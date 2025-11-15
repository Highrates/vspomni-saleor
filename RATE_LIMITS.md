# Let's Encrypt Rate Limits и как их обойти

## Основные лимиты

| Тип лимита | Production | Staging | Период |
|------------|-----------|---------|--------|
| Сертификатов на домен | 50 | 30,000 | 7 дней |
| Дубликатов сертификата | 5 | 30,000 | 7 дней |
| Неудачных валидаций | 5 | н/д | 1 час |
| Новых заказов | 300 | 1,500 | 3 часа |

## Использование Staging сервера

### Вариант 1: Через init-скрипт (рекомендуется)

```bash
# Откройте скрипт
nano init-letsencrypt-simple.sh

# Найдите строку:
STAGING=0

# Измените на:
STAGING=1

# Сохраните и запустите
./init-letsencrypt-simple.sh
```

### Вариант 2: Напрямую через certbot

```bash
# Staging сертификат
docker-compose run --rm certbot certonly --webroot \
    -w /var/www/certbot \
    --staging \
    --email admin@miraflores-shop.com \
    -d dashboard.miraflores-shop.com \
    --rsa-key-size 4096 \
    --agree-tos \
    --force-renewal \
    --non-interactive
```

### Вариант 3: Для уже работающего certbot

```bash
# Продление с staging
docker-compose run --rm certbot renew --staging --dry-run

# Принудительное получение staging сертификата
docker-compose run --rm certbot renew --staging --force-renewal
```

## Проверка текущего статуса лимитов

### Официальный инструмент

К сожалению, Let's Encrypt не предоставляет официальный API для проверки текущих лимитов.

### Косвенная проверка

```bash
# Проверить количество сертификатов для вашего домена
# Используйте crt.sh - база данных Certificate Transparency
curl "https://crt.sh/?q=%.miraflores-shop.com&output=json" | jq

# Или через браузер:
# https://crt.sh/?q=%.miraflores-shop.com
```

## Что делать если превысили лимит

### Симптомы

Ошибка от certbot:
```
Error: urn:ietf:params:acme:error:rateLimited
Detail: Error creating new order :: too many certificates already issued for exact set of domains
```

### Решения

#### 1. Использовать staging для тестирования (100% работает)

```bash
# Всегда тестируйте сначала на staging
STAGING=1 ./init-letsencrypt-simple.sh

# Когда все работает - переключайтесь на production
STAGING=0 ./init-letsencrypt-simple.sh
```

#### 2. Подождать (если уже заблокированы)

- **Failed Validations**: 1 час
- **Duplicate Certificate**: 7 дней
- **Certificates per Domain**: 7 дней

#### 3. Добавить/убрать субдомен (обход Duplicate limit)

Если превысили лимит дубликатов (5 в неделю), можно:

```bash
# Вместо:
-d dashboard.miraflores-shop.com

# Используйте:
-d dashboard.miraflores-shop.com -d www.dashboard.miraflores-shop.com

# Это будет считаться другим сертификатом!
```

#### 4. Использовать другой ACME клиент (не поможет)

⚠️ Лимиты привязаны к домену, а не к клиенту!

## Рекомендованный workflow

### Первоначальная настройка

```bash
# 1. Тестирование на staging
cd ~/Saleor-miraflores
nano init-letsencrypt-simple.sh
# Установите STAGING=1

./init-letsencrypt-simple.sh

# 2. Проверьте что всё работает
# Откройте https://dashboard.miraflores-shop.com/
# Браузер покажет предупреждение - это нормально для staging

# 3. Активируйте SSL конфигурацию
docker-compose stop nginx
cp nginx/nginx.conf nginx/nginx-http.conf.backup
cp nginx/nginx-ssl.conf nginx/nginx.conf
docker-compose build --no-cache dashboard
docker-compose down && docker-compose up -d

# 4. Если всё работает - получите production сертификат
docker-compose down
rm -rf certbot/
nano init-letsencrypt-simple.sh
# Установите STAGING=0

./init-letsencrypt-simple.sh

# 5. Перезапустите
docker-compose down && docker-compose up -d
```

### Обновление конфигурации

```bash
# Всегда используйте --dry-run для тестирования
docker-compose run --rm certbot renew --dry-run

# Принудительное обновление (осторожно!)
docker-compose run --rm certbot renew --force-renewal
```

## Как избежать проблем с лимитами

### ✅ Делайте

