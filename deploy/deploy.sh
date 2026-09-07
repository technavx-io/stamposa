#!/bin/bash
# One deploy script for every Stamposa app slot on CloudStick.
#
#   ./deploy/deploy.sh api          # backend-api slot  → api + postgres + redis
#   ./deploy/deploy.sh web          # a web slot        → the Next.js container
#   ./deploy/deploy.sh api --seed   # FRESH install only: also load demo data (WIPES DB)
#
# Run it from a git checkout of the repo inside that slot's app path, after
# filling in deploy/.env.production. It pulls the latest code, builds the image,
# runs migrations (api role), and (re)starts the container. CloudStick's nginx
# reverse-proxies each domain to the localhost port the container publishes.
set -euo pipefail

ROLE="${1:-}"
cd "$(dirname "$0")/.."

# ── Preflight ──────────────────────────────────────────────────────────────
if [ ! -f deploy/.env.production ]; then
  echo "✗ deploy/.env.production is missing."
  echo "  cp deploy/env.production.example deploy/.env.production   # then fill it in"
  exit 1
fi
if grep -q "replace-me\|replace-with" deploy/.env.production; then
  echo "✗ deploy/.env.production still has placeholder values — fill them in first."
  exit 1
fi
val() { grep "^$1=" deploy/.env.production | cut -d= -f2-; }

# Always deploy exactly what's on the tracked branch — no local drift.
if [ -d .git ]; then
  echo "→ Pulling latest code…"
  git pull --ff-only
fi
export GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
export BUILT_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

case "$ROLE" in
  api)
    COMPOSE=(docker compose -f deploy/docker-compose.api.yml --env-file deploy/.env.production)
    echo "→ Building API image…";           "${COMPOSE[@]}" build
    echo "→ Starting Postgres + Redis…";     "${COMPOSE[@]}" up -d postgres redis
    echo "→ Applying database migrations…";  "${COMPOSE[@]}" --profile tools run --rm migrate
    echo "→ Ensuring admin accounts exist…"; "${COMPOSE[@]}" --profile tools run --rm seed-admins
    if [ "${2:-}" = "--seed" ]; then
      echo "⚠  --seed WIPES ALL DATA and inserts demo tenants. Never on a live database."
      read -r -p "   Type 'wipe' to proceed, anything else to abort: " confirm
      [ "$confirm" = "wipe" ] || { echo "   Aborted — nothing was wiped."; exit 1; }
      "${COMPOSE[@]}" --profile tools run --rm seed
    fi
    echo "→ Starting the API…";              "${COMPOSE[@]}" up -d api
    echo "→ Waiting for the API health check…"
    for i in $(seq 1 30); do
      if "${COMPOSE[@]}" exec -T api wget -qO- http://localhost:4000/v1/health >/dev/null 2>&1; then
        echo "✓ API healthy."; break
      fi
      [ "$i" = 30 ] && { echo "✗ API did not become healthy — check: ${COMPOSE[*]} logs api"; exit 1; }
      sleep 2
    done
    "${COMPOSE[@]}" ps
    echo ""
    echo "✓ API deployed on 127.0.0.1:$(val API_PORT)."
    echo "  In CloudStick, reverse-proxy  https://$(val API_DOMAIN)  →  127.0.0.1:$(val API_PORT)"
    ;;

  web)
    # Distinct compose project per web slot so two identical web containers
    # (site + app) can coexist on the same Docker host without clashing.
    PROJECT="stamposa-web-${WEB_SLOT:-$(val WEB_PORT)}"
    COMPOSE=(docker compose -p "$PROJECT" -f deploy/docker-compose.web.yml --env-file deploy/.env.production)
    echo "→ Building web image (project: $PROJECT)…"; "${COMPOSE[@]}" build
    echo "→ Starting web…";                            "${COMPOSE[@]}" up -d web
    "${COMPOSE[@]}" ps
    echo ""
    echo "✓ Web deployed on 127.0.0.1:$(val WEB_PORT)."
    echo "  In CloudStick, reverse-proxy this slot's domain → 127.0.0.1:$(val WEB_PORT):"
    echo "    stamposawebsite slot →  https://$(val SITE_DOMAIN)"
    echo "    frontend-app    slot →  https://$(val APP_DOMAIN)"
    ;;

  *)
    echo "Usage: ./deploy/deploy.sh {api|web} [--seed]"
    echo "  api  → backend-api slot   (api + postgres + redis + migrations)"
    echo "  web  → a web slot         (stamposawebsite or frontend-app)"
    echo ""
    echo "For a web slot, set WEB_SLOT (site|app) and a unique WEB_PORT in that"
    echo "slot's deploy/.env.production so the two web containers don't clash."
    exit 1
    ;;
esac
