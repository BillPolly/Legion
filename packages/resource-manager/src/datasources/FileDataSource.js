/**
 * FileDataSource - DataSource implementation for filesystem resources
 * 
 * Provides access to files and directories through the DataSource interface.
 * Supports querying files by patterns, watching for changes via filesystem events,
 * and validation against file schema specifications.
 * 
 * URI Examples:
 * - legion://local/filesystem/project/src/main.js
 * - legion://server/filesystem/workspace/config.json
 * - legion://prod/filesystem/logs/application.log
 */

import { validateDataSourceInterface } from '@legion/handle/src/DataSource.js';
import path from 'path';

export class FileDataSource {
  constructor(context) {
    if (!context || !context.resourceManager) {
      throw new Error('Context with ResourceManager is required');
    }

    this.context = context;
    this.resourceManager = context.resourceManager;
    this.parsed = context.parsed;
    
    // File system path from URI path
    this.filePath = this.parsed.path || '';
    this.server = this.parsed.server;
    this.resourceType = this.parsed.resourceType;
    
    // File system state
    this._watchers = new Map();
    this._subscriptions = new Map();
    this._stats = null;
    this._content = null;
    this._contentTimestamp = null;
    this._cacheTimeout = 5 * 60 * 1000; // 5 minutes
    
    // Cached data
    this._schema = null;
    this._metadata = null;
    
    // Validate interface compliance
    validateDataSourceInterface(this, 'FileDataSource');
  }

  /**
   * Execute query against filesystem - SYNCHRONOUS
   * @param {Object} querySpec - Query specification
   * @returns {Array} Query results
   */
  query(querySpec) {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }

