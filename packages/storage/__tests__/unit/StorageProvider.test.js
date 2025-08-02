/**
 * StorageProvider Unit Tests
 * Phase 1.1: ResourceManager Integration Tests
 */

import { StorageProvider } from '../../src/StorageProvider.js';

// Mock the ResourceManager since we're doing unit tests
jest.mock('@legion/module-loader', () => ({
  ResourceManager: jest.fn()
}));

// Mock the ActorSpace
jest.mock('@legion/actors', () => ({
  ActorSpace: jest.fn().mockImplementation((id) => ({
    id,
    register: jest.fn()
  }))
}));

describe('StorageProvider - ResourceManager Integration', () => {
  let mockResourceManager;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock ResourceManager
    mockResourceManager = {
      initialized: true,
      get: jest.fn((key) => {
        const config = {
          'env.STORAGE_CONFIG': { maxConnections: 10, timeout: 5000 },
          'env.MONGODB_URL': 'mongodb://localhost:27017/test',
          'env.POSTGRESQL_URL': 'postgresql://localhost:5432/test',
          'env.REDIS_URL': 'redis://localhost:6379',
          'env.STORAGE_MONGODB_CONFIG': { maxPoolSize: 20 },
          'env.STORAGE_MEMORY_CONFIG': { maxSize: 1000 }
        };
        return config[key] || null;
      })
    };
  });

  describe('Initialization with ResourceManager', () => {
    test('should require an initialized ResourceManager', async () => {
      // Test with no ResourceManager
      await expect(StorageProvider.create(null)).rejects.toThrow(
        'StorageProvider requires an initialized ResourceManager'
      );

      // Test with uninitialized ResourceManager
      mockResourceManager.initialized = false;
      await expect(StorageProvider.create(mockResourceManager)).rejects.toThrow(
        'StorageProvider requires an initialized ResourceManager'
      );
    });

    test('should create StorageProvider with ResourceManager', async () => {
      const storage = await StorageProvider.create(mockResourceManager);
      
      expect(storage).toBeDefined();
      expect(storage.initialized).toBe(true);
      expect(storage.resourceManager).toBe(mockResourceManager);
    });

    test('should auto-configure from environment variables', async () => {
      const storage = await StorageProvider.create(mockResourceManager);
      
      // Should have called get for various config keys
      expect(mockResourceManager.get).toHaveBeenCalledWith('env.STORAGE_CONFIG');
      expect(mockResourceManager.get).toHaveBeenCalledWith('env.MONGODB_URL');
      expect(mockResourceManager.get).toHaveBeenCalledWith('env.POSTGRESQL_URL');
      expect(mockResourceManager.get).toHaveBeenCalledWith('env.REDIS_URL');
    });

    test('should handle missing configuration gracefully', async () => {
      mockResourceManager.get = jest.fn(() => null);
      
      const storage = await StorageProvider.create(mockResourceManager);
      
      expect(storage).toBeDefined();
      expect(storage.initialized).toBe(true);
      // Should have memory provider as fallback
      expect(storage.providers.has('memory')).toBe(true);
    });
  });

  describe('Provider-specific configuration retrieval', () => {
    test('should retrieve MongoDB-specific configuration', async () => {
      const storage = await StorageProvider.create(mockResourceManager);
      
      expect(mockResourceManager.get).toHaveBeenCalledWith('env.STORAGE_MONGODB_CONFIG');
      expect(mockResourceManager.get).toHaveBeenCalledWith('env.STORAGE_MEMORY_CONFIG');
    });

    test('should merge general and provider-specific config', async () => {
      const storage = await StorageProvider.create(mockResourceManager);
      
      // Verify it requested both general and specific configs
      expect(mockResourceManager.get).toHaveBeenCalledWith('env.STORAGE_CONFIG');
      expect(mockResourceManager.get).toHaveBeenCalledWith('env.STORAGE_MONGODB_CONFIG');
    });
  });

  describe('Auto-configuration behavior', () => {
    test('should auto-add MongoDB provider when URL is available', async () => {
      const storage = await StorageProvider.create(mockResourceManager);
      
      expect(storage.providers.has('mongodb')).toBe(true);
    });

    test('should not add MongoDB provider when URL is missing', async () => {
      mockResourceManager.get = jest.fn((key) => {
        if (key === 'env.MONGODB_URL') return null;
        return null;
      });
      
      const storage = await StorageProvider.create(mockResourceManager);
      
      expect(storage.providers.has('mongodb')).toBe(false);
    });

    test('should always add memory provider as fallback', async () => {
      mockResourceManager.get = jest.fn(() => null); // No config at all
      
      const storage = await StorageProvider.create(mockResourceManager);
      
      expect(storage.providers.has('memory')).toBe(true);
    });
  });
});