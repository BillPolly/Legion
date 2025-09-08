import { EventEmitter } from 'events';

/**
 * MonitoringSystem - Monitors deployments across different providers
 */
class MonitoringSystem extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.providers = new Map();
    this.monitoringJobs = new Map();
  }

  /**
   * Register a provider for monitoring
   */
  registerProvider(name, provider) {
    this.providers.set(name, provider);
  }

  /**
   * Monitor a deployment
   */
  async monitor(params) {
    const { deploymentId, metrics = ['health'], interval = 30000, duration = 0 } = params;

    // Get deployment info to find provider
    const deployment = await this.getDeploymentInfo(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    const provider = this.providers.get(deployment.provider);
    if (!provider) {
      throw new Error(`Provider not found: ${deployment.provider}`);
    }

    // Get current status from provider
    const status = await provider.getStatus(deploymentId);
    
    // Prepare monitoring result
    const result = {
      deploymentId,
      provider: deployment.provider,
      health: {
        status: status.status === 'running' ? 'healthy' : status.status,
        lastCheck: new Date()
      },
      metrics: {},
      url: status.url,
      domain: status.domain
    };

    // Get metrics if provider supports it
    if (provider.getMetrics && metrics.includes('cpu') || metrics.includes('memory')) {
      try {
        const metricsData = await provider.getMetrics(deployment.serviceId || deploymentId);
        if (metricsData.success) {
          result.metrics = metricsData.metrics || {};
        }
      } catch (error) {
        // Metrics not available
      }
    }

    // Get logs if needed
    if (metrics.includes('logs')) {
      try {
        const logs = await provider.getLogs(deploymentId, { lines: 10 });
        if (logs.success) {
          result.logs = logs.logs;
        }
      } catch (error) {
        // Logs not available
      }
    }

    // If duration > 0, set up continuous monitoring
    if (duration > 0 && interval > 0) {
      const jobId = `monitor-${deploymentId}-${Date.now()}`;
      
      const intervalId = setInterval(async () => {
        try {
          const update = await this.monitor({ 
            deploymentId, 
            metrics, 
            interval: 0, 
            duration: 0 
          });
          
          this.emit('monitor:update', {
            jobId,
            deploymentId,
            update
          });
        } catch (error) {
          this.emit('monitor:error', {
            jobId,
            deploymentId,
            error: error.message
          });
        }
      }, interval);

      // Stop monitoring after duration
      setTimeout(() => {
        clearInterval(intervalId);
        this.monitoringJobs.delete(jobId);
        this.emit('monitor:complete', { jobId, deploymentId });
      }, duration);

      this.monitoringJobs.set(jobId, { intervalId, deploymentId });
    }

    return result;
  }

  /**
   * Start monitoring a deployment
   */
  async startMonitoring(deploymentId) {
    // For now, just emit an event
    this.emit('monitoring:started', { deploymentId });
  }

  /**
   * Stop monitoring a deployment
   */
  async stopMonitoring(deploymentId) {
    // Stop any active monitoring jobs for this deployment
    for (const [jobId, job] of this.monitoringJobs.entries()) {
      if (job.deploymentId === deploymentId) {
        clearInterval(job.intervalId);
        this.monitoringJobs.delete(jobId);
      }
    }
    
    this.emit('monitoring:stopped', { deploymentId });
  }

  /**
   * Get deployment info (stub - should be connected to DeploymentManager)
   */
  async getDeploymentInfo(deploymentId) {
    // This should ideally get info from DeploymentManager
    // For now, we'll try to infer from available providers
    
    // Check each provider
    for (const [providerName, provider] of this.providers.entries()) {
      try {
        if (provider.getStatus) {
          const status = await provider.getStatus(deploymentId);
          if (status && !status.error) {
            return {
              id: deploymentId,
              provider: providerName,
              serviceId: status.serviceId
            };
          }
        }
      } catch (error) {
        // Continue to next provider
      }
    }

    // Check active deployments in providers
    for (const [providerName, provider] of this.providers.entries()) {
      if (provider.activeDeployments && provider.activeDeployments.has(deploymentId)) {
        const deployment = provider.activeDeployments.get(deploymentId);
        return {
          id: deploymentId,
          provider: providerName,
          serviceId: deployment.serviceId
        };
      }
    }

    return null;
  }
}

export default MonitoringSystem;