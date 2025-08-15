/**
 * Nomic Embedding Debug Test
 * Debug and verify Nomic embedding service functionality
 */

import { LocalEmbeddingService } from '../../../semantic-search/src/services/LocalEmbeddingService.js';

describe('Nomic Embedding Debug', () => {
  let service;

  beforeEach(async () => {
    service = new LocalEmbeddingService();
  });

  afterEach(async () => {
    if (service) {
      await service.cleanup();
    }
  });

  describe('Service Initialization', () => {
    test('should initialize properly', async () => {
      console.log('🔍 Testing service initialization...');
      
      expect(service.initialized).toBe(false);
      expect(service.dimensions).toBe(768);
      
      await service.initialize();
      
      expect(service.initialized).toBe(true);
      console.log('✅ Service initialized successfully');
    });

    test('should handle multiple initialization calls', async () => {
      await service.initialize();
      await service.initialize(); // Should not error
      
      expect(service.initialized).toBe(true);
    });
  });

  describe('Embedding Generation Debug', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    test('should generate valid embeddings', async () => {
      const texts = [
        'test',
        'Calculate math',
        'Read files from disk',
        'Parse JSON data structures'
      ];

      for (const text of texts) {
        console.log(`🔍 Generating embedding for: "${text}"`);
        
        const embedding = await service.embed(text);
        
        console.log(`  - Dimensions: ${embedding.length}`);
        console.log(`  - Type: ${typeof embedding[0]}`);
        console.log(`  - Range: [${Math.min(...embedding).toFixed(4)}, ${Math.max(...embedding).toFixed(4)}]`);
        
        expect(embedding).toBeDefined();
        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBe(768);
        expect(embedding.every(v => typeof v === 'number')).toBe(true);
        expect(embedding.every(v => !isNaN(v))).toBe(true);
      }
    });

    test('should show embedding statistics', async () => {
      const testTexts = [
        'calculator tool for math',
        'file reader utility',
        'json parser function'
      ];

      console.log('🔍 Embedding statistics analysis:');

      for (const text of testTexts) {
        const embedding = await service.embed(text);
        
        const mean = embedding.reduce((sum, val) => sum + val, 0) / embedding.length;
        const variance = embedding.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / embedding.length;
        const stdDev = Math.sqrt(variance);
        
        console.log(`\n"${text}":`)
        console.log(`  Mean: ${mean.toFixed(6)}`);
        console.log(`  Std Dev: ${stdDev.toFixed(6)}`);
        console.log(`  Min: ${Math.min(...embedding).toFixed(6)}`);
        console.log(`  Max: ${Math.max(...embedding).toFixed(6)}`);
        
        expect(Math.abs(mean)).toBeLessThan(1); // Reasonable mean
        expect(stdDev).toBeGreaterThan(0); // Should have variation
      }
    });
  });

  describe('Performance Metrics', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    test('should track performance metrics', async () => {
      const initialEmbeddings = service.totalEmbeddings;
      const initialTime = service.totalTime;

      await service.embed('test text 1');
      await service.embed('test text 2');

      expect(service.totalEmbeddings).toBe(initialEmbeddings + 2);
      expect(service.totalTime).toBeGreaterThan(initialTime);

      const avgTime = service.totalTime / service.totalEmbeddings;
      console.log(`📊 Average embedding time: ${avgTime.toFixed(2)}ms`);
      console.log(`📊 Total embeddings: ${service.totalEmbeddings}`);
    });
  });
});