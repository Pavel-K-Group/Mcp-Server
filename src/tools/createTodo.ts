import { z } from 'zod'
import type { ToolDefinition } from '../types/tool.js'
import { db } from '../database/client.js'
import { block } from '../database/schema.js'
import { eq, and, isNull, desc, asc } from 'drizzle-orm'

/**
 * Интерфейс для входных данных создания тудушки
 */
interface CreateTodoInput {
    title: string
    parentId: string
    description?: string
    priority?: 'low' | 'medium' | 'high'
    dueDate?: string | null
    tags?: string[]
    projectId?: string | null
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
        // Определяем приоритет как число
        const priorityMap = {
            low: 0,
            medium: 1,
            high: 2,
        }
        const priorityNumber = priorityMap[input.priority || 'low']

        // Подготавливаем контент для JSONB поля
        const content = {
            description: input.description || '',
            completed: false,
            priority: input.priority || 'low',
            dueDate: input.dueDate || null,
            projectId: input.projectId || null,
        }

        // Получаем следующую позицию для нового блока
        const lastBlock = await db
            .select({ position: block.position })
            .from(block)
            .where(
                and(
                    eq(block.userId, userId),
                    eq(block.type, 'todo'),
                    isNull(block.deletedAt),
                ),
            )
            .orderBy(desc(block.position))
            .limit(1)

        const nextPosition = lastBlock.length > 0 ? lastBlock[0].position + 1 : 1024

        // Создаем новый блок типа todo с обязательным parentId
        const insertData = {
            userId,
            type: 'todo' as const,
            title: input.title,
            content,
            tags: input.tags || [],
            position: nextPosition,
            parentId, // Всегда используем захардкоженный parentId
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
                    dueDate: content.dueDate,
                    tags: newTodo.tags,
                    projectId: content.projectId,
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
    dueDate: z.string().optional().describe('Дата выполнения (ISO string)'),
    tags: z.array(z.string()).optional().describe('Теги для задачи'),
    projectId: z.string().optional().describe('ID проекта'),
}

// Экспортируем определение инструмента
export const toolDefinition: ToolDefinition = {
    name: 'createTodo',
    description:
        'Создать новую задачу с названием, описанием, приоритетом, датой выполнения и тегами. ВАЖНО: Для работы инструмента необходимо передать parentId - ID блока, в котором создается задача. Этот ID агент получает из контекста webhook запроса.',
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
