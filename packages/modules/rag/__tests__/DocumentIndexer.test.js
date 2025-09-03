import { describe, it, expect, beforeEach, beforeAll, afterEach } from '@jest/globals';
import DocumentIndexer from '../src/indexers/DocumentIndexer.js';
import DatabaseSchema from '../src/database/DatabaseSchema.js';
import ContentProcessor from '../src/processors/ContentProcessor.js';
import { ResourceManager } from '@legion/resource-manager';
import { MongoClient } from 'mongodb';

describe('DocumentIndexer', () => {
  let documentIndexer;
  let resourceManager;
  let mongoClient;
  let db;
  let databaseSchema;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    
    // Connect to MongoDB for integration testing (no mocks)
    const mongoUrl = resourceManager.get('env.MONGODB_URL') || 'mongodb://localhost:27017';
    mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
    db = mongoClient.db('semantic-search-indexer-test');
    
    databaseSchema = new DatabaseSchema(db, {
      collections: {
        documents: 'test_documents',
        chunks: 'test_document_chunks'
      }
    });
  });

  afterAll(async () => {
    if (mongoClient) {
      await mongoClient.close();
    }
  });

  beforeEach(async () => {
    // Clean up test collections
    try {
      await db.collection('test_documents').drop();
      await db.collection('test_document_chunks').drop();
    } catch (error) {
      // Collections might not exist
    }

    const contentProcessor = new ContentProcessor({
      defaultChunkSize: 200, // Smaller for testing
      defaultOverlap: 0.2,
      maxFileSize: 1024 * 1024
    });

    documentIndexer = new DocumentIndexer({
      databaseSchema,
      contentProcessor,
      resourceManager,
      options: {
        batchSize: 5,
        maxConcurrent: 2
      }
    });
  });

  describe('constructor', () => {
    it('should create instance with correct properties', () => {
      expect(documentIndexer.databaseSchema).toBe(databaseSchema);
      expect(documentIndexer.contentProcessor).toBeInstanceOf(ContentProcessor);
      expect(documentIndexer.resourceManager).toBe(resourceManager);
    });

    it('should throw error without required dependencies', () => {
      expect(() => {
        new DocumentIndexer({});
      }).toThrow('DatabaseSchema is required');
    });
  });

  describe('single document indexing', () => {
    it('should index a document with content and generate embeddings', async () => {
      const content = 'This is test content for indexing. It should be processed into chunks. Each chunk will get embeddings generated.';
      
      const result = await documentIndexer.indexDocument(content, 'text/plain', {
        source: 'file:///test.txt'
      }, { workspace: 'test-indexer' });
      
      expect(result.success).toBe(true);
      expect(result.documentId).toBeDefined();
      expect(result.chunksIndexed).toBeGreaterThan(0);
      expect(result.vectorsIndexed).toBe(result.chunksIndexed);
      
      // Verify document was stored
      const storedDoc = await databaseSchema.getDocument(result.documentId);
      expect(storedDoc).toBeDefined();
      expect(storedDoc.source).toBe('file:///test.txt');
      expect(storedDoc.totalChunks).toBe(result.chunksIndexed);
      
      // Verify chunks were stored with embeddings
      const chunks = await databaseSchema.getChunksByDocument(result.documentId);
      expect(chunks.length).toBe(result.chunksIndexed);
      
      chunks.forEach(chunk => {
        expect(chunk.embedding).toBeDefined();
        expect(Array.isArray(chunk.embedding)).toBe(true);
        expect(chunk.embedding.length).toBe(768); // Nomic dimensions
        expect(chunk.qdrantId).toBeDefined();
      });
    });

    it('should handle duplicate content by returning existing document', async () => {
      const content = 'Duplicate content for testing deduplication.';
      const metadata = { source: 'file:///duplicate.txt' };
      
      const firstResult = await documentIndexer.indexDocument(content, 'text/plain', metadata, { workspace: 'test-duplicates' });
      const secondResult = await documentIndexer.indexDocument(content, 'text/plain', metadata, { workspace: 'test-duplicates' });
      
      expect(firstResult.documentId.toString()).toBe(secondResult.documentId.toString());
      expect(secondResult.alreadyExists).toBe(true);
    });

    it('should handle indexing errors gracefully', async () => {
      // Test with empty content (should fail)
      await expect(
        documentIndexer.indexDocument('', 'text/plain', {
          source: 'file:///empty.txt'
        }, { workspace: 'test-errors' })
      ).rejects.toThrow('Content cannot be empty');
    });
  });

  describe('batch document indexing', () => {
    it('should index multiple documents in batch', async () => {
      const documents = [
        {
          content: 'First document content with multiple sentences. Each sentence provides context.',
          contentType: 'text/plain',
          metadata: { source: 'file:///doc1.txt' }
        },
        {
          content: 'Second document content with different information. This has unique data.',
          contentType: 'text/plain', 
          metadata: { source: 'file:///doc2.txt' }
        },
        {
          content: 'Third document with JSON data. {"key": "value", "number": 42}.',
          contentType: 'application/json',
          metadata: { source: 'file:///doc3.json' }
        }
      ];

      const results = await documentIndexer.indexDocuments(documents, { workspace: 'test-batch' });
      
      expect(results.totalDocuments).toBe(3);
      expect(results.successfulDocuments).toBe(3);
      expect(results.failedDocuments).toBe(0);
      expect(results.totalChunks).toBeGreaterThan(0);
      expect(results.totalVectors).toBe(results.totalChunks);
      
      // Verify all documents were stored
      for (const docResult of results.documents) {
        expect(docResult.success).toBe(true);
        expect(docResult.documentId).toBeDefined();
        
        const storedDoc = await databaseSchema.getDocument(docResult.documentId);
        expect(storedDoc).toBeDefined();
      }
    });

    it('should handle mixed success/failure in batch processing', async () => {
      const documents = [
        {
          content: 'Valid document content.',
          contentType: 'text/plain',
          metadata: { source: 'file:///valid.txt' }
        },
        {
          content: '', // Invalid - empty content
          contentType: 'text/plain',
          metadata: { source: 'file:///invalid.txt' }
        },
        {
          content: 'Another valid document.',
          contentType: 'text/plain',
          metadata: { source: 'file:///valid2.txt' }
        }
      ];

      const results = await documentIndexer.indexDocuments(documents, { workspace: 'test-batch' });
      
      expect(results.totalDocuments).toBe(3);
      expect(results.successfulDocuments).toBe(2);
      expect(results.failedDocuments).toBe(1);
      expect(results.errors).toHaveLength(1);
      expect(results.errors[0].error).toContain('Content cannot be empty');
    });
  });

  describe('embedding integration', () => {
    it('should generate embeddings using Nomic service', async () => {
      const content = 'Test content for embedding generation using the Nomic service.';
      
      const result = await documentIndexer.indexDocument(content, 'text/plain', {
        source: 'file:///embedding-test.txt'
      }, { workspace: 'test-embeddings' });
      
      expect(result.success).toBe(true);
      
      // Verify embeddings were generated
      const chunks = await databaseSchema.getChunksByDocument(result.documentId);
      
      chunks.forEach(chunk => {
        expect(chunk.embedding).toBeDefined();
        expect(Array.isArray(chunk.embedding)).toBe(true);
        expect(chunk.embedding.length).toBe(768);
        
        // Verify embeddings contain valid numbers
        chunk.embedding.forEach(value => {
          expect(typeof value).toBe('number');
          expect(isFinite(value)).toBe(true);
        });
      });
    });
  });

  describe('vector store integration', () => {
    it('should index vectors in Qdrant with proper metadata', async () => {
      const content = 'Content for vector indexing test. This will be stored in Qdrant.';
      
      const result = await documentIndexer.indexDocument(content, 'text/plain', {
        source: 'file:///vector-test.txt'
      }, { workspace: 'test-vectors' });
      
      expect(result.success).toBe(true);
      expect(result.vectorsIndexed).toBe(result.chunksIndexed);
      
      // Verify chunks have Qdrant IDs
      const chunks = await databaseSchema.getChunksByDocument(result.documentId);
      
      chunks.forEach(chunk => {
        expect(chunk.qdrantId).toBeDefined();
        expect(typeof chunk.qdrantId).toBe('string');
      });
    });
  });

  describe('incremental indexing', () => {
    it('should support updating existing documents', async () => {
      const originalContent = 'Original document content.';
      const updatedContent = 'Updated document content with new information.';
      const metadata = { source: 'file:///update-test.txt' };
      
      // Index original
      const originalResult = await documentIndexer.indexDocument(
        originalContent, 'text/plain', metadata, { workspace: 'test-updates' }
      );
      
      // Update with new content
      const updateResult = await documentIndexer.indexDocument(
        updatedContent, 'text/plain', metadata, { updateExisting: true, workspace: 'test-updates' }
      );
      
      expect(updateResult.success).toBe(true);
      expect(updateResult.documentId.toString()).toBe(originalResult.documentId.toString());
      
      // Verify content was updated
      const updatedDoc = await databaseSchema.getDocument(updateResult.documentId);
      expect(updatedDoc.contentHash).not.toBe(originalResult.contentHash);
    });
  });

  describe('indexing statistics', () => {
    it('should provide accurate indexing statistics', async () => {
      const documents = [
        {
          content: 'Document one with some content.',
          contentType: 'text/plain',
          metadata: { source: 'file:///stats1.txt' }
        },
        {
          content: 'Document two with different content and more text.',
          contentType: 'text/plain',
          metadata: { source: 'file:///stats2.txt' }
        }
      ];

      const results = await documentIndexer.indexDocuments(documents, { workspace: 'test-batch' });
      
      expect(results.statistics).toBeDefined();
      expect(results.statistics.avgChunksPerDocument).toBeGreaterThan(0);
      expect(results.statistics.avgProcessingTime).toBeGreaterThan(0);
      expect(results.statistics.totalEmbeddingTime).toBeGreaterThan(0);
      expect(results.statistics.totalIndexingTime).toBeGreaterThan(0);
    });
  });
});