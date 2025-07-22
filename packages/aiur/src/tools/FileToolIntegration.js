/**
 * FileToolIntegration - Basic file operations integration for MCP
 * 
 * Provides essential file system operations through MCP tools with handle integration
 */

import fs from 'fs/promises';
import path from 'path';

export class FileToolIntegration {
  constructor(mcpServer, options = {}) {
    this.server = mcpServer;
    this.options = {
      safeMode: options.safeMode || false,
      allowedPaths: options.allowedPaths || [],
      toolPrefix: options.toolPrefix || 'file_',
      enabledTools: options.enabledTools || ['read', 'write', 'exists', 'directory_create', 'directory_list'],
      maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB default
      defaultEncoding: options.defaultEncoding || 'utf8',
      ...options
    };
  }

  /**
   * Register basic file operation tools
   */
  registerBasicFileTools() {
    const enabledTools = this.options.enabledTools;

    if (enabledTools.includes('read')) {
      this._registerFileReadTool();
    }

    if (enabledTools.includes('write')) {
      this._registerFileWriteTool();
    }

    if (enabledTools.includes('exists')) {
      this._registerFileExistsTool();
    }

    if (enabledTools.includes('directory_create')) {
      this._registerDirectoryCreateTool();
    }

    if (enabledTools.includes('directory_list')) {
      this._registerDirectoryListTool();
    }
  }

