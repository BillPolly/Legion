/**
 * @fileoverview NodeRunnerModule - Main module for Node.js process management and logging
 */

import { Module } from './base/Module.js';
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

export class NodeRunnerModule extends Module {
  constructor(dependencies = {}) {
    super('node-runner', dependencies);
    
    this.processManager = dependencies.processManager;
    this.serverManager = dependencies.serverManager;
    this.packageManager = dependencies.packageManager;
    this.logStorage = dependencies.logStorage;
    this.logSearch = dependencies.logSearch;
    this.sessionManager = dependencies.sessionManager;
    this.frontendInjector = dependencies.frontendInjector;
    this.webSocketServer = dependencies.webSocketServer;
  }

  static async create(resourceManager) {
    // Get providers from ResourceManager if available
    const StorageProvider = resourceManager?.get('StorageProvider') || null;
    const SemanticSearchProvider = resourceManager?.get('SemanticSearchProvider') || null;
    
    // Create core components
    const logStorage = new LogStorage(StorageProvider);
    const sessionManager = new SessionManager(StorageProvider);
    const processManager = new ProcessManager(logStorage, sessionManager);
    const serverManager = new ServerManager(processManager, logStorage);
    const logSearch = new LogSearch(SemanticSearchProvider, logStorage);
    
    // Create module with dependencies
    const dependencies = {
      processManager,
      serverManager,
      packageManager: null, // Will be implemented in Phase 6
      logStorage,
      logSearch,
      sessionManager,
      frontendInjector: null, // Will be implemented in Phase 6
      webSocketServer: null // Will be implemented in Phase 6
    };
    
    return new NodeRunnerModule(dependencies);
  }

  getTools() {
    return [
      new RunNodeTool(this),
      new StopNodeTool(this),
      new SearchLogsTool(this),
      new ListSessionsTool(this),
      new ServerHealthTool(this)
    ];
  }
}