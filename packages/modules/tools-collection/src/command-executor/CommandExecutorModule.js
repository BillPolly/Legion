/**
 * CommandExecutorModule - Legion module for command execution
 * 
 * Provides a tool for executing bash commands in the terminal
 */

import { Module } from '@legion/tools-registry';
import { CommandExecutor } from './CommandExecutorTool.js';
import { fileURLToPath } from 'url';

class CommandExecutorModule extends Module {
  constructor() {
    super();
    this.name = 'command-executor';
    this.description = 'Command execution tools for running bash commands';
    this.version = '1.0.0';
    
    // NEW: Set metadata path for automatic loading
    this.metadataPath = './module.json';
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
    const module = new CommandExecutorModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }

  /**
   * Initialize the module - metadata-driven approach only
   */
  async initialize() {
    await super.initialize(); // This will load metadata automatically
    
    // Create tool using metadata
    const tool = this.createToolFromMetadata('command_executor', CommandExecutor);
    this.registerTool(tool.name, tool);
  }

  /**
   * Get all tools provided by this module
   */
  getTools() {
    return Object.values(this.tools);
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
