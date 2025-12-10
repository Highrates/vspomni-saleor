#!/bin/bash
set -e

echo "🚀 Starting Saleor initialization..."

# Wait for PostgreSQL
echo "⏳ Waiting for PostgreSQL..."
while ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" > /dev/null 2>&1; do
  sleep 1
done
echo "✅ PostgreSQL is ready"

# Wait for Redis
echo "⏳ Waiting for Redis..."
while ! redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping > /dev/null 2>&1; do
  sleep 1
done
echo "✅ Redis is ready"

# Migrations
echo "📦 Running migrations..."
python manage.py migrate --noinput

# Static
echo "🎨 Collecting static..."
python manage.py collectstatic --noinput --clear

# ❗ УБИРАЕМ create_channel — он ломает запуск
# python manage.py create_channel || true

echo "✅ Initialization complete"
echo "🚀 Starting Saleor API..."

# ❗ ПРАВИЛЬНЫЙ exec
exec "$@"
