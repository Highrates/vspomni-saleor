#!/usr/bin/env bash
# Полная сборка на VPS без привязки к SSH-сессии.
set -euo pipefail
cd /opt/vspomni
LOG=/tmp/vspomni-deploy-all.log
exec > >(tee "$LOG") 2>&1

echo "==> start $(date -Is)"
assert_path() {
  case "$PWD" in
    /opt/vspomni|/opt/vspomni/*) ;;
    *) echo "error: не /opt/vspomni (PWD=$PWD)"; exit 1 ;;
  esac
}
assert_path

unset NODE_ENV
echo "==> npm ci (workspace)"
npm ci
echo "==> build packages"
npm run build:packages

if [[ ! -f api/.env ]]; then
  echo "error: нет api/.env" >&2
  exit 1
fi

set -a && source api/.env && set +a
echo "==> prisma migrate deploy"
npx prisma migrate deploy --schema api/prisma/schema.prisma
echo "==> prisma generate + build api"
npx prisma generate --schema api/prisma/schema.prisma
npm run build -w vspomni-api
echo "==> restart vspomni-api"
systemctl restart vspomni-api
sleep 2
curl -sf -H 'Host: vspomni.store' http://127.0.0.1/api/v1/health >/dev/null \
  && echo "vspomni-api: health ok" \
  || { echo "vspomni-api: health FAIL"; journalctl -u vspomni-api -n 40 --no-pager; exit 1; }

echo "==> build admin"
npm run build -w vspomni-admin
systemctl restart vspomni-admin
sleep 2
systemctl is-active vspomni-admin >/dev/null && echo "vspomni-admin: active" \
  || { echo "vspomni-admin: DOWN"; journalctl -u vspomni-admin -n 40 --no-pager; exit 1; }

echo "==> Front npm ci + build"
(
  cd Front
  unset NODE_ENV
  npm ci
  npm run build
)
systemctl restart vspomni-front
sleep 2
systemctl is-active vspomni-front >/dev/null && echo "vspomni-front: active" \
  || { echo "vspomni-front: DOWN"; journalctl -u vspomni-front -n 40 --no-pager; exit 1; }

echo "==> DONE $(date -Is)"
