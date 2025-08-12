/**
 * Sidewinder Injection Script
 * This file is loaded via --require flag to instrument Node.js applications
 */

const { WebSocket } = require('ws');
const { EventEmitter } = require('events');
const path = require('path');

// Global event emitter for instrumentation events
global.__sidewinder = new EventEmitter();
global.__sidewinder.setMaxListeners(100);

// Configuration from environment
const config = {
  wsPort: process.env.SIDEWINDER_WS_PORT || process.env.MONITOR_WS_PORT || '9898',
  wsHost: process.env.SIDEWINDER_WS_HOST || 'localhost',
  sessionId: process.env.SIDEWINDER_SESSION_ID || process.env.MONITOR_SESSION_ID || 'default',
  profile: process.env.SIDEWINDER_PROFILE || 'standard',
  hooks: process.env.SIDEWINDER_HOOKS ? process.env.SIDEWINDER_HOOKS.split(',') : null,
  debug: process.env.SIDEWINDER_DEBUG === 'true'
};

// Debug logging
function debug(...args) {
  if (config.debug) {
    console.error('[Sidewinder]', ...args);
  }
}

debug('Initializing with config:', config);

// WebSocket connection management
class SidewinderClient {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.messageQueue = [];
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
  }

  connect() {
    const url = `ws://${config.wsHost}:${config.wsPort}/sidewinder`;
    debug(`Connecting to ${url}`);
    
    try {
      this.ws = new WebSocket(url);
      
      this.ws.on('open', () => {
        debug('WebSocket connected');
        this.connected = true;
        this.reconnectAttempts = 0;
        
        // Send identification
        this.send({
          type: 'identify',
          sessionId: config.sessionId,
          pid: process.pid,
          profile: config.profile,
          hooks: config.hooks || this.getProfileHooks(config.profile)
        });
        
        // Flush queued messages
        while (this.messageQueue.length > 0) {
          const msg = this.messageQueue.shift();
          this.ws.send(JSON.stringify(msg));
        }
      });
      
      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleCommand(message);
        } catch (err) {
          debug('Failed to parse message:', err);
        }
      });
      
      this.ws.on('close', () => {
        debug('WebSocket closed');
        this.connected = false;
        this.scheduleReconnect();
      });
      
      this.ws.on('error', (err) => {
        debug('WebSocket error:', err.message);
      });
    } catch (err) {
      debug('Failed to create WebSocket:', err);
      this.scheduleReconnect();
    }
  }
  
  scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);
      debug(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.connect(), delay);
    }
  }
  
  send(message) {
    const payload = {
      ...message,
      timestamp: Date.now(),
      pid: process.pid
    };
    
    if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    } else {
      // Queue messages if not connected
      if (this.messageQueue.length < 1000) {
        this.messageQueue.push(payload);
      }
    }
  }
  
  handleCommand(message) {
    debug('Received command:', message);
    
    switch (message.type) {
      case 'updateHooks':
        this.updateHooks(message.hooks);
        break;
      case 'getHeapSnapshot':
        this.sendHeapSnapshot();
        break;
      case 'getCpuProfile':
        this.sendCpuProfile(message.duration);
        break;
      case 'eval':
        // Security: Only allow in debug mode
        if (config.debug) {
          this.executeEval(message.code);
        }
        break;
    }
  }
  
  getProfileHooks(profile) {
    const profiles = {
      minimal: ['console', 'errors'],
      standard: ['console', 'errors', 'http', 'async'],
      full: ['console', 'errors', 'http', 'async', 'memory', 'modules', 'eventloop']
    };
    return profiles[profile] || profiles.standard;
  }
  
  updateHooks(hooks) {
    // Dynamically enable/disable hooks
    global.__sidewinder.emit('updateHooks', hooks);
  }
  
  sendHeapSnapshot() {
    if (typeof global.gc === 'function') {
      global.gc();
    }
    const snapshot = process.memoryUsage();
    this.send({
      type: 'heapSnapshot',
      data: snapshot
    });
  }
  
  sendCpuProfile(duration = 1000) {
    // Simple CPU profiling placeholder
    const start = Date.now();
    setTimeout(() => {
      this.send({
        type: 'cpuProfile',
        duration: Date.now() - start
      });
    }, duration);
  }
  
  executeEval(code) {
    try {
      const result = eval(code);
      this.send({
        type: 'evalResult',
        result: String(result)
      });
    } catch (err) {
      this.send({
        type: 'evalError',
        error: err.message
      });
    }
  }
}

// Initialize client
const client = new SidewinderClient();

// Load hooks based on configuration
function loadHooks() {
  const hooks = config.hooks || client.getProfileHooks(config.profile);
  debug('Loading hooks:', hooks);
  
  hooks.forEach(hookName => {
    try {
      const hookPath = path.join(__dirname, '..', 'hooks', `${hookName}.cjs`);
      const hook = require(hookPath);
      hook.install(client, config);
      debug(`Installed hook: ${hookName}`);
    } catch (err) {
      debug(`Failed to load hook ${hookName}:`, err.message);
    }
  });
}

