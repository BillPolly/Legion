import { Handle } from '@legion/handle';
import { ServerFileHandle } from './ServerFileHandle.js';
import path from 'path';

/**
 * ServerDirectoryHandle - Server-side directory handle for filesystem operations
 * 
 * Extends the Handle class to provide directory-specific operations
 * through the FileSystemDataSource.
 */
export class ServerDirectoryHandle extends Handle {
  constructor(dataSource, dirPath = '') {
    super(dataSource);
    this.path = dirPath;
  }
  
  /**
   * Get directory metadata
   * @returns {Object} Directory metadata
   */
  value() {
    return this.dataSource.query({
      type: 'directory',
      path: this.path,
      operation: 'metadata'
    });
  }
  
  /**
   * List directory contents
   * @param {Object} options - List options (filter, sort, etc.)
   * @returns {Array} Directory entries
   */
  list(options = {}) {
    return this.dataSource.query({
      type: 'directory',
      path: this.path,
      operation: 'list',
      ...options
    });
  }
  
  /**
   * Get file handle for a file in this directory
   * @param {string} filename - File name or relative path
   * @returns {ServerFileHandle} File handle
   */
  file(filename) {
    const filePath = this.path ? path.join(this.path, filename) : filename;
    return this.dataSource.file(filePath);
  }
  
  /**
   * Get subdirectory handle
   * @param {string} dirname - Directory name or relative path
   * @returns {ServerDirectoryHandle} Directory handle
   */
  directory(dirname) {
    const dirPath = this.path ? path.join(this.path, dirname) : dirname;
    return this.dataSource.directory(dirPath);
  }
  
  /**
   * Check if directory exists
   * @returns {boolean} True if directory exists
   */
  exists() {
    const result = this.dataSource.query({
      type: 'directory',
      path: this.path,
      operation: 'exists'
    });
    return result.exists;
  }
  
  /**
   * Check if directory is empty
   * @returns {boolean} True if directory is empty
   */
  isEmpty() {
    const entries = this.list();
    return entries.length === 0;
  }
  
  /**
   * Get directory name without path
   * @returns {string} Directory name
   */
  name() {
    if (!this.path) {
      // Root directory - return the basename of the root path
      return path.basename(this.dataSource.rootPath);
    }
    return path.basename(this.path);
  }
  
  /**
   * Get parent directory path
   * @returns {string} Parent directory path
   */
  dirname() {
    // Get the absolute path from the root
    const absolutePath = path.join(this.dataSource.rootPath, this.path || '');
    return path.dirname(absolutePath);
  }
  
  /**
   * Count entries in directory
   * @param {Object} filter - Optional filter
   * @returns {number} Number of entries
   */
  count(filter = {}) {
    const entries = this.list({ filter });
    return entries.length;
  }
  
  /**
   * Get all files recursively (to be fully implemented in Phase 5)
   * @param {Object} options - Options for recursive listing
   * @returns {Array} All files
   */
  getAllFiles(options = {}) {
    // Basic implementation for Phase 3
    const entries = this.list({ filter: { type: 'file' } });
    return entries;
  }
  
  /**
   * Get all directories recursively (to be fully implemented in Phase 5)
   * @param {Object} options - Options for recursive listing
   * @returns {Array} All directories
   */
  getAllDirectories(options = {}) {
    // Basic implementation for Phase 3
    const entries = this.list({ filter: { type: 'directory' } });
    return entries;
  }
  
  // Search operations - to be implemented in Phase 5
  
  /**
   * Search directory recursively
   * @param {string} pattern - Search pattern (glob or regex)
   * @param {Object} options - Search options
   * @returns {Array} Search results
   */
  search(pattern, options = {}) {
    return this.dataSource.query({
      type: 'directory',
      path: this.path,
      operation: 'search',
      pattern: options.regex ? 'regex' : 'glob',
      value: pattern,
      recursive: options.recursive !== false,
      depth: options.depth,
      filter: options.filter
    });
  }
  
