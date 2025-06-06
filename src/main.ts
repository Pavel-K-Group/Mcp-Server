import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { z } from 'zod'
import express from 'express'
import cors from 'cors'

// Импортируем GitHub функции
import * as issuesApi from './github-functions/issues.js'
import * as pullRequestsApi from './github-functions/pull-requests.js'
import * as commentsApi from './github-functions/comments.js'
import * as actionsApi from './github-functions/actions.js'

// Импортируем Telegram функции
import * as telegramApi from './telegram-functions/messages.js'

// Create an MCP server
const server = new McpServer({
    name: 'GitHub & Telegram MCP Server',
    version: '1.0.0',
})

// Схема для информации о репозитории
const repositorySchema = {
    owner: z.string().describe('Владелец репозитория'),
    repo: z.string().describe('Название репозитория'),
}

// Получить issue по номеру
server.tool(
    'getIssue',
    'Получить информацию об issue по номеру',
    {
        ...repositorySchema,
        issueNumber: z.number().describe('Номер issue'),
    },
    async ({ owner, repo, issueNumber }) => {
        try {
            const issue = await issuesApi.getIssue({ owner, repo }, issueNumber)
            return {
                content: [
                    { type: 'text' as const, text: JSON.stringify(issue, null, 2) },
                ],
            }
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `Ошибка: ${
                            error instanceof Error ? error.message : String(error)
                        }`,
                    },
                ],
            }
        }
    },
)

// Обновить issue
server.tool(
    'updateIssue',
    'Обновить issue (заголовок, описание или состояние)',
    {
        ...repositorySchema,
        issueNumber: z.number().describe('Номер issue'),
        title: z.string().optional().describe('Новый заголовок issue'),
        body: z.string().optional().describe('Новое описание issue'),
        state: z.enum(['open', 'closed']).optional().describe('Новое состояние issue'),
    },
    async ({ owner, repo, issueNumber, title, body, state }) => {
        try {
            const updates: { title?: string; body?: string; state?: 'open' | 'closed' } =
                {}
            if (title !== undefined) updates.title = title
            if (body !== undefined) updates.body = body
            if (state !== undefined) updates.state = state

            const issue = await issuesApi.updateIssue(
                { owner, repo },
                issueNumber,
                updates,
            )
            return {
                content: [
                    { type: 'text' as const, text: JSON.stringify(issue, null, 2) },
                ],
            }
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `Ошибка: ${
                            error instanceof Error ? error.message : String(error)
                        }`,
                    },
                ],
            }
        }
    },
)

// Список issues
server.tool(
    'listIssues',
    'Получить список issues репозитория',
    {
        ...repositorySchema,
        state: z
            .enum(['open', 'closed', 'all'])
            .optional()
            .describe('Состояние issues для фильтрации'),
        perPage: z
            .number()
            .optional()
            .describe('Количество результатов на странице (по умолчанию 30)'),
    },
    async ({ owner, repo, state, perPage }) => {
        try {
            const issues = await issuesApi.listIssues(
                { owner, repo },
                { state, per_page: perPage },
            )
            return {
                content: [
                    { type: 'text' as const, text: JSON.stringify(issues, null, 2) },
                ],
            }
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `Ошибка: ${
                            error instanceof Error ? error.message : String(error)
                        }`,
                    },
                ],
            }
        }
    },
)

// Получить pull request по номеру
server.tool(
    'getPullRequest',
    'Получить информацию о pull request по номеру',
    {
        ...repositorySchema,
        pullNumber: z.number().describe('Номер pull request'),
    },
    async ({ owner, repo, pullNumber }) => {
        try {
            const pr = await pullRequestsApi.getPullRequest({ owner, repo }, pullNumber)
            return {
                content: [{ type: 'text' as const, text: JSON.stringify(pr, null, 2) }],
            }
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `Ошибка: ${
                            error instanceof Error ? error.message : String(error)
                        }`,
                    },
                ],
            }
        }
    },
)

// Обновить pull request
server.tool(
    'updatePullRequest',
    'Обновить pull request (заголовок, описание или состояние)',
    {
        ...repositorySchema,
        pullNumber: z.number().describe('Номер pull request'),
        title: z.string().optional().describe('Новый заголовок pull request'),
        body: z.string().optional().describe('Новое описание pull request'),
        state: z
            .enum(['open', 'closed'])
            .optional()
            .describe('Новое состояние pull request'),
    },
    async ({ owner, repo, pullNumber, title, body, state }) => {
        try {
            const updates: { title?: string; body?: string; state?: 'open' | 'closed' } =
                {}
            if (title !== undefined) updates.title = title
            if (body !== undefined) updates.body = body
            if (state !== undefined) updates.state = state

            const pr = await pullRequestsApi.updatePullRequest(
                { owner, repo },
                pullNumber,
                updates,
            )
            return {
                content: [{ type: 'text' as const, text: JSON.stringify(pr, null, 2) }],
            }
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `Ошибка: ${
                            error instanceof Error ? error.message : String(error)
                        }`,
                    },
                ],
            }
        }
    },
)

