/**
 * Контекст сессии MCP
 * 
 * Хранит параметры подключения, переданные через query params при SSE подключении.
 * Эти параметры используются tools для CRUD операций с ToDoList.
 */

export interface SessionContext {
    /** ID ToDoList компании - используется как parentId для задач */
    todoListId: string | null
    /** ID агента - используется для фильтрации задач по assignee */
    agentId: string | null
    /** ID пользователя - владелец данных */
    userId: string | null
    /** ID сессии */
    sessionId: string
    /** Время создания сессии */
    createdAt: Date
}

/**
 * Хранилище контекстов сессий
 * Ключ - sessionId, значение - контекст сессии
 */
const sessionContexts = new Map<string, SessionContext>()

/**
 * ID последней активной сессии
 * Используется для определения текущего контекста в handlers tools
 */
let lastActiveSessionId: string | null = null

/**
 * Создает новый контекст сессии
 */
export function createSessionContext(
    sessionId: string,
    todoListId: string | null,
    agentId: string | null,
    userId: string | null
): SessionContext {
    const context: SessionContext = {
        todoListId,
        agentId,
        userId,
        sessionId,
        createdAt: new Date(),
    }
    
    sessionContexts.set(sessionId, context)
    lastActiveSessionId = sessionId
    
    console.log(`📦 Session created [${sessionId.slice(0, 8)}...]:`, {
        todoListId: todoListId?.slice(0, 8) || 'none',
        agentId: agentId?.slice(0, 8) || 'none',
        userId: userId?.slice(0, 8) || 'none',
    })
    
    return context
}

/**
 * Получает контекст сессии по ID
 */
export function getSessionContext(sessionId: string): SessionContext | null {
    return sessionContexts.get(sessionId) || null
}

/**
 * Получает контекст последней активной сессии
 * Используется в handlers tools когда нет явного sessionId
 */
export function getCurrentSessionContext(): SessionContext | null {
    if (!lastActiveSessionId) {
        return null
    }
    
    return sessionContexts.get(lastActiveSessionId) || null
}

/**
 * Удаляет контекст сессии
 */
export function removeSessionContext(sessionId: string): void {
    sessionContexts.delete(sessionId)
    
    if (lastActiveSessionId === sessionId) {
        // Устанавливаем последнюю доступную сессию
        const remainingSessions = Array.from(sessionContexts.keys())
        lastActiveSessionId = remainingSessions.length > 0 
            ? remainingSessions[remainingSessions.length - 1] 
            : null
    }
}

/**
 * Устанавливает последнюю активную сессию
 */
export function setActiveSession(sessionId: string): void {
    if (sessionContexts.has(sessionId)) {
        lastActiveSessionId = sessionId
    }
}

/**
 * Получает todoListId для текущей сессии
 * Удобная функция для использования в tools
 */
export function getTodoListId(): string | null {
    const context = getCurrentSessionContext()
    return context?.todoListId || null
}

/**
 * Получает agentId для текущей сессии
 * Удобная функция для использования в tools
 */
export function getAgentId(): string | null {
    const context = getCurrentSessionContext()
    return context?.agentId || null
}

/**
 * Получает userId для текущей сессии
 * Удобная функция для использования в tools
 */
export function getUserId(): string | null {
    const context = getCurrentSessionContext()
    return context?.userId || null
}

