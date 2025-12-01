import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { db } from './database/client.js'
import { block } from './database/schema.js'
import { eq, and, isNull, desc, asc } from 'drizzle-orm'
import { getTodoListId, getAgentId, getUserId } from './context/sessionContext.js'

export function registerTools(server: McpServer) {
  
  // ============================================================================
  // ping - проверка связи
  // ============================================================================
  server.tool('ping', 'Проверка связи с сервером', {}, async () => {
    return { content: [{ type: 'text', text: 'pong' }] }
  })

  // ============================================================================
  // readTodos - получить задачи агента
  // ============================================================================
  server.tool(
    'readTodos',
    'Get list of tasks assigned to this agent',
    {
      limit: z.number().min(1).max(100).optional().describe('Number of tasks (1-100)'),
    },
    async ({ limit }) => {
      const userId = getUserId()
      const parentId = getTodoListId()
      const agentId = getAgentId()

      if (!userId) throw new Error('User not authenticated')
      if (!parentId) throw new Error('todoListId not configured')
      if (!agentId) throw new Error('agentId not configured')

      console.log(`📖 readTodos: user=${userId?.slice(0, 8)}, parent=${parentId?.slice(0, 8)}, agent=${agentId?.slice(0, 8)}`)

      const allTodos = await db
        .select()
        .from(block)
        .where(
          and(
            eq(block.userId, userId),
            eq(block.type, 'todo'),
            eq(block.parentId, parentId),
            isNull(block.deletedAt),
          ),
        )
        .orderBy(asc(block.position), desc(block.createdAt))

      // Фильтруем по assigneeId
      const agentTodos = allTodos.filter((todo) => {
        const content = (todo.content as Record<string, unknown>) || {}
        return content.assigneeId === agentId
      })

      const limitedTodos = limit ? agentTodos.slice(0, limit) : agentTodos

      const formattedTodos = limitedTodos.map((todo, index) => {
        const content = (todo.content as Record<string, unknown>) || {}
        return {
          id: todo.id,
          title: todo.title,
          description: (content.description as string) || '',
          completed: (content.completed as boolean) || false,
          priority: (content.priority as string) || 'low',
          tags: (todo.tags as string[]) || [],
          createdAt: todo.createdAt,
          updatedAt: todo.updatedAt,
          position: index + 1,
        }
      })

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: { todos: formattedTodos, count: formattedTodos.length },
            message: `Found ${formattedTodos.length} task(s)`,
          }, null, 2),
        }],
      }
    },
  )

  // ============================================================================
  // createTodo - создать задачу
  // ============================================================================
  server.tool(
    'createTodo',
    'Create a new task',
    {
      title: z.string().describe('Task title'),
      description: z.string().optional().describe('Task description'),
      priority: z.enum(['low', 'medium', 'high']).optional().describe('Priority'),
      tags: z.array(z.string()).optional().describe('Tags'),
    },
    async ({ title, description, priority, tags }) => {
      const userId = getUserId()
      const parentId = getTodoListId()
      const agentId = getAgentId()

      if (!userId) throw new Error('User not authenticated')
      if (!parentId) throw new Error('todoListId not configured')

      console.log(`✏️ createTodo: "${title?.slice(0, 30)}...", user=${userId?.slice(0, 8)}`)

      const content = {
        description: description || '',
        completed: false,
        priority: priority || 'low',
        ...(agentId && { assigneeId: agentId }),
      }

      const [newTodo] = await db.insert(block).values({
        userId,
        type: 'todo',
        title,
        content,
        tags: tags || [],
        parentId,
        hasChildren: false,
        archived: false,
      }).returning()

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: {
              todo: {
                id: newTodo.id,
                title: newTodo.title,
                description: content.description,
                completed: content.completed,
                priority: content.priority,
                assigneeId: agentId || null,
                tags: newTodo.tags,
                parentId: newTodo.parentId,
                createdAt: newTodo.createdAt,
              },
            },
            message: `Task "${title}" created`,
          }, null, 2),
        }],
      }
    },
  )

  // ============================================================================
  // updateTodo - обновить задачу
  // ============================================================================
  server.tool(
    'updateTodo',
    'Update an existing task',
    {
      todoId: z.string().describe('Task ID'),
      title: z.string().optional().describe('New title'),
      description: z.string().optional().describe('New description'),
      completed: z.boolean().optional().describe('Completion status'),
      priority: z.enum(['low', 'medium', 'high']).optional().describe('New priority'),
      tags: z.array(z.string()).optional().describe('New tags'),
    },
    async ({ todoId, title, description, completed, priority, tags }) => {
      const userId = getUserId()
      if (!userId) throw new Error('User not authenticated')

      console.log(`📝 updateTodo: todo=${todoId?.slice(0, 8)}, user=${userId?.slice(0, 8)}`)

      const [existingTodo] = await db
        .select()
        .from(block)
        .where(
          and(
            eq(block.id, todoId),
            eq(block.userId, userId),
            eq(block.type, 'todo'),
            isNull(block.deletedAt),
          ),
        )
        .limit(1)

      if (!existingTodo) throw new Error('Task not found')

      const existingContent = (existingTodo.content as Record<string, unknown>) || {}

      const updatedContent = {
        description: description !== undefined ? description : (existingContent.description as string) || '',
        completed: completed !== undefined ? completed : (existingContent.completed as boolean) || false,
        priority: priority !== undefined ? priority : (existingContent.priority as string) || 'low',
        assigneeId: existingContent.assigneeId,
      }

      const updateData: Record<string, unknown> = {
        content: updatedContent,
        updatedAt: new Date().toISOString(),
      }

      if (title !== undefined) updateData.title = title
      if (tags !== undefined) updateData.tags = tags

      const [updatedTodo] = await db
        .update(block)
        .set(updateData)
        .where(
          and(
            eq(block.id, todoId),
            eq(block.userId, userId),
            eq(block.type, 'todo'),
            isNull(block.deletedAt),
          ),
        )
        .returning()

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: {
              todo: {
                id: updatedTodo.id,
                title: updatedTodo.title,
                description: updatedContent.description,
                completed: updatedContent.completed,
                priority: updatedContent.priority,
                tags: updatedTodo.tags,
                updatedAt: updatedTodo.updatedAt,
              },
            },
            message: `Task updated`,
          }, null, 2),
        }],
      }
    },
  )

  // ============================================================================
  // deleteTodo - удалить задачу
  // ============================================================================
  server.tool(
    'deleteTodo',
    'Delete a task (soft delete)',
    {
      todoId: z.string().describe('Task ID'),
      permanent: z.boolean().optional().describe('Permanent delete (default: false)'),
    },
    async ({ todoId, permanent }) => {
      const userId = getUserId()
      if (!userId) throw new Error('User not authenticated')

      console.log(`🗑️ deleteTodo: todo=${todoId?.slice(0, 8)}, user=${userId?.slice(0, 8)}, permanent=${permanent || false}`)

      const [existingTodo] = await db
        .select()
        .from(block)
        .where(
          and(
            eq(block.id, todoId),
            eq(block.userId, userId),
            eq(block.type, 'todo'),
            isNull(block.deletedAt),
          ),
        )
        .limit(1)

      if (!existingTodo) throw new Error('Task not found')

      const todoTitle = existingTodo.title

      if (permanent) {
        await db
          .delete(block)
          .where(
            and(
              eq(block.id, todoId),
              eq(block.userId, userId),
              eq(block.type, 'todo'),
            ),
          )

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              data: { todoId, permanent: true },
              message: `Task "${todoTitle}" permanently deleted`,
            }, null, 2),
          }],
        }
      } else {
        const [deletedTodo] = await db
          .update(block)
          .set({
            deletedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(
            and(
              eq(block.id, todoId),
              eq(block.userId, userId),
              eq(block.type, 'todo'),
              isNull(block.deletedAt),
            ),
          )
          .returning()

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              data: { todoId: deletedTodo.id, deletedAt: deletedTodo.deletedAt, permanent: false },
              message: `Task "${todoTitle}" moved to trash`,
            }, null, 2),
          }],
        }
      }
    },
  )
}
