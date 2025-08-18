/**
 * Complete Semantic Search Integration Test with Nomic
 * Tests the full semantic search workflow with real Nomic embeddings
 */

import { jest } from '@jest/globals';
import { SemanticSearchProvider } from '../../src/SemanticSearchProvider.js';
import { LocalEmbeddingService } from '../../src/services/LocalEmbeddingService.js';
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Complete Semantic Search with Nomic', () => {
  let semanticProvider;
  let resourceManager;
  let isNomicAvailable = false;

  beforeAll(async () => {
    // Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Test if Nomic model is available
    try {
      const modelDir = path.join(__dirname, '../../../nomic/models');
      const modelFiles = fs.existsSync(modelDir) ? 
        fs.readdirSync(modelDir).filter(f => f.endsWith('.gguf')) : [];
      
      if (modelFiles.length > 0) {
        isNomicAvailable = true;
        console.log('✅ Nomic model available for semantic search tests');
      } else {
        console.log('⚠️ Nomic model not available, testing error handling');
      }
    } catch (error) {
      console.log('⚠️ Error checking Nomic availability:', error.message);
    }
  });

  afterAll(async () => {
    if (semanticProvider) {
      await semanticProvider.disconnect();
    }
  });

  describe('SemanticSearchProvider with Nomic', () => {
    test('should create SemanticSearchProvider with Nomic', async () => {
      if (isNomicAvailable) {
        try {
          semanticProvider = await SemanticSearchProvider.create(resourceManager, {
            collectionName: 'test-semantic-complete'
          });
          
          expect(semanticProvider).toBeDefined();
          expect(semanticProvider.useLocalEmbeddings).toBe(true);
          expect(semanticProvider.embeddingDimensions).toBe(768);
          
          const metadata = semanticProvider.getMetadata();
          expect(metadata.embeddingService).toBe('local-nomic');
          expect(metadata.embeddingDimensions).toBe(768);
          
          console.log('✅ SemanticSearchProvider created with Nomic embeddings');
        } catch (error) {
          console.error('Failed to create SemanticSearchProvider:', error.message);
          throw error;
        }
      } else {
        console.log('Skipping: Nomic model not available');
      }
    });

    test('should validate ResourceManager initialization', async () => {
      const uninitializedRM = new ResourceManager();
      // Don't initialize it - set initialized flag to false explicitly
      uninitializedRM.initialized = false;
      
      try {
        await SemanticSearchProvider.create(uninitializedRM);
        fail('Should have thrown an error for uninitialized ResourceManager');
      } catch (error) {
        expect(error.message).toMatch(/initialized ResourceManager/);
        console.log('✅ Correctly validates ResourceManager initialization');
      }
    });
  });

  describe('LocalEmbeddingService Nomic Integration', () => {
    test('should create LocalEmbeddingService correctly', () => {
      const service = new LocalEmbeddingService();

      expect(service).toBeDefined();
      expect(service.dimensions).toBe(768);
      expect(service.initialized).toBe(false);
    });

    test('should initialize with Nomic model if available', async () => {
      if (!isNomicAvailable) {
        console.log('Skipping: Nomic model not available');
        return;
      }

      const service = new LocalEmbeddingService();
      await service.initialize();
      
      expect(service.initialized).toBe(true);
      
      const info = service.getModelInfo();
      expect(info.name).toContain('Nomic');
      expect(info.dimensions).toBe(768);
      expect(info.provider).toContain('local');
    });

    test('should provide correct model metadata', () => {
      const service = new LocalEmbeddingService();
      const info = service.getModelInfo();
      
      expect(info.type).toBe('transformer');
      expect(info.dimensions).toBe(768);
      expect(info.name).toContain('Nomic');
      expect(info.model).toBe('nomic-embed-text-v1.5');
    });
  });

  describe('Real Nomic Embedding Generation', () => {
    test('should generate real embeddings with Nomic model', async () => {
      if (!isNomicAvailable) {
        console.log('Skipping: Nomic model not available');
        return;
      }

      console.log('🧪 Testing real Nomic embedding generation...');

      const service = new LocalEmbeddingService();
      await service.initialize();

      const testTexts = [
        'list directory contents',
        'parse json data', 
        'calculate mathematical operations',
        'read file from disk'
      ];

      const embeddings = await service.embedBatch(testTexts);
      
      expect(embeddings).toHaveLength(testTexts.length);
      
      embeddings.forEach((embedding, index) => {
        expect(embedding).toHaveLength(768);
        expect(embedding.every(v => !isNaN(v))).toBe(true);
        
        // Check if it's not a zero vector
        const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
        expect(magnitude).toBeGreaterThan(0.1);
        
        console.log(`✅ Embedding ${index + 1}: ${testTexts[index]} (magnitude: ${magnitude.toFixed(6)})`);
      });

      // Test cosine similarity calculation
      const similarity = await service.similarity(embeddings[0], embeddings[1]);
      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
      console.log(`✅ Cosine similarity: ${similarity.toFixed(4)}`);

      await service.cleanup();
      console.log('🎉 Real Nomic embedding workflow test passed!');
    });

    test('should demonstrate real semantic similarity ranking', async () => {
      if (!isNomicAvailable) {
        console.log('Skipping: Nomic model not available');
        return;
      }

      const service = new LocalEmbeddingService();
      await service.initialize();

      // Real tool descriptions
      const toolDescriptions = [
        { name: 'directory_list', description: 'List contents of a directory' },
        { name: 'file_read', description: 'Read the contents of a file from disk' },
        { name: 'json_parse', description: 'Parse JSON string into JavaScript object' },
        { name: 'calculator', description: 'Performs mathematical calculations' }
      ];

      const queryText = 'show files in folder';

      // Generate real embeddings using Nomic
      const descriptions = toolDescriptions.map(tool => tool.description);
      const toolEmbeddings = await service.embedBatch(descriptions);
      const queryEmbedding = await service.embed(queryText);

      // Calculate similarities using real embeddings
      const similarities = await Promise.all(toolEmbeddings.map(async (toolEmb, index) => ({
        tool: toolDescriptions[index],
        similarity: await service.similarity(queryEmbedding, toolEmb)
      })));

      // Sort by similarity
      similarities.sort((a, b) => b.similarity - a.similarity);

      console.log('🧪 Real semantic similarity ranking:');
      similarities.forEach((item, index) => {
        console.log(`${index + 1}. ${item.tool.name}: ${item.similarity.toFixed(4)}`);
      });

      // Should have calculated similarities for all tools
      expect(similarities).toHaveLength(4);
      expect(similarities.every(item => typeof item.similarity === 'number')).toBe(true);
      expect(similarities.every(item => item.similarity >= -1 && item.similarity <= 1)).toBe(true);
      
      // Directory listing should be most similar to "show files in folder"
      expect(similarities[0].tool.name).toBe('directory_list');
      
      await service.cleanup();
      console.log('✅ Real semantic ranking working correctly');
    });
  });
});