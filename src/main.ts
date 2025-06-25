// Загружаем переменные окружения только если не production
if (process.env.NODE_ENV !== 'production') {
    import('dotenv/config')
}

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import express from 'express'
import cors from 'cors'
import { loadAllTools } from './utils/tool-loader.js'

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
        server.tool(
            tool.name,
            tool.description,
            tool.inputSchema,
            tool.handler
        )
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
app.get('/sse', async (req, res) => {
    console.log('Новое SSE соединение установлено')

    try {
        const transport = new SSEServerTransport('/message', res)
        const sessionId = `session_${Date.now()}_${Math.random()}`
        transports.set(sessionId, transport)

        // Удаляем транспорт при закрытии соединения
        res.on('close', () => {
            transports.delete(sessionId)
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
        // Ищем любой активный транспорт для обработки сообщения
        const activeTransport = Array.from(transports.values())[0]

        if (!activeTransport) {
            return res.status(400).json({
                error: 'No active SSE connection found',
            })
        }

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
    await registerAllTools()
    
    // В Docker контейнере всегда используем 0.0.0.0, иначе localhost
    const HOST = process.env.DOCKER_ENV === 'true' || process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost'
    
    app.listen(PORT, HOST, () => {
        console.log(`🚀 Universal MCP Server запущен на http://${HOST}:${PORT}`)
        console.log(`📡 SSE endpoint доступен на http://${HOST}:${PORT}/sse`)
        console.log(`🔧 Настройте ваш MCP клиент на: http://${HOST}:${PORT}/sse`)
    })
}

startServer().catch(console.error)
