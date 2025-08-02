/**
 * SystemModule - Provides system-level tools for module management
 * 
 * These tools are always available and provide information about
 * the loaded modules and their tools.
 */

import { Module } from '@legion/module-loader';
import { ModuleListTool } from './ModuleListTool.js';
import { ModuleInfoTool } from './ModuleInfoTool.js';
import { ModuleToolsTool } from './ModuleToolsTool.js';
import { ModuleLoadTool } from './ModuleLoadTool.js';

export default class SystemModule extends Module {
  static dependencies = ['moduleLoader']; // Declare that we need moduleLoader
  
  constructor(dependencies = {}) {
    super('SystemModule', dependencies);
    this.description = 'System-level tools for module and tool management';
  }

  getTools() {
    return [
      new ModuleLoadTool(this.dependencies),
      new ModuleListTool(this.dependencies),
      new ModuleInfoTool(this.dependencies),
      new ModuleToolsTool(this.dependencies)
    ];
  }
}