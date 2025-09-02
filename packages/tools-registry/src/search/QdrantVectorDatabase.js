/**
 * QdrantVectorDatabase - Concrete implementation of vector database interface for Qdrant
 * 
 * Wraps the Qdrant client to provide consistent interface for VectorStore
 * Handles tool perspective storage with proper metadata linking
 * 
 * No mocks, no fallbacks - real Qdrant implementation only
 */

import { VectorDatabaseError } from '../errors/index.js';

export class QdrantVectorDatabase {
  constructor(qdrantClient, options = {}) {
    if (!qdrantClient) {
      throw new VectorDatabaseError(
        'QdrantClient is required',
        'INIT_ERROR'
      );
    }

    this.client = qdrantClient;
    this.options = {
      dimensions: 768,  // Default for Nomic embeddings
      indexType: 'hnsw',
      distance: 'cosine',
      ...options
    };

    this.isConnected = true;
  }

  /**
   * Create a collection in Qdrant
   * @param {string} collectionName - Name of collection to create
   * @param {Object} options - Collection options
   * @returns {boolean} Success status
   */
  async createCollection(collectionName, options = {}) {
    try {
      const config = {
        ...this.options,
        ...options
      };

      await this.client.createCollection(collectionName, {
        vectors: {
          size: config.dimensions,
          distance: config.distance === 'cosine' ? 'Cosine' : config.distance  // Qdrant expects capitalized
        }
      });

      return true;

    } catch (error) {
      // Collection might already exist
      if (error.message && error.message.includes('already exists')) {
        return true;
      }

      throw new VectorDatabaseError(
        `Failed to create collection ${collectionName}: ${error.message}`,
        'CREATE_COLLECTION_ERROR',
        error
      );
    }
  }

  /**
   * Check if collection exists
   * @param {string} collectionName - Name of collection to check
   * @returns {boolean} True if collection exists
   */
  async hasCollection(collectionName) {
    try {
      const collections = await this.client.getCollections();
      return collections.collections.some(c => c.name === collectionName);

    } catch (error) {
      throw new VectorDatabaseError(
        `Failed to check collection ${collectionName}: ${error.message}`,
        'CHECK_COLLECTION_ERROR',
        error
      );
    }
  }

  /**
   * Insert a single vector point
   * @param {string} collectionName - Collection name
   * @param {Object} doc - Document with vector and metadata
   * @returns {Object} Result with id
   */
  async insert(collectionName, doc) {
    try {
      const { vector, metadata = {} } = doc;
      
      if (!vector || !Array.isArray(vector)) {
        throw new VectorDatabaseError(
          'Vector is required and must be an array',
          'INVALID_VECTOR'
        );
      }

      const pointId = Math.floor(Math.random() * 1000000000000); // Use integer ID for Qdrant
      
      const point = {
        id: pointId,
        vector: vector,
        payload: {
          ...metadata,
          insertedAt: new Date().toISOString()
        }
      };

      await this.client.upsert(collectionName, {
        wait: true,
        points: [point]
      });

      return { id: pointId, ...doc };

    } catch (error) {
      throw new VectorDatabaseError(
        `Failed to insert point: ${error.message}`,
        'INSERT_ERROR',
        error
      );
    }
  }

  /**
   * Insert multiple vector points in batch
   * @param {string} collectionName - Collection name
   * @param {Array} docs - Array of documents with vectors and metadata
   * @returns {Array} Results with ids
   */
  async insertBatch(collectionName, docs) {
    try {
      if (!Array.isArray(docs) || docs.length === 0) {
        return [];
      }

      const points = docs.map((doc, index) => {
        const { vector, metadata = {} } = doc;
        
        if (!vector || !Array.isArray(vector)) {
          throw new VectorDatabaseError(
            `Vector is required and must be an array at index ${index}`,
            'INVALID_VECTOR'
          );
        }

        const pointId = Math.floor(Math.random() * 1000000000000) + index; // Use integer ID for Qdrant
        
        return {
          id: pointId,
          vector: vector,
          payload: {
            ...metadata,
            insertedAt: new Date().toISOString(),
            batchIndex: index
          }
        };
      });

      await this.client.upsert(collectionName, {
        wait: true,
        points: points
      });

      return points.map((point, index) => ({
        id: point.id,
        ...docs[index]
      }));

    } catch (error) {
      throw new VectorDatabaseError(
        `Failed to insert batch: ${error.message}`,
        'INSERT_BATCH_ERROR',
        error
      );
    }
  }

