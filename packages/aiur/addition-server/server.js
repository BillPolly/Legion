const express = require('express');
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Addition endpoint
app.post('/add', (req, res) => {
    try {
        const { num1, num2 } = req.body;

        // Check if both numbers are provided
        if (num1 === undefined || num2 === undefined) {
            return res.status(400).json({
                error: 'Both numbers are required'
            });
        }

        // Convert to numbers and validate
        const number1 = Number(num1);
        const number2 = Number(num2);

        if (isNaN(number1) || isNaN(number2)) {
            return res.status(400).json({
                error: 'Invalid numbers provided'
            });
        }

        // Calculate sum and return result
        const sum = number1 + number2;
        res.json({
            result: sum
        });
    } catch (error) {
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Something went wrong!'
    });
});

const PORT = process.env.PORT || 3000;

// Only listen if this file is run directly (not in tests)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

module.exports = app;