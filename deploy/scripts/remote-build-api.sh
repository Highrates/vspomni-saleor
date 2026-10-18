#!/usr/bin/env bash
set -euo pipefail
cd /opt/vspomni
LOG=/tmp/vspomni-deploy-api.log
exec > >(tee "$LOG") 2>&1

echo "==> start $(date -Is)"
unset NODE_ENV
npm ci
npm run build:packages
npx prisma generate --schema api/prisma/schema.prisma
npm run build -w vspomni-api
systemctl restart vspomni-api
sleep 2
curl -sf -H 'Host: vspomni.store' http://127.0.0.1/api/v1/health >/dev/null \
  && echo "vspomni-api: health ok" \
  || { echo "health FAIL"; journalctl -u vspomni-api -n 40 --no-pager; exit 1; }
echo "==> DONE $(date -Is)"
