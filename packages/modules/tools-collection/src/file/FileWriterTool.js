import { Tool } from '@legion/tools-registry';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Tool for writing files to the file system
 */
class FileWriterTool extends Tool {
  constructor(moduleOrConfig, toolName = null) {
    // NEW PATTERN: Tool(module, toolName) - metadata comes from module
    if (toolName && moduleOrConfig?.getToolMetadata) {
      super(moduleOrConfig, toolName);
      
      // Get config from module
      const config = moduleOrConfig.config || {};
      this.basePath = config.basePath || process.cwd();
      this.encoding = config.encoding || 'utf-8';
      this.createDirectories = config.createDirectories || false;
      this.shortName = 'write';
    } 
    // OLD PATTERN: Tool(config) - backwards compatibility
    else {
      const { basePath, encoding = 'utf-8', createDirectories = false } = moduleOrConfig || {};
      
      if (!basePath) {
        throw new Error('basePath is required');
      }
      
      super({
        name: 'file_writer',
        shortName: 'write',
        description: 'Writes content to a file in the file system',
        schema: {
          input: {
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
          }
        }
    });

      // Store dependencies
      this.basePath = basePath;
      this.encoding = encoding;
      this.createDirectories = createDirectories;
    }
  }

  /**
   * Execute the file writer tool
   * @param {Object} args - The arguments for writing the file
   * @returns {Promise<Object>} The result of writing the file
   */
  async _execute(args) {
    try {
      let { filePath, content, append = false } = args;
      
      // Validate that content is provided
      if (content === undefined || content === null) {
        throw new Error('Content parameter is required', {
          cause: {
            filePath: String(filePath),
            errorType: 'invalid_input'
          }
        });
      }

      // Convert content to string if needed (handles objects like package.json)
      if (typeof content !== 'string') {
        content = typeof content === 'object' ? JSON.stringify(content, null, 2) : String(content);
      }

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
          throw new Error('Directory does not exist', {
            cause: {
              filePath: filePath,
              errorType: 'directory_not_found'
            }
          });
        }
      }

      // Write the file
      const flag = append ? 'a' : 'w';
      await fs.writeFile(resolvedPath, content, { encoding: this.encoding, flag });

      return {
        path: resolvedPath,
        bytesWritten: content.length
      };
    } catch (error) {
      // Handle any unexpected errors
      const cause = error.cause || {};
      throw new Error(error.message || 'Failed to write file', {
        cause: {
          filePath: args?.filePath || 'unknown',
          errorType: cause.errorType || 'write_error',
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

export default FileWriterTool;