import { ModularTool } from '@jsenvoy/module-loader';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Tool for writing files to the file system
 */
class FileWriterTool extends ModularTool {
  constructor({ basePath, encoding = 'utf-8', createDirectories = false }) {
    super();
    this.name = 'file_writer';
    this.shortName = 'write';
    this.description = 'Writes content to a file in the file system';
    this.parameters = {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'The path where the file should be written'
        },
        content: {
          type: 'string',
          description: 'The content to write to the file'
        },
        append: {
          type: 'boolean',
          description: 'Whether to append to existing file (default: false)',
          default: false
        }
      },
      required: ['filePath', 'content']
    };

    // Store dependencies
    this.basePath = basePath;
    this.encoding = encoding;
    this.createDirectories = createDirectories;
  }

  /**
   * Execute the file writer tool
   * @param {Object} args - The arguments
   * @param {string} args.filePath - The path where the file should be written
   * @param {string} args.content - The content to write
   * @param {boolean} args.append - Whether to append (default: false)
   * @returns {Promise<Object>} The write result
   */
  async execute({ filePath, content, append = false } = {}) {
    try {
      // Validate input
      if (filePath === undefined) {
        throw new Error('File path is required');
      }

      if (content === undefined) {
        throw new Error('Content is required');
      }

      if (typeof filePath !== 'string') {
        throw new Error('File path must be a string');
      }

      if (typeof content !== 'string') {
        throw new Error('Content must be a string');
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

      // Create directory if needed
      if (this.createDirectories) {
        const dir = path.dirname(resolvedPath);
        try {
          await fs.access(dir);
        } catch (error) {
          // Directory doesn't exist, create it
          await fs.mkdir(dir, { recursive: true });
        }
      } else {
        // Check if directory exists
        const dir = path.dirname(resolvedPath);
        try {
          await fs.access(dir);
        } catch (error) {
          throw new Error('Directory does not exist');
        }
      }

      // Write the file
      const flag = append ? 'a' : 'w';
      await fs.writeFile(resolvedPath, content, { encoding: this.encoding, flag });

      return {
        success: true,
        path: resolvedPath,
        bytesWritten: content.length
      };
    } catch (error) {
      if (error.message.startsWith('File path') || 
          error.message.startsWith('Content') ||
          error.message.startsWith('Access denied') ||
          error.message.startsWith('Invalid file path') ||
          error.message.startsWith('Directory does not exist')) {
        throw error;
      }
      throw new Error(`Failed to write file: ${error.message}`);
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

export default FileWriterTool;