/**
 * FileSystem Module
 * Provides file system operations as tools
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { glob } from 'glob';
import { ModuleDefinition } from './ModuleDefinition.js';
import { ModuleInstance } from './ModuleInstance.js';
import { Tool } from './Tool.js';
import { generateHandle } from '../utils/HandleManager.js';

/**
 * FileSystemModuleDefinition
 */
export class FileSystemModuleDefinition extends ModuleDefinition {
  static async create(config) {
    // Validate and set defaults
    const validatedConfig = {
      basePath: config.basePath || process.cwd(),
      allowWrite: config.allowWrite !== false,
      allowDelete: config.allowDelete !== false,
      maxFileSize: config.maxFileSize || 10 * 1024 * 1024, // 10MB default
      followSymlinks: config.followSymlinks !== false,
      ...config
    };

    // Resolve base path to absolute
    validatedConfig.basePath = path.resolve(validatedConfig.basePath);

    // Create instance
    const instance = new FileSystemModuleInstance(this, validatedConfig);
    await instance.initialize();
    
    return instance;
  }

  static getMetadata() {
    return {
      name: 'FileSystemModule',
      description: 'File system operations module',
      version: '1.0.0',
      tools: {
        readFile: {
          description: 'Read file contents',
          input: { path: 'string', encoding: 'string?' },
          output: { content: 'string|Buffer', path: 'string' }
        },
        writeFile: {
          description: 'Write file contents',
          input: { path: 'string', content: 'string|Buffer', encoding: 'string?' },
          output: { path: 'string' }
        },
        appendFile: {
          description: 'Append to file',
          input: { path: 'string', content: 'string', encoding: 'string?' },
          output: { path: 'string' }
        },
        deleteFile: {
          description: 'Delete a file',
          input: { path: 'string' },
          output: { deleted: 'boolean' }
        },
        exists: {
          description: 'Check if path exists',
          input: { path: 'string' },
          output: { exists: 'boolean', isFile: 'boolean?', isDirectory: 'boolean?' }
        },
        stat: {
          description: 'Get file/directory statistics',
          input: { path: 'string' },
          output: { size: 'number', mtime: 'Date', isFile: 'boolean', isDirectory: 'boolean' }
        },
        mkdir: {
          description: 'Create directory',
          input: { path: 'string', recursive: 'boolean?' },
          output: { path: 'string' }
        },
        rmdir: {
          description: 'Remove directory',
          input: { path: 'string', recursive: 'boolean?' },
          output: { deleted: 'boolean' }
        },
        listDir: {
          description: 'List directory contents',
          input: { path: 'string' },
          output: { entries: 'Array<{name: string, type: string}>' }
        },
        copyFile: {
          description: 'Copy file',
          input: { source: 'string', destination: 'string' },
          output: { destination: 'string' }
        },
        moveFile: {
          description: 'Move/rename file',
          input: { source: 'string', destination: 'string' },
          output: { destination: 'string' }
        },
        findFiles: {
          description: 'Find files matching pattern',
          input: { pattern: 'string', cwd: 'string?' },
          output: { files: 'Array<string>' }
        },
        watchFile: {
          description: 'Watch file for changes',
          input: { path: 'string' },
          output: { handle: 'string', type: 'string' }
        },
        checksum: {
          description: 'Calculate file checksum',
          input: { path: 'string', algorithm: 'string?' },
          output: { checksum: 'string', algorithm: 'string' }
        },
        chmod: {
          description: 'Change file permissions',
          input: { path: 'string', mode: 'string' },
          output: { path: 'string' }
        }
      }
    };
  }
}

/**
 * FileSystemModuleInstance
 */
export class FileSystemModuleInstance extends ModuleInstance {
  constructor(moduleDefinition, config) {
    super(moduleDefinition, config);
    this.watchers = new Map();
  }

  async initialize() {
    // Ensure base path exists
    try {
      await fs.access(this.config.basePath);
    } catch {
      // Create base path if it doesn't exist
      await fs.mkdir(this.config.basePath, { recursive: true });
    }
    
    this.createTools();
  }

  /**
   * Validate and resolve path within base directory
   */
  resolvePath(inputPath) {
    const resolved = path.resolve(this.config.basePath, inputPath);
    
    // Security: Prevent path traversal
    if (!resolved.startsWith(this.config.basePath)) {
      throw {
        code: 'FORBIDDEN',
        message: 'Path traversal detected'
      };
    }
    
    return resolved;
  }

