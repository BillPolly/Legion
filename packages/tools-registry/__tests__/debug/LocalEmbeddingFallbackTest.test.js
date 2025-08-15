/**
 * Test LocalEmbeddingService with fallback approach
 */

import { LocalEmbeddingService } from '../../../semantic-search/src/services/LocalEmbeddingService.js';

describe('LocalEmbedding Fallback Test', () => {
  let service;

  beforeAll(async () => {
    service = new LocalEmbeddingService();
    await service.initialize();
  });

  test('should generate fallback embeddings when ONNX fails', async () => {
    console.log('Testing LocalEmbeddingService with fallback...');

    const testTexts = [
      'calculator tool for mathematical operations',
      'file_write tool for writing files',
      'json_parse tool for parsing JSON'
    ];

    for (const text of testTexts) {
      console.log(`\nTesting: "${text}"`);
      
      try {
        const embedding = await service.embed(text);
        
        // Verify embedding properties
        expect(embedding).toBeDefined();
        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBe(768);
        
        // Check normalization
        const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        expect(norm).toBeCloseTo(1.0, 5);
        
        console.log(`  ✅ Generated ${embedding.length}D embedding, norm: ${norm.toFixed(6)}`);
        console.log(`  First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}]`);
        
      } catch (error) {
        console.error(`  ❌ Failed: ${error.message}`);
        throw error;
      }
    }

    console.log('\n✅ All embeddings generated successfully!');
  });

  test('should generate consistent embeddings for same text', async () => {
    console.log('Testing embedding consistency...');

    const text = 'test embedding consistency';
    const embedding1 = await service.embed(text);
    const embedding2 = await service.embed(text);

    // Should be identical
    expect(embedding1.length).toBe(embedding2.length);
    
    for (let i = 0; i < embedding1.length; i++) {
      expect(embedding1[i]).toBeCloseTo(embedding2[i], 10);
    }

    console.log('✅ Embeddings are consistent!');
  });

  test('should generate different embeddings for different text', async () => {
    console.log('Testing embedding uniqueness...');

    const embedding1 = await service.embed('calculator mathematical operations');
    const embedding2 = await service.embed('file system operations');

    // Calculate cosine similarity
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    console.log(`Cosine similarity: ${similarity.toFixed(6)}`);

    // Different texts should have different embeddings (similarity < 0.99)
    expect(Math.abs(similarity)).toBeLessThan(0.99);

    console.log('✅ Different texts produce different embeddings!');
  });

  test('should handle batch processing', async () => {
    console.log('Testing batch processing...');

    const texts = [
      'first test text',
      'second test text', 
      'third test text'
    ];

    const embeddings = await service.generateEmbeddings(texts);

    expect(embeddings).toHaveLength(3);
    embeddings.forEach((embedding, i) => {
      expect(embedding).toHaveLength(768);
      const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      expect(norm).toBeCloseTo(1.0, 5);
      console.log(`  Batch ${i + 1}: norm = ${norm.toFixed(6)}`);
    });

    console.log('✅ Batch processing works!');
  });

  test('should provide correct model info', async () => {
    console.log('Testing model info...');

    const info = service.getModelInfo();
    
    expect(info.name).toContain('Nomic Embed');
    expect(info.type).toBe('local');
    expect(info.dimensions).toBe(768);
    expect(info.provider).toBeDefined();

    console.log('Model info:', info);
    console.log('✅ Model info is correct!');
  });
});