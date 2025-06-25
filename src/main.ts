// Загружаем переменные окружения
if (process.env.NODE_ENV !== 'production') {
    import('dotenv/config')
}

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import express from 'express'
import cors from 'cors'
import { loadAllTools } from './utils/tool-loader.js'
import { randomUUID } from 'crypto'
import { InitializeRequestSchema } from '@modelcontextprotocol/sdk/types.js'

// Create an MCP server
const server = new McpServer({
    name: 'Universal MCP Server',
    version: '1.0.0',
})

// Session management для множественных подключений
const transports = new Map<string, StreamableHTTPServerTransport>()
const SESSION_ID_HEADER = 'mcp-session-id'

// Флаг готовности сервера
let isServerReady = false

// Автоматически загружаем и регистрируем все инструменты
async function registerAllTools() {
    console.log('🔧 Загружаем инструменты...')
    const tools = await loadAllTools()
    
    for (const tool of tools) {
        server.registerTool(
            tool.name,
            tool.config,
            tool.handler
        )
        console.log(`📋 Зарегистрирован инструмент: ${tool.name}`)
    }
    
    console.log(`✅ Загружено ${tools.length} инструментов`)
    isServerReady = true // Помечаем сервер как готовый
}

// Создаем Express приложение
const app = express()
const PORT = Number(process.env.PORT) || 8080

// Настраиваем CORS
app.use(
    cors({
        origin: '*',
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'mcp-session-id'],
    }),
)

app.use(express.json())

// Обслуживаем главную страницу
app.get('/', (req, res) => {
    res.json({
        name: 'Universal MCP Server',
        version: '1.0.0',
        status: isServerReady ? 'ready' : 'initializing',
        endpoints: {
            mcp: '/mcp',
        },
        architecture: 'Streamable HTTP',
    })
})

// Проверяем, является ли запрос initialize
function isInitializeRequest(body: unknown): boolean {
    if (Array.isArray(body)) {
        return body.some(request => {
            const result = InitializeRequestSchema.safeParse(request)
            return result.success
        })
    }
    const result = InitializeRequestSchema.safeParse(body)
    return result.success
}

// Создаем error response
function createErrorResponse(message: string, id?: string | number) {
    return {
        jsonrpc: '2.0',
        error: {
            code: -32000,
            message: message,
        },
        id: id || randomUUID(),
    }
}

// Единый MCP endpoint - поддерживает и GET и POST
app.get('/mcp', async (req, res) => {
    console.log('🔗 GET /mcp - Запрос SSE потока')
    
    if (!isServerReady) {
        return res.status(503).json(createErrorResponse('Server is still initializing'))
    }

    const sessionId = req.headers[SESSION_ID_HEADER] as string | undefined
    
    if (!sessionId || !transports.has(sessionId)) {
        return res.status(400).json(createErrorResponse('Invalid or missing session ID'))
    }

    try {
        const transport = transports.get(sessionId)!
        console.log(`📡 Открываем SSE поток для сессии: ${sessionId}`)
        await transport.handleRequest(req, res)
    } catch (error) {
        console.error('❌ Ошибка SSE потока:', error)
        res.status(500).json(createErrorResponse('Failed to establish SSE stream'))
    }
})

app.post('/mcp', async (req, res) => {
    console.log('📨 POST /mcp - Обработка MCP запроса')
    
    if (!isServerReady) {
        return res.status(503).json(createErrorResponse('Server is still initializing'))
    }

    const sessionId = req.headers[SESSION_ID_HEADER] as string | undefined
    
    try {
        // Если есть sessionId, используем существующий transport
        if (sessionId && transports.has(sessionId)) {
            const transport = transports.get(sessionId)!
            console.log(`🔄 Используем существующий transport для сессии: ${sessionId}`)
            await transport.handleRequest(req, res, req.body)
            return
        }

        // Создаем новый transport только для initialize запросов без sessionId
        if (!sessionId && isInitializeRequest(req.body)) {
            console.log('🆕 Создаем новый transport для initialize запроса')
            
            const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
            })

            // Подключаем сервер к transport
            await server.connect(transport)
            
            // Обрабатываем первый запрос
            await transport.handleRequest(req, res, req.body)
            
            // Сохраняем transport по sessionId (доступен после handleRequest)
            const newSessionId = transport.sessionId
            if (newSessionId) {
                transports.set(newSessionId, transport)
                console.log(`💾 Сохранен transport для сессии: ${newSessionId}`)
                
                // Очистка при закрытии
                transport.onclose = () => {
                    transports.delete(newSessionId)
                    console.log(`🗑️ Удален transport для сессии: ${newSessionId}`)
                }
            }
            return
        }

        // Неверный запрос
        console.log('❌ Неверный запрос - нет sessionId или не initialize')
        res.status(400).json(createErrorResponse('Bad Request: missing session ID or invalid method'))
        
    } catch (error) {
        console.error('❌ Ошибка обработки MCP запроса:', error)
        res.status(500).json(createErrorResponse('Internal server error'))
    }
})

// Инициализируем сервер
async function startServer() {
    console.log('🚀 Запуск Universal MCP Server...')
    
    // Сначала загружаем все инструменты
    await registerAllTools()
    
    // В Docker контейнере всегда используем 0.0.0.0, иначе localhost
    const HOST = process.env.DOCKER_ENV === 'true' || process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost'
    
    app.listen(PORT, HOST, () => {
        console.log(`🚀 Universal MCP Server запущен на http://${HOST}:${PORT}`)
        console.log(`📡 MCP endpoint доступен на http://${HOST}:${PORT}/mcp`)
        console.log(`🔧 Настройте ваш MCP клиент на: http://${HOST}:${PORT}/mcp`)
        console.log(`✅ Архитектура: Streamable HTTP`)
        console.log(`📊 Статус: ${isServerReady ? 'ГОТОВ' : 'ИНИЦИАЛИЗАЦИЯ'}`)
    })
}

startServer().catch(console.error)
