#!/usr/bin/env bash
# start_api.sh - start REST API (safe umask + restart)
# Full replacement — backed up earlier as backups/start_api.sh.<ts>.bak

set -eu

# keep original envs (adjust paths if yours differ)
export CHAINCODE_NAME="${CHAINCODE_NAME:-carboncc}"
export CHANNEL_NAME="${CHANNEL_NAME:-mychannel}"
export TLS_CERT_PATH="${TLS_CERT_PATH:-$HOME/carbonpasture-kenya/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt}"
export MSP_ID="${MSP_ID:-Org1MSP}"
export KEY_PATH="${KEY_PATH:-$HOME/carbonpasture-kenya/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/keystore/883a938db7b46f914681806d291707cae2fe993a02b7a50093461afe9d483c3f_sk}"
export DISABLE_AUTH="${DISABLE_AUTH:-true}"
export PEER_ENDPOINT="${PEER_ENDPOINT:-127.0.0.1:7051}"
export PORT="${PORT:-3000}"

# ensure logs dir exists
mkdir -p "$HOME/projects/carbonpasture/application-gateway/logs"
mkdir -p "$HOME/projects/carbonpasture/application-gateway/data"

# set umask so created files are group/other restricted
umask 0027   # files 640, dirs 750

# optional: rotate previous logs (move to logs/)
ts=$(date -u +%Y%m%dT%H%M%SZ)
if [ -f api.log ]; then
  mv api.log "logs/api.log.$ts" || true
fi
if [ -f ussd.log ]; then
  mv ussd.log "logs/ussd.log.$ts" || true
fi

# start API (background) and leave output to api.log
node rest-api.js > api.log 2>&1 &
echo "Started rest-api PID $!"

# done (do not exit if you want this to be interactive; script returns control)