// Process event handlers
process.on('exit', (code) => {
  client.send({
    type: 'processExit',
    code
  });
});

process.on('uncaughtException', (err) => {
  client.send({
    type: 'uncaughtException',
    error: {
      message: err.message,
      stack: err.stack
    }
  });
});

process.on('unhandledRejection', (reason, promise) => {
  client.send({
    type: 'unhandledRejection',
    reason: reason instanceof Error ? {
      message: reason.message,
      stack: reason.stack
    } : String(reason)
  });
});

// Server lifecycle monitoring
function wrapServerCreation() {
  const http = require('http');
  const https = require('https');
  
  // Wrap HTTP server creation
  const originalCreateServer = http.createServer;
  http.createServer = function wrappedCreateServer(...args) {
    debug('HTTP server being created');
    try {
      const server = originalCreateServer.apply(this, args);
      
      // Send server creation signal
      client.send({
        type: 'server-lifecycle',
        event: 'http-server-created',
        timestamp: Date.now()
      });
      
      // Wrap the listen method
      const originalListen = server.listen;
      server.listen = function wrappedListen(...listenArgs) {
        debug('HTTP server starting to listen');
        
        try {
          const result = originalListen.apply(this, listenArgs);
          
          // Extract port from arguments
          let port = listenArgs[0];
          if (typeof port === 'object' && port !== null) {
            port = port.port;
          }
          
          // Send listening event after successful bind
          this.once('listening', () => {
            const address = this.address();
            debug(`Server listening on port ${address?.port || port}`);
            
            client.send({
              type: 'server-lifecycle',
              event: 'server-listening',
              port: address?.port || port,
              address: address,
              timestamp: Date.now()
            });
          });
          
          // Send error event if binding fails
          this.once('error', (err) => {
            debug(`Server error: ${err.message}`);
            
            client.send({
              type: 'server-lifecycle',  
              event: 'server-error',
              error: {
                message: err.message,
                code: err.code,
                port: port
              },
              timestamp: Date.now()
            });
          });
          
          return result;
        } catch (err) {
          debug(`Server listen error: ${err.message}`);
          client.send({
            type: 'server-lifecycle',
            event: 'server-listen-error',
            error: {
              message: err.message,
              stack: err.stack
            },
            timestamp: Date.now()
          });
          throw err;
        }
      };
      
      return server;
    } catch (err) {
      debug(`Server creation error: ${err.message}`);
      client.send({
        type: 'server-lifecycle',
        event: 'server-creation-error',
        error: {
          message: err.message,
          stack: err.stack
        },
        timestamp: Date.now()
      });
      throw err;
    }
  };
  
  // Wrap HTTPS server creation similarly
  const originalCreateSecureServer = https.createServer;
  https.createServer = function wrappedCreateSecureServer(...args) {
    debug('HTTPS server being created');
    try {
      const server = originalCreateSecureServer.apply(this, args);
      
      client.send({
        type: 'server-lifecycle',
        event: 'https-server-created',
        timestamp: Date.now()
      });
      
      // Wrap listen method for HTTPS too
      const originalListen = server.listen;
      server.listen = function wrappedListen(...listenArgs) {
        try {
          const result = originalListen.apply(this, listenArgs);
          
          let port = listenArgs[0];
          if (typeof port === 'object' && port !== null) {
            port = port.port;
          }
          
          this.once('listening', () => {
            const address = this.address();
            client.send({
              type: 'server-lifecycle',
              event: 'server-listening',
              port: address?.port || port,
              address: address,
              https: true,
              timestamp: Date.now()
            });
          });
          
          this.once('error', (err) => {
            client.send({
              type: 'server-lifecycle',
              event: 'server-error',
              error: {
                message: err.message,
                code: err.code,
                port: port
              },
              https: true,
              timestamp: Date.now()
            });
          });
          
          return result;
        } catch (err) {
          client.send({
            type: 'server-lifecycle',
            event: 'server-listen-error',
            error: {
              message: err.message,
              stack: err.stack
            },
            https: true,
            timestamp: Date.now()
          });
          throw err;
        }
      };
      
      return server;
    } catch (err) {
      client.send({
        type: 'server-lifecycle',
        event: 'server-creation-error',
        error: {
          message: err.message,
          stack: err.stack
        },
        https: true,
        timestamp: Date.now()
      });
      throw err;
    }
  };
}

// Start instrumentation
try {
  // Connect to monitoring server
  client.connect();
  
  // Wrap server creation BEFORE loading hooks
  wrapServerCreation();
  
  // Load and install hooks
  loadHooks();
  
  // Send startup message
  client.send({
    type: 'processStart',
    argv: process.argv,
    cwd: process.cwd(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch
  });
  
  debug('Sidewinder instrumentation active with server lifecycle monitoring');
} catch (err) {
  console.error('[Sidewinder] Failed to initialize:', err);
  
  // Send initialization error
  if (client) {
    client.send({
      type: 'sidewinder-init-error',
      error: {
        message: err.message,
        stack: err.stack
      },
      timestamp: Date.now()
    });
  }
}

// Export for use by hooks
module.exports = { client, config };