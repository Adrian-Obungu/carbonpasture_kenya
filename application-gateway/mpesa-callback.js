// mpesa-callback.js
// Simple STK callback receiver for Daraja sandbox testing.
// Usage: node mpesa-callback.js
// Logs incoming callbacks to ./data/mpesa-callbacks.log and prints to stdout.

const express = require('express');
const fs = require('fs');
const path = require('path');

const PORT = process.env.MPESA_CALLBACK_PORT || 4001;
const LOG_FILE = path.join(__dirname, 'data', 'mpesa-callbacks.log');

function ensureDir() {
  const d = path.dirname(LOG_FILE);
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

ensureDir();

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.post('/callback', async (req, res) => {
  const ts = new Date().toISOString();
  const entry = { timestamp: ts, headers: req.headers, body: req.body };
  const line = JSON.stringify(entry) + '\n';
  // append to log file
  fs.appendFileSync(LOG_FILE, line);
  console.log('⤴ Received MPESA callback at', ts);
  console.log(JSON.stringify(entry, null, 2));
  // Respond 200 quickly as Daraja expects a 200
  res.status(200).json({ result: 'received', timestamp: ts });
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`📥 MPESA callback server listening on http://127.0.0.1:${PORT}/callback`);
  console.log(`Logs appended to ${LOG_FILE}`);
});
