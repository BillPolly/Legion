/**
 * FileHandle - Handle implementation for filesystem resources
 * 
 * Provides Handle interface for accessing and manipulating files and directories.
 * Supports real-time updates via filesystem watchers and provides intuitive
 * file manipulation methods with comprehensive caching.
 * 
 * URI Examples:
 * - legion://local/filesystem/project/src/main.js
 * - legion://server/filesystem/workspace/config.json
 * - legion://prod/filesystem/logs/application.log
 */

import path from 'path';

export class FileHandle {
  constructor(dataSource, parsed) {
    if (!dataSource) {
      throw new Error('DataSource is required for FileHandle');
    }
    
    if (!parsed) {
      throw new Error('Parsed URI components are required for FileHandle');
    }

    this.dataSource = dataSource;
    this.parsed = parsed;
    this._destroyed = false;
    
    // Filesystem-specific properties from path
    this.filePath = parsed.path || '';
    this.server = parsed.server;
    this.resourceType = parsed.resourceType;
    
    // Handle type based on filesystem structure
    this.handleType = this._determineHandleType();
    
    // Cached file data
    this._content = null;
    this._stats = null;
    this._lastFetch = null;
    this._cacheTimeout = 5 * 60 * 1000; // 5 minutes
    
    // Create proxy for transparent property access
    return new Proxy(this, {
      get(target, prop, receiver) {
        // Handle methods and private properties directly
        if (prop in target || prop.startsWith('_') || typeof target[prop] === 'function') {
          return Reflect.get(target, prop, receiver);
        }
        
        // For file content access, delegate to getContent for text files
        if (typeof prop === 'string' && target.handleType === 'file') {
          // Special properties for file metadata
          if (prop === 'size') return target.getSize();
          if (prop === 'modified') return target.getModified();
          if (prop === 'created') return target.getCreated();
          if (prop === 'name') return target.getName();
          if (prop === 'extension') return target.getExtension();
        }
        
        return Reflect.get(target, prop, receiver);
      },
      
      set(target, prop, value) {
        // Don't allow setting private properties or methods
        if (prop.startsWith('_') || prop in target) {
          return Reflect.set(target, prop, value);
        }
        
        // For file content setting, delegate to write methods
        if (typeof prop === 'string' && target.handleType === 'file') {
          if (prop === 'content') {
            target.write(value);
            return true;
          }
        }
        
        return Reflect.set(target, prop, value);
      },
      
      has(target, prop) {
        // Check if it's a FileHandle property/method
        if (prop in target) {
          return true;
        }
        
        // For files, check standard file properties
        if (target.handleType === 'file') {
          const fileProps = ['size', 'modified', 'created', 'name', 'extension', 'content'];
          return fileProps.includes(prop);
        }
        
        return false;
      }
    });
  }

  /**
   * Read file content (for file handles)
   * @param {Object} options - Read options (encoding, etc.)
   * @returns {string|Buffer} File content
   */
  getContent(options = {}) {
    this._checkDestroyed();
    
    if (this.handleType !== 'file') {
      throw new Error('getContent() only available for file handles');
    }
    
    // Return cached content if available and recent
    if (this._content && this._isDataCacheValid()) {
      return this._content;
    }
    
    // For real-time access, we need async - provide sync access to cached data only
    if (!this._content) {
      throw new Error('No cached file content - use getContentAsync() for fresh data');
    }
    
    return this._content;
  }

  /**
   * Read file content asynchronously (always fresh)
   * @param {Object} options - Read options (encoding, etc.)
   * @returns {Promise<string|Buffer>} File content
   */
  async getContentAsync(options = {}) {
    this._checkDestroyed();
    
    if (this.handleType !== 'file') {
      throw new Error('getContentAsync() only available for file handles');
    }
    
    try {
      // Fetch fresh file content
      const results = await this.dataSource.queryAsync({
        read: options
      });
      
      if (results.length === 0) {
        throw new Error(`File not found: ${this.filePath}`);
      }
      
      // Update cache
      this._content = results[0].content;
      this._lastFetch = Date.now();
      
      return this._content;
      
    } catch (error) {
      throw new Error(`Failed to read file content: ${error.message}`);
    }
  }

