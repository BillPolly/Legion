import { Module } from '@legion/tools-registry';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import RailwayDeployTool from './tools/RailwayDeployTool.js';
import RailwayStatusTool from './tools/RailwayStatusTool.js';
import RailwayLogsTool from './tools/RailwayLogsTool.js';
import RailwayUpdateEnvTool from './tools/RailwayUpdateEnvTool.js';
import RailwayRemoveTool from './tools/RailwayRemoveTool.js';
import RailwayListProjectsTool from './tools/RailwayListProjectsTool.js';
import RailwayProvider from './providers/RailwayProvider.js';

class RailwayModule extends Module {
  constructor() {
    super();
    this.name = 'railway';
    this.description = 'Deploy and manage applications on Railway cloud platform';
    this.version = '1.0.0';
    this.resourceManager = null;
    this.provider = null;
    // NEW: Set metadata path for automatic loading
    this.metadataPath = './tools-metadata.json';
  }

  /**
   * Override getModulePath to support proper path resolution
   */
  getModulePath() {
    return fileURLToPath(import.meta.url);
  }

  /**
   * Static async factory method following the standard interface
   */
  static async create(resourceManager) {
    const module = new RailwayModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }
  
  initializeTools() {
    // NEW APPROACH: Create tools using metadata
    if (this.metadata) {
      const tools = [
        { key: 'railway_deploy', class: RailwayDeployTool },
        { key: 'railway_status', class: RailwayStatusTool },
        { key: 'railway_logs', class: RailwayLogsTool },
        { key: 'railway_update_env', class: RailwayUpdateEnvTool },
        { key: 'railway_remove', class: RailwayRemoveTool },
        { key: 'railway_list_projects', class: RailwayListProjectsTool }
      ];

      for (const { key, class: ToolClass } of tools) {
        try {
          const tool = this.createToolFromMetadata(key, ToolClass);
          tool.provider = this.provider;
          tool.resourceManager = this.resourceManager;
          this.registerTool(tool.name, tool);
        } catch (error) {
          console.warn(`Failed to create metadata tool ${key}, falling back to legacy: ${error.message}`);
          
          // Fallback to legacy constructor
          const legacyTool = new ToolClass(this.resourceManager);
          if (legacyTool.setProvider) legacyTool.setProvider(this.provider);
          this.registerTool(legacyTool.name, legacyTool);
        }
      }
    } else {
      // FALLBACK: Old approach for backwards compatibility  
      const tools = [
        new RailwayDeployTool(this.resourceManager),
      new RailwayStatusTool(this.resourceManager),
      new RailwayLogsTool(this.resourceManager),
      new RailwayUpdateEnvTool(this.resourceManager),
      new RailwayRemoveTool(this.resourceManager),
      new RailwayListProjectsTool(this.resourceManager)
    ];
    
    for (const tool of tools) {
      this.registerTool(tool.name, tool);
    }
    }
  }
  
  async initialize() {
    await super.initialize();
    
    // Get Railway API key from environment
    const apiKey = this.resourceManager.get('env.RAILWAY_API_KEY') || 
                   this.resourceManager.get('env.RAILWAY_API_TOKEN') ||
                   this.resourceManager.get('env.RAILWAY');
    
    if (!apiKey) {
      throw new Error('Railway API key not found. Set RAILWAY_API_KEY, RAILWAY_API_TOKEN, or RAILWAY environment variable.');
    }
    
    // Create Railway provider
    this.provider = new RailwayProvider(apiKey);
    
    // Register provider with resource manager for other modules to use
    this.resourceManager.set('railwayProvider', this.provider);
    
    // Initialize tools
    this.initializeTools();
    
    // Verify API key works by making a simple request
    try {
      if (this.provider && this.provider.getAccountOverview) {
        const result = await this.provider.getAccountOverview();
        if (result.success) {
          console.log(`Railway module initialized for account: ${result.account.email}`);
        } else {
          console.warn('Railway API key verification failed:', result.error);
        }
      }
    } catch (error) {
      console.warn('Railway initialization warning:', error.message);
    }
  }
  
  async cleanup() {
    // Cleanup any active deployments if needed
    console.log('Railway module cleanup completed');
  }
}

export default RailwayModule;