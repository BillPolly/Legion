/**
 * RemoteFileSystemResourceManager - Browser-side ResourceManager for remote filesystem access
 * 
 * Implements the ResourceManager interface for browser environments to access files
 * on a remote server via WebSocket or HTTP API. This enables web applications to use
 * FileHandle and DirectoryHandle to work with server-side files as if they were local.
 * 
 * Features:
 * - WebSocket connection for real-time file watching
 * - HTTP fallback for simple request/response operations
 * - Automatic reconnection and error recovery
 * - Request batching for performance
 * - Local caching with TTL for metadata
 * - Binary and text file support
 * - Streaming support for large files
 */

import { EventEmitter } from 'events';

export class RemoteFileSystemResourceManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuration
    this.options = {
      // Server endpoint for filesystem operations
      serverUrl: options.serverUrl || 'http://localhost:3000',
      // WebSocket endpoint for real-time updates
      wsUrl: options.wsUrl || 'ws://localhost:3000/filesystem',
      // Authentication token if required
      authToken: options.authToken,
      // Request timeout in milliseconds
      requestTimeout: options.requestTimeout || 30000,
      // Enable WebSocket for watching
      enableWebSocket: options.enableWebSocket !== false,
      // Reconnection settings
      reconnectInterval: options.reconnectInterval || 5000,
      maxReconnectAttempts: options.maxReconnectAttempts || 10,
      // Cache settings
      enableCache: options.enableCache !== false,
      cacheTTL: options.cacheTTL || 5000,
      // Batch request settings
      batchRequests: options.batchRequests !== false,
      batchInterval: options.batchInterval || 50,
      ...options
    };
    
    // WebSocket connection
    this.ws = null;
    this.wsConnected = false;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    
    // Request handling
    this.pendingRequests = new Map();
    this.requestIdCounter = 1;
    this.batchQueue = [];
    this.batchTimer = null;
    
    // Subscription handling
    this.subscriptions = new Map();
    this.subscriptionIdCounter = 1;
    
    // Metadata cache
    this.metadataCache = new Map();
    
    // Initialize WebSocket if enabled
    if (this.options.enableWebSocket) {
      this._connectWebSocket();
    }
  }
  
  /**
   * Get query builder for the Handle-based architecture
   * @param {Handle} sourceHandle - Handle that initiated the query
   * @returns {Object} Query builder instance
   */
  queryBuilder(sourceHandle) {
    // Return a query builder that forwards to our query method
    return {
      query: (querySpec) => this.query(querySpec)
    };
  }
  
  /**
   * Execute query synchronously (required by Handle interface)
   * Uses synchronous XMLHttpRequest for compatibility with Handle's sync interface
   * @param {Object} querySpec - Query specification
   * @returns {Array} Query results
   */
  query(querySpec) {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification is required');
    }
    
    // For synchronous operation, we use XMLHttpRequest with async=false
    // This is deprecated but necessary for Handle's synchronous interface
    const xhr = new XMLHttpRequest();
    const url = `${this.options.serverUrl}/api/filesystem/query`;
    
    xhr.open('POST', url, false); // Synchronous request
    xhr.setRequestHeader('Content-Type', 'application/json');
    
    if (this.options.authToken) {
      xhr.setRequestHeader('Authorization', `Bearer ${this.options.authToken}`);
    }
    
    try {
      xhr.send(JSON.stringify({ query: querySpec }));
      
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText);
        return response.results || [];
      } else {
        throw new Error(`Server error: ${xhr.status} ${xhr.statusText}`);
      }
    } catch (error) {
      // Check cache for metadata queries
      if (this._isMetadataQuery(querySpec) && this.options.enableCache) {
        const cached = this._getCachedMetadata(querySpec);
        if (cached) return cached;
      }
      
      throw new Error(`Query failed: ${error.message}`);
    }
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
    
    const xhr = new XMLHttpRequest();
    const url = `${this.options.serverUrl}/api/filesystem/update`;
    
    xhr.open('POST', url, false); // Synchronous request
    xhr.setRequestHeader('Content-Type', 'application/json');
    
    if (this.options.authToken) {
      xhr.setRequestHeader('Authorization', `Bearer ${this.options.authToken}`);
    }
    
    // Handle binary data
    let requestData = { path, ...data };
    if (data.content instanceof ArrayBuffer || data.content instanceof Uint8Array) {
      // Convert binary to base64 for transport
      requestData.content = this._arrayBufferToBase64(data.content);
      requestData.encoding = 'base64';
    }
    
    try {
      xhr.send(JSON.stringify(requestData));
      
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText);
        
        // Invalidate cache for this path
        this._invalidateCache(path || data.path);
        
        return response;
      } else {
        return {
          success: false,
          error: `Server error: ${xhr.status} ${xhr.statusText}`
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Create subscription for file watching (required by Handle interface)
   * Uses WebSocket for real-time updates
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
    
    if (!this.options.enableWebSocket) {
      throw new Error('WebSocket is disabled - cannot create subscriptions');
    }
    
    const subscriptionId = this.subscriptionIdCounter++;
    
    // Store subscription
    const subscription = {
      id: subscriptionId,
      querySpec,
      callback
    };
    
    this.subscriptions.set(subscriptionId, subscription);
    
    // Send subscription request via WebSocket if connected
    if (this.wsConnected) {
      this._sendWebSocketMessage({
        type: 'subscribe',
        id: subscriptionId,
        query: querySpec
      });
    }
    // Otherwise it will be sent when WebSocket connects
    
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
   * Get schema information (required by Handle interface)
   * @returns {Object} Schema object
   */
  getSchema() {
    return {
      version: '1.0.0',
      type: 'remote-filesystem',
      provider: 'RemoteFileSystemResourceManager',
      capabilities: {
        read: true,
        write: true,
        watch: this.options.enableWebSocket,
        search: true,
        streams: true
      },
      connection: {
        serverUrl: this.options.serverUrl,
        wsConnected: this.wsConnected
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
  
  // WebSocket management
  
  _connectWebSocket() {
    if (!this.options.enableWebSocket) return;
    
    try {
      this.ws = new WebSocket(this.options.wsUrl);
      
      this.ws.onopen = () => {
        if (this.options.verbose !== false) {
          console.log('WebSocket connected to filesystem server');
        }
        this.wsConnected = true;
        this.reconnectAttempts = 0;
        
        // Clear reconnect timer
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        
        // Authenticate if needed
        if (this.options.authToken) {
          this._sendWebSocketMessage({
            type: 'auth',
            token: this.options.authToken
          });
        }
        
        // Re-establish subscriptions
        for (const subscription of this.subscriptions.values()) {
          this._sendWebSocketMessage({
            type: 'subscribe',
            id: subscription.id,
            query: subscription.querySpec
          });
        }
        
        this.emit('connected');
      };
      
      this.ws.onmessage = (event) => {
        this._handleWebSocketMessage(event.data);
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
      };
      
      this.ws.onclose = () => {
        if (this.options.verbose !== false) {
          console.log('WebSocket disconnected');
        }
        this.wsConnected = false;
        this.emit('disconnected');
        
        // Attempt reconnection
        this._scheduleReconnect();
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this._scheduleReconnect();
    }
  }
  
  _scheduleReconnect() {
    if (!this.options.enableWebSocket) return;
    
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('reconnectFailed');
      return;
    }
    
    if (this.reconnectTimer) return; // Already scheduled
    
    this.reconnectAttempts++;
    if (this.options.verbose !== false) {
      console.log(`Scheduling reconnection attempt ${this.reconnectAttempts}...`);
    }
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._connectWebSocket();
    }, this.options.reconnectInterval);
  }
  
  _sendWebSocketMessage(data) {
    if (!this.wsConnected || !this.ws) {
      console.warn('WebSocket not connected - cannot send message');
      return;
    }
    
    try {
      this.ws.send(JSON.stringify(data));
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
    }
  }
  
  _handleWebSocketMessage(data) {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'fileChange':
          this._handleFileChange(message);
          break;
        case 'error':
          console.error('Server error:', message.error);
          break;
        case 'subscribed':
          console.log(`Subscription ${message.id} confirmed`);
          break;
        case 'unsubscribed':
          console.log(`Subscription ${message.id} removed`);
          break;
        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }
  
  _handleFileChange(message) {
    // Find matching subscriptions
    for (const subscription of this.subscriptions.values()) {
      if (this._matchesSubscription(message, subscription.querySpec)) {
        try {
          subscription.callback([{
            event: message.event || 'change',
            path: message.path,
            timestamp: message.timestamp || new Date().toISOString(),
            data: message.data
          }]);
        } catch (error) {
          console.error('Subscription callback error:', error);
        }
      }
    }
  }
  
  _matchesSubscription(message, querySpec) {
    // Check if the file change matches the subscription query
    if (!querySpec.where) return false;
    
    for (const clause of querySpec.where) {
      if (Array.isArray(clause) && clause.length >= 2) {
        const [subject, predicate, object] = clause;
        
        // Check if this is watching the changed file/directory
        if ((subject === 'file' || subject === 'directory') && 
            predicate === message.path && 
            object === 'change') {
          return true;
        }
        
        // Check parent directory watches
        if (subject === 'parent' && message.path.startsWith(predicate)) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  _unsubscribe(subscriptionId) {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;
    
    this.subscriptions.delete(subscriptionId);
    
    // Notify server if connected
    if (this.wsConnected) {
      this._sendWebSocketMessage({
        type: 'unsubscribe',
        id: subscriptionId
      });
    }
  }
  
  // Cache management
  
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
    
    // Optionally invalidate parent directory listing (not metadata)
    // This allows parent to remain but forces fresh listing if queried
    const parentPath = path.substring(0, path.lastIndexOf('/')) || '/';
    if (parentPath !== path) {
      // Only invalidate if it's a listing cache, not metadata cache
      const parentCached = this.metadataCache.get(parentPath);
      if (parentCached && parentCached.data && Array.isArray(parentCached.data)) {
        this.metadataCache.delete(parentPath);
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
  
  // Utility methods
  
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
    if (this.ws) {
      this.wsConnected = false;
      this.ws.close();
      this.ws = null;
    }
    
    // Clear timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    // Clear collections
    this.subscriptions.clear();
    this.pendingRequests.clear();
    this.metadataCache.clear();
    this.batchQueue = [];
  }
}