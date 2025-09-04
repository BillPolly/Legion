/**
 * GlobTool - Find files by pattern matching
 */

import { Tool } from '@legion/tools-registry';
import fg from 'fast-glob';
import path from 'path';
import { promises as fs } from 'fs';

export class GlobTool extends Tool {
  constructor() {
    super({
      name: 'Glob',
      description: 'Fast file pattern matching tool that works with any codebase size',
      schema: {
        input: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              minLength: 1,
              description: 'Glob pattern to match files against (e.g., "**/*.js", "src/**/*.ts")'
            },
            path: {
              type: 'string',
              description: 'Directory to search in (defaults to current working directory)'
            },
            ignore: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'List of glob patterns to ignore'
            }
          },
          required: ['pattern']
        },
        output: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: 'The pattern that was searched'
            },
            matches: {
              type: 'array',
              description: 'Array of matching files with metadata, sorted by modification time',
              items: {
                type: 'object',
                properties: {
                  path: {
                    type: 'string',
                    description: 'Absolute path to the file'
                  },
                  relative_path: {
                    type: 'string',
                    description: 'Path relative to search directory'
                  },
                  size: {
                    type: 'number',
                    description: 'File size in bytes'
                  },
                  modified_time: {
                    type: 'string',
                    description: 'Last modification time (ISO string)'
                  }
                }
              }
            },
            total_matches: {
              type: 'number',
              description: 'Total number of matching files'
            },
            search_time_ms: {
              type: 'number',
              description: 'Time taken to search in milliseconds'
            }
          },
          required: ['pattern', 'matches', 'total_matches', 'search_time_ms']
        }
      }
    });
  }

  async _execute(input) {
    return await this.findFiles(input);
  }

  /**
   * Find files matching a glob pattern
   */
  async findFiles(input) {
    try {
      const { pattern, path: searchPath = process.cwd(), ignore = [] } = input;

      // Resolve the search path
      const basePath = path.resolve(searchPath);

      // Check if the base path exists
      try {
        const stats = await fs.stat(basePath);
        if (!stats.isDirectory()) {
          return {
            success: false,
            error: {
              code: 'INVALID_PARAMETER',
              message: `Path is not a directory: ${basePath}`,
              path: basePath
            }
          };
        }
      } catch (error) {
        if (error.code === 'ENOENT') {
          return {
            success: false,
            error: {
              code: 'RESOURCE_NOT_FOUND',
              message: `Directory not found: ${basePath}`,
              path: basePath
            }
          };
        }
        throw error;
      }

      const startTime = Date.now();

      // Find files using fast-glob
      const matches = await fg(pattern, {
        cwd: basePath,
        ignore: [...ignore, '**/node_modules/**', '**/.git/**'],
        absolute: true,
        stats: true,
        followSymbolicLinks: false
      });

      // Sort by modification time (newest first)
      matches.sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());

      // Format results
      const results = await Promise.all(matches.map(async (match) => {
        return {
          path: match.path,
          relative_path: path.relative(basePath, match.path),
          size: match.stats.size,
          modified_time: match.stats.mtime.toISOString()
        };
      }));

      const searchTime = Date.now() - startTime;

      return {
          pattern,
          matches: results,
          total_matches: results.length,
          search_time_ms: searchTime
        };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: `Failed to search files: ${error.message}`,
          details: error.stack
        }
      };
    }
  }

}