import { ModularTool } from '@jsenvoy/module-loader';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Tool for reading files from the file system
 */
class FileReaderTool extends ModularTool {
  constructor({ basePath, encoding = 'utf-8', maxFileSize = 10 * 1024 * 1024 }) {
    super();
    this.name = 'file_reader';
    this.shortName = 'read';
    this.description = 'Reads the contents of a file from the file system';
    this.parameters = {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'The path to the file to read'
        }
      },
      required: ['filePath']
    };

    // Store dependencies
    this.basePath = basePath;
    this.encoding = encoding;
    this.maxFileSize = maxFileSize;
  }

  /**
   * Execute the file reader tool
   * @param {Object} args - The arguments
   * @param {string} args.filePath - The path to the file to read
   * @returns {Promise<Object>} The file contents
   */
  async execute({ filePath } = {}) {
    try {
      // Validate input
      if (filePath === undefined) {
        throw new Error('File path is required');
      }

      if (typeof filePath !== 'string') {
        throw new Error('File path must be a string');
      }

      if (filePath.trim() === '') {
        throw new Error('File path cannot be empty');
      }

      // Check for null bytes (security)
      if (filePath.includes('\0')) {
        throw new Error('Invalid file path');
      }

      // Resolve the file path
      const resolvedPath = this.resolvePath(filePath);

      // Check if path is within allowed basePath
      if (!this.isPathAllowed(resolvedPath)) {
        throw new Error('Access denied: Path is outside allowed directory');
      }

      // Check file permissions
      try {
        await fs.access(resolvedPath);
      } catch (error) {
        throw new Error('File not found or not accessible');
      }

      // Read the file
      const content = await fs.readFile(resolvedPath, this.encoding);

      return {
        content,
        path: resolvedPath
      };
    } catch (error) {
      if (error.message.startsWith('File not found') || 
          error.message.startsWith('Access denied') ||
          error.message.startsWith('File path') ||
          error.message.startsWith('Invalid file path')) {
        throw error;
      }
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  /**
   * Resolve the file path relative to basePath
   * @param {string} filePath - The file path to resolve
   * @returns {string} The resolved absolute path
   */
  resolvePath(filePath) {
    // If the path is absolute, return it as is (will be validated later)
    if (path.isAbsolute(filePath)) {
      return path.normalize(filePath);
    }
    
    // Otherwise, resolve relative to basePath
    return path.normalize(path.join(this.basePath, filePath));
  }

  /**
   * Check if the resolved path is within the allowed basePath
   * @param {string} resolvedPath - The resolved absolute path
   * @returns {boolean} True if allowed, false otherwise
   */
  isPathAllowed(resolvedPath) {
    // Use path.relative to determine if resolvedPath is within basePath
    const relative = path.relative(this.basePath, resolvedPath);
    
    // If the relative path starts with '..', it's outside the base path
    // If it's an absolute path (on Windows, starts with a drive letter),
    // it's also outside
    return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
  }
}

export default FileReaderTool;