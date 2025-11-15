# Установка и настройка Nginx для Saleor

Эта инструкция описывает установку системного Nginx (вне Docker) для проксирования к Docker контейнерам Saleor.

## Архитектура

```
Интернет (HTTPS:443)
    ↓
Nginx (системный, с SSL сертификатами)
    ↓
    ├─→ localhost:8000 (saleor_api контейнер)
    ├─→ localhost:3000 (saleor_dashboard контейнер)
    ├─→ /var/lib/docker/volumes/.../static/
    └─→ /var/lib/docker/volumes/.../media/
```

## Шаг 1: Установка Nginx

```bash
# Обновите пакеты
sudo apt update

# Установите Nginx
sudo apt install nginx -y

# Проверьте установку
nginx -v

# Включите автозапуск
sudo systemctl enable nginx
```

## Шаг 2: Подготовка SSL сертификатов

### Вариант A: Сертификаты от reg.ru (рекомендуется)

```bash
# Создайте директорию для сертификатов
sudo mkdir -p /etc/nginx/ssl/dashboard.miraflores-shop.com

# Скопируйте ваши сертификаты от reg.ru на сервер
# На локальной машине:
scp certificate.crt root@91.229.8.83:/tmp/cert.pem
scp ca_bundle.crt root@91.229.8.83:/tmp/chain.pem
scp private.key root@91.229.8.83:/tmp/privkey.pem

# На сервере:
sudo mv /tmp/cert.pem /etc/nginx/ssl/dashboard.miraflores-shop.com/
sudo mv /tmp/chain.pem /etc/nginx/ssl/dashboard.miraflores-shop.com/
sudo mv /tmp/privkey.pem /etc/nginx/ssl/dashboard.miraflores-shop.com/

# Создайте fullchain.pem (cert + chain)
sudo cat /etc/nginx/ssl/dashboard.miraflores-shop.com/cert.pem \
         /etc/nginx/ssl/dashboard.miraflores-shop.com/chain.pem \
         > /etc/nginx/ssl/dashboard.miraflores-shop.com/fullchain.pem

# Установите права доступа
sudo chmod 644 /etc/nginx/ssl/dashboard.miraflores-shop.com/*.pem
sudo chmod 600 /etc/nginx/ssl/dashboard.miraflores-shop.com/privkey.pem
```

### Вариант B: Let's Encrypt (если хотите попробовать снова)

```bash
# Установите certbot
sudo apt install certbot python3-certbot-nginx -y

# Получите сертификат (ПОСЛЕ настройки nginx HTTP)
sudo certbot --nginx -d dashboard.miraflores-shop.com --email fsdamp@gmail.com
```

## Шаг 3: Настройка конфигурации Nginx

```bash
# Скопируйте конфигурацию из репозитория
cd ~/Saleor-miraflores
sudo cp nginx-system.conf /etc/nginx/sites-available/saleor

# Найдите пути к docker volumes
docker volume inspect saleor-miraflores_static_files | grep Mountpoint
docker volume inspect saleor-miraflores_media_files | grep Mountpoint

# Отредактируйте конфигурацию и укажите ПРАВИЛЬНЫЕ пути к volumes
sudo nano /etc/nginx/sites-available/saleor

# Найдите строки:
#   alias /var/lib/docker/volumes/saleor-miraflores_static_files/_data/;
#   alias /var/lib/docker/volumes/saleor-miraflores_media_files/_data/;
# И замените на реальные пути из предыдущей команды

# Отключите дефолтный сайт nginx
sudo rm /etc/nginx/sites-enabled/default

# Включите конфигурацию Saleor
sudo ln -s /etc/nginx/sites-available/saleor /etc/nginx/sites-enabled/

# Проверьте конфигурацию на ошибки
sudo nginx -t

# Если всё ОК - перезапустите nginx
sudo systemctl restart nginx
```

## Шаг 4: Запуск Docker контейнеров

```bash
cd ~/Saleor-miraflores

# Остановите старые контейнеры (если были nginx в docker)
docker-compose down

# Запустите контейнеры с новой конфигурацией
docker-compose up -d

# Проверьте что контейнеры запущены
docker-compose ps

# Проверьте что API доступен на localhost:8000
curl http://localhost:8000/health/

# Проверьте что Dashboard доступен на localhost:3000
curl http://localhost:3000/dashboard/
```

