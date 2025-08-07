import BaseProvider from './BaseProvider.js';

/**
 * RailwayProviderAdapter - Adapter that wraps @legion/railway provider to match BaseProvider interface
 */
class RailwayProviderAdapter extends BaseProvider {
  constructor(resourceManager) {
    super();
    this.resourceManager = resourceManager;
    this.name = 'railway';
    this.railwayProvider = null;
  }

  async initialize() {
    if (this.railwayProvider) return;
    
    // Check if resourceManager is available
    if (!this.resourceManager) {
      throw new Error('ResourceManager not provided to RailwayProviderAdapter');
    }
    
    // First try to get the Railway provider from resource manager (registered by Railway module)
    try {
      this.railwayProvider = this.resourceManager.railwayProvider;
    } catch (error) {
      // Not available from module
    }
    
    if (!this.railwayProvider) {
      // If not available through module, try to create directly
      try {
        let apiKey;
        try {
          apiKey = this.resourceManager.env.RAILWAY || 
                   this.resourceManager.env.RAILWAY_API_KEY;
        } catch (error) {
          // Try alternative method
          apiKey = process.env.RAILWAY || process.env.RAILWAY_API_KEY;
        }
        
        if (!apiKey) {
          throw new Error('Railway API key not available. Set RAILWAY or RAILWAY_API_KEY environment variable.');
        }
        
        // Use direct import path
        const { RailwayProvider } = await import('../../../railway/src/providers/RailwayProvider.js');
        this.railwayProvider = new RailwayProvider(apiKey);
      } catch (error) {
        throw new Error(`Failed to initialize Railway provider: ${error.message}`);
      }
    }
  }

  async ensureInitialized() {
    if (!this.railwayProvider) {
      await this.initialize();
    }
  }

  /**
   * Get provider capabilities
   */
  getCapabilities() {
    // Capabilities can be returned without initialization
    return {
      name: 'railway',
      displayName: 'Railway',
      description: 'Deploy applications to Railway cloud platform',
      supports: {
        hosting: true,
        customDomains: true,
        ssl: true,
        scaling: true,
        databases: true,
        environmentVariables: true,
        monitoring: true,
        githubIntegration: true,
        dockerSupport: true,
        buildFromSource: true,
        multiInstance: false,
        loadBalancing: true,
        autoScaling: true
      },
      requirements: {
        railwayApiKey: true,
        githubRepo: false
      }
    };
  }

  /**
   * Validate deployment configuration
   */
  async validateConfig(config) {
    await this.ensureInitialized();
    return this.railwayProvider.validateConfig(config);
  }

  /**
   * Deploy application to Railway
   */
  async deploy(config) {
    await this.ensureInitialized();
    
    // If source is github and we need a domain, use deployWithDomain
    if (config.source === 'github' && config.generateDomain !== false) {
      return await this.railwayProvider.deployWithDomain(config);
    }
    
    return await this.railwayProvider.deploy(config);
  }

  /**
   * Get deployment status
   */
  async getStatus(deploymentId) {
    await this.ensureInitialized();
    return await this.railwayProvider.getStatus(deploymentId);
  }

  /**
   * Get deployment logs
   */
  async getLogs(deploymentId, options = {}) {
    await this.ensureInitialized();
    return await this.railwayProvider.getLogs(deploymentId, options);
  }

  /**
   * Get service metrics
   */
  async getMetrics(serviceId) {
    await this.ensureInitialized();
    return await this.railwayProvider.getMetrics(serviceId);
  }

  /**
   * Update service configuration
   */
  async update(serviceId, updateConfig) {
    await this.ensureInitialized();
    return await this.railwayProvider.update(serviceId, updateConfig);
  }

  /**
   * Stop service (Railway doesn't have explicit stop)
   */
  async stop(serviceId) {
    await this.ensureInitialized();
    return await this.railwayProvider.stop(serviceId);
  }

  /**
   * Remove deployment/service
   */
  async remove(deploymentId) {
    await this.ensureInitialized();
    return await this.railwayProvider.remove(deploymentId);
  }

  /**
   * List all deployments
   */
  async listDeployments() {
    await this.ensureInitialized();
    return await this.railwayProvider.listDeployments();
  }

  /**
   * Railway-specific methods exposed for compatibility
   */
  
  async createProject(config) {
    await this.ensureInitialized();
    return await this.railwayProvider.createProject(config);
  }

  async listProjects() {
    await this.ensureInitialized();
    return await this.railwayProvider.listProjects();
  }

  async deleteProject(projectId) {
    await this.ensureInitialized();
    return await this.railwayProvider.deleteProject(projectId);
  }

  async setEnvironmentVariables(serviceId, variables) {
    await this.ensureInitialized();
    return await this.railwayProvider.setEnvironmentVariables(serviceId, variables);
  }

  async getEnvironmentVariables(serviceId) {
    await this.ensureInitialized();
    return await this.railwayProvider.getEnvironmentVariables(serviceId);
  }

  async addCustomDomain(serviceId, config) {
    await this.ensureInitialized();
    return await this.railwayProvider.addCustomDomain(serviceId, config);
  }

  async listCustomDomains(serviceId) {
    await this.ensureInitialized();
    return await this.railwayProvider.listCustomDomains(serviceId);
  }

  async createDatabase(projectId, config) {
    await this.ensureInitialized();
    return await this.railwayProvider.createDatabase(projectId, config);
  }

  async getDatabaseConnection(serviceId) {
    await this.ensureInitialized();
    return await this.railwayProvider.getDatabaseConnection(serviceId);
  }

  async getProjectDetails(projectId) {
    await this.ensureInitialized();
    return await this.railwayProvider.getProjectDetails(projectId);
  }

  async getAccountOverview() {
    await this.ensureInitialized();
    return await this.railwayProvider.getAccountOverview();
  }

  async deleteAllProjects() {
    await this.ensureInitialized();
    return await this.railwayProvider.deleteAllProjects();
  }

  async deployWithDomain(config) {
    await this.ensureInitialized();
    return await this.railwayProvider.deployWithDomain(config);
  }
}

export default RailwayProviderAdapter;