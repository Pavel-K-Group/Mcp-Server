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
import { 
    logBlockedAttempt, 
    logSuspiciousActivity 
} from '../utils/securityLogger.js'

/**
 * Интерфейс для входных данных обновления тудушки
 */
interface UpdateTodoInput {
    todoId: string
    title?: string
    description?: string
    completed?: boolean
    priority?: 'low' | 'medium' | 'high'
    tags?: string[]
}

/**
 * Инструмент для обновления тудушек
 */
async function updateTodo(input: UpdateTodoInput) {
    // Берем данные из контекста сессии
    const userId = getUserId()
    const todoListId = getTodoListId()
    const agentId = getAgentId()
    const ipAddress = getIpAddress()
    const userAgent = getUserAgent()
    const sessionId = getSessionId()
    
    if (!userId) {
        throw new Error('User not authenticated. Session userId is required.')
    }
    
    // Валидация и санитизация title если он передан
    let sanitizedTitle: string | undefined = undefined
    if (input.title !== undefined) {
        const titleValidation = validateAndSanitize(input.title, 200)
        if (!titleValidation.isValid) {
            logBlockedAttempt('updateTodo', 'Title validation failed', {
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
            logBlockedAttempt('updateTodo', 'Malicious content detected in title', {
                userId,
                sessionId,
                ipAddress,
                userAgent,
                threats: titleValidation.threats,
                input: input.title,
            })
            throw new Error('Malicious content detected in title. Request blocked for security reasons.')
        }
        
        sanitizedTitle = titleValidation.sanitized
        
        if (titleValidation.threats.length > 0) {
            logSuspiciousActivity('updateTodo', 'Suspicious patterns detected and blocked in title', {
                userId,
                sessionId,
                ipAddress,
                userAgent,
                threats: titleValidation.threats,
            })
        }
    }
    
    // Валидация и санитизация description если он передан
    let sanitizedDescription: string | undefined = undefined
    if (input.description !== undefined) {
        const descriptionValidation = validateAndSanitize(input.description, 2000)
        if (!descriptionValidation.isValid) {
            logBlockedAttempt('updateTodo', 'Description validation failed', {
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
            logBlockedAttempt('updateTodo', 'Malicious content detected in description', {
                userId,
                sessionId,
                ipAddress,
                userAgent,
                threats: descriptionValidation.threats,
                input: input.description,
            })
            throw new Error('Malicious content detected in description. Request blocked for security reasons.')
        }
        
        sanitizedDescription = descriptionValidation.sanitized
        
        if (descriptionValidation.threats.length > 0) {
            logSuspiciousActivity('updateTodo', 'Suspicious patterns detected and blocked in description', {
                userId,
                sessionId,
                ipAddress,
                userAgent,
                threats: descriptionValidation.threats,
            })
        }
    }
    
    console.log(`📝 updateTodo: todo=${input.todoId?.slice(0, 8)}, user=${userId?.slice(0, 8)}, agent=${agentId?.slice(0, 8) || 'none'}`)

    try {
        // Проверяем существование задачи
        const [existingTodo] = await db
            .select()
            .from(block)
            .where(
                and(
                    eq(block.id, input.todoId),
                    eq(block.userId, userId),
                    eq(block.type, 'todo'),
                    isNull(block.deletedAt),
                ),
            )
            .limit(1)

        if (!existingTodo) {
            throw new Error('Task not found or you do not have permission to update it')
        }

        // Получаем существующий content
        const existingContent = (existingTodo.content as Record<string, unknown>) || {}

        // Формируем обновленный content
        const updatedContent = {
            description:
                sanitizedDescription !== undefined
                    ? sanitizedDescription
                    : (existingContent.description as string) || '',
            completed:
                input.completed !== undefined
                    ? input.completed
                    : (existingContent.completed as boolean) || false,
            priority:
                input.priority !== undefined
                    ? input.priority
                    : (existingContent.priority as 'low' | 'medium' | 'high') || 'low',
        }

        // Формируем объект обновления
        const updateData: Record<string, unknown> = {
            content: updatedContent,
            updatedAt: new Date().toISOString(),
        }

        // Обновляем title если он передан (используем санитизированное значение)
        if (sanitizedTitle !== undefined) {
            updateData.title = sanitizedTitle
        }

        // Обновляем tags если они переданы (с санитизацией)
        if (input.tags !== undefined && Array.isArray(input.tags)) {
            const sanitizedTags: string[] = []
            for (const tag of input.tags) {
                if (typeof tag === 'string') {
                    const tagValidation = validateAndSanitize(tag, 50)
                    if (tagValidation.isSafe && tagValidation.isValid) {
                        sanitizedTags.push(tagValidation.sanitized)
                    }
                }
            }
            updateData.tags = sanitizedTags
        }

        // Выполняем обновление
        const [updatedTodo] = await db
            .update(block)
            .set(updateData)
            .where(
                and(
                    eq(block.id, input.todoId),
                    eq(block.userId, userId),
                    eq(block.type, 'todo'),
                    isNull(block.deletedAt),
                ),
            )
            .returning()

        return {
            success: true,
            operation: 'update',
            data: {
                todo: {
                    id: updatedTodo.id,
                    title: updatedTodo.title,
                    description: updatedContent.description,
                    completed: updatedContent.completed,
                    priority: updatedContent.priority,
                    tags: updatedTodo.tags,
                    parentId: updatedTodo.parentId,
                    position: updatedTodo.position,
                    createdAt: updatedTodo.createdAt,
                    updatedAt: updatedTodo.updatedAt,
                },
            },
            message: `Task "${updatedTodo.title}" updated successfully`,
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown database error'
        console.error(`❌ updateTodo error: ${errorMessage}`)
        return {
            success: false,
            operation: 'update',
            error: errorMessage,
            message: `Failed to update task: ${errorMessage}`,
        }
    }
}

// Схема для валидации входных данных
const inputSchema = {
    todoId: z.string().describe('ID задачи для обновления (обязательно)'),
    title: z.string().optional().describe('Новое название задачи'),
    description: z.string().optional().describe('Новое описание задачи'),
    completed: z.boolean().optional().describe('Статус выполнения задачи (true/false)'),
    priority: z.enum(['low', 'medium', 'high']).optional().describe('Новый приоритет задачи'),
    tags: z.array(z.string()).optional().describe('Новые теги для задачи'),
}

// Экспортируем определение инструмента
export const toolDefinition: ToolDefinition = {
    name: 'updateTodo',
    description:
        'Updates specified fields of an existing todo. Only provided fields are changed, others remain unchanged. Verifies ownership and updates updatedAt timestamp. Required: todoId (string). Optional: title, description, completed (boolean), priority (low/medium/high), tags (array).',
    inputSchema: inputSchema,
    handler: async (input: unknown) => {
        try {
            const parsed = z.object(inputSchema).parse(input)

            if (!parsed.todoId) {
                throw new Error('todoId is required - specify the task ID to update')
            }

            const result = await updateTodo(parsed as UpdateTodoInput)
            return {
                content: [
                    { type: 'text' as const, text: JSON.stringify(result, null, 2) },
                ],
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            const result = {
                success: false,
                operation: 'update',
                error: errorMessage,
                message: `Failed to update task: ${errorMessage}`,
            }
            return {
                content: [
                    { type: 'text' as const, text: JSON.stringify(result, null, 2) },
                ],
            }
        }
    },
}