  createTools() {
    // Read File
    const readFileTool = new Tool({
      name: 'readFile',
      execute: async (input) => {
        try {
          const filePath = this.resolvePath(input.path);
          const encoding = input.encoding === 'binary' ? null : (input.encoding || 'utf8');
          
          // Emit progress event from the tool
          readFileTool.progress(`Reading file: ${input.path}`, 0);
          
          const content = await fs.readFile(filePath, encoding);
          
          // Emit completion from the tool
          readFileTool.progress(`File read successfully: ${input.path}`, 100, {
            size: content.length
          });
          
          return {
            success: true,
            data: {
              content,
              path: filePath
            }
          };
        } catch (error) {
          // Emit error event from the tool
          readFileTool.error(`Failed to read file: ${input.path}`, {
            code: error.code || 'READ_ERROR',
            details: error.message
          });
          
          return {
            success: false,
            data: {
              errorMessage: error.message,
              code: error.code || 'READ_ERROR',
              stackTrace: error.stack
            }
          };
        }
      },
      getMetadata: () => FileSystemModuleDefinition.getMetadata().tools.readFile
    });
    
    // Register the tool to forward events
    this.registerTool('readFile', readFileTool);

    // Write File
    const writeFileTool = new Tool({
      name: 'writeFile',
      execute: async (input) => {
        if (!this.config.allowWrite) {
          writeFileTool.warning('Write operations are not allowed', {
            code: 'PERMISSION_DENIED'
          });
          return {
            success: false,
            data: {
              errorMessage: 'Write operations are not allowed',
              code: 'PERMISSION_DENIED'
            }
          };
        }

        // Check file size limit
        const content = input.content;
        const size = Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content);
        if (size > this.config.maxFileSize) {
          writeFileTool.warning(`File size ${size} exceeds limit`, {
            size,
            limit: this.config.maxFileSize
          });
          return {
            success: false,
            data: {
              errorMessage: `File size ${size} exceeds limit of ${this.config.maxFileSize}`,
              code: 'FILE_TOO_LARGE'
            }
          };
        }

        try {
          const filePath = this.resolvePath(input.path);
          const encoding = input.encoding === 'binary' ? null : (input.encoding || 'utf8');
          
          writeFileTool.progress(`Writing file: ${input.path}`, 25);
          
          // Ensure directory exists
          await fs.mkdir(path.dirname(filePath), { recursive: true });
          
          writeFileTool.progress(`Writing content to: ${input.path}`, 50);
          await fs.writeFile(filePath, content, encoding);
          
          writeFileTool.progress(`File written successfully: ${input.path}`, 100, {
            size,
            path: filePath
          });
          
          return {
            success: true,
            data: {
              path: filePath
            }
          };
        } catch (error) {
          writeFileTool.error(`Failed to write file: ${input.path}`, {
            code: error.code || 'WRITE_ERROR',
            details: error.message
          });
          
          return {
            success: false,
            data: {
              errorMessage: error.message,
              code: error.code || 'WRITE_ERROR',
              stackTrace: error.stack
            }
          };
        }
      },
      getMetadata: () => FileSystemModuleDefinition.getMetadata().tools.writeFile
    });
    
    this.registerTool('writeFile', writeFileTool);

    // Append File
    this.tools.appendFile = new Tool({
      name: 'appendFile',
      execute: async (input) => {
        if (!this.config.allowWrite) {
          return {
            success: false,
            data: {
              errorMessage: 'Write operations are not allowed',
              code: 'PERMISSION_DENIED'
            }
          };
        }

        try {
          const filePath = this.resolvePath(input.path);
          const encoding = input.encoding || 'utf8';
          await fs.appendFile(filePath, input.content, encoding);
          
          return {
            success: true,
            data: {
              path: filePath
            }
          };
        } catch (error) {
          return {
            success: false,
            data: {
              errorMessage: error.message,
              code: error.code || 'APPEND_ERROR',
              stackTrace: error.stack
            }
          };
        }
      },
      getMetadata: () => FileSystemModuleDefinition.getMetadata().tools.appendFile
    });

    // Delete File
    this.tools.deleteFile = new Tool({
      name: 'deleteFile',
      execute: async (input) => {
        if (!this.config.allowDelete) {
          return {
            success: false,
            data: {
              errorMessage: 'Delete operations are not allowed',
              code: 'PERMISSION_DENIED'
            }
          };
        }

        try {
          const filePath = this.resolvePath(input.path);
          await fs.unlink(filePath);
          
          return {
            success: true,
            data: {
              deleted: true
            }
          };
        } catch (error) {
          return {
            success: false,
            data: {
              errorMessage: error.message,
              code: error.code || 'DELETE_ERROR',
              stackTrace: error.stack
            }
          };
        }
      },
      getMetadata: () => FileSystemModuleDefinition.getMetadata().tools.deleteFile
    });

    // Check Exists
    this.tools.exists = new Tool({
      name: 'exists',
      execute: async (input) => {
        try {
          const filePath = this.resolvePath(input.path);
          const stats = await fs.stat(filePath);
          
          return {
            success: true,
            data: {
              exists: true,
              isFile: stats.isFile(),
              isDirectory: stats.isDirectory()
            }
          };
        } catch (error) {
          if (error.code === 'ENOENT') {
            return {
              success: true,
              data: {
                exists: false
              }
            };
          }
          return {
            success: false,
            data: {
              errorMessage: error.message,
              code: error.code || 'STAT_ERROR',
              stackTrace: error.stack
            }
          };
        }
      },
      getMetadata: () => FileSystemModuleDefinition.getMetadata().tools.exists
    });

    // Get Stats
    this.tools.stat = new Tool({
      name: 'stat',
      execute: async (input) => {
        try {
          const filePath = this.resolvePath(input.path);
          const stats = await fs.stat(filePath);
          
          return {
            success: true,
            data: {
              size: stats.size,
              mtime: stats.mtime,
              mode: stats.mode,
              isFile: stats.isFile(),
              isDirectory: stats.isDirectory()
            }
          };
        } catch (error) {
          return {
            success: false,
            data: {
              errorMessage: error.message,
              code: error.code || 'STAT_ERROR',
              stackTrace: error.stack
            }
          };
        }
      },
      getMetadata: () => FileSystemModuleDefinition.getMetadata().tools.stat
    });

    // Make Directory
    this.tools.mkdir = new Tool({
      name: 'mkdir',
      execute: async (input) => {
        if (!this.config.allowWrite) {
          return {
            success: false,
            data: {
              errorMessage: 'Write operations are not allowed',
              code: 'PERMISSION_DENIED'
            }
          };
        }

        try {
          const dirPath = this.resolvePath(input.path);
          await fs.mkdir(dirPath, { recursive: input.recursive });
          
          return {
            success: true,
            data: {
              path: dirPath
            }
          };
        } catch (error) {
          return {
            success: false,
            data: {
              errorMessage: error.message,
              code: error.code || 'MKDIR_ERROR',
              stackTrace: error.stack
            }
          };
        }
      },
      getMetadata: () => FileSystemModuleDefinition.getMetadata().tools.mkdir
    });

    // Remove Directory
    this.tools.rmdir = new Tool({
      name: 'rmdir',
      execute: async (input) => {
        if (!this.config.allowDelete) {
          return {
            success: false,
            data: {
              errorMessage: 'Delete operations are not allowed',
              code: 'PERMISSION_DENIED'
            }
          };
        }

        try {
          const dirPath = this.resolvePath(input.path);
          await fs.rm(dirPath, { recursive: input.recursive, force: true });
          
          return {
            success: true,
            data: {
              deleted: true
            }
          };
        } catch (error) {
          return {
            success: false,
            data: {
              errorMessage: error.message,
              code: error.code || 'RMDIR_ERROR',
              stackTrace: error.stack
            }
          };
        }
      },
      getMetadata: () => FileSystemModuleDefinition.getMetadata().tools.rmdir
    });

    // List Directory
    this.tools.listDir = new Tool({
      name: 'listDir',
      execute: async (input) => {
        try {
          const dirPath = this.resolvePath(input.path);
          const entries = await fs.readdir(dirPath, { withFileTypes: true });
          
          const result = entries.map(entry => ({
            name: entry.name,
            type: entry.isDirectory() ? 'directory' : 'file'
          }));
          
          return {
            success: true,
            data: {
              entries: result
            }
          };
        } catch (error) {
          return {
            success: false,
            data: {
              errorMessage: error.message,
              code: error.code || 'READDIR_ERROR',
              stackTrace: error.stack
            }
          };
        }
      },
      getMetadata: () => FileSystemModuleDefinition.getMetadata().tools.listDir
    });

    // Copy File
    this.tools.copyFile = new Tool({
      name: 'copyFile',
      execute: async (input) => {
        if (!this.config.allowWrite) {
          return {
            success: false,
            data: {
              errorMessage: 'Write operations are not allowed',
              code: 'PERMISSION_DENIED'
            }
          };
        }

        try {
          const sourcePath = this.resolvePath(input.source);
          const destPath = this.resolvePath(input.destination);
          
          await fs.copyFile(sourcePath, destPath);
          
          return {
            success: true,
            data: {
              destination: destPath
            }
          };
        } catch (error) {
          return {
            success: false,
            data: {
              errorMessage: error.message,
              code: error.code || 'COPY_ERROR',
              stackTrace: error.stack
            }
          };
        }
      },
      getMetadata: () => FileSystemModuleDefinition.getMetadata().tools.copyFile
    });

    // Move/Rename File
    this.tools.moveFile = new Tool({
      name: 'moveFile',
      execute: async (input) => {
        if (!this.config.allowWrite || !this.config.allowDelete) {
          return {
            success: false,
            data: {
              errorMessage: 'Move operations require write and delete permissions',
              code: 'PERMISSION_DENIED'
            }
          };
        }

        try {
          const sourcePath = this.resolvePath(input.source);
          const destPath = this.resolvePath(input.destination);
          
          await fs.rename(sourcePath, destPath);
          
          return {
            success: true,
            data: {
              destination: destPath
            }
          };
        } catch (error) {
          return {
            success: false,
            data: {
              errorMessage: error.message,
              code: error.code || 'MOVE_ERROR',
              stackTrace: error.stack
            }
          };
        }
      },
      getMetadata: () => FileSystemModuleDefinition.getMetadata().tools.moveFile
    });

    // Find Files
    this.tools.findFiles = new Tool({
      name: 'findFiles',
      execute: async (input) => {
        try {
          const cwd = input.cwd ? this.resolvePath(input.cwd) : this.config.basePath;
          
          const files = await glob(input.pattern, {
            cwd,
            absolute: false,
            nodir: true
          });
          
          return {
            success: true,
            data: {
              files
            }
          };
        } catch (error) {
          return {
            success: false,
            data: {
              errorMessage: error.message,
              code: 'FIND_ERROR',
              stackTrace: error.stack
            }
          };
        }
      },
      getMetadata: () => FileSystemModuleDefinition.getMetadata().tools.findFiles
    });

    // Watch File
    this.tools.watchFile = new Tool({
      name: 'watchFile',
      execute: async (input) => {
        try {
          const filePath = this.resolvePath(input.path);
          
          // Create a file watcher
          const watcher = fsSync.watch(filePath, (eventType, filename) => {
            // In real implementation, would emit events
            console.log(`File ${filename} changed: ${eventType}`);
          });
          
          // Create handle for the watcher
          const handle = generateHandle('watcher', { path: filePath });
          this.watchers.set(handle._id, watcher);
          
          return {
            success: true,
            data: {
              handle: handle._id,
              type: 'watcher'
            }
          };
        } catch (error) {
          return {
            success: false,
            data: {
              errorMessage: error.message,
              code: error.code || 'WATCH_ERROR',
              stackTrace: error.stack
            }
          };
        }
      },
      getMetadata: () => FileSystemModuleDefinition.getMetadata().tools.watchFile
    });

    // Calculate Checksum
    this.tools.checksum = new Tool({
      name: 'checksum',
      execute: async (input) => {
        try {
          const filePath = this.resolvePath(input.path);
          const algorithm = input.algorithm || 'sha256';
          
          const content = await fs.readFile(filePath);
          const hash = crypto.createHash(algorithm);
          hash.update(content);
          const checksum = hash.digest('hex');
          
          return {
            success: true,
            data: {
              checksum,
              algorithm
            }
          };
        } catch (error) {
          return {
            success: false,
            data: {
              errorMessage: error.message,
              code: error.code || 'CHECKSUM_ERROR',
              stackTrace: error.stack
            }
          };
        }
      },
      getMetadata: () => FileSystemModuleDefinition.getMetadata().tools.checksum
    });

    // Change Permissions
    this.tools.chmod = new Tool({
      name: 'chmod',
      execute: async (input) => {
        if (!this.config.allowWrite) {
          return {
            success: false,
            data: {
              errorMessage: 'Write operations are not allowed',
              code: 'PERMISSION_DENIED'
            }
          };
        }

        try {
          const filePath = this.resolvePath(input.path);
          const mode = parseInt(input.mode, 8); // Convert octal string to number
          
          await fs.chmod(filePath, mode);
          
          return {
            success: true,
            data: {
              path: filePath
            }
          };
        } catch (error) {
          return {
            success: false,
            data: {
              errorMessage: error.message,
              code: error.code || 'CHMOD_ERROR',
              stackTrace: error.stack
            }
          };
        }
      },
      getMetadata: () => FileSystemModuleDefinition.getMetadata().tools.chmod
    });
  }

  async cleanup() {
    // Close all watchers
    for (const [id, watcher] of this.watchers) {
      watcher.close();
    }
    this.watchers.clear();
  }
}