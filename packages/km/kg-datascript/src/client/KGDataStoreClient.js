import { ActorSpace } from '@legion/actors';
import WebSocket from 'ws';

/**
 * KGDataStoreClient - Client-side ActorSpace with WebSocket Channel 
 * connection to KGDataStoreServer
 * 
 * Provides a structured way to connect to a remote KGDataStoreServer,
 * interact with the server-side KGDataStoreActor, and manage distributed
 * KGEntityHandles.
 */
export class KGDataStoreClient {
  constructor(options = {}) {
    this.options = {
      host: 'localhost',
      port: 8080,
      reconnectAttempts: 3,
      reconnectDelay: 1000,
      messageTimeout: 5000,
      ...options
    };
    
    // Client state
    this.websocket = null;
    this.actorSpace = null;
    this.channel = null;
    this.clientId = null;
    this.serverInfo = null;
    this.isConnected = false;
    this.reconnectCount = 0;
    
    // Message handling
    this.pendingRequests = new Map(); // requestId -> { resolve, reject, timeout }
    this.requestCounter = 0;
    
    // Event listeners
    this.listeners = new Map(); // event -> Set of callbacks
    
    console.log(`KGDataStoreClient initialized for ${this.options.host}:${this.options.port}`);
  }
  
  /**
   * Connect to the KGDataStoreServer
   */
  async connect() {
    if (this.isConnected) {
      throw new Error('Client is already connected');
    }
    
    console.log('Connecting to KGDataStoreServer...');
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.options.messageTimeout);
      
