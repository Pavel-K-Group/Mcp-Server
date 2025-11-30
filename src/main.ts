// Загружаем переменные окружения только если не production
if (process.env.NODE_ENV !== 'production') {
    import('dotenv/config')
}

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
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
    name: 'Universal MCP Server',
    version: '2.0.0',
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

// Middleware для парсинга JSON (нужно для Streamable HTTP)
app.use(express.json())

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
app.get('/', (req, res) => {
    res.json({
        name: 'Universal MCP Server',
        version: '2.0.0',
        status: 'running',
        endpoints: {
            // Новый стабильный endpoint (Streamable HTTP)
            streamableHttp: '/mcp',
            // Legacy endpoint (SSE) - для обратной совместимости
            sse: '/sse',
        },
        docs: {
            streamableHttp: 'POST/GET/DELETE /mcp - рекомендуемый, стабильный',
            sse: 'GET /sse + POST /message - legacy, для старых клиентов',
        }
    })
})

// ============================================================================
// 🚀 НОВЫЙ ENDPOINT: Streamable HTTP (рекомендуемый)
// ============================================================================

// Хранилище транспортов Streamable HTTP по сессиям
const streamableTransports = new Map<string, StreamableHTTPServerTransport>()

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
 * Streamable HTTP endpoint - обрабатывает все методы (GET, POST, DELETE)
 * 
 * Подключение:
 * - POST /mcp?todoListId=XXX&agentId=YYY&userId=ZZZ
 * - Headers: Accept: application/json, text/event-stream
 *            Content-Type: application/json
 */
app.all('/mcp', async (req: Request, res: Response) => {
    // Получаем session ID из заголовка (если есть)
    const sessionId = req.headers['mcp-session-id'] as string | undefined

    // Если есть существующая сессия - используем её транспорт
    if (sessionId && streamableTransports.has(sessionId)) {
        const transport = streamableTransports.get(sessionId)!
        setActiveSession(sessionId)
        await transport.handleRequest(req, res, req.body)
        return
    }

    // Для новых сессий - создаём транспорт
    if (req.method === 'POST' || req.method === 'GET') {
        const { todoListId, agentId, userId } = parseSessionParams(req)
        
        console.log('📡 New Streamable HTTP connection:', {
            method: req.method,
            todoListId: todoListId || 'not set',
            agentId: agentId || 'not set',
            userId: userId || 'not set',
        })

        try {
            const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                onsessioninitialized: (newSessionId) => {
                    // Сохраняем транспорт по session ID
                    streamableTransports.set(newSessionId, transport)
                    
                    // Создаём контекст сессии
                    createSessionContext(newSessionId, todoListId, agentId, userId)
                    
                    console.log(`✅ Streamable HTTP сессия создана: ${newSessionId}`)
                }
            })

            // Обработка закрытия транспорта
            transport.onclose = () => {
                if (transport.sessionId) {
                    streamableTransports.delete(transport.sessionId)
                    removeSessionContext(transport.sessionId)
                    console.log(`❌ Streamable HTTP сессия закрыта: ${transport.sessionId}`)
                }
            }

            // Подключаем сервер к транспорту
            await server.connect(transport)
            
            // Обрабатываем запрос
            await transport.handleRequest(req, res, req.body)
            
        } catch (error) {
            console.error('❌ Ошибка Streamable HTTP:', error)
            if (!res.headersSent) {
                res.status(500).json({ 
                    jsonrpc: '2.0',
                    error: { 
                        code: -32603, 
                        message: 'Internal server error' 
                    },
                    id: null
                })
            }
        }
        return
    }

    // Неизвестный метод без session ID
    res.status(400).json({
        jsonrpc: '2.0',
        error: {
            code: -32600,
            message: 'Bad Request: Missing mcp-session-id header'
        },
        id: null
    })
})

// ============================================================================
// 📺 LEGACY ENDPOINT: SSE (для обратной совместимости)
// ============================================================================

// Глобальная переменная для хранения SSE транспортов по сессиям
const sseTransports = new Map<string, SSEServerTransport>()

