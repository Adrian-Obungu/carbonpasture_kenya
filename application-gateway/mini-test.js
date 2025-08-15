const express = require('express');
const app = express();

app.get('/test', (req, res) => {
  console.log("✅ /test hit");
  res.send('pong');
});

app.listen(3000, () => console.log('🚀 Mini test API running on 3000'));
