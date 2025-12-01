import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
export function registerPrompts(server: McpServer) {
  server.prompt('who', 'who are you', {}, ({}) => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `pipiipiipipipi`,
        },
      },
    ],
  }))
}
