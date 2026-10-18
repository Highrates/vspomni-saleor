#!/usr/bin/env bash
# Клиентский smoke: только :80 / :443 (nginx), не прямой :3011/:3001/:3020.
#
# Usage:
#   ./deploy/scripts/smoke-client.sh
#   ./deploy/scripts/smoke-client.sh --ip 194.67.113.17
#   SMOKE_HOST=vspomni.store SMOKE_IP=194.67.113.17 ./deploy/scripts/smoke-client.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib.sh"

SMOKE_HOST="${SMOKE_HOST:-vspomni.store}"
SMOKE_IP="${SMOKE_IP:-}"

usage() {
  cat <<'EOF'
Client smoke via nginx :80/:443 only (not Nest :3011).

  ./deploy/scripts/smoke-client.sh
  ./deploy/scripts/smoke-client.sh --ip 194.67.113.17
  ./deploy/scripts/smoke-client.sh --host vspomni.store --ip 194.67.113.17
EOF
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ip) SMOKE_IP="${2:?}"; shift ;;
    --host) SMOKE_HOST="${2:?}"; shift ;;
    -h|--help) usage 0 ;;
    *) echo "unknown: $1" >&2; usage 1 ;;
  esac
  shift
done

if [[ -z "$SMOKE_IP" ]]; then
  if [[ -f "$DEPLOY_ROOT/deploy.env" ]]; then
    # shellcheck disable=SC1090
    set -a && source "$DEPLOY_ROOT/deploy.env" && set +a
  fi
  if [[ -n "${DEPLOY_HOST:-}" ]]; then
    SMOKE_IP="${DEPLOY_HOST##*@}"
  fi
fi
: "${SMOKE_IP:?задайте --ip или DEPLOY_HOST в deploy/deploy.env}"

# Не путать с Saleor / Mira (deploy/upload blocked; ETL dump — отдельно)
case "$SMOKE_IP" in
  *91.229.8.83*|*91.229.9.11*)
    echo "error: smoke IP = старый Mira/Saleor ($SMOKE_IP) — нужен новый Nest-VPS" >&2
    exit 1
    ;;
esac

BODY=/tmp/vsp-smoke.body
resolve_https=(--resolve "${SMOKE_HOST}:443:${SMOKE_IP}")
resolve_http=(--resolve "${SMOKE_HOST}:80:${SMOKE_IP}")

http_code() {
  curl -sS -o "$BODY" -w '%{http_code}' --connect-timeout 10 "$@"
}

https_code() {
  # -k: staging self-signed до Let's Encrypt
  curl -skS -o "$BODY" -w '%{http_code}' --connect-timeout 10 "$@"
}

check() {
  local label="$1" expect="$2" code="$3"
  if [[ "$code" == "$expect" ]]; then
    log "OK  $label → $code"
  else
    echo "FAIL $label → $code (ожидали $expect)" >&2
    head -c 200 "$BODY" >&2 || true
    echo >&2
    exit 1
  fi
}

log "probe closed app ports on $SMOKE_IP"
if nc -z -G 2 "$SMOKE_IP" 3011 2>/dev/null; then
  echo "FAIL :3011 открыт снаружи — клиентский путь только через nginx" >&2
  exit 1
fi
log "OK  :3011 closed"

log "HTTP → HTTPS redirect"
code=$(http_code "${resolve_http[@]}" "http://${SMOKE_HOST}/")
check "http://$SMOKE_HOST/" "301" "$code"

log "HTTPS health (nginx → Nest)"
code=$(https_code "${resolve_https[@]}" "https://${SMOKE_HOST}/api/v1/health")
check "https://…/api/v1/health" "200" "$code"
grep -q '"ok":true' "$BODY"

log "HTTPS front /"
code=$(https_code "${resolve_https[@]}" "https://${SMOKE_HOST}/")
check "https://…/" "200" "$code"

log "HTTPS admin /admin"
code=$(https_code "${resolve_https[@]}" "https://${SMOKE_HOST}/admin")
if [[ "$code" != "200" && "$code" != "307" && "$code" != "302" ]]; then
  echo "FAIL /admin → $code" >&2
  exit 1
fi
log "OK  https://…/admin → $code"

log "Saleor stubs 410"
code=$(https_code "${resolve_https[@]}" "https://${SMOKE_HOST}/graphql/")
check "https://…/graphql/" "410" "$code"

log "client smoke OK → https://${SMOKE_HOST}/ (@ ${SMOKE_IP})"
