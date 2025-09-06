import { ITripleStore } from './ITripleStore.js';
import { StorageError, ConnectionError, NetworkError, AuthenticationError, ValidationError } from './StorageError.js';

/**
 * Remote HTTP API triple store implementation
 * Enables integration with remote knowledge graph services
 */
export class RemoteTripleStore extends ITripleStore {
  constructor(endpoint, options = {}) {
    super();
    
    this.endpoint = endpoint.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = options.apiKey;
    this.timeout = options.timeout || 30000;
    this.retries = options.retries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.batchSize = options.batchSize || 100;
    
    // Authentication
    this.authType = options.authType || 'bearer'; // bearer, basic, apikey
    this.username = options.username;
    this.password = options.password;
    
    // Caching and offline support
    this.enableCache = options.enableCache !== false;
    this.cacheSize = options.cacheSize || 1000;
    this.cacheTTL = options.cacheTTL || 300000; // 5 minutes
    this.offlineMode = options.offlineMode || false;
    
    // Cache implementation
    this.cache = new Map();
    this.cacheTimestamps = new Map();
    
    // Connection state
    this.connected = false;
    this.lastPing = null;
    
    this._validateConfig();
  }

  getMetadata() {
    return {
      type: 'remote',
      supportsTransactions: false,
      supportsPersistence: true,
      supportsAsync: true,
      maxTriples: Infinity,
      endpoint: this.endpoint,
      connected: this.connected,
      enableCache: this.enableCache,
      cacheSize: this.cacheSize,
      cacheTTL: this.cacheTTL,
      offlineMode: this.offlineMode,
      lastPing: this.lastPing,
      cacheStats: this._getCacheStats()
    };
  }

  /**
   * Connect to the remote API
   */
  async connect() {
    if (this.connected) return;
    
    try {
      // Test connection with ping
      await this._ping();
      this.connected = true;
      this.lastPing = Date.now();
    } catch (error) {
      if (this.offlineMode) {
        console.warn('Remote API unavailable, operating in offline mode');
        this.connected = false;
      } else {
        throw new ConnectionError(`Failed to connect to remote API: ${error.message}`, error);
      }
    }
  }

  /**
   * Disconnect from the remote API
   */
  async disconnect() {
    this.connected = false;
    this.lastPing = null;
    
    // Clear cache if needed
    if (!this.enableCache) {
      this.cache.clear();
      this.cacheTimestamps.clear();
    }
  }

  /**
   * Add a triple to the remote store
   */
  async addTriple(subject, predicate, object) {
    await this._ensureConnected();
    
    try {
      const response = await this._makeRequest('POST', '/triples', {
        subject,
        predicate,
        object
      });
      
      // Invalidate relevant cache entries
      this._invalidateCache(subject, predicate, object);
      
      return response.success || false;
    } catch (error) {
      if (this.offlineMode && this._isNetworkError(error)) {
        // Queue for later sync
        this._queueOperation('add', [subject, predicate, object]);
        return true;
      }
      throw new StorageError(`Failed to add triple: ${error.message}`, 'ADD_ERROR', error);
    }
  }

  /**
   * Remove a triple from the remote store
   */
  async removeTriple(subject, predicate, object) {
    await this._ensureConnected();
    
    try {
      const response = await this._makeRequest('DELETE', '/triples', {
        subject,
        predicate,
        object
      });
      
      // Invalidate relevant cache entries
      this._invalidateCache(subject, predicate, object);
      
      return response.success || false;
    } catch (error) {
      if (this.offlineMode && this._isNetworkError(error)) {
        // Queue for later sync
        this._queueOperation('remove', [subject, predicate, object]);
        return true;
      }
      throw new StorageError(`Failed to remove triple: ${error.message}`, 'REMOVE_ERROR', error);
    }
  }

