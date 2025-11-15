# Установка и настройка Nginx для Saleor

Эта инструкция описывает установку системного Nginx (вне Docker) для проксирования к Docker контейнерам Saleor.

## Архитектура

```
Интернет (HTTPS:443)
    ↓
Nginx (системный, с SSL сертификатами от reg.ru)
    ↓
    ├─→ localhost:8000 (saleor_api контейнер)
    ├─→ localhost:3000 (saleor_dashboard контейнер)
    ├─→ /var/lib/docker/volumes/.../static/
    └─→ /var/lib/docker/volumes/.../media/
```

## Файлы конфигурации

В проекте есть 2 конфигурации nginx:

- **`nginx-system-http.conf`** - HTTP конфигурация БЕЗ SSL (для первоначального запуска)
- **`nginx-system-https.conf`** - HTTPS конфигурация С SSL (для production после установки сертификатов)

---

## Шаг 1: Подготовка на локальной машине

```bash
cd /Users/aliman/PycharmProjects/Saleor-miraflores

# Убедитесь что изменения отправлены
git status
git push
```

## Шаг 2: Обновление кода на сервере

```bash
# Подключитесь к серверу
ssh root@91.229.8.83
cd ~/Saleor-miraflores

# Остановите старые контейнеры (если запущены)
docker-compose down

# Получите обновления
git pull

# Проверьте что nginx убран из docker-compose.yml
grep -c nginx docker-compose.yml
# Должен вернуть: 0
```

## Шаг 3: Установка Nginx

```bash
# Обновите пакеты
sudo apt update

# Установите Nginx
sudo apt install nginx -y

# Проверьте установку
nginx -v

# Включите автозапуск
sudo systemctl enable nginx

# Проверьте статус
sudo systemctl status nginx
```

## Шаг 4: Настройка HTTP конфигурации (БЕЗ SSL)

```bash
# Скопируйте HTTP конфигурацию
sudo cp ~/Saleor-miraflores/nginx-system-http.conf /etc/nginx/sites-available/saleor

# Отключите дефолтный сайт
sudo rm -f /etc/nginx/sites-enabled/default

# Включите конфигурацию Saleor
sudo ln -s /etc/nginx/sites-available/saleor /etc/nginx/sites-enabled/

# Проверьте конфигурацию
sudo nginx -t

# Если ошибка про пути к static/media - НЕ страшно, исправим после запуска Docker

# Перезапустите nginx
sudo systemctl restart nginx
```

## Шаг 5: Запуск Docker контейнеров

```bash
cd ~/Saleor-miraflores

# Запустите контейнеры
docker-compose up -d

# Подождите 30-60 секунд для запуска

# Проверьте статус
docker-compose ps

# Проверьте что API отвечает
curl http://localhost:8000/health/
# Должен вернуть: {"status":"ok"} или подобное

# Проверьте что Dashboard отвечает
curl http://localhost:3000/dashboard/
# Должен вернуть HTML
```

## Шаг 6: Настройка путей к static и media

```bash
# Найдите пути к docker volumes
docker volume inspect saleor-miraflores_static_files | grep Mountpoint
docker volume inspect saleor-miraflores_media_files | grep Mountpoint

# Скопируйте выведенные пути (например: /var/lib/docker/volumes/saleor-miraflores_static_files/_data)

# Отредактируйте конфигурацию nginx
sudo nano /etc/nginx/sites-available/saleor

# Найдите строки:
#   location /static/ {
#       alias /var/lib/docker/volumes/saleor-miraflores_static_files/_data/;
#
#   location /media/ {
#       alias /var/lib/docker/volumes/saleor-miraflores_media_files/_data/;

# Замените пути на реальные из команды выше (если отличаются)

# Сохраните (Ctrl+O, Enter, Ctrl+X)

# Проверьте конфигурацию
sudo nginx -t

# Перезапустите nginx
sudo nginx -s reload
```

## Шаг 7: Проверка работы по HTTP

```bash
# Проверьте главную страницу
curl -I http://miraflores-shop.com/

# Проверьте dashboard
curl -I http://miraflores-shop.com/dashboard/

# Проверьте API
curl -I http://miraflores-shop.com/graphql/

# Откройте в браузере
# http://miraflores-shop.com/dashboard/
```

Если всё работает - переходите к установке SSL!

---

## Шаг 8: Установка SSL сертификатов от reg.ru

### На локальной машине - скопируйте сертификаты

```bash
# Скачайте с reg.ru 3 файла:
# - certificate.crt (Сертификат)
# - ca_bundle.crt (Корневой сертификат)
# - private.key (Private Key)

# Скопируйте на сервер
scp certificate.crt root@91.229.8.83:/tmp/cert.pem
scp ca_bundle.crt root@91.229.8.83:/tmp/chain.pem
scp private.key root@91.229.8.83:/tmp/privkey.pem
```

### На сервере - установите сертификаты

