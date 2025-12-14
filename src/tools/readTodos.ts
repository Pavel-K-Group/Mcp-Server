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
    /** Показать все задачи (включая бэклог). По умолчанию false — только задачи в фокусе */
    showAll?: boolean
    /** Показать ТОЛЬКО выполненные задачи (для отчёта). По умолчанию false — только активные */
    showCompleted?: boolean
}

/**
 * Получение списка задач агента
 * 
 * По умолчанию возвращает только:
 * - Задачи, назначенные на текущего агента (assigneeId = agentId)
 * - Задачи в фокусе (если режим фокуса включен)
 * - Невыполненные задачи
 * 
 * Параметры:
 * - showAll: true — показать все задачи, включая бэклог
 * - showCompleted: true — включить выполненные задачи
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
    
    const { showAll = false, showCompleted = false } = input
    
    // === VERSION 2.0 - WITH FILTERING ===
    console.log(`📖 readTodos v2.0: userId=${userId?.slice(0, 8)}, parentId=${parentId?.slice(0, 8)}, agentId=${agentId?.slice(0, 8)}, showAll=${showAll}, showCompleted=${showCompleted}`)

    try {
        // Сначала получаем контейнер (todoList) для чтения настроек фокуса
        const [container] = await db
            .select()
            .from(block)
            .where(
                and(
                    eq(block.id, parentId),
                    eq(block.userId, userId),
                    isNull(block.deletedAt),
                ),
            )
            .limit(1)
        
        // Читаем настройки фокуса из контейнера
        const containerContent = (container?.content as Record<string, unknown>) || {}
        const focusModeEnabled = (containerContent.focusModeEnabled as boolean) ?? false
        const focusChildOrder = (containerContent.focusChildOrder as string[]) ?? []
        const backlogChildOrder = (containerContent.backlogChildOrder as string[]) ?? []
        
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
        let agentTodos = allTodos.filter((todo) => {
            const content = (todo.content as Record<string, unknown>) || {}
            return content.assigneeId === agentId
        })
        
        // Фильтр по статусу выполнения
        // showCompleted: false (default) → только активные задачи
        // showCompleted: true → только завершённые задачи (для отчёта)
        agentTodos = agentTodos.filter((todo) => {
            const content = (todo.content as Record<string, unknown>) || {}
            const isCompleted = (content.completed as boolean) || (content.checked as boolean) || false
            return showCompleted ? isCompleted : !isCompleted
        })
        
        // Фильтр по фокусу (если режим фокуса включен и не запрошены все задачи)
        let filteredTodos = agentTodos
        let focusInfo = {
            focusModeEnabled,
            showingFocusOnly: false,
            focusCount: 0,
            backlogCount: 0,
        }
        
        if (focusModeEnabled && !showAll) {
            // Создаём Set для быстрого поиска
            const focusSet = new Set(focusChildOrder)
            const backlogSet = new Set(backlogChildOrder)
            
            // Задачи, которые не в фокусе и не в бэклоге — считаем их "новыми" и включаем в фокус
            const focusedTodos = agentTodos.filter((todo) => {
                const inFocus = focusSet.has(todo.id)
                const inBacklog = backlogSet.has(todo.id)
                // Задача в фокусе ИЛИ не распределена (новая)
                return inFocus || (!inFocus && !inBacklog)
            })
            
            filteredTodos = focusedTodos
            focusInfo.showingFocusOnly = true
            focusInfo.focusCount = focusedTodos.length
            focusInfo.backlogCount = agentTodos.filter(t => backlogSet.has(t.id)).length
        }
        
        // Сортируем по порядку из focusChildOrder (если есть)
        if (focusModeEnabled) {
            const orderMap = new Map<string, number>()
            focusChildOrder.forEach((id, index) => orderMap.set(id, index))
            
            filteredTodos.sort((a, b) => {
                const orderA = orderMap.get(a.id) ?? Infinity
                const orderB = orderMap.get(b.id) ?? Infinity
                return orderA - orderB
            })
        }
        
        // Применяем limit если указан
        const limitedTodos = input.limit 
            ? filteredTodos.slice(0, input.limit)
            : filteredTodos

        // Форматируем для вывода
        const formattedTodos = limitedTodos.map((todo, index) => {
            const content = (todo.content as Record<string, unknown>) || {}
            return {
                id: todo.id,
                title: todo.title,
                description: (content.description as string) || '',
                completed: (content.completed as boolean) || (content.checked as boolean) || false,
                priority: (content.priority as 'low' | 'medium' | 'high') || 'low',
                tags: (todo.tags as string[]) || [],
                createdAt: todo.createdAt,
                updatedAt: todo.updatedAt,
                position: index + 1,
            }
        })

        // Формируем понятное сообщение
        let message: string
        if (showCompleted) {
            // Режим отчёта — показываем завершённые
            if (formattedTodos.length === 0) {
                message = 'No completed tasks yet.'
            } else if (formattedTodos.length === 1) {
                message = 'You have completed 1 task.'
            } else {
                message = `You have completed ${formattedTodos.length} tasks.`
            }
        } else if (formattedTodos.length === 0) {
            if (focusInfo.showingFocusOnly && focusInfo.backlogCount > 0) {
                message = `No tasks in focus. You have ${focusInfo.backlogCount} task(s) in backlog. Use showAll: true to see all tasks.`
            } else {
                message = 'No tasks assigned to you. Your task list is empty.'
            }
        } else if (formattedTodos.length === 1) {
            message = focusInfo.showingFocusOnly 
                ? `You have 1 task to work on.${focusInfo.backlogCount > 0 ? ` (${focusInfo.backlogCount} more in backlog)` : ''}`
                : 'You have 1 task to work on.'
        } else {
            message = focusInfo.showingFocusOnly 
                ? `You have ${formattedTodos.length} tasks to work on.${focusInfo.backlogCount > 0 ? ` (${focusInfo.backlogCount} more in backlog)` : ''}`
                : `You have ${formattedTodos.length} tasks to work on.`
        }

        return {
            success: true,
            operation: 'read',
            version: '2.0', // Маркер версии для отладки
            data: {
                todos: formattedTodos,
                count: formattedTodos.length,
                isEmpty: formattedTodos.length === 0,
                focusMode: focusInfo,
            },
            message,
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown database error'
        console.error(`❌ readTodos error: ${errorMessage}`)
        return {
            success: false,
            operation: 'read',
            error: errorMessage,
            message: `Failed to read tasks: ${errorMessage}`,
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
        .describe('Number of tasks to retrieve (1-100). If not specified, returns all matching tasks'),
    showAll: z
        .boolean()
        .optional()
        .describe('Show all tasks including backlog. Default: false (only focused tasks)'),
    showCompleted: z
        .boolean()
        .optional()
        .describe('Show ONLY completed tasks (for reporting). Default: false (only active tasks)'),
}

// Экспортируем определение инструмента
export const toolDefinition: ToolDefinition = {
    name: 'readTodos',
    description:
        'Get your current tasks. Just call without parameters — this returns what you need to work on. ' +
        'Use showCompleted: true only when asked "what did you do?" to report completed work. ' +
        'Use showAll: true only if user explicitly wants to see ALL tasks.',
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
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            const result = {
                success: false,
                operation: 'read',
                error: errorMessage,
                message: `Failed to read tasks: ${errorMessage}`,
            }
            return {
                content: [
                    { type: 'text' as const, text: JSON.stringify(result, null, 2) },
                ],
            }
        }
    },
}
