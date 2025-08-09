const express = require('express');
const app = express();

app.get('/add', (req, res) => {
  const a = Number(req.query.a);
  const b = Number(req.query.b);
  res.json({ sum: a + b });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});