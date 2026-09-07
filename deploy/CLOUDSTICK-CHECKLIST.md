# CloudStick deploy — step-by-step checklist

Deploy order: **API first**, then the two web slots. Everything runs as Docker
containers on your server; CloudStick's nginx puts each domain in front.

Your three slots:

| Role | Slot path | Domain | Port |
| --- | --- | --- | --- |
| API + DB | `/home/proxyuserj2f8tbdu/apps/backend-api` | api.stamposa.com | 4000 |
| Website | `/home/proxyuser8mxd72el/apps/stamposawebsite` | stamposa.com | 3000 |
| App | `/home/proxyuserdk24dtad/apps/frontend-app` | app.stamposa.com | 3001 |

---

## 0. One-time prep

**a. SSH in and confirm Docker works** (as a user that can run Docker):
```bash
docker --version && docker compose version
```
If `docker` is "permission denied", run the deploy as root or add your user to
the `docker` group: `sudo usermod -aG docker $USER` then re-login.

**b. GitHub access** — the repo is private, so cloning needs auth. Easiest is a
Personal Access Token (repo:read). You'll clone with:
```bash
git clone https://<YOUR_GITHUB_PAT>@github.com/technavx-io/stamposa.git .
```
(or set up an SSH deploy key and use the `git@github.com:...` URL).

**c. DNS** — confirm A records for `stamposa.com`, `app.stamposa.com`,
`api.stamposa.com` all point at this server's IP.

**d. Generate secrets once** (paste the SAME values into all three `.env` files):
```bash
openssl rand -hex 24   # → POSTGRES_PASSWORD
openssl rand -hex 32   # → JWT_ACCESS_SECRET
openssl rand -hex 32   # → JWT_REFRESH_SECRET   (must differ from the access one)
```
Also decide a strong `SEED_ADMIN_PASSWORD`. Keep all four somewhere safe.

---

## 1. Backend API slot  (do this first)

```bash
cd /home/proxyuserj2f8tbdu/apps/backend-api
# dir must be empty for `git clone .`; if it has placeholder files, clear them first
git clone https://<YOUR_GITHUB_PAT>@github.com/technavx-io/stamposa.git .
cd loyalty-platform
cp deploy/env.production.example deploy/.env.production
nano deploy/.env.production
```

Fill in `.env.production`:
- Domains are already correct (`SITE_DOMAIN=stamposa.com`, `APP_DOMAIN=app.stamposa.com`, `API_DOMAIN=api.stamposa.com`).
- `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `SEED_ADMIN_PASSWORD` → your generated values.
- `API_PORT=4000`, leave `WEB_PORT=3000`.
- Leave all `DODO_*` blank for now (checkout shows "contact us" until you add live keys).

Deploy:
```bash
./deploy/deploy.sh api
```
This starts Postgres + Redis, runs migrations, seeds the admin accounts, and
starts the API on `127.0.0.1:4000`. Wait for `✓ API healthy.`

**CloudStick:** open the `backend-api` app → set it to **reverse proxy** to
`http://127.0.0.1:4000` → enable SSL (Let's Encrypt) for `api.stamposa.com`.

Verify: `https://api.stamposa.com/v1/health` returns ok.

---

## 2. Website slot  →  stamposa.com

```bash
cd /home/proxyuser8mxd72el/apps/stamposawebsite
git clone https://<YOUR_GITHUB_PAT>@github.com/technavx-io/stamposa.git .
cd loyalty-platform
cp deploy/env.production.example deploy/.env.production
nano deploy/.env.production      # SAME values as slot 1, keep WEB_PORT=3000
./deploy/deploy.sh web
```
**CloudStick:** `stamposawebsite` app → reverse proxy `http://127.0.0.1:3000` →
enable SSL for `stamposa.com`.

---

## 3. App slot  →  app.stamposa.com

```bash
cd /home/proxyuserdk24dtad/apps/frontend-app
git clone https://<YOUR_GITHUB_PAT>@github.com/technavx-io/stamposa.git .
cd loyalty-platform
cp deploy/env.production.example deploy/.env.production
nano deploy/.env.production      # SAME values, but set WEB_PORT=3001
./deploy/deploy.sh web
```
**CloudStick:** `frontend-app` app → reverse proxy `http://127.0.0.1:3001` →
enable SSL for `app.stamposa.com`.

> The two web slots run the identical build; the only difference in their env
> files is `WEB_PORT` (3000 vs 3001) so the containers don't clash.

---

## 4. Verify everything

- `https://api.stamposa.com/v1/health` → ok
- `https://api.stamposa.com/v1/public/plans` → the plans list
- `https://stamposa.com/pricing` → pricing page ($9 / $19 / $39)
- `https://app.stamposa.com/admin` → admin sign-in

**Admin login:** `owner@stamposa.com` + your `SEED_ADMIN_PASSWORD` → enrol an
authenticator app (2FA is mandatory in production) → **Team** → add
`technavx@gmail.com`.

**Create your promo code:** Admin → **Promo codes** → New code → `FIRST30`,
Growth, 6 months, 30 max.

---

## 5. Every future deploy

In the slot you changed:
```bash
cd <slot-path>/loyalty-platform
./deploy/deploy.sh api     # backend-api slot   (auto-pulls, rebuilds, migrates)
./deploy/deploy.sh web     # a web slot
```

## 6. Turn on live card payments (when ready)

In the LIVE Dodo dashboard create the 6 recurring USD products + a live API key +
a webhook to `https://api.stamposa.com/v1/billing/webhook`. Put the key, webhook
secret, `DODO_ENVIRONMENT=live_mode`, and the 6 `DODO_PRODUCT_*` ids into the
**backend-api** slot's `.env.production`, then `./deploy/deploy.sh api`.

## 7. Backups

In the backend-api slot, schedule `deploy/backup.sh` via cron (nightly Postgres dump).
