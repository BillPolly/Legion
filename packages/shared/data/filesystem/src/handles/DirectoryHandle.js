/**
 * DirectoryHandle - Handle abstraction for filesystem directories
 * 
 * Provides a consistent interface for directory operations regardless of 
 * whether the ResourceManager is local (Node.js fs), remote (browser API), 
 * or indexed (search-enabled).
 * 
 * Key features:
 * - List directory contents (files and subdirectories)
 * - Create/delete files and subdirectories
 * - Search for files by name/metadata (if ResourceManager supports it)
 * - Navigate to child DirectoryHandle or FileHandle instances
 * - Works with any filesystem ResourceManager implementation
 */

import { Handle } from '@legion/handle';
import { HandleFactory } from './HandleFactory.js';

export class DirectoryHandle extends Handle {
  constructor(resourceManager, path = '/') {
    super(resourceManager);
    
    // Validate and normalize path
    this.path = this._normalizePath(path);
    
    // Cache for child handles
    this._childHandles = new Map();
  }
  
  /**
   * Get directory metadata and statistics
   * @returns {Object} Directory information (size, modified time, permissions, etc.)
   */
  value() {
    this._validateNotDestroyed();
    
    // Query ResourceManager for directory metadata
    const querySpec = {
      find: ['metadata'],
      where: [['directory', this.path, 'metadata']]
    };
    
    const results = this.resourceManager.query(querySpec);
    return Array.isArray(results) && results.length > 0 ? results[0] : {
      path: this.path,
      type: 'directory',
      exists: false
    };
  }
  
  /**
   * List directory contents
   * @param {Object} options - Listing options (recursive, filter, etc.)
   * @returns {Array} Array of file/directory information objects
   */
  list(options = {}) {
    this._validateNotDestroyed();
    
    const querySpec = {
      find: ['name', 'type', 'metadata'],
      where: [
        ['parent', this.path],
        ['name', '?name'],
        ['type', '?type'],
        ['metadata', '?metadata']
      ]
    };
    
    // Add recursive option if requested
    if (options.recursive) {
      querySpec.recursive = true;
    }
    
    // Add filter if provided
    if (options.filter) {
      querySpec.filter = options.filter;
    }
    
    return this.resourceManager.query(querySpec);
  }
  
  /**
   * Get child file handle
   * @param {string} filename - Name of the file
   * @returns {FileHandle} FileHandle instance for the specified file
   */
  file(filename) {
    this._validateNotDestroyed();
    this._validateFilename(filename);
    
    const childPath = this._joinPath(this.path, filename);
    const cacheKey = `file:${childPath}`;
    
    // Check cache first
    if (this._childHandles.has(cacheKey)) {
      return this._childHandles.get(cacheKey);
    }
    
    // Create new FileHandle using factory to avoid circular dependency
    const fileHandle = HandleFactory.createFileHandle(this.resourceManager, childPath);
    
    // Cache the handle
    this._childHandles.set(cacheKey, fileHandle);
    
    return fileHandle;
  }
  
  /**
   * Get child directory handle
   * @param {string} dirname - Name of the subdirectory
   * @returns {DirectoryHandle} DirectoryHandle instance for the specified subdirectory
   */
  directory(dirname) {
    this._validateNotDestroyed();
    this._validateFilename(dirname);
    
    const childPath = this._joinPath(this.path, dirname);
    const cacheKey = `dir:${childPath}`;
    
    // Check cache first
    if (this._childHandles.has(cacheKey)) {
      return this._childHandles.get(cacheKey);
    }
    
    // Create new DirectoryHandle
    const dirHandle = new DirectoryHandle(this.resourceManager, childPath);
    
    // Cache the handle
    this._childHandles.set(cacheKey, dirHandle);
    
    return dirHandle;
  }
  
  /**
   * Create a new file in this directory
   * @param {string} filename - Name of the file to create
   * @param {string|Buffer|Uint8Array} content - Initial file content
   * @param {Object} options - Creation options (overwrite, permissions, etc.)
   * @returns {FileHandle} FileHandle for the created file
   */
  createFile(filename, content = '', options = {}) {
    this._validateNotDestroyed();
    this._validateFilename(filename);
    
    const filePath = this._joinPath(this.path, filename);
    
    // Use ResourceManager to create the file
    const result = this.resourceManager.update(null, {
      type: 'file',
      path: filePath,
      content: content,
      options: options
    });
    
    if (!result.success) {
      throw new Error(`Failed to create file: ${result.error || 'Unknown error'}`);
    }
    
    // Return FileHandle for the created file
    return this.file(filename);
  }
  
  /**
   * Create a new subdirectory
   * @param {string} dirname - Name of the directory to create
   * @param {Object} options - Creation options (recursive, permissions, etc.)
   * @returns {DirectoryHandle} DirectoryHandle for the created directory
   */
  createDirectory(dirname, options = {}) {
    this._validateNotDestroyed();
    this._validateFilename(dirname);
    
    const dirPath = this._joinPath(this.path, dirname);
    
    // Use ResourceManager to create the directory
    const result = this.resourceManager.update(null, {
      type: 'directory',
      path: dirPath,
      options: options
    });
    
    if (!result.success) {
      throw new Error(`Failed to create directory: ${result.error || 'Unknown error'}`);
    }
    
    // Return DirectoryHandle for the created directory
    return this.directory(dirname);
  }
  
