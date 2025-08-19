/**
 * FileOperationsModule - Module containing all file operation tools
 */

import { Module } from '@legion/tools-registry';
import { ReadTool } from './ReadTool.js';
import { WriteTool } from './WriteTool.js';
import { EditTool } from './EditTool.js';
import { MultiEditTool } from './MultiEditTool.js';
import { NotebookEditTool } from './NotebookEditTool.js';

export class FileOperationsModule extends Module {
  constructor(resourceManager) {
    super();
    this.name = 'file-operations';
    this.description = 'Comprehensive file system operations including reading, writing, editing, and Jupyter notebook support';
    this.resourceManager = resourceManager;
    
    // Create and register all tools
    this.createTools();
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
    const module = new FileOperationsModule(resourceManager);
    await module.initialize();
    return module;
  }

  /**
   * Get module metadata
   */
  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      tools: this.listTools().map(name => {
        const tool = this.getTool(name);
        return {
          name: tool.name,
          description: tool.description
        };
      })
    };
  }
}