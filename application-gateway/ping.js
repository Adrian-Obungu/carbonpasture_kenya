const express = require('express');
const app = express();
app.get('/ping', (_req, res) => res.send('pong'));
app.listen(3001, '0.0.0.0', () => console.log('🟢 ping server listening on http://127.0.0.1:3001'));
