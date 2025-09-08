/**
 * BaseProvider - Abstract base class for all deployment providers
 */
class BaseProvider {
  constructor(config = {}) {
    if (new.target === BaseProvider) {
      throw new Error('BaseProvider is an abstract class and cannot be instantiated directly');
    }
    this.config = config;
  }
  
  // Deployment operations
  async deploy(config) {
    throw new Error('deploy() must be implemented by provider');
  }
  
  async update(deploymentId, config) {
    throw new Error('update() must be implemented by provider');
  }
  
  async stop(deploymentId) {
    throw new Error('stop() must be implemented by provider');
  }
  
  async remove(deploymentId) {
    throw new Error('remove() must be implemented by provider');
  }
  
  // Monitoring operations
  async getStatus(deploymentId) {
    throw new Error('getStatus() must be implemented by provider');
  }
  
  async getLogs(deploymentId, options) {
    throw new Error('getLogs() must be implemented by provider');
  }
  
  async getMetrics(deploymentId) {
    throw new Error('getMetrics() must be implemented by provider');
  }
  
  // Provider capabilities
  getCapabilities() {
    return {
      supportsRollingUpdate: false,
      supportsBlueGreen: false,
      supportsHealthChecks: false,
      supportsMetrics: false,
      supportsCustomDomains: false
    };
  }
}

export default BaseProvider;