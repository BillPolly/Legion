/**
 * RipGrepTool - Ported from Gemini CLI ripGrep.ts to Legion patterns
 * Fast text search with ripgrep-like functionality
 */

import { Tool } from '@legion/tools-registry';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Tool for fast text search (ported from Gemini CLI's ripGrep.ts)
 */
class RipGrepTool extends Tool {
  constructor(moduleOrConfig, toolName = null) {
    // NEW PATTERN: Tool(module, toolName) - metadata comes from module
    if (toolName && moduleOrConfig?.getToolMetadata) {
      super(moduleOrConfig, toolName);
      
      // Get config from module  
      const config = moduleOrConfig.config || {};
      this.basePath = config.basePath || process.cwd();
      this.shortName = 'rg';
    } 
    // OLD PATTERN: Tool(config) - backwards compatibility
    else {
      const { basePath } = moduleOrConfig || {};
      
      super({
        name: 'ripgrep_search',
        shortName: 'rg',
        description: 'Fast text search with ripgrep-like functionality (ported from Gemini CLI)',
        schema: {
          input: {
            type: 'object',
            properties: {
              pattern: {
                type: 'string',
                description: 'The search pattern (regex supported)'
              },
              path: {
                type: 'string',
                description: 'The directory to search in (optional)',
                default: '.'
              },
              file_type: {
                type: 'string',
                description: 'File type filter (e.g., "js", "ts", "py")'
              },
              ignore_case: {
                type: 'boolean',
                description: 'Ignore case in search (default: false)',
                default: false
              }
            },
            required: ['pattern']
          },
          output: {
            type: 'object',
            properties: {
              matches: {
                type: 'array',
                description: 'Search matches found'
              },
              totalMatches: {
                type: 'number',
                description: 'Total number of matches'
              },
              searchedFiles: {
                type: 'number',
                description: 'Number of files searched'
              }
            },
            required: ['matches', 'totalMatches']
          }
        }
      });

      this.basePath = basePath || process.cwd();
    }
  }

  /**
   * Execute ripgrep search (enhanced search ported from Gemini CLI)
   * @param {Object} args - The arguments for ripgrep search
   * @returns {Promise<Object>} The search results
   */
  async _execute(args) {
    try {
      const { pattern, path: searchPath = '.', file_type, ignore_case = false } = args;

      // Validate input
      if (typeof pattern !== 'string') {
        throw new Error('Pattern must be a string');
      }

      if (pattern.trim() === '') {
        throw new Error('Pattern cannot be empty');
      }

      // Create regex with options (ported from Gemini CLI)
      const flags = ignore_case ? 'gi' : 'g';
      let regex;
      try {
        regex = new RegExp(pattern, flags);
      } catch (error) {
        throw new Error(`Invalid regex pattern: ${pattern}`);
      }

      // Perform enhanced search (ported ripgrep-like functionality)
      const searchResults = await this._performRipGrepSearch(
        path.resolve(searchPath),
        regex,
        file_type
      );

      return {
        matches: searchResults.matches,
        totalMatches: searchResults.matches.length,
        searchedFiles: searchResults.filesSearched
      };

    } catch (error) {
      // Legion pattern: fail fast, no fallbacks
      throw new Error(error.message || 'Failed to perform ripgrep search');
    }
  }

  /**
   * Perform ripgrep-like search (enhanced from basic grep)
   * @param {string} searchPath - Directory to search
   * @param {RegExp} regex - Search pattern
   * @param {string} fileType - File type filter
   * @returns {Promise<Object>} Search results
   */
  async _performRipGrepSearch(searchPath, regex, fileType) {
    const matches = [];
    let filesSearched = 0;

    // Get files to search with type filtering
    const files = await this._getSearchableFiles(searchPath, fileType);

    for (const filePath of files) {
      try {
        filesSearched++;
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const match = regex.exec(line);
          
          if (match) {
            matches.push({
              filePath,
              lineNumber: i + 1,
              line: line.trim(),
              matchStart: match.index,
              matchText: match[0]
            });
          }
        }
      } catch (error) {
        // Skip files we can't read
        console.warn(`Skipping file ${filePath}: ${error.message}`);
      }
    }

    return { matches, filesSearched };
  }

  /**
   * Get files to search with type filtering (ripgrep-like file filtering)
   * @param {string} searchPath - Path to search
   * @param {string} fileType - File type filter
   * @returns {Promise<Array>} Files to search
   */
  async _getSearchableFiles(searchPath, fileType) {
    const files = [];
    
    const typeExtensions = {
      'js': ['.js', '.jsx'],
      'ts': ['.ts', '.tsx'],
      'py': ['.py'],
      'java': ['.java'],
      'cpp': ['.cpp', '.cxx', '.cc'],
      'c': ['.c', '.h'],
      'go': ['.go'],
      'rust': ['.rs'],
      'php': ['.php'],
      'rb': ['.rb'],
      'cs': ['.cs'],
      'kt': ['.kt']
    };

    await this._collectFiles(searchPath, files, typeExtensions[fileType]);
    
    return files;
  }

  /**
   * Recursively collect files with extension filtering
   * @param {string} dirPath - Directory to search
   * @param {Array} files - Array to collect files
   * @param {Array} allowedExtensions - Extensions to include
   */
  async _collectFiles(dirPath, files, allowedExtensions) {
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });

      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);

        if (item.isFile()) {
          if (!allowedExtensions || allowedExtensions.includes(path.extname(item.name))) {
            files.push(itemPath);
          }
        } else if (item.isDirectory() && !item.name.startsWith('.')) {
          await this._collectFiles(itemPath, files, allowedExtensions);
        }
      }
    } catch (error) {
      console.warn(`Skipping directory ${dirPath}: ${error.message}`);
    }
  }
}

export default RipGrepTool;