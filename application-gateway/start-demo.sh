#!/usr/bin/env bash
# CarbonPasture demo launcher (API, USSD, Callback) with logs in ./data
set -euo pipefail

mkdir -p data

echo "Starting REST API..."
pkill -f "node rest-api.js" 2>/dev/null || true
nohup node rest-api.js > data/api.log 2>&1 &

echo "Starting USSD webhook..."
pkill -f "node ussd.js" 2>/dev/null || true
nohup node ussd.js > data/ussd.log 2>&1 &

echo "Starting MPESA callback listener..."
pkill -f "node mpesa-callback.js" 2>/dev/null || true
nohup node mpesa-callback.js > data/mpesa-callback.log 2>&1 &

echo
echo "Tails (api.log, ussd.log, mpesa-callback.log) below:"
echo "-----------------------------------------------------"
tail -n 30 data/api.log || true
tail -n 30 data/ussd.log || true
tail -n 30 data/mpesa-callback.log || true

echo
echo "Next: run a tunnel  (e.g.  ngrok http 4001 )  and export:"
echo 'export STK_CALLBACK_URL="https://<your-forwarding-url>/callback"'
echo
echo "Then trigger a payment (mock mode works if PASSKEY is empty):"
echo 'MPESA_DEBUG=1 node payment.js --farmer farmSmoke --phone +254700000002 --amount 1'
