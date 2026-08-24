# Stamposa

A production-grade, multi-tenant SaaS loyalty platform. Live at
[stamposa.com](https://stamposa.com) (app: `app.stamposa.com`, API:
`api.stamposa.com`). Merchants
launch a stamp-card program in minutes, customers join by scanning a QR code and verifying their
phone, staff add stamps from any device, and the digital card updates live in the customer's
browser.

**Stack:** Next.js 15 (App Router) + TypeScript + Tailwind CSS 4 · NestJS 11 + Prisma 6 ·
PostgreSQL · Redis · Phone + OTP + JWT auth · Swagger docs · npm workspaces monorepo.

---

## Repository layout

```
loyalty-platform/
├── apps/
│   ├── api/                  # NestJS API (port 4000)
│   │   ├── prisma/           #   schema.prisma, migrations, seed.ts
│   │   └── src/
│   │       ├── auth/         #   OTP + JWT sessions, guards (global, secure-by-default)
│   │       ├── businesses/   #   business profile, logo upload, QR code
│   │       ├── campaigns/    #   stamp-card campaigns
│   │       ├── loyalty/      #   core domain: memberships (cards) + stamps
│   │       ├── staff-management/  # merchant manages staff accounts
│   │       ├── staff-console/     # counter surface: search + stamp
│   │       ├── customer-portal/   # join, my cards, card detail
│   │       ├── dashboard/    #   merchant overview stats
│   │       ├── public/       #   unauthenticated join-page data
│   │       ├── sms/          #   SmsProvider abstraction (console in dev)
│   │       ├── storage/      #   FileStorage abstraction (local disk in dev)
│   │       ├── qr/           #   QR generation
│   │       ├── redis/        #   client + Redis-backed rate limiting
│   │       ├── prisma/       #   PrismaService
│   │       ├── config/       #   zod-validated env
│   │       └── common/       #   filters, interceptors, pagination, utils
│   └── web/                  # Next.js app (port 3000)
│       └── src/
│           ├── app/          #   /, /merchant/**, /staff/**, /join/[slug], /card/[id], /my-cards
│           ├── components/   #   design system + feature components
│           └── lib/          #   typed API client, session stores, hooks
├── docs/ARCHITECTURE.md      # deeper design doc (tenancy, auth, decisions)
├── docker-compose.yml        # optional Postgres+Redis (ports 5433/6380)
└── package.json              # workspace root
```

## Prerequisites

- Node.js ≥ 20
- PostgreSQL running locally (Homebrew: `brew services start postgresql@16`)
  — or use `docker compose up -d` (see ports note inside docker-compose.yml)
- Redis running locally (Homebrew: `brew services start redis`)

> On this machine both are already running as Homebrew services, and the
> `loyalty_platform` database already exists, is migrated and seeded.

## Setup from scratch

```bash
cd loyalty-platform
npm install

# 1) Configure the API environment
cp apps/api/.env.example apps/api/.env
#    → set DATABASE_URL, REDIS_URL, and two `openssl rand -hex 32` JWT secrets

# 2) Configure the web environment
cp apps/web/.env.example apps/web/.env.local

# 3) Create + migrate + seed the database
createdb loyalty_platform          # skip if it exists
npm run db:migrate                 # prisma migrate dev
npm run db:seed                    # demo tenants (re-run any time to reset data)

# 4) Run both apps
npm run dev                        # api → http://localhost:4000, web → http://localhost:3000
```

- **Web app:** http://localhost:3000
- **API + Swagger docs:** http://localhost:4000/docs (root URL redirects there)
- **Health check:** http://localhost:4000/v1/health

## Development OTP mode

No SMS gateway is wired in development. OTP codes are:

1. printed in the API console (`SMS → +91…: 123456 is your Stamposa verification code…`), and
2. returned in the API response and shown as a tappable amber hint in the UI
   (`OTP_DEV_EXPOSE=true`; hard-disabled in production builds).

