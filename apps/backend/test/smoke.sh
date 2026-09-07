#!/bin/bash
# End-to-end smoke test for the Loyalty Platform API (dev OTP mode).
set -u
API=http://localhost:4000/v1
# Direct DB access for test fixtures (override in CI with a full URL).
PSQL="${PSQL:-psql -h localhost -d loyalty_platform}"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✗ $1  →  $2"; }
check() { # name expected actual
  if [ "$2" = "$3" ]; then ok "$1"; else bad "$1" "expected [$2] got [$3]"; fi
}

MPHONE="+919812345678"
CPHONE="+919811111111"
SPHONE="+919813333333"

echo "— Health"
H=$(curl -s $API/health)
check "health ok" "ok" "$(echo "$H" | jq -r .status)"

echo "— Merchant registration"
D=$(curl -s -X POST $API/auth/merchant/otp/request -H 'Content-Type: application/json' -d "{\"phone\":\"$MPHONE\"}")
CODE=$(echo "$D" | jq -r .devCode)
[ ${#CODE} = 6 ] && ok "otp request returns devCode" || bad "otp devCode" "$D"
V=$(curl -s -X POST $API/auth/merchant/otp/verify -H 'Content-Type: application/json' -d "{\"phone\":\"$MPHONE\",\"code\":\"$CODE\"}")
check "new phone → REGISTRATION_REQUIRED" "REGISTRATION_REQUIRED" "$(echo "$V" | jq -r .status)"
RT=$(echo "$V" | jq -r .registrationToken)
R=$(curl -s -X POST $API/auth/merchant/register -H 'Content-Type: application/json' -d "{\"registrationToken\":\"$RT\",\"name\":\"Test Owner\"}")
MTOK=$(echo "$R" | jq -r .tokens.accessToken)
MREF=$(echo "$R" | jq -r .tokens.refreshToken)
[ ${#MTOK} -gt 50 ] && ok "merchant session issued" || bad "merchant session" "$R"

echo "— Wrong OTP rejected"
curl -s -X POST $API/auth/merchant/otp/request -H 'Content-Type: application/json' -d "{\"phone\":\"+919812340000\"}" >/dev/null
W=$(curl -s -X POST $API/auth/merchant/otp/verify -H 'Content-Type: application/json' -d "{\"phone\":\"+919812340000\",\"code\":\"000000\"}")
CODE2=$(curl -s -X POST $API/auth/merchant/otp/request -H 'Content-Type: application/json' -d "{\"phone\":\"+919812340000\"}" | jq -r .code)
check "wrong code → OTP_INVALID" "OTP_INVALID" "$(echo "$W" | jq -r .code)"
check "instant resend → OTP_COOLDOWN" "OTP_COOLDOWN" "$CODE2"

echo "— Business + campaign + QR"
B=$(curl -s -X POST $API/merchant/business -H "Authorization: Bearer $MTOK" -H 'Content-Type: application/json' -d '{"name":"Smoke Test Cafe","address":"1 Test Street"}')
SLUG=$(echo "$B" | jq -r .slug)
[ "$SLUG" != "null" ] && ok "business created (slug=$SLUG)" || bad "business create" "$B"
B2=$(curl -s -X POST $API/merchant/business -H "Authorization: Bearer $MTOK" -H 'Content-Type: application/json' -d '{"name":"Second"}')
check "second business blocked" "BUSINESS_EXISTS" "$(echo "$B2" | jq -r .code)"
C=$(curl -s -X POST $API/merchant/campaigns -H "Authorization: Bearer $MTOK" -H 'Content-Type: application/json' -d '{"name":"Test Card","stampsRequired":3,"reward":"Free tea"}')
CAMP=$(echo "$C" | jq -r .id)
[ "$CAMP" != "null" ] && ok "campaign created (3 stamps)" || bad "campaign create" "$C"
C2=$(curl -s -X POST $API/merchant/campaigns -H "Authorization: Bearer $MTOK" -H 'Content-Type: application/json' -d '{"name":"Another","stampsRequired":5,"reward":"Free thing"}')
check "second campaign blocked (phase 1)" "CAMPAIGN_LIMIT" "$(echo "$C2" | jq -r .code)"
Q=$(curl -s $API/merchant/business/qr -H "Authorization: Bearer $MTOK")
echo "$Q" | jq -r .qrDataUrl | grep -q "^data:image/png" && ok "QR data URL generated" || bad "QR" "$Q"
check "QR join url" "http://localhost:3000/join/$SLUG" "$(echo "$Q" | jq -r .joinUrl)"

echo "— Public join page data"
P=$(curl -s $API/public/businesses/$SLUG)
check "public business name" "Smoke Test Cafe" "$(echo "$P" | jq -r .name)"
check "public accepting joins" "true" "$(echo "$P" | jq -r .acceptingJoins)"

echo "— Customer registration + join"
D=$(curl -s -X POST $API/auth/customer/otp/request -H 'Content-Type: application/json' -d "{\"phone\":\"$CPHONE\"}")
CODE=$(echo "$D" | jq -r .devCode)
V=$(curl -s -X POST $API/auth/customer/otp/verify -H 'Content-Type: application/json' -d "{\"phone\":\"$CPHONE\",\"code\":\"$CODE\"}")
RT=$(echo "$V" | jq -r .registrationToken)
R=$(curl -s -X POST $API/auth/customer/register -H 'Content-Type: application/json' -d "{\"registrationToken\":\"$RT\",\"name\":\"Test Customer\"}")
CTOK=$(echo "$R" | jq -r .tokens.accessToken)
[ ${#CTOK} -gt 50 ] && ok "customer session issued" || bad "customer session" "$R"
J=$(curl -s -X POST $API/customer/memberships -H "Authorization: Bearer $CTOK" -H 'Content-Type: application/json' -d "{\"businessSlug\":\"$SLUG\",\"marketingConsent\":true}")
MEMID=$(echo "$J" | jq -r .card.id)
MCODE=$(echo "$J" | jq -r .card.formattedCode)
check "join not alreadyMember" "false" "$(echo "$J" | jq -r .alreadyMember)"
echo "$MCODE" | grep -Eq "^[A-Z2-9]{4}-[A-Z2-9]{4}$" && ok "customer code $MCODE" || bad "customer code" "$J"
J2=$(curl -s -X POST $API/customer/memberships -H "Authorization: Bearer $CTOK" -H 'Content-Type: application/json' -d "{\"businessSlug\":\"$SLUG\"}")
check "re-join idempotent" "true" "$(echo "$J2" | jq -r .alreadyMember)"

echo "— Staff login + stamping"
S=$(curl -s -X POST $API/merchant/staff -H "Authorization: Bearer $MTOK" -H 'Content-Type: application/json' -d "{\"name\":\"Test Staff\",\"phone\":\"$SPHONE\"}")
[ "$(echo "$S" | jq -r .id)" != "null" ] && ok "staff created" || bad "staff create" "$S"
D=$(curl -s -X POST $API/auth/staff/otp/request -H 'Content-Type: application/json' -d "{\"phone\":\"$SPHONE\"}")
CODE=$(echo "$D" | jq -r .devCode)
V=$(curl -s -X POST $API/auth/staff/otp/verify -H 'Content-Type: application/json' -d "{\"phone\":\"$SPHONE\",\"code\":\"$CODE\"}")
STOK=$(echo "$V" | jq -r .session.tokens.accessToken)
[ ${#STOK} -gt 50 ] && ok "staff session issued" || bad "staff session" "$V"
UNKNOWN=$(curl -s -X POST $API/auth/staff/otp/request -H 'Content-Type: application/json' -d '{"phone":"+919899999999"}')
check "unknown staff phone rejected" "STAFF_NOT_FOUND" "$(echo "$UNKNOWN" | jq -r .code)"
CTX=$(curl -s $API/staff/context -H "Authorization: Bearer $STOK")
check "staff context business" "Smoke Test Cafe" "$(echo "$CTX" | jq -r .business.name)"
SR=$(curl -s "$API/staff/customers/search?q=9811111111" -H "Authorization: Bearer $STOK")
check "search by phone finds customer" "$MEMID" "$(echo "$SR" | jq -r '.[0].id')"
SR2=$(curl -s "$API/staff/customers/search?q=$(echo $MCODE | tr -d '-')" -H "Authorization: Bearer $STOK")
check "search by code finds customer" "$MEMID" "$(echo "$SR2" | jq -r '.[0].id')"
A1=$(curl -s -X POST $API/staff/stamps -H "Authorization: Bearer $STOK" -H 'Content-Type: application/json' -d "{\"membershipId\":\"$MEMID\"}")
check "stamp 1 count" "1" "$(echo "$A1" | jq -r .card.stampCount)"
check "stamp 1 no reward" "false" "$(echo "$A1" | jq -r .rewardEarned)"
A2=$(curl -s -X POST $API/staff/stamps -H "Authorization: Bearer $STOK" -H 'Content-Type: application/json' -d "{\"membershipId\":\"$MEMID\"}")
check "instant re-stamp blocked (cooldown)" "STAMP_COOLDOWN" "$(echo "$A2" | jq -r .code)"
sleep 3.2
A2=$(curl -s -X POST $API/staff/stamps -H "Authorization: Bearer $STOK" -H 'Content-Type: application/json' -d "{\"membershipId\":\"$MEMID\"}")
check "stamp 2 count" "2" "$(echo "$A2" | jq -r .card.stampCount)"
sleep 3.2
A3=$(curl -s -X POST $API/staff/stamps -H "Authorization: Bearer $STOK" -H 'Content-Type: application/json' -d "{\"membershipId\":\"$MEMID\"}")
check "stamp 3 completes card → reward" "true" "$(echo "$A3" | jq -r .rewardEarned)"
check "count resets to 0" "0" "$(echo "$A3" | jq -r .card.stampCount)"
check "completedCount 1" "1" "$(echo "$A3" | jq -r .card.completedCount)"

echo "— Redemption lifecycle"
RCODE=$(echo "$A3" | jq -r .redemption.code)
RID=$(echo "$A3" | jq -r .redemption.id)
[ ${#RCODE} = 8 ] && ok "voucher minted on completion ($RCODE)" || bad "voucher minted" "$A3"
check "card carries pending reward" "1" "$(echo "$A3" | jq -r '.card.pendingRewards | length')"
PEND=$(curl -s "$API/merchant/redemptions?status=PENDING" -H "Authorization: Bearer $MTOK")
check "merchant pending list total" "1" "$(echo "$PEND" | jq -r .total)"
SRCH=$(curl -s "$API/staff/customers/search?q=9811111111" -H "Authorization: Bearer $STOK")
check "staff search shows pending reward" "1" "$(echo "$SRCH" | jq -r '.[0].pendingRewards | length')"
RED=$(curl -s -X POST $API/staff/redemptions/redeem -H "Authorization: Bearer $STOK" -H 'Content-Type: application/json' -d "{\"code\":\"$RCODE\"}")
check "staff redeems by code" "REDEEMED" "$(echo "$RED" | jq -r .redemption.status)"
check "redeemedBy recorded" "Test Staff" "$(echo "$RED" | jq -r .redemption.redeemedBy)"
check "card pending cleared" "0" "$(echo "$RED" | jq -r '.card.pendingRewards | length')"
RE2=$(curl -s -X POST $API/staff/redemptions/redeem -H "Authorization: Bearer $STOK" -H 'Content-Type: application/json' -d "{\"redemptionId\":\"$RID\"}")
check "double redeem blocked" "ALREADY_REDEEMED" "$(echo "$RE2" | jq -r .code)"

echo "— Customer card reflects stamps"
CARD=$(curl -s $API/customer/cards/$MEMID -H "Authorization: Bearer $CTOK")
check "card totalStamps" "3" "$(echo "$CARD" | jq -r .totalStamps)"
check "card rewards earned" "1" "$(echo "$CARD" | jq -r .completedCount)"
check "card redeemedCount" "1" "$(echo "$CARD" | jq -r .redeemedCount)"
check "card no pending rewards" "0" "$(echo "$CARD" | jq -r '.pendingRewards | length')"
check "card recent stamps" "3" "$(echo "$CARD" | jq -r '.recentStamps | length')"
check "stamp issuer name" "Test Staff" "$(echo "$CARD" | jq -r '.recentStamps[0].issuerName')"

echo "— Merchant dashboard + customer list"
DB=$(curl -s $API/merchant/dashboard -H "Authorization: Bearer $MTOK")
check "dashboard customers" "1" "$(echo "$DB" | jq -r .stats.customers)"
check "dashboard stamps total" "3" "$(echo "$DB" | jq -r .stats.stampsTotal)"
check "dashboard rewards" "1" "$(echo "$DB" | jq -r .stats.rewardsEarned)"
check "dashboard rewards redeemed" "1" "$(echo "$DB" | jq -r .stats.rewardsRedeemed)"
check "dashboard rewards pending" "0" "$(echo "$DB" | jq -r .stats.rewardsPending)"
check "dashboard activity has redemption" "REDEMPTION" "$(echo "$DB" | jq -r '[.activity[] | select(.type == "REDEMPTION")][0].type')"
check "dashboard activity items (3 stamps + 1 redemption)" "4" "$(echo "$DB" | jq -r '.activity | length')"
CL=$(curl -s "$API/merchant/customers?search=Test" -H "Authorization: Bearer $MTOK")
check "customer list finds by name" "1" "$(echo "$CL" | jq -r .total)"
HIST=$(curl -s "$API/merchant/customers/$MEMID/stamps" -H "Authorization: Bearer $MTOK")
check "stamp history total" "3" "$(echo "$HIST" | jq -r .total)"

echo "— Merchant panel: CRM, analytics, ledger, exports"
NOTES=$(curl -s -X PATCH "$API/merchant/customers/$MEMID" -H "Authorization: Bearer $MTOK" -H 'Content-Type: application/json' -d '{"notes":"Prefers oat milk","tags":["regular","vip"]}')
check "notes saved" "Prefers oat milk" "$(echo "$NOTES" | jq -r .notes)"
check "tags saved" "2" "$(echo "$NOTES" | jq -r '.tags | length')"
ADJ=$(curl -s -X POST "$API/merchant/customers/$MEMID/adjust" -H "Authorization: Bearer $MTOK" -H 'Content-Type: application/json' -d '{"delta":2,"reason":"Goodwill after a long wait"}')
check "balance adjusted +2" "2" "$(echo "$ADJ" | jq -r .card.stampCount)"
NOREASON=$(curl -s -X POST "$API/merchant/customers/$MEMID/adjust" -H "Authorization: Bearer $MTOK" -H 'Content-Type: application/json' -d '{"delta":1,"reason":"x"}')
check "adjustment reason required" "VALIDATION_ERROR" "$(echo "$NOREASON" | jq -r .code)"
TOOLOW=$(curl -s -X POST "$API/merchant/customers/$MEMID/adjust" -H "Authorization: Bearer $MTOK" -H 'Content-Type: application/json' -d '{"delta":-99,"reason":"Testing the floor"}')
check "adjustment cannot go below zero" "ADJUSTMENT_TOO_LARGE" "$(echo "$TOOLOW" | jq -r .code)"
NEG=$(curl -s -X POST "$API/merchant/customers/$MEMID/adjust" -H "Authorization: Bearer $MTOK" -H 'Content-Type: application/json' -d '{"delta":-1,"reason":"Stamped twice by mistake"}')
check "negative adjustment works" "1" "$(echo "$NEG" | jq -r .card.stampCount)"

BLK=$(curl -s -X POST "$API/merchant/customers/$MEMID/block" -H "Authorization: Bearer $MTOK" -H 'Content-Type: application/json' -d '{"blocked":true,"reason":"Testing the block flow"}')
[ "$(echo "$BLK" | jq -r .blockedAt)" != "null" ] && ok "customer blocked" || bad "block" "$BLK"
sleep 3.2
BLKSTAMP=$(curl -s -X POST $API/staff/stamps -H "Authorization: Bearer $STOK" -H 'Content-Type: application/json' -d "{\"membershipId\":\"$MEMID\"}")
check "blocked customer cannot earn" "CUSTOMER_BLOCKED" "$(echo "$BLKSTAMP" | jq -r .code)"
UNBLK=$(curl -s -X POST "$API/merchant/customers/$MEMID/block" -H "Authorization: Bearer $MTOK" -H 'Content-Type: application/json' -d '{"blocked":false}')
check "unblocked" "null" "$(echo "$UNBLK" | jq -r .blockedAt)"

CONS=$(curl -s "$API/merchant/customers/$MEMID/consents" -H "Authorization: Bearer $MTOK")
[ "$(echo "$CONS" | jq -r 'length')" -ge 1 ] && ok "consent recorded at enrolment" || bad "consent" "$CONS"
check "consent captured as granted" "true" "$(echo "$CONS" | jq -r '.[0].granted')"

SUM=$(curl -s "$API/merchant/analytics/summary?range=30d" -H "Authorization: Bearer $MTOK")
[ "$(echo "$SUM" | jq -r .stats.stamps.value)" -ge 3 ] && ok "analytics summary" || bad "summary" "$SUM"
check "repeat rate present" "100" "$(echo "$SUM" | jq -r .totals.repeatRatePct)"
SER=$(curl -s "$API/merchant/analytics/series?range=7d" -H "Authorization: Bearer $MTOK")
check "series zero-filled to 7 days" "7" "$(echo "$SER" | jq -r 'length')"
TOPC=$(curl -s "$API/merchant/analytics/top-customers" -H "Authorization: Bearer $MTOK")
[ "$(echo "$TOPC" | jq -r 'length')" -ge 1 ] && ok "top customers" || bad "top" "$TOPC"
SPERF=$(curl -s "$API/merchant/analytics/staff?range=30d" -H "Authorization: Bearer $MTOK")
[ "$(echo "$SPERF" | jq -r '.[0].stamps')" -ge 1 ] && ok "staff performance" || bad "staff perf" "$SPERF"

TX=$(curl -s "$API/merchant/transactions?limit=50" -H "Authorization: Bearer $MTOK")
[ "$(echo "$TX" | jq -r .total)" -ge 5 ] && ok "ledger lists entries" || bad "ledger" "$TX"
echo "$TX" | jq -e '.items[] | select(.issuerType=="ADJUSTMENT")' >/dev/null && ok "adjustments appear in ledger" || bad "ledger adjustments" "missing"
echo "$TX" | jq -e '.items[] | select(.reason=="Stamped twice by mistake")' >/dev/null && ok "adjustment reason in ledger" || bad "reason" "missing"
ADJONLY=$(curl -s "$API/merchant/transactions?issuerType=ADJUSTMENT" -H "Authorization: Bearer $MTOK")
check "ledger filters by type" "2" "$(echo "$ADJONLY" | jq -r .total)"
TOT=$(curl -s "$API/merchant/transactions/totals" -H "Authorization: Bearer $MTOK")
check "ledger totals count adjustments" "2" "$(echo "$TOT" | jq -r .adjustments)"

CSV=$(curl -s "$API/merchant/export/customers.csv" -H "Authorization: Bearer $MTOK")
echo "$CSV" | head -1 | grep -q "customer_code,name,phone" && ok "customer CSV header" || bad "csv" "$CSV"
echo "$CSV" | grep -q "Prefers oat milk" && ok "CSV includes notes" || bad "csv notes" "missing"
TCSV=$(curl -s "$API/merchant/export/transactions.csv" -H "Authorization: Bearer $MTOK")
echo "$TCSV" | head -1 | grep -q "timestamp,customer_code" && ok "transactions CSV header" || bad "tx csv" "bad"
RCSV=$(curl -s "$API/merchant/export/rewards.csv" -H "Authorization: Bearer $MTOK")
echo "$RCSV" | head -1 | grep -q "voucher_code,reward" && ok "rewards CSV header" || bad "rewards csv" "bad"

echo "— Settings + branding"
SET=$(curl -s -X PATCH $API/merchant/business -H "Authorization: Bearer $MTOK" -H 'Content-Type: application/json' -d '{"brandColor":"#0D9488","category":"cafe","timezone":"Asia/Kolkata","notifyDailySummary":false}')
check "brand colour saved" "#0D9488" "$(echo "$SET" | jq -r .brandColor)"
check "category saved" "cafe" "$(echo "$SET" | jq -r .category)"
check "notification pref saved" "false" "$(echo "$SET" | jq -r .notifyDailySummary)"
BADCOLOR=$(curl -s -X PATCH $API/merchant/business -H "Authorization: Bearer $MTOK" -H 'Content-Type: application/json' -d '{"brandColor":"not-a-colour"}')
check "invalid colour rejected" "VALIDATION_ERROR" "$(echo "$BADCOLOR" | jq -r .code)"
CT=$(curl -s -X PATCH $API/merchant/business -H "Authorization: Bearer $MTOK" -H 'Content-Type: application/json' -d '{"consentText":"I agree to hear about offers from Smoke Test Cafe."}')
check "consent wording saved" "I agree to hear about offers from Smoke Test Cafe." "$(echo "$CT" | jq -r .consentText)"
PUBC=$(curl -s $API/public/businesses/$SLUG)
check "join page shows brand colour" "#0D9488" "$(echo "$PUBC" | jq -r .brandColor)"
check "join page shows consent text" "I agree to hear about offers from Smoke Test Cafe." "$(echo "$PUBC" | jq -r .consentText)"

echo "— Daily stamp cap"
CAPC=$(curl -s -X PATCH "$API/merchant/campaigns/$CAMP" -H "Authorization: Bearer $MTOK" -H 'Content-Type: application/json' -d '{"dailyStampCap":1,"terms":"One stamp per visit."}')
check "daily cap saved" "1" "$(echo "$CAPC" | jq -r .dailyStampCap)"
check "terms saved" "One stamp per visit." "$(echo "$CAPC" | jq -r .terms)"
sleep 3.2
CAPPED=$(curl -s -X POST $API/staff/stamps -H "Authorization: Bearer $STOK" -H 'Content-Type: application/json' -d "{\"membershipId\":\"$MEMID\"}")
check "daily cap enforced" "DAILY_CAP_REACHED" "$(echo "$CAPPED" | jq -r .code)"
curl -s -X PATCH "$API/merchant/campaigns/$CAMP" -H "Authorization: Bearer $MTOK" -H 'Content-Type: application/json' -d '{"dailyStampCap":0}' >/dev/null


echo "— Staff panel: roles"
SP1="+919814444001"; SP2="+919814444002"
S1=$(curl -s -X POST $API/merchant/staff -H "Authorization: Bearer $MTOK" -H 'Content-Type: application/json' -d "{\"name\":\"Undo Uma\",\"phone\":\"$SP1\"}")
check "new staff defaults to STAFF role" "STAFF" "$(echo "$S1" | jq -r .role)"
S2=$(curl -s -X POST $API/merchant/staff -H "Authorization: Bearer $MTOK" -H 'Content-Type: application/json' -d "{\"name\":\"Mgr Mahi\",\"phone\":\"$SP2\",\"role\":\"MANAGER\"}")
check "staff can be created as MANAGER" "MANAGER" "$(echo "$S2" | jq -r .role)"
S1ID=$(echo "$S1" | jq -r .id)
RD=$(curl -s -X PATCH $API/merchant/staff/$S1ID -H "Authorization: Bearer $MTOK" -H 'Content-Type: application/json' -d '{"role":"MANAGER"}')
check "role changes via PATCH" "MANAGER" "$(echo "$RD" | jq -r .role)"
curl -s -X PATCH $API/merchant/staff/$S1ID -H "Authorization: Bearer $MTOK" -H 'Content-Type: application/json' -d '{"role":"STAFF"}' >/dev/null

D=$(curl -s -X POST $API/auth/staff/otp/request -H 'Content-Type: application/json' -d "{\"phone\":\"$SP1\"}")
V=$(curl -s -X POST $API/auth/staff/otp/verify -H 'Content-Type: application/json' -d "{\"phone\":\"$SP1\",\"code\":\"$(echo "$D" | jq -r .devCode)\"}")
S1TOK=$(echo "$V" | jq -r .session.tokens.accessToken)
check "staff sees own role in context" "STAFF" "$(curl -s $API/staff/context -H "Authorization: Bearer $S1TOK" | jq -r .staff.role)"
D=$(curl -s -X POST $API/auth/staff/otp/request -H 'Content-Type: application/json' -d "{\"phone\":\"$SP2\"}")
V=$(curl -s -X POST $API/auth/staff/otp/verify -H 'Content-Type: application/json' -d "{\"phone\":\"$SP2\",\"code\":\"$(echo "$D" | jq -r .devCode)\"}")
S2TOK=$(echo "$V" | jq -r .session.tokens.accessToken)
check "manager sees MANAGER in context" "MANAGER" "$(curl -s $API/staff/context -H "Authorization: Bearer $S2TOK" | jq -r .staff.role)"

echo "— Staff panel: today stats"
check "staff /today hides team view" "null" "$(curl -s $API/staff/today -H "Authorization: Bearer $S1TOK" | jq -r .team)"
check "manager /today includes team + totals" "true" "$(curl -s $API/staff/today -H "Authorization: Bearer $S2TOK" | jq '.team != null and .totals != null')"

echo "— Staff panel: counter enrolment"
E=$(curl -s -X POST $API/staff/enroll -H "Authorization: Bearer $S1TOK" -H 'Content-Type: application/json' -d '{"identifier":"+919815555001","name":"Enrolled Ed","marketingConsent":true}')
check "counter enrol creates a new customer" "true" "$(echo "$E" | jq -r .isNewCustomer)"
EMEM=$(echo "$E" | jq -r .card.id)
E2=$(curl -s -X POST $API/staff/enroll -H "Authorization: Bearer $S1TOK" -H 'Content-Type: application/json' -d '{"identifier":"+919815555001"}')
check "re-enrol is idempotent" "true" "$(echo "$E2" | jq -r .alreadyMember)"
CN=$(curl -s "$API/merchant/customers/$EMEM/consents" -H "Authorization: Bearer $MTOK")
check "counter consent recorded (channel=counter)" "counter" "$(echo "$CN" | jq -r '.[0].channel')"
EBAD=$(curl -s -X POST $API/staff/enroll -H "Authorization: Bearer $S1TOK" -H 'Content-Type: application/json' -d '{"identifier":"1"}')
check "enrol with a bad phone → 400" "400" "$(echo "$EBAD" | jq -r .statusCode)"

# A customer identified by email is a complete customer — this is what lets a
# shop enrol and serve people before SMS delivery is available.
EE=$(curl -s -X POST $API/staff/enroll -H "Authorization: Bearer $S1TOK" -H 'Content-Type: application/json' -d '{"identifier":"Counter.Customer@Example.com","name":"Email Ellie"}')
check "counter enrol by email creates a customer" "true" "$(echo "$EE" | jq -r .isNewCustomer)"
EEMEM=$(echo "$EE" | jq -r .card.id)
check "email is normalised to lowercase" "counter.customer@example.com" "$(echo "$EE" | jq -r .card.customer.email)"
check "email customer has no phone" "null" "$(echo "$EE" | jq -r .card.customer.phone)"
check "contact falls back to the email" "counter.customer@example.com" "$(echo "$EE" | jq -r .card.customer.contact)"
EE2=$(curl -s -X POST $API/staff/enroll -H "Authorization: Bearer $S1TOK" -H 'Content-Type: application/json' -d '{"identifier":"COUNTER.CUSTOMER@example.com"}')
check "re-enrol by email is idempotent regardless of case" "true" "$(echo "$EE2" | jq -r .alreadyMember)"
ESRCH=$(curl -s "$API/staff/customers/search?q=counter.customer" -H "Authorization: Bearer $S1TOK")
check "counter search finds an email customer" "$EEMEM" "$(echo "$ESRCH" | jq -r '.[0].id')"
EBADM=$(curl -s -X POST $API/staff/enroll -H "Authorization: Bearer $S1TOK" -H 'Content-Type: application/json' -d '{"identifier":"not-an-email@"}')
check "enrol with a malformed email → 400" "400" "$(echo "$EBADM" | jq -r .statusCode)"

echo "— Staff panel: undo"
A=$(curl -s -X POST $API/staff/stamps -H "Authorization: Bearer $S1TOK" -H 'Content-Type: application/json' -d "{\"membershipId\":\"$EMEM\"}")
check "staff stamps the enrolled card" "1" "$(echo "$A" | jq -r .card.stampCount)"
U=$(curl -s -X POST $API/staff/stamps/undo -H "Authorization: Bearer $S1TOK" -H 'Content-Type: application/json' -d "{\"membershipId\":\"$EMEM\"}")
check "own stamp undone within 60s" "0" "$(echo "$U" | jq -r .card.stampCount)"
U2=$(curl -s -X POST $API/staff/stamps/undo -H "Authorization: Bearer $S1TOK" -H 'Content-Type: application/json' -d "{\"membershipId\":\"$EMEM\"}")
check "nothing left to undo" "NOTHING_TO_UNDO" "$(echo "$U2" | jq -r .code)"
DET=$(curl -s "$API/merchant/customers/$EMEM" -H "Authorization: Bearer $MTOK")
check "lifetime count rolled back too" "0" "$(echo "$DET" | jq -r .totalStamps)"
sleep 3.2
A=$(curl -s -X POST $API/staff/stamps -H "Authorization: Bearer $S1TOK" -H 'Content-Type: application/json' -d "{\"membershipId\":\"$EMEM\"}")
U=$(curl -s -X POST $API/staff/stamps/undo -H "Authorization: Bearer $S2TOK" -H 'Content-Type: application/json' -d "{\"membershipId\":\"$EMEM\"}")
check "manager undoes another's stamp" "0" "$(echo "$U" | jq -r .card.stampCount)"
sleep 3.2
A=$(curl -s -X POST $API/staff/stamps -H "Authorization: Bearer $S2TOK" -H 'Content-Type: application/json' -d "{\"membershipId\":\"$EMEM\"}")
U=$(curl -s -X POST $API/staff/stamps/undo -H "Authorization: Bearer $S1TOK" -H 'Content-Type: application/json' -d "{\"membershipId\":\"$EMEM\"}")
check "staff cannot undo someone else's stamp" "UNDO_NOT_YOURS" "$(echo "$U" | jq -r .code)"
U=$(curl -s -X POST $API/staff/stamps/undo -H "Authorization: Bearer $S2TOK" -H 'Content-Type: application/json' -d "{\"membershipId\":\"$EMEM\"}")
check "manager cleans it up" "0" "$(echo "$U" | jq -r .card.stampCount)"
sleep 3.2
A=$(curl -s -X POST $API/staff/stamps -H "Authorization: Bearer $S1TOK" -H 'Content-Type: application/json' -d "{\"membershipId\":\"$EMEM\"}")
$PSQL -Atc "update stamps set created_at = created_at - interval '2 minutes' where id=(select id from stamps where membership_id='$EMEM' and delta > 0 and undone_at is null order by created_at desc limit 1);" >/dev/null
U=$(curl -s -X POST $API/staff/stamps/undo -H "Authorization: Bearer $S1TOK" -H 'Content-Type: application/json' -d "{\"membershipId\":\"$EMEM\"}")
check "60s window enforced for staff" "UNDO_WINDOW_EXPIRED" "$(echo "$U" | jq -r .code)"
U=$(curl -s -X POST $API/staff/stamps/undo -H "Authorization: Bearer $S2TOK" -H 'Content-Type: application/json' -d "{\"membershipId\":\"$EMEM\"}")
check "manager window covers 15 min" "0" "$(echo "$U" | jq -r .card.stampCount)"

echo "— Staff panel: undo vs rewards"
ADJ=$(curl -s -X POST "$API/merchant/customers/$EMEM/adjust" -H "Authorization: Bearer $MTOK" -H 'Content-Type: application/json' -d '{"delta":2,"reason":"Test prep balance"}')
check "owner adjustment applied (+2)" "2" "$(echo "$ADJ" | jq -r .card.stampCount)"
U=$(curl -s -X POST $API/staff/stamps/undo -H "Authorization: Bearer $S1TOK" -H 'Content-Type: application/json' -d "{\"membershipId\":\"$EMEM\"}")
check "adjustments cannot be undone by staff" "UNDO_NOT_A_STAMP" "$(echo "$U" | jq -r .code)"
sleep 3.2
A=$(curl -s -X POST $API/staff/stamps -H "Authorization: Bearer $S1TOK" -H 'Content-Type: application/json' -d "{\"membershipId\":\"$EMEM\"}")
check "third stamp completes the card" "true" "$(echo "$A" | jq -r .rewardEarned)"
RID2=$(echo "$A" | jq -r .redemption.id)
U=$(curl -s -X POST $API/staff/stamps/undo -H "Authorization: Bearer $S1TOK" -H 'Content-Type: application/json' -d "{\"membershipId\":\"$EMEM\"}")
check "undoing a completion voids the voucher" "true" "$(echo "$U" | jq -r .voucherVoided)"
check "card rolled back below the line" "2" "$(echo "$U" | jq -r .card.stampCount)"
VLIST=$(curl -s "$API/merchant/redemptions?status=VOID" -H "Authorization: Bearer $MTOK")
check "voided voucher visible to merchant" "true" "$(echo "$VLIST" | jq --arg id "$RID2" '[.items[].id] | index($id) != null')"
sleep 3.2
A=$(curl -s -X POST $API/staff/stamps -H "Authorization: Bearer $S1TOK" -H 'Content-Type: application/json' -d "{\"membershipId\":\"$EMEM\"}")
RID3=$(echo "$A" | jq -r .redemption.id)
RR=$(curl -s -X POST $API/staff/redemptions/redeem -H "Authorization: Bearer $S1TOK" -H 'Content-Type: application/json' -d "{\"redemptionId\":\"$RID3\"}")
check "reward handed over at the counter" "REDEEMED" "$(echo "$RR" | jq -r .redemption.status)"
U=$(curl -s -X POST $API/staff/stamps/undo -H "Authorization: Bearer $S1TOK" -H 'Content-Type: application/json' -d "{\"membershipId\":\"$EMEM\"}")
check "handed-over rewards block undo" "UNDO_REWARD_REDEEMED" "$(echo "$U" | jq -r .code)"

echo "— Staff panel: undo frees the daily cap"
curl -s -X PATCH "$API/merchant/campaigns/$CAMP" -H "Authorization: Bearer $MTOK" -H 'Content-Type: application/json' -d '{"dailyStampCap":2}' >/dev/null
sleep 3.2
A=$(curl -s -X POST $API/staff/stamps -H "Authorization: Bearer $S1TOK" -H 'Content-Type: application/json' -d "{\"membershipId\":\"$EMEM\"}")
check "cap: second standing stamp ok" "201" "$(echo "$A" | jq -r 'if .card then 201 else .statusCode end')"
sleep 3.2
A2=$(curl -s -X POST $API/staff/stamps -H "Authorization: Bearer $S1TOK" -H 'Content-Type: application/json' -d "{\"membershipId\":\"$EMEM\"}")
check "cap: third blocked" "DAILY_CAP_REACHED" "$(echo "$A2" | jq -r .code)"
U=$(curl -s -X POST $API/staff/stamps/undo -H "Authorization: Bearer $S1TOK" -H 'Content-Type: application/json' -d "{\"membershipId\":\"$EMEM\"}")
check "undo the second stamp" "true" "$(echo "$U" | jq 'has("card")')"
sleep 3.2
A3=$(curl -s -X POST $API/staff/stamps -H "Authorization: Bearer $S1TOK" -H 'Content-Type: application/json' -d "{\"membershipId\":\"$EMEM\"}")
check "undo freed the daily allowance" "true" "$(echo "$A3" | jq 'has("card")')"
curl -s -X PATCH "$API/merchant/campaigns/$CAMP" -H "Authorization: Bearer $MTOK" -H 'Content-Type: application/json' -d '{"dailyStampCap":0}' >/dev/null

echo "— Card QR for counter scanning"
QR=$(curl -s "$API/customer/cards/$MEMID/qr" -H "Authorization: Bearer $CTOK")
echo "$QR" | jq -r .dataUrl | grep -q "^data:image/png" && ok "card QR is a png data url" || bad "card QR" "$QR"
check "card QR encodes the display code" "9" "$(echo "$QR" | jq -r '.code | length')"


echo "— Wallet passes"
WAV=$(curl -s "$API/customer/cards/$MEMID/wallet" -H "Authorization: Bearer $CTOK")
if [ "$(echo "$WAV" | jq -r .apple.available)" != "true" ]; then
  echo "  (wallet fixtures not configured — skipping wallet assertions)"
else
  check "both wallets available" "true true" "$(echo "$WAV" | jq -r '.apple.available') $(echo "$WAV" | jq -r '.google.available')"
  curl -s "$API/customer/cards/$MEMID/wallet/apple.pkpass" -H "Authorization: Bearer $CTOK" -o /tmp/smoke.pkpass -D /tmp/smoke-pkpass-headers.txt
  grep -qi "application/vnd.apple.pkpass" /tmp/smoke-pkpass-headers.txt && ok "pkpass content type" || bad "pkpass content type" "$(head -3 /tmp/smoke-pkpass-headers.txt)"
  PKCHECK=$(python3 - <<'PYEOF'
import zipfile, json, hashlib
z = zipfile.ZipFile('/tmp/smoke.pkpass')
names = set(z.namelist())
need = {'pass.json', 'manifest.json', 'signature', 'icon.png'}
if not need.issubset(names):
    print('missing files'); raise SystemExit
man = json.loads(z.read('manifest.json'))
for name, sha in man.items():
    if hashlib.sha1(z.read(name)).hexdigest() != sha:
        print('hash mismatch ' + name); raise SystemExit
pj = json.loads(z.read('pass.json'))
print('ok ' + pj['storeCard']['primaryFields'][0]['value'])
PYEOF
)
  echo "$PKCHECK" | grep -q "^ok" && ok "pkpass structure + manifest hashes ($PKCHECK)" || bad "pkpass structure" "$PKCHECK"
  GW=$(curl -s -X POST "$API/customer/cards/$MEMID/wallet/google" -H "Authorization: Bearer $CTOK")
  echo "$GW" | jq -r .saveUrl | grep -q "^https://pay.google.com/gp/v/save/" && ok "google save link minted" || bad "google link" "$GW"

  WTOK=$($PSQL -Atc "select apple_auth_token from wallet_passes where membership_id='$MEMID';")
  PT="pass.dev.stamposa"; WDEV="smoke-device-1"
  R=$(curl -s -X POST "$API/wallet/apple/v1/devices/$WDEV/registrations/$PT/$MEMID" -H "Authorization: ApplePass $WTOK" -H 'Content-Type: application/json' -d '{"pushToken":"smoke-push"}' -o /dev/null -w "%{http_code}")
  check "device registers for updates" "201" "$R"
  R=$(curl -s -X POST "$API/wallet/apple/v1/devices/$WDEV/registrations/$PT/$MEMID" -H "Authorization: ApplePass wrong" -H 'Content-Type: application/json' -d '{"pushToken":"x"}' -o /dev/null -w "%{http_code}")
  check "wrong pass token rejected" "401" "$R"
  SINCE=$(date +%s)
  sleep 3.2
  curl -s -X POST $API/staff/stamps -H "Authorization: Bearer $S1TOK" -H 'Content-Type: application/json' -d "{\"membershipId\":\"$MEMID\"}" >/dev/null
  sleep 1
  UPD=$(curl -s "$API/wallet/apple/v1/devices/$WDEV/registrations/$PT?passesUpdatedSince=$SINCE")
  echo "$UPD" | jq -r '.serialNumbers[]' 2>/dev/null | grep -q "$MEMID" && ok "stamp bumps passesUpdatedSince" || bad "updatedSince" "$UPD"
  curl -s "$API/wallet/apple/v1/passes/$PT/$MEMID" -H "Authorization: ApplePass $WTOK" -o /tmp/smoke2.pkpass -w "" 
  python3 -c "
import zipfile, json
z = zipfile.ZipFile('/tmp/smoke2.pkpass')
print(json.loads(z.read('pass.json'))['storeCard']['primaryFields'][0]['value'])" | grep -q "of" && ok "device refetches updated pass" || bad "device refetch" "?"
  R=$(curl -s -X DELETE "$API/wallet/apple/v1/devices/$WDEV/registrations/$PT/$MEMID" -H "Authorization: ApplePass $WTOK" -o /dev/null -w "%{http_code}")
  check "device unregisters" "200" "$R"
fi

echo "— Multi-tenant isolation"
D=$(curl -s -X POST $API/auth/merchant/otp/request -H 'Content-Type: application/json' -d '{"phone":"+919876500001"}')
CODE=$(echo "$D" | jq -r .devCode)
V=$(curl -s -X POST $API/auth/merchant/otp/verify -H 'Content-Type: application/json' -d "{\"phone\":\"+919876500001\",\"code\":\"$CODE\"}")
ATOK=$(echo "$V" | jq -r .session.tokens.accessToken)
check "seeded merchant logs straight in" "AUTHENTICATED" "$(echo "$V" | jq -r .status)"
X=$(curl -s "$API/merchant/customers/$MEMID" -H "Authorization: Bearer $ATOK")
check "other tenant's member → 404" "404" "$(echo "$X" | jq -r .statusCode)"
X2=$(curl -s -X POST "$API/merchant/customers/$MEMID/stamps" -H "Authorization: Bearer $ATOK")
check "other tenant can't stamp → 404" "404" "$(echo "$X2" | jq -r .statusCode)"
X3=$(curl -s -X POST "$API/merchant/redemptions/redeem" -H "Authorization: Bearer $ATOK" -H 'Content-Type: application/json' -d "{\"redemptionId\":\"$RID\"}")
check "other tenant can't see voucher → 404" "404" "$(echo "$X3" | jq -r .statusCode)"
ADB=$(curl -s $API/merchant/dashboard -H "Authorization: Bearer $ATOK")
check "seeded dashboard sees own 8 customers" "8" "$(echo "$ADB" | jq -r .stats.customers)"

echo "— Role guards + token lifecycle"
X=$(curl -s $API/merchant/dashboard -H "Authorization: Bearer $CTOK")
check "customer token on merchant route → 403" "403" "$(echo "$X" | jq -r .statusCode)"
X=$(curl -s $API/customer/cards)
check "no token → 401" "401" "$(echo "$X" | jq -r .statusCode)"
NEW=$(curl -s -X POST $API/auth/refresh -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$MREF\"}")
[ "$(echo "$NEW" | jq -r .accessToken)" != "null" ] && ok "refresh rotates tokens" || bad "refresh" "$NEW"
OLD=$(curl -s -X POST $API/auth/refresh -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$MREF\"}")
check "old refresh token revoked" "SESSION_EXPIRED" "$(echo "$OLD" | jq -r .code)"

echo ""
echo "RESULT: $PASS passed, $FAIL failed"
[ $FAIL -eq 0 ]
