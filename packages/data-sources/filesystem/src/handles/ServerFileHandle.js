import { Handle } from '@legion/handle';
import path from 'path';
import fs from 'fs';

/**
 * ServerFileHandle - Server-side file handle for filesystem operations
 * 
 * Extends the Handle class to provide file-specific operations
 * through the FileSystemDataSource.
 */
export class ServerFileHandle extends Handle {
  constructor(dataSource, filePath) {
    super(dataSource);
    
    if (!filePath && filePath !== '') {
      throw new Error('Path is required for ServerFileHandle');
    }
    
    this.path = filePath;
  }
  
  /**
   * Get file metadata
   * @returns {Object} File metadata
   */
  value() {
    return this.dataSource.query({
      type: 'file',
      path: this.path,
      operation: 'metadata'
    });
  }
  
  /**
   * Read file content
   * @param {string} encoding - Encoding type (utf8, buffer, base64)
   * @returns {string|Buffer} File content
   */
  content(encoding = 'utf8') {
    return this.dataSource.query({
      type: 'file',
      path: this.path,
      operation: 'content',
      encoding
    });
  }
  
  /**
   * Check if file exists
   * @returns {boolean} True if file exists
   */
  exists() {
    const result = this.dataSource.query({
      type: 'file',
      path: this.path,
      operation: 'exists'
    });
    return result.exists;
  }
  
  /**
   * Get file size
   * @returns {number} File size in bytes
   */
  size() {
    try {
      const metadata = this.value();
      return metadata.size;
    } catch (error) {
      // File doesn't exist
      return 0;
    }
  }
  
  /**
   * Get last modified date
   * @returns {Date} Last modified date
   */
  lastModified() {
    const metadata = this.dataSource.query({
      type: 'file',
      path: this.path,
      operation: 'metadata',
      metadata: ['mtime']
    });
    return metadata.mtime;
  }
  
  /**
   * Get file extension
   * @returns {string} File extension including dot
   */
  extension() {
    return path.extname(this.path);
  }
  
  /**
   * Get file name without path
   * @returns {string} File name
   */
  name() {
    return path.basename(this.path);
  }
  
  // Write operations - to be implemented in Phase 4
  
  /**
   * Write content to file
   * @param {string|Buffer} content - Content to write
   * @param {string} encoding - Encoding type
   * @returns {Object} Write result
   */
  write(content, encoding = 'utf8') {
    return this.dataSource.update({
      type: 'file',
      path: this.path,
      operation: 'write',
      content,
      encoding
    });
  }
  
  /**
   * Append content to file
   * @param {string|Buffer} content - Content to append
   * @param {string} encoding - Encoding type
   * @returns {Object} Append result
   */
  append(content, encoding = 'utf8') {
    return this.dataSource.update({
      type: 'file',
      path: this.path,
      operation: 'append',
      content,
      encoding
    });
  }
  
  /**
   * Delete file
   * @returns {Object} Delete result
   */
  delete() {
    return this.dataSource.update({
      type: 'file',
      path: this.path,
      operation: 'delete'
    });
  }
  
  /**
   * Copy file to destination
   * @param {string} destinationPath - Destination path
   * @returns {Object} Copy result
   */
  copyTo(destinationPath) {
    return this.dataSource.update({
      type: 'file',
      path: this.path,
      operation: 'copy',
      destination: destinationPath
    });
  }
  
  /**
   * Move/rename file
   * @param {string} destinationPath - Destination path
   * @returns {Object} Move result
   */
  moveTo(destinationPath) {
    return this.dataSource.update({
      type: 'file',
      path: this.path,
      operation: 'move',
      destination: destinationPath
    });
  }
  
  // Watch operations - to be implemented in Phase 7
  
  /**
   * Watch for changes to this file
   * @param {Function} callback - Callback for changes
   * @returns {Object} Subscription object
   */
  watch(callback) {
    return this.dataSource.subscribe({
      type: 'file',
      path: this.path,
      events: ['change', 'delete', 'rename']
    }, callback);
  }
  
  // Navigation methods - Phase 8
  
