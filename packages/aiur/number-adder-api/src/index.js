const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

/**
 * Validates that both inputs are valid numbers
 * @param {number} num1 First number
 * @param {number} num2 Second number
 * @throws {Error} If inputs are invalid
 */
function validateNumbers(num1, num2) {
  if (typeof num1 !== 'number' || typeof num2 !== 'number') {
    throw new Error('Both inputs must be numbers');
  }
  if (!isFinite(num1) || !isFinite(num2)) {
    throw new Error('Inputs must be finite numbers');
  }
}

// Addition endpoint
app.post('/api/add', (req, res) => {
  try {
    const { num1, num2 } = req.body;
    validateNumbers(Number(num1), Number(num2));
    const result = Number(num1) + Number(num2);
    res.json({ result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app; // Export for testing