import { z } from 'zod'
import type { ToolDefinition } from '../types/tool.js'
import { db } from '../database/client.js'
import { block } from '../database/schema.js'
import { eq, and, isNull } from 'drizzle-orm'
import { getTodoListId, getAgentId, getUserId } from '../context/sessionContext.js'

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
    
    if (!userId) {
        throw new Error('User not authenticated. Session userId is required.')
    }
    
    if (!parentId) {
        throw new Error('Session not configured. todoListId is required.')
    }
    
    console.log(`✏️ createTodo: "${input.title}", userId=${userId}, parentId=${parentId}, agentId=${agentId || 'not set'}`)

    try {
        // Подготавливаем контент для JSONB поля
        // assigneeId автоматически назначается на агента, создавшего задачу
        const content = {
            description: input.description || '',
            completed: false,
            priority: input.priority || 'low',
            ...(agentId && { assigneeId: agentId }),
        }

        // Создаем новый блок типа todo с обязательным parentId (position не указываем - будет null)
        const insertData = {
            userId,
            type: 'todo' as const,
            title: input.title,
            content,
            tags: input.tags || [],
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
                    description: content.description,
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
            message: `Task "${input.title}" created successfully`,
        }
    } catch (error) {
        return {
            success: false,
            operation: 'create',
            error: error instanceof Error ? error.message : 'Неизвестная ошибка',
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

            // Проверяем, что обязательные поля присутствуют
            if (!parsed.title) {
                throw new Error('Название задачи обязательно')
            }

            const result = await createTodo(parsed as CreateTodoInput)
            return {
                content: [
                    { type: 'text' as const, text: JSON.stringify(result, null, 2) },
                ],
            }
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `Ошибка: ${
                            error instanceof Error ? error.message : String(error)
                        }`,
                    },
                ],
            }
        }
    },
}
