/**
 * GrepTool - Search file contents using regex patterns
 * Note: This is a simplified implementation without ripgrep dependency for MVP
 */

import { Tool } from '@legion/tools-registry';
import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';
import fg from 'fast-glob';

// Input schema for validation
const grepToolSchema = z.object({
  pattern: z.string().min(1),
  path: z.string().optional(),
  glob: z.string().optional(),
  type: z.string().optional(),
  output_mode: z.enum(['content', 'files_with_matches', 'count']).optional().default('files_with_matches'),
  case_insensitive: z.boolean().optional().default(false),
  show_line_numbers: z.boolean().optional().default(false),
  context_before: z.number().int().min(0).optional().default(0),
  context_after: z.number().int().min(0).optional().default(0),
  context_around: z.number().int().min(0).optional().default(0),
  multiline: z.boolean().optional().default(false),
  head_limit: z.number().int().positive().optional()
});

export class GrepTool extends Tool {
  constructor() {
    super({
      name: 'Grep',
      description: 'Search file contents using regex patterns',
      inputSchema: grepToolSchema,
      execute: async (input) => this.searchContent(input),
      getMetadata: () => this.getToolMetadata()
    });
  }

  /**
   * Search file contents
   */
  async searchContent(input) {
    try {
      const {
        pattern,
        path: searchPath = process.cwd(),
        glob: globPattern = '**/*',
        type: fileType,
        output_mode = 'files_with_matches',
        case_insensitive = false,
        show_line_numbers = false,
        context_before = 0,
        context_after = 0,
        context_around = 0,
        multiline = false,
        head_limit
      } = input;

      const startTime = Date.now();

      // Build regex
      const flags = case_insensitive ? 'gi' : 'g';
      const regex = new RegExp(pattern, flags + (multiline ? 'm' : ''));

      // Determine file patterns
      let filePattern = globPattern;
      if (fileType) {
        const typePatterns = {
          js: '**/*.{js,jsx,mjs,cjs}',
          py: '**/*.py',
          rust: '**/*.rs',
          go: '**/*.go',
          java: '**/*.java',
          ts: '**/*.{ts,tsx}',
          json: '**/*.json',
          md: '**/*.md',
          txt: '**/*.txt'
        };
        filePattern = typePatterns[fileType] || globPattern;
      }

      // Find files to search
      const files = await fg(filePattern, {
        cwd: searchPath,
        absolute: true,
        ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**']
      });

      // Search in files
      const results = [];
      let totalMatches = 0;

      for (const filePath of files) {
        try {
          const content = await fs.readFile(filePath, 'utf8');
          const lines = content.split('\n');
          const fileMatches = [];

          // Search line by line
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineMatches = [...line.matchAll(new RegExp(pattern, flags))];
            
            if (lineMatches.length > 0) {
              const contextBefore = Math.max(context_around, context_before);
              const contextAfter = Math.max(context_around, context_after);
              
              const match = {
                line_number: i + 1,
                line_content: line,
                match_start: lineMatches[0].index,
                match_end: lineMatches[0].index + lineMatches[0][0].length
              };

              if (contextBefore > 0) {
                match.context_before = lines.slice(Math.max(0, i - contextBefore), i);
              }
              if (contextAfter > 0) {
                match.context_after = lines.slice(i + 1, Math.min(lines.length, i + 1 + contextAfter));
              }

              fileMatches.push(match);
              totalMatches++;
            }
          }

          if (fileMatches.length > 0) {
            results.push({
              file_path: filePath,
              matches: fileMatches,
              match_count: fileMatches.length
            });
          }

          // Apply head limit if specified
          if (head_limit && results.length >= head_limit) {
            break;
          }
        } catch (error) {
          // Skip binary files or unreadable files
          continue;
        }
      }

      const searchTime = Date.now() - startTime;

      // Format output based on mode
      let outputData;
      if (output_mode === 'files_with_matches') {
        outputData = {
          pattern,
          files: results.map(r => r.file_path),
          total_files: results.length,
          search_time_ms: searchTime
        };
      } else if (output_mode === 'count') {
        outputData = {
          pattern,
          total_matches: totalMatches,
          files_with_matches: results.length,
          search_time_ms: searchTime
        };
      } else {
        // content mode
        outputData = {
          pattern,
          results: head_limit ? results.slice(0, head_limit) : results,
          total_matches: totalMatches,
          search_time_ms: searchTime
        };
      }

      return {
        success: true,
        data: outputData
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: `Failed to search content: ${error.message}`,
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
      name: 'Grep',
      description: 'Search file contents using regex patterns',
      input: {
        pattern: {
          type: 'string',
          required: true,
          description: 'Regex pattern to search for'
        },
        path: {
          type: 'string',
          required: false,
          description: 'Directory to search in'
        },
        glob: {
          type: 'string',
          required: false,
          description: 'File pattern filter'
        },
        type: {
          type: 'string',
          required: false,
          description: 'File type filter (js, py, rust, etc.)'
        },
        output_mode: {
          type: 'string',
          required: false,
          description: 'Output format (content, files_with_matches, count)'
        },
        case_insensitive: {
          type: 'boolean',
          required: false,
          description: 'Case insensitive search'
        }
      },
      output: {
        pattern: {
          type: 'string',
          description: 'The pattern that was searched'
        },
        results: {
          type: 'array',
          description: 'Search results'
        },
        total_matches: {
          type: 'number',
          description: 'Total number of matches'
        },
        search_time_ms: {
          type: 'number',
          description: 'Search time in milliseconds'
        }
      }
    };
  }
}