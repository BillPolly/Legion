/**
 * HandleVectorStore - Manages vector embeddings and storage
 *
 * Handles embedding generation via Nomic and vector storage in Qdrant.
 * Provides search capabilities for semantic handle discovery.
 */

export class HandleVectorStore {
  /**
   * Create HandleVectorStore
   * @param {ResourceManager} resourceManager - ResourceManager instance for getting handles
   */
  constructor(resourceManager) {
    if (!resourceManager) {
      throw new Error('ResourceManager is required for HandleVectorStore');
    }

    this.resourceManager = resourceManager;
    this.nomicHandle = null;
    this.qdrantHandle = null;
    this.mongoHandle = null;
    this.collectionName = 'handle_vectors';
    this.initialized = false;
  }

  /**
   * Initialize the vector store
   * Gets Nomic, Qdrant, and MongoDB handles from ResourceManager
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    // Get Nomic handle for embeddings
    const nomicURI = 'legion://local/nomic/embed';
    this.nomicHandle = await this.resourceManager.createHandleFromURI(nomicURI);

    // Get Qdrant handle for vector storage
    const qdrantURI = `legion://local/qdrant/collections/${this.collectionName}`;
    this.qdrantHandle = await this.resourceManager.createHandleFromURI(qdrantURI);

    // Get MongoDB handle for metadata storage
    const mongoURI = 'legion://local/mongodb/handle_semantic_search/handle_records';
    this.mongoHandle = await this.resourceManager.createHandleFromURI(mongoURI);

    // Ensure collection exists with correct configuration
    await this._ensureCollection();

    this.initialized = true;
  }

  /**
   * Ensure Qdrant collection exists with correct configuration
   * @private
   */
  async _ensureCollection() {
    try {
      // Check if collection exists
      const exists = await this.qdrantHandle.exists();
      if (!exists) {
        // Collection doesn't exist, create it
        await this.qdrantHandle.createCollection({
          collection_name: this.collectionName,
          vectors: {
            size: 768, // Nomic embedding dimensions
            distance: 'Cosine'
          }
        });
      }
    } catch (error) {
      // If error is not "already exists", rethrow
      if (!error.message.includes('already exists')) {
        throw error;
      }
    }
  }

  /**
   * Generate embedding for text using Nomic
   * @param {string} text - Text to embed
   * @returns {Promise<Array>} 768-dimensional embedding vector
   */
  async generateEmbedding(text) {
    if (!this.initialized) {
      throw new Error('HandleVectorStore not initialized');
    }

    if (!text || typeof text !== 'string') {
      throw new Error('Text is required for embedding generation');
    }

    // Use Nomic handle to generate embedding
    const embedding = await this.nomicHandle.embed(text);
    return embedding;
  }

  /**
   * Store gloss embeddings in Qdrant
   * @param {string} handleURI - Handle URI being indexed
   * @param {Array} glosses - Array of glosses with perspective, description, keywords
   * @returns {Promise<Object>} Storage result with vector IDs
   */
  async storeGlossEmbeddings(handleURI, glosses) {
    if (!this.initialized) {
      throw new Error('HandleVectorStore not initialized');
    }

    if (!handleURI) {
      throw new Error('Handle URI is required');
    }

    if (!Array.isArray(glosses) || glosses.length === 0) {
      throw new Error('Glosses array is required and must not be empty');
    }

    const vectorIds = [];
    const points = [];

    // Generate embeddings for each gloss
    for (let i = 0; i < glosses.length; i++) {
      const gloss = glosses[i];

      // Use integer ID (Qdrant default) - timestamp + random component for uniqueness
      const vectorId = Date.now() * 1000 + Math.floor(Math.random() * 1000);

      // Generate embedding for the gloss description
      const embedding = await this.generateEmbedding(gloss.description);

      // Create point for Qdrant
      points.push({
        id: vectorId,
        vector: embedding,
        payload: {
          handle_uri: handleURI,
          gloss_type: gloss.perspective,
          gloss_description: gloss.description,
          keywords: gloss.keywords || [],
          indexed_at: new Date().toISOString()
        }
      });

      vectorIds.push(vectorId);
    }

    // Upsert all points to Qdrant
    await this.qdrantHandle.upsert(points);

    return {
      success: true,
      vectorIds,
      count: points.length
    };
  }

