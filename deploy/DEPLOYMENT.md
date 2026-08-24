# Deploying to a VPS

One server runs everything: Postgres, Redis, the API, the web app, and Caddy
(which gets and renews HTTPS certificates automatically). Total footprint fits
comfortably in 2 GB RAM.

## What you need

- A VPS running **Ubuntu 24.04** (2 GB RAM / 2 vCPU is plenty to start —
  Hetzner, DigitalOcean, Hostinger, any provider works)
- A **domain** with DNS you control
- 15 minutes

## 1. Point DNS at the server

Create three **A records** pointing at your server’s IP:

| Type | Host | Value |
|---|---|---|
| A | `@` (stamposa.com) | `<server IP>` |
| A | `www` | `<server IP>` |
| A | `api` | `<server IP>` |

On **Namecheap**: Domain List → Manage → Advanced DNS → Add New Record.
Delete the default "CNAME www → parkingpage" and the URL-redirect record
first, or they will fight these.

Do this first — HTTPS certificates can only be issued once DNS resolves.

## 2. Install Docker on the server

```bash
curl -fsSL https://get.docker.com | sh
```

## 3. Get the code onto the server

Either `git clone` your repository, or copy the folder directly from this
machine:

```bash
rsync -az --exclude node_modules --exclude .next --exclude uploads \
  "loyalty-platform/" root@<server-ip>:/opt/loyalty-platform/
```

## 4. Configure

```bash
cd /opt/loyalty-platform
cp deploy/env.production.example deploy/.env.production
nano deploy/.env.production
```

Fill in the domains, and generate real secrets:

```bash
openssl rand -hex 32   # run three times: JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, POSTGRES_PASSWORD
```

## 5. Deploy

```bash
./deploy/deploy.sh            # first run builds everything (~5 min)
./deploy/deploy.sh --seed     # use this variant if you want demo data
```

The script builds the images, applies database migrations, starts the stack,
and waits for the health check. When it finishes:

- Site + portals: `https://stamposa.com`
- API + Swagger: `https://api.stamposa.com/docs`
- Admin: `https://stamposa.com/admin/login` — sign in with
  `owner@stamposa.com` + the `SEED_ADMIN_PASSWORD` you set, then **enrol your
  authenticator when prompted and change the password**. 2FA is mandatory in
  production; the API refuses to boot without it.

## 6. Nightly backups

```bash
crontab -e
# add:
15 2 * * * /opt/loyalty-platform/deploy/backup.sh >> /var/log/loyalty-backup.log 2>&1
```

Dumps land in `~/loyalty-backups/`, kept 14 days. Test a restore once:

```bash
gunzip -c ~/loyalty-backups/loyalty-<date>.sql.gz | \
  docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production \
  exec -T postgres psql -U loyalty loyalty_platform
```

## Updating to a new version

```bash
cd /opt/loyalty-platform
git pull            # or rsync again
./deploy/deploy.sh  # rebuilds, migrates, restarts — a few seconds of downtime
```

## Useful commands

```bash
alias lc='docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production'
lc ps                 # status
lc logs -f api        # API logs (OTP codes appear here while SMS_PROVIDER=console)
lc logs -f caddy      # certificate issues show up here
lc restart api        # restart one service
```

## Known limits (deliberate, for now)

- **SMS ships in console-mode until you add MSG91 credentials** — the
  integration is built; follow `docs/SMS-SETUP.md` (MSG91 account + DLT
  registration, ~1 hour of steps + 2–4 days of operator approval), fill in
  the three `MSG91_*` vars, redeploy. Until then staff can enrol customers
  at the counter without OTPs, which carries a pilot café fine.
- **CI** (`.github/workflows/ci.yml`) activates when the repo is pushed to
  GitHub — it runs lint, unit tests, builds, and all 205 E2E assertions on
  every change.
- **Error monitoring is wired but off until you add DSNs** — create a free
  Sentry account (or self-host GlitchTip later), set `SENTRY_DSN` and
  `WEB_SENTRY_DSN`, redeploy. See `docs/MONITORING-SETUP.md`.
