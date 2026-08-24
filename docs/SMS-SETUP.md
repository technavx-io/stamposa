# SMS via MSG91 — going live

The MSG91 integration is built and tested; it activates when three env vars
appear. Until then, `SMS_PROVIDER=console` prints OTPs to the API log (and
staff can always enrol customers at the counter without any OTP).

Indian regulation (TRAI) requires **DLT registration** before anyone can
send SMS to Indian numbers — MSG91 walks you through all of it in their
dashboard. Budget 2–4 working days for the approvals; the steps themselves
take under an hour.

## 1. Create the MSG91 account

Sign up at [msg91.com](https://msg91.com). Your **Auth Key** is under
Settings once you're in (keep it secret — it is the API password).

## 2. DLT registration (one time)

In the MSG91 dashboard, follow **DLT registration**:

1. **Entity registration** — your business name, PAN/GST. You receive a
   *Principal Entity ID*.
2. **Sender ID (header)** — a **6-letter** identity, e.g. `STMPSA`. This is
   the "from" customers see. Note DLT headers are exactly six characters, so
   the full brand name does not fit — `STMPSA` is the closest readable form
   of Stamposa. Whatever you register here must match `MSG91_SENDER_ID`.
3. **Template registration** — register a *transactional/OTP* template whose
   text contains the `##otp##` variable, for example:

   > `##otp## is your Stamposa verification code. It expires in 5 minutes.`

   Once approved, connect it to a **Flow** in MSG91 (Flows → create from the
   DLT template) and note the **Template/Flow ID**.

## 3. Configure and deploy

Add to `deploy/.env.production` (or `apps/api/.env` to test locally with
your real account):

```bash
SMS_PROVIDER=msg91
MSG91_AUTH_KEY=<auth key>
MSG91_TEMPLATE_ID=<flow/template id>
MSG91_SENDER_ID=STMPSA
```

Then `./deploy/deploy.sh`. The API refuses to boot if `SMS_PROVIDER=msg91`
is set with any credential missing, so a typo fails loudly at deploy time
rather than silently at the first login.

## How the platform behaves

- The **code is generated and verified by us** (hashed in Redis, 5-minute
  expiry, 5 attempts, 60-second resend cooldown, 5 sends/hour/number) —
  MSG91 is purely the delivery pipe, so switching providers later means one
  new adapter file, nothing else.
- **Delivery failures don't strand anyone**: if MSG91 rejects or times out
  (10 s), the stored code *and* the resend cooldown are rolled back and the
  user sees "We could not send the code right now — please try again", which
  works immediately.
- OTP codes are **never written to logs** in msg91 mode — only MSG91's
  request id and the last 4 digits of the number.
- In production with `SMS_PROVIDER=console` the API boots but logs a loud
  warning on startup.

## Testing your real credentials

With the env vars set locally, restart the API and request a code for your
own phone from `http://localhost:3000/staff/login` — the SMS should arrive
within a few seconds, and `MSG91 → …<last4> accepted (request …)` appears in
the API log. (Set `OTP_DEV_EXPOSE=false` first if you want to prove you're
reading the code from the SMS, not the dev hint.)
