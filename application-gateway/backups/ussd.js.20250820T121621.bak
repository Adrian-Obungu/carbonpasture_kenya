/**
 * ussd.js - full replacement USSD webhook (dev)
 * - POST /ussd  (form-encoded fields)
 * - flows:
 *   * "" => menu: 1 Register  2 Submit reading  3 My credits  4 Exit
 *   * "1" => register: ask farmID then PIN (PIN optional)
 *   * "2" => submit reading: ask farmID (or use phone mapping) then methane ppm
 *   * "3" => returns credits balance (calls REST)
 */
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch'); // node-fetch@2
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

const PORT = process.env.USSD_PORT || 4000;
const REST_BASE = process.env.REST_BASE || 'http://127.0.0.1:3000';
const DATA_DIR = path.join(__dirname, 'data');

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}
function ussdResponse(type, message) {
  return `${type} ${message}`;
}
async function dailyLog(obj) {
  await ensureDataDir();
  const fn = path.join(DATA_DIR, `ussd-${new Date().toISOString().slice(0,10)}.json`);
  let arr = [];
  try {
    const raw = await fs.readFile(fn, 'utf8');
    arr = JSON.parse(raw || '[]');
  } catch (e) {
    arr = [];
  }
  arr.push(obj);
  await fs.writeFile(fn, JSON.stringify(arr, null, 2));
}

// in-memory session store for dev
const sessions = {};

app.post('/ussd', async (req, res) => {
  const sessionId = req.body.sessionId || req.body.session || 'sess-' + Date.now();
  const phoneNumber = (req.body.phoneNumber || req.body.phone || req.body.msisdn || '+000').trim();
  const text = (req.body.text || '').trim();
  // split by * typical provider encoding
  const parts = text === '' ? [] : text.split('*');

  // build session state
  if (!sessions[sessionId]) sessions[sessionId] = { step: 0, phoneNumber };
  const sess = sessions[sessionId];

  // logging input
  await dailyLog({ sessionId, phoneNumber, text, step: sess.step || 0, timestamp: new Date().toISOString() });

  try {
    // root menu
    if (parts.length === 0) {
      sess.step = 1;
      const msg = 'Welcome\n1. Register\n2. Submit methane reading\n3. My credits\n4. Exit';
      return res.send(ussdResponse('CON', msg));
    }

    // Register flow (1)
    if (parts[0] === '1') {
      // user typed "1" then optionally "farmID" then optionally "PIN"
      if (parts.length === 1) {
        sess.step = 'register:wantFarm';
        return res.send(ussdResponse('CON', 'Enter your farm ID to register:'));
      }
      if (parts.length === 2) {
        // got farmID
        const farmID = parts[1].trim();
        sess.pendingFarm = farmID;
        sess.step = 'register:wantPin';
        return res.send(ussdResponse('CON', 'Set a 4-digit PIN (or 0000 to skip):'));
      }
      if (parts.length >= 3) {
        const farmID = sess.pendingFarm || parts[1].trim();
        const pin = parts[2].trim();
        // call REST to register mapping
        const body = { phone: phoneNumber, farmID };
        const r = await fetch(`${REST_BASE}/registerPhone`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
        const j = await r.json().catch(() => ({}));
        await dailyLog({ sessionId, phoneNumber, action: 'register', farmID, result: j, timestamp: new Date().toISOString() });
        sess.step = 'done';
        return res.send(ussdResponse('END', `Registered. FarmerID: ${farmID}. Keep your PIN safe.`));
      }
    }

    // Submit reading (2)
    if (parts[0] === '2') {
      // shapes:
      // - '2' -> ask farmID (or allow lookup)
      // - '2*farmID' -> ask ppm
      // - '2*farmID*ppm' -> submit
      if (parts.length === 1) {
        // try to lookup phone mapping quickly
        const lookup = await fetch(`${REST_BASE}/lookupPhone/${encodeURIComponent(phoneNumber)}`);
        if (lookup.status === 200) {
          const body = await lookup.json().catch(()=>({}));
          const farmID = body.farmID || (body.map && Object.values(body.map)[0] && Object.values(body.map)[0].farmID);
          if (farmID) {
            // prompt for ppm immediately using known farmID
            sess.step = 'submit:gotFarm';
            sess.pendingFarm = farmID;
            return res.send(ussdResponse('CON', `Detected farm ${farmID}. Enter methane ppm (e.g. 55.1):`));
          }
        }
        sess.step = 'submit:wantFarm';
        return res.send(ussdResponse('CON', 'Enter farm ID (or register first):'));
      }
      if (parts.length === 2) {
        // got farmID, ask ppm
        const farmID = parts[1].trim();
        sess.pendingFarm = farmID;
        sess.step = 'submit:wantPPM';
        return res.send(ussdResponse('CON', 'Enter methane ppm (e.g. 55.1):'));
      }
      if (parts.length >= 3) {
        const farmID = sess.pendingFarm || parts[1].trim();
        const ppmRaw = parts[2].trim();
        const ppm = parseFloat(ppmRaw);
        if (Number.isNaN(ppm)) {
          return res.send(ussdResponse('CON', 'Invalid number. Enter methane ppm (e.g. 55.1):'));
        }
        // build record and POST to REST
        const rec = {
          ID: `rec${Date.now()}`,
          farmID,
          methanePPM: ppm,
          timestamp: new Date().toISOString()
        };
        const r = await fetch(`${REST_BASE}/records`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rec)
        });
        const j = await r.json().catch(() => ({}));
        await dailyLog({ sessionId, phoneNumber, action: 'submitRecord', record: rec, backendResponse: j, timestamp: new Date().toISOString() });
        let reply = 'Saved reading.';
        if (j && j.award && typeof j.award.balance !== 'undefined') {
          reply += ` You earned ${j.award.entry.amount} Demo Credit. Bal: ${j.award.balance}`;
        }
        reply += ` ID:${rec.ID}`;
        return res.send(ussdResponse('END', reply));
      }
    }

    // My credits (3)
    if (parts[0] === '3') {
      // attempt lookup by phone
      const lookup = await fetch(`${REST_BASE}/lookupPhone/${encodeURIComponent(phoneNumber)}`);
      if (lookup.status === 200) {
        const body = await lookup.json().catch(()=>({}));
        const farmID = body.farmID;
        if (farmID) {
          const c = await fetch(`${REST_BASE}/credits/${encodeURIComponent(farmID)}`);
          if (c.status === 200) {
            const cj = await c.json().catch(()=>({}));
            await dailyLog({ sessionId, phoneNumber, action: 'queryCredits', farmID, result: cj, timestamp: new Date().toISOString() });
            return res.send(ussdResponse('END', `Farm ${farmID} Credits: ${cj.balance || 0}.`));
          }
        }
      }
      return res.send(ussdResponse('END', 'No account found for this phone. Register first.'));
    }

    // Exit or other
    if (parts[0] === '4') {
      return res.send(ussdResponse('END', 'Goodbye.'));
    }

    // fallback
    return res.send(ussdResponse('END', 'Invalid option.'));
  } catch (err) {
    console.error('USSD handler error:', err && err.message ? err.message : err);
    await dailyLog({ sessionId, phoneNumber, error: String(err), timestamp: new Date().toISOString() });
    return res.send(ussdResponse('END', 'Service error. Try later.'));
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`📞 USSD service with daily logging listening on http://127.0.0.1:${PORT}`);
});
