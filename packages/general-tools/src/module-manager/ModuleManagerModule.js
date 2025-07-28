import { Module, ModuleManager, ModuleFactory } from '@legion/module-loader';
import path from 'path';
import ModuleListTool from './tools/ModuleListTool.js';
import ModuleLoadTool from './tools/ModuleLoadTool.js';
import ModuleUnloadTool from './tools/ModuleUnloadTool.js';
import ModuleInfoTool from './tools/ModuleInfoTool.js';
import ModuleDiscoverTool from './tools/ModuleDiscoverTool.js';
import ModuleToolsTool from './tools/ModuleToolsTool.js';

/**
 * ModuleManagerModule - Provides module management capabilities as Legion tools
 */
export default class ModuleManagerModule extends Module {
  static dependencies = ['ResourceManager'];

  constructor(dependencies) {
    super();
    this.resourceManager = dependencies.ResourceManager;
    this.name = 'module-manager';
    this.description = 'Dynamic module discovery and management';
    
    // Use existing ModuleManager if provided, otherwise create new one
    if (dependencies.ModuleManager) {
      console.log('[ModuleManagerModule] Using existing ModuleManager from dependencies');
      this.moduleManager = dependencies.ModuleManager;
      this.moduleLoader = dependencies.ModuleLoader; // Store reference to loader
    } else {
      console.log('[ModuleManagerModule] Creating new ModuleManager');
      // Create ModuleFactory and ModuleManager
      this.moduleFactory = new ModuleFactory(this.resourceManager);
      this.moduleManager = new ModuleManager(this.moduleFactory, {
        searchDepth: 3,
        autoDiscover: true
      });
      
      // Store reference in ResourceManager for other modules to use
      this.resourceManager.register('ModuleManager', this.moduleManager);
      this.resourceManager.register('ModuleFactory', this.moduleFactory);
    }

    // Default directories to search - navigate up to Legion root
    const currentPath = process.cwd();
    // If we're in a subdirectory, go up to Legion root
    const basePath = currentPath.includes('packages/') 
      ? path.resolve(currentPath.substring(0, currentPath.indexOf('packages/')))
      : currentPath;
      
    this.defaultDirectories = [
      path.join(basePath, 'packages/general-tools/src'),
      path.join(basePath, 'packages/apps'),
      path.join(basePath, 'packages/code-gen')
    ];

    // Initialize tools
    this.initializeTools();
  }

  initializeTools() {
    this.tools = [
      new ModuleListTool(this.moduleManager),
      new ModuleLoadTool(this.moduleManager),
      new ModuleUnloadTool(this.moduleManager),
      new ModuleInfoTool(this.moduleManager),
      new ModuleDiscoverTool(this.moduleManager, this.defaultDirectories),
      new ModuleToolsTool(this.moduleManager)
    ];
    console.log(`[ModuleManagerModule] Initialized ${this.tools.length} tools:`, this.tools.map(t => t.name));
  }

  getTools() {
    return this.tools;
  }

  getName() {
    return 'module-manager';
  }

  getDescription() {
    return 'Dynamic module discovery and management';
  }

  async initialize() {
    // Optionally discover modules on startup
    if (this.moduleManager.options.autoDiscover) {
      try {
        await this.moduleManager.discoverModules(this.defaultDirectories);
      } catch (error) {
        console.warn('Failed to auto-discover modules:', error.message);
      }
    }
  }

  async cleanup() {
    // Unregister from ResourceManager
    this.resourceManager.unregister('ModuleManager');
    this.resourceManager.unregister('ModuleFactory');
  }
}