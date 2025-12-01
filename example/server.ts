import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { registerTools } from './tools.ts'
import { registerPrompts } from './prompts.ts'

export const getServer = () => {
  const server = new McpServer({
    name: 'TMX MCP',
    version: '1.0.0',
  })

  registerTools(server)
  registerPrompts(server)

  return server
}
