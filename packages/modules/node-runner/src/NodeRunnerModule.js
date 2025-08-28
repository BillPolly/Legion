/**
 * @fileoverview NodeRunnerModule - Main module for Node.js process management and logging
 */

import { Module } from '@legion/tools-registry';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
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
  constructor(dependencies = {}) {
    super();
    this.name = 'node-runner';
    this.description = 'Node.js process management and logging tools';
    this.version = '1.0.0';
    this.metadataPath = './tools-metadata.json';
    
    // Accept injected dependencies for testing, or initialize as null
    this.processManager = dependencies.processManager || null;
    this.serverManager = dependencies.serverManager || null;
    this.packageManager = dependencies.packageManager || null;
    this.logStorage = dependencies.logStorage || null;
    this.logSearch = dependencies.logSearch || null;
    this.sessionManager = dependencies.sessionManager || null;
    this.frontendInjector = dependencies.frontendInjector || null;
    this.webSocketServer = dependencies.webSocketServer || null;
    
    // Try to load metadata
    try {
      const metadata = this.loadMetadata();
      if (metadata) {
        this.metadata = metadata;
      }
    } catch (error) {
      // Will fall back to legacy approach
      this.metadata = null;
    }
    
    // If dependencies are provided, mark as initialized for testing
    if (Object.keys(dependencies).length > 0) {
      this.initialized = true;
      this.initializeTools();
    }
  }

  getModulePath() {
    return fileURLToPath(import.meta.url);
  }

  loadMetadata() {
    try {
      const modulePath = dirname(this.getModulePath());
      const metadataPath = join(modulePath, this.metadataPath);
      const metadataContent = readFileSync(metadataPath, 'utf8');
      return JSON.parse(metadataContent);
    } catch (error) {
      return null;
    }
  }

  static async create(resourceManager) {
    const module = new NodeRunnerModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }

  async initialize() {
    await super.initialize();
    
    // Only create components if they weren't injected
    if (!this.logStorage || !this.sessionManager || !this.processManager) {
      // Get providers from ResourceManager if available
      const StorageProvider = this.resourceManager?.get('StorageProvider') || null;
      const SemanticSearchProvider = this.resourceManager?.get('SemanticSearchProvider') || null;
      
      // Create core components if not injected
      if (!this.logStorage) {
        this.logStorage = new LogStorage(StorageProvider);
      }
      if (!this.sessionManager) {
        this.sessionManager = new SessionManager(StorageProvider);
      }
      if (!this.processManager) {
        this.processManager = new ProcessManager(this.logStorage, this.sessionManager);
      }
      if (!this.serverManager) {
        this.serverManager = new ServerManager(this.processManager, this.logStorage);
      }
      if (!this.logSearch) {
        this.logSearch = new LogSearch(SemanticSearchProvider, this.logStorage);
      }
    }
    
    // Initialize tools
    this.initializeTools();
  }

  initializeTools() {
    // Try metadata-driven tool creation first
    if (this.metadata && this.metadata.tools) {
      try {
        for (const [toolKey, toolMeta] of Object.entries(this.metadata.tools)) {
          this.registerTool(toolMeta.name, this.createMetadataTool(toolMeta));
        }
        return;
      } catch (error) {
        console.warn(`NodeRunner module metadata tool creation failed: ${error.message}, falling back to legacy`);
      }
    }
    
    // Fallback to legacy approach
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

  createMetadataTool(toolMeta) {
    // Create a tool proxy that routes to legacy implementations
    return {
      name: toolMeta.name,
      description: toolMeta.description,
      schema: {
        input: toolMeta.inputSchema,
        output: toolMeta.outputSchema
      },
      execute: async (args) => {
        // Route to appropriate legacy tool based on name
        switch (toolMeta.name) {
          case 'run_node':
            const runTool = new RunNodeTool(this);
            return await runTool.execute(args);
          case 'stop_node':
            const stopTool = new StopNodeTool(this);
            return await stopTool.execute(args);
          case 'list_sessions':
            const listTool = new ListSessionsTool(this);
            return await listTool.execute(args);
          case 'search_logs':
            const searchTool = new SearchLogsTool(this);
            return await searchTool.execute(args);
          case 'server_health':
            const healthTool = new ServerHealthTool(this);
            return await healthTool.execute(args);
          default:
            throw new Error(`Unknown NodeRunner tool: ${toolMeta.name}`);
        }
      }
    };
  }
}

export default NodeRunnerModule;