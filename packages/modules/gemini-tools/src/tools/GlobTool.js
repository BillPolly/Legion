/**
 * GlobTool - Ported from Gemini CLI glob.ts to Legion patterns
 * Fast file pattern matching with glob patterns
 */

import { Tool } from '@legion/tools-registry';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Tool for glob pattern file matching (ported from Gemini CLI's glob.ts)
 */
class GlobTool extends Tool {
  constructor(moduleOrConfig, toolName = null) {
    // NEW PATTERN: Tool(module, toolName) - metadata comes from module
    if (toolName && moduleOrConfig?.getToolMetadata) {
      super(moduleOrConfig, toolName);
      
      // Get config from module  
      const config = moduleOrConfig.config || {};
      this.basePath = config.basePath || process.cwd();
      this.shortName = 'glob';
    } 
    // OLD PATTERN: Tool(config) - backwards compatibility
    else {
      const { basePath } = moduleOrConfig || {};
      
      super({
        name: 'glob_pattern',
        shortName: 'glob',
        description: 'Fast file pattern matching with glob patterns (ported from Gemini CLI)',
        schema: {
          input: {
            type: 'object',
            properties: {
              pattern: {
                type: 'string',
                description: 'The glob pattern to match files against (e.g., "**/*.js", "src/**/*.ts")'
              },
              path: {
                type: 'string',
                description: 'The directory to search in (optional, defaults to current directory)',
                default: '.'
              },
              case_sensitive: {
                type: 'boolean',
                description: 'Whether the search should be case-sensitive (default: false)',
                default: false
              }
            },
            required: ['pattern']
          },
          output: {
            type: 'object',
            properties: {
              files: {
                type: 'array',
                description: 'Matching file paths',
                items: { type: 'string' }
              },
              totalFiles: {
                type: 'number',
                description: 'Total number of matching files'
              }
            },
            required: ['files', 'totalFiles']
          }
        }
      });

      this.basePath = basePath || process.cwd();
    }
  }

  /**
   * Execute the glob pattern matching (core logic ported from Gemini CLI)
   * @param {Object} args - The arguments for glob matching
   * @returns {Promise<Object>} The matching files
   */
  async _execute(args) {
    try {
      const { pattern, path: searchPath = '.', case_sensitive = false } = args;

      // Validate input
      if (typeof pattern !== 'string') {
        throw new Error('Pattern must be a string');
      }

      if (pattern.trim() === '') {
        throw new Error('Pattern cannot be empty');
      }

      // Resolve search path
      const resolvedPath = path.resolve(searchPath);

      // Check if search path exists
      try {
        await fs.access(resolvedPath);
      } catch (error) {
        throw new Error('Search path not found or not accessible');
      }

      // Find matching files (ported logic from Gemini CLI)
      const matches = await this._findMatches(resolvedPath, pattern, case_sensitive);

      // Sort files by recency then alphabetically (ported from Gemini CLI)
      const sortedMatches = this._sortFileEntries(matches);

      return {
        files: sortedMatches,
        totalFiles: sortedMatches.length
      };

    } catch (error) {
      // Legion pattern: fail fast, no fallbacks
      throw new Error(error.message || 'Failed to match glob pattern');
    }
  }

  /**
   * Find files matching glob pattern (ported logic from Gemini CLI)
   * @param {string} searchPath - Directory to search
   * @param {string} pattern - Glob pattern
   * @param {boolean} caseSensitive - Case sensitivity
   * @returns {Promise<Array>} Matching file paths with metadata
   */
  async _findMatches(searchPath, pattern, caseSensitive) {
    const matches = [];

    // Convert glob pattern to regex (simplified implementation)
    const regexPattern = this._globToRegex(pattern, caseSensitive);
    
    // Recursively search for matches
    await this._searchDirectory(searchPath, regexPattern, matches, searchPath);
    
    return matches;
  }

  /**
   * Recursively search directory for pattern matches
   * @param {string} currentPath - Current directory being searched
   * @param {RegExp} regexPattern - Compiled pattern
   * @param {Array} matches - Array to collect matches
   * @param {string} basePath - Base search path
   */
  async _searchDirectory(currentPath, regexPattern, matches, basePath) {
    try {
      const items = await fs.readdir(currentPath, { withFileTypes: true });

      for (const item of items) {
        const itemPath = path.join(currentPath, item.name);
        const relativePath = path.relative(basePath, itemPath);

        if (item.isFile()) {
          // Test file against pattern
          if (regexPattern.test(relativePath) || regexPattern.test(item.name)) {
            const stats = await fs.stat(itemPath);
            matches.push({
              fullpath: () => itemPath,
              mtimeMs: stats.mtimeMs
            });
          }
        } else if (item.isDirectory() && !item.name.startsWith('.')) {
          // Recurse into subdirectories (skip hidden dirs)
          await this._searchDirectory(itemPath, regexPattern, matches, basePath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
      console.warn(`Skipping directory ${currentPath}: ${error.message}`);
    }
  }

  /**
   * Convert glob pattern to regex (simplified implementation)
   * @param {string} pattern - Glob pattern
   * @param {boolean} caseSensitive - Case sensitivity
   * @returns {RegExp} Compiled regex
   */
  _globToRegex(pattern, caseSensitive) {
    let regexStr = pattern
      .replace(/\./g, '\\.')        // Escape dots
      .replace(/\*\*/g, '.*')       // ** matches any path
      .replace(/\*/g, '[^/]*')      // * matches any filename chars
      .replace(/\?/g, '.')          // ? matches single char
      .replace(/\{([^}]+)\}/g, '($1)') // {a,b} becomes (a|b)
      .replace(/,/g, '|');          // Convert comma to OR

    const flags = caseSensitive ? '' : 'i';
    return new RegExp(`^${regexStr}$`, flags);
  }

  /**
   * Sort file entries by recency then alphabetically (ported from Gemini CLI)
   * @param {Array} entries - File entries with metadata
   * @returns {Array} Sorted file paths
   */
  _sortFileEntries(entries) {
    const now = Date.now();
    const recencyThreshold = 24 * 60 * 60 * 1000; // 24 hours

    const sorted = [...entries].sort((a, b) => {
      const mtimeA = a.mtimeMs || 0;
      const mtimeB = b.mtimeMs || 0;
      const aIsRecent = now - mtimeA < recencyThreshold;
      const bIsRecent = now - mtimeB < recencyThreshold;

      if (aIsRecent && bIsRecent) {
        return mtimeB - mtimeA; // Recent files: newest first
      } else if (aIsRecent) {
        return -1; // Recent files come first
      } else if (bIsRecent) {
        return 1;  // Recent files come first
      } else {
        return a.fullpath().localeCompare(b.fullpath()); // Alphabetical for old files
      }
    });

    return sorted.map(entry => entry.fullpath());
  }
}

export default GlobTool;