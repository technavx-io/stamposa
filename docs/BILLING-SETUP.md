# Billing — going live with Dodo Payments

The subscription billing integration is fully built. Paid checkout turns on by
itself the moment the Dodo credentials appear in the environment — no code
changes. Until then the billing screen shows honest "Contact us" CTAs and the
pricing page reads "taxes shown at checkout".

Dodo Payments is a **Merchant of Record (MoR)**: it becomes the legal seller,
collects and remits GST / VAT / sales tax worldwide, handles multi-currency,
and pays out to you. One Dodo account belongs to the **platform** (Stamposa);
your merchants are its customers.

---

## What flips billing on

`apps/api/.env` (see `.env.example`):

```
DODO_ENVIRONMENT=test_mode          # or live_mode
DODO_API_KEY=...                    # from the dashboard (Bearer key)
DODO_WEBHOOK_SECRET=whsec_...       # from the webhook you create
DODO_PRODUCT_STARTER_MONTHLY=pdt_...
DODO_PRODUCT_STARTER_YEARLY=pdt_...
DODO_PRODUCT_GROWTH_MONTHLY=pdt_...
DODO_PRODUCT_GROWTH_YEARLY=pdt_...
DODO_PRODUCT_PRO_MONTHLY=pdt_...
DODO_PRODUCT_PRO_YEARLY=pdt_...
```

With `DODO_API_KEY` empty, billing stays off (safe default). The API refuses to
start if `DODO_API_KEY` is set without `DODO_WEBHOOK_SECRET` — an unverifiable
webhook would never activate any subscription.

---

## Steps (do these in the Dodo dashboard)

1. **Create your account** at [dodopayments.com](https://dodopayments.com) and
   complete **business verification (KYC)** — business details, bank account
   for payouts, tax info. Test mode works immediately; live mode is gated on
   KYC.
2. **Set your brand profile** — business name, logo, support email, and your
   **Terms** + **Refund/Cancellation policy** URLs. Dodo requires these and
   shows them on the hosted checkout.
3. **Create six subscription Products**, one per paid tier × interval. Match the
   catalog in `apps/api/src/billing/plans.ts`:

   | Product           | Price   | Billing period |
   | ----------------- | ------- | -------------- |
   | Starter – Monthly | ₹199    | Monthly        |
   | Starter – Yearly  | ₹1,990  | Yearly         |
   | Growth – Monthly  | ₹499    | Monthly        |
   | Growth – Yearly   | ₹4,990  | Yearly         |
   | Pro – Monthly     | ₹999    | Monthly        |
   | Pro – Yearly      | ₹9,990  | Yearly         |

   Set currency **INR**; enable adaptive / multi-currency to auto-price
   international customers. Copy each **product id** (`pdt_…`) into the matching
   `DODO_PRODUCT_*` var. (Free has no product.)
4. **Copy an API key** — Test key now; Live key after KYC. → `DODO_API_KEY`.
5. **Create a webhook endpoint** → point it at:

   ```
   https://<your-api-domain>/v1/billing/webhook
   ```

   Subscribe to at least: `subscription.active`, `subscription.renewed`,
   `subscription.on_hold`, `subscription.cancelled`, `subscription.expired`,
   `subscription.failed`. Copy the **signing secret** (`whsec_…`) →
   `DODO_WEBHOOK_SECRET`.

   For local testing, expose your API with a tunnel
   (`cloudflared tunnel --url http://localhost:4000` or ngrok) and use that
   host in the webhook URL.

6. **Restart the API** so the new env loads.

---

## How the flow works (built, no action needed)

- Merchant clicks a plan on **/merchant/billing** → `POST /merchant/subscription/checkout`
  creates a Dodo **checkout session** (with `metadata.businessId/tier/interval`)
  and returns the hosted `checkout_url`. The merchant is redirected there.
- After paying, Dodo redirects back to `/merchant/billing?checkout=success`
  (an optimistic "activating…" toast). **The plan only actually switches when
  the webhook confirms it** — the browser redirect is never trusted.
- `POST /v1/billing/webhook` verifies the Standard Webhooks signature over the
  raw body, then updates the tenant's `Subscription` row (status, plan,
  interval, `currentPeriodEnd`, gateway ids).
- Cancel → `POST /merchant/subscription/cancel` sets cancel-at-period-end; the
  merchant keeps access until the period closes, then the webhook drops them to
  Free.

## Verify

- **Test mode:** use Dodo's test cards, subscribe from the billing screen, and
  confirm the row moves `TRIALING → ACTIVE` after the `subscription.active`
  webhook lands. Send a test event from the dashboard to confirm the endpoint
  returns `200`.
- A bad/absent signature returns `400` (so Dodo won't hammer retries); an
  unconfigured endpoint returns `503`.

## Notes / gotchas

- **Verify the cancel endpoint** (`DodoService.cancelAtPeriodEnd`) against your
  Dodo API version — cancel semantics have varied; the field used is
  `cancel_at_next_billing_date`.
- **Live API base** is derived as `https://live.dodopayments.com`; override with
  `DODO_API_BASE` if your dashboard shows a different host.
- **Indian cards:** off-session renewal charges can take up to ~48h to settle,
  and charges above ₹15,000 need fresh authentication (Dodo handles the UX).
- **Scheduled downgrade:** when a paid period lapses, `effectiveTier` already
  falls back correctly; a periodic job to also flip stale `status` values to
  `EXPIRED` is a nice-to-have but not required for correctness.
