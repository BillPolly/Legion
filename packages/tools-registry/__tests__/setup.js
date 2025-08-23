/**
 * Global test setup for tools-registry
 * 
 * Provides proper test isolation, resource management, and cleanup
 * to avoid the issues that plagued the old tools-registry package.
 */

import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';

// Global cleanup tracking to prevent resource leaks
global.testCleanupTasks = [];
global.testConnections = new Set();
global.testTimers = new Set();

// Test database naming for isolation
global.getTestDatabaseName = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `test_tool_registry_${timestamp}_${random}`;
};

// Register cleanup tasks
global.registerCleanupTask = (task) => {
  global.testCleanupTasks.push(task);
};

// Register connections for cleanup
global.registerTestConnection = (connection) => {
  global.testConnections.add(connection);
  return connection;
};

// Register timers for cleanup
global.registerTestTimer = (timer) => {
  global.testTimers.add(timer);
  return timer;
};

// Test-specific ResourceManager that uses test database
global.createTestResourceManager = async () => {
  const { ResourceManager } = await import('@legion/resource-manager');
  const resourceManager = new ResourceManager(); // Create new instance, NOT singleton
  await resourceManager.initialize();
  
  // Override database name for testing
  const testDbName = global.getTestDatabaseName();
  resourceManager.set('test', { database: { name: testDbName } });
  
  // Register cleanup to drop test database
  global.registerCleanupTask(async () => {
    try {
      const { MongoClient } = await import('mongodb');
      const mongoUrl = resourceManager.get('env.MONGODB_URL') || 'mongodb://localhost:27017';
      const client = new MongoClient(mongoUrl);
      await client.connect();
      await client.db(testDbName).dropDatabase();
      await client.close();
    } catch (error) {
      console.warn(`Failed to cleanup test database ${testDbName}:`, error.message);
    }
  });
  
  return resourceManager;
};

// Individual test cleanup
beforeEach(() => {
  // Clear per-test state
  global.testCleanupTasks = [];
  global.testConnections.clear();
  global.testTimers.clear();
});

afterEach(async () => {
  // Clean up after each test
  console.log('Running per-test cleanup...');
  
  // Clear timers
  for (const timer of global.testTimers) {
    clearTimeout(timer);
    clearInterval(timer);
  }
  
  // Close connections
  for (const connection of global.testConnections) {
    try {
      if (connection && typeof connection.close === 'function') {
        await connection.close();
      }
    } catch (error) {
      console.warn('Per-test connection cleanup failed:', error.message);
    }
  }
  
  // Run cleanup tasks
  for (const task of global.testCleanupTasks) {
    try {
      await task();
    } catch (error) {
      console.warn('Per-test cleanup task failed:', error.message);
    }
  }
});

// Global test cleanup
afterAll(async () => {
  console.log('Running global test cleanup...');
  
  // Force cleanup any remaining resources
  const cleanupPromises = [];
  
  // Close any remaining connections
  for (const connection of global.testConnections) {
    if (connection && typeof connection.close === 'function') {
      cleanupPromises.push(
        Promise.race([
          connection.close(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Cleanup timeout')), 5000)
          )
        ]).catch(error => {
          console.warn('Global connection cleanup failed:', error.message);
        })
      );
    }
  }
  
  // Wait for all cleanup to complete
  await Promise.allSettled(cleanupPromises);
  
  console.log('Global test cleanup complete');
});

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection in test at:', promise, 'reason:', reason);
  // In tests, log but don't exit
});

// Handle uncaught exceptions in tests
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception in test:', error);
  // In tests, log but don't exit
});

console.log('Test setup complete - isolated test environment ready');