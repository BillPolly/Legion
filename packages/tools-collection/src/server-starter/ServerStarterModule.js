/**
 * ServerStarterModule - Module wrapper for server management tools
 */

import { Module } from '@legion/tools-registry';
import ServerStarter from './index.js';

/**
 * ServerStarterModule - Provides server management tools
 */
export default class ServerStarterModule extends Module {
  constructor(dependencies = {}) {
    super('ServerStarterModule', dependencies);
    this.name = 'ServerStarterModule';
    this.description = 'Start and manage development servers';
    
    // Register the ServerStarter tool
    const serverStarter = new ServerStarter();
    this.registerTool(serverStarter.name, serverStarter);
  }
}

// Export the original tool for backward compatibility
export { default as ServerStarter } from './index.js';