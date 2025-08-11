/**
 * BrowserAgentActor - Injected into browser pages to capture events
 * Wraps existing monitoring functionality with Actor protocol
 * This script is injected into the browser context
 */

(function() {
  'use strict';
  
  // Simple Actor implementation for browser context
  class BrowserActor {
    constructor() {
      this.isActor = true;
      this.guid = null;
      this.remoteMonitor = null;
    }
    
    receive(message) {
      // Handle messages from monitor
      const { type, data } = message;
      
      switch (type) {
        case 'identify':
          this.guid = data.guid;
          console.log('[BrowserAgentActor] Identified as:', this.guid);
          break;
          
        case 'execute':
          this.executeCommand(data);
          break;
          
        case 'get-stats':
          this.sendStats();
          break;
          
        default:
          console.warn('[BrowserAgentActor] Unknown message type:', type);
      }
    }
    
    send(type, data) {
      if (this.remoteMonitor) {
        this.remoteMonitor.receive({
          type,
          data,
          pageId: window.__pageId,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    executeCommand(command) {
      const { action, selector, text } = command;
      
      switch (action) {
        case 'click':
          const clickEl = document.querySelector(selector);
          if (clickEl) clickEl.click();
          break;
          
        case 'type':
          const typeEl = document.querySelector(selector);
          if (typeEl) typeEl.value = text;
          break;
          
        case 'screenshot':
          // Trigger screenshot request to monitor
          this.send('screenshot-request', {});
          break;
      }
    }
    
    sendStats() {
      this.send('stats', {
        url: window.location.href,
        title: document.title,
        readyState: document.readyState,
        consoleCount: this.consoleCount || 0,
        errorCount: this.errorCount || 0
      });
    }
  }
  
  // Create the browser agent actor
  const browserAgent = new BrowserActor();
  window.__browserAgent = browserAgent;
  
  // Wrap existing monitoring functionality
  const monitoringContext = {
    sessionId: window.__sessionId,
    pageId: window.__pageId,
    consoleCount: 0,
    errorCount: 0,
    networkRequests: new Map()
  };
  
  // Console monitoring wrapper
  const originalConsole = {};
  ['log', 'info', 'warn', 'error', 'debug', 'trace'].forEach(method => {
    originalConsole[method] = console[method];
    console[method] = function(...args) {
      originalConsole[method].apply(console, args);
      
      monitoringContext.consoleCount++;
      if (method === 'error') monitoringContext.errorCount++;
      
      // Send through Actor
      browserAgent.send('console', {
        level: method,
        message: args.map(arg => {
          try {
            return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
          } catch (e) {
            return String(arg);
          }
        }).join(' '),
        args: args,
        stackTrace: new Error().stack
      });
    };
  });
  
  // Error monitoring wrapper
  window.addEventListener('error', (event) => {
    monitoringContext.errorCount++;
    
    browserAgent.send('page-error', {
      message: event.message,
      source: event.filename,
      line: event.lineno,
      column: event.colno,
      stack: event.error ? event.error.stack : null
    });
  });
  
  window.addEventListener('unhandledrejection', (event) => {
    monitoringContext.errorCount++;
    
    browserAgent.send('page-error', {
      message: 'Unhandled Promise Rejection: ' + event.reason,
      stack: event.reason && event.reason.stack ? event.reason.stack : null,
      source: 'unhandledrejection'
    });
  });
  
  // Network monitoring wrapper (Fetch API)
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const requestId = 'req-' + Date.now() + '-' + Math.random();
    const [resource, config] = args;
    
    const url = typeof resource === 'string' ? resource : resource.url;
    const method = (config && config.method) || 'GET';
    const headers = (config && config.headers) || {};
    
    // Check for correlation headers
    const correlationId = headers['x-correlation-id'] || headers['x-request-id'];
    
    // Send request start event
    browserAgent.send('network-request', {
      requestId,
      url,
      method,
      headers,
      correlationId
    });
    
    const startTime = performance.now();
    monitoringContext.networkRequests.set(requestId, { url, method, startTime });
    
    return originalFetch.apply(this, args)
      .then(response => {
        const duration = performance.now() - startTime;
        
        // Send response event
        browserAgent.send('network-response', {
          requestId,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          duration: Math.round(duration),
          correlationId
        });
        
        monitoringContext.networkRequests.delete(requestId);
        return response;
      })
      .catch(error => {
        const duration = performance.now() - startTime;
        
        // Send error event
        browserAgent.send('network-error', {
          requestId,
          error: error.message,
          duration: Math.round(duration)
        });
        
        monitoringContext.networkRequests.delete(requestId);
        throw error;
      });
  };
  
  // XMLHttpRequest monitoring wrapper
  const XHRPrototype = XMLHttpRequest.prototype;
  const originalOpen = XHRPrototype.open;
  const originalSend = XHRPrototype.send;
  const originalSetRequestHeader = XHRPrototype.setRequestHeader;
  
  XHRPrototype.open = function(method, url, ...rest) {
    this._requestId = 'xhr-' + Date.now() + '-' + Math.random();
    this._method = method;
    this._url = url;
    this._headers = {};
    return originalOpen.apply(this, [method, url, ...rest]);
  };
  
  XHRPrototype.setRequestHeader = function(header, value) {
    this._headers = this._headers || {};
    this._headers[header] = value;
    return originalSetRequestHeader.apply(this, arguments);
  };
  
  XHRPrototype.send = function(...args) {
    const requestId = this._requestId;
    const method = this._method;
    const url = this._url;
    const headers = this._headers || {};
    
    // Check for correlation headers
    const correlationId = headers['x-correlation-id'] || headers['x-request-id'];
    
    // Send request start event
    browserAgent.send('network-request', {
      requestId,
      url,
      method,
      headers,
      correlationId
    });
    
    const startTime = performance.now();
    monitoringContext.networkRequests.set(requestId, { url, method, startTime });
    
    this.addEventListener('load', function() {
      const duration = performance.now() - startTime;
      
      // Send response event
      browserAgent.send('network-response', {
        requestId,
        status: this.status,
        statusText: this.statusText,
        duration: Math.round(duration),
        correlationId
      });
      
      monitoringContext.networkRequests.delete(requestId);
    });
    
    this.addEventListener('error', function() {
      const duration = performance.now() - startTime;
      
      // Send error event
      browserAgent.send('network-error', {
        requestId,
        error: 'Network request failed',
        duration: Math.round(duration)
      });
      
      monitoringContext.networkRequests.delete(requestId);
    });
    
    return originalSend.apply(this, args);
  };
  
  // DOM interaction monitoring
  document.addEventListener('click', (event) => {
    const target = event.target;
    const selector = target.id ? `#${target.id}` : 
                    target.className ? `.${target.className.split(' ')[0]}` :
                    target.tagName.toLowerCase();
    
    browserAgent.send('dom-event', {
      eventType: 'click',
      selector,
      details: {
        text: target.textContent ? target.textContent.substring(0, 100) : '',
        href: target.href || null
      }
    });
  });
  
  // Performance monitoring
  if (window.performance && window.performance.timing) {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const timing = window.performance.timing;
        const metrics = {
          domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
          loadComplete: timing.loadEventEnd - timing.navigationStart,
          firstPaint: timing.responseEnd - timing.navigationStart,
          domInteractive: timing.domInteractive - timing.navigationStart
        };
        
        browserAgent.send('performance-metrics', metrics);
      }, 1000);
    });
  }
  
  // Initialize connection message
  browserAgent.send('browser-agent-ready', {
    url: window.location.href,
    title: document.title,
    userAgent: navigator.userAgent,
    sessionId: window.__sessionId,
    pageId: window.__pageId
  });
  
  // Store agent in window for debugging
  window.__browserAgentActor = browserAgent;
  browserAgent.consoleCount = monitoringContext.consoleCount;
  browserAgent.errorCount = monitoringContext.errorCount;
  
  console.log('[BrowserAgentActor] Initialized and monitoring page');
})();