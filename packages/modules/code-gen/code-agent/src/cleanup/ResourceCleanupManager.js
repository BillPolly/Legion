/**
 * ResourceCleanupManager - Centralized resource cleanup and lifecycle management
 * 
 * Manages cleanup of Git resources, handles graceful shutdown,
 * and ensures proper resource disposal across the system.
 */

import { EventEmitter } from 'events';

class ResourceCleanupManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      enableAutoCleanup: config.enableAutoCleanup !== false,
      cleanupTimeout: config.cleanupTimeout || 30000, // 30 seconds
      enableGracefulShutdown: config.enableGracefulShutdown !== false,
      enableMetrics: config.enableMetrics !== false,
      cleanupOnExit: config.cleanupOnExit !== false,
      ...config
    };
    
    // Resource registry
    this.resources = new Map();
    this.cleanupHandlers = new Map();
    this.shutdownInProgress = false;
    
    // Resource types
    this.resourceTypes = {
      GIT_INTEGRATION: 'git-integration',
      TRANSACTION_MANAGER: 'transaction-manager',
      ERROR_HANDLER: 'error-handler',
      REPOSITORY_RECOVERY: 'repository-recovery',
      BRANCH_MANAGER: 'branch-manager',
      COMMIT_ORCHESTRATOR: 'commit-orchestrator',
      GITHUB_OPERATIONS: 'github-operations',
      FILE_WATCHER: 'file-watcher',
      PROCESS: 'process',
      TIMER: 'timer',
      STREAM: 'stream',
      TEMP_FILE: 'temp-file',
      TEMP_DIR: 'temp-dir'
    };
    
    // Cleanup priorities (lower number = higher priority)
    this.cleanupPriorities = {
      [this.resourceTypes.PROCESS]: 1,
      [this.resourceTypes.TRANSACTION_MANAGER]: 2,
      [this.resourceTypes.GIT_INTEGRATION]: 3,
      [this.resourceTypes.ERROR_HANDLER]: 4,
      [this.resourceTypes.REPOSITORY_RECOVERY]: 5,
      [this.resourceTypes.BRANCH_MANAGER]: 6,
      [this.resourceTypes.COMMIT_ORCHESTRATOR]: 7,
      [this.resourceTypes.GITHUB_OPERATIONS]: 8,
      [this.resourceTypes.FILE_WATCHER]: 9,
      [this.resourceTypes.TIMER]: 10,
      [this.resourceTypes.STREAM]: 11,
      [this.resourceTypes.TEMP_FILE]: 12,
      [this.resourceTypes.TEMP_DIR]: 13
    };
    
    // Metrics
    this.metrics = {
      resourcesRegistered: 0,
      resourcesCleaned: 0,
      cleanupFailures: 0,
      gracefulShutdowns: 0,
      forcedShutdowns: 0,
      totalCleanupTime: 0
    };
    
    // Process event handlers
    this.exitHandlers = [];
    
    this.initialized = false;
  }
  
  /**
   * Initialize the cleanup manager
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    if (this.config.cleanupOnExit) {
      this.setupProcessEventHandlers();
    }
    
    this.initialized = true;
    
    this.emit('initialized', {
      config: this.config,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Register a resource for cleanup
   * @param {string} id - Unique resource identifier
   * @param {string} type - Resource type
   * @param {Object} resource - Resource object
   * @param {Function} cleanupHandler - Custom cleanup function
   * @returns {Object} Registration result
   */
  registerResource(id, type, resource, cleanupHandler = null) {
    if (!this.initialized) {
      throw new Error('ResourceCleanupManager not initialized');
    }
    
    if (this.resources.has(id)) {
      throw new Error(`Resource ${id} already registered`);
    }
    
    const resourceInfo = {
      id,
      type,
      resource,
      registeredAt: new Date(),
      priority: this.cleanupPriorities[type] || 999,
      cleanupAttempts: 0,
      lastCleanupAttempt: null,
      cleaned: false
    };
    
    this.resources.set(id, resourceInfo);
    
    if (cleanupHandler) {
      this.cleanupHandlers.set(id, cleanupHandler);
    }
    
    this.metrics.resourcesRegistered++;
    
    this.emit('resource-registered', {
      id,
      type,
      timestamp: new Date().toISOString()
    });
    
    return {
      success: true,
      id,
      type,
      registeredAt: resourceInfo.registeredAt
    };
  }
  
  /**
   * Unregister a resource
   * @param {string} id - Resource identifier
   * @returns {boolean} Success status
   */
  unregisterResource(id) {
    const removed = this.resources.delete(id);
    this.cleanupHandlers.delete(id);
    
    if (removed) {
      this.emit('resource-unregistered', {
        id,
        timestamp: new Date().toISOString()
      });
    }
    
    return removed;
  }
  
  /**
   * Cleanup a specific resource
   * @param {string} id - Resource identifier
   * @returns {Object} Cleanup result
   */
  async cleanupResource(id) {
    const resourceInfo = this.resources.get(id);
    if (!resourceInfo) {
      return { success: false, error: `Resource ${id} not found` };
    }
    
    if (resourceInfo.cleaned) {
      return { success: true, message: `Resource ${id} already cleaned` };
    }
    
    const startTime = Date.now();
    resourceInfo.cleanupAttempts++;
    resourceInfo.lastCleanupAttempt = new Date();
    
    try {
      this.emit('cleanup-start', {
        id,
        type: resourceInfo.type,
        attempt: resourceInfo.cleanupAttempts,
        timestamp: new Date().toISOString()
      });
      
      // Use custom handler if available
      const customHandler = this.cleanupHandlers.get(id);
      if (customHandler) {
        await customHandler(resourceInfo.resource);
      } else {
        // Use default cleanup strategy based on resource type
        await this.executeDefaultCleanup(resourceInfo);
      }
      
      resourceInfo.cleaned = true;
      this.metrics.resourcesCleaned++;
      
      const duration = Date.now() - startTime;
      this.metrics.totalCleanupTime += duration;
      
      this.emit('cleanup-success', {
        id,
        type: resourceInfo.type,
        duration,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: true,
        id,
        type: resourceInfo.type,
        duration
      };
      
    } catch (error) {
      this.metrics.cleanupFailures++;
      
      this.emit('cleanup-failed', {
        id,
        type: resourceInfo.type,
        error: error.message,
        attempt: resourceInfo.cleanupAttempts,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: false,
        id,
        type: resourceInfo.type,
        error: error.message,
        attempt: resourceInfo.cleanupAttempts
      };
    }
  }
  
  /**
   * Cleanup resources by type
   * @param {string} type - Resource type
   * @returns {Object} Cleanup results
   */
  async cleanupResourcesByType(type) {
    const resourcesOfType = Array.from(this.resources.values())
      .filter(resource => resource.type === type);
    
    const results = [];
    
    for (const resourceInfo of resourcesOfType) {
      const result = await this.cleanupResource(resourceInfo.id);
      results.push(result);
    }
    
    return {
      type,
      totalResources: resourcesOfType.length,
      results,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    };
  }
  
  /**
   * Cleanup all resources
   * @param {boolean} graceful - Whether to attempt graceful cleanup
   * @returns {Object} Cleanup results
   */
  async cleanupAllResources(graceful = true) {
    if (this.shutdownInProgress) {
      return { success: false, error: 'Shutdown already in progress' };
    }
    
    this.shutdownInProgress = true;
    const startTime = Date.now();
    
    try {
      this.emit('cleanup-all-start', {
        graceful,
        totalResources: this.resources.size,
        timestamp: new Date().toISOString()
      });
      
      // Get resources sorted by cleanup priority
      const sortedResources = Array.from(this.resources.values())
        .filter(resource => !resource.cleaned)
        .sort((a, b) => a.priority - b.priority);
      
      const results = [];
      let timeoutReached = false;
      
      // Set timeout for graceful cleanup
      const timeoutPromise = graceful ? new Promise(resolve => {
        setTimeout(() => {
          timeoutReached = true;
          resolve();
        }, this.config.cleanupTimeout);
      }) : null;
      
      // Cleanup resources
      for (const resourceInfo of sortedResources) {
        if (timeoutReached) {
          break;
        }
        
        const result = await this.cleanupResource(resourceInfo.id);
        results.push(result);
        
        // Check if timeout reached during cleanup
        if (graceful && timeoutReached) {
          break;
        }
      }
      
      const duration = Date.now() - startTime;
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      if (graceful && !timeoutReached) {
        this.metrics.gracefulShutdowns++;
      } else if (timeoutReached) {
        this.metrics.forcedShutdowns++;
      }
      
      this.emit('cleanup-all-complete', {
        graceful,
        timeoutReached,
        totalResources: sortedResources.length,
        successful,
        failed,
        duration,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: failed === 0,
        graceful: graceful && !timeoutReached,
        totalResources: sortedResources.length,
        successful,
        failed,
        duration,
        results
      };
      
    } catch (error) {
      this.emit('cleanup-all-failed', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      throw error;
    } finally {
      this.shutdownInProgress = false;
    }
  }
  
  /**
   * Execute default cleanup strategy based on resource type
   */
  async executeDefaultCleanup(resourceInfo) {
    const { type, resource } = resourceInfo;
    
    switch (type) {
      case this.resourceTypes.GIT_INTEGRATION:
      case this.resourceTypes.TRANSACTION_MANAGER:
      case this.resourceTypes.ERROR_HANDLER:
      case this.resourceTypes.REPOSITORY_RECOVERY:
      case this.resourceTypes.BRANCH_MANAGER:
      case this.resourceTypes.COMMIT_ORCHESTRATOR:
      case this.resourceTypes.GITHUB_OPERATIONS:
        if (resource && typeof resource.cleanup === 'function') {
          await resource.cleanup();
        }
        break;
        
      case this.resourceTypes.FILE_WATCHER:
        if (resource && typeof resource.close === 'function') {
          resource.close();
        }
        break;
        
      case this.resourceTypes.PROCESS:
        if (resource && typeof resource.kill === 'function') {
          resource.kill('SIGTERM');
          
          // Wait for graceful termination
          await new Promise(resolve => {
            const timeout = setTimeout(() => {
              if (!resource.killed) {
                resource.kill('SIGKILL');
              }
              resolve();
            }, 5000);
            
            resource.on('exit', () => {
              clearTimeout(timeout);
              resolve();
            });
          });
        }
        break;
        
      case this.resourceTypes.TIMER:
        if (resource) {
          clearTimeout(resource);
          clearInterval(resource);
        }
        break;
        
      case this.resourceTypes.STREAM:
        if (resource && typeof resource.destroy === 'function') {
          resource.destroy();
        } else if (resource && typeof resource.end === 'function') {
          resource.end();
        }
        break;
        
      case this.resourceTypes.TEMP_FILE:
        if (resource && typeof resource.removeCallback === 'function') {
          resource.removeCallback();
        }
        break;
        
      case this.resourceTypes.TEMP_DIR:
        if (resource && typeof resource.removeCallback === 'function') {
          resource.removeCallback();
        }
        break;
        
      default:
        // Generic cleanup - try common cleanup methods
        if (resource) {
          if (typeof resource.cleanup === 'function') {
            await resource.cleanup();
          } else if (typeof resource.close === 'function') {
            await resource.close();
          } else if (typeof resource.destroy === 'function') {
            await resource.destroy();
          }
        }
    }
  }
  
  /**
   * Setup process event handlers for automatic cleanup
   */
  setupProcessEventHandlers() {
    const signals = ['SIGINT', 'SIGTERM', 'SIGUSR2'];
    const events = ['exit', 'uncaughtException', 'unhandledRejection'];
    
    // Signal handlers
    signals.forEach(signal => {
      const handler = async () => {
        console.log(`\n🧹 Received ${signal}, cleaning up resources...`);
        try {
          await this.cleanupAllResources(true);
          console.log('✅ Resource cleanup completed');
          process.exit(0);
        } catch (error) {
          console.error('❌ Error during cleanup:', error.message);
          process.exit(1);
        }
      };
      
      process.on(signal, handler);
      this.exitHandlers.push({ event: signal, handler });
    });
    
    // Process event handlers
    events.forEach(event => {
      const handler = async (error) => {
        if (event !== 'exit') {
          console.error(`\n🧹 ${event} occurred, cleaning up resources...`);
          if (error) {
            console.error('Error details:', error);
          }
        }
        
        try {
          await this.cleanupAllResources(false); // Force cleanup
          if (event !== 'exit') {
            process.exit(1);
          }
        } catch (cleanupError) {
          console.error('❌ Error during cleanup:', cleanupError.message);
          if (event !== 'exit') {
            process.exit(1);
          }
        }
      };
      
      process.on(event, handler);
      this.exitHandlers.push({ event, handler });
    });
  }
  
  /**
   * Remove process event handlers
   */
  removeProcessEventHandlers() {
    this.exitHandlers.forEach(({ event, handler }) => {
      process.removeListener(event, handler);
    });
    this.exitHandlers = [];
  }
  
  /**
   * Get resource information
   * @param {string} id - Resource identifier
   * @returns {Object|null} Resource information
   */
  getResourceInfo(id) {
    const resourceInfo = this.resources.get(id);
    if (!resourceInfo) {
      return null;
    }
    
    return {
      id: resourceInfo.id,
      type: resourceInfo.type,
      registeredAt: resourceInfo.registeredAt,
      priority: resourceInfo.priority,
      cleanupAttempts: resourceInfo.cleanupAttempts,
      lastCleanupAttempt: resourceInfo.lastCleanupAttempt,
      cleaned: resourceInfo.cleaned
    };
  }
  
  /**
   * List all registered resources
   * @returns {Array} Resource list
   */
  listResources() {
    return Array.from(this.resources.values()).map(resourceInfo => ({
      id: resourceInfo.id,
      type: resourceInfo.type,
      registeredAt: resourceInfo.registeredAt,
      priority: resourceInfo.priority,
      cleanupAttempts: resourceInfo.cleanupAttempts,
      cleaned: resourceInfo.cleaned
    }));
  }
  
  /**
   * Get cleanup metrics
   * @returns {Object} Metrics object
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeResources: this.resources.size,
      cleanedResources: Array.from(this.resources.values()).filter(r => r.cleaned).length,
      avgCleanupTime: this.metrics.resourcesCleaned > 0 
        ? this.metrics.totalCleanupTime / this.metrics.resourcesCleaned 
        : 0,
      successRate: this.metrics.resourcesRegistered > 0
        ? ((this.metrics.resourcesCleaned / this.metrics.resourcesRegistered) * 100)
        : 0
    };
  }
  
  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      resourcesRegistered: 0,
      resourcesCleaned: 0,
      cleanupFailures: 0,
      gracefulShutdowns: 0,
      forcedShutdowns: 0,
      totalCleanupTime: 0
    };
  }
  
  /**
   * Force cleanup of all resources and shutdown
   */
  async forceShutdown() {
    console.log('🚨 Forcing immediate shutdown...');
    
    try {
      await this.cleanupAllResources(false);
      console.log('✅ Force shutdown completed');
    } catch (error) {
      console.error('❌ Error during force shutdown:', error.message);
    }
    
    this.removeProcessEventHandlers();
    this.removeAllListeners();
    
    process.exit(1);
  }
  
  /**
   * Cleanup the cleanup manager itself
   */
  async cleanup() {
    if (!this.shutdownInProgress) {
      await this.cleanupAllResources(true);
    }
    
    this.removeProcessEventHandlers();
    this.resources.clear();
    this.cleanupHandlers.clear();
    this.removeAllListeners();
  }
}

export default ResourceCleanupManager;