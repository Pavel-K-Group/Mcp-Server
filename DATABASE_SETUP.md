# Настройка базы данных для MCP сервера

## Подключение к существующей базе данных Timelix

Если у вас уже есть база данных Timelix, просто укажите её в переменной окружения:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/timelix
```

## Создание новой базы данных

### 1. Установите PostgreSQL

Если PostgreSQL не установлен:

-   **Windows**: Скачайте с [официального сайта](https://www.postgresql.org/download/windows/)
-   **macOS**: `brew install postgresql`
-   **Linux**: `sudo apt-get install postgresql`

### 2. Создайте базу данных

```sql
-- Подключитесь к PostgreSQL как superuser
psql -U postgres

-- Создайте базу данных
CREATE DATABASE timelix;

-- Создайте пользователя (опционально)
CREATE USER timelix_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE timelix TO timelix_user;

-- Выйдите из psql
\q
```

### 3. Создайте таблицы

Выполните следующий SQL для создания необходимых таблиц:

```sql
-- Подключитесь к базе данных timelix
psql -U postgres -d timelix

-- Создайте enum типы
CREATE TYPE "block_type" AS ENUM('text', 'todo', 'media', 'link', 'container', 'unit_ref', 'calendar', 'database');
CREATE TYPE "unit_type" AS ENUM('assistant', 'human', 'timelix', 'system');

-- Создайте таблицу блоков
CREATE TABLE "block" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" text NOT NULL,
    "parent_id" uuid,
    "type" "block_type" NOT NULL,
    "title" text,
    "content" jsonb DEFAULT '{}'::jsonb,
    "style" jsonb DEFAULT '{}'::jsonb,
    "position" jsonb DEFAULT '{"layout":"flow","x":0,"y":0,"w":null,"h":null}'::jsonb,
    "order" integer DEFAULT 0,
    "archived" boolean DEFAULT false,
    "tags" jsonb DEFAULT '[]'::jsonb,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "deleted_at" timestamp with time zone
);

-- Создайте таблицу задач
CREATE TABLE "todos" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" text NOT NULL,
    "title" text NOT NULL,
    "completed" boolean DEFAULT false NOT NULL,
    "description" text,
    "order" integer NOT NULL,
    "priority" integer DEFAULT 0,
    "due_date" timestamp with time zone,
    "tags" jsonb DEFAULT '[]'::jsonb,
    "project_id" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "deleted_at" timestamp with time zone
);

-- Создайте таблицу агентов
CREATE TABLE "unit" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "avatar" text,
    "model" text NOT NULL,
    "system_prompt" text NOT NULL,
    "tools" jsonb DEFAULT '[]'::jsonb,
    "is_default" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "avatar_url" text,
    "unit_type" "unit_type" DEFAULT 'assistant' NOT NULL
);

-- Добавьте индексы для оптимизации
CREATE INDEX "block_user_id_idx" ON "block" ("user_id");
CREATE INDEX "block_parent_id_idx" ON "block" ("parent_id");
CREATE INDEX "todos_user_id_idx" ON "todos" ("user_id");
CREATE INDEX "unit_user_id_idx" ON "unit" ("user_id");

-- Выйдите из psql
\q
```

### 4. Настройте переменную окружения

Создайте файл `.env` и укажите строку подключения:

```env
# Database Configuration
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/timelix

# Другие переменные...
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
PORT=8080
```

## Тестирование подключения

Запустите сервер в режиме разработки:

```bash
npm run dev
```

Если подключение к базе данных успешно, вы увидите:

```
✅ Database connection successful
💾 База данных подключена и готова к работе
```

Если база данных недоступна, сервер продолжит работу, но инструменты для работы с БД будут недоступны:

```
⚠️ База данных недоступна, но сервер продолжит работу без БД инструментов
```

## Примеры использования инструментов

После успешного подключения к БД вы сможете использовать новые инструменты:

### Управление блоками

```json
{
    "tool": "manageBlocks",
    "arguments": {
        "operation": "create",
        "userId": "user123",
        "type": "text",
        "title": "Мой новый блок",
        "content": { "text": "Содержимое блока" }
    }
}
```

### Создание задачи

```json
{
    "tool": "createTodo",
    "arguments": {
        "title": "Купить молоко",
        "description": "Не забыть купить молоко в магазине",
        "priority": "medium"
    }
}
```

### Чтение задач

```json
{
    "tool": "readTodos",
    "arguments": {
        "position": 1
    }
}
```

### Обновление задачи

```json
{
    "tool": "updateTodo",
    "arguments": {
        "position": 1,
        "completed": true,
        "priority": "high"
    }
}
```

### Удаление задачи

```json
{
    "tool": "deleteTodo",
    "arguments": {
        "position": 1
    }
}
```

### Управление агентами

```json
{
    "tool": "manageUnits",
    "arguments": {
        "operation": "create",
        "userId": "user123",
        "name": "Помощник программиста",
        "model": "gpt-4",
        "systemPrompt": "Ты опытный программист, который помогает с кодом"
    }
}
```
