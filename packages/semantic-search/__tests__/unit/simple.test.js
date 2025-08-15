/**
 * Simple test to verify basic functionality
 */

import { describe, it, expect } from '@jest/globals';
import { SemanticSearchProvider } from '../../src/SemanticSearchProvider.js';
import { DocumentProcessor } from '../../src/utils/DocumentProcessor.js';
import { EmbeddingCache } from '../../src/utils/EmbeddingCache.js';

describe('Semantic Search Basic Functionality', () => {
  it('should create provider with mock ResourceManager', async () => {
    const stored = new Map();
    const mockResourceManager = {
      initialized: true,
      get: (key) => {
        const values = {
          'env.OPENAI_API_KEY': 'test-key',
          'env.QDRANT_URL': 'http://localhost:6333'
        };
        return stored.get(key) || values[key];
      },
      getOrInitialize: async (key, initFn) => {
        if (!stored.has(key)) {
          stored.set(key, await initFn());
        }
        return stored.get(key);
      },
      register: () => {},
      initialize: async () => {}
    };
    
    const provider = await SemanticSearchProvider.create(mockResourceManager, { skipConnection: true });
    
    expect(provider).toBeDefined();
    expect(provider.name).toBe('SemanticSearchProvider');
    expect(provider.type).toBe('semantic');
    expect(provider.initialized).toBe(true);
  });
  
  it('should process documents correctly', () => {
    const processor = new DocumentProcessor();
    
    const doc = {
      title: 'Test Document',
      content: 'This is test content',
      tags: ['test', 'example']
    };
    
    const processed = processor.processDocument(doc);
    
    expect(processed.searchText).toBeDefined();
    expect(processed.searchText).toContain('Test Document');
    expect(processed.searchText).toContain('test content');
    expect(processed._processedFields).toBeInstanceOf(Array);
  });
  
  it('should handle query expansion', () => {
    const processor = new DocumentProcessor();
    
    const query = 'db auth';
    const expanded = processor.processCapabilityQuery(query);
    
    expect(expanded).toContain('database');
    expect(expanded).toContain('authentication');
  });
  
  it('should create embedding cache', () => {
    const cache = new EmbeddingCache({
      ttl: 3600,
      resourceManager: { get: () => null }
    });
    
    expect(cache).toBeDefined();
    expect(cache.config.ttl).toBe(3600);
  });
  
  it.skip('should connect and disconnect provider', async () => {
    const mockResourceManager = {
      initialized: true,
      get: (key) => {
        const values = {
          'env.OPENAI_API_KEY': 'test-key',
          'env.QDRANT_URL': 'http://localhost:6333'
        };
        return values[key];
      }
    };
    
    const provider = await SemanticSearchProvider.create(mockResourceManager, { skipConnection: true });
    
    expect(provider.connected).toBe(false);
    
    await provider.connect();
    expect(provider.connected).toBe(true);
    
    await provider.disconnect();
    expect(provider.connected).toBe(false);
  });
  
  it('should report capabilities', async () => {
    const stored = new Map();
    const mockResourceManager = {
      initialized: true,
      get: (key) => {
        const values = {
          'env.OPENAI_API_KEY': 'test-key',
          'env.QDRANT_URL': 'http://localhost:6333'
        };
        return stored.get(key) || values[key];
      },
      getOrInitialize: async (key, initFn) => {
        if (!stored.has(key)) {
          stored.set(key, await initFn());
        }
        return stored.get(key);
      },
      register: () => {},
      initialize: async () => {}
    };
    
    const provider = await SemanticSearchProvider.create(mockResourceManager, { skipConnection: true });
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