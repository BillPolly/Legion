/**
 * ClaudeToolsModule - Main module that combines all Claude tools
 */

import { Module } from '@legion/tools-registry';
import { FileOperationsModule } from './file-operations/FileOperationsModule.js';
import { SearchNavigationModule } from './search-navigation/SearchNavigationModule.js';
import { SystemOperationsModule } from './system-operations/SystemOperationsModule.js';
import { WebToolsModule } from './web-tools/WebToolsModule.js';
import { TaskManagementModule } from './task-management/TaskManagementModule.js';

export class ClaudeToolsModule extends Module {
  constructor(resourceManager) {
    super();
    this.name = 'claude-tools';
    this.description = 'Complete suite of Claude Code tools for the Legion framework';
    this.resourceManager = resourceManager;
    this.subModules = new Map();
  }

  /**
   * Initialize all sub-modules
   */
  async initialize() {
    await super.initialize();
    
    // Create all sub-modules
    const modules = [
      await FileOperationsModule.create(this.resourceManager),
      await SearchNavigationModule.create(this.resourceManager),
      await SystemOperationsModule.create(this.resourceManager),
      await WebToolsModule.create(this.resourceManager),
      await TaskManagementModule.create(this.resourceManager)
    ];

    // Register all tools from sub-modules
    for (const module of modules) {
      this.subModules.set(module.name, module);
      
      // Register each tool from the sub-module
      for (const toolName of module.listTools()) {
        const tool = module.getTool(toolName);
        this.registerTool(toolName, tool);
      }
    }
  }

  /**
   * Factory method for creating the module
   */
  static async create(resourceManager) {
    const module = new ClaudeToolsModule(resourceManager);
    await module.initialize();
    return module;
  }

  /**
   * Get a specific sub-module
   */
  getSubModule(name) {
    return this.subModules.get(name);
  }

  /**
   * List all sub-modules
   */
  listSubModules() {
    return Array.from(this.subModules.keys());
  }

  /**
   * Get metadata including sub-modules
   */
  getMetadata() {
    const metadata = {
      name: this.name,
      description: this.description,
      subModules: {},
      tools: {}
    };

    // Add sub-module metadata
    for (const [name, module] of this.subModules) {
      metadata.subModules[name] = {
        name: module.name,
        description: module.description,
        toolCount: module.listTools().length
      };
    }

    // Group tools by module
    for (const [moduleName, module] of this.subModules) {
      metadata.tools[moduleName] = module.listTools().map(toolName => {
        const tool = module.getTool(toolName);
        return {
          name: tool.name,
          description: tool.description
        };
      });
    }

    metadata.totalTools = this.listTools().length;

    return metadata;
  }

  /**
   * Get categorized tool list
   */
  getCategorizedTools() {
    const categories = {};
    
    for (const [moduleName, module] of this.subModules) {
      categories[moduleName] = module.listTools();
    }
    
    return categories;
  }
}