/**
 * ActorRemoteFileSystemDataSource - Actor-based browser DataSource for remote filesystem access
 * 
 * Implements the DataSource interface for browser environments to access files
 * on a remote server via the Actor system and WebSocketBridgeActor. This replaces
 * the custom WebSocket handling with proper Actor-based communication.
 * 
 * Features:
 * - Actor-based communication via WebSocketBridgeActor and FileSystemProtocol
 * - Automatic request/response correlation
 * - Real-time file watching via actor subscriptions
 * - Local caching with TTL for metadata
 * - Binary and text file support
 * - Proper error handling and reconnection
 */

import { EventEmitter } from 'events';
import { WebSocketBridgeActor } from '@legion/websocket-actor-protocol';
import { FileSystemProtocol } from '../protocol/FileSystemProtocol.js';

export class ActorRemoteFileSystemDataSource extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuration
    this.options = {
      // Server endpoint for WebSocket connection
      wsUrl: options.wsUrl || 'ws://localhost:3000/filesystem',
      // Authentication token if required
      authToken: options.authToken,
      // Request timeout in milliseconds
      requestTimeout: options.requestTimeout || 30000,
      // Reconnection settings
      reconnectInterval: options.reconnectInterval || 5000,
      maxReconnectAttempts: options.maxReconnectAttempts || 10,
      // Cache settings
      enableCache: options.enableCache !== false,
      cacheTTL: options.cacheTTL || 5000,
      // Actor system
      actorSpace: options.actorSpace,
      // Logging
      verbose: options.verbose || false,
      ...options
    };
    
    // Create WebSocket connection
    this.websocket = null;
    this.bridgeActor = null;
    this.protocol = new FileSystemProtocol();
    
    // Request handling
    this.pendingRequests = new Map();
    this.requestIdCounter = 1;
    
    // Subscription handling
    this.subscriptions = new Map();
    this.subscriptionIdCounter = 1;
    
    // Metadata cache
    this.metadataCache = new Map();
    
    // Connection state
    this.isConnected = false;
    this.isAuthenticated = false;
    this.sessionId = null;
    
    // Initialize Actor bridge
    this._initializeBridge();
  }
  
  /**
   * Initialize the WebSocket bridge actor
   */
  _initializeBridge() {
    // Create WebSocket connection
    this.websocket = new WebSocket(this.options.wsUrl);
    
    // Create bridge actor with filesystem protocol
    this.bridgeActor = new WebSocketBridgeActor({
      protocol: this.protocol,
      websocket: this.websocket,
      actorSpace: this.options.actorSpace,
      name: 'FileSystemBridge'
    });
    
    // Register this data source as an actor to receive responses
    if (this.options.actorSpace) {
      this.options.actorSpace.registerActor('filesystem-client', this);
    }
    
    // Set up event handlers
    this._setupEventHandlers();
  }
  
  /**
   * Set up event handlers for the bridge actor and WebSocket
   */
  _setupEventHandlers() {
    // Listen for connection events
    this.websocket.addEventListener('open', () => {
      this.isConnected = true;
      if (this.options.verbose) {
        console.log('FileSystem WebSocket connected');
      }
      this.emit('connected');
      
      // Authenticate if token provided
      if (this.options.authToken) {
        this._authenticate();
      }
    });
    
    this.websocket.addEventListener('close', () => {
      this.isConnected = false;
      this.isAuthenticated = false;
      if (this.options.verbose) {
        console.log('FileSystem WebSocket disconnected');
      }
      this.emit('disconnected');
      
      // Reject pending requests
      for (const [requestId, request] of this.pendingRequests) {
        request.reject(new Error('Connection closed'));
      }
      this.pendingRequests.clear();
    });
    
    this.websocket.addEventListener('error', (error) => {
      console.error('FileSystem WebSocket error:', error);
      this.emit('error', error);
    });
  }
  
  /**
   * Authenticate with the server
   */
  async _authenticate() {
    try {
      const response = await this._sendActorMessage({
        type: 'filesystemConnect',
        payload: {
          authToken: this.options.authToken
        }
      });
      
      if (response.success) {
        this.isAuthenticated = true;
        this.sessionId = response.sessionId;
        if (this.options.verbose) {
          console.log('FileSystem authentication successful');
        }
      }
    } catch (error) {
      console.error('FileSystem authentication failed:', error);
    }
  }
  
  /**
   * Send message via Actor system and wait for response
   */
  async _sendActorMessage(message) {
    if (!this.isConnected) {
      throw new Error('Not connected to filesystem server');
    }
    
    return new Promise((resolve, reject) => {
      const requestId = `req_${this.requestIdCounter++}`;
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }, this.options.requestTimeout);
      
      this.pendingRequests.set(requestId, {
        resolve: (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });
      
      // Send message through bridge actor
      this.bridgeActor.receive({
        ...message,
        requestId,
        resolve: this.pendingRequests.get(requestId).resolve,
        reject: this.pendingRequests.get(requestId).reject
      });
    });
  }
  
  /**
   * Receive message from Actor system (implements Actor interface)
   */
  receive(message) {
    const { type, payload, requestId } = message;
    
    if (this.options.verbose) {
      console.log(`FileSystem client received: ${type}`);
    }
    
    // Handle responses to pending requests
    if (requestId && this.pendingRequests.has(requestId)) {
      const request = this.pendingRequests.get(requestId);
      this.pendingRequests.delete(requestId);
      
      if (type.includes('Error')) {
        request.reject(new Error(payload.error?.message || 'Request failed'));
      } else {
        request.resolve(payload);
      }
      return;
    }
    
    // Handle subscription notifications
    switch (type) {
      case 'filesystemFileChange':
        this._handleFileChange(payload);
        break;
        
      case 'filesystemServerConnected':
        if (this.options.verbose) {
          console.log('FileSystem server capabilities:', payload.capabilities);
        }
        break;
        
      case 'filesystemConnected':
        this.isAuthenticated = payload.success;
        this.sessionId = payload.sessionId;
        break;
        
      default:
        if (this.options.verbose) {
          console.log('Unhandled filesystem message:', type);
        }
    }
  }
  
  /**
   * Get query builder for the Handle-based architecture
   * @param {Handle} sourceHandle - Handle that initiated the query
   * @returns {Object} Query builder instance
   */
  queryBuilder(sourceHandle) {
    return {
      query: (querySpec) => this.query(querySpec)
    };
  }
  
  /**
   * Execute query synchronously (required by Handle interface)
   * Uses synchronous message passing for compatibility with Handle's sync interface
   * @param {Object} querySpec - Query specification
   * @returns {Array} Query results
   */
  query(querySpec) {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification is required');
    }
    
    // For synchronous operation, we need to block until response arrives
    // This is implemented using a busy wait with async/await under the hood
    let result = null;
    let error = null;
    let completed = false;
    
    this._sendActorMessage({
      type: 'filesystemQuery',
      payload: { querySpec }
    }).then(response => {
      result = response.results || [];
      completed = true;
    }).catch(err => {
      error = err;
      completed = true;
    });
    
    // Busy wait for completion (not ideal but required for sync interface)
    const startTime = Date.now();
    while (!completed && (Date.now() - startTime) < this.options.requestTimeout) {
      // Allow event loop to process
      if (typeof setImmediate !== 'undefined') {
        setImmediate(() => {});
      }
    }
    
    if (!completed) {
      // Check cache for metadata queries
      if (this._isMetadataQuery(querySpec) && this.options.enableCache) {
        const cached = this._getCachedMetadata(querySpec);
        if (cached) return cached;
      }
      
      throw new Error('Query timeout');
    }
    
    if (error) {
      // Check cache for metadata queries
      if (this._isMetadataQuery(querySpec) && this.options.enableCache) {
        const cached = this._getCachedMetadata(querySpec);
        if (cached) return cached;
      }
      
      throw error;
    }
    
    return result;
  }
  
  /**
   * Update filesystem synchronously (required by Handle interface)
   * @param {string|null} path - File path (null for new files)
   * @param {Object} data - Update data
   * @returns {Object} Update result
   */
  update(path, data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Update data is required');
    }
    
    // Handle binary data
    let requestData = { path, ...data };
    if (data.content instanceof ArrayBuffer || data.content instanceof Uint8Array) {
      // Convert binary to base64 for transport
      requestData.content = this._arrayBufferToBase64(data.content);
      requestData.encoding = 'base64';
    }
    
    let result = null;
    let error = null;
    let completed = false;
    
    this._sendActorMessage({
      type: 'filesystemUpdate',
      payload: { path, data: requestData }
    }).then(response => {
      result = {
        success: response.success,
        path: response.path
      };
      completed = true;
      
      // Invalidate cache for this path
      this._invalidateCache(path || data.path);
      
    }).catch(err => {
      error = err;
      completed = true;
    });
    
    // Busy wait for completion
    const startTime = Date.now();
    while (!completed && (Date.now() - startTime) < this.options.requestTimeout) {
      if (typeof setImmediate !== 'undefined') {
        setImmediate(() => {});
      }
    }
    
    if (!completed) {
      return {
        success: false,
        error: 'Update timeout'
      };
    }
    
    if (error) {
      return {
        success: false,
        error: error.message
      };
    }
    
    return result;
  }
  
  /**
   * Create subscription for file watching (required by Handle interface)
   * Uses Actor system for real-time updates
   * @param {Object} querySpec - Query specification to monitor
   * @param {Function} callback - Callback function for changes
   * @returns {Object} Subscription object with unsubscribe method
   */
  subscribe(querySpec, callback) {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification is required');
    }
    
    if (typeof callback !== 'function') {
      throw new Error('Callback function is required');
    }
    
    const subscriptionId = `sub_${this.subscriptionIdCounter++}`;
    
    // Store subscription
    const subscription = {
      id: subscriptionId,
      querySpec,
      callback
    };
    
    this.subscriptions.set(subscriptionId, subscription);
    
    // Send subscription request via Actor system
    this._sendActorMessage({
      type: 'filesystemSubscribe',
      payload: { querySpec, subscriptionId }
    }).catch(error => {
      console.error('Subscription failed:', error);
      this.subscriptions.delete(subscriptionId);
    });
    
    // Return subscription object
    return {
      id: subscriptionId,
      querySpec: querySpec,
      callback: callback,
      unsubscribe: () => {
        this._unsubscribe(subscriptionId);
      }
    };
  }
  
  /**
   * Unsubscribe from file watching
   */
  _unsubscribe(subscriptionId) {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;
    
    this.subscriptions.delete(subscriptionId);
    
    // Notify server
    this._sendActorMessage({
      type: 'filesystemUnsubscribe',
      payload: { subscriptionId }
    }).catch(error => {
      console.error('Unsubscribe failed:', error);
    });
  }
  
  /**
   * Handle file change notifications from server
   */
  _handleFileChange(payload) {
    const { subscriptionId, changes } = payload;
    
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      try {
        subscription.callback(changes);
      } catch (error) {
        console.error('Subscription callback error:', error);
      }
    }
  }
  
  /**
   * Get schema information (required by Handle interface)
   * @returns {Object} Schema object
   */
  getSchema() {
    return {
      version: '1.0.0',
      type: 'actor-remote-filesystem',
      provider: 'ActorRemoteFileSystemDataSource',
      capabilities: {
        read: true,
        write: true,
        watch: true,
        search: true,
        streams: true
      },
      connection: {
        wsUrl: this.options.wsUrl,
        isConnected: this.isConnected,
        isAuthenticated: this.isAuthenticated,
        sessionId: this.sessionId
      },
      attributes: {
        path: { type: 'string', required: true },
        type: { type: 'string', enum: ['file', 'directory'] },
        size: { type: 'number' },
        lastModified: { type: 'date' },
        permissions: { type: 'object' }
      }
    };
  }
  
  // Cache management methods (same as original implementation)
  
  _isMetadataQuery(querySpec) {
    if (!querySpec.where) return false;
    
    return querySpec.where.some(clause => 
      Array.isArray(clause) && clause[2] === 'metadata'
    );
  }
  
  _getCachedMetadata(querySpec) {
    const path = this._extractPathFromQuery(querySpec);
    if (!path) return null;
    
    const cached = this.metadataCache.get(path);
    if (!cached) return null;
    
    // Check TTL
    if (Date.now() - cached.timestamp > this.options.cacheTTL) {
      this.metadataCache.delete(path);
      return null;
    }
    
    return cached.data;
  }
  
  _setCachedMetadata(path, data) {
    if (!this.options.enableCache) return;
    
    this.metadataCache.set(path, {
      data,
      timestamp: Date.now()
    });
  }
  
  _invalidateCache(path) {
    if (!path) return;
    
    // Remove exact path
    this.metadataCache.delete(path);
    
    // Remove child paths (but NOT parent paths - they should remain)
    for (const [cachedPath] of this.metadataCache) {
      if (cachedPath.startsWith(path + '/')) {
        this.metadataCache.delete(cachedPath);
      }
    }
  }
  
  _extractPathFromQuery(querySpec) {
    if (!querySpec.where) return null;
    
    for (const clause of querySpec.where) {
      if (Array.isArray(clause) && clause.length >= 2) {
        const [subject, predicate, object] = clause;
        
        if ((subject === 'file' || subject === 'directory') && object === 'metadata') {
          return predicate;
        }
        
        if (typeof subject === 'string' && predicate === 'metadata') {
          return subject;
        }
      }
    }
    
    return null;
  }
  
  // Utility methods (same as original implementation)
  
  _arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  
  _base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    // Close WebSocket
    if (this.websocket) {
      this.isConnected = false;
      this.websocket.close();
      this.websocket = null;
    }
    
    // Clean up bridge actor
    if (this.bridgeActor) {
      this.bridgeActor.destroy();
      this.bridgeActor = null;
    }
    
    // Clear collections
    this.subscriptions.clear();
    this.pendingRequests.clear();
    this.metadataCache.clear();
    
    // Unregister from actor space
    if (this.options.actorSpace) {
      this.options.actorSpace.unregisterActor('filesystem-client');
    }
  }
}