# CarbonPasture — Application Gateway (demo)

**One-line:** Phone-first system that lets farmers register, submit methane readings, and receive demo credits via M-Pesa STK Push (Daraja sandbox).

## What this repo contains
- `rest-api.js` — REST endpoints (records, lookup, credits)
- `ussd.js` — USSD webhook (register, submit reading, query credits)
- `payment.js`, `token.js` — Daraja integration + mock fallback
- `mpesa-callback.js` — STK push callback listener
- `start-demo.sh` — helper to start API, USSD, and callback listener
- `data/` — demo data: phone-map, credits, callback logs (ignored by .gitignore)

## Quick demo (what to run)
1. Start services (3 separate terminals recommended):
   - REST API (auth disabled for demo): `DISABLE_AUTH=true node rest-api.js`
   - USSD webhook: `node ussd.js`
   - MPESA callback listener: `node mpesa-callback.js`
2. Expose callback publicly (ngrok or localtunnel) and set `STK_CALLBACK_URL`, e.g.:
ngrok http 4001
export STK_CALLBACK_URL="https://<your-ngrok-id>.ngrok-free.app/callback"

java
Copy code
3. Trigger STK push (demo phone):  
MPESA_DEBUG=1 node payment.js --farmer farmSmoke --phone +254700000002 --amount 1

bash
Copy code
4. Watch callback log: `tail -f data/mpesa-callbacks.log`  
Check credits: `curl http://127.0.0.1:3000/credits/farmSmoke`

## Security warnings
- DO NOT commit secrets (consumer key/secret, passkey, ngrok tokens).
- Store secrets in environment variables or a .env local file (ignored by .gitignore).

