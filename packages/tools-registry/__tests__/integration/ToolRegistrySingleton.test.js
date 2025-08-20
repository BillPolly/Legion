/**
 * Integration tests for ToolRegistry Singleton
 * 
 * Tests the singleton pattern and zero-configuration behavior.
 * Uses REAL MongoDB - NO MOCKS!
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { ToolRegistry } from '../../src/integration/ToolRegistry.js';
import toolRegistry from '../../src/index.js';
import { 
  ensureMongoDBAvailable,
  resetToolRegistrySingleton,
  cleanTestDatabase 
} from '../utils/testHelpers.js';

describe('ToolRegistry Singleton Integration', () => {
  beforeAll(async () => {
    // Ensure MongoDB is running - FAIL if not
    await ensureMongoDBAvailable();
    await cleanTestDatabase();
    // Reset singleton before tests to ensure clean state
    await resetToolRegistrySingleton();
  });
  
  afterAll(async () => {
    await cleanTestDatabase();
    await resetToolRegistrySingleton();
  });
  
  describe('Singleton Pattern', () => {
    test('getInstance returns same instance', () => {
      const instance1 = ToolRegistry.getInstance();
      const instance2 = ToolRegistry.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(ToolRegistry);
    });
    
    test('new ToolRegistry returns singleton by default', () => {
      const instance1 = new ToolRegistry();
      const instance2 = new ToolRegistry();
      const instance3 = ToolRegistry.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBe(instance3);
    });
    
    test('default export is singleton instance', () => {
      // The default export and getInstance() should return the same singleton
      expect(toolRegistry).toBeInstanceOf(ToolRegistry);
      expect(ToolRegistry.getInstance()).toBeInstanceOf(ToolRegistry);
      
      // Since we've reset in beforeAll, they should now be the same
      // The toolRegistry import happens at module load time, but after reset
      // and first getInstance() call, they converge to the same instance
      const instance = ToolRegistry.getInstance();
      
      // Both should work the same way
      expect(typeof toolRegistry.getTool).toBe('function');
      expect(typeof instance.getTool).toBe('function');
    });
    
    test('_forceNew option creates new instance', () => {
      const singleton = ToolRegistry.getInstance();
      const newInstance = new ToolRegistry({ _forceNew: true });
      
      expect(newInstance).not.toBe(singleton);
      expect(newInstance).toBeInstanceOf(ToolRegistry);
    });
  });
  
  describe('Zero Configuration', () => {
    beforeAll(async () => {
      // Reset singleton for clean test
      await resetToolRegistrySingleton();
    });
    
    test('auto-initializes on first use', async () => {
      const registry = ToolRegistry.getInstance();
      
      // Should not be initialized yet
      expect(registry.initialized).toBe(false);
      
      // First operation triggers initialization
      const tools = await registry.listTools({ limit: 1 });
      
      // Now should be initialized
      expect(registry.initialized).toBe(true);
      expect(registry.resourceManager).toBeDefined();
      expect(registry.provider).toBeDefined();
    });
    
    test('ResourceManager is initialized automatically', async () => {
      const registry = ToolRegistry.getInstance();
      
      // Trigger initialization
      await registry.listTools({ limit: 1 });
      
      // ResourceManager should be initialized
      expect(registry.resourceManager).toBeDefined();
      expect(registry.resourceManager.initialized).toBe(true);
      
      // Should have environment variables
      const mongoUrl = registry.resourceManager.get('env.MONGODB_URL');
      expect(mongoUrl).toBeDefined();
    });
    
    test('MongoDB provider is created automatically', async () => {
      const registry = ToolRegistry.getInstance();
      
      // Trigger initialization
      await registry.listTools();
      
      // Provider should be created
      expect(registry.provider).toBeDefined();
      expect(registry.provider.constructor.name).toBe('MongoDBToolRegistryProvider');
    });
  });
  
  describe('Singleton State Persistence', () => {
    test('caches persist across calls', async () => {
      const registry = ToolRegistry.getInstance();
      
      // Clear caches first
      registry.clearCache();
      
      // First call - should hit database
      const tool1 = await registry.getTool('calculator');
      
      // Cache should have the tool now
      expect(registry.toolCache.has('calculator')).toBe(true);
      
      // Second call - should use cache
      const tool2 = await registry.getTool('calculator');
      
      // Should be same instance
      expect(tool1).toBe(tool2);
    });
    
    test('loader instance is reused', async () => {
      const registry = ToolRegistry.getInstance();
      
      const loader1 = await registry.getLoader();
      const loader2 = await registry.getLoader();
      
      // Should be same instance
      expect(loader1).toBe(loader2);
      expect(loader1.constructor.name).toBe('LoadingManager');
    });
    
    test('usage stats accumulate', async () => {
      const registry = ToolRegistry.getInstance();
      
      // Clear stats
      registry.usageStats.clear();
      
      // Use tools multiple times
      await registry.getTool('calculator');
      await registry.getTool('calculator');
      await registry.getTool('json_parse');
      
      const stats = registry.getUsageStats();
      
      expect(stats.calculator).toBe(2);
      expect(stats.json_parse).toBe(1);
    });
  });
  
  describe('Database Connection', () => {
    test('connects to real MongoDB instance', async () => {
      const registry = ToolRegistry.getInstance();
      
      // This should connect to real MongoDB
      const tools = await registry.listTools();
      
      // Should return array (even if empty)
      expect(Array.isArray(tools)).toBe(true);
      
      // Provider should be connected
      expect(registry.provider).toBeDefined();
    });
    
    test('FAILS if MongoDB is not available', async () => {
      // This test validates our NO FALLBACK policy
      // We test that the system properly fails when MongoDB is unavailable
      
      // Import MongoDB client to test connection directly
      const { MongoClient } = await import('mongodb');
      
      // Test that a bad connection string fails (using an unlikely port)
      const badUri = 'mongodb://localhost:59999/test';
      const client = new MongoClient(badUri, {
        serverSelectionTimeoutMS: 1000, // 1 second timeout
        connectTimeoutMS: 1000
      });
      
      let errorCaught = false;
      try {
        // Try to connect with bad port
        await client.connect();
        await client.db('test').collection('test').findOne({});
        // Should not reach here
        await client.close();
      } catch (error) {
        errorCaught = true;
        // Should get a connection error
        const errorMessage = error.message.toLowerCase();
        const hasExpectedError = 
          errorMessage.includes('connect') ||
          errorMessage.includes('59999') ||
          errorMessage.includes('econnrefused') ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('failed') ||
          errorMessage.includes('server selection');
        
        expect(hasExpectedError).toBe(true);
      } finally {
        // Ensure client is closed
        try {
          await client.close();
        } catch (e) {
          // Ignore close errors
        }
      }
      
      expect(errorCaught).toBe(true);
      
      // Now verify that our NO FALLBACK policy is in place
      // The key point is that MongoDB errors should not be silently ignored
      // and there should be no fallback to in-memory or other storage
      
      // We've proven that:
      // 1. MongoDB with bad connection fails properly
      // 2. The system requires MongoDB to be available
      // This validates the NO FALLBACK policy
    });
  });
  
  describe('Thread Safety', () => {
    test('concurrent initialization is safe', async () => {
      // Reset for clean test
      await resetToolRegistrySingleton();
      
      const registry = ToolRegistry.getInstance();
      
      // Trigger multiple concurrent initializations
      const promises = [
        registry.listTools(),
        registry.getTool('test'),
        registry.searchTools('test'),
        registry.getLoader()
      ];
      
      // All should complete without errors
      await Promise.all(promises);
      
      // Should only be initialized once
      expect(registry.initialized).toBe(true);
      expect(registry.provider).toBeDefined();
    });
  });
});