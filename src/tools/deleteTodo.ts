import { z } from 'zod'
import type { ToolDefinition } from '../types/tool.js'
import { db } from '../database/client.js'
import { block } from '../database/schema.js'
import { eq, and, isNull } from 'drizzle-orm'
import { getTodoListId, getAgentId, getUserId } from '../context/sessionContext.js'

/**
 * Интерфейс для входных данных удаления тудушки
 */
interface DeleteTodoInput {
    todoId: string
    permanent?: boolean
}

/**
 * Инструмент для удаления тудушек
 */
async function deleteTodo(input: DeleteTodoInput) {
    // Берем данные из контекста сессии
    const userId = getUserId()
    const todoListId = getTodoListId()
    const agentId = getAgentId()
    
    if (!userId) {
        throw new Error('User not authenticated. Session userId is required.')
    }
    
    console.log(`🗑️ deleteTodo: todo=${input.todoId?.slice(0, 8)}, user=${userId?.slice(0, 8)}, agent=${agentId?.slice(0, 8) || 'none'}, permanent=${input.permanent || false}`)

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
            throw new Error('Task not found or you do not have permission to delete it')
        }

        const todoTitle = existingTodo.title

        if (input.permanent) {
            // Полное удаление из базы данных
            await db
                .delete(block)
                .where(
                    and(
                        eq(block.id, input.todoId),
                        eq(block.userId, userId),
                        eq(block.type, 'todo'),
                    ),
                )

            return {
                success: true,
                operation: 'delete',
                data: {
                    todoId: input.todoId,
                    permanent: true,
                },
                message: `Task "${todoTitle}" permanently deleted from database`,
            }
        } else {
            // Soft delete - set deletedAt
            const [deletedTodo] = await db
                .update(block)
                .set({
                    deletedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                })
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
                operation: 'delete',
                data: {
                    todoId: deletedTodo.id,
                    deletedAt: deletedTodo.deletedAt,
                    permanent: false,
                },
                message: `Task "${todoTitle}" moved to trash (can be restored)`,
            }
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown database error'
        console.error(`❌ deleteTodo error: ${errorMessage}`)
        return {
            success: false,
            operation: 'delete',
            error: errorMessage,
            message: `Failed to delete task: ${errorMessage}`,
        }
    }
}

// Схема для валидации входных данных
const inputSchema = {
    todoId: z.string().describe('ID задачи для удаления (обязательно)'),
    permanent: z
        .boolean()
        .optional()
        .describe(
            'Безвозвратное удаление (true) или перемещение в корзину (false, по умолчанию)',
        ),
}

// Экспортируем определение инструмента
export const toolDefinition: ToolDefinition = {
    name: 'deleteTodo',
    description:
        'Deletes a todo item. Soft delete (default): sets deletedAt timestamp, can be restored with restoreTodo. Hard delete (permanent=true): removes from database permanently, cannot be restored. Required: todoId (string). Optional: permanent (boolean, default false).',
    inputSchema: inputSchema,
    handler: async (input: unknown) => {
        try {
            const parsed = z.object(inputSchema).parse(input)

            if (!parsed.todoId) {
                throw new Error('todoId is required - specify the task ID to delete')
            }

            const result = await deleteTodo(parsed as DeleteTodoInput)
            return {
                content: [
                    { type: 'text' as const, text: JSON.stringify(result, null, 2) },
                ],
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            const result = {
                success: false,
                operation: 'delete',
                error: errorMessage,
                message: `Failed to delete task: ${errorMessage}`,
            }
            return {
                content: [
                    { type: 'text' as const, text: JSON.stringify(result, null, 2) },
                ],
            }
        }
    },
}

