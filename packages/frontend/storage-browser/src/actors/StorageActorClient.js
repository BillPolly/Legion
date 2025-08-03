/**
 * Storage Actor Client
 * Client-side implementation of Actor protocol for storage operations
 */

import { WebSocketChannel } from './WebSocketChannel.js';

export class StorageActorClient {
  constructor(url, options = {}) {
    this.url = url;
    this.options = {
      requestTimeout: 30000,
      ...options
    };

    this.channel = new WebSocketChannel(url, options);
    this.pendingRequests = new Map();
    this.subscriptions = new Map();
    this.requestIdCounter = 0;
    this.listeners = new Map();

    this.setupChannelHandlers();
  }

  setupChannelHandlers() {
    this.channel.on('message', (message) => {
      this.handleMessage(message);
    });

    this.channel.on('connect', () => {
      this.emit('connect');
    });

    this.channel.on('disconnect', () => {
      this.handleDisconnect();
      this.emit('disconnect');
    });

    this.channel.on('error', (error) => {
      this.emit('error', error);
    });
  }

  handleMessage(message) {
    switch (message.type) {
      case 'response':
        this.handleResponse(message);
        break;
      case 'notification':
        this.handleNotification(message);
        break;
      case 'connected':
        this.emit('connected', message);
        break;
      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  handleResponse(message) {
    console.log('[ActorClient] Response received:', message);
    const pending = this.pendingRequests.get(message.id);
    if (!pending) {
      console.warn('[ActorClient] Response for unknown request:', message.id);
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(message.id);

    if (message.success) {
      console.log('[ActorClient] Request succeeded, data:', message.data);
      pending.resolve(message.data);
    } else {
      console.error('[ActorClient] Request failed:', message.error);
      const error = new Error(message.error?.message || 'Request failed');
      error.code = message.error?.code;
      pending.reject(error);
    }
  }

  handleNotification(message) {
    const { event, data } = message;
    
    // Emit general notification event
    this.emit('notification', { event, data });

    // Route to specific subscribers
    const eventSubscribers = this.subscriptions.get(event);
    if (eventSubscribers) {
      eventSubscribers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in notification handler for ${event}:`, error);
        }
      });
    }
  }

  handleDisconnect() {
    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Connection lost'));
    }
    this.pendingRequests.clear();
  }

  /**
   * Send a request to an actor
   */
  request(actor, method, params = {}, options = {}) {
    console.log(`[ActorClient] Request: ${actor}.${method}`, params);
    
    if (!this.channel.isConnected()) {
      console.error('[ActorClient] Not connected to server');
      throw new Error('Not connected to server');
    }

    const requestId = this.generateRequestId();
    const timeout = options.timeout || this.options.requestTimeout;

    const message = {
      type: 'request',
      id: requestId,
      actor,
      method,
      params,
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      // Set timeout
      const timeoutId = setTimeout(() => {
        console.error(`[ActorClient] Request timeout for ${actor}.${method}`);
        this.pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }, timeout);

      // Store pending request
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout: timeoutId
      });

      console.log('[ActorClient] Sending message:', message);
      // Send request
      this.channel.send(message);
    });
  }

  /**
   * Subscribe to actor events
   */
  async subscribe(actor, event, handler) {
    const subscriptionId = this.generateRequestId();
    const eventKey = `${actor}.${event}`;

    // Send subscription request
    const message = {
      type: 'subscribe',
      id: subscriptionId,
      actor,
      event,
      timestamp: Date.now()
    };

    // Store handler
    if (!this.subscriptions.has(eventKey)) {
      this.subscriptions.set(eventKey, new Set());
    }
    this.subscriptions.get(eventKey).add(handler);

    // Send subscription
    this.channel.send(message);

    return subscriptionId;
  }

  /**
   * Unsubscribe from actor events
   */
  async unsubscribe(subscriptionId) {
    const message = {
      type: 'unsubscribe',
      id: this.generateRequestId(),
      subscriptionId,
      timestamp: Date.now()
    };

    this.channel.send(message);

    // Remove handler (would need to track subscription to handler mapping)
    // For simplicity, this is omitted in the basic implementation
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    this.channel.disconnect();
  }

  /**
   * Check connection status
   */
  isConnected() {
    return this.channel.isConnected();
  }

  /**
   * Generate unique request ID
   */
  generateRequestId() {
    return `req-${++this.requestIdCounter}-${Date.now()}`;
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

  // Convenience methods for common operations
  async find(collection, query = {}, options = {}) {
    return this.request('CollectionActor', 'find', {
      collection,
      query,
      options
    });
  }

  async findOne(collection, query = {}, options = {}) {
    return this.request('CollectionActor', 'findOne', {
      collection,
      query,
      options
    });
  }

  async insert(collection, documents, options = {}) {
    return this.request('CollectionActor', 'insert', {
      collection,
      documents,
      options
    });
  }

  async update(collection, filter, update, options = {}) {
    return this.request('CollectionActor', 'update', {
      collection,
      filter,
      update,
      options
    });
  }

  async delete(collection, filter, options = {}) {
    return this.request('CollectionActor', 'delete', {
      collection,
      filter,
      options
    });
  }

  async count(collection, query = {}, options = {}) {
    return this.request('CollectionActor', 'count', {
      collection,
      query,
      options
    });
  }

  async listCollections(provider = 'memory') {
    return this.request('CollectionActor', 'listCollections', {
      provider
    });
  }

  async executeQuery(collection, query, options = {}) {
    return this.request('QueryActor', 'execute', {
      collection,
      query,
      options
    });
  }

  // Database operations
  async listDatabases(provider = 'mongodb') {
    return this.request('DatabaseActor', 'listDatabases', {
      provider
    });
  }

  async switchDatabase(database, provider = 'mongodb') {
    return this.request('DatabaseActor', 'switchDatabase', {
      database,
      provider
    });
  }

  async getCurrentDatabase() {
    return this.request('DatabaseActor', 'getCurrentDatabase', {});
  }

  async createDatabase(database, provider = 'mongodb') {
    return this.request('DatabaseActor', 'createDatabase', {
      database,
      provider
    });
  }

  async dropDatabase(database, provider = 'mongodb') {
    return this.request('DatabaseActor', 'dropDatabase', {
      database,
      provider
    });
  }
}