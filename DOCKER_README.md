# Saleor Docker Deployment

Этот документ описывает, как запустить Saleor и Dashboard используя Docker Compose.

## Архитектура

Docker Compose настроен для запуска следующих сервисов:

- **nginx** (порт 80) - Reverse proxy для всех сервисов
- **api** - Django/Saleor бэкенд с GraphQL API
- **dashboard** - React фронтенд админ-панели
- **celery-worker** - Обработка фоновых задач
- **db** - PostgreSQL 16
- **redis** - Redis для кеширования и Celery
- **mailpit** (порт 8025) - SMTP сервер для тестирования email

## Быстрый старт

### 1. Предварительные требования

Убедитесь, что у вас установлены:
- Docker (версия 20.10 или выше)
- Docker Compose (версия 2.0 или выше)

### 2. Настройка переменных окружения

Файл `.env` уже создан с настройками для Docker окружения. При необходимости отредактируйте его:

```bash
nano .env
```

Важные переменные:
- `SECRET_KEY` - измените для production
- `DB_NAME`, `DB_USER`, `DB_PASSWORD` - настройки базы данных
- `DEBUG` - установите `False` для production

### 3. Сборка Dashboard (локально)

Dashboard собирается локально для избежания проблем с памятью во время Docker build.

```bash
# Перейти в директорию dashboard
cd saleor-dashboard

# Запустить скрипт сборки
./build.sh

# Вернуться в корень проекта
cd ..
```

Это создаст готовую сборку в `saleor-dashboard/build/`.

### 4. Запуск проекта

```bash
# Сборка и запуск всех сервисов
docker-compose up --build

# Или в фоновом режиме
docker-compose up -d --build
```

Первый запуск может занять 10-15 минут (загрузка образов, сборка, миграции, создание данных).

### 5. Доступ к сервисам

После успешного запуска сервисы доступны по следующим адресам:

- **Dashboard**: http://localhost/dashboard/
- **GraphQL API**: http://localhost/graphql/
- **GraphQL Playground**: http://localhost/graphql/ (откройте в браузере)
- **Mailpit UI**: http://localhost:8025

### 6. Вход в админ-панель

Если `DEBUG=True`, при первом запуске автоматически создается суперпользователь:

- **Email**: `admin@example.com`
- **Password**: `admin`

## Управление проектом

### Просмотр логов

```bash
# Все сервисы
docker-compose logs -f

# Конкретный сервис
docker-compose logs -f api
docker-compose logs -f dashboard
docker-compose logs -f celery-worker
```

### Остановка сервисов

```bash
# Остановить все сервисы
docker-compose down

# Остановить и удалить volumes (БД будет очищена!)
docker-compose down -v
```

### Перезапуск сервиса

```bash
# Перезапустить конкретный сервис
docker-compose restart api
docker-compose restart dashboard
```

### Выполнение команд в контейнерах

```bash
# Django management команды
docker-compose exec api python manage.py createsuperuser
docker-compose exec api python manage.py migrate
docker-compose exec api python manage.py shell

# Доступ к shell контейнера
docker-compose exec api bash
docker-compose exec db psql -U saleor -d saleor
```

## Разработка

### Горячая перезагрузка (Hot Reload)

Проект смонтирован как volume в контейнерах `api` и `celery-worker`:
- Изменения в Python коде автоматически подхватываются
- Dashboard нужно пересобрать после изменений (см. ниже)

### Пересборка Dashboard

Dashboard собирается локально для избежания проблем с памятью на сервере.

**Шаги для пересборки:**

```bash
# 1. Перейти в директорию dashboard
cd saleor-dashboard

# 2. Запустить локальную сборку
./build.sh

# 3. Собрать Docker образ с готовой сборкой
cd ..
docker-compose build dashboard

# 4. Запустить обновленный контейнер
docker-compose up -d dashboard
```

**Альтернативно (если нужна сборка внутри Docker):**
```bash
# Используйте Dockerfile.build для сборки внутри контейнера
cd saleor-dashboard
docker build -f Dockerfile.build -t dashboard-builder .
```

### Пересборка API

После изменений в зависимостях (pyproject.toml, uv.lock):

```bash
docker-compose up -d --build api celery-worker
```

## Миграции базы данных

