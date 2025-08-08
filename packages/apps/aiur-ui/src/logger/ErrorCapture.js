/**
 * ErrorCapture - Captures unhandled errors and promise rejections
 * 
 * This module sets up global error handlers to catch:
 * - Unhandled JavaScript errors
 * - Unhandled promise rejections
 * - Network errors
 * - Resource loading errors
 */

export class ErrorCapture {
  constructor(config = {}) {
    this.config = {
      captureUnhandledErrors: config.captureUnhandledErrors !== false,
      capturePromiseRejections: config.capturePromiseRejections !== false,
      captureResourceErrors: config.captureResourceErrors !== false,
      captureNetworkErrors: config.captureNetworkErrors !== false,
      maxErrorsPerMinute: config.maxErrorsPerMinute || 50,
      ...config
    };
    
    this.errorBuffer = [];
    this.listeners = [];
    this.isInstalled = false;
    this.errorCounts = new Map();
    this.rateLimitWindow = 60000; // 1 minute
    
    // Bind handlers to preserve context
    this.handleError = this.handleError.bind(this);
    this.handlePromiseRejection = this.handlePromiseRejection.bind(this);
    this.handleResourceError = this.handleResourceError.bind(this);
  }
  
  /**
   * Install error capture handlers
   */
  install() {
    if (this.isInstalled) {
      return;
    }
    
    if (this.config.captureUnhandledErrors) {
      window.addEventListener('error', this.handleError, true);
    }
    
    if (this.config.capturePromiseRejections) {
      window.addEventListener('unhandledrejection', this.handlePromiseRejection, true);
    }
    
    if (this.config.captureResourceErrors) {
      window.addEventListener('error', this.handleResourceError, true);
    }
    
    if (this.config.captureNetworkErrors) {
      this.installNetworkErrorCapture();
    }
    
    this.isInstalled = true;
    console.log('Legion ErrorCapture: Error handlers installed');
  }
  
  /**
   * Remove error capture handlers
   */
  uninstall() {
    if (!this.isInstalled) {
      return;
    }
    
    window.removeEventListener('error', this.handleError, true);
    window.removeEventListener('unhandledrejection', this.handlePromiseRejection, true);
    window.removeEventListener('error', this.handleResourceError, true);
    
    this.isInstalled = false;
    console.log('Legion ErrorCapture: Error handlers removed');
  }
  
  /**
   * Handle JavaScript errors
   */
  handleError(event) {
    try {
      // Skip resource errors (handled by handleResourceError)
      if (event.target !== window) {
        return;
      }
      
      const errorEntry = {
        type: 'javascript_error',
        timestamp: Date.now(),
        message: event.message || 'Unknown error',
        filename: event.filename || 'unknown',
        lineNumber: event.lineno || 0,
        columnNumber: event.colno || 0,
        stack: event.error?.stack || 'No stack trace available',
        url: window.location.href,
        userAgent: navigator.userAgent,
        sessionId: this.getSessionId()
      };
      
      // Add additional error context
      if (event.error) {
        errorEntry.errorName = event.error.name;
        errorEntry.errorType = event.error.constructor?.name || 'Error';
      }
      
      this.captureError(errorEntry);
      
    } catch (captureError) {
      console.error('ErrorCapture handleError failed:', captureError);
    }
  }
  
  /**
   * Handle unhandled promise rejections
   */
  handlePromiseRejection(event) {
    try {
      const errorEntry = {
        type: 'promise_rejection',
        timestamp: Date.now(),
        reason: this.serializeRejectionReason(event.reason),
        url: window.location.href,
        userAgent: navigator.userAgent,
        sessionId: this.getSessionId()
      };
      
      // Add stack trace if available
      if (event.reason instanceof Error) {
        errorEntry.stack = event.reason.stack;
        errorEntry.message = event.reason.message;
        errorEntry.errorName = event.reason.name;
      }
      
      this.captureError(errorEntry);
      
    } catch (captureError) {
      console.error('ErrorCapture handlePromiseRejection failed:', captureError);
    }
  }
  
  /**
   * Handle resource loading errors
   */
  handleResourceError(event) {
    try {
      // Only handle resource errors (not JavaScript errors)
      if (event.target === window) {
        return;
      }
      
      const target = event.target;
      const errorEntry = {
        type: 'resource_error',
        timestamp: Date.now(),
        resourceType: target.tagName?.toLowerCase() || 'unknown',
        resourceUrl: target.src || target.href || 'unknown',
        message: `Failed to load ${target.tagName}: ${target.src || target.href}`,
        url: window.location.href,
        userAgent: navigator.userAgent,
        sessionId: this.getSessionId()
      };
      
      // Add additional resource context
      if (target.id) errorEntry.resourceId = target.id;
      if (target.className) errorEntry.resourceClass = target.className;
      
      this.captureError(errorEntry);
      
    } catch (captureError) {
      console.error('ErrorCapture handleResourceError failed:', captureError);
    }
  }
  
