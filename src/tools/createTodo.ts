import { z } from 'zod'
import type { ToolDefinition } from '../types/tool.js'
import { db } from '../database/client.js'
import { block } from '../database/schema.js'
import { eq, and, isNull } from 'drizzle-orm'

/**
 * Интерфейс для входных данных создания тудушки
 */
interface CreateTodoInput {
    title: string
    parentId: string
    description?: string
    priority?: 'low' | 'medium' | 'high'
    tags?: string[]
}

/**
 * Инструмент для создания тудушек
 */
async function createTodo(input: CreateTodoInput) {
    // Захардкодим userId своего аккаунта на dev supabase cloud
    const userId = 'htN0Vg2p7OA70Hx3sg0R21DDnHZl7ndT'
    // Используем parentId из входных параметров
    const parentId = input.parentId

    try {
        // Подготавливаем контент для JSONB поля
        const content = {
            description: input.description || '',
            completed: false,
            priority: input.priority || 'low',
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
                    tags: newTodo.tags,
                    parentId: newTodo.parentId,
                    position: newTodo.position,
                    createdAt: newTodo.createdAt,
                    updatedAt: newTodo.updatedAt,
                },
            },
            message: `Задача "${input.title}" успешно создана`,
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
    title: z.string().describe('Название задачи (обязательно)'),
    parentId: z
        .string()
        .describe('ID родительского блока (получается агентом из контекста)'),
    description: z.string().optional().describe('Описание задачи'),
    priority: z.enum(['low', 'medium', 'high']).optional().describe('Приоритет задачи'),
    tags: z.array(z.string()).optional().describe('Теги для задачи'),
}

// Экспортируем определение инструмента
export const toolDefinition: ToolDefinition = {
    name: 'createTodo',
    description:
        'Creates a new todo item in the specified parent block. Automatically sets completed=false. Required: title (string), parentId (string). Optional: description (string), priority (low/medium/high), tags (array).',
    inputSchema: inputSchema,
    handler: async (input: unknown) => {
        try {
            const parsed = z.object(inputSchema).parse(input)

            // Проверяем, что обязательные поля присутствуют
            if (!parsed.title) {
                throw new Error('Название задачи обязательно')
            }
            if (!parsed.parentId) {
                throw new Error('parentId обязателен - передайте ID блока из контекста')
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
