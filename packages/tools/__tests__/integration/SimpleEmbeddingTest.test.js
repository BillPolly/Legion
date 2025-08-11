/**
 * Simple test for LocalEmbeddingService with sensible defaults
 */

import { LocalEmbeddingService } from '../../../semantic-search/src/services/LocalEmbeddingService.js';

describe('Simple Embedding Test', () => {
  let service;

  beforeAll(async () => {
    service = new LocalEmbeddingService();
    await service.initialize();
  });

  test('should generate embedding for simple text', async () => {
    const text = 'calculator tool for mathematical operations';
    
    const embedding = await service.embed(text);
    
    expect(embedding).toBeDefined();
    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBe(384);
    
    // Check that it's normalized
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    expect(norm).toBeCloseTo(1.0, 5);
    
    console.log('✅ Basic embedding generation works!');
    console.log('  Text:', text);
    console.log('  Dimensions:', embedding.length);
    console.log('  Norm:', norm.toFixed(6));
  });

  test('should generate multiple embeddings', async () => {
    const texts = [
      'file read operation',
      'json parsing utility',
      'calculator function'
    ];
    
    const embeddings = await service.generateEmbeddings(texts);
    
    expect(embeddings).toHaveLength(3);
    embeddings.forEach((embedding, i) => {
      expect(embedding).toHaveLength(384);
      const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      expect(norm).toBeCloseTo(1.0, 5);
      console.log(`  Embedding ${i + 1} for "${texts[i]}": norm = ${norm.toFixed(6)}`);
    });
    
    console.log('✅ Batch embedding generation works!');
  });
});