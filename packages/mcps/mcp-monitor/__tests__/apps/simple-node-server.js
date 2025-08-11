/**
 * Simple Node.js Express Server for testing Enhanced Full-Stack Monitor
 */

const express = require('express');
const { createServer } = require('http');

const app = express();
const PORT = parseInt(process.env.PORT || '3008');

// Middleware to add correlation IDs
app.use((req, res, next) => {
  req.correlationId = `correlation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[${req.correlationId}] ${req.method} ${req.path}`);
  next();
});

app.use(express.json());
app.use(express.static('public'));

// Root route
app.get('/', (req, res) => {
  const responseData = {
    message: 'Hello from Node.js server!',
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    correlationId: req.correlationId,
    typescript: false,
    port: PORT
  };
  
  console.log(`[${req.correlationId}] Sending response:`, responseData);
  res.json(responseData);
});

// Health check endpoint
app.get('/health', (req, res) => {
  const healthData = {
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    correlationId: req.correlationId,
    timestamp: new Date().toISOString()
  };
  
  console.log(`[${req.correlationId}] Health check requested`);
  res.json(healthData);
});

// API endpoint that triggers some processing
app.post('/api/process', (req, res) => {
  const { data } = req.body;
  
  console.log(`[${req.correlationId}] Processing data:`, data);
  
  // Simulate some async processing
  setTimeout(() => {
    const result = {
      processed: true,
      original: data,
      processedAt: new Date().toISOString(),
      correlationId: req.correlationId,
      processingTime: '100ms'
    };
    
    console.log(`[${req.correlationId}] Processing complete:`, result);
    res.json(result);
  }, 100);
});

// Error endpoint for testing error handling
app.get('/error', (req, res) => {
  console.error(`[${req.correlationId}] Intentional error triggered`);
  throw new Error(`Test error with correlation ${req.correlationId}`);
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error(`[${req.correlationId}] Error occurred:`, error.message);
  res.status(500).json({
    error: error.message,
    correlationId: req.correlationId,
    timestamp: new Date().toISOString()
  });
});

// Create and start server
const server = createServer(app);

server.listen(PORT, () => {
  console.log(`🚀 Node.js server running on port ${PORT}`);
  console.log(`📊 Process ID: ${process.pid}`);
  console.log(`🔗 URLs:`);
  console.log(`   - http://localhost:${PORT}/`);
  console.log(`   - http://localhost:${PORT}/health`);
  console.log(`   - http://localhost:${PORT}/api/process (POST)`);
  console.log(`   - http://localhost:${PORT}/error (for error testing)`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('💀 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('💀 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});