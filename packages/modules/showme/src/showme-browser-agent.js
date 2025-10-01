/**
 * ShowMe Browser Agent - Frontend monitoring agent for ShowMe windows
 * Injected into ShowMe browser windows to capture console, errors, and provide debugging
 */

(function() {
  'use strict';

  // Configuration (injected during window creation)
  const config = {
    wsPort: window.__SHOWME_WS_PORT__ || '3700',
    wsHost: window.__SHOWME_WS_HOST__ || 'localhost',
    windowId: window.__SHOWME_WINDOW_ID__ || 'unknown',
    sessionId: window.__SHOWME_SESSION_ID__ || 'default'
  };

  // WebSocket connection to ShowMe server
  let ws = null;
  let connected = false;
  const messageQueue = [];
  let reconnectTimer = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 10;

  // Connect to ShowMe server browser agent endpoint
  function connect() {
    const url = `ws://${config.wsHost}:${config.wsPort}/browser`;

    try {
      ws = new WebSocket(url);

      ws.onopen = function() {
        connected = true;
        reconnectAttempts = 0;

        // Send identification as browser agent
        send({
          type: 'browser-agent-identify',
          windowId: config.windowId,
          sessionId: config.sessionId,
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
        console.error('[ShowMe Agent] WebSocket error:', error);
      };

      ws.onmessage = function(event) {
        try {
          const message = JSON.parse(event.data);
          handleServerMessage(message);
        } catch (err) {
          console.error('[ShowMe Agent] Failed to parse message:', err);
        }
      };

    } catch (err) {
      console.error('[ShowMe Agent] Failed to create WebSocket:', err);
      scheduleReconnect();
    }
  }

  // Handle messages from ShowMe server
  function handleServerMessage(message) {
    // Server can send commands to browser agent
    switch (message.type) {
      case 'eval':
        // Execute JavaScript in browser context (for debugging)
        try {
          const result = eval(message.code);
          send({
            type: 'eval-result',
            requestId: message.requestId,
            result: serializeValue(result),
            windowId: config.windowId,
            timestamp: Date.now()
          });
        } catch (err) {
          send({
            type: 'eval-error',
            requestId: message.requestId,
            error: err.message,
            stack: err.stack,
            windowId: config.windowId,
            timestamp: Date.now()
          });
        }
        break;

      case 'inspect':
        // Send current page state
        send({
          type: 'inspect-result',
          requestId: message.requestId,
          state: {
            url: window.location.href,
            title: document.title,
            readyState: document.readyState,
            hasShowMeAPI: typeof window.ShowMeAPI !== 'undefined'
          },
          windowId: config.windowId,
          timestamp: Date.now()
        });
        break;
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

  // Helper to serialize values for transmission
  function serializeValue(value) {
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    if (typeof value === 'function') return value.toString();
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  }

  // Helper to serialize arguments
  function serializeArgs(args) {
    return Array.from(args).map(serializeValue);
  }

  // Hook console methods
  const originalConsole = {};
  ['log', 'error', 'warn', 'info', 'debug'].forEach(function(method) {
    originalConsole[method] = console[method];
    console[method] = function() {
      // Send to ShowMe server
      send({
        type: 'console',
        method: method,
        args: serializeArgs(arguments),
        windowId: config.windowId,
        sessionId: config.sessionId,
        location: window.location.href,
        timestamp: Date.now()
      });

      // Call original method
      return originalConsole[method].apply(console, arguments);
    };
  });

  // Capture errors
  window.addEventListener('error', function(event) {
    send({
      type: 'error',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error ? event.error.stack : null,
      windowId: config.windowId,
      sessionId: config.sessionId,
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
      windowId: config.windowId,
      sessionId: config.sessionId,
      timestamp: Date.now()
    });
  });

  // Track page visibility changes
  document.addEventListener('visibilitychange', function() {
    send({
      type: 'visibility',
      hidden: document.hidden,
      visibilityState: document.visibilityState,
      windowId: config.windowId,
      sessionId: config.sessionId,
      timestamp: Date.now()
    });
  });

  // Start connection
  connect();

  // Log initialization (this will be sent to ShowMe server)
  console.log('[ShowMe Agent] Initialized for window:', config.windowId);
})();
