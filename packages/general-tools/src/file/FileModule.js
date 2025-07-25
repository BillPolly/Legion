import { Tool, ToolResult, Module } from '@legion/module-loader';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Internal tool class for file operations
 */
class FileOperationsTool extends Tool {
  constructor() {
    super();
    this.name = 'file_operations';
    this.description = 'Comprehensive file system operations including reading, writing, and directory management';
  }

  /**
   * Returns all available file operation functions in standard function calling format
   */
  getAllToolDescriptions() {
    return [
      {
        type: 'function',
        function: {
          name: 'file_read',
          description: 'Read the contents of a file from disk',
          parameters: {
            type: 'object',
            properties: {
              filepath: {
                type: 'string',
                description: 'The path to the file to read (can be absolute or relative)'
              }
            },
            required: ['filepath']
          },
          output: {
            success: {
              type: 'object',
              properties: {
                content: {
                  type: 'string',
                  description: 'The contents of the file'
                },
                filepath: {
                  type: 'string',
                  description: 'The path of the file that was read'
                },
                size: {
                  type: 'number',
                  description: 'Size of the file in bytes'
                }
              },
              required: ['content', 'filepath']
            },
            failure: {
              type: 'object',
              properties: {
                filepath: {
                  type: 'string',
                  description: 'The path that was attempted'
                },
                errorCode: {
                  type: 'string',
                  enum: ['ENOENT', 'EACCES', 'EISDIR', 'UNKNOWN'],
                  description: 'System error code if applicable'
                },
                details: {
                  type: 'string',
                  description: 'Additional error details'
                }
              },
              required: ['filepath', 'errorCode']
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'file_write',
          description: 'Create a new file and write text content to it',
          parameters: {
            type: 'object',
            properties: {
              filepath: {
                type: 'string',
                description: 'The path where the file should be created (can be absolute or relative)'
              },
              content: {
                type: 'string',
                description: 'The text content to write to the file'
              }
            },
            required: ['filepath', 'content']
          },
          output: {
            success: {
              type: 'object',
              properties: {
                filepath: {
                  type: 'string',
                  description: 'The path of the file that was written'
                },
                bytesWritten: {
                  type: 'number',
                  description: 'Number of bytes written to the file'
                },
                created: {
                  type: 'boolean',
                  description: 'Whether a new file was created (true) or existing file was overwritten (false)'
                }
              },
              required: ['filepath', 'bytesWritten']
            },
            failure: {
              type: 'object',
              properties: {
                filepath: {
                  type: 'string',
                  description: 'The path where write was attempted'
                },
                errorCode: {
                  type: 'string',
                  enum: ['EACCES', 'ENOENT', 'EISDIR', 'ENOSPC', 'UNKNOWN'],
                  description: 'System error code if applicable'
                },
                details: {
                  type: 'string',
                  description: 'Additional error details'
                }
              },
              required: ['filepath', 'errorCode']
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'directory_create',
          description: 'Create a new directory at the specified path',
          parameters: {
            type: 'object',
            properties: {
              dirpath: {
                type: 'string',
                description: 'The path where the directory should be created (can be absolute or relative)'
              }
            },
            required: ['dirpath']
          },
          output: {
            success: {
              type: 'object',
              properties: {
                dirpath: {
                  type: 'string',
                  description: 'The path of the directory that was created'
                },
                created: {
                  type: 'boolean',
                  description: 'Whether a new directory was created (true) or it already existed (false)'
                }
              },
              required: ['dirpath', 'created']
            },
            failure: {
              type: 'object',
              properties: {
                dirpath: {
                  type: 'string',
                  description: 'The path where directory creation was attempted'
                },
                errorCode: {
                  type: 'string',
                  enum: ['EACCES', 'EEXIST', 'ENOENT', 'ENOTDIR', 'UNKNOWN'],
                  description: 'System error code if applicable'
                },
                details: {
                  type: 'string',
                  description: 'Additional error details'
                }
              },
              required: ['dirpath', 'errorCode']
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'directory_current',
          description: 'Get the current working directory path',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          },
          output: {
            success: {
              type: 'object',
              properties: {
                currentDirectory: {
                  type: 'string',
                  description: 'The absolute path of the current working directory'
                }
              },
              required: ['currentDirectory']
            },
            failure: {
              type: 'object',
              properties: {
                errorCode: {
                  type: 'string',
                  enum: ['UNKNOWN'],
                  description: 'System error code if applicable'
                },
                details: {
                  type: 'string',
                  description: 'Additional error details'
                }
              },
              required: ['errorCode']
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'directory_list',
          description: 'List contents of a directory',
          parameters: {
            type: 'object',
            properties: {
              dirpath: {
                type: 'string',
                description: 'The directory path to list (optional, defaults to current directory)'
              }
            },
            required: []
          },
          output: {
            success: {
              type: 'object',
              properties: {
                dirpath: {
                  type: 'string',
                  description: 'The directory path that was listed'
                },
                contents: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: {
                        type: 'string',
                        description: 'Name of the file or directory'
                      },
                      type: {
                        type: 'string',
                        enum: ['file', 'directory'],
                        description: 'Whether this is a file or directory'
                      },
                      size: {
                        type: 'number',
                        description: 'Size in bytes (for files)'
                      }
                    },
                    required: ['name', 'type']
                  },
                  description: 'Array of files and directories in the specified path'
                }
              },
              required: ['dirpath', 'contents']
            },
            failure: {
              type: 'object',
              properties: {
                dirpath: {
                  type: 'string',
                  description: 'The directory path where listing was attempted'
                },
                errorCode: {
                  type: 'string',
                  enum: ['ENOENT', 'EACCES', 'ENOTDIR', 'UNKNOWN'],
                  description: 'System error code if applicable'
                },
                details: {
                  type: 'string',
                  description: 'Additional error details'
                }
              },
              required: ['dirpath', 'errorCode']
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'directory_change',
          description: 'Change the current working directory',
          parameters: {
            type: 'object',
            properties: {
              dirpath: {
                type: 'string',
                description: 'The directory path to change to (can be absolute or relative)'
              }
            },
            required: ['dirpath']
          },
          output: {
            success: {
              type: 'object',
              properties: {
                previousDirectory: {
                  type: 'string',
                  description: 'The previous working directory path'
                },
                currentDirectory: {
                  type: 'string',
                  description: 'The new current working directory path'
                }
              },
              required: ['previousDirectory', 'currentDirectory']
            },
            failure: {
              type: 'object',
              properties: {
                dirpath: {
                  type: 'string',
                  description: 'The directory path where change was attempted'
                },
                errorCode: {
                  type: 'string',
                  enum: ['ENOENT', 'EACCES', 'ENOTDIR', 'UNKNOWN'],
                  description: 'System error code if applicable'
                },
                details: {
                  type: 'string',
                  description: 'Additional error details'
                }
              },
              required: ['dirpath', 'errorCode']
            }
          }
        }
      }
    ];
  }

  /**
   * Returns the primary tool function description (file_read)
   */
  getToolDescription() {
    return this.getAllToolDescriptions()[0];
  }

  /**
   * Routes tool calls to the appropriate file operation
   */
  async invoke(toolCall) {
    try {
      const args = this.parseArguments(toolCall.function.arguments);
      
      switch (toolCall.function.name) {
        case 'file_read':
          this.validateRequiredParameters(args, ['filepath']);
          return await this.readFile(args.filepath);
          
        case 'file_write':
          this.validateRequiredParameters(args, ['filepath', 'content']);
          return await this.writeFile(args.filepath, args.content);
          
        case 'directory_create':
          this.validateRequiredParameters(args, ['dirpath']);
          return await this.createDirectory(args.dirpath);
          
        case 'directory_current':
          return await this.getCurrentDirectory();
          
        case 'directory_list':
          const dirToList = args.dirpath || process.cwd();
          return await this.listDirectory(dirToList);
          
        case 'directory_change':
          this.validateRequiredParameters(args, ['dirpath']);
          return await this.changeDirectory(args.dirpath);
          
        default:
          return ToolResult.failure(
            `Unknown function: ${toolCall.function.name}`,
            { functionName: toolCall.function.name }
          );
      }
    } catch (error) {
      // Handle parameter validation errors
      return ToolResult.failure(
        error.message,
        { 
          functionName: toolCall.function.name,
          errorType: 'validation_error'
        }
      );
    }
  }

  /**
   * Reads a file from disk
   */
  async readFile(filepath) {
    try {
      console.log(`Reading file: ${filepath}`);
      this.emitProgress(`Reading file: ${filepath}`, { filepath });
      
      const resolvedPath = path.resolve(filepath);
      
      // Check if file exists and is readable
      const stats = await fs.stat(resolvedPath);
      if (!stats.isFile()) {
        this.emitError(`Path is not a file: ${filepath}`, { filepath, errorCode: 'EISDIR' });
        return ToolResult.failure(
          `Path is not a file: ${filepath}`,
          { 
            filepath: filepath,
            errorCode: 'EISDIR',
            details: 'The specified path points to a directory'
          }
        );
      }
      
      const content = await fs.readFile(resolvedPath, 'utf8');
      console.log(`Successfully read ${content.length} characters from ${filepath}`);
      this.emitInfo(`Successfully read ${content.length} characters from ${filepath}`, { 
        filepath, 
        size: content.length 
      });
      
      return ToolResult.success({
        content: content,
        filepath: filepath,
        size: content.length
      });
    } catch (error) {
      let errorCode = 'UNKNOWN';
      let errorMessage = `Failed to read file: ${error.message}`;
      
      if (error.code === 'ENOENT') {
        errorCode = 'ENOENT';
        errorMessage = `File not found: ${filepath}`;
      } else if (error.code === 'EACCES') {
        errorCode = 'EACCES';
        errorMessage = `Permission denied: ${filepath}`;
      } else if (error.code === 'EISDIR') {
        errorCode = 'EISDIR';
        errorMessage = `Path is a directory, not a file: ${filepath}`;
      }
      
      this.emitError(errorMessage, { filepath, errorCode, details: error.stack });
      
      return ToolResult.failure(
        errorMessage,
        { 
          filepath: filepath,
          errorCode: errorCode,
          details: error.stack
        }
      );
    }
  }

  /**
   * Writes content to a file
   */
  async writeFile(filepath, content) {
    try {
      console.log(`Writing file: ${filepath}`);
      this.emitProgress(`Writing file: ${filepath}`, { filepath, contentLength: content ? content.length : 0 });
      console.log(`Content length: ${content ? content.length : 0} chars`);
      console.log(`Content type: ${typeof content}`);
      
      if (content === undefined || content === null) {
        console.error('ERROR: Content is undefined or null!');
        this.emitError('Content is required for file write', { filepath });
        return ToolResult.failure('Content is required', { filepath });
      }
      
      const resolvedPath = path.resolve(filepath);
      console.log(`Resolved path: ${resolvedPath}`);
      
      // Check if file already exists
      let fileExists = false;
      try {
        await fs.stat(resolvedPath);
        fileExists = true;
      } catch (e) {
        // File doesn't exist, which is fine
      }
      
      // Ensure the directory exists
      const dir = path.dirname(resolvedPath);
      await fs.mkdir(dir, { recursive: true });
      
      console.log(`Calling fs.writeFile with path: ${resolvedPath}, content: "${content}"`);
      await fs.writeFile(resolvedPath, content, 'utf8');
      console.log(`fs.writeFile completed without error`);
      
      // Verify file was written
      try {
        const verifyStats = await fs.stat(resolvedPath);
        console.log(`File verified: ${verifyStats.size} bytes`);
      } catch (e) {
        console.error(`ERROR: File was not written! ${e.message}`);
      }
      
      console.log(`Successfully wrote ${content.length} characters to ${filepath}`);
      this.emitInfo(`Successfully wrote ${content.length} characters to ${filepath}`, { 
        filepath, 
        bytesWritten: content.length,
        created: !fileExists 
      });
      
      return ToolResult.success({
        filepath: filepath,
        bytesWritten: content.length,
        created: !fileExists
      });
    } catch (error) {
      let errorCode = 'UNKNOWN';
      let errorMessage = `Failed to write file: ${error.message}`;
      
      if (error.code === 'EACCES') {
        errorCode = 'EACCES';
        errorMessage = `Permission denied: ${filepath}`;
      } else if (error.code === 'ENOSPC') {
        errorCode = 'ENOSPC';
        errorMessage = `No space left on device: ${filepath}`;
      } else if (error.code === 'EISDIR') {
        errorCode = 'EISDIR';
        errorMessage = `Path is a directory: ${filepath}`;
      } else if (error.code === 'ENOENT') {
        errorCode = 'ENOENT';
        errorMessage = `Parent directory does not exist: ${filepath}`;
      }
      
      this.emitError(errorMessage, { filepath, errorCode, details: error.stack });
      
      return ToolResult.failure(
        errorMessage,
        {
          filepath: filepath,
          errorCode: errorCode,
          details: error.stack
        }
      );
    }
  }

  /**
   * Creates a directory
   */
  async createDirectory(dirpath) {
    try {
      console.log(`Creating directory: ${dirpath}`);
      this.emitProgress(`Creating directory: ${dirpath}`, { dirpath });
      
      const resolvedPath = path.resolve(dirpath);
      
      // Check if directory already exists
      let dirExists = false;
      try {
        const stats = await fs.stat(resolvedPath);
        dirExists = stats.isDirectory();
      } catch (e) {
        // Directory doesn't exist, which is fine
      }
      
      await fs.mkdir(resolvedPath, { recursive: true });
      console.log(`Successfully created directory: ${dirpath}`);
      this.emitInfo(`Successfully created directory: ${dirpath}`, { dirpath, created: !dirExists });
      
      return ToolResult.success({
        dirpath: dirpath,
        created: !dirExists
      });
    } catch (error) {
      let errorCode = 'UNKNOWN';
      let errorMessage = `Failed to create directory: ${error.message}`;
      
      if (error.code === 'EACCES') {
        errorCode = 'EACCES';
        errorMessage = `Permission denied: ${dirpath}`;
      } else if (error.code === 'EEXIST') {
        errorCode = 'EEXIST';
        errorMessage = `File already exists at path: ${dirpath}`;
      } else if (error.code === 'ENOENT') {
        errorCode = 'ENOENT';
        errorMessage = `Parent directory does not exist: ${dirpath}`;
      } else if (error.code === 'ENOTDIR') {
        errorCode = 'ENOTDIR';
        errorMessage = `Parent path is not a directory: ${dirpath}`;
      }
      
      return ToolResult.failure(
        errorMessage,
        {
          dirpath: dirpath,
          errorCode: errorCode,
          details: error.stack
        }
      );
    }
  }

  /**
   * Get the current working directory
   */
  async getCurrentDirectory() {
    try {
      const currentDir = process.cwd();
      console.log(`Current directory: ${currentDir}`);
      
      return ToolResult.success({
        currentDirectory: currentDir
      });
    } catch (error) {
      return ToolResult.failure(
        `Failed to get current directory: ${error.message}`,
        {
          errorCode: 'UNKNOWN',
          details: error.stack
        }
      );
    }
  }

  /**
   * List contents of a directory
   */
  async listDirectory(dirpath) {
    try {
      console.log(`Listing directory: ${dirpath}`);
      
      const resolvedPath = path.resolve(dirpath);
      
      // Check if directory exists and is accessible
      const stats = await fs.stat(resolvedPath);
      if (!stats.isDirectory()) {
        return ToolResult.failure(
          `Path is not a directory: ${dirpath}`,
          { 
            dirpath: dirpath,
            errorCode: 'ENOTDIR',
            details: 'The specified path is not a directory'
          }
        );
      }
      
      // Read directory contents
      const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
      const contents = [];
      
      for (const entry of entries) {
        const itemPath = path.join(resolvedPath, entry.name);
        const item = {
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file'
        };
        
        // Add size for files
        if (entry.isFile()) {
          try {
            const fileStats = await fs.stat(itemPath);
            item.size = fileStats.size;
          } catch (error) {
            // If we can't get size, just omit it
          }
        }
        
        contents.push(item);
      }
      
      console.log(`Successfully listed ${contents.length} items in ${dirpath}`);
      
      return ToolResult.success({
        dirpath: dirpath,
        contents: contents
      });
    } catch (error) {
      let errorCode = 'UNKNOWN';
      let errorMessage = `Failed to list directory: ${error.message}`;
      
      if (error.code === 'ENOENT') {
        errorCode = 'ENOENT';
        errorMessage = `Directory not found: ${dirpath}`;
      } else if (error.code === 'EACCES') {
        errorCode = 'EACCES';
        errorMessage = `Permission denied: ${dirpath}`;
      } else if (error.code === 'ENOTDIR') {
        errorCode = 'ENOTDIR';
        errorMessage = `Path is not a directory: ${dirpath}`;
      }
      
      return ToolResult.failure(
        errorMessage,
        {
          dirpath: dirpath,
          errorCode: errorCode,
          details: error.stack
        }
      );
    }
  }

  /**
   * Change the current working directory
   */
  async changeDirectory(dirpath) {
    try {
      console.log(`Changing directory to: ${dirpath}`);
      
      const previousDir = process.cwd();
      const resolvedPath = path.resolve(dirpath);
      
      // Check if directory exists and is accessible
      const stats = await fs.stat(resolvedPath);
      if (!stats.isDirectory()) {
        return ToolResult.failure(
          `Path is not a directory: ${dirpath}`,
          { 
            dirpath: dirpath,
            errorCode: 'ENOTDIR',
            details: 'The specified path is not a directory'
          }
        );
      }
      
      // Change directory
      process.chdir(resolvedPath);
      const currentDir = process.cwd();
      
      console.log(`Successfully changed directory from ${previousDir} to ${currentDir}`);
      
      return ToolResult.success({
        previousDirectory: previousDir,
        currentDirectory: currentDir
      });
    } catch (error) {
      let errorCode = 'UNKNOWN';
      let errorMessage = `Failed to change directory: ${error.message}`;
      
      if (error.code === 'ENOENT') {
        errorCode = 'ENOENT';
        errorMessage = `Directory not found: ${dirpath}`;
      } else if (error.code === 'EACCES') {
        errorCode = 'EACCES';
        errorMessage = `Permission denied: ${dirpath}`;
      } else if (error.code === 'ENOTDIR') {
        errorCode = 'ENOTDIR';
        errorMessage = `Path is not a directory: ${dirpath}`;
      }
      
      return ToolResult.failure(
        errorMessage,
        {
          dirpath: dirpath,
          errorCode: errorCode,
          details: error.stack
        }
      );
    }
  }
}

/**
 * File system module that provides all file-related tools
 * This is a complete module with built-in tools, no external dependencies needed
 */
class FileModule extends Module {
  // Declare required dependencies
  static dependencies = ['basePath', 'encoding', 'createDirectories', 'permissions'];

  constructor({ basePath = process.cwd(), encoding = 'utf8', createDirectories = true, permissions = 0o755 } = {}) {
    super();
    this.name = 'file';
    
    // Store configuration
    this.config = {
      basePath,
      encoding,
      createDirectories,
      permissions
    };
    
    // Create and register the file operations tool
    const fileOperationsTool = new FileOperationsTool();
    this.registerTool('file_operations', fileOperationsTool);
  }
}

// Export the module as the default
export default FileModule;

// Also export the tool class for direct usage
export { FileOperationsTool, FileModule };