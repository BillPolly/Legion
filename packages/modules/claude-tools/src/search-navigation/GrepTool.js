/**
 * GrepTool - Search file contents using regex patterns
 * Note: This is a simplified implementation without ripgrep dependency for MVP
 */

import { Tool } from '@legion/tools-registry';
import { promises as fs } from 'fs';
import path from 'path';
import fg from 'fast-glob';

export class GrepTool extends Tool {
  constructor() {
    super({
      name: 'Grep',
      description: 'A powerful search tool for file contents with regex support and multiple output modes',
      schema: {
        input: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              minLength: 1,
              description: 'The regular expression pattern to search for in file contents'
            },
            path: {
              type: 'string',
              description: 'File or directory to search in (defaults to current working directory)'
            },
            glob: {
              type: 'string',
              description: 'Glob pattern to filter files (e.g. "*.js", "**/*.tsx")'
            },
            type: {
              type: 'string',
              description: 'File type to search (js, py, rust, go, java, ts, json, md, txt). More efficient than glob for standard file types.'
            },
            output_mode: {
              type: 'string',
              enum: ['content', 'files_with_matches', 'count'],
              description: 'Output mode: "content" shows matching lines, "files_with_matches" shows file paths (default), "count" shows match counts',
              default: 'files_with_matches'
            },
            case_insensitive: {
              type: 'boolean',
              description: 'Case insensitive search',
              default: false
            },
            show_line_numbers: {
              type: 'boolean',
              description: 'Show line numbers in output (requires output_mode: "content")',
              default: false
            },
            context_before: {
              type: 'integer',
              minimum: 0,
              description: 'Number of lines to show before each match (requires output_mode: "content")',
              default: 0
            },
            context_after: {
              type: 'integer',
              minimum: 0,
              description: 'Number of lines to show after each match (requires output_mode: "content")',
              default: 0
            },
            context_around: {
              type: 'integer',
              minimum: 0,
              description: 'Number of lines to show before and after each match (requires output_mode: "content")',
              default: 0
            },
            multiline: {
              type: 'boolean',
              description: 'Enable multiline mode where . matches newlines and patterns can span lines',
              default: false
            },
            head_limit: {
              type: 'integer',
              minimum: 1,
              description: 'Limit output to first N lines/entries/results. Works across all output modes.'
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
            results: {
              type: 'array',
              description: 'Search results with file matches and line details'
            },
            files: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'List of files containing matches (files_with_matches mode)'
            },
            total_matches: {
              type: 'number',
              description: 'Total number of matches found'
            },
            total_files: {
              type: 'number',
              description: 'Total number of files searched'
            },
            files_with_matches: {
              type: 'number',
              description: 'Number of files containing matches'
            },
            search_time_ms: {
              type: 'number',
              description: 'Time taken to search in milliseconds'
            }
          }
        }
      }
    });
  }

  async _execute(input) {
    return await this.searchContent(input);
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

}