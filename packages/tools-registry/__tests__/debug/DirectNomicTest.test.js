/**
 * Direct Nomic model test to verify embedding functionality
 */

import { LocalEmbeddingService } from '../../../semantic-search/src/services/LocalEmbeddingService.js';

describe('Direct Nomic Model Test', () => {
  let service;

  beforeAll(async () => {
    console.log('Initializing Nomic embedding service...');
    service = new LocalEmbeddingService();
    await service.initialize();
    console.log('✅ Nomic service initialized');
  });

  afterAll(async () => {
    if (service) {
      await service.cleanup();
    }
  });

  describe('Basic Embedding Generation', () => {
    test('should generate embedding for simple text', async () => {
      const text = 'Hello world';
      console.log(`Generating embedding for: "${text}"`);
      
      const embedding = await service.embed(text);
      
      console.log(`Generated embedding dimensions: ${embedding.length}`);
      console.log(`First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}]`);
      
      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(768);
      expect(embedding.every(val => typeof val === 'number')).toBe(true);
      expect(embedding.some(val => val !== 0)).toBe(true); // Should not be all zeros
    });

    test('should handle various text lengths', async () => {
      const testTexts = [
        'a',
        'short text',
        'This is a medium length sentence for testing embeddings.',
        'This is a much longer piece of text that contains multiple sentences and should test how the Nomic model handles longer inputs with more complex semantic content and structure.'
      ];

      for (const text of testTexts) {
        console.log(`Testing text length ${text.length}: "${text.substring(0, 50)}..."`);
        
        const embedding = await service.embed(text);
        
        expect(embedding).toBeDefined();
        expect(embedding.length).toBe(768);
        expect(embedding.every(val => typeof val === 'number')).toBe(true);
        
        console.log(`  ✅ Generated valid embedding`);
      }
    });

    test('should produce consistent embeddings', async () => {
      const text = 'Calculate mathematical expressions';
      
      const embedding1 = await service.embed(text);
      const embedding2 = await service.embed(text);
      
      expect(embedding1).toEqual(embedding2);
      console.log('✅ Embeddings are consistent for same input');
    });

    test('should produce different embeddings for different texts', async () => {
      const text1 = 'mathematical calculations';
      const text2 = 'file system operations';
      
      const embedding1 = await service.embed(text1);
      const embedding2 = await service.embed(text2);
      
      expect(embedding1).not.toEqual(embedding2);
      
      // Calculate similarity to verify they're meaningfully different
      const similarity = cosineSimilarity(embedding1, embedding2);
      console.log(`Similarity between different texts: ${similarity.toFixed(4)}`);
      expect(similarity).toBeLessThan(0.9); // Should be less similar
    });
  });

  describe('Tool Description Embeddings', () => {
    test('should generate embeddings for tool descriptions', async () => {
      const toolDescriptions = [
        'Calculate mathematical expressions and return numerical results',
        'Read file contents from the filesystem and return as string',
        'Parse JSON strings into JavaScript objects with validation',
        'Write text content to files in the filesystem',
        'List files and directories in a given path'
      ];

      const embeddings = [];
      
      for (const desc of toolDescriptions) {
        console.log(`Embedding tool: ${desc.substring(0, 30)}...`);
        const embedding = await service.embed(desc);
        embeddings.push(embedding);
        
        expect(embedding.length).toBe(768);
        expect(embedding.every(val => typeof val === 'number')).toBe(true);
      }

      // Verify all embeddings are different
      for (let i = 0; i < embeddings.length; i++) {
        for (let j = i + 1; j < embeddings.length; j++) {
          expect(embeddings[i]).not.toEqual(embeddings[j]);
        }
      }

      console.log(`✅ Generated ${embeddings.length} unique tool embeddings`);
    });

    test('should show semantic relationships between related tools', async () => {
      const mathTools = [
        'Calculate arithmetic expressions like addition and subtraction',
        'Compute mathematical formulas and equations'
      ];
      
      const fileTools = [
        'Read text files from the filesystem',
        'Write content to files on disk'
      ];

      const mathEmbeddings = await Promise.all(mathTools.map(t => service.embed(t)));
      const fileEmbeddings = await Promise.all(fileTools.map(t => service.embed(t)));

      // Math tools should be more similar to each other than to file tools
      const mathSimilarity = cosineSimilarity(mathEmbeddings[0], mathEmbeddings[1]);
      const crossSimilarity = cosineSimilarity(mathEmbeddings[0], fileEmbeddings[0]);

      console.log(`Math-to-math similarity: ${mathSimilarity.toFixed(4)}`);
      console.log(`Math-to-file similarity: ${crossSimilarity.toFixed(4)}`);

      expect(mathSimilarity).toBeGreaterThan(crossSimilarity);
      expect(mathSimilarity).toBeGreaterThan(0.6); // Should be reasonably similar
    });
  });

  describe('Performance Characteristics', () => {
    test('should generate embeddings within reasonable time', async () => {
      const text = 'Performance test for embedding generation speed';
      
      const startTime = Date.now();
      const embedding = await service.embed(text);
      const endTime = Date.now();
      
      const duration = endTime - startTime;
      console.log(`Embedding generation took ${duration}ms`);
      
      expect(embedding).toBeDefined();
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should handle batch processing efficiently', async () => {
      const texts = Array.from({ length: 10 }, (_, i) => 
        `This is test text number ${i + 1} for batch processing evaluation`
      );

      const startTime = Date.now();
      const embeddings = await Promise.all(texts.map(text => service.embed(text)));
      const endTime = Date.now();

      const duration = endTime - startTime;
      console.log(`Generated ${embeddings.length} embeddings in ${duration}ms`);
      console.log(`Average: ${(duration / embeddings.length).toFixed(1)}ms per embedding`);

      expect(embeddings.length).toBe(10);
      expect(embeddings.every(emb => emb.length === 768)).toBe(true);
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
    });
  });

  describe('Error Handling', () => {
    test('should handle edge cases gracefully', async () => {
      const edgeCases = [
        '',
        ' ',
        '   \n\t   ',
        'Single',
        '😀🎉🔥', // Emojis
        'Text with "quotes" and special chars: @#$%^&*()',
      ];

      for (const text of edgeCases) {
        console.log(`Testing edge case: "${text}"`);
        const embedding = await service.embed(text);
        
        expect(embedding).toBeDefined();
        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBe(768);
        expect(embedding.every(val => typeof val === 'number' && !isNaN(val))).toBe(true);
      }
    });
  });
});

// Helper function for cosine similarity
function cosineSimilarity(a, b) {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}