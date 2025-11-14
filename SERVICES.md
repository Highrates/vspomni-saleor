# 🔧 Управление сервисами Saleor

## 🚀 Быстрый запуск всего проекта

```bash
# 1. Запустить Docker сервисы (PostgreSQL, Redis, Mailpit)
docker-compose up -d

# 2. Запустить Saleor сервер
uv run poe start
```

Сервер будет доступен по адресу: **http://localhost:8000/graphql/**

---

## 🛑 Остановка сервисов

### Остановить Saleor сервер
```bash
# Ctrl + C в терминале, где запущен сервер
# или найти и остановить процесс:
ps aux | grep uvicorn
kill -9 <PID>
```

### Остановить Docker сервисы
```bash
# Остановить все сервисы
docker-compose down

# Остановить с удалением volumes (очистит БД!)
docker-compose down -v
```

---

## 🔄 Перезапуск сервисов

### Перезапуск Docker сервисов
```bash
# Перезапуск всех сервисов
docker-compose restart

# Перезапуск конкретного сервиса
docker-compose restart db
docker-compose restart redis
docker-compose restart mailpit
```

### Перезапуск Saleor
```bash
# Остановить (Ctrl + C) и снова запустить
uv run poe start
```

---

## 📊 Проверка статуса

### Docker сервисы
```bash
# Статус всех сервисов
docker-compose ps

# Логи всех сервисов
docker-compose logs -f

# Логи конкретного сервиса
docker-compose logs -f db
docker-compose logs -f redis
docker-compose logs -f mailpit
```

### Проверка доступности
```bash
# PostgreSQL
docker-compose exec db pg_isready -U saleor

# Redis
docker-compose exec redis redis-cli ping

# Saleor API
curl http://localhost:8000/graphql/

# Mailpit
curl http://localhost:8025/
```

---

## 🐳 Управление отдельными сервисами

### PostgreSQL
```bash
# Запуск
docker-compose up -d db

# Остановка
docker-compose stop db

# Подключиться к БД
docker-compose exec db psql -U saleor -d saleor

# Бэкап БД
docker-compose exec db pg_dump -U saleor saleor > backup.sql

# Восстановление БД
docker-compose exec -T db psql -U saleor -d saleor < backup.sql
```

### Redis
```bash
# Запуск
docker-compose up -d redis

# Остановка
docker-compose stop redis

# Redis CLI
docker-compose exec redis redis-cli

# Очистить Redis
docker-compose exec redis redis-cli FLUSHALL
```

### Mailpit (SMTP тестирование)
```bash
# Запуск
docker-compose up -d mailpit

# Остановка
docker-compose stop mailpit

# Веб-интерфейс
open http://localhost:8025/
```

---

## 🔄 Celery (фоновые задачи)

### Celery Worker
```bash
# Запустить worker
uv run poe worker

# В фоновом режиме (Linux/macOS)
nohup uv run poe worker > celery-worker.log 2>&1 &

# Остановить worker
pkill -f "celery.*worker"
```

### Celery Beat (планировщик)
```bash
# Запустить beat
uv run poe scheduler

# В фоновом режиме (Linux/macOS)
nohup uv run poe scheduler > celery-beat.log 2>&1 &

# Остановить beat
pkill -f "celery.*beat"
```

### Мониторинг Celery
```bash
# Flower (веб-интерфейс для Celery)
pip install flower
celery -A saleor.celeryconf flower

# Доступен на http://localhost:5555/
```

---

## 🔧 Colima (Docker runtime)

### Управление Colima
```bash
# Статус
colima status

# Запуск
colima start

# Остановка
colima stop

# Перезапуск
colima restart

# Удаление (очистит всё)
colima delete
```

### Ресурсы Colima
```bash
# Изменить CPU и память
colima stop
colima start --cpu 4 --memory 8

# Текущие настройки
colima list
```

---

## 🗑️ Полная очистка и переустановка

⚠️ **ВНИМАНИЕ: Удалит все данные!**

```bash
# 1. Остановить все
docker-compose down -v
colima stop

# 2. Удалить volumes
docker volume prune -f

# 3. Переустановить
colima start
docker-compose up -d
uv run poe migrate
uv run poe populatedb
```

---

## 📝 Скрипты для автоматизации

### Создать файл `start.sh`
```bash
#!/bin/bash
echo "🚀 Запуск Saleor..."

# Запуск Docker сервисов
docker-compose up -d

# Ожидание готовности БД
echo "⏳ Ожидание PostgreSQL..."
until docker-compose exec db pg_isready -U saleor; do
  sleep 1
done

# Запуск Saleor
echo "✅ Запуск Saleor сервера..."
uv run poe start
```

### Создать файл `stop.sh`
```bash
#!/bin/bash
echo "🛑 Остановка Saleor..."

# Остановить Saleor (если запущен)
pkill -f "uvicorn saleor"

# Остановить Celery
pkill -f "celery"

# Остановить Docker
docker-compose down

echo "✅ Все сервисы остановлены"
```

### Сделать скрипты исполняемыми
```bash
chmod +x start.sh stop.sh
```

### Использование
```bash
# Запуск
./start.sh

# Остановка
./stop.sh
```

---

## 🔍 Диагностика проблем

### Порты заняты
```bash
# Узнать, что использует порт
lsof -i :8000  # Saleor
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :8025  # Mailpit

# Убить процесс на порту
kill -9 $(lsof -t -i:8000)
```

### Docker не запускается
```bash
# Проверить Colima
colima status

# Перезапустить Colima
colima restart

# Посмотреть логи
colima logs
```

### БД недоступна
```bash
# Проверить статус
docker-compose ps db

# Посмотреть логи
docker-compose logs db

# Пересоздать контейнер
docker-compose up -d --force-recreate db
```

---

## 📊 Мониторинг ресурсов

```bash
# Docker статистика
docker stats

# Размер volumes
docker system df -v

# Очистка неиспользуемых ресурсов
docker system prune -a --volumes
```

---

## 🎯 Рекомендуемый workflow

### Начало работы
1. `docker-compose up -d` - запустить сервисы
2. `uv run poe start` - запустить Saleor
3. (опционально) `uv run poe worker` - запустить Celery

### Конец работы
1. `Ctrl + C` в терминале Saleor
2. `docker-compose down` - остановить Docker

### Для production
1. Использовать `systemd` или `supervisor` для автозапуска
2. Настроить логирование
3. Мониторинг через Prometheus/Grafana
4. Load balancer (nginx/caddy)

---

*Все сервисы настроены для локальной разработки. Для production требуется дополнительная конфигурация безопасности.*

