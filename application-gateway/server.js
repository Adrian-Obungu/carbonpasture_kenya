const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// mock dataset
let carbonData = [
  { id: 1, location: "Nairobi", trees: 120, co2: 3.2 },
  { id: 2, location: "Kisumu", trees: 80, co2: 1.7 }
];

app.get('/data', (req, res) => res.json(carbonData));

app.post('/data', (req, res) => {
  const newEntry = { id: carbonData.length+1, ...req.body };
  carbonData.push(newEntry);
  res.json(newEntry);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
