/**
 * SearchNavigationModule - Module containing search and navigation tools
 */

import { Module } from '@legion/tools-registry';
import { GlobTool } from './GlobTool.js';
import { GrepTool } from './GrepTool.js';
import { LSTool } from './LSTool.js';

export class SearchNavigationModule extends Module {
  constructor() {
    super();
    this.name = 'search-navigation';
    this.description = 'File search and navigation tools including glob patterns, content search, and directory listing';
    this.resourceManager = null;
  }

  /**
   * Create and register all search navigation tools
   */
  createTools() {
    // Create tool instances
    const globTool = new GlobTool();
    const grepTool = new GrepTool();
    const lsTool = new LSTool();

    // Register tools
    this.registerTool('Glob', globTool);
    this.registerTool('Grep', grepTool);
    this.registerTool('LS', lsTool);
  }

  /**
   * Factory method for creating the module
   */
  static async create(resourceManager) {
    const module = new SearchNavigationModule();
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