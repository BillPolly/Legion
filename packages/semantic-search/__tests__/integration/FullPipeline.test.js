/**
 * FULL PIPELINE END-TO-END TEST
 * 
 * Tests the complete semantic search pipeline from document indexing 
 * to search and retrieval using real Nomic embeddings.
 */

import { LocalEmbeddingService } from '../../src/services/LocalEmbeddingService.js';
import { DocumentProcessor } from '../../src/utils/DocumentProcessor.js';
import { EmbeddingCache } from '../../src/utils/EmbeddingCache.js';

describe('Full Semantic Search Pipeline - End-to-End', () => {
  let embeddingService;
  let documentProcessor;
  let cache;
  let documentIndex;

  beforeAll(async () => {
    embeddingService = new LocalEmbeddingService();
    await embeddingService.initialize();
    
    documentProcessor = new DocumentProcessor();
    cache = new EmbeddingCache({ ttl: 3600 });
    
    // Simple in-memory document index
    documentIndex = new Map();
    
    console.log('✅ Full pipeline test initialized');
  }, 60000);

  afterAll(async () => {
    if (embeddingService) {
      await embeddingService.cleanup();
    }
  });

  describe('Document Indexing Pipeline', () => {
    const testDocuments = [
      {
        id: 'react-guide',
        title: 'React Development Guide',
        content: 'Complete guide to building React applications with hooks, context, and state management using Redux',
        category: 'frontend',
        tags: ['react', 'javascript', 'frontend', 'ui']
      },
      {
        id: 'node-api',
        title: 'Node.js API Development',
        content: 'Building RESTful APIs with Express.js, middleware, authentication, and database integration',
        category: 'backend',
        tags: ['nodejs', 'express', 'api', 'backend']
      },
      {
        id: 'docker-deployment',
        title: 'Docker Deployment Strategy',
        content: 'Containerizing applications with Docker, orchestration with Kubernetes, and CI/CD pipelines',
        category: 'devops',
        tags: ['docker', 'kubernetes', 'deployment', 'devops']
      },
      {
        id: 'testing-guide',
        title: 'Testing Best Practices',
        content: 'Unit testing, integration testing, and end-to-end testing with Jest, Cypress, and testing strategies',
        category: 'testing',
        tags: ['testing', 'jest', 'cypress', 'quality']
      },
      {
        id: 'database-design',
        title: 'Database Schema Design',
        content: 'PostgreSQL database design, normalization, indexing strategies, and query optimization techniques',
        category: 'database',
        tags: ['postgresql', 'database', 'sql', 'optimization']
      }
    ];

    test('should index documents with embeddings', async () => {
      console.log('🔄 Starting document indexing...');
      
      for (const doc of testDocuments) {
        // Process document
        const processed = documentProcessor.processDocument(doc);
        
        // Generate embedding
        const embedding = await embeddingService.embed(processed.searchText);
        
        // Store in index
        documentIndex.set(doc.id, {
          ...processed,
          embedding: embedding
        });
        
        console.log(`  ✅ Indexed: ${doc.title} (${embedding.length}D)`);
      }
      
      expect(documentIndex.size).toBe(testDocuments.length);
      console.log(`📚 Successfully indexed ${documentIndex.size} documents`);
    });

    test('should validate all embeddings are properly generated', async () => {
      for (const [id, indexedDoc] of documentIndex) {
        expect(indexedDoc.embedding).toBeDefined();
        expect(indexedDoc.embedding).toHaveLength(768);
        expect(indexedDoc.embedding.every(v => typeof v === 'number')).toBe(true);
        
        // Check embedding magnitude is reasonable
        const magnitude = Math.sqrt(indexedDoc.embedding.reduce((sum, v) => sum + v * v, 0));
        expect(magnitude).toBeGreaterThan(0);
      }
      
      console.log('✅ All embeddings validated successfully');
    });
  });

  describe('Semantic Search Pipeline', () => {
    const searchQueries = [
      {
        query: 'React component development',
        expectedCategory: 'frontend',
        expectedDocId: 'react-guide'
      },
      {
        query: 'REST API building',
        expectedCategory: 'backend', 
        expectedDocId: 'node-api'
      },
      {
        query: 'container deployment',
        expectedCategory: 'devops',
        expectedDocId: 'docker-deployment'
      },
      {
        query: 'unit testing framework',
        expectedCategory: 'testing',
        expectedDocId: 'testing-guide'
      },
      {
        query: 'SQL query performance',
        expectedCategory: 'database',
        expectedDocId: 'database-design'
      }
    ];

    test('should perform semantic search and return relevant results', async () => {
      console.log('🔍 Testing semantic search pipeline...');
      
      for (const { query, expectedCategory, expectedDocId } of searchQueries) {
        // Generate query embedding
        const queryEmbedding = await embeddingService.embed(query);
        
        // Search through index
        const searchResults = [];
        for (const [docId, indexedDoc] of documentIndex) {
          const similarity = await embeddingService.similarity(queryEmbedding, indexedDoc.embedding);
          searchResults.push({
            docId,
            document: indexedDoc,
            similarity
          });
        }
        
        // Sort by similarity
        searchResults.sort((a, b) => b.similarity - a.similarity);
        
        const topResult = searchResults[0];
        console.log(`  Query: "${query}"`);
        console.log(`    Top result: ${topResult.document.title} (${topResult.similarity.toFixed(4)})`);
        console.log(`    Expected: ${expectedDocId}, Got: ${topResult.docId}`);
        
        // Validate search quality
        expect(topResult.docId).toBe(expectedDocId);
        expect(topResult.document.category).toBe(expectedCategory);
        expect(topResult.similarity).toBeGreaterThan(0.5); // Good relevance
        
        // Validate ranking quality
        const secondResult = searchResults[1];
        expect(topResult.similarity).toBeGreaterThan(secondResult.similarity);
      }
      
      console.log('✅ All semantic searches returned correct results');
    });

    test('should perform batch search for multiple queries', async () => {
      const queries = searchQueries.map(q => q.query);
      const queryEmbeddings = await embeddingService.embedBatch(queries);
      
      expect(queryEmbeddings).toHaveLength(queries.length);
      
      const batchResults = [];
      for (let i = 0; i < queryEmbeddings.length; i++) {
        const results = [];
        for (const [docId, indexedDoc] of documentIndex) {
          const similarity = await embeddingService.similarity(queryEmbeddings[i], indexedDoc.embedding);
          results.push({ docId, similarity });
        }
        results.sort((a, b) => b.similarity - a.similarity);
        batchResults.push(results[0]);
      }
      
      // Validate batch results match individual results
      for (let i = 0; i < searchQueries.length; i++) {
        expect(batchResults[i].docId).toBe(searchQueries[i].expectedDocId);
      }
      
      console.log('✅ Batch search completed successfully');
    });
  });

  describe('Advanced Search Features', () => {
    test('should handle complex multi-term queries', async () => {
      const complexQueries = [
        'React hooks and state management',
        'Express middleware and authentication',
        'Docker containers and Kubernetes orchestration',
        'Jest testing and code coverage',
        'PostgreSQL indexing and performance'
      ];
      
      for (const query of complexQueries) {
        const queryEmbedding = await embeddingService.embed(query);
        
        const results = [];
        for (const [docId, indexedDoc] of documentIndex) {
          const similarity = await embeddingService.similarity(queryEmbedding, indexedDoc.embedding);
          results.push({ docId, document: indexedDoc, similarity });
        }
        results.sort((a, b) => b.similarity - a.similarity);
        
        const topResult = results[0];
        console.log(`Complex query: "${query}" → ${topResult.document.title} (${topResult.similarity.toFixed(4)})`);
        
        expect(topResult.similarity).toBeGreaterThan(0.4);
        expect(results[0].similarity).toBeGreaterThan(results[1].similarity);
      }
    });

    test('should rank results by relevance quality', async () => {
      const testQuery = 'building web applications';
      const queryEmbedding = await embeddingService.embed(testQuery);
      
      const results = [];
      for (const [docId, indexedDoc] of documentIndex) {
        const similarity = await embeddingService.similarity(queryEmbedding, indexedDoc.embedding);
        results.push({ 
          docId, 
          title: indexedDoc.title,
          category: indexedDoc.category,
          similarity 
        });
      }
      results.sort((a, b) => b.similarity - a.similarity);
      
      console.log('Relevance ranking for "building web applications":');
      results.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.title} (${result.category}) - ${result.similarity.toFixed(4)}`);
      });
      
      // Frontend and backend should rank higher than devops/testing/database for web app query
      const frontendBackendIndices = results
        .map((r, i) => ({ ...r, index: i }))
        .filter(r => ['frontend', 'backend'].includes(r.category))
        .map(r => r.index);
      
      expect(frontendBackendIndices.some(i => i < 2)).toBe(true); // At least one in top 2
    });
  });

  describe('Performance and Scalability', () => {
    test('should maintain performance with larger document sets', async () => {
      // Generate additional test documents
      const additionalDocs = Array.from({ length: 10 }, (_, i) => ({
        id: `doc-${i}`,
        title: `Document ${i}`,
        content: `This is document ${i} about ${['programming', 'design', 'testing', 'deployment', 'database'][i % 5]} topics`,
        category: 'test'
      }));
      
      const startTime = Date.now();
      
      // Process and index additional documents
      for (const doc of additionalDocs) {
        const processed = documentProcessor.processDocument(doc);
        const embedding = await embeddingService.embed(processed.searchText);
        documentIndex.set(doc.id, { ...processed, embedding });
      }
      
      const indexingTime = Date.now() - startTime;
      
      // Perform search on larger index
      const searchStartTime = Date.now();
      const queryEmbedding = await embeddingService.embed('programming topics');
      
      const results = [];
      for (const [docId, indexedDoc] of documentIndex) {
        const similarity = await embeddingService.similarity(queryEmbedding, indexedDoc.embedding);
        results.push({ docId, similarity });
      }
      results.sort((a, b) => b.similarity - a.similarity);
      
      const searchTime = Date.now() - searchStartTime;
      
      console.log(`📊 Performance with ${documentIndex.size} documents:`);
      console.log(`  Indexing time: ${indexingTime}ms for ${additionalDocs.length} docs`);
      console.log(`  Search time: ${searchTime}ms across ${documentIndex.size} docs`);
      console.log(`  Top result similarity: ${results[0].similarity.toFixed(4)}`);
      
      expect(documentIndex.size).toBe(15); // 5 original + 10 additional
      expect(indexingTime).toBeLessThan(5000); // Reasonable indexing time
      expect(searchTime).toBeLessThan(1000); // Fast search
    });

    test('should provide consistent results across multiple runs', async () => {
      const testQuery = 'React development';
      const runs = 3;
      const results = [];
      
      for (let i = 0; i < runs; i++) {
        const queryEmbedding = await embeddingService.embed(testQuery);
        const searchResults = [];
        
        for (const [docId, indexedDoc] of documentIndex) {
          const similarity = await embeddingService.similarity(queryEmbedding, indexedDoc.embedding);
          searchResults.push({ docId, similarity });
        }
        searchResults.sort((a, b) => b.similarity - a.similarity);
        results.push(searchResults[0]);
      }
      
      // All runs should return the same top result
      const firstResult = results[0];
      for (let i = 1; i < runs; i++) {
        expect(results[i].docId).toBe(firstResult.docId);
        expect(results[i].similarity).toBeCloseTo(firstResult.similarity, 10);
      }
      
      console.log(`✅ Consistent results across ${runs} runs: ${firstResult.docId} (${firstResult.similarity.toFixed(4)})`);
    });
  });
});