import { z } from 'zod'
import type { ToolDefinition } from '../types/tool.js'
import { db } from '../database/client.js'
import { block } from '../database/schema.js'
import { eq, and, isNull, desc, ilike, asc } from 'drizzle-orm'
import type { TodoSearchInput } from '../types/todo.js'

/**
 * Инструмент для чтения тудушек
 */
async function readTodos(input: TodoSearchInput) {
    // Захардкодим userId своего аккаунта на dev supabase cloud
    const userId = 'htN0Vg2p7OA70Hx3sg0R21DDnHZl7ndT'
    // Захардкодим parentId нашего INBOX (тот же, что в createTodo.ts)
    const parentId = 'e130ec09-d4bf-40de-9d54-137a572527ac'

    try {
        if (input.todoId) {
            // Поиск по точному ID
            const result = await db
                .select()
                .from(block)
                .where(
                    and(
                        eq(block.id, input.todoId),
                        eq(block.userId, userId),
                        eq(block.type, 'todo'),
                        eq(block.parentId, parentId),
                        isNull(block.deletedAt),
                    ),
                )
                .limit(1)

            if (result.length === 0) {
                return {
                    success: false,
                    operation: 'read',
                    error: 'Задача не найдена',
                }
            }

            const todo = result[0]
            const content = (todo.content as any) || {}

            return {
                success: true,
                operation: 'read',
                data: {
                    todo: {
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
                    },
                },
                message: `Задача найдена: ${todo.title}`,
            }
        } else if (input.position) {
            // Поиск по позиции в списке
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

            if (input.position < 1 || input.position > allTodos.length) {
                return {
                    success: false,
                    operation: 'read',
                    error: `Позиция ${input.position} не найдена. Всего задач: ${allTodos.length}`,
                }
            }

            const todo = allTodos[input.position - 1]
            const content = (todo.content as any) || {}

            return {
                success: true,
                operation: 'read',
                data: {
                    todo: {
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
                        position: input.position,
                    },
                },
                message: `Задача найдена по позиции ${input.position}: ${todo.title}`,
            }
        } else if (input.titleSearch) {
            // Поиск по части названия
            const result = await db
                .select()
                .from(block)
                .where(
                    and(
                        eq(block.userId, userId),
                        eq(block.type, 'todo'),
                        eq(block.parentId, parentId),
                        ilike(block.title || '', `%${input.titleSearch}%`),
                        isNull(block.deletedAt),
                    ),
                )
                .limit(1)

            if (result.length === 0) {
                return {
                    success: false,
                    operation: 'read',
                    error: `Задачи с названием содержащим "${input.titleSearch}" не найдены`,
                }
            }

            const todo = result[0]
            const content = (todo.content as any) || {}

            return {
                success: true,
                operation: 'read',
                data: {
                    todo: {
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
                    },
                },
                message: `Задача найдена по поиску "${input.titleSearch}": ${todo.title}`,
            }
        } else if (input.limit) {
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
    todoId: z.string().optional().describe('Точный ID задачи (если известен)'),
    position: z.number().optional().describe('Номер задачи в списке (1, 2, 3...)'),
    titleSearch: z.string().optional().describe('Поиск по части названия задачи'),
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
        'Получить список задач пользователя. Можно найти по ID, позиции в списке, поиску по названию, ограничить количество (например, 10 последних) или получить все задачи.',
    inputSchema: inputSchema,
    handler: async (input: unknown) => {
        try {
            const parsed = z.object(inputSchema).parse(input)
            const result = await readTodos(parsed)
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