  /**
   * Find files by content
   * @param {string} searchString - String to search for
   * @param {Object} options - Search options
   * @returns {Array} Files containing the search string
   */
  findByContent(searchString, options = {}) {
    return this.dataSource.query({
      type: 'directory',
      path: this.path,
      operation: 'search',
      pattern: 'content',
      value: searchString,
      recursive: options.recursive !== false,
      filter: options.filter
    });
  }
  
  // Write operations - to be implemented in Phase 4
  
  /**
   * Create subdirectory
   * @param {string} dirname - Directory name
   * @returns {Object} Creation result
   */
  createDirectory(dirname) {
    return this.dataSource.update({
      type: 'directory',
      path: this.path ? path.join(this.path, dirname) : dirname,
      operation: 'create'
    });
  }
  
  /**
   * Create file in this directory
   * @param {string} filename - File name
   * @param {string|Buffer} content - Initial content
   * @param {string} encoding - Content encoding
   * @returns {Object} Creation result
   */
  createFile(filename, content = '', encoding = 'utf8') {
    return this.dataSource.update({
      type: 'file',
      path: this.path ? path.join(this.path, filename) : filename,
      operation: 'create',
      content,
      encoding
    });
  }
  
  /**
   * Delete directory
   * @param {boolean} recursive - Delete recursively
   * @returns {Object} Delete result
   */
  delete(recursive = false) {
    return this.dataSource.update({
      type: 'directory',
      path: this.path,
      operation: 'delete',
      recursive
    });
  }
  
  /**
   * Copy directory to destination
   * @param {string} destinationPath - Destination path
   * @returns {Object} Copy result
   */
  copyTo(destinationPath) {
    return this.dataSource.update({
      type: 'directory',
      path: this.path,
      operation: 'copy',
      destination: destinationPath
    });
  }
  
  /**
   * Move/rename directory
   * @param {string} destinationPath - Destination path
   * @returns {Object} Move result
   */
  moveTo(destinationPath) {
    return this.dataSource.update({
      type: 'directory',
      path: this.path,
      operation: 'move',
      destination: destinationPath
    });
  }
  
  // Watch operations - to be implemented in Phase 7
  
  /**
   * Watch for changes in this directory
   * @param {Function} callback - Callback for changes
   * @param {Object} options - Watch options
   * @returns {Object} Subscription object
   */
  watch(callback, options = {}) {
    return this.dataSource.subscribe({
      type: 'directory',
      path: this.path,
      events: ['add', 'change', 'delete', 'rename'],
      recursive: options.recursive
    }, callback);
  }
  
  // Navigation methods - Phase 8
  
  /**
   * Get parent directory handle
   * @returns {ServerDirectoryHandle|null} Parent directory handle or null if root
   */
  parent() {
    // Root directory has no parent
    if (!this.path) {
      return null;
    }
    
    const parentPath = path.dirname(this.path);
    
    // Handle root case
    if (parentPath === '.' || parentPath === this.path) {
      return new ServerDirectoryHandle(this.dataSource, '');
    }
    
    return new ServerDirectoryHandle(this.dataSource, parentPath);
  }
  
  /**
   * Get root directory handle
   * @returns {ServerDirectoryHandle} Root directory handle
   */
  root() {
    return new ServerDirectoryHandle(this.dataSource, '');
  }
  
  /**
   * Get child directory by name
   * @param {string} childName - Child directory name
   * @returns {ServerDirectoryHandle} Child directory handle
   */
  child(childName) {
    const childPath = this.path ? path.join(this.path, childName) : childName;
    return new ServerDirectoryHandle(this.dataSource, childPath);
  }
  
  /**
   * Get all child directory handles
   * @returns {Array<ServerDirectoryHandle>} Child directory handles
   */
  children() {
    try {
      const entries = this.list({ filter: { type: 'directory' } });
      return entries.map(entry => {
        const childPath = this.path ? path.join(this.path, entry.name) : entry.name;
        return new ServerDirectoryHandle(this.dataSource, childPath);
      });
    } catch (error) {
      // Directory doesn't exist or other error
      return [];
    }
  }
  
