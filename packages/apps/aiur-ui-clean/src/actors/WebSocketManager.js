/**
 * WebSocket connection manager with auto-reconnection
 */
export class WebSocketManager {
  constructor(url = 'ws://localhost:8080/ws') {
    this.url = url;
    this.ws = null;
    this.reconnectInterval = 1000;
    this.maxReconnectInterval = 30000;
    this.reconnectAttempts = 0;
    this.listeners = new Map();
    this.isConnecting = false;
    this.shouldReconnect = true;
  }

  connect() {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return Promise.resolve(this.ws);
    }

    this.isConnecting = true;
    
    return new Promise((resolve, reject) => {
      try {
        console.log(`WebSocketManager: Connecting to ${this.url}...`);
        this.ws = new WebSocket(this.url);
        
        this.ws.onopen = () => {
          console.log('WebSocketManager: Connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.reconnectInterval = 1000;
          this.emit('open');
          resolve(this.ws);
        };
        
        this.ws.onmessage = (event) => {
          this.emit('message', event);
        };
        
        this.ws.onerror = (error) => {
          console.error('WebSocketManager: Error:', error);
          this.isConnecting = false;
          this.emit('error', error);
        };
        
        this.ws.onclose = () => {
          console.log('WebSocketManager: Disconnected');
          this.isConnecting = false;
          this.ws = null;
          this.emit('close');
          
          if (this.shouldReconnect) {
            this.scheduleReconnect();
          }
        };
        
      } catch (error) {
        console.error('WebSocketManager: Failed to create WebSocket:', error);
        this.isConnecting = false;
        reject(error);
      }
    });
  }
  
  scheduleReconnect() {
    this.reconnectAttempts++;
    const interval = Math.min(
      this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectInterval
    );
    
    console.log(`WebSocketManager: Reconnecting in ${interval}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      if (this.shouldReconnect) {
        this.connect();
      }
    }, interval);
  }
  
  send(data) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocketManager: Cannot send - not connected');
      return false;
    }
    
    if (typeof data !== 'string') {
      data = JSON.stringify(data);
    }
    
    this.ws.send(data);
    return true;
  }
  
  disconnect() {
    this.shouldReconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
  
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(handler);
  }
  
  off(event, handler) {
    if (!this.listeners.has(event)) return;
    
    const handlers = this.listeners.get(event);
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }
  
  emit(event, ...args) {
    if (!this.listeners.has(event)) return;
    
    const handlers = this.listeners.get(event);
    handlers.forEach(handler => {
      try {
        handler(...args);
      } catch (error) {
        console.error(`WebSocketManager: Error in ${event} handler:`, error);
      }
    });
  }
  
  get isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}