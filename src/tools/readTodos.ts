import { z } from 'zod'
import type { ToolDefinition } from '../types/tool.js'
import { db } from '../database/client.js'
import { block } from '../database/schema.js'
import { eq, and, isNull, desc, asc } from 'drizzle-orm'

/**
 * Упрощенный интерфейс для чтения тудушек - только parentId и опциональный limit
 */
interface SimpleTodoSearchInput {
    parentId: string
    limit?: number
}

/**
 * Инструмент для чтения тудушек
 */
async function readTodos(input: SimpleTodoSearchInput) {
    // Захардкодим userId своего аккаунта на dev supabase cloud
    const userId = 'htN0Vg2p7OA70Hx3sg0R21DDnHZl7ndT'
    // Используем parentId из входных параметров
    const parentId = input.parentId

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
                const content = (todo.content as any) || {}
                return {
                    id: todo.id,
                    title: todo.title,
                    description: content.description || '',
                    completed: content.completed || false,
                    priority: content.priority || 'low',
                    dueDate: content.dueDate || null,
                    tags: todo.tags || [],
                    projectId: content.projectId || null,
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
                const content = (todo.content as any) || {}
                return {
                    id: todo.id,
                    title: todo.title,
                    description: content.description || '',
                    completed: content.completed || false,
                    priority: content.priority || 'low',
                    dueDate: content.dueDate || null,
                    tags: todo.tags || [],
                    projectId: content.projectId || null,
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
    parentId: z
        .string()
        .describe('ID родительского блока (получается агентом из контекста)'),
    limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe('Количество задач для получения (1-100, например 10 последних)'),
}

// Экспортируем определение инструмента
export const toolDefinition: ToolDefinition = {
    name: 'readTodos',
    description:
        'Retrieves a list of todos from a specified parent block. Returns all todos or a limited number sorted by creation date. Excludes soft-deleted items (deletedAt != null). Required: parentId (string). Optional: limit (number, 1-100).',
    inputSchema: inputSchema,
    handler: async (input: unknown) => {
        try {
            const parsed = z.object(inputSchema).parse(input)

            // Проверяем, что parentId присутствует
            if (!parsed.parentId) {
                throw new Error('parentId обязателен - передайте ID блока из контекста')
            }

            const result = await readTodos(parsed as SimpleTodoSearchInput)
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
