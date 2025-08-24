/**
 * SystemModule - Provides system-level tools for module management
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

export default class SystemModule extends Module {
  constructor() {
    super();
    this.name = 'system';
    this.description = 'System-level tools for module and tool management';
    this.version = '1.0.0';
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
   * Initialize the module
   */
  async initialize() {
    await super.initialize();
    
    // Create and register all system tools
    const moduleLoadTool = new ModuleLoadTool(this.config);
    const moduleUnloadTool = new ModuleUnloadTool(this.config);
    const moduleListTool = new ModuleListTool(this.config);
    const moduleInfoTool = new ModuleInfoTool(this.config);
    const moduleToolsTool = new ModuleToolsTool(this.config);
    
    this.registerTool(moduleLoadTool.name, moduleLoadTool);
    this.registerTool(moduleUnloadTool.name, moduleUnloadTool);
    this.registerTool(moduleListTool.name, moduleListTool);
    this.registerTool(moduleInfoTool.name, moduleInfoTool);
    this.registerTool(moduleToolsTool.name, moduleToolsTool);
  }
}
