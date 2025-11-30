import { z } from 'zod'
import type { ToolDefinition } from '../types/tool.js'
import { db } from '../database/client.js'
import { block } from '../database/schema.js'
import { eq, and, isNull, desc, asc } from 'drizzle-orm'
import { getTodoListId, getAgentId, getUserId } from '../context/sessionContext.js'

/**
 * Входные данные для чтения задач
 */
interface ReadTodosInput {
    limit?: number
}

/**
 * Получение списка задач
 */
async function readTodos(input: ReadTodosInput) {
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
    
    console.log(`📖 readTodos: userId=${userId}, parentId=${parentId}, agentId=${agentId || 'not set'}`)

    try {
        if (input.limit) {
            // Получить ограниченное количество задач (последние по дате создания)
            const limitedTodos = await db
                .select()
                .from(block)
                .where(
                    and(
                        eq(block.userId, userId),
                        eq(block.type, 'todo'),
                        eq(block.parentId, parentId),
                        isNull(block.deletedAt),
                    ),
                )
                .orderBy(desc(block.createdAt))
                .limit(input.limit)

            // Добавляем позицию для удобства
            const numberedTodos = limitedTodos.map((todo, index) => {
                const content = (todo.content as Record<string, unknown>) || {}
                return {
                    id: todo.id,
                    title: todo.title,
                    description: (content.description as string) || '',
                    completed: (content.completed as boolean) || false,
                    priority: (content.priority as 'low' | 'medium' | 'high') || 'low',
                    tags: (todo.tags as string[]) || [],
                    createdAt: todo.createdAt,
                    updatedAt: todo.updatedAt,
                    position: index + 1,
                }
            })

            return {
                success: true,
                operation: 'read',
                data: {
                    todos: numberedTodos,
                    count: numberedTodos.length,
                },
                message: `Найдено ${numberedTodos.length} последних задач`,
            }
        } else {
            // Получить пронумерованный список всех тудушек
            const userTodos = await db
                .select()
                .from(block)
                .where(
                    and(
                        eq(block.userId, userId),
                        eq(block.type, 'todo'),
                        eq(block.parentId, parentId),
                        isNull(block.deletedAt),
                    ),
                )
                .orderBy(asc(block.position), desc(block.createdAt))

            // Добавляем позицию для удобства
            const numberedTodos = userTodos.map((todo, index) => {
                const content = (todo.content as Record<string, unknown>) || {}
                return {
                    id: todo.id,
                    title: todo.title,
                    description: (content.description as string) || '',
                    completed: (content.completed as boolean) || false,
                    priority: (content.priority as 'low' | 'medium' | 'high') || 'low',
                    tags: (todo.tags as string[]) || [],
                    createdAt: todo.createdAt,
                    updatedAt: todo.updatedAt,
                    position: index + 1,
                }
            })

            return {
                success: true,
                operation: 'read',
                data: {
                    todos: numberedTodos,
                    count: numberedTodos.length,
                },
                message: `Найдено ${numberedTodos.length} задач`,
            }
        }
    } catch (error) {
        return {
            success: false,
            operation: 'read',
            error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        }
    }
}

// Схема для валидации входных данных
const inputSchema = {
    limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe('Number of tasks to retrieve (1-100). If not specified, returns all tasks'),
}

// Экспортируем определение инструмента
export const toolDefinition: ToolDefinition = {
    name: 'readTodos',
    description:
        'Get list of tasks. Returns all tasks by default. Optional: limit (number 1-100) to get only recent tasks.',
    inputSchema: inputSchema,
    handler: async (input: unknown) => {
        try {
            const parsed = z.object(inputSchema).parse(input)

            const result = await readTodos(parsed as ReadTodosInput)
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
