/**
 * Test for Nomic Embedding Integration
 * Tests the complete Nomic embedding pipeline for tool indexing and search
 */

import { LocalEmbeddingService } from '../../../semantic-search/src/services/LocalEmbeddingService.js';
import { QdrantVectorStore } from '../../../semantic-search/src/services/QdrantVectorStore.js';
import { SemanticSearchProvider } from '../../../semantic-search/src/SemanticSearchProvider.js';

describe('Nomic Embedding Integration', () => {
  let embeddingService;
  let vectorStore;
  let semanticSearch;
  let resourceManager;

  beforeAll(async () => {
    // Initialize ResourceManager
    const { ResourceManager } = await import('@legion/core');
    resourceManager = ResourceManager.getInstance();
    if (!resourceManager.initialized) {
      await resourceManager.initialize();
    }

    // Create semantic search provider using factory method
    semanticSearch = await SemanticSearchProvider.create(resourceManager, {
      collectionName: 'test_tools_nomic'
    });
    
    // Get the embedding service and vector store from the provider
    embeddingService = semanticSearch.embeddingService;
    vectorStore = semanticSearch.vectorStore;
  });

  afterAll(async () => {
    if (vectorStore) {
      try {
        await vectorStore.deleteCollection('test_tools_nomic');
      } catch (error) {
        // Collection might not exist
      }
      await vectorStore.disconnect();
    }
    if (embeddingService) {
      await embeddingService.cleanup();
    }
  });

  describe('Nomic Embedding Generation', () => {
    test('should generate 768-dimensional embeddings', async () => {
      const text = 'Calculate mathematical expressions and return results';
      const embedding = await embeddingService.embed(text);
      
      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(768);
      expect(embedding.every(val => typeof val === 'number')).toBe(true);
    });

    test('should generate consistent embeddings for same text', async () => {
      const text = 'Read files from the filesystem';
      const embedding1 = await embeddingService.embed(text);
      const embedding2 = await embeddingService.embed(text);
      
      expect(embedding1).toEqual(embedding2);
    });

    test('should generate different embeddings for different text', async () => {
      const text1 = 'Calculate mathematical expressions';
      const text2 = 'Read files from disk';
      
      const embedding1 = await embeddingService.embed(text1);
      const embedding2 = await embeddingService.embed(text2);
      
      expect(embedding1).not.toEqual(embedding2);
    });
  });

  describe('Vector Storage Integration', () => {
    test('should index tool descriptions', async () => {
      const tools = [
        {
          id: 'calc_1',
          name: 'calculator',
          description: 'Evaluate mathematical expressions like 2+2 or sqrt(16)',
          metadata: { module: 'calculator', type: 'math' }
        },
        {
          id: 'file_1', 
          name: 'file_read',
          description: 'Read contents of files from the filesystem',
          metadata: { module: 'file', type: 'io' }
        }
      ];

      // Index tools using insert method
      await semanticSearch.insert('test_tools_nomic', tools);

      // Verify indexing
      const count = await semanticSearch.count('test_tools_nomic');
      expect(count).toBe(2);
    });

    test('should find relevant tools through semantic search', async () => {
      // Index tools first
      const tools = [
        {
          id: 'calc_1',
          name: 'calculator',
          description: 'Evaluate mathematical expressions and arithmetic operations',
          metadata: { module: 'calculator' }
        },
        {
          id: 'file_1',
          name: 'file_read', 
          description: 'Read and retrieve contents of files from storage',
          metadata: { module: 'file' }
        },
        {
          id: 'json_1',
          name: 'json_parse',
          description: 'Parse and validate JSON string data',
          metadata: { module: 'json' }
        }
      ];

      // Index tools using insert method
      await semanticSearch.insert('test_tools_nomic', tools);

      // Search for math-related tools
      const mathResults = await semanticSearch.semanticSearch('test_tools_nomic', 'arithmetic calculations', { limit: 2 });
      expect(mathResults.length).toBeGreaterThan(0);
      expect(mathResults[0].metadata.module).toBe('calculator');

      // Search for file-related tools
      const fileResults = await semanticSearch.semanticSearch('test_tools_nomic', 'read file contents', { limit: 2 });
      expect(fileResults.length).toBeGreaterThan(0);
      expect(fileResults[0].metadata.module).toBe('file');
    });
  });

  describe('Performance and Quality', () => {
    test('should generate embeddings efficiently', async () => {
      const texts = [
        'Calculate square root of numbers',
        'Read text files from disk',
        'Parse JSON data structures',
        'Write content to files',
        'List directory contents'
      ];

      const startTime = Date.now();
      const embeddings = await Promise.all(
        texts.map(text => embeddingService.embed(text))
      );
      const endTime = Date.now();

      expect(embeddings.length).toBe(5);
      expect(embeddings.every(emb => emb.length === 768)).toBe(true);
      
      // Should complete in reasonable time (less than 10 seconds for 5 embeddings)
      const duration = endTime - startTime;
      console.log(`Generated ${embeddings.length} embeddings in ${duration}ms`);
      expect(duration).toBeLessThan(10000);
    });

    test('should produce semantically meaningful similarity scores', async () => {
      // Similar concepts should have higher similarity
      const mathText1 = 'Calculate arithmetic expressions';
      const mathText2 = 'Evaluate mathematical formulas';
      const fileText = 'Read files from filesystem';

      const embedding1 = await embeddingService.embed(mathText1);
      const embedding2 = await embeddingService.embed(mathText2);
      const embedding3 = await embeddingService.embed(fileText);

      // Calculate cosine similarity
      const similarity12 = cosineSimilarity(embedding1, embedding2);
      const similarity13 = cosineSimilarity(embedding1, embedding3);

      // Math-related texts should be more similar than math vs file
      expect(similarity12).toBeGreaterThan(similarity13);
      expect(similarity12).toBeGreaterThan(0.5); // Should be reasonably similar
    });
  });

  describe('Error Handling', () => {
    test('should handle empty text gracefully', async () => {
      const embedding = await embeddingService.embed('');
      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(768);
      expect(embedding.every(val => typeof val === 'number')).toBe(true);
    });

    test('should handle very long text', async () => {
      const longText = 'Calculate mathematical expressions '.repeat(100);
      const embedding = await embeddingService.embed(longText);
      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(768);
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