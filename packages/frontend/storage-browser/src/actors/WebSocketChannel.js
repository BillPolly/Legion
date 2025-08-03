/**
 * WebSocket Channel
 * Manages WebSocket connections with auto-reconnection and message queuing
 */

export class WebSocketChannel {
  constructor(url, options = {}) {
    this.url = url;
    this.options = {
      autoReconnect: true,
      reconnectDelay: 1000,
      maxReconnectDelay: 30000,
      maxReconnectAttempts: Infinity,
      maxQueueSize: 100,
      binaryType: 'json',
      ...options
    };

    this.ws = null;
    this.messageQueue = [];
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.currentReconnectDelay = this.options.reconnectDelay;
    this.isManualDisconnect = false;
    this.listeners = new Map();

    this.connect();
  }

  connect() {
    try {
      this.ws = new WebSocket(this.url);
      this.setupEventHandlers();
    } catch (error) {
      this.emit('error', error);
      if (this.options.autoReconnect && !this.isManualDisconnect) {
        this.scheduleReconnect();
      }
    }
  }

  setupEventHandlers() {
    this.ws.addEventListener('open', () => {
      console.log('[WebSocketChannel] Connected to:', this.url);
      this.reconnectAttempts = 0;
      this.currentReconnectDelay = this.options.reconnectDelay;
      this.emit('connect');
      this.flushQueue();
    });

    this.ws.addEventListener('close', (event) => {
      console.log('[WebSocketChannel] Connection closed:', event.code, event.reason);
      this.emit('disconnect', {
        code: event.code,
        reason: event.reason
      });

      if (this.options.autoReconnect && 
          !this.isManualDisconnect && 
          event.code !== 1000) {
        this.scheduleReconnect();
      }
    });

    this.ws.addEventListener('error', (error) => {
      console.error('[WebSocketChannel] WebSocket error:', error);
      this.emit('error', error);
    });

    this.ws.addEventListener('message', (event) => {
      console.log('[WebSocketChannel] Message received:', event.data);
      try {
        const message = this.options.binaryType === 'json' 
          ? JSON.parse(event.data)
          : event.data;
        this.emit('message', message);
      } catch (error) {
        this.emit('error', new Error(`Failed to parse message: ${error.message}`));
      }
    });
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      this.emit('error', new Error('Max reconnection attempts reached'));
      return;
    }

    this.reconnectAttempts++;
    
    this.reconnectTimer = setTimeout(() => {
      this.emit('reconnecting', {
        attempt: this.reconnectAttempts,
        delay: this.currentReconnectDelay
      });
      
      this.connect();
      
      // Exponential backoff
      this.currentReconnectDelay = Math.min(
        this.currentReconnectDelay * 2,
        this.options.maxReconnectDelay
      );
    }, this.currentReconnectDelay);
  }

  send(message) {
    console.log('[WebSocketChannel] Send called, connected:', this.isConnected());
    console.log('[WebSocketChannel] Message to send:', message);
    
    if (this.isConnected()) {
      const data = typeof message === 'string' 
        ? message 
        : JSON.stringify(message);
      console.log('[WebSocketChannel] Sending via WebSocket:', data);
      this.ws.send(data);
    } else {
      console.log('[WebSocketChannel] Not connected, queuing message');
      // Queue message if disconnected
      if (this.messageQueue.length < this.options.maxQueueSize) {
        this.messageQueue.push(message);
      } else {
        this.emit('error', new Error('Message queue full'));
      }
    }
  }

  sendBinary(data) {
    if (this.isConnected()) {
      this.ws.send(data);
    } else {
      if (this.messageQueue.length < this.options.maxQueueSize) {
        this.messageQueue.push(data);
      } else {
        this.emit('error', new Error('Message queue full'));
      }
    }
  }

  flushQueue() {
    while (this.messageQueue.length > 0 && this.isConnected()) {
      const message = this.messageQueue.shift();
      if (message instanceof ArrayBuffer || message instanceof Blob) {
        this.sendBinary(message);
      } else {
        this.send(message);
      }
    }
  }

  disconnect() {
    this.isManualDisconnect = true;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.messageQueue = [];
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  getQueueSize() {
    return this.messageQueue.length;
  }

  // Event emitter methods
  on(event, listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(listener);
  }

  off(event, listener) {
    if (!this.listeners.has(event)) return;
    
    const listeners = this.listeners.get(event);
    const index = listeners.indexOf(listener);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  }

  emit(event, ...args) {
    if (!this.listeners.has(event)) return;
    
    const listeners = this.listeners.get(event);
    listeners.forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }
}