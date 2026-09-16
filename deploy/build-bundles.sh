#!/usr/bin/env bash
# Build every deployment bundle with a consistent version stamp.
#
# Three artefacts come out of one run:
#   website-docker/website/   stamposa.com      (apps/website, Next standalone)
#   website-docker/frontend/  app.stamposa.com  (apps/frontend, Next standalone)
#   api-docker/app/           api.stamposa.com  (apps/backend, compiled dist/)
#
# The point is that every deployed artefact carries the same version, the
# commit it came from, and when it was built — so `curl https://<host>/version`
# and `/v1/health` can be compared against what you think you shipped.
#
# Everything is compiled HERE, on the dev machine, never on the server: the
# 2GB VPS cannot spare the RAM for a Next or Nest build while serving traffic.
#
# Modes:
#   STAGE=prod    (default) — full build: two Next bundles + api bundle.
#   STAGE=staging          — only the two Next bundles (baked with staging
#                            URLs); staging reuses the prod api image on
#                            the VPS. See deploy/staging/README.md.
set -euo pipefail

STAGE="${STAGE:-prod}"
case "$STAGE" in
  prod|staging) ;;
  *) echo "STAGE must be 'prod' or 'staging' (got: $STAGE)" >&2; exit 2 ;;
esac

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

VERSION=$(node -p "require('$REPO/package.json').version")
GIT_SHA=$(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || echo unknown)
DIRTY=$(git -C "$REPO" status --porcelain 2>/dev/null | head -1)
[ -n "$DIRTY" ] && GIT_SHA="${GIT_SHA}-dirty"
BUILT_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)

echo "── Stamposa build ────────────────────────────────"
echo "   stage   : $STAGE"
echo "   version : $VERSION"
echo "   commit  : $GIT_SHA"
echo "   built   : $BUILT_AT"
[ -n "$DIRTY" ] && echo "   WARNING : working tree is dirty — this build is not reproducible from git"
echo

# Build-time values baked into both Next bundles. Staging swaps every URL to
# the staging.* subdomains so the compiled bundle calls the right API.
if [ "$STAGE" = "staging" ]; then
  export NEXT_PUBLIC_API_URL=https://api-staging.stamposa.com
  export NEXT_PUBLIC_SITE_URL=https://staging.stamposa.com
  export NEXT_PUBLIC_APP_URL=https://app-staging.stamposa.com
  WEB_TARBALL="stamposa-web-docker-staging.tar.gz"
  # Bundles unpack into deploy/staging/{website,frontend}/ on the VPS.
  WEB_OUT_DIR="staging"
else
  export NEXT_PUBLIC_API_URL=https://api.stamposa.com
  export NEXT_PUBLIC_SITE_URL=https://stamposa.com
  export NEXT_PUBLIC_APP_URL=https://app.stamposa.com
  WEB_TARBALL="stamposa-web-docker.tar.gz"
  WEB_OUT_DIR="website-docker"
fi
export NEXT_PUBLIC_DEFAULT_PHONE_REGION=IN
export NEXT_PUBLIC_PHONE_AUTH_ENABLED="${PHONE_AUTH_ENABLED:-false}"
export NEXT_PUBLIC_APP_VERSION="$VERSION"
export NEXT_PUBLIC_GIT_SHA="$GIT_SHA"
export NEXT_PUBLIC_BUILT_AT="$BUILT_AT"

# ── Next apps (website + frontend) ────────────────────────────────────────
# $1 = workspace dir under apps/, $2 = bundle dir under $WEB_OUT_DIR/
build_next() {
  local app="$1" dest="$OUT/$WEB_OUT_DIR/$2"
  echo "▸ building $app…"
  rm -rf "$REPO/apps/$app/.next"
  ( cd "$REPO" && npm run -w "apps/$app" build >/dev/null )
  rm -rf "$dest"; mkdir -p "$dest"
  # Standalone output is rooted at the monorepo, so the server lives at
  # apps/<app>/server.js inside the bundle; the Dockerfiles use that path.
  cp -R "$REPO/apps/$app/.next/standalone/." "$dest/"
  mkdir -p "$dest/apps/$app/.next"
  cp -R "$REPO/apps/$app/.next/static" "$dest/apps/$app/.next/static"
  cp -R "$REPO/apps/$app/public" "$dest/apps/$app/public"
  # A stray .next left in the app dir corrupts the next `next dev`.
  rm -rf "$REPO/apps/$app/.next"
}
build_next website website
build_next frontend frontend
( cd "$OUT" && tar czf "$WEB_TARBALL" "$WEB_OUT_DIR" )
echo "  web bundle  : $(du -h "$OUT/$WEB_TARBALL" | cut -f1)  (website + frontend, $STAGE)"

# ── Backend (prod only — staging reuses the prod image) ──────────────────
if [ "$STAGE" = "prod" ]; then
  echo "▸ building backend…"
  ( cd "$REPO" && npm run build -w apps/backend >/dev/null )
  API="$OUT/api-docker/app"
  rm -rf "$API"; mkdir -p "$API"
  cp -R "$REPO/apps/backend/dist" "$API/dist"
  cp -R "$REPO/apps/backend/prisma" "$API/prisma"
  # prisma/seed.ts is the DEV seed — it WIPES the database. Never ship it to prod.
  rm -f "$API/prisma/seed.ts"
  cp -R "$REPO/apps/backend/assets" "$API/assets"   # wallet default logo + apple icons
  cp "$REPO/apps/backend/package.json" "$API/package.json"
  cp "$REPO/apps/backend/tsconfig.json" "$API/tsconfig.json"
  # The API reads these from the environment at runtime; the compose file loads
  # this file after .env so the stamp of the bundle actually deployed wins.
  cat > "$OUT/api-docker/build-info.env" <<INNER
APP_VERSION=$VERSION
GIT_SHA=$GIT_SHA
BUILT_AT=$BUILT_AT
INNER
  ( cd "$OUT" && tar czf stamposa-api-docker.tar.gz api-docker )
  echo "  api bundle  : $(du -h "$OUT/stamposa-api-docker.tar.gz" | cut -f1)"
fi

echo
if [ "$STAGE" = "staging" ]; then
  echo "Built STAGING v$VERSION ($GIT_SHA). Verify after deploy:"
  echo "  curl -s https://staging.stamposa.com/version"
  echo "  curl -s https://app-staging.stamposa.com/version"
  echo "  curl -s https://api-staging.stamposa.com/v1/health"
else
  echo "Built v$VERSION ($GIT_SHA). Verify after deploy:"
  echo "  curl -s https://stamposa.com/version"
  echo "  curl -s https://app.stamposa.com/version"
  echo "  curl -s https://api.stamposa.com/v1/health"
fi