Production SMS is already wired for **MSG91** (India's DLT-compliant route):
set `SMS_PROVIDER=msg91` plus three credentials and real texts flow — see
[docs/SMS-SETUP.md](docs/SMS-SETUP.md). Other gateways are one adapter file
(`apps/api/src/sms/`).

## Demo accounts (after `npm run db:seed`)

| Role | Phone | Where |
|---|---|---|
| Merchant — Brew & Bean Coffee | `+91 98765 00001` | http://localhost:3000/merchant/login |
| Staff — Brew & Bean (Ravi) | `+91 98765 00002` | http://localhost:3000/staff/login |
| Staff — Brew & Bean (Meera) | `+91 98765 00003` | http://localhost:3000/staff/login |
| Merchant — Glow Salon (2nd tenant) | `+91 98765 00004` | http://localhost:3000/merchant/login |
| Customers (8 with history) | `+91 98765 01101 … 01108` | http://localhost:3000/my-cards |

**Platform admins** sign in with email + password at http://localhost:3000/admin/login
(override the password with `SEED_ADMIN_PASSWORD` before seeding):

| Admin | Email | Password | Role |
|---|---|---|---|
| Platform Owner | `owner@stamposa.com` | `ChangeMe!2026` | Super admin — everything |
| Ops Admin | `ops@stamposa.com` | `ChangeMe!2026` | Merchants, suspension, impersonation |
| Support Agent | `support@stamposa.com` | `ChangeMe!2026` | Read + lookup + impersonation |

**Two-factor is controlled by `ADMIN_REQUIRE_2FA` in `apps/api/.env`:**

- `false` *(current local default)* — sign in with just email and password. Convenient while
  developing. Each sign-in is still recorded, annotated "Two-factor disabled by configuration",
  so the weakened state is visible in the audit trail rather than silent.
- `true` — on first sign-in each admin is walked through authenticator setup (scan the QR with
  any authenticator app, save the eight single-use recovery codes); every later sign-in asks for
  a code.

The API **refuses to start** with `ADMIN_REQUIRE_2FA=false` and `NODE_ENV=production`. Admin
accounts can read every tenant's customer data, suspend businesses and impersonate merchants, so
a password-only admin in production would make one leaked credential a full platform compromise.

> Changing this value needs an API restart — `.env` is read at boot, and watch mode only reloads
> code.

The customer join page for the seeded café: http://localhost:3000/join/brew-and-bean

Any *new* phone number registers a fresh merchant or customer — the three portals use separate
browser sessions, so you can play merchant, staff and customer side by side in one browser.

## Deploying to production

The whole stack ships as a Docker deployment kit for a single VPS — Postgres,
Redis, API, web and automatic HTTPS. See **[deploy/DEPLOYMENT.md](deploy/DEPLOYMENT.md)**;
the short version is: point two DNS records at the server, fill in
`deploy/.env.production`, run `./deploy/deploy.sh`. Nightly backups and a CI
workflow (lint + unit + builds + 196 E2E assertions) are included.

## Phase 1 feature map

| # | Feature | Where |
|---|---|---|
| 1 | Merchant registration & login (phone + OTP) | `/merchant/login` |
| 2 | Business profile (name, logo, address, phone) | onboarding wizard + `/merchant/settings` |
| 3 | Dashboard with overview cards | `/merchant/dashboard` (stats, live activity, setup checklist) |
| 4 | Loyalty campaign (e.g. buy 10 get 1) | onboarding + `/merchant/campaign` (pause/resume/edit) |
| 5 | QR code for customer registration | `/merchant/qr` (copy link, download PNG, printable standee) |
| 6 | Customer registration via phone + OTP | `/join/[slug]` |
| 7 | Unique customer ID | 8-char unambiguous code, shown as `XXXX-XXXX` |
| 8 | Digital loyalty card in the browser | `/card/[id]` + scannable QR |
| 9 | Staff login | `/staff/login` (accounts created by the merchant) |
| 10 | Staff search + add one stamp | `/staff` console (phone / code / name search) |
| 11 | Customer stamp count updates immediately | card polls every 4 s; toast + animation on change |
| 12 | Customer list & stamp history | `/merchant/customers` (+ per-customer history, owner stamping) |
| 13 | **Reward redemption** (added after Phase 1) | see below |
| 14 | **Consent capture** at enrolment | unticked by default; wording, version and IP recorded |
| 15 | **Merchant analytics, ledger, CRM and exports** | see below |
| 16 | **Platform admin panel** | see below |
| 17 | **Counter upgrades** (scan, enrol, undo, roles) | see below |
| 18 | **Apple & Google Wallet passes** (Phase 2) | see below |

### Reward redemption

Completing a card mints a **voucher** — a `Redemption` row with its own unique code and the
reward text snapshotted at earn time (so later campaign edits never rewrite history).

- **Customer** (`/card/[id]`): a "Reward ready to claim" panel with the voucher code to show at
  the counter; it disappears live when staff hand the reward over.
- **Staff** (`/staff`): pending rewards appear on the search result with a **Redeem** button;
  a typed confirmation dialog prevents accidental taps; redeeming by voucher code is also
  supported by the API.
- **Merchant** (`/merchant/rewards`): every voucher, filterable by Waiting / Handed over / All,
  searchable by name, phone or code, showing **who** honoured each one and **when**. The owner
  can hand one over directly (also from the customer detail page).
- **Dashboard**: a "Rewards waiting" card and redemption events in the live activity feed.

Redeeming is race-safe (a conditional status flip, so two staff can never both redeem the same
voucher) and voucher minting happens inside the stamp transaction, so an earned reward can never
exist without one.

### The merchant panel

Beyond the basics, the merchant portal now covers the full operating loop:

| Screen | What it does |
|---|---|
| Dashboard | Today's numbers, live activity, rewards waiting, setup checklist |
| Campaign | Stamp rules, reward, **daily stamp cap** (fraud rail), terms, pause/resume |
| Customers | Search, then per-customer: notes, tags, **balance adjustment with a mandatory reason**, block/unblock, consent history |
| Rewards | Every voucher earned — waiting or handed over, by whom and when |
| Transactions | The full ledger: stamps and corrections, filterable by type or person, with CSV export |
| Analytics | 7/30/90-day ranges, daily chart, change vs previous period, repeat rate, most-loyal list, per-staff activity |
| QR code | Join link, downloadable PNG, printable standee |
| Staff | Add, deactivate, per-person stamp counts |
| Settings | Profile · **timezone** · **brand colour** with live card preview · logo · consent wording · notification preferences · danger zone with exports |

Three details worth knowing:

- **Balance adjustments are ledger entries, never field edits.** A correction records who made it,
  by how much and why, and shows up in the customer's own history — so a disputed balance can
  always be explained.
- **"Today" respects the business timezone**, so a café closing at 1am doesn't see its night
  split across two days.
- **CSV export is free on every plan** — customers, transactions and rewards. A merchant's
  customer list is their asset, not a retention lever.

### The staff console (counter upgrades)

The console is built for one-handed use at a busy till:

- **Camera QR scanning** — every customer card shows a QR of its code; staff tap "Scan card
  QR" and point the phone at it. Uses the browser's native BarcodeDetector where available
  (Chrome/Android) and a pure-JS decoder (jsQR) everywhere else, so iPhones work too.
- **Enrol at the counter** — staff type the customer's phone and they're in, no OTP dance
  in the queue. The customer proves the phone is theirs whenever they first log in; a
  first stamp can be added in the same motion. Marketing consent is only recorded if the
  customer explicitly agreed (stored with channel `counter`).
- **60-second undo** — the "oops" button. Staff can take back their own most recent stamp
  for a minute; **managers** can take back anyone's within 15 minutes. Undo never deletes:
  the original entry is marked undone and a −1 reversal is appended, so the ledger keeps
  telling the truth. If the stamp had completed a card, its voucher is voided — unless the
  reward was already handed over, in which case the undo is refused.
- **Manager role** — set per staff member on the merchant's Staff page. Managers see the
  whole counter's day (total stamps, new customers, rewards, per-person chips); everyone
  sees their own numbers.

### Wallet passes (Phase 2)

Every card can be added to **Apple Wallet** (signed `.pkpass`) and **Google
Wallet** (signed save-link) — and the passes stay live: each stamp, undo,
adjustment or redemption updates the pass (APNs push for Apple, object PATCH
for Google). The pass QR is the customer code, so the staff scanner reads
wallet passes exactly like the web card.

The integration activates per wallet when platform credentials are configured
— see [docs/WALLET-SETUP.md](docs/WALLET-SETUP.md). In development,
`apps/api/test/make-wallet-fixtures.sh` generates self-signed stand-ins so
the whole pipeline (signing included) runs and is smoke-tested locally.

### The admin panel (platform operator console)

A separate surface at `/admin` for the people running the platform — dark rail, data-dense
tables, deliberately unlike the merchant portal so the two are never confused.

| Screen | What it does |
|---|---|
| Sign in | Email + password, then a mandatory authenticator code. Recovery codes for lost devices. |
| Dashboard | **Attention queue first** — churn signals, stalled setups, suspensions, system alerts — then platform metrics and recent activity. |
| Merchants | Every tenant, filterable by Active / Gone quiet / Setup stalled / Suspended, searchable by business, owner or phone, each with an A–D health grade. |
| Merchant detail | Health with reasoning, metrics, programme, staff, customers (codes only), operator notes, and the account's full admin history. |
| Customer lookup | Exact phone only, reason mandatory, every attempt logged. For privacy requests — deliberately impossible to browse. |
| Audit log | Append-only trail of every sensitive action, filterable by type, with actor, reason, target and IP. |
| Team | Platform staff: invite with a one-time password, change roles, deactivate (kills sessions instantly), force sign-out. |
| System health | Live dependency status and platform counters. |

**Suspension** is enforced everywhere at once: the owner and their staff are signed out
mid-session, cannot sign back in, and the public join page stops accepting customers.
**Impersonation** requires a reason of at least eight characters, lasts 30 minutes, and is
written to the audit log *before* the token is issued — an unlogged impersonation is impossible.

Roles gate what each admin can reach: super admins manage the team, ops can suspend, support can
look up customers and impersonate, finance and analysts are read-only. The UI hides what a role
cannot do and the API enforces it regardless.

## Commands

| Command (repo root) | What it does |
|---|---|
| `npm run dev` | API + web concurrently |
| `npm run dev:api` / `npm run dev:web` | one app only |
| `npm run build` | production builds of both apps |
| `npm test` | API unit tests (Jest) |
| `npm run db:migrate` / `db:seed` / `db:studio` | Prisma workflows |

## Security posture (Phase 1)

- Every route is authenticated by default (global guard); public endpoints are explicitly
  `@Public()`.
- Tenant isolation: every tenant query is scoped by a `businessId` derived **only** from the
  authenticated actor — never from client input. Cross-tenant access returns 404.
- OTPs: 6-digit, peppered-hash stored in Redis (5 min TTL), 5 verify attempts, 60 s resend
  cooldown, 5 sends/hour/phone, plus IP rate limiting (Redis-backed, multi-instance safe).
- JWTs: 15 min access tokens; 30 day refresh tokens with per-session `jti` in Redis —
  rotated on every refresh, individually revocable, instant logout.
- Stamps: atomic conditional updates (no double-reward under concurrency) + 3 s double-tap
  guard; immutable stamp audit trail.
- Redemptions: vouchers minted inside the stamp transaction; conditional status flip makes
  double-redemption impossible; who/when recorded permanently.
- Uploads: type + size validated, random filenames, path-traversal-safe deletes.
- Known trade-off: web tokens live in `localStorage` so one browser can hold all three roles
  (great for counters and demos). Phase 2 hardening: httpOnly cookie sessions. See
  [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Roadmap hooks (why the code is shaped this way)

- **Wallet passes (Phase 2):** the card page isolates card rendering; memberships already
  carry everything a pass needs. Add a `passes/` module + Apple/Google adapters.
- **Multi-location / multi-campaign:** schema is 1-N ready (`Business.merchantId` unique
  constraint and the one-live-campaign rule are Phase 1 service-level limits, not schema limits).
- **WhatsApp/SMS campaigns:** `SmsProvider` port already exists; customer phones are E.164.
- **Billing/analytics/AI:** stamps are an immutable event log — aggregate freely.
- **S3 storage:** implement `FileStorage` and swap the provider in `StorageModule`.
