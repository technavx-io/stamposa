# Stamposa — production deployment (CloudStick, self-hosted Docker)

The **one and only** production method. No Netlify, no Render, no Neon — the
whole platform (including its Postgres database) runs in Docker on your
CloudStick server.

## Architecture

Three subdomains, three CloudStick app slots, all on one server:

| CloudStick slot     | Domain              | Runs                        | Localhost port |
| ------------------- | ------------------- | --------------------------- | -------------- |
| `backend-api`       | `api.stamposa.com`  | API + **Postgres + Redis**  | `API_PORT` (4000) |
| `frontend-app`      | `app.stamposa.com`  | web (Next.js) container     | `WEB_PORT` (e.g. 3001) |
| `stamposawebsite`   | `stamposa.com`      | web (Next.js) container     | `WEB_PORT` (e.g. 3000) |

- **The web app is one build.** `stamposa.com` and `app.stamposa.com` run the
  same image; the Next.js middleware serves the marketing site on the first host
  and the merchant/staff/admin/customer portals on the second. Deploy the same
  `web` container in both web slots (different `WEB_PORT` each).
- **CloudStick's nginx terminates HTTPS** and reverse-proxies each domain to the
  container's localhost port. The containers never bind public ports.
- **Your database lives here** — a Postgres container in the `backend-api` slot,
  volume-backed (`pgdata`). Nothing goes to Neon.

## Prerequisites (you said these are ready)

- Docker + docker compose v2 on the server.
- DNS A records → the server for `stamposa.com`, `app.stamposa.com`, `api.stamposa.com`.
- The three CloudStick app slots created (paths under each `proxyuser` home).

## One-time setup — per slot

In **each** slot's app path, clone the repo and create the env file:

```bash
# backend-api slot: /home/proxyuserj2f8tbdu/apps/backend-api
# frontend-app slot: /home/proxyuserdk24dtad/apps/frontend-app
# website slot:      /home/proxyuser8mxd72el/apps/stamposawebsite
git clone https://github.com/technavx-io/stamposa.git .
cd loyalty-platform
cp deploy/env.production.example deploy/.env.production
# Fill it in (same values in every slot EXCEPT WEB_PORT — see below).
```

Fill `deploy/.env.production`:
- `SITE_DOMAIN=stamposa.com`, `APP_DOMAIN=app.stamposa.com`, `API_DOMAIN=api.stamposa.com` (same everywhere).
- `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `SEED_ADMIN_PASSWORD` (same everywhere — the web slots ignore the DB ones, but keeping one file identical avoids drift).
- **Ports:** `API_PORT=4000` (backend slot); `WEB_PORT` **different in each web slot** — e.g. `3000` in `stamposawebsite`, `3001` in `frontend-app`.
- Billing: leave `DODO_API_KEY` blank for now (checkout shows a "contact us" CTA); fill LIVE Dodo values later (see `docs/BILLING-SETUP.md`).

## Deploy

**Backend API slot** (`backend-api`):
```bash
./deploy/deploy.sh api          # add --seed ONLY on a brand-new empty DB
```
This builds the API, starts Postgres + Redis, runs migrations, seeds the admin
accounts, and starts the API on `127.0.0.1:$API_PORT`.

**Each web slot** (`stamposawebsite`, then `frontend-app`):
```bash
./deploy/deploy.sh web
```
Builds and starts the web container on `127.0.0.1:$WEB_PORT`.

## Wire the domains in CloudStick

For each app slot, set its site to **reverse-proxy** to the localhost port, and
let CloudStick issue the SSL certificate:

| Domain             | Reverse-proxy target      |
| ------------------ | ------------------------- |
| `api.stamposa.com` | `http://127.0.0.1:4000`   |
| `app.stamposa.com` | `http://127.0.0.1:3001`   |
| `stamposa.com`     | `http://127.0.0.1:3000`   |

(If CloudStick expects a raw nginx `location`, it's just:
`proxy_pass http://127.0.0.1:PORT;` with the usual `proxy_set_header Host $host;`
and `X-Forwarded-*` headers.)

## Verify

- `https://api.stamposa.com/v1/health` → ok
- `https://api.stamposa.com/v1/public/plans` → the plan list
- `https://stamposa.com/pricing` → pricing page
- `https://app.stamposa.com/admin` → admin sign-in

## Admin sign-in

- URL: **`https://app.stamposa.com/admin`**
- Seeded account: `owner@stamposa.com`, password = `SEED_ADMIN_PASSWORD`.
- 2FA is mandatory in production — you enrol an authenticator app on first login.
- Add more admins (e.g. `technavx@gmail.com`) from **Admin → Team**.

## Every future deploy

Just re-run the script in the relevant slot(s) — it pulls latest, rebuilds, and
restarts. Migrations run automatically for the API:

```bash
cd <slot>/loyalty-platform && ./deploy/deploy.sh api   # or web
```

## Turning on live payments (later)

1. In the LIVE Dodo dashboard: create the 6 recurring USD products, a live API
   key, and a webhook → `https://api.stamposa.com/v1/billing/webhook`.
2. Put `DODO_ENVIRONMENT=live_mode`, `DODO_API_KEY`, `DODO_WEBHOOK_SECRET`, and
   the 6 `DODO_PRODUCT_*` ids in the **backend-api** slot's `.env.production`.
3. `./deploy/deploy.sh api` to restart with billing enabled.

## Backups

`deploy/backup.sh` dumps the Postgres volume — schedule it via cron on the server.
