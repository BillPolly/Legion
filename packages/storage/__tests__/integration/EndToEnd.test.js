/**
 * End-to-End Integration Tests
 * Phase 8: Final Validation
 */

import { StorageProvider } from '../../src/index.js';
import { MemoryProvider } from '../../src/providers/memory/MemoryProvider.js';
import { Query } from '../../src/core/Query.js';
import { StorageError } from '../../src/core/StorageError.js';

describe('End-to-End Storage System', () => {
  let storageProvider;
  let mockResourceManager;

  beforeEach(() => {
    // Create mock ResourceManager
    mockResourceManager = {
      initialized: true,
      get: jest.fn((key) => {
        const config = {
          'env.STORAGE_CONFIG': { maxConnections: 10 },
          'env.STORAGE_MEMORY_CONFIG': { maxSize: 1000 }
        };
        return config[key] || null;
      })
    };
  });

  describe('Direct Backend Usage Pattern', () => {
    test('should create StorageProvider and use Memory provider directly', async () => {
      // Create StorageProvider
      storageProvider = await StorageProvider.create(mockResourceManager);
      
      expect(storageProvider.initialized).toBe(true);
      expect(storageProvider.providers.has('memory')).toBe(true);
      
      // Get memory provider and use directly
      const memoryProvider = storageProvider.getProvider('memory');
      
      // Insert data
      const insertResult = await memoryProvider.insert('users', [
        { name: 'Alice', role: 'admin' },
        { name: 'Bob', role: 'user' }
      ]);
      
      expect(insertResult.insertedCount).toBe(2);
      
      // Find data
      const users = await memoryProvider.find('users');
      expect(users).toHaveLength(2);
      
      // Update data
      const updateResult = await memoryProvider.update(
        'users',
        { name: 'Alice' },
        { $set: { role: 'superadmin' } }
      );
      
      expect(updateResult.modifiedCount).toBe(1);
      
      // Verify update
      const alice = await memoryProvider.findOne('users', { name: 'Alice' });
      expect(alice.role).toBe('superadmin');
      
      // Delete data
      const deleteResult = await memoryProvider.delete('users', { role: 'user' });
      expect(deleteResult.deletedCount).toBe(1);
      
      // Verify deletion
      const remaining = await memoryProvider.find('users');
      expect(remaining).toHaveLength(1);
    });

    test('should support multiple providers', async () => {
      storageProvider = await StorageProvider.create(mockResourceManager);
      
      // Add a second memory provider with different name
      const secondProvider = new MemoryProvider();
      await storageProvider.addProvider('cache', secondProvider);
      
      // Use both providers
      const memory = storageProvider.getProvider('memory');
      const cache = storageProvider.getProvider('cache');
      
      await memory.insert('data', { type: 'persistent' });
      await cache.insert('data', { type: 'temporary' });
      
      const memoryData = await memory.find('data');
      const cacheData = await cache.find('data');
      
      expect(memoryData[0].type).toBe('persistent');
      expect(cacheData[0].type).toBe('temporary');
    });
  });

  describe('Query Builder Integration', () => {
    test('should work with Query builder', async () => {
      storageProvider = await StorageProvider.create(mockResourceManager);
      const provider = storageProvider.getProvider('memory');
      
      // Insert test data
      await provider.insert('products', [
        { name: 'iPhone', category: 'electronics', price: 999, inStock: true },
        { name: 'iPad', category: 'electronics', price: 799, inStock: true },
        { name: 'MacBook', category: 'computers', price: 1999, inStock: false },
        { name: 'AirPods', category: 'electronics', price: 199, inStock: true }
      ]);
      
      // Build complex query
      const query = new Query('products')
        .where('category', 'electronics')
        .gte('price', 200)
        .lte('price', 1000)
        .sort('price', -1)
        .limit(2);
      
      // Execute query
      const results = await provider.find(
        query.collection,
        query.criteria,
        query.options
      );
      
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('iPhone');
      expect(results[1].name).toBe('iPad');
    });
  });

  describe('Error Handling', () => {
    test('should handle StorageError correctly', () => {
      const error = new StorageError(
        'Connection failed',
        'CONNECTION_ERROR',
        'mongodb',
        'connect',
        { host: 'localhost', port: 27017 }
      );
      
      expect(error.name).toBe('StorageError');
      expect(error.code).toBe('CONNECTION_ERROR');
      expect(error.provider).toBe('mongodb');
      expect(error.operation).toBe('connect');
      expect(error.details).toEqual({ host: 'localhost', port: 27017 });
      expect(error.timestamp).toBeDefined();
      
      const json = error.toJSON();
      expect(json.message).toBe('Connection failed');
    });

    test('should throw error when provider not found', async () => {
      storageProvider = await StorageProvider.create(mockResourceManager);
      
      expect(() => {
        storageProvider.getProvider('non-existent');
      }).toThrow("Provider 'non-existent' not found");
    });
  });

  describe('Provider Interface Compliance', () => {
    test('Memory provider should implement all required methods', async () => {
      const provider = new MemoryProvider();
      
      // Check all required methods exist
      expect(typeof provider.connect).toBe('function');
      expect(typeof provider.disconnect).toBe('function');
      expect(typeof provider.find).toBe('function');
      expect(typeof provider.findOne).toBe('function');
      expect(typeof provider.insert).toBe('function');
      expect(typeof provider.update).toBe('function');
      expect(typeof provider.delete).toBe('function');
      expect(typeof provider.count).toBe('function');
      expect(typeof provider.listCollections).toBe('function');
      expect(typeof provider.dropCollection).toBe('function');
      expect(typeof provider.getCapabilities).toBe('function');
      expect(typeof provider.getMetadata).toBe('function');
    });

    test('Provider should return correct capability list', () => {
      const provider = new MemoryProvider();
      const capabilities = provider.getCapabilities();
      
      expect(capabilities).toContain('find');
      expect(capabilities).toContain('insert');
      expect(capabilities).toContain('update');
      expect(capabilities).toContain('delete');
      expect(capabilities).toContain('count');
      expect(capabilities).toContain('listCollections');
      expect(capabilities).toContain('dropCollection');
    });
  });

  describe('Cleanup', () => {
    test('should cleanup all providers on shutdown', async () => {
      storageProvider = await StorageProvider.create(mockResourceManager);
      
      const provider1 = new MemoryProvider();
      const provider2 = new MemoryProvider();
      
      await storageProvider.addProvider('provider1', provider1);
      await storageProvider.addProvider('provider2', provider2);
      
      expect(provider1.connected).toBe(true);
      expect(provider2.connected).toBe(true);
      
      await storageProvider.cleanup();
      
      expect(provider1.connected).toBe(false);
      expect(provider2.connected).toBe(false);
    });
  });
});