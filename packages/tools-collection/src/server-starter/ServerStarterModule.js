/**
 * ServerStarterModule - Module wrapper for server management tools
 */

import { Module } from '@legion/tools-registry';
import ServerStarter from './index.js';

/**
 * ServerStarterModule - Provides server management tools
 */
export default class ServerStarterModule extends Module {
  constructor() {
    super();
    this.name = 'server-starter';
    this.description = 'Start and manage development servers';
    this.version = '1.0.0';
  }

  /**
   * Static async factory method following the standard interface
   */
  static async create(resourceManager) {
    const module = new ServerStarterModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }

  /**
   * Initialize the module
   */
  async initialize() {
    await super.initialize();
    
    // Register the ServerStarter tool
    const serverStarter = new ServerStarter();
    this.registerTool(serverStarter.name, serverStarter);
  }
}

// Export the original tool for backward compatibility
export { default as ServerStarter } from './index.js';
