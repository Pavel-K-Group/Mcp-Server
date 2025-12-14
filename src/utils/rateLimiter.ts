/**
 * Утилита для rate limiting
 * Ограничивает количество запросов от одного источника
 */

interface RateLimitEntry {
    count: number
    resetTime: number
}

/**
 * Хранилище для rate limiting по ключу (например, userId или sessionId)
 */
const rateLimitStore = new Map<string, RateLimitEntry>()

/**
 * Конфигурация rate limiting
 */
const RATE_LIMIT_CONFIG = {
    // Максимальное количество создаваемых задач в минуту
    MAX_TODOS_PER_MINUTE: 10,
    // Время окна в миллисекундах
    WINDOW_MS: 60 * 1000, // 1 минута
}

/**
 * Очистка устаревших записей (вызывается периодически)
 */
function cleanupExpiredEntries(): void {
    const now = Date.now()
    for (const [key, entry] of rateLimitStore.entries()) {
        if (now > entry.resetTime) {
            rateLimitStore.delete(key)
        }
    }
}

// Запускаем периодическую очистку каждые 5 минут
setInterval(cleanupExpiredEntries, 5 * 60 * 1000)

/**
 * Проверяет rate limit для указанного ключа
 * 
 * @param key - ключ для идентификации источника (userId, sessionId, IP и т.д.)
 * @param maxRequests - максимальное количество запросов в окне
 * @param windowMs - размер окна в миллисекундах
 * @returns объект с результатом проверки
 */
export function checkRateLimit(
    key: string,
    maxRequests: number = RATE_LIMIT_CONFIG.MAX_TODOS_PER_MINUTE,
    windowMs: number = RATE_LIMIT_CONFIG.WINDOW_MS
): {
    allowed: boolean
    remaining: number
    resetTime: number
} {
    const now = Date.now()
    const entry = rateLimitStore.get(key)

    if (!entry || now > entry.resetTime) {
        // Создаем новую запись или сбрасываем устаревшую
        const newEntry: RateLimitEntry = {
            count: 1,
            resetTime: now + windowMs,
        }
        rateLimitStore.set(key, newEntry)
        return {
            allowed: true,
            remaining: maxRequests - 1,
            resetTime: newEntry.resetTime,
        }
    }

    // Увеличиваем счетчик
    entry.count++

    if (entry.count > maxRequests) {
        return {
            allowed: false,
            remaining: 0,
            resetTime: entry.resetTime,
        }
    }

    return {
        allowed: true,
        remaining: maxRequests - entry.count,
        resetTime: entry.resetTime,
    }
}

/**
 * Проверяет rate limit для создания задач
 * 
 * @param userId - ID пользователя
 * @returns объект с результатом проверки
 */
export function checkTodoCreationRateLimit(userId: string): {
    allowed: boolean
    remaining: number
    resetTime: number
} {
    return checkRateLimit(
        `todo:${userId}`,
        RATE_LIMIT_CONFIG.MAX_TODOS_PER_MINUTE,
        RATE_LIMIT_CONFIG.WINDOW_MS
    )
}

/**
 * Сбрасывает rate limit для указанного ключа (для тестирования)
 */
export function resetRateLimit(key: string): void {
    rateLimitStore.delete(key)
}


