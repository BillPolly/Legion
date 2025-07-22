/**
 * FileOperationsManager - Integration layer for @legion/general-tools file operations
 * 
 * This class provides a standardized interface for file operations using the jsEnvoy
 * file tools, handling error cases and providing consistent result formats.
 */

import path from 'path';

class FileOperationsManager {
  constructor() {
    this.fileModule = null;
    this.initialized = false;
  }

  /**
   * Initialize the file operations manager with jsEnvoy file module
   */
  async initialize() {
    try {
      // Import the FileModule from the relative path (since packages aren't published yet)
      const { default: FileModule } = await import('../../../../general-tools/src/file/index.js');
      
      // Create an instance of the file module
      const fileModuleInstance = new FileModule();
      
      // Get the file operations tool from the module
      this.fileModule = fileModuleInstance.tools[0]; // FileOperationsTool is the first tool
      
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize FileOperationsManager: ${error.message}`);
    }
  }

  /**
   * Ensure the manager is initialized
   * @private
   */
  _ensureInitialized() {
    if (!this.initialized) {
      throw new Error('FileOperationsManager must be initialized before use');
    }
  }

  /**
   * Read file content
   * @param {string} filepath - Path to the file to read
   * @returns {Object} Result object with success, content, and metadata
   */
  async readFile(filepath) {
    this._ensureInitialized();
    
    try {
      const toolCall = {
        id: `file-read-${Date.now()}`,
        type: 'function',
        function: {
          name: 'file_read',
          arguments: JSON.stringify({ filepath })
        }
      };

      const result = await this.fileModule.invoke(toolCall);
      
      if (result.success) {
        return {
          success: true,
          content: result.data.content,
          filepath: result.data.filepath,
          size: result.data.size,
          data: result.data
        };
      } else {
        return {
          success: false,
          error: result.error,
          filepath: filepath,
          data: result.data
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `File read failed: ${error.message}`,
        filepath: filepath,
        data: null
      };
    }
  }

  /**
   * Write content to file
   * @param {string} filepath - Path where the file should be written
   * @param {string} content - Content to write to the file
   * @returns {Object} Result object with success, filepath, and metadata
   */
  async writeFile(filepath, content) {
    this._ensureInitialized();
    
    try {
      const toolCall = {
        id: `file-write-${Date.now()}`,
        type: 'function',
        function: {
          name: 'file_write',
          arguments: JSON.stringify({ filepath, content })
        }
      };

      const result = await this.fileModule.invoke(toolCall);
      
      if (result.success) {
        return {
          success: true,
          filepath: result.data.filepath,
          bytesWritten: result.data.bytesWritten,
          created: result.data.created,
          data: result.data
        };
      } else {
        return {
          success: false,
          error: result.error,
          filepath: filepath,
          data: result.data
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `File write failed: ${error.message}`,
        filepath: filepath,
        data: null
      };
    }
  }

  /**
   * Create directory
   * @param {string} dirpath - Path where the directory should be created
   * @returns {Object} Result object with success, dirpath, and metadata
   */
  async createDirectory(dirpath) {
    this._ensureInitialized();
    
    try {
      const toolCall = {
        id: `dir-create-${Date.now()}`,
        type: 'function',
        function: {
          name: 'directory_create',
          arguments: JSON.stringify({ dirpath })
        }
      };

      const result = await this.fileModule.invoke(toolCall);
      
      if (result.success) {
        return {
          success: true,
          dirpath: result.data.dirpath,
          created: result.data.created,
          data: result.data
        };
      } else {
        return {
          success: false,
          error: result.error,
          dirpath: dirpath,
          data: result.data
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Directory creation failed: ${error.message}`,
        dirpath: dirpath,
        data: null
      };
    }
  }

  /**
   * List directory contents
   * @param {string} dirpath - Path to the directory to list
   * @returns {Object} Result object with success, contents, and metadata
   */
  async listDirectory(dirpath) {
    this._ensureInitialized();
    
    try {
      const toolCall = {
        id: `dir-list-${Date.now()}`,
        type: 'function',
        function: {
          name: 'directory_list',
          arguments: JSON.stringify({ dirpath })
        }
      };

      const result = await this.fileModule.invoke(toolCall);
      
      if (result.success) {
        return {
          success: true,
          dirpath: result.data.dirpath,
          contents: result.data.contents,
          data: result.data
        };
      } else {
        return {
          success: false,
          error: result.error,
          dirpath: dirpath,
          data: result.data
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Directory listing failed: ${error.message}`,
        dirpath: dirpath,
        data: null
      };
    }
  }

  /**
   * Get current working directory
   * @returns {Object} Result object with success and currentDirectory
   */
  async getCurrentDirectory() {
    this._ensureInitialized();
    
    try {
      const toolCall = {
        id: `dir-current-${Date.now()}`,
        type: 'function',
        function: {
          name: 'directory_current',
          arguments: JSON.stringify({})
        }
      };

      const result = await this.fileModule.invoke(toolCall);
      
      if (result.success) {
        return {
          success: true,
          currentDirectory: result.data.currentDirectory,
          data: result.data
        };
      } else {
        return {
          success: false,
          error: result.error,
          data: result.data
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Get current directory failed: ${error.message}`,
        data: null
      };
    }
  }

  /**
   * Change working directory
   * @param {string} dirpath - Path to change to
   * @returns {Object} Result object with success, currentDirectory, and previousDirectory
   */
  async changeDirectory(dirpath) {
    this._ensureInitialized();
    
    try {
      const toolCall = {
        id: `dir-change-${Date.now()}`,
        type: 'function',
        function: {
          name: 'directory_change',
          arguments: JSON.stringify({ dirpath })
        }
      };

      const result = await this.fileModule.invoke(toolCall);
      
      if (result.success) {
        return {
          success: true,
          currentDirectory: result.data.currentDirectory,
          previousDirectory: result.data.previousDirectory,
          data: result.data
        };
      } else {
        return {
          success: false,
          error: result.error,
          dirpath: dirpath,
          data: result.data
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Directory change failed: ${error.message}`,
        dirpath: dirpath,
        data: null
      };
    }
  }

  /**
   * Check if file exists
   * @param {string} filepath - Path to check
   * @returns {boolean} True if file exists, false otherwise
   */
  async fileExists(filepath) {
    const result = await this.readFile(filepath);
    return result.success;
  }

  /**
   * Check if directory exists
   * @param {string} dirpath - Path to check
   * @returns {boolean} True if directory exists, false otherwise
   */
  async directoryExists(dirpath) {
    const result = await this.listDirectory(dirpath);
    return result.success;
  }

  /**
   * Resolve relative path to absolute path
   * @param {string} relativePath - Relative path to resolve
   * @returns {string} Absolute path
   */
  resolvePath(relativePath) {
    return path.resolve(relativePath);
  }

  /**
   * Get file extension
   * @param {string} filepath - File path
   * @returns {string} File extension (including the dot)
   */
  getFileExtension(filepath) {
    return path.extname(filepath);
  }

  /**
   * Get directory name from path
   * @param {string} filepath - File path
   * @returns {string} Directory name
   */
  getDirectoryName(filepath) {
    return path.dirname(filepath);
  }

  /**
   * Get base name from path
   * @param {string} filepath - File path
   * @returns {string} Base name (filename without directory)
   */
  getBaseName(filepath) {
    return path.basename(filepath);
  }

  /**
   * Join path components
   * @param {...string} paths - Path components to join
   * @returns {string} Joined path
   */
  joinPath(...paths) {
    return path.join(...paths);
  }
}

export { FileOperationsManager };