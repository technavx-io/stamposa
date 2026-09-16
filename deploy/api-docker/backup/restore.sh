#!/usr/bin/env bash
# Restore drill — never run against production without a plan.
#
# Usage:
#   docker compose run --rm backup restore.sh postgres <r2-object-key> [target-db]
#   docker compose run --rm backup restore.sh redis    <r2-object-key> [target-rdb-path]
#
# Examples:
#   restore.sh postgres daily/postgres-20260908T031500Z.dump.enc loyalty_restore
#   restore.sh redis    daily/redis-20260908T031500Z.rdb.enc    /tmp/restored.rdb
#
# Postgres: streams the encrypted dump from R2, decrypts, and pg_restore's
# into <target-db> (defaults to loyalty_restore — NEVER writes to the live DB
# unless you explicitly name it). The DB must already exist.
#
# Redis: writes the decrypted RDB to <target-rdb-path>. Loading it into the
# live redis is a separate, manual step (stop redis, replace dump.rdb, start).
set -euo pipefail

MODE="${1:-}"
KEY="${2:-}"
TARGET="${3:-}"

if [ -z "$MODE" ] || [ -z "$KEY" ]; then
  cat <<'USAGE' >&2
usage:
  restore.sh postgres <r2-object-key> [target-db=loyalty_restore]
  restore.sh redis    <r2-object-key> [target-rdb-path=/tmp/restored.rdb]
USAGE
  exit 2
fi

: "${R2_BUCKET:?}"
: "${BACKUP_ENCRYPTION_PASSPHRASE:?}"

case "$MODE" in
  postgres)
    DB="${TARGET:-loyalty_restore}"
    echo "── Restoring $KEY → database $DB (host=${POSTGRES_HOST:-127.0.0.1}) ──"
    rclone cat --config /root/.config/rclone/rclone.conf "r2:${R2_BUCKET}/${KEY}" \
    | openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
        -pass env:BACKUP_ENCRYPTION_PASSPHRASE \
    | pg_restore \
        -h "${POSTGRES_HOST:-127.0.0.1}" -p "${POSTGRES_PORT:-5432}" \
        -U "${POSTGRES_USER:-loyalty}" -d "$DB" \
        --clean --if-exists --no-owner --no-privileges
    echo "── Restore complete ──"
    ;;
  redis)
    OUT="${TARGET:-/tmp/restored.rdb}"
    echo "── Restoring $KEY → $OUT ──"
    rclone cat --config /root/.config/rclone/rclone.conf "r2:${R2_BUCKET}/${KEY}" \
    | openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
        -pass env:BACKUP_ENCRYPTION_PASSPHRASE \
    > "$OUT"
    echo "── Wrote $(stat -c %s "$OUT") bytes to $OUT ──"
    echo "To load: stop redis, replace /opt/stamposa-data/redis/dump.rdb, start redis."
    ;;
  *)
    echo "unknown mode: $MODE (want postgres or redis)" >&2
    exit 2
    ;;
esac
