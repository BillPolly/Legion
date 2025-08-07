import { Tool, ToolResult } from '@legion/tool-system';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Tool for reading files from the file system
 */
class FileReaderTool extends Tool {
  constructor({ basePath, encoding = 'utf-8', maxFileSize = 10 * 1024 * 1024 }) {
    super();
    this.name = 'file_reader';
    this.shortName = 'read';
    this.description = 'Reads the contents of a file from the file system';

    // Store dependencies
    this.basePath = basePath;
    this.encoding = encoding;
    this.maxFileSize = maxFileSize;
  }

  /**
   * Returns the tool description in standard function calling format
   */
  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: 'file_reader',
        description: 'Reads the contents of a file from the file system',
        parameters: {
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
          success: {
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
          },
          failure: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'The path that was attempted'
              },
              errorType: {
                type: 'string',
                enum: ['file_not_found', 'access_denied', 'invalid_path', 'read_error'],
                description: 'The type of error that occurred'
              },
              details: {
                type: 'string',
                description: 'Additional error details'
              }
            },
            required: ['filePath', 'errorType']
          }
        }
      }
    };
  }

  /**
   * Execute the file reader tool
   * @param {Object} args - The arguments for reading the file
   * @returns {Promise<ToolResult>} The result of reading the file
   */
  async execute(args) {
    try {
      // Validate required parameters
      if (!args || !args.filePath) {
        throw new Error('filePath is required');
      }

      const { filePath } = args;

      // Validate input
      if (typeof filePath !== 'string') {
        return ToolResult.failure('File path must be a string', {
          filePath: String(filePath),
          errorType: 'invalid_path'
        });
      }

      if (filePath.trim() === '') {
        return ToolResult.failure('File path cannot be empty', {
          filePath: filePath,
          errorType: 'invalid_path'
        });
      }

      // Check for null bytes (security)
      if (filePath.includes('\0')) {
        return ToolResult.failure('Invalid file path', {
          filePath: filePath,
          errorType: 'invalid_path'
        });
      }

      // Resolve the file path
      const resolvedPath = this.resolvePath(filePath);

      // Check if path is within allowed basePath
      if (!this.isPathAllowed(resolvedPath)) {
        return ToolResult.failure('Access denied: Path is outside allowed directory', {
          filePath: filePath,
          errorType: 'access_denied'
        });
      }

      // Check file permissions
      try {
        await fs.access(resolvedPath);
      } catch (error) {
        return ToolResult.failure('File not found or not accessible', {
          filePath: filePath,
          errorType: 'file_not_found'
        });
      }

      // Read the file
      const content = await fs.readFile(resolvedPath, this.encoding);

      return ToolResult.success({
        content,
        path: resolvedPath
      });
    } catch (error) {
      // Handle any unexpected errors
      return ToolResult.failure(error.message || 'Failed to read file', {
        filePath: args?.filePath || 'unknown',
        errorType: 'read_error',
        details: error.stack
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