/**
 * WebToolsModule - Module containing web-related tools
 */

import { Module } from '@legion/tools-registry';
import { WebSearchTool } from './WebSearchTool.js';
import { WebFetchTool } from './WebFetchTool.js';

export class WebToolsModule extends Module {
  constructor() {
    super();
    this.name = 'web-tools';
    this.description = 'Web search and content fetching tools for accessing online information';
    this.resourceManager = null;
  }

  /**
   * Create and register all web tools
   */
  createTools() {
    // Create tool instances
    const webSearchTool = new WebSearchTool();
    const webFetchTool = new WebFetchTool();

    // Register tools
    this.registerTool('WebSearch', webSearchTool);
    this.registerTool('WebFetch', webFetchTool);
  }

  /**
   * Factory method for creating the module
   */
  static async create(resourceManager) {
    const module = new WebToolsModule();
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