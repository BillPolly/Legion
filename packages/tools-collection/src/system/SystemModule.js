/**
 * SystemModule - Provides system-level tools for module management
 * 
 * These tools are always available and provide information about
 * the loaded modules and their tools.
 */

import { Module } from '@legion/tools';
import { ModuleListTool } from './ModuleListTool.js';
import { ModuleInfoTool } from './ModuleInfoTool.js';
import { ModuleToolsTool } from './ModuleToolsTool.js';
import { ModuleLoadTool } from './ModuleLoadTool.js';
import { ModuleUnloadTool } from './ModuleUnloadTool.js';

export default class SystemModule extends Module {
  static dependencies = ['moduleLoader']; // Declare that we need moduleLoader
  
  constructor(dependencies = {}) {
    super('SystemModule', dependencies);
    this.description = 'System-level tools for module and tool management';
    
    // Initialize tools dictionary
    this.tools = {};
    
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