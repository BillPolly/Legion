/**
 * FileHandle - Handle abstraction for filesystem files
 * 
 * Provides a consistent interface for file operations regardless of 
 * whether the ResourceManager is local (Node.js fs), remote (browser API), 
 * or indexed (search-enabled).
 * 
 * Key features:
 * - Read/write file content (text, binary, streams)
 * - Get/set file metadata (size, modified time, permissions, etc.)
 * - Watch for file changes
 * - Navigate to parent DirectoryHandle
 * - Works with any filesystem ResourceManager implementation
 */

import { Handle } from '@legion/handle';
import { HandleFactory } from './HandleFactory.js';

export class FileHandle extends Handle {
  constructor(resourceManager, path) {
    super(resourceManager);
    
    // Validate and store path
    if (!path || typeof path !== 'string') {
      throw new Error('File path is required and must be a string');
    }
    
    this.path = this._normalizePath(path);
    
    // Cache for file metadata
    this._metadataCache = null;
    this._metadataCacheExpiry = 0;
    this._metadataCacheTTL = 5000; // 5 second cache TTL
  }
  
  /**
   * Get file metadata and statistics
   * @param {boolean} fresh - Force fresh query, bypass cache
   * @returns {Object} File information (size, modified time, permissions, etc.)
   */
  value(fresh = false) {
    this._validateNotDestroyed();
    
    // Check cache first (unless fresh requested)
    if (!fresh && this._metadataCache && Date.now() < this._metadataCacheExpiry) {
      return this._metadataCache;
    }
    
    // Query ResourceManager for file metadata
    const querySpec = {
      find: ['metadata'],
      where: [['file', this.path, 'metadata']]
    };
    
    const results = this.resourceManager.query(querySpec);
    const metadata = Array.isArray(results) && results.length > 0 ? results[0] : {
      path: this.path,
      type: 'file',
      exists: false
    };
    
    // Update cache
    this._metadataCache = metadata;
    this._metadataCacheExpiry = Date.now() + this._metadataCacheTTL;
    
    return metadata;
  }
  
  /**
   * Check if file exists
   * @returns {boolean} True if file exists
   */
  exists() {
    this._validateNotDestroyed();
    
    const metadata = this.value();
    return metadata.exists === true;
  }
  
  /**
   * Get file size in bytes
   * @returns {number} File size in bytes, or 0 if file doesn't exist
   */
  size() {
    this._validateNotDestroyed();
    
    const metadata = this.value();
    return metadata.size || 0;
  }
  
  /**
   * Get file modification time
   * @returns {Date|null} Last modified date, or null if file doesn't exist
   */
  lastModified() {
    this._validateNotDestroyed();
    
    const metadata = this.value();
    return metadata.lastModified ? new Date(metadata.lastModified) : null;
  }
  
  /**
   * Read file content
   * @param {Object} options - Read options (encoding, offset, length, etc.)
   * @returns {string|Buffer|Uint8Array} File content in specified format
   */
  read(options = {}) {
    this._validateNotDestroyed();
    
    const querySpec = {
      find: ['content'],
      where: [['file', this.path, 'content']],
      options: {
        encoding: options.encoding || 'utf8',
        offset: options.offset || 0,
        length: options.length,
        ...options
      }
    };
    
    const results = this.resourceManager.query(querySpec);
    
    if (!Array.isArray(results) || results.length === 0) {
      throw new Error(`File not found: ${this.path}`);
    }
    
    return results[0];
  }
  
  /**
   * Read file content as text
   * @param {string} encoding - Text encoding (default: 'utf8')
   * @returns {string} File content as text
   */
  text(encoding = 'utf8') {
    this._validateNotDestroyed();
    
    return this.read({ encoding });
  }
  
  /**
   * Read file content as binary data
   * @returns {Buffer|Uint8Array} File content as binary data
   */
  binary() {
    this._validateNotDestroyed();
    
    return this.read({ encoding: null }); // null encoding returns binary
  }
  