  /**
   * Query triples with pattern matching
   */
  async query(subject, predicate, object) {
    await this._ensureConnected();
    
    // Check cache first
    if (this.enableCache) {
      const cached = this._getCachedQuery(subject, predicate, object);
      if (cached) {
        return cached;
      }
    }
    
    try {
      const params = {};
      if (subject !== null && subject !== undefined) params.subject = subject;
      if (predicate !== null && predicate !== undefined) params.predicate = predicate;
      if (object !== null && object !== undefined) params.object = object;
      
      const response = await this._makeRequest('GET', '/triples', null, params);
      const triples = response.triples || [];
      
      // Cache the result
      if (this.enableCache) {
        this._cacheQuery(subject, predicate, object, triples);
      }
      
      return triples;
    } catch (error) {
      if (this.offlineMode && this._isNetworkError(error)) {
        // Return cached results if available
        const cached = this._getCachedQuery(subject, predicate, object, true);
        if (cached) {
          return cached;
        }
        return [];
      }
      throw new StorageError(`Failed to query triples: ${error.message}`, 'QUERY_ERROR', error);
    }
  }

  /**
   * Get the total number of triples
   */
  async size() {
    await this._ensureConnected();
    
    try {
      const response = await this._makeRequest('GET', '/stats/size');
      return response.count || 0;
    } catch (error) {
      if (this.offlineMode && this._isNetworkError(error)) {
        return 0; // Can't determine size offline
      }
      throw new StorageError(`Failed to get size: ${error.message}`, 'SIZE_ERROR', error);
    }
  }

  /**
   * Clear all triples
   */
  async clear() {
    await this._ensureConnected();
    
    try {
      await this._makeRequest('DELETE', '/triples/all');
      
      // Clear cache
      this.cache.clear();
      this.cacheTimestamps.clear();
    } catch (error) {
      if (this.offlineMode && this._isNetworkError(error)) {
        // Queue for later sync
        this._queueOperation('clear', []);
        return;
      }
      throw new StorageError(`Failed to clear triples: ${error.message}`, 'CLEAR_ERROR', error);
    }
  }

  /**
   * Check if a triple exists
   */
  async exists(subject, predicate, object) {
    const results = await this.query(subject, predicate, object);
    return results.length > 0;
  }

  /**
   * Add multiple triples in a batch
   */
  async addTriples(triples) {
    await this._ensureConnected();
    
    if (triples.length === 0) return 0;
    
    try {
      let addedCount = 0;
      
      // Process in batches
      for (let i = 0; i < triples.length; i += this.batchSize) {
        const batch = triples.slice(i, i + this.batchSize);
        const response = await this._makeRequest('POST', '/triples/batch', {
          triples: batch.map(([s, p, o]) => ({ subject: s, predicate: p, object: o }))
        });
        
        addedCount += response.added || 0;
        
        // Invalidate cache for batch
        batch.forEach(([s, p, o]) => this._invalidateCache(s, p, o));
      }
      
      return addedCount;
    } catch (error) {
      if (this.offlineMode && this._isNetworkError(error)) {
        // Queue for later sync
        triples.forEach(triple => this._queueOperation('add', triple));
        return triples.length;
      }
      throw new StorageError(`Failed to add triples batch: ${error.message}`, 'BATCH_ADD_ERROR', error);
    }
  }

  /**
   * Remove multiple triples in a batch
   */
  async removeTriples(triples) {
    await this._ensureConnected();
    
    if (triples.length === 0) return 0;
    
    try {
      let removedCount = 0;
      
      // Process in batches
      for (let i = 0; i < triples.length; i += this.batchSize) {
        const batch = triples.slice(i, i + this.batchSize);
        const response = await this._makeRequest('DELETE', '/triples/batch', {
          triples: batch.map(([s, p, o]) => ({ subject: s, predicate: p, object: o }))
        });
        
        removedCount += response.removed || 0;
        
        // Invalidate cache for batch
        batch.forEach(([s, p, o]) => this._invalidateCache(s, p, o));
      }
      
      return removedCount;
    } catch (error) {
      if (this.offlineMode && this._isNetworkError(error)) {
        // Queue for later sync
        triples.forEach(triple => this._queueOperation('remove', triple));
        return triples.length;
      }
      throw new StorageError(`Failed to remove triples batch: ${error.message}`, 'BATCH_REMOVE_ERROR', error);
    }
  }