// Список pull requests
server.tool(
    'listPullRequests',
    'Получить список pull requests репозитория',
    {
        ...repositorySchema,
        state: z
            .enum(['open', 'closed', 'all'])
            .optional()
            .describe('Состояние pull requests для фильтрации'),
        perPage: z
            .number()
            .optional()
            .describe('Количество результатов на странице (по умолчанию 30)'),
    },
    async ({ owner, repo, state, perPage }) => {
        try {
            const prs = await pullRequestsApi.listPullRequests(
                { owner, repo },
                { state, per_page: perPage },
            )
            return {
                content: [{ type: 'text' as const, text: JSON.stringify(prs, null, 2) }],
            }
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `Ошибка: ${
                            error instanceof Error ? error.message : String(error)
                        }`,
                    },
                ],
            }
        }
    },
)

// Создать комментарий к issue
server.tool(
    'createIssueComment',
    'Создать комментарий к issue',
    {
        ...repositorySchema,
        issueNumber: z.number().describe('Номер issue'),
        body: z.string().describe('Текст комментария'),
    },
    async ({ owner, repo, issueNumber, body }) => {
        try {
            const comment = await commentsApi.createIssueComment(
                { owner, repo },
                issueNumber,
                body,
            )
            return {
                content: [
                    { type: 'text' as const, text: JSON.stringify(comment, null, 2) },
                ],
            }
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `Ошибка: ${
                            error instanceof Error ? error.message : String(error)
                        }`,
                    },
                ],
            }
        }
    },
)

// Создать комментарий к pull request
server.tool(
    'createPullRequestComment',
    'Создать комментарий к pull request',
    {
        ...repositorySchema,
        pullNumber: z.number().describe('Номер pull request'),
        body: z.string().describe('Текст комментария'),
    },
    async ({ owner, repo, pullNumber, body }) => {
        try {
            const comment = await commentsApi.createPullRequestComment(
                { owner, repo },
                pullNumber,
                body,
            )
            return {
                content: [
                    { type: 'text' as const, text: JSON.stringify(comment, null, 2) },
                ],
            }
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `Ошибка: ${
                            error instanceof Error ? error.message : String(error)
                        }`,
                    },
                ],
            }
        }
    },
)

// Список workflow runs (Actions)
server.tool(
    'listWorkflowRuns',
    'Получить список workflow runs (GitHub Actions) репозитория',
    {
        ...repositorySchema,
        status: z
            .enum([
                'completed',
                'action_required',
                'cancelled',
                'failure',
                'neutral',
                'skipped',
                'stale',
                'success',
                'timed_out',
                'in_progress',
                'queued',
                'requested',
                'waiting',
                'pending',
            ])
            .optional()
            .describe('Статус workflow runs для фильтрации'),
        perPage: z
            .number()
            .optional()
            .describe('Количество результатов на странице (по умолчанию 30)'),
        page: z.number().optional().describe('Номер страницы (по умолчанию 1)'),
    },
    async ({ owner, repo, status, perPage, page }) => {
        try {
            const runs = await actionsApi.listWorkflowRuns(
                { owner, repo },
                { status, per_page: perPage, page },
            )
            return {
                content: [{ type: 'text' as const, text: JSON.stringify(runs, null, 2) }],
            }
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `Ошибка: ${
                            error instanceof Error ? error.message : String(error)
                        }`,
                    },
                ],
            }
        }
    },
)

// Получить статус workflow run
server.tool(
    'getWorkflowRun',
    'Получить статус конкретного workflow run (GitHub Action)',
    {
        ...repositorySchema,
        runId: z.number().describe('ID workflow run'),
    },
    async ({ owner, repo, runId }) => {
        try {
            const run = await actionsApi.getWorkflowRun({ owner, repo }, runId)
            return {
                content: [{ type: 'text' as const, text: JSON.stringify(run, null, 2) }],
            }
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `Ошибка: ${
                            error instanceof Error ? error.message : String(error)
                        }`,
                    },
                ],
            }
        }
    },
)

// Получить детали workflow run
server.tool(
    'getWorkflowRunDetails',
    'Получить детальную информацию о workflow run включая jobs',
    {
        ...repositorySchema,
        runId: z.number().describe('ID workflow run'),
        perPage: z
            .number()
            .optional()
            .describe('Количество jobs на странице (по умолчанию 30)'),
        page: z.number().optional().describe('Номер страницы для jobs (по умолчанию 1)'),
    },
    async ({ owner, repo, runId, perPage, page }) => {
        try {
            const details = await actionsApi.getWorkflowRunDetails(
                { owner, repo },
                runId,
                { per_page: perPage, page },
            )
            return {
                content: [
                    { type: 'text' as const, text: JSON.stringify(details, null, 2) },
                ],
            }
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `Ошибка: ${
                            error instanceof Error ? error.message : String(error)
                        }`,
                    },
                ],
            }
        }
    },
)