/**
 * SSE endpoint для MCP - для получения сообщений от сервера
 * Поддерживает query params: todoListId, agentId, userId
 * Пример: /sse?todoListId=XXX&agentId=YYY&userId=ZZZ
 * 
 * ⚠️ LEGACY: Используйте /mcp для новых интеграций
 */
app.get('/sse', async (req, res) => {
    const { todoListId, agentId, userId } = parseSessionParams(req)
    
    console.log('📡 [LEGACY] New SSE connection:', {
        todoListId: todoListId || 'not set',
        agentId: agentId || 'not set',
        userId: userId || 'not set',
    })

    try {
        const transport = new SSEServerTransport('/message', res)
        const sessionId = `sse_${Date.now()}_${Math.random().toString(36).substring(7)}`
        sseTransports.set(sessionId, transport)
        
        // Создаем контекст сессии с параметрами из query
        createSessionContext(sessionId, todoListId, agentId, userId)

        // Удаляем транспорт и контекст при закрытии соединения
        res.on('close', () => {
            sseTransports.delete(sessionId)
            removeSessionContext(sessionId)
            console.log(`❌ [LEGACY] SSE соединение ${sessionId} закрыто`)
        })

        await server.connect(transport)
        console.log(`✅ [LEGACY] MCP сервер подключен через SSE (сессия: ${sessionId})`)
    } catch (error) {
        console.error('❌ [LEGACY] Ошибка подключения SSE:', error)
        res.status(500).json({ error: 'Failed to establish SSE connection' })
    }
})

/**
 * POST endpoint для обработки сообщений от SSE клиента
 * 
 * ⚠️ LEGACY: Используйте /mcp для новых интеграций
 */
app.post('/message', async (req, res) => {
    console.log('🔄 [LEGACY] MCP протокол: получен запрос от клиента')

    try {
        // Ищем активный транспорт для обработки сообщения
        const transportEntries = Array.from(sseTransports.entries())
        
        if (transportEntries.length === 0) {
            return res.status(400).json({
                error: 'No active SSE connection found',
            })
        }

        // Используем последний активный транспорт и устанавливаем его сессию как активную
        const [sessionId, activeTransport] = transportEntries[transportEntries.length - 1]
        setActiveSession(sessionId)

        // Обрабатываем POST сообщение через активный транспорт
        await activeTransport.handlePostMessage(req, res)
        console.log('✅ [LEGACY] MCP протокол: запрос обработан')
    } catch (error) {
        console.error('❌ [LEGACY] Ошибка обработки MCP запроса:', error)
        res.status(500).json({ error: 'Failed to handle POST message' })
    }
})

// ============================================================================
// 🚀 Запуск сервера
// ============================================================================

async function startServer() {
    // Проверяем подключение к базе данных
    console.log('🔄 Проверяем подключение к базе данных...')
    const dbConnected = await testConnection()

    if (!dbConnected) {
        console.warn(
            '⚠️  База данных недоступна, но сервер продолжит работу без БД инструментов',
        )
    }

    await registerAllTools()

    // В Docker контейнере всегда используем 0.0.0.0, иначе localhost
    const HOST =
        process.env.DOCKER_ENV === 'true' || process.env.NODE_ENV === 'production'
            ? '0.0.0.0'
            : 'localhost'

    app.listen(PORT, HOST, () => {
        console.log('')
        console.log('═══════════════════════════════════════════════════════════')
        console.log(`🚀 Universal MCP Server v2.0.0 запущен на http://${HOST}:${PORT}`)
        console.log('═══════════════════════════════════════════════════════════')
        console.log('')
        console.log('📡 Endpoints:')
        console.log(`   🆕 Streamable HTTP: http://${HOST}:${PORT}/mcp`)
        console.log(`      └─ POST/GET/DELETE, стабильный, рекомендуемый`)
        console.log(`   📺 Legacy SSE:      http://${HOST}:${PORT}/sse`)
        console.log(`      └─ GET + POST /message, для старых клиентов`)
        console.log('')
        if (dbConnected) {
            console.log(`💾 База данных подключена и готова к работе`)
        }
        console.log('')
    })
}

startServer().catch(console.error)
