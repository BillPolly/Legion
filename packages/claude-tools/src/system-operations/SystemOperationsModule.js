/**
 * SystemOperationsModule - Module containing system operation tools
 */

import { Module } from '@legion/tools-registry';
import { BashTool } from './BashTool.js';

export class SystemOperationsModule extends Module {
  constructor() {
    super();
    this.name = 'system-operations';
    this.description = 'System command execution tools with security controls and timeout management';
    this.resourceManager = null;
  }

  /**
   * Create and register all system operation tools
   */
  createTools() {
    // Create tool instances
    const bashTool = new BashTool();

    // Register tools
    this.registerTool('Bash', bashTool);
  }

  /**
   * Factory method for creating the module
   */
  static async create(resourceManager) {
    const module = new SystemOperationsModule();
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