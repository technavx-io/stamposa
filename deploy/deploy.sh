#!/bin/bash
# Deploy (or update) the loyalty platform on this server.
#   ./deploy/deploy.sh            # build, migrate, restart
#   ./deploy/deploy.sh --seed     # additionally load demo data (fresh installs)
set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE=(docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production)

if [ ! -f deploy/.env.production ]; then
  echo "✗ deploy/.env.production is missing."
  echo "  cp deploy/env.production.example deploy/.env.production   # then fill it in"
  exit 1
fi
if grep -q "replace-me\|replace-with\|example.com" deploy/.env.production; then
  echo "✗ deploy/.env.production still contains placeholder values — fill them in first."
  exit 1
fi

echo "→ Building images…"
"${COMPOSE[@]}" build

echo "→ Starting data stores…"
"${COMPOSE[@]}" up -d postgres redis

echo "→ Applying database migrations…"
"${COMPOSE[@]}" --profile tools run --rm migrate

if [ "${1:-}" = "--seed" ]; then
  echo "→ Seeding demo data…"
  "${COMPOSE[@]}" --profile tools run --rm seed
fi

echo "→ Starting the stack…"
"${COMPOSE[@]}" up -d api web caddy

echo "→ Waiting for the API health check…"
for i in $(seq 1 30); do
  if "${COMPOSE[@]}" exec -T api wget -qO- http://localhost:4000/v1/health >/dev/null 2>&1; then
    echo "✓ API healthy."
    break
  fi
  [ "$i" = 30 ] && { echo "✗ API did not become healthy — check: ${COMPOSE[*]} logs api"; exit 1; }
  sleep 2
done

"${COMPOSE[@]}" ps
echo ""
echo "✓ Deployed. App: https://$(grep ^APP_DOMAIN deploy/.env.production | cut -d= -f2)"
echo "           API: https://$(grep ^API_DOMAIN deploy/.env.production | cut -d= -f2)/docs"
