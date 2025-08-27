import { Tool } from '@legion/tools-registry';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Tool for listing directory contents
 */
class DirectoryListTool extends Tool {
  constructor({ basePath }) {
    if (!basePath) {
      throw new Error('basePath is required');
    }
    
    super({
      name: 'directory_list',
      shortName: 'ls',
      description: 'Lists the contents of a directory',
      schema: {
        input: {
          type: 'object',
          properties: {
            directoryPath: {
              type: 'string',
              description: 'The path to the directory to list'
            },
            recursive: {
              type: 'boolean',
              description: 'Whether to list contents recursively (default: false)',
              default: false
            },
            filter: {
              type: 'string',
              description: 'Optional filter pattern (e.g., "*.txt")'
            },
            includeHidden: {
              type: 'boolean',
              description: 'Whether to include hidden files (default: false)',
              default: false
            }
          },
          required: ['directoryPath']
        },
        output: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              description: 'List of directory items',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  path: { type: 'string' },
                  type: { type: 'string', enum: ['file', 'directory'] },
                  size: { type: 'number' },
                  modified: { type: 'string' },
                  created: { type: 'string' }
                }
              }
            },
            path: {
              type: 'string',
              description: 'The resolved path of the listed directory'
            },
            totalItems: {
              type: 'number',
              description: 'Total number of items found'
            }
          },
          required: ['items', 'path', 'totalItems']
        }
      }
    });

    this.basePath = basePath;
  }

  /**
   * Execute the directory list tool
   * @param {Object} args - The arguments for listing the directory
   * @returns {Promise<Object>} The result of listing the directory
   */
  async execute(args) {
    try {
      const { directoryPath, recursive = false, filter, includeHidden = false } = args;

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

      // Resolve the directory path
      const resolvedPath = this.resolvePath(directoryPath);

      // Check if path is within allowed basePath
      if (!this.isPathAllowed(resolvedPath)) {
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

      // List directory contents
      const items = await this.listDirectory(resolvedPath, recursive, filter, includeHidden);

      return {
        items,
        path: resolvedPath,
        totalItems: items.length
      };
    } catch (error) {
      const cause = error.cause || {};
      throw new Error(error.message || 'Failed to list directory', {
        cause: {
          directoryPath: args?.directoryPath || 'unknown',
          errorType: cause.errorType || 'list_error',
          details: error.stack
        }
      });
    }
  }

  /**
   * Recursively list directory contents
   * @param {string} dirPath - The directory path to list
   * @param {boolean} recursive - Whether to list recursively
   * @param {string} filter - Optional filter pattern
   * @param {boolean} includeHidden - Whether to include hidden files
   * @returns {Promise<Array>} Array of directory items
   */
  async listDirectory(dirPath, recursive, filter, includeHidden) {
    const items = [];
    const entries = await fs.readdir(dirPath);

    for (const entry of entries) {
      // Skip hidden files if not requested
      if (!includeHidden && entry.startsWith('.')) {
        continue;
      }

      // Apply filter if specified
      if (filter && !this.matchesFilter(entry, filter)) {
        continue;
      }

      const entryPath = path.join(dirPath, entry);
      const stats = await fs.stat(entryPath);

      const item = {
        name: entry,
        path: entryPath,
        type: stats.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        modified: stats.mtime.toISOString(),
        created: stats.birthtime.toISOString()
      };

      items.push(item);

      // Recurse into subdirectories if requested
      if (recursive && stats.isDirectory()) {
        const subItems = await this.listDirectory(entryPath, recursive, filter, includeHidden);
        items.push(...subItems);
      }
    }

    return items;
  }

  /**
   * Check if a filename matches the filter pattern
   * @param {string} filename - The filename to check
   * @param {string} filter - The filter pattern (supports * wildcards)
   * @returns {boolean} True if matches, false otherwise
   */
  matchesFilter(filename, filter) {
    // Convert glob pattern to regex
    const regexPattern = filter
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(filename);
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

export default DirectoryListTool;