/**
 * payment.js - robust STK Push helper (Daraja sandbox + mock fallback)
 *
 * Usage:
 *  - Set envs: MPESA_KEY/MPESA_SECRET already used by token.js
 *  - Optionally set BUSINESS_SHORTCODE, PASSKEY, STK_CALLBACK_URL, STK_PUSH_URL
 *
 *  CLI examples:
 *    # simulated (mock token) or when PASSKEY not provided
 *    node payment.js --farmer demoFarm --phone +254700000002 --amount 1
 *
 *    # real sandbox STK push (requires PASSKEY, BUSINESS_SHORTCODE and reachable callback)
 *    BUSINESS_SHORTCODE=174379 PASSKEY='yourpasskey' STK_CALLBACK_URL='https://<ngrok-id>.ngrok.io/callback' MPESA_DEBUG=1 node payment.js --farmer demoFarm --phone +254700000002 --amount 1
 *
 * Exports:
 *   initiateSTKPush({ farmerID, amount, phoneNumber, description })
 */

const { getAccessToken } = require('./token');
const fetch = require('node-fetch'); // v2
const qs = require('querystring');

const STK_PUSH_URL = process.env.STK_PUSH_URL || 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';
const BUSINESS_SHORTCODE = process.env.BUSINESS_SHORTCODE || '174379';
const PASSKEY = process.env.PASSKEY || ''; // required for real STK
const CALLBACK_URL = process.env.STK_CALLBACK_URL || process.env.CALLBACK_URL || 'https://example.com/callback';
const DEBUG = !!process.env.MPESA_DEBUG;
const TIMEOUT_MS = Number(process.env.MPESA_STK_TIMEOUT_MS || 20000);

/** format timestamp YYYYMMDDHHmmss */
function mkTimestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function createPassword(shortcode, passkey, timestamp) {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
}

/**
 * initiateSTKPush
 *  - if token.mock is true OR PASSKEY missing -> simulate and return fake success
 *  - otherwise perform real POST to STK_PUSH_URL
 */
async function initiateSTKPush({ farmerID, amount = 1, phoneNumber = null, description = 'Demo credit' } = {}) {
  if (!farmerID) throw new Error('farmerID required');
  if (!phoneNumber) throw new Error('phoneNumber required (e.g. +2547...)');

  const token = await getAccessToken();

  // If token is mock or PASSKEY missing -> simulate
  if (token.mock || !PASSKEY) {
    if (DEBUG) console.log('[payment] Mock path: token.mock=', token.mock, 'PASSKEY present=', !!PASSKEY);
    // simulated sandbox-like response
    const now = Date.now();
    const out = {
      success: true,
      mock: true,
      message: (token.mock ? 'Simulated (mock token)' : 'Simulated (missing PASSKEY)') + ' STK push',
      result: {
        merchantRequestID: `MCK${now}`,
        checkoutRequestID: `CK${now}`,
        responseCode: '0',
        responseDescription: 'Success. Request is processed for simulation.'
      }
    };
    return out;
  }

 // Real STK push flow
const timestamp = mkTimestamp();
const password = createPassword(BUSINESS_SHORTCODE, PASSKEY, timestamp);

// Prefer the exported env STK_CALLBACK_URL; fall back to CALLBACK_URL if it exists.
// (Keeps compatibility if you previously defined CALLBACK_URL earlier in the file.)
const CALLBACK_FINAL = process.env.STK_CALLBACK_URL || (typeof CALLBACK_URL !== 'undefined' ? CALLBACK_URL : null);

const body = {
  BusinessShortCode: BUSINESS_SHORTCODE,
  Password: password,
  Timestamp: timestamp,
  TransactionType: 'CustomerPayBillOnline',
  Amount: Number(amount),
  // make sure PartyA and PhoneNumber are in 2547... format (no leading +)
  PartyA: String(phoneNumber).replace(/^\+/, ''), 
  PartyB: BUSINESS_SHORTCODE,
  PhoneNumber: String(phoneNumber).replace(/^\+/, ''),
  CallBackURL: CALLBACK_FINAL,
  AccountReference: farmerID,
  TransactionDesc: description
};

if (DEBUG) {
  console.log('[payment] STK push request ->', STK_PUSH_URL);
  console.log('[payment] Authorization: Bearer <token>');
  // show full body for easy debugging (safe here because this is a sandbox/demo)
  console.log('[payment] full body:', JSON.stringify(body, null, 2));
  // help detect malformed callback URL early
  console.log('[payment] using CallBackURL:', CALLBACK_FINAL);
}

  const headers = {
    'Authorization': `Bearer ${token.access_token}`,
    'Content-Type': 'application/json'
  };

  const resp = await fetch(STK_PUSH_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    timeout: TIMEOUT_MS
  });

  const text = await resp.text().catch(()=>'');
  let parsed = null;
  try { parsed = JSON.parse(text); } catch (e) { parsed = { raw: text }; }

  if (!resp.ok) {
    const err = new Error(`STK push failed ${resp.status} ${resp.statusText}`);
    err.response = parsed;
    throw err;
  }

  // success path
  return { success: true, mock: false, result: parsed };
}

// CLI runner
if (require.main === module) {
  (async () => {
    const argv = process.argv.slice(2);
    const getOpt = (k) => {
      const idx = argv.findIndex(a => a === k);
      if (idx >= 0 && argv[idx+1]) return argv[idx+1];
      const kv = argv.find(a => a.startsWith(`${k}=`));
      if (kv) return kv.split('=')[1];
      return undefined;
    };

    const farmer = getOpt('--farmer') || getOpt('--f') || process.env.FARMER_ID || 'demoFarm';
    const phone = getOpt('--phone') || getOpt('--p') || process.env.PHONE_NUMBER || '+254700000002';
    const amount = Number(getOpt('--amount') || getOpt('--a') || process.env.AMOUNT || 1);

    try {
      const out = await initiateSTKPush({ farmerID: farmer, amount, phoneNumber: phone, description: 'Demo credit' });
      console.log(JSON.stringify(out, null, 2));
      process.exit(0);
    } catch (e) {
      console.error('STK push error:', e && (e.stack || e.message) ? (e.stack || e.message) : e);
      if (e.response) console.error('response:', JSON.stringify(e.response, null, 2));
      process.exit(2);
    }
  })();
}

module.exports = { initiateSTKPush };
