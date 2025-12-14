// Загружаем переменные окружения только если не production
if (process.env.NODE_ENV !== 'production') {
    import('dotenv/config')
}

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import express, { Request, Response } from 'express'
import cors from 'cors'
import { randomUUID } from 'crypto'
import { loadAllTools } from './utils/tool-loader.js'
import { testConnection } from './database/client.js'
import { 
    createSessionContext, 
    removeSessionContext, 
    setActiveSession 
} from './context/sessionContext.js'

// Create an MCP server
const server = new McpServer({
    name: 'Timelix MCP Server',
    version: '2.2.0',
})

// Автоматически загружаем и регистрируем все инструменты
async function registerAllTools() {
    console.log('🔧 Загружаем инструменты...')
    const tools = await loadAllTools()

    for (const tool of tools) {
        server.tool(tool.name, tool.description, tool.inputSchema, tool.handler)
        console.log(`📋 Зарегистрирован инструмент: ${tool.name}`)
    }

    console.log(`✅ Загружено ${tools.length} инструментов`)
}

// Создаем Express приложение
const app = express()
const PORT = Number(process.env.PORT) || 8080

// JSON парсинг применяется только к /mcp endpoint

// Настраиваем CORS
app.use(
    cors({
        origin: '*',
        methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'mcp-session-id'],
        exposedHeaders: ['mcp-session-id'],
    }),
)

// Обслуживаем главную страницу
app.get('/', (_req, res) => {
    res.json({
        name: 'Timelix MCP Server',
        version: '2.2.0',
        status: 'running',
        endpoint: '/mcp',
        protocol: 'Streamable HTTP (MCP)',
    })
})

// Health check endpoint
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        activeSessions: transports.size,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    })
})

// ============================================================================
// 🚀 MCP ENDPOINT: Streamable HTTP
// ============================================================================

// Хранилище транспортов по сессиям
const transports = new Map<string, StreamableHTTPServerTransport>()

// Время последней активности сессии
const sessionLastActivity = new Map<string, number>()

// Таймаут для запросов (30 секунд)
const REQUEST_TIMEOUT_MS = 30000

// Таймаут неактивной сессии (5 минут)
const SESSION_TIMEOUT_MS = 5 * 60 * 1000

// Интервал проверки мёртвых сессий (1 минута)
const CLEANUP_INTERVAL_MS = 60 * 1000

/**
 * Парсит query params из URL для контекста сессии
 */
function parseSessionParams(req: Request) {
    const todoListId = typeof req.query.todoListId === 'string' ? req.query.todoListId : null
    const agentId = typeof req.query.agentId === 'string' ? req.query.agentId : null
    const userId = typeof req.query.userId === 'string' ? req.query.userId : null
    return { todoListId, agentId, userId }
}

/**
 * Получает IP адрес клиента из запроса
 */
function getClientIp(req: Request): string | null {
    // Проверяем заголовки прокси (если приложение за reverse proxy)
    const forwarded = req.headers['x-forwarded-for']
    if (forwarded) {
        const ips = typeof forwarded === 'string' ? forwarded.split(',') : forwarded
        return ips[0]?.trim() || null
    }
    
    // Проверяем другие заголовки
    const realIp = req.headers['x-real-ip']
    if (realIp && typeof realIp === 'string') {
        return realIp
    }
    
    // Используем IP из соединения
    return req.socket.remoteAddress || null
}

/**
 * Обёртка для выполнения с таймаутом
 */
