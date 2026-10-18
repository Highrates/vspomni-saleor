# Новый VPS для vspomni.store

Отдельный сервер. Код только в **`/opt/vspomni`**.  
**Не** деплоить в `~/Saleor-miraflores`, `/opt/miraflores`, `/opt/saleor` и не на VPS Miraflores (`91.229.8.83`).

Старый прод Saleor (`91.229.9.11`, `/opt/saleor/vspomni-saleor`) — только источник dump/ETL; cutover DNS уводит домен на новый VPS.

---

## Архитектура

```
https://vspomni.store/
  /                 → Next Front   systemd vspomni-front 127.0.0.1:3001
  /api/v1/          → Nest API     systemd vspomni-api   127.0.0.1:3011
  /uploads/         → Nest
  /admin            → Next Admin   systemd vspomni-admin 127.0.0.1:3020
  /api/cdek|…       → Front BFF
  /graphql/ /dashboard/ → 410

Postgres docker vspomni_db → 127.0.0.1:5432
nginx + Let’s Encrypt
UFW: снаружи только 22 / 80 / 443 (app-порты не слушают 0.0.0.0)
```

### Harden (обязательно)

- `api/.env`: `HOST=127.0.0.1`, `TRUST_PROXY=1`, `CORS_ORIGIN=https://vspomni.store,…` (не пустой), `FRONTEND_PUBLIC_URL` / `LOCAL_UPLOADS_PUBLIC_URL=https://vspomni.store`, `YOOKASSA_WEBHOOK_SECRET` + `YOOKASSA_WEBHOOK_CHECK_IP=true`
- systemd: `User=vspomni`, Front/Admin `next start -H 127.0.0.1`
- UFW: только 22 / 80 / 443
- SSH: `PasswordAuthentication no`, `PermitRootLogin prohibit-password`, fail2ban `sshd`
- nginx: HSTS + `X-Content-Type-Options` / `Referrer-Policy` / `X-Frame-Options`; `limit_req` на `/api/v1/auth/`, promo validate, yookassa webhook; access_log без `$args`

---

## 0. Локальная приёмка (до DNS)

На Mac / staging:

- [ ] `NEST_LIVE` smoke, guest checkout, promo `WELCOME10`, доставка fail-hard
- [ ] [`CHECKOUT-PROD.md`](CHECKOUT-PROD.md) env готовы к копированию на сервер
- [ ] ETL данные в Nest (или план переноса dump → новый Postgres)

DNS **не** переключать, пока стек не отвечает по IP нового VPS (или `/etc/hosts`).

---

## 1. Локальный конфиг деплоя

```bash
cp deploy/deploy.env.example deploy/deploy.env
# DEPLOY_HOST=root@NEW_VPS_IP
# DEPLOY_PATH=/opt/vspomni
# DEPLOY_SSH_KEY=~/.ssh/id_ed25519_vspomni

chmod +x deploy/scripts/*.sh
ssh-copy-id -i ~/.ssh/id_ed25519_vspomni.pub root@NEW_VPS_IP
```

`upload-to-server.sh` / `lib.sh` откажутся писать вне `/opt/vspomni` и на хост Mira.

---

## 2. Первый залив и bootstrap на VPS

```bash
# с Mac
./deploy/scripts/upload-to-server.sh

# на VPS
ssh root@NEW_VPS_IP
export VSPOMNI_PG_PASSWORD='…сильный…'
bash /opt/vspomni/deploy/scripts/bootstrap-vps.sh
```

### Секреты

**Только на сервере** — не копировать живые ключи в `deploy/.secrets/` на Mac и не коммитить.

