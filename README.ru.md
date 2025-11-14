# 🛍️ Saleor E-Commerce Platform

> Headless, GraphQL-first платформа для электронной коммерции

[![Python](https://img.shields.io/badge/Python-3.12-blue.svg)](https://www.python.org/)
[![Django](https://img.shields.io/badge/Django-5.2-green.svg)](https://www.djangoproject.com/)
[![GraphQL](https://img.shields.io/badge/GraphQL-API-E10098.svg)](https://graphql.org/)

## 📋 Содержание

- [Быстрый старт](#-быстрый-старт)
- [Возможности](#-возможности)
- [Технологии](#-технологии)
- [Установка](#-установка)
- [Использование](#-использование)
- [Документация](#-документация)
- [Разработка](#-разработка)

## 🚀 Быстрый старт

```bash
# 1. Установить зависимости (уже установлены)
brew install uv libmagic

# 2. Запустить сервисы
docker-compose up -d

# 3. Применить миграции
uv run poe migrate

# 4. Загрузить тестовые данные
uv run poe populatedb

# 5. Запустить сервер
uv run poe start
```

**Готово!** Откройте http://localhost:8000/graphql/

### Учетные данные
- **Email:** `admin@example.com`
- **Пароль:** `admin`

## ✨ Возможности

### Основные функции
- ✅ **GraphQL API** - современный API для любых фронтендов
- ✅ **Headless архитектура** - полная свобода в выборе технологий
- ✅ **Мультиканальность** - управление несколькими магазинами
- ✅ **Интернационализация** - поддержка множества языков и валют
- ✅ **Система промоакций** - скидки, ваучеры, подарочные карты
- ✅ **Управление заказами** - полный цикл обработки заказов
- ✅ **Inventory management** - склады и управление запасами
- ✅ **Платежные системы** - интеграция с популярными шлюзами
- ✅ **Webhook система** - события и интеграции
- ✅ **Plugin система** - расширяемая архитектура

### Бизнес-возможности
- 🏪 Multi-warehouse поддержка
- 💰 Гибкое ценообразование по каналам
- 🎁 Подарочные карты
- 📦 Настройка доставки
- 🌍 Мультивалютность
- 🔐 Управление правами доступа
- 📊 Расширенная аналитика через GraphQL
- 🔌 Интеграции через Apps и Webhooks

## 🛠 Технологии

### Backend
- **Python 3.12** - основной язык
- **Django 5.2** - веб-фреймворк
- **GraphQL (Graphene)** - API слой
- **PostgreSQL 16** - база данных
- **Redis 7** - кэш и очереди
- **Celery** - фоновые задачи

### DevOps
- **Docker & Docker Compose** - контейнеризация
- **uv** - менеджер пакетов Python
- **Poe the Poet** - task runner
- **Ruff** - линтер и форматтер

### Дополнительно
- **Mailpit** - SMTP сервер для разработки
- **pytest** - тестирование
- **mypy** - статическая типизация

## 📦 Установка

### Системные требования
- macOS 12+ / Linux / Windows (WSL2)
- Docker Desktop или Colima
- 4GB RAM минимум (8GB рекомендуется)
- 5GB свободного места на диске

### Полная установка

#### 1. Клонирование (если еще не клонировали)
```bash
git clone https://github.com/saleor/saleor.git
cd saleor
```

#### 2. Установка зависимостей
```bash
# macOS
brew install uv libmagic

# Linux (Ubuntu/Debian)
curl -LsSf https://astral.sh/uv/install.sh | sh
apt-get install libmagic1

# Windows (WSL2)
curl -LsSf https://astral.sh/uv/install.sh | sh
apt-get install libmagic1
```

#### 3. Настройка окружения
```bash
# Установить Python 3.12
uv python install 3.12

# Установить зависимости проекта
uv sync

# Создать .env файл
cp .env.example .env
```

#### 4. Запуск сервисов
```bash
# Docker
docker-compose up -d

# Применить миграции
uv run poe migrate

# Загрузить тестовые данные
uv run poe populatedb
```

#### 5. Запуск Saleor
```bash
uv run poe start
```

## 🎯 Использование

### URL сервисов

| Сервис | URL | Описание |
|--------|-----|----------|
| GraphQL API | http://localhost:8000/graphql/ | API и Playground |
| Mailpit | http://localhost:8025/ | Email testing |
| PostgreSQL | localhost:5432 | База данных |
| Redis | localhost:6379 | Кэш и очереди |

### Основные команды

```bash
# Сервер
uv run poe start           # Запустить сервер
uv run poe worker          # Запустить Celery worker
uv run poe scheduler       # Запустить Celery beat

# База данных
uv run poe migrate         # Применить миграции
uv run poe make-migrations # Создать миграции
uv run poe shell          # Django shell
uv run poe populatedb      # Загрузить тестовые данные

# GraphQL
uv run poe build-schema    # Сгенерировать schema.graphql

# Тестирование
uv run poe test                    # Все тесты
uv run poe test path/to/test.py    # Конкретный тест
```

### Примеры GraphQL запросов

#### Получить список продуктов
```graphql
{
  products(first: 10, channel: "default-channel") {
    edges {
      node {
        id
        name
        description
        pricing {
          priceRange {
            start {
              gross {
                amount
                currency
              }
            }
          }
        }
      }
    }
  }
}
```

#### Создать заказ
```graphql
mutation {
  checkoutCreate(input: {
    channel: "default-channel"
    email: "customer@example.com"
    lines: [
      {
        quantity: 1
        variantId: "UHJvZHVjdFZhcmlhbnQ6MQ=="
      }
    ]
  }) {
    checkout {
      id
      token
    }
    errors {
      field
      message
    }
  }
}
```

## 📚 Документация

### Официальная документация
- **Saleor Docs:** https://docs.saleor.io
- **GraphQL API:** https://docs.saleor.io/api-reference
- **Developer Guide:** https://docs.saleor.io/developer

### Локальная документация
- [`QUICKSTART.md`](QUICKSTART.md) - Быстрый старт
- [`SERVICES.md`](SERVICES.md) - Управление сервисами
- [`MCP_SETUP.md`](MCP_SETUP.md) - Настройка MCP для AI
- [`CONTRIBUTING.md`](CONTRIBUTING.md) - Руководство по разработке
- [`.cursorrules`](.cursorrules) - Правила для AI в Cursor

### Полезные ссылки
- [Discord сообщество](https://saleor.io/discord)
- [Roadmap](https://saleor.io/roadmap)
- [Blog](https://saleor.io/blog)

## 👨‍💻 Разработка

### Структура проекта

```
saleor/
├── account/          # Пользователи и аутентификация
├── app/              # App marketplace
├── attribute/        # Атрибуты продуктов
├── channel/          # Мультиканальность
├── checkout/         # Корзина и оформление
├── core/             # Общие утилиты
├── discount/         # Промоакции и скидки
├── giftcard/         # Подарочные карты
├── graphql/          # GraphQL API
│   ├── account/
│   ├── product/
│   ├── order/
│   └── ...
├── invoice/          # Инвойсы
├── menu/             # Навигационные меню
├── order/            # Заказы
├── payment/          # Платежи
├── plugins/          # Система расширений
├── product/          # Каталог продуктов
├── shipping/         # Доставка
├── warehouse/        # Склады
└── webhook/          # Webhook система
```

### Тестирование

```bash
# Запустить все тесты
uv run poe test

# Тесты конкретного модуля
uv run poe test saleor/product/tests/

# Один тест с отладкой
uv run poe test path/to/test.py::test_name -n0 -s

# С покрытием
uv run pytest --cov=saleor --cov-report=html
```

### Линтинг и форматирование

```bash
# Ruff (линтер + форматтер)
uv run ruff check .
uv run ruff format .

# Type checking
uv run mypy saleor

# Pre-commit hooks (если Git репозиторий)
uv run pre-commit install
uv run pre-commit run --all-files
```

### Создание новой фичи

1. **Создать ветку**
```bash
git checkout -b feature/my-feature
```

2. **Внести изменения**
- Добавить модели в `models.py`
- Создать миграции: `uv run poe make-migrations`
- Добавить GraphQL типы и мутации
- Написать тесты

3. **Тестирование**
```bash
uv run poe test
uv run ruff check .
```

4. **Коммит**
```bash
git add .
git commit -m "Add: my feature description"
```

### Debug режим

```bash
# Установить ipdb
uv add ipdb --dev

# В коде добавить
breakpoint()  # Python встроенный debugger

# Или использовать Django Debug Toolbar
# (требует установки и настройки)
```

## 🔌 Расширения и интеграции

### Apps (приложения)
Saleor поддерживает экосистему приложений:
- **Stripe Payment** - прием платежей
- **Adyen** - платежный шлюз
- **Slack** - уведомления
- **Segment** - аналитика
- [И многие другие](https://saleor.io/marketplace)

### Webhooks
События для интеграций:
- `ORDER_CREATED` - новый заказ
- `PRODUCT_UPDATED` - обновление продукта
- `CUSTOMER_CREATED` - новый клиент
- [Полный список](https://docs.saleor.io/developer/extending/webhooks/overview)

### Plugins
Система плагинов для кастомизации:
```python
from saleor.plugins.base_plugin import BasePlugin

class MyPlugin(BasePlugin):
    PLUGIN_NAME = "My Custom Plugin"
    
    def order_created(self, order, previous_value):
        # Ваша логика
        pass
```

## 🐛 Решение проблем

### Частые проблемы

#### Сервер не запускается
```bash
# Проверить логи
docker-compose logs -f

# Перезапустить сервисы
docker-compose restart
```

#### База данных недоступна
```bash
# Проверить статус
docker-compose ps db

# Пересоздать
docker-compose up -d --force-recreate db
```

#### Ошибки миграций
```bash
# Откатить миграцию
uv run python manage.py migrate app_name migration_name

# Полный сброс (удалит данные!)
docker-compose down -v
docker-compose up -d
uv run poe migrate
uv run poe populatedb
```

### Логи и отладка
```bash
# Логи Saleor
tail -f saleor.log

# Логи Docker
docker-compose logs -f

# PostgreSQL логи
docker-compose logs -f db

# Redis логи
docker-compose logs -f redis
```

## 🤝 Вклад в проект

Мы приветствуем вклад в развитие Saleor! См. [`CONTRIBUTING.md`](CONTRIBUTING.md) для деталей.

### Процесс
1. Fork репозитория
2. Создайте feature branch
3. Внесите изменения
4. Напишите тесты
5. Создайте Pull Request

## 📄 Лицензия

BSD 3-Clause License. См. [LICENSE](LICENSE) для подробностей.

---

## 🌟 Полезные ресурсы

### Frontend
- [React Storefront](https://github.com/saleor/storefront) - готовый фронтенд на Next.js
- [Dashboard](https://github.com/saleor/saleor-dashboard) - админ панель
- [SDK](https://github.com/saleor/saleor-sdk) - JavaScript SDK

### Инструменты
- [Saleor CLI](https://github.com/saleor/saleor-cli) - CLI инструмент
- [GraphQL Codegen](https://www.graphql-code-generator.com/) - генерация типов

### Сообщество
- [Discord](https://saleor.io/discord) - чат сообщества
- [Twitter](https://twitter.com/getsaleor) - новости
- [YouTube](https://www.youtube.com/c/SaleorCommerce) - видео туториалы

---

<div align="center">
  <strong>Создано с ❤️ командой Saleor Commerce</strong>
  <br>
  <a href="https://saleor.io">saleor.io</a> • 
  <a href="mailto:hello@saleor.io">hello@saleor.io</a>
</div>

