import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export function registerTools(server: McpServer) {
  server.tool('ping', 'Проверка связи с сервером', {}, async () => {
    return {
      content: [{ type: 'text', text: 'pong' }],
    }
  })
}

