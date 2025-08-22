set -e
API=http://127.0.0.1:3000
echo "=> HEALTH:"
curl -sS $API/health || true
echo -e "\n=> TEST:"
curl -sS $API/test || true
echo -e "\n=> READ rec004 (may be absent):"
curl -sS $API/records/rec004 || true
echo -e "\n=> POST sample record rec004:"
curl -sS -X POST -H "Content-Type: application/json" -d '{"ID":"rec004","farmID":"farmD","methanePPM":55.1,"timestamp":"2025-08-06T21:00:00Z"}' $API/records || true
echo -e "\n=> USSD signup simulation:"
curl -sS -X POST -d "sessionId=1&phoneNumber=+254700000001&text=1" http://127.0.0.1:3000/ussd || true
echo -e "\nDone."
