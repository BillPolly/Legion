/**
 * FileModule - Modern file operations using individual tools
 * Refactored to use 6 separate tools following Clean Architecture
 */

import { Module } from '@legion/tools-registry';
import FileReaderTool from './FileReaderTool.js';
import FileWriterTool from './FileWriterTool.js';
import DirectoryCreatorTool from './DirectoryCreatorTool.js';
import DirectoryListTool from './DirectoryListTool.js';
import DirectoryChangeTool from './DirectoryChangeTool.js';
import DirectoryCurrentTool from './DirectoryCurrentTool.js';
import path from 'path';
import os from 'os';

/**
 * FileModule - Provides comprehensive file system operations
 */
class FileModule extends Module {
  constructor({ basePath, encoding = 'utf-8', createDirectories = true } = {}) {
    // Default basePath to current working directory if not provided
    const defaultBasePath = basePath || process.cwd();
    
    super({
      name: 'file-module',
      description: 'Comprehensive file system operations including reading, writing, and directory management'
    });

    // Initialize all 6 file operation tools
    this.fileReader = new FileReaderTool({ basePath: defaultBasePath, encoding });
    this.fileWriter = new FileWriterTool({ basePath: defaultBasePath, encoding, createDirectories });
    this.directoryCreator = new DirectoryCreatorTool({ basePath: defaultBasePath });
    this.directoryList = new DirectoryListTool({ basePath: defaultBasePath });
    this.directoryChange = new DirectoryChangeTool({ basePath: defaultBasePath });
    this.directoryCurrent = new DirectoryCurrentTool({ basePath: defaultBasePath });

    // Register all tools
    this.registerTool(this.fileReader.name, this.fileReader);
    this.registerTool(this.fileWriter.name, this.fileWriter);
    this.registerTool(this.directoryCreator.name, this.directoryCreator);
    this.registerTool(this.directoryList.name, this.directoryList);
    this.registerTool(this.directoryChange.name, this.directoryChange);
    this.registerTool(this.directoryCurrent.name, this.directoryCurrent);

    // Store configuration
    this.basePath = defaultBasePath;
    this.encoding = encoding;
    this.createDirectories = createDirectories;
  }

  /**
   * Get all tool descriptions for function calling
   * @returns {Array} Array of tool descriptions
   */
  getAllToolDescriptions() {
    return [
      {
        type: 'function',
        function: {
          name: 'file_read',
          description: 'Reads the contents of a file from the file system',
          parameters: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'The path to the file to read'
              }
            },
            required: ['filePath']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'file_write',
          description: 'Writes content to a file in the file system',
          parameters: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'The path where the file should be written'
              },
              content: {
                description: 'The content to write to the file (string or object - objects will be JSON stringified)'
              },
              append: {
                type: 'boolean',
                description: 'Whether to append to existing file (default: false)',
                default: false
              }
            },
            required: ['filePath', 'content']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'directory_create',
          description: 'Creates directories in the file system',
          parameters: {
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
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'directory_list',
          description: 'Lists the contents of a directory',
          parameters: {
            type: 'object',
            properties: {
              directoryPath: {
                type: 'string',
                description: 'The path to the directory to list'
              },
              recursive: {
                type: 'boolean',
                description: 'Whether to list contents recursively (default: false)',
                default: false
              },
              filter: {
                type: 'string',
                description: 'Optional filter pattern (e.g., "*.txt")'
              },
              includeHidden: {
                type: 'boolean',
                description: 'Whether to include hidden files (default: false)',
                default: false
              }
            },
            required: ['directoryPath']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'directory_change',
          description: 'Changes the current working directory',
          parameters: {
            type: 'object',
            properties: {
              directoryPath: {
                type: 'string',
                description: 'The path to change to (supports ~, ., .., absolute and relative paths)'
              }
            },
            required: ['directoryPath']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'directory_current',
          description: 'Returns the current working directory',
          parameters: {
            type: 'object',
            properties: {
              relative: {
                type: 'boolean',
                description: 'Whether to return path relative to base path (default: false)',
                default: false
              },
              includeMetadata: {
                type: 'boolean',
                description: 'Whether to include directory metadata (default: false)',
                default: false
              }
            }
          }
        }
      }
    ];
  }

  /**
   * Invoke a specific file operation
   * @param {string} toolName - The name of the tool to invoke
   * @param {Object} params - The parameters for the tool
   * @returns {Promise<Object>} The result of the operation
   */
  async invoke(toolName, params) {
    // Tools now return wrapped results via their execute() method,
    // so we can return them directly without manual wrapping
    switch (toolName) {
      case 'file_read':
        return await this.fileReader.execute(params);
      case 'file_write':
        return await this.fileWriter.execute(params);
      case 'directory_create':
        return await this.directoryCreator.execute(params);
      case 'directory_list':
        return await this.directoryList.execute(params);
      case 'directory_change':
        return await this.directoryChange.execute(params);
      case 'directory_current':
        return await this.directoryCurrent.execute(params);
      default:
        return {
          success: false,
          error: `Unknown tool: ${toolName}`,
          data: {}
        };
    }
  }

  /**
   * Get the base path for all file operations
   * @returns {string} The base path
   */
  getBasePath() {
    return this.basePath;
  }

  /**
   * Set a new base path for all file operations
   * @param {string} newBasePath - The new base path
   */
  setBasePath(newBasePath) {
    this.basePath = newBasePath;
    
    // Update all tools with new base path
    this.fileReader.basePath = newBasePath;
    this.fileWriter.basePath = newBasePath;
    this.directoryCreator.basePath = newBasePath;
    this.directoryList.basePath = newBasePath;
    this.directoryChange.basePath = newBasePath;
    this.directoryCurrent.basePath = newBasePath;
  }

  /**
   * Get module statistics
   * @returns {Object} Module statistics
   */
  getStatistics() {
    return {
      toolCount: 6,
      basePath: this.basePath,
      encoding: this.encoding,
      createDirectories: this.createDirectories,
      tools: [
        'file_read',
        'file_write', 
        'directory_create',
        'directory_list',
        'directory_change',
        'directory_current'
      ]
    };
  }
}

export default FileModule;