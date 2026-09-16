# Stamposa staging (middle-path)

A second, ephemeral copy of the whole stack on the SAME VPS, on different
ports and behind three `staging.*` subdomains. Reuses the production API
Docker image; only the two Next apps get a second build because they bake
`NEXT_PUBLIC_*` URLs at build time.

## What lives where

|                 | Prod                         | Staging                            |
| --------------- | ---------------------------- | ---------------------------------- |
| website URL     | `https://stamposa.com`       | `https://staging.stamposa.com`     |
| app URL         | `https://app.stamposa.com`   | `https://app-staging.stamposa.com` |
| api URL         | `https://api.stamposa.com`   | `https://api-staging.stamposa.com` |
| website port    | 127.0.0.1:3000               | 127.0.0.1:3010                     |
| app port        | 127.0.0.1:3001               | 127.0.0.1:3011                     |
| api port        | 127.0.0.1:4000               | 127.0.0.1:4001                     |
| Postgres port   | 127.0.0.1:5432               | 127.0.0.1:5433                     |
| Redis port      | 127.0.0.1:6379               | 127.0.0.1:6380                     |
| data dir        | `/opt/stamposa-data/`        | `/opt/stamposa-data-staging/`      |
| compose project | `stamposa-api`, `stamposa-web` | `stamposa-api-staging`, `stamposa-web-staging` |
| env file        | `/opt/api-docker/.env`       | `/opt/staging/.env`                |

Staging runs the SAME `stamposa-api:latest` image as prod. The env vars are
what makes it staging.

## Ephemeral, not always-on

The VPS has 2 GB RAM. Staging up + prod up together is tight. Bring staging
up only when you're about to test something, tear it down after.

```
# Bring up
cd /opt/staging && docker compose -f api-compose.yml -f web-compose.yml up -d

# Tear down (keeps data volumes)
docker compose -f api-compose.yml -f web-compose.yml down

# Tear down and WIPE staging data (start fresh next time)
docker compose -f api-compose.yml -f web-compose.yml down -v
rm -rf /opt/stamposa-data-staging
```

## One-time setup

### 1. DNS (Cloudflare or your DNS provider)

Add three A records pointing to the VPS (`192.210.152.199`):

```
staging.stamposa.com       A  192.210.152.199
app-staging.stamposa.com   A  192.210.152.199
api-staging.stamposa.com   A  192.210.152.199
```

### 2. Nginx sites (CloudStick UI)

Create three sites in the CloudStick panel:

- `staging.stamposa.com`  → proxy pass `http://127.0.0.1:3010`
- `app-staging.stamposa.com` → proxy pass `http://127.0.0.1:3011`
- `api-staging.stamposa.com` → proxy pass `http://127.0.0.1:4001`

Enable Let's Encrypt for each site (CloudStick handles renewal).

### 3. Directory + env

On the VPS:

```
mkdir -p /opt/staging /opt/stamposa-data-staging/{postgres,redis,uploads}
```

Copy the two compose files and the two Dockerfiles from
`deploy/staging/` into `/opt/staging/` (any way you like — the repo,
scp, git checkout).

Copy `.env.example` to `/opt/staging/.env` and fill in staging secrets. **Do
NOT reuse prod JWT secrets.** Generate fresh ones:

```
openssl rand -hex 32     # JWT_ACCESS_SECRET
openssl rand -hex 32     # JWT_REFRESH_SECRET
openssl rand -base64 24  # POSTGRES_PASSWORD
```

### 4. Build the staging bundles on your Mac

The two Next apps must be rebuilt for staging because URLs are baked in:

```
STAGE=staging bash loyalty-platform/deploy/build-bundles.sh
```

That produces `stamposa-web-docker-staging.tar.gz` (only — no api tarball,
staging reuses the prod api image already on the VPS).

### 5. Ship the web bundle

```
scp loyalty-platform/deploy/stamposa-web-docker-staging.tar.gz root@192.210.152.199:/opt/
ssh root@192.210.152.199
tar xzf /opt/stamposa-web-docker-staging.tar.gz -C /opt/staging
```

That unpacks the `website/` and `frontend/` subdirs alongside the two
Dockerfiles.

### 6. First bring-up

```
cd /opt/staging
docker compose -f api-compose.yml -f web-compose.yml up -d --build
docker compose -f api-compose.yml exec api npx prisma migrate deploy
docker compose logs -f api    # watch startup
```

Verify:

```
curl -s https://api-staging.stamposa.com/v1/health
curl -s https://staging.stamposa.com/version
curl -s https://app-staging.stamposa.com/version
```

## Refreshing staging data from prod

Staging starts empty. To make it useful, restore the most recent daily
Postgres backup from R2:

```
cd /opt/staging
bash refresh-from-prod.sh
```

That script:
1. Finds the newest `daily/postgres-*.dump.enc` in R2.
2. Uses the prod-side `backup` sidecar image (already on the VPS) to
   decrypt and `pg_restore` into the staging Postgres.
3. Does **not** touch Redis (staging can start with an empty Redis; sessions
   are ephemeral anyway).

⚠️ **Data warning:** the restored data contains real merchants, real
customers, real phone numbers, real emails. Anonymization is TODO. Until
that lands, staging is at the same trust level as prod — do not give access
to anyone who shouldn't see prod data.

## Testing the risky migrations (1.3, 1.4)

Recommended flow for either:

1. Bring staging up.
2. Refresh staging data from the latest prod backup.
3. Deploy the change to staging (rebuild + `docker compose up -d --build`).
4. For 1.3 (RLS + append-only): run `prisma migrate deploy`, then poke
   every controller path (add stamp, redeem, admin impersonate, wallet
   pass, customer join). Watch API logs for `permission denied` errors.
5. For 1.4 (cookie auth): drive the real staging URLs from Safari, Chrome,
   and mobile Safari. Check every login/refresh/logout flow. Verify the
   cookie is `HttpOnly; Secure; SameSite=Strict; Domain=.stamposa.com`
   (leading dot lets `app-staging` share it with `api-staging`).
6. Only ship to prod after 24 hours of green staging.

## Costs

- No new servers.
- ~500 MB RAM while running.
- ~1 GB disk for the two Next bundles + staging data volumes.
- Zero when torn down.

## Troubleshooting

- **Staging api can't reach Postgres**: staging pg listens on 5433. Ensure
  `DATABASE_URL` in `/opt/staging/.env` says `127.0.0.1:5433`, not `:5432`.
- **Nginx 502 on staging.stamposa.com**: the container isn't up. Check
  `docker compose ps` inside `/opt/staging`.
- **`docker compose up` conflicts**: something is already on port 3010 or
  4001. `ss -ltnp | grep -E ':30(1[01]|00)|:400[01]|:543[23]|:637[89]|:638[01]'`
- **Prod goes red when staging is up**: RAM contention. Tear staging down
  (`docker compose down`) and investigate the memory hog before retrying.