  /**
   * Search for similar handles using semantic query
   * @param {string} query - Search query text
   * @param {Object} options - Search options (limit, threshold, filters)
   * @returns {Promise<Array>} Search results with similarity scores
   */
  async searchSimilar(query, options = {}) {
    if (!this.initialized) {
      throw new Error('HandleVectorStore not initialized');
    }

    if (!query || typeof query !== 'string') {
      throw new Error('Query text is required for search');
    }

    const {
      limit = 10,
      threshold = 0.0,
      filter = null
    } = options;

    // Generate embedding for query
    const queryEmbedding = await this.generateEmbedding(query);

    // Search Qdrant - use appropriate method based on filter
    let searchResults;
    if (filter) {
      searchResults = await this.qdrantHandle.searchWithFilter(queryEmbedding, filter, limit);
    } else {
      searchResults = await this.qdrantHandle.search(queryEmbedding, limit);
    }

    // Transform results - filter by threshold
    return searchResults
      .filter(result => result.score >= threshold)
      .map(result => ({
        handleURI: result.payload.handle_uri,
        glossType: result.payload.gloss_type,
        description: result.payload.gloss_description,
        keywords: result.payload.keywords || [],
        similarity: result.score,
        vectorId: result.id
      }));
  }

  /**
   * Delete vectors for a handle URI
   * @param {string} handleURI - Handle URI to delete
   * @returns {Promise<Object>} Deletion result
   */
  async deleteVectors(handleURI) {
    if (!this.initialized) {
      throw new Error('HandleVectorStore not initialized');
    }

    if (!handleURI) {
      throw new Error('Handle URI is required');
    }

    // Search for all vectors with this handle URI to get their IDs
    const filter = {
      must: [
        {
          key: 'handle_uri',
          match: { value: handleURI }
        }
      ]
    };

    // Use a dummy vector for filter-only search (we just want IDs)
    const dummyVector = new Array(768).fill(0);
    const results = await this.qdrantHandle.searchWithFilter(dummyVector, filter, 1000);

    // Extract IDs and delete
    if (results && results.length > 0) {
      const ids = results.map(r => r.id);
      await this.qdrantHandle.deletePoints(ids);
    }

    return {
      success: true,
      handleURI,
      deletedCount: results ? results.length : 0
    };
  }

  /**
   * Store complete handle record in MongoDB
   * @param {string} handleURI - Handle URI
   * @param {Object} metadata - Handle metadata
   * @param {Array} glosses - Array of glosses
   * @param {Array} vectorIds - Array of vector IDs from Qdrant
   * @returns {Promise<Object>} Storage result
   */
  async storeHandleRecord(handleURI, metadata, glosses, vectorIds) {
    if (!this.initialized) {
      throw new Error('HandleVectorStore not initialized');
    }

    // Build glosses with vector IDs
    const glossesWithVectors = glosses.map((gloss, index) => ({
      type: gloss.perspective,
      content: gloss.description,
      keywords: gloss.keywords || [],
      vector_id: vectorIds[index]
    }));

    // Build MongoDB document
    const now = new Date().toISOString();
    const document = {
      handleURI,
      handleType: metadata.handleType || 'generic',
      metadata,
      glosses: glossesWithVectors,
      updated_at: now,
      status: 'active',
      vector_collection: this.collectionName
    };

    // Upsert document (update if exists, insert if not) - use DataSource directly
    const result = await this.mongoHandle.dataSource.updateAsync({
      updateOne: {
        filter: { handleURI },
        update: {
          $set: document,
          $setOnInsert: { indexed_at: now }
        },
        options: { upsert: true }
      }
    });

    return {
      success: true,
      mongoId: result.upsertedId || handleURI
    };
  }

  /**
   * Retrieve handle record from MongoDB
   * @param {string} handleURI - Handle URI to retrieve
   * @returns {Promise<Object|null>} Handle record or null if not found
   */
  async getHandleRecord(handleURI) {
    if (!this.initialized) {
      throw new Error('HandleVectorStore not initialized');
    }

    // Use queryAsync to get raw document data (findOne returns a MongoHandle)
    const results = await this.mongoHandle.dataSource.queryAsync({
      findOne: { handleURI }
    });

    if (!results || results.length === 0) {
      return null;
    }

    // Extract the actual document data from the result
    return results[0].data || results[0];
  }

  /**
   * Store handle with coordinated dual storage
   * Stores vectors in Qdrant and metadata in MongoDB
   * @param {string} handleURI - Handle URI
   * @param {Object} metadata - Handle metadata
   * @param {Array} glosses - Array of glosses
   * @returns {Promise<Object>} Storage result with both vector and mongo IDs
   */
  async storeHandle(handleURI, metadata, glosses) {
    if (!this.initialized) {
      throw new Error('HandleVectorStore not initialized');
    }

    // First, store vectors in Qdrant
    const vectorResult = await this.storeGlossEmbeddings(handleURI, glosses);

    // Then, store metadata in MongoDB with vector IDs
    const mongoResult = await this.storeHandleRecord(
      handleURI,
      metadata,
      glosses,
      vectorResult.vectorIds
    );

    return {
      success: true,
      vectorIds: vectorResult.vectorIds,
      mongoId: mongoResult.mongoId
    };
  }
}