function withTimeout<T>(promise: Promise<T>, ms: number, operation: string): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout: ${operation} took longer than ${ms}ms`)), ms)
        )
    ])
}

/**
 * Обновляет время последней активности сессии
 */
function updateSessionActivity(sessionId: string): void {
    sessionLastActivity.set(sessionId, Date.now())
}

/**
 * Очищает сессию
 */
function cleanupSession(sessionId: string, reason: string): void {
    const transport = transports.get(sessionId)
    if (transport) {
        console.log(`🧹 Cleaning up session ${sessionId.slice(0, 8)}... | Reason: ${reason}`)
        transports.delete(sessionId)
        sessionLastActivity.delete(sessionId)
        removeSessionContext(sessionId)
        
        // Пытаемся закрыть транспорт
        try {
            transport.close?.()
        } catch (e) {
            // Игнорируем ошибки при закрытии
        }
    }
}

/**
 * Очистка неактивных сессий
 */
function cleanupInactiveSessions(): void {
    const now = Date.now()
    let cleaned = 0
    
    for (const [sessionId, lastActivity] of sessionLastActivity.entries()) {
        if (now - lastActivity > SESSION_TIMEOUT_MS) {
            cleanupSession(sessionId, 'inactivity timeout')
            cleaned++
        }
    }
    
    if (cleaned > 0) {
        console.log(`🧹 Cleaned ${cleaned} inactive sessions | Remaining: ${transports.size}`)
    }
}

// Запускаем периодическую очистку
setInterval(cleanupInactiveSessions, CLEANUP_INTERVAL_MS)

/**
 * MCP Endpoint - обрабатывает все методы (GET, POST, DELETE)
 * 
 * Подключение:
 * - POST /mcp?todoListId=XXX&agentId=YYY&userId=ZZZ
 * - Headers: Accept: application/json, text/event-stream
 *            Content-Type: application/json
 */
app.all('/mcp', express.json(), async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined
    const requestStart = Date.now()

    try {
        // Если есть существующая сессия - используем её транспорт
        if (sessionId && transports.has(sessionId)) {
            const transport = transports.get(sessionId)!
            setActiveSession(sessionId)
            updateSessionActivity(sessionId)
            
            console.log(`📨 [${sessionId.slice(0, 8)}] ${req.method} request`)
            
            await withTimeout(
                transport.handleRequest(req, res, req.body),
                REQUEST_TIMEOUT_MS,
                'handleRequest'
            )
            
            console.log(`✅ [${sessionId.slice(0, 8)}] Done in ${Date.now() - requestStart}ms`)
            return
        }
        
        // Сессия не найдена - клиенту нужно переподключиться
        if (sessionId && !transports.has(sessionId)) {
            console.warn(`⚠️ Session not found: ${sessionId.slice(0, 8)}... - client needs to reconnect`)
            if (!res.headersSent) {
                res.status(404).json({
                    jsonrpc: '2.0',
                    error: { 
                        code: -32001, 
                        message: 'Session not found. Please reconnect.' 
                    },
                    id: null
                })
            }
            return
        }

        // Для новых сессий - создаём транспорт
        if (req.method === 'POST' || req.method === 'GET') {
            const { todoListId, agentId, userId } = parseSessionParams(req)
            const ipAddress = getClientIp(req)
            const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null
            
            console.log(`📡 New connection: method=${req.method}, user=${userId?.slice(0, 8) || 'none'}, agent=${agentId?.slice(0, 8) || 'none'}, ip=${ipAddress || 'unknown'}`)

            const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                onsessioninitialized: (newSessionId) => {
                    transports.set(newSessionId, transport)
                    updateSessionActivity(newSessionId)
                    createSessionContext(newSessionId, todoListId, agentId, userId, ipAddress, userAgent)
                    console.log(`✅ Session created: ${newSessionId.slice(0, 8)}... | Active: ${transports.size}`)
                }
            })

            // Обработка закрытия транспорта
            transport.onclose = () => {
                if (transport.sessionId) {
                    console.log(`🔌 Session closed: ${transport.sessionId.slice(0, 8)}... | Remaining: ${transports.size - 1}`)
                    cleanupSession(transport.sessionId, 'transport closed')
                }
            }
            
            // Обработка ошибок транспорта
            transport.onerror = (error: Error) => {
                console.error(`❌ Transport error [${transport.sessionId?.slice(0, 8) || 'unknown'}]: ${error.message}`)
                if (transport.sessionId) {
                    cleanupSession(transport.sessionId, `transport error: ${error.message}`)
                }
            }

            // Подключаем сервер к транспорту
            await server.connect(transport)
            
            // Обрабатываем запрос с таймаутом
            await withTimeout(
                transport.handleRequest(req, res, req.body),
                REQUEST_TIMEOUT_MS,
                'handleRequest'
            )
            
            console.log(`✅ Initial request completed in ${Date.now() - requestStart}ms`)
            return
        }

        // DELETE для закрытия сессии
        if (req.method === 'DELETE' && sessionId) {
            console.log(`🗑️ DELETE session: ${sessionId.slice(0, 8)}...`)
            const transport = transports.get(sessionId)
            if (transport) {
                await transport.handleRequest(req, res, req.body)
            }
            return
        }

        // Неизвестный метод без session ID
        console.warn(`⚠️ Bad request: ${req.method} without session ID`)
        if (!res.headersSent) {
            res.status(400).json({
                jsonrpc: '2.0',
                error: { code: -32600, message: 'Bad Request: Missing mcp-session-id header' },
                id: null
            })
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        const errorStack = error instanceof Error ? error.stack : undefined
        
        console.error(`❌ MCP Error [${sessionId?.slice(0, 8) || 'no-session'}]: ${errorMessage}`)
        if (errorStack) {
            console.error(`   Stack: ${errorStack.split('\n').slice(1, 3).join(' | ')}`)
        }
        console.error(`   Duration: ${Date.now() - requestStart}ms`)
        
        if (!res.headersSent) {
            res.status(500).json({ 
                jsonrpc: '2.0',
                error: { code: -32603, message: errorMessage },
                id: null
            })
        }
    }
})

// ============================================================================
// 🚀 Запуск сервера
// ============================================================================

async function startServer() {
    try {
        // Проверяем подключение к базе данных
        const dbConnected = await testConnection()

        if (!dbConnected) {
            console.warn('⚠️ База данных недоступна')
        }

        await registerAllTools()

        // В Docker контейнере всегда используем 0.0.0.0, иначе localhost
        const HOST =
            process.env.DOCKER_ENV === 'true' || process.env.NODE_ENV === 'production'
                ? '0.0.0.0'
                : 'localhost'

        app.listen(PORT, HOST, () => {
            console.log('')
            console.log(`🚀 Timelix MCP Server v2.2.0`)
            console.log(`   Endpoint: http://${HOST}:${PORT}/mcp`)
            console.log(`   Health:   http://${HOST}:${PORT}/health`)
            console.log(`   Database: ${dbConnected ? '✅' : '❌'}`)
            console.log(`   Session timeout: ${SESSION_TIMEOUT_MS / 1000}s`)
            console.log(`   Cleanup interval: ${CLEANUP_INTERVAL_MS / 1000}s`)
            console.log('')
        })
    } catch (error) {
        console.error('❌ Failed to start server:', error)
        process.exit(1)
    }
}

// Глобальная обработка необработанных ошибок
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error.message)
})

process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled Rejection:', reason)
})

startServer()
