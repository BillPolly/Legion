/**
 * DeploymentIntegration - Integration layer for Conan-the-Deployer
 * 
 * This class provides a standardized interface for deployment operations
 * using the Conan-the-Deployer module through the jsEnvoy module loader.
 */

class DeploymentIntegration {
  constructor(moduleLoader, resourceManager) {
    this.moduleLoader = moduleLoader;
    this.resourceManager = resourceManager;
    this.deployerModule = null;
    this.initialized = false;
    this.activeDeployments = new Map();
  }

  /**
   * Initialize the deployment integration
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Register deployment-related resources if needed
      await this._registerResources();

      // For now, always use direct import since module loader is using mocks
      // TODO: Update when module loader properly loads real modules
      const { default: ConanTheDeployer } = await import('../../../../conan-the-deployer/src/ConanTheDeployer.js');
      
      const dependencies = {
        resourceManager: this.resourceManager,
        config: {
          defaultProvider: 'local',
          monitoringEnabled: true,
          healthCheckInterval: 30000
        }
      };
      
      this.deployerModule = new ConanTheDeployer(dependencies);
      this.initialized = true;

    } catch (error) {
      throw new Error(`Failed to initialize deployment integration: ${error.message}`);
    }
  }

  /**
   * Register required resources with ResourceManager
   * @private
   */
  async _registerResources() {
    // Register environment variables as resources if available
    const envVars = {
      RAILWAY_API_TOKEN: process.env.RAILWAY_API_TOKEN,
      RAILWAY_API_KEY: process.env.RAILWAY_API_KEY,
      DOCKER_HOST: process.env.DOCKER_HOST
    };

    for (const [key, value] of Object.entries(envVars)) {
      if (value) {
        await this.resourceManager.register(key, {
          type: 'config',
          value: value
        });
      }
    }
  }

  /**
   * Ensure the integration is initialized
   * @private
   */
  _ensureInitialized() {
    if (!this.initialized) {
      throw new Error('DeploymentIntegration must be initialized before use');
    }
  }

  /**
   * Get supported deployment providers
   * @returns {Array<string>} List of supported providers
   */
  async getSupportedProviders() {
    this._ensureInitialized();
    
    try {
      // Get list of available providers from the module
      if (this.deployerModule && typeof this.deployerModule.listProviders === 'function') {
        return await this.deployerModule.listProviders();
      }
      
      // Default providers
      return ['local', 'docker', 'railway'];
    } catch (error) {
      return ['local', 'docker', 'railway'];
    }
  }

