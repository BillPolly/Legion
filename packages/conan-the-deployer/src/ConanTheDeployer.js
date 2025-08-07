import { Module } from '@legion/tool-system';
import DeploymentManager from './DeploymentManager.js';
import MonitoringSystem from './MonitoringSystem.js';
import LocalProvider from './providers/LocalProvider.js';
import DockerProvider from './providers/DockerProvider.js';
import RailwayProviderAdapter from './providers/RailwayProviderAdapter.js';
import CheckDeploymentTool from './tools/CheckDeploymentTool.js';

/**
 * ConanTheDeployer - Main module for deploying and monitoring Node.js applications
 */
class ConanTheDeployer extends Module {
  static dependencies = ['resourceManager'];
  constructor(dependencies = {}) {
    super();
    
    this.name = 'conan-the-deployer';
    this.description = 'Deploy and monitor Node.js applications across multiple providers';
    
    // Extract resourceManager and config from dependencies
    this.resourceManager = dependencies.resourceManager || dependencies;
    
    // If dependencies is actually a ResourceManager instance (backward compatibility)
    if (this.resourceManager && typeof this.resourceManager.get === 'function') {
      // We have a ResourceManager
    } else {
      // No ResourceManager provided
      this.resourceManager = null;
    }
    
    // Merge with default configuration
    this.config = {
      defaultProvider: 'local',
      monitoringEnabled: true,
      healthCheckInterval: 30000,
      metricsInterval: 60000,
      logBufferSize: 1000,
      ...(dependencies.config || {})
    };
    
    // Initialize providers first
    this.providers = this.initializeProviders();
    
    // Initialize core components with providers
    this.deploymentManager = new DeploymentManager(this.config, this.providers);
    this.monitoringSystem = new MonitoringSystem(this.config);
    
    // Register providers with monitoring system
    for (const [name, provider] of Object.entries(this.providers)) {
      this.monitoringSystem.registerProvider(name, provider);
    }
    
    // Give monitoring system access to deployment manager
    this.monitoringSystem.deploymentManager = this.deploymentManager;
    
    // Register tools
    this.registerTool('check_deployment', new CheckDeploymentTool(this.config));
  }
  
  initializeProviders() {
    const providers = {};
    
    // Initialize Local Provider
    providers.local = new LocalProvider(this.resourceManager, this.config);
    
    // Initialize Docker Provider
    let dockerHost;
    try {
      dockerHost = this.resourceManager?.get('env.DOCKER_HOST');
    } catch (error) {
      // DOCKER_HOST not available
    }
    providers.docker = new DockerProvider(this.resourceManager, {
      ...this.config,
      dockerHost
    });
    
    // Initialize Railway Provider
    providers.railway = new RailwayProviderAdapter(this.resourceManager);
    
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