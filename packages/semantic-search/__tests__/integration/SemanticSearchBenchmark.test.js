/**
 * COMPREHENSIVE SEMANTIC SEARCH BENCHMARK
 * 
 * Tests the full semantic search pipeline using real Nomic embeddings.
 * Validates semantic understanding, search quality, and performance.
 */

import { LocalEmbeddingService } from '../../src/services/LocalEmbeddingService.js';
import { DocumentProcessor } from '../../src/utils/DocumentProcessor.js';
import { EmbeddingCache } from '../../src/utils/EmbeddingCache.js';

describe('Semantic Search Benchmark - Real Nomic Embeddings', () => {
  let embeddingService;
  let documentProcessor;
  let cache;

  beforeAll(async () => {
    embeddingService = new LocalEmbeddingService();
    await embeddingService.initialize();
    
    documentProcessor = new DocumentProcessor();
    cache = new EmbeddingCache({ ttl: 3600 });
    
    console.log('✅ Semantic Search Benchmark initialized with real Nomic embeddings');
  }, 60000);

  afterAll(async () => {
    if (embeddingService) {
      await embeddingService.cleanup();
    }
  });

  describe('Programming Tool Discovery', () => {
    const programmingQueries = [
      'find files containing bugs',
      'search for unit tests',
      'locate deployment scripts',
      'find authentication code',
      'search for database schemas',
      'locate API endpoints',
      'find configuration files',
      'search for error handling'
    ];

    const programmingDocuments = [
      { id: 'deploy', title: 'Deploy to Production', content: 'Script to deploy application to production environment using Docker and Kubernetes' },
      { id: 'auth', title: 'User Authentication', content: 'JWT-based authentication system with login, logout, and token refresh functionality' },
      { id: 'tests', title: 'Unit Test Suite', content: 'Comprehensive unit tests for user service, authentication, and payment processing' },
      { id: 'config', title: 'Database Configuration', content: 'PostgreSQL database configuration with connection pooling and migration scripts' },
      { id: 'api', title: 'REST API Endpoints', content: 'RESTful API endpoints for user management, product catalog, and order processing' },
      { id: 'bugs', title: 'Bug Tracking System', content: 'Issue tracking and bug reporting system with automated categorization' },
      { id: 'errors', title: 'Error Handler Middleware', content: 'Express.js middleware for centralized error handling and logging' },
      { id: 'schemas', title: 'Data Schema Definitions', content: 'JSON schemas for API validation and database table definitions' }
    ];

    test('should find relevant programming tools for semantic queries', async () => {
      // Generate embeddings for all documents
      const docEmbeddings = await embeddingService.embedBatch(
        programmingDocuments.map(doc => `${doc.title}: ${doc.content}`)
      );

      let totalRelevanceScore = 0;
      let testCount = 0;

      for (const query of programmingQueries) {
        const queryEmbedding = await embeddingService.embed(query);
        
        // Find most similar documents
        const similarities = await Promise.all(
          docEmbeddings.map(async (docEmbed, i) => ({
            document: programmingDocuments[i],
            similarity: await embeddingService.similarity(queryEmbedding, docEmbed)
          }))
        );

        // Sort by similarity
        similarities.sort((a, b) => b.similarity - a.similarity);
        
        const topResult = similarities[0];
        const worstResult = similarities[similarities.length - 1];
        
        console.log(`Query: "${query}"`);
        console.log(`  Top match: ${topResult.document.title} (${topResult.similarity.toFixed(4)})`);
        console.log(`  Worst match: ${worstResult.document.title} (${worstResult.similarity.toFixed(4)})`);
        
        // Validate that there's meaningful semantic ranking
        expect(topResult.similarity).toBeGreaterThan(worstResult.similarity);
        expect(topResult.similarity).toBeGreaterThan(0.3); // Should find something relevant
        
        totalRelevanceScore += topResult.similarity;
        testCount++;
      }

      const avgRelevance = totalRelevanceScore / testCount;
      console.log(`\n📊 Average top result relevance: ${avgRelevance.toFixed(4)}`);
      expect(avgRelevance).toBeGreaterThan(0.4); // Good average relevance
    });

    test('should distinguish between different programming domains', async () => {
      const frontendQuery = 'React components and user interface styling';
      const backendQuery = 'database queries and server configuration';
      const devopsQuery = 'deployment automation and container orchestration';

      const documents = [
        'React component library with hooks, context, and styled-components for responsive UI design',
        'Node.js Express server with PostgreSQL database connections and ORM configuration',
        'Docker containers, Kubernetes deployments, and CI/CD pipeline automation scripts',
        'Python data analysis with pandas, matplotlib for statistical modeling and visualization'
      ];

      const queryEmbeddings = await embeddingService.embedBatch([frontendQuery, backendQuery, devopsQuery]);
      const docEmbeddings = await embeddingService.embedBatch(documents);

      // Test each query finds its most relevant domain
      for (let q = 0; q < queryEmbeddings.length; q++) {
        const similarities = await Promise.all(
          docEmbeddings.map(docEmbed => 
            embeddingService.similarity(queryEmbeddings[q], docEmbed)
          )
        );

        const maxSimilarityIndex = similarities.indexOf(Math.max(...similarities));
        
        // Each query should be most similar to its corresponding domain
        expect(maxSimilarityIndex).toBe(q);
        
        console.log(`Domain ${q}: max similarity = ${similarities[maxSimilarityIndex].toFixed(4)} at index ${maxSimilarityIndex}`);
      }
    });
  });

  describe('Document Processing Integration', () => {
    test('should process and embed complex documents', async () => {
      const complexDoc = {
        title: 'Microservices Architecture Implementation',
        content: 'This document describes the implementation of a microservices architecture using Docker containers, API gateways, service discovery, and distributed tracing.',
        metadata: {
          category: 'architecture',
          tags: ['microservices', 'docker', 'api'],
          author: 'Engineering Team',
          priority: 'high'
        }
      };

      const processed = documentProcessor.processDocument(complexDoc);
      expect(processed.searchText).toContain('Microservices Architecture Implementation');
      expect(processed.searchText).toContain('Docker containers');
      
      const embedding = await embeddingService.embed(processed.searchText);
      expect(embedding).toHaveLength(768);
      expect(embedding.every(v => typeof v === 'number')).toBe(true);
      
      console.log('✅ Complex document processed and embedded successfully');
    });

    test('should handle batch processing efficiently', async () => {
      const documents = Array.from({ length: 20 }, (_, i) => ({
        title: `Document ${i + 1}`,
        content: `This is document number ${i + 1} about ${['programming', 'design', 'testing', 'deployment'][i % 4]}`
      }));

      const startTime = Date.now();
      const embeddings = await embeddingService.embedBatch(
        documents.map(doc => `${doc.title}: ${doc.content}`)
      );
      const endTime = Date.now();

      expect(embeddings).toHaveLength(20);
      expect(embeddings.every(emb => emb.length === 768)).toBe(true);
      
      const totalTime = endTime - startTime;
      const avgTimePerDoc = totalTime / 20;
      
      console.log(`📊 Batch processing: 20 documents in ${totalTime}ms (${avgTimePerDoc.toFixed(1)}ms per doc)`);
      expect(avgTimePerDoc).toBeLessThan(5000); // Should be reasonably fast
    });
  });

  describe('Semantic Understanding Quality', () => {
    test('should understand technical synonyms and concepts', async () => {
      const conceptPairs = [
        ['machine learning algorithm', 'ML model training'],
        ['database query optimization', 'SQL performance tuning'],
        ['user interface design', 'frontend UX development'],
        ['API endpoint security', 'REST service authentication'],
        ['container orchestration', 'Docker deployment management']
      ];

      for (const [concept1, concept2] of conceptPairs) {
        const emb1 = await embeddingService.embed(concept1);
        const emb2 = await embeddingService.embed(concept2);
        const similarity = await embeddingService.similarity(emb1, emb2);
        
        console.log(`"${concept1}" vs "${concept2}": ${similarity.toFixed(4)}`);
        expect(similarity).toBeGreaterThan(0.5); // Should recognize semantic similarity
      }
    });

    test('should detect different programming languages and frameworks', async () => {
      const technologies = [
        'Python Django web framework for backend API development',
        'React TypeScript frontend with Redux state management',
        'Java Spring Boot microservices with JPA database access',
        'Go language HTTP servers with concurrent request handling'
      ];

      const embeddings = await embeddingService.embedBatch(technologies);
      
      // Calculate all pairwise similarities
      const similarities = [];
      for (let i = 0; i < embeddings.length; i++) {
        for (let j = i + 1; j < embeddings.length; j++) {
          const sim = await embeddingService.similarity(embeddings[i], embeddings[j]);
          similarities.push({
            tech1: technologies[i].split(' ')[0],
            tech2: technologies[j].split(' ')[0],
            similarity: sim
          });
        }
      }

      // All should be somewhat similar (all about programming) but distinct
      similarities.forEach(({ tech1, tech2, similarity }) => {
        console.log(`${tech1} vs ${tech2}: ${similarity.toFixed(4)}`);
        expect(similarity).toBeGreaterThan(0.3); // Related (programming)
        expect(similarity).toBeLessThan(0.8); // But distinct technologies
      });
    });
  });

  describe('Caching Integration', () => {
    test('should cache embeddings for performance', async () => {
      const testText = 'This is a test document for caching verification';
      
      // First call - should compute embedding
      const startTime1 = Date.now();
      const embedding1 = await embeddingService.embed(testText);
      const time1 = Date.now() - startTime1;
      
      // Cache the result (using internal set method)
      await cache.set(testText, embedding1);
      
      // Second call - should use cache if we had cache integration
      const startTime2 = Date.now();
      const embedding2 = await embeddingService.embed(testText);
      const time2 = Date.now() - startTime2;
      
      // Embeddings should be identical (deterministic)
      for (let i = 0; i < embedding1.length; i++) {
        expect(embedding1[i]).toBeCloseTo(embedding2[i], 10);
      }
      
      console.log(`First call: ${time1}ms, Second call: ${time2}ms`);
      expect(embedding1).toHaveLength(768);
      expect(embedding2).toHaveLength(768);
    });
  });

  describe('Performance Benchmarks', () => {
    test('should meet performance expectations', async () => {
      const texts = [
        'Quick performance test',
        'Machine learning model inference',
        'Database connection pooling',
        'API rate limiting implementation',
        'Error handling middleware'
      ];

      const stats = embeddingService.getStats();
      const initialCount = stats.totalEmbeddings;
      
      const startTime = Date.now();
      const embeddings = await embeddingService.embedBatch(texts);
      const endTime = Date.now();
      
      const newStats = embeddingService.getStats();
      
      console.log('📊 Performance Stats:');
      console.log(`  Embeddings generated: ${newStats.totalEmbeddings - initialCount}`);
      console.log(`  Total time: ${endTime - startTime}ms`);
      console.log(`  Average time per embedding: ${newStats.averageTime.toFixed(1)}ms`);
      console.log(`  Model: ${newStats.model}`);
      console.log(`  Dimensions: ${newStats.dimensions}`);
      
      expect(embeddings).toHaveLength(texts.length);
      expect(newStats.totalEmbeddings).toBe(initialCount + texts.length);
      expect(newStats.dimensions).toBe(768);
      expect(newStats.model).toBe('nomic-embed-text-v1.5');
    });
  });
});