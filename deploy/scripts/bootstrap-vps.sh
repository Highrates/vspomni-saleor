#!/usr/bin/env bash
# Одноразовый bootstrap на НОВОМ VPS (запускать ПО SSH на сервере как root).
# Не трогает Mira / ~/Saleor-miraflores.
#
# Usage (на сервере после первого upload):
#   cd /opt/vspomni && bash deploy/scripts/bootstrap-vps.sh
#
set -euo pipefail

ROOT="${1:-/opt/vspomni}"
case "$ROOT" in
  /opt/vspomni|/opt/vspomni/*) ;;
  *)
    echo "error: bootstrap только для /opt/vspomni (got $ROOT)" >&2
    exit 1
    ;;
esac

if [[ ! -d "$ROOT/deploy" ]]; then
  echo "error: нет $ROOT/deploy — сначала ./deploy/scripts/upload-to-server.sh" >&2
  exit 1
fi

echo "==> dirs"
mkdir -p /var/www/certbot
mkdir -p "$ROOT"

echo "==> systemd units"
cp "$ROOT/deploy/systemd/vspomni-api.service" /etc/systemd/system/
cp "$ROOT/deploy/systemd/vspomni-front.service" /etc/systemd/system/
cp "$ROOT/deploy/systemd/vspomni-admin.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable vspomni-api vspomni-front vspomni-admin

echo "==> postgres (docker)"
if [[ -z "${VSPOMNI_PG_PASSWORD:-}" ]]; then
  echo "warn: VSPOMNI_PG_PASSWORD не задан — пропускаю docker compose db"
  echo "       export VSPOMNI_PG_PASSWORD='…' && docker compose -f $ROOT/deploy/docker-compose.prod.yml up -d"
else
  (cd "$ROOT" && docker compose -f deploy/docker-compose.prod.yml up -d)
fi

echo "==> nginx HTTP bootstrap (до LE)"
if [[ -d /etc/nginx/sites-available ]]; then
  cp "$ROOT/deploy/nginx-vspomni-http-bootstrap.conf" /etc/nginx/sites-available/vspomni
  ln -sf /etc/nginx/sites-available/vspomni /etc/nginx/sites-enabled/vspomni
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx
else
  echo "warn: nginx sites-available нет — поставьте nginx вручную"
fi

cat <<EOF

Bootstrap OK.

Дальше:
1) Положите секреты:
   $ROOT/api/.env          (TRUST_PROXY=1, YOOKASSA_*, SMTP_*, DATABASE_URL → :5432)
   $ROOT/Admin/.env.local
   $ROOT/Front/.env.local  (NEXT_PUBLIC_API_URL=http://127.0.0.1:3011/api/v1
                            NEXT_PUBLIC_SITE_URL=https://vspomni.store)

2) С Mac: ./deploy/scripts/deploy.sh --skip-upload   # или полный deploy.sh

3) DNS A/AAAA vspomni.store → этот VPS (после локальной приёмки по IP / hosts)

4) Let’s Encrypt:
   sudo certbot --nginx -d vspomni.store -d www.vspomni.store
   # затем можно заменить сайт на deploy/nginx-vspomni-https.conf и reload

5) YooKassa webhook → Nest (см. deploy/CHECKOUT-PROD.md)

НЕ деплоить в ~/Saleor-miraflores и не на VPS Miraflores (91.229.8.83).
EOF
