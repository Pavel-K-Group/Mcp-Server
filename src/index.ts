import express, { Request, Response } from 'express'
import cors from 'cors'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import { randomUUID } from 'node:crypto'
import { getServer } from './server.js'
import { testConnection } from './database/client.js'
import { 
  createSessionContext, 
  removeSessionContext, 
  setActiveSession 
} from './context/sessionContext.js'

const app = express()
app.use(express.json())
app.use(cors({ origin: '*' }))

const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {}
const sessionLastActivity: { [sessionId: string]: number } = {}

// Таймауты
const SESSION_TIMEOUT_MS = 5 * 60 * 1000 // 5 минут неактивности
const CLEANUP_INTERVAL_MS = 60 * 1000 // проверка каждую минуту

/**
 * Обновляет время активности сессии
 */
function updateActivity(sessionId: string) {
  sessionLastActivity[sessionId] = Date.now()
}

/**
 * Очищает сессию
 */
function cleanupSession(sessionId: string, reason: string) {
  const transport = transports[sessionId]
  if (transport) {
    console.log(`🧹 Session cleanup: ${sessionId.slice(0, 8)}... | Reason: ${reason}`)
    removeSessionContext(sessionId)
    delete transports[sessionId]
    delete sessionLastActivity[sessionId]
    try {
      transport.close?.()
    } catch {}
  }
}

/**
 * Периодическая очистка неактивных сессий
 */
function cleanupInactiveSessions() {
  const now = Date.now()
  let cleaned = 0
  
  for (const sessionId in sessionLastActivity) {
    if (now - sessionLastActivity[sessionId] > SESSION_TIMEOUT_MS) {
      cleanupSession(sessionId, 'inactivity timeout')
      cleaned++
    }
  }
  
  if (cleaned > 0) {
    console.log(`🧹 Cleaned ${cleaned} inactive sessions | Active: ${Object.keys(transports).length}`)
  }
}

// Запускаем очистку
setInterval(cleanupInactiveSessions, CLEANUP_INTERVAL_MS)

// Health check
app.get('/', (_req, res) => {
  res.json({
    name: 'Timelix MCP Server',
    version: '1.1.0',
    status: 'running',
    endpoint: '/mcp',
  })
})

// Статус сервера
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    activeSessions: Object.keys(transports).length,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  })
})

/**
 * Парсит query params для контекста сессии
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

app.post('/mcp', async (req: Request, res: Response) => {
  try {
    const sessionId = req.headers['mcp-session-id'] as string | undefined

    if (sessionId && transports[sessionId]) {
      // Существующая сессия - обновляем активность
      const transport = transports[sessionId]
      setActiveSession(sessionId)
      updateActivity(sessionId)
      await transport.handleRequest(req, res, req.body)
    } else if (sessionId && !transports[sessionId]) {
      // Сессия не найдена - клиент должен переподключиться
      console.warn(`⚠️ Session expired: ${sessionId.slice(0, 8)}... - client needs to reconnect`)
      res.status(404).json({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Session expired. Please reconnect.' },
        id: null,
      })
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // Новая сессия
      const { todoListId, agentId, userId } = parseSessionParams(req)
      const ipAddress = getClientIp(req)
      const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null
      
      console.log(`📡 New connection: user=${userId?.slice(0, 8) || 'none'}, agent=${agentId?.slice(0, 8) || 'none'}, todoList=${todoListId?.slice(0, 8) || 'none'}, ip=${ipAddress || 'unknown'}`)

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId) => {
          transports[newSessionId] = transport
          updateActivity(newSessionId)
          createSessionContext(newSessionId, todoListId, agentId, userId, ipAddress, userAgent)
          console.log(`✅ Session created: ${newSessionId.slice(0, 8)}... | Active: ${Object.keys(transports).length}`)
        },
      })

      transport.onclose = () => {
        const sid = transport.sessionId
        if (sid && transports[sid]) {
          console.log(`🔌 Session closed by client: ${sid.slice(0, 8)}... | Remaining: ${Object.keys(transports).length - 1}`)
          cleanupSession(sid, 'client disconnect')
        }
      }
      
      transport.onerror = (error: Error) => {
        const sid = transport.sessionId
        console.error(`❌ Transport error [${sid?.slice(0, 8) || '?'}]: ${error.message}`)
        if (sid) {
          cleanupSession(sid, `error: ${error.message}`)
        }
      }

      const server = getServer()
      await server.connect(transport)
      await transport.handleRequest(req, res, req.body)
    } else {
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
        id: null,
      })
    }
  } catch (error) {
    console.error('❌ MCP Error:', error)
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      })
    }
  }
})

// GET - SSE streams
app.get('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID')
    return
  }

  const lastEventId = req.headers['last-event-id'] as string | undefined
  if (lastEventId) {
    console.log(`🔄 Reconnecting with Last-Event-ID: ${lastEventId}`)
  }

  setActiveSession(sessionId)
  const transport = transports[sessionId]
  await transport.handleRequest(req, res)
})

// DELETE - session termination
app.delete('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID')
    return
  }

  console.log(`🗑️ Session termination: ${sessionId.slice(0, 8)}...`)

  try {
    const transport = transports[sessionId]
    await transport.handleRequest(req, res)
  } catch (error) {
    console.error('Error handling session termination:', error)
    if (!res.headersSent) {
      res.status(500).send('Error processing session termination')
    }
  }
})

// Start server
const PORT = Number(process.env.PORT) || 8080
const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost'

async function start() {
  // Проверяем БД
  const dbConnected = await testConnection()
  if (!dbConnected) {
    console.warn('⚠️ Database not connected')
  }

  app.listen(PORT, HOST, () => {
    console.log('')
    console.log(`🚀 Timelix MCP Server v1.1.0`)
    console.log(`   Endpoint: http://${HOST}:${PORT}/mcp`)
    console.log(`   Health:   http://${HOST}:${PORT}/health`)
    console.log(`   Database: ${dbConnected ? '✅' : '❌'}`)
    console.log(`   Session timeout: ${SESSION_TIMEOUT_MS / 1000}s`)
    console.log('')
  })
}

start()

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...')
  for (const sessionId in transports) {
    try {
      await transports[sessionId].close()
      delete transports[sessionId]
    } catch (error) {
      console.error(`Error closing session ${sessionId}:`, error)
    }
  }
  process.exit(0)
})

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message)
})

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason)
})
