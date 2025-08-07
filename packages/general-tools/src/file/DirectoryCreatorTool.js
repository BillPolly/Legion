import { Tool, ToolResult } from '@legion/tool-system';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Tool for creating directories in the file system
 */
class DirectoryCreatorTool extends Tool {
  constructor({ basePath, permissions = 0o755 }) {
    super();
    this.name = 'directory_creator';
    this.shortName = 'mkdir';
    this.description = 'Creates directories in the file system';

    // Store dependencies
    this.basePath = basePath;
    this.permissions = permissions;
  }

  /**
   * Returns the tool description in standard function calling format
   */
  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: 'directory_creator',
        description: 'Creates directories in the file system',
        parameters: {
          type: 'object',
          properties: {
            directoryPath: {
              type: 'string',
              description: 'The path of the directory to create'
            },
            recursive: {
              type: 'boolean',
              description: 'Whether to create parent directories if they don\'t exist (default: true)',
              default: true
            }
          },
          required: ['directoryPath']
        },
        output: {
          success: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'The resolved path of the created directory'
              },
              created: {
                type: 'boolean',
                description: 'Whether a new directory was created (false if it already existed)'
              }
            },
            required: ['path', 'created']
          },
          failure: {
            type: 'object',
            properties: {
              directoryPath: {
                type: 'string',
                description: 'The path that was attempted'
              },
              errorType: {
                type: 'string',
                enum: ['invalid_path', 'access_denied', 'path_exists_not_dir', 'parent_not_found', 'permission_denied', 'create_error'],
                description: 'The type of error that occurred'
              },
              details: {
                type: 'string',
                description: 'Additional error details'
              }
            },
            required: ['directoryPath', 'errorType']
          }
        }
      }
    };
  }

  /**
   * Execute the directory creator tool
   * @param {Object} args - The arguments for creating the directory
   * @returns {Promise<ToolResult>} The result of creating the directory
   */
  async execute(args) {
    try {
      // Validate required parameters
      if (!args || !args.directoryPath) {
        throw new Error('directoryPath is required');
      }

      const { directoryPath, recursive = true } = args;

      // Validate input
      if (typeof directoryPath !== 'string') {
        return ToolResult.failure('Directory path must be a string', {
          directoryPath: String(directoryPath),
          errorType: 'invalid_path'
        });
      }

      if (directoryPath.trim() === '') {
        return ToolResult.failure('Directory path cannot be empty', {
          directoryPath: directoryPath,
          errorType: 'invalid_path'
        });
      }

      // Check for null bytes (security)
      if (directoryPath.includes('\0')) {
        return ToolResult.failure('Invalid directory path', {
          directoryPath: directoryPath,
          errorType: 'invalid_path'
        });
      }

      // Resolve the directory path
      const resolvedPath = this.resolvePath(directoryPath);

      // Check if path is within allowed basePath
      if (!this.isPathAllowed(resolvedPath)) {
        return ToolResult.failure('Access denied: Path is outside allowed directory', {
          directoryPath: directoryPath,
          errorType: 'access_denied'
        });
      }

      // Try to create the directory
      try {
        await fs.mkdir(resolvedPath, { 
          recursive, 
          mode: this.permissions 
        });

        return ToolResult.success({
          path: resolvedPath,
          created: true
        });
      } catch (error) {
        // Handle specific error codes
        if (error.code === 'EEXIST') {
          // Directory already exists - check if it's actually a directory
          try {
            await fs.access(resolvedPath);
            const stats = await fs.stat(resolvedPath);
            if (stats.isDirectory()) {
              return ToolResult.success({
                path: resolvedPath,
                created: false
              });
            } else {
              return ToolResult.failure('Path exists but is not a directory', {
                directoryPath: directoryPath,
                errorType: 'path_exists_not_dir'
              });
            }
          } catch (accessError) {
            // If we can't access the path to verify, return the error
            return ToolResult.failure('Path exists but is not a directory', {
              directoryPath: directoryPath,
              errorType: 'path_exists_not_dir'
            });
          }
        } else if (error.code === 'ENOENT' && !recursive) {
          return ToolResult.failure('Parent directory does not exist', {
            directoryPath: directoryPath,
            errorType: 'parent_not_found'
          });
        } else if (error.code === 'EACCES') {
          return ToolResult.failure('Permission denied', {
            directoryPath: directoryPath,
            errorType: 'permission_denied'
          });
        } else {
          throw error;
        }
      }
    } catch (error) {
      // Handle any unexpected errors
      return ToolResult.failure(error.message || 'Failed to create directory', {
        directoryPath: args?.directoryPath || 'unknown',
        errorType: 'create_error',
        details: error.stack
      });
    }
  }

  /**
   * Resolve the directory path relative to basePath
   * @param {string} directoryPath - The directory path to resolve
   * @returns {string} The resolved absolute path
   */
  resolvePath(directoryPath) {
    // If the path is absolute, return it as is (will be validated later)
    if (path.isAbsolute(directoryPath)) {
      return path.normalize(directoryPath);
    }
    
    // Otherwise, resolve relative to basePath
    return path.normalize(path.join(this.basePath, directoryPath));
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

export default DirectoryCreatorTool;