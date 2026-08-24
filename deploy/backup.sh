#!/bin/bash
# Nightly Postgres backup with 14-day rotation.
# Install:  crontab -e   →   15 2 * * * /path/to/loyalty-platform/deploy/backup.sh
set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE=(docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production)
BACKUP_DIR="${BACKUP_DIR:-$HOME/loyalty-backups}"
KEEP_DAYS=14

mkdir -p "$BACKUP_DIR"
STAMP=$(date +%F-%H%M)
FILE="$BACKUP_DIR/loyalty-$STAMP.sql.gz"

"${COMPOSE[@]}" exec -T postgres pg_dump -U loyalty loyalty_platform | gzip > "$FILE"

# Also snapshot uploaded logos alongside the database.
"${COMPOSE[@]}" cp api:/repo/apps/api/uploads "$BACKUP_DIR/uploads-latest" >/dev/null 2>&1 || true

find "$BACKUP_DIR" -name 'loyalty-*.sql.gz' -mtime +$KEEP_DAYS -delete
echo "✓ $FILE ($(du -h "$FILE" | cut -f1))"
