#!/bin/bash

# Простой и надежный скрипт установки SSL сертификата для Saleor
# Домен: dashboard.miraflores-shop.com
# Email: fsdamp@gmail.com

set -e  # Остановка при ошибке

DOMAIN="dashboard.miraflores-shop.com"
EMAIL="fsdamp@gmail.com"
STAGING=0  # Установите 1 для тестирования (staging сертификат)

echo "============================================"
echo "Установка SSL сертификата для $DOMAIN"
echo "============================================"
echo ""

# Шаг 1: Проверка что все сервисы запущены
echo "[1/5] Проверка статуса Docker контейнеров..."
if ! docker-compose ps | grep -q "saleor_api.*Up"; then
    echo "⚠️  Контейнер saleor_api не запущен. Запускаю все сервисы..."
    docker-compose up -d
    echo "Ожидание запуска сервисов (30 секунд)..."
    sleep 30
else
    echo "✓ Все сервисы запущены"
fi
echo ""

# Шаг 2: Создание директорий для certbot
echo "[2/5] Создание директорий для certbot..."
mkdir -p certbot/conf
mkdir -p certbot/www
echo "✓ Директории созданы"
echo ""

# Шаг 3: Активация HTTP конфигурации с поддержкой ACME challenge
echo "[3/5] Активация HTTP конфигурации с поддержкой ACME challenge..."

# Создаем бэкап текущей конфигурации
if [ -f "nginx/nginx.conf" ]; then
    cp nginx/nginx.conf nginx/nginx.conf.backup-$(date +%Y%m%d-%H%M%S)
    echo "✓ Создан бэкап текущей конфигурации"
fi

# Активируем HTTP конфигурацию с ACME challenge
cp nginx/nginx-http.conf nginx/nginx.conf
echo "✓ Активирована HTTP конфигурация с ACME challenge"

# Перезапускаем nginx с новой конфигурацией
echo "Перезапуск nginx..."
docker-compose restart nginx
sleep 5
echo "✓ Nginx перезапущен"
echo ""

# Шаг 4: Проверка доступности домена
echo "[4/5] Проверка доступности домена..."
if curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN/.well-known/acme-challenge/test | grep -q "404"; then
    echo "✓ Домен доступен, ACME challenge работает"
elif curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN/ | grep -q "200\|301\|302"; then
    echo "✓ Домен доступен"
else
    echo "⚠️  ВНИМАНИЕ: Домен может быть недоступен"
    echo "Проверьте DNS: nslookup $DOMAIN"
    echo "Проверьте файрволл: порты 80 и 443 должны быть открыты"
    echo ""
    read -p "Продолжить? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Установка прервана"
        exit 1
    fi
fi
echo ""

# Шаг 5: Получение SSL сертификата от Let's Encrypt
echo "[5/5] Получение SSL сертификата от Let's Encrypt..."

STAGING_ARG=""
if [ $STAGING = 1 ]; then
    STAGING_ARG="--staging"
    echo "⚠️  ВНИМАНИЕ: Используется staging режим (тестовый сертификат)"
    echo ""
fi

# Удаляем старые сертификаты если они есть (для чистой установки)
if [ -d "certbot/conf/live/$DOMAIN" ]; then
    echo "Найден существующий сертификат. Удаляю..."
    rm -rf certbot/conf/live/$DOMAIN
    rm -rf certbot/conf/archive/$DOMAIN
    rm -rf certbot/conf/renewal/$DOMAIN.conf
    echo "✓ Старые сертификаты удалены"
fi

# Получаем сертификат (переопределяем entrypoint чтобы использовать certbot напрямую)
docker-compose run --rm --entrypoint certbot certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    $STAGING_ARG \
    -d $DOMAIN

if [ $? -eq 0 ]; then
    echo ""
    echo "✅✅✅ SSL сертификат успешно получен! ✅✅✅"
    echo ""
    echo "============================================"
    echo "СЛЕДУЮЩИЕ ШАГИ - АКТИВАЦИЯ HTTPS:"
    echo "============================================"
    echo ""
    echo "Выполните следующие команды:"
    echo ""
    echo "1. Остановите все контейнеры:"
    echo "   docker-compose down"
    echo ""
    echo "2. Активируйте HTTPS конфигурацию:"
    echo "   cp nginx/nginx-https.conf nginx/nginx.conf"
    echo ""
    echo "3. Запустите все сервисы:"
    echo "   docker-compose up -d"
    echo ""
    echo "4. Проверьте работу HTTPS:"
    echo "   curl -I https://$DOMAIN/dashboard/"
    echo "   # Или откройте в браузере: https://$DOMAIN/dashboard/"
    echo ""
    echo "============================================"
    echo ""
    echo "Сертификат будет автоматически продлеваться"
    echo "каждые 12 часов через контейнер certbot."
    echo ""
else
    echo ""
    echo "❌ ОШИБКА: Не удалось получить сертификат!"
    echo ""
    echo "ДИАГНОСТИКА:"
    echo "============================================"
    echo ""
    echo "1. Проверьте DNS запись:"
    echo "   nslookup $DOMAIN"
    echo "   (должен вернуть ваш IP сервера)"
    echo ""
    echo "2. Проверьте доступность порта 80:"
    echo "   curl -I http://$DOMAIN/"
    echo ""
    echo "3. Проверьте логи nginx:"
    echo "   docker-compose logs nginx"
    echo ""
    echo "4. Проверьте логи certbot:"
    echo "   docker-compose logs certbot"
    echo ""
    echo "5. Проверьте файрволл:"
    echo "   sudo ufw status"
    echo "   sudo ufw allow 80/tcp"
    echo "   sudo ufw allow 443/tcp"
    echo ""
    echo "============================================"
    echo ""
    echo "Если проблема с лимитами Let's Encrypt:"
    echo "Откройте скрипт и измените STAGING=0 на STAGING=1"
    echo "Это позволит получить тестовый сертификат для проверки"
    echo ""

    # Восстанавливаем старую конфигурацию
    if [ -f "nginx/nginx.conf.backup-"* ]; then
        LATEST_BACKUP=$(ls -t nginx/nginx.conf.backup-* | head -1)
        cp "$LATEST_BACKUP" nginx/nginx.conf
        docker-compose restart nginx
        echo "Восстановлена предыдущая конфигурация nginx"
    fi

    exit 1
fi
