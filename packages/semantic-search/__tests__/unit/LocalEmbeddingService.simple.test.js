/**
 * Simple test for LocalEmbeddingService - just make an actual embedding
 */

import { jest } from '@jest/globals';
import { LocalEmbeddingService } from '../../src/services/LocalEmbeddingService.js';

describe('LocalEmbeddingService - Simple Embedding Test', () => {
  let service;

  beforeAll(async () => {
    // Create service - no configuration needed!
    service = new LocalEmbeddingService();
    
    // Initialize the service (no-op but keeping for compatibility)
    await service.initialize();
  });

  afterAll(async () => {
    if (service) {
      await service.cleanup();
    }
  });

  test('should create an actual embedding from text', async () => {
    const text = 'Hello, this is a test sentence for embedding generation.';
    
    // Generate the embedding
    const embedding = await service.embed(text);
    
    // Verify the embedding
    expect(embedding).toBeDefined();
    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBe(768); // Expected dimensions
    
    // Check that we have a meaningful embedding (magnitude > 0)
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    expect(magnitude).toBeGreaterThan(0);
    
    // Check that values are reasonable floats
    embedding.forEach(val => {
      expect(typeof val).toBe('number');
      expect(Math.abs(val)).toBeLessThan(10); // Reasonable range for nomic embeddings
    });
    
    console.log('✅ Successfully generated embedding!');
    console.log(`   Dimensions: ${embedding.length}`);
    console.log(`   Magnitude: ${magnitude.toFixed(6)}`);
    console.log(`   Sample values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
    
    // Test that same text produces same embedding (deterministic)
    const embedding2 = await service.embed(text);
    embedding.forEach((val, i) => {
      expect(val).toBeCloseTo(embedding2[i], 10);
    });
    console.log('✅ Embeddings are deterministic');
  });
});