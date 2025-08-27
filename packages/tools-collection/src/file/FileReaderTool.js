import { Tool } from '@legion/tools-registry';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Tool for reading files from the file system
 */
class FileReaderTool extends Tool {
  constructor({ basePath, encoding = 'utf-8', maxFileSize = 10 * 1024 * 1024 }) {
    if (!basePath) {
      throw new Error('basePath is required');
    }
    
    super({
      name: 'file_reader',
      shortName: 'read',
      description: 'Reads the contents of a file from the file system',
      schema: {
        input: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'The path to the file to read'
            }
          },
          required: ['filePath']
        },
        output: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'The contents of the file'
            },
            path: {
              type: 'string',
              description: 'The resolved path of the file'
            }
          },
          required: ['content', 'path']
        }
      }
    });

    // Store dependencies
    this.basePath = basePath;
    this.encoding = encoding;
    this.maxFileSize = maxFileSize;
  }

  /**
   * Execute the file reader tool
   * @param {Object} args - The arguments for reading the file
   * @returns {Promise<Object>} The result of reading the file
   */
  async execute(args) {
    try {
      const { filePath } = args;

      // Validate input
      if (typeof filePath !== 'string') {
        throw new Error('File path must be a string', {
          cause: {
            filePath: String(filePath),
            errorType: 'invalid_path'
          }
        });
      }

      if (filePath.trim() === '') {
        throw new Error('File path cannot be empty', {
          cause: {
            filePath: filePath,
            errorType: 'invalid_path'
          }
        });
      }

      // Check for null bytes (security)
      if (filePath.includes('\0')) {
        throw new Error('Invalid file path', {
          cause: {
            filePath: filePath,
            errorType: 'invalid_path'
          }
        });
      }

      // Resolve the file path
      const resolvedPath = this.resolvePath(filePath);

      // Check if path is within allowed basePath
      if (!this.isPathAllowed(resolvedPath)) {
        throw new Error('Access denied: Path is outside allowed directory', {
          cause: {
            filePath: filePath,
            errorType: 'access_denied'
          }
        });
      }

      // Check file permissions
      try {
        await fs.access(resolvedPath);
      } catch (error) {
        throw new Error('File not found or not accessible', {
          cause: {
            filePath: filePath,
            errorType: 'file_not_found'
          }
        });
      }

      // Read the file
      const content = await fs.readFile(resolvedPath, this.encoding);

      return {
        content,
        path: resolvedPath
      };
    } catch (error) {
      // Handle any unexpected errors
      const cause = error.cause || {};
      throw new Error(error.message || 'Failed to read file', {
        cause: {
          filePath: args?.filePath || 'unknown',
          errorType: cause.errorType || 'read_error',
          details: error.stack
        }
      });
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