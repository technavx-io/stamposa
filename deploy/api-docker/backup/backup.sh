#!/usr/bin/env bash
# Nightly Postgres + Redis backup → encrypted → uploaded to Cloudflare R2.
#
# Everything streams: pg_dump | openssl enc | rclone rcat. No plaintext dump
# ever touches container disk, so a compromise of the container filesystem
# still cannot read the backup. The encryption passphrase is required to
# read anything back.
#
# Prefix rotation matches R2 lifecycle rules (configured in the Cloudflare
# console):
#   monthly/  1st of the month   → keep 365 days
#   weekly/   Sunday             → keep 28 days
#   daily/    everything else    → keep 7 days
set -euo pipefail

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DOM="$(date -u +%d)"    # day of month, 01–31
DOW="$(date -u +%u)"    # day of week, 1=Mon … 7=Sun

if   [ "$DOM" = "01" ]; then PREFIX="monthly"
elif [ "$DOW" = "7"  ]; then PREFIX="weekly"
else                          PREFIX="daily"
fi

log()  { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }
fail() {
  local subject="[Stamposa] Backup FAILED — $*"
  log "FAIL: $*"
  if [ -n "${ALERT_EMAIL:-}" ] && command -v msmtp >/dev/null 2>&1 && [ -f /root/.msmtprc ]; then
    { printf 'Subject: %s\nTo: %s\n\n' "$subject" "$ALERT_EMAIL"
      printf 'Backup on stamposa-api box failed at %s UTC.\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
      printf 'Reason: %s\n\nLast 30 log lines:\n' "$*"
      tail -n 30 /var/log/stamposa-backup/backup.log 2>/dev/null || true
    } | msmtp "$ALERT_EMAIL" || log "msmtp send failed"
  fi
  exit 1
}

trap 'fail "aborted at line $LINENO"' ERR

log "── Backup start (prefix=$PREFIX, stamp=$STAMP) ──"

# ── Postgres ────────────────────────────────────────────────────────────────
PG_KEY="${PREFIX}/postgres-${STAMP}.dump.enc"
log "pg_dump → openssl → r2:${R2_BUCKET}/${PG_KEY}"
pg_dump \
  -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" \
  -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  --format=custom --no-owner --no-privileges --compress=9 \
| openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
    -pass env:BACKUP_ENCRYPTION_PASSPHRASE \
| rclone rcat --config /root/.config/rclone/rclone.conf \
    "r2:${R2_BUCKET}/${PG_KEY}" \
  || fail "postgres dump/upload"

# ── Redis (live RDB stream) ─────────────────────────────────────────────────
REDIS_KEY="${PREFIX}/redis-${STAMP}.rdb.enc"
log "redis-cli --rdb - → openssl → r2:${R2_BUCKET}/${REDIS_KEY}"
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" --rdb - 2>/dev/null \
| openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
    -pass env:BACKUP_ENCRYPTION_PASSPHRASE \
| rclone rcat --config /root/.config/rclone/rclone.conf \
    "r2:${R2_BUCKET}/${REDIS_KEY}" \
  || fail "redis dump/upload"

# ── Success marker (read by healthcheck + human) ────────────────────────────
date -u +%Y-%m-%dT%H:%M:%SZ > /var/log/stamposa-backup/last-success

log "── Backup OK (${PG_KEY}, ${REDIS_KEY}) ──"
