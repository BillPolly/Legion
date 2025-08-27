/**
 * LSTool - List files and directories in a given path
 */

import { Tool } from '@legion/tools-registry';
import { promises as fs } from 'fs';
import path from 'path';

export class LSTool extends Tool {
  constructor() {
    super({
      name: 'LS',
      description: 'Lists files and directories in a given path with detailed metadata',
      schema: {
        input: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              minLength: 1,
              description: 'The absolute path to the directory to list'
            },
            ignore: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'List of glob patterns to ignore'
            }
          },
          required: ['path']
        },
        output: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The absolute path that was listed'
            },
            entries: {
              type: 'array',
              description: 'Array of directory entries sorted by type (directories first) then alphabetically',
              items: {
                type: 'object',
                properties: {
                  name: {
                    type: 'string',
                    description: 'Name of the file or directory'
                  },
                  type: {
                    type: 'string',
                    enum: ['directory', 'file', 'symlink', 'unknown'],
                    description: 'Type of the entry'
                  },
                  permissions: {
                    type: 'string',
                    description: 'File permissions in rwxrwxrwx format'
                  },
                  size: {
                    type: 'number',
                    description: 'Size in bytes (only for files)'
                  },
                  modified_time: {
                    type: 'string',
                    description: 'Last modification time (ISO string)'
                  },
                  created_time: {
                    type: 'string',
                    description: 'Creation time (ISO string)'
                  },
                  error: {
                    type: 'string',
                    description: 'Error message if entry could not be accessed'
                  }
                }
              }
            },
            total_entries: {
              type: 'number',
              description: 'Total number of entries listed'
            }
          },
          required: ['path', 'entries', 'total_entries']
        }
      },
      execute: async (input) => this.listDirectory(input)
    });
  }

  /**
   * List directory contents
   */
  async listDirectory(input) {
    try {
      const { path: dirPath, ignore = [] } = input;

      // Resolve to absolute path
      const absolutePath = path.resolve(dirPath);

      // Check if directory exists
      let stats;
      try {
        stats = await fs.stat(absolutePath);
      } catch (error) {
        if (error.code === 'ENOENT') {
          return {
            success: false,
            error: {
              code: 'RESOURCE_NOT_FOUND',
              message: `Path not found: ${absolutePath}`,
              path: absolutePath
            }
          };
        }
        if (error.code === 'EACCES') {
          return {
            success: false,
            error: {
              code: 'PERMISSION_DENIED',
              message: `Permission denied: ${absolutePath}`,
              path: absolutePath
            }
          };
        }
        throw error;
      }

      // Check if it's a directory
      if (!stats.isDirectory()) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMETER',
            message: `Path is not a directory: ${absolutePath}`,
            path: absolutePath
          }
        };
      }

      // Read directory contents
      const items = await fs.readdir(absolutePath, { withFileTypes: true });
      
      // Build ignore patterns
      const ignorePatterns = ignore.map(pattern => {
        // Convert glob patterns to regex for filtering
        return new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
      });

      // Process each item
      const entries = [];
      for (const item of items) {
        // Check if should be ignored
        const shouldIgnore = ignorePatterns.some(pattern => pattern.test(item.name));
        if (shouldIgnore) continue;

        const itemPath = path.join(absolutePath, item.name);
        
        try {
          const itemStats = await fs.stat(itemPath);
          
          const entry = {
            name: item.name,
            type: item.isDirectory() ? 'directory' : item.isSymbolicLink() ? 'symlink' : 'file',
            permissions: this.formatPermissions(itemStats.mode),
            modified_time: itemStats.mtime.toISOString(),
            created_time: itemStats.birthtime.toISOString()
          };

          // Add size for files
          if (!item.isDirectory()) {
            entry.size = itemStats.size;
          }

          entries.push(entry);
        } catch (error) {
          // Skip items we can't stat (broken symlinks, etc.)
          entries.push({
            name: item.name,
            type: item.isSymbolicLink() ? 'symlink' : 'unknown',
            error: error.message
          });
        }
      }

      // Sort entries: directories first, then alphabetically
      entries.sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (a.type !== 'directory' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
      });

      return {
        success: true,
        data: {
          path: absolutePath,
          entries,
          total_entries: entries.length
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: `Failed to list directory: ${error.message}`,
          details: error.stack
        }
      };
    }
  }

  /**
   * Format file permissions as string
   */
  formatPermissions(mode) {
    const permissions = [
      (mode & 0o400) ? 'r' : '-',
      (mode & 0o200) ? 'w' : '-',
      (mode & 0o100) ? 'x' : '-',
      (mode & 0o040) ? 'r' : '-',
      (mode & 0o020) ? 'w' : '-',
      (mode & 0o010) ? 'x' : '-',
      (mode & 0o004) ? 'r' : '-',
      (mode & 0o002) ? 'w' : '-',
      (mode & 0o001) ? 'x' : '-'
    ].join('');
    
    return permissions;
  }

}