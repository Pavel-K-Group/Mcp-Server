import { z } from 'zod'
import type { ToolDefinition } from '../types/tool.js'

/**
 * Send message to Telegram
 */
async function sendMessage(text: string) {
    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN
    const telegramChatId = process.env.TELEGRAM_CHAT_ID

    if (!telegramBotToken) {
        return {
            success: false,
            operation: 'sendTelegram',
            error: 'TELEGRAM_BOT_TOKEN not configured',
            message: 'Telegram integration is not configured. TELEGRAM_BOT_TOKEN environment variable is missing.',
        }
    }

    if (!telegramChatId) {
        return {
            success: false,
            operation: 'sendTelegram',
            error: 'TELEGRAM_CHAT_ID not configured',
            message: 'Telegram integration is not configured. TELEGRAM_CHAT_ID environment variable is missing.',
        }
    }

    const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: telegramChatId,
                text: text,
                parse_mode: 'HTML',
            }),
        })

        if (!response.ok) {
            const errorData = (await response.json()) as { description?: string }
            return {
                success: false,
                operation: 'sendTelegram',
                error: errorData.description || response.statusText,
                message: `Failed to send Telegram message: ${errorData.description || response.statusText}`,
            }
        }

        const result = await response.json()
        return {
            success: true,
            operation: 'sendTelegram',
            data: result,
            message: 'Message sent to Telegram successfully',
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Network error'
        console.error(`❌ sendTelegramMessage error: ${errorMessage}`)
        return {
            success: false,
            operation: 'sendTelegram',
            error: errorMessage,
            message: `Failed to send Telegram message: ${errorMessage}`,
        }
    }
}

// Input schema
const inputSchema = {
    text: z.string().describe('Message text to send'),
}

// Export tool definition
export const toolDefinition: ToolDefinition = {
    name: 'sendTelegramMessage',
    description: 'Send a message to Telegram. Requires TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables to be configured.',
    inputSchema: inputSchema,
    handler: async (input: unknown) => {
        try {
            const parsed = z.object(inputSchema).parse(input)
            
            if (!parsed.text || parsed.text.trim() === '') {
                const result = {
                    success: false,
                    operation: 'sendTelegram',
                    error: 'Empty message',
                    message: 'Message text cannot be empty',
                }
                return {
                    content: [
                        { type: 'text' as const, text: JSON.stringify(result, null, 2) },
                    ],
                }
            }
            
            const result = await sendMessage(parsed.text)
            return {
                content: [
                    { type: 'text' as const, text: JSON.stringify(result, null, 2) },
                ],
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            const result = {
                success: false,
                operation: 'sendTelegram',
                error: errorMessage,
                message: `Failed to send Telegram message: ${errorMessage}`,
            }
            return {
                content: [
                    { type: 'text' as const, text: JSON.stringify(result, null, 2) },
                ],
            }
        }
    },
}
