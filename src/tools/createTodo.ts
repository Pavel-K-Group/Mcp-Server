import { z } from 'zod'
import type { ToolDefinition } from '../types/tool.js'
import { db } from '../database/client.js'
import { block } from '../database/schema.js'
import { eq, and, isNull } from 'drizzle-orm'
import { 
    getTodoListId, 
    getAgentId, 
    getUserId, 
    getIpAddress, 
    getUserAgent, 
    getSessionId 
} from '../context/sessionContext.js'
import { validateAndSanitize } from '../utils/sanitize.js'
import { checkTodoCreationRateLimit } from '../utils/rateLimiter.js'
import { 
    logBlockedAttempt, 
    logRateLimitExceeded, 
    logSuspiciousActivity 
} from '../utils/securityLogger.js'

/**
 * Входные данные для создания задачи
 */
interface CreateTodoInput {
    title: string
    description?: string
    priority?: 'low' | 'medium' | 'high'
    tags?: string[]
}

/**
 * Создание новой задачи
 */
async function createTodo(input: CreateTodoInput) {
    // Берем данные из контекста сессии
    const userId = getUserId()
    const parentId = getTodoListId()
    const agentId = getAgentId()
    const ipAddress = getIpAddress()
    const userAgent = getUserAgent()
    const sessionId = getSessionId()
    
    if (!userId) {
        throw new Error('User not authenticated. Session userId is required.')
    }
    
    if (!parentId) {
        throw new Error('Session not configured. todoListId is required.')
    }
    
    // Проверка rate limiting
    const rateLimitCheck = checkTodoCreationRateLimit(userId)
    if (!rateLimitCheck.allowed) {
        logRateLimitExceeded('createTodo', {
            userId,
            sessionId,
            ipAddress,
            userAgent,
            resetTime: rateLimitCheck.resetTime,
        })
        throw new Error(`Rate limit exceeded. Maximum ${rateLimitCheck.remaining === 0 ? 10 : rateLimitCheck.remaining} tasks per minute. Try again later.`)
    }
    
    // Валидация и санитизация title
    const titleValidation = validateAndSanitize(input.title || '', 200)
    if (!titleValidation.isValid) {
        logBlockedAttempt('createTodo', 'Title validation failed', {
            userId,
            sessionId,
            ipAddress,
            userAgent,
            errors: titleValidation.errors,
            input: input.title,
        })
        throw new Error(`Title validation failed: ${titleValidation.errors.join(', ')}`)
    }
    
    if (!titleValidation.isSafe) {
        logBlockedAttempt('createTodo', 'Malicious content detected in title', {
            userId,
            sessionId,
            ipAddress,
            userAgent,
            threats: titleValidation.threats,
            input: input.title,
        })
        throw new Error('Malicious content detected in title. Request blocked for security reasons.')
    }
    
    // Валидация и санитизация description
    const descriptionValidation = validateAndSanitize(input.description || '', 2000)
    if (!descriptionValidation.isValid) {
        logBlockedAttempt('createTodo', 'Description validation failed', {
            userId,
            sessionId,
            ipAddress,
            userAgent,
            errors: descriptionValidation.errors,
            input: input.description,
        })
        throw new Error(`Description validation failed: ${descriptionValidation.errors.join(', ')}`)
    }
    
    if (!descriptionValidation.isSafe) {
        logBlockedAttempt('createTodo', 'Malicious content detected in description', {
            userId,
            sessionId,
            ipAddress,
            userAgent,
            threats: descriptionValidation.threats,
            input: input.description,
        })
        throw new Error('Malicious content detected in description. Request blocked for security reasons.')
    }
    
    // Логируем подозрительную активность если есть угрозы, но они были заблокированы
    if (titleValidation.threats.length > 0 || descriptionValidation.threats.length > 0) {
        logSuspiciousActivity('createTodo', 'Suspicious patterns detected and blocked', {
            userId,
            sessionId,
            ipAddress,
            userAgent,
            threats: [...titleValidation.threats, ...descriptionValidation.threats],
        })
    }
    
    // Используем санитизированные значения
    const sanitizedTitle = titleValidation.sanitized
    const sanitizedDescription = descriptionValidation.sanitized
    
    console.log(`✏️ createTodo: title="${sanitizedTitle?.slice(0, 30)}...", user=${userId?.slice(0, 8)}, parent=${parentId?.slice(0, 8)}, agent=${agentId?.slice(0, 8) || 'none'}`)

    try {
        // Подготавливаем контент для JSONB поля
        // assigneeId автоматически назначается на агента, создавшего задачу
        const content = {
            description: input.description || '',
            completed: false,
            priority: input.priority || 'low',
            ...(agentId && { assigneeId: agentId }),
        }

        // Валидация и санитизация tags
        const sanitizedTags: string[] = []
        if (input.tags && Array.isArray(input.tags)) {
            for (const tag of input.tags) {
                if (typeof tag === 'string') {
                    const tagValidation = validateAndSanitize(tag, 50)
                    if (tagValidation.isSafe && tagValidation.isValid) {
                        sanitizedTags.push(tagValidation.sanitized)
                    }
                }
            }
        }
        
        // Создаем новый блок типа todo с обязательным parentId (position не указываем - будет null)
        const insertData = {
            userId,
            type: 'todo' as const,
            title: sanitizedTitle,
            content: {
                ...content,
                description: sanitizedDescription,
            },
            tags: sanitizedTags,
            parentId,
            hasChildren: false,
            archived: false,
        }

        const [newTodo] = await db.insert(block).values(insertData).returning()

        return {
            success: true,
            operation: 'create',
            data: {
                todo: {
                    id: newTodo.id,
                    title: newTodo.title,
                    description: sanitizedDescription,
                    completed: content.completed,
                    priority: content.priority,
                    assigneeId: agentId || null,
                    tags: newTodo.tags,
                    parentId: newTodo.parentId,
                    position: newTodo.position,
                    createdAt: newTodo.createdAt,
                    updatedAt: newTodo.updatedAt,
                },
            },
            message: `Task "${sanitizedTitle}" created successfully`,
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown database error'
        console.error(`❌ createTodo error: ${errorMessage}`)
        return {
            success: false,
            operation: 'create',
            error: errorMessage,
            message: `Failed to create task: ${errorMessage}`,
        }
    }
}

// Схема для валидации входных данных
const inputSchema = {
    title: z.string().describe('Task title'),
    description: z.string().optional().describe('Detailed task description'),
    priority: z.enum(['low', 'medium', 'high']).optional().describe('Task priority: low, medium, or high'),
    tags: z.array(z.string()).optional().describe('Tags for task categorization'),
}

// Экспортируем определение инструмента
export const toolDefinition: ToolDefinition = {
    name: 'createTodo',
    description:
        'Create a new task. Required: title (string). Optional: description (string), priority (low/medium/high), tags (array of strings).',
    inputSchema: inputSchema,
    handler: async (input: unknown) => {
        try {
            const parsed = z.object(inputSchema).parse(input)

            if (!parsed.title) {
                throw new Error('Title is required')
            }

            const result = await createTodo(parsed as CreateTodoInput)
            return {
                content: [
                    { type: 'text' as const, text: JSON.stringify(result, null, 2) },
                ],
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            const result = {
                success: false,
                operation: 'create',
                error: errorMessage,
                message: `Failed to create task: ${errorMessage}`,
            }
            return {
                content: [
                    { type: 'text' as const, text: JSON.stringify(result, null, 2) },
                ],
            }
        }
    },
}
