const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

/**
 * Validates and converts input strings to numbers
 * @param {string} num1 First number
 * @param {string} num2 Second number
 * @returns {Array<number>} Array of validated numbers
 * @throws {Error} If invalid numbers are provided
 */
function validateNumbers(num1, num2) {
  const n1 = Number(num1);
  const n2 = Number(num2);
  if (isNaN(n1) || isNaN(n2)) {
    throw new Error('Invalid numbers provided');
  }
  return [n1, n2];
}

app.use(express.json());

app.get('/add', (req, res) => {
  try {
    const { num1, num2 } = req.query;
    
    if (!num1 || !num2) {
      return res.status(400).json({
        error: 'Missing required parameters: num1 and num2'
      });
    }

    const [validNum1, validNum2] = validateNumbers(num1, num2);
    const result = validNum1 + validNum2;

    res.json({
      result,
      numbers: [validNum1, validNum2]
    });
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, server };