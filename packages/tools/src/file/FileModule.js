const { Tool, Module } = require('@jsenvoy/modules');
const fs = require('fs').promises;
const path = require('path');

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
      let result;
      
      switch (toolCall.function.name) {
        case 'file_read':
          this.validateRequiredParameters(args, ['filepath']);
          result = await this.readFile(args.filepath);
          break;
          
        case 'file_write':
          this.validateRequiredParameters(args, ['filepath', 'content']);
          result = await this.writeFile(args.filepath, args.content);
          break;
          
        case 'directory_create':
          this.validateRequiredParameters(args, ['dirpath']);
          result = await this.createDirectory(args.dirpath);
          break;
          
        default:
          throw new Error(`Unknown function: ${toolCall.function.name}`);
      }
      
      return this.createSuccessResponse(
        toolCall.id,
        toolCall.function.name,
        result
      );
    } catch (error) {
      return this.createErrorResponse(
        toolCall.id,
        toolCall.function.name,
        error
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
        throw new Error(`Path is not a file: ${filepath}`);
      }
      
      const content = await fs.readFile(resolvedPath, 'utf8');
      console.log(`Successfully read ${content.length} characters from ${filepath}`);
      
      return { content };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${filepath}`);
      } else if (error.code === 'EACCES') {
        throw new Error(`Permission denied: ${filepath}`);
      } else if (error.code === 'EISDIR') {
        throw new Error(`Path is a directory, not a file: ${filepath}`);
      }
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  /**
   * Writes content to a file
   */
  async writeFile(filepath, content) {
    try {
      console.log(`Writing file: ${filepath}`);
      
      const resolvedPath = path.resolve(filepath);
      
      // Ensure the directory exists
      const dir = path.dirname(resolvedPath);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(resolvedPath, content, 'utf8');
      console.log(`Successfully wrote ${content.length} characters to ${filepath}`);
      
      return {
        success: true,
        filepath: filepath,
        bytesWritten: content.length
      };
    } catch (error) {
      if (error.code === 'EACCES') {
        throw new Error(`Permission denied: ${filepath}`);
      } else if (error.code === 'ENOSPC') {
        throw new Error(`No space left on device: ${filepath}`);
      }
      throw new Error(`Failed to write file: ${error.message}`);
    }
  }

  /**
   * Creates a directory
   */
  async createDirectory(dirpath) {
    try {
      console.log(`Creating directory: ${dirpath}`);
      
      const resolvedPath = path.resolve(dirpath);
      
      await fs.mkdir(resolvedPath, { recursive: true });
      console.log(`Successfully created directory: ${dirpath}`);
      
      return {
        success: true,
        dirpath: dirpath
      };
    } catch (error) {
      if (error.code === 'EACCES') {
        throw new Error(`Permission denied: ${dirpath}`);
      } else if (error.code === 'EEXIST') {
        throw new Error(`Directory already exists: ${dirpath}`);
      }
      throw new Error(`Failed to create directory: ${error.message}`);
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
module.exports = FileModule;

// Also export the tool class for direct usage
module.exports.FileOperationsTool = FileOperationsTool;
module.exports.FileModule = FileModule;