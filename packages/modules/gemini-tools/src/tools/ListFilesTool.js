/**
 * ListFilesTool - Ported from Gemini CLI ls.ts to Legion patterns  
 * Lists directory contents with metadata
 */

import { Tool } from '@legion/tools-registry';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Tool for listing directory contents (ported from Gemini CLI's ls.ts)
 */
class ListFilesTool extends Tool {
  constructor(moduleOrConfig, toolName = null) {
    // NEW PATTERN: Tool(module, toolName) - metadata comes from module
    if (toolName && moduleOrConfig?.getToolMetadata) {
      super(moduleOrConfig, toolName);
      
      // Get config from module  
      const config = moduleOrConfig.config || {};
      this.basePath = config.basePath || process.cwd();
      this.shortName = 'ls';
    } 
    // OLD PATTERN: Tool(config) - backwards compatibility
    else {
      const { basePath } = moduleOrConfig || {};
      
      super({
        name: 'list_files',
        shortName: 'ls',
        description: 'Lists files and directories in a specified path (ported from Gemini CLI)',
        schema: {
          input: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'The directory path to list'
              },
              recursive: {
                type: 'boolean',
                description: 'Whether to list recursively',
                default: false
              }
            },
            required: ['path']
          },
          output: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'The directory that was listed'
              },
              entries: {
                type: 'array',
                description: 'Directory entries',
                items: {
                  type: 'object'
                }
              }
            },
            required: ['path', 'entries']
          }
        }
      });

      this.basePath = basePath || process.cwd();
    }
  }

  /**
   * Execute the list files tool (core logic ported from Gemini CLI)
   * @param {Object} args - The arguments for listing directory
   * @returns {Promise<Object>} The result of listing the directory
   */
  async _execute(args) {
    try {
      const { path: dirPath, recursive = false } = args;

      // Validate input (ported from Gemini CLI validation)
      if (typeof dirPath !== 'string') {
        throw new Error('Directory path must be a string');
      }

      if (dirPath.trim() === '') {
        throw new Error('Directory path cannot be empty');
      }

      // Security check for null bytes
      if (dirPath.includes('\0')) {
        throw new Error('Invalid directory path');
      }

      // Resolve the directory path
      const resolvedPath = path.resolve(dirPath);

      // Check directory accessibility
      try {
        const stats = await fs.stat(resolvedPath);
        if (!stats.isDirectory()) {
          throw new Error('Path is not a directory');
        }
      } catch (error) {
        if (error.code === 'ENOENT') {
          throw new Error('Directory not found');
        }
        if (error.message === 'Path is not a directory') {
          throw error; // Re-throw our custom error
        }
        throw new Error('Directory not accessible');
      }

      // Read directory contents (ported logic from Gemini CLI)
      const entries = await this._listDirectory(resolvedPath, recursive);

      return {
        path: resolvedPath,
        entries
      };

    } catch (error) {
      // Legion pattern: fail fast, no fallbacks
      throw new Error(error.message || 'Failed to list directory');
    }
  }

  /**
   * Internal method to list directory contents
   * @param {string} dirPath - Directory to list
   * @param {boolean} recursive - Whether to recurse
   * @returns {Promise<Array>} Directory entries
   */
  async _listDirectory(dirPath, recursive = false) {
    const entries = [];
    
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });

      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);
        
        const entry = {
          name: item.name,
          type: item.isDirectory() ? 'directory' : 'file',
          path: itemPath
        };

        // Add file stats (ported from Gemini CLI metadata handling)
        try {
          const stats = await fs.stat(itemPath);
          entry.size = stats.size;
          entry.modified = stats.mtime.toISOString();
        } catch (statsError) {
          // Don't fail if we can't get stats
          entry.size = 0;
          entry.modified = null;
        }

        entries.push(entry);

        // Recursive listing if requested
        if (recursive && item.isDirectory()) {
          try {
            const subEntries = await this._listDirectory(itemPath, true);
            entries.push(...subEntries);
          } catch (recurseError) {
            // Skip directories we can't access
            console.warn(`Skipping directory ${itemPath}: ${recurseError.message}`);
          }
        }
      }
    } catch (error) {
      throw new Error(`Failed to read directory: ${error.message}`);
    }

    return entries.sort((a, b) => {
      // Sort directories first, then files
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }
}

export default ListFilesTool;