```bash
# Создайте директорию
sudo mkdir -p /etc/nginx/ssl/miraflores-shop.com

# Переместите файлы
sudo mv /tmp/cert.pem /etc/nginx/ssl/miraflores-shop.com/
sudo mv /tmp/chain.pem /etc/nginx/ssl/miraflores-shop.com/
sudo mv /tmp/privkey.pem /etc/nginx/ssl/miraflores-shop.com/

# Создайте fullchain.pem (сертификат + цепочка)
sudo cat /etc/nginx/ssl/miraflores-shop.com/cert.pem \
         /etc/nginx/ssl/miraflores-shop.com/chain.pem \
         > /etc/nginx/ssl/miraflores-shop.com/fullchain.pem

# Установите права доступа
sudo chmod 644 /etc/nginx/ssl/miraflores-shop.com/*.pem
sudo chmod 600 /etc/nginx/ssl/miraflores-shop.com/privkey.pem

# Проверьте сертификат
sudo openssl x509 -in /etc/nginx/ssl/miraflores-shop.com/fullchain.pem -noout -subject -dates
```

## Шаг 9: Переключение на HTTPS конфигурацию

```bash
cd ~/Saleor-miraflores

# Сделайте бэкап текущей HTTP конфигурации
sudo cp /etc/nginx/sites-available/saleor /etc/nginx/sites-available/saleor-http-backup

# Замените на HTTPS конфигурацию
sudo cp nginx-system-https.conf /etc/nginx/sites-available/saleor

# Обновите пути к static/media (если нужно)
sudo nano /etc/nginx/sites-available/saleor

# Проверьте конфигурацию
sudo nginx -t

# Если всё ОК - перезапустите nginx
sudo systemctl restart nginx
```

## Шаг 10: Проверка HTTPS

```bash
# Проверьте HTTP редирект
curl -I http://miraflores-shop.com/
# Должен быть: 301 Moved Permanently → https://

# Проверьте HTTPS
curl -I https://miraflores-shop.com/dashboard/
# Должен быть: 200 OK

# Проверьте SSL сертификат
openssl s_client -connect miraflores-shop.com:443 -servername miraflores-shop.com < /dev/null 2>/dev/null | openssl x509 -noout -dates

# Откройте в браузере
# https://miraflores-shop.com/dashboard/
```

## Шаг 11: Настройка файрволла

```bash
# Проверьте статус
sudo ufw status

# Разрешите HTTP и HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Проверьте что применилось
sudo ufw status
```

---

## Полезные команды

### Управление Nginx

```bash
# Проверка конфигурации
sudo nginx -t

# Перезагрузка (без остановки)
sudo nginx -s reload

# Перезапуск
sudo systemctl restart nginx

# Статус
sudo systemctl status nginx

# Остановка
sudo systemctl stop nginx

# Запуск
sudo systemctl start nginx
```

### Логи

```bash
# Access логи (запросы)
sudo tail -f /var/log/nginx/saleor_access.log

# Error логи (ошибки)
sudo tail -f /var/log/nginx/saleor_error.log

# Логи Docker контейнеров
docker-compose logs -f api
docker-compose logs -f dashboard
```

### Проверка портов

```bash
# Проверить какие порты слушаются
sudo netstat -tlnp | grep -E ':80|:443|:3000|:8000'

# Или через ss
sudo ss -tlnp | grep -E ':80|:443|:3000|:8000'
```

### Docker

```bash
# Статус контейнеров
docker-compose ps

# Перезапуск контейнера
docker-compose restart api

# Логи
docker-compose logs --tail=100 api

# Остановка всех
docker-compose down

# Запуск всех
docker-compose up -d
```

---

## Обновление SSL сертификатов

Сертификаты от reg.ru действуют обычно 1 год. Когда они истекут:

```bash
# 1. Скачайте новые сертификаты с reg.ru

# 2. Скопируйте на сервер (с локальной машины)
scp certificate.crt root@91.229.8.83:/tmp/cert.pem
scp ca_bundle.crt root@91.229.8.83:/tmp/chain.pem
scp private.key root@91.229.8.83:/tmp/privkey.pem

# 3. На сервере замените файлы
sudo mv /tmp/cert.pem /etc/nginx/ssl/miraflores-shop.com/
sudo mv /tmp/chain.pem /etc/nginx/ssl/miraflores-shop.com/
sudo mv /tmp/privkey.pem /etc/nginx/ssl/miraflores-shop.com/

# 4. Пересоздайте fullchain.pem
sudo cat /etc/nginx/ssl/miraflores-shop.com/cert.pem \
         /etc/nginx/ssl/miraflores-shop.com/chain.pem \
         > /etc/nginx/ssl/miraflores-shop.com/fullchain.pem

# 5. Установите права
sudo chmod 644 /etc/nginx/ssl/miraflores-shop.com/*.pem
sudo chmod 600 /etc/nginx/ssl/miraflores-shop.com/privkey.pem

# 6. Перезагрузите nginx
sudo nginx -s reload

# 7. Проверьте новый сертификат
openssl s_client -connect miraflores-shop.com:443 -servername miraflores-shop.com < /dev/null 2>/dev/null | openssl x509 -noout -dates
```

