import { Tool, ToolResult, Module } from '@jsenvoy/modules';
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
      
      const resolvedPath = path.resolve(filepath);
      
      // Check if file exists and is readable
      const stats = await fs.stat(resolvedPath);
      if (!stats.isFile()) {
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
      console.log(`Content length: ${content ? content.length : 0} chars`);
      console.log(`Content type: ${typeof content}`);
      
      if (content === undefined || content === null) {
        console.error('ERROR: Content is undefined or null!');
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
    
    // Create the file operations tool
    this.tools = [
      new FileOperationsTool()
    ];
  }
}

// Export the module as the default
export default FileModule;

// Also export the tool class for direct usage
export { FileOperationsTool, FileModule };