/**
 * ConnectionPool - Simple connection pool for database operations
 * 
 * Provides connection management and pooling for the tool registry system
 * Part of the semantic search functionality contained within new-tool-registry
 * 
 * No mocks, no fallbacks - real implementation only
 */

export class ConnectionPool {
  constructor({ resourceManager, maxConnections = 10, options = {} }) {
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }

    this.resourceManager = resourceManager;
    this.maxConnections = maxConnections;
    this.options = options;
    
    // Simple pool tracking
    this.connections = new Map();
    this.activeConnections = 0;
    this.initialized = false;
  }

  /**
   * Initialize the connection pool
   */
  async initialize() {
    if (this.initialized) return;

    // Connection pool is ready - actual database connections are managed
    // by DatabaseStorage which uses this pool for tracking
    this.initialized = true;
  }

  /**
   * Get a connection from the pool
   * Returns a connection slot indicator - actual DB connection is managed by DatabaseStorage
   */
  async getConnection() {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.activeConnections >= this.maxConnections) {
      throw new Error(`Connection pool exhausted: ${this.activeConnections}/${this.maxConnections} connections in use`);
    }

    this.activeConnections++;
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    this.connections.set(connectionId, { 
      id: connectionId, 
      acquiredAt: Date.now() 
    });
    
    return connectionId;
  }

  /**
   * Release a connection back to the pool
   */
  async releaseConnection(connectionId) {
    if (typeof connectionId === 'string' && this.connections.has(connectionId)) {
      this.connections.delete(connectionId);
      if (this.activeConnections > 0) {
        this.activeConnections--;
      }
    } else if (this.activeConnections > 0) {
      // Handle legacy calls
      this.activeConnections--;
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      maxConnections: this.maxConnections,
      activeConnections: this.activeConnections,
      availableConnections: Math.max(0, this.maxConnections - this.activeConnections)
    };
  }

  /**
   * Check if pool is healthy
   */
  async healthCheck() {
    if (!this.initialized) {
      return { healthy: false, reason: 'Not initialized' };
    }

    try {
      // Check if we have capacity
      const hasCapacity = this.activeConnections < this.maxConnections;
      
      if (!hasCapacity) {
        return { 
          healthy: false, 
          reason: `Pool at capacity: ${this.activeConnections}/${this.maxConnections}` 
        };
      }
      
      return { 
        healthy: true,
        activeConnections: this.activeConnections,
        maxConnections: this.maxConnections
      };
    } catch (error) {
      return { healthy: false, reason: error.message };
    }
  }

  /**
   * Cleanup all connections
   */
  async cleanup() {
    try {
      this.connections.clear();
      this.activeConnections = 0;
      this.initialized = false;
      
      // Don't cleanup the storage provider directly since it's managed by ResourceManager
    } catch (error) {
      console.error('ConnectionPool cleanup error:', error.message);
    }
  }
}