  /**
   * Install network error capture by patching fetch and XMLHttpRequest
   */
  installNetworkErrorCapture() {
    // Patch fetch
    if (window.fetch) {
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        try {
          const response = await originalFetch(...args);
          
          // Capture HTTP errors
          if (!response.ok) {
            this.captureNetworkError({
              type: 'fetch_error',
              url: args[0],
              status: response.status,
              statusText: response.statusText,
              method: args[1]?.method || 'GET'
            });
          }
          
          return response;
        } catch (error) {
          // Capture network failures
          this.captureNetworkError({
            type: 'fetch_failure',
            url: args[0],
            error: error.message,
            method: args[1]?.method || 'GET'
          });
          throw error;
        }
      };
    }
    
    // Patch XMLHttpRequest
    if (window.XMLHttpRequest) {
      const OriginalXHR = window.XMLHttpRequest;
      window.XMLHttpRequest = function(...args) {
        const xhr = new OriginalXHR(...args);
        
        xhr.addEventListener('error', () => {
          this.captureNetworkError({
            type: 'xhr_error',
            url: xhr.responseURL || 'unknown',
            status: xhr.status,
            statusText: xhr.statusText,
            method: 'XHR'
          });
        });
        
        xhr.addEventListener('timeout', () => {
          this.captureNetworkError({
            type: 'xhr_timeout',
            url: xhr.responseURL || 'unknown',
            timeout: xhr.timeout,
            method: 'XHR'
          });
        });
        
        return xhr;
      }.bind(this);
    }
  }
  
  /**
   * Capture network errors
   */
  captureNetworkError(errorInfo) {
    const errorEntry = {
      type: 'network_error',
      timestamp: Date.now(),
      ...errorInfo,
      url: window.location.href,
      userAgent: navigator.userAgent,
      sessionId: this.getSessionId()
    };
    
    this.captureError(errorEntry);
  }
  
  /**
   * Serialize promise rejection reasons
   */
  serializeRejectionReason(reason) {
    if (reason instanceof Error) {
      return {
        name: reason.name,
        message: reason.message,
        stack: reason.stack
      };
    }
    
    if (typeof reason === 'object') {
      try {
        return JSON.parse(JSON.stringify(reason));
      } catch (error) {
        return '[Non-serializable object]';
      }
    }
    
    return String(reason);
  }
  
  /**
   * Main error capture function with rate limiting
   */
  captureError(errorEntry) {
    try {
      // Rate limiting
      if (!this.checkRateLimit(errorEntry)) {
        return;
      }
      
      // Add to buffer
      this.errorBuffer.push(errorEntry);
      
      // Notify listeners
      this.notifyListeners(errorEntry);
      
    } catch (error) {
      console.error('ErrorCapture failed:', error);
    }
  }
  
  /**
   * Check rate limiting for errors
   */
  checkRateLimit(errorEntry) {
    const now = Date.now();
    const key = `${errorEntry.type}:${errorEntry.message || ''}`;
    
    // Clean up old entries
    for (const [errorKey, timestamps] of this.errorCounts.entries()) {
      this.errorCounts.set(errorKey, timestamps.filter(t => now - t < this.rateLimitWindow));
      if (this.errorCounts.get(errorKey).length === 0) {
        this.errorCounts.delete(errorKey);
      }
    }
    
    // Check current error count
    if (!this.errorCounts.has(key)) {
      this.errorCounts.set(key, []);
    }
    
    const timestamps = this.errorCounts.get(key);
    
    if (timestamps.length >= this.config.maxErrorsPerMinute) {
      return false; // Rate limited
    }
    
    timestamps.push(now);
    return true;
  }
  
  /**
   * Get session ID (same as ConsoleHook)
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
   * Add listener for captured errors
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
   * Notify all listeners of a new error
   */
  notifyListeners(errorEntry) {
    this.listeners.forEach(callback => {
      try {
        callback(errorEntry);
      } catch (error) {
        console.error('ErrorCapture listener error:', error);
      }
    });
  }
  
  /**
   * Get buffered errors and optionally clear buffer
   */
  getBufferedErrors(clear = false) {
    const errors = [...this.errorBuffer];
    if (clear) {
      this.errorBuffer = [];
    }
    return errors;
  }
  
  /**
   * Clear error buffer
   */
  clearBuffer() {
    this.errorBuffer = [];
  }
  
  /**
   * Get error statistics
   */
  getStats() {
    const stats = {
      total: this.errorBuffer.length,
      byType: {},
      rateLimited: Array.from(this.errorCounts.entries()).map(([key, timestamps]) => ({
        key,
        count: timestamps.length
      }))
    };
    
    this.errorBuffer.forEach(error => {
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
    });
    
    return stats;
  }
}