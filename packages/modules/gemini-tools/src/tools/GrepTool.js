/**
 * GrepTool - Ported from Gemini CLI grep.ts to Legion patterns
 * Searches for patterns in file contents
 */

import { Tool } from '@legion/tools-registry';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Tool for searching file contents (ported from Gemini CLI's grep.ts)
 */
class GrepTool extends Tool {
  constructor(moduleOrConfig, toolName = null) {
    // NEW PATTERN: Tool(module, toolName) - metadata comes from module
    if (toolName && moduleOrConfig?.getToolMetadata) {
      super(moduleOrConfig, toolName);
      
      // Get config from module  
      const config = moduleOrConfig.config || {};
      this.basePath = config.basePath || process.cwd();
      this.shortName = 'grep';
    } 
    // OLD PATTERN: Tool(config) - backwards compatibility
    else {
      const { basePath } = moduleOrConfig || {};
      
      super({
        name: 'grep_search',
        shortName: 'grep',
        description: 'Searches for patterns in file contents (ported from Gemini CLI)',
        schema: {
          input: {
            type: 'object',
            properties: {
              pattern: {
                type: 'string',
                description: 'The regular expression pattern to search for'
              },
              path: {
                type: 'string',
                description: 'The directory to search in (optional)',
                default: '.'
              },
              include: {
                type: 'string',
                description: 'File pattern to include (e.g. "*.js", "*.{ts,tsx}")'
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
                description: 'Total number of matches found'
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
   * Execute the grep search tool (core logic ported from Gemini CLI)
   * @param {Object} args - The arguments for searching
   * @returns {Promise<Object>} The search results
   */
  async _execute(args) {
    try {
      const { pattern, path: searchPath = '.', include } = args;

      // Validate input
      if (typeof pattern !== 'string') {
        throw new Error('Pattern must be a string');
      }

      if (pattern.trim() === '') {
        throw new Error('Pattern cannot be empty');
      }

      // Resolve search path
      const resolvedPath = path.resolve(searchPath);

      // Create regex from pattern (ported logic from Gemini CLI)
      let regex;
      try {
        regex = new RegExp(pattern, 'i'); // Case-insensitive like Gemini CLI default
      } catch (error) {
        throw new Error(`Invalid regex pattern: ${pattern}`);
      }

      // Search for matches
      const matches = await this._searchFiles(resolvedPath, regex, include);

      return {
        matches,
        totalMatches: matches.length
      };

    } catch (error) {
      // Legion pattern: fail fast, no fallbacks
      throw new Error(error.message || 'Failed to search files');
    }
  }

  /**
   * Internal method to search files recursively
   * @param {string} searchPath - Directory to search
   * @param {RegExp} regex - Pattern to search for
   * @param {string} include - File inclusion pattern  
   * @returns {Promise<Array>} Search matches
   */
  async _searchFiles(searchPath, regex, include) {
    const matches = [];
    
    try {
      const stats = await fs.stat(searchPath);
      
      if (stats.isFile()) {
        // Single file search
        const fileMatches = await this._searchInFile(searchPath, regex);
        matches.push(...fileMatches);
      } else if (stats.isDirectory()) {
        // Directory search
        const files = await this._findFiles(searchPath, include);
        
        for (const filePath of files) {
          try {
            const fileMatches = await this._searchInFile(filePath, regex);
            matches.push(...fileMatches);
          } catch (error) {
            // Skip files we can't read (permission issues, binary files, etc.)
            console.warn(`Skipping file ${filePath}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      throw new Error(`Search path error: ${error.message}`);
    }

    return matches;
  }

  /**
   * Search within a single file
   * @param {string} filePath - File to search
   * @param {RegExp} regex - Pattern to search for
   * @returns {Promise<Array>} Matches in this file
   */
  async _searchInFile(filePath, regex) {
    const matches = [];
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (regex.test(line)) {
          matches.push({
            filePath,
            lineNumber: i + 1,
            line: line.trim()
          });
        }
      }
    } catch (error) {
      // Skip binary files and permission issues
      if (error.code !== 'EISDIR') {
        throw error;
      }
    }
    
    return matches;
  }

  /**
   * Find files matching inclusion pattern
   * @param {string} searchPath - Directory to search
   * @param {string} include - File inclusion pattern
   * @returns {Promise<Array>} List of file paths
   */
  async _findFiles(searchPath, include) {
    const files = [];
    
    const items = await fs.readdir(searchPath, { withFileTypes: true });
    
    for (const item of items) {
      const itemPath = path.join(searchPath, item.name);
      
      if (item.isFile()) {
        // Skip backup files (created by edit tool)
        if (item.name.includes('.backup.')) {
          continue;
        }
        
        // Check if file matches include pattern
        if (!include || this._matchesPattern(item.name, include)) {
          files.push(itemPath);
        }
      } else if (item.isDirectory() && !item.name.startsWith('.')) {
        // Recursively search subdirectories (skip hidden directories)
        try {
          const subFiles = await this._findFiles(itemPath, include);
          files.push(...subFiles);
        } catch (error) {
          // Skip directories we can't access
          console.warn(`Skipping directory ${itemPath}: ${error.message}`);
        }
      }
    }
    
    return files;
  }

  /**
   * Simple pattern matching for file inclusion
   * @param {string} fileName - File name to check
   * @param {string} pattern - Pattern to match against
   * @returns {boolean} Whether file matches pattern
   */
  _matchesPattern(fileName, pattern) {
    // Simple glob-like pattern matching
    if (pattern.startsWith('*') && pattern.includes('.')) {
      const extension = pattern.substring(1); // Remove *
      return fileName.endsWith(extension);
    }
    
    // Exact match
    return fileName === pattern;
  }
}

export default GrepTool;