  /**
   * Delete a file or directory
   * @param {string} name - Name of the file/directory to delete
   * @param {Object} options - Deletion options (recursive, force, etc.)
   * @returns {Object} Deletion result
   */
  delete(name, options = {}) {
    this._validateNotDestroyed();
    this._validateFilename(name);
    
    const targetPath = this._joinPath(this.path, name);
    
    // Remove from cache if present
    this._childHandles.delete(`file:${targetPath}`);
    this._childHandles.delete(`dir:${targetPath}`);
    
    // Use ResourceManager to perform deletion
    const result = this.resourceManager.update(targetPath, {
      operation: 'delete',
      options: options
    });
    
    return result;
  }
  
  /**
   * Search for files in this directory and subdirectories
   * @param {string|Object} query - Search query (string for name, object for complex queries)
   * @param {Object} options - Search options (recursive, limit, etc.)
   * @returns {Array} Array of matching file/directory information
   */
  search(query, options = {}) {
    this._validateNotDestroyed();
    
    let querySpec;
    
    if (typeof query === 'string') {
      // Simple name-based search
      querySpec = {
        find: ['path', 'name', 'type', 'metadata'],
        where: [
          ['parent', this.path],
          ['name', 'matches', query],
          ['path', '?path'],
          ['type', '?type'],
          ['metadata', '?metadata']
        ]
      };
    } else if (typeof query === 'object') {
      // Complex query object
      querySpec = {
        find: ['path', 'name', 'type', 'metadata'],
        where: [
          ['parent', this.path],
          ...this._buildSearchWhere(query)
        ]
      };
    } else {
      throw new Error('Search query must be a string or object');
    }
    
    // Add search options
    if (options.recursive) {
      querySpec.recursive = true;
    }
    
    if (options.limit) {
      querySpec.limit = options.limit;
    }
    
    return this.resourceManager.query(querySpec);
  }
  
  /**
   * Watch directory for changes
   * @param {Function} callback - Callback function for change notifications
   * @param {Object} options - Watch options (recursive, filter, etc.)
   * @returns {Object} Subscription object with unsubscribe method
   */
  watch(callback, options = {}) {
    this._validateNotDestroyed();
    
    if (typeof callback !== 'function') {
      throw new Error('Watch callback must be a function');
    }
    
    const querySpec = {
      find: ['path', 'event', 'metadata'],
      where: [
        ['parent', this.path],
        ['event', '?event'],
        ['path', '?path'],
        ['metadata', '?metadata']
      ]
    };
    
    if (options.recursive) {
      querySpec.recursive = true;
    }
    
    return this.resourceManager.subscribe(querySpec, callback);
  }
  
  /**
   * Get parent directory handle
   * @returns {DirectoryHandle|null} Parent DirectoryHandle or null if at root
   */
  parent() {
    this._validateNotDestroyed();
    
    if (this.path === '/' || this.path === '') {
      return null; // Already at root
    }
    
    const parentPath = this._getParentPath(this.path);
    return new DirectoryHandle(this.resourceManager, parentPath);
  }
  
  /**
   * Override Handle's destroy method to clean up child handles
   */
  destroy() {
    if (this._destroyed) {
      return;
    }
    
    // Clean up cached child handles
    for (const childHandle of this._childHandles.values()) {
      if (typeof childHandle.destroy === 'function') {
        childHandle.destroy();
      }
    }
    this._childHandles.clear();
    
    // Call parent cleanup
    super.destroy();
  }
  
  // Private helper methods
  
  _normalizePath(path) {
    if (!path || typeof path !== 'string') {
      return '/';
    }
    
    // Normalize path separators and remove trailing slashes
    let normalized = path.replace(/\\/g, '/');
    if (normalized !== '/' && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    
    // Ensure path starts with /
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }
    
    return normalized;
  }
  
  _validateFilename(filename) {
    if (!filename || typeof filename !== 'string') {
      throw new Error('Filename must be a non-empty string');
    }
    
    // Check for invalid characters
    if (filename.includes('/') || filename.includes('\\')) {
      throw new Error('Filename cannot contain path separators');
    }
    
    if (filename === '.' || filename === '..') {
      throw new Error('Filename cannot be . or ..');
    }
  }
  
  _joinPath(basePath, name) {
    const normalized = this._normalizePath(basePath);
    if (normalized === '/') {
      return '/' + name;
    }
    return normalized + '/' + name;
  }
  
  _getParentPath(path) {
    const normalized = this._normalizePath(path);
    const lastSlash = normalized.lastIndexOf('/');
    if (lastSlash <= 0) {
      return '/';
    }
    return normalized.substring(0, lastSlash);
  }
  
  _buildSearchWhere(query) {
    const where = [];
    
    // Convert query object to where clauses
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === 'string' && value.includes('*')) {
        // Wildcard pattern
        where.push([key, 'matches', value]);
      } else {
        // Exact match
        where.push([key, value]);
      }
    }
    
    return where;
  }
  
}