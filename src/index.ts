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

// Health check
app.get('/', (_req, res) => {
  res.json({
    name: 'Timelix MCP Server',
    version: '1.0.0',
    status: 'running',
    endpoint: '/mcp',
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

app.post('/mcp', async (req: Request, res: Response) => {
  console.log('📨 MCP POST request')
  try {
    const sessionId = req.headers['mcp-session-id'] as string | undefined

    if (sessionId && transports[sessionId]) {
      // Существующая сессия
      const transport = transports[sessionId]
      setActiveSession(sessionId)
      await transport.handleRequest(req, res, req.body)
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // Новая сессия
      const { todoListId, agentId, userId } = parseSessionParams(req)
      
      console.log(`📡 New connection: user=${userId?.slice(0, 8) || 'none'}, agent=${agentId?.slice(0, 8) || 'none'}, todoList=${todoListId?.slice(0, 8) || 'none'}`)

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId) => {
          transports[newSessionId] = transport
          createSessionContext(newSessionId, todoListId, agentId, userId)
          console.log(`✅ Session created: ${newSessionId.slice(0, 8)}... | Active: ${Object.keys(transports).length}`)
        },
      })

      transport.onclose = () => {
        const sid = transport.sessionId
        if (sid && transports[sid]) {
          console.log(`🔌 Session closed: ${sid.slice(0, 8)}...`)
          removeSessionContext(sid)
          delete transports[sid]
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
    console.log(`🚀 Timelix MCP Server v1.0.0`)
    console.log(`   Endpoint: http://${HOST}:${PORT}/mcp`)
    console.log(`   Database: ${dbConnected ? '✅' : '❌'}`)
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
