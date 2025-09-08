/**
 * WebSocketService
 * 
 * Manages WebSocket connection to ShowMe server
 * Handles reconnection, message queuing, and event distribution
 */

export class WebSocketService {
  constructor(config = {}) {
    this.config = {
      url: config.url || 'ws://localhost:3700/showme',
      reconnectInterval: config.reconnectInterval || 3000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      messageTimeout: config.messageTimeout || 30000,
      ...config
    };
    
    // Connection state
    this.ws = null;
    this.connected = false;
    this.reconnecting = false;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    
    // Message handling
    this.messageQueue = [];
    this.messageHandlers = new Map();
    this.eventHandlers = new Map();
    this.pendingRequests = new Map();
    this.requestIdCounter = 0;
  }
  
  /**
   * Connect to WebSocket server
   */
  async connect() {
    return new Promise((resolve, reject) => {
      if (this.connected) {
        resolve();
        return;
      }
      
      try {
        console.log('Connecting to WebSocket server:', this.config.url);
        
        this.ws = new WebSocket(this.config.url);
        
        // Set up event handlers
        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.connected = true;
          this.reconnecting = false;
          this.reconnectAttempts = 0;
          
          // Clear reconnect timer
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
          }
          
          // Flush message queue
          this.flushMessageQueue();
          
          // Emit connected event
          this.emit('connected');
          
          resolve();
        };
        
        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };
        
        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.emit('error', error);
          
          if (!this.connected && !this.reconnecting) {
            reject(new Error('Failed to connect to WebSocket server'));
          }
        };
        
        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.connected = false;
          this.ws = null;
          
          // Emit disconnected event
          this.emit('disconnected');
          
          // Attempt reconnection
          if (!this.reconnecting) {
            this.scheduleReconnect();
          }
        };
        
      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        reject(error);
      }
    });
  }
  
  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    this.reconnecting = false;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.connected = false;
  }
  
  /**
   * Send message to server
   */
  send(message) {
    if (!message) return;
    
    // Add timestamp if not present
    if (!message.timestamp) {
      message.timestamp = Date.now();
    }
    
    // Add request ID for request/response tracking
    if (!message.requestId) {
      message.requestId = this.generateRequestId();
    }
    
    const data = JSON.stringify(message);
    
    if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(data);
      } catch (error) {
        console.error('Failed to send message:', error);
        this.queueMessage(message);
      }
    } else {
      // Queue message for later
      this.queueMessage(message);
    }
    
    return message.requestId;
  }
  
  /**
   * Send request and wait for response
   */
  async sendRequest(message, timeout = null) {
    return new Promise((resolve, reject) => {
      const requestId = this.send(message);
      const timeoutMs = timeout || this.config.messageTimeout;
      
      // Set up timeout
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout: ${requestId}`));
      }, timeoutMs);
      
      // Store pending request
      this.pendingRequests.set(requestId, {
        resolve: (response) => {
          clearTimeout(timer);
          this.pendingRequests.delete(requestId);
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timer);
          this.pendingRequests.delete(requestId);
          reject(error);
        }
      });
    });
  }
  
  /**
   * Handle incoming message
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      
      // Check if this is a response to a pending request
      if (message.requestId && this.pendingRequests.has(message.requestId)) {
        const pending = this.pendingRequests.get(message.requestId);
        if (message.error) {
          pending.reject(new Error(message.error));
        } else {
          pending.resolve(message);
        }
        return;
      }
      
      // Handle message based on type
      if (message.type) {
        // Check for specific message handlers
        if (this.messageHandlers.has(message.type)) {
          const handler = this.messageHandlers.get(message.type);
          handler(message);
        }
        
        // Emit as event
        this.emit(message.type, message);
      }
      
      // Emit generic message event
      this.emit('message', message);
      
    } catch (error) {
      console.error('Failed to parse message:', error, data);
    }
  }
  
  /**
   * Register message handler
   */
  onMessage(type, handler) {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, handler);
    }
  }
  
  /**
   * Remove message handler
   */
  offMessage(type) {
    this.messageHandlers.delete(type);
  }
  
  /**
   * Register event handler
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }
  
  /**
   * Remove event handler
   */
  off(event, handler) {
    if (this.eventHandlers.has(event)) {
      const handlers = this.eventHandlers.get(event);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }
  
  /**
   * Emit event
   */
  emit(event, ...args) {
    if (this.eventHandlers.has(event)) {
      const handlers = this.eventHandlers.get(event);
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }
  
  /**
   * Queue message for later sending
   */
  queueMessage(message) {
    this.messageQueue.push(message);
  }
  
  /**
   * Flush message queue
   */
  flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.send(message);
    }
  }
  
  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnecting || this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      this.emit('reconnect-failed');
      return;
    }
    
    this.reconnecting = true;
    this.reconnectAttempts++;
    
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts}`);
    
    this.reconnectTimer = setTimeout(() => {
      this.emit('reconnecting', this.reconnectAttempts);
      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
        this.scheduleReconnect();
      });
    }, this.config.reconnectInterval);
  }
  
  /**
   * Generate unique request ID
   */
  generateRequestId() {
    return `req_${++this.requestIdCounter}_${Date.now()}`;
  }
  
  /**
   * Get connection status
   */
  isConnected() {
    return this.connected && this.ws && this.ws.readyState === WebSocket.OPEN;
  }
  
  /**
   * Get WebSocket state
   */
  getState() {
    if (!this.ws) return 'CLOSED';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'CONNECTING';
      case WebSocket.OPEN:
        return 'OPEN';
      case WebSocket.CLOSING:
        return 'CLOSING';
      case WebSocket.CLOSED:
        return 'CLOSED';
      default:
        return 'UNKNOWN';
    }
  }
  
  /**
   * Get connection statistics
   */
  getStats() {
    return {
      connected: this.connected,
      state: this.getState(),
      reconnecting: this.reconnecting,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length,
      pendingRequests: this.pendingRequests.size
    };
  }
}