---

## Решение проблем

### Nginx не запускается

```bash
# Проверьте конфигурацию
sudo nginx -t

# Посмотрите подробные ошибки
sudo journalctl -u nginx -n 50

# Посмотрите error лог
sudo tail -50 /var/log/nginx/error.log

# Проверьте что порты свободны
sudo netstat -tlnp | grep -E ':80|:443'
```

### 502 Bad Gateway

Означает что nginx не может подключиться к backend (Docker контейнерам).

```bash
# Проверьте что контейнеры запущены
docker-compose ps

# Проверьте что API отвечает на localhost:8000
curl http://localhost:8000/health/

# Проверьте что Dashboard отвечает на localhost:3000
curl http://localhost:3000/dashboard/

# Посмотрите логи контейнеров
docker-compose logs api
docker-compose logs dashboard

# Проверьте nginx error лог
sudo tail -50 /var/log/nginx/error.log
```

### 404 Not Found для static/media файлов

```bash
# Проверьте пути к volumes
docker volume inspect saleor-miraflores_static_files
docker volume inspect saleor-miraflores_media_files

# Обновите пути в конфигурации nginx
sudo nano /etc/nginx/sites-available/saleor

# Проверьте права доступа
sudo ls -la /var/lib/docker/volumes/saleor-miraflores_static_files/_data/

# Перезагрузите nginx
sudo nginx -s reload
```

### SSL сертификат не работает

```bash
# Проверьте что файлы существуют
sudo ls -la /etc/nginx/ssl/miraflores-shop.com/

# Проверьте сертификат
sudo openssl x509 -in /etc/nginx/ssl/miraflores-shop.com/fullchain.pem -noout -text

# Проверьте приватный ключ
sudo openssl rsa -in /etc/nginx/ssl/miraflores-shop.com/privkey.pem -check

# Проверьте совпадение сертификата и ключа
sudo openssl x509 -noout -modulus -in /etc/nginx/ssl/miraflores-shop.com/fullchain.pem | openssl md5
sudo openssl rsa -noout -modulus -in /etc/nginx/ssl/miraflores-shop.com/privkey.pem | openssl md5
# MD5 суммы должны совпадать
```

---

## Мониторинг

### Проверка срока действия сертификата

```bash
# Просмотр даты истечения
sudo openssl x509 -in /etc/nginx/ssl/miraflores-shop.com/fullchain.pem -noout -enddate

# Проверка через интернет
openssl s_client -connect miraflores-shop.com:443 -servername miraflores-shop.com < /dev/null 2>/dev/null | openssl x509 -noout -dates
```

### Ротация логов

Nginx автоматически ротирует логи через logrotate:

```bash
# Конфигурация ротации (уже настроено)
cat /etc/logrotate.d/nginx

# Принудительная ротация (если нужно)
sudo logrotate -f /etc/logrotate.d/nginx
```

---

## Безопасность

✅ Порты Docker контейнеров (8000, 3000) доступны **только на localhost**
✅ HTTPS с TLS 1.2 и TLS 1.3
✅ Современные шифры
✅ Security headers (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection)
✅ HSTS включен (принудительный HTTPS)
✅ HTTP → HTTPS редирект
✅ Rate limiting для GraphQL API
✅ Запрет доступа к скрытым файлам (.git, .env, .htaccess)

---

## Структура файлов

```
/etc/nginx/
├── sites-available/
│   ├── saleor                  # Активная конфигурация (HTTP или HTTPS)
│   └── saleor-http-backup      # Бэкап HTTP конфигурации
├── sites-enabled/
│   └── saleor -> ../sites-available/saleor
└── ssl/
    └── miraflores-shop.com/
        ├── cert.pem            # Сертификат домена
        ├── chain.pem           # Корневой сертификат
        ├── fullchain.pem       # cert + chain
        └── privkey.pem         # Приватный ключ

/var/log/nginx/
├── saleor_access.log           # Логи запросов
└── saleor_error.log            # Логи ошибок
```

---

## Поддержка

Если возникли проблемы, соберите информацию:

```bash
echo "=== Nginx Status ==="
sudo systemctl status nginx

echo "=== Nginx Config Test ==="
sudo nginx -t

echo "=== Docker Status ==="
docker-compose ps

echo "=== API Health ==="
curl http://localhost:8000/health/

echo "=== Dashboard Health ==="
curl -I http://localhost:3000/dashboard/

echo "=== Nginx Error Logs ==="
sudo tail -50 /var/log/nginx/saleor_error.log

echo "=== Docker Logs ==="
docker-compose logs --tail=50 api
docker-compose logs --tail=50 dashboard
```
