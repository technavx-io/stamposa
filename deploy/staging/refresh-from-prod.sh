#!/usr/bin/env bash
# Refresh staging Postgres from the latest daily prod backup in R2.
#
# Runs from the VPS. Uses the prod-side backup image (which already has
# rclone + openssl + pg_restore) to fetch, decrypt, and restore into the
# staging Postgres on 127.0.0.1:5433.
#
# Redis is NOT restored — staging sessions are throwaway.
#
# Usage:
#   ./refresh-from-prod.sh              # newest daily/
#   ./refresh-from-prod.sh weekly       # newest weekly/
#   ./refresh-from-prod.sh <full-key>   # a specific R2 object
#
# ⚠️  This restores REAL data (real merchants, real customer phone numbers).
#     Anonymization is TODO. Treat staging at prod trust level.
set -euo pipefail

STAGING_ENV="/opt/staging/.env"
PROD_ENV="/opt/api-docker/.env"

[ -r "$STAGING_ENV" ] || { echo "missing $STAGING_ENV" >&2; exit 1; }
[ -r "$PROD_ENV"    ] || { echo "missing $PROD_ENV (needed for R2 creds)" >&2; exit 1; }

# Prod env has R2_* + BACKUP_ENCRYPTION_PASSPHRASE. Staging env has
# POSTGRES_PASSWORD (staging one). Pull each from the right file.
# shellcheck disable=SC1090
set -a
. "$PROD_ENV"
STAGING_PGPASS="$(grep -E '^POSTGRES_PASSWORD=' "$STAGING_ENV" | head -1 | cut -d= -f2-)"
set +a
[ -n "$STAGING_PGPASS" ] || { echo "staging POSTGRES_PASSWORD not set" >&2; exit 1; }

ARG="${1:-}"
if [ -z "$ARG" ] || [ "$ARG" = "daily" ] || [ "$ARG" = "weekly" ] || [ "$ARG" = "monthly" ]; then
  PREFIX="${ARG:-daily}"
  echo "── Finding newest $PREFIX Postgres backup in r2:${R2_BUCKET}/${PREFIX}/ ──"
  KEY=$(docker run --rm --network host \
    -e RCLONE_CONFIG_R2_TYPE=s3 \
    -e RCLONE_CONFIG_R2_PROVIDER=Cloudflare \
    -e RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
    -e RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
    -e RCLONE_CONFIG_R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com" \
    stamposa-backup:latest \
    rclone lsf "r2:${R2_BUCKET}/${PREFIX}/" --include 'postgres-*.dump.enc' \
    | sort -r | head -1)
  [ -n "$KEY" ] || { echo "no postgres backups under $PREFIX/" >&2; exit 1; }
  KEY="${PREFIX}/${KEY}"
else
  KEY="$ARG"
fi
echo "── Using backup: $KEY ──"

# Ensure staging is up.
if ! nc -z 127.0.0.1 5433 2>/dev/null; then
  echo "staging Postgres not on 127.0.0.1:5433 — run 'docker compose -f /opt/staging/api-compose.yml up -d postgres' first" >&2
  exit 1
fi

# Recreate the staging DB so restore is clean.
echo "── Recreating staging database loyalty_platform ──"
PGPASSWORD="$STAGING_PGPASS" psql -h 127.0.0.1 -p 5433 -U loyalty -d postgres -c \
  "DROP DATABASE IF EXISTS loyalty_platform;" >/dev/null
PGPASSWORD="$STAGING_PGPASS" psql -h 127.0.0.1 -p 5433 -U loyalty -d postgres -c \
  "CREATE DATABASE loyalty_platform;" >/dev/null

# Stream: R2 → decrypt → pg_restore, all in one pipeline.
echo "── Streaming decrypt + restore ──"
docker run --rm --network host \
  -e RCLONE_CONFIG_R2_TYPE=s3 \
  -e RCLONE_CONFIG_R2_PROVIDER=Cloudflare \
  -e RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  -e RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  -e RCLONE_CONFIG_R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com" \
  -e BACKUP_ENCRYPTION_PASSPHRASE="$BACKUP_ENCRYPTION_PASSPHRASE" \
  -e PGPASSWORD="$STAGING_PGPASS" \
  stamposa-backup:latest \
  sh -c "rclone cat 'r2:${R2_BUCKET}/${KEY}' \
    | openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_ENCRYPTION_PASSPHRASE \
    | pg_restore -h 127.0.0.1 -p 5433 -U loyalty -d loyalty_platform --no-owner --no-privileges"

echo "── Staging refresh complete ──"
echo "Rows in a few core tables:"
PGPASSWORD="$STAGING_PGPASS" psql -h 127.0.0.1 -p 5433 -U loyalty -d loyalty_platform -c \
  "SELECT 'merchants' AS t, count(*) FROM \"Merchant\"
   UNION ALL SELECT 'businesses', count(*) FROM \"Business\"
   UNION ALL SELECT 'customers', count(*) FROM \"Customer\"
   UNION ALL SELECT 'stamps', count(*) FROM \"Stamp\";"
