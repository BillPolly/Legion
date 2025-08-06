const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON requests
app.use(express.json());

// Addition API endpoint
app.post('/api/add', (req, res) => {
  const { a, b } = req.body;
  
  // Validate inputs
  if (typeof a !== 'number' || typeof b !== 'number') {
    return res.status(400).json({
      error: 'Both a and b must be numbers',
      example: { a: 5, b: 3 }
    });
  }
  
  const result = a + b;
  
  res.json({
    a: a,
    b: b,
    result: result
  });
});

// GET endpoint for testing
app.get('/api/add', (req, res) => {
  res.json({
    message: 'Addition API endpoint',
    usage: 'Send a POST request to /api/add with JSON body containing "a" and "b" numbers',
    example: {
      request: { a: 5, b: 3 },
      response: { a: 5, b: 3, result: 8 }
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Addition API Server',
    endpoints: [
      {
        method: 'POST',
        path: '/api/add',
        description: 'Add two numbers',
        body: { a: 'number', b: 'number' }
      },
      {
        method: 'GET',
        path: '/api/add',
        description: 'Get API usage information'
      }
    ]
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Addition API server is running on http://localhost:${PORT}`);
  console.log(`Test the API: curl -X POST http://localhost:${PORT}/api/add -H "Content-Type: application/json" -d '{"a":5,"b":3}'`);
});