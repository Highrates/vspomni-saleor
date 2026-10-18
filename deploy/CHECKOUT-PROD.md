# Checkout / оплата — checklist перед продом

Без этих env деньги ЮKassa могут списаться, а заказ останется не `PAID` (webhook отклонён). OTP / password-reset / claim ETL-buyer без SMTP не работают.

## Обязательный чеклист

- [ ] `TRUST_PROXY=1` в Nest (за nginx) — иначе `req.ip` = IP прокси, IP-check webhook → 403
- [ ] `YOOKASSA_WEBHOOK_SECRET` задан; URL в ЛК ЮKassa указывает **на Nest**, не на Front BFF
- [ ] SMTP (`SMTP_*` / `MAIL_*`) настроен — письма сброса пароля и OTP уходят
- [ ] `YOOKASSA_WEBHOOK_CHECK_IP=true` (+ `TRUST_PROXY=1`)
- [ ] Webhook URL в ЛК (без секрета в query предпочтительно; nginx map переносит `?secret=` → header):

```text
https://vspomni.store/api/v1/orders/yookassa/webhook
```

Legacy: `?secret=…` допустим — nginx кладёт в `X-Yookassa-Webhook-Secret`, access_log пишет только `$uri` (без query). На Nest в production принимается **только header**.

## Nest `api/.env` (обязательно)

| Переменная | Значение | Зачем |
|---|---|---|
| `YOOKASSA_SHOP_ID` | shopId из ЛК | Создание платежа |
| `YOOKASSA_SECRET_KEY` | secret key | API ЮKassa |
| `YOOKASSA_WEBHOOK_SECRET` | длинная случайная строка | Auth webhook (предпочтительно) |
| `TRUST_PROXY` | **`1`** за nginx | `req.ip` / throttler видят клиента из `X-Forwarded-For` |
| `ORDER_PAY_SECRET` | секрет HMAC quote | Подпись shipping-quote |
| `FRONTEND_PUBLIC_URL` | `https://vspomni.store` | Ссылки в письмах / reset |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | см. `api/.env.example` | Исходящая почта |
| `SMTP_USER` / `SMTP_PASSWORD` | ящик + пароль приложения | Auth SMTP |
| `MAIL_FROM` / `MAIL_REPLY_TO` | From / Reply-To | Письма покупателю |

Опционально:

| Переменная | Заметка |
|---|---|
| `YOOKASSA_WEBHOOK_CHECK_IP` | `true` — только IP ЮKassa; в prod без secret IP-check включается сам |
| `SHIPPING_REQUIRE_SERVER_REPRICE` | default on; `false` ослабляет CDEK |
| `YANDEX_DELIVERY_ENABLED` | `true` только если Nest знает `YANDEX_DELIVERY_TOKEN` (server reprice) |
| `YANDEX_DELIVERY_TOKEN` | тот же токен, что на Front BFF |
| `YANDEX_PLATFORM_SOURCE_STATION_ID` | склад Platform API |
| `CDEK_ACCOUNT` / `CDEK_SECURE` | server reprice СДЭК |

## Nginx

В `deploy/nginx-vspomni-https.conf` уже пробрасываются `X-Real-IP` / `X-Forwarded-For` на Nest.  
**Обязательно** `TRUST_PROXY=1` в Nest — иначе при IP-check webhook видит IP nginx/локальный → 403 → заказ не PAID.

Webhook **не** должен идти на Next (`:3001`) — только на Nest (`/api/v1/orders/yookassa/webhook`).

## Smoke (только :80/:443, не :3011)

Клиентский путь через nginx:

```bash
./deploy/scripts/smoke-client.sh --ip 194.67.113.17
# webhook auth:
SMOKE_IP=194.67.113.17 YOOKASSA_WEBHOOK_SECRET=… ./scripts/smoke-yookassa-webhook.sh
```

Webhook вручную (header, не `?secret=` в логах):

```bash
# 1) без secret → 401
curl -sk -o /dev/null -w "%{http_code}\n" -X POST \
  --resolve vspomni.store:443:194.67.113.17 \
  "https://vspomni.store/api/v1/orders/yookassa/webhook" \
  -H 'content-type: application/json' \
  -d '{"event":"payment.waiting_for_capture","object":{"id":"x","status":"waiting_for_capture"}}'

# 2) с header secret + YooKassa IP
curl -sk -X POST \
  --resolve vspomni.store:443:194.67.113.17 \
  "https://vspomni.store/api/v1/orders/yookassa/webhook" \
  -H "X-Yookassa-Webhook-Secret: $YOOKASSA_WEBHOOK_SECRET" \
  -H 'content-type: application/json' \
  -H 'X-Forwarded-For: 185.71.76.1' \
  -d '{"event":"payment.waiting_for_capture","object":{"id":"smoke-nonexistent","status":"waiting_for_capture","paid":true,"amount":{"value":"1.00","currency":"RUB"}}}'
```

Юнит-тесты IP/secret: `api/src/orders/yookassa-webhook-auth.spec.ts`.

## Доставка

- Nest подписывает quote только после server reprice для **Ozon**, **Яндекс** и (при включённом reprice) **СДЭК**.
- Front после BFF-тарифа вызывает `shipping-quote` и показывает **Nest cost** до «Оплатить».
- Если Nest-reconcile падает — **fail-hard** для CDEK/Yandex/Ozon (BFF-цену не оставляем; иначе повторный `SHIPPING_CHANGED` на Pay).
