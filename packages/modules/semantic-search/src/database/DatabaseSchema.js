/**
 * DatabaseSchema - MongoDB schema setup and operations for semantic search
 * 
 * Manages documents and document_chunks collections with proper indexing
 * Provides CRUD operations and search functionality
 * NO FALLBACKS - all operations must succeed or throw errors
 */

import { ObjectId } from 'mongodb';
import crypto from 'crypto';

export default class DatabaseSchema {
  constructor(db, config = {}) {
    if (!db) {
      throw new Error('Database instance is required');
    }

    this.db = db;
    this.config = {
      collections: {
        documents: 'documents',
        chunks: 'document_chunks',
        ...config.collections
      },
      ...config
    };
    
    this.initialized = false;
  }

  /**
   * Initialize collections and indexes
   */
  async initializeCollections() {
    if (this.initialized) return;

    try {
      // Create documents collection with indexes
      const documentsCollection = this.db.collection(this.config.collections.documents);
      
      // Documents indexes - workspace-first design
      // IMPORTANT: workspace + source must be unique (same source can exist in different workspaces)
      await documentsCollection.createIndex({ workspace: 1, source: 1 }, { unique: true, background: true });
      await documentsCollection.createIndex({ workspace: 1, contentHash: 1 }, { background: true });
      await documentsCollection.createIndex({ workspace: 1, sourceType: 1 }, { background: true });
      await documentsCollection.createIndex({ workspace: 1, indexedAt: -1 }, { background: true });
      await documentsCollection.createIndex({ workspace: 1 }, { background: true }); // Workspace-only index
      
      // Create chunks collection with indexes
      const chunksCollection = this.db.collection(this.config.collections.chunks);
      
      // Chunks indexes - include workspace for efficient filtering  
      await chunksCollection.createIndex({ workspace: 1, documentId: 1 }, { background: true });
      await chunksCollection.createIndex({ workspace: 1, contentHash: 1 }, { unique: true, background: true });
      await chunksCollection.createIndex({ workspace: 1, documentId: 1, chunkIndex: 1 }, { background: true });
      await chunksCollection.createIndex({ workspace: 1, qdrantId: 1 }, { sparse: true, background: true });
      await chunksCollection.createIndex({ workspace: 1 }, { background: true }); // Workspace-only index
      
      // Create text index for content search
      await chunksCollection.createIndex({ content: 'text' }, { background: true });
      
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize database schema: ${error.message}`);
    }
  }

  /**
   * Insert a new document
   */
  async insertDocument(documentData, workspace) {
    if (!workspace) {
      throw new Error('Workspace is required for document insertion');
    }
    await this.initializeCollections();
    
    const collection = this.db.collection(this.config.collections.documents);
    
    // Check for existing document by content hash and workspace
    if (documentData.contentHash) {
      const existing = await collection.findOne({ 
        contentHash: documentData.contentHash,
        workspace: workspace
      });
      if (existing) {
        return existing._id;
      }
    }
    
    // Check for existing document by source and workspace
    const existingBySource = await collection.findOne({ 
      source: documentData.source,
      workspace: workspace
    });
    if (existingBySource) {
      return existingBySource._id;
    }
    
    const document = {
      workspace: workspace,
      ...documentData,
      indexedAt: new Date(),
      _id: new ObjectId()
    };
    
    const result = await collection.insertOne(document);
    return result.insertedId;
  }

  /**
   * Get document by ID
   */
  async getDocument(documentId) {
    await this.initializeCollections();
    
    const collection = this.db.collection(this.config.collections.documents);
    return await collection.findOne({ _id: new ObjectId(documentId) });
  }

  /**
   * Search documents by criteria
   */
  async searchDocuments(criteria, workspace = null) {
    await this.initializeCollections();
    
    const collection = this.db.collection(this.config.collections.documents);
    
    // Add workspace filter if specified
    const searchCriteria = workspace ? { ...criteria, workspace } : criteria;
    
    return await collection.find(searchCriteria).toArray();
  }

  /**
   * Insert a new chunk  
   */
  async insertChunk(chunkData, workspace) {
    if (!workspace) {
      throw new Error('Workspace is required for chunk insertion');
    }
    await this.initializeCollections();
    
    const collection = this.db.collection(this.config.collections.chunks);
    
    // Check for existing chunk by content hash and workspace
    if (chunkData.contentHash) {
      const existing = await collection.findOne({ 
        contentHash: chunkData.contentHash,
        workspace: workspace
      });
      if (existing) {
        return existing._id;
      }
    }
    
    const chunk = {
      workspace: workspace,
      ...chunkData,
      documentId: new ObjectId(chunkData.documentId),
      createdAt: new Date(),
      _id: new ObjectId()
    };
    
    const result = await collection.insertOne(chunk);
    return result.insertedId;
  }

  /**
   * Get chunk by ID
   */
  async getChunk(chunkId) {
    await this.initializeCollections();
    
    const collection = this.db.collection(this.config.collections.chunks);
    return await collection.findOne({ _id: new ObjectId(chunkId) });
  }

  /**
   * Get all chunks for a document
   */
  async getChunksByDocument(documentId) {
    await this.initializeCollections();
    
    const collection = this.db.collection(this.config.collections.chunks);
    return await collection.find({ documentId: new ObjectId(documentId) })
                          .sort({ chunkIndex: 1 })
                          .toArray();
  }

  /**
   * Search chunks by criteria
   */
  async searchChunks(criteria, workspace = null) {
    await this.initializeCollections();
    
    const collection = this.db.collection(this.config.collections.chunks);
    
    // Add workspace filter if specified
    const searchCriteria = workspace ? { ...criteria, workspace } : criteria;
    
    return await collection.find(searchCriteria).toArray();
  }

  /**
   * Update chunk with embedding and Qdrant ID
   */
  async updateChunkEmbedding(chunkId, embedding, qdrantId) {
    await this.initializeCollections();
    
    const collection = this.db.collection(this.config.collections.chunks);
    
    const updateData = {
      embedding: embedding,
      embeddedAt: new Date()
    };
    
    if (qdrantId) {
      updateData.qdrantId = qdrantId;
    }
    
    const result = await collection.updateOne(
      { _id: new ObjectId(chunkId) },
      { $set: updateData }
    );
    
    return result.modifiedCount > 0;
  }

  /**
   * Clear all documents and chunks
   */
  async clearAll(workspace = null) {
    await this.initializeCollections();
    
    const docsCollection = this.db.collection(this.config.collections.documents);
    const chunksCollection = this.db.collection(this.config.collections.chunks);
    
    // Clear specific workspace or all
    const filter = workspace ? { workspace } : {};
    
    const docsResult = await docsCollection.deleteMany(filter);
    const chunksResult = await chunksCollection.deleteMany(filter);
    
    return {
      documentsDeleted: docsResult.deletedCount,
      chunksDeleted: chunksResult.deletedCount
    };
  }

  /**
   * Clear documents and chunks by source filter
   */
  async clearBySource(sourcePattern) {
    await this.initializeCollections();
    
    const docsCollection = this.db.collection(this.config.collections.documents);
    const chunksCollection = this.db.collection(this.config.collections.chunks);
    
    // Find documents matching pattern
    const matchingDocs = await docsCollection.find({ source: sourcePattern }).toArray();
    const documentIds = matchingDocs.map(doc => doc._id);
    
    // Delete chunks first (foreign key dependency)
    const chunksResult = await chunksCollection.deleteMany({ 
      documentId: { $in: documentIds } 
    });
    
    // Delete documents
    const docsResult = await docsCollection.deleteMany({ source: sourcePattern });
    
    return {
      documentsDeleted: docsResult.deletedCount,
      chunksDeleted: chunksResult.deletedCount
    };
  }

  /**
   * Get database statistics
   */
  async getStatistics(workspace = null) {
    await this.initializeCollections();
    
    const docsCollection = this.db.collection(this.config.collections.documents);
    const chunksCollection = this.db.collection(this.config.collections.chunks);
    
    // Count documents and chunks for specific workspace or all
    const filter = workspace ? { workspace } : {};
    
    const [totalDocuments, totalChunks] = await Promise.all([
      docsCollection.countDocuments(filter),
      chunksCollection.countDocuments(filter)
    ]);
    
    return {
      workspace: workspace || 'all',
      totalDocuments,
      totalChunks,
      collectionsInitialized: this.initialized,
      collections: {
        documents: this.config.collections.documents,
        chunks: this.config.collections.chunks
      }
    };
  }

  /**
   * Generate content hash for deduplication
   */
  static generateContentHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Validate document data before insertion
   */
  static validateDocument(documentData) {
    const required = ['source', 'sourceType'];
    
    for (const field of required) {
      if (!documentData[field]) {
        throw new Error(`Document missing required field: ${field}`);
      }
    }
    
    const validSourceTypes = ['file', 'url', 'directory'];
    if (!validSourceTypes.includes(documentData.sourceType)) {
      throw new Error(`Invalid sourceType: ${documentData.sourceType}. Must be one of: ${validSourceTypes.join(', ')}`);
    }
    
    return true;
  }

  /**
   * Validate chunk data before insertion
   */
  static validateChunk(chunkData) {
    const required = ['documentId', 'chunkIndex', 'content'];
    
    for (const field of required) {
      if (chunkData[field] === undefined || chunkData[field] === null) {
        throw new Error(`Chunk missing required field: ${field}`);
      }
    }
    
    if (typeof chunkData.chunkIndex !== 'number' || chunkData.chunkIndex < 0) {
      throw new Error('chunkIndex must be a non-negative number');
    }
    
    if (typeof chunkData.content !== 'string' || chunkData.content.length === 0) {
      throw new Error('content must be a non-empty string');
    }
    
    return true;
  }
}