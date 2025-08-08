import { Module } from '@legion/tools';
import RailwayDeployTool from './tools/RailwayDeployTool.js';
import RailwayStatusTool from './tools/RailwayStatusTool.js';
import RailwayLogsTool from './tools/RailwayLogsTool.js';
import RailwayUpdateEnvTool from './tools/RailwayUpdateEnvTool.js';
import RailwayRemoveTool from './tools/RailwayRemoveTool.js';
import RailwayListProjectsTool from './tools/RailwayListProjectsTool.js';
import RailwayProvider from './providers/RailwayProvider.js';

class RailwayModule extends Module {
  constructor(dependencies = {}) {
    super();
    this.name = 'railway';
    this.displayName = 'Railway Deployment Module';
    this.description = 'Deploy and manage applications on Railway cloud platform';
    this.config = dependencies;
    this.provider = dependencies.railwayProvider;
    this.resourceManager = dependencies.resourceManager;
  }

  /**
   * Static async factory method following the ResourceManager pattern
   */
  static async create(resourceManager) {
    // Get Railway API key from environment
    const apiKey = resourceManager.env.RAILWAY_API_KEY || 
                   resourceManager.env.RAILWAY_API_TOKEN ||
                   resourceManager.env.RAILWAY;
    
    if (!apiKey) {
      throw new Error('Railway API key not found. Set RAILWAY_API_KEY, RAILWAY_API_TOKEN, or RAILWAY environment variable.');
    }
    
    // Create Railway provider
    const provider = new RailwayProvider(apiKey);
    
    // Register provider with resource manager for other modules to use
    resourceManager.register('railwayProvider', provider);
    
    // Create module instance with dependencies
    return new RailwayModule({
      railwayProvider: provider,
      resourceManager: resourceManager
    });
  }
  
  getTools() {
    return [
      new RailwayDeployTool(this.resourceManager),
      new RailwayStatusTool(this.resourceManager),
      new RailwayLogsTool(this.resourceManager),
      new RailwayUpdateEnvTool(this.resourceManager),
      new RailwayRemoveTool(this.resourceManager),
      new RailwayListProjectsTool(this.resourceManager)
    ];
  }
  
  async initialize() {
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