  /**
   * Write content to file
   * @param {string|Buffer} content - Content to write
   * @param {Object} options - Write options (encoding, etc.)
   * @returns {Promise<Object>} Write result
   */
  async write(content, options = {}) {
    this._checkDestroyed();
    
    if (this.handleType !== 'file') {
      throw new Error('write() only available for file handles');
    }
    
    try {
      const result = await this.dataSource.updateAsync({
        write: { content, ...options }
      });
      
      // Update local cache
      this._content = content;
      this._lastFetch = Date.now();
      this._stats = null; // Invalidate stats cache
      
      return result;
      
    } catch (error) {
      throw new Error(`Failed to write file: ${error.message}`);
    }
  }

  /**
   * Append content to file
   * @param {string} content - Content to append
   * @param {Object} options - Append options (encoding, etc.)
   * @returns {Promise<Object>} Append result
   */
  async append(content, options = {}) {
    this._checkDestroyed();
    
    if (this.handleType !== 'file') {
      throw new Error('append() only available for file handles');
    }
    
    try {
      const result = await this.dataSource.updateAsync({
        append: { content, ...options }
      });
      
      // Invalidate content cache since file changed
      this._content = null;
      this._lastFetch = null;
      this._stats = null;
      
      return result;
      
    } catch (error) {
      throw new Error(`Failed to append to file: ${error.message}`);
    }
  }

  /**
   * Get file statistics
   * @returns {Object} File stats (size, modified, etc.)
   */
  getStats() {
    this._checkDestroyed();
    
    // Return cached stats if available and recent
    if (this._stats && this._isDataCacheValid()) {
      return this._stats;
    }
    
    if (!this._stats) {
      throw new Error('No cached file stats - use getStatsAsync() for fresh data');
    }
    
    return this._stats;
  }

  /**
   * Get file statistics asynchronously
   * @returns {Promise<Object>} File stats
   */
  async getStatsAsync() {
    this._checkDestroyed();
    
    try {
      const results = await this.dataSource.queryAsync({
        stats: true
      });
      
      if (results.length === 0) {
        throw new Error(`File not found: ${this.filePath}`);
      }
      
      // Update cache
      this._stats = results[0];
      this._lastFetch = Date.now();
      
      return this._stats;
      
    } catch (error) {
      throw new Error(`Failed to get file stats: ${error.message}`);
    }
  }

  /**
   * Get file size (sync from cache)
   * @returns {number|null} File size in bytes
   */
  getSize() {
    this._checkDestroyed();
    
    if (this._stats && this._isDataCacheValid()) {
      return this._stats.size;
    }
    return null;
  }

  /**
   * Get file modification time (sync from cache)
   * @returns {Date|null} Last modification time
   */
  getModified() {
    this._checkDestroyed();
    
    if (this._stats && this._isDataCacheValid()) {
      return this._stats.modified;
    }
    return null;
  }

  /**
   * Get file creation time (sync from cache)
   * @returns {Date|null} Creation time
   */
  getCreated() {
    this._checkDestroyed();
    
    if (this._stats && this._isDataCacheValid()) {
      return this._stats.created;
    }
    return null;
  }

  /**
   * Get file name
   * @returns {string} File or directory name
   */
  getName() {
    this._checkDestroyed();
    
    return path.basename(this.filePath);
  }

  /**
   * Get file extension
   * @returns {string} File extension (including dot)
   */
  getExtension() {
    this._checkDestroyed();
    
    if (this.handleType !== 'file') {
      return '';
    }
    
    return path.extname(this.filePath);
  }

