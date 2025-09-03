/**
 * ResourceHandleManager - Central registry for creating and managing resource handles
 * 
 * Manages the lifecycle of resource handles, tracks active handles, and provides
 * factory methods for creating different resource types.
 */

export class ResourceHandleManager {
  constructor() {
    this.handles = new Map(); // handleId -> handle instance
    this.resourceTypes = new Map(); // resourceType -> method signatures
    this.handleCounter = 0;
    
    // Initialize with built-in resource types
    this._registerBuiltInTypes();
  }
  
  /**
   * Register built-in resource types
   * @private
   */
  _registerBuiltInTypes() {
    this.registerResourceType('FileHandle', ['read', 'write', 'stat', 'watch', 'delete']);
    this.registerResourceType('ImageHandle', ['getMetadata', 'getData', 'getUrl', 'resize']);
    this.registerResourceType('DirectoryHandle', ['list', 'createFile', 'createDir', 'delete']);
  }
  
  /**
   * Create a file handle
   * @param {string} filePath - Path to the file
   * @param {Object} fileSystem - File system implementation
   * @returns {Object} File handle with unique ID
   */
  createFileHandle(filePath, fileSystem) {
    const handleId = this._generateHandleId();
    
    const handle = {
      handleId,
      resourceType: 'FileHandle',
      path: filePath,
      fileSystem,
      
      async read() {
        return await fileSystem.readFile(filePath, 'utf8');
      },
      
      async write(content) {
        await fileSystem.writeFile(filePath, content, 'utf8');
        return true;
      },
      
      async stat() {
        return await fileSystem.stat(filePath);
      },
      
      async watch(callback) {
        return await fileSystem.watch(filePath, callback);
      },
      
      async delete() {
        return await fileSystem.unlink(filePath);
      }
    };
    
    return handle;
  }
  
  /**
   * Create an image handle
   * @param {string} imagePath - Path to the image
   * @param {Object} fileSystem - File system implementation
   * @returns {Object} Image handle with unique ID
   */
  createImageHandle(imagePath, fileSystem) {
    const handleId = this._generateHandleId();
    const manager = this; // Capture reference for nested calls
    
    const handle = {
      handleId,
      resourceType: 'ImageHandle', 
      path: imagePath,
      fileSystem,
      
      async getMetadata() {
        const stats = await fileSystem.stat(imagePath);
        return {
          size: stats.size,
          mtime: stats.mtime,
          extension: imagePath.split('.').pop()
        };
      },
      
      async getData() {
        return await fileSystem.readFile(imagePath);
      },
      
      async getUrl() {
        const data = await fileSystem.readFile(imagePath);
        const extension = imagePath.split('.').pop().toLowerCase();
        const mimeType = manager._getMimeType(extension);
        return `data:${mimeType};base64,${data.toString('base64')}`;
      },
      
      async resize(width, height) {
        throw new Error('Image resize not implemented in MVP');
      }
    };
    
    return handle;
  }
  
  /**
   * Create a directory handle
   * @param {string} dirPath - Path to the directory
   * @param {Object} fileSystem - File system implementation  
   * @returns {Object} Directory handle with unique ID
   */
  createDirectoryHandle(dirPath, fileSystem) {
    const handleId = this._generateHandleId();
    const manager = this; // Capture reference for nested calls
    
    const handle = {
      handleId,
      resourceType: 'DirectoryHandle',
      path: dirPath,
      fileSystem,
      
      async list() {
        return await fileSystem.readdir(dirPath);
      },
      
      async createFile(fileName) {
        const filePath = `${dirPath}/${fileName}`;
        await fileSystem.writeFile(filePath, '', 'utf8');
        return true; // For MVP, return success instead of handle
      },
      
      async createDir(dirName) {
        const newDirPath = `${dirPath}/${dirName}`;
        await fileSystem.mkdir(newDirPath);
        return true; // For MVP, return success instead of handle
      },
      
      async delete() {
        return await fileSystem.rmdir(dirPath);
      }
    };
    
    return handle;
  }
  
  /**
   * Register a resource type with its method signatures
   * @param {string} typeName - Name of the resource type
   * @param {Array<string>} methodSignatures - List of method names
   */
  registerResourceType(typeName, methodSignatures) {
    if (this.resourceTypes.has(typeName)) {
      throw new Error(`Resource type ${typeName} already registered`);
    }
    
    this.resourceTypes.set(typeName, methodSignatures);
  }
  
  /**
   * Get method signatures for a resource type
   * @param {string} typeName - Resource type name
   * @returns {Array<string>|undefined} Method signatures
   */
  getResourceType(typeName) {
    return this.resourceTypes.get(typeName);
  }
  
  /**
   * Track a handle instance
   * @param {string} handleId - Handle identifier
   * @param {Object} handle - Handle instance
   */
  trackHandle(handleId, handle) {
    this.handles.set(handleId, handle);
  }
  
  /**
   * Get a tracked handle
   * @param {string} handleId - Handle identifier
   * @returns {Object|null} Handle instance or null if not found
   */
  getHandle(handleId) {
    return this.handles.get(handleId) || null;
  }
  
  /**
   * Release a tracked handle
   * @param {string} handleId - Handle identifier
   */
  releaseHandle(handleId) {
    this.handles.delete(handleId);
  }
  
  /**
   * Validate a handle has required properties
   * @param {Object} handle - Handle to validate
   * @returns {boolean} True if valid
   */
  isValidHandle(handle) {
    return !!(handle && 
             handle.handleId && 
             handle.resourceType && 
             typeof handle.handleId === 'string' &&
             typeof handle.resourceType === 'string');
  }
  
  /**
   * Generate unique handle ID
   * @private
   * @returns {string} Unique handle identifier
   */
  _generateHandleId() {
    return `handle-${Date.now()}-${this.handleCounter++}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get MIME type from file extension
   * @private
   * @param {string} extension - File extension
   * @returns {string} MIME type
   */
  _getMimeType(extension) {
    const mimeTypes = {
      'png': 'image/png',
      'jpg': 'image/jpeg', 
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml'
    };
    
    return mimeTypes[extension] || 'application/octet-stream';
  }
}