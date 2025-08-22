#!/usr/bin/env bash
# Full replacement: scripts/smoke.sh
# Usage: ./scripts/smoke.sh
set -euo pipefail

ROOT="${HOME}/projects/carbonpasture/application-gateway"
API="http://127.0.0.1:3000"
USSD="http://127.0.0.1:4000"
TMPDIR=$(mktemp -d)
LOG="$ROOT/logs/smoke.$(date -u +%Y%m%dT%H%M%SZ).log"

echo "SMOKE RUN: $(date -u)" | tee "$LOG"

fail=0

# 1) Check processes/ports
echo "- Checking listeners on :3000 and :4000" | tee -a "$LOG"
if ss -ltnp | grep -q ':3000 '; then echo "  :3000 OK" | tee -a "$LOG"; else echo "  :3000 NOT LISTENING" | tee -a "$LOG"; fail=1; fi
if ss -ltnp | grep -q ':4000 '; then echo "  :4000 OK" | tee -a "$LOG"; else echo "  :4000 NOT LISTENING" | tee -a "$LOG"; fail=1; fi

# 2) API health
echo "- /health" | tee -a "$LOG"
if curl -sS --max-time 5 "$API/health" | grep -q '"ok":true'; then echo "  API /health OK" | tee -a "$LOG"; else echo "  API /health FAILED" | tee -a "$LOG"; fail=1; fi

# 3) USSD health (test menu)
echo "- USSD menu" | tee -a "$LOG"
usd=$(curl -sS --data "sessionId=smokesess1" --data "phoneNumber=+254700000000" --data "text=" "$USSD/ussd" || true)
if echo "$usd" | grep -q 'Submit methane reading'; then echo "  USSD menu OK" | tee -a "$LOG"; else echo "  USSD menu FAILED: $usd" | tee -a "$LOG"; fail=1; fi

# 4) Create a test record via REST API
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
ID="smoke$(date +%s)"
RECORD_JSON=$(printf '{"ID":"%s","farmID":"farmSmoke","methanePPM":%s,"timestamp":"%s"}' "$ID" "7.77" "$TS")
echo "- POST /records -> $ID" | tee -a "$LOG"
post=$(curl -sS -H "Content-Type: application/json" -d "$RECORD_JSON" "$API/records" || true)
if echo "$post" | grep -q '"success":true'; then echo "  POST OK: $post" | tee -a "$LOG"; else echo "  POST FAILED: $post" | tee -a "$LOG"; fail=1; fi

# 5) GET the record back
echo "- GET /records/$ID" | tee -a "$LOG"
get=$(curl -sS "$API/records/$ID" || true)
if echo "$get" | grep -q '"ID":"'"$ID"'"'; then echo "  GET OK: $get" | tee -a "$LOG"; else echo "  GET FAILED: $get" | tee -a "$LOG"; fail=1; fi

# 6) USSD end-to-end flow: submit reading with a farm name and PPM
USSD_ID="smokeussd$(date +%s)"
echo "- USSD end-to-end (1*smokeFarm*12.34)" | tee -a "$LOG"
r1=$(curl -sS --data "sessionId=$USSD_ID" --data "phoneNumber=+254700000001" --data "text=" "$USSD/ussd" || true)
r2=$(curl -sS --data "sessionId=$USSD_ID" --data "phoneNumber=+254700000001" --data "text=1*smokeFarm" "$USSD/ussd" || true)
r3=$(curl -sS --data "sessionId=$USSD_ID" --data "phoneNumber=+254700000001" --data "text=1*smokeFarm*12.34" "$USSD/ussd" || true)
if echo "$r3" | grep -q 'Saved reading'; then echo "  USSD submit OK" | tee -a "$LOG"; else echo "  USSD submit FAILED: $r3" | tee -a "$LOG"; fail=1; fi

# 7) Validate phone map internal endpoint
echo "- /_internal/phone-map" | tee -a "$LOG"
pm=$(curl -sS "$USSD/_internal/phone-map" || true)
if echo "$pm" | grep -q '"map"'; then echo "  phone-map OK" | tee -a "$LOG"; else echo "  phone-map FAILED: $pm" | tee -a "$LOG"; fail=1; fi

# Summary
if [ "$fail" -eq 0 ]; then
  echo "SMOKE TEST: PASS" | tee -a "$LOG"
  exit 0
else
  echo "SMOKE TEST: FAILED (see $LOG)" | tee -a "$LOG"
  exit 2
fi

