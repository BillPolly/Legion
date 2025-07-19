const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Store for demo data
let visitors = 0;
const messages = [];

// Routes
app.get('/', (req, res) => {
  visitors++;
  res.json({ 
    message: 'Hello from Simple Express App!',
    version: '1.0.0',
    visitors: visitors,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.version,
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/api/messages', (req, res) => {
  res.json({
    messages: messages,
    total: messages.length
  });
});

app.post('/api/messages', (req, res) => {
  const { message, author } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  
  const newMessage = {
    id: messages.length + 1,
    message: message,
    author: author || 'Anonymous',
    timestamp: new Date().toISOString()
  };
  
  messages.push(newMessage);
  
  console.log(`New message from ${newMessage.author}: ${newMessage.message}`);
  
  res.status(201).json(newMessage);
});

app.get('/api/stats', (req, res) => {
  res.json({
    visitors: visitors,
    messages: messages.length,
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
    },
    pid: process.pid,
    nodeVersion: process.version,
    platform: process.platform
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

// Start server
const server = app.listen(port, () => {
  console.log(`Simple Express App listening on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Process ID: ${process.pid}`);
  console.log(`Available endpoints:`);
  console.log(`  GET  /           - Welcome message`);
  console.log(`  GET  /health     - Health check`);
  console.log(`  GET  /api/stats  - Application statistics`);
  console.log(`  GET  /api/messages - Get all messages`);
  console.log(`  POST /api/messages - Create a new message`);
});

// Handle server errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});