## Шаг 5: Проверка работы

```bash
# Проверьте HTTP редирект
curl -I http://dashboard.miraflores-shop.com/
# Должен быть: 301 Moved Permanently

# Проверьте HTTPS
curl -I https://dashboard.miraflores-shop.com/dashboard/
# Должен быть: 200 OK или 301

# Откройте в браузере
# https://dashboard.miraflores-shop.com/dashboard/
```

## Шаг 6: Настройка файрволла

```bash
# Проверьте статус
sudo ufw status

# Разрешите HTTP и HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Запретите прямой доступ к портам контейнеров извне (только localhost)
# Это уже настроено в docker-compose.yml через 127.0.0.1:8000:8000
```

## Полезные команды

```bash
# Проверка конфигурации nginx
sudo nginx -t

# Перезагрузка nginx (без остановки)
sudo nginx -s reload

# Перезапуск nginx
sudo systemctl restart nginx

# Статус nginx
sudo systemctl status nginx

# Логи nginx
sudo tail -f /var/log/nginx/saleor_access.log
sudo tail -f /var/log/nginx/saleor_error.log

# Логи Docker контейнеров
docker-compose logs -f api
docker-compose logs -f dashboard

# Проверка портов
sudo netstat -tlnp | grep -E '80|443|3000|8000'
```

## Обновление SSL сертификатов

Когда сертификаты от reg.ru истекут (обычно через год):

```bash
# Скачайте новые сертификаты от reg.ru
# Скопируйте их на сервер в /etc/nginx/ssl/dashboard.miraflores-shop.com/

# Пересоздайте fullchain.pem
sudo cat /etc/nginx/ssl/dashboard.miraflores-shop.com/cert.pem \
         /etc/nginx/ssl/dashboard.miraflores-shop.com/chain.pem \
         > /etc/nginx/ssl/dashboard.miraflores-shop.com/fullchain.pem

# Перезагрузите nginx
sudo nginx -s reload
```

## Решение проблем

### Nginx не запускается

```bash
# Проверьте конфигурацию
sudo nginx -t

# Посмотрите логи ошибок
sudo tail -50 /var/log/nginx/error.log

# Проверьте что порты 80 и 443 свободны
sudo netstat -tlnp | grep -E ':80|:443'
```

### 502 Bad Gateway

```bash
# Проверьте что Docker контейнеры запущены
docker-compose ps

# Проверьте что API отвечает
curl http://localhost:8000/health/

# Проверьте что Dashboard отвечает
curl http://localhost:3000/dashboard/

# Проверьте логи
docker-compose logs api
docker-compose logs dashboard
```

### Static/Media файлы не загружаются (404)

```bash
# Проверьте пути к docker volumes
docker volume inspect saleor-miraflores_static_files
docker volume inspect saleor-miraflores_media_files

# Обновите пути в /etc/nginx/sites-available/saleor
sudo nano /etc/nginx/sites-available/saleor

# Перезагрузите nginx
sudo nginx -s reload
```

## Мониторинг

Рекомендуем настроить:

1. **Логротация nginx**
```bash
# Уже настроена автоматически в /etc/logrotate.d/nginx
```

2. **Мониторинг SSL сертификатов**
```bash
# Проверка срока действия
sudo openssl x509 -in /etc/nginx/ssl/dashboard.miraflores-shop.com/fullchain.pem -noout -dates
```

3. **Автоматический перезапуск nginx при сбое**
```bash
# Уже настроено через systemd
sudo systemctl status nginx
```

## Безопасность

✅ Порты Docker контейнеров доступны только на localhost
✅ HTTPS с современными TLS 1.2/1.3
✅ Security headers настроены
✅ HSTS включен
✅ Rate limiting для API
✅ Запрет доступа к скрытым файлам

## Что дальше?

1. Настройте регулярные бэкапы базы данных
2. Настройте мониторинг (Prometheus, Grafana)
3. Настройте алерты при падении сервисов
4. Обновите сертификаты перед истечением срока
