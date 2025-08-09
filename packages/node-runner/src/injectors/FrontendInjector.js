/**
 * @fileoverview FrontendInjector - Generates JavaScript code for frontend log capture
 */

export class FrontendInjector {
  constructor(config = {}) {
    this.config = {
      captureConsole: config.captureConsole !== false,
      captureErrors: config.captureErrors !== false,
      captureNetwork: config.captureNetwork !== false,
      capturePerformance: config.capturePerformance || false,
      includePolyfills: config.includePolyfills || false,
      batchSize: config.batchSize || 50,
      batchInterval: config.batchInterval || 5000,
      maxMessageSize: config.maxMessageSize || 10000,
      logLevels: config.logLevels || ['log', 'error', 'warn', 'info'],
      urlFilter: config.urlFilter || null,
      ...config
    };
  }

  /**
   * Generate the complete injection script
   * @param {string} wsUrl - WebSocket server URL
   * @param {Object} options - Additional options
   * @returns {string} JavaScript code to inject
   */
  generateScript(wsUrl, options = {}) {
    const { sessionId, metadata, debug, minify } = options;
    
    let script = `(function() {
  'use strict';
  
  ${this.config.includePolyfills ? `
  // Polyfill checks
  if (typeof WebSocket === 'undefined') {
    console.warn('[Logger] WebSocket not supported');
    return;
  }
  if (typeof fetch === 'undefined') {
    console.warn('[Logger] Fetch API not supported');
  }` : ''}
  
  // Check WebSocket support
  if (!('WebSocket' in window)) {
    console.warn('[Logger] WebSocket not supported in this browser');
    return;
  }
  
  const config = {
    wsUrl: '${wsUrl}',
    sessionId: '${sessionId || 'default'}',
    debug: ${debug || false},
    maxMessageSize: ${this.config.maxMessageSize},
    batchSize: ${this.config.batchSize},
    batchInterval: ${this.config.batchInterval},
    metadata: ${JSON.stringify(metadata || {})}
  };
  
  let ws = null;
  let messageQueue = [];
  let batchTimer = null;
  let reconnectTimer = null;
  let reconnectAttempts = 0;
  
  // Utility functions
  function escape(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[<>&"']/g, function(c) {
      switch(c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '"': return '&quot;';
        case "'": return '&#39;';
        default: return c;
      }
    });
  }
  
  function truncate(str, maxLength) {
    if (typeof str !== 'string') return str;
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '... (truncated)';
  }
  
  function getTimestamp() {
    return new Date().toISOString();
  }
  
  // WebSocket Management
  function connect() {
    try {
      ws = new WebSocket(config.wsUrl);
      
      ws.onopen = function() {
        if (config.debug) {
          console.log('[Logger] Connected to logging server');
        }
        reconnectAttempts = 0;
        flushQueue();
      };
      
      ws.onclose = function() {
        ws = null;
        scheduleReconnect();
      };
      
      ws.onerror = function(error) {
        if (config.debug) {
          console.error('[Logger] WebSocket error:', error);
        }
      };
    } catch (error) {
      if (config.debug) {
        console.error('[Logger] Failed to connect:', error);
      }
      scheduleReconnect();
    }
  }
  
  function scheduleReconnect() {
    if (reconnectTimer) return;
    
    reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
    
    reconnectTimer = setTimeout(function() {
      reconnectTimer = null;
      connect();
    }, delay);
  }
  
  function sendMessage(message) {
    const fullMessage = Object.assign({}, message, {
      sessionId: config.sessionId,
      timestamp: getTimestamp(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      metadata: config.metadata
    });
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(fullMessage));
      } catch (error) {
        queueMessage(fullMessage);
      }
    } else {
      queueMessage(fullMessage);
    }
  }
  
  function queueMessage(message) {
    messageQueue.push(message);
    
    if (messageQueue.length >= config.batchSize) {
      flushQueue();
    } else if (!batchTimer) {
      batchTimer = setTimeout(flushQueue, config.batchInterval);
    }
  }
  
  function flushQueue() {
    if (batchTimer) {
      clearTimeout(batchTimer);
      batchTimer = null;
    }
    
    if (messageQueue.length === 0) return;
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      const batch = {
        type: 'batch',
        messages: messageQueue.splice(0, config.batchSize)
      };
      
      try {
        ws.send(JSON.stringify(batch));
      } catch (error) {
        // Re-queue messages
        messageQueue.unshift(...batch.messages);
      }
    }
    
    if (messageQueue.length > 0 && !batchTimer) {
      batchTimer = setTimeout(flushQueue, config.batchInterval);
    }
  }
  
  ${this.config.captureConsole ? this.generateConsoleCapture() : ''}
  ${this.config.captureErrors ? this.generateErrorCapture() : ''}
  ${this.config.captureNetwork ? this.generateNetworkCapture() : ''}
  ${this.config.capturePerformance ? this.generatePerformanceCapture() : ''}
  
  // Debug indicator
  ${debug ? this.generateDebugIndicator() : ''}
  
  // Initialize connection
  connect();
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', function() {
    flushQueue();
    if (ws) {
      ws.close();
    }
  });
})();`;

    if (minify) {
      // Simple minification - remove comments and excess whitespace
      script = script
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
        .replace(/\n\s*/g, ' ')
        .replace(/\s{2,}/g, ' ');
    }

    return script;
  }

