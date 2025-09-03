import { describe, it, expect, beforeEach, beforeAll, afterEach } from '@jest/globals';
import SemanticSearchEngine from '../src/search/SemanticSearchEngine.js';
import DatabaseSchema from '../src/database/DatabaseSchema.js';
import DocumentIndexer from '../src/indexers/DocumentIndexer.js';
import ContentProcessor from '../src/processors/ContentProcessor.js';
import { ResourceManager } from '@legion/resource-manager';
import { MongoClient } from 'mongodb';

describe('SemanticSearchEngine', () => {
  let searchEngine;
  let resourceManager;
  let mongoClient;
  let db;
  let databaseSchema;
  let documentIndexer;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    
    // Connect to MongoDB for integration testing (no mocks)
    const mongoUrl = resourceManager.get('env.MONGODB_URL') || 'mongodb://localhost:27017';
    mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
    db = mongoClient.db('semantic-search-engine-workspace-test');
    
    databaseSchema = new DatabaseSchema(db, {
      collections: {
        documents: 'test_documents',
        chunks: 'test_document_chunks'
      }
    });

    // Set up test data by indexing some content
    const contentProcessor = new ContentProcessor({
      defaultChunkSize: 300,
      defaultOverlap: 0.2,
      maxFileSize: 1024 * 1024
    });

    documentIndexer = new DocumentIndexer({
      databaseSchema,
      contentProcessor,
      resourceManager,
      options: {
        qdrantCollection: 'semantic_search_test'
      }
    });

    // Index test documents
    const testDocs = [
      {
        content: `# Database Configuration Guide
        
To configure your database connection, you need to set up the connection string properly. 
MongoDB requires specific connection parameters including host, port, and authentication details.
The configuration should be stored in environment variables for security.`,
        contentType: 'text/markdown',
        metadata: { source: 'file:///docs/database.md' }
      },
      {
        content: `# Authentication Setup
        
User authentication in the system requires JWT tokens. 
Set up authentication middleware to validate incoming requests.
Configure password hashing and session management properly.`,
        contentType: 'text/markdown',
        metadata: { source: 'file:///docs/auth.md' }
      },
      {
        content: `# API Reference
        
The REST API provides endpoints for user management.
GET /users retrieves user information with proper filtering.
POST /users creates new user accounts with validation.`,
        contentType: 'text/markdown',
        metadata: { source: 'file:///docs/api.md' }
      }
    ];

    for (const doc of testDocs) {
      await documentIndexer.indexDocument(doc.content, doc.contentType, doc.metadata, { workspace: 'search-engine-test' });
    }
  });

  afterAll(async () => {
    if (mongoClient) {
      await mongoClient.close();
    }
  });

  beforeEach(async () => {
    searchEngine = new SemanticSearchEngine({
      databaseSchema,
      resourceManager,
      options: {
        qdrantCollection: 'semantic_search_test',
        defaultLimit: 10,
        defaultThreshold: 0.3
      }
    });
  });

  afterEach(async () => {
    if (searchEngine) {
      await searchEngine.cleanup();
    }
  });

  describe('constructor', () => {
    it('should create instance with correct properties', () => {
      expect(searchEngine.databaseSchema).toBe(databaseSchema);
      expect(searchEngine.resourceManager).toBe(resourceManager);
      expect(searchEngine.options.qdrantCollection).toBe('semantic_search_test');
    });

    it('should throw error without required dependencies', () => {
      expect(() => {
        new SemanticSearchEngine({});
      }).toThrow('DatabaseSchema is required');
    });
  });

  describe('semantic search', () => {
    it('should find relevant content for database queries', async () => {
      const results = await searchEngine.search('database connection configuration', {
        workspace: 'search-engine-test',
        limit: 5,
        threshold: 0.3
      });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      // Should find the database configuration content
      const dbResult = results.find(result => 
        result.content.includes('database connection') ||
        result.source.includes('database.md')
      );
      
      expect(dbResult).toBeDefined();
      expect(dbResult.similarity).toBeGreaterThan(0.3);
      expect(dbResult.content).toBeDefined();
      expect(dbResult.source).toBeDefined();
      expect(dbResult.title).toBeDefined();
    });

    it('should find relevant content for authentication queries', async () => {
      const results = await searchEngine.search('user authentication JWT tokens', {
        workspace: 'search-engine-test',
        limit: 5,
        threshold: 0.2
      });

      expect(results.length).toBeGreaterThan(0);

      // Should find authentication content
      const authResult = results.find(result =>
        result.content.includes('authentication') ||
        result.content.includes('JWT') ||
        result.source.includes('auth.md')
      );

      expect(authResult).toBeDefined();
      expect(authResult.similarity).toBeGreaterThan(0.2);
    });

    it('should return empty results for unrelated queries', async () => {
      const results = await searchEngine.search('unrelated topic that does not exist in docs', {
        workspace: 'search-engine-test',
        limit: 5,
        threshold: 0.5  // High threshold
      });

      // Might be empty or have very low similarity scores
      if (results.length > 0) {
        results.forEach(result => {
          expect(result.similarity).toBeLessThan(0.5);
        });
      }
    });

    it('should respect similarity threshold', async () => {
      const highThresholdResults = await searchEngine.search('database', {
        workspace: 'search-engine-test',
        threshold: 0.8  // Very high threshold
      });
      
      const lowThresholdResults = await searchEngine.search('database', {
        workspace: 'search-engine-test',
        threshold: 0.2  // Low threshold
      });

      expect(lowThresholdResults.length).toBeGreaterThanOrEqual(highThresholdResults.length);
      
      // All results should meet threshold
      highThresholdResults.forEach(result => {
        expect(result.similarity).toBeGreaterThanOrEqual(0.8);
      });
    });

    it('should respect result limit', async () => {
      const limitedResults = await searchEngine.search('configuration', {
        workspace: 'search-engine-test',
        limit: 2,
        threshold: 0.1
      });

      expect(limitedResults.length).toBeLessThanOrEqual(2);
    });
  });

  describe('search with context', () => {
    it('should include context chunks when requested', async () => {
      const results = await searchEngine.search('database connection', {
        workspace: 'search-engine-test',
        limit: 3,
        includeContext: true
      });

      expect(results.length).toBeGreaterThan(0);
      
      // All results should have context property when requested
      results.forEach(result => {
        expect(result.context).toBeDefined();
        expect(typeof result.context).toBe('object');
      });
    });
  });

  describe('filtering', () => {
    it('should filter results by source pattern', async () => {
      const results = await searchEngine.search('configuration', {
        workspace: 'search-engine-test',
        sourceFilter: 'database.md',
        limit: 10
      });

      // All results should be from database.md file
      results.forEach(result => {
        expect(result.source).toContain('database.md');
      });
    });

    it('should filter results by content type', async () => {
      const results = await searchEngine.search('authentication', {
        workspace: 'search-engine-test',
        contentTypeFilter: ['text/markdown'],
        limit: 10
      });

      results.forEach(result => {
        expect(result.metadata.contentType).toBe('text/markdown');
      });
    });
  });

  describe('result ranking', () => {
    it('should return results sorted by similarity score', async () => {
      const results = await searchEngine.search('database MongoDB connection', {
        workspace: 'search-engine-test',
        limit: 5,
        threshold: 0.1
      });

      expect(results.length).toBeGreaterThan(1);
      
      // Results should be sorted by similarity (descending)
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].similarity).toBeGreaterThanOrEqual(results[i + 1].similarity);
      }
    });

    it('should provide relevance scoring', async () => {
      const results = await searchEngine.search('database configuration setup', {
        workspace: 'search-engine-test',
        limit: 3,
        includeRelevanceScore: true
      });

      results.forEach(result => {
        expect(result.similarity).toBeDefined();
        expect(typeof result.similarity).toBe('number');
        expect(result.similarity).toBeGreaterThanOrEqual(0);
        expect(result.similarity).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('search performance', () => {
    it('should complete searches within reasonable time', async () => {
      const startTime = Date.now();
      
      await searchEngine.search('database authentication API', {
        workspace: 'search-engine-test',
        limit: 10
      });
      
      const searchTime = Date.now() - startTime;
      expect(searchTime).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });

  describe('error handling', () => {
    it('should handle empty query gracefully', async () => {
      await expect(
        searchEngine.search('')
      ).rejects.toThrow('Query cannot be empty');
    });

    it('should handle invalid search options', async () => {
      await expect(
        searchEngine.search('test query', { 
          workspace: 'search-engine-test',
          limit: -1 
        })
      ).rejects.toThrow('Limit must be positive');
    });
  });
});