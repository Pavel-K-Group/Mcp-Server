// Загружаем переменные окружения только если не production
if (process.env.NODE_ENV !== 'production') {
    import('dotenv/config')
}

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import express from 'express'
import cors from 'cors'
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
    version: '1.0.0',
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

// Настраиваем CORS
app.use(
    cors({
        origin: '*',
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    }),
)

// Обслуживаем главную страницу
app.get('/', (req, res) => {
    res.json({
        name: 'Universal MCP Server',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            sse: '/sse',
        },
    })
})

// Глобальная переменная для хранения транспортов по сессиям
const transports = new Map<string, SSEServerTransport>()

// SSE endpoint для MCP - для получения сообщений от сервера
// Поддерживает query params: todoListId, agentId, userId
// Пример: /sse?todoListId=XXX&agentId=YYY&userId=ZZZ
app.get('/sse', async (req, res) => {
    // Парсим query params для контекста сессии
    const todoListId = typeof req.query.todoListId === 'string' ? req.query.todoListId : null
    const agentId = typeof req.query.agentId === 'string' ? req.query.agentId : null
    const userId = typeof req.query.userId === 'string' ? req.query.userId : null
    
    console.log('📡 New SSE connection:', {
        todoListId: todoListId || 'not set',
        agentId: agentId || 'not set',
        userId: userId || 'not set',
    })

    try {
        const transport = new SSEServerTransport('/message', res)
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`
        transports.set(sessionId, transport)
        
        // Создаем контекст сессии с параметрами из query
        createSessionContext(sessionId, todoListId, agentId, userId)

        // Удаляем транспорт и контекст при закрытии соединения
        res.on('close', () => {
            transports.delete(sessionId)
            removeSessionContext(sessionId)
            console.log(`❌ SSE соединение ${sessionId} закрыто`)
        })

        await server.connect(transport)
        console.log(`✅ MCP сервер подключен через SSE (сессия: ${sessionId})`)
    } catch (error) {
        console.error('❌ Ошибка подключения SSE:', error)
        res.status(500).json({ error: 'Failed to establish SSE connection' })
    }
})

// POST endpoint для обработки сообщений от клиента
app.post('/message', async (req, res) => {
    console.log('🔄 MCP протокол: получен запрос от клиента')

    try {
        // Ищем активный транспорт для обработки сообщения
        const transportEntries = Array.from(transports.entries())
        
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
        console.log('✅ MCP протокол: запрос обработан')
    } catch (error) {
        console.error('❌ Ошибка обработки MCP запроса:', error)
        res.status(500).json({ error: 'Failed to handle POST message' })
    }
})

// Инициализируем сервер
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
        console.log(`🚀 Universal MCP Server запущен на http://${HOST}:${PORT}`)
        console.log(`📡 SSE endpoint доступен на http://${HOST}:${PORT}/sse`)
        console.log(`🔧 Настройте ваш MCP клиент на: http://${HOST}:${PORT}/sse`)
        if (dbConnected) {
            console.log(`💾 База данных подключена и готова к работе`)
        }
    })
}

startServer().catch(console.error)