  /**
   * Check if resource exists
   * @returns {Promise<boolean>} True if file/directory exists
   */
  async exists() {
    this._checkDestroyed();
    
    try {
      await this.getStatsAsync();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * List directory contents (for directory handles)
   * @param {Object} options - List options
   * @returns {Promise<Array>} Array of file/directory handles
   */
  async list(options = {}) {
    this._checkDestroyed();
    
    if (this.handleType !== 'directory') {
      throw new Error('list() only available for directory handles');
    }
    
    const results = await this.dataSource.queryAsync({
      find: 'all',
      ...options
    });
    
    // Convert results to file handles
    return results.map(result => this._createChildHandle(result));
  }

  /**
   * Find files matching pattern (for directory handles)
   * @param {string} pattern - Glob pattern
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Array of matching file handles
   */
  async find(pattern, options = {}) {
    this._checkDestroyed();
    
    if (this.handleType !== 'directory') {
      throw new Error('find() only available for directory handles');
    }
    
    const queryBuilder = this.dataSource.queryBuilder(this);
    const results = await queryBuilder.pattern(pattern).toArray();
    
    return results;
  }

  /**
   * Copy file or directory
   * @param {string} destination - Destination path
   * @param {Object} options - Copy options
   * @returns {Promise<FileHandle>} Handle for copied resource
   */
  async copy(destination, options = {}) {
    this._checkDestroyed();
    
    try {
      const result = await this.dataSource.updateAsync({
        copy: { destination, options }
      });
      
      if (result.success) {
        return this._createHandleFromPath(destination);
      }
      
      throw new Error('Copy operation failed');
      
    } catch (error) {
      throw new Error(`Failed to copy: ${error.message}`);
    }
  }

  /**
   * Move/rename file or directory
   * @param {string} destination - Destination path
   * @returns {Promise<FileHandle>} Handle for moved resource
   */
  async move(destination) {
    this._checkDestroyed();
    
    try {
      const result = await this.dataSource.updateAsync({
        move: { destination }
      });
      
      if (result.success) {
        // Update this handle's path
        this.filePath = destination;
        this.parsed.path = destination;
        
        // Invalidate caches
        this._content = null;
        this._stats = null;
        this._lastFetch = null;
        
        return this;
      }
      
      throw new Error('Move operation failed');
      
    } catch (error) {
      throw new Error(`Failed to move: ${error.message}`);
    }
  }

  /**
   * Delete file or directory
   * @param {Object} options - Delete options (recursive, force)
   * @returns {Promise<Object>} Delete result
   */
  async delete(options = {}) {
    this._checkDestroyed();
    
    try {
      const result = await this.dataSource.updateAsync({
        delete: options
      });
      
      // Mark as destroyed since file no longer exists
      this._destroyed = true;
      
      return result;
      
    } catch (error) {
      throw new Error(`Failed to delete: ${error.message}`);
    }
  }

  /**
   * Create directory (for directory handles)
   * @param {Object} options - Directory creation options
   * @returns {Promise<Object>} Creation result
   */
  async mkdir(options = {}) {
    this._checkDestroyed();
    
    try {
      const result = await this.dataSource.updateAsync({
        mkdir: options
      });
      
      // Update handle type since directory now exists
      this.handleType = 'directory';
      this._stats = null; // Invalidate stats cache
      
      return result;
      
    } catch (error) {
      throw new Error(`Failed to create directory: ${error.message}`);
    }
  }

  /**
   * Subscribe to file/directory changes
   * @param {Function} callback - Change notification callback
   * @param {Object} options - Subscription options
   * @returns {Object} Subscription object with unsubscribe method
   */
  subscribe(callback, options = {}) {
    this._checkDestroyed();
    
    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback function is required');
    }

    const querySpec = {
      watch: true,
      ...options
    };
      
    return this.dataSource.subscribe(querySpec, (changes) => {
      // Invalidate caches when changes occur
      this._content = null;
      this._stats = null;
      this._lastFetch = null;
      
      callback(changes);
    });
  }

  /**
   * Get Handle metadata
   * @returns {Object} Handle metadata
   */
  getMetadata() {
    this._checkDestroyed();
    
    const baseMetadata = this.dataSource.getMetadata();
    
    return {
      ...baseMetadata,
      handleType: this.handleType,
      filePath: this.filePath,
      name: this.getName(),
      extension: this.getExtension(),
      hasCachedContent: !!this._content,
      hasCachedStats: !!this._stats,
      cacheAge: this._lastFetch ? Date.now() - this._lastFetch : null
    };
  }

  /**
   * Get Handle schema
   * @returns {Object} Handle schema
   */
  getSchema() {
    this._checkDestroyed();
    return this.dataSource.getSchema();
  }

  /**
   * Create query builder
   * @returns {Object} Filesystem query builder
   */
  queryBuilder() {
    this._checkDestroyed();
    return this.dataSource.queryBuilder(this);
  }

  /**
   * Get URI for this filesystem resource
   * @returns {string} Legion URI
   */
  toURI() {
    return `legion://${this.server}/${this.resourceType}/${this.filePath}`;
  }

  /**
   * Create child Handle for nested resource
   * @param {string} childPath - Child resource path
   * @returns {FileHandle} Child filesystem Handle
   */
  child(childPath) {
    this._checkDestroyed();
    
    const fullChildPath = path.join(this.filePath, childPath);
    
    return this._createHandleFromPath(fullChildPath);
  }

  /**
   * Get parent Handle (if applicable)
   * @returns {FileHandle|null} Parent Handle or null if at root
   */
  parent() {
    this._checkDestroyed();
    
    const parentPath = path.dirname(this.filePath);
    
    if (parentPath === this.filePath || parentPath === '.') {
      return null; // At root
    }
    
    return this._createHandleFromPath(parentPath);
  }

  /**
   * Clone this Handle
   * @returns {FileHandle} Cloned Handle
   */
  clone() {
    this._checkDestroyed();
    return new FileHandle(this.dataSource, { ...this.parsed });
  }

  /**
   * Check if Handle is destroyed
   * @returns {boolean} True if destroyed
   */
  isDestroyed() {
    return this._destroyed;
  }

  /**
   * Destroy this Handle and cleanup resources
   */
  destroy() {
    if (this._destroyed) return;
    
    // Cleanup cached data
    this._content = null;
    this._stats = null;
    this._lastFetch = null;
    
    this._destroyed = true;
    this.dataSource = null;
    this.parsed = null;
  }

  /**
   * String representation
   * @returns {string} String representation
   */
  toString() {
    if (this._destroyed) {
      return '[FileHandle (destroyed)]';
    }
    
    return `[FileHandle (${this.handleType}): ${this.toURI()}]`;
  }

  /**
   * JSON representation
   * @returns {Object} JSON-serializable object
   */
  toJSON() {
    if (this._destroyed) {
      return { destroyed: true };
    }
    
    return {
      type: 'FileHandle',
      handleType: this.handleType,
      uri: this.toURI(),
      filePath: this.filePath,
      name: this.getName(),
      extension: this.getExtension(),
      server: this.server,
      hasCachedContent: !!this._content,
      hasCachedStats: !!this._stats
    };
  }

  // Private helper methods

  /**
   * Determine handle type from path
   * @returns {string} Handle type (file, directory, unknown)
   * @private
   */
  _determineHandleType() {
    // Try to determine from cached stats
    if (this._stats) {
      return this._stats.isDirectory ? 'directory' : 'file';
    }
    
    // Heuristic: if path has extension, likely a file
    const ext = path.extname(this.filePath);
    
    if (ext) {
      return 'file';
    }
    
    // Default to unknown - will be determined when stats are loaded
    return 'unknown';
  }

  /**
   * Check if cached data is still valid
   * @returns {boolean} True if cache is valid
   * @private
   */
  _isDataCacheValid() {
    if (!this._lastFetch) return false;
    return (Date.now() - this._lastFetch) < this._cacheTimeout;
  }

  /**
   * Create child handle from query result
   * @param {Object} result - Query result
   * @returns {FileHandle} Child handle
   * @private
   */
  _createChildHandle(result) {
    const childPath = result.path;
    return this._createHandleFromPath(childPath);
  }

  /**
   * Create handle from file path
   * @param {string} filePath - File path
   * @returns {FileHandle} File handle
   * @private
   */
  _createHandleFromPath(filePath) {
    const childParsed = {
      ...this.parsed,
      path: filePath
    };
    
    return new FileHandle(this.dataSource, childParsed);
  }

  /**
   * Check if Handle is destroyed and throw if so
   * @private
   */
  _checkDestroyed() {
    if (this._destroyed) {
      throw new Error('FileHandle has been destroyed');
    }
  }
}

export default FileHandle;