Миграции выполняются автоматически при запуске контейнера `api`. Для ручного запуска:

```bash
# Создать миграции
docker-compose exec api python manage.py makemigrations

# Применить миграции
docker-compose exec api python manage.py migrate

# Откатить последнюю миграцию
docker-compose exec api python manage.py migrate app_name previous_migration
```

## Популяция тестовыми данными

При `DEBUG=True` база данных автоматически заполняется тестовыми данными при первом запуске.

Для ручной популяции:

```bash
docker-compose exec api python manage.py populatedb --createsuperuser
```

## Очистка и сброс

### Очистка Docker ресурсов

```bash
# Остановить и удалить контейнеры, сети
docker-compose down

# Также удалить volumes (БД будет очищена!)
docker-compose down -v

# Удалить образы
docker-compose down --rmi all

# Полная очистка (включая неиспользуемые образы)
docker system prune -a
```

### Сброс базы данных

```bash
# Остановить сервисы и удалить volume с БД
docker-compose down
docker volume rm saleor-miraflores_postgres_data

# Запустить снова - БД будет создана заново
docker-compose up -d
```

## Устранение проблем

### API не стартует

Проверьте логи:
```bash
docker-compose logs api
```

Частые проблемы:
- База данных не готова - подождите 30 секунд и перезапустите
- Ошибки миграций - проверьте `docker-compose logs api`

### Dashboard не открывается

```bash
# Проверьте статус контейнера
docker-compose ps dashboard

# Проверьте логи
docker-compose logs dashboard

# Пересоберите dashboard
docker-compose up -d --build dashboard
```

### Celery worker не работает

```bash
# Проверьте логи
docker-compose logs celery-worker

# Перезапустите worker
docker-compose restart celery-worker
```

### Проблемы с подключением к БД

```bash
# Проверьте здоровье БД
docker-compose exec db pg_isready -U saleor

# Подключитесь к БД напрямую
docker-compose exec db psql -U saleor -d saleor
```

### Порт 80 занят

Если порт 80 уже используется, измените в `docker-compose.yml`:

```yaml
nginx:
  ports:
    - "8080:80"  # Изменить на другой порт
```

Затем доступ по http://localhost:8080

## Production Deployment

Для production окружения:

1. **Измените `.env`**:
   ```bash
   DEBUG=False
   SECRET_KEY=your-secure-random-key
   ALLOWED_HOSTS=yourdomain.com
   ```

2. **Настройте SSL** в nginx конфигурации

3. **Используйте managed БД** (RDS, Cloud SQL) вместо Docker PostgreSQL

4. **Настройте backup** для volumes

5. **Используйте Docker secrets** для паролей

6. **Настройте мониторинг** (Sentry, Prometheus)

7. **Отключите expose портов** для внутренних сервисов (кроме nginx)

## Полезные команды

```bash
# Проверить статус всех сервисов
docker-compose ps

# Использование ресурсов
docker stats

# Проверить логи конкретного сервиса за последние 100 строк
docker-compose logs --tail=100 api

# Подключиться к Redis
docker-compose exec redis redis-cli

# Бэкап базы данных
docker-compose exec db pg_dump -U saleor saleor > backup.sql

# Восстановление базы данных
docker-compose exec -T db psql -U saleor saleor < backup.sql

# Очистка кеша Redis
docker-compose exec redis redis-cli FLUSHALL
```

## Структура файлов

```
.
├── docker-compose.yml       # Основная конфигурация Docker Compose
├── docker-entrypoint.sh     # Скрипт инициализации Django
├── Dockerfile               # Dockerfile для API
├── .env                     # Переменные окружения
├── nginx/
│   └── nginx.conf          # Конфигурация Nginx reverse proxy
└── saleor-dashboard/
    └── Dockerfile          # Dockerfile для Dashboard
```

## Дополнительная информация

- [Saleor Documentation](https://docs.saleor.io/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Nginx Documentation](https://nginx.org/en/docs/)

## Поддержка

Если возникли проблемы:
1. Проверьте логи: `docker-compose logs -f`
2. Убедитесь, что все контейнеры запущены: `docker-compose ps`
3. Проверьте переменные окружения в `.env`
4. Попробуйте полную пересборку: `docker-compose down && docker-compose up --build`
