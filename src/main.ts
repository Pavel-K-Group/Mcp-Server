// Загружаем переменные окружения только если не production
if (process.env.NODE_ENV !== 'production') {
    import('dotenv/config')
}

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { z } from 'zod'
import express from 'express'
import cors from 'cors'

// Импортируем Telegram функции
import * as telegramApi from './telegram-functions/messages.js'

// Create an MCP server
const server = new McpServer({
    name: 'Telegram MCP Server',
    version: '1.0.0',
})

// Отправить сообщение в Telegram
server.tool(
    'sendTelegramMessage',
    'Отправить сообщение в Telegram',
    {
        text: z.string().describe('Текст сообщения для отправки'),
    },
    async ({ text }) => {
        try {
            const result = await telegramApi.sendMessage(text)
            return {
                content: [
                    { type: 'text' as const, text: JSON.stringify(result, null, 2) },
                ],
            }
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `Ошибка: ${
                            error instanceof Error ? error.message : String(error)
                        }`,
                    },
                ],
            }
        }
    },
)

// Создаем Express приложение
const app = express()
const PORT = 8080

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
        name: 'Telegram MCP Server',
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
    console.log('Получено POST сообщение:', req.body)

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
        console.log('✅ POST сообщение обработано')
    } catch (error) {
        console.error('❌ Ошибка обработки POST сообщения:', error)
        res.status(500).json({ error: 'Failed to handle POST message' })
    }
})

// Запускаем сервер
app.listen(PORT, () => {
    console.log(`🚀 Telegram MCP Server запущен на http://localhost:${PORT}`)
    console.log(`📡 SSE endpoint доступен на http://localhost:${PORT}/sse`)
    console.log(`🔧 Настройте ваш MCP клиент на: http://localhost:${PORT}/sse`)
})
