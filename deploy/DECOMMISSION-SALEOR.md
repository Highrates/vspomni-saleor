# Фаза 4 — декомиссия Saleor на старом проде

Цель: после cutover DNS на **новый VPS** (`/opt/vspomni`, см. [`NEW-VPS.md`](NEW-VPS.md)) остановить Saleor на старом сервере.

Старый прод (исторически): `91.229.9.11`, compose `/opt/saleor/vspomni-saleor`.  
Новый runtime Nest: отдельный VPS, **`/opt/vspomni`** — не `~/Saleor-miraflores`, не Mira.

## 0. Перед выключением

1. Front уже на Nest (`NEXT_PUBLIC_API_URL` → Nest `/api/v1`).
2. Nest API + Postgres (`vspomni`) + Admin подняты и отвечают.
3. Свежий dump Saleor + media уже в `dumps/` (фаза 0) — не удалять volumes, пока не уверены.
4. YooKassa webhook URL переключён на Nest: `https://vspomni.store/api/v1/orders/yookassa/webhook` (или Front proxy → Nest).

## 1. Nginx → Nest-стек

```bash
# с локальной машины / на сервере
sudo cp /path/to/Vspomni/deploy/nginx-vspomni-https.conf /etc/nginx/sites-available/vspomni
sudo ln -sf /etc/nginx/sites-available/vspomni /etc/nginx/sites-enabled/vspomni
sudo nginx -t && sudo systemctl reload nginx
```

Проверка: `/graphql/` и `/dashboard/` → **410** (остальные Saleor-заглушки не нужны); `/api/v1/health` → 200; витрина `/`, `/checkout`, `/checkout/success` → Front.

Перед cutover оплаты: [`CHECKOUT-PROD.md`](CHECKOUT-PROD.md) — `TRUST_PROXY=1`, `YOOKASSA_*`, webhook URL.

## 2. Остановить Saleor compose

```bash
cd /opt/saleor/vspomni-saleor   # или фактический путь проекта
docker compose ps
docker compose stop api celery-worker celery-beat dashboard 2>/dev/null || true
# Redis + Postgres Saleor — только если больше ничем не используются:
docker compose stop redis 2>/dev/null || true
# db оставляем до финального бэкапа / решения об удалении volumes
```

Убедиться, что порты 8000 / 3030 больше не слушают.

## 3. Убрать Saleor-only сервисы (после smoke)

```bash
docker compose rm -f api celery-worker celery-beat dashboard redis 2>/dev/null || true
# Опционально позже:
# docker compose down   # НЕ трогать volumes без бэкапа
# docker volume rm vspomni-saleor_media_files vspomni-saleor_static_files … 
```

## 4. DNS / секреты

- Удалить Saleor env (SECRET_KEY, plugins) с сервера, когда не нужны.
- SMTP / YooKassa / CDEK / Ozon — только в Nest `api/.env` и Front server env.
- Закрыть firewall на 8000/3030 снаружи (если были открыты).

## 5. Локальный репозиторий

Уже сделано в фазе 4:

- удалена папка `Back/` (Saleor + dashboard)
- удалены `Front/saleor-yandex-plugin/`, `Front/scripts/audit-stock.mjs`, `diagnose-stock-saleor.py`
- новый nginx: `deploy/nginx-vspomni-https.conf`

ETL (`scripts/etl/`, `dumps/`) можно оставить для повторного импорта — это не runtime Saleor.

## Rollback

1. Вернуть старый nginx из бэкапа `/etc/nginx/sites-available/`.
2. `docker compose start api redis celery-worker dashboard` в `/opt/saleor/vspomni-saleor`.
3. Front временно на Saleor GraphQL — только если ещё есть старый билд (не рекомендуется).
