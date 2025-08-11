/**
 * CommandExecutorModule - Legion module for command execution
 * 
 * Provides a tool for executing bash commands in the terminal
 */

import { Module } from '@legion/tools';
import { CommandExecutor } from './CommandExecutorTool.js';

export class CommandExecutorModule extends Module {
  constructor(dependencies = {}) {
    super();
    this.name = 'CommandExecutorModule';
    this.description = 'Command execution tools for running bash commands';
    this.version = '1.0.0';
    
    // Initialize tools dictionary
    this.tools = {};
    
    // Create and register the command executor tool
    const commandExecutor = new CommandExecutor();
    this.registerTool(commandExecutor.name, commandExecutor);
  }

  /**
   * Static async factory method following the ResourceManager pattern
   */
  static async create(resourceManager) {
    const module = new CommandExecutorModule();
    await module.initialize();
    return module;
  }

  /**
   * Initialize the module
   */
  async initialize() {
    if (this.initialized) return;
    this.initialized = true;
    if (super.initialize) {
      await super.initialize();
    }
  }

  /**
   * Get all tools provided by this module
   */
  getTools() {
    return this.tools;
  }

  /**
   * Get module metadata
   */
  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      version: this.version,
      tools: Object.keys(this.tools).length
    };
  }
}

export default CommandExecutorModule;