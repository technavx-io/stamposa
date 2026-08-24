# Error monitoring — going live

Both apps ship with Sentry instrumentation that costs nothing while off and
turns on with a DSN. No code changes, no redeploy logic — just env vars.

## What gets captured (and what never does)

| Captured | Deliberately NOT captured |
|---|---|
| Every API 5xx, with request id, method, path, actor **id** and role | 4xx domain errors (wrong OTP, daily cap, already redeemed — expected outcomes) |
| Background failures that users never see: wallet sync errors, audit-write failures | Request bodies, headers, cookies (they contain phones and OTPs) |
| Uncaught crashes and unhandled rejections in the API process | Phone numbers or names, anywhere |
| Browser-side crashes (via the global error boundary) | |

The API's `x-request-id` (returned on every response and shown in error
envelopes) is attached as a tag, so a merchant's screenshot of an error can
be matched to the exact Sentry event.

## Setup (10 minutes)

1. Create a free account at [sentry.io](https://sentry.io) (the free tier's
   5k errors/month is far more than a healthy deployment produces).
2. Create **two projects**: one *Node.js* (the API) and one *Browser
   JavaScript* (the web app). Each gives you a **DSN** — a public-ish URL
   that identifies the project.
3. Add to `deploy/.env.production`:

   ```bash
   SENTRY_DSN=<the Node project DSN>
   WEB_SENTRY_DSN=<the Browser project DSN>
   ```

4. `./deploy/deploy.sh` — the API DSN is picked up at boot; the web DSN is
   baked into the browser bundle during the image build.
5. In Sentry: Settings → Alerts → route new-issue alerts to your email (or a
   WhatsApp/Slack webhook later).

To test it end-to-end after deploying, temporarily hit an impossible state
(e.g. stop Redis: `lc stop redis`, make any request, `lc start redis`) and
watch the event arrive.

## Notes

- **Local dev**: set `SENTRY_DSN` in `apps/api/.env` only if you want dev
  errors reported; normally leave it unset.
- **Performance tracing** is off by default. `SENTRY_TRACES_SAMPLE_RATE=0.1`
  samples 10% of requests if you later want latency breakdowns.
- **Self-hosting**: the SDKs speak the Sentry protocol, so a self-hosted
  [GlitchTip](https://glitchtip.com) (Sentry-compatible, runs in docker
  compose) works with the same two DSNs if you'd rather keep everything on
  your VPS. Start with sentry.io; switch by changing the DSNs.