// Отменить workflow run
server.tool(
    'cancelWorkflowRun',
    'Отменить выполнение workflow run (GitHub Action)',
    {
        ...repositorySchema,
        runId: z.number().describe('ID workflow run для отмены'),
    },
    async ({ owner, repo, runId }) => {
        try {
            const result = await actionsApi.cancelWorkflowRun({ owner, repo }, runId)
            return {
                content: [
                    { type: 'text' as const, text: JSON.stringify(result, null, 2) },
                ],
            }
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `Ошибка: ${
                            error instanceof Error ? error.message : String(error)
                        }`,
                    },
                ],
            }
        }
    },
)

// Повторить workflow run
server.tool(
    'rerunWorkflowRun',
    'Повторить выполнение workflow run (GitHub Action)',
    {
        ...repositorySchema,
        runId: z.number().describe('ID workflow run для повтора'),
    },
    async ({ owner, repo, runId }) => {
        try {
            const result = await actionsApi.rerunWorkflowRun({ owner, repo }, runId)
            return {
                content: [
                    { type: 'text' as const, text: JSON.stringify(result, null, 2) },
                ],
            }
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `Ошибка: ${
                            error instanceof Error ? error.message : String(error)
                        }`,
                    },
                ],
            }
        }
    },
)

// Повторить неудачные jobs
server.tool(
    'rerunFailedJobs',
    'Повторить только неудачные jobs в workflow run',
    {
        ...repositorySchema,
        runId: z.number().describe('ID workflow run для повтора неудачных jobs'),
    },
    async ({ owner, repo, runId }) => {
        try {
            const result = await actionsApi.rerunFailedJobs({ owner, repo }, runId)
            return {
                content: [
                    { type: 'text' as const, text: JSON.stringify(result, null, 2) },
                ],
            }
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `Ошибка: ${
                            error instanceof Error ? error.message : String(error)
                        }`,
                    },
                ],
            }
        }
    },
)

// Отправить сообщение в Telegram
server.tool(
    'sendTelegramMessage',
    'Отправить сообщение в Telegram',
    {
        text: z.string().describe('Текст сообщения для отправки'),
    },
    async ({ text }) => {
        try {
            const result = await telegramApi.sendMessage(text)
            return {
                content: [
                    { type: 'text' as const, text: JSON.stringify(result, null, 2) },
                ],
            }
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `Ошибка: ${
                            error instanceof Error ? error.message : String(error)
                        }`,
                    },
                ],
            }
        }
    },
)

// Создаем Express приложение
const app = express()
const PORT = 8080

// Настраиваем CORS
app.use(
    cors({
        origin: '*',
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    }),
)

// Обслуживаем главную страницу
app.get('/', (req, res) => {
    res.json({
        name: 'GitHub & Telegram MCP Server',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            sse: '/sse',
        },
    })
})

// Глобальная переменная для хранения транспортов по сессиям
const transports = new Map<string, SSEServerTransport>()

// SSE endpoint для MCP - для получения сообщений от сервера
app.get('/sse', async (req, res) => {
    console.log('Новое SSE соединение установлено')

    try {
        const transport = new SSEServerTransport('/message', res)
        const sessionId = `session_${Date.now()}_${Math.random()}`
        transports.set(sessionId, transport)

        // Удаляем транспорт при закрытии соединения
        res.on('close', () => {
            transports.delete(sessionId)
            console.log(`❌ SSE соединение ${sessionId} закрыто`)
        })

        await server.connect(transport)
        console.log(`✅ MCP сервер подключен через SSE (сессия: ${sessionId})`)
    } catch (error) {
        console.error('❌ Ошибка подключения SSE:', error)
        res.status(500).json({ error: 'Failed to establish SSE connection' })
    }
})

// POST endpoint для обработки сообщений от клиента
app.post('/message', async (req, res) => {
    console.log('Получено POST сообщение:', req.body)

    try {
        // Ищем любой активный транспорт для обработки сообщения
        const activeTransport = Array.from(transports.values())[0]

        if (!activeTransport) {
            return res.status(400).json({
                error: 'No active SSE connection found',
            })
        }

        // Обрабатываем POST сообщение через активный транспорт
        await activeTransport.handlePostMessage(req, res)
        console.log('✅ POST сообщение обработано')
    } catch (error) {
        console.error('❌ Ошибка обработки POST сообщения:', error)
        res.status(500).json({ error: 'Failed to handle POST message' })
    }
})

// Запускаем сервер
app.listen(PORT, () => {
    console.log(`🚀 GitHub & Telegram MCP Server запущен на http://localhost:${PORT}`)
    console.log(`📡 SSE endpoint доступен на http://localhost:${PORT}/sse`)
    console.log(`🔧 Настройте ваш MCP клиент на: http://localhost:${PORT}/sse`)
})
