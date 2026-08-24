#!/bin/bash
# Generates DEV-ONLY wallet credentials so the full signing pipeline runs
# locally: a self-signed "WWDR" CA + pass certificate for Apple, and a fake
# service-account key for Google. Passes built with these will NOT install
# on real devices — swap in real credentials per docs/WALLET-SETUP.md.
set -euo pipefail
cd "$(dirname "$0")"
OUT=fixtures/wallet
mkdir -p "$OUT"

# Fake Apple WWDR intermediate (acts as our CA).
openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout "$OUT/wwdr-key.pem" -out "$OUT/wwdr.pem" \
  -subj "/CN=Fake WWDR CA/O=Dev Only" 2>/dev/null

# Pass signing key + certificate signed by the fake CA.
openssl req -newkey rsa:2048 -nodes \
  -keyout "$OUT/signer-key.pem" -out "$OUT/signer.csr" \
  -subj "/CN=Pass Type ID: pass.dev.stamposa/O=Dev Only/UID=pass.dev.stamposa" 2>/dev/null
openssl x509 -req -in "$OUT/signer.csr" -CA "$OUT/wwdr.pem" -CAkey "$OUT/wwdr-key.pem" \
  -CAcreateserial -days 365 -out "$OUT/signer.pem" 2>/dev/null
rm -f "$OUT/signer.csr" "$OUT/wwdr.srl"

# Fake Google service-account key (real RSA key, fake identity).
openssl genrsa -out "$OUT/google-sa-key.pem" 2048 2>/dev/null
openssl pkcs8 -topk8 -nocrypt -in "$OUT/google-sa-key.pem" -out "$OUT/google-sa-pkcs8.pem" 2>/dev/null
python3 - "$OUT" <<'PY'
import json, sys, pathlib
out = pathlib.Path(sys.argv[1])
key = (out / 'google-sa-pkcs8.pem').read_text()
(out / 'google-sa.json').write_text(json.dumps({
    'type': 'service_account',
    'client_email': 'dev-wallet@dev-only.iam.gserviceaccount.com',
    'private_key': key,
}, indent=2))
# Public key for JWT verification in tests.
PY
openssl rsa -in "$OUT/google-sa-key.pem" -pubout -out "$OUT/google-sa-public.pem" 2>/dev/null
rm -f "$OUT/google-sa-key.pem" "$OUT/google-sa-pkcs8.pem"

echo "✓ wallet fixtures in apps/api/test/$OUT"
echo "  Add to apps/api/.env:"
echo "    APPLE_WALLET_CERT_PATH=./test/fixtures/wallet/signer.pem"
echo "    APPLE_WALLET_KEY_PATH=./test/fixtures/wallet/signer-key.pem"
echo "    APPLE_WALLET_WWDR_PATH=./test/fixtures/wallet/wwdr.pem"
echo "    APPLE_WALLET_TEAM_ID=DEVTEAM123"
echo "    APPLE_WALLET_PASS_TYPE_ID=pass.dev.stamposa"
echo "    GOOGLE_WALLET_ISSUER_ID=3388000000000000000"
echo "    GOOGLE_WALLET_SA_KEY_PATH=./test/fixtures/wallet/google-sa.json"