  /**
   * Deploy an application
   * @param {Object} deploymentConfig - Deployment configuration
   * @returns {Promise<Object>} Deployment result
   */
  async deploy(deploymentConfig) {
    this._ensureInitialized();

    try {
      const result = await this.deployerModule.deployApplication({
        projectPath: deploymentConfig.projectPath,
        provider: deploymentConfig.provider,
        name: deploymentConfig.name,
        config: deploymentConfig.config
      });

      if (result.success && result.id) {
        // Store deployment reference
        this.activeDeployments.set(result.id, {
          id: result.id,
          name: result.name,
          provider: result.provider,
          startTime: result.startTime || new Date(),
          config: deploymentConfig
        });
      }

      return result;

    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorCode: 'DEPLOYMENT_FAILED',
        errorDetails: error
      };
    }
  }

  /**
   * Monitor a deployment
   * @param {Object} monitorConfig - Monitor configuration
   * @returns {Promise<Object>} Monitor result
   */
  async monitor(monitorConfig) {
    this._ensureInitialized();

    try {
      return await this.deployerModule.monitorDeployment({
        deploymentId: monitorConfig.deploymentId,
        metrics: monitorConfig.metrics || ['health', 'cpu', 'memory'],
        interval: monitorConfig.interval || 30000,
        duration: monitorConfig.duration || 0
      });
    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorCode: 'MONITOR_FAILED'
      };
    }
  }

  /**
   * Get deployment logs
   * @param {Object} logConfig - Log configuration
   * @returns {Promise<Object>} Logs result
   */
  async getLogs(logConfig) {
    this._ensureInitialized();

    try {
      return await this.deployerModule.getDeploymentLogs({
        deploymentId: logConfig.deploymentId,
        lines: logConfig.lines || 100,
        follow: logConfig.follow || false,
        level: logConfig.level || 'all',
        since: logConfig.since
      });
    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorCode: 'LOGS_FAILED'
      };
    }
  }

  /**
   * Update a deployment
   * @param {Object} updateConfig - Update configuration
   * @returns {Promise<Object>} Update result
   */
  async update(updateConfig) {
    this._ensureInitialized();

    try {
      return await this.deployerModule.updateDeployment({
        deploymentId: updateConfig.deploymentId,
        projectPath: updateConfig.projectPath,
        strategy: updateConfig.strategy || 'rolling',
        config: updateConfig.config
      });
    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorCode: 'UPDATE_FAILED'
      };
    }
  }

  /**
   * Stop a deployment
   * @param {Object} stopConfig - Stop configuration
   * @returns {Promise<Object>} Stop result
   */
  async stop(stopConfig) {
    this._ensureInitialized();

    try {
      const result = await this.deployerModule.stopDeployment({
        deploymentId: stopConfig.deploymentId,
        graceful: stopConfig.graceful !== false,
        timeout: stopConfig.timeout || 30000
      });

      if (result.success) {
        // Update active deployments
        const deployment = this.activeDeployments.get(stopConfig.deploymentId);
        if (deployment) {
          deployment.status = 'stopped';
          deployment.stoppedAt = new Date();
        }
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorCode: 'STOP_FAILED'
      };
    }
  }

  /**
   * Remove a deployment
   * @param {Object} removeConfig - Remove configuration
   * @returns {Promise<Object>} Remove result
   */
  async remove(removeConfig) {
    this._ensureInitialized();

    try {
      const result = await this.deployerModule.removeDeployment({
        deploymentId: removeConfig.deploymentId,
        force: removeConfig.force || false,
        cleanup: removeConfig.cleanup !== false
      });

      if (result.success) {
        // Remove from active deployments
        this.activeDeployments.delete(removeConfig.deploymentId);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorCode: 'REMOVE_FAILED'
      };
    }
  }

  /**
   * List all deployments
   * @param {Object} listConfig - List configuration
   * @returns {Promise<Object>} List result
   */
  async listDeployments(listConfig = {}) {
    this._ensureInitialized();

    try {
      return await this.deployerModule.listDeployments({
        provider: listConfig.provider || 'all',
        status: listConfig.status || 'all',
        name: listConfig.name
      });
    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorCode: 'LIST_FAILED',
        deployments: []
      };
    }
  }

  /**
   * Get deployment status
   * @param {string} deploymentId - Deployment ID
   * @returns {Promise<Object>} Status information
   */
  async getStatus(deploymentId) {
    this._ensureInitialized();

    try {
      const deployment = this.activeDeployments.get(deploymentId);
      if (!deployment) {
        return {
          success: false,
          error: 'Deployment not found',
          errorCode: 'NOT_FOUND'
        };
      }

      // Get current status from module
      const listResult = await this.listDeployments({
        name: deployment.name
      });

      if (listResult.success && listResult.deployments.length > 0) {
        const currentDeployment = listResult.deployments.find(d => d.id === deploymentId);
        if (currentDeployment) {
          return {
            success: true,
            deployment: currentDeployment
          };
        }
      }

      return {
        success: true,
        deployment: deployment
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorCode: 'STATUS_FAILED'
      };
    }
  }

  /**
   * Get active deployments managed by this integration
   * @returns {Array<Object>} Active deployments
   */
  getActiveDeployments() {
    return Array.from(this.activeDeployments.values());
  }

  /**
   * Clear all active deployments (for cleanup)
   */
  clearActiveDeployments() {
    this.activeDeployments.clear();
  }

  /**
   * Create deployment configuration helper
   * @param {Object} projectInfo - Project information
   * @returns {Object} Deployment configuration
   */
  createDeploymentConfig(projectInfo) {
    const config = {
      name: projectInfo.name || 'generated-app',
      provider: projectInfo.provider || 'local',
      config: {
        env: projectInfo.environment || {},
        port: projectInfo.port || 3000
      }
    };

    // Add provider-specific defaults
    switch (config.provider) {
      case 'docker':
        config.config.dockerfile = projectInfo.dockerfile || './Dockerfile';
        config.config.buildArgs = projectInfo.buildArgs || {};
        break;
      
      case 'railway':
        config.config.environmentName = projectInfo.environmentName || 'production';
        if (projectInfo.railwayProjectId) {
          config.config.projectId = projectInfo.railwayProjectId;
        }
        break;
      
      case 'local':
        config.config.startCommand = projectInfo.startCommand || 'npm start';
        break;
    }

    return config;
  }

  /**
   * Validate deployment requirements
   * @param {Object} requirements - Deployment requirements
   * @returns {Object} Validation result
   */
  async validateRequirements(requirements) {
    const errors = [];
    const warnings = [];

    // Check provider availability
    const providers = await this.getSupportedProviders();
    if (requirements.provider && !providers.includes(requirements.provider)) {
      errors.push(`Provider '${requirements.provider}' is not available`);
    }

    // Check resource availability
    if (requirements.provider === 'railway') {
      const hasApiKey = await this.resourceManager.get('RAILWAY_API_TOKEN') || 
                       await this.resourceManager.get('RAILWAY_API_KEY');
      if (!hasApiKey) {
        errors.push('Railway API key not found in environment');
      }
    }

    if (requirements.provider === 'docker') {
      // Could check if Docker is available
      warnings.push('Ensure Docker daemon is running');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get deployment recommendations based on project type
   * @param {Object} projectInfo - Project information
   * @returns {Object} Recommendations
   */
  getDeploymentRecommendations(projectInfo) {
    const recommendations = {
      provider: 'local',
      configuration: {},
      notes: []
    };

    switch (projectInfo.type) {
      case 'frontend':
        recommendations.provider = 'docker';
        recommendations.configuration = {
          dockerfile: 'nginx-based',
          port: 80
        };
        recommendations.notes.push('Frontend apps work well with nginx Docker containers');
        break;
      
      case 'backend':
        recommendations.provider = 'railway';
        recommendations.configuration = {
          environmentName: 'production',
          healthCheckPath: '/health'
        };
        recommendations.notes.push('Backend services benefit from Railway\'s managed infrastructure');
        break;
      
      case 'fullstack':
        recommendations.provider = 'docker';
        recommendations.configuration = {
          dockerfile: 'multi-stage',
          port: 3000
        };
        recommendations.notes.push('Fullstack apps can use Docker Compose for complex setups');
        break;
    }

    return recommendations;
  }
}

export { DeploymentIntegration };