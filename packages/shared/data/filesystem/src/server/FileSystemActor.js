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

import { LocalFileSystemDataSource } from '../datasources/LocalFileSystemDataSource.js';
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
    
    // Create local filesystem DataSource
    this.fsManager = new LocalFileSystemDataSource({
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
   * Get actor metadata (implements Actor interface)
   */
  getMetadata() {
    return {
      type: 'filesystem',
      name: this.name,
      capabilities: this.fsManager.getSchema().capabilities,
      rootPath: this.options.rootPath,
      version: '1.0.0'
    };
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
          throw new Error(`Unknown message type: ${type}`);
      }
    } catch (error) {
      // Create error response message
      const errorResponse = {
        type: 'filesystemError',
        payload: {
          error: {
            message: error.message,
            code: error.code || -1
          }
        },
        requestId
      };
      
      // Send to actor space
      this._sendResponse(errorResponse);
      
      // Return for direct testing
      return errorResponse;
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
    
    // Create response message
    const response = {
      type: 'filesystemConnected',
      payload: {
        sessionId,
        success: true,
        capabilities: this.fsManager.getSchema().capabilities
      },
      requestId
    };
    
    // Send to actor space
    this._sendResponse(response);
    
    // Return for direct testing
    return response;
  }
  
  /**
   * Handle filesystem query request
   */
  async _handleQuery(payload, requestId) {
    const { querySpec } = payload;
    
    // Request ID is required for queries
    if (!requestId) {
      throw new Error('Request ID is required');
    }
    
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Invalid query specification');
    }
    
    // Validate and sanitize paths in query
    this._validateQuery(querySpec);
    
    // Transform relative paths to absolute paths for LocalFileSystemDataSource
    const transformedSpec = this._transformQueryPaths(querySpec);
    
    // Execute query
    const results = this.fsManager.query(transformedSpec);
    
    // Check if this is a content query (where clause has 'content' as third element)
    const isContentQuery = querySpec.where && 
      Array.isArray(querySpec.where) &&
      querySpec.where.some(clause => 
        Array.isArray(clause) && clause.length === 3 && clause[2] === 'content'
      );
    
    // If content query, wrap result with path
    let processedResults = results;
    if (isContentQuery) {
      // Extract the file path from the query
      const contentClause = querySpec.where.find(clause => 
        Array.isArray(clause) && clause.length === 3 && clause[2] === 'content'
      );
      const filePath = contentClause ? contentClause[1] : null;
      
      // LocalFileSystemDataSource returns content as [content] - an array with a single element
      if (Array.isArray(results) && results.length > 0) {
        const content = results[0];
        processedResults = [{
          path: filePath,
          content: content
        }];
      } else if (typeof results === 'string' || results instanceof Buffer) {
        // Fallback for direct string/buffer results
        processedResults = [{
          path: filePath,
          content: results
        }];
      }
    }
    
    // Limit results
    const limited = Array.isArray(processedResults) 
      ? processedResults.slice(0, this.options.maxQueryResults)
      : processedResults;
    
    // Transform absolute paths back to relative paths in results
    const transformedResults = this._transformResultPaths(limited);
    
    // Create response message
    const response = {
      type: 'filesystemQueryResult',
      payload: {
        success: true,
        results: transformedResults,
        truncated: Array.isArray(results) && results.length > this.options.maxQueryResults
      },
      requestId
    };
    
    // Send to actor space
    this._sendResponse(response);
    
    // Return for direct testing
    return response;
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
    
    // For write operations without explicit createParents option, set it to false
    // This ensures operations fail if parent directories don't exist (security)
    if (data.operation === 'write' && !data.options) {
      data.options = { createParents: false };
    } else if (data.operation === 'write' && data.options && data.options.createParents === undefined) {
      data.options.createParents = false;
    }
    
    // Transform relative path to absolute path for LocalFileSystemDataSource
    let absoluteFilePath = filePath;
    if (filePath && filePath.startsWith('/')) {
      const pathToResolve = filePath.substring(1);
      absoluteFilePath = path.resolve(this.options.rootPath, pathToResolve);
    }
    
    // Transform paths in data object
    const transformedData = { ...data };
    if (data.path && data.path.startsWith('/')) {
      const pathToResolve = data.path.substring(1);
      transformedData.path = path.resolve(this.options.rootPath, pathToResolve);
    }
    // If no data.path but we have a main filePath, and this is a directory/file creation, add it to data
    else if (!data.path && absoluteFilePath && (data.type === 'directory' || data.type === 'file')) {
      transformedData.path = absoluteFilePath;
    }
    
    if (data.source && data.source.startsWith('/')) {
      const pathToResolve = data.source.substring(1);
      transformedData.source = path.resolve(this.options.rootPath, pathToResolve);
    }
    if (data.target && data.target.startsWith('/')) {
      const pathToResolve = data.target.substring(1);
      transformedData.target = path.resolve(this.options.rootPath, pathToResolve);
    }
    
    // Remove 'operation' field when type is directory or file
    // LocalFileSystemDataSource infers the operation from the presence of 'type' field
    if (transformedData.type === 'directory' || transformedData.type === 'file') {
      delete transformedData.operation;
    }
    
    // For directory/file creation operations, pass null as first param to LocalFileSystemDataSource
    const updatePath = (data.type === 'directory' || data.type === 'file') ? null : absoluteFilePath;
    
    // Execute update
    const result = this.fsManager.update(updatePath, transformedData);
    
    if (!result.success) {
      throw new Error(result.error || 'Update operation failed');
    }
    
    // Notify subscribers of changes
    const affectedPath = filePath || data.path || data.target;
    if (affectedPath) {
      this._notifyFileChange(affectedPath, data.operation || data.type || 'change');
    }
    
    // Create response message
    const response = {
      type: 'filesystemUpdateResult',
      payload: {
        success: true,
        path: affectedPath
      },
      requestId
    };
    
    // Send to actor space
    this._sendResponse(response);
    
    // Return for direct testing
    return response;
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
    
    // Transform relative paths to absolute paths for LocalFileSystemDataSource
    const transformedSpec = this._transformQueryPaths(querySpec);
    
    // Create subscription with the local filesystem manager
    // Note: May fail if file doesn't exist, but we still track the subscription
    let subscription = null;
    try {
      subscription = this.fsManager.subscribe(transformedSpec, (changes) => {
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
    } catch (error) {
      // File watcher creation failed (e.g., file doesn't exist)
      // Still track the subscription for API consistency
      subscription = {
        id: subscriptionId,
        querySpec: transformedSpec,
        callback: () => {},
        unsubscribe: () => {} // No-op unsubscribe
      };
      
      if (this.options.verbose) {
        console.log(`Warning: File watcher creation failed: ${error.message}`);
      }
    }
    
    // Store subscription
    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      querySpec,
      subscription,
      requestId
    });
    
    // Create response message
    const response = {
      type: 'filesystemSubscribed',
      payload: {
        subscriptionId,
        success: true
      },
      requestId
    };
    
    // Send to actor space
    this._sendResponse(response);
    
    // Return for direct testing
    return response;
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
    
    // Create response message
    const response = {
      type: 'filesystemUnsubscribed',
      payload: {
        subscriptionId,
        success: true
      },
      requestId
    };
    
    // Send to actor space
    this._sendResponse(response);
    
    // Return for direct testing
    return response;
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
    
    // Create stream end response message
    const response = {
      type: 'filesystemStreamEnd',
      payload: {
        success: true,
        totalBytes: stats.size
      },
      requestId
    };
    
    // Send to actor space
    this._sendResponse(response);
    
    // Return for direct testing
    return response;
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
    
    // Create stream end response message
    const response = {
      type: 'filesystemStreamEnd',
      payload: {
        success: true,
        totalBytes: data ? data.length : 0
      },
      requestId
    };
    
    // Send to actor space
    this._sendResponse(response);
    
    // Return for direct testing
    return response;
  }
  
  /**
   * Send response message to actor system
   */
  _sendResponse(message) {
    if (this.actorSpace) {
      // Broadcast the response to all actors (the WebSocketBridgeActor will route it)
      // actorSpace is a Map, so we iterate directly
      this.actorSpace.forEach((actor, key) => {
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
   * Transform absolute paths in results back to relative paths (starting with /)
   */
  _transformResultPaths(results) {
    const rootPath = path.resolve(this.options.rootPath);
    
    const transformPath = (absPath) => {
      if (typeof absPath !== 'string') {
        return absPath;
      }
      
      // If the path starts with rootPath, make it relative
      if (absPath.startsWith(rootPath)) {
        const relativePath = absPath.substring(rootPath.length);
        // Ensure it starts with /
        return relativePath.startsWith('/') ? relativePath : '/' + relativePath;
      }
      
      return absPath;
    };
    
    if (!results) {
      return results;
    }
    
    if (Array.isArray(results)) {
      return results.map(result => {
        if (typeof result === 'object' && result !== null) {
          const transformed = { ...result };
          if (transformed.path) {
            transformed.path = transformPath(transformed.path);
          }
          return transformed;
        }
        return result;
      });
    }
    
    if (typeof results === 'object' && results !== null) {
      const transformed = { ...results };
      if (transformed.path) {
        transformed.path = transformPath(transformed.path);
      }
      return transformed;
    }
    
    return results;
  }
  
  /**
   * Transform query paths from relative (starting with /) to absolute paths
   */
  _transformQueryPaths(querySpec) {
    if (!querySpec.where || !Array.isArray(querySpec.where)) {
      return querySpec;
    }
    
    const transformedWhere = querySpec.where.map(clause => {
      if (!Array.isArray(clause)) {
        return clause;
      }
      
      // Transform paths in clauses
      return clause.map(item => {
        if (typeof item === 'string' && item.startsWith('/')) {
          // Convert relative path to absolute path
          const pathToResolve = item.substring(1); // Remove leading /
          return path.resolve(this.options.rootPath, pathToResolve);
        }
        return item;
      });
    });
    
    return {
      ...querySpec,
      where: transformedWhere
    };
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