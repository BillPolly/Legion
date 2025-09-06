/**
 * FileHandle - Specialized handle for file operations
 * 
 * Extends BaseHandle to provide file-specific operations with caching,
 * event emission, and transparent remote access.
 */

import { BaseHandle } from '../BaseHandle.js';
import { TypeHandleRegistry } from '../TypeHandleRegistry.js';
import path from 'path';

export class FileHandle extends BaseHandle {
  constructor(filePath, fileSystem) {
    super('FileHandle', { path: filePath });
    
    this._validateFileSystem(fileSystem);
    
    this.fileSystem = fileSystem;
    
    // Set file-specific attributes
    this.setAttribute('path', filePath);
    this.setAttribute('extension', path.extname(filePath));
    
    // Auto-register type if not already registered
    this._ensureTypeRegistered();
  }

  /**
   * Read file content (cacheable operation)
   * @returns {Promise<string>} File content
   */
  async read() {
    const result = await this.callMethod('read', []);
    return result;
  }

  /**
   * Write content to file (state-changing operation)
   * @param {string} content - Content to write
   * @returns {Promise<boolean>} Success status
   */
  async write(content) {
    const result = await this.callMethod('write', [content]);
    return result;
  }

  /**
   * Get file statistics (cacheable operation)
   * @returns {Promise<Object>} File stats
   */
  async stat() {
    const result = await this.callMethod('stat', []);
    return result;
  }

  /**
   * Watch file for changes
   * @param {Function} callback - Change callback
   * @returns {Promise<Object>} Watcher object
   */
  async watch(callback) {
    const result = await this.callMethod('watch', [callback]);
    return result;
  }

  /**
   * Delete file (state-changing operation)
   * @returns {Promise<boolean>} Success status
   */
  async delete() {
    const result = await this.callMethod('delete', []);
    return result;
  }

  /**
   * Computed size attribute
   * @returns {Promise<number>} File size in bytes
   */
  get size() {
    return this.stat().then(stats => stats.size);
  }

  // Internal implementation methods (prefixed with _)

  async _read() {
    return await this.fileSystem.readFile(this.data.path, 'utf8');
  }

  async _write(content) {
    await this.fileSystem.writeFile(this.data.path, content, 'utf8');
    // Invalidate read cache since content changed
    this.invalidateCache('method:read');
    // Content will be emitted as side effect by callMethod
    return true;
  }

  async _stat() {
    return await this.fileSystem.stat(this.data.path);
  }

  async _watch(callback) {
    return await this.fileSystem.watch(this.data.path, callback);
  }

  async _delete() {
    const result = await this.fileSystem.unlink(this.data.path);
    // File deletion emitted as side effect by callMethod
    return result;
  }

  /**
   * Validate file system implementation
   * @private
   * @param {Object} fileSystem - File system to validate
   */
  _validateFileSystem(fileSystem) {
    if (!fileSystem) {
      throw new Error('FileSystem implementation is required');
    }

    const requiredMethods = ['readFile', 'writeFile', 'stat', 'watch', 'unlink'];
    const missingMethods = requiredMethods.filter(method => typeof fileSystem[method] !== 'function');
    
    if (missingMethods.length > 0) {
      throw new Error(`FileSystem must implement required methods: ${missingMethods.join(', ')}`);
    }
  }

  /**
   * Ensure FileHandle type is registered
   * @private
   */
  _ensureTypeRegistered() {
    const registry = TypeHandleRegistry.getGlobalRegistry();
    
    if (!registry.hasType('FileHandle')) {
      registry.registerType('FileHandle', this._getTypeMetadata());
    }
  }

  /**
   * Get type metadata for FileHandle
   * @private
   * @returns {Object} Type metadata
   */
  _getTypeMetadata() {
    return {
      methods: {
        read: {
          params: [],
          returns: 'string',
          cacheable: true,
          ttl: 30000, // Cache for 30 seconds
          documentation: 'Read file contents as UTF-8 string'
        },
        write: {
          params: ['content:string'],
          returns: 'boolean',
          cacheable: false,
          sideEffects: ['content-changed'],
          documentation: 'Write content to file and emit content-changed event'
        },
        stat: {
          params: [],
          returns: 'object',
          cacheable: true,
          ttl: 5000, // Cache for 5 seconds
          documentation: 'Get file statistics (size, mtime, etc.)'
        },
        watch: {
          params: ['callback:function'],
          returns: 'object',
          cacheable: false,
          documentation: 'Watch file for changes and call callback on modification'
        },
        delete: {
          params: [],
          returns: 'boolean',
          cacheable: false,
          sideEffects: ['file-deleted'],
          documentation: 'Delete file and emit file-deleted event'
        }
      },
      attributes: {
        path: {
          type: 'string',
          readonly: true,
          documentation: 'Full path to the file'
        },
        extension: {
          type: 'string',
          readonly: true,
          documentation: 'File extension including the dot'
        },
        size: {
          type: 'number',
          computed: true,
          documentation: 'File size in bytes (computed from stat)'
        }
      },
      documentation: {
        description: 'Handle for file system files with read/write/watch capabilities',
        examples: [
          'const content = await fileHandle.read()',
          'await fileHandle.write("new content")',
          'const stats = await fileHandle.stat()',
          'fileHandle.subscribe("content-changed", callback)'
        ]
      },
      version: '1.0.0'
    };
  }

  /**
   * Static method to get type name for auto-registration
   * @returns {string} Type name
   */
  static getTypeName() {
    return 'FileHandle';
  }

  /**
   * Static method to get type metadata for auto-registration
   * @returns {Object} Type metadata
   */
  static getTypeMetadata() {
    return new FileHandle('/dummy', {
      readFile: () => {},
      writeFile: () => {},
      stat: () => {},
      watch: () => {},
      unlink: () => {}
    })._getTypeMetadata();
  }
}