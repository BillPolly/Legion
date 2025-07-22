/**
 * Resource Pool
 * 
 * Manages a pool of reusable resources with validation,
 * lifecycle management, and statistics tracking
 */

import { EventEmitter } from 'events';

export class ResourcePool extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      maxSize: options.maxSize || 10,
      minSize: options.minSize || 2,
      idleTimeout: options.idleTimeout || 300000, // 5 minutes
      acquireTimeout: options.acquireTimeout || 5000,
      resourceFactory: options.resourceFactory || (() => ({ id: Math.random() })),
      validator: options.validator || (() => true),
      destroyer: options.destroyer || (() => Promise.resolve()),
      ...options
    };

    // Resource tracking
    this.available = [];
    this.active = new Set();
    this.pending = [];
    this.resourceMetadata = new Map(); // Resource -> { createdAt, lastUsed, useCount }

    // Statistics
    this.stats = {
      created: 0,
      destroyed: 0,
      acquired: 0,
      released: 0,
      timeouts: 0,
      validationFailures: 0
    };

    // Cleanup timer
    this.idleCleanupTimer = setInterval(() => {
      this._cleanupIdleResources();
    }, 60000);

    // Initialize minimum resources
    this._initialize();
  }

  /**
   * Acquire resource from pool
   */
  async acquire(timeout = null) {
    const acquireTimeout = timeout || this.options.acquireTimeout;
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        // Remove from pending if it's there
        const pendingIndex = this.pending.findIndex(p => p.timeoutHandle === timeoutHandle);
        if (pendingIndex >= 0) {
          this.pending.splice(pendingIndex, 1);
        }
        this.stats.timeouts++;
        reject(new Error('Resource acquisition timeout'));
      }, acquireTimeout);

      const tryAcquire = async () => {
        try {
          // Try to get an available resource
          const resource = await this._getAvailableResource();
          
          if (resource) {
            clearTimeout(timeoutHandle);
            this.stats.acquired++;
            resolve(resource);
            return;
          }

          // No available resource, queue the request if pool is at capacity
          if (this.active.size >= this.options.maxSize) {
            this.pending.push({ resolve, reject, timeoutHandle, startTime });
          } else {
            // This shouldn't happen, but handle edge case
            clearTimeout(timeoutHandle);
            reject(new Error('Unable to create resource'));
          }
        } catch (error) {
          clearTimeout(timeoutHandle);
          reject(error);
        }
      };

      tryAcquire();
    });
  }

  /**
   * Release resource back to pool
   */
  async release(resource) {
    if (!this.active.has(resource)) {
      return false; // Resource not tracked by this pool
    }

    // Remove from active set
    this.active.delete(resource);

    // Validate resource before returning to pool
    try {
      const isValid = await this.options.validator(resource);
      
      if (!isValid) {
        this.stats.validationFailures++;
        await this._destroyResource(resource);
        await this._processPending();
        return true;
      }
    } catch (error) {
      this.stats.validationFailures++;
      await this._destroyResource(resource);
      await this._processPending();
      return true;
    }

    // Update metadata
    const metadata = this.resourceMetadata.get(resource);
    if (metadata) {
      metadata.lastUsed = Date.now();
      metadata.useCount++;
    }

    // Return to available pool
    this.available.push(resource);
    this.stats.released++;

    this.emit('resource-released', { resource, poolSize: this.getStats() });

    // Process any pending requests
    await this._processPending();
    
    return true;
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      total: this.active.size + this.available.length,
      active: this.active.size,
      available: this.available.length,
      pending: this.pending.length,
      created: this.stats.created,
      destroyed: this.stats.destroyed,
      acquired: this.stats.acquired,
      released: this.stats.released,
      timeouts: this.stats.timeouts,
      validationFailures: this.stats.validationFailures
    };
  }

  /**
   * Get resource utilization metrics
   */
  getUtilization() {
    const stats = this.getStats();
    const utilizationRate = stats.total > 0 ? stats.active / stats.total : 0;
    const poolEfficiency = stats.acquired > 0 ? 
      (stats.acquired - stats.timeouts) / stats.acquired : 1;

    return {
      utilizationRate,
      poolEfficiency,
      averageWaitTime: this._calculateAverageWaitTime(),
      resourceTurnover: this._calculateResourceTurnover()
    };
  }

  /**
   * Destroy pool and all resources
   */
  async destroy() {
    // Clear cleanup timer
    if (this.idleCleanupTimer) {
      clearInterval(this.idleCleanupTimer);
      this.idleCleanupTimer = null;
    }

    // Reject all pending requests
    for (const pending of this.pending) {
      clearTimeout(pending.timeoutHandle);
      pending.reject(new Error('Pool destroyed'));
    }
    this.pending = [];

    // Destroy all resources
    const allResources = [...this.available, ...this.active];
    
    await Promise.all(
      allResources.map(resource => this._destroyResource(resource))
    );

    this.available = [];
    this.active.clear();
    this.resourceMetadata.clear();

    this.emit('pool-destroyed');
  }

  /**
   * Initialize minimum resources
   * @private
   */
  async _initialize() {
    const promises = [];
    for (let i = 0; i < this.options.minSize; i++) {
      promises.push(this._createResource());
    }

    try {
      const resources = await Promise.all(promises);
      this.available.push(...resources);
    } catch (error) {
      this.emit('initialization-error', error);
    }
  }

  /**
   * Get available resource or create new one
   * @private
   */
  async _getAvailableResource() {
    // Try to get from available pool first
    while (this.available.length > 0) {
      const resource = this.available.shift();
      
      // Validate resource
      try {
        const isValid = await this.options.validator(resource);
        if (isValid) {
          this.active.add(resource);
          return resource;
        } else {
          await this._destroyResource(resource);
        }
      } catch (error) {
        await this._destroyResource(resource);
      }
    }

    // Create new resource if under limit
    const totalResources = this.active.size + this.available.length;
    if (totalResources < this.options.maxSize) {
      try {
        const resource = await this._createResource();
        this.active.add(resource);
        return resource;
      } catch (error) {
        this.emit('resource-creation-error', error);
        return null;
      }
    }

    return null; // Pool exhausted
  }

  /**
   * Create new resource
   * @private
   */
  async _createResource() {
    const resource = await this.options.resourceFactory();
    
    // Validate new resource
    try {
      const isValid = await this.options.validator(resource);
      if (!isValid) {
        throw new Error('Newly created resource failed validation');
      }
    } catch (error) {
      // If validation fails, don't count this as created
      throw error;
    }
    
    // Track metadata
    this.resourceMetadata.set(resource, {
      createdAt: Date.now(),
      lastUsed: Date.now(),
      useCount: 0
    });

    this.stats.created++;
    this.emit('resource-created', { resource, poolSize: this.getStats() });
    
    return resource;
  }

  /**
   * Destroy resource
   * @private
   */
  async _destroyResource(resource) {
    try {
      await this.options.destroyer(resource);
    } catch (error) {
      this.emit('resource-destruction-error', { resource, error });
    }

    this.resourceMetadata.delete(resource);
    this.stats.destroyed++;
    this.emit('resource-destroyed', { resource, poolSize: this.getStats() });
  }

  /**
   * Process pending acquisition requests
   * @private
   */
  async _processPending() {
    while (this.pending.length > 0) {
      const resource = await this._getAvailableResource();
      
      if (!resource) {
        break; // No more resources available
      }

      const pending = this.pending.shift();
      clearTimeout(pending.timeoutHandle);
      this.stats.acquired++;
      pending.resolve(resource);
    }
  }

  /**
   * Clean up idle resources
   * @private
   */
  async _cleanupIdleResources() {
    if (this.available.length <= this.options.minSize) {
      return; // Don't go below minimum
    }

    const now = Date.now();
    const resourcesToRemove = [];

    for (let i = 0; i < this.available.length; i++) {
      const resource = this.available[i];
      const metadata = this.resourceMetadata.get(resource);
      
      if (metadata && (now - metadata.lastUsed) > this.options.idleTimeout) {
        resourcesToRemove.push({ resource, index: i });
      }
    }

    // Remove idle resources (keep minimum count)
    const canRemove = Math.min(
      resourcesToRemove.length,
      this.available.length - this.options.minSize
    );

    for (let i = 0; i < canRemove; i++) {
      const { resource, index } = resourcesToRemove[i];
      this.available.splice(index - i, 1); // Adjust index for previous removals
      await this._destroyResource(resource);
    }
  }

  /**
   * Calculate average wait time for pending requests
   * @private
   */
  _calculateAverageWaitTime() {
    if (this.pending.length === 0) return 0;

    const now = Date.now();
    const totalWaitTime = this.pending.reduce((sum, pending) => 
      sum + (now - pending.startTime), 0
    );

    return totalWaitTime / this.pending.length;
  }

  /**
   * Calculate resource turnover rate
   * @private
   */
  _calculateResourceTurnover() {
    const totalResources = this.stats.created;
    if (totalResources === 0) return 0;

    return this.stats.destroyed / totalResources;
  }
}