import { ModularTool } from '@jsenvoy/module-loader';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Tool for creating directories in the file system
 */
class DirectoryCreatorTool extends ModularTool {
  constructor({ basePath, permissions = 0o755 }) {
    super();
    this.name = 'directory_creator';
    this.shortName = 'mkdir';
    this.description = 'Creates directories in the file system';
    this.parameters = {
      type: 'object',
      properties: {
        directoryPath: {
          type: 'string',
          description: 'The path of the directory to create'
        },
        recursive: {
          type: 'boolean',
          description: 'Whether to create parent directories if they don\'t exist (default: true)',
          default: true
        }
      },
      required: ['directoryPath']
    };

    // Store dependencies
    this.basePath = basePath;
    this.permissions = permissions;
  }

  /**
   * Execute the directory creator tool
   * @param {Object} args - The arguments
   * @param {string} args.directoryPath - The path of the directory to create
   * @param {boolean} args.recursive - Whether to create parent directories (default: true)
   * @returns {Promise<Object>} The creation result
   */
  async execute({ directoryPath, recursive = true } = {}) {
    try {
      // Validate input
      if (directoryPath === undefined) {
        throw new Error('Directory path is required');
      }

      if (typeof directoryPath !== 'string') {
        throw new Error('Directory path must be a string');
      }

      if (directoryPath.trim() === '') {
        throw new Error('Directory path cannot be empty');
      }

      // Check for null bytes (security)
      if (directoryPath.includes('\0')) {
        throw new Error('Invalid directory path');
      }

      // Resolve the directory path
      const resolvedPath = this.resolvePath(directoryPath);

      // Check if path is within allowed basePath
      if (!this.isPathAllowed(resolvedPath)) {
        throw new Error('Access denied: Path is outside allowed directory');
      }

      // Try to create the directory
      try {
        await fs.mkdir(resolvedPath, { 
          recursive, 
          mode: this.permissions 
        });

        return {
          success: true,
          path: resolvedPath,
          created: true
        };
      } catch (error) {
        // Handle specific error codes
        if (error.code === 'EEXIST') {
          // Directory already exists - check if it's actually a directory
          try {
            await fs.access(resolvedPath);
            const stats = await fs.stat(resolvedPath);
            if (stats.isDirectory()) {
              return {
                success: true,
                path: resolvedPath,
                created: false
              };
            } else {
              throw new Error('Path exists but is not a directory');
            }
          } catch (accessError) {
            // If we can't access the path to verify, re-throw the original error
            throw new Error('Path exists but is not a directory');
          }
        } else if (error.code === 'ENOENT' && !recursive) {
          throw new Error('Parent directory does not exist');
        } else if (error.code === 'EACCES') {
          throw new Error('Permission denied');
        } else {
          throw error;
        }
      }
    } catch (error) {
      if (error.message.startsWith('Directory path') || 
          error.message.startsWith('Access denied') ||
          error.message.startsWith('Invalid directory path') ||
          error.message.startsWith('Path exists') ||
          error.message.startsWith('Parent directory') ||
          error.message.startsWith('Permission denied')) {
        throw error;
      }
      throw new Error(`Failed to create directory: ${error.message}`);
    }
  }

  /**
   * Resolve the directory path relative to basePath
   * @param {string} directoryPath - The directory path to resolve
   * @returns {string} The resolved absolute path
   */
  resolvePath(directoryPath) {
    // If the path is absolute, return it as is (will be validated later)
    if (path.isAbsolute(directoryPath)) {
      return path.normalize(directoryPath);
    }
    
    // Otherwise, resolve relative to basePath
    return path.normalize(path.join(this.basePath, directoryPath));
  }

  /**
   * Check if the resolved path is within the allowed basePath
   * @param {string} resolvedPath - The resolved absolute path
   * @returns {boolean} True if allowed, false otherwise
   */
  isPathAllowed(resolvedPath) {
    // Use path.relative to determine if resolvedPath is within basePath
    const relative = path.relative(this.basePath, resolvedPath);
    
    // If the relative path starts with '..', it's outside the base path
    // If it's an absolute path (on Windows, starts with a drive letter),
    // it's also outside
    return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
  }
}

export default DirectoryCreatorTool;