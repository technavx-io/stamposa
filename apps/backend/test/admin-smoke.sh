#!/bin/bash
# End-to-end smoke test for the admin panel.
set -u
API=http://localhost:4000/v1
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1  →  $2"; }
check() { if [ "$2" = "$3" ]; then ok "$1"; else bad "$1" "expected [$2] got [$3]"; fi; }

PW="${SEED_ADMIN_PASSWORD:-ChangeMe!2026}"

echo "— Admin login (step 1)"
L=$(curl -s -X POST $API/admin/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"owner@stamposa.com\",\"password\":\"$PW\"}")
LOGIN_STATUS=$(echo "$L" | jq -r .status)
# The suite adapts to ADMIN_REQUIRE_2FA so it passes in both modes.
if [ "$LOGIN_STATUS" = "AUTHENTICATED" ]; then
  TWOFA_MODE="off"
  ok "password-only sign-in (ADMIN_REQUIRE_2FA=false)"
else
  TWOFA_MODE="on"
  check "password step needs 2FA setup" "TWO_FACTOR_SETUP_REQUIRED" "$LOGIN_STATUS"
fi

BAD=$(curl -s -X POST $API/admin/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"owner@stamposa.com\",\"password\":\"wrongpassword\"}")
check "wrong password rejected" "INVALID_CREDENTIALS" "$(echo "$BAD" | jq -r .code)"
NOBODY=$(curl -s -X POST $API/admin/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"nobody@stamposa.com\",\"password\":\"wrongpassword\"}")
check "unknown email gives same error" "INVALID_CREDENTIALS" "$(echo "$NOBODY" | jq -r .code)"

