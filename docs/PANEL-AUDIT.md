# Panel Audit — Dashboard Completion Phase

**Date:** 2026-08-05 · **Audited against:** the actual source code (38 API endpoints, 15 web pages, 7 DB models — every file verified) and the product's own specifications (`spec/01–10` + `02-PRODUCT-SPEC.md`).

> **Progress since this audit was written** (all 2026-08-05, scores below predate both):
>
> 1. ✅ **Reward redemption, end-to-end** — `Redemption` model + 3 endpoints, staff redeem flow,
>    merchant Rewards page, customer voucher display, dashboard stats. 63 E2E assertions.
> 2. ✅ **Admin panel (Minimum Viable Admin)** — admin auth with TOTP (configurable), audit log,
>    merchant management with suspension and impersonation, customer lookup, platform team with
>    role capabilities, system health. 8 screens, 20 endpoints, 57–64 E2E assertions.
> 3. ✅ **Merchant panel completion** — analytics with date ranges and charts, the transactions
>    ledger, customer CRM (notes, tags, reason-logged balance adjustments, block), consent
>    capture at enrolment, CSV exports, brand colour, timezone, daily stamp cap, terms,
>    notification preferences and a danger zone. 98 E2E assertions.
>
> 4. ✅ **Staff panel completion** — camera QR scanning (card QR + BarcodeDetector/jsQR
>    scanner), counter enrolment by phone, 60-second undo (15 min for managers) with
>    ledger-true reversals and voucher voiding, STAFF/MANAGER roles, and a today strip
>    with team stats for managers. 132 E2E assertions.
> 5. ✅ **Production-readiness round** — impersonation banner (with token-clamped 30-min
>    sessions enforced server-side), DPDP/GDPR customer erasure (SUPER_ADMIN-only, typed
>    confirmation, anonymised ledger), and a complete VPS deployment kit (Docker images,
>    compose stack with automatic HTTPS via Caddy, deploy/backup scripts, CI workflow,
>    runbook in deploy/DEPLOYMENT.md). 196 total E2E assertions.
>
> 6. ✅ **Phase 2: Apple & Google Wallet passes** — signed .pkpass with Apple's full pass
>    web service + APNs live updates, Google LoyaltyClass/Object with signed save links
>    and REST-pushed updates, credential-gated activation, dev fixtures exercising the
>    entire signing pipeline in tests. 141 tenant + 64 admin E2E assertions, 31 unit tests.
>
> That closes recommendation items 1, 2, 3, 4, 5 and 6 from §11, both audit partials
> (impersonation banner, erasure workflow), AND the Phase 2 wallet integration.
> 7. ✅ **MSG91 SMS** (2026-08-18) — DLT-compliant Flow API adapter, boot-validated
>    config, cooldown rollback on gateway failure. Activates on 3 env vars.
> 8. ✅ **Error monitoring** (2026-08-18) — Sentry in both apps, DSN-gated: API 5xx with
>    request context (PII scrubbed), background wallet/audit failures, browser crashes
>    with a recovery boundary. Activates on 2 env vars.
>
> Everything buildable is now built. Remaining are user signups that become pure
> config: MSG91 account + DLT approval, VPS + domain, Apple Developer, Google Wallet
> issuer, Sentry account. Billing stays deferred by explicit decision.

Two scoring baselines are used throughout, because "complete" is meaningless without a denominator:

- **MVP baseline** — the "ship exactly this, nothing else" cut line from `02-PRODUCT-SPEC §4`. This is the launch bar.
- **Full-spec baseline** — the complete vision in `spec/` (31 admin pages, 15 merchant areas, 40 DB tables). This is the multi-year bar.

Wallet passes (Apple/Google) were excluded from the original denominators per direction — since **shipped** (2026-08-18) as Phase 2.

---

## 0. Headline numbers

