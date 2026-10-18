#!/usr/bin/env bash
# Полный деплой на /opt/vspomni: rsync → npm ci → migrate → build → systemd.
#
# Usage:
#   ./deploy/scripts/deploy.sh              # всё
#   ./deploy/scripts/deploy.sh --api
#   ./deploy/scripts/deploy.sh --front
#   ./deploy/scripts/deploy.sh --admin
#   ./deploy/scripts/deploy.sh --skip-upload # код уже на сервере
#   ./deploy/scripts/deploy.sh --skip-migrate
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib.sh"

load_deploy_env
setup_ssh
verify_deploy_ssh

DO_API=1
DO_FRONT=1
DO_ADMIN=1
DO_UPLOAD=1
DO_MIGRATE=1

usage() {
  cat <<'EOF'
Deploy Nest + Front + Admin → /opt/vspomni (отдельный VPS, не Mira).

  ./deploy/scripts/deploy.sh
  ./deploy/scripts/deploy.sh --api|--front|--admin
  ./deploy/scripts/deploy.sh --skip-upload
  ./deploy/scripts/deploy.sh --skip-migrate

Config: deploy/deploy.env  (DEPLOY_PATH=/opt/vspomni)
EOF
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --api) DO_API=1; DO_FRONT=0; DO_ADMIN=0 ;;
    --front) DO_API=0; DO_FRONT=1; DO_ADMIN=0 ;;
    --admin) DO_API=0; DO_FRONT=0; DO_ADMIN=1 ;;
    --skip-upload) DO_UPLOAD=0 ;;
    --skip-migrate) DO_MIGRATE=0 ;;
    -h|--help) usage 0 ;;
    *) echo "unknown arg: $1" >&2; usage 1 ;;
  esac
  shift
done

if [[ "$DO_UPLOAD" -eq 1 ]]; then
  "$SCRIPT_DIR/upload-to-server.sh"
else
  log "skip upload"
fi

log "remote build & restart → $DEPLOY_HOST:$DEPLOY_PATH"
"${SSH[@]}" "$DEPLOY_HOST" bash -s <<REMOTE
set -euo pipefail
cd '$DEPLOY_PATH'
assert_path() {
  case "\$PWD" in
    /opt/vspomni|/opt/vspomni/*) ;;
    *) echo "error: не /opt/vspomni (PWD=\$PWD)"; exit 1 ;;
  esac
}
assert_path

DO_API=$DO_API
DO_FRONT=$DO_FRONT
DO_ADMIN=$DO_ADMIN
DO_MIGRATE=$DO_MIGRATE

echo "==> npm ci (workspace: api + Admin + packages)"
unset NODE_ENV
npm ci

echo "==> build packages"
npm run build:packages

if [[ "\$DO_API" -eq 1 ]]; then
  if [[ ! -f api/.env ]]; then
    echo "error: нет api/.env — скопируйте с локали / заполните по api/.env.example" >&2
    exit 1
  fi
  if [[ "\$DO_MIGRATE" -eq 1 ]]; then
    set -a && source api/.env && set +a
    echo "==> prisma migrate deploy"
    npx prisma migrate deploy --schema api/prisma/schema.prisma
  fi
  echo "==> prisma generate + build api"
  npx prisma generate --schema api/prisma/schema.prisma
  npm run build -w vspomni-api
  echo "==> restart vspomni-api"
  systemctl restart vspomni-api
  sleep 2
  # Клиентский путь: nginx :80/:443, не прямой :3011
  curl -sf -H 'Host: vspomni.store' http://127.0.0.1/api/v1/health >/dev/null \
    && echo "vspomni-api: health ok (via nginx :80)" \
    || { echo "vspomni-api: health FAIL (nginx :80)"; journalctl -u vspomni-api -n 40 --no-pager; exit 1; }
fi

if [[ "\$DO_ADMIN" -eq 1 ]]; then
  if [[ ! -f Admin/.env.local ]]; then
    echo "warn: нет Admin/.env.local — admin может не стартовать"
  fi
  echo "==> build admin"
  npm run build -w vspomni-admin
  echo "==> restart vspomni-admin"
  systemctl restart vspomni-admin
  sleep 2
  systemctl is-active vspomni-admin >/dev/null && echo "vspomni-admin: active" \
    || { echo "vspomni-admin: DOWN"; journalctl -u vspomni-admin -n 40 --no-pager; exit 1; }
fi

if [[ "\$DO_FRONT" -eq 1 ]]; then
  if [[ ! -f Front/.env.local && ! -f Front/.env ]]; then
    echo "warn: нет Front/.env.local — создайте перед продом (NEXT_PUBLIC_*)"
  fi
  echo "==> Front npm ci + build"
  (
    cd Front
    unset NODE_ENV
    npm ci
    npm run build
  )
  echo "==> restart vspomni-front"
  systemctl restart vspomni-front
  sleep 2
  systemctl is-active vspomni-front >/dev/null && echo "vspomni-front: active" \
    || { echo "vspomni-front: DOWN"; journalctl -u vspomni-front -n 40 --no-pager; exit 1; }
fi
REMOTE

log "done → client smoke: ./deploy/scripts/smoke-client.sh (только :80/:443, не :3011)"
