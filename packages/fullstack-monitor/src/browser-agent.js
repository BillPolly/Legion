/**
 * Browser Agent - Frontend monitoring agent for web pages
 * Injected into pages to capture console, network, errors, and DOM events
 */

(function() {
  'use strict';
  
  // Configuration (can be customized during injection)
  const config = {
    wsPort: window.__BROWSER_AGENT_PORT__ || '9901',
    wsHost: window.__BROWSER_AGENT_HOST__ || 'localhost',
    sessionId: window.__BROWSER_AGENT_SESSION__ || 'default',
    pageId: window.__BROWSER_AGENT_PAGE_ID__ || 'page-' + Date.now()
  };
  
  // WebSocket connection
  let ws = null;
  let connected = false;
  const messageQueue = [];
  let reconnectTimer = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 10;
  
  // Connect to FullStackMonitor
  function connect() {
    const url = `ws://${config.wsHost}:${config.wsPort}/browser`;
    
    try {
      ws = new WebSocket(url);
      
      ws.onopen = function() {
        connected = true;
        reconnectAttempts = 0;
        
        // Send identification
        send({
          type: 'identify',
          sessionId: config.sessionId,
          pageId: config.pageId,
          pageUrl: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: Date.now()
        });
        
        // Flush queued messages
        while (messageQueue.length > 0) {
          const msg = messageQueue.shift();
          ws.send(JSON.stringify(msg));
        }
      };
      
      ws.onclose = function() {
        connected = false;
        scheduleReconnect();
      };
      
      ws.onerror = function(error) {
        console.error('[Browser Agent] WebSocket error:', error);
      };
      
    } catch (err) {
      console.error('[Browser Agent] Failed to create WebSocket:', err);
      scheduleReconnect();
    }
  }
  
  // Schedule reconnection
  function scheduleReconnect() {
    if (reconnectTimer) return;
    if (reconnectAttempts >= maxReconnectAttempts) return;
    
    reconnectAttempts++;
    const delay = Math.min(1000 * reconnectAttempts, 5000);
    
    reconnectTimer = setTimeout(function() {
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
        messageQueue.push(message);
      }
    } else {
      // Queue message if not connected
      messageQueue.push(message);
      if (messageQueue.length > 500) {
        messageQueue.shift(); // Drop oldest message if queue too large
      }
    }
  }
  
  // Helper to serialize arguments
  function serializeArgs(args) {
    return Array.from(args).map(arg => {
      if (arg === undefined) return 'undefined';
      if (arg === null) return 'null';
      if (typeof arg === 'function') return arg.toString();
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    });
  }
  
  // Hook console methods
  const originalConsole = {};
  ['log', 'error', 'warn', 'info', 'debug'].forEach(function(method) {
    originalConsole[method] = console[method];
    console[method] = function() {
      // Send to FullStackMonitor
      send({
        type: 'console',
        method: method,
        args: serializeArgs(arguments),
        sessionId: config.sessionId,
        pageId: config.pageId,
        location: window.location.href,
        timestamp: Date.now()
      });
      
      // Call original method
      return originalConsole[method].apply(console, arguments);
    };
  });
  
  // Hook fetch for network monitoring and correlation
  const originalFetch = window.fetch;
  window.fetch = function(url, options) {
    const correlationId = 'correlation-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const method = (options && options.method) || 'GET';
    
    // Add correlation header
    if (!options) options = {};
    if (!options.headers) options.headers = {};
    if (options.headers instanceof Headers) {
      options.headers.append('X-Correlation-ID', correlationId);
    } else {
      options.headers['X-Correlation-ID'] = correlationId;
    }
    
    // Log the request with correlation
    console.log(`[${correlationId}] Fetch ${method} ${url}`);
    
    // Send network event
    send({
      type: 'network',
      subtype: 'request',
      method: method,
      url: String(url),
      correlationId: correlationId,
      sessionId: config.sessionId,
      pageId: config.pageId,
      timestamp: Date.now()
    });
    
    // Call original fetch and track response
    const startTime = Date.now();
    return originalFetch.apply(window, arguments).then(
      function(response) {
        const duration = Date.now() - startTime;
        
        send({
          type: 'network',
          subtype: 'response',
          url: String(url),
          status: response.status,
          statusText: response.statusText,
          correlationId: correlationId,
          duration: duration,
          sessionId: config.sessionId,
          pageId: config.pageId,
          timestamp: Date.now()
        });
        
        return response;
      },
      function(error) {
        const duration = Date.now() - startTime;
        
        send({
          type: 'network',
          subtype: 'error',
          url: String(url),
          error: error.message,
          correlationId: correlationId,
          duration: duration,
          sessionId: config.sessionId,
          pageId: config.pageId,
          timestamp: Date.now()
        });
        
        throw error;
      }
    );
  };
  
  // Hook XMLHttpRequest
  const XHR = XMLHttpRequest.prototype;
  const originalOpen = XHR.open;
  const originalSend = XHR.send;
  
  XHR.open = function(method, url) {
    this._correlationId = 'correlation-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    this._method = method;
    this._url = url;
    return originalOpen.apply(this, arguments);
  };
  
  XHR.send = function() {
    const xhr = this;
    const correlationId = xhr._correlationId;
    
    // Add correlation header
    xhr.setRequestHeader('X-Correlation-ID', correlationId);
    
    // Log the request
    console.log(`[${correlationId}] XHR ${xhr._method} ${xhr._url}`);
    
    send({
      type: 'network',
      subtype: 'xhr-request',
      method: xhr._method,
      url: xhr._url,
      correlationId: correlationId,
      sessionId: config.sessionId,
      pageId: config.pageId,
      timestamp: Date.now()
    });
    
    // Track response
    const startTime = Date.now();
    xhr.addEventListener('load', function() {
      const duration = Date.now() - startTime;
      
      send({
        type: 'network',
        subtype: 'xhr-response',
        url: xhr._url,
        status: xhr.status,
        statusText: xhr.statusText,
        correlationId: correlationId,
        duration: duration,
        sessionId: config.sessionId,
        pageId: config.pageId,
        timestamp: Date.now()
      });
    });
    
    xhr.addEventListener('error', function() {
      const duration = Date.now() - startTime;
      
      send({
        type: 'network',
        subtype: 'xhr-error',
        url: xhr._url,
        correlationId: correlationId,
        duration: duration,
        sessionId: config.sessionId,
        pageId: config.pageId,
        timestamp: Date.now()
      });
    });
    
    return originalSend.apply(this, arguments);
  };
  
  // Capture errors
  window.addEventListener('error', function(event) {
    send({
      type: 'error',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error ? event.error.stack : null,
      sessionId: config.sessionId,
      pageId: config.pageId,
      timestamp: Date.now()
    });
  });
  
  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', function(event) {
    send({
      type: 'unhandledrejection',
      reason: event.reason instanceof Error ? {
        message: event.reason.message,
        stack: event.reason.stack
      } : String(event.reason),
      sessionId: config.sessionId,
      pageId: config.pageId,
      timestamp: Date.now()
    });
  });
  
  // Track page visibility changes
  document.addEventListener('visibilitychange', function() {
    send({
      type: 'visibility',
      hidden: document.hidden,
      visibilityState: document.visibilityState,
      sessionId: config.sessionId,
      pageId: config.pageId,
      timestamp: Date.now()
    });
  });
  
  // Track basic user interactions (optional, can be heavy)
  if (window.__BROWSER_AGENT_TRACK_INTERACTIONS__) {
    ['click', 'submit'].forEach(function(eventType) {
      document.addEventListener(eventType, function(event) {
        const target = event.target;
        const targetInfo = {
          tagName: target.tagName,
          id: target.id,
          className: target.className,
          text: target.textContent ? target.textContent.substring(0, 100) : ''
        };
        
        send({
          type: 'user-interaction',
          event: eventType,
          target: targetInfo,
          sessionId: config.sessionId,
          pageId: config.pageId,
          timestamp: Date.now()
        });
      }, true);
    });
  }
  
  // Track basic DOM mutations (optional, can be heavy)
  if (window.__BROWSER_AGENT_TRACK_MUTATIONS__ && window.MutationObserver) {
    const observer = new MutationObserver(function(mutations) {
      // Sample mutations to avoid overwhelming
      if (Math.random() > 0.1) return;
      
      const summary = {
        additions: 0,
        removals: 0,
        attributes: 0,
        text: 0
      };
      
      mutations.forEach(function(mutation) {
        if (mutation.type === 'childList') {
          summary.additions += mutation.addedNodes.length;
          summary.removals += mutation.removedNodes.length;
        } else if (mutation.type === 'attributes') {
          summary.attributes++;
        } else if (mutation.type === 'characterData') {
          summary.text++;
        }
      });
      
      if (summary.additions || summary.removals || summary.attributes || summary.text) {
        send({
          type: 'dom-mutation',
          summary: summary,
          sessionId: config.sessionId,
          pageId: config.pageId,
          timestamp: Date.now()
        });
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      attributes: true,
      characterData: true,
      subtree: true
    });
  }
  
  // Start connection
  connect();
  
  // Log initialization
  console.log('[Browser Agent] Initialized for session:', config.sessionId);
})();