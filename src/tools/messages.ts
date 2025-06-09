import { z } from 'zod'
import type { ToolDefinition } from '../types/tool.js'

/**
 * Отправить сообщение в Telegram
 */
async function sendMessage(text: string) {
    // Получаем токен и chat ID из переменных окружения
    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN
    const telegramChatId = process.env.TELEGRAM_CHAT_ID

    if (!telegramBotToken) {
        throw new Error(
            'TELEGRAM_BOT_TOKEN не найден в переменных окружения. Добавьте его в .env файл.',
        )
    }

    if (!telegramChatId) {
        throw new Error(
            'TELEGRAM_CHAT_ID не найден в переменных окружения. Добавьте его в .env файл.',
        )
    }

    const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            chat_id: telegramChatId,
            text: text,
            parse_mode: 'HTML', // Поддержка HTML форматирования
        }),
    })

    if (!response.ok) {
        const errorData = (await response.json()) as { description?: string }
        throw new Error(
            `Ошибка отправки сообщения в Telegram: ${
                errorData.description || response.statusText
            }`,
        )
    }

    return await response.json()
}

// Схема для валидации входных данных
const inputSchema = {
    text: z.string().describe('Текст сообщения для отправки'),
}

// Экспортируем определение инструмента
export const toolDefinition: ToolDefinition = {
    name: 'sendTelegramMessage',
    description: 'Отправить сообщение в Telegram',
    inputSchema: inputSchema,
    handler: async (input: unknown) => {
        try {
            const parsed = z.object(inputSchema).parse(input)
            const result = await sendMessage(parsed.text)
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
}
