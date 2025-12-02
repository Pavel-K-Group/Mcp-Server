import { z } from 'zod'
import type { ToolDefinition } from '../types/tool.js'
import { db } from '../database/client.js'
import { block } from '../database/schema.js'
import { eq, and, isNull } from 'drizzle-orm'
import { getTodoListId, getAgentId, getUserId } from '../context/sessionContext.js'

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
    
    if (!userId) {
        throw new Error('User not authenticated. Session userId is required.')
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
                input.description !== undefined
                    ? input.description
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

