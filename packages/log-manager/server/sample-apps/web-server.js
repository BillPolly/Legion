/**
 * Sample Web Server Application
 * Generates realistic web server logs with request IDs for correlation
 */

import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

let requestCounter = 0;
let activeRequests = new Map();

// Structured logging with levels
function log(level, message, metadata = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...metadata
  };
  console.log(JSON.stringify(logEntry));
}

// Request ID generator
function generateRequestId() {
  return `req-${Date.now()}-${++requestCounter}`;
}

// Middleware for request tracking
app.use((req, res, next) => {
  const requestId = generateRequestId();
  req.id = requestId;
  
  const startTime = Date.now();
  activeRequests.set(requestId, { startTime, path: req.path });
  
  log('info', `[${requestId}] Incoming ${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
    ip: req.ip
  });
  
  // Log response
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    activeRequests.delete(requestId);
    
    log('info', `[${requestId}] Response sent - ${res.statusCode} (${duration}ms)`, {
      statusCode: res.statusCode,
      duration
    });
    
    originalSend.call(this, data);
  };
  
  next();
});

// Routes
app.get('/api/health', (req, res) => {
  log('debug', `[${req.id}] Health check requested`);
  res.json({ 
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    requestId: req.id
  });
});

app.get('/api/users', async (req, res) => {
  log('info', `[${req.id}] Fetching users list`);
  
  // Simulate database query
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const users = [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' },
    { id: 3, name: 'Charlie', email: 'charlie@example.com' }
  ];
  
  log('debug', `[${req.id}] Found ${users.length} users`);
  res.json({ users, requestId: req.id });
});

app.get('/api/users/:id', async (req, res) => {
  const userId = req.params.id;
  log('info', `[${req.id}] Fetching user ${userId}`);
  
  // Simulate database query
  await new Promise(resolve => setTimeout(resolve, 50));
  
  if (userId === '999') {
    log('warn', `[${req.id}] User ${userId} not found`);
    return res.status(404).json({ 
      error: 'User not found',
      requestId: req.id 
    });
  }
  
  const user = { 
    id: userId, 
    name: 'Test User', 
    email: 'test@example.com' 
  };
  
  log('debug', `[${req.id}] User ${userId} retrieved successfully`);
  res.json({ user, requestId: req.id });
});

app.post('/api/process', async (req, res) => {
  const { data, correlationId } = req.body;
  const processId = `process-${Date.now()}`;
  
  log('info', `[${req.id}] Starting process ${processId}${correlationId ? ` [correlation-${correlationId}]` : ''}`);
  
  try {
    // Simulate processing steps
    log('debug', `[${req.id}] Validating input data`);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    log('debug', `[${req.id}] Processing stage 1`);
    await new Promise(resolve => setTimeout(resolve, 200));
    
    log('debug', `[${req.id}] Processing stage 2`);
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Random chance of warning
    if (Math.random() > 0.7) {
      log('warn', `[${req.id}] Process ${processId} encountered non-critical issue`);
    }
    
    // Random chance of error
    if (Math.random() > 0.9) {
      throw new Error('Random processing error');
    }
    
    log('info', `[${req.id}] Process ${processId} completed successfully`);
    res.json({ 
      success: true,
      processId,
      requestId: req.id,
      correlationId
    });
    
  } catch (error) {
    log('error', `[${req.id}] Process ${processId} failed: ${error.message}`, {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ 
      error: error.message,
      requestId: req.id 
    });
  }
});

// 404 handler
app.use((req, res) => {
  log('warn', `[${req.id}] Route not found: ${req.method} ${req.path}`);
  res.status(404).json({ 
    error: 'Not found',
    requestId: req.id 
  });
});

// Error handler
app.use((err, req, res, next) => {
  log('error', `[${req.id}] Unhandled error: ${err.message}`, {
    error: err.message,
    stack: err.stack
  });
  res.status(500).json({ 
    error: 'Internal server error',
    requestId: req.id 
  });
});

// Start server
const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  log('info', `Web server started on port ${PORT}`);
  
  // Periodic status logs
  setInterval(() => {
    const stats = {
      activeRequests: activeRequests.size,
      uptime: Math.floor(process.uptime()),
      memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
    };
    log('info', `Server status - Active: ${stats.activeRequests}, Uptime: ${stats.uptime}s, Memory: ${stats.memory}MB`);
  }, 30000);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('info', 'Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  log('info', 'Received SIGINT, shutting down gracefully');
  process.exit(0);
});