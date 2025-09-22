/**
 * FileSystemActor - Actor-based server for filesystem operations
 * 
 * Implements the Actor pattern to handle filesystem operations via the
 * WebSocket-Actor protocol system. This replaces the custom WebSocket handling
 * in FileSystemServer with a proper Actor implementation.
 * 
 * Features:
 * - Actor-based message handling for all filesystem operations
 * - Integration with WebSocketBridgeActor for browser communication
 * - Proper protocol separation using FileSystemProtocol
 * - Support for queries, updates, subscriptions, and streaming
 * - Security validation and path sandboxing
 */

import { LocalFileSystemResourceManager } from '../resourcemanagers/LocalFileSystemResourceManager.js';
import path from 'path';
import fs from 'fs';

export class FileSystemActor {
  constructor(config = {}) {
    this.isActor = true;
    this.name = config.name || 'FilesystemActor';
    
    this.options = {
      // Filesystem configuration
      rootPath: config.rootPath || process.cwd(),
      // Security
      enableAuth: config.enableAuth || false,
      authTokens: config.authTokens || new Set(),
      // Limits
      maxFileSize: config.maxFileSize || 10 * 1024 * 1024, // 10MB
      maxQueryResults: config.maxQueryResults || 1000,
      // Logging
      verbose: config.verbose || false,
      ...config
    };
    
    // Create local filesystem resource manager
    this.fsManager = new LocalFileSystemResourceManager({
      rootPath: this.options.rootPath,
      enableWatching: true
    });
    
    // Track client sessions and subscriptions
    this.clientSessions = new Map();
    this.subscriptions = new Map();
    this.subscriptionIdCounter = 1;
    
    // Actor system references
    this.actorSpace = config.actorSpace;
    this._key = config.key;
    
    if (this.options.verbose) {
      console.log(`FileSystemActor initialized with root: ${this.options.rootPath}`);
    }
  }
  
