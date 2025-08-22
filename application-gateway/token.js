/**
 * token.js - robust Daraja OAuth helper with mock fallback + caching + debug
 *
 * Usage:
 *   node token.js [--mock] [--debug]
 *   const { getAccessToken } = require('./token');
 *
 * Features:
 *  - Uses node-fetch@2 (timeout option supported)
 *  - Uses configurable timeout via MPESA_TOKEN_TIMEOUT_MS (default 20000ms)
 *  - Logs DNS resolution for debugging (MPESA_DEBUG=1)
 *  - Caches token until expiry-60s
 *  - MPESA_FORCE_MOCK=1 or --mock forces a mock token (good for demo)
 *
 * IMPORTANT: keep your MPESA_KEY/MPESA_SECRET in env (do NOT hard-code).
 */

const fetch = require('node-fetch'); // v2
const dns = require('dns').promises;
const https = require('https');

const MPESA_KEY = (process.env.MPESA_KEY || process.env.MPESA_CONSUMER_KEY || '').trim();
const MPESA_SECRET = (process.env.MPESA_SECRET || process.env.MPESA_CONSUMER_SECRET || '').trim();
const TOKEN_URL = process.env.TOKEN_URL || 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';

const FORCE_MOCK_ENV = (process.env.MPESA_FORCE_MOCK === '1') || (process.env.FORCE_MOCK === '1');
const DEBUG = !!process.env.MPESA_DEBUG;
const TIMEOUT_MS = Number(process.env.MPESA_TOKEN_TIMEOUT_MS || 20000); // default 20s

let cachedToken = null; // { tokenObj, expiryMs }

/** generate mock token */
function mockToken() {
  const t = `mock-demo-token-${Date.now()}`;
  return { access_token: t, expires_in: 3600, mock: true };
}

/** try DNS lookup (for debugging) */
async function resolveHost(hostname) {
  try {
    const res = await dns.lookup(hostname, { all: true });
    return res;
  } catch (e) {
    return null;
  }
}

/** fetch token from Daraja using node-fetch with timeout */
async function fetchDarajaToken() {
  if (!MPESA_KEY || !MPESA_SECRET) {
    throw new Error('MPESA_KEY or MPESA_SECRET not set in environment');
  }

  // debug DNS
  if (DEBUG) {
    try {
      const url = new URL(TOKEN_URL);
      const host = url.hostname;
      const resolved = await resolveHost(host);
      console.log('[token] DNS lookup', host, '=>', resolved);
    } catch (e) {
      console.log('[token] DNS lookup error:', e && e.message ? e.message : e);
    }
  }

  const auth = Buffer.from(`${MPESA_KEY}:${MPESA_SECRET}`).toString('base64');
  const headers = {
    'Authorization': `Basic ${auth}`,
    'Accept': 'application/json',
  };

  // Use a simple https.Agent (no keepAlive) to avoid lingering sockets in short-lived scripts
  const agent = new https.Agent({ keepAlive: false });

  if (DEBUG) console.log('[token] fetching token from', TOKEN_URL, 'timeoutMs=', TIMEOUT_MS);

  // node-fetch v2 supports a top-level `timeout` option (ms)
  const resp = await fetch(TOKEN_URL, { method: 'GET', headers, timeout: TIMEOUT_MS, agent });

  if (DEBUG) {
    console.log('[token] status', resp.status, resp.statusText);
    const hdrs = {};
    ['content-type','cache-control','date','x-request-id'].forEach(k => {
      const v = resp.headers.get(k);
      if (v) hdrs[k] = v;
    });
    console.log('[token] headers', hdrs);
  }

  if (!resp.ok) {
    const text = await resp.text().catch(()=>'<no-body>');
    throw new Error(`Bad response from token endpoint: ${resp.status} ${resp.statusText} - body: ${text}`);
  }

  // parse JSON (will throw on invalid JSON)
  const body = await resp.json();

  const access_token = body.access_token || body.AccessToken || body.token;
  const expires_in = Number(body.expires_in || body.expiresIn || body.expires || 3600);

  if (!access_token) throw new Error('Token endpoint did not return access_token field');

  return { access_token, expires_in, mock: false };
}

/**
 * getAccessToken(options)
 *  - options.forceMock = true -> returns mock token
 */
async function getAccessToken(options = {}) {
  if (options.forceMock || FORCE_MOCK_ENV) {
    if (DEBUG) console.log('[token] forceMock enabled, returning mock token');
    return mockToken();
  }

  // return cached if valid
  if (cachedToken && cachedToken.tokenObj && Date.now() < cachedToken.expiryMs) {
    if (DEBUG) console.log('[token] returning cached token, expires in', Math.round((cachedToken.expiryMs - Date.now())/1000),'s');
    return cachedToken.tokenObj;
  }

  try {
    const tokenObj = await fetchDarajaToken();
    const ttl = Math.max(30, (Number(tokenObj.expires_in) || 3600) - 60);
    cachedToken = { tokenObj, expiryMs: Date.now() + ttl * 1000 };
    if (DEBUG) console.log('[token] fetched and cached token for', ttl, 'seconds');
    return tokenObj;
  } catch (err) {
    // detailed debug info for you
    console.error('Failed to fetch token (network / timeout / DNS / credentials?), returning mock token. Error:', err && err.message ? err.message : err);
    return mockToken();
  }
}

/** CLI support */
if (require.main === module) {
  const opts = {};
  if (process.argv.includes('--mock')) opts.forceMock = true;
  if (process.argv.includes('--debug')) process.env.MPESA_DEBUG = '1';
  getAccessToken(opts).then(t => {
    console.log(JSON.stringify(t, null, 2));
    process.exit(0);
  }).catch(e => {
    console.error('ERROR', e && e.stack ? e.stack : e);
    process.exit(2);
  });
}

module.exports = { getAccessToken, mockToken };