  /**
   * Generate console capture code
   * @returns {string} Console capture JavaScript
   */
  generateConsoleCapture() {
    const levels = this.config.logLevels;
    
    return `
  // Console capture
  ${levels.filter(level => ['log', 'error', 'warn', 'info', 'debug'].includes(level)).map(level => `
  const original${level.charAt(0).toUpperCase() + level.slice(1)} = console.${level};
  console.${level} = function() {
    const args = Array.prototype.slice.call(arguments);
    const message = args.map(function(arg) {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
    
    sendMessage({
      type: 'log',
      level: '${level}',
      message: truncate(escape(message), config.maxMessageSize),
      stack: ${level === 'error' ? 'new Error().stack' : 'null'}
    });
    
    original${level.charAt(0).toUpperCase() + level.slice(1)}.apply(console, arguments);
  };`).join('')}`;
  }

  /**
   * Generate error capture code
   * @returns {string} Error capture JavaScript
   */
  generateErrorCapture() {
    return `
  // Error capture
  window.addEventListener('error', function(event) {
    sendMessage({
      type: 'error',
      message: escape(event.message),
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error ? event.error.stack : null
    });
  });
  
  window.addEventListener('unhandledrejection', function(event) {
    sendMessage({
      type: 'error',
      message: 'Unhandled Promise Rejection',
      reason: escape(String(event.reason)),
      stack: event.reason && event.reason.stack ? event.reason.stack : null
    });
  });`;
  }

  /**
   * Generate network capture code
   * @returns {string} Network capture JavaScript
   */
  generateNetworkCapture() {
    const urlFilter = this.config.urlFilter;
    
    return `
  // Network capture
  const originalFetch = window.fetch;
  const urlFilter = ${urlFilter ? `new RegExp('${urlFilter}')` : 'null'};
  
  window.fetch = function(url, options) {
    const method = (options && options.method) || 'GET';
    const fullUrl = new URL(url, window.location.href).href;
    
    if (urlFilter && !urlFilter.test(fullUrl)) {
      return originalFetch.apply(this, arguments);
    }
    
    // Ensure credentials are handled properly
    if (!options) options = {};
    if (!options.credentials) options.credentials = 'same-origin';
    
    const startTime = performance.now();
    
    return originalFetch.apply(this, arguments).then(function(response) {
      const duration = performance.now() - startTime;
      
      sendMessage({
        type: 'network',
        method: method,
        url: fullUrl,
        status: response.status,
        duration: Math.round(duration),
        size: response.headers.get('content-length') || 0
      });
      
      return response;
    }).catch(function(error) {
      const duration = performance.now() - startTime;
      
      sendMessage({
        type: 'network',
        method: method,
        url: fullUrl,
        status: 0,
        duration: Math.round(duration),
        error: escape(error.message)
      });
      
      throw error;
    });
  };
  
  // XMLHttpRequest interception
  const XHROpen = XMLHttpRequest.prototype.open;
  const XHRSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url) {
    this._method = method;
    this._url = new URL(url, window.location.href).href;
    return XHROpen.apply(this, arguments);
  };
  
  XMLHttpRequest.prototype.send = function() {
    const xhr = this;
    const startTime = performance.now();
    
    if (urlFilter && !urlFilter.test(xhr._url)) {
      return XHRSend.apply(this, arguments);
    }
    
    xhr.addEventListener('loadend', function() {
      const duration = performance.now() - startTime;
      
      sendMessage({
        type: 'network',
        method: xhr._method,
        url: xhr._url,
        status: xhr.status,
        duration: Math.round(duration)
      });
    });
    
    return XHRSend.apply(this, arguments);
  };`;
  }

  /**
   * Generate performance capture code
   * @returns {string} Performance capture JavaScript
   */
  generatePerformanceCapture() {
    return `
  // Performance capture
  if ('PerformanceObserver' in window) {
    try {
      const perfObserver = new PerformanceObserver(function(list) {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            sendMessage({
              type: 'performance',
              subtype: 'navigation',
              duration: entry.duration,
              domContentLoaded: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
              loadComplete: entry.loadEventEnd - entry.loadEventStart
            });
          } else if (entry.entryType === 'resource') {
            sendMessage({
              type: 'performance',
              subtype: 'resource',
              name: entry.name,
              duration: entry.duration,
              size: entry.transferSize || 0
            });
          }
        }
      });
      
      perfObserver.observe({ entryTypes: ['navigation', 'resource'] });
    } catch (error) {
      if (config.debug) {
        console.error('[Logger] Failed to setup performance observer:', error);
      }
    }
  }`;
  }

  /**
   * Generate debug indicator
   * @returns {string} Debug indicator HTML/CSS
   */
  generateDebugIndicator() {
    return `
  // Debug indicator
  const indicator = document.createElement('div');
  indicator.style.cssText = 'position: fixed; bottom: 10px; right: 10px; background: #4CAF50; color: white; padding: 5px 10px; border-radius: 3px; font-size: 12px; z-index: 999999;';
  indicator.textContent = 'Logging Active';
  document.body.appendChild(indicator);
  
  // Update indicator based on connection status
  setInterval(function() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      indicator.style.background = '#4CAF50';
      indicator.textContent = 'Logging Active';
    } else {
      indicator.style.background = '#f44336';
      indicator.textContent = 'Logging Disconnected';
    }
  }, 1000);`;
  }

  /**
   * Generate HTML script tag
   * @param {string} wsUrl - WebSocket server URL
   * @param {Object} options - Additional options
   * @returns {string} HTML script tag
   */
  generateScriptTag(wsUrl, options = {}) {
    const script = this.generateScript(wsUrl, options);
    const attributes = [];
    
    if (options.sessionId) {
      attributes.push(`data-session-id="${options.sessionId}"`);
    }
    
    if (options.debug) {
      attributes.push(`data-debug="${options.debug}"`);
    }
    
    return `<script ${attributes.join(' ')}>${script}</script>`;
  }
}