1. **Всегда тестируйте на staging первым**
2. Используйте `--dry-run` для проверки обновления
3. Проверьте DNS перед запросом сертификата
4. Проверьте что порт 80 доступен
5. Проверьте логи nginx перед запросом

### ❌ Не делайте

1. Не используйте `--force-renewal` без необходимости
2. Не запускайте скрипт много раз подряд при ошибках
3. Не меняйте конфигурацию без тестирования на staging
4. Не пытайтесь "обмануть" систему множественными запросами

## Проверка staging vs production сертификата

### Через OpenSSL

```bash
# Проверить издателя сертификата
echo | openssl s_client -servername dashboard.miraflores-shop.com \
  -connect dashboard.miraflores-shop.com:443 2>/dev/null | \
  openssl x509 -noout -issuer

# Production покажет:
# issuer=C = US, O = Let's Encrypt, CN = R3

# Staging покажет:
# issuer=C = US, O = (STAGING) Let's Encrypt, CN = (STAGING) Artificial Apricot R3
```

### Через браузер

**Staging:**
- ⚠️ Предупреждение о безопасности
- Издатель: "(STAGING) Artificial Apricot R3"

**Production:**
- ✅ Зеленый замок
- Издатель: "Let's Encrypt R3" или "Let's Encrypt E1"

## Удаление staging сертификата перед получением production

```bash
# 1. Остановите сервисы
docker-compose down

# 2. Полностью удалите certbot данные
rm -rf certbot/

# 3. Измените скрипт на production
nano init-letsencrypt-simple.sh
# STAGING=0

# 4. Запустите заново
./init-letsencrypt-simple.sh
```

## Детали лимитов

### Certificates per Registered Domain

Считает **все** сертификаты для домена и его поддоменов:

```
miraflores-shop.com                     ← 1 сертификат
dashboard.miraflores-shop.com           ← 2 сертификата
api.miraflores-shop.com                 ← 3 сертификата
www.miraflores-shop.com                 ← 4 сертификата
...
```

Лимит: **50 в неделю** для домена `miraflores-shop.com`

### Duplicate Certificate

Идентичный набор доменов:

```bash
# Запрос 1:
-d dashboard.miraflores-shop.com

# Запрос 2 (дубликат):
-d dashboard.miraflores-shop.com

# Запрос 3 (дубликат):
-d dashboard.miraflores-shop.com

# ... до 5 раз в неделю
```

**Обход:** Добавьте/уберите домен:
```bash
# Не дубликат:
-d dashboard.miraflores-shop.com -d www.dashboard.miraflores-shop.com
```

### Failed Validations

**5 неудач в час** на:
- IP адрес
- Аккаунт
- Hostname

Самая частая проблема при отладке!

**Решение:** Используйте staging!

## Полезные команды

```bash
# Информация о сертификате
docker-compose exec certbot certbot certificates

# Список всех сертификатов
docker-compose exec nginx ls -la /etc/letsencrypt/live/

# Срок действия
docker-compose exec nginx openssl x509 \
  -in /etc/letsencrypt/live/dashboard.miraflores-shop.com/fullchain.pem \
  -noout -dates

# Dry-run продления
docker-compose run --rm certbot renew --dry-run

# История запросов (через crt.sh)
curl "https://crt.sh/?q=dashboard.miraflores-shop.com&output=json" | jq -r '.[].not_before' | sort
```

## FAQ

### Сколько раз можно безопасно пробовать?

**Staging:** Практически неограниченно
**Production:**
- Первая попытка: свободно
- При ошибке: максимум 4 попытки в час
- После 5 ошибок: ждать 1 час

### Что считается "неделей"?

Rolling window - скользящее окно 7 дней, а не календарная неделя.

Если получили сертификат в понедельник, лимит сбросится в следующий понедельник.

### Можно ли получить больше сертификатов?

Для больших организаций можно запросить увеличение лимита:
https://letsencrypt.org/docs/rate-limits/#requesting-a-rate-limit-override

Но для обычного использования 50 сертификатов в неделю более чем достаточно.

### Staging и production - разные лимиты?

Да! Staging не влияет на production лимиты и наоборот.

## Ссылки

- [Official Rate Limits Documentation](https://letsencrypt.org/docs/rate-limits/)
- [Certificate Transparency Search](https://crt.sh/)
- [Staging Environment](https://letsencrypt.org/docs/staging-environment/)
- [Integration Guide](https://letsencrypt.org/docs/integration-guide/)
