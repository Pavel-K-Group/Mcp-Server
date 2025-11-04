import { z } from 'zod'
import type { ToolDefinition } from '../types/tool.js'
import { db } from '../database/client.js'
import { block } from '../database/schema.js'
import { eq, and, isNull } from 'drizzle-orm'

/**
 * Интерфейс для входных данных обновления тудушки
 */
interface UpdateTodoInput {
    todoId: string
    title?: string
    description?: string
    completed?: boolean
    priority?: 'low' | 'medium' | 'high'
    dueDate?: string | null
    tags?: string[]
    projectId?: string | null
}

/**
 * Инструмент для обновления тудушек
 */
async function updateTodo(input: UpdateTodoInput) {
    // Захардкодим userId своего аккаунта на dev supabase cloud
    const userId = 'htN0Vg2p7OA70Hx3sg0R21DDnHZl7ndT'

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
            throw new Error('Задача не найдена или у вас нет прав на её изменение')
        }

        // Получаем существующий content
        const existingContent = (existingTodo.content as any) || {}

        // Формируем обновленный content
        const updatedContent = {
            description:
                input.description !== undefined
                    ? input.description
                    : existingContent.description || '',
            completed:
                input.completed !== undefined
                    ? input.completed
                    : existingContent.completed || false,
            priority:
                input.priority !== undefined
                    ? input.priority
                    : existingContent.priority || 'low',
            dueDate:
                input.dueDate !== undefined ? input.dueDate : existingContent.dueDate || null,
            projectId:
                input.projectId !== undefined
                    ? input.projectId
                    : existingContent.projectId || null,
        }

        // Формируем объект обновления
        const updateData: any = {
            content: updatedContent,
            updatedAt: new Date().toISOString(),
        }

        // Обновляем title если он передан
        if (input.title !== undefined) {
            updateData.title = input.title
        }

        // Обновляем tags если они переданы
        if (input.tags !== undefined) {
            updateData.tags = input.tags
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
                    dueDate: updatedContent.dueDate,
                    tags: updatedTodo.tags,
                    projectId: updatedContent.projectId,
                    parentId: updatedTodo.parentId,
                    position: updatedTodo.position,
                    createdAt: updatedTodo.createdAt,
                    updatedAt: updatedTodo.updatedAt,
                },
            },
            message: `Задача "${updatedTodo.title}" успешно обновлена`,
        }
    } catch (error) {
        return {
            success: false,
            operation: 'update',
            error: error instanceof Error ? error.message : 'Неизвестная ошибка',
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
    dueDate: z.string().optional().nullable().describe('Новая дата выполнения (ISO string)'),
    tags: z.array(z.string()).optional().describe('Новые теги для задачи'),
    projectId: z.string().optional().nullable().describe('Новый ID проекта'),
}

// Экспортируем определение инструмента
export const toolDefinition: ToolDefinition = {
    name: 'updateTodo',
    description:
        'Updates specified fields of an existing todo. Only provided fields are changed, others remain unchanged. Verifies ownership and updates updatedAt timestamp. Required: todoId (string). Optional: title, description, completed (boolean), priority (low/medium/high), dueDate (ISO string or null), tags (array), projectId (string or null).',
    inputSchema: inputSchema,
    handler: async (input: unknown) => {
        try {
            const parsed = z.object(inputSchema).parse(input)

            // Проверяем, что todoId присутствует
            if (!parsed.todoId) {
                throw new Error('todoId обязателен - укажите ID задачи для обновления')
            }

            const result = await updateTodo(parsed as UpdateTodoInput)
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

