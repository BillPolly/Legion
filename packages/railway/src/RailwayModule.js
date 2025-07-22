import { Module } from '@legion/module-loader';
import RailwayDeployTool from './tools/RailwayDeployTool.js';
import RailwayStatusTool from './tools/RailwayStatusTool.js';
import RailwayLogsTool from './tools/RailwayLogsTool.js';
import RailwayUpdateEnvTool from './tools/RailwayUpdateEnvTool.js';
import RailwayRemoveTool from './tools/RailwayRemoveTool.js';
import RailwayListProjectsTool from './tools/RailwayListProjectsTool.js';
import RailwayProvider from './providers/RailwayProvider.js';

class RailwayModule extends Module {
  constructor(resourceManager) {
    super('railway', resourceManager);
    this.displayName = 'Railway Deployment Module';
    this.description = 'Deploy and manage applications on Railway cloud platform';
    
    // Initialize Railway provider
    const apiKey = this.resourceManager.get('env.RAILWAY_API_KEY') || 
                   this.resourceManager.get('env.RAILWAY');
    
    if (!apiKey) {
      throw new Error('Railway API key not found. Set RAILWAY_API_KEY or RAILWAY environment variable.');
    }
    
    this.provider = new RailwayProvider(apiKey);
    
    // Register provider with resource manager for other modules to use
    this.resourceManager.register('railwayProvider', this.provider);
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
      const result = await this.provider.getAccountOverview();
      if (result.success) {
        console.log(`Railway module initialized for account: ${result.account.email}`);
      } else {
        console.warn('Railway API key verification failed:', result.error);
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