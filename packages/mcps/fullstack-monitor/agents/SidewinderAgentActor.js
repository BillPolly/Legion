/**
 * SidewinderAgentActor - Injected into Node.js processes for instrumentation
 * Wraps existing Sidewinder functionality with Actor protocol
 * This script is injected into Node.js runtime
 */

import { WebSocket } from 'ws';

// Simple Actor implementation for Node context
class SidewinderAgentActor {
  constructor(config = {}) {
    this.isActor = true;
    this.guid = `sidewinder-${process.pid}-${Date.now()}`;
    this.sessionId = config.sessionId || 'default';
    this.wsPort = config.wsPort || 9898;
    this.ws = null;
    this.remoteMonitor = null;
    this.isConnected = false;
    
    // Stats tracking
    this.stats = {
      httpRequests: 0,
      consoleMessages: 0,
      errors: 0,
      asyncOperations: 0
    };
    
    // Request tracking for correlation
    this.activeRequests = new Map();
    
    this.connect();
  }
  
  connect() {
    try {
      this.ws = new WebSocket(`ws://localhost:${this.wsPort}`);
      
      this.ws.on('open', () => {
        this.isConnected = true;
        console.log(`[SidewinderAgentActor] Connected to monitor on port ${this.wsPort}`);
        
        // Send identification
        this.send('identify', {
          pid: process.pid,
          sessionId: this.sessionId,
          name: process.argv[1] || 'node-process',
          guid: this.guid
        });
      });
      
      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.receive(message);
        } catch (error) {
          console.error('[SidewinderAgentActor] Failed to parse message:', error);
        }
      });
      
      this.ws.on('close', () => {
        this.isConnected = false;
        console.log('[SidewinderAgentActor] Disconnected from monitor');
        // Attempt reconnection after delay
        setTimeout(() => this.connect(), 5000);
      });
      
      this.ws.on('error', (error) => {
        console.error('[SidewinderAgentActor] WebSocket error:', error.message);
      });
      
    } catch (error) {
      console.error('[SidewinderAgentActor] Failed to connect:', error);
      // Attempt reconnection after delay
      setTimeout(() => this.connect(), 5000);
    }
  }
  
  receive(message) {
    const { type, data } = message;
    
    switch (type) {
      case 'identified':
        console.log('[SidewinderAgentActor] Identified by monitor');
        break;
        
      case 'setLogLevel':
        this.setLogLevel(data.level);
        break;
        
      case 'get-stats':
        this.sendStats();
        break;
        
      default:
        console.warn('[SidewinderAgentActor] Unknown message type:', type);
    }
  }
  
  send(type, data) {
    if (this.isConnected && this.ws) {
      const message = {
        type,
        ...data,
        processId: process.pid,
        timestamp: Date.now()
      };
      
      this.ws.send(JSON.stringify(message));
    }
  }
  
  sendStats() {
    this.send('stats', {
      ...this.stats,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    });
  }
  
  setLogLevel(level) {
    this.logLevel = level;
    console.log(`[SidewinderAgentActor] Log level set to: ${level}`);
  }
  
  // Wrap existing Sidewinder instrumentation
  
  /**
   * Instrument HTTP module
   */
  instrumentHTTP() {
    const http = require('http');
    const https = require('https');
    
    // Instrument both http and https
    [http, https].forEach(module => {
      const originalRequest = module.request;
      
      module.request = (...args) => {
        const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        let options = {};
        
        // Parse arguments
        if (typeof args[0] === 'string') {
          const url = new URL(args[0]);
          options = {
            host: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: 'GET'
          };
        } else if (args[0]) {
          options = args[0];
        }
        
        // Extract correlation ID if present
        const headers = options.headers || {};
        const correlationId = headers['x-correlation-id'] || headers['x-request-id'];
        
        // Send request start event
        this.stats.httpRequests++;
        this.send('http', {
          subtype: 'requestStart',
          requestId,
          request: {
            method: options.method || 'GET',
            host: options.host || options.hostname,
            port: options.port,
            path: options.path || '/',
            headers
          },
          context: {
            correlationId,
            requestId
          }
        });
        
        const startTime = Date.now();
        this.activeRequests.set(requestId, { startTime, options });
        
        const req = originalRequest.apply(module, args);
        
        // Instrument response
        req.on('response', (res) => {
          const duration = Date.now() - startTime;
          
          this.send('http', {
            subtype: 'response',
            requestId,
            response: {
              statusCode: res.statusCode,
              statusMessage: res.statusMessage,
              headers: res.headers,
              duration
            },
            context: {
              correlationId,
              requestId
            }
          });
          
          this.activeRequests.delete(requestId);
        });
        
        req.on('error', (error) => {
          const duration = Date.now() - startTime;
          
          this.send('error', {
            subtype: 'http',
            error: {
              message: error.message,
              stack: error.stack
            },
            context: {
              requestId,
              duration
            }
          });
          
          this.activeRequests.delete(requestId);
        });
        
        return req;
      };
    });
  }
  
  /**
   * Instrument console methods
   */
  instrumentConsole() {
    const originalConsole = {};
    
    ['log', 'info', 'warn', 'error', 'debug', 'trace'].forEach(method => {
      originalConsole[method] = console[method];
      
      console[method] = (...args) => {
        originalConsole[method].apply(console, args);
        
        this.stats.consoleMessages++;
        
        this.send('console', {
          method,
          args: args.map(arg => {
            try {
              return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
            } catch (e) {
              return String(arg);
            }
          })
        });
      };
    });
  }
  
  /**
   * Instrument process errors
   */
  instrumentErrors() {
    process.on('uncaughtException', (error) => {
      this.stats.errors++;
      
      this.send('error', {
        subtype: 'uncaughtException',
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        }
      });
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      this.stats.errors++;
      
      this.send('error', {
        subtype: 'unhandledRejection',
        error: {
          message: reason instanceof Error ? reason.message : String(reason),
          stack: reason instanceof Error ? reason.stack : null
        }
      });
    });
    
    process.on('warning', (warning) => {
      this.send('warning', {
        message: warning.message,
        stack: warning.stack,
        name: warning.name
      });
    });
  }
  
  /**
   * Instrument async context for request tracking
   */
  instrumentAsyncContext() {
    try {
      const asyncHooks = require('async_hooks');
      
      const contexts = new Map();
      let currentContext = null;
      
      const asyncHook = asyncHooks.createHook({
        init(asyncId, type, triggerAsyncId) {
          // Propagate context from trigger to new async operation
          if (currentContext && type === 'HTTPINCOMINGMESSAGE') {
            contexts.set(asyncId, currentContext);
          } else if (contexts.has(triggerAsyncId)) {
            contexts.set(asyncId, contexts.get(triggerAsyncId));
          }
        },
        
        before(asyncId) {
          if (contexts.has(asyncId)) {
            currentContext = contexts.get(asyncId);
          }
        },
        
        after(asyncId) {
          currentContext = null;
        },
        
        destroy(asyncId) {
          contexts.delete(asyncId);
        }
      });
      
      asyncHook.enable();
      
      // Instrument HTTP server to create context
      const http = require('http');
      const originalCreateServer = http.createServer;
      
      http.createServer = function(...args) {
        const server = originalCreateServer.apply(this, args);
        
        server.on('request', (req, res) => {
          const requestId = `ctx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          currentContext = {
            requestId,
            method: req.method,
            url: req.url,
            startTime: Date.now()
          };
          
          this.stats.asyncOperations++;
          
          this.send('async', {
            subtype: 'contextCreated',
            requestId,
            method: req.method,
            url: req.url
          });
        });
        
        return server;
      }.bind(this);
      
    } catch (error) {
      console.warn('[SidewinderAgentActor] Async hooks not available:', error.message);
    }
  }
  
  /**
   * Initialize all instrumentation
   */
  initialize() {
    console.log('[SidewinderAgentActor] Initializing instrumentation...');
    
    this.instrumentHTTP();
    this.instrumentConsole();
    this.instrumentErrors();
    this.instrumentAsyncContext();
    
    // Send ready signal
    this.send('agent-ready', {
      pid: process.pid,
      version: process.version,
      platform: process.platform,
      arch: process.arch,
      argv: process.argv,
      cwd: process.cwd()
    });
    
    console.log('[SidewinderAgentActor] Instrumentation complete');
  }
}

// Auto-initialize if imported directly
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  const config = {
    sessionId: process.env.SIDEWINDER_SESSION_ID || 'default',
    wsPort: parseInt(process.env.SIDEWINDER_WS_PORT || '9898')
  };
  
  const agent = new SidewinderAgentActor(config);
  agent.initialize();
  
  module.exports = agent;
  
  // Keep process alive
  setInterval(() => {
    // Heartbeat
    if (agent.isConnected) {
      agent.send('heartbeat', {
        uptime: process.uptime(),
        memory: process.memoryUsage()
      });
    }
  }, 30000);
}

export default SidewinderAgentActor;