  /**
   * Receive message from other actors (implements Actor interface)
   */
  async receive(message) {
    const { type, payload, requestId } = message;
    
    if (this.options.verbose) {
      console.log(`FileSystemActor received: ${type}`);
    }
    
    try {
      switch (type) {
        case 'filesystemConnect':
          return await this._handleConnect(payload, requestId);
          
        case 'filesystemQuery':
          return await this._handleQuery(payload, requestId);
          
        case 'filesystemUpdate':
          return await this._handleUpdate(payload, requestId);
          
        case 'filesystemSubscribe':
          return await this._handleSubscribe(payload, requestId);
          
        case 'filesystemUnsubscribe':
          return await this._handleUnsubscribe(payload, requestId);
          
        case 'filesystemStreamRead':
          return await this._handleStreamRead(payload, requestId);
          
        case 'filesystemStreamWrite':
          return await this._handleStreamWrite(payload, requestId);
          
        default:
          throw new Error(`Unknown filesystem operation: ${type}`);
      }
    } catch (error) {
      // Send error response
      this._sendResponse({
        type: 'filesystemError',
        payload: {
          error: {
            message: error.message,
            code: error.code || -1
          }
        },
        requestId
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Handle filesystem connection request
   */
  async _handleConnect(payload, requestId) {
    const { authToken } = payload;
    
    // Validate authentication if enabled
    if (this.options.enableAuth) {
      if (!authToken || !this.options.authTokens.has(authToken)) {
        throw new Error('Invalid authentication token');
      }
    }
    
    // Create or update client session
    const sessionId = `fs_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.clientSessions.set(sessionId, {
      sessionId,
      authToken,
      authenticated: true,
      subscriptions: new Set(),
      createdAt: new Date()
    });
    
    // Send success response
    this._sendResponse({
      type: 'filesystemConnected',
      payload: {
        sessionId,
        success: true,
        capabilities: this.fsManager.getSchema().capabilities
      },
      requestId
    });
    
    return {
      success: true,
      sessionId
    };
  }
  
  /**
   * Handle filesystem query request
   */
  async _handleQuery(payload, requestId) {
    const { querySpec } = payload;
    
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Invalid query specification');
    }
    
    // Validate and sanitize paths in query
    this._validateQuery(querySpec);
    
    // Execute query
    const results = this.fsManager.query(querySpec);
    
    // Limit results
    const limited = Array.isArray(results) 
      ? results.slice(0, this.options.maxQueryResults)
      : results;
    
    // Send response
    this._sendResponse({
      type: 'filesystemQueryResult',
      payload: {
        results: limited,
        truncated: Array.isArray(results) && results.length > this.options.maxQueryResults
      },
      requestId
    });
    
    return {
      success: true,
      results: limited
    };
  }
  
  /**
   * Handle filesystem update request
   */
  async _handleUpdate(payload, requestId) {
    const { path: filePath, data } = payload;
    
    // Validate paths
    if (filePath) {
      this._validatePath(filePath);
    }
    if (data.path) {
      this._validatePath(data.path);
    }
    if (data.source) {
      this._validatePath(data.source);
    }
    if (data.target) {
      this._validatePath(data.target);
    }
    
    // Handle base64 encoded content
    if (data.encoding === 'base64' && data.content) {
      data.content = Buffer.from(data.content, 'base64');
      delete data.encoding;
    }
    
    // Check file size limits
    if (data.content && data.content.length > this.options.maxFileSize) {
      throw new Error('File size exceeds limit');
    }
    
    // Execute update
    const result = this.fsManager.update(filePath, data);
    
    if (!result.success) {
      throw new Error(result.error || 'Update operation failed');
    }
    
    // Notify subscribers of changes
    const affectedPath = filePath || data.path || data.target;
    if (affectedPath) {
      this._notifyFileChange(affectedPath, data.operation || data.type || 'change');
    }
    
    // Send response
    this._sendResponse({
      type: 'filesystemUpdateResult',
      payload: {
        success: true,
        path: affectedPath
      },
      requestId
    });
    
    return result;
  }
  
  /**
   * Handle filesystem subscription request
   */
  async _handleSubscribe(payload, requestId) {
    const { querySpec, subscriptionId } = payload;
    
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Invalid query specification');
    }
    
    // Validate query
    this._validateQuery(querySpec);
    
    // Create subscription with the local filesystem manager
    const subscription = this.fsManager.subscribe(querySpec, (changes) => {
      // Notify the subscriber via actor message
      this._sendResponse({
        type: 'filesystemFileChange',
        payload: {
          subscriptionId,
          changes,
          timestamp: new Date().toISOString()
        }
      });
    });
    
    // Store subscription
    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      querySpec,
      subscription,
      requestId
    });
    
    // Send confirmation
    this._sendResponse({
      type: 'filesystemSubscribed',
      payload: {
        subscriptionId,
        success: true
      },
      requestId
    });
    
    return {
      success: true,
      subscriptionId
    };
  }
  
  /**
   * Handle filesystem unsubscribe request
   */
  async _handleUnsubscribe(payload, requestId) {
    const { subscriptionId } = payload;
    
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }
    
    // Unsubscribe from filesystem manager
    subscription.subscription.unsubscribe();
    
    // Remove from our tracking
    this.subscriptions.delete(subscriptionId);
    
    // Send confirmation
    this._sendResponse({
      type: 'filesystemUnsubscribed',
      payload: {
        subscriptionId,
        success: true
      },
      requestId
    });
    
    return {
      success: true,
      subscriptionId
    };
  }
  
  /**
   * Handle filesystem stream read request
   */
  async _handleStreamRead(payload, requestId) {
    const { path: filePath, options = {} } = payload;
    
    this._validatePath(filePath);
    
    const resolvedPath = path.resolve(this.options.rootPath, filePath.substring(1));
    
    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      throw new Error('File not found');
    }
    
    const stats = fs.statSync(resolvedPath);
    if (!stats.isFile()) {
      throw new Error('Path is not a file');
    }
    
    // For now, read the entire file (could be enhanced for true streaming)
    const content = fs.readFileSync(resolvedPath, options.encoding || 'utf8');
    
    // Send stream data
    this._sendResponse({
      type: 'filesystemStreamData',
      payload: {
        data: content,
        encoding: options.encoding || 'utf8',
        totalBytes: stats.size
      },
      requestId
    });
    
    // Send stream end
    this._sendResponse({
      type: 'filesystemStreamEnd',
      payload: {
        success: true,
        totalBytes: stats.size
      },
      requestId
    });
    
    return {
      success: true,
      totalBytes: stats.size
    };
  }
  
  /**
   * Handle filesystem stream write request
   */
  async _handleStreamWrite(payload, requestId) {
    const { path: filePath, data, options = {} } = payload;
    
    this._validatePath(filePath);
    
    // Check file size limits
    if (data && data.length > this.options.maxFileSize) {
      throw new Error('File size exceeds limit');
    }
    
    // Execute the write using the filesystem manager
    const result = this.fsManager.update(filePath, {
      content: data,
      ...options
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Write operation failed');
    }
    
    // Notify subscribers
    this._notifyFileChange(filePath, 'write');
    
    // Send stream end
    this._sendResponse({
      type: 'filesystemStreamEnd',
      payload: {
        success: true,
        totalBytes: data ? data.length : 0
      },
      requestId
    });
    
    return result;
  }
  
  /**
   * Send response message to actor system
   */
  _sendResponse(message) {
    if (this.actorSpace) {
      // Broadcast the response to all actors (the WebSocketBridgeActor will route it)
      this.actorSpace.actors.forEach((actor, key) => {
        if (key !== this._key && actor.receive) {
          try {
            actor.receive(message);
          } catch (error) {
            // Ignore routing errors
          }
        }
      });
    }
  }
  
  /**
   * Notify subscribers of file changes
   */
  _notifyFileChange(filePath, operation) {
    // The actual notification is handled by the filesystem manager's subscriptions
    // This method could be enhanced to send additional notifications if needed
    if (this.options.verbose) {
      console.log(`File changed: ${filePath} (${operation})`);
    }
  }
  
  /**
   * Validate file path to prevent traversal attacks
   */
  _validatePath(filePath) {
    // Check for obvious traversal patterns before normalization
    if (filePath.includes('..') || filePath.includes('/../')) {
      throw new Error('Path traversal attempt detected');
    }
    
    const normalized = path.normalize(filePath);
    
    // Ensure path starts with /
    const cleanPath = normalized.startsWith('/') ? normalized : '/' + normalized;
    
    // Double check after normalization
    if (cleanPath.includes('..')) {
      throw new Error('Path traversal attempt detected');
    }
    
    // Resolve against root and check containment
    const pathToResolve = cleanPath.substring(1); // Remove leading /
    const resolved = path.resolve(this.options.rootPath, pathToResolve);
    const rootResolved = path.resolve(this.options.rootPath);
    
    if (!resolved.startsWith(rootResolved)) {
      throw new Error('Path traversal attempt detected');
    }
    
    return cleanPath;
  }
  
  /**
   * Validate query specification
   */
  _validateQuery(query) {
    if (!query || typeof query !== 'object') {
      throw new Error('Invalid query specification');
    }
    
    // Allow empty queries with just find/where structure
    if (!query.hasOwnProperty('find') && !query.hasOwnProperty('where')) {
      throw new Error('Query must have find or where clauses');
    }
    
    if (query.where && Array.isArray(query.where)) {
      for (const clause of query.where) {
        if (Array.isArray(clause) && clause.length >= 2) {
          // Validate paths in clauses
          if (typeof clause[1] === 'string' && clause[1].startsWith('/')) {
            this._validatePath(clause[1]);
          }
          if (typeof clause[0] === 'string' && clause[0].startsWith('/')) {
            this._validatePath(clause[0]);
          }
        }
      }
    }
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    // Clean up all subscriptions
    for (const sub of this.subscriptions.values()) {
      try {
        sub.subscription.unsubscribe();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    this.subscriptions.clear();
    this.clientSessions.clear();
    
    if (this.options.verbose) {
      console.log('FileSystemActor destroyed');
    }
  }
}