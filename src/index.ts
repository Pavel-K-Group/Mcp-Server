import express, { Request, Response } from 'express'
import cors from 'cors'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import { randomUUID } from 'node:crypto'
import { getServer } from './server.js'

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

app.post('/mcp', async (req: Request, res: Response) => {
  console.log('Received MCP request:', req.body)
  try {
    // Check for existing session ID
    const sessionId = req.headers['mcp-session-id'] as string | undefined
    let transport: StreamableHTTPServerTransport

    if (sessionId && transports[sessionId]) {
      // Reuse existing transport
      transport = transports[sessionId]
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New initialization request
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sessionId) => {
          // Store the transport by session ID when session is initialized
          // This avoids race conditions where requests might come in before the session is stored
          console.log(`Session initialized with ID: ${sessionId}`)
          transports[sessionId] = transport
        },
      })

      // Set up onclose handler to clean up transport when closed
      transport.onclose = () => {
        const sid = transport.sessionId
        if (sid && transports[sid]) {
          console.log(
            `Transport closed for session ${sid}, removing from transports map`,
          )
          delete transports[sid]
        }
      }

      // Connect the transport to the MCP server BEFORE handling the request
      // so responses can flow back through the same transport
      const server = getServer()
      await server.connect(transport)

      await transport.handleRequest(req, res, req.body)
      return // Already handled
    } else {
      // Invalid request - no session ID or not initialization request
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: null,
      })
      return
    }

    // Handle the request with existing transport - no need to reconnect
    // The existing transport is already connected to the server
    await transport.handleRequest(req, res, req.body)
  } catch (error) {
    console.error('Error handling MCP request:', error)
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      })
    }
  }
})

// Handle GET requests for SSE streams (using built-in support from StreamableHTTP)
app.get('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID')
    return
  }

  // Check for Last-Event-ID header for resumability
  const lastEventId = req.headers['last-event-id'] as string | undefined
  if (lastEventId) {
    console.log(`Client reconnecting with Last-Event-ID: ${lastEventId}`)
  } else {
    console.log(`Establishing new SSE stream for session ${sessionId}`)
  }

  const transport = transports[sessionId]
  await transport.handleRequest(req, res)
})

// Handle DELETE requests for session termination (according to MCP spec)
app.delete('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID')
    return
  }

  console.log(`Received session termination request for session ${sessionId}`)

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

// Start the server
const PORT = Number(process.env.PORT) || 8080
const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost'

app.listen(PORT, HOST, () => {
  console.log(`🚀 Timelix MCP Server listening on http://${HOST}:${PORT}`)
  console.log(`   Endpoint: /mcp`)
})

// Handle server shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...')

  // Close all active transports to properly clean up resources
  for (const sessionId in transports) {
    try {
      console.log(`Closing transport for session ${sessionId}`)
      await transports[sessionId].close()
      delete transports[sessionId]
    } catch (error) {
      console.error(
        `Error closing transport for session ${sessionId}: ${error}`,
      )
    }
  }
  console.log('Server shutdown complete')
  process.exit(0)
})

