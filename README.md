# GitHub MCP Server

Этот MCP сервер предоставляет инструменты для работы с GitHub API через Claude Desktop.

## Установка и настройка

### 1. Установка зависимостей

```bash
npm install
```

### 2. Настройка GitHub токена

Создайте файл `.env` в корне проекта:

```
GITHUB_TOKEN=your_github_token_here
```

Получить токен можно в GitHub Settings > Developer settings > Personal access tokens.
Необходимые права: `repo`, `issues`, `pull_requests`.

### 3. Сборка проекта

```bash
npm run build
```

### 4. Запуск сервера

Запустите MCP сервер:

```bash
pnpm run dev
```

Сервер запустится на `http://localhost:8080` с SSE endpoint на `/sse`.

### 5. Настройка Claude Desktop

Отредактируйте файл конфигурации Claude Desktop:

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`  
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

Добавьте следующую конфигурацию:

```json
{
    "mcpServers": {
        "GitHub": {
            "url": "http://localhost:8080/sse"
        }
    }
}
```

**Важно**: Убедитесь что ваш MCP клиент поддерживает полный SSE протокол с POST сообщениями. Если клиент ожидает только SSE, возможно потребуется использовать прокси, например:

```json
{
    "mcpServers": {
        "GitHub": {
            "command": "npx",
            "args": [
                "mcp-proxy",
                "--port",
                "8081",
                "--shell",
                "node",
                "D:\\push-f\\_Ai\\MCP Server\\dist\\main.js"
            ]
        }
    }
}
```

### 6. Перезапуск Claude Desktop

После изменения конфигурации перезапустите Claude Desktop.

## Доступные инструменты

Сервер предоставляет следующие инструменты для работы с GitHub:

### Issues

-   `getIssue` - получить информацию об issue
-   `updateIssue` - обновить issue
-   `listIssues` - список issues репозитория

### Pull Requests

-   `getPullRequest` - получить информацию о PR
-   `updatePullRequest` - обновить PR
-   `listPullRequests` - список PR репозитория

### Comments

-   `addComment` - добавить комментарий к issue/PR
-   `listComments` - список комментариев

### GitHub Actions

-   `listWorkflowRuns` - список запусков workflow
-   `getWorkflowRun` - информация о конкретном запуске
-   `getWorkflowRunDetails` - детальная информация о запуске
-   `cancelWorkflowRun` - отменить запуск
-   `rerunWorkflowRun` - перезапустить workflow
-   `rerunFailedJobs` - перезапустить только неудачные jobs

## Разработка

Для разработки используйте:

```bash
npm run dev
```

Это запустит сервер с автоматической перезагрузкой при изменении файлов.