  /**
   * Execute a custom API query
   */
  async executeCustomQuery(endpoint, method = 'GET', data = null, params = {}) {
    await this._ensureConnected();
    
    try {
      return await this._makeRequest(method, endpoint, data, params);
    } catch (error) {
      throw new StorageError(`Failed to execute custom query: ${error.message}`, 'CUSTOM_QUERY_ERROR', error);
    }
  }

  /**
   * Get remote API statistics
   */
  async getRemoteStats() {
    await this._ensureConnected();
    
    try {
      return await this._makeRequest('GET', '/stats');
    } catch (error) {
      throw new StorageError(`Failed to get remote stats: ${error.message}`, 'STATS_ERROR', error);
    }
  }

  /**
   * Sync offline operations
   */
  async syncOfflineOperations() {
    if (!this.offlineQueue || this.offlineQueue.length === 0) {
      return { synced: 0, failed: 0 };
    }
    
    let synced = 0;
    let failed = 0;
    
    for (const operation of this.offlineQueue) {
      try {
        switch (operation.type) {
          case 'add':
            await this.addTriple(...operation.args);
            break;
          case 'remove':
            await this.removeTriple(...operation.args);
            break;
          case 'clear':
            await this.clear();
            break;
        }
        synced++;
      } catch (error) {
        failed++;
        console.error(`Failed to sync operation ${operation.type}:`, error);
      }
    }
    
    // Clear synced operations
    this.offlineQueue = this.offlineQueue.slice(synced);
    
    return { synced, failed };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }

  /**
   * Close the store and cleanup resources
   */
  async close() {
    await this.disconnect();
  }

  // Private methods

  /**
   * Ensure connection to remote API
   */
  async _ensureConnected() {
    if (!this.connected && !this.offlineMode) {
      await this.connect();
    }
  }

  /**
   * Validate configuration
   */
  _validateConfig() {
    if (!this.endpoint) {
      throw new ValidationError('API endpoint is required');
    }
    
    try {
      new URL(this.endpoint);
    } catch {
      throw new ValidationError('Invalid API endpoint URL');
    }
    
    if (this.timeout < 1000 || this.timeout > 300000) {
      throw new ValidationError('Timeout must be between 1000ms and 300000ms');
    }
    
    if (this.batchSize < 1 || this.batchSize > 1000) {
      throw new ValidationError('Batch size must be between 1 and 1000');
    }
  }

  /**
   * Ping the remote API
   */
  async _ping() {
    const response = await this._makeRequest('GET', '/health');
    if (!response.status || response.status !== 'ok') {
      throw new Error('API health check failed');
    }
  }

