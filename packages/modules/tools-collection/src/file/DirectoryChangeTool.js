import { Tool } from '@legion/tools-registry';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Tool for changing the current working directory
 */
class DirectoryChangeTool extends Tool {
  constructor({ basePath }) {
    if (!basePath) {
      throw new Error('basePath is required');
    }
    
    super({
      name: 'directory_change',
      shortName: 'cd',
      description: 'Changes the current working directory',
      schema: {
        input: {
          type: 'object',
          properties: {
            directoryPath: {
              type: 'string',
              description: 'The path to change to (supports ~, ., .., absolute and relative paths)'
            }
          },
          required: ['directoryPath']
        },
        output: {
          type: 'object',
          properties: {
            previousPath: {
              type: 'string',
              description: 'The previous working directory'
            },
            currentPath: {
              type: 'string',
              description: 'The new current working directory'
            },
            history: {
              type: 'array',
              description: 'Directory change history',
              items: { type: 'string' }
            }
          },
          required: ['previousPath', 'currentPath']
        }
      }
    });

    this.basePath = basePath;
    this.history = [];
  }

  /**
   * Execute the directory change tool
   * @param {Object} args - The arguments for changing directory
   * @returns {Promise<Object>} The result of changing directory
   */
  async _execute(args) {
    try {
      const { directoryPath } = args;
      const previousPath = process.cwd();

      // Validate input
      if (typeof directoryPath !== 'string') {
        throw new Error('Directory path must be a string', {
          cause: {
            directoryPath: String(directoryPath),
            errorType: 'invalid_path'
          }
        });
      }

      if (directoryPath.trim() === '') {
        throw new Error('Directory path cannot be empty', {
          cause: {
            directoryPath: directoryPath,
            errorType: 'invalid_path'
          }
        });
      }

      // Check for null bytes (security)
      if (directoryPath.includes('\0')) {
        throw new Error('Invalid directory path', {
          cause: {
            directoryPath: directoryPath,
            errorType: 'invalid_path'
          }
        });
      }

      // Resolve the directory path with special handling
      const resolvedPath = this.resolveSpecialPath(directoryPath);

      // Check if path is within allowed basePath
      if (!(await this.isPathAllowed(resolvedPath))) {
        throw new Error('Access denied: Path is outside allowed directory', {
          cause: {
            directoryPath: directoryPath,
            errorType: 'access_denied'
          }
        });
      }

      // Check if directory exists and is accessible
      try {
        await fs.access(resolvedPath);
        const stats = await fs.stat(resolvedPath);
        if (!stats.isDirectory()) {
          throw new Error('Path is not a directory', {
            cause: {
              directoryPath: directoryPath,
              errorType: 'not_a_directory'
            }
          });
        }
      } catch (error) {
        if (error.cause) throw error;
        throw new Error('Directory not found or not accessible', {
          cause: {
            directoryPath: directoryPath,
            errorType: 'directory_not_found'
          }
        });
      }

      // Change to the directory
      process.chdir(resolvedPath);
      const currentPath = process.cwd();

      // Update history
      this.history.push(previousPath);
      if (this.history.length > 10) {
        this.history.shift(); // Keep only last 10 entries
      }

      return {
        previousPath,
        currentPath,
        history: [...this.history]
      };
    } catch (error) {
      const cause = error.cause || {};
      throw new Error(error.message || 'Failed to change directory', {
        cause: {
          directoryPath: args?.directoryPath || 'unknown',
          errorType: cause.errorType || 'change_error',
          details: error.stack
        }
      });
    }
  }

  /**
   * Resolve path with special handling for ~, ., .., etc.
   * @param {string} directoryPath - The directory path to resolve
   * @returns {string} The resolved absolute path
   */
  resolveSpecialPath(directoryPath) {
    let resolvedPath = directoryPath;

    // Handle tilde (~) as base directory
    if (resolvedPath.startsWith('~')) {
      resolvedPath = resolvedPath.replace('~', this.basePath);
    }

    // Handle current directory (.)
    if (resolvedPath === '.') {
      resolvedPath = process.cwd();
    }

    // If still relative, resolve against current working directory
    if (!path.isAbsolute(resolvedPath)) {
      resolvedPath = path.resolve(process.cwd(), resolvedPath);
    }

    return path.normalize(resolvedPath);
  }

  /**
   * Check if the resolved path is within the allowed basePath
   * @param {string} resolvedPath - The resolved absolute path
   * @returns {boolean} True if allowed, false otherwise
   */
  async isPathAllowed(resolvedPath) {
    try {
      // Resolve real paths to handle symlinks (e.g., /tmp -> /private/tmp on macOS)
      const realBasePath = await fs.realpath(this.basePath);
      const realResolvedPath = await fs.realpath(resolvedPath);
      
      // Use path.relative to determine if resolvedPath is within basePath
      const relative = path.relative(realBasePath, realResolvedPath);
      
      // If the relative path starts with '..', it's outside the base path
      // If it's an absolute path (on Windows, starts with a drive letter),
      // it's also outside
      // Empty relative path means the resolved path IS the base path, which is allowed
      return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
    } catch (error) {
      // If we can't resolve the real paths, fall back to string comparison
      const relative = path.relative(this.basePath, resolvedPath);
      return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
    }
  }
}

export default DirectoryChangeTool;