if [ "$TWOFA_MODE" = "on" ]; then
  T2=$(echo "$L" | jq -r .twoFactorToken)
  SECRET=$(echo "$L" | jq -r .twoFactorSetup.secret)
  [ ${#SECRET} -ge 16 ] && ok "TOTP secret issued" || bad "secret" "$L"
  echo "$L" | jq -r .twoFactorSetup.qrDataUrl | grep -q "^data:image/png" && ok "enrolment QR generated" || bad "QR" "no qr"

  echo "— TOTP enrolment"
  CODE=$(node -e "const {authenticator}=require('otplib');console.log(authenticator.generate('$SECRET'))" 2>/dev/null)
  [ ${#CODE} = 6 ] && ok "generated TOTP code" || bad "totp gen" "$CODE"
  E=$(curl -s -X POST $API/admin/auth/2fa/enroll -H 'Content-Type: application/json' -d "{\"twoFactorToken\":\"$T2\",\"code\":\"$CODE\"}")
  check "enrolment authenticates" "AUTHENTICATED" "$(echo "$E" | jq -r .status)"
  check "recovery codes issued" "8" "$(echo "$E" | jq -r '.recoveryCodes | length')"

  echo "— Second login uses the authenticator"
  L2=$(curl -s -X POST $API/admin/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"owner@stamposa.com\",\"password\":\"$PW\"}")
  check "now requires 2FA code" "TWO_FACTOR_REQUIRED" "$(echo "$L2" | jq -r .status)"
  T2B=$(echo "$L2" | jq -r .twoFactorToken)
  WRONG=$(curl -s -X POST $API/admin/auth/2fa/verify -H 'Content-Type: application/json' -d "{\"twoFactorToken\":\"$T2B\",\"code\":\"000000\"}")
  check "wrong 2FA code rejected" "TWO_FACTOR_INVALID" "$(echo "$WRONG" | jq -r .code)"
else
  E="$L"
fi

ATOK=$(echo "$E" | jq -r .tokens.accessToken)
AREF=$(echo "$E" | jq -r .tokens.refreshToken)
check "role is super admin" "SUPER_ADMIN" "$(echo "$E" | jq -r .admin.role)"

echo "— Guards"
NOAUTH=$(curl -s $API/admin/dashboard)
check "no token → 401" "401" "$(echo "$NOAUTH" | jq -r .statusCode)"
MC=$(curl -s -X POST $API/auth/merchant/otp/request -H 'Content-Type: application/json' -d '{"phone":"+919876500001"}' | jq -r .devCode)
MTOK=$(curl -s -X POST $API/auth/merchant/otp/verify -H 'Content-Type: application/json' -d "{\"phone\":\"+919876500001\",\"code\":\"$MC\"}" | jq -r .session.tokens.accessToken)
X=$(curl -s $API/admin/dashboard -H "Authorization: Bearer $MTOK")
check "merchant token cannot reach admin" "401" "$(echo "$X" | jq -r .statusCode)"
Y=$(curl -s $API/merchant/dashboard -H "Authorization: Bearer $ATOK")
check "admin token cannot reach merchant" "401" "$(echo "$Y" | jq -r .statusCode)"

echo "— Dashboard"
D=$(curl -s $API/admin/dashboard -H "Authorization: Bearer $ATOK")
check "merchant count" "2" "$(echo "$D" | jq -r .stats.merchants)"
[ "$(echo "$D" | jq -r '.attention | length')" -ge 1 ] && ok "attention queue populated" || bad "attention" "$D"
[ "$(echo "$D" | jq -r '.recentSignups | length')" -ge 2 ] && ok "recent signups listed" || bad "signups" "$D"

echo "— Merchants"
M=$(curl -s "$API/admin/merchants?limit=50" -H "Authorization: Bearer $ATOK")
check "lists both tenants" "2" "$(echo "$M" | jq -r .total)"
BID=$(echo "$M" | jq -r '.items[] | select(.slug=="brew-and-bean") | .id')
[ -n "$BID" ] && ok "found brew-and-bean ($BID)" || bad "find tenant" "$M"
echo "$M" | jq -e '.items[0].health' >/dev/null && ok "health grade computed" || bad "health" "$M"
SR=$(curl -s "$API/admin/merchants?search=glow" -H "Authorization: Bearer $ATOK")
check "search by name" "1" "$(echo "$SR" | jq -r .total)"
DET=$(curl -s "$API/admin/merchants/$BID" -H "Authorization: Bearer $ATOK")
check "detail name" "Brew & Bean Coffee" "$(echo "$DET" | jq -r .name)"
check "detail customers" "8" "$(echo "$DET" | jq -r .stats.customers)"
check "detail staff listed" "2" "$(echo "$DET" | jq -r '.staff | length')"
CUS=$(curl -s "$API/admin/merchants/$BID/customers" -H "Authorization: Bearer $ATOK")
check "tenant customers" "8" "$(echo "$CUS" | jq -r .total)"

echo "— Notes"
N=$(curl -s -X PATCH "$API/admin/merchants/$BID/notes" -H "Authorization: Bearer $ATOK" -H 'Content-Type: application/json' -d '{"notes":"Prefers WhatsApp. Second outlet in March."}')
check "notes saved" "Prefers WhatsApp. Second outlet in March." "$(echo "$N" | jq -r .adminNotes)"

echo "— Suspension"
WRONGNAME=$(curl -s -X POST "$API/admin/merchants/$BID/suspend" -H "Authorization: Bearer $ATOK" -H 'Content-Type: application/json' -d '{"reason":"Testing suspension flow","confirmName":"Wrong Name"}')
check "typed confirmation enforced" "CONFIRMATION_MISMATCH" "$(echo "$WRONGNAME" | jq -r .code)"
S=$(curl -s -X POST "$API/admin/merchants/$BID/suspend" -H "Authorization: Bearer $ATOK" -H 'Content-Type: application/json' -d '{"reason":"Testing suspension flow","confirmName":"Brew & Bean Coffee"}')
check "suspended" "true" "$(echo "$S" | jq -r .suspended)"
MLOGIN=$(curl -s -X POST $API/auth/merchant/otp/request -H 'Content-Type: application/json' -d '{"phone":"+919876500001"}')
check "suspended merchant blocked at login" "BUSINESS_SUSPENDED" "$(echo "$MLOGIN" | jq -r .code)"
MSESSION=$(curl -s $API/merchant/dashboard -H "Authorization: Bearer $MTOK")
check "existing merchant session killed" "BUSINESS_SUSPENDED" "$(echo "$MSESSION" | jq -r .code)"
SLOGIN=$(curl -s -X POST $API/auth/staff/otp/request -H 'Content-Type: application/json' -d '{"phone":"+919876500002"}')
check "staff blocked too" "BUSINESS_SUSPENDED" "$(echo "$SLOGIN" | jq -r .code)"
PUB=$(curl -s $API/public/businesses/brew-and-bean)
check "join page stops accepting" "false" "$(echo "$PUB" | jq -r .acceptingJoins)"
DUP=$(curl -s -X POST "$API/admin/merchants/$BID/suspend" -H "Authorization: Bearer $ATOK" -H 'Content-Type: application/json' -d '{"reason":"Testing suspension flow","confirmName":"Brew & Bean Coffee"}')
check "double suspend blocked" "ALREADY_SUSPENDED" "$(echo "$DUP" | jq -r .code)"
R=$(curl -s -X POST "$API/admin/merchants/$BID/reactivate" -H "Authorization: Bearer $ATOK")
check "reactivated" "false" "$(echo "$R" | jq -r .suspended)"
PUB2=$(curl -s $API/public/businesses/brew-and-bean)
check "join page works again" "true" "$(echo "$PUB2" | jq -r .acceptingJoins)"

echo "— Impersonation"
SHORT=$(curl -s -X POST "$API/admin/merchants/$BID/impersonate" -H "Authorization: Bearer $ATOK" -H 'Content-Type: application/json' -d '{"reason":"short"}')
check "reason minimum enforced" "VALIDATION_ERROR" "$(echo "$SHORT" | jq -r .code)"
IMP=$(curl -s -X POST "$API/admin/merchants/$BID/impersonate" -H "Authorization: Bearer $ATOK" -H 'Content-Type: application/json' -d '{"reason":"Investigating reported stamping issue"}')
ITOK=$(echo "$IMP" | jq -r .tokens.accessToken)
check "impersonation business" "Brew & Bean Coffee" "$(echo "$IMP" | jq -r .businessName)"
IMPD=$(curl -s $API/merchant/dashboard -H "Authorization: Bearer $ITOK")
check "impersonation token works as merchant" "8" "$(echo "$IMPD" | jq -r .stats.customers)"

echo "— Customer lookup (privacy)"
LK=$(curl -s -X POST $API/admin/customers/lookup -H "Authorization: Bearer $ATOK" -H 'Content-Type: application/json' -d '{"phone":"+919876501101","reason":"Customer asked which businesses hold their data"}')
check "customer found" "true" "$(echo "$LK" | jq -r .found)"
check "shows cross-tenant memberships" "2" "$(echo "$LK" | jq -r '.customer.memberships | length')"
NF=$(curl -s -X POST $API/admin/customers/lookup -H "Authorization: Bearer $ATOK" -H 'Content-Type: application/json' -d '{"phone":"+919999999999","reason":"Checking a support request"}')
check "unknown phone handled" "false" "$(echo "$NF" | jq -r .found)"

echo "— Audit log"
AU=$(curl -s "$API/admin/audit?limit=100" -H "Authorization: Bearer $ATOK")
[ "$(echo "$AU" | jq -r .total)" -ge 8 ] && ok "audit entries recorded ($(echo "$AU" | jq -r .total))" || bad "audit count" "$AU"
AUDITED_ACTIONS="admin.login merchant.suspended merchant.reactivated merchant.impersonated customer.looked_up"
# Only expect an enrolment entry when the authenticator step actually ran.
[ "$TWOFA_MODE" = "on" ] && AUDITED_ACTIONS="$AUDITED_ACTIONS admin.2fa.enrolled"
for ACT in $AUDITED_ACTIONS; do
  echo "$AU" | jq -e --arg a "$ACT" '.items[] | select(.action==$a)' >/dev/null && ok "logged: $ACT" || bad "logged: $ACT" "missing"
done
if [ "$TWOFA_MODE" = "off" ]; then
  echo "$AU" | jq -e '.items[] | select(.action=="admin.login") | select(.reason | test("Two-factor disabled"))' >/dev/null \
    && ok "password-only sign-in flagged in the audit trail" \
    || bad "2fa-disabled note" "missing"
fi
echo "$AU" | jq -e '.items[] | select(.action=="merchant.suspended") | select(.reason=="Testing suspension flow")' >/dev/null && ok "suspension reason captured" || bad "reason" "missing"
echo "$AU" | jq -e '.items[] | select(.action=="customer.looked_up") | select(.targetLabel | test("•"))' >/dev/null && ok "looked-up phone is masked in log" || bad "masking" "not masked"
FIL=$(curl -s "$API/admin/audit?action=merchant." -H "Authorization: Bearer $ATOK")
[ "$(echo "$FIL" | jq -r .total)" -ge 3 ] && ok "audit filter by action prefix" || bad "audit filter" "$FIL"

echo "— Team management"
TEAM=$(curl -s $API/admin/team -H "Authorization: Bearer $ATOK")
check "team lists 3 admins" "3" "$(echo "$TEAM" | jq -r 'length')"
NEW=$(curl -s -X POST $API/admin/team -H "Authorization: Bearer $ATOK" -H 'Content-Type: application/json' -d '{"email":"finance@stamposa.com","name":"Finance Lead","role":"FINANCE"}')
check "created admin" "finance@stamposa.com" "$(echo "$NEW" | jq -r .admin.email)"
[ "$(echo "$NEW" | jq -r '.temporaryPassword | length')" -ge 8 ] && ok "temporary password returned once" || bad "temp password" "$NEW"
NID=$(echo "$NEW" | jq -r .admin.id)
DUPE=$(curl -s -X POST $API/admin/team -H "Authorization: Bearer $ATOK" -H 'Content-Type: application/json' -d '{"email":"finance@stamposa.com","name":"Dupe","role":"OPS"}')
check "duplicate email blocked" "ADMIN_EXISTS" "$(echo "$DUPE" | jq -r .code)"
UPD=$(curl -s -X PATCH "$API/admin/team/$NID" -H "Authorization: Bearer $ATOK" -H 'Content-Type: application/json' -d '{"isActive":false}')
check "deactivated" "false" "$(echo "$UPD" | jq -r .isActive)"
SELF=$(echo "$E" | jq -r .admin.id)
SELFD=$(curl -s -X PATCH "$API/admin/team/$SELF" -H "Authorization: Bearer $ATOK" -H 'Content-Type: application/json' -d '{"isActive":false}')
check "cannot deactivate self" "CANNOT_DEACTIVATE_SELF" "$(echo "$SELFD" | jq -r .code)"

echo "— Role permissions"
SL=$(curl -s -X POST $API/admin/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"support@stamposa.com\",\"password\":\"$PW\"}")
if [ "$(echo "$SL" | jq -r .status)" = "AUTHENTICATED" ]; then
  SE="$SL"
else
  ST2=$(echo "$SL" | jq -r .twoFactorToken)
  SSEC=$(echo "$SL" | jq -r .twoFactorSetup.secret)
  SCODE=$(node -e "const {authenticator}=require('otplib');console.log(authenticator.generate('$SSEC'))" 2>/dev/null)
  SE=$(curl -s -X POST $API/admin/auth/2fa/enroll -H 'Content-Type: application/json' -d "{\"twoFactorToken\":\"$ST2\",\"code\":\"$SCODE\"}")
fi
STOK=$(echo "$SE" | jq -r .tokens.accessToken)
check "support can read merchants" "2" "$(curl -s "$API/admin/merchants?limit=5" -H "Authorization: Bearer $STOK" | jq -r .total)"
SUSP=$(curl -s -X POST "$API/admin/merchants/$BID/suspend" -H "Authorization: Bearer $STOK" -H 'Content-Type: application/json' -d '{"reason":"Should not be allowed","confirmName":"Brew & Bean Coffee"}')
check "support cannot suspend" "INSUFFICIENT_ROLE" "$(echo "$SUSP" | jq -r .code)"
STEAM=$(curl -s $API/admin/team -H "Authorization: Bearer $STOK")
check "support cannot manage team" "INSUFFICIENT_ROLE" "$(echo "$STEAM" | jq -r .code)"


echo "— Customer erasure (DPDP)"
EC=$(curl -s -X POST $API/admin/customers/lookup -H "Authorization: Bearer $ATOK" -H 'Content-Type: application/json' -d '{"phone":"+919876501107","reason":"Erasure smoke verification"}')
check "target customer found" "true" "$(echo "$EC" | jq -r .found)"
ECID=$(echo "$EC" | jq -r .customer.id)
X=$(curl -s -X POST "$API/admin/customers/$ECID/erase" -H "Authorization: Bearer $STOK" -H 'Content-Type: application/json' -d '{"reason":"Support should not erase","confirm":"ERASE"}')
check "support blocked from erasing" "INSUFFICIENT_ROLE" "$(echo "$X" | jq -r .code)"
X=$(curl -s -X POST "$API/admin/customers/$ECID/erase" -H "Authorization: Bearer $ATOK" -H 'Content-Type: application/json' -d '{"reason":"Verified DPDP request","confirm":"nope"}')
check "typed confirmation required" "CONFIRMATION_MISMATCH" "$(echo "$X" | jq -r .code)"
X=$(curl -s -X POST "$API/admin/customers/$ECID/erase" -H "Authorization: Bearer $ATOK" -H 'Content-Type: application/json' -d '{"reason":"Verified DPDP request","confirm":"ERASE"}')
check "erasure succeeds for super admin" "true" "$(echo "$X" | jq -r .erased)"
X=$(curl -s -X POST $API/admin/customers/lookup -H "Authorization: Bearer $ATOK" -H 'Content-Type: application/json' -d '{"phone":"+919876501107","reason":"Post-erasure check"}')
check "erased phone no longer found" "false" "$(echo "$X" | jq -r .found)"
X=$(curl -s -X POST "$API/admin/customers/$ECID/erase" -H "Authorization: Bearer $ATOK" -H 'Content-Type: application/json' -d '{"reason":"Verified DPDP request","confirm":"ERASE"}')
check "double erasure refused" "ALREADY_ERASED" "$(echo "$X" | jq -r .code)"
AU=$(curl -s "$API/admin/audit?action=customer.erased&limit=5" -H "Authorization: Bearer $ATOK")
check "erasure audit-logged" "customer.erased" "$(echo "$AU" | jq -r '.items[0].action')"

echo "— Health + session lifecycle"
H=$(curl -s $API/admin/health -H "Authorization: Bearer $ATOK")
check "health reports services" "3" "$(echo "$H" | jq -r '.services | length')"
check "database up" "up" "$(echo "$H" | jq -r '.services[] | select(.name=="PostgreSQL") | .status')"
NEWTOK=$(curl -s -X POST $API/admin/auth/refresh -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$AREF\"}")
[ "$(echo "$NEWTOK" | jq -r .tokens.accessToken)" != "null" ] && ok "admin refresh rotates" || bad "refresh" "$NEWTOK"
OLD=$(curl -s -X POST $API/admin/auth/refresh -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$AREF\"}")
check "old admin refresh revoked" "SESSION_EXPIRED" "$(echo "$OLD" | jq -r .code)"

echo ""
echo "RESULT: $PASS passed, $FAIL failed"
[ $FAIL -eq 0 ]
