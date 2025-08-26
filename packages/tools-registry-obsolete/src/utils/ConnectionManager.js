/**
 * Connection Manager for Test Resource Cleanup
 * 
 * Centralized management of database connections, timers, and other resources
 * to ensure proper cleanup and prevent Jest from hanging.
 */

export class ConnectionManager {
  constructor() {
    this.connections = new Set();
    this.timers = new Set();
    this.cleanupTasks = [];
  }
  
  /**
   * Register a connection for cleanup
   */
  register(connection) {
    this.connections.add(connection);
    return connection;
  }
  
  /**
   * Register a timer for cleanup
   */
  registerTimer(timer) {
    this.timers.add(timer);
    return timer;
  }

  /**
   * Register a custom cleanup task
   */
  registerCleanupTask(task) {
    this.cleanupTasks.push(task);
  }
  
  /**
   * Clean up all registered resources
   */
  async cleanup() {
    console.log('🧹 ConnectionManager: Starting cleanup...');
    
    // Clear all timers first
    for (const timer of this.timers) {
      try {
        clearTimeout(timer);
        clearInterval(timer);
      } catch (error) {
        // Ignore timer cleanup errors
      }
    }
    this.timers.clear();
    
    // Run custom cleanup tasks
    for (const task of this.cleanupTasks) {
      try {
        await Promise.race([
          task(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Cleanup task timeout')), 3000)
          )
        ]);
      } catch (error) {
        console.warn('⚠️ Cleanup task failed:', error.message);
      }
    }
    this.cleanupTasks = [];
    
    // Close all connections with timeout protection
    const closePromises = Array.from(this.connections).map(async (connection) => {
      try {
        if (connection && typeof connection.close === 'function') {
          await Promise.race([
            connection.close(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Connection close timeout')), 3000)
            )
          ]);
        } else if (connection && typeof connection.disconnect === 'function') {
          await Promise.race([
            connection.disconnect(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Connection disconnect timeout')), 3000)
            )
          ]);
        }
      } catch (error) {
        console.warn('⚠️ Connection close failed:', error.message);
      }
    });
    
    await Promise.allSettled(closePromises);
    this.connections.clear();
    
    console.log('✅ ConnectionManager: Cleanup completed');
  }
}

// Global instance for tests
export const testConnectionManager = new ConnectionManager();