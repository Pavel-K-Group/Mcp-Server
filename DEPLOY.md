# Деплой Universal MCP Server

## Локальный запуск

```bash
# Через Docker Compose (локальная разработка с портами)
docker-compose -f docker-compose.local.yml up --build

# Или локально через Node.js
npm install
npm run build
npm start
```

**Файлы конфигурации:**
- `docker-compose.yml` - для Coolify деплоя (БЕЗ портов!)
- `docker-compose.local.yml` - для локальной разработки (с портом 8080)
- `docker-compose.production.yml` - для готового образа в registry

## Деплой на Coolify

⚠️ **ВАЖНО**: В Coolify НЕ НУЖНО указывать `ports` в docker-compose.yml!
Coolify сам управляет портами через reverse proxy.

### 1. Переменные окружения

Настройте следующие переменные в Coolify:

```
NODE_ENV=production
```

⚠️ **Важно**: 
- НЕ устанавливайте переменную `PORT` в Coolify
- НЕ нужно экспозить порты в docker-compose - Coolify использует reverse proxy

Если используются дополнительные сервисы, добавьте:

```
# Telegram Bot (если используется)
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# Другие API ключи (по необходимости)
# API_KEY=your_api_key_here
```

### 2. Настройка в Coolify

**Способ 1: Git Repository (Рекомендуется)**

1. Создайте новое приложение в Coolify
2. Подключите Git репозиторий
3. Выберите `Docker Compose` как метод сборки
4. Установите переменные окружения (указанные выше)
5. Coolify автоматически настроит reverse proxy и HTTPS
6. Деплойте приложение

**Способ 2: Docker Registry**

1. Соберите и запушьте образ в registry
2. Создайте Service → Docker Image
3. Укажите образ: `your-username/telegram-mcp-server:latest`
4. Порт: `8080` (Coolify сам обработает через proxy)

### 3. Решение проблем

#### Ошибка "port is already allocated"
Эта ошибка возникает если в docker-compose.yml указаны `ports`.

**Решение**: Уберите секцию `ports` из docker-compose.yml для Coolify!

```yaml
# ❌ НЕ ДЕЛАЙТЕ ТАК для Coolify:
ports:
  - '8080:8080'

# ✅ ПРАВИЛЬНО для Coolify - без портов:
services:
  universal-mcp-server:
    build: 
      context: .
    environment:
      - NODE_ENV=production
      - PORT=8080
```

Coolify использует:
- **Внутреннюю сеть** контейнеров
- **Reverse proxy** для маршрутизации
- **Автоматический SSL/TLS**

#### Проверка работы

После деплоя проверьте:
- `GET /` - информация о сервере  
- `GET /sse` - SSE endpoint для MCP клиентов
- Health check должен показывать статус "healthy"

### 4. Использование

Настройте ваш MCP клиент на:
```
https://your-domain.com/sse
```

## Структура проекта

- `src/` - исходный код TypeScript
- `dist/` - скомпилированный JavaScript (создается при сборке)
- `docker-compose.yml` - конфигурация для Coolify (БЕЗ портов)
- `docker-compose.local.yml` - для локальной разработки (С портами)
- `docker-compose.production.yml` - для готового образа из registry
- `Dockerfile` - инструкции для сборки Docker образа

## Порты и сеть

- **Внутренний порт контейнера**: `8080` (только внутри Docker сети)
- **Внешний доступ**: через reverse proxy Coolify
- **Локально**: используется порт `8080` (в docker-compose.local.yml)
- **Production/Coolify**: порты НЕ экспозятся, всё через reverse proxy

## Локальное тестирование

```bash
# Локально с портами (для тестирования)
docker-compose -f docker-compose.local.yml up --build

# Проверка
curl http://localhost:8080
```

## Логи

Для отладки проверяйте логи контейнера:
- Сообщения о загрузке инструментов
- Подключения SSE
- Обработка MCP запросов 