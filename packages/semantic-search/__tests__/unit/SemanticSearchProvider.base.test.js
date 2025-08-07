/**
 * Base tests for SemanticSearchProvider
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { SemanticSearchProvider } from '../../src/SemanticSearchProvider.js';
import { TestUtils } from '../setup.js';

describe('SemanticSearchProvider - Base Implementation', () => {
  let mockResourceManager;

  beforeEach(() => {
    mockResourceManager = TestUtils.createMockResourceManager();
  });

  describe('Provider Extension', () => {
    it('should extend Provider base class', async () => {
      const provider = await SemanticSearchProvider.create(mockResourceManager);
      
      // Check for Provider methods
      expect(typeof provider.connect).toBe('function');
      expect(typeof provider.disconnect).toBe('function');
      expect(typeof provider.find).toBe('function');
      expect(typeof provider.insert).toBe('function');
      expect(typeof provider.update).toBe('function');
      expect(typeof provider.delete).toBe('function');
    });

    it('should implement Provider interface correctly', async () => {
      const provider = await SemanticSearchProvider.create(mockResourceManager);
      
      expect(provider.name).toBe('SemanticSearchProvider');
      expect(provider.type).toBe('semantic');
      expect(provider.initialized).toBe(true);
    });
  });

  describe('ResourceManager Integration', () => {
    it('should require ResourceManager for creation', async () => {
      await expect(SemanticSearchProvider.create())
        .rejects.toThrow('ResourceManager is required');
    });

    it('should use ResourceManager for configuration', async () => {
      const provider = await SemanticSearchProvider.create(mockResourceManager);
      
      // Verify ResourceManager was called for config
      expect(mockResourceManager.get).toHaveBeenCalledWith('env.OPENAI_API_KEY');
      expect(mockResourceManager.get).toHaveBeenCalledWith('env.QDRANT_URL');
    });

    it('should register itself with ResourceManager', async () => {
      const mockRegister = jest.fn();
      mockResourceManager.register = mockRegister;
      
      const provider = await SemanticSearchProvider.create(mockResourceManager);
      
      expect(mockRegister).toHaveBeenCalledWith('semanticSearchProvider', provider);
    });
  });

  describe('Factory Pattern', () => {
    it('should use async factory method for creation', async () => {
      const provider = await SemanticSearchProvider.create(mockResourceManager);
      expect(provider).toBeInstanceOf(SemanticSearchProvider);
    });

    it('should not allow direct instantiation', () => {
      expect(() => new SemanticSearchProvider()).toThrow();
    });

    it('should perform async initialization', async () => {
      const provider = await SemanticSearchProvider.create(mockResourceManager);
      
      // Check that async resources are initialized
      expect(provider.embeddingService).toBeDefined();
      expect(provider.vectorStore).toBeDefined();
      expect(provider.documentProcessor).toBeDefined();
      expect(provider.cache).toBeDefined();
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance when registered in ResourceManager', async () => {
      const rm = TestUtils.createMockResourceManager();
      const instances = new Map();
      
      rm.register = jest.fn((name, instance) => {
        instances.set(name, instance);
      });
      
      rm.get = jest.fn((key) => {
        if (key === 'semanticSearchProvider') {
          return instances.get('semanticSearchProvider');
        }
        return rm.get.mock.calls.find(c => c[0] === key)?.[1] || 
               TestUtils.createMockResourceManager().get(key);
      });
      
      const provider1 = await SemanticSearchProvider.create(rm);
      const provider2 = rm.get('semanticSearchProvider');
      
      expect(provider2).toBe(provider1);
    });
  });

  describe('Connection Lifecycle', () => {
    it('should connect all services', async () => {
      const provider = await SemanticSearchProvider.create(mockResourceManager);
      
      await provider.connect();
      
      expect(provider.connected).toBe(true);
      expect(provider.vectorStore.connected).toBe(true);
    });

    it('should disconnect all services', async () => {
      const provider = await SemanticSearchProvider.create(mockResourceManager);
      
      await provider.connect();
      await provider.disconnect();
      
      expect(provider.connected).toBe(false);
      expect(provider.vectorStore.connected).toBe(false);
    });

    it('should handle connection errors gracefully', async () => {
      const provider = await SemanticSearchProvider.create(mockResourceManager);
      
      provider.vectorStore.connect = jest.fn().mockRejectedValue(new Error('Connection failed'));
      
      await expect(provider.connect()).rejects.toThrow('Failed to connect');
    });
  });

  describe('Provider Metadata', () => {
    it('should return correct metadata', async () => {
      const provider = await SemanticSearchProvider.create(mockResourceManager);
      
      const metadata = provider.getMetadata();
      
      expect(metadata).toMatchObject({
        name: 'SemanticSearchProvider',
        type: 'semantic',
        initialized: true,
        connected: false,
        embeddingModel: 'text-embedding-3-small',
        vectorDatabase: 'qdrant'
      });
    });

    it('should update metadata after connection', async () => {
      const provider = await SemanticSearchProvider.create(mockResourceManager);
      
      await provider.connect();
      const metadata = provider.getMetadata();
      
      expect(metadata.connected).toBe(true);
    });
  });

  describe('Capability Reporting', () => {
    it('should report semantic search capabilities', async () => {
      const provider = await SemanticSearchProvider.create(mockResourceManager);
      
      const capabilities = provider.getCapabilities();
      
      expect(capabilities).toContain('semanticSearch');
      expect(capabilities).toContain('hybridSearch');
      expect(capabilities).toContain('findSimilar');
      expect(capabilities).toContain('vectorSearch');
      expect(capabilities).toContain('embeddingGeneration');
      expect(capabilities).toContain('batchProcessing');
      expect(capabilities).toContain('caching');
    });
  });
});