import ProviderFactory from './providers/ProviderFactory.js';
import DeploymentConfig from './models/DeploymentConfig.js';
import { EventEmitter } from 'events';

/**
 * DeploymentManager - Orchestrates deployments across providers
 */
class DeploymentManager extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.resourceManager = config.resourceManager;
    this.providerFactory = new ProviderFactory(this.resourceManager);
    this.providers = new Map();
    this.deployments = new Map();
    
    // Deployment queue and concurrency control
    this.deploymentQueue = [];
    this.processingQueue = new Set();
    this.queueStats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0
    };
    
    // Provider concurrency limits
    this.providerConcurrencyLimits = new Map();
    this.providerActiveJobs = new Map();
    
    // Retry configuration
    this.retryConfig = {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffFactor: 2
    };
    
    // Initialize available providers
    this.availableProviders = this.providerFactory.getAvailableProviders();
  }

  /**
   * Get available providers
   */
  getAvailableProviders() {
    return [...this.availableProviders];
  }

  /**
   * Get or create provider instance
   */
  async getProvider(type) {
    if (!this.providers.has(type)) {
      const provider = this.providerFactory.createProvider(type);
      this.providers.set(type, provider);
    }
    return this.providers.get(type);
  }

  /**
   * Set provider concurrency limit
   */
  setProviderConcurrencyLimit(provider, limit) {
    this.providerConcurrencyLimits.set(provider, limit);
  }

  /**
   * Set retry configuration
   */
  setRetryConfig(config) {
    this.retryConfig = { ...this.retryConfig, ...config };
  }

  /**
   * Select best provider for deployment
   */
  selectProvider(config) {
    if (config.provider) {
      return config.provider;
    }

    // Auto-select based on requirements
    if (config.requirements) {
      for (const providerType of this.availableProviders) {
        const provider = this.providerFactory.createProvider(providerType);
        const capabilities = provider.getCapabilities();
        
        const meetsRequirements = Object.entries(config.requirements).every(
          ([requirement, required]) => capabilities[requirement] === required
        );
        
        if (meetsRequirements) {
          return providerType;
        }
      }
    }

    // Default to local provider
    return 'local';
  }

  /**
   * Check if provider can accept new jobs
   */
  canAcceptJob(providerType) {
    const limit = this.providerConcurrencyLimits.get(providerType);
    if (!limit) return true;
    
    const activeJobs = this.providerActiveJobs.get(providerType) || 0;
    return activeJobs < limit;
  }

  /**
   * Track provider job start
   */
  trackJobStart(providerType) {
    const current = this.providerActiveJobs.get(providerType) || 0;
    this.providerActiveJobs.set(providerType, current + 1);
  }

  /**
   * Track provider job end
   */
  trackJobEnd(providerType) {
    const current = this.providerActiveJobs.get(providerType) || 0;
    this.providerActiveJobs.set(providerType, Math.max(0, current - 1));
  }

  /**
   * Deploy an application
   */
  async deploy(config) {
    // Validate configuration
    const validation = DeploymentConfig.validate(config);
    if (!validation.success) {
      throw new Error(`Invalid deployment config: ${validation.error}`);
    }

    const deploymentConfig = validation.data;
    
    // Select provider
    deploymentConfig.provider = this.selectProvider(deploymentConfig);
    
    // Add to queue and process
    return this.queueDeployment('deploy', deploymentConfig);
  }

  /**
   * Update a deployment
   */
  async update(deploymentId, config) {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    return this.queueDeployment('update', { deploymentId, ...config }, deployment.provider);
  }

  /**
   * Stop a deployment
   */
  async stop(deploymentId) {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    const provider = await this.getProvider(deployment.provider);
    const result = await provider.stop(deploymentId);
    
    // Update deployment state
    deployment.status = 'stopped';
    deployment.updatedAt = new Date();
    
    this.emit('deployment:stopped', deployment);
    return result;
  }

  /**
   * Remove a deployment
   */
  async remove(deploymentId) {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    const provider = await this.getProvider(deployment.provider);
    const result = await provider.remove(deploymentId);
    
    // Remove from our tracking
    this.deployments.delete(deploymentId);
    
    this.emit('deployment:removed', deployment);
    return result;
  }

  /**
   * Get deployment logs
   */
  async getLogs(deploymentId, options = {}) {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    const provider = await this.getProvider(deployment.provider);
    return provider.getLogs(deploymentId, options);
  }

  /**
   * Get deployment metrics
   */
  async getMetrics(deploymentId) {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    const provider = await this.getProvider(deployment.provider);
    return provider.getMetrics(deploymentId);
  }

  /**
   * Get deployment
   */
  getDeployment(deploymentId) {
    return this.deployments.get(deploymentId);
  }

  /**
   * List deployments with optional filtering
   */
  listDeployments(filters = {}) {
    const deployments = Array.from(this.deployments.values());
    
    return deployments.filter(deployment => {
      if (filters.provider && deployment.provider !== filters.provider) {
        return false;
      }
      if (filters.status && deployment.status !== filters.status) {
        return false;
      }
      if (filters.name && deployment.name !== filters.name) {
        return false;
      }
      return true;
    });
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    return { ...this.queueStats };
  }

  /**
   * Queue deployment operation
   */
  async queueDeployment(operation, config, providerType = null) {
    const provider = providerType || config.provider;
    
    return new Promise((resolve, reject) => {
      const job = {
        id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        operation,
        config,
        provider,
        resolve,
        reject,
        retries: 0,
        createdAt: new Date()
      };
      
      this.deploymentQueue.push(job);
      this.queueStats.pending++;
      
      this.processQueue();
    });
  }

  /**
   * Process deployment queue
   */
  async processQueue() {
    // Process jobs that can be started
    while (this.deploymentQueue.length > 0) {
      const job = this.deploymentQueue.find(j => 
        !this.processingQueue.has(j.id) && this.canAcceptJob(j.provider)
      );
      
      if (!job) break;
      
      // Remove from queue and mark as processing
      const index = this.deploymentQueue.indexOf(job);
      this.deploymentQueue.splice(index, 1);
      this.processingQueue.add(job.id);
      
      this.queueStats.pending--;
      this.queueStats.processing++;
      
      // Process job asynchronously
      this.processJob(job).catch(err => {
        console.error('Unexpected error in processJob:', err);
      });
    }
  }

  /**
   * Process individual deployment job
   */
  async processJob(job) {
    this.trackJobStart(job.provider);
    
    try {
      const result = await this.executeJobWithRetry(job);
      
      // Update deployment tracking
      if (job.operation === 'deploy' && result && result.id) {
        const deployment = {
          id: result.id,
          name: result.name,
          provider: job.provider,
          status: result.status,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...result
        };
        this.deployments.set(result.id, deployment);
        this.emit('deployment:created', deployment);
      }
      
      this.queueStats.processing--;
      this.queueStats.completed++;
      
      job.resolve(result);
    } catch (error) {
      // Handle deployment failure
      if (job.operation === 'deploy' && job.config.name) {
        const deploymentId = job.config.name;
        const failedDeployment = {
          id: deploymentId,
          name: job.config.name,
          provider: job.provider,
          status: 'failed',
          error: error.message,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        this.deployments.set(deploymentId, failedDeployment);
        this.emit('deployment:failed', failedDeployment);
      }
      
      this.queueStats.processing--;
      this.queueStats.failed++;
      
      job.reject(error);
    } finally {
      this.processingQueue.delete(job.id);
      this.trackJobEnd(job.provider);
      
      // Continue processing queue
      setImmediate(() => this.processQueue());
    }
  }

  /**
   * Execute job with retry logic
   */
  async executeJobWithRetry(job) {
    const { maxRetries, initialDelay, maxDelay, backoffFactor } = this.retryConfig;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const provider = await this.getProvider(job.provider);
        
        switch (job.operation) {
          case 'deploy':
            return await provider.deploy(job.config);
          case 'update':
            return await provider.update(job.config.deploymentId, job.config);
          default:
            throw new Error(`Unknown operation: ${job.operation}`);
        }
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          initialDelay * Math.pow(backoffFactor, attempt),
          maxDelay
        );
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
}

export default DeploymentManager;