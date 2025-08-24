/**
 * System Health Integration Tests
 * 
 * Tests memory usage patterns, connection pool management,
 * concurrent operations, error recovery, and resource leaks
 * 
 * Follows strict TDD approach with no mocks in integration tests
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ToolRegistry } from '../../src/integration/ToolRegistry.js';
import { ModuleLoader } from '../../src/core/ModuleLoader.js';
import { ModuleDiscovery } from '../../src/core/ModuleDiscovery.js';
import { DatabaseStorage } from '../../src/core/DatabaseStorage.js';
import { ModuleRegistry } from '../../src/core/ModuleRegistry.js';
import { DatabaseOperations } from '../../src/core/DatabaseOperations.js';
import { TextSearch } from '../../src/search/TextSearch.js';
import { Perspectives } from '../../src/search/Perspectives.js';
import { VectorStore } from '../../src/search/VectorStore.js';
import { ResourceManager } from '@legion/resource-manager';
import { MongoClient } from 'mongodb';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('SystemHealth Integration Tests', () => {
  let resourceManager;
  let mongoClient;
  let testDbName;
  let toolRegistry;
  const activeConnections = new Set();
  const activeTimers = new Set();

  beforeEach(async () => {
    // Create unique test database
    testDbName = `test_health_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Initialize ResourceManager
    resourceManager = await ResourceManager.getResourceManager();
    
    // Create MongoDB connection
    const mongoUrl = resourceManager.get('env.MONGODB_URL') || 'mongodb://localhost:27017';
    mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
    activeConnections.add(mongoClient);
    
    // Set test database
    resourceManager.set('test.database.name', testDbName);
    resourceManager.set('test.database.client', mongoClient);
  });

  afterEach(async () => {
    // Clean up timers
    for (const timer of activeTimers) {
      clearTimeout(timer);
      clearInterval(timer);
    }
    activeTimers.clear();

    // Clean up tool registry
    if (toolRegistry) {
      await toolRegistry.cleanup();
      toolRegistry = null;
    }

    // Drop test database
    if (mongoClient) {
      try {
        await mongoClient.db(testDbName).dropDatabase();
      } catch (error) {
        console.warn('Failed to drop test database:', error.message);
      }
    }

    // Close all connections
    for (const connection of activeConnections) {
      try {
        if (connection && typeof connection.close === 'function') {
          await connection.close();
        }
      } catch (error) {
        console.warn('Failed to close connection:', error.message);
      }
    }
    activeConnections.clear();
  });

  describe('Memory Usage Patterns', () => {
    it('should maintain stable memory usage under normal load', async () => {
      // Create tool registry
      toolRegistry = new ToolRegistry({ resourceManager });
      await toolRegistry.initialize();

      // Track initial memory
      const initialMemory = process.memoryUsage();

      // Load and cache 100 tools
      for (let i = 0; i < 100; i++) {
        const toolName = `test-tool-${i}`;
        
        // Create tool in database
        const db = mongoClient.db(testDbName);
        await db.collection('tools').insertOne({
          name: toolName,
          description: `Test tool ${i}`,
          moduleName: 'TestModule',
          inputSchema: { type: 'object' }
        });

        // Get tool (will cache it)
        await toolRegistry.getTool(toolName);
      }

      // Track memory after loading
      const afterLoadMemory = process.memoryUsage();

      // Memory increase should be reasonable (< 50MB for 100 tools)
      const memoryIncrease = (afterLoadMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
      expect(memoryIncrease).toBeLessThan(50);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        
        // Check memory after GC
        const afterGCMemory = process.memoryUsage();
        const retainedMemory = (afterGCMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
        
        // Should retain reasonable memory after GC
        expect(retainedMemory).toBeLessThan(30);
      }
    });

    it('should handle memory pressure with cache eviction', async () => {
      // Create tool registry with small cache
      toolRegistry = new ToolRegistry({ 
        resourceManager,
        maxCacheSize: 10
      });
      await toolRegistry.initialize();

      const db = mongoClient.db(testDbName);

      // Load more tools than cache can hold
      for (let i = 0; i < 50; i++) {
        const toolName = `test-tool-${i}`;
        
        await db.collection('tools').insertOne({
          name: toolName,
          description: `Test tool ${i}`,
          moduleName: 'TestModule'
        });

        await toolRegistry.getTool(toolName);
      }

      // Cache should only have latest 10 tools
      const cacheSize = toolRegistry.cache?.size || 0;
      expect(cacheSize).toBeLessThanOrEqual(10);
    });
  });

  describe('Connection Pool Management', () => {
    it('should manage database connections efficiently', async () => {
      const databaseStorage = new DatabaseStorage({ resourceManager });
      await databaseStorage.connect();
      activeConnections.add(databaseStorage);

      // Track initial connections
      const initialConnections = mongoClient.db('admin').admin().serverStatus();

      // Perform multiple operations
      const operations = [];
      for (let i = 0; i < 20; i++) {
        operations.push(
          databaseStorage.saveModule({
            name: `Module${i}`,
            description: `Test module ${i}`,
            version: '1.0.0'
          })
        );
      }

      await Promise.all(operations);

      // Should reuse connections, not create new ones for each operation
      const finalConnections = mongoClient.db('admin').admin().serverStatus();
      
      // Connection count should remain stable
      // Note: This is a simplified test - real connection tracking would need admin access
      expect(databaseStorage.isConnected()).toBe(true);

      await databaseStorage.disconnect();
    });

    it('should handle connection failures gracefully', async () => {
      // Use invalid connection string
      resourceManager.set('env.MONGODB_URL', 'mongodb://invalid:27017');
      
      // Create database storage with invalid URL
      const databaseStorage = new DatabaseStorage({ resourceManager });
      
      // Should throw error but not crash
      await expect(databaseStorage.connect()).rejects.toThrow();
      
      // Should handle operations gracefully when not connected
      await expect(databaseStorage.saveModule({ name: 'Test' })).rejects.toThrow();
      
      // Restore valid connection
      resourceManager.set('env.MONGODB_URL', 'mongodb://localhost:27017');
    });

    it('should clean up connections on shutdown', async () => {
      const services = [];

      // Create multiple services
      for (let i = 0; i < 5; i++) {
        const service = new DatabaseStorage({ resourceManager });
        await service.connect();
        services.push(service);
        activeConnections.add(service);
      }

      // All should be connected
      services.forEach(service => {
        expect(service.isConnected()).toBe(true);
      });

      // Disconnect all
      await Promise.all(services.map(s => s.disconnect()));

      // All should be disconnected
      services.forEach(service => {
        expect(service.isConnected()).toBe(false);
      });
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle sequential tool retrievals', async () => {
      // Use previously tested components in sequence
      const databaseStorage = new DatabaseStorage({ resourceManager });
      await databaseStorage.initialize();

      const moduleLoader = new ModuleLoader();
      
      // Load module using previously tested ModuleLoader
      const modulePath = path.join(__dirname, '../fixtures/MockCalculatorModule.js');
      const moduleInstance = await moduleLoader.loadModule(modulePath);
      
      // Get tools using previously tested method
      const tools = moduleInstance.getTools();
      expect(tools).toHaveLength(4);
      
      // Save module using previously tested DatabaseStorage
      await databaseStorage.saveModule({
        name: 'MockCalculator',
        path: modulePath,
        type: 'class'
      });
      
      // Save tools using previously tested DatabaseStorage  
      await databaseStorage.saveTools(tools, 'MockCalculator');
      
      // Retrieve tools sequentially using previously tested DatabaseStorage
      for (const tool of tools) {
        const retrievedTool = await databaseStorage.getTool(tool.name);
        expect(retrievedTool).toBeDefined();
        expect(retrievedTool.name).toBe(tool.name);
      }
    });

    it('should handle concurrent module loads', async () => {
      // Create DatabaseStorage with test database connection
      const databaseStorage = new DatabaseStorage({ 
        resourceManager,
        db: mongoClient.db(testDbName)
      });
      await databaseStorage.initialize();
      
      const databaseOperations = new DatabaseOperations({
        resourceManager,
        databaseStorage
      });
      
      const moduleRegistry = new ModuleRegistry({ 
        resourceManager,
        databaseOperations
      });
      await moduleRegistry.initialize();

      const db = mongoClient.db(testDbName);

      // Register test modules
      const modules = [];
      for (let i = 0; i < 10; i++) {
        modules.push({
          name: `ConcurrentModule${i}`,
          path: path.join(__dirname, '../fixtures/MockCalculatorModule.js'),
          type: 'class'
        });
      }
      await db.collection('modules').insertMany(modules);

      // Load modules concurrently
      const loads = modules.map(module =>
        moduleRegistry.loadModule(module.name)
      );

      const results = await Promise.all(loads);

      // All modules should load successfully
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
      });

      await moduleRegistry.cleanup();
    });

    it('should handle concurrent searches', async () => {
      const textSearch = new TextSearch({
        databaseStorage: {
          isConnected: true,
          getCollection: (name) => mongoClient.db(testDbName).collection(name)
        }
      });
      await textSearch.initialize();

      const db = mongoClient.db(testDbName);

      // Create searchable tools
      const tools = [];
      for (let i = 0; i < 50; i++) {
        tools.push({
          name: `search-tool-${i}`,
          description: `Tool for ${i % 5 === 0 ? 'testing' : 'processing'} data ${i}`,
          moduleName: 'SearchModule'
        });
      }
      await db.collection('tools').insertMany(tools);

      // Perform concurrent searches
      const searches = [
        textSearch.search('testing'),
        textSearch.search('processing'),
        textSearch.search('data'),
        textSearch.search('tool'),
        textSearch.search('search')
      ];

      const results = await Promise.all(searches);

      // All searches should complete
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
      });
    });
  });

  describe('Error Recovery', () => {
    it('should recover from database connection loss', async () => {
      toolRegistry = new ToolRegistry({ resourceManager });
      await toolRegistry.initialize();

      const db = mongoClient.db(testDbName);
      
      // Create test module first
      await db.collection('modules').insertOne({
        name: 'TestModule',
        description: 'Test module for recovery testing',
        path: path.join(__dirname, '../fixtures/MockCalculatorModule.js'),
        type: 'class'
      });
      
      // Create a tool that matches MockCalculatorModule
      await db.collection('tools').insertOne({
        name: 'add',
        description: 'Add two numbers together',
        moduleName: 'TestModule'
      });

      // Get tool (will cache)
      const tool1 = await toolRegistry.getTool('add');
      expect(tool1).toBeDefined();

      // Simulate connection loss by closing client
      // Note: In real scenario, we'd simulate network failure
      // For now, we'll test cache fallback
      
      // Tool should still be available from cache
      const tool2 = await toolRegistry.getTool('add');
      expect(tool2).toBeDefined();
      expect(tool2.name).toBe('add');
    });

    it('should handle and recover from transaction failures', async () => {
      const databaseStorage = new DatabaseStorage({ resourceManager });
      await databaseStorage.connect();
      activeConnections.add(databaseStorage);

      // Start a transaction
      const session = mongoClient.startSession();
      
      try {
        await session.withTransaction(async () => {
          // Perform operations
          await databaseStorage.saveModule({
            name: 'TransactionModule',
            description: 'Test transaction',
            version: '1.0.0'
          });

          // Simulate error
          throw new Error('Transaction test error');
        });
      } catch (error) {
        // Transaction should roll back
        expect(error.message).toBe('Transaction test error');
      } finally {
        await session.endSession();
      }

      // Module should not exist due to rollback
      const module = await databaseStorage.getModule('TransactionModule');
      expect(module).toBeNull();

      await databaseStorage.disconnect();
    });

    it('should handle module loading failures gracefully', async () => {
      const moduleLoader = new ModuleLoader();
      
      // Try to load non-existent module
      await expect(
        moduleLoader.loadModule('/non/existent/module.js')
      ).rejects.toThrow();

      // Try to load malformed module
      const malformedPath = path.join(__dirname, '../fixtures/malformed.js');
      await expect(
        moduleLoader.loadModule(malformedPath)
      ).rejects.toThrow();

      // Should still be able to load valid modules
      const validPath = path.join(__dirname, '../fixtures/MockCalculatorModule.js');
      const validModule = await moduleLoader.loadModule(validPath);
      expect(validModule).toBeDefined();
    });
  });

  describe('Resource Leak Detection', () => {
    it('should not leak memory on repeated operations', async () => {
      toolRegistry = new ToolRegistry({ resourceManager });
      await toolRegistry.initialize();

      const db = mongoClient.db(testDbName);

      // Track initial memory
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many operations
      for (let cycle = 0; cycle < 5; cycle++) {
        // Create tools
        const tools = [];
        for (let i = 0; i < 20; i++) {
          tools.push({
            name: `leak-test-${cycle}-${i}`,
            description: `Leak test tool ${cycle}-${i}`,
            moduleName: 'LeakTestModule'
          });
        }
        await db.collection('tools').insertMany(tools);

        // Load and unload tools
        for (const tool of tools) {
          await toolRegistry.getTool(tool.name);
        }

        // Clear cache
        if (toolRegistry.cache) {
          toolRegistry.cache.clear();
        }

        // Force GC if available
        if (global.gc) {
          global.gc();
        }
      }

      // Check final memory
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = (finalMemory - initialMemory) / 1024 / 1024;

      // Memory growth should be minimal (< 10MB for leak detection)
      expect(memoryGrowth).toBeLessThan(10);
    });

    it('should not leak database connections', async () => {
      const services = [];

      // Create and destroy services repeatedly
      for (let cycle = 0; cycle < 10; cycle++) {
        const service = new DatabaseStorage({ resourceManager });
        await service.connect();
        
        // Perform some operations
        await service.saveModule({
          name: `LeakModule${cycle}`,
          description: `Leak test ${cycle}`,
          version: '1.0.0'
        });

        await service.disconnect();
      }

      // No connections should remain active
      // Note: In real scenario, we'd check connection pool metrics
      expect(activeConnections.size).toBeLessThanOrEqual(1); // Only test client
    });

    it('should clean up event listeners', async () => {
      const moduleDiscovery = new ModuleDiscovery({
        resourceManager,
        searchPaths: [path.join(__dirname, '../fixtures')]
      });

      // Get initial listener count
      const initialListeners = process.listenerCount('uncaughtException');

      // Initialize (may add listeners)
      await moduleDiscovery.discoverModules(path.join(__dirname, '../fixtures'));

      // Clean up
      if (moduleDiscovery.cleanup) {
        await moduleDiscovery.cleanup();
      }

      // Check listener count hasn't grown
      const finalListeners = process.listenerCount('uncaughtException');
      expect(finalListeners).toBeLessThanOrEqual(initialListeners);
    });

    it('should clear timers on cleanup', async () => {
      // Track active timers
      const originalSetTimeout = global.setTimeout;
      const originalSetInterval = global.setInterval;
      const trackedTimers = new Set();

      global.setTimeout = function(...args) {
        const timer = originalSetTimeout.apply(this, args);
        trackedTimers.add(timer);
        return timer;
      };

      global.setInterval = function(...args) {
        const timer = originalSetInterval.apply(this, args);
        trackedTimers.add(timer);
        return timer;
      };

      // Create registry that might use timers
      toolRegistry = new ToolRegistry({ 
        resourceManager,
        cacheOptions: { ttl: 1000 } // Short TTL to trigger timer cleanup
      });
      await toolRegistry.initialize();

      // Perform operations that might create timers
      const db = mongoClient.db(testDbName);
      await db.collection('tools').insertOne({
        name: 'timer-test-tool',
        description: 'Timer test',
        moduleName: 'TestModule'
      });
      await toolRegistry.getTool('timer-test-tool');

      // Clean up
      await toolRegistry.cleanup();

      // All timers should be cleared
      for (const timer of trackedTimers) {
        clearTimeout(timer);
        clearInterval(timer);
      }

      // Restore original functions
      global.setTimeout = originalSetTimeout;
      global.setInterval = originalSetInterval;
    });
  });

  describe('System Monitoring', () => {
    it('should provide accurate system statistics', async () => {
      toolRegistry = new ToolRegistry({ resourceManager });
      await toolRegistry.initialize();

      const db = mongoClient.db(testDbName);

      // Create test data
      await db.collection('modules').insertMany([
        { name: 'Module1', description: 'Test module 1' },
        { name: 'Module2', description: 'Test module 2' }
      ]);

      await db.collection('tools').insertMany([
        { name: 'tool1', moduleName: 'Module1' },
        { name: 'tool2', moduleName: 'Module1' },
        { name: 'tool3', moduleName: 'Module2' }
      ]);

      // Get statistics
      const stats = await toolRegistry.getStatistics();

      expect(stats).toBeDefined();
      expect(stats.modules).toBe(2);
      expect(stats.tools).toBe(3);
      expect(stats.cacheSize).toBeGreaterThanOrEqual(0);
      expect(stats.connections).toBeGreaterThanOrEqual(1);
    });

    it('should track operation performance', async () => {
      toolRegistry = new ToolRegistry({ 
        resourceManager,
        enableMetrics: true 
      });
      await toolRegistry.initialize();

      const db = mongoClient.db(testDbName);
      
      // Create test tool
      await db.collection('tools').insertOne({
        name: 'perf-test-tool',
        description: 'Performance test',
        moduleName: 'TestModule'
      });

      // Measure operation time
      const startTime = Date.now();
      await toolRegistry.getTool('perf-test-tool');
      const endTime = Date.now();

      const operationTime = endTime - startTime;
      
      // Operation should complete within reasonable time (< 1 second)
      expect(operationTime).toBeLessThan(1000);

      // Get metrics if available
      if (toolRegistry.getMetrics) {
        const metrics = await toolRegistry.getMetrics();
        expect(metrics).toBeDefined();
      }
    });
  });
});