/**
 * Sidewinder Agent - Backend monitoring agent for Node.js processes
 * Injected via --require flag to capture console, errors, and lifecycle events
 */

const WebSocket = require('ws');
const { EventEmitter } = require('events');

// Configuration from environment
const config = {
  wsPort: process.env.SIDEWINDER_WS_PORT || '9901',
  wsHost: process.env.SIDEWINDER_WS_HOST || 'localhost',
  sessionId: process.env.SIDEWINDER_SESSION_ID || 'default',
  debug: process.env.SIDEWINDER_DEBUG === 'true'
};

// Debug logging
function debug(...args) {
  if (config.debug) {
    console.error('[Sidewinder Agent]', ...args);
  }
}

// WebSocket connection
let ws = null;
let connected = false;
const messageQueue = [];
let reconnectTimer = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;

// Connect to FullStackMonitor
function connect() {
  const url = `ws://${config.wsHost}:${config.wsPort}/sidewinder`;
  debug(`Connecting to ${url}`);
  
  try {
    ws = new WebSocket(url);
    
    ws.on('open', () => {
      debug('Connected to FullStackMonitor');
      connected = true;
      reconnectAttempts = 0;
      
      // Send identification
      send({
        type: 'identify',
        sessionId: config.sessionId,
        pid: process.pid,
        profile: 'standard'
      });
      
      // Send process start info
      send({
        type: 'processStart',
        pid: process.pid,
        argv: process.argv,
        cwd: process.cwd(),
        timestamp: Date.now()
      });
      
      // Flush queued messages
      while (messageQueue.length > 0) {
        const msg = messageQueue.shift();
        ws.send(JSON.stringify(msg));
      }
    });
    
    ws.on('close', () => {
      debug('Disconnected from FullStackMonitor');
      connected = false;
      scheduleReconnect();
    });
    
    ws.on('error', (err) => {
      debug('WebSocket error:', err.message);
    });
    
  } catch (err) {
    debug('Failed to create WebSocket:', err.message);
    scheduleReconnect();
  }
}

// Schedule reconnection
function scheduleReconnect() {
  if (reconnectTimer) return;
  if (reconnectAttempts >= maxReconnectAttempts) {
    debug('Max reconnection attempts reached');
    return;
  }
  
  reconnectAttempts++;
  const delay = Math.min(1000 * reconnectAttempts, 5000);
  debug(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
  
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

// Send message via WebSocket
function send(message) {
  if (connected && ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(message));
    } catch (err) {
      debug('Failed to send message:', err.message);
      messageQueue.push(message);
    }
  } else {
    // Queue message if not connected
    messageQueue.push(message);
    if (messageQueue.length > 1000) {
      messageQueue.shift(); // Drop oldest message if queue too large
    }
  }
}

// Hook console methods
['log', 'error', 'warn', 'info', 'debug'].forEach(method => {
  const original = console[method];
  debug(`Hooking console.${method}`);
  console[method] = function(...args) {
    // Send to FullStackMonitor FIRST (before any potential errors)
    send({
      type: 'console',
      method: method,
      args: args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      }),
      sessionId: config.sessionId,
      pid: process.pid,
      timestamp: Date.now()
    });
    
    // Then call original method
    try {
      return original.apply(console, args);
    } catch (error) {
      // Ignore EPIPE errors when stdout/stderr is redirected
      if (error.code !== 'EPIPE') {
        throw error;
      }
    }
  };
});

// Hook process events
process.on('uncaughtException', (error) => {
  send({
    type: 'uncaughtException',
    sessionId: config.sessionId,
    pid: process.pid,
    error: {
      message: error.message,
      stack: error.stack,
      code: error.code
    },
    timestamp: Date.now()
  });
  
  // Let the error propagate
  throw error;
});

process.on('unhandledRejection', (reason, promise) => {
  send({
    type: 'unhandledRejection',
    sessionId: config.sessionId,
    pid: process.pid,
    reason: reason instanceof Error ? {
      message: reason.message,
      stack: reason.stack
    } : String(reason),
    timestamp: Date.now()
  });
});

process.on('exit', (code) => {
  send({
    type: 'processExit',
    sessionId: config.sessionId,
    pid: process.pid,
    code: code,
    timestamp: Date.now()
  });
  
  // Give time for final message to send
  if (ws) {
    ws.close();
  }
});

// Hook HTTP server creation (simplified)
const http = require('http');
const originalCreateServer = http.createServer;
http.createServer = function(...args) {
  const server = originalCreateServer.apply(http, args);
  
  server.on('listening', () => {
    const addr = server.address();
    send({
      type: 'server-lifecycle',
      event: 'listening',
      port: addr.port,
      address: addr.address,
      sessionId: config.sessionId,
      pid: process.pid,
      timestamp: Date.now()
    });
  });
  
  server.on('error', (error) => {
    send({
      type: 'server-lifecycle',
      event: 'error',
      error: {
        message: error.message,
        code: error.code
      },
      sessionId: config.sessionId,
      pid: process.pid,
      timestamp: Date.now()
    });
  });
  
  return server;
};

// Start connection
connect();

debug('Sidewinder agent initialized');