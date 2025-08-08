/**
 * WebSocket Debugger - Injects debugging capabilities into the browser
 */

export class WebSocketDebugger {
  constructor() {
    this.originalSend = null;
    this.originalOnMessage = null;
    this.messageLog = [];
    this.isActive = false;
  }

  /**
   * Inject WebSocket debugging
   */
  inject() {
    if (this.isActive) return;
    
    console.log('[WebSocketDebugger] Injecting WebSocket debugging...');
    
    // Store original WebSocket
    const OriginalWebSocket = window.WebSocket;
    
    // Create our debugging wrapper
    window.WebSocket = class DebuggingWebSocket extends OriginalWebSocket {
      constructor(url, protocols) {
        console.log('[WebSocket] Creating connection to:', url);
        super(url, protocols);
        
        // Store reference for debugging
        window._wsDebugInstance = this;
        
        // Override send method
        const originalSend = this.send;
        this.send = function(data) {
          console.log('[WebSocket] SENDING:', data);
          try {
            const parsed = JSON.parse(data);
            console.log('[WebSocket] SENDING (parsed):', parsed);
          } catch (e) {
            console.log('[WebSocket] SENDING (raw):', data);
          }
          return originalSend.call(this, data);
        };
        
        // Override message handler
        this.addEventListener('message', (event) => {
          console.log('[WebSocket] RECEIVED:', event.data);
          try {
            const parsed = JSON.parse(event.data);
            console.log('[WebSocket] RECEIVED (parsed):', parsed);
          } catch (e) {
            console.log('[WebSocket] RECEIVED (raw):', event.data);
          }
        });
        
        this.addEventListener('open', () => {
          console.log('[WebSocket] Connection opened to:', url);
        });
        
        this.addEventListener('close', (event) => {
          console.log('[WebSocket] Connection closed:', event.code, event.reason);
        });
        
        this.addEventListener('error', (error) => {
          console.error('[WebSocket] Connection error:', error);
        });
      }
    };
    
    this.isActive = true;
    console.log('[WebSocketDebugger] Debugging injection complete');
  }

  /**
   * Get current WebSocket instance
   */
  getCurrentWebSocket() {
    return window._wsDebugInstance;
  }

  /**
   * Send debug message
   */
  sendDebugMessage(message) {
    const ws = this.getCurrentWebSocket();
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log('[WebSocketDebugger] Sending debug message:', message);
      ws.send(JSON.stringify(message));
    } else {
      console.log('[WebSocketDebugger] WebSocket not available or not open');
    }
  }

  /**
   * Test connection
   */
  testConnection() {
    const ws = this.getCurrentWebSocket();
    if (ws) {
      console.log('[WebSocketDebugger] WebSocket state:', {
        readyState: ws.readyState,
        url: ws.url,
        protocol: ws.protocol
      });
      
      this.sendDebugMessage({
        type: 'debug_test',
        timestamp: Date.now(),
        message: 'WebSocket debug test'
      });
    } else {
      console.log('[WebSocketDebugger] No WebSocket instance found');
    }
  }
}

// Auto-inject when loaded
const debugger = new WebSocketDebugger();
debugger.inject();

// Expose globally for manual testing
window.wsDebugger = debugger;