    // For synchronous interface, we need to handle async filesystem operations
    // This is a limitation - filesystem operations are inherently async
    // We'll throw an error directing users to use async methods
    throw new Error('Filesystem operations are async - use FileHandle.queryAsync() instead of sync query()');
  }

  /**
   * Execute async query against filesystem
   * @param {Object} querySpec - Query specification
   * @returns {Promise<Array>} Query results
   */
  async queryAsync(querySpec) {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const results = [];

    try {
      if (querySpec.find === 'all') {
        // List all files in directory
        if (!this.filePath) {
          throw new Error('File path is required for directory listing');
        }
        
        const fullPath = this._resolveFilePath();
        const stats = await fs.stat(fullPath);
        
        if (stats.isDirectory()) {
          const entries = await fs.readdir(fullPath, { withFileTypes: true });
          return entries.map(entry => ({
            name: entry.name,
            path: path.join(this.filePath, entry.name),
            type: entry.isDirectory() ? 'directory' : 'file',
            size: null, // Would need separate stat call
            modified: null // Would need separate stat call
          }));
        } else {
          // Single file info
          return [{
            name: path.basename(fullPath),
            path: this.filePath,
            type: 'file',
            size: stats.size,
            modified: stats.mtime
          }];
        }
        
      } else if (querySpec.find && typeof querySpec.find === 'object') {
        // Find files matching pattern
        if (querySpec.find.pattern) {
          return await this._findFilesByPattern(querySpec.find.pattern, querySpec);
        }
        
        if (querySpec.find.name) {
          return await this._findFilesByName(querySpec.find.name, querySpec);
        }
        
      } else if (querySpec.read) {
        // Read file content
        const content = await this._readFileContent(querySpec.read);
        return [{ content, path: this.filePath, type: 'content' }];
        
      } else if (querySpec.stats) {
        // Get file statistics
        const fullPath = this._resolveFilePath();
        const stats = await fs.stat(fullPath);
        
        return [{
          path: this.filePath,
          size: stats.size,
          modified: stats.mtime,
          created: stats.birthtime,
          isDirectory: stats.isDirectory(),
          isFile: stats.isFile(),
          permissions: stats.mode
        }];
      }

      return results;

    } catch (error) {
      throw new Error(`Filesystem query failed: ${error.message}`);
    }
  }

  /**
   * Set up subscription for filesystem changes - SYNCHRONOUS
   * @param {Object} querySpec - Query specification to monitor
   * @param {Function} callback - Change notification callback
   * @returns {Object} Subscription object
   */
  subscribe(querySpec, callback) {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }
    
    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback function is required');
    }

    const subscriptionId = Date.now() + Math.random();
    
    // Create subscription object (async setup will happen in background)
    const subscription = {
      id: subscriptionId,
      querySpec,
      callback,
      unsubscribe: () => {
        this._subscriptions.delete(subscriptionId);
        this._stopFileWatcher(subscriptionId);
      }
    };

    this._subscriptions.set(subscriptionId, subscription);
    
    // Start file watcher asynchronously
    this._startFileWatcher(subscriptionId, querySpec, callback);

    return subscription;
  }

  /**
   * Get filesystem schema - SYNCHRONOUS
   * @returns {Object} Schema describing filesystem structure
   */
  getSchema() {
    if (!this._schema) {
      this._schema = this._generateFileSchema();
    }
    return this._schema;
  }

  /**
   * Update filesystem resources - SYNCHRONOUS (throws error directing to async)
   * @param {Object} updateSpec - Update specification
   * @returns {Object} Update result
   */
  update(updateSpec) {
    throw new Error('Filesystem updates are async - use FileHandle.updateAsync() instead of sync update()');
  }

  /**
   * Update filesystem resources - ASYNC
   * @param {Object} updateSpec - Update specification
   * @returns {Promise<Object>} Update result
   */
  async updateAsync(updateSpec) {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const changes = [];

    try {
      if (updateSpec.write) {
        // Write content to file
        const { content, encoding = 'utf8', options = {} } = updateSpec.write;
        const fullPath = this._resolveFilePath();
        
        // Ensure directory exists
        const dir = path.dirname(fullPath);
        await fs.mkdir(dir, { recursive: true });
        
        await fs.writeFile(fullPath, content, { encoding, ...options });
        
        changes.push({
          type: 'write',
          path: this.filePath,
          size: Buffer.byteLength(content, encoding)
        });
      }

      if (updateSpec.append) {
        // Append content to file
        const { content, encoding = 'utf8' } = updateSpec.append;
        const fullPath = this._resolveFilePath();
        
        await fs.appendFile(fullPath, content, { encoding });
        
        changes.push({
          type: 'append',
          path: this.filePath,
          appendedLength: Buffer.byteLength(content, encoding)
        });
      }

      if (updateSpec.mkdir) {
        // Create directory
        const { recursive = true, mode } = updateSpec.mkdir;
        const fullPath = this._resolveFilePath();
        
        await fs.mkdir(fullPath, { recursive, mode });
        
        changes.push({
          type: 'mkdir',
          path: this.filePath,
          recursive
        });
      }

      if (updateSpec.copy) {
        // Copy file or directory
        const { destination, options = {} } = updateSpec.copy;
        const sourcePath = this._resolveFilePath();
        const destPath = this._resolveFilePath(destination);
        
        await fs.cp(sourcePath, destPath, options);
        
        changes.push({
          type: 'copy',
          source: this.filePath,
          destination,
          options
        });
      }

      if (updateSpec.move) {
        // Move/rename file or directory
        const { destination } = updateSpec.move;
        const sourcePath = this._resolveFilePath();
        const destPath = this._resolveFilePath(destination);
        
        await fs.rename(sourcePath, destPath);
        
        changes.push({
          type: 'move',
          source: this.filePath,
          destination
        });
      }

      if (updateSpec.delete) {
        // Delete file or directory
        const { force = false, recursive = false } = updateSpec.delete;
        const fullPath = this._resolveFilePath();
        
        if (recursive) {
          await fs.rm(fullPath, { recursive: true, force });
        } else {
          await fs.unlink(fullPath);
        }
        
        changes.push({
          type: 'delete',
          path: this.filePath,
          recursive,
          force
        });
      }

      // Invalidate cached data
      this._content = null;
      this._contentTimestamp = null;
      this._stats = null;
      this._metadata = null;

      // Notify subscribers of changes
      this._notifySubscribers(changes);

      return {
        success: true,
        changes,
        metadata: {
          path: this.filePath,
          timestamp: Date.now()
        }
      };

    } catch (error) {
      throw new Error(`Filesystem update failed: ${error.message}`);
    }
  }

  /**
   * Validate filesystem data - SYNCHRONOUS
   * @param {*} data - Data to validate
   * @returns {boolean} True if valid
   */
  validate(data) {
    if (data === null || data === undefined) {
      return false;
    }

    // Basic file system validation
    if (typeof data === 'string') {
      // Valid file content
      return true;
    }
    
    if (typeof data === 'object') {
      // File metadata object
      if (data.path || data.name) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get filesystem metadata - SYNCHRONOUS
   * @returns {Object} Metadata about filesystem resource
   */
  getMetadata() {
    if (!this._metadata) {
      this._metadata = {
        dataSourceType: 'FileDataSource',
        filePath: this.filePath,
        server: this.server,
        subscriptionCount: this._subscriptions.size,
        watcherCount: this._watchers.size,
        schema: this.getSchema(),
        capabilities: {
          query: false, // Sync query not supported
          queryAsync: true,
          subscribe: true,
          update: false, // Sync update not supported
          updateAsync: true,
          validate: true,
          queryBuilder: true
        },
        hasCachedContent: !!this._content,
        contentCacheAge: this._contentTimestamp ? Date.now() - this._contentTimestamp : null,
        lastModified: Date.now()
      };
    }
    
    return this._metadata;
  }

  /**
   * Create query builder for filesystem - SYNCHRONOUS
   * @param {Handle} sourceHandle - Source Handle
   * @returns {Object} Filesystem query builder
   */
  queryBuilder(sourceHandle) {
    if (!sourceHandle) {
      throw new Error('Source Handle is required for query builder');
    }

    return new FileQueryBuilder(sourceHandle, this);
  }

  // Private helper methods

  /**
   * Resolve file path to absolute path
   * @param {string} relativePath - Optional relative path to resolve
   * @returns {string} Absolute file path
   * @private
   */
  _resolveFilePath(relativePath = null) {
    const targetPath = relativePath || this.filePath;
    
    // If path is already absolute, return as-is
    if (path.isAbsolute(targetPath)) {
      return targetPath;
    }
    
    // Get workspace root from ResourceManager
    const workspaceRoot = this.resourceManager.get('env.WORKSPACE_ROOT') || 
                         this.resourceManager.get('env.MONOREPO_ROOT') ||
                         process.cwd();
    
    return path.resolve(workspaceRoot, targetPath);
  }

  /**
   * Read file content with caching
   * @param {Object} options - Read options
   * @returns {Promise<string>} File content
   * @private
   */
  async _readFileContent(options = {}) {
    // Check cache first
    if (this._content && this._isContentCacheValid()) {
      return this._content;
    }
    
    const fs = await import('fs/promises');
    const { encoding = 'utf8' } = options;
    
    try {
      const fullPath = this._resolveFilePath();
      const content = await fs.readFile(fullPath, { encoding });
      
      // Cache content
      this._content = content;
      this._contentTimestamp = Date.now();
      
      return content;
    } catch (error) {
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  /**
   * Check if cached content is still valid
   * @returns {boolean} True if cache is valid
   * @private
   */
  _isContentCacheValid() {
    if (!this._contentTimestamp) return false;
    return (Date.now() - this._contentTimestamp) < this._cacheTimeout;
  }

  /**
   * Find files by pattern
   * @param {string} pattern - File pattern (glob)
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Matching files
   * @private
   */
  async _findFilesByPattern(pattern, options = {}) {
    const glob = await import('glob');
    const path = await import('path');
    const fs = await import('fs/promises');
    
    const searchPath = this._resolveFilePath();
    const fullPattern = path.join(searchPath, pattern);
    
    const matches = await glob.glob(fullPattern, {
      ignore: options.ignore || ['node_modules/**', '.git/**'],
      dot: options.includeDotFiles || false
    });
    
    const results = [];
    for (const match of matches) {
      try {
        const stats = await fs.stat(match);
        const relativePath = path.relative(searchPath, match);
        
        results.push({
          name: path.basename(match),
          path: relativePath,
          fullPath: match,
          type: stats.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          modified: stats.mtime
        });
      } catch (error) {
        // Skip files that can't be accessed
        continue;
      }
    }
    
    return results;
  }

  /**
   * Find files by name
   * @param {string} name - File name to search for
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Matching files
   * @private
   */
  async _findFilesByName(name, options = {}) {
    return this._findFilesByPattern(`**/${name}`, options);
  }

  /**
   * Start file watcher for subscription
   * @param {string} subscriptionId - Subscription ID
   * @param {Object} querySpec - Query specification
   * @param {Function} callback - Change callback
   * @private
   */
  async _startFileWatcher(subscriptionId, querySpec, callback) {
    try {
      const fs = await import('fs');
      const fullPath = this._resolveFilePath();
      
      // Create file watcher
      const watcher = fs.watch(fullPath, { recursive: true }, (eventType, filename) => {
        try {
          callback([{
            type: 'change',
            event: eventType,
            filename: filename,
            path: this.filePath,
            timestamp: Date.now()
          }]);
        } catch (error) {
          console.warn('Filesystem change notification failed:', error);
        }
      });
      
      this._watchers.set(subscriptionId, watcher);
      
      watcher.on('error', (error) => {
        console.warn(`File watcher error for subscription ${subscriptionId}:`, error);
        this._watchers.delete(subscriptionId);
      });

    } catch (error) {
      console.warn(`Failed to start file watcher for subscription ${subscriptionId}:`, error);
    }
  }

  /**
   * Stop file watcher for subscription
   * @param {string} subscriptionId - Subscription ID
   * @private
   */
  _stopFileWatcher(subscriptionId) {
    const watcher = this._watchers.get(subscriptionId);
    if (watcher) {
      try {
        watcher.close();
      } catch (error) {
        console.warn(`Error closing file watcher ${subscriptionId}:`, error);
      }
      this._watchers.delete(subscriptionId);
    }
  }

  /**
   * Generate filesystem schema
   * @returns {Object} Filesystem schema
   * @private
   */
  _generateFileSchema() {
    return {
      version: '1.0.0',
      type: 'filesystem',
      path: this.filePath,
      attributes: {
        name: {
          type: 'string',
          required: true,
          description: 'File or directory name'
        },
        path: {
          type: 'string',
          required: true,
          description: 'File path relative to workspace'
        },
        size: {
          type: 'number',
          description: 'File size in bytes'
        },
        modified: {
          type: 'date',
          description: 'Last modification time'
        },
        type: {
          type: 'string',
          enum: ['file', 'directory'],
          description: 'File system entry type'
        }
      },
      relationships: {},
      constraints: {
        requiredFields: ['name', 'path']
      },
      capabilities: [
        'read', 'write', 'append', 'delete', 'copy', 'move',
        'mkdir', 'watch', 'search', 'glob'
      ]
    };
  }

  /**
   * Notify subscribers of changes
   * @param {Array} changes - Array of change objects
   * @private
   */
  _notifySubscribers(changes) {
    for (const subscription of this._subscriptions.values()) {
      try {
        subscription.callback(changes);
      } catch (error) {
        console.warn('Filesystem change notification failed:', error);
      }
    }
  }

  /**
   * Cleanup and close watchers
   */
  async shutdown() {
    // Close all file watchers
    for (const [subscriptionId] of this._watchers) {
      this._stopFileWatcher(subscriptionId);
    }

    // Clear subscriptions
    this._subscriptions.clear();
    this._watchers.clear();

    // Clear cached data
    this._content = null;
    this._contentTimestamp = null;
    this._stats = null;
    this._metadata = null;
  }
}

/**
 * Filesystem-specific query builder
 */
class FileQueryBuilder {
  constructor(sourceHandle, dataSource) {
    this._sourceHandle = sourceHandle;
    this._dataSource = dataSource;
    this._operations = [];
    this._options = {};
  }

  /**
   * Find files by pattern
   * @param {string} pattern - Glob pattern
   * @returns {FileQueryBuilder} Query builder for chaining
   */
  pattern(pattern) {
    this._operations.push({ type: 'pattern', pattern });
    return this;
  }

  /**
   * Find files by name
   * @param {string} name - File name
   * @returns {FileQueryBuilder} Query builder for chaining
   */
  name(name) {
    this._operations.push({ type: 'name', name });
    return this;
  }

  /**
   * Filter by file type
   * @param {string} type - File type ('file' or 'directory')
   * @returns {FileQueryBuilder} Query builder for chaining
   */
  type(type) {
    this._operations.push({ type: 'fileType', fileType: type });
    return this;
  }

  /**
   * Include dotfiles in search
   * @param {boolean} include - Whether to include dotfiles
   * @returns {FileQueryBuilder} Query builder for chaining
   */
  includeDotFiles(include = true) {
    this._options.includeDotFiles = include;
    return this;
  }

  /**
   * Set ignore patterns
   * @param {Array<string>} patterns - Patterns to ignore
   * @returns {FileQueryBuilder} Query builder for chaining
   */
  ignore(patterns) {
    this._options.ignore = patterns;
    return this;
  }

  /**
   * Execute query and return first result
   * @returns {Promise<Handle>} Handle for first file
   */
  async first() {
    const querySpec = this._buildQuerySpec();
    const results = await this._dataSource.queryAsync(querySpec);
    return results.length > 0 ? this._createFileHandle(results[0]) : null;
  }

  /**
   * Execute query and return all results
   * @returns {Promise<Array<Handle>>} Array of file Handles
   */
  async toArray() {
    const querySpec = this._buildQuerySpec();
    const results = await this._dataSource.queryAsync(querySpec);
    
    return results.map(result => this._createFileHandle(result));
  }

  /**
   * Count matching files
   * @returns {Promise<number>} Count of matching files
   */
  async count() {
    const results = await this.toArray();
    return results.length;
  }

  /**
   * Build query specification from operations
   * @returns {Object} Query specification
   * @private
   */
  _buildQuerySpec() {
    if (this._operations.length === 0) {
      return { find: 'all', ...this._options };
    }

    // Find primary operation
    const patternOp = this._operations.find(op => op.type === 'pattern');
    const nameOp = this._operations.find(op => op.type === 'name');
    
    if (patternOp) {
      return {
        find: { pattern: patternOp.pattern },
        ...this._options
      };
    }
    
    if (nameOp) {
      return {
        find: { name: nameOp.name },
        ...this._options
      };
    }
    
    return { find: 'all', ...this._options };
  }

  /**
   * Create Handle for file
   * @param {Object} fileInfo - File information
   * @returns {Handle} File Handle
   * @private
   */
  _createFileHandle(fileInfo) {
    return {
      name: fileInfo.name,
      path: fileInfo.path,
      type: fileInfo.type,
      size: fileInfo.size,
      modified: fileInfo.modified,
      uri: `legion://local/filesystem/${fileInfo.path}`,
      
      // Handle-like methods
      async read(encoding = 'utf8') {
        const results = await this._dataSource.queryAsync({ read: { encoding } });
        return results.length > 0 ? results[0].content : null;
      },
      
      async write(content, options = {}) {
        return this._dataSource.updateAsync({
          write: { content, ...options }
        });
      },
      
      async delete() {
        return this._dataSource.updateAsync({
          delete: { force: true, recursive: fileInfo.type === 'directory' }
        });
      },
      
      toURI() {
        return `legion://local/filesystem/${fileInfo.path}`;
      }
    };
  }
}

export default FileDataSource;