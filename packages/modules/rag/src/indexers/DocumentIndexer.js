/**
 * DocumentIndexer - Complete document indexing pipeline
 * 
 * Coordinates content processing, embedding generation, and vector storage
 * Integrates with existing Nomic embeddings and Qdrant infrastructure
 * NO FALLBACKS - all operations must succeed or throw errors
 */

import { NomicEmbeddings } from '@legion/nomic';
import { QdrantClient } from '@qdrant/js-client-rest';
import crypto from 'crypto';

export default class DocumentIndexer {
  constructor({ databaseSchema, contentProcessor, resourceManager, options = {} }) {
    if (!databaseSchema) {
      throw new Error('DatabaseSchema is required');
    }
    if (!contentProcessor) {
      throw new Error('ContentProcessor is required');
    }
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }

    this.databaseSchema = databaseSchema;
    this.contentProcessor = contentProcessor;
    this.resourceManager = resourceManager;
    
    this.options = {
      batchSize: 10,
      maxConcurrent: 3,
      qdrantCollection: 'semantic_content',
      generateEmbeddings: true,
      indexVectors: true,
      ...options
    };

    this.nomicEmbeddings = null;
    this.qdrantClient = null;
    this.initialized = false;
    
    // Statistics tracking
    this.stats = {
      documentsProcessed: 0,
      chunksCreated: 0,
      embeddingsGenerated: 0,
      vectorsIndexed: 0,
      totalProcessingTime: 0,
      totalEmbeddingTime: 0,
      totalIndexingTime: 0
    };
  }

  /**
   * Initialize embedding and vector services
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Initialize Nomic embeddings
      this.nomicEmbeddings = new NomicEmbeddings();
      await this.nomicEmbeddings.initialize();
      
      // Initialize Qdrant client
      const qdrantUrl = this.resourceManager.get('env.QDRANT_URL') || 'http://localhost:6333';
      this.qdrantClient = new QdrantClient({ url: qdrantUrl });
      
      // Ensure Qdrant collection exists
      await this.ensureQdrantCollection();
      
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize DocumentIndexer: ${error.message}`);
    }
  }

  /**
   * Ensure Qdrant collection exists for specific workspace
   * Creates separate collections per workspace for optimal performance and isolation
   * Collection naming pattern: semantic_content_{workspace_name}
   */
  async ensureQdrantCollection(workspace = 'default') {
    try {
      // Generate workspace-specific collection name
      const workspaceCollectionName = this.getWorkspaceCollectionName(workspace);
      
      const collections = await this.qdrantClient.getCollections();
      const collectionExists = collections.collections.some(c => c.name === workspaceCollectionName);
      
      if (!collectionExists) {
        console.log(`[DocumentIndexer] Creating Qdrant collection for workspace: ${workspace} -> ${workspaceCollectionName}`);
        await this.qdrantClient.createCollection(workspaceCollectionName, {
          vectors: {
            size: 768, // Nomic dimensions
            distance: 'Cosine'
          }
        });
      }
      
      return workspaceCollectionName;
    } catch (error) {
      throw new Error(`Failed to ensure Qdrant collection for workspace ${workspace}: ${error.message}`);
    }
  }

  /**
   * Generate Qdrant collection name for workspace
   * Pattern: semantic_content_{workspace_name}
   * Ensures clean, predictable collection naming
   */
  getWorkspaceCollectionName(workspace) {
    // Sanitize workspace name for collection naming
    const sanitizedWorkspace = workspace.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    return `semantic_content_${sanitizedWorkspace}`;
  }

  /**
   * Index a single document
   */
  async indexDocument(content, contentType, metadata, options = {}) {
    await this.initialize();
    
    const workspace = options.workspace;
    if (!workspace) {
      throw new Error('Workspace is required for document indexing');
    }
    const startTime = Date.now();
    
    try {
      // Check for existing document if not updating
      if (!options.updateExisting) {
        const contentHash = crypto.createHash('sha256').update(content).digest('hex');
        const existing = await this.databaseSchema.searchDocuments({ contentHash }, workspace);
        
        if (existing.length > 0) {
          return {
            success: true,
            documentId: existing[0]._id,
            chunksIndexed: existing[0].totalChunks,
            vectorsIndexed: existing[0].totalChunks,
            alreadyExists: true,
            processingTime: Date.now() - startTime
          };
        }
      }

      // Process content into document and chunks
      const processed = await this.contentProcessor.processContent(content, contentType, metadata, options);
      
      // Store document in MongoDB
      const documentId = await this.databaseSchema.insertDocument(processed.document, workspace);
      
      // Generate embeddings for chunks
      const embeddingStartTime = Date.now();
      const embeddings = await this.generateEmbeddings(processed.chunks);
      const embeddingTime = Date.now() - embeddingStartTime;
      
      // Store chunks with embeddings in MongoDB
      const chunkIds = [];
      for (let i = 0; i < processed.chunks.length; i++) {
        const chunk = processed.chunks[i];
        chunk.documentId = documentId;
        chunk.embedding = embeddings[i];
        
        const chunkId = await this.databaseSchema.insertChunk(chunk, workspace);
        chunkIds.push(chunkId);
      }
      
      // Index vectors in Qdrant
      const vectorStartTime = Date.now();
      const vectorIds = await this.indexVectors(processed.chunks, documentId, workspace);
      const vectorTime = Date.now() - vectorStartTime;
      
      // Update chunks with Qdrant IDs
      for (let i = 0; i < chunkIds.length; i++) {
        await this.databaseSchema.updateChunkEmbedding(chunkIds[i], embeddings[i], vectorIds[i]);
      }
      
      // Update statistics
      this.stats.documentsProcessed++;
      this.stats.chunksCreated += processed.chunks.length;
      this.stats.embeddingsGenerated += embeddings.length;
      this.stats.vectorsIndexed += vectorIds.length;
      this.stats.totalProcessingTime += Date.now() - startTime;
      this.stats.totalEmbeddingTime += embeddingTime;
      this.stats.totalIndexingTime += vectorTime;
      
      return {
        success: true,
        documentId,
        chunksIndexed: processed.chunks.length,
        vectorsIndexed: vectorIds.length,
        processingTime: Date.now() - startTime,
        embeddingTime,
        vectorTime
      };

    } catch (error) {
      throw new Error(`Document indexing failed: ${error.message}`);
    }
  }

  /**
   * Index multiple documents in batch
   */
  async indexDocuments(documents, options = {}) {
    await this.initialize();
    
    const startTime = Date.now();
    const results = {
      totalDocuments: documents.length,
      successfulDocuments: 0,
      failedDocuments: 0,
      totalChunks: 0,
      totalVectors: 0,
      documents: [],
      errors: [],
      statistics: null
    };

    // Process documents in batches
    for (let i = 0; i < documents.length; i += this.options.batchSize) {
      const batch = documents.slice(i, i + this.options.batchSize);
      
      const batchPromises = batch.map(async (doc, index) => {
        try {
          const result = await this.indexDocument(doc.content, doc.contentType, doc.metadata, options);
          
          results.successfulDocuments++;
          results.totalChunks += result.chunksIndexed;
          results.totalVectors += result.vectorsIndexed;
          
          return {
            success: true,
            index: i + index,
            documentId: result.documentId,
            chunksIndexed: result.chunksIndexed,
            vectorsIndexed: result.vectorsIndexed,
            processingTime: result.processingTime
          };
        } catch (error) {
          results.failedDocuments++;
          results.errors.push({
            index: i + index,
            source: doc.metadata?.source || 'unknown',
            error: error.message
          });
          
          return {
            success: false,
            index: i + index,
            error: error.message
          };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.documents.push(...batchResults);
    }
    
    // Calculate statistics
    const totalTime = Date.now() - startTime;
    results.statistics = {
      totalProcessingTime: totalTime,
      avgProcessingTime: results.successfulDocuments > 0 ? totalTime / results.successfulDocuments : 0,
      avgChunksPerDocument: results.successfulDocuments > 0 ? results.totalChunks / results.successfulDocuments : 0,
      avgProcessingTime: this.stats.totalProcessingTime / Math.max(1, this.stats.documentsProcessed),
      totalEmbeddingTime: this.stats.totalEmbeddingTime,
      totalIndexingTime: this.stats.totalIndexingTime
    };
    
    return results;
  }

  /**
   * Generate embeddings for chunks using Nomic
   */
  async generateEmbeddings(chunks) {
    if (!this.options.generateEmbeddings) {
      return chunks.map(() => null);
    }

    const texts = chunks.map(chunk => chunk.content);
    
    try {
      const embeddings = await this.nomicEmbeddings.embedBatch(texts);
      
      if (embeddings.length !== chunks.length) {
        throw new Error(`Embedding count mismatch: expected ${chunks.length}, got ${embeddings.length}`);
      }
      
      return embeddings;
    } catch (error) {
      throw new Error(`Embedding generation failed: ${error.message}`);
    }
  }

  /**
   * Index vectors in Qdrant using workspace-specific collection
   * Each workspace gets its own Qdrant collection for optimal performance and isolation
   * Collection naming: semantic_content_{workspace_name}
   */
  async indexVectors(chunks, documentId, workspace = 'default') {
    if (!this.options.indexVectors) {
      return chunks.map(() => null);
    }

    try {
      // Ensure workspace-specific Qdrant collection exists
      const workspaceCollectionName = await this.ensureQdrantCollection(workspace);
      
      console.log(`[DocumentIndexer] Indexing ${chunks.length} vectors in workspace collection: ${workspaceCollectionName}`);

      const points = chunks.map((chunk, index) => {
        if (!chunk.embedding) {
          throw new Error(`Chunk ${index} missing embedding`);
        }
        
        // Generate numeric ID for Qdrant (following existing pattern)
        const numericId = Math.floor(Math.random() * 1000000000000) + index;
        const pointId = `doc_${documentId}_chunk_${chunk.chunkIndex}`;
        
        return {
          id: numericId,
          vector: chunk.embedding,
          payload: {
            // Store workspace in payload for filtering (though collection is already workspace-specific)
            workspace: workspace,
            documentId: documentId.toString(),
            chunkIndex: chunk.chunkIndex,
            source: chunk.metadata?.source || 'unknown',
            title: chunk.metadata?.documentTitle || 'unknown',
            contentType: chunk.metadata?.contentType || 'text/plain',
            charStart: chunk.charStart,
            charEnd: chunk.charEnd,
            headings: chunk.metadata?.headings || [],
            indexedAt: new Date().toISOString(),
            stringId: pointId  // Store string ID in payload
          }
        };
      });

      // Index into workspace-specific collection
      await this.qdrantClient.upsert(workspaceCollectionName, {
        wait: true,
        points: points
      });

      console.log(`[DocumentIndexer] Successfully indexed ${points.length} vectors in ${workspaceCollectionName}`);
      return points.map(point => point.payload.stringId);
    } catch (error) {
      throw new Error(`Vector indexing failed for workspace ${workspace}: ${error.message}`);
    }
  }

  /**
   * Clear all indexed documents
   */
  async clearIndex() {
    await this.initialize();
    
    try {
      // Clear MongoDB collections
      const dbClearResult = await this.databaseSchema.clearAll();
      
      // Clear Qdrant collection
      await this.qdrantClient.delete(this.options.qdrantCollection, {
        filter: {
          must: [] // Matches all points
        }
      });
      
      // Reset statistics
      this.stats = {
        documentsProcessed: 0,
        chunksCreated: 0,
        embeddingsGenerated: 0,
        vectorsIndexed: 0,
        totalProcessingTime: 0,
        totalEmbeddingTime: 0,
        totalIndexingTime: 0
      };
      
      return {
        documentsCleared: dbClearResult.documentsDeleted,
        chunksCleared: dbClearResult.chunksDeleted,
        vectorsCleared: true
      };
    } catch (error) {
      throw new Error(`Failed to clear index: ${error.message}`);
    }
  }

  /**
   * Get indexing statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      initialized: this.initialized,
      qdrantCollection: this.options.qdrantCollection
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.nomicEmbeddings) {
      await this.nomicEmbeddings.close();
    }
    
    this.initialized = false;
  }
}