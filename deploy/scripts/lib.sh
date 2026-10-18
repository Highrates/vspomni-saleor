#!/usr/bin/env bash
# Общие функции для deploy-скриптов Vspomni.
set -euo pipefail

DEPLOY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MONO_ROOT="$(cd "$DEPLOY_ROOT/.." && pwd)"

# Пути, куда деплоить Vspomni нельзя (путаница с Mira / старый Saleor).
FORBIDDEN_PATH_REGEX='Saleor-miraflores|/opt/miraflores|/opt/saleor|miraflores'

assert_vspomni_deploy_path() {
  local path="${1:-}"
  if [[ -z "$path" ]]; then
    echo "error: DEPLOY_PATH пуст" >&2
    exit 1
  fi
  if [[ "$path" != /opt/vspomni && "$path" != /opt/vspomni/* ]]; then
    echo "error: DEPLOY_PATH должен быть /opt/vspomni (сейчас: $path)" >&2
    echo "       Не деплойте в ~/Saleor-miraflores или /opt/miraflores." >&2
    exit 1
  fi
  if [[ "$path" =~ $FORBIDDEN_PATH_REGEX ]]; then
    echo "error: DEPLOY_PATH похож на Mira/Saleor: $path" >&2
    exit 1
  fi
}

load_deploy_env() {
  local env_file="$DEPLOY_ROOT/deploy.env"
  if [[ -f "$env_file" ]]; then
    # shellcheck disable=SC1090
    set -a && source "$env_file" && set +a
  elif [[ -f "$DEPLOY_ROOT/deploy.env.example" ]]; then
    echo "warn: нет deploy/deploy.env — беру deploy.env.example" >&2
    # shellcheck disable=SC1090
    set -a && source "$DEPLOY_ROOT/deploy.env.example" && set +a
  fi

  : "${DEPLOY_HOST:?задайте DEPLOY_HOST в deploy/deploy.env}"
  DEPLOY_PATH="${DEPLOY_PATH:-/opt/vspomni}"
  DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
  DEPLOY_SSH_KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/id_ed25519_vspomni}"
  assert_vspomni_deploy_path "$DEPLOY_PATH"

  # Deploy/upload только на новый Nest-VPS. ETL dump (scripts/etl/dump-from-prod.sh)
  # на 91.229.9.11 по-прежнему ок — он lib.sh не подключает.
  if [[ "$DEPLOY_HOST" == *"91.229.8.83"* ]] || [[ "$DEPLOY_HOST" == *"miraflores"* ]]; then
    echo "error: DEPLOY_HOST указывает на Miraflores ($DEPLOY_HOST)" >&2
    echo "       Нужен отдельный VPS для vspomni.store." >&2
    exit 1
  fi
  if [[ "$DEPLOY_HOST" == *"91.229.9.11"* ]]; then
    echo "error: DEPLOY_HOST указывает на старый Saleor ($DEPLOY_HOST)" >&2
    echo "       Деплой только на новый VPS (/opt/vspomni). Dump ETL — отдельно:" >&2
    echo "       ./scripts/etl/dump-from-prod.sh" >&2
    exit 1
  fi
}

setup_ssh() {
  local key="${DEPLOY_SSH_KEY/#\~/$HOME}"
  if [[ ! -f "$key" ]]; then
    echo "error: SSH-ключ не найден: $key" >&2
    echo "       Задайте DEPLOY_SSH_KEY в deploy/deploy.env" >&2
    exit 1
  fi
  SSH=(ssh -o RequestTTY=no -o BatchMode=yes -i "$key" -o IdentitiesOnly=yes)
  RSYNC=(rsync -az --delete -e "ssh -o RequestTTY=no -o BatchMode=yes -i '$key' -o IdentitiesOnly=yes")
}

verify_deploy_ssh() {
  log "проверка SSH → $DEPLOY_HOST"
  if ! "${SSH[@]}" -o ConnectTimeout=15 "$DEPLOY_HOST" "echo ok" >/dev/null 2>&1; then
    local key="${DEPLOY_SSH_KEY/#\~/$HOME}"
    echo "error: SSH к $DEPLOY_HOST не прошёл" >&2
    echo "  ssh-copy-id -i ${key}.pub $DEPLOY_HOST" >&2
    exit 1
  fi
}

log() { printf '==> %s\n' "$*"; }
