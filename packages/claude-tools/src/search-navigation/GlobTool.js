/**
 * GlobTool - Find files by pattern matching
 */

import { Tool } from '@legion/tools-registry';
import { z } from 'zod';
import fg from 'fast-glob';
import path from 'path';
import { promises as fs } from 'fs';

// Input schema for validation
const globToolSchema = z.object({
  pattern: z.string().min(1),
  path: z.string().optional(),
  ignore: z.array(z.string()).optional()
});

export class GlobTool extends Tool {
  constructor() {
    super({
      name: 'Glob',
      description: 'Find files by pattern matching (e.g., "**/*.js")',
      inputSchema: globToolSchema,
      execute: async (input) => this.findFiles(input),
      getMetadata: () => this.getToolMetadata()
    });
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
        success: true,
        data: {
          pattern,
          matches: results,
          total_matches: results.length,
          search_time_ms: searchTime
        }
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

  /**
   * Get tool metadata
   */
  getToolMetadata() {
    return {
      name: 'Glob',
      description: 'Find files by pattern matching (e.g., "**/*.js")',
      input: {
        pattern: {
          type: 'string',
          required: true,
          description: 'Glob pattern to match files'
        },
        path: {
          type: 'string',
          required: false,
          description: 'Base directory to search (defaults to current directory)'
        },
        ignore: {
          type: 'array',
          required: false,
          description: 'Patterns to ignore'
        }
      },
      output: {
        pattern: {
          type: 'string',
          description: 'The pattern that was searched'
        },
        matches: {
          type: 'array',
          description: 'Array of matching files with metadata'
        },
        total_matches: {
          type: 'number',
          description: 'Total number of matching files'
        },
        search_time_ms: {
          type: 'number',
          description: 'Time taken to search in milliseconds'
        }
      }
    };
  }
}