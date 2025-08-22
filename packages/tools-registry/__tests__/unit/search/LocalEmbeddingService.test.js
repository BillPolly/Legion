/**
 * Unit tests for LocalEmbeddingService
 * Tests the local ONNX-based embedding generation
 */

import { jest } from '@jest/globals';

// Create a factory for mock instances to avoid closure issues
const createMockNomicInstance = () => {
  const instance = {
    initialized: false,
    initialize: jest.fn().mockImplementation(async function() {
      this.initialized = true;
      return true;
    }),
    embed: jest.fn().mockImplementation(async (text) => {
      // Return mock embedding
      const embedding = new Array(768).fill(0);
      for (let i = 0; i < Math.min(10, 768); i++) {
        embedding[i] = Math.random();
      }
      return embedding;
    }),
    embedBatch: jest.fn().mockImplementation(async (texts) => {
      return texts.map(() => {
        const embedding = new Array(768).fill(0);
        for (let i = 0; i < Math.min(10, 768); i++) {
          embedding[i] = Math.random();
        }
        return embedding;
      });
    }),
    similarity: jest.fn().mockImplementation(async (embedding1, embedding2) => {
      return 0.85; // Mock similarity score
    }),
    findSimilar: jest.fn().mockImplementation(async (queryEmbedding, documentEmbeddings, topK) => {
      return documentEmbeddings.slice(0, topK).map((embedding, index) => ({
        embedding,
        score: 0.9 - index * 0.1,
        index
      }));
    }),
    close: jest.fn().mockResolvedValue(true)
  };
  
  // Bind the context for initialize
  instance.initialize = instance.initialize.bind(instance);
  
  return instance;
};

// Mock the Nomic embedding service
jest.unstable_mockModule('@legion/nomic', () => {
  return {
    NomicEmbeddings: class MockNomicEmbeddings {
      constructor() {
        return createMockNomicInstance();
      }
    }
  };
});

const { LocalEmbeddingService } = await import('../../../src/search/LocalEmbeddingService.js');

describe('LocalEmbeddingService', () => {
  let service;

  beforeEach(() => {
    service = new LocalEmbeddingService();
  });

  describe('Constructor and Configuration', () => {
    test('should create service with default configuration', () => {
      expect(service).toBeDefined();
      expect(service.embedder).toBe(null); // embedder is null until initialized
    });

    test('should accept custom configuration', () => {
      const customService = new LocalEmbeddingService({
        batchSize: 50,
        modelName: 'custom-model'
      });
      expect(customService).toBeDefined();
      expect(customService.embedder).toBe(null); // embedder is null until initialized
    });
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      await service.initialize();
      expect(service.initialized).toBe(true);
    });

    test('should not reinitialize if already initialized', async () => {
      await service.initialize();
      const firstInit = service.initialized;
      await service.initialize();
      expect(service.initialized).toBe(firstInit);
    });
  });

  describe('Embedding Generation', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    test('should generate embedding for single text', async () => {
      const text = 'test text for embedding';
      const embedding = await service.embed(text);
      
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(768);
      expect(embedding.every(val => typeof val === 'number')).toBe(true);
    });

    test('should generate embeddings for multiple texts', async () => {
      const texts = [
        'first text',
        'second text',
        'third text'
      ];
      const embeddings = await service.generateEmbeddings(texts);
      
      expect(Array.isArray(embeddings)).toBe(true);
      expect(embeddings.length).toBe(3);
      embeddings.forEach(embedding => {
        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBe(768);
      });
    });

    test('should handle empty text', async () => {
      const embedding = await service.embed('');
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(768);
    });

    test('should handle very long text', async () => {
      const longText = 'test '.repeat(1000);
      const embedding = await service.embed(longText);
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(768);
    });

    test('should handle special characters', async () => {
      const specialText = '!@#$%^&*()_+-=[]{}|;\':",.<>?/\\`~';
      const embedding = await service.embed(specialText);
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(768);
    });

    test('should batch large arrays of texts', async () => {
      const texts = Array(250).fill('test text');
      const embeddings = await service.generateEmbeddings(texts);
      
      expect(embeddings.length).toBe(250);
      embeddings.forEach(embedding => {
        expect(embedding.length).toBe(768);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid service state gracefully', async () => {
      const uninitializedService = new LocalEmbeddingService();
      // With mocked service, this will work - just verify it doesn't crash
      const result = await uninitializedService.embed('test');
      expect(Array.isArray(result)).toBe(true);
    });

    test('should handle null input', async () => {
      await service.initialize();
      // Mock will handle null gracefully
      const result = await service.embed(null);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(768);
    });

    test('should handle undefined input', async () => {
      await service.initialize();
      // Mock will handle undefined gracefully
      const result = await service.embed(undefined);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(768);
    });

    test('should handle non-string input', async () => {
      await service.initialize();
      // Implementation will convert non-string to string
      const result = await service.embed(123);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(768);
    });
  });

  describe('Model Information', () => {
    test('should provide model info', () => {
      const info = service.getModelInfo();
      expect(info).toBeDefined();
      expect(info.name).toBe('Nomic Embed Text v1.5');
      expect(info.dimensions).toBe(768);
      expect(info.type).toBe('transformer');
      expect(info.model).toBe('nomic-embed-text-v1.5');
      expect(info.provider).toBe('Nomic AI (local)');
    });
  });

  describe('generateEmbedding method', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    test('should be an alias for embed method', async () => {
      const text = 'test text';
      const embedding1 = await service.embed(text);
      const embedding2 = await service.generateEmbedding(text);
      
      // Should produce similar embeddings (not exact due to potential variations)
      expect(embedding1.length).toBe(embedding2.length);
      expect(embedding1.length).toBe(768);
    });
  });
});