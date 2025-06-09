import { z } from 'zod'
import type { ToolDefinition } from '../types/tool.js'

// Схема для валидации входных данных
const inputSchema = {
    query: z.string().describe('SQL запрос для выполнения'),
    database: z.string().optional().describe('Имя базы данных (по умолчанию main)'),
}

// Экспортируем определение инструмента
export const toolDefinition: ToolDefinition = {
    name: 'executeSQL',
    description: 'Выполнить SQL запрос к базе данных',
    inputSchema: inputSchema,
    handler: async (input: unknown) => {
        try {
            const parsed = z.object(inputSchema).parse(input)
            const database = parsed.database || 'main'
            
            // Здесь была бы реальная логика работы с БД
            const mockResult = {
                database: database,
                query: parsed.query,
                rows: [],
                affected: 0,
                time: Date.now()
            }
            
            return {
                content: [
                    { type: 'text' as const, text: `База данных: ${database}\nЗапрос выполнен:\n${parsed.query}\n\nРезультат: ${JSON.stringify(mockResult, null, 2)}` },
                ],
            }
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `Ошибка выполнения SQL: ${
                            error instanceof Error ? error.message : String(error)
                        }`,
                    },
                ],
            }
        }
    },
} 