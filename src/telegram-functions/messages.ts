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

/**
 * Отправить сообщение в Telegram
 */
export async function sendMessage(text: string) {
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
