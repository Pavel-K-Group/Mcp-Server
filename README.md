# Telegram MCP Server

Этот MCP сервер предоставляет инструменты для отправки сообщений в Telegram через Claude Desktop.

## Установка и настройка

### 1. Установка зависимостей

```bash
npm install
```

### 2. Настройка Telegram бота

Создайте файл `.env` в корне проекта:

```
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

#### Получение токена бота:

1. Найдите бота @BotFather в Telegram
2. Отправьте команду `/newbot`
3. Следуйте инструкциям для создания бота
4. Скопируйте полученный токен

#### Получение Chat ID:

1. Запустите вашего бота
2. Отправьте ему любое сообщение
3. Перейдите по ссылке: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Найдите значение `chat.id` в ответе

## Запуск сервера

### Вариант 1: Разработка (рекомендуется)

```bash
npm run dev
```

### Вариант 2: Production сборка

```bash
npm run build
npm start
```

### Вариант 3: Docker Compose

```bash
# Сборка и запуск
docker-compose up --build

# Запуск в фоне
docker-compose up -d

# Остановка
docker-compose down
```

Сервер запустится на `http://localhost:8080` с SSE endpoint на `/sse`.

## Настройка Claude Desktop

Отредактируйте файл конфигурации Claude Desktop:

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`  
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

Добавьте следующую конфигурацию:

```json
{
    "mcpServers": {
        "Telegram": {
            "url": "http://localhost:8080/sse"
        }
    }
}
```

После изменения конфигурации перезапустите Claude Desktop.

## Доступные инструменты

Сервер предоставляет следующий инструмент для работы с Telegram:

### Сообщения

-   `sendTelegramMessage` - отправить сообщение в Telegram

## Использование

После настройки вы можете попросить Claude отправить сообщения в Telegram:

```
Отправь сообщение "Привет!" в Telegram
```

Claude будет использовать инструмент `sendTelegramMessage` для отправки сообщения в указанный чат.

## Структура проекта

```
Telegram-Mcp-Server/
├── src/
│   ├── telegram-functions/
│   │   └── messages.ts          # Функции для работы с Telegram API
│   └── main.ts                  # Главный файл сервера
├── dist/                        # Скомпилированные файлы
├── docker-compose.yml           # Docker Compose конфигурация
├── Dockerfile                   # Docker образ
├── .env                         # Переменные окружения (создать самостоятельно)
├── .env.example                 # Пример файла переменных окружения
└── README.md                    # Документация
```

## Технические особенности

- Использует ES modules (type: "module" в package.json)
- TypeScript с компиляцией в ES2020
- Express.js для HTTP сервера
- Server-Sent Events (SSE) для MCP протокола
- Автоматическая загрузка переменных окружения через dotenv
