import { describe, it, expect, beforeEach, afterEach, beforeAll } from '@jest/globals';
import DatabaseSchema from '../src/database/DatabaseSchema.js';
import { ResourceManager } from '@legion/resource-manager';
import { MongoClient } from 'mongodb';

describe('DatabaseSchema', () => {
  let databaseSchema;
  let resourceManager;
  let mongoClient;
  let db;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    
    // Connect to MongoDB for integration testing (no mocks)
    const mongoUrl = resourceManager.get('env.MONGODB_URL') || 'mongodb://localhost:27017';
    mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
    db = mongoClient.db('semantic-search-test');
  });

  afterAll(async () => {
    if (mongoClient) {
      await mongoClient.close();
    }
  });

  beforeEach(() => {
    databaseSchema = new DatabaseSchema(db, {
      collections: {
        documents: 'test_documents',
        chunks: 'test_document_chunks'
      }
    });
  });

  afterEach(async () => {
    // Clean up test collections
    try {
      await db.collection('test_documents').drop();
      await db.collection('test_document_chunks').drop();
    } catch (error) {
      // Collections might not exist
    }
  });

  describe('constructor', () => {
    it('should create instance with correct properties', () => {
      expect(databaseSchema.db).toBe(db);
      expect(databaseSchema.config.collections.documents).toBe('test_documents');
      expect(databaseSchema.config.collections.chunks).toBe('test_document_chunks');
    });

    it('should throw error without database', () => {
      expect(() => {
        new DatabaseSchema(null);
      }).toThrow('Database instance is required');
    });
  });

  describe('collection management', () => {
    it('should create document collections with proper indexes', async () => {
      await databaseSchema.initializeCollections();
      
      // Verify collections exist
      const collections = await db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);
      
      expect(collectionNames).toContain('test_documents');
      expect(collectionNames).toContain('test_document_chunks');
    });

    it('should create proper indexes on collections', async () => {
      await databaseSchema.initializeCollections();
      
      // Check documents collection indexes
      const docIndexes = await db.collection('test_documents').indexes();
      const docIndexNames = docIndexes.map(idx => Object.keys(idx.key)[0]);
      
      expect(docIndexNames).toContain('source');
      expect(docIndexNames).toContain('contentHash');
      
      // Check chunks collection indexes
      const chunkIndexes = await db.collection('test_document_chunks').indexes();
      const chunkIndexNames = chunkIndexes.map(idx => Object.keys(idx.key)[0]);
      
      expect(chunkIndexNames).toContain('documentId');
      expect(chunkIndexNames).toContain('contentHash');
    });
  });

  describe('document operations', () => {
    beforeEach(async () => {
      await databaseSchema.initializeCollections();
    });

    it('should insert and retrieve documents', async () => {
      const testDoc = {
        source: 'file:///test/doc.txt',
        sourceType: 'file',
        title: 'Test Document',
        totalChunks: 5,
        contentHash: 'abc123',
        fileSize: 1024,
        contentType: 'text/plain'
      };

      const insertedId = await databaseSchema.insertDocument(testDoc);
      expect(insertedId).toBeDefined();
      
      const retrieved = await databaseSchema.getDocument(insertedId);
      expect(retrieved).toBeDefined();
      expect(retrieved.source).toBe(testDoc.source);
      expect(retrieved.title).toBe(testDoc.title);
      expect(retrieved.indexedAt).toBeDefined();
    });

    it('should prevent duplicate documents by content hash', async () => {
      const testDoc = {
        source: 'file:///test/doc.txt',
        sourceType: 'file',
        title: 'Test Document',
        contentHash: 'duplicate123'
      };

      const firstId = await databaseSchema.insertDocument(testDoc);
      expect(firstId).toBeDefined();
      
      // Attempt to insert duplicate
      const secondId = await databaseSchema.insertDocument(testDoc);
      expect(secondId.toString()).toBe(firstId.toString()); // Should return existing ID
    });
  });

  describe('chunk operations', () => {
    let documentId;

    beforeEach(async () => {
      await databaseSchema.initializeCollections();
      
      const testDoc = {
        source: 'file:///test/doc.txt',
        sourceType: 'file',
        title: 'Test Document',
        contentHash: 'doc123'
      };
      
      documentId = await databaseSchema.insertDocument(testDoc);
    });

    it('should insert and retrieve chunks', async () => {
      const testChunk = {
        documentId: documentId,
        chunkIndex: 0,
        content: 'This is test chunk content for testing purposes.',
        contentHash: 'chunk123',
        charStart: 0,
        charEnd: 47,
        tokenCount: 10
      };

      const insertedId = await databaseSchema.insertChunk(testChunk);
      expect(insertedId).toBeDefined();
      
      const retrieved = await databaseSchema.getChunk(insertedId);
      expect(retrieved).toBeDefined();
      expect(retrieved.content).toBe(testChunk.content);
      expect(retrieved.documentId.toString()).toBe(documentId.toString());
    });

    it('should retrieve chunks by document ID', async () => {
      const chunks = [
        {
          documentId: documentId,
          chunkIndex: 0,
          content: 'First chunk content',
          contentHash: 'chunk1',
          charStart: 0,
          charEnd: 19
        },
        {
          documentId: documentId,
          chunkIndex: 1,
          content: 'Second chunk content',
          contentHash: 'chunk2',
          charStart: 20,
          charEnd: 40
        }
      ];

      for (const chunk of chunks) {
        await databaseSchema.insertChunk(chunk);
      }
      
      const retrievedChunks = await databaseSchema.getChunksByDocument(documentId);
      expect(retrievedChunks).toHaveLength(2);
      expect(retrievedChunks[0].chunkIndex).toBe(0);
      expect(retrievedChunks[1].chunkIndex).toBe(1);
    });

    it('should prevent duplicate chunks by content hash', async () => {
      const testChunk = {
        documentId: documentId,
        chunkIndex: 0,
        content: 'Duplicate content',
        contentHash: 'duplicate_chunk_123'
      };

      const firstId = await databaseSchema.insertChunk(testChunk);
      expect(firstId).toBeDefined();
      
      // Attempt to insert duplicate
      const secondId = await databaseSchema.insertChunk(testChunk);
      expect(secondId.toString()).toBe(firstId.toString()); // Should return existing ID
    });
  });

  describe('search operations', () => {
    beforeEach(async () => {
      await databaseSchema.initializeCollections();
    });

    it('should search documents by source', async () => {
      const docs = [
        {
          source: 'file:///docs/readme.md',
          sourceType: 'file',
          title: 'README',
          contentHash: 'readme123'
        },
        {
          source: 'file:///src/main.js',
          sourceType: 'file', 
          title: 'Main Script',
          contentHash: 'main123'
        }
      ];

      for (const doc of docs) {
        await databaseSchema.insertDocument(doc);
      }
      
      const results = await databaseSchema.searchDocuments({ source: /docs/ });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('README');
    });

    it('should search chunks by content', async () => {
      const testDoc = {
        source: 'file:///test.txt',
        sourceType: 'file',
        title: 'Test',
        contentHash: 'test123'
      };
      const docId = await databaseSchema.insertDocument(testDoc);

      const chunks = [
        {
          documentId: docId,
          chunkIndex: 0,
          content: 'This chunk contains database configuration information',
          contentHash: 'config_chunk'
        },
        {
          documentId: docId,
          chunkIndex: 1,
          content: 'This chunk contains user authentication details',
          contentHash: 'auth_chunk'
        }
      ];

      for (const chunk of chunks) {
        await databaseSchema.insertChunk(chunk);
      }
      
      const results = await databaseSchema.searchChunks({ content: /database/ });
      expect(results).toHaveLength(1);
      expect(results[0].content).toContain('database configuration');
    });
  });

  describe('cleanup operations', () => {
    beforeEach(async () => {
      await databaseSchema.initializeCollections();
    });

    it('should clear all documents and chunks', async () => {
      const testDoc = {
        source: 'file:///test.txt',
        sourceType: 'file',
        title: 'Test',
        contentHash: 'test123'
      };
      const docId = await databaseSchema.insertDocument(testDoc);
      
      await databaseSchema.insertChunk({
        documentId: docId,
        chunkIndex: 0,
        content: 'Test content',
        contentHash: 'chunk123'
      });

      const clearResult = await databaseSchema.clearAll();
      expect(clearResult.documentsDeleted).toBeGreaterThan(0);
      expect(clearResult.chunksDeleted).toBeGreaterThan(0);
      
      // Verify collections are empty
      const docCount = await db.collection('test_documents').countDocuments();
      const chunkCount = await db.collection('test_document_chunks').countDocuments();
      
      expect(docCount).toBe(0);
      expect(chunkCount).toBe(0);
    });
  });

  describe('statistics', () => {
    beforeEach(async () => {
      await databaseSchema.initializeCollections();
    });

    it('should return accurate statistics', async () => {
      const testDoc = {
        source: 'file:///test.txt',
        sourceType: 'file',
        title: 'Test',
        contentHash: 'test123'
      };
      const docId = await databaseSchema.insertDocument(testDoc);
      
      await databaseSchema.insertChunk({
        documentId: docId,
        chunkIndex: 0,
        content: 'Test content',
        contentHash: 'chunk123'
      });

      const stats = await databaseSchema.getStatistics();
      expect(stats.totalDocuments).toBe(1);
      expect(stats.totalChunks).toBe(1);
      expect(stats.collectionsInitialized).toBe(true);
    });
  });
});