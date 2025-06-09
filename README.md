# Universal MCP Server

Универсальный MCP сервер с модульной архитектурой плагинов. Позволяет легко добавлять новые инструменты без изменения основного кода.

## 🚀 Особенности

- **Модульная архитектура**: добавляйте новые инструменты, просто создавая файлы в папке `src/tools/`
- **Автоматическая загрузка**: система автоматически обнаруживает и регистрирует все инструменты
- **TypeScript**: полная типизация для безопасности и удобства разработки
- **Docker поддержка**: готовые Docker и Docker Compose конфигурации
- **Готовые инструменты**: 4 встроенных инструмента для различных задач

## 📦 Встроенные инструменты

1. **Telegram Messages** - отправка сообщений в Telegram
2. **HTTP Requests** - выполнение HTTP запросов к внешним API
3. **File Operations** - чтение и запись файлов
4. **SQL Database** - выполнение SQL запросов (SQLite)

## ⚙️ Установка и настройка

### 1. Установка зависимостей

```bash
npm install
```

### 2. Настройка переменных окружения

Создайте файл `.env` в корне проекта на основе `.env.example`:

```bash
cp .env.example .env
```

Заполните необходимые переменные:

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

## 🚀 Запуск сервера

### Разработка (рекомендуется)

```bash
npm run dev
```

### Production сборка

```bash
npm run build
npm start
```

### Docker Compose

```bash
# Сборка и запуск
docker-compose up --build

# Запуск в фоне
docker-compose up -d

# Остановка
docker-compose down
```

Сервер запустится на `http://localhost:8080` с SSE endpoint на `/sse`.

## 🔧 Настройка Claude Desktop

Отредактируйте файл конфигурации Claude Desktop:

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`  
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

Добавьте следующую конфигурацию:

```json
{
    "mcpServers": {
        "Universal MCP Server": {
            "url": "http://localhost:8080/sse"
        }
    }
}
```

После изменения конфигурации перезапустите Claude Desktop.

## 🛠️ Создание новых инструментов

Чтобы добавить новый инструмент, создайте файл в папке `src/tools/` следующего формата:

```typescript
import { z } from 'zod';
import type { ToolDefinition } from '../types/tool.js';

export const toolDefinition: ToolDefinition = {
  name: 'myNewTool',
  description: 'Описание нового инструмента',
  inputSchema: z.object({
    parameter1: z.string().describe('Описание параметра'),
    parameter2: z.number().optional().describe('Опциональный параметр')
  }),
  handler: async (args) => {
    // Логика инструмента
    return {
      success: true,
      result: 'Результат работы инструмента'
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
│   │   ├── messages.ts         # Telegram сообщения
│   │   ├── http-requests.ts    # HTTP запросы
│   │   ├── file-operations.ts  # Файловые операции
│   │   └── database-tool.ts    # SQL запросы
│   ├── types/
│   │   └── tool.ts             # TypeScript интерфейсы
│   ├── utils/
│   │   └── tool-loader.ts      # Автозагрузчик инструментов
│   └── main.ts                 # Главный файл сервера
├── dist/                       # Скомпилированные файлы
├── docker-compose.yml          # Docker Compose конфигурация
├── Dockerfile                  # Docker образ
├── .env                        # Переменные окружения
├── .env.example               # Пример переменных окружения
└── README.md                   # Эта документация
```

## 📚 Доступные инструменты

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

### 📄 fileOperations
Чтение и запись файлов

```typescript
// Параметры:
{
  action: "read" | "write", // Действие
  filepath: string,         // Путь к файлу
  content?: string         // Содержимое (только для write)
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

## 🐳 Docker

Проект включает готовые Docker конфигурации:

- `Dockerfile` - для сборки образа
- `docker-compose.yml` - для быстрого развертывания

```bash
# Сборка и запуск одной командой
docker-compose up --build -d
```

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
