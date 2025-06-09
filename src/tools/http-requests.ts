import { z } from 'zod'
import type { ToolDefinition } from '../types/tool.js'

// Схема для валидации входных данных
const inputSchema = {
    url: z.string().url().describe('URL для запроса'),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('GET').describe('HTTP метод'),
    headers: z.record(z.string()).optional().describe('HTTP заголовки'),
    body: z.string().optional().describe('Тело запроса (для POST/PUT)'),
}

// Экспортируем определение инструмента
export const toolDefinition: ToolDefinition = {
    name: 'httpRequest',
    description: 'Выполнить HTTP запрос к внешнему API',
    inputSchema: inputSchema,
    handler: async (input: unknown) => {
        try {
            const parsed = z.object(inputSchema).parse(input)
            
            const requestOptions: RequestInit = {
                method: parsed.method,
                headers: {
                    'Content-Type': 'application/json',
                    ...parsed.headers,
                },
            }
            
            if (parsed.body && (parsed.method === 'POST' || parsed.method === 'PUT')) {
                requestOptions.body = parsed.body
            }
            
            const response = await fetch(parsed.url, requestOptions)
            const data = await response.text()
            
            return {
                content: [
                    { type: 'text' as const, text: `HTTP ${parsed.method} ${parsed.url}\nСтатус: ${response.status} ${response.statusText}\n\nОтвет:\n${data}` },
                ],
            }
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `Ошибка HTTP запроса: ${
                            error instanceof Error ? error.message : String(error)
                        }`,
                    },
                ],
            }
        }
    },
} 