      try {
        // 1. Create WebSocket connection
        const url = `ws://${this.options.host}:${this.options.port}`;
        this.websocket = new WebSocket(url);
        
        // 2. Create client-side ActorSpace
        this.actorSpace = new ActorSpace(`client-${Date.now()}`);
        console.log('✅ Client ActorSpace created');
        
        // 3. Create WebSocket wrapper for Channel compatibility
        const websocketWrapper = {
          send: (data) => this.websocket.send(data),
          close: () => this.websocket.close(),
          onmessage: null,
          onclose: null,
          onerror: null,
          onopen: null
        };
        
        // 4. Bridge WebSocket events to wrapper
        this.websocket.on('message', (data) => {
          if (websocketWrapper.onmessage) {
            websocketWrapper.onmessage({ data: data.toString() });
          }
        });
        
        this.websocket.on('close', (code, reason) => {
          if (websocketWrapper.onclose) {
            websocketWrapper.onclose({ code, reason });
          }
        });
        
        this.websocket.on('error', (error) => {
          if (websocketWrapper.onerror) {
            websocketWrapper.onerror(error);
          }
        });
        
        this.websocket.on('open', () => {
          if (websocketWrapper.onopen) {
            websocketWrapper.onopen();
          }
        });
        
        // 5. Create Channel through ActorSpace
        this.channel = this.actorSpace.addChannel(websocketWrapper);
        console.log('✅ WebSocket Channel created');
        
        // 6. Handle incoming messages
        this.websocket.on('message', (data) => {
          this._handleIncomingMessage(data.toString());
        });
        
        // 7. Handle connection events
        this.websocket.on('open', () => {
          console.log('✅ WebSocket connection established');
        });
        
        this.websocket.on('close', (code, reason) => {
          console.log(`📱 WebSocket connection closed: ${code} ${reason}`);
          this._handleDisconnection();
        });
        
        this.websocket.on('error', (error) => {
          console.error('WebSocket error:', error);
          this._handleConnectionError(error);
        });
        
        // 8. Wait for welcome message from server
        const welcomeHandler = (data) => {
          try {
            const message = JSON.parse(data.toString());
            if (message.type === 'server:welcome') {
              clearTimeout(timeout);
              this.websocket.removeListener('message', welcomeHandler);
              
              this.clientId = message.clientId;
              this.serverInfo = message.serverInfo;
              this.isConnected = true;
              this.reconnectCount = 0;
              
              console.log('✅ Welcome message received');
              console.log('   Client ID:', this.clientId);
              console.log('   Server ActorSpace:', this.serverInfo.actorSpaceId);
              console.log('   DataStore GUID:', this.serverInfo.dataStoreGuid);
              
              this._emit('connected', { clientId: this.clientId, serverInfo: this.serverInfo });
              resolve({
                clientId: this.clientId,
                serverInfo: this.serverInfo
              });
            }
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        };
        
        this.websocket.on('message', welcomeHandler);
        
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }
  
  /**
   * Disconnect from the server
   */
  async disconnect() {
    if (!this.isConnected) {
      console.log('Client is not connected');
      return;
    }
    
    console.log('Disconnecting from KGDataStoreServer...');
    
    // 1. Cancel pending requests
    for (const [requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Connection closing'));
    }
    this.pendingRequests.clear();
    
    // 2. Close WebSocket
    if (this.websocket) {
      this.websocket.close(1000, 'Client disconnect');
      this.websocket = null;
    }
    
    // 3. Clean up ActorSpace
    if (this.actorSpace) {
      this.actorSpace.destroy();
      this.actorSpace = null;
    }
    
    // 4. Clean up state
    this.channel = null;
    this.clientId = null;
    this.serverInfo = null;
    this.isConnected = false;
    
    console.log('🛑 KGDataStoreClient disconnected');
    this._emit('disconnected');
  }
  
  /**
   * Send a message to the server and wait for response
   */
  async sendMessage(payload, options = {}) {
    if (!this.isConnected) {
      throw new Error('Client is not connected');
    }
    
    const requestId = `req-${++this.requestCounter}`;
    const timeout = options.timeout || this.options.messageTimeout;
    
    // Add requestId to the payload
    const messagePayload = {
      ...payload,
      requestId
    };
    
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Message timeout: ${payload.type}`));
      }, timeout);
      
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout: timeoutHandle
      });
      
      try {
        // Send raw JSON like the working test does
        // The server expects { targetGuid, payload } format
        const message = {
          targetGuid: this.serverInfo.dataStoreGuid,
          payload: messagePayload
        };
        this.websocket.send(JSON.stringify(message));
        console.log(`📤 Message sent: ${payload.type} (${requestId})`);
      } catch (error) {
        this.pendingRequests.delete(requestId);
        clearTimeout(timeoutHandle);
        reject(error);
      }
    });
  }
  
  /**
   * Add objects to the remote data store
   */
  async addObjects(objects) {
    return this.sendMessage({
      type: 'store:add',
      payload: { objects }
    });
  }
  
  /**
   * Query the remote data store
   */
  async query(querySpec) {
    return this.sendMessage({
      type: 'store:query',
      payload: { querySpec }
    });
  }
  
  /**
   * Get object by ID from remote data store
   */
  async getObject(objectId) {
    return this.sendMessage({
      type: 'store:get',
      payload: { objectIds: [objectId] }
    });
  }
  
  /**
   * Create a distributed handle for an object
   */
  async createHandle(objectId) {
    return this.sendMessage({
      type: 'handle:create',
      payload: { objectId }
    });
  }
  
  /**
   * Call a method on a distributed handle
   */
  async callHandleMethod(handleId, method, args = []) {
    return this.sendMessage({
      type: 'handle:method',
      payload: {
        handleId,
        method,
        args
      }
    });
  }
  
  /**
   * Add a subscription for change notifications
   */
  async subscribe(subscriptionSpec) {
    return this.sendMessage({
      type: 'subscription:add',
      payload: { subscription: subscriptionSpec }
    });
  }
  
  /**
   * Remove a subscription
   */
  async unsubscribe(subscriptionSpec) {
    return this.sendMessage({
      type: 'subscription:remove',
      payload: { subscription: subscriptionSpec }
    });
  }
  
  /**
   * Handle incoming messages from server
   * @private
   */
  _handleIncomingMessage(data) {
    try {
      const message = JSON.parse(data);
      
      // Skip welcome messages (handled during connection)
      if (message.type === 'server:welcome') {
        return;
      }
      
      // Handle response messages for pending requests
      if (message.type === 'response' && message.requestId) {
        const pending = this.pendingRequests.get(message.requestId);
        if (pending) {
          this.pendingRequests.delete(message.requestId);
          clearTimeout(pending.timeout);
          
          console.log(`📥 Response received: ${message.requestId}`);
          
          if (message.success) {
            pending.resolve(message.result);
          } else {
            pending.reject(new Error(message.error || 'Request failed'));
          }
        }
        return;
      }
      
      // Handle notification messages
      if (message.type === 'notification') {
        console.log('📢 Notification received:', message.notificationType);
        this._emit('notification', message);
        return;
      }
      
      // Handle other message types
      console.log('📥 Message received:', message.type, message);
      this._emit('message', message);
      
    } catch (error) {
      console.error('Error handling incoming message:', error);
      this._emit('error', error);
    }
  }
  
  /**
   * Handle connection disconnection
   * @private
   */
  _handleDisconnection() {
    if (this.isConnected) {
      this.isConnected = false;
      this._emit('disconnected');
      
      // Attempt reconnection if configured
      if (this.reconnectCount < this.options.reconnectAttempts) {
        setTimeout(() => {
          this._attemptReconnection();
        }, this.options.reconnectDelay);
      }
    }
  }
  
  /**
   * Handle connection errors
   * @private
   */
  _handleConnectionError(error) {
    console.error('Connection error:', error);
    this._emit('error', error);
  }
  
  /**
   * Attempt to reconnect to the server
   * @private
   */
  async _attemptReconnection() {
    if (this.isConnected) {
      return; // Already reconnected
    }
    
    this.reconnectCount++;
    console.log(`🔄 Reconnection attempt ${this.reconnectCount}/${this.options.reconnectAttempts}`);
    
    try {
      await this.connect();
      console.log('✅ Reconnected successfully');
    } catch (error) {
      console.error('Reconnection failed:', error);
      
      if (this.reconnectCount < this.options.reconnectAttempts) {
        setTimeout(() => {
          this._attemptReconnection();
        }, this.options.reconnectDelay);
      } else {
        console.error('❌ Max reconnection attempts reached');
        this._emit('reconnection_failed');
      }
    }
  }
  
  /**
   * Add event listener
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }
  
  /**
   * Remove event listener
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }
  
  /**
   * Emit event to listeners
   * @private
   */
  _emit(event, data) {
    if (this.listeners.has(event)) {
      for (const callback of this.listeners.get(event)) {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      }
    }
  }
  
  /**
   * Get client connection status and statistics
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      clientId: this.clientId,
      serverInfo: this.serverInfo,
      actorSpaceId: this.actorSpace?.spaceId,
      pendingRequests: this.pendingRequests.size,
      reconnectCount: this.reconnectCount,
      options: this.options
    };
  }
}