/**
 * Утилита для логирования подозрительных попыток и security событий
 */

export interface SecurityLogEntry {
    timestamp: Date
    type: 'blocked' | 'suspicious' | 'rate_limit' | 'validation_error'
    operation: string
    userId?: string | null
    sessionId?: string | null
    ipAddress?: string | null
    userAgent?: string | null
    threats?: string[]
    errors?: string[]
    input?: string
    message: string
}

/**
 * Логирует security событие
 */
export function logSecurityEvent(entry: SecurityLogEntry): void {
    const logLine = [
        `[SECURITY] ${entry.type.toUpperCase()}`,
        `[${entry.timestamp.toISOString()}]`,
        `Operation: ${entry.operation}`,
        entry.userId ? `User: ${entry.userId.slice(0, 8)}...` : '',
        entry.sessionId ? `Session: ${entry.sessionId.slice(0, 8)}...` : '',
        entry.ipAddress ? `IP: ${entry.ipAddress}` : '',
        entry.userAgent ? `UA: ${entry.userAgent.slice(0, 50)}` : '',
        entry.threats && entry.threats.length > 0 ? `Threats: ${entry.threats.join(', ')}` : '',
        entry.errors && entry.errors.length > 0 ? `Errors: ${entry.errors.join(', ')}` : '',
        `Message: ${entry.message}`,
    ]
        .filter(Boolean)
        .join(' | ')

    // В production можно отправлять в отдельный лог-файл или систему мониторинга
    console.warn(`🚨 ${logLine}`)

    // Если это блокированная попытка, логируем входные данные (обрезанные)
    if (entry.type === 'blocked' && entry.input) {
        const truncatedInput = entry.input.length > 200 
            ? entry.input.slice(0, 200) + '...' 
            : entry.input
        console.warn(`   Input: ${truncatedInput}`)
    }
}

/**
 * Логирует заблокированную попытку
 */
export function logBlockedAttempt(
    operation: string,
    reason: string,
    options: {
        userId?: string | null
        sessionId?: string | null
        ipAddress?: string | null
        userAgent?: string | null
        threats?: string[]
        errors?: string[]
        input?: string
    } = {}
): void {
    logSecurityEvent({
        timestamp: new Date(),
        type: 'blocked',
        operation,
        message: reason,
        ...options,
    })
}

/**
 * Логирует подозрительную активность
 */
export function logSuspiciousActivity(
    operation: string,
    reason: string,
    options: {
        userId?: string | null
        sessionId?: string | null
        ipAddress?: string | null
        userAgent?: string | null
        threats?: string[]
        input?: string
    } = {}
): void {
    logSecurityEvent({
        timestamp: new Date(),
        type: 'suspicious',
        operation,
        message: reason,
        ...options,
    })
}

/**
 * Логирует превышение rate limit
 */
export function logRateLimitExceeded(
    operation: string,
    options: {
        userId?: string | null
        sessionId?: string | null
        ipAddress?: string | null
        userAgent?: string | null
        resetTime?: number
    } = {}
): void {
    const resetTimeStr = options.resetTime 
        ? new Date(options.resetTime).toISOString() 
        : 'unknown'
    
    logSecurityEvent({
        timestamp: new Date(),
        type: 'rate_limit',
        operation,
        message: `Rate limit exceeded. Resets at: ${resetTimeStr}`,
        ...options,
    })
}


