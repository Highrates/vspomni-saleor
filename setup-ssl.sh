#!/bin/bash

# Простой и надежный скрипт установки SSL сертификата для Saleor
# Домен: dashboard.miraflores-shop.com
# Email: fsdamp@gmail.com

DOMAIN="dashboard.miraflores-shop.com"
EMAIL="fsdamp@gmail.com"
STAGING=1  # 1 = staging (тестовый), 0 = production (настоящий сертификат)

echo "============================================"
echo "Установка SSL сертификата для $DOMAIN"
if [ $STAGING = 1 ]; then
    echo "РЕЖИМ: STAGING (тестовый сертификат)"
else
    echo "РЕЖИМ: PRODUCTION (настоящий сертификат)"
fi
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
mkdir -p certbot/www/.well-known/acme-challenge
chmod -R 755 certbot/www
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

# Проверяем что в конфиге нет блокирующего правила
if grep -q "location ~ /\\\\\\." nginx/nginx.conf; then
    echo "❌ ОШИБКА: В конфигурации найдено блокирующее правило 'location ~ /\.'"
    echo "Проверьте что nginx-http.conf обновлен через git pull"
    exit 1
fi

# Перезапускаем nginx с новой конфигурацией (полный перезапуск контейнера)
echo "Полный перезапуск nginx контейнера..."
docker-compose stop nginx
docker-compose up -d nginx
sleep 10
echo "✓ Nginx перезапущен"

# Проверяем что nginx видит новую конфигурацию
echo "Проверка загруженной конфигурации nginx..."
docker-compose exec nginx nginx -T 2>&1 | grep -A 5 "\.well-known" || echo "⚠️ .well-known не найден в конфиге"
echo ""

# Шаг 4: Проверка доступности домена и ACME challenge
echo "[4/5] Проверка доступности домена и ACME challenge..."

# Создаем тестовый файл для проверки ACME challenge
echo "test" > certbot/www/.well-known/acme-challenge/test-file
chmod 644 certbot/www/.well-known/acme-challenge/test-file

# Проверяем доступность тестового файла
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN/.well-known/acme-challenge/test-file)
if [ "$HTTP_CODE" = "200" ]; then
    echo "✓ Домен доступен, ACME challenge работает корректно!"
    rm certbot/www/.well-known/acme-challenge/test-file
elif [ "$HTTP_CODE" = "404" ]; then
    echo "⚠️  Тестовый файл не найден (404). Проверяю общую доступность домена..."
    if curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN/ | grep -q "200\|301\|302"; then
        echo "✓ Домен доступен, но ACME challenge может не работать"
        echo "Попробуем продолжить..."
    else
        echo "❌ Домен недоступен"
        exit 1
    fi
elif [ "$HTTP_CODE" = "403" ]; then
    echo "❌ ОШИБКА: Получен 403 Forbidden для ACME challenge"
    echo "Nginx не может прочитать файлы из /var/www/certbot"
    echo ""
    echo "Проверка логов nginx:"
    docker-compose logs --tail=20 nginx
    echo ""
    echo "Проверка прав доступа:"
    ls -la certbot/www/.well-known/acme-challenge/
    exit 1
else
    echo "⚠️  ВНИМАНИЕ: Неожиданный ответ ($HTTP_CODE)"
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
echo "Запуск certbot с подробным логированием..."
docker-compose run --rm --entrypoint certbot certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    --preferred-challenges http \
    --verbose \
    $STAGING_ARG \
    -d $DOMAIN

if [ $? -eq 0 ]; then
    echo ""
    if [ $STAGING = 1 ]; then
        echo "✅✅✅ STAGING сертификат успешно получен! ✅✅✅"
        echo ""
        echo "============================================"
        echo "ТЕСТОВЫЙ СЕРТИФИКАТ ПОЛУЧЕН!"
        echo "============================================"
        echo ""
        echo "Всё работает корректно! Теперь получите НАСТОЯЩИЙ сертификат:"
        echo ""
        echo "1. Удалите тестовый сертификат:"
        echo "   rm -rf certbot/"
        echo ""
        echo "2. Откройте скрипт и измените STAGING:"
        echo "   nano setup-ssl.sh"
        echo "   # Измените STAGING=1 на STAGING=0"
        echo ""
        echo "3. Запустите скрипт снова:"
        echo "   ./setup-ssl.sh"
        echo ""
        echo "============================================"
    else
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
    fi
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
