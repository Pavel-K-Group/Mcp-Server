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
 * Получение списка задач агента
 * Возвращает только задачи, назначенные на текущего агента (assigneeId = agentId)
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
    
    if (!agentId) {
        throw new Error('Agent not identified. Session agentId is required.')
    }
    
    console.log(`📖 readTodos: userId=${userId}, parentId=${parentId}, agentId=${agentId}`)

    try {
        // Получаем все задачи компании
        const allTodos = await db
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
        
        // Фильтруем только задачи, назначенные на текущего агента
        const agentTodos = allTodos.filter((todo) => {
            const content = (todo.content as Record<string, unknown>) || {}
            return content.assigneeId === agentId
        })
        
        // Применяем limit если указан
        const limitedTodos = input.limit 
            ? agentTodos.slice(0, input.limit)
            : agentTodos

        // Форматируем для вывода
        const formattedTodos = limitedTodos.map((todo, index) => {
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
                todos: formattedTodos,
                count: formattedTodos.length,
            },
            message: `Found ${formattedTodos.length} task(s)`,
        }
    } catch (error) {
        return {
            success: false,
            operation: 'read',
            error: error instanceof Error ? error.message : 'Unknown error',
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
