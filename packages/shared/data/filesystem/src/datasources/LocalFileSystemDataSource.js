/**
 * LocalFileSystemDataSource - Node.js filesystem DataSource implementation
 * 
 * Implements the DataSource interface for local filesystem operations using Node.js fs module.
 * Provides the query(), update(), subscribe(), and getSchema() methods required by Handle.
 * 
 * Features:
 * - Synchronous query() method for metadata and content queries
 * - Synchronous update() method for file/directory operations
 * - File watching via fs.watch for subscriptions
 * - Support for both text and binary file operations
 * - Directory listing and traversal
 * - Cross-platform path handling
 */

import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

export class LocalFileSystemDataSource extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuration options
    this.options = {
      // Root directory for filesystem operations (default: process.cwd())
      rootPath: options.rootPath || process.cwd(),
      // Enable file watching for subscriptions
      enableWatching: options.enableWatching !== false,
      // Default file encoding
      defaultEncoding: options.defaultEncoding || 'utf8',
      // Cache TTL for metadata (milliseconds)
      metadataCacheTTL: options.metadataCacheTTL || 5000,
      ...options
    };
    
    // Normalize root path
    this.rootPath = path.resolve(this.options.rootPath);
    
    // Metadata cache
    this._metadataCache = new Map();
    
    // File watchers for subscriptions
    this._watchers = new Map();
    this._subscriptions = new Map();
    this._nextSubscriptionId = 1;
  }
  
  /**
   * Get query builder for the Handle-based architecture
   * @param {Handle} sourceHandle - Handle that initiated the query
   * @returns {Object} Query builder instance
   */
  queryBuilder(sourceHandle) {
    // Return a simple query builder that just forwards to our query method
    return {
      query: (querySpec) => this.query(querySpec)
    };
  }
  
  /**
   * Execute query synchronously (required by Handle interface)
   * @param {Object} querySpec - Query specification
   * @returns {Array} Query results
   */
  query(querySpec) {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification is required');
    }
    
    // Parse query to determine operation type
    const operation = this._parseQuery(querySpec);
    
    switch (operation.type) {
      case 'metadata':
        return this._queryMetadata(operation.path);
      case 'content':
        return this._queryContent(operation.path, operation.options);
      case 'list':
        return this._queryList(operation.path, operation.options);
      case 'search':
        return this._querySearch(operation.path, operation.pattern, operation.options);
      case 'readStream':
        return this._createReadStream(operation.path, operation.options);
      case 'writeStream':
        return this._createWriteStream(operation.path, operation.options);
      default:
        throw new Error(`Unsupported query operation: ${operation.type}`);
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
    
    try {
      switch (data.operation || data.type) {
        case 'write':
          return this._writeFile(path, data.content, data.options);
        case 'file':
          return this._createFile(data.path, data.content, data.options);
        case 'directory':
          return this._createDirectory(data.path, data.options);
        case 'copy':
          return this._copyFile(data.source, data.target, data.options);
        case 'move':
          return this._moveFile(path, data.target, data.options);
        case 'delete':
          return this._delete(path, data.options);
        default:
          throw new Error(`Unknown operation: ${data.operation || data.type}`);
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
    
    if (!this.options.enableWatching) {
      throw new Error('File watching is disabled');
    }
    
    const subscriptionId = this._nextSubscriptionId++;
    const operation = this._parseQuery(querySpec);
    
    // Create file watcher if needed
    const watchPath = this._resolvePath(operation.path);
    
    if (!this._watchers.has(watchPath)) {
      try {
        const watcher = fs.watch(watchPath, { recursive: operation.options?.recursive || false }, 
          (eventType, filename) => {
            this._handleFileSystemEvent(watchPath, eventType, filename);
          });
        
        this._watchers.set(watchPath, watcher);
      } catch (error) {
        throw new Error(`Failed to watch path ${watchPath}: ${error.message}`);
      }
    }
    
    // Store subscription
    const subscription = {
      id: subscriptionId,
      querySpec,
      callback,
      watchPath
    };
    
    this._subscriptions.set(subscriptionId, subscription);
    
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
      type: 'local-filesystem',
      provider: 'LocalFileSystemDataSource',
      capabilities: {
        read: true,
        write: true,
        watch: this.options.enableWatching,
        search: true,
        streams: true
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
  
  // Private implementation methods
  
  _parseQuery(querySpec) {
    // Parse different query formats into operation objects
    
    if (querySpec.find && querySpec.where) {
      // DataScript-style query format
      const where = querySpec.where;
      
      // Handle empty query (return root directory listing)
      if (where.length === 0) {
        return {
          type: 'list',
          path: '/',
          options: querySpec.options || {}
        };
      }
      
      // Look for parent clause first for directory listing queries
      const parentClause = where.find(clause => 
        Array.isArray(clause) && clause.length >= 2 && clause[0] === 'parent'
      );
      
      if (parentClause) {
        return {
          type: 'list',
          path: parentClause[1],
          options: { 
            recursive: querySpec.recursive || false,
            filter: querySpec.filter,
            ...querySpec.options 
          }
        };
      }
      
      for (const clause of where) {
        if (Array.isArray(clause) && clause.length >= 3) {
          const [subject, predicate, object] = clause;
          
          // Handle direct metadata queries: ['directory', path, 'metadata'] or ['file', path, 'metadata']
          if ((subject === 'directory' || subject === 'file') && object === 'metadata') {
            return {
              type: 'metadata',
              path: predicate,
              options: querySpec.options || {}
            };
          }
          
          // Handle direct content queries: ['file', path, 'content']
          if (subject === 'file' && object === 'content') {
            return {
              type: 'content',
              path: predicate,
              options: querySpec.options || {}
            };
          }
          
          // Handle stream queries: ['file', path, 'readStream'] or ['file', path, 'writeStream']
          if (subject === 'file' && (object === 'readStream' || object === 'writeStream')) {
            return {
              type: object,
              path: predicate,
              options: querySpec.options || {}
            };
          }
          
          // Handle watch queries: ['file', path, 'change'] or ['directory', path, 'change']
          if ((subject === 'directory' || subject === 'file') && object === 'change') {
            return {
              type: 'watch',
              path: predicate,
              options: querySpec.options || {}
            };
          }
          
          // Handle existing patterns with predicate as operation
          if (predicate === 'metadata') {
            return {
              type: 'metadata',
              path: typeof subject === 'string' ? subject : (object || '/'),
              options: querySpec.options || {}
            };
          } else if (predicate === 'content') {
            return {
              type: 'content',
              path: typeof subject === 'string' ? subject : (object || '/'),
              options: querySpec.options || {}
            };
          } else if (predicate === 'matches') {
            return {
              type: 'search',
              path: typeof subject === 'string' ? subject : '/',
              pattern: object,
              options: querySpec.options || {}
            };
          } else if (predicate === 'readStream') {
            return {
              type: 'readStream',
              path: typeof subject === 'string' ? subject : (object || '/'),
              options: querySpec.options || {}
            };
          } else if (predicate === 'writeStream') {
            return {
              type: 'writeStream',
              path: typeof subject === 'string' ? subject : (object || '/'),
              options: querySpec.options || {}
            };
          } else if (predicate === 'change') {
            return {
              type: 'watch',
              path: typeof subject === 'string' ? subject : (object || '/'),
              options: querySpec.options || {}
            };
          }
        }
      }
    }
    
    // Collection-style query format
    if (querySpec.collection) {
      return {
        type: 'list',
        path: querySpec.path || '/',
        options: querySpec.options || {}
      };
    }
    
    throw new Error('Unable to parse query specification');
  }
  
  _resolvePath(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      return this.rootPath;
    }
    
    // If path is already absolute and starts with a filesystem root, use it directly
    // This is needed for testing with absolute paths
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    
    // Convert to absolute path within root
    const resolved = path.resolve(this.rootPath, filePath);
    
    return resolved;
  }
  
  _queryMetadata(filePath) {
    const resolvedPath = this._resolvePath(filePath);
    
    try {
      const stats = fs.statSync(resolvedPath);
      
      const metadata = {
        path: filePath,
        type: stats.isDirectory() ? 'directory' : 'file',
        exists: true,
        size: stats.size,
        lastModified: stats.mtime.toISOString(),
        created: stats.birthtime.toISOString(),
        permissions: {
          readable: true, // Could check with fs.constants.R_OK
          writable: true, // Could check with fs.constants.W_OK
          executable: true // Could check with fs.constants.X_OK
        },
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile()
      };
      
      return [metadata];
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [{
          path: filePath,
          type: 'unknown',
          exists: false
        }];
      }
      throw error;
    }
  }
  
  _queryContent(filePath, options = {}) {
    const resolvedPath = this._resolvePath(filePath);
    
    try {
      const encoding = options.encoding !== null ? (options.encoding || this.options.defaultEncoding) : null;
      
      if (options.offset !== undefined || options.length !== undefined) {
        // Partial read with offset/length
        const fd = fs.openSync(resolvedPath, 'r');
        try {
          const buffer = Buffer.alloc(options.length || 8192);
          const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, options.offset || 0);
          const content = buffer.subarray(0, bytesRead);
          return [encoding ? content.toString(encoding) : content];
        } finally {
          fs.closeSync(fd);
        }
      } else {
        // Full file read
        const content = fs.readFileSync(resolvedPath, encoding ? { encoding } : undefined);
        return [content];
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      }
      throw error;
    }
  }
  
  _queryList(dirPath, options = {}) {
    const resolvedPath = this._resolvePath(dirPath);
    
    try {
      const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });
      const results = [];
      
      for (const entry of entries) {
        const itemPath = path.join(dirPath === '/' ? '' : dirPath, entry.name);
        const itemMetadata = this._queryMetadata(itemPath)[0];
        
        results.push({
          name: entry.name,
          path: itemPath,
          type: entry.isDirectory() ? 'directory' : 'file',
          metadata: itemMetadata
        });
        
        // Recursive listing if requested
        if (options.recursive && entry.isDirectory()) {
          const subResults = this._queryList(itemPath, options);
          results.push(...subResults);
        }
      }
      
      // Apply filter if provided
      if (options.filter && typeof options.filter === 'function') {
        return results.filter(options.filter);
      }
      
      return results;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }
  
  _querySearch(searchPath, pattern, options = {}) {
    const results = [];
    const queue = [searchPath];
    
    while (queue.length > 0) {
      const currentPath = queue.shift();
      
      try {
        const listing = this._queryList(currentPath, { recursive: false });
        
        for (const item of listing) {
          // Check if item matches pattern
          if (this._matchesPattern(item.name, pattern)) {
            results.push(item);
          }
          
          // Add directories to queue for recursive search
          if (options.recursive && item.type === 'directory') {
            queue.push(item.path);
          }
        }
      } catch (error) {
        // Skip directories we can't read
        continue;
      }
      
      // Respect limit option
      if (options.limit && results.length >= options.limit) {
        break;
      }
    }
    
    return results;
  }
  
  _writeFile(filePath, content, options = {}) {
    const resolvedPath = this._resolvePath(filePath);
    
    // Create parent directories if needed
    if (options.createParents !== false) {
      const parentDir = path.dirname(resolvedPath);
      fs.mkdirSync(parentDir, { recursive: true });
    }
    
    const writeOptions = {
      encoding: options.encoding || this.options.defaultEncoding,
      flag: options.append ? 'a' : 'w'
    };
    
    fs.writeFileSync(resolvedPath, content, writeOptions);
    
    return {
      success: true,
      path: filePath
    };
  }
  
  _createFile(filePath, content = '', options = {}) {
    const resolvedPath = this._resolvePath(filePath);
    
    // Check if file already exists (unless overwrite is allowed)
    if (!options.overwrite && fs.existsSync(resolvedPath)) {
      return {
        success: false,
        error: `File already exists: ${filePath}`
      };
    }
    
    return this._writeFile(filePath, content, options);
  }
  
  _createDirectory(dirPath, options = {}) {
    const resolvedPath = this._resolvePath(dirPath);
    
    fs.mkdirSync(resolvedPath, { 
      recursive: options.recursive !== false 
    });
    
    return {
      success: true,
      path: dirPath
    };
  }
  
  _copyFile(sourcePath, targetPath, options = {}) {
    const resolvedSource = this._resolvePath(sourcePath);
    const resolvedTarget = this._resolvePath(targetPath);
    
    // Create parent directories if needed
    const parentDir = path.dirname(resolvedTarget);
    fs.mkdirSync(parentDir, { recursive: true });
    
    const copyOptions = options.overwrite ? 0 : fs.constants.COPYFILE_EXCL;
    
    fs.copyFileSync(resolvedSource, resolvedTarget, copyOptions);
    
    return {
      success: true,
      source: sourcePath,
      target: targetPath
    };
  }
  
  _moveFile(sourcePath, targetPath, options = {}) {
    const resolvedSource = this._resolvePath(sourcePath);
    const resolvedTarget = this._resolvePath(targetPath);
    
    // Create parent directories if needed
    const parentDir = path.dirname(resolvedTarget);
    fs.mkdirSync(parentDir, { recursive: true });
    
    // Check if target exists (unless overwrite is allowed)
    if (!options.overwrite && fs.existsSync(resolvedTarget)) {
      return {
        success: false,
        error: `Target already exists: ${targetPath}`
      };
    }
    
    fs.renameSync(resolvedSource, resolvedTarget);
    
    return {
      success: true,
      source: sourcePath,
      target: targetPath
    };
  }
  
  _delete(filePath, options = {}) {
    const resolvedPath = this._resolvePath(filePath);
    
    try {
      const stats = fs.statSync(resolvedPath);
      
      if (stats.isDirectory()) {
        fs.rmSync(resolvedPath, { 
          recursive: options.recursive !== false,
          force: options.force || false
        });
      } else {
        fs.unlinkSync(resolvedPath);
      }
      
      return {
        success: true,
        path: filePath
      };
    } catch (error) {
      if (error.code === 'ENOENT' && options.force) {
        return {
          success: true,
          path: filePath
        };
      }
      throw error;
    }
  }
  
  _createReadStream(filePath, options = {}) {
    const resolvedPath = this._resolvePath(filePath);
    
    try {
      const stream = fs.createReadStream(resolvedPath, options);
      return [stream];
    } catch (error) {
      throw new Error(`Failed to create read stream: ${error.message}`);
    }
  }
  
  _createWriteStream(filePath, options = {}) {
    const resolvedPath = this._resolvePath(filePath);
    
    try {
      // Create parent directories if needed
      const parentDir = path.dirname(resolvedPath);
      fs.mkdirSync(parentDir, { recursive: true });
      
      const stream = fs.createWriteStream(resolvedPath, options);
      return [stream];
    } catch (error) {
      throw new Error(`Failed to create write stream: ${error.message}`);
    }
  }
  
  _matchesPattern(name, pattern) {
    if (typeof pattern === 'string') {
      // Simple wildcard matching
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
      return regex.test(name);
    } else if (pattern instanceof RegExp) {
      return pattern.test(name);
    }
    return false;
  }
  
  _handleFileSystemEvent(watchPath, eventType, filename) {
    // Notify all subscriptions watching this path
    for (const subscription of this._subscriptions.values()) {
      if (subscription.watchPath === watchPath) {
        const eventData = {
          event: eventType,
          path: filename ? path.join(subscription.querySpec.path || '/', filename) : subscription.querySpec.path,
          timestamp: new Date().toISOString()
        };
        
        try {
          subscription.callback([eventData]);
        } catch (error) {
          console.warn('Subscription callback error:', error);
        }
      }
    }
  }
  
  _unsubscribe(subscriptionId) {
    const subscription = this._subscriptions.get(subscriptionId);
    if (!subscription) {
      return;
    }
    
    this._subscriptions.delete(subscriptionId);
    
    // Check if any other subscriptions are watching the same path
    const stillWatched = Array.from(this._subscriptions.values())
      .some(sub => sub.watchPath === subscription.watchPath);
    
    if (!stillWatched) {
      // No more subscriptions for this path - close the watcher
      const watcher = this._watchers.get(subscription.watchPath);
      if (watcher) {
        watcher.close();
        this._watchers.delete(subscription.watchPath);
      }
    }
  }
  
  /**
   * Clean up all watchers and subscriptions
   */
  destroy() {
    // Close all watchers
    for (const watcher of this._watchers.values()) {
      try {
        watcher.close();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    this._watchers.clear();
    this._subscriptions.clear();
    this._metadataCache.clear();
  }
}