/**
 * FileOperationsModule - Module containing all file operation tools
 */

import { Module } from '@legion/tools-registry';
import { ReadTool } from './ReadTool.js';
import { WriteTool } from './WriteTool.js';
import { EditTool } from './EditTool.js';
import { MultiEditTool } from './MultiEditTool.js';
import { NotebookEditTool } from './NotebookEditTool.js';

class FileOperationsModule extends Module {
  constructor() {
    super();
    this.name = 'file-operations';
    this.description = 'Comprehensive file system operations including reading, writing, editing, and Jupyter notebook support';
    this.resourceManager = null;
  }

  /**
   * Create and register all file operation tools
   */
  createTools() {
    // Create tool instances
    const readTool = new ReadTool();
    const writeTool = new WriteTool();
    const editTool = new EditTool();
    const multiEditTool = new MultiEditTool();
    const notebookEditTool = new NotebookEditTool();

    // Register tools
    this.registerTool('Read', readTool);
    this.registerTool('Write', writeTool);
    this.registerTool('Edit', editTool);
    this.registerTool('MultiEdit', multiEditTool);
    this.registerTool('NotebookEdit', notebookEditTool);
  }

  /**
   * Factory method for creating the module
   */
  static async create(resourceManager) {
    const module = new FileOperationsModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }

  /**
   * Initialize the module
   */
  async initialize() {
    await super.initialize();
    
    // Create and register all tools
    this.createTools();
  }

  /**
   * Get module metadata
   */
  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      tools: this.getTools().map(tool => ({
        name: tool.name,
        description: tool.description
      }))
    };
  }
}

export default FileOperationsModule;
export { FileOperationsModule };