/**
 * Sample Backend Server for Integration Testing
 * A simple Express server that demonstrates correlation tracking
 */

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 4002;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || `req-${Date.now()}`;
  req.correlationId = correlationId;
  
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'info',
    message: `[${correlationId}] ${req.method} ${req.path}`,
    method: req.method,
    path: req.path,
    correlationId
  }));
  
  // Log response
  const originalSend = res.send;
  res.send = function(data) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `[${correlationId}] Response ${res.statusCode}`,
      statusCode: res.statusCode,
      correlationId
    }));
    originalSend.call(this, data);
  };
  
  next();
});

// Routes
app.get('/api/health', (req, res) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'debug',
    message: `[${req.correlationId}] Health check requested`
  }));
  
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    correlationId: req.correlationId
  });
});

app.get('/api/data', (req, res) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'debug',
    message: `[${req.correlationId}] Fetching data`
  }));
  
  // Simulate some processing
  setTimeout(() => {
    res.json({
      data: [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
        { id: 3, name: 'Item 3' }
      ],
      correlationId: req.correlationId
    });
  }, 100);
});

app.post('/api/action', (req, res) => {
  const { action, data } = req.body;
  
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'info',
    message: `[${req.correlationId}] Processing action: ${action}`,
    action,
    data
  }));
  
  // Simulate different responses based on action
  if (action === 'error-test') {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      message: `[${req.correlationId}] Intentional error for testing`,
      error: 'Test error'
    }));
    
    return res.status(500).json({
      error: 'Intentional error for testing',
      correlationId: req.correlationId
    });
  }
  
  res.json({
    success: true,
    action,
    result: 'Action processed',
    correlationId: req.correlationId
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'error',
    message: `[${req.correlationId}] Unhandled error: ${err.message}`,
    error: err.message,
    stack: err.stack
  }));
  
  res.status(500).json({
    error: 'Internal server error',
    correlationId: req.correlationId
  });
});

// Start server
app.listen(PORT, () => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'info',
    message: `Backend server started on port ${PORT}`
  }));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'info',
    message: 'Server shutting down gracefully'
  }));
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'info',
    message: 'Server interrupted, shutting down'
  }));
  process.exit(0);
});