/**
 * Errors Hook - Global error and rejection handlers
 */

function install(client, config) {
  // Track if we've already installed handlers to avoid duplicates
  if (global.__sidewinder._errorsInstalled) {
    return;
  }
  global.__sidewinder._errorsInstalled = true;
  
  // Helper to extract error details
  function extractErrorDetails(err) {
    if (err instanceof Error) {
      return {
        name: err.name,
        message: err.message,
        stack: err.stack,
        code: err.code,
        // Include any custom properties
        ...Object.getOwnPropertyNames(err).reduce((acc, key) => {
          if (!['name', 'message', 'stack', 'code'].includes(key)) {
            acc[key] = err[key];
          }
          return acc;
        }, {})
      };
    }
    return {
      message: String(err),
      raw: err
    };
  }
  
  // Uncaught exceptions
  const originalUncaughtException = process.listeners('uncaughtException');
  process.removeAllListeners('uncaughtException');
  
  process.on('uncaughtException', (err, origin) => {
    // Send to monitor first
    client.send({
      type: 'error',
      subtype: 'uncaughtException',
      error: extractErrorDetails(err),
      origin,
      fatal: true,
      timestamp: Date.now()
    });
    
    // Call original handlers
    originalUncaughtException.forEach(handler => {
      handler(err, origin);
    });
    
    // If no original handlers, exit as Node would
    if (originalUncaughtException.length === 0) {
      console.error('Uncaught Exception:', err);
      process.exit(1);
    }
  });
  
  // Unhandled rejections
  const originalUnhandledRejection = process.listeners('unhandledRejection');
  process.removeAllListeners('unhandledRejection');
  
  process.on('unhandledRejection', (reason, promise) => {
    client.send({
      type: 'error',
      subtype: 'unhandledRejection',
      error: extractErrorDetails(reason),
      promiseId: promise ? promise.constructor.name : 'Unknown',
      fatal: false,
      timestamp: Date.now()
    });
    
    // Call original handlers
    originalUnhandledRejection.forEach(handler => {
      handler(reason, promise);
    });
  });
  
  // Rejection handled (useful for tracking)
  process.on('rejectionHandled', (promise) => {
    client.send({
      type: 'error',
      subtype: 'rejectionHandled',
      promiseId: promise ? promise.constructor.name : 'Unknown',
      timestamp: Date.now()
    });
  });
  
  // Warning events
  process.on('warning', (warning) => {
    client.send({
      type: 'error',
      subtype: 'warning',
      error: extractErrorDetails(warning),
      timestamp: Date.now()
    });
  });
  
  // Monkey-patch Error constructor to track error creation
  if (config.trackErrorCreation) {
    const OriginalError = Error;
    
    global.Error = class SidewinderError extends OriginalError {
      constructor(message) {
        super(message);
        
        // Send error creation event
        client.send({
          type: 'error',
          subtype: 'errorCreated',
          error: {
            message: this.message,
            stack: this.stack
          },
          timestamp: Date.now()
        });
      }
    };
    
    // Copy static properties
    Object.setPrototypeOf(global.Error, OriginalError);
    Object.setPrototypeOf(global.Error.prototype, OriginalError.prototype);
  }
  
  // Track Promise rejections in detail
  if (typeof Promise !== 'undefined' && config.trackPromises) {
    const OriginalPromise = Promise;
    const originalThen = OriginalPromise.prototype.then;
    const originalCatch = OriginalPromise.prototype.catch;
    
    OriginalPromise.prototype.then = function(onFulfilled, onRejected) {
      // Wrap rejection handler to track
      const wrappedOnRejected = onRejected ? function(reason) {
        client.send({
          type: 'error',
          subtype: 'promiseRejection',
          error: extractErrorDetails(reason),
          handled: true,
          timestamp: Date.now()
        });
        return onRejected.call(this, reason);
      } : undefined;
      
      return originalThen.call(this, onFulfilled, wrappedOnRejected);
    };
    
    OriginalPromise.prototype.catch = function(onRejected) {
      const wrappedOnRejected = function(reason) {
        client.send({
          type: 'error',
          subtype: 'promiseCatch',
          error: extractErrorDetails(reason),
          handled: true,
          timestamp: Date.now()
        });
        return onRejected.call(this, reason);
      };
      
      return originalCatch.call(this, wrappedOnRejected);
    };
  }
  
  // Listen for hook updates
  global.__sidewinder.on('updateHooks', (hooks) => {
    if (!hooks.errors) {
      // Remove our handlers (restoring original is complex, so we just remove)
      process.removeAllListeners('uncaughtException');
      process.removeAllListeners('unhandledRejection');
      process.removeAllListeners('rejectionHandled');
      process.removeAllListeners('warning');
      
      // Re-add original handlers
      originalUncaughtException.forEach(handler => {
        process.on('uncaughtException', handler);
      });
      originalUnhandledRejection.forEach(handler => {
        process.on('unhandledRejection', handler);
      });
    }
  });
}

module.exports = { install };