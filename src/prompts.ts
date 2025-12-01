import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export function registerPrompts(server: McpServer) {
  server.prompt('dogs', 'Информация о собачках', {}, () => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: 'Собачки красные',
        },
      },
    ],
  }))
}

