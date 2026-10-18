#!/usr/bin/env bash
# Залить код на новый VPS → /opt/vspomni (rsync).
# НЕ трогает Miraflores и НЕ пишет в ~/Saleor-miraflores.
#
# Usage:
#   ./deploy/scripts/upload-to-server.sh
#   ./deploy/scripts/upload-to-server.sh --dry-run
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib.sh"

load_deploy_env
setup_ssh
verify_deploy_ssh

DRY=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY=1 ;;
    -h|--help)
      echo "Usage: $0 [--dry-run]"
      exit 0
      ;;
    *) echo "unknown arg: $1" >&2; exit 1 ;;
  esac
  shift
done

RSYNC_FLAGS=(-az --delete)
[[ "$DRY" -eq 1 ]] && RSYNC_FLAGS+=(--dry-run)

EXCLUDES=(
  --exclude node_modules
  --exclude .git
  --exclude .next
  --exclude dist
  --exclude .data
  --exclude api/.data
  --exclude dumps
  # relative to each rsync root (scripts/ → etl/.media-cache)
  --exclude .media-cache
  --exclude etl/.media-cache
  --exclude 'deploy/deploy.env'
  --exclude 'deploy/.secrets'
  --exclude '.env'
  --exclude '.env.local'
  --exclude 'api/.env'
  --exclude 'Admin/.env.local'
  --exclude 'Front/.env.local'
  --exclude 'Front/.env'
  --exclude '*.log'
  --exclude .DS_Store
  --exclude '**/*.tsbuildinfo'
)

log "rsync → $DEPLOY_HOST:$DEPLOY_PATH  (dry-run=$DRY)"
assert_vspomni_deploy_path "$DEPLOY_PATH"

"${SSH[@]}" "$DEPLOY_HOST" "mkdir -p '$DEPLOY_PATH'"

# Корень монорепо (package.json, lock, docker-compose) + исходники
rsync "${RSYNC_FLAGS[@]}" -e "ssh -o RequestTTY=no -o BatchMode=yes -i '${DEPLOY_SSH_KEY/#\~/$HOME}' -o IdentitiesOnly=yes" \
  "${EXCLUDES[@]}" \
  "$MONO_ROOT/package.json" \
  "$MONO_ROOT/package-lock.json" \
  "$MONO_ROOT/docker-compose.yml" \
  "$DEPLOY_HOST:$DEPLOY_PATH/"

for dir in api Admin Front packages deploy scripts; do
  if [[ -d "$MONO_ROOT/$dir" ]]; then
    log "  $dir/"
    rsync "${RSYNC_FLAGS[@]}" -e "ssh -o RequestTTY=no -o BatchMode=yes -i '${DEPLOY_SSH_KEY/#\~/$HOME}' -o IdentitiesOnly=yes" \
      "${EXCLUDES[@]}" \
      "$MONO_ROOT/$dir/" \
      "$DEPLOY_HOST:$DEPLOY_PATH/$dir/"
  fi
done

log "upload done → $DEPLOY_HOST:$DEPLOY_PATH"
log "секреты (.env) не заливаются — положите вручную на сервере:"
log "  $DEPLOY_PATH/api/.env"
log "  $DEPLOY_PATH/Admin/.env.local"
log "  $DEPLOY_PATH/Front/.env.local"
