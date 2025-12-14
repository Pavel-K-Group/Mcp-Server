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
  // server.tool('ping', 'Проверка связи с сервером', {}, async () => {
  //   return { content: [{ type: 'text', text: 'pong' }] }
  // })

  // ============================================================================
  // readTodos - получить задачи агента
  // По умолчанию: только активные (не completed) задачи
  // showCompleted: true — только завершённые (для отчёта)
  // showAll: true — все задачи включая бэклог
  // ============================================================================
  server.tool(
    'readTodos',
    'Get your current tasks. ALWAYS call without parameters. Parameters are only for special cases: showCompleted=true ONLY if user asks "what did you do/complete?", showAll=true ONLY if user says "show ALL tasks" or "show backlog".',
    {
      limit: z.number().min(1).max(100).optional().describe('Limit results (rarely needed)'),
      showAll: z.boolean().optional().describe('ONLY if user explicitly asks for ALL tasks or backlog'),
      showCompleted: z.boolean().optional().describe('ONLY if user asks what you completed/did'),
    },
    async ({ limit, showAll = false, showCompleted = false }) => {
      const userId = getUserId()
      const parentId = getTodoListId()
      const agentId = getAgentId()

      if (!userId) throw new Error('User not authenticated')
      if (!parentId) throw new Error('todoListId not configured')
      if (!agentId) throw new Error('agentId not configured')

      console.log(`📖 readTodos v2: user=${userId?.slice(0, 8)}, parent=${parentId?.slice(0, 8)}, agent=${agentId?.slice(0, 8)}, showAll=${showAll}, showCompleted=${showCompleted}`)

      // Получаем контейнер для настроек фокуса
      const [container] = await db
        .select()
        .from(block)
        .where(
          and(
            eq(block.id, parentId),
            eq(block.userId, userId),
            isNull(block.deletedAt),
          ),
        )
        .limit(1)

      const containerContent = (container?.content as Record<string, unknown>) || {}
      const focusModeEnabled = (containerContent.focusModeEnabled as boolean) ?? false
      const focusChildOrder = (containerContent.focusChildOrder as string[]) ?? []
      const backlogChildOrder = (containerContent.backlogChildOrder as string[]) ?? []

      // Получаем все задачи
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
      let agentTodos = allTodos.filter((todo) => {
        const content = (todo.content as Record<string, unknown>) || {}
        return content.assigneeId === agentId
      })

      // Фильтр по статусу выполнения
      agentTodos = agentTodos.filter((todo) => {
        const content = (todo.content as Record<string, unknown>) || {}
        const isCompleted = (content.completed as boolean) || (content.checked as boolean) || false
        return showCompleted ? isCompleted : !isCompleted
      })

      // Фильтр по фокусу
      let filteredTodos = agentTodos
      let focusInfo = { focusModeEnabled, showingFocusOnly: false, focusCount: 0, backlogCount: 0 }

      if (focusModeEnabled && !showAll) {
        const focusSet = new Set(focusChildOrder)
        const backlogSet = new Set(backlogChildOrder)
        
        filteredTodos = agentTodos.filter((todo) => {
          const inFocus = focusSet.has(todo.id)
          const inBacklog = backlogSet.has(todo.id)
          return inFocus || (!inFocus && !inBacklog)
        })
        
        focusInfo.showingFocusOnly = true
        focusInfo.focusCount = filteredTodos.length
        focusInfo.backlogCount = agentTodos.filter(t => backlogSet.has(t.id)).length
      }

      // Сортировка по focusChildOrder
      if (focusModeEnabled) {
        const orderMap = new Map<string, number>()
        focusChildOrder.forEach((id, index) => orderMap.set(id, index))
        filteredTodos.sort((a, b) => (orderMap.get(a.id) ?? Infinity) - (orderMap.get(b.id) ?? Infinity))
      }

      const limitedTodos = limit ? filteredTodos.slice(0, limit) : filteredTodos

      const formattedTodos = limitedTodos.map((todo, index) => {
        const content = (todo.content as Record<string, unknown>) || {}
        return {
          id: todo.id,
          title: todo.title,
          description: (content.description as string) || '',
          completed: (content.completed as boolean) || (content.checked as boolean) || false,
          priority: (content.priority as string) || 'low',
          tags: (todo.tags as string[]) || [],
          createdAt: todo.createdAt,
          updatedAt: todo.updatedAt,
          position: index + 1,
        }
      })

      // Сообщение
      let message: string
      if (showCompleted) {
        message = formattedTodos.length === 0 
          ? 'No completed tasks yet.' 
          : `You have completed ${formattedTodos.length} task(s).`
      } else if (formattedTodos.length === 0) {
        message = focusInfo.backlogCount > 0 
          ? `No tasks in focus. ${focusInfo.backlogCount} task(s) in backlog.`
          : 'No tasks assigned to you.'
      } else {
        message = `You have ${formattedTodos.length} task(s) to work on.`
        if (focusInfo.backlogCount > 0) message += ` (${focusInfo.backlogCount} more in backlog)`
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            version: '2.0',
            data: { todos: formattedTodos, count: formattedTodos.length, focusMode: focusInfo },
            message,
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

  // ============================================================================
  // sendTelegramMessage - отправить сообщение в Telegram
  // ============================================================================
  server.tool(
    'sendTelegramMessage',
    'Send a message to Telegram. Requires TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables.',
    {
      text: z.string().describe('Message text to send'),
    },
    async ({ text }) => {
      const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN
      const telegramChatId = process.env.TELEGRAM_CHAT_ID

      if (!telegramBotToken) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'TELEGRAM_BOT_TOKEN not configured',
              message: 'Telegram integration is not configured.',
            }, null, 2),
          }],
        }
      }

      if (!telegramChatId) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'TELEGRAM_CHAT_ID not configured',
              message: 'Telegram integration is not configured.',
            }, null, 2),
          }],
        }
      }

      if (!text || text.trim() === '') {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'Empty message',
              message: 'Message text cannot be empty',
            }, null, 2),
          }],
        }
      }

      try {
        const response = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text: text,
            parse_mode: 'HTML',
          }),
        })

        if (!response.ok) {
          const errorData = (await response.json()) as { description?: string }
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: errorData.description || response.statusText,
                message: `Failed to send: ${errorData.description || response.statusText}`,
              }, null, 2),
            }],
          }
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Message sent to Telegram successfully',
            }, null, 2),
          }],
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Network error'
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: errorMessage,
              message: `Failed to send: ${errorMessage}`,
            }, null, 2),
          }],
        }
      }
    },
  )

  // ============================================================================
  // getCompanyMetrics — получить все метрики компании
  // ============================================================================
  server.tool(
    'getCompanyMetrics',
    'Get all metrics for your company. Returns list of metrics with current values and weekly changes.',
    {},
    async () => {
      const userId = getUserId()
      const agentId = getAgentId()
      if (!userId) throw new Error('User not authenticated')
      if (!agentId) throw new Error('Agent not configured')

      console.log(`📊 getCompanyMetrics: agent=${agentId?.slice(0, 8)}, user=${userId?.slice(0, 8)}`)

      // Получаем агента чтобы найти компанию через parentId
      const [agent] = await db
        .select()
        .from(block)
        .where(
          and(
            eq(block.id, agentId),
            eq(block.userId, userId),
            isNull(block.deletedAt),
          ),
        )
        .limit(1)

      if (!agent) throw new Error('Agent not found')
      
      // parentId агента — это ID компании
      const companyId = agent.parentId
      if (!companyId) throw new Error('Agent not linked to a company')

      // Получаем компанию
      const [company] = await db
        .select()
        .from(block)
        .where(
          and(
            eq(block.id, companyId),
            eq(block.userId, userId),
            isNull(block.deletedAt),
          ),
        )
        .limit(1)

      if (!company) throw new Error('Company not found')

      const companyContent = (company.content as Record<string, unknown>) || {}
      const metricsId = companyContent.metricsId as string | undefined

      if (!metricsId) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              data: { metrics: [], count: 0 },
              message: 'No metrics container configured for this company',
            }, null, 2),
          }],
        }
      }

      // Получаем все блоки в контейнере метрик
      // Тип 'metric' не в enum схемы, фильтруем по parentId
      const allBlocks = await db
        .select()
        .from(block)
        .where(
          and(
            eq(block.userId, userId),
            eq(block.parentId, metricsId),
            isNull(block.deletedAt),
          ),
        )
        .orderBy(asc(block.position))

      // Фильтруем метрики по content.metricType
      const metrics = allBlocks.filter((b) => {
        const content = (b.content as Record<string, unknown>) || {}
        return content.metricType === 'counter' || content.metricType === 'number'
      })

      // Считаем deltaWeek для каждой метрики
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)

      const formattedMetrics = metrics.map((metric) => {
        const content = (metric.content as Record<string, unknown>) || {}
        const history = (content.history as Array<{ value: number; timestamp: string; delta?: number }>) || []
        
        // Ищем значение неделю назад
        let deltaWeek: number | null = null
        const weekAgoEntry = history.find(h => new Date(h.timestamp) <= weekAgo)
        if (weekAgoEntry !== undefined) {
          deltaWeek = (content.currentValue as number || 0) - weekAgoEntry.value
        } else if (history.length > 0) {
          // Если нет записи неделю назад, берём первую запись
          deltaWeek = (content.currentValue as number || 0) - history[0].value
        }

        return {
          id: metric.id,
          title: metric.title || 'Без названия',
          metricType: (content.metricType as string) || 'counter',
          currentValue: (content.currentValue as number) || 0,
          unit: content.unit as string | undefined,
          goal: content.goal as number | undefined,
          icon: content.icon as string | undefined,
          deltaWeek,
        }
      })

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: { metrics: formattedMetrics, count: formattedMetrics.length },
            message: `Found ${formattedMetrics.length} metric(s)`,
          }, null, 2),
        }],
      }
    },
  )

  // ============================================================================
  // incrementMetric — увеличить/уменьшить counter метрику
  // ============================================================================
  server.tool(
    'incrementMetric',
    'Increment or decrement a counter metric. Use for metrics like "workouts done", "interviews", etc.',
    {
      metricId: z.string().describe('Metric ID'),
      delta: z.number().describe('Change amount (+1, -1, +5, etc.)'),
      note: z.string().optional().describe('Optional comment for the change'),
    },
    async ({ metricId, delta, note }) => {
      const userId = getUserId()
      if (!userId) throw new Error('User not authenticated')

      console.log(`➕ incrementMetric: metric=${metricId?.slice(0, 8)}, delta=${delta}, user=${userId?.slice(0, 8)}`)

      const [metric] = await db
        .select()
        .from(block)
        .where(
          and(
            eq(block.id, metricId),
            eq(block.userId, userId),
            isNull(block.deletedAt),
          ),
        )
        .limit(1)

      if (!metric) throw new Error('Metric not found')

      const content = (metric.content as Record<string, unknown>) || {}
      
      // Проверяем что это метрика
      if (content.metricType !== 'counter' && content.metricType !== 'number') {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'Not a metric',
              message: 'This block is not a metric.',
            }, null, 2),
          }],
        }
      }

      if (content.metricType !== 'counter') {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'Wrong metric type',
              message: `This metric is "${content.metricType}", not "counter". Use setMetricValue for number metrics.`,
            }, null, 2),
          }],
        }
      }

      const currentValue = (content.currentValue as number) || 0
      const newValue = currentValue + delta
      const history = (content.history as Array<Record<string, unknown>>) || []

      const newEntry = {
        value: newValue,
        timestamp: new Date().toISOString(),
        delta,
        ...(note && { note }),
      }

      const updatedContent = {
        ...content,
        currentValue: newValue,
        history: [...history, newEntry],
      }

      await db
        .update(block)
        .set({
          content: updatedContent,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(block.id, metricId))

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: {
              metricId,
              title: metric.title,
              previousValue: currentValue,
              newValue,
              delta,
              unit: content.unit,
            },
            message: `${metric.title}: ${currentValue} → ${newValue} (${delta > 0 ? '+' : ''}${delta}${content.unit ? ' ' + content.unit : ''})`,
          }, null, 2),
        }],
      }
    },
  )

  // ============================================================================
  // setMetricValue — установить значение number метрики
  // ============================================================================
  server.tool(
    'setMetricValue',
    'Set absolute value for a number metric. Use for metrics like "weight", "balance", "temperature".',
    {
      metricId: z.string().describe('Metric ID'),
      value: z.number().describe('New value to set'),
      note: z.string().optional().describe('Optional comment for the change'),
    },
    async ({ metricId, value, note }) => {
      const userId = getUserId()
      if (!userId) throw new Error('User not authenticated')

      console.log(`📝 setMetricValue: metric=${metricId?.slice(0, 8)}, value=${value}, user=${userId?.slice(0, 8)}`)

      const [metric] = await db
        .select()
        .from(block)
        .where(
          and(
            eq(block.id, metricId),
            eq(block.userId, userId),
            isNull(block.deletedAt),
          ),
        )
        .limit(1)

      if (!metric) throw new Error('Metric not found')

      const content = (metric.content as Record<string, unknown>) || {}
      
      // Проверяем что это метрика
      if (content.metricType !== 'counter' && content.metricType !== 'number') {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'Not a metric',
              message: 'This block is not a metric.',
            }, null, 2),
          }],
        }
      }

      if (content.metricType !== 'number') {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'Wrong metric type',
              message: `This metric is "${content.metricType}", not "number". Use incrementMetric for counter metrics.`,
            }, null, 2),
          }],
        }
      }

      const currentValue = (content.currentValue as number) || 0
      const delta = value - currentValue
      const history = (content.history as Array<Record<string, unknown>>) || []

      const newEntry = {
        value,
        timestamp: new Date().toISOString(),
        delta,
        ...(note && { note }),
      }

      const updatedContent = {
        ...content,
        currentValue: value,
        history: [...history, newEntry],
      }

      await db
        .update(block)
        .set({
          content: updatedContent,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(block.id, metricId))

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: {
              metricId,
              title: metric.title,
              previousValue: currentValue,
              newValue: value,
              delta,
              unit: content.unit,
            },
            message: `${metric.title}: ${currentValue} → ${value}${content.unit ? ' ' + content.unit : ''} (${delta >= 0 ? '+' : ''}${delta})`,
          }, null, 2),
        }],
      }
    },
  )

  // ============================================================================
  // getMetricHistory — получить историю метрики
  // ============================================================================
  server.tool(
    'getMetricHistory',
    'Get history of a metric with statistics. Use to analyze trends and progress.',
    {
      metricId: z.string().describe('Metric ID'),
      days: z.number().min(1).max(365).optional().describe('Number of days to get history for (default: 30)'),
    },
    async ({ metricId, days = 30 }) => {
      const userId = getUserId()
      if (!userId) throw new Error('User not authenticated')

      console.log(`📈 getMetricHistory: metric=${metricId?.slice(0, 8)}, days=${days}, user=${userId?.slice(0, 8)}`)

      const [metric] = await db
        .select()
        .from(block)
        .where(
          and(
            eq(block.id, metricId),
            eq(block.userId, userId),
            isNull(block.deletedAt),
          ),
        )
        .limit(1)

      if (!metric) throw new Error('Metric not found')

      const content = (metric.content as Record<string, unknown>) || {}
      
      // Проверяем что это метрика
      if (content.metricType !== 'counter' && content.metricType !== 'number') {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'Not a metric',
              message: 'This block is not a metric.',
            }, null, 2),
          }],
        }
      }

      const allHistory = (content.history as Array<{ value: number; timestamp: string; delta?: number; note?: string }>) || []

      // Фильтруем по дням
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)

      const history = allHistory.filter(h => new Date(h.timestamp) >= cutoffDate)

      // Считаем статистику
      let stats = {
        min: 0,
        max: 0,
        avg: 0,
        totalDelta: 0,
        entriesCount: history.length,
      }

      if (history.length > 0) {
        const values = history.map(h => h.value)
        stats.min = Math.min(...values)
        stats.max = Math.max(...values)
        stats.avg = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100
        
        // Общее изменение = последнее значение - первое значение за период
        if (history.length >= 2) {
          stats.totalDelta = history[history.length - 1].value - history[0].value
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: {
              metric: {
                id: metric.id,
                title: metric.title,
                metricType: content.metricType,
                currentValue: content.currentValue,
                unit: content.unit,
                goal: content.goal,
              },
              history: history.slice(-50), // Последние 50 записей
              stats,
              period: `${days} days`,
            },
            message: `History for "${metric.title}": ${history.length} entries over ${days} days`,
          }, null, 2),
        }],
      }
    },
  )
}