| Файл на VPS | Минимум |
|------|---------|
| `/opt/vspomni/api/.env` | `DATABASE_URL`, `JWT_SECRET`, `YOOKASSA_*`, `YOOKASSA_WEBHOOK_SECRET`, `TRUST_PROXY=1`, `SMTP_*`, `FRONTEND_PUBLIC_URL=https://vspomni.store`, `CORS_ORIGIN` с `https://vspomni.store` |
| `/opt/vspomni/Front/.env.local` | `NEXT_PUBLIC_API_URL=http://127.0.0.1:3011/api/v1`, `NEXT_PUBLIC_SITE_URL=https://vspomni.store`, CDEK/Yandex/Ozon BFF |
| `/opt/vspomni/Admin/.env.local` | API → `http://127.0.0.1:3011/api/v1` |

`deploy/deploy.env` на Mac — только `DEPLOY_HOST` / SSH-ключ / путь (без JWT/DB/webhook).  
`upload-to-server.sh` **не** заливает `.env*`.

После DNS cutover, если секреты когда-либо лежали на ноутбуке или в чате — **ротация**: `JWT_SECRET`, `ORDER_PAY_SECRET`, `YOOKASSA_WEBHOOK_SECRET`, пароль Postgres + `DATABASE_URL`, `ADMIN_SEED_PASSWORD` (и смена пароля админа в БД).

Сборка и старт:

```bash
# с Mac
./deploy/scripts/deploy.sh
# или на сервере уже залито:
./deploy/scripts/deploy.sh --skip-upload
```

Проверка по IP (до DNS):

```bash
curl -sS http://NEW_VPS_IP/api/v1/health
# Host-заголовок при необходимости:
curl -sS -H 'Host: vspomni.store' http://NEW_VPS_IP/api/v1/health
```

---

## 3. Let’s Encrypt

Пока DNS A = старый IP (`91.229.9.11`) — certbot HTTP-01 на новом VPS **не пройдёт**.  
Сейчас на `194.67.113.17` стоит **staging self-signed** (`/etc/ssl/vspomni/`) + `nginx-vspomni-https.conf` (HTTP→301 HTTPS). Для браузера: `/etc/hosts` → новый IP и принять предупреждение о сертификате.

После cutover DNS на новый VPS:

```bash
sudo mkdir -p /var/www/certbot
sudo certbot --nginx -d vspomni.store -d www.vspomni.store \
  --non-interactive --agree-tos -m info@vspomni.store --redirect
# затем пути cert в sites-available должны стать /etc/letsencrypt/live/…
sudo cp /opt/vspomni/deploy/nginx-vspomni-https.conf /etc/nginx/sites-available/vspomni
sudo nginx -t && sudo systemctl reload nginx
```

---

## 4. DNS cutover

1. Локальная / IP-приёмка на новом VPS зелёная.
2. YooKassa webhook URL уже указывает на Nest (или переключить в момент cutover):  
   `https://vspomni.store/api/v1/orders/yookassa/webhook?secret=…`
3. TTL заранее понизить.
4. A/AAAA `vspomni.store` + `www` → IP **нового** VPS.
5. Smoke: health, витрина, `/admin`, тестовая оплата, SMTP reset.
6. Старый Saleor-стек: [`DECOMMISSION-SALEOR.md`](DECOMMISSION-SALEOR.md) (остановить compose на `91.229.9.11`).

---

## 5. Рутинный деплой

```bash
./deploy/scripts/deploy.sh                 # upload + build + restart
./deploy/scripts/upload-to-server.sh       # только код
./deploy/scripts/deploy.sh --front         # только витрина
./deploy/scripts/deploy.sh --api --skip-upload
```

---

## Запрещено

| Путь / хост | Почему |
|-------------|--------|
| `~/Saleor-miraflores`, `/root/Saleor-miraflores` | старый скрипт Mira / путаница |
| `/opt/miraflores`, `91.229.8.83` | прод Miraflores |
| `91.229.9.11` как `DEPLOY_HOST` | старый Saleor — **блок в `lib.sh`**; dump ETL ок отдельно |
| `/opt/saleor/vspomni-saleor` на старом IP | только dump; не целевой runtime Nest |

Целевой runtime: **`/opt/vspomni`** на отдельном VPS.

Клиентский smoke (не `:3011`):

```bash
./deploy/scripts/smoke-client.sh --ip 194.67.113.17
```
