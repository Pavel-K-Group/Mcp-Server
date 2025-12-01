import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export function registerTools(server: McpServer) {
  server.tool('addTodo', `pipip`, {}, async () => {
    console.log('sssss')
  })
  server.tool('readAllTodos', `Read all my tasks`, {}, async () => {})
}
