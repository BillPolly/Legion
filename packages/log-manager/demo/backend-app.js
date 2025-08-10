/**
 * Demo Backend Application - Shows log correlation with frontend
 */

import express from 'express';
import cors from 'cors';
import { LegionLogManager } from '../src/LegionLogManager.js';
import { MockResourceManager, MockStorageProvider, MockSemanticSearchProvider } from '../__tests__/utils/TestUtils.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize ResourceManager with mock providers for demo
const resourceManager = new MockResourceManager();
const storageProvider = new MockStorageProvider();
const semanticProvider = new MockSemanticSearchProvider();

resourceManager.set('StorageProvider', storageProvider);
resourceManager.set('SemanticSearchProvider', semanticProvider);

// Create LegionLogManager
const logManager = await LegionLogManager.create(resourceManager);

// Create a session for this demo
const sessionResult = await logManager.createSession({
  name: 'Live Demo Session',
  description: 'Demonstrating frontend-backend log correlation'
});

const SESSION_ID = sessionResult.sessionId;
console.log(`✅ Session created: ${SESSION_ID}`);

// Start WebSocket server for log streaming
const wsResult = await logManager.startWebSocketServer({
  port: 8080,
  host: 'localhost'
});
console.log(`✅ WebSocket server started at ${wsResult.url}`);

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Request ID generator for correlation
let requestCounter = 0;
const generateRequestId = () => `req-${Date.now()}-${++requestCounter}`;

// Middleware to log all requests
app.use((req, res, next) => {
  const requestId = generateRequestId();
  req.requestId = requestId;
  
  // Log incoming request
  logManager.logMessage({
    sessionId: SESSION_ID,
    processId: 'backend-server',
    source: 'stdout',
    message: `[${requestId}] ${req.method} ${req.url} - Client: ${req.ip}`,
    level: 'info',
    metadata: {
      requestId,
      method: req.method,
      url: req.url,
      headers: req.headers
    }
  });
  
  // Log response when finished
  const originalSend = res.send;
  res.send = function(data) {
    logManager.logMessage({
      sessionId: SESSION_ID,
      processId: 'backend-server',
      source: 'stdout',
      message: `[${requestId}] Response sent - Status: ${res.statusCode}`,
      level: res.statusCode >= 400 ? 'error' : 'info',
      metadata: {
        requestId,
        statusCode: res.statusCode,
        responseSize: data ? data.length : 0
      }
    });
    originalSend.apply(res, arguments);
  };
  
  next();
});

// API Routes
app.get('/api/health', (req, res) => {
  logManager.logMessage({
    sessionId: SESSION_ID,
    processId: 'backend-server',
    source: 'stdout',
    message: `[${req.requestId}] Health check requested`,
    level: 'debug'
  });
  
  res.json({ 
    status: 'healthy', 
    requestId: req.requestId,
    sessionId: SESSION_ID,
    timestamp: new Date() 
  });
});

app.post('/api/action', async (req, res) => {
  const { action, data } = req.body;
  
  logManager.logMessage({
    sessionId: SESSION_ID,
    processId: 'backend-server',
    source: 'stdout',
    message: `[${req.requestId}] Processing action: ${action}`,
    level: 'info',
    metadata: {
      requestId: req.requestId,
      action,
      data
    }
  });
  
  // Simulate some processing
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Simulate different outcomes
  if (action === 'error-test') {
    logManager.logMessage({
      sessionId: SESSION_ID,
      processId: 'backend-server',
      source: 'stderr',
      message: `[${req.requestId}] Error processing action: Simulated error`,
      level: 'error',
      metadata: {
        requestId: req.requestId,
        error: 'Simulated error for testing'
      }
    });
    
    res.status(500).json({ 
      error: 'Simulated error', 
      requestId: req.requestId 
    });
  } else {
    logManager.logMessage({
      sessionId: SESSION_ID,
      processId: 'backend-server',
      source: 'stdout',
      message: `[${req.requestId}] Action completed successfully: ${action}`,
      level: 'info',
      metadata: {
        requestId: req.requestId,
        result: 'success'
      }
    });
    
    res.json({ 
      result: `Processed ${action}`, 
      requestId: req.requestId,
      timestamp: new Date() 
    });
  }
});

app.get('/api/search-logs', async (req, res) => {
  const { query, mode = 'keyword' } = req.query;
  
  logManager.logMessage({
    sessionId: SESSION_ID,
    processId: 'backend-server',
    source: 'stdout',
    message: `[${req.requestId}] Searching logs: "${query}" (mode: ${mode})`,
    level: 'info'
  });
  
  const searchResult = await logManager.searchLogs({
    query,
    sessionId: SESSION_ID,
    mode,
    limit: 50
  });
  
  res.json({
    requestId: req.requestId,
    ...searchResult
  });
});

// API to get session info
app.get('/api/session', (req, res) => {
  res.json({
    sessionId: SESSION_ID,
    wsUrl: wsResult.url,
    requestId: req.requestId
  });
});

// Simulate some background activity
setInterval(() => {
  const activities = [
    'Database health check',
    'Cache cleanup',
    'Memory usage check',
    'Queue processing',
    'Metrics collection'
  ];
  
  const activity = activities[Math.floor(Math.random() * activities.length)];
  const level = Math.random() > 0.8 ? 'warn' : 'debug';
  
  logManager.logMessage({
    sessionId: SESSION_ID,
    processId: 'backend-worker',
    source: 'system',
    message: `Background task: ${activity}`,
    level,
    metadata: {
      task: activity,
      timestamp: new Date()
    }
  });
}, 5000);

// Start server
const PORT = 3333;
app.listen(PORT, () => {
  console.log(`✅ Backend server running at http://localhost:${PORT}`);
  console.log(`📊 Session ID: ${SESSION_ID}`);
  console.log(`🔌 WebSocket URL: ${wsResult.url}`);
  console.log('\n📝 Open http://localhost:3333/index.html to see the demo');
  
  logManager.logMessage({
    sessionId: SESSION_ID,
    processId: 'backend-server',
    source: 'system',
    message: `Server started on port ${PORT}`,
    level: 'info',
    metadata: {
      port: PORT,
      sessionId: SESSION_ID,
      wsUrl: wsResult.url
    }
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  
  logManager.logMessage({
    sessionId: SESSION_ID,
    processId: 'backend-server',
    source: 'system',
    message: 'Server shutting down',
    level: 'warn'
  });
  
  await logManager.endSession(SESSION_ID);
  await logManager.cleanup();
  process.exit(0);
});