const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

/**
 * Validates that both inputs are valid numbers
 * @param {number} num1 First number
 * @param {number} num2 Second number
 * @returns {boolean} True if both inputs are valid numbers
 */
function validateNumbers(num1, num2) {
  return !isNaN(num1) && !isNaN(num2);
}

// Addition endpoint
app.post('/add', (req, res) => {
  try {
    const { num1, num2 } = req.body;
    
    if (!num1 || !num2) {
      return res.status(400).json({
        error: 'Both numbers are required'
      });
    }

    if (!validateNumbers(num1, num2)) {
      return res.status(400).json({
        error: 'Invalid input: both parameters must be numbers'
      });
    }

    const sum = Number(num1) + Number(num2);
    
    res.json({
      result: sum,
      numbers: [num1, num2]
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});