/**
 * Утилита для санитизации пользовательского ввода
 * Защита от prompt injection атак и вредоносных payload
 */

/**
 * Опасные паттерны для блокировки
 */
const DANGEROUS_PATTERNS = [
    // Command substitution
    /`[^`]*`/g,                    // backticks с любым содержимым
    /\$\([^)]*\)/g,                // command substitution $()
    
    // Pipe to execution
    /\|.*base64/g,                 // pipe to base64
    /\|.*bash/g,                   // pipe to bash
    /\|.*sh\b/g,                   // pipe to sh
    
    // Command execution patterns
    /curl.*\|/g,                   // curl piped somewhere
    /wget.*\|/g,                   // wget piped somewhere
    /\/bin\/bash.*-c/g,            // bash command execution
    /echo.*\|.*-d/g,               // echo piped to decode
    
    // Mining related
    /xmrig/gi,                     // miner name
    /cryptonight/gi,               // mining algorithm
    /stratum\+tcp/gi,              // mining protocol
    /pool\.[^:\s]+:\d+/g,          // mining pool pattern (pool.domain.com:port)
    
    // Base64 encoded payloads (длинные alphanumeric строки)
    /\b[A-Za-z0-9+/]{100,}={0,2}\b/g,  // base64 строки длиннее 100 символов
    
    // Suspicious URL patterns
    /https?:\/\/[^\s]+\.(sh|bash|exe|bin)/gi,  // executable files via URL
];

/**
 * Подозрительные ключевые слова в контексте выполнения
 */
const SUSPICIOUS_KEYWORDS = [
    'xmrig',
    'miner',
    'crypto',
    'mining',
    'stratum',
    'hashrate',
    'monero',
    'bitcoin',
    'cryptocurrency',
    'cryptomining',
    'cryptonight',
    'pool',
    'wallet',
    'systemd',
    'service',
    'daemon',
    'background',
    'nohup',
    'screen',
    'tmux',
];

/**
 * Проверяет наличие подозрительных ключевых слов в контексте выполнения команд
 */
function containsSuspiciousExecutionContext(text: string): boolean {
    const lowerText = text.toLowerCase()
    
    // Проверяем наличие подозрительных ключевых слов рядом с командами выполнения
    const executionContexts = [
        /(?:wget|curl|bash|sh|python|node|npm|yarn|exec|eval|system|popen)\s+.*(?:xmrig|miner|crypto|mining|stratum|pool|wallet)/i,
        /(?:xmrig|miner|crypto|mining|stratum|pool|wallet).*(?:wget|curl|bash|sh|python|node|npm|yarn|exec|eval|system|popen)/i,
    ]
    
    return executionContexts.some(pattern => pattern.test(text))
}

/**
 * Санитизирует пользовательский ввод, удаляя опасные паттерны
 * 
 * @param input - входная строка для санитизации
 * @returns объект с результатом: { sanitized: string, isSafe: boolean, threats: string[] }
 */
export function sanitizeUserInput(input: string): {
    sanitized: string
    isSafe: boolean
    threats: string[]
} {
    if (!input || typeof input !== 'string') {
        return {
            sanitized: '',
            isSafe: true,
            threats: [],
        }
    }

    const threats: string[] = []
    let sanitized = input

    // Проверяем опасные паттерны
    for (const pattern of DANGEROUS_PATTERNS) {
        const matches = sanitized.match(pattern)
        if (matches) {
            threats.push(`Dangerous pattern detected: ${pattern.source}`)
            // Удаляем найденные паттерны
            sanitized = sanitized.replace(pattern, '[BLOCKED]')
        }
    }

    // Проверяем подозрительные ключевые слова в контексте выполнения
    if (containsSuspiciousExecutionContext(sanitized)) {
        threats.push('Suspicious execution context detected')
        // Блокируем весь контент если обнаружен подозрительный контекст
        sanitized = '[BLOCKED: Suspicious execution context]'
    }

    // Проверяем наличие подозрительных ключевых слов (более мягкая проверка)
    const lowerInput = sanitized.toLowerCase()
    for (const keyword of SUSPICIOUS_KEYWORDS) {
        // Проверяем только если ключевое слово встречается в подозрительном контексте
        const keywordPattern = new RegExp(`\\b${keyword}\\b`, 'gi')
        if (keywordPattern.test(lowerInput)) {
            // Проверяем контекст - если рядом есть команды выполнения, это подозрительно
            const contextPattern = new RegExp(
                `(?:wget|curl|bash|sh|python|node|exec|eval|system|popen|download|install|run).*${keyword}|${keyword}.*(?:wget|curl|bash|sh|python|node|exec|eval|system|popen|download|install|run)`,
                'i'
            )
            if (contextPattern.test(sanitized)) {
                threats.push(`Suspicious keyword in execution context: ${keyword}`)
                sanitized = sanitized.replace(keywordPattern, '[BLOCKED]')
            }
        }
    }

    // Удаляем множественные пробелы и нормализуем
    sanitized = sanitized.replace(/\s+/g, ' ').trim()

    return {
        sanitized,
        isSafe: threats.length === 0,
        threats,
    }
}

/**
 * Валидирует длину входных данных
 * 
 * @param input - входная строка
 * @param maxLength - максимальная длина
 * @returns true если длина допустима
 */
export function validateLength(input: string, maxLength: number): boolean {
    if (!input || typeof input !== 'string') {
        return true
    }
    return input.length <= maxLength
}

/**
 * Полная валидация и санитизация пользовательского ввода
 * 
 * @param input - входная строка
 * @param maxLength - максимальная длина (опционально)
 * @returns объект с результатом валидации
 */
export function validateAndSanitize(
    input: string,
    maxLength?: number
): {
    sanitized: string
    isSafe: boolean
    isValid: boolean
    threats: string[]
    errors: string[]
} {
    const errors: string[] = []
    
    // Проверка длины
    if (maxLength !== undefined && !validateLength(input, maxLength)) {
        errors.push(`Input exceeds maximum length of ${maxLength} characters`)
    }

    // Санитизация
    const sanitizeResult = sanitizeUserInput(input)

    return {
        sanitized: sanitizeResult.sanitized,
        isSafe: sanitizeResult.isSafe,
        isValid: errors.length === 0,
        threats: sanitizeResult.threats,
        errors,
    }
}


