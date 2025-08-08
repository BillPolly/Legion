import { Tool, ToolResult } from '../../../tools/src/index.js';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Tool for writing files to the file system
 */
class FileWriterTool extends Tool {
  constructor({ basePath, encoding = 'utf-8', createDirectories = false }) {
    super();
    this.name = 'file_writer';
    this.shortName = 'write';
    this.description = 'Writes content to a file in the file system';

    // Store dependencies
    this.basePath = basePath;
    this.encoding = encoding;
    this.createDirectories = createDirectories;
  }

  /**
   * Returns the tool description in standard function calling format
   */
  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: 'file_writer',
        description: 'Writes content to a file in the file system',
        parameters: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'The path where the file should be written'
            },
            content: {
              description: 'The content to write to the file (string or object - objects will be JSON stringified)'
            },
            append: {
              type: 'boolean',
              description: 'Whether to append to existing file (default: false)',
              default: false
            }
          },
          required: ['filePath', 'content']
        },
        output: {
          success: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'The resolved path where the file was written'
              },
              bytesWritten: {
                type: 'number',
                description: 'Number of bytes written to the file'
              }
            },
            required: ['path', 'bytesWritten']
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
                enum: ['invalid_path', 'access_denied', 'directory_not_found', 'write_error'],
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
   * Execute the file writer tool
   * @param {Object} args - The arguments for writing the file
   * @returns {Promise<ToolResult>} The result of writing the file
   */
  async execute(args) {
    try {
      // Validate required parameters
      if (!args || !args.filePath || args.content === undefined) {
        throw new Error('filePath and content are required');
      }

      let { filePath, content, append = false } = args;
      
      // Convert content to string if needed (handles objects like package.json)
      if (typeof content !== 'string') {
        content = typeof content === 'object' ? JSON.stringify(content, null, 2) : String(content);
      }

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
          return ToolResult.failure('Directory does not exist', {
            filePath: filePath,
            errorType: 'directory_not_found'
          });
        }
      }

      // Write the file
      const flag = append ? 'a' : 'w';
      await fs.writeFile(resolvedPath, content, { encoding: this.encoding, flag });

      return ToolResult.success({
        path: resolvedPath,
        bytesWritten: content.length
      });
    } catch (error) {
      // Handle any unexpected errors
      return ToolResult.failure(error.message || 'Failed to write file', {
        filePath: args?.filePath || 'unknown',
        errorType: 'write_error',
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

export default FileWriterTool;