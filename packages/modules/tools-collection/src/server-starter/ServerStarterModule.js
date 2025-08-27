/**
 * ServerStarterModule - Module wrapper for server management tools
 */

import { Module } from '@legion/tools-registry';
import ServerStartTool from './ServerStartTool.js';
import ServerReadOutputTool from './ServerReadOutputTool.js';
import ServerStopTool from './ServerStopTool.js';

/**
 * ServerStarterModule - Provides server management tools
 */
export default class ServerStarterModule extends Module {
  constructor() {
    super();
    this.name = 'server-starter';
    this.description = 'Start and manage development servers with comprehensive process control';
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
    
    // Register all server management tools
    const serverStartTool = new ServerStartTool();
    const serverReadOutputTool = new ServerReadOutputTool();
    const serverStopTool = new ServerStopTool();
    
    this.registerTool(serverStartTool.name, serverStartTool);
    this.registerTool(serverReadOutputTool.name, serverReadOutputTool);
    this.registerTool(serverStopTool.name, serverStopTool);
  }
}
