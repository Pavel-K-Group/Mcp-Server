# Universal MCP Server

Универсальный MCP сервер с модульной архитектурой плагинов. Позволяет легко добавлять новые инструменты без изменения основного кода.

## ⚡ Быстрый старт

# через Docker (с портом 8080 наружу)
docker-compose -f docker-compose.local.yml up --build

### 🏠 Локальный запуск

```bash
# 1. Клонируйте репозиторий
git clone <repo-url>
cd Telegram-Mcp-Server

# 2. Установите зависимости
npm install

# 3. Настройте переменные окружения
cp .env.example .env
# Отредактируйте .env - добавьте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID

# 4. Запуск для разработки (рекомендуется)
npm run dev

```

Сервер запустится на `http://localhost:8080` с MCP endpoint на `/mcp`

### 🚀 Продакшн деплой

```bash
# На сервере
docker-compose up --build -d
```

### 🔧 Настройка MCP клиента (Claude Desktop)

Добавьте в конфигурацию (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
    "mcpServers": {
        "Universal MCP Server": {
            "url": "http://localhost:8080/mcp"
        }
    }
}
```

---

## 🚀 Особенности

- **Модульная архитектура**: добавляйте новые инструменты, просто создавая файлы в папке `src/tools/`
- **Автоматическая загрузка**: система автоматически обнаруживает и регистрирует все инструменты
- **TypeScript**: полная типизация для безопасности и удобства разработки
- **Docker поддержка**: готовые Docker и Docker Compose конфигурации
- **Готовые инструменты**: 5 встроенных инструментов для различных задач

## 📦 Встроенные инструменты

1. **Calculator** - математические вычисления с функциями и константами
2. **Telegram Messages** - отправка сообщений в Telegram
3. **HTTP Requests** - выполнение HTTP запросов к внешним API
4. **File Operations** - чтение и запись файлов
5. **SQL Database** - выполнение SQL запросов (SQLite)

## ⚙️ Детальная настройка

### Переменные окружения

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# Server Configuration
PORT=8080
```

#### Получение токена Telegram бота:

1. Найдите бота @BotFather в Telegram
2. Отправьте команду `/newbot`
3. Следуйте инструкциям для создания бота
4. Скопируйте полученный токен

#### Получение Chat ID:

1. Запустите вашего бота
2. Отправьте ему любое сообщение
3. Перейдите по ссылке: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Найдите значение `chat.id` в ответе

## 🛠️ Создание новых инструментов

Чтобы добавить новый инструмент, создайте файл в папке `src/tools/` следующего формата:

```typescript
import { z } from 'zod';
import type { ToolDefinition } from '../types/tool.js';

export const toolDefinition: ToolDefinition = {
  name: 'myNewTool',
  config: {
    title: 'My New Tool',
    description: 'Описание нового инструмента',
    inputSchema: {
      parameter1: z.string().describe('Описание параметра'),
      parameter2: z.number().optional().describe('Опциональный параметр')
    },
  },
  handler: async (args) => {
    // Логика инструмента
    return {
      content: [
        { type: 'text', text: 'Результат работы инструмента' }
      ]
    };
  }
};
```

Система автоматически обнаружит и зарегистрирует новый инструмент при следующем запуске сервера.

## 📁 Структура проекта

```
Universal-MCP-Server/
├── src/
│   ├── tools/                   # 🔧 Папка с инструментами
│   │   ├── README.md           # Документация для разработчиков
│   │   ├── calculator.ts       # Математический калькулятор
│   │   ├── messages.ts         # Telegram сообщения
│   │   ├── http-requests.ts    # HTTP запросы
│   │   └── database-tool.ts    # SQL запросы
│   ├── types/
│   │   └── tool.ts             # TypeScript интерфейсы
│   ├── utils/
│   │   └── tool-loader.ts      # Автозагрузчик инструментов
│   └── main.ts                 # Главный файл сервера
├── dist/                       # Скомпилированные файлы
├── docker-compose.yml          # Docker Compose для продакшена
├── docker-compose.local.yml    # Docker Compose для локальной разработки
├── Dockerfile                  # Docker образ
├── .env                        # Переменные окружения
├── .env.example               # Пример переменных окружения
└── README.md                   # Эта документация
```

## 📚 Доступные инструменты

### 🧮 calculator
Математические вычисления с поддержкой функций и констант

```typescript
// Параметры:
{
  expression: string // Математическое выражение (например: "2 + 2", "sqrt(16)", "sin(π/2)")
}
```

### 📱 sendTelegramMessage
Отправка сообщений в Telegram

```typescript
// Параметры:
{
  text: string // Текст сообщения
}
```

### 🌐 httpRequest
Выполнение HTTP запросов к внешним API

```typescript
// Параметры:
{
  url: string,           // URL для запроса
  method?: "GET" | "POST" | "PUT" | "DELETE", // HTTP метод (по умолчанию GET)
  headers?: object,      // HTTP заголовки
  body?: string         // Тело запроса (для POST/PUT)
}
```

### 🗃️ executeSQL
Выполнение SQL запросов

```typescript
// Параметры:
{
  query: string,     // SQL запрос
  database?: string  // Имя базы данных (по умолчанию main)
}
```

## 🔧 Технические особенности

- **ES Modules**: современная модульная система JavaScript
- **TypeScript**: полная типизация с компиляцией в ES2020
- **Express.js**: HTTP сервер для MCP протокола
- **Server-Sent Events (SSE)**: для MCP коммуникации
- **Zod**: валидация схем для безопасности типов
- **Автоматическая загрузка**: переменные окружения через dotenv
- **Новое MCP API**: использует `registerTool()` из SDK v1.13.1

## 🐳 Docker

Проект включает готовые Docker конфигурации:

- `Dockerfile` - образ для сборки приложения
- `docker-compose.yml` - для продакшен деплоя (без проброса портов)
- `docker-compose.local.yml` - для локальной разработки (с портом 8080 наружу)

**Локальная разработка:**
```bash
docker-compose -f docker-compose.local.yml up --build -d
```

**Продакшн деплой:**
```bash
docker-compose up --build -d
```

**Важно:** 
- `docker-compose.local.yml` - для локальной разработки (порт 8080 наружу)
- `docker-compose.yml` - для продакшена (без проброса портов, с Coolify лейблами)

## 🤝 Вклад в проект

1. Форкните репозиторий
2. Создайте ветку для новой функции
3. Добавьте свои инструменты в `src/tools/`
4. Протестируйте изменения
5. Создайте Pull Request

## 📄 Лицензия

MIT License. Смотрите файл LICENSE для деталей.

---

**Создано с ❤️ для упрощения работы с MCP инструментами**
