#!/usr/bin/env bash
# Wire cron with the container's env, then hand off to crond in the foreground.
#
# Cron does not inherit container env; instead we materialise the vars we need
# into /etc/backup.env and source that from the cron entry.
set -euo pipefail

need() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "backup: missing required env var $name — refusing to start" >&2
    exit 1
  fi
}

need POSTGRES_PASSWORD
need R2_ACCOUNT_ID
need R2_ACCESS_KEY_ID
need R2_SECRET_ACCESS_KEY
need R2_BUCKET
need BACKUP_ENCRYPTION_PASSPHRASE

# ── rclone config for the "r2" remote ───────────────────────────────────────
mkdir -p /root/.config/rclone
cat > /root/.config/rclone/rclone.conf <<CONF
[r2]
type = s3
provider = Cloudflare
access_key_id = ${R2_ACCESS_KEY_ID}
secret_access_key = ${R2_SECRET_ACCESS_KEY}
endpoint = https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com
acl = private
no_check_bucket = true
CONF
chmod 600 /root/.config/rclone/rclone.conf

# ── Optional msmtp config for failure alerts (only if SMTP is set) ──────────
if [ -n "${SMTP_HOST:-}" ] && [ -n "${SMTP_USER:-}" ] && [ -n "${SMTP_PASS:-}" ]; then
  cat > /root/.msmtprc <<CONF
account default
host ${SMTP_HOST}
port ${SMTP_PORT:-587}
auth on
user ${SMTP_USER}
password ${SMTP_PASS}
$( [ "${SMTP_SECURE:-false}" = "true" ] && echo "tls on
tls_starttls off" || echo "tls on
tls_starttls on" )
from ${SMTP_FROM:-backup@stamposa.com}
logfile /var/log/stamposa-backup/msmtp.log
CONF
  chmod 600 /root/.msmtprc
fi

# ── Env snapshot for cron to source ─────────────────────────────────────────
{
  echo "export POSTGRES_HOST=${POSTGRES_HOST:-127.0.0.1}"
  echo "export POSTGRES_PORT=${POSTGRES_PORT:-5432}"
  echo "export POSTGRES_USER=${POSTGRES_USER:-loyalty}"
  echo "export POSTGRES_DB=${POSTGRES_DB:-loyalty_platform}"
  echo "export PGPASSWORD='${POSTGRES_PASSWORD}'"
  echo "export REDIS_HOST=${REDIS_HOST:-127.0.0.1}"
  echo "export REDIS_PORT=${REDIS_PORT:-6379}"
  echo "export R2_BUCKET=${R2_BUCKET}"
  echo "export BACKUP_ENCRYPTION_PASSPHRASE='${BACKUP_ENCRYPTION_PASSPHRASE}'"
  echo "export ALERT_EMAIL='${ALERT_EMAIL:-}'"
} > /etc/backup.env
chmod 600 /etc/backup.env

echo "backup: entrypoint ready — schedule active (see /etc/crontabs/root)"
# crond can't be PID 1 in this container (setpgid EPERM in the crash loop we
# saw on 2026-09-17). Run it as a background child of this shell and wait —
# bash stays PID 1 so crond runs as PID 2 and can setpgid its cron jobs.
crond -f -l 8 &
wait
