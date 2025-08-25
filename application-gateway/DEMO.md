# Demo script (for judges / reproducible run)

## Start (tab allocation)
- Tab A: REST API
cd ~/projects/carbonpasture/application-gateway
export DISABLE_AUTH=true
node rest-api.js > api.log 2>&1 &
tail -n 50 api.log

css
Copy code
- Tab B: USSD webhook
node ussd.js > ussd.log 2>&1 &
tail -n 50 ussd.log

mathematica
Copy code
- Tab C: MPESA callback listener
node mpesa-callback.js > mpesa-callback.log 2>&1 &
tail -f data/mpesa-callbacks.log

mathematica
Copy code
- Tab D: Run tests / trigger payment
export MPESA_KEY='<consumer_key>'
export MPESA_SECRET='<consumer_secret>'
export TOKEN_URL='https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
export BUSINESS_SHORTCODE='174379'
export PASSKEY='<sandbox_passkey_or_empty_for-mock>'
export STK_CALLBACK_URL='https://<tunnel-id>.ngrok-free.app/callback'
MPESA_DEBUG=1 node payment.js --farmer farmSmoke --phone +254700000002 --amount 1

markdown
Copy code

## One-shot demo flow
1. Register phone (simulate USSD):
curl -X POST http://127.0.0.1:4000/ussd -d "sessionId=s1" -d "phoneNumber=+254700000002" -d "text=1farmSmoke0000"

markdown
Copy code
2. Submit reading:
curl -X POST http://127.0.0.1:4000/ussd -d "sessionId=s2" -d "phoneNumber=+254700000002" -d "text=2farmSmoke12.3"

markdown
Copy code
3. Trigger STK push:
MPESA_DEBUG=1 node payment.js --farmer farmSmoke --phone +254700000002 --amount 1

markdown
Copy code
4. Watch callback & confirm credits:
tail -f data/mpesa-callbacks.log
curl http://127.0.0.1:3000/credits/farmSmoke

sql
Copy code