  /**
   * Make HTTP request to remote API
   */
  async _makeRequest(method, path, data = null, params = {}) {
    const url = new URL(this.endpoint + path);
    
    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        url.searchParams.append(key, value);
      }
    });
    
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'KnowledgeGraph-RemoteStore/1.0'
    };
    
    // Add authentication
    this._addAuthentication(headers);
    
    const requestOptions = {
      method,
      headers,
      signal: AbortSignal.timeout(this.timeout)
    };
    
    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      requestOptions.body = JSON.stringify(data);
    }
    
    let lastError;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const response = await fetch(url.toString(), requestOptions);
        
        if (!response.ok) {
          await this._handleErrorResponse(response);
        }
        
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          return await response.json();
        } else {
          return await response.text();
        }
        
      } catch (error) {
        lastError = error;
        
        if (error.name === 'AbortError') {
          lastError = new NetworkError(`Request timeout after ${this.timeout}ms`);
        }
        
        // Don't retry on authentication errors
        if (error instanceof AuthenticationError) {
          throw error;
        }
        
        // Retry on network errors with exponential backoff
        if (attempt < this.retries && this._isRetryableError(error)) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          await this._sleep(delay);
          continue;
        }
      }
    }
    
    throw lastError || new NetworkError('Request failed after all retries');
  }

  /**
   * Add authentication to request headers
   */
  _addAuthentication(headers) {
    switch (this.authType) {
      case 'bearer':
        if (this.apiKey) {
          headers['Authorization'] = `Bearer ${this.apiKey}`;
        }
        break;
      case 'basic':
        if (this.username && this.password) {
          const credentials = Buffer.from(`${this.username}:${this.password}`).toString('base64');
          headers['Authorization'] = `Basic ${credentials}`;
        }
        break;
      case 'apikey':
        if (this.apiKey) {
          headers['X-API-Key'] = this.apiKey;
        }
        break;
    }
  }

  /**
   * Handle error responses from API
   */
  async _handleErrorResponse(response) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: response.statusText };
    }
    
    const error = new Error(errorData.message || 'API error');
    error.status = response.status;
    error.response = errorData;
    
    switch (response.status) {
      case 401:
        throw new AuthenticationError(`API authentication failed: ${errorData.message}`);
      case 403:
        throw new AuthenticationError(`API access forbidden: ${errorData.message}`);
      case 404:
        throw new ValidationError(`API endpoint not found: ${errorData.message}`);
      case 422:
        throw new ValidationError(`API validation error: ${errorData.message}`);
      case 429:
        throw new NetworkError(`API rate limit exceeded: ${errorData.message}`);
      case 500:
      case 502:
      case 503:
      case 504:
        throw new NetworkError(`API server error (${response.status}): ${errorData.message}`);
      default:
        throw new NetworkError(`API error (${response.status}): ${errorData.message}`);
    }
  }

  /**
   * Check if error is retryable
   */
  _isRetryableError(error) {
    return error instanceof NetworkError || 
           error.name === 'AbortError' ||
           error.code === 'ECONNRESET' ||
           error.code === 'ENOTFOUND';
  }

  /**
   * Check if error is a network error
   */
  _isNetworkError(error) {
    return error instanceof NetworkError ||
           error.name === 'AbortError' ||
           error.code === 'ECONNRESET' ||
           error.code === 'ENOTFOUND' ||
           error.code === 'ETIMEDOUT';
  }

  /**
   * Sleep for specified milliseconds
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Cache management

  /**
   * Generate cache key for query
   */
  _getCacheKey(subject, predicate, object) {
    return `${subject || '*'}|${predicate || '*'}|${JSON.stringify(object) || '*'}`;
  }

  /**
   * Get cached query result
   */
  _getCachedQuery(subject, predicate, object, ignoreExpiry = false) {
    const key = this._getCacheKey(subject, predicate, object);
    const timestamp = this.cacheTimestamps.get(key);
    
    if (!timestamp) return null;
    
    if (!ignoreExpiry && Date.now() - timestamp > this.cacheTTL) {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
      return null;
    }
    
    return this.cache.get(key);
  }

  /**
   * Cache query result
   */
  _cacheQuery(subject, predicate, object, result) {
    if (this.cache.size >= this.cacheSize) {
      // Remove oldest entry
      const oldestKey = this.cacheTimestamps.keys().next().value;
      this.cache.delete(oldestKey);
      this.cacheTimestamps.delete(oldestKey);
    }
    
    const key = this._getCacheKey(subject, predicate, object);
    this.cache.set(key, result);
    this.cacheTimestamps.set(key, Date.now());
  }

  /**
   * Invalidate cache entries
   */
  _invalidateCache(subject, predicate, object) {
    // Remove exact matches and broader patterns that might include this triple
    const keysToRemove = [];
    
    for (const key of this.cache.keys()) {
      const [s, p, o] = key.split('|');
      
      // Check if this cache entry could include the modified triple
      if ((s === '*' || s === subject) &&
          (p === '*' || p === predicate) &&
          (o === '*' || o === JSON.stringify(object))) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
    });
  }

  /**
   * Get cache statistics
   */
  _getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.cacheSize,
      hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0
    };
  }

  // Offline support

  /**
   * Queue operation for offline sync
   */
  _queueOperation(type, args) {
    if (!this.offlineQueue) {
      this.offlineQueue = [];
    }
    
    this.offlineQueue.push({
      type,
      args,
      timestamp: Date.now()
    });
  }
}