  /**
   * Search for similar vectors
   * @param {string} collectionName - Collection name
   * @param {Array} vector - Query vector
   * @param {Object} options - Search options
   * @returns {Array} Search results with scores and metadata
   */
  async search(collectionName, vector, options = {}) {
    try {
      const {
        limit = 10,
        scoreThreshold = 0.0,
        filter = null,
        withPayload = true,
        withVector = false
      } = options;

      if (!vector || !Array.isArray(vector)) {
        throw new VectorDatabaseError(
          'Query vector is required and must be an array',
          'INVALID_QUERY_VECTOR'
        );
      }

      const searchParams = {
        vector: vector,
        limit: limit,
        score_threshold: scoreThreshold,
        with_payload: withPayload,
        with_vector: withVector
      };

      // Add filter if provided
      if (filter && Object.keys(filter).length > 0) {
        searchParams.filter = {
          must: Object.entries(filter).map(([key, value]) => ({
            key: key,
            match: { value: value }
          }))
        };
      }

      const searchResult = await this.client.search(collectionName, searchParams);

      // Fix: Handle undefined searchResult or invalid results
      if (!searchResult || !Array.isArray(searchResult)) {
        console.warn(`[QdrantVectorDatabase] Invalid search result: ${typeof searchResult}`);
        return [];
      }

      return searchResult.map((result, idx) => {
        if (!result) {
          console.warn(`[QdrantVectorDatabase] Undefined result at index ${idx}`);
          return null;
        }
        
        return {
          id: result.id,
          score: result.score,
          metadata: result.payload || {},
          vector: result.vector || null
        };
      }).filter(result => result !== null);

    } catch (error) {
      throw new VectorDatabaseError(
        `Failed to search: ${error.message}`,
        'SEARCH_ERROR',
        error
      );
    }
  }

  /**
   * Update vector points by filter
   * @param {string} collectionName - Collection name
   * @param {Object} filter - Filter criteria
   * @param {Object} doc - Updated document
   * @returns {boolean} Success status
   */
  async update(collectionName, filter, doc) {
    try {
      // For Qdrant, we need to search for points first, then update them
      const searchResults = await this.search(collectionName, doc.vector, {
        filter: filter,
        limit: 1000  // Get all matching points
      });

      if (searchResults.length === 0) {
        return false;
      }

      const pointsToUpdate = searchResults.map(result => {
        const { vector, metadata = {} } = doc;
        
        return {
          id: result.id,
          vector: vector,
          payload: {
            ...result.metadata,
            ...metadata,
            updatedAt: new Date().toISOString()
          }
        };
      });

      await this.client.upsert(collectionName, {
        wait: true,
        points: pointsToUpdate
      });

      return true;

    } catch (error) {
      throw new VectorDatabaseError(
        `Failed to update points: ${error.message}`,
        'UPDATE_ERROR',
        error
      );
    }
  }

  /**
   * Delete points by filter
   * @param {string} collectionName - Collection name
   * @param {Object} filterOptions - Filter criteria
   * @returns {boolean} Success status
   */
  async delete(collectionName, filterOptions) {
    try {
      // Convert our filter format to Qdrant filter format
      const qdrantFilter = this._buildQdrantFilter(filterOptions);

      await this.client.delete(collectionName, {
        wait: true,
        filter: qdrantFilter
      });

      return true;

    } catch (error) {
      throw new VectorDatabaseError(
        `Failed to delete points: ${error.message}`,
        'DELETE_ERROR',
        error
      );
    }
  }

  /**
   * Clear collection or points by filter
   * @param {string} collectionName - Collection name
   * @param {Object} filter - Optional filter for selective clearing
   * @returns {Object} Result with deletion count
   */
  async clear(collectionName, filter = null) {
    try {
      if (filter && Object.keys(filter).length > 0) {
        // Selective clearing - count points first
        const points = await this.search(collectionName, new Array(this.options.dimensions).fill(0), {
          filter: filter,
          limit: 10000,
          withPayload: true,
          withVector: false
        });

        if (points.length > 0) {
          await this.delete(collectionName, filter);
        }

        return { deletedCount: points.length };
      } else {
        // Clear entire collection - get count first
        const info = await this.getStatistics(collectionName);
        const vectorCount = info.vectors_count || 0;

        // Delete all points - use proper filter structure for Qdrant
        await this.client.delete(collectionName, {
          wait: true,
          filter: {
            must: [] // Empty must condition matches all points
          }
        });

        return { deletedCount: vectorCount };
      }

    } catch (error) {
      throw new VectorDatabaseError(
        `Failed to clear collection: ${error.message}`,
        'CLEAR_ERROR',
        error
      );
    }
  }

  /**
   * Get collection statistics
   * @param {string} collectionName - Collection name
   * @returns {Object} Statistics
   */
  async getStatistics(collectionName) {
    try {
      const info = await this.client.getCollection(collectionName);
      
      return {
        vectors_count: info.points_count || 0,  // Use points_count instead of vectors_count
        dimensions: this.options.dimensions,
        indexType: this.options.indexType,
        distance: this.options.distance,
        status: info.status || 'unknown',  // Fix: Handle undefined status
        optimizer_status: info.optimizer_status || 'unknown'  // Fix: Handle undefined optimizer_status
      };

    } catch (error) {
      throw new VectorDatabaseError(
        `Failed to get statistics: ${error.message}`,
        'STATS_ERROR',
        error
      );
    }
  }

  /**
   * Build Qdrant filter from simple key-value object
   * @param {Object} filter - Simple filter object
   * @returns {Object} Qdrant filter object
   */
  _buildQdrantFilter(filter) {
    if (!filter || Object.keys(filter).length === 0) {
      return {};
    }

    const conditions = Object.entries(filter).map(([key, value]) => ({
      key: key,
      match: { value: value }
    }));

    return {
      must: conditions
    };
  }

  /**
   * Test connection to Qdrant
   * @returns {boolean} Connection status
   */
  async testConnection() {
    try {
      await this.client.getCollections();
      this.isConnected = true;
      return true;
    } catch (error) {
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Close connection and cleanup
   */
  async close() {
    // Qdrant client doesn't require explicit closing
    this.isConnected = false;
  }
}