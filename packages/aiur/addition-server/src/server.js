const express = require('express');

const PORT = process.env.PORT || 3000;
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

/**
 * Validates that both inputs are valid numbers
 * @param {number} num1 First number
 * @param {number} num2 Second number
 * @throws {Error} If inputs are invalid
 */
function validateNumbers(num1, num2) {
  if (typeof num1 !== 'number' || typeof num2 !== 'number' || isNaN(num1) || isNaN(num2)) {
    throw new Error('Invalid input: Both parameters must be valid numbers');
  }
  return true;
}

// Addition endpoint
app.post('/add', (req, res) => {
  try {
    const { num1, num2 } = req.body;
    const parsedNum1 = parseFloat(num1);
    const parsedNum2 = parseFloat(num2);
    
    validateNumbers(parsedNum1, parsedNum2);
    
    const result = parsedNum1 + parsedNum2;
    res.json({ result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Start the server if not being required as a module (for testing)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export for testing
module.exports = app;