import { DeploymentStatus, isValidTransition } from './DeploymentStatus.js';

/**
 * Deployment model representing a deployed application
 */
class Deployment {
  constructor(data) {
    // Validate required fields
    const requiredFields = ['id', 'name', 'provider', 'projectPath'];
    for (const field of requiredFields) {
      if (!data[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Validate provider
    const validProviders = ['local', 'docker', 'railway'];
    if (!validProviders.includes(data.provider)) {
      throw new Error(`Invalid provider: ${data.provider}`);
    }
    
    // Set properties
    this.id = data.id;
    this.name = data.name;
    this.provider = data.provider;
    this.projectPath = data.projectPath;
    this.status = data.status || DeploymentStatus.PENDING;
    this.url = data.url;
    this.port = data.port;
    this.config = data.config || {};
    this.metadata = data.metadata || {};
    
    // Timestamps
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
    this.startedAt = data.startedAt ? new Date(data.startedAt) : null;
    this.stoppedAt = data.stoppedAt ? new Date(data.stoppedAt) : null;
    
    // Status history
    this.statusHistory = data.statusHistory || [{
      status: this.status,
      timestamp: this.createdAt,
      message: 'Deployment created'
    }];
  }
  
  /**
   * Update deployment status
   */
  updateStatus(newStatus, force = false) {
    if (!force && !isValidTransition(this.status, newStatus)) {
      throw new Error(`Invalid status transition: ${this.status} -> ${newStatus}`);
    }
    
    const previousStatus = this.status;
    this.status = newStatus;
    this.updatedAt = new Date();
    
    // Track status change in history
    this.statusHistory.push({
      status: newStatus,
      previousStatus,
      timestamp: this.updatedAt,
      message: `Status changed from ${previousStatus} to ${newStatus}`
    });
    
    // Update timestamps based on status
    if (newStatus === DeploymentStatus.RUNNING && !this.startedAt) {
      this.startedAt = new Date();
    } else if ([DeploymentStatus.STOPPED, DeploymentStatus.FAILED].includes(newStatus)) {
      this.stoppedAt = new Date();
    }
  }
  
  /**
   * Get status history
   */
  getStatusHistory() {
    return [...this.statusHistory];
  }
  
  /**
   * Check if deployment is running
   */
  isRunning() {
    return this.status === DeploymentStatus.RUNNING;
  }
  
  /**
   * Check if deployment has failed
   */
  hasFailed() {
    return this.status === DeploymentStatus.FAILED;
  }
  
  /**
   * Get uptime in milliseconds
   */
  getUptime() {
    if (!this.startedAt || !this.isRunning()) {
      return 0;
    }
    return Date.now() - this.startedAt.getTime();
  }
  
  /**
   * Convert to JSON
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      projectPath: this.projectPath,
      status: this.status,
      url: this.url,
      port: this.port,
      config: this.config,
      metadata: this.metadata,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      startedAt: this.startedAt?.toISOString(),
      stoppedAt: this.stoppedAt?.toISOString(),
      statusHistory: this.statusHistory
    };
  }
  
  /**
   * Create from JSON
   */
  static fromJSON(json) {
    return new Deployment(json);
  }
}

export default Deployment;