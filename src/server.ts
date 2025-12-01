import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerTools } from './tools-register.js'
import { registerPrompts } from './prompts.js'

export const getServer = () => {
  const server = new McpServer({
    name: 'Timelix MCP',
    version: '1.0.0',
  })

  registerTools(server)
  registerPrompts(server)

  return server
}