  /**
   * Get descendant by relative path
   * @param {string} relativePath - Relative path to descendant
   * @returns {ServerDirectoryHandle} Descendant directory handle
   */
  descendant(relativePath) {
    const descendantPath = this.path ? path.join(this.path, relativePath) : relativePath;
    return new ServerDirectoryHandle(this.dataSource, descendantPath);
  }
  
  /**
   * Get all descendants recursively
   * @returns {Array<ServerDirectoryHandle>} All descendant directory handles
   */
  descendants() {
    try {
      const allEntries = this.search('**/*', { recursive: true, filter: { type: 'directory' } });
      return allEntries.map(entry => {
        // Search returns entries with 'relativePath' property relative to this directory
        const entryPath = entry.relativePath || entry.path || '';
        // Need to prepend this directory's path to make it absolute from dataSource root
        const absolutePath = this.path ? path.join(this.path, entryPath) : entryPath;
        return this.dataSource.directory(absolutePath);
      });
    } catch (error) {
      return [];
    }
  }
  
  /**
   * Get all ancestors up to root
   * @returns {Array<ServerDirectoryHandle>} Ancestor directory handles
   */
  ancestors() {
    const ancestors = [];
    let current = this.parent();
    
    while (current) {
      ancestors.push(current);
      current = current.parent();
    }
    
    return ancestors;
  }
  
  /**
   * Find common ancestor with another directory
   * @param {ServerDirectoryHandle} other - Other directory handle
   * @returns {ServerDirectoryHandle} Common ancestor handle
   */
  commonAncestor(other) {
    const thisSegments = this.pathSegments();
    const otherSegments = other.pathSegments();
    
    // If one path is a direct ancestor of the other, find their parent
    if (this.path === other.path) {
      // Same directory - return parent
      return this.parent() || this.dataSource.directory('');
    }
    
    // Check if one is ancestor of the other
    if (other.path.startsWith(this.path + '/')) {
      // other is descendant of this - return this directory's parent
      return this.parent() || this.dataSource.directory('');
    }
    
    if (this.path.startsWith(other.path + '/')) {
      // this is descendant of other - return other directory's parent  
      return other.parent() || this.dataSource.directory('');
    }
    
    // Find common path segments
    const commonSegments = [];
    const minLength = Math.min(thisSegments.length, otherSegments.length);
    
    for (let i = 0; i < minLength; i++) {
      if (thisSegments[i] === otherSegments[i]) {
        commonSegments.push(thisSegments[i]);
      } else {
        break;
      }
    }
    
    const commonPath = commonSegments.join('/');
    return this.dataSource.directory(commonPath);
  }
  
  /**
   * Calculate path distance to another directory
   * @param {ServerDirectoryHandle} other - Other directory handle
   * @returns {number} Path distance
   */
  pathDistance(other) {
    const thisDepth = this.depth();
    const otherDepth = other.depth();
    return Math.abs(thisDepth - otherDepth);
  }
  
  /**
   * Get path segments as array
   * @returns {Array<string>} Path segments
   */
  pathSegments() {
    if (!this.path) {
      return [];
    }
    return this.path.split('/').filter(segment => segment.length > 0);
  }
  
  /**
   * Get depth from root
   * @returns {number} Depth level
   */
  depth() {
    return this.pathSegments().length;
  }
  
  /**
   * Resolve relative path from this directory
   * @param {string} relativePath - Relative path to resolve
   * @returns {ServerDirectoryHandle} Resolved directory handle
   */
  resolve(relativePath) {
    // Start from this directory's path, or empty string for root
    const basePath = this.path || '';
    
    // Use path.posix.resolve to handle relative paths correctly
    let resolvedPath;
    if (basePath) {
      resolvedPath = path.posix.resolve('/' + basePath, relativePath).substring(1);
    } else {
      resolvedPath = path.posix.resolve('/', relativePath).substring(1);
    }
    
    // Security check - prevent path traversal beyond root
    const normalizedPath = path.normalize(resolvedPath);
    if (normalizedPath.startsWith('..') || normalizedPath.includes('../') || resolvedPath.startsWith('../')) {
      throw new Error('Path traversal not allowed');
    }
    
    return this.dataSource.directory(resolvedPath);
  }
  
