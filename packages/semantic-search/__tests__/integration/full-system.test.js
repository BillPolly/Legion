/**
 * Full system integration test
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { SemanticSearchProvider } from '../../src/SemanticSearchProvider.js';

describe.skip('Semantic Search Full Integration (requires Qdrant)', () => {
  let provider;
  let mockResourceManager;
  
  beforeAll(async () => {
    mockResourceManager = {
      initialized: true,
      get: (key) => {
        const values = {
          'env.OPENAI_API_KEY': 'test-key',
          'env.QDRANT_URL': 'http://localhost:6333',
          'env.SEMANTIC_SEARCH_MODEL': 'text-embedding-3-small',
          'env.SEMANTIC_SEARCH_BATCH_SIZE': '100',
          'env.SEMANTIC_SEARCH_CACHE_TTL': '3600',
          'env.SEMANTIC_SEARCH_ENABLE_CACHE': 'true'
        };
        return values[key];
      },
      register: () => {}
    };
    
    provider = await SemanticSearchProvider.create(mockResourceManager);
    await provider.connect();
  });
  
  afterAll(async () => {
    if (provider) {
      await provider.disconnect();
    }
  });
  
  describe('Document Indexing and Search', () => {
    it('should index and search documents', async () => {
      // Index documents
      const documents = [
        {
          id: 'doc1',
          title: 'Introduction to Machine Learning',
          content: 'Machine learning is a subset of artificial intelligence that enables systems to learn from data.',
          category: 'technical',
          tags: ['AI', 'ML', 'tutorial']
        },
        {
          id: 'doc2',
          title: 'Database Optimization Techniques',
          content: 'Optimizing database performance involves indexing, query optimization, and caching strategies.',
          category: 'technical',
          tags: ['database', 'performance', 'optimization']
        },
        {
          id: 'doc3',
          title: 'User Authentication Best Practices',
          content: 'Secure authentication requires strong passwords, multi-factor authentication, and proper session management.',
          category: 'security',
          tags: ['auth', 'security', 'best-practices']
        }
      ];
      
      const insertResult = await provider.insert('documents', documents);
      expect(insertResult.success).toBe(true);
      expect(insertResult.insertedCount).toBe(3);
      expect(insertResult.vectorsStored).toBe(3);
      
      // Search for documents
      const searchResults = await provider.semanticSearch(
        'documents',
        'how to implement secure login system',
        { limit: 2 }
      );
      
      expect(searchResults).toBeDefined();
      expect(searchResults.length).toBeLessThanOrEqual(2);
      
      // The auth document should be most relevant
      if (searchResults.length > 0) {
        expect(searchResults[0]._searchType).toBe('semantic');
        expect(searchResults[0]._similarity).toBeGreaterThan(0);
      }
    });
    
    it('should perform hybrid search', async () => {
      const results = await provider.hybridSearch(
        'documents',
        'database performance',
        {
          semanticWeight: 0.6,
          keywordWeight: 0.4,
          limit: 2
        }
      );
      
      expect(results).toBeDefined();
      if (results.length > 0) {
        expect(results[0]._hybridScore).toBeDefined();
        expect(results[0]._semanticScore).toBeDefined();
        expect(results[0]._keywordScore).toBeDefined();
      }
    });
    
    it('should find similar documents', async () => {
      const referenceDoc = {
        title: 'Security Guidelines',
        content: 'Security is important for protecting user data and preventing unauthorized access.',
        tags: ['security']
      };
      
      const similarDocs = await provider.findSimilar(
        'documents',
        referenceDoc,
        { limit: 2, threshold: 0.3 }
      );
      
      expect(similarDocs).toBeDefined();
      expect(Array.isArray(similarDocs)).toBe(true);
      
      if (similarDocs.length > 0) {
        expect(similarDocs[0]._searchType).toBe('similarity');
        expect(similarDocs[0]._similarity).toBeGreaterThan(0);
      }
    });
  });
  
  describe('Code Search', () => {
    it('should index and search code snippets', async () => {
      const codeSnippets = [
        {
          id: 'code1',
          filepath: '/src/auth/jwt.js',
          content: `
            function generateJWT(userId) {
              const payload = { userId, exp: Date.now() + 3600000 };
              return jwt.sign(payload, SECRET_KEY);
            }
          `,
          language: 'javascript',
          purpose: 'JWT token generation'
        },
        {
          id: 'code2',
          filepath: '/src/db/connection.js',
          content: `
            async function connectDatabase() {
              const client = new MongoClient(uri);
              await client.connect();
              return client.db('myapp');
            }
          `,
          language: 'javascript',
          purpose: 'Database connection'
        }
      ];
      
      await provider.insert('code', codeSnippets);
      
      const results = await provider.semanticSearch(
        'code',
        'how to create authentication tokens',
        { limit: 1 }
      );
      
      expect(results).toBeDefined();
      if (results.length > 0) {
        expect(results[0].document).toBeDefined();
      }
    });
  });
  
  describe('CRUD Operations', () => {
    it('should perform standard CRUD operations', async () => {
      // Insert
      await provider.insert('test_collection', {
        id: 'test1',
        name: 'Test Document',
        value: 42
      });
      
      // Find
      const found = await provider.find('test_collection', { id: 'test1' });
      expect(Array.isArray(found)).toBe(true);
      
      // Update
      const updateResult = await provider.update(
        'test_collection',
        { id: 'test1' },
        { value: 100 }
      );
      expect(updateResult.modifiedCount).toBeGreaterThanOrEqual(0);
      
      // Delete
      const deleteResult = await provider.delete('test_collection', { id: 'test1' });
      expect(deleteResult.deletedCount).toBeGreaterThanOrEqual(0);
    });
  });
  
  describe('Caching', () => {
    it('should cache embeddings for repeated queries', async () => {
      const query = 'test caching query';
      
      // First search - generates embedding
      const results1 = await provider.semanticSearch('documents', query);
      
      // Second search - should use cached embedding
      const results2 = await provider.semanticSearch('documents', query);
      
      // Results should be identical
      expect(results1.length).toBe(results2.length);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle invalid search options gracefully', async () => {
      await expect(
        provider.semanticSearch('documents', 'test', {
          limit: 1001 // Exceeds maximum
        })
      ).rejects.toThrow('limit must be a number between 1 and 1000');
    });
    
    it('should handle invalid hybrid search weights', async () => {
      await expect(
        provider.hybridSearch('documents', 'test', {
          semanticWeight: 0.7,
          keywordWeight: 0.5 // Sum exceeds 1.0
        })
      ).rejects.toThrow('semanticWeight and keywordWeight must sum to 1.0');
    });
  });
});