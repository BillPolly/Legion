/**
 * SearchNavigationModule - Module containing search and navigation tools
 */

import { Module } from '@legion/tools-registry';
import { GlobTool } from './GlobTool.js';
import { GrepTool } from './GrepTool.js';
import { LSTool } from './LSTool.js';

export class SearchNavigationModule extends Module {
  constructor(resourceManager) {
    super();
    this.name = 'search-navigation';
    this.description = 'File search and navigation tools including glob patterns, content search, and directory listing';
    this.resourceManager = resourceManager;
    
    // Create and register all tools
    this.createTools();
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
    const module = new SearchNavigationModule(resourceManager);
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