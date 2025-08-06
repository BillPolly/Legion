const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

/**
 * Validates that both inputs are valid numbers
 * @param {string} num1 First number to validate
 * @param {string} num2 Second number to validate
 * @returns {Object} Validation result
 */
function validateNumbers(num1, num2) {
  const n1 = Number(num1);
  const n2 = Number(num2);
  
  if (isNaN(n1) || isNaN(n2)) {
    return { valid: false, error: 'Both parameters must be valid numbers' };
  }
  
  return { valid: true, numbers: [n1, n2] };
}

// Addition endpoint
app.get('/add/:num1/:num2', (req, res) => {
  const { num1, num2 } = req.params;
  const validation = validateNumbers(num1, num2);
  
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }
  
  const [n1, n2] = validation.numbers;
  const sum = n1 + n2;
  
  res.json({ 
    result: sum,
    inputs: { num1: n1, num2: n2 }
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app; // Export for testing