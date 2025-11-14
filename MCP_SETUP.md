# 🔌 Настройка Model Context Protocol (MCP) для Saleor

## Что такое MCP?

**Model Context Protocol (MCP)** - это протокол от Anthropic для подключения дополнительных источников контекста к AI-ассистентам (Claude, Cursor и др.). MCP позволяет:

- 📊 Подключать базы данных (PostgreSQL, MySQL, SQLite)
- 🌐 Интегрировать API и веб-сервисы
- 📁 Предоставлять доступ к файловым системам
- 🔧 Использовать специализированные инструменты

## Для чего это нужно в Saleor?

1. **Доступ к базе данных** - AI сможет читать схему БД, анализировать данные
2. **GraphQL Schema** - автоматический доступ к типам и схеме API
3. **Метрики и логи** - анализ производительности
4. **Интеграции** - подключение к внешним сервисам (Stripe, payment gateways)

## 🚀 Быстрая настройка MCP для Cursor

### 1. Установка MCP сервера

Для PostgreSQL базы данных Saleor:

```bash
# Установить MCP сервер для PostgreSQL
npm install -g @modelcontextprotocol/server-postgres
```

### 2. Конфигурация Cursor

#### macOS / Linux
Путь к конфигу: `~/.cursor/mcp.json`

```json
{
  "mcpServers": {
    "saleor-db": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://saleor:saleor@localhost:5432/saleor"
      ]
    }
  }
}
```

#### Windows
Путь к конфигу: `%APPDATA%\\Cursor\\mcp.json`

```json
{
  "mcpServers": {
    "saleor-db": {
      "command": "npx.cmd",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://saleor:saleor@localhost:5432/saleor"
      ]
    }
  }
}
```

### 3. Перезапуск Cursor

После создания конфига перезапустите Cursor, чтобы изменения вступили в силу.

### 4. Проверка подключения

В Cursor AI chat спросите:
```
Покажи схему таблицы product_product из базы данных
```

Если MCP настроен правильно, AI сможет прочитать схему напрямую из PostgreSQL.

## 📚 Доступные MCP серверы для Saleor

### 1. PostgreSQL (База данных)
```json
{
  "saleor-db": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-postgres", 
             "postgresql://saleor:saleor@localhost:5432/saleor"]
  }
}
```

### 2. Filesystem (Файлы проекта)
```json
{
  "saleor-files": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem",
             "/Users/ap/Projects/Miraflores 2.0"]
  }
}
```

### 3. Redis (Кэш и очередь)
```bash
# Установить
npm install -g @modelcontextprotocol/server-redis

# Конфиг
{
  "saleor-redis": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-redis",
             "redis://localhost:6379"]
  }
}
```

### 4. Custom GraphQL Schema
Для доступа к GraphQL схеме Saleor можно создать кастомный MCP сервер или использовать файловый сервер с указанием на `schema.graphql`:

```json
{
  "saleor-schema": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem",
             "/Users/ap/Projects/Miraflores 2.0/saleor/graphql"]
  }
}
```

## 🔧 Полная конфигурация для Saleor

Объединенный конфиг `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "saleor-db": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://saleor:saleor@localhost:5432/saleor"
      ]
    },
    "saleor-project": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/ap/Projects/Miraflores 2.0"
      ]
    },
    "saleor-redis": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-redis",
        "redis://localhost:6379"
      ]
    }
  }
}
```

## 💡 Примеры использования

После настройки MCP вы сможете задавать вопросы:

### База данных
```
1. Покажи все таблицы в базе данных Saleor
2. Какие поля есть у таблицы order_order?
3. Сколько активных заказов в базе?
4. Найди пользователей, зарегистрированных за последний месяц
```

### Файловая система
```
1. Покажи все модели в saleor/product/models.py
2. Найди все GraphQL мутации для работы с заказами
3. Какие тесты есть для checkout модуля?
```

### Redis (если настроен)
```
1. Какие ключи хранятся в Redis?
2. Покажи статистику использования кэша
```

## 🛡️ Безопасность

⚠️ **Важно:**
- MCP конфиг содержит credentials к БД
- Не коммитьте `mcp.json` в Git
- Используйте read-only доступ для production БД
- Для прода создайте отдельного пользователя БД с ограниченными правами

### Создание read-only пользователя для production:

```sql
-- Подключиться к PostgreSQL
psql -U saleor -d saleor

-- Создать read-only пользователя
CREATE USER mcp_readonly WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE saleor TO mcp_readonly;
GRANT USAGE ON SCHEMA public TO mcp_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO mcp_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO mcp_readonly;
```

Затем в MCP конфиге используйте:
```
postgresql://mcp_readonly:secure_password@localhost:5432/saleor
```

## 🔍 Отладка MCP

Если MCP не работает:

1. **Проверьте логи Cursor:**
   - macOS: `~/Library/Application Support/Cursor/logs/`
   - Windows: `%APPDATA%\\Cursor\\logs\\`

2. **Проверьте доступность сервисов:**
```bash
# PostgreSQL
psql -U saleor -d saleor -c "SELECT 1"

# Redis
redis-cli ping
```

3. **Тестируйте MCP сервер напрямую:**
```bash
# PostgreSQL MCP
npx -y @modelcontextprotocol/server-postgres \
  "postgresql://saleor:saleor@localhost:5432/saleor"
```

## 📖 Дополнительные ресурсы

- **MCP Официальная документация:** https://modelcontextprotocol.io
- **Cursor MCP Guide:** https://cursor.com/docs/context/mcp
- **Доступные MCP серверы:** https://github.com/modelcontextprotocol/servers
- **Создание кастомного MCP сервера:** https://modelcontextprotocol.io/docs/creating-a-server

## 🎯 Альтернативы MCP

Если MCP кажется сложным, используйте:

1. **`.cursorrules` файл** (уже настроен) - правила и контекст для AI
2. **Composer в Cursor** - добавляйте файлы вручную в контекст
3. **@-mentions** - упоминайте файлы/папки в чате: `@saleor/product/models.py`

---

*MCP значительно улучшает понимание проекта AI-ассистентом, но не является обязательным для работы с Saleor*