  /**
   * Join paths to create descendant handle
   * @param {...string} pathSegments - Path segments to join
   * @returns {ServerDirectoryHandle} Joined path handle
   */
  join(...pathSegments) {
    const joinedPath = this.path ? path.join(this.path, ...pathSegments) : path.join(...pathSegments);
    return new ServerDirectoryHandle(this.dataSource, joinedPath);
  }
  
  /**
   * Normalize path
   * @returns {ServerDirectoryHandle} Normalized path handle
   */
  normalize() {
    const normalizedPath = path.normalize(this.path || '').replace(/\\/g, '/');
    return new ServerDirectoryHandle(this.dataSource, normalizedPath);
  }
  
  /**
   * Find paths by pattern
   * @param {string|RegExp} pattern - Glob pattern or regex
   * @returns {Array<Handle>} Matching handles
   */
  find(pattern) {
    try {
      const results = this.search(pattern, { recursive: true });
      return results.map(result => {
        // Search returns entries with 'relativePath' property
        const resultPath = result.relativePath || result.path || result.name || '';
        if (result.stats && result.stats.isFile) {
          return this.dataSource.file(resultPath);
        } else {
          return this.dataSource.directory(resultPath);
        }
      });
    } catch (error) {
      return [];
    }
  }
  
  /**
   * Check if this path is descendant of another path
   * @param {string} ancestorPath - Ancestor path to check
   * @returns {boolean} True if descendant
   */
  isDescendantOf(ancestorPath) {
    const normalizedAncestor = ancestorPath.replace(/\\/g, '/');
    const normalizedPath = this.path.replace(/\\/g, '/');
    
    // A directory is descendant if it's inside the ancestor directory
    return normalizedPath.startsWith(normalizedAncestor + '/') && 
           normalizedPath !== normalizedAncestor;
  }
  
  /**
   * Check if this path is ancestor of another path
   * @param {string} descendantPath - Descendant path to check
   * @returns {boolean} True if ancestor
   */
  isAncestorOf(descendantPath) {
    const normalizedDescendant = descendantPath.replace(/\\/g, '/');
    const normalizedPath = this.path.replace(/\\/g, '/');
    
    // A directory is ancestor if the descendant is inside this directory
    return normalizedDescendant.startsWith(normalizedPath + '/') &&
           normalizedDescendant !== normalizedPath;
  }
  
  /**
   * Get relative path from another path
   * @param {string} fromPath - Path to calculate relative from
   * @returns {string} Relative path
   */
  relativeTo(fromPath) {
    return path.relative(fromPath, this.path);
  }
  
  /**
   * Get absolute filesystem path
   * @returns {string} Absolute path
   */
  absolutePath() {
    return path.join(this.dataSource.rootPath, this.path);
  }
  
  /**
   * Check if path matches a pattern
   * @param {string|RegExp} pattern - Glob pattern or regex
   * @returns {boolean} True if matches
   */
  matches(pattern) {
    if (pattern instanceof RegExp) {
      return pattern.test(this.path);
    } else {
      // Simple glob matching - handle ** first, then * and ?
      let escapedPattern = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape regex special chars
        .replace(/\*\*/g, '__DOUBLE_STAR__')      // Temporarily replace **
        .replace(/\*/g, '__SINGLE_STAR__')       // Temporarily replace *
        .replace(/\?/g, '__QUESTION__');         // Temporarily replace ?
      
      // Now safely replace the placeholders
      escapedPattern = escapedPattern
        .replace(/__DOUBLE_STAR__/g, '.*')       // ** becomes .*
        .replace(/__SINGLE_STAR__/g, '[^/]*')    // * becomes [^/]*
        .replace(/__QUESTION__/g, '.');          // ? becomes .
      
      return new RegExp('^' + escapedPattern + '$').test(this.path);
    }
  }
}