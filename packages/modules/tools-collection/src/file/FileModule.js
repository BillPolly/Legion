/**
 * FileModule - NEW metadata-driven architecture
 * Metadata comes from tools-metadata.json, tools contain pure logic only
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
import { fileURLToPath } from 'url';

/**
 * FileModule - Provides comprehensive file system operations
 */
class FileModule extends Module {
  constructor({ basePath, encoding = 'utf-8', createDirectories = true } = {}) {
    super();
    
    // Set required properties as expected by base Module class
    this.name = 'file-module';
    this.description = 'Comprehensive file system operations including reading, writing, and directory management';
    
    // NEW: Set metadata path for automatic loading
    this.metadataPath = './tools-metadata.json';
    
    // Store configuration for tools
    this.config = {
      basePath: basePath || process.cwd(),
      encoding,
      createDirectories
    };
  }

  /**
   * Override getModulePath to support proper path resolution
   */
  getModulePath() {
    return fileURLToPath(import.meta.url);
  }

  /**
   * Static async factory method following the standard interface
   */
  static async create(resourceManager) {
    const module = new FileModule({});
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }

  /**
   * Initialize the module - NEW metadata-driven approach
   */
  async initialize() {
    await super.initialize(); // This will load metadata automatically
    
    // NEW APPROACH: Create tools using metadata
    if (this.metadata) {
      // Create all 6 file tools using metadata
      const tools = [
        { key: 'file_read', class: FileReaderTool },
        { key: 'file_write', class: FileWriterTool },
        { key: 'directory_create', class: DirectoryCreatorTool },
        { key: 'directory_list', class: DirectoryListTool },
        { key: 'directory_change', class: DirectoryChangeTool },
        { key: 'directory_current', class: DirectoryCurrentTool }
      ];

      for (const { key, class: ToolClass } of tools) {
        try {
          const tool = this.createToolFromMetadata(key, ToolClass);
          // Pass configuration to tool after creation
          if (tool.config !== undefined) {
            Object.assign(tool, this.config);
          } else {
            tool.config = this.config;
          }
          this.registerTool(tool.name, tool);
        } catch (error) {
          console.warn(`Failed to create metadata tool ${key}, falling back to legacy: ${error.message}`);
          
          // Fallback to legacy constructor for this specific tool
          const { basePath, encoding, createDirectories } = this.config;
          let legacyTool;
          
          switch (key) {
            case 'file_read':
              legacyTool = new FileReaderTool({ basePath, encoding });
              break;
            case 'file_write':
              legacyTool = new FileWriterTool({ basePath, encoding, createDirectories });
              break;
            case 'directory_create':
              legacyTool = new DirectoryCreatorTool({ basePath });
              break;
            case 'directory_list':
              legacyTool = new DirectoryListTool({ basePath });
              break;
            case 'directory_change':
              legacyTool = new DirectoryChangeTool({ basePath });
              break;
            case 'directory_current':
              legacyTool = new DirectoryCurrentTool({ basePath });
              break;
            default:
              console.error(`Unknown tool: ${key}`);
              continue;
          }
          
          if (legacyTool) {
            this.registerTool(legacyTool.name, legacyTool);
          }
        }
      }
    } else {
      // FALLBACK: Old approach for backwards compatibility
      const { basePath, encoding, createDirectories } = this.config;
      
      const fileReader = new FileReaderTool({ basePath, encoding });
      const fileWriter = new FileWriterTool({ basePath, encoding, createDirectories });
      const directoryCreator = new DirectoryCreatorTool({ basePath });
      const directoryList = new DirectoryListTool({ basePath });
      const directoryChange = new DirectoryChangeTool({ basePath });
      const directoryCurrent = new DirectoryCurrentTool({ basePath });

      this.registerTool(fileReader.name, fileReader);
      this.registerTool(fileWriter.name, fileWriter);
      this.registerTool(directoryCreator.name, directoryCreator);
      this.registerTool(directoryList.name, directoryList);
      this.registerTool(directoryChange.name, directoryChange);
      this.registerTool(directoryCurrent.name, directoryCurrent);
    }
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