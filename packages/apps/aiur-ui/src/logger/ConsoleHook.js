/**
 * ConsoleHook - Intercepts console methods while preserving original behavior
 * 
 * This module hooks into all console methods (log, error, warn, info, debug)
 * to capture logs for transmission to the backend while maintaining the
 * original console functionality for developers.
 */

export class ConsoleHook {
  constructor(config = {}) {
    this.config = {
      captureStackTrace: config.captureStackTrace !== false,
      maxStackDepth: config.maxStackDepth || 10,
      filterSensitive: config.filterSensitive !== false,
      ...config
    };
    
    this.originalMethods = {};
    this.logBuffer = [];
    this.listeners = [];
    this.isHooked = false;
    
    // Sensitive data patterns to filter
    this.sensitivePatterns = [
      /password/i,
      /token/i,
      /key/i,
      /secret/i,
      /auth/i,
      /credential/i
    ];
  }
  
  /**
   * Install console hooks
   */
  install() {
    if (this.isHooked) {
      return;
    }
    
    const methods = ['log', 'error', 'warn', 'info', 'debug', 'trace'];
    
    methods.forEach(method => {
      if (console[method]) {
        // Store original method
        this.originalMethods[method] = console[method].bind(console);
        
        // Replace with our hooked version
        console[method] = (...args) => {
          // Call original method first (preserve developer experience)
          this.originalMethods[method](...args);
          
          // Capture the log
          this.captureLog(method, args);
        };
      }
    });
    
    this.isHooked = true;
    console.log('Legion ConsoleHook: Console logging intercepted');
  }
  
  /**
   * Remove console hooks and restore original methods
   */
  uninstall() {
    if (!this.isHooked) {
      return;
    }
    
    Object.keys(this.originalMethods).forEach(method => {
      console[method] = this.originalMethods[method];
    });
    
    this.originalMethods = {};
    this.isHooked = false;
    console.log('Legion ConsoleHook: Console hooks removed');
  }
  
  /**
   * Capture a console log entry
   */
  captureLog(level, args) {
    // Prevent infinite recursion by checking if this is a ConsoleHook error
    if (args.length > 0 && typeof args[0] === 'string' && args[0].includes('ConsoleHook')) {
      return; // Skip capturing our own error messages
    }
    
    try {
      const logEntry = {
        timestamp: Date.now(),
        level: level,
        messages: this.processArgs(args),
        url: window?.location?.href || 'unknown',
        userAgent: navigator?.userAgent || 'unknown',
        sessionId: this.getSessionId()
      };
      
      // Add stack trace for errors
      if ((level === 'error' || level === 'trace') && this.config.captureStackTrace) {
        logEntry.stackTrace = this.getStackTrace();
      }
      
      // Add to buffer
      this.logBuffer.push(logEntry);
      
      // Notify listeners
      this.notifyListeners(logEntry);
      
    } catch (error) {
      // Use original console to avoid infinite recursion - and don't capture this error
      if (this.originalMethods.error) {
        this.originalMethods.error('ConsoleHook capture error:', error.message);
      }
    }
  }
  
  /**
   * Process console arguments for safe serialization
   */
  processArgs(args) {
    return args.map(arg => {
      try {
        if (arg === null || arg === undefined) {
          return String(arg);
        }
        
        if (typeof arg === 'string') {
          return this.config.filterSensitive ? this.filterSensitiveData(arg) : arg;
        }
        
        if (typeof arg === 'object') {
          if (arg instanceof Error) {
            return {
              __type: 'Error',
              name: arg.name,
              message: arg.message,
              stack: arg.stack
            };
          }
          
          if (arg instanceof Event) {
            return {
              __type: 'Event',
              type: arg.type,
              target: arg.target?.tagName || 'unknown'
            };
          }
          
          // Try to serialize object, with circular reference protection
          return this.safeStringify(arg);
        }
        
        return String(arg);
        
      } catch (error) {
        return '[Unserializable Object]';
      }
    });
  }
  
  /**
   * Safe JSON stringify with circular reference protection
   */
  safeStringify(obj, depth = 0) {
    if (depth > 3) return '[Max Depth Reached]';
    
    const seen = new WeakSet();
    
    try {
      return JSON.parse(JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[Circular Reference]';
          }
          seen.add(value);
        }
        
        // Filter sensitive keys
        if (this.config.filterSensitive && typeof key === 'string') {
          if (this.sensitivePatterns.some(pattern => pattern.test(key))) {
            return '[FILTERED]';
          }
        }
        
        return value;
      }));
    } catch (error) {
      return '[Serialization Error]';
    }
  }
  
  /**
   * Filter sensitive data from strings
   */
  filterSensitiveData(text) {
    // Look for key=value or "key":"value" patterns
    return text.replace(/(["\']?(?:password|token|key|secret|auth|credential)["\']?[:\s=]+)([^\s"',}]+)/gi, '$1[FILTERED]');
  }
  
  /**
   * Get current stack trace
   */
  getStackTrace() {
    try {
      const error = new Error();
      const stack = error.stack?.split('\n') || [];
      
      // Remove the first few frames (this function, captureLog, console method)
      return stack.slice(4, 4 + this.config.maxStackDepth).map(line => line.trim());
    } catch (error) {
      return ['Stack trace unavailable'];
    }
  }
  
  /**
   * Get or generate session ID
   */
  getSessionId() {
    let sessionId = window.sessionStorage?.getItem('legion-session-id');
    
    if (!sessionId) {
      sessionId = 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
      window.sessionStorage?.setItem('legion-session-id', sessionId);
    }
    
    return sessionId;
  }
  
  /**
   * Add listener for captured logs
   */
  addListener(callback) {
    this.listeners.push(callback);
  }
  
  /**
   * Remove listener
   */
  removeListener(callback) {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }
  
  /**
   * Notify all listeners of a new log entry
   */
  notifyListeners(logEntry) {
    this.listeners.forEach(callback => {
      try {
        callback(logEntry);
      } catch (error) {
        // Don't capture listener errors to avoid recursion
        if (this.originalMethods.error) {
          this.originalMethods.error('ConsoleHook listener error:', error.message);
        }
      }
    });
  }
  
  /**
   * Get buffered logs and optionally clear buffer
   */
  getBufferedLogs(clear = false) {
    const logs = [...this.logBuffer];
    if (clear) {
      this.logBuffer = [];
    }
    return logs;
  }
  
  /**
   * Clear log buffer
   */
  clearBuffer() {
    this.logBuffer = [];
  }
  
  /**
   * Get statistics about captured logs
   */
  getStats() {
    const stats = {
      total: this.logBuffer.length,
      byLevel: {}
    };
    
    this.logBuffer.forEach(log => {
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
    });
    
    return stats;
  }
}