| Surface | vs MVP cut line | vs full spec | Verdict |
|---|---|---|---|
| Merchant Panel | **~59%** | ~28% | Strong skeleton; missing money features (redemption, billing, export) |
| Staff Access | **~42% → 100%** | ~30% → ~70% | Complete: stamp, redeem, scan, enrol, undo, roles, today stats |
| Customer surface | **~75%** | ~35% | Solid; consent capture is the legal gap |
| Master Admin Panel | **0%** | 0% (0/31 pages) | Does not exist — no code, no tables, no auth |
| Platform foundations | ~75% | ~40% | Tenancy/ledger/auth solid; audit log, outbox, RLS, CI missing |
| **Overall (this phase's goal)** | **~43%** | ~18% | |

Method: feature rows scored ✅=1, 🟡=0.5, ❌=0 against each baseline's checklist (tables below).

---

## 1. What exists today (verified from source)

**Fully functional, end-to-end (API + UI + tests where noted):**
- Phone+OTP auth for 3 roles with registration, refresh rotation, revocation (11 endpoints; unit + E2E tested)
- Multi-tenant isolation, service-layer scoped, E2E-probed (cross-tenant → 404)
- Business profile CRUD + logo upload/removal (local storage, S3-swappable port)
- Single stamp campaign: create/edit/pause/resume (+ archive via API), single-live-campaign rule
- QR join link: data-URL + PNG download + printable standee page
- Customer join via slug (idempotent, unique 8-char code), digital card with 4s live polling
- Staff console: search (phone/code/name), add stamp (atomic, reward-completing, 3s guard)
- Merchant customers: list/search/paginate, detail, stamp history, owner-issued stamps
- Dashboard: 4 KPI cards, live activity feed, setup checklist, campaign snapshot
- Staff management: add, activate/deactivate (instant lockout), stamps-issued count
- Swagger docs, stable error codes, Redis rate limiting, health endpoint, seeds

**Backend-only (API exists, no UI):** staff rename (`PATCH /merchant/staff/:id` name), campaign archive status, campaign detail endpoint, QR size parameter.

**UI-only (no backend):** Apple/Google Wallet buttons (intentional placeholders — next phase).

**Deviations from spec (decisions to ratify, not bugs):**
1. **Merchant auth is phone+OTP** (per the Phase 1 prompt); spec 02/06 says email/password+Google. Recommendation: keep OTP (built, tested, market-appropriate), add email as recovery channel later.
2. **Staff auth is phone+OTP**, not PIN-based scanner sessions (spec 06 §10). OTP is fine for login; the spec's *PIN-for-redemption* idea is worth adopting as the approval step when redemption ships.
3. Reward is a **text on the campaign**, not a Rewards entity — adequate for stamping, blocks redemption tracking.

---

## 2. Master Admin Panel audit

**Nothing exists.** No admin routes, no admin app, no `platform_admins` table, no admin auth. 0 of the 31 specced pages.

Because the full 31-page spec is a multi-quarter build, this audit defines a **Minimum Viable Admin (MVA)** — the smallest panel that lets you actually operate the SaaS — and scores against it:

| # | MVA Feature | Status | Notes |
|---|---|---|---|
| 1 | Admin auth (email+password, TOTP 2FA, sessions) | ✅ Complete | Mandatory 2FA, recovery codes, lockout, timing-safe unknown emails |
| 2 | Admin dashboard (KPIs: merchants, stamps/wk, activation) | ✅ Complete | Attention queue first, then metrics with trend |
| 3 | Merchant management (list, search, detail, edit) | ✅ Complete | 5 filters, A–D health grades, operator notes |
| 4 | Suspend / reactivate merchant (typed confirm, reason) | ✅ Complete | Enforced in OTP path, auth guard and public join |
| 5 | Impersonation (reason, TTL, banner, double audit) | ✅ Complete | Banner with live countdown; tokens clamped to the 30-min session and killed server-side on early end |
| 6 | Audit log (write path + viewer) | ✅ Complete | Append-only, filterable, masks PII in entries |
| 7 | Platform admin staff mgmt (invite, roles, deactivate) | ✅ Complete | 5 roles, capability map, session revocation, last-super-admin guard |
| 8 | Plans & subscriptions view | ❌ Missing | Blocked on payment provider choice |
| 9 | End-customer lookup + erasure workflow (DPDP/GDPR) | ✅ Complete | Erase = anonymise identity, wipe notes/tags, block cards, revoke sessions, strip consent IPs; SUPER_ADMIN + typed confirm |
| 10 | System health page (DB/Redis/queues) | ✅ Complete | Live status + platform counters |

**Score: 9 complete, 0 partial, 1 missing (billing — deferred by decision) → 90%; 9/9 of everything not blocked on the payment provider.**
Deferred-by-design from full spec (fine to postpone past this phase): revenue waterfall, dunning, coupons, taxes, CMS, feature flags, referrals oversight, integrations, wallet/QR ops pages, ticket SLA system.

---

## 3. Merchant Panel audit

### vs MVP cut line (launch bar)

| Feature (MVP definition) | Status | What's missing |
|---|---|---|
| Signup / login | ✅ Complete | OTP deviation noted (§1) |
| Single business, single location | ✅ Complete | By design |
| Brand setup: logo + **colour** + live preview | 🟡 Partial | Brand colour missing (card is fixed dark theme); previews exist |
| Program config: stamps, reward, **daily cap, min spend** | 🟡 Partial | Daily stamp cap + min-spend fields missing (fraud + economics) |
| Customer list (phone, name, stamps, visits, last visit, joined) | ✅ Complete | |
| Customer detail: history, **manual adjust**, **notes** | 🟡 Partial | Owner can add stamps; no remove/adjust-with-reason, no notes |
| Dashboard metrics with **7/30/90-day picker** | 🟡 Partial | Today + all-time only; no period picker, no charts |
| QR: **standee PDF** + Instagram square | 🟡 Partial | Print page + PNG exist; no PDF asset, no IG square |
| Staff: add, deactivate | ✅ Complete | |
| **Billing: subscription, plan up/downgrade** | ❌ Missing | No plans/subscriptions/invoices anywhere |
| **CSV export of customers** | ❌ Missing | Spec calls it "the competitive weapon" — free on every tier |

**MVP score at audit time: 4 ✅ · 5 🟡 · 2 ❌ → 6.5/11 ≈ 59%.**
**After the merchant-panel work: 10 ✅ · 0 🟡 · 1 ❌ (billing) → ≈ 91%.** Brand colour, daily
cap, min-spend-equivalent fraud rails, notes/adjustments, the 7/30/90 picker with charts, and
CSV export all shipped; only billing remains, and it is blocked on a provider decision.

### Additional gaps vs full spec (05/06) — post-MVP unless noted
- **Rewards module** (entity, CRUD, performance) — *partially pulled forward: redemption needs a Redemption entity now* (§5)
- **Transactions page** (business-wide ledger UI, filters, reversal) — data exists in `stamps`; no UI/endpoint
- Campaigns/messaging + credits, automations, segments — V1.1 per cut line
- Locations (multi-outlet), Reports library, Support page, Profile page (sessions list/revoke), notification centre, program wizard with 5 reward types, program versioning, customer import, integrations/API keys — V1.1/V2

---

## 4. Staff Access audit

| Check (from the task brief) | Status | Notes |
|---|---|---|
| Staff login | ✅ Complete | OTP, invite-only, inactive blocked pre-SMS and per-request |
| Role management | ✅ Complete | STAFF/MANAGER per person, set from the merchant Staff page; drives undo windows + team stats |
| Permission management | 🟡 Partial | Role-based (2 counter roles + owner); no per-permission matrix — deliberate until a real need appears |
| Module access | ✅ Complete | Staff can only reach console endpoints (guards verified) |
| Customer access | ✅ Complete | Search scoped to own business; E2E-proved |
| Loyalty operations — **stamp** | ✅ Complete | Atomic, reward-detecting, cooldown |
| Loyalty operations — **enroll at counter** | ✅ Complete | Phone-only, no OTP in the queue; optional first stamp; consent channel `counter` |
| Loyalty operations — **redeem reward** | ✅ Complete | Voucher flow, race-safe, 2 entry points |
| Loyalty operations — **camera QR scan** | ✅ Complete | Card shows its QR; console scans via BarcodeDetector + jsQR fallback |
| Transaction permissions (adjust/reverse) | ✅ Complete | 60 s own-stamp undo, 15 min manager undo, ledger-true reversals, voucher voiding |
| Reports access | ✅ Complete | Today strip: own numbers for staff, counter totals + per-person for managers |
| Activity logs | 🟡 Partial | Undo/enrol audit-logged; merchant sees everything in Transactions; no dedicated staff-facing log |
| Password management | ✅ N/A by design | OTP-based; adopt PIN only as redemption approval step |

**MVP scanner score (6 items): login ✅, manual lookup ✅, camera scan ✅, enroll ✅, redeem ✅, activity+undo ✅ → 6/6 ≈ 100%.**

---

## 5. Customer surface audit (bonus — it's a panel too)

| Feature | Status | Notes |
|---|---|---|
| Join page (branded, campaign preview) | ✅ Complete | |
| OTP verify + registration | ✅ Complete | Resend timer, attempts, dev hint |
| **Consent checkbox + consent record** | ❌ Missing | Legal requirement (DPDP/GDPR) before real customers; spec stores text version + IP + timestamp |
| Digital card, live updates | ✅ Complete | 4s polling, animations |
| My cards (multi-business) | ✅ Complete | |
| History | 🟡 Partial | Recent 15 on card; no paginated full history |
| Profile edit / leave program / privacy dashboard | ❌ Missing | Post-MVP except deletion rights (pair with admin erasure) |
| Reward-ready state on card | 🟡 Partial | Celebrates completion; no persistent "unredeemed reward" state (needs redemption model) |

**vs MVP (excl. wallet): ≈75%.**

---

## 6. Cross-cutting gaps

**Missing DB tables/fields (needed this phase):**
`rewards` isn't needed as a separate table yet, but **`redemptions` is** (id, membershipId, businessId, staffId, reward text snapshot, code, status, createdAt/redeemedAt). Add: `Staff.role` (MANAGER|STAFF), `audit_logs`, `consents` (or consent fields on membership), `platform_admins`, `impersonation_sessions`, and for billing: `plans`, `subscriptions`, `invoices`. Field adds: `Business.brandColor/category/timezone`, `Campaign.dailyStampCap/terms`, `CustomerMembership.notes/tags/blockedAt`, `Stamp.reversedById` (undo). Later (points/campaigns): generalized `ledger_entries`, `events` outbox, `daily_business_stats`.

**Missing validations:** consent at enrollment · per-card daily stamp cap · logo magic-byte sniffing · Turnstile hook on OTP (SMS cost abuse) · timezone-aware "today" (uses server TZ now) · idempotency keys on stamp/redeem (spec §C1).

**Missing platform pieces (production-readiness, not features):** real SMS provider (console-only today — **launch blocker**) · error monitoring (Sentry) · CI (tests exist, nothing runs them) · deployment config (Dockerfiles/PM2) · DB backup routine · legal pages (privacy/terms) · httpOnly-cookie session hardening (documented trade-off).

---

## 7. Recommended production features

**Must Have (blockers for charging real merchants):**
1. Reward **redemption** end-to-end — a loyalty product without redemption tracking is a counter that counts; merchants can't trust "rewards earned = 7" without knowing which were honored
2. Real SMS provider + Turnstile — no OTP delivery = no product; unprotected OTP = SMS bill attack
3. Consent capture + audit log — DPDP/GDPR exposure otherwise; audit log also unblocks admin
4. Billing + plan limits — it isn't SaaS until it charges; limits code shapes many UIs
5. CSV export — your own spec calls it the competitive weapon; trivially cheap
6. Minimum Viable Admin (§2 list) — you cannot operate, support, or suspend without it
7. Sentry + CI + backups + deploy config — table stakes before first paying tenant

**Recommended (soon after):** Manager role + proposed permission matrix (§8) · camera QR scanning in staff console · undo-within-60s reversal · 7/30/90 analytics with charts · brand colour theming on cards/join page · customer notes/tags/adjust-with-reason · staff activity UI · timezone field + correct "today" · program terms text.

**Nice to Have (defer past this phase):** segments + WhatsApp campaigns (this is the V1.1 revenue engine — first thing *after* panels) · multi-location · points program type · referrals · notifications centre · reports library · customer PWA extras (profile, privacy dashboard) · RLS defense-in-depth · outbox/events.

---

## 8. Proposed staff permission matrix (spec gap — needs owner sign-off)

| Action | Staff | Manager | Owner (Merchant) |
|---|---|---|---|
| Search customers, view card state | ✅ | ✅ | ✅ |
| Add stamp | ✅ | ✅ | ✅ |
| Enroll customer at counter | ✅ | ✅ | ✅ |
| Redeem reward | ✅ (PIN/OTP re-confirm) | ✅ | ✅ |
| Undo own stamp ≤60s | ✅ | ✅ | ✅ |
| Reverse any transaction ≤24h | ❌ | ✅ | ✅ |
| Adjust balance (reason required) | ❌ | ✅ | ✅ |
| View day/staff reports | own only | ✅ location | ✅ all |
| Manage staff / campaign / settings | ❌ | ❌ | ✅ |

---

## 9. Roadmap

> **Recommended execution order: B → C → A.** Merchant/Staff gaps block real usage and revenue; the admin panel is for operating at scale you don't have yet. Build the audit log early in B since A depends on it. Estimates are focused dev-days.

### Phase B — Merchant Panel to production (≈ 18–24 days)
| Work item | Effort | Depends on |
|---|---|---|
| Redemption model + endpoints + merchant UI (customer detail + dashboard) | 3–4d | — |
| Consent capture at join + display in customer detail | 1d | — |
| Audit log infra (writes on sensitive actions) + merchant activity view | 2–3d | — |
| CSV exports (customers, stamps) | 1d | — |
| Transactions page (business ledger, filters) | 2d | — |
| Analytics upgrade: 7/30/90 picker, daily series chart, per-period KPIs | 2–3d | — |
| Customer CRM: notes, tags, adjust-with-reason, block | 2d | audit log |
| Campaign extras: daily cap, terms; Business: brand colour (card theming), category, timezone | 2d | — |
| Settings: notification prefs stub, danger zone (pause program), sessions list/revoke | 2d | — |
| Billing: provider checkout, plans, subscription state, invoice list, limit enforcement | 5–8d | **provider account (blocker)** |

### Phase C — Staff Access to production (≈ 8–11 days)
| Work item | Effort | Depends on |
|---|---|---|
| Manager/Staff roles + permission checks (matrix §8) | 2d | — |
| Redeem flow in console (approval step, redemption code) | 2d | B: redemption model |
| Camera QR scan (card shows QR of code; console scans it) | 2d | — |
| Enroll-at-counter | 1d | consent capture |
| Today's activity + undo ≤60s (reversal entries) | 2d | — |
| Staff activity log UI (merchant side) | 1d | audit log |

### Phase A — Minimum Viable Admin (≈ 14–19 days)
| Work item | Effort | Depends on |
|---|---|---|
| `platform_admins` + email/password + TOTP + sessions | 3d | — |
| Admin app shell + platform KPI dashboard | 2d | — |
| Merchant management (list/detail/edit/suspend/reactivate + suspension enforcement in guards) | 3d | — |
| Impersonation (reason, TTL, banner, double audit) | 1–2d | audit log |
| Audit log viewer (cross-tenant) | 1–2d | audit log |
| Customer lookup + erasure workflow | 2d | — |
| Plans & subscriptions views | 2d | B: billing |
| Admin staff mgmt + health page | 2d | — |

Full-spec admin (31 pages) is an additional ~60–90d beyond MVA — explicitly out of this phase.

---

## 10. Blockers & decisions needed

1. **Payment provider** (Razorpay, Stripe, or both) + account credentials — blocks billing.
2. **SMS/WhatsApp provider** (MSG91/Twilio/Gupshup…) + sender registration — blocks production OTP.
3. **Ratify auth deviation:** keep phone-OTP for merchants (recommended) vs spec's email+Google.
4. **Pricing enforcement now vs free beta** — determines whether limit checks gate UIs immediately.
5. **Approve the staff permission matrix** (§8) — the spec never defined one.
6. Optional now: custom domain(s) for deploy targets.

---

## 11. Final recommendation

Build in this order, then start the Wallet phase:

1. **Redemption end-to-end** (B+C) — closes the loyalty loop; everything else is decoration until a reward can be honored and recorded.
2. **Consent + audit log + CSV export** — legal soundness and the cheapest high-value wins.
3. **Staff console upgrades** — roles, camera scan, enroll, undo.
4. **Analytics + CRM + theming** — makes the merchant panel feel production-grade.
5. **Billing** — start the provider account process *today* (external dependency).
6. **Minimum Viable Admin** — operate, support, suspend, comply.

That sequence takes the phase goal from ~43% to production-ready with no wallet work wasted: the redemption/ledger data model is exactly what wallet passes will render later.
