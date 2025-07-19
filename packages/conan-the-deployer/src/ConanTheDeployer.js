import { Module } from '@jsenvoy/module-loader';
import DeploymentManager from './DeploymentManager.js';
import MonitoringSystem from './MonitoringSystem.js';
import LocalProvider from './providers/LocalProvider.js';
import DockerProvider from './providers/DockerProvider.js';
import RailwayProvider from './providers/RailwayProvider.js';

/**
 * ConanTheDeployer - Main module for deploying and monitoring Node.js applications
 */
class ConanTheDeployer extends Module {
  constructor(config = {}, resourceManager = null) {
    super();
    
    this.name = 'conan-the-deployer';
    this.description = 'Deploy and monitor Node.js applications across multiple providers';
    
    // Merge with default configuration
    this.config = {
      defaultProvider: 'local',
      monitoringEnabled: true,
      healthCheckInterval: 30000,
      metricsInterval: 60000,
      logBufferSize: 1000,
      ...config
    };
    
    this.resourceManager = resourceManager;
    
    // Initialize providers first
    this.providers = this.initializeProviders();
    
    // Initialize core components with providers
    this.deploymentManager = new DeploymentManager(this.config, this.providers);
    this.monitoringSystem = new MonitoringSystem(this.config);
  }
  
  initializeProviders() {
    const providers = {};
    
    // Initialize Local Provider
    providers.local = new LocalProvider(this.config);
    
    // Initialize Docker Provider
    const dockerHost = this.resourceManager?.get('DOCKER_HOST') || process.env.DOCKER_HOST;
    providers.docker = new DockerProvider({
      ...this.config,
      dockerHost
    });
    
    // Initialize Railway Provider
    const railwayToken = this.resourceManager?.get('RAILWAY_API_TOKEN') || process.env.RAILWAY_API_TOKEN;
    providers.railway = new RailwayProvider({
      ...this.config,
      apiToken: railwayToken
    });
    
    return providers;
  }
  
  /**
   * Deploy a Node.js application to specified provider
   */
  async deployApplication(params) {
    const { projectPath, provider, name, config } = params;
    
    // Emit deployment started event
    this.emitInfo('Deployment started', {
      name,
      provider,
      projectPath
    });
    
    try {
      const deployment = await this.deploymentManager.deploy({
        projectPath,
        provider: provider || this.config.defaultProvider,
        name,
        config
      });
      
      // Start monitoring if enabled
      if (this.config.monitoringEnabled) {
        await this.monitoringSystem.startMonitoring(deployment.id);
      }
      
      // Emit deployment completed event
      this.emitInfo('Deployment completed', {
        deploymentId: deployment.id,
        name: deployment.name,
        status: deployment.status
      });
      
      return deployment;
    } catch (error) {
      this.emitError('Deployment failed', {
        name,
        provider,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Monitor health and metrics of a deployment
   */
  async monitorDeployment(params) {
    const { deploymentId, metrics, interval, duration } = params;
    
    try {
      const monitoringData = await this.monitoringSystem.monitor({
        deploymentId,
        metrics: metrics || ['health', 'cpu', 'memory'],
        interval: interval || this.config.healthCheckInterval,
        duration: duration || 0
      });
      
      return monitoringData;
    } catch (error) {
      this.emitError('Monitoring failed', {
        deploymentId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Update an existing deployment with new code
   */
  async updateDeployment(params) {
    const { deploymentId, projectPath, strategy, config } = params;
    
    try {
      const result = await this.deploymentManager.update({
        deploymentId,
        projectPath,
        strategy: strategy || 'rolling',
        config
      });
      
      this.emitInfo('Deployment updated', {
        deploymentId,
        strategy,
        newVersion: result.newVersion
      });
      
      return result;
    } catch (error) {
      this.emitError('Update failed', {
        deploymentId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * List all deployments across providers
   */
  async listDeployments(params = {}) {
    const { provider, status, name } = params;
    
    try {
      const deployments = await this.deploymentManager.list({
        provider: provider || 'all',
        status: status || 'all',
        name
      });
      
      return deployments;
    } catch (error) {
      this.emitError('Failed to list deployments', {
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Stop a running deployment
   */
  async stopDeployment(params) {
    const { deploymentId, graceful, timeout } = params;
    
    try {
      const result = await this.deploymentManager.stop({
        deploymentId,
        graceful: graceful !== false,
        timeout: timeout || 30000
      });
      
      // Stop monitoring
      await this.monitoringSystem.stopMonitoring(deploymentId);
      
      this.emitInfo('Deployment stopped', {
        deploymentId,
        graceful: result.graceful
      });
      
      return result;
    } catch (error) {
      this.emitError('Failed to stop deployment', {
        deploymentId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Retrieve logs from a deployment
   */
  async getDeploymentLogs(params) {
    const { deploymentId, lines, follow, level, since } = params;
    
    try {
      const logs = await this.deploymentManager.getLogs({
        deploymentId,
        lines: lines || 100,
        follow: follow || false,
        level: level || 'all',
        since
      });
      
      return logs;
    } catch (error) {
      this.emitError('Failed to get logs', {
        deploymentId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Remove a deployment and clean up resources
   */
  async removeDeployment(params) {
    const { deploymentId, force, cleanup } = params;
    
    try {
      // Stop monitoring first
      await this.monitoringSystem.stopMonitoring(deploymentId);
      
      const result = await this.deploymentManager.remove({
        deploymentId,
        force: force || false,
        cleanup: cleanup !== false
      });
      
      this.emitInfo('Deployment removed', {
        deploymentId,
        cleanedResources: result.cleanedResources
      });
      
      return result;
    } catch (error) {
      this.emitError('Failed to remove deployment', {
        deploymentId,
        error: error.message
      });
      throw error;
    }
  }
}

export default ConanTheDeployer;