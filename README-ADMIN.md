# Vspomni Admin + API (фаза 1)

Стек скопирован из Miraflores 3.0 и изолирован:

| | Local |
|--|--|
| API | http://127.0.0.1:3011/api/v1 (`api/`) |
| Admin | http://127.0.0.1:3020/admin (`Admin/`) |
| Postgres | `127.0.0.1:55432` db/user/pass `vspomni` |
| Cookie | `vspomni_admin_token` |

## Запуск

```bash
docker compose up -d
cd api && npx prisma migrate deploy && npx prisma db seed
npm run build:packages
npm run dev:api    # терминал 1
npm run dev:admin  # терминал 2
```

Логин после seed: `admin@vspomni.store` / пароль из `api/.env` (`ADMIN_SEED_PASSWORD`).

## Не перенесено в Vspomni

AI-ассистент, чат, группы пользователей (UI), корзина (настройки), программа благодарности, квиз, 1С, preview-витрина `(site)`.

## Ароматы (зафиксировано)

**Ароматы = Prisma `CatalogTag`** (без rename схемы). В админ-навигации пункт «Ароматы» ведёт на `/admin/catalog/tags`. ETL будет мапить Saleor page type `vse-aromaty` + attribute `aromat` → `CatalogTag` / `ProductCatalogTag`.

## ETL source (фаза 0) — не путать с Mira

| | Vspomni | Miraflores (не трогать) |
|--|--|--|
| Dump DB | `vspomni_saleor_etl` на `localhost:5432` | `saleor_etl` на `localhost:5432` |
| Channel | `vspomni-site` | `miraflores-site` |
| Media cache | `scripts/etl/.media-cache/` | Mira свой |

```bash
./scripts/etl/restore-saleor-dump.sh dumps/vspomni_saleor_2026-10-07.sql
./scripts/etl/unpack-media.sh dumps/vspomni_media_2026-10-07.tgz
# SALEOR_DATABASE_URL=postgresql://saleor:saleor@localhost:5432/vspomni_saleor_etl
```

Nest/Prisma target остаётся `localhost:55432/vspomni` (docker `vspomni_db`).

## Front → Nest (фаза 3)

Витрина `Front/` (Next :3000) читает каталог/CMS/auth/checkout через Nest:

```bash
# api/.env — YOOKASSA_* для оплаты
cd api && npx nest start          # :3011
cd Front && npm run dev           # NEXT_PUBLIC_API_URL=http://127.0.0.1:3011/api/v1
```

- Клиент: `Front/src/api/*` (`catalogApi`, `authApi`, `ordersApi`, …).
- Корзина локальная + `POST /catalog/cart/sync`; заказ: shipping-quote → create → pay (YooKassa widget).
- Prod checkout env: [`deploy/CHECKOUT-PROD.md`](deploy/CHECKOUT-PROD.md) (`TRUST_PROXY=1`, `YOOKASSA_*`, webhook smoke).
- Saleor GraphQL **выключен** (`graphqlRequest` всегда throw). Нет `NEXT_PUBLIC_SALEOR_API_URL`.
- Сторис: Admin `/admin/stories`, публично `GET /settings/stories`, ETL `--step=stories` (Saleor page type `news`).
- Soft-долг: Yandex ID скрыт. Coming Soon — slug Nest (`catalogCategories.ts`); candles banner — static до CMS. Guest checkout на Front разрешён (как Mira).
- Live smoke: `cd Front && NEST_LIVE=1 NEXT_PUBLIC_API_URL=http://127.0.0.1:3011/api/v1 npx vitest run src/api/nestLive.test.ts` (cart, claim/devHint, surcharge quote, webhook auth, create→pay).

## Фаза 4 — Saleor убран из репо

- Удалены: `Back/` (API + dashboard + celery compose), `Front/saleor-yandex-plugin/`, `Front/scripts/audit-stock*`.
- Nginx Nest-стека: [`deploy/nginx-vspomni-https.conf`](deploy/nginx-vspomni-https.conf) — `410` только на `/graphql/` и `/dashboard/`.
- Декомиссия старого Saleor-VPS: [`deploy/DECOMMISSION-SALEOR.md`](deploy/DECOMMISSION-SALEOR.md).
- Локальный ETL dump (`dumps/`, `scripts/etl/`) оставлен только для повторного импорта, не для runtime.
- **SMTP** (`api/.env` `SMTP_*`): без него OTP регистрации и password-reset не уходят. ETL-покупатели с `passwordHash=null` входят только через «Забыли пароль» → письмо → задать пароль.

## Новый VPS (прод Nest)

Отдельный сервер, код в **`/opt/vspomni`**, свои systemd/nginx/LE.  
**Не** деплоить в `~/Saleor-miraflores` и не на VPS Miraflores.

- Гайд: [`deploy/NEW-VPS.md`](deploy/NEW-VPS.md)
- Upload: `./deploy/scripts/upload-to-server.sh` → только `/opt/vspomni`
- Deploy: `./deploy/scripts/deploy.sh`
- Checkout env: [`deploy/CHECKOUT-PROD.md`](deploy/CHECKOUT-PROD.md)

## ETL notes (фаза 2)

- Объём: Saleor attr `obuem` → `ProductVariant.volumeMl` (не Mira `volume`). Без attr → `null`.
- Остатки: по умолчанию `ETL_FORCE_STOCK=1000` на все варианты.
- CMS: `privacy` ← body `BlogPost` `privacy-policy`; `terms` / `delivery` / `about` — пустые заглушки под ручное наполнение.
- **YooKassa:** в Saleor-дампе нет payment ID (пустые metadata / нет payment-таблиц). Исторические `Payment.externalId` остаются `NULL`; новые оплаты — через Nest YooKassa, ETL их не восстанавливает.
- Buyers: `passwordHash=null` → «Забыли пароль» / `POST /auth/password-reset/request` + `confirm` (нужен SMTP; ответ API отдаёт `mailConfigured`).

Miraflores 3.0 не изменялся.
