# Wallet passes — going live

The integration is fully built and tested. Each wallet turns on by itself the
moment its credentials appear in the environment — no code changes. Until
then, the card page shows the honest "soon" placeholders.

In development, `apps/api/test/make-wallet-fixtures.sh` generates self-signed
stand-ins so the whole pipeline runs locally (passes built with them will not
install on real devices).

---

## Apple Wallet (needs an Apple Developer account, $99/year)

1. **Enrol** at [developer.apple.com](https://developer.apple.com/programs/enroll/)
   as an organisation (or individual). Note your **Team ID** (10 characters,
   under Membership).
2. **Create a Pass Type ID**: Certificates, Identifiers & Profiles →
   Identifiers → ➕ → Pass Type IDs → e.g. `pass.com.stamposa.loyalty`.
3. **Create the signing certificate** for that Pass Type ID (the portal walks
   you through a CSR from Keychain Access). Download the `.cer`, add it to
   Keychain, then export cert + private key:

   ```bash
   # From Keychain export a .p12, then:
   openssl pkcs12 -in pass.p12 -clcerts -nokeys -out signer.pem -legacy
   openssl pkcs12 -in pass.p12 -nocerts -nodes -out signer-key.pem -legacy
   ```

4. **Download Apple's WWDR G4 intermediate** from
   [apple.com/certificateauthority](https://www.apple.com/certificateauthority/)
   and convert: `openssl x509 -inform der -in AppleWWDRCAG4.cer -out wwdr.pem`
5. **Configure** (paths are wherever you put the PEMs on the server):

   ```bash
   APPLE_WALLET_CERT_PATH=/opt/loyalty-secrets/signer.pem
   APPLE_WALLET_KEY_PATH=/opt/loyalty-secrets/signer-key.pem
   APPLE_WALLET_WWDR_PATH=/opt/loyalty-secrets/wwdr.pem
   APPLE_WALLET_TEAM_ID=<your 10-char team id>
   APPLE_WALLET_PASS_TYPE_ID=pass.com.stamposa.loyalty
   ```

**Live updates:** passes carry our web-service URL; iPhones register
themselves and get APNs pushes (sent with the same certificate) whenever a
stamp lands — the pass refreshes in seconds. Requires the API to be on HTTPS
(the VPS setup already is).

## Google Wallet (free)

1. **Sign up as an issuer** at the
   [Google Pay & Wallet console](https://pay.google.com/business/console) →
   Google Wallet API. Note your numeric **Issuer ID**.
2. **Create a service account** in any Google Cloud project (IAM → Service
   Accounts), create a **JSON key**, and download it.
3. **Grant it access**: back in the Wallet console → Users → invite the
   service account's email as a developer.
4. **Configure**:

   ```bash
   GOOGLE_WALLET_ISSUER_ID=<numeric issuer id>
   GOOGLE_WALLET_SA_KEY_PATH=/opt/loyalty-secrets/google-sa.json
   ```

New issuer accounts start in demo mode (passes show a "test" banner and only
work for allow-listed testers) — request publishing access in the console
when ready.

**Live updates:** every stamp PATCHes the loyalty object; Google pushes the
change to saved passes itself.

## On the VPS

Put the credential files on the server (e.g. `/opt/loyalty-secrets/`), mount
them into the API container, and add the env vars to
`deploy/.env.production`. In `deploy/docker-compose.prod.yml` add under
`api:`:

```yaml
    volumes:
      - uploads:/repo/apps/api/uploads
      - /opt/loyalty-secrets:/opt/loyalty-secrets:ro
```

Then `./deploy/deploy.sh` — the availability endpoint flips to true and the
buttons appear on every customer card.

## What's on the pass

Both passes show the brand colour, live stamp count, next-reward progress
(or "reward ready"), and a QR of the customer code — the same code the staff
console scanner reads, so a wallet pass works at the counter exactly like
the web card.
