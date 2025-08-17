cd "$(dirname "$0")" || exit 1
echo "🔄 Restarting REST API..."
pkill -f restart-api.js || true 
export DISABLE_AUTH=true
exec node rest-api.js
