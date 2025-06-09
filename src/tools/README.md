# 🛠️ Универсальная библиотека инструментов

Эта папка содержит все инструменты (tools) для MCP сервера. Каждый файл представляет собой отдельный самодостаточный инструмент.

## 📋 Как создать новый инструмент

### 1. Создайте файл в папке `src/tools/`
Например: `my-awesome-tool.ts`

### 2. Используйте стандартный шаблон:

```typescript
import { z } from 'zod'
import type { ToolDefinition } from '../types/tool.js'

// Схема для валидации входных данных
const inputSchema = {
    param1: z.string().describe('Описание параметра 1'),
    param2: z.number().optional().describe('Необязательный параметр 2'),
}

// Экспортируем определение инструмента
export const toolDefinition: ToolDefinition = {
    name: 'myAwesomeTool',
    description: 'Описание того, что делает инструмент',
    inputSchema: inputSchema,
    handler: async (input: unknown) => {
        try {
            const parsed = z.object(inputSchema).parse(input)
            
            // Ваша бизнес-логика здесь
            const result = `Обработка: ${parsed.param1}`
            
            return {
                content: [
                    { type: 'text' as const, text: result },
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
```

### 3. Перезапустите сервер
Ваш инструмент автоматически загрузится при следующем запуске!

## 🎯 Примеры инструментов

- **`messages.ts`** - Отправка сообщений в Telegram
- **`database-tool.ts`** - Работа с базами данных
- **`file-operations.ts`** - Чтение/запись файлов
- **`http-requests.ts`** - HTTP запросы к внешним API

## 🔥 Ключевые принципы

### ✅ Что нужно делать:
- Экспортировать `toolDefinition` с типом `ToolDefinition`
- Использовать Zod схемы для валидации входных данных
- Обрабатывать ошибки в handler'е
- Возвращать результат в формате `{ content: [{ type: 'text', text: string }] }`

### ❌ Что НЕ нужно делать:
- Модифицировать `main.ts` или другие файлы
- Использовать `any` типы (используйте `unknown`)
- Забывать про обработку ошибок

## 🚀 Добавление/Удаление инструментов

**Добавить:** Создайте файл в этой папке → перезапустите сервер ✅

**Удалить:** Удалите файл из этой папки → перезапустите сервер ✅

**Отключить временно:** Переименуйте файл (например, добавьте `.disabled` в конец)

## 🔧 Отладка

Если инструмент не загружается:
1. Проверьте экспорт `toolDefinition`
2. Проверьте консоль сервера на ошибки
3. Убедитесь что схема валидации корректна
4. Проверьте синтаксис TypeScript

Логи загрузки появятся в консоли при старте сервера. 