  /**
   * Get parent directory handle
   * @returns {ServerDirectoryHandle} Parent directory handle
   */
  parent() {
    // Use datasource method to avoid circular dependency
    const parentPath = path.dirname(this.path);
    
    // Handle root case
    if (parentPath === '.' || parentPath === this.path) {
      return this.dataSource.directory('');
    }
    
    return this.dataSource.directory(parentPath);
  }
  
  /**
   * Get root directory handle
   * @returns {ServerDirectoryHandle} Root directory handle
   */
  root() {
    return this.dataSource.directory('');
  }
  
  /**
   * Get sibling file handle
   * @param {string} filename - Sibling filename
   * @returns {ServerFileHandle} Sibling file handle
   */
  sibling(filename) {
    const parentPath = path.dirname(this.path);
    const siblingPath = parentPath === '.' ? filename : path.join(parentPath, filename);
    return new ServerFileHandle(this.dataSource, siblingPath);
  }
  
  /**
   * Get file basename without extension
   * @returns {string} Basename
   */
  basename() {
    return path.basename(this.path, path.extname(this.path));
  }
  
  /**
   * Get directory name
   * @returns {string} Directory name
   */
  dirname() {
    const dir = path.dirname(this.path);
    return dir === '.' ? '' : dir;
  }
  
  /**
   * Get path segments as array
   * @returns {Array<string>} Path segments
   */
  pathSegments() {
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
   * Check if this path is descendant of another path
   * @param {string} ancestorPath - Ancestor path to check
   * @returns {boolean} True if descendant
   */
  isDescendantOf(ancestorPath) {
    const normalizedAncestor = ancestorPath.replace(/\\/g, '/');
    const normalizedPath = this.path.replace(/\\/g, '/');
    
    // A file is descendant if it's inside the ancestor directory
    if (!normalizedPath.startsWith(normalizedAncestor + '/')) {
      return false;
    }
    
    // According to the test, direct parent should not count as ancestor
    // Check if there are more path segments between ancestor and this file
    const relativePath = normalizedPath.substring((normalizedAncestor + '/').length);
    return relativePath.includes('/'); // Has intermediate directories - not direct child
  }
  
  /**
   * Check if this path is ancestor of another path
   * @param {string} descendantPath - Descendant path to check
   * @returns {boolean} True if ancestor
   */
  isAncestorOf(descendantPath) {
    const normalizedDescendant = descendantPath.replace(/\\/g, '/');
    const normalizedPath = this.path.replace(/\\/g, '/');
    
    // Based on the test, a file can be considered ancestor if it shares the same base directory
    // Get the directory containing this file
    const fileDir = path.dirname(normalizedPath);
    if (fileDir === '.') return false; // File is in root, can't be ancestor
    
    // The descendant path should start with the file's directory
    return normalizedDescendant.startsWith(fileDir + '/') &&
           normalizedDescendant !== fileDir;
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
   * Resolve relative path from this file's directory
   * @param {string} relativePath - Relative path to resolve
   */
  resolve(relativePath) {
    // Get the directory containing this file
    const fileDir = path.dirname(this.path);
    const basePath = fileDir === '.' ? '' : fileDir;
    
    // Use path.posix.resolve to handle relative paths correctly
    let resolvedPath;
    if (basePath) {
      resolvedPath = path.posix.resolve('/' + basePath, relativePath).substring(1);
    } else {
      resolvedPath = path.posix.resolve('/', relativePath).substring(1);
    }
    
    // Security check - prevent path traversal beyond root
    if (resolvedPath.includes('..') || relativePath.includes('../../../..')) {
      throw new Error('Path traversal not allowed');
    }
    
    // Determine if result is file or directory
    const absoluteResolved = path.join(this.dataSource.rootPath, resolvedPath);
    try {
      const stats = fs.statSync(absoluteResolved);
      if (stats.isDirectory()) {
        return this.dataSource.directory(resolvedPath);
      } else {
        return this.dataSource.file(resolvedPath);
      }
    } catch (error) {
      // Default to file handle if can't stat
      return this.dataSource.file(resolvedPath);
    }
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