/**
 * ReadManyFilesTool - Ported from Gemini CLI read-many-files.ts to Legion patterns
 * Reads multiple files efficiently with glob pattern support
 */

import { Tool } from '@legion/tools-registry';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Tool for reading multiple files (ported from Gemini CLI's read-many-files.ts)
 */
class ReadManyFilesTool extends Tool {
  constructor(moduleOrConfig, toolName = null) {
    // NEW PATTERN: Tool(module, toolName) - metadata comes from module
    if (toolName && moduleOrConfig?.getToolMetadata) {
      super(moduleOrConfig, toolName);
      
      // Get config from module  
      const config = moduleOrConfig.config || {};
      this.basePath = config.basePath || process.cwd();
      this.encoding = config.encoding || 'utf-8';
      this.shortName = 'readmany';
    } 
    // OLD PATTERN: Tool(config) - backwards compatibility
    else {
      const { basePath, encoding = 'utf-8' } = moduleOrConfig || {};
      
      super({
        name: 'read_many_files',
        shortName: 'readmany',
        description: 'Reads multiple files efficiently with glob pattern support (ported from Gemini CLI)',
        schema: {
          input: {
            type: 'object',
            properties: {
              paths: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of file paths or directory paths to read'
              },
              include: {
                type: 'array',
                items: { type: 'string' },
                description: 'Glob patterns for files to include (e.g., ["*.ts", "src/**/*.md"])'
              },
              exclude: {
                type: 'array',
                items: { type: 'string' },
                description: 'Glob patterns for files to exclude (e.g., ["*.log", "dist/**"])'
              },
              recursive: {
                type: 'boolean',
                description: 'Search directories recursively (default: true)',
                default: true
              }
            },
            required: ['paths']
          },
          output: {
            type: 'object',
            properties: {
              files: {
                type: 'array',
                description: 'Array of file contents',
                items: {
                  type: 'object',
                  properties: {
                    path: { type: 'string' },
                    content: { type: 'string' },
                    lines: { type: 'number' }
                  }
                }
              },
              totalFiles: {
                type: 'number',
                description: 'Total number of files read'
              }
            },
            required: ['files', 'totalFiles']
          }
        }
      });

      this.basePath = basePath || process.cwd();
      this.encoding = encoding;
    }
  }

  /**
   * Execute reading multiple files (core logic ported from Gemini CLI)
   * @param {Object} args - The arguments for reading multiple files
   * @returns {Promise<Object>} The file contents
   */
  async _execute(args) {
    try {
      const { paths, include = [], exclude = [], recursive = true } = args;

      // Validate input
      if (!Array.isArray(paths)) {
        throw new Error('Paths must be an array');
      }

      if (paths.length === 0) {
        throw new Error('At least one path must be provided');
      }

      // Collect all files to read (ported logic from Gemini CLI)
      const filesToRead = await this._collectFiles(paths, include, exclude, recursive);

      // Read all files (ported from Gemini CLI batch reading)
      const fileContents = await this._readFiles(filesToRead);

      return {
        files: fileContents,
        totalFiles: fileContents.length
      };

    } catch (error) {
      // Legion pattern: fail fast, no fallbacks
      throw new Error(error.message || 'Failed to read multiple files');
    }
  }

  /**
   * Collect all files matching criteria (ported from Gemini CLI)
   * @param {Array} paths - Base paths to search
   * @param {Array} include - Include patterns
   * @param {Array} exclude - Exclude patterns
   * @param {boolean} recursive - Search recursively
   * @returns {Promise<Array>} List of files to read
   */
  async _collectFiles(paths, include, exclude, recursive) {
    const allFiles = new Set();

    for (const searchPath of paths) {
      const resolvedPath = path.resolve(searchPath);

      try {
        const stats = await fs.stat(resolvedPath);

        if (stats.isFile()) {
          // Single file
          if (this._shouldIncludeFile(resolvedPath, include, exclude)) {
            allFiles.add(resolvedPath);
          }
        } else if (stats.isDirectory()) {
          // Directory - find matching files
          const dirFiles = await this._findFilesInDirectory(
            resolvedPath, 
            include, 
            exclude, 
            recursive
          );
          dirFiles.forEach(file => allFiles.add(file));
        }
      } catch (error) {
        console.warn(`Skipping path ${searchPath}: ${error.message}`);
      }
    }

    return Array.from(allFiles);
  }

  /**
   * Find files in directory matching criteria
   * @param {string} dirPath - Directory to search
   * @param {Array} include - Include patterns
   * @param {Array} exclude - Exclude patterns
   * @param {boolean} recursive - Search recursively
   * @returns {Promise<Array>} Matching files
   */
  async _findFilesInDirectory(dirPath, include, exclude, recursive) {
    const files = [];

    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });

      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);

        if (item.isFile()) {
          if (this._shouldIncludeFile(itemPath, include, exclude)) {
            files.push(itemPath);
          }
        } else if (item.isDirectory() && recursive && !item.name.startsWith('.')) {
          const subFiles = await this._findFilesInDirectory(
            itemPath, 
            include, 
            exclude, 
            recursive
          );
          files.push(...subFiles);
        }
      }
    } catch (error) {
      console.warn(`Skipping directory ${dirPath}: ${error.message}`);
    }

    return files;
  }

  /**
   * Check if file should be included based on patterns
   * @param {string} filePath - File path to check
   * @param {Array} include - Include patterns
   * @param {Array} exclude - Exclude patterns
   * @returns {boolean} Whether to include the file
   */
  _shouldIncludeFile(filePath, include, exclude) {
    const fileName = path.basename(filePath);
    const relativePath = path.relative(this.basePath, filePath);

    // Check exclude patterns first
    for (const pattern of exclude) {
      if (this._matchesPattern(fileName, pattern) || 
          this._matchesPattern(relativePath, pattern)) {
        return false;
      }
    }

    // If no include patterns, include all (except excluded)
    if (include.length === 0) {
      return true;
    }

    // Check include patterns
    for (const pattern of include) {
      if (this._matchesPattern(fileName, pattern) || 
          this._matchesPattern(relativePath, pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Simple pattern matching for file filtering
   * @param {string} fileName - File name to check
   * @param {string} pattern - Pattern to match against
   * @returns {boolean} Whether file matches pattern
   */
  _matchesPattern(fileName, pattern) {
    // Simple glob-like pattern matching
    if (pattern.includes('*')) {
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*');
      const regex = new RegExp(`^${regexPattern}$`, 'i');
      return regex.test(fileName);
    }
    
    return fileName === pattern;
  }

  /**
   * Read all collected files (ported from Gemini CLI batch reading)
   * @param {Array} filePaths - Files to read
   * @returns {Promise<Array>} File contents
   */
  async _readFiles(filePaths) {
    const results = [];

    for (const filePath of filePaths) {
      try {
        const content = await fs.readFile(filePath, this.encoding);
        const lines = content.split('\n').length;

        results.push({
          path: filePath,
          content,
          lines
        });
      } catch (error) {
        // Skip files we can't read
        console.warn(`Skipping file ${filePath}: ${error.message}`);
      }
    }

    return results;
  }
}

export default ReadManyFilesTool;