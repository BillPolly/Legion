/**
 * Async Hook - Tracks async context for request correlation
 */

const { AsyncLocalStorage } = require('async_hooks');
const crypto = require('crypto');

function install(client, config) {
  // Create async local storage for request context
  const requestContext = new AsyncLocalStorage();
  
  // Make it globally available for other hooks
  global.__sidewinder.requestContext = requestContext;
  
  // Generate unique request IDs
  function generateRequestId() {
    return `req-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }
  
  // Wrap common async entry points
  function wrapAsyncEntryPoints() {
    // HTTP Server
    const http = require('http');
    const https = require('https');
    
    [http, https].forEach(module => {
      const originalCreateServer = module.createServer;
      
      module.createServer = function(...args) {
        const server = originalCreateServer.apply(this, args);
        
        // Wrap request handler to create context
        const originalEmit = server.emit;
        server.emit = function(event, ...eventArgs) {
          if (event === 'request') {
            const [req, res] = eventArgs;
            const requestId = req.headers['x-request-id'] || generateRequestId();
            
            // Run handler in context
            return requestContext.run({ requestId, startTime: Date.now() }, () => {
              // Add request ID to response headers
              res.setHeader('X-Request-Id', requestId);
              
              // Send context creation event
              client.send({
                type: 'async',
                subtype: 'contextCreated',
                requestId,
                url: req.url,
                method: req.method,
                timestamp: Date.now()
              });
              
              // Track when response ends
              const originalEnd = res.end;
              res.end = function(...args) {
                const context = requestContext.getStore();
                if (context) {
                  client.send({
                    type: 'async',
                    subtype: 'contextEnded',
                    requestId: context.requestId,
                    duration: Date.now() - context.startTime,
                    timestamp: Date.now()
                  });
                }
                return originalEnd.apply(this, args);
              };
              
              return originalEmit.call(this, event, ...eventArgs);
            });
          }
          return originalEmit.call(this, event, ...eventArgs);
        };
        
        return server;
      };
    });
    
    // Timers - maintain context across setTimeout/setInterval
    const originalSetTimeout = global.setTimeout;
    const originalSetInterval = global.setInterval;
    const originalSetImmediate = global.setImmediate;
    
    global.setTimeout = function(callback, delay, ...args) {
      const context = requestContext.getStore();
      if (!context) {
        return originalSetTimeout(callback, delay, ...args);
      }
      
      const wrappedCallback = function() {
        return requestContext.run(context, () => callback.apply(this, arguments));
      };
      
      return originalSetTimeout(wrappedCallback, delay, ...args);
    };
    
    global.setInterval = function(callback, delay, ...args) {
      const context = requestContext.getStore();
      if (!context) {
        return originalSetInterval(callback, delay, ...args);
      }
      
      const wrappedCallback = function() {
        return requestContext.run(context, () => callback.apply(this, arguments));
      };
      
      return originalSetInterval(wrappedCallback, delay, ...args);
    };
    
    global.setImmediate = function(callback, ...args) {
      const context = requestContext.getStore();
      if (!context) {
        return originalSetImmediate(callback, ...args);
      }
      
      const wrappedCallback = function() {
        return requestContext.run(context, () => callback.apply(this, arguments));
      };
      
      return originalSetImmediate(wrappedCallback, ...args);
    };
    
    // Process.nextTick
    const originalNextTick = process.nextTick;
    process.nextTick = function(callback, ...args) {
      const context = requestContext.getStore();
      if (!context) {
        return originalNextTick(callback, ...args);
      }
      
      const wrappedCallback = function() {
        return requestContext.run(context, () => callback.apply(this, arguments));
      };
      
      return originalNextTick(wrappedCallback, ...args);
    };
    
    // Promises - maintain context across async/await
    const OriginalPromise = Promise;
    const originalThen = OriginalPromise.prototype.then;
    
    OriginalPromise.prototype.then = function(onFulfilled, onRejected) {
      const context = requestContext.getStore();
      
      const wrappedOnFulfilled = onFulfilled && function(value) {
        if (context) {
          return requestContext.run(context, () => onFulfilled(value));
        }
        return onFulfilled(value);
      };
      
      const wrappedOnRejected = onRejected && function(reason) {
        if (context) {
          return requestContext.run(context, () => onRejected(reason));
        }
        return onRejected(reason);
      };
      
      return originalThen.call(this, wrappedOnFulfilled, wrappedOnRejected);
    };
  }
  
  // Enhance logging with request context
  function enhanceLogging() {
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    
    ['log', 'error', 'warn', 'info', 'debug'].forEach(method => {
      const original = console[method];
      console[method] = function(...args) {
        const context = requestContext.getStore();
        
        if (context && context.requestId) {
          // Prepend request ID to logs
          args.unshift(`[${context.requestId}]`);
        }
        
        return original.apply(console, args);
      };
    });
  }
  
  // Track async resource creation
  if (config.trackResources) {
    const async_hooks = require('async_hooks');
    const resourceMap = new Map();
    
    const asyncHook = async_hooks.createHook({
      init(asyncId, type, triggerAsyncId, resource) {
        const context = requestContext.getStore();
        if (context) {
          resourceMap.set(asyncId, {
            type,
            requestId: context.requestId,
            triggerAsyncId,
            created: Date.now()
          });
          
          // Sample resource creation events (to avoid overwhelming)
          if (Math.random() < 0.1) {
            client.send({
              type: 'async',
              subtype: 'resourceCreated',
              asyncId,
              resourceType: type,
              requestId: context.requestId,
              timestamp: Date.now()
            });
          }
        }
      },
      
      destroy(asyncId) {
        const resource = resourceMap.get(asyncId);
        if (resource) {
          const lifetime = Date.now() - resource.created;
          resourceMap.delete(asyncId);
          
          // Track long-lived resources
          if (lifetime > 5000) {
            client.send({
              type: 'async',
              subtype: 'longLivedResource',
              asyncId,
              resourceType: resource.type,
              requestId: resource.requestId,
              lifetime,
              timestamp: Date.now()
            });
          }
        }
      }
    });
    
    asyncHook.enable();
    
    // Cleanup on exit
    process.on('exit', () => {
      asyncHook.disable();
    });
  }
  
  // Install enhancements
  wrapAsyncEntryPoints();
  enhanceLogging();
  
  // Expose helper for manual context creation
  global.__sidewinder.createContext = function(requestId) {
    return requestContext.run({ requestId, startTime: Date.now() }, () => {
      client.send({
        type: 'async',
        subtype: 'manualContextCreated',
        requestId,
        timestamp: Date.now()
      });
      return requestId;
    });
  };
  
  // Get current context
  global.__sidewinder.getContext = function() {
    const context = requestContext.getStore();
    return context ? context.requestId : null;
  };
  
  client.send({
    type: 'async',
    subtype: 'hookInstalled',
    features: {
      contextTracking: true,
      resourceTracking: config.trackResources || false,
      enhancedLogging: true
    },
    timestamp: Date.now()
  });
}

module.exports = { install };