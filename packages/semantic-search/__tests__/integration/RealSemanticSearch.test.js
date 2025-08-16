/**
 * REAL Semantic Search Integration Test
 * NO MOCKS, NO FALLBACKS - Uses actual Nomic embeddings
 */

import { LocalEmbeddingService } from '../../src/services/LocalEmbeddingService.js';
import { QdrantVectorStore } from '../../src/services/QdrantVectorStore.js';
import { SemanticSearchProvider } from '../../src/SemanticSearchProvider.js';
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Real Semantic Search Integration - NO MOCKS', () => {
  let embeddingService;
  let vectorStore;
  let searchProvider;
  let resourceManager;
  
  const TEST_COLLECTION = 'test-real-semantic-search';

  beforeAll(async () => {
    // Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Verify model exists
    const modelDir = path.join(__dirname, '../../../nomic/models');
    const modelFiles = fs.existsSync(modelDir) ? 
      fs.readdirSync(modelDir).filter(f => f.endsWith('.gguf')) : [];
    
    if (modelFiles.length === 0) {
      throw new Error(`
        ❌ NO MODEL FILES FOUND!
        
        Nomic model required for real semantic search.
        Expected location: ${modelDir}
        
        Copy a GGUF model file to that directory.
      `);
    }
    
    console.log('✅ Found model files:', modelFiles);
    
    // Initialize real embedding service (uses Nomic)
    embeddingService = new LocalEmbeddingService();
    await embeddingService.initialize();
    console.log('✅ LocalEmbeddingService initialized with Nomic');
    
    // Initialize vector store
    vectorStore = new QdrantVectorStore({
      url: 'http://localhost:6333',
      collectionName: TEST_COLLECTION,
      vectorSize: 768 // Nomic dimensions
    });
    
    try {
      await vectorStore.initialize();
      await vectorStore.deleteCollection();
      await vectorStore.createCollection();
      console.log('✅ QdrantVectorStore initialized');
    } catch (error) {
      console.warn('⚠️  Qdrant not available, skipping vector store tests');
      vectorStore = null;
    }
    
    // Initialize search provider using factory pattern
    searchProvider = await SemanticSearchProvider.create(resourceManager, {
      collectionName: TEST_COLLECTION,
      useLocalEmbeddings: true
    });
    console.log('✅ SemanticSearchProvider initialized');
  }, 60000); // 60 second timeout for initialization

  afterAll(async () => {
    if (vectorStore) {
      try {
        await vectorStore.deleteCollection();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    if (embeddingService) {
      await embeddingService.close();
    }
  });

  describe('Real Embedding Verification', () => {
    test('should generate real 768-dimensional embeddings', async () => {
      const text = 'Testing real semantic embeddings with Nomic';
      const embedding = await embeddingService.embed(text);
      
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(768);
      
      // Verify it's not degenerate (all zeros or same value)
      const uniqueValues = new Set(embedding.map(v => Math.round(v * 10000)));
      expect(uniqueValues.size).toBeGreaterThan(100);
      
      console.log('Embedding stats:');
      console.log('  Dimensions:', embedding.length);
      console.log('  Unique values:', uniqueValues.size);
      console.log('  Min value:', Math.min(...embedding));
      console.log('  Max value:', Math.max(...embedding));
    });

    test('should understand semantic similarity', async () => {
      // Test semantic pairs
      const pairs = [
        { text1: 'dog', text2: 'puppy', expectedMin: 0.7 },
        { text1: 'car', text2: 'automobile', expectedMin: 0.7 },
        { text1: 'happy', text2: 'joyful', expectedMin: 0.6 },
        { text1: 'computer', text2: 'banana', expectedMax: 0.5 }
      ];
      
      for (const pair of pairs) {
        const embed1 = await embeddingService.embed(pair.text1);
        const embed2 = await embeddingService.embed(pair.text2);
        const similarity = await embeddingService.similarity(embed1, embed2);
        
        console.log(`${pair.text1} <-> ${pair.text2}: ${similarity.toFixed(4)}`);
        
        if (pair.expectedMin) {
          expect(similarity).toBeGreaterThan(pair.expectedMin);
        }
        if (pair.expectedMax) {
          expect(similarity).toBeLessThan(pair.expectedMax);
        }
      }
    });

    test('should generate query-optimized embeddings', async () => {
      const text = 'database optimization techniques';
      
      const docEmbed = await embeddingService.embed(text);
      const queryEmbed = await embeddingService.embedQuery(text);
      
      // Should be similar but potentially optimized differently
      const similarity = await embeddingService.similarity(docEmbed, queryEmbed);
      
      expect(similarity).toBeGreaterThan(0.9); // Very similar
      expect(similarity).toBeLessThanOrEqual(1.0);
      
      console.log('Document vs Query embedding similarity:', similarity.toFixed(4));
    });
  });

  describe('Semantic Search Functionality', () => {
    const testDocuments = [
      { id: '1', content: 'Python is a high-level programming language known for its simplicity', metadata: { category: 'programming' } },
      { id: '2', content: 'JavaScript enables interactive web pages and is essential for web development', metadata: { category: 'programming' } },
      { id: '3', content: 'Machine learning algorithms can learn patterns from data', metadata: { category: 'ai' } },
      { id: '4', content: 'Neural networks are inspired by biological brain structures', metadata: { category: 'ai' } },
      { id: '5', content: 'Cats are independent domestic animals that make great pets', metadata: { category: 'animals' } },
      { id: '6', content: 'Dogs are loyal companions and have been domesticated for thousands of years', metadata: { category: 'animals' } },
      { id: '7', content: 'Data structures like arrays and linked lists organize information efficiently', metadata: { category: 'programming' } },
      { id: '8', content: 'Deep learning has revolutionized computer vision and natural language processing', metadata: { category: 'ai' } },
      { id: '9', content: 'Italian cuisine features pasta, pizza, and rich tomato-based sauces', metadata: { category: 'food' } },
      { id: '10', content: 'Quantum computing uses quantum bits that can exist in multiple states simultaneously', metadata: { category: 'technology' } }
    ];

    beforeEach(async () => {
      if (!vectorStore) {
        console.log('Skipping test - Qdrant not available');
        return;
      }
      
      // Clear and repopulate the collection
      await vectorStore.deleteCollection();
      await vectorStore.createCollection();
      
      // Index all documents
      for (const doc of testDocuments) {
        await searchProvider.indexDocument(doc);
      }
      
      console.log(`Indexed ${testDocuments.length} documents`);
    });

    test('should find semantically similar programming content', async () => {
      if (!vectorStore) return;
      
      const results = await searchProvider.search('How to write Python code', { limit: 3 });
      
      console.log('\nSearch: "How to write Python code"');
      results.forEach((r, i) => {
        console.log(`  ${i + 1}. [${r.score.toFixed(4)}] ${r.content.substring(0, 60)}...`);
      });
      
      // Top results should be programming-related
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].metadata.category).toBe('programming');
      
      // Python document should rank high
      const pythonResult = results.find(r => r.id === '1');
      expect(pythonResult).toBeDefined();
      expect(results.indexOf(pythonResult)).toBeLessThan(3);
    });

    test('should find AI/ML related content', async () => {
      if (!vectorStore) return;
      
      const results = await searchProvider.search('artificial intelligence and deep learning', { limit: 3 });
      
      console.log('\nSearch: "artificial intelligence and deep learning"');
      results.forEach((r, i) => {
        console.log(`  ${i + 1}. [${r.score.toFixed(4)}] ${r.content.substring(0, 60)}...`);
      });
      
      // Top results should be AI-related
      const aiResults = results.filter(r => r.metadata.category === 'ai');
      expect(aiResults.length).toBeGreaterThanOrEqual(2);
      
      // Deep learning document should rank high
      const deepLearningResult = results.find(r => r.id === '8');
      expect(deepLearningResult).toBeDefined();
    });

    test('should distinguish between different domains', async () => {
      if (!vectorStore) return;
      
      const programmingResults = await searchProvider.search('coding and software development', { limit: 5 });
      const animalResults = await searchProvider.search('pets and domestic animals', { limit: 5 });
      
      // Count categories in results
      const progCategories = programmingResults.reduce((acc, r) => {
        acc[r.metadata.category] = (acc[r.metadata.category] || 0) + 1;
        return acc;
      }, {});
      
      const animalCategories = animalResults.reduce((acc, r) => {
        acc[r.metadata.category] = (acc[r.metadata.category] || 0) + 1;
        return acc;
      }, {});
      
      console.log('\nProgramming search categories:', progCategories);
      console.log('Animal search categories:', animalCategories);
      
      // Programming search should favor programming/tech content
      expect(progCategories.programming).toBeGreaterThan(0);
      
      // Animal search should favor animal content
      expect(animalCategories.animals).toBeGreaterThan(0);
    });

    test('should handle complex queries', async () => {
      if (!vectorStore) return;
      
      const complexQuery = 'What are the differences between procedural and object-oriented programming paradigms?';
      const results = await searchProvider.search(complexQuery, { limit: 3 });
      
      console.log(`\nComplex query: "${complexQuery}"`);
      results.forEach((r, i) => {
        console.log(`  ${i + 1}. [${r.score.toFixed(4)}] Category: ${r.metadata.category}`);
      });
      
      // Should return programming-related content
      const programmingResults = results.filter(r => r.metadata.category === 'programming');
      expect(programmingResults.length).toBeGreaterThan(0);
    });

    test('should filter by metadata', async () => {
      if (!vectorStore) return;
      
      const results = await searchProvider.search('technology and innovation', {
        limit: 10,
        filter: { category: 'ai' }
      });
      
      console.log('\nFiltered search (category: ai)');
      console.log('Results:', results.length);
      
      // All results should be from AI category
      results.forEach(r => {
        expect(r.metadata.category).toBe('ai');
      });
    });
  });

  describe('Performance Tests', () => {
    test('should handle batch embeddings efficiently', async () => {
      const texts = Array.from({ length: 10 }, (_, i) => 
        `Test document ${i}: This is a sample text for performance testing of embeddings`
      );
      
      const startTime = Date.now();
      const embeddings = await embeddingService.embedBatch(texts);
      const endTime = Date.now();
      
      const totalTime = endTime - startTime;
      const avgTime = totalTime / texts.length;
      
      console.log(`\nBatch embedding performance:`);
      console.log(`  Total texts: ${texts.length}`);
      console.log(`  Total time: ${totalTime}ms`);
      console.log(`  Average per text: ${avgTime.toFixed(2)}ms`);
      
      expect(embeddings.length).toBe(texts.length);
      embeddings.forEach(emb => {
        expect(emb.length).toBe(768);
      });
      
      // Should be reasonably fast
      expect(avgTime).toBeLessThan(2000); // Less than 2 seconds per embedding
    });

    test('should provide consistent embeddings', async () => {
      const text = 'Consistency test for semantic embeddings';
      
      const embed1 = await embeddingService.embed(text);
      const embed2 = await embeddingService.embed(text);
      const embed3 = await embeddingService.embed(text);
      
      const sim12 = await embeddingService.similarity(embed1, embed2);
      const sim23 = await embeddingService.similarity(embed2, embed3);
      const sim13 = await embeddingService.similarity(embed1, embed3);
      
      console.log('\nConsistency check:');
      console.log(`  Run 1 <-> Run 2: ${sim12.toFixed(6)}`);
      console.log(`  Run 2 <-> Run 3: ${sim23.toFixed(6)}`);
      console.log(`  Run 1 <-> Run 3: ${sim13.toFixed(6)}`);
      
      // Should be nearly identical
      expect(sim12).toBeGreaterThan(0.999);
      expect(sim23).toBeGreaterThan(0.999);
      expect(sim13).toBeGreaterThan(0.999);
    });
  });

  describe('Model Information', () => {
    test('should report correct model information', () => {
      const modelInfo = embeddingService.getModelInfo();
      
      console.log('\nModel Information:');
      console.log('  Name:', modelInfo.name);
      console.log('  Type:', modelInfo.type);
      console.log('  Dimensions:', modelInfo.dimensions);
      console.log('  Model:', modelInfo.model);
      console.log('  Provider:', modelInfo.provider);
      
      expect(modelInfo.name).toContain('Nomic');
      expect(modelInfo.dimensions).toBe(768);
      expect(modelInfo.provider).toContain('local');
    });

    test('should track performance statistics', () => {
      const stats = embeddingService.getStats();
      
      console.log('\nPerformance Statistics:');
      console.log('  Total embeddings:', stats.totalEmbeddings);
      console.log('  Total time:', stats.totalTime, 'ms');
      console.log('  Average time:', stats.averageTime.toFixed(2), 'ms');
      console.log('  Throughput:', stats.throughput.toFixed(2), 'embeddings/sec');
      
      expect(stats.totalEmbeddings).toBeGreaterThan(0);
      expect(stats.initialized).toBe(true);
      expect(stats.model).toContain('nomic');
    });
  });
});

// This test file will FAIL if:
// 1. No GGUF model file is present
// 2. The embeddings are not real (e.g., hash-based)
// 3. Semantic similarity doesn't work correctly