  /**
   * Read file content as JSON
   * @returns {Object} Parsed JSON content
   */
  json() {
    this._validateNotDestroyed();
    
    const text = this.text();
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error(`Failed to parse JSON from ${this.path}: ${error.message}`);
    }
  }
  
  /**
   * Write content to file
   * @param {string|Buffer|Uint8Array} content - Content to write
   * @param {Object} options - Write options (encoding, append, permissions, etc.)
   * @returns {Object} Write result with success status
   */
  write(content, options = {}) {
    this._validateNotDestroyed();
    
    if (content === undefined || content === null) {
      throw new Error('Content to write cannot be null or undefined');
    }
    
    const result = this.resourceManager.update(this.path, {
      operation: 'write',
      content: content,
      options: {
        encoding: options.encoding || 'utf8',
        append: options.append || false,
        createParents: options.createParents !== false,
        permissions: options.permissions,
        ...options
      }
    });
    
    if (result.success) {
      // Invalidate metadata cache after successful write
      this._metadataCache = null;
      this._metadataCacheExpiry = 0;
    }
    
    return result;
  }
  
  /**
   * Append content to file
   * @param {string|Buffer|Uint8Array} content - Content to append
   * @param {Object} options - Append options (encoding, etc.)
   * @returns {Object} Write result with success status
   */
  append(content, options = {}) {
    this._validateNotDestroyed();
    
    return this.write(content, { ...options, append: true });
  }
  
  /**
   * Copy file to another location
   * @param {string} targetPath - Target file path
   * @param {Object} options - Copy options (overwrite, preserveMetadata, etc.)
   * @returns {FileHandle} FileHandle for the copied file
   */
  copy(targetPath, options = {}) {
    this._validateNotDestroyed();
    
    if (!targetPath || typeof targetPath !== 'string') {
      throw new Error('Target path must be a non-empty string');
    }
    
    const result = this.resourceManager.update(null, {
      operation: 'copy',
      source: this.path,
      target: targetPath,
      options: {
        overwrite: options.overwrite || false,
        preserveMetadata: options.preserveMetadata !== false,
        ...options
      }
    });
    
    if (!result.success) {
      throw new Error(`Failed to copy file: ${result.error || 'Unknown error'}`);
    }
    
    // Return FileHandle for the copied file
    return new FileHandle(this.resourceManager, targetPath);
  }
  
  /**
   * Move/rename file to another location
   * @param {string} targetPath - Target file path
   * @param {Object} options - Move options (overwrite, etc.)
   * @returns {FileHandle} FileHandle for the moved file
   */
  move(targetPath, options = {}) {
    this._validateNotDestroyed();
    
    if (!targetPath || typeof targetPath !== 'string') {
      throw new Error('Target path must be a non-empty string');
    }
    
    const result = this.resourceManager.update(this.path, {
      operation: 'move',
      target: targetPath,
      options: {
        overwrite: options.overwrite || false,
        ...options
      }
    });
    
    if (!result.success) {
      throw new Error(`Failed to move file: ${result.error || 'Unknown error'}`);
    }
    
    // Update this handle's path and invalidate cache
    this.path = this._normalizePath(targetPath);
    this._metadataCache = null;
    this._metadataCacheExpiry = 0;
    
    return this;
  }
  
  /**
   * Delete file
   * @param {Object} options - Deletion options (force, backup, etc.)
   * @returns {Object} Deletion result with success status
   */
  delete(options = {}) {
    this._validateNotDestroyed();
    
    const result = this.resourceManager.update(this.path, {
      operation: 'delete',
      options: options
    });
    
    if (result.success) {
      // Invalidate metadata cache after successful deletion
      this._metadataCache = null;
      this._metadataCacheExpiry = 0;
    }
    
    return result;
  }
  
  /**
   * Watch file for changes
   * @param {Function} callback - Callback function for change notifications
   * @param {Object} options - Watch options (content, metadata, etc.)
   * @returns {Object} Subscription object with unsubscribe method
   */
  watch(callback, options = {}) {
    this._validateNotDestroyed();
    
    if (typeof callback !== 'function') {
      throw new Error('Watch callback must be a function');
    }
    
    const querySpec = {
      find: ['event', 'data'],
      where: [
        ['file', this.path, 'change'],
        ['event', '?event'],
        ['data', '?data']
      ]
    };
    
    // Add options to control what changes to watch
    if (options.content !== false) querySpec.watchContent = true;
    if (options.metadata !== false) querySpec.watchMetadata = true;
    
    return this.resourceManager.subscribe(querySpec, (results) => {
      // Invalidate cache when file changes
      this._metadataCache = null;
      this._metadataCacheExpiry = 0;
      
      callback(results);
    });
  }
  
  /**
   * Get parent directory handle
   * @returns {DirectoryHandle} DirectoryHandle for the parent directory
   */
  parent() {
    this._validateNotDestroyed();
    
    const parentPath = this._getParentPath(this.path);
    
    // Use factory to avoid circular dependency
    return HandleFactory.createDirectoryHandle(this.resourceManager, parentPath);
  }
  
  /**
   * Get file name (without path)
   * @returns {string} File name
   */
  name() {
    this._validateNotDestroyed();
    
    const lastSlash = this.path.lastIndexOf('/');
    return lastSlash >= 0 ? this.path.substring(lastSlash + 1) : this.path;
  }
  
  /**
   * Get file extension
   * @returns {string} File extension (including dot), or empty string if no extension
   */
  extension() {
    this._validateNotDestroyed();
    
    const name = this.name();
    const lastDot = name.lastIndexOf('.');
    return lastDot > 0 ? name.substring(lastDot) : '';
  }
  
  /**
   * Get file name without extension
   * @returns {string} File name without extension
   */
  basename() {
    this._validateNotDestroyed();
    
    const name = this.name();
    const lastDot = name.lastIndexOf('.');
    return lastDot > 0 ? name.substring(0, lastDot) : name;
  }
  
  /**
   * Create a readable stream for the file
   * @param {Object} options - Stream options (encoding, start, end, etc.)
   * @returns {Object} Readable stream object
   */
  createReadStream(options = {}) {
    this._validateNotDestroyed();
    
    // This would be implemented by the specific ResourceManager
    // Here we provide a fallback that reads the entire file
    const querySpec = {
      find: ['stream'],
      where: [['file', this.path, 'readStream']],
      options: options
    };
    
    const results = this.resourceManager.query(querySpec);
    
    if (!Array.isArray(results) || results.length === 0) {
      throw new Error(`Cannot create read stream for: ${this.path}`);
    }
    
    return results[0];
  }
  
  /**
   * Create a writable stream for the file
   * @param {Object} options - Stream options (encoding, flags, etc.)
   * @returns {Object} Writable stream object
   */
  createWriteStream(options = {}) {
    this._validateNotDestroyed();
    
    // This would be implemented by the specific ResourceManager
    const querySpec = {
      find: ['stream'],
      where: [['file', this.path, 'writeStream']],
      options: options
    };
    
    const results = this.resourceManager.query(querySpec);
    
    if (!Array.isArray(results) || results.length === 0) {
      throw new Error(`Cannot create write stream for: ${this.path}`);
    }
    
    return results[0];
  }
  
  // Private helper methods
  
  _normalizePath(path) {
    if (!path || typeof path !== 'string') {
      throw new Error('File path must be a non-empty string');
    }
    
    // Normalize path separators
    let normalized = path.replace(/\\/g, '/');
    
    // Ensure path starts with / if it's absolute
    if (!normalized.startsWith('/') && !normalized.includes(':')) {
      normalized = '/' + normalized;
    }
    
    return normalized;
  }
  
  _getParentPath(path) {
    const normalized = this._normalizePath(path);
    const lastSlash = normalized.lastIndexOf('/');
    if (lastSlash <= 0) {
      return '/';
    }
    return normalized.substring(0, lastSlash);
  }
  
}