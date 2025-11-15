#!/bin/bash

# Установка собственных SSL сертификатов для Saleor
# Используется когда у вас уже есть готовые сертификаты (например, от reg.ru)

DOMAIN="dashboard.miraflores-shop.com"

echo "============================================"
echo "Установка собственных SSL сертификатов"
echo "Домен: $DOMAIN"
echo "============================================"
echo ""

# Создаем директорию для сертификатов
echo "[1/4] Создание директории для сертификатов..."
mkdir -p ssl-certs/live/$DOMAIN
echo "✓ Директория создана: ssl-certs/live/$DOMAIN"
echo ""

echo "[2/4] Инструкция по копированию файлов:"
echo "============================================"
echo ""
echo "У вас должны быть 3 файла от reg.ru:"
echo "  1. Сертификат домена (certificate.crt)"
echo "  2. Корневой сертификат (ca_bundle.crt или root.crt)"
echo "  3. Private Key (private.key)"
echo ""
echo "СКОПИРУЙТЕ их в директорию ssl-certs/live/$DOMAIN/ с такими именами:"
echo ""
echo "  ssl-certs/live/$DOMAIN/cert.pem        <- Сертификат домена"
echo "  ssl-certs/live/$DOMAIN/chain.pem       <- Корневой сертификат"
echo "  ssl-certs/live/$DOMAIN/privkey.pem     <- Private Key"
echo ""
echo "Примеры команд для копирования (выполните на ВАШЕЙ машине):"
echo ""
echo "# С локальной машины:"
echo "scp /путь/к/certificate.crt root@91.229.8.83:~/Saleor-miraflores/ssl-certs/live/$DOMAIN/cert.pem"
echo "scp /путь/к/ca_bundle.crt root@91.229.8.83:~/Saleor-miraflores/ssl-certs/live/$DOMAIN/chain.pem"
echo "scp /путь/к/private.key root@91.229.8.83:~/Saleor-miraflores/ssl-certs/live/$DOMAIN/privkey.pem"
echo ""
echo "============================================"
echo ""
read -p "Скопировали все 3 файла? Нажмите Enter для продолжения..."
echo ""

# Проверяем что файлы скопированы
echo "[3/4] Проверка наличия файлов..."
if [ ! -f "ssl-certs/live/$DOMAIN/cert.pem" ]; then
    echo "❌ ОШИБКА: Файл cert.pem не найден"
    exit 1
fi

if [ ! -f "ssl-certs/live/$DOMAIN/chain.pem" ]; then
    echo "❌ ОШИБКА: Файл chain.pem не найден"
    exit 1
fi

if [ ! -f "ssl-certs/live/$DOMAIN/privkey.pem" ]; then
    echo "❌ ОШИБКА: Файл privkey.pem не найден"
    exit 1
fi

echo "✓ Все файлы найдены"
echo ""

# Создаем fullchain.pem (cert + chain)
echo "Создание fullchain.pem..."
cat ssl-certs/live/$DOMAIN/cert.pem ssl-certs/live/$DOMAIN/chain.pem > ssl-certs/live/$DOMAIN/fullchain.pem
echo "✓ fullchain.pem создан"
echo ""

# Устанавливаем правильные права доступа
echo "Установка прав доступа..."
chmod 644 ssl-certs/live/$DOMAIN/cert.pem
chmod 644 ssl-certs/live/$DOMAIN/chain.pem
chmod 644 ssl-certs/live/$DOMAIN/fullchain.pem
chmod 600 ssl-certs/live/$DOMAIN/privkey.pem
echo "✓ Права доступа установлены"
echo ""

# Проверяем сертификат
echo "Проверка сертификата..."
openssl x509 -in ssl-certs/live/$DOMAIN/cert.pem -noout -subject -dates
echo ""

echo "[4/4] Активация HTTPS конфигурации..."
echo ""

# Делаем бэкап текущей конфигурации
if [ -f "nginx/nginx.conf" ]; then
    cp nginx/nginx.conf nginx/nginx.conf.backup-$(date +%Y%m%d-%H%M%S)
    echo "✓ Создан бэкап текущей конфигурации"
fi

# Активируем HTTPS конфигурацию
cp nginx/nginx-https-custom.conf nginx/nginx.conf
echo "✓ Активирована HTTPS конфигурация"
echo ""

echo "Перезапуск всех сервисов..."
docker-compose down
docker-compose up -d
echo ""

echo "✅✅✅ SSL сертификаты установлены! ✅✅✅"
echo ""
echo "============================================"
echo "ПРОВЕРКА HTTPS:"
echo "============================================"
echo ""
echo "1. Откройте в браузере:"
echo "   https://$DOMAIN/dashboard/"
echo ""
echo "2. Или проверьте через curl:"
echo "   curl -I https://$DOMAIN/dashboard/"
echo ""
echo "3. Проверьте сертификат:"
echo "   openssl s_client -connect $DOMAIN:443 -servername $DOMAIN < /dev/null 2>/dev/null | openssl x509 -noout -dates"
echo ""
echo "============================================"
echo ""
echo "Сертификаты находятся в: ssl-certs/live/$DOMAIN/"
echo "Когда сертификат истечет, замените файлы и перезапустите nginx:"
echo "  docker-compose restart nginx"
echo ""
