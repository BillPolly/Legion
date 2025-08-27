/**
 * @fileoverview NodeRunnerModule - Main module for Node.js process management and logging
 */

import { Module } from '@legion/tools-registry';
import { ProcessManager } from './managers/ProcessManager.js';
import { SessionManager } from './managers/SessionManager.js';
import { ServerManager } from './managers/ServerManager.js';
import { LogStorage } from './storage/LogStorage.js';
import { LogSearch } from './search/LogSearch.js';
import { RunNodeTool } from './tools/RunNodeTool.js';
import { StopNodeTool } from './tools/StopNodeTool.js';
import { SearchLogsTool } from './tools/SearchLogsTool.js';
import { ListSessionsTool } from './tools/ListSessionsTool.js';
import { ServerHealthTool } from './tools/ServerHealthTool.js';

class NodeRunnerModule extends Module {
  constructor() {
    super();
    this.name = 'node-runner';
    this.description = 'Node.js process management and logging tools';
    this.version = '1.0.0';
    
    this.processManager = null;
    this.serverManager = null;
    this.packageManager = null;
    this.logStorage = null;
    this.logSearch = null;
    this.sessionManager = null;
    this.frontendInjector = null;
    this.webSocketServer = null;
  }

  static async create(resourceManager) {
    const module = new NodeRunnerModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }

  async initialize() {
    await super.initialize();
    
    // Get providers from ResourceManager if available
    const StorageProvider = this.resourceManager?.get('StorageProvider') || null;
    const SemanticSearchProvider = this.resourceManager?.get('SemanticSearchProvider') || null;
    
    // Create core components
    this.logStorage = new LogStorage(StorageProvider);
    this.sessionManager = new SessionManager(StorageProvider);
    this.processManager = new ProcessManager(this.logStorage, this.sessionManager);
    this.serverManager = new ServerManager(this.processManager, this.logStorage);
    this.logSearch = new LogSearch(SemanticSearchProvider, this.logStorage);
    
    // Initialize tools
    this.initializeTools();
  }

  initializeTools() {
    // Create and register all NodeRunner tools
    const tools = [
      new RunNodeTool(this),
      new StopNodeTool(this),
      new SearchLogsTool(this),
      new ListSessionsTool(this),
      new ServerHealthTool(this)
    ];
    
    for (const tool of tools) {
      this.registerTool(tool.name, tool);
    }
  }
}

export default NodeRunnerModule;