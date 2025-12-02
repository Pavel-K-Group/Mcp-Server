import { z } from 'zod'
import type { ToolDefinition } from '../types/tool.js'
import { isDbConnected } from '../database/client.js'
import { getCurrentSessionContext } from '../context/sessionContext.js'

/**
 * Ping tool - checks server and database connectivity
 */
async function ping() {
    const startTime = Date.now()
    
    // Check database
    const dbConnected = await isDbConnected()
    
    // Check session context
    const sessionContext = getCurrentSessionContext()
    const hasSession = sessionContext !== null
    
    const responseTime = Date.now() - startTime

    return {
        success: true,
        operation: 'ping',
        data: {
            status: 'ok',
            server: 'Timelix MCP Server',
            version: '1.1.0',
            database: dbConnected ? 'connected' : 'disconnected',
            session: hasSession ? 'active' : 'no session',
            responseTimeMs: responseTime,
            timestamp: new Date().toISOString(),
        },
        message: dbConnected 
            ? `Server is healthy. Response time: ${responseTime}ms` 
            : `Server is running but database is disconnected. Response time: ${responseTime}ms`,
    }
}

// Empty input schema - no parameters needed
const inputSchema = {}

// Export tool definition
export const toolDefinition: ToolDefinition = {
    name: 'ping',
    description: 'Check server health and connectivity. Returns server status, database connection status, and response time. Use this to verify the MCP server is working correctly.',
    inputSchema: inputSchema,
    handler: async (_input: unknown) => {
        try {
            const result = await ping()
            return {
                content: [
                    { type: 'text' as const, text: JSON.stringify(result, null, 2) },
                ],
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            const result = {
                success: false,
                operation: 'ping',
                error: errorMessage,
                message: `Server health check failed: ${errorMessage}`,
            }
            return {
                content: [
                    { type: 'text' as const, text: JSON.stringify(result, null, 2) },
                ],
            }
        }
    },
}

