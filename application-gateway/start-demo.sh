#!/usr/bin/env bash
# start-demo.sh — safe script to start service components (run from project dir)
# USAGE:
#   cd ~/projects/carbonpasture/application-gateway
#   chmod +x start-demo.sh
#   ./start-demo.sh

set -euo pipefail

echo "Starting REST API..."
pkill -f "node rest-api.js" 2>/dev/null || true
export DISABLE_AUTH=true
nohup node rest-api.js > api.log 2>&1 &

echo "Starting USSD webhook..."
pkill -f "node ussd.js" 2>/dev/null || true
nohup node ussd.js > ussd.log 2>&1 &

echo "Starting MPESA callback listener..."
pkill -f "node mpesa-callback.js" 2>/dev/null || true
nohup node mpesa-callback.js > mpesa-callback.log 2>&1 &

sleep 1
echo
echo "Tails (api.log, ussd.log, mpesa-callback.log) are available. Start ngrok or localtunnel separately to expose the callback listener."
echo "Run: ngrok http 4001   # (in a separate terminal) and copy the HTTPS forwarding URL."
echo
echo "To run the demo: set MPESA env variables and run node payment.js as described in the README or demo doc."
