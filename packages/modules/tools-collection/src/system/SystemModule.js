/**
 * SystemModule - Provides system-level tools for module management using metadata-driven architecture
 * 
 * These tools are always available and provide information about
 * the loaded modules and their tools.
 */

import { Module } from '@legion/tools-registry';
import { ModuleListTool } from './ModuleListTool.js';
import { ModuleInfoTool } from './ModuleInfoTool.js';
import { ModuleToolsTool } from './ModuleToolsTool.js';
import { ModuleLoadTool } from './ModuleLoadTool.js';
import { ModuleUnloadTool } from './ModuleUnloadTool.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default class SystemModule extends Module {
  constructor() {
    super();
    this.name = 'system';
    this.description = 'System-level tools for module management and introspection';
    this.version = '1.0.0';
    
    // NEW: Set metadata path for automatic loading
    this.metadataPath = './tools-metadata.json';
    
    this.toolClasses = {
      ModuleListTool,
      ModuleInfoTool,
      ModuleToolsTool,
      ModuleLoadTool,
      ModuleUnloadTool
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
    const module = new SystemModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }

  /**
   * Initialize the module - NEW metadata-driven approach
   */
  async initialize() {
    await super.initialize(); // This loads metadata automatically
    
    // NEW APPROACH: Create tools using metadata
    if (this.metadata) {
      const tools = [
        { key: 'module_list', class: ModuleListTool },
        { key: 'module_info', class: ModuleInfoTool },
        { key: 'module_tools', class: ModuleToolsTool },
        { key: 'module_load', class: ModuleLoadTool },
        { key: 'module_unload', class: ModuleUnloadTool }
      ];

      for (const { key, class: ToolClass } of tools) {
        try {
          const tool = this.createToolFromMetadata(key, ToolClass);
          this.registerTool(tool.name, tool);
        } catch (error) {
          console.warn(`Failed to create metadata tool ${key}, falling back to legacy: ${error.message}`);
          
          // Fallback to legacy
          const legacyTool = new ToolClass();
          this.registerTool(legacyTool.name, legacyTool);
        }
      }
    } else {
      // FALLBACK: Old approach for backwards compatibility
      const tools = [
        new ModuleListTool(),
        new ModuleInfoTool(),
        new ModuleToolsTool(),
        new ModuleLoadTool(),
        new ModuleUnloadTool()
      ];
      
      for (const tool of tools) {
        this.registerTool(tool.name, tool);
      }
    }
  }

  /**
   * Get module metadata from loaded metadata
   */
  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      version: this.version,
      author: this.author || 'Legion Team',
      tools: this.getTools().length,
      capabilities: this.capabilities || [],
      supportedFeatures: this.supportedFeatures || []
    };
  }

  /**
   * Get all tools provided by this module
   */
  getTools() {
    if (!this.initialized) {
      throw new Error('SystemModule must be initialized before getting tools');
    }
    return Object.values(this.tools);
  }
}
