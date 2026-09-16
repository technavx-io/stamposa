# Stamposa backup sidecar

Nightly Postgres + Redis snapshots, encrypted on the box, streamed to
Cloudflare R2. Restore drills use the same image, run on demand.

## What runs where

- **Container** (built from this directory): `stamposa-backup:latest` — alpine
  + `pg_dump`, `redis-cli`, `openssl`, `rclone`, `msmtp`, `crond`.
- **Schedule**: cron entry in `crontab`, daily at **03:15 IST**.
- **Storage**: Cloudflare R2 bucket `${R2_BUCKET}`. Bucket must have
  lifecycle rules on the three prefixes:
  - `daily/`   → delete after 7 days
  - `weekly/`  → delete after 28 days
  - `monthly/` → delete after 365 days
- **Encryption**: AES-256-CBC with PBKDF2 (200k iterations). Passphrase lives
  in `/opt/api-docker/.env` as `BACKUP_ENCRYPTION_PASSPHRASE`. Lose it and
  the backups are unrecoverable — keep a copy in a password manager AND
  offline.
- **Alerts**: failure emails via SMTP (`SMTP_*` env vars, same ones the API
  uses) to `ALERT_EMAIL`. If `msmtp` is not configured, failures still exit
  non-zero and land in the container log.

## First-time setup on the VPS

1. Ensure `/opt/api-docker/.env` has all seven required vars:
   `POSTGRES_PASSWORD`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
   `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `BACKUP_ENCRYPTION_PASSPHRASE`,
   and (recommended) `ALERT_EMAIL` + `SMTP_*`.
2. `cd /opt/api-docker && docker compose up -d backup` — builds the image on
   first run, then just starts the container.
3. Force one immediate run to verify end-to-end:
   `docker compose exec backup /usr/local/bin/backup.sh`
   Expect two objects in R2 under `daily/postgres-...` and `daily/redis-...`.
4. Check `docker compose logs backup` — should show `Backup OK` and the
   next cron time.

## Restore drill (recommended: monthly, on a scratch box)

To restore a Postgres backup to a **separate** database (never the live one):

```
docker compose run --rm backup \
  restore.sh postgres daily/postgres-20260908T031500Z.dump.enc loyalty_restore
```

The target DB (`loyalty_restore`) must exist. Add it first with:

```
docker compose exec postgres createdb -U loyalty loyalty_restore
```

Then verify the row counts match the source. Delete `loyalty_restore` when done.

To recover Redis: `restore.sh redis <key> /tmp/restored.rdb`, then stop the
redis container, replace `/opt/stamposa-data/redis/dump.rdb`, and start it.

## Retention & rotation

R2 lifecycle rules do the deleting. This container never runs a `rclone
delete`. That means a compromised sidecar cannot wipe history.

## Troubleshooting

- **Container won't start**: entrypoint refuses without required env; check
  logs for the missing var name.
- **`pg_dump: connection refused`**: postgres container is not up yet — the
  compose file uses `depends_on: postgres.service_healthy` so this should
  not happen after a fresh `up`. If it does, restart the backup service.
- **`rclone: 403 InvalidAccessKeyId`**: token doesn't match the bucket, or
  the token was revoked. Rotate in the Cloudflare console, update `.env`,
  restart the backup container.
- **`openssl: bad decrypt`** on restore: wrong `BACKUP_ENCRYPTION_PASSPHRASE`
  or file corrupted in transit. rclone's SHA-256 on upload should have
  caught corruption; try a different backup.
