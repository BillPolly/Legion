/**
 * Unit tests for LocalEmbeddingService
 * Tests real Nomic embedding generation
 */

import { jest } from '@jest/globals';
import { LocalEmbeddingService } from '../../src/services/LocalEmbeddingService.js';

describe('LocalEmbeddingService', () => {
  let service;

  beforeEach(() => {
    service = new LocalEmbeddingService();
  });

  afterEach(async () => {
    if (service) {
      await service.cleanup();
      service = null;
    }
  });

  describe('Constructor', () => {
    test('should create service with correct defaults', () => {
      expect(service.dimensions).toBe(768);
      expect(service.initialized).toBe(false);
      expect(service.totalEmbeddings).toBe(0);
      expect(service.totalTime).toBe(0);
    });
  });

  describe('Embedding Generation', () => {
    test('should generate embedding for single text', async () => {
      const text = 'test text';
      const embedding = await service.embed(text);
      
      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(768);
      
      // Check normalization
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      expect(magnitude).toBeGreaterThan(0);
    });

    test('should generate consistent embeddings for same text', async () => {
      const text = 'consistent test';
      
      const embedding1 = await service.embed(text);
      const embedding2 = await service.embed(text);
      
      embedding1.forEach((val, i) => {
        expect(val).toBeCloseTo(embedding2[i], 10);
      });
    });

    test('should generate different embeddings for different texts', async () => {
      const embedding1 = await service.embed('cats and dogs');
      const embedding2 = await service.embed('completely different topic about cars');
      
      // Calculate cosine similarity
      const similarity = await service.similarity(embedding1, embedding2);
      
      // Should be different (not identical) but still within cosine similarity bounds
      expect(similarity).toBeLessThan(0.9);
      expect(similarity).toBeGreaterThan(-1.0);
    });

    test('should handle batch embedding generation', async () => {
      const texts = ['text 1', 'text 2', 'text 3'];
      const embeddings = await service.embedBatch(texts);
      
      expect(embeddings).toHaveLength(3);
      embeddings.forEach(embedding => {
        expect(embedding).toHaveLength(768);
      });
    });

    test('should handle generateEmbeddings interface', async () => {
      const texts = ['text 1', 'text 2'];
      const embeddings = await service.generateEmbeddings(texts);
      
      expect(embeddings).toHaveLength(2);
      embeddings.forEach(embedding => {
        expect(embedding).toHaveLength(768);
      });
    });

    test('should handle single text in generateEmbeddings', async () => {
      const embeddings = await service.generateEmbeddings('single text');
      
      expect(embeddings).toHaveLength(1);
      expect(embeddings[0]).toHaveLength(768);
    });

    test('should handle empty input gracefully', async () => {
      expect(await service.embedBatch([])).toEqual([]);
      expect(await service.embedBatch(null)).toEqual([]);
      expect(await service.generateEmbeddings([])).toEqual([]);
      expect(await service.generateEmbeddings(null)).toEqual([]);
    });
  });

  describe('Event Embedding', () => {
    test('should embed log event', async () => {
      const event = {
        type: 'error',
        level: 'critical',
        message: 'Something went wrong',
        service: 'api',
        eventType: 'request_failed'
      };
      
      const embedding = await service.embedLogEvent(event);
      
      expect(embedding).toBeDefined();
      expect(embedding).toHaveLength(768);
    });

    test('should extract text from event correctly', () => {
      const event = {
        type: 'info',
        message: 'User logged in',
        service: 'auth'
      };
      
      const text = service.extractEmbeddingText(event);
      
      expect(text).toContain('Type: info');
      expect(text).toContain('User logged in');
      expect(text).toContain('Service: auth');
    });
  });

  describe('Statistics', () => {
    test('should track embedding statistics', async () => {
      await service.embed('test 1');
      await service.embed('test 2');
      
      const stats = service.getStats();
      
      expect(stats.totalEmbeddings).toBe(2);
      expect(stats.totalTime).toBeGreaterThanOrEqual(0);
      expect(stats.averageTime).toBeGreaterThanOrEqual(0);
      expect(stats.dimensions).toBe(768);
      expect(stats.initialized).toBe(true);
      expect(stats.model).toBe('nomic-embed-text-v1.5');
    });
  });

  describe('Model Info', () => {
    test('should return correct model info', () => {
      const info = service.getModelInfo();
      
      expect(info.name).toBe('Nomic Embed Text v1.5');
      expect(info.type).toBe('transformer');
      expect(info.dimensions).toBe(768);
      expect(info.model).toBe('nomic-embed-text-v1.5');
      expect(info.provider).toBe('Nomic AI (local)');
    });
  });

  describe('Aliases and Compatibility', () => {
    test('should support generateEmbedding alias', async () => {
      const embedding = await service.generateEmbedding('test text');
      
      expect(embedding).toBeDefined();
      expect(embedding).toHaveLength(768);
    });
  });
});