  /**
   * Register file read tool
   * @private
   */
  _registerFileReadTool() {
    const toolName = this.options.toolPrefix + 'read';
    
    this.server.addTool({
      name: toolName,
      description: 'Read content from a file',
      inputSchema: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Path to the file to read'
          },
          encoding: {
            type: 'string',
            description: 'File encoding (utf8, ascii, etc.)',
            default: this.options.defaultEncoding
          }
        },
        required: ['filePath']
      },
      execute: async (params) => {
        try {
          const { filePath, encoding = this.options.defaultEncoding } = params;

          // Validate file path
          this._validateFilePath(filePath);

          // Check file size
          const stats = await fs.stat(filePath);
          if (stats.size > this.options.maxFileSize) {
            throw new Error(`File too large: ${stats.size} bytes (max: ${this.options.maxFileSize})`);
          }

          // Read file content
          const content = encoding ? 
            await fs.readFile(filePath, encoding) :
            await fs.readFile(filePath);

          return {
            success: true,
            content,
            filePath,
            stats: {
              size: stats.size,
              modified: stats.mtime,
              isFile: stats.isFile(),
              isDirectory: stats.isDirectory()
            },
            encoding: encoding || 'binary'
          };

        } catch (error) {
          return {
            success: false,
            error: error.message,
            code: error.code
          };
        }
      }
    });
  }

  /**
   * Register file write tool
   * @private
   */
  _registerFileWriteTool() {
    const toolName = this.options.toolPrefix + 'write';
    
    this.server.addTool({
      name: toolName,
      description: 'Write content to a file',
      inputSchema: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Path to the file to write'
          },
          content: {
            type: 'string',
            description: 'Content to write to the file'
          },
          encoding: {
            type: 'string',
            description: 'File encoding (utf8, ascii, etc.)',
            default: this.options.defaultEncoding
          },
          createDirectories: {
            type: 'boolean',
            description: 'Create parent directories if they do not exist',
            default: false
          }
        },
        required: ['filePath', 'content']
      },
      execute: async (params) => {
        try {
          const { 
            filePath, 
            content, 
            encoding = this.options.defaultEncoding, 
            createDirectories = false 
          } = params;

          // Validate file path
          this._validateFilePath(filePath);

          // Validate content
          if (content === undefined || content === null) {
            throw new Error('Content is required for file write operation');
          }

          // Create directories if requested
          if (createDirectories) {
            const dir = path.dirname(filePath);
            await fs.mkdir(dir, { recursive: true });
          }

          // Write file content
          await fs.writeFile(filePath, content, encoding);

          // Get file stats
          const stats = await fs.stat(filePath);

          return {
            success: true,
            filePath,
            bytesWritten: Buffer.byteLength(content, encoding),
            stats: {
              size: stats.size,
              modified: stats.mtime
            },
            encoding
          };

        } catch (error) {
          return {
            success: false,
            error: error.message,
            code: error.code
          };
        }
      }
    });
  }

  /**
   * Register file exists tool
   * @private
   */
  _registerFileExistsTool() {
    const toolName = this.options.toolPrefix + 'exists';
    
    this.server.addTool({
      name: toolName,
      description: 'Check if a file or directory exists',
      inputSchema: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Path to check for existence'
          }
        },
        required: ['filePath']
      },
      execute: async (params) => {
        try {
          const { filePath } = params;

          // Validate file path
          this._validateFilePath(filePath);

          let exists = false;
          let stats = null;

          try {
            stats = await fs.stat(filePath);
            exists = true;
          } catch (error) {
            if (error.code === 'ENOENT') {
              exists = false;
            } else {
              throw error;
            }
          }

          const result = {
            success: true,
            exists,
            filePath
          };

          if (exists && stats) {
            result.stats = {
              size: stats.size,
              modified: stats.mtime,
              accessed: stats.atime,
              created: stats.birthtime,
              isFile: stats.isFile(),
              isDirectory: stats.isDirectory(),
              isSymbolicLink: stats.isSymbolicLink()
            };
          }

          return result;

        } catch (error) {
          return {
            success: false,
            error: error.message,
            code: error.code
          };
        }
      }
    });
  }

  /**
   * Register directory create tool
   * @private
   */
  _registerDirectoryCreateTool() {
    const toolName = this.options.toolPrefix.replace('file_', 'directory_') + 'create';
    
    this.server.addTool({
      name: toolName,
      description: 'Create a directory',
      inputSchema: {
        type: 'object',
        properties: {
          directoryPath: {
            type: 'string',
            description: 'Path of the directory to create'
          },
          recursive: {
            type: 'boolean',
            description: 'Create parent directories if they do not exist',
            default: false
          }
        },
        required: ['directoryPath']
      },
      execute: async (params) => {
        try {
          const { directoryPath, recursive = false } = params;

          // Validate directory path
          this._validateFilePath(directoryPath);

          // Create directory
          await fs.mkdir(directoryPath, { recursive });

          // Get directory stats
          const stats = await fs.stat(directoryPath);

          return {
            success: true,
            directoryPath,
            created: true,
            stats: {
              created: stats.birthtime,
              modified: stats.mtime,
              isDirectory: stats.isDirectory()
            }
          };

        } catch (error) {
          return {
            success: false,
            error: error.message,
            code: error.code
          };
        }
      }
    });
  }

  /**
   * Register directory list tool
   * @private
   */
  _registerDirectoryListTool() {
    const toolName = this.options.toolPrefix.replace('file_', 'directory_') + 'list';
    
    this.server.addTool({
      name: toolName,
      description: 'List contents of a directory',
      inputSchema: {
        type: 'object',
        properties: {
          directoryPath: {
            type: 'string',
            description: 'Path of the directory to list'
          },
          includeStats: {
            type: 'boolean',
            description: 'Include file/directory statistics',
            default: true
          }
        },
        required: ['directoryPath']
      },
      execute: async (params) => {
        try {
          const { directoryPath, includeStats = true } = params;

          // Validate directory path
          this._validateFilePath(directoryPath);

          // Read directory contents
          const entries = await fs.readdir(directoryPath);

          const items = [];
          for (const entry of entries) {
            const itemPath = path.join(directoryPath, entry);
            const item = {
              name: entry,
              path: itemPath
            };

            if (includeStats) {
              try {
                const stats = await fs.stat(itemPath);
                item.stats = {
                  size: stats.size,
                  modified: stats.mtime,
                  isFile: stats.isFile(),
                  isDirectory: stats.isDirectory(),
                  isSymbolicLink: stats.isSymbolicLink()
                };
                
                // Add convenience properties
                item.isFile = stats.isFile();
                item.isDirectory = stats.isDirectory();
                item.size = stats.size;
              } catch (statError) {
                // If we can't stat the item, just include basic info
                item.error = `Could not stat: ${statError.message}`;
              }
            }

            items.push(item);
          }

          return {
            success: true,
            directoryPath,
            items,
            count: items.length
          };

        } catch (error) {
          return {
            success: false,
            error: error.message,
            code: error.code
          };
        }
      }
    });
  }

  /**
   * Validate file path for security
   * @private
   */
  _validateFilePath(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('File path must be a non-empty string');
    }

    // Security checks in safe mode
    if (this.options.safeMode) {
      // Prevent path traversal attacks
      if (filePath.includes('..')) {
        throw new Error('Path traversal not allowed');
      }

      // Check allowed paths
      if (this.options.allowedPaths.length > 0) {
        const resolvedPath = path.resolve(filePath);
        const isAllowed = this.options.allowedPaths.some(allowedPath => {
          const resolvedAllowedPath = path.resolve(allowedPath);
          return resolvedPath.startsWith(resolvedAllowedPath);
        });

        if (!isAllowed) {
          throw new Error('Path not in allowed directories');
        }
      }
    }

    return true;
  }

  /**
   * Register advanced file tools
   */
  registerAdvancedFileTools() {
    this._registerFileCopyTool();
    this._registerFileMoveTool();
    this._registerFileDeleteTool();
    this._registerFileWatchTool();
  }

  /**
   * Register file copy tool
   * @private
   */
  _registerFileCopyTool() {
    const toolName = this.options.toolPrefix + 'copy';
    
    this.server.addTool({
      name: toolName,
      description: 'Copy a file to another location',
      inputSchema: {
        type: 'object',
        properties: {
          sourcePath: {
            type: 'string',
            description: 'Path of the file to copy'
          },
          destinationPath: {
            type: 'string',
            description: 'Destination path for the copied file'
          },
          overwrite: {
            type: 'boolean',
            description: 'Whether to overwrite destination if it exists',
            default: false
          }
        },
        required: ['sourcePath', 'destinationPath']
      },
      execute: async (params) => {
        try {
          const { sourcePath, destinationPath, overwrite = false } = params;

          this._validateFilePath(sourcePath);
          this._validateFilePath(destinationPath);

          // Check if destination exists and overwrite is not allowed
          if (!overwrite) {
            try {
              await fs.access(destinationPath);
              throw new Error('Destination file exists and overwrite is not allowed');
            } catch (error) {
              if (error.code !== 'ENOENT') {
                throw error;
              }
            }
          }

          // Copy file
          await fs.copyFile(sourcePath, destinationPath);

          const stats = await fs.stat(destinationPath);

          return {
            success: true,
            sourcePath,
            destinationPath,
            bytescopied: stats.size
          };

        } catch (error) {
          return {
            success: false,
            error: error.message,
            code: error.code
          };
        }
      }
    });
  }

  /**
   * Get integration statistics
   * @returns {Object} Integration statistics
   */
  getStatistics() {
    const registeredTools = this.server.listTools().filter(tool => 
      tool.name.startsWith(this.options.toolPrefix) || 
      tool.name.startsWith('directory_')
    );

    return {
      registeredTools: registeredTools.length,
      toolNames: registeredTools.map(t => t.name),
      safeMode: this.options.safeMode,
      maxFileSize: this.options.maxFileSize,
      allowedPaths: this.options.allowedPaths.length,
      enabledTools: this.options.enabledTools
    };
  }

  /**
   * Test file operations
   * @returns {Promise<Object>} Test results
   */
  async testFileOperations() {
    const results = {
      passed: 0,
      failed: 0,
      tests: []
    };

    // Test basic file operations if tools are registered
    const tools = this.server.listTools();
    const toolNames = tools.map(t => t.name);

    if (toolNames.includes(this.options.toolPrefix + 'exists')) {
      try {
        const result = await this.server.callTool(this.options.toolPrefix + 'exists', {
          filePath: '/'
        });
        results.tests.push({
          name: 'file_exists on root',
          passed: result.success,
          result
        });
        if (result.success) results.passed++;
        else results.failed++;
      } catch (error) {
        results.tests.push({
          name: 'file_exists on root',
          passed: false,
          error: error.message
        });
        results.failed++;
      }
    }

    return results;
  }
}