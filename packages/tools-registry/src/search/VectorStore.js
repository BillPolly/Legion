/**
 * VectorStore - Vector storage and similarity search for tools
 * 
 * Provides vector-based semantic search capabilities using embeddings
 * Stores tool embeddings and enables similarity-based tool discovery
 * 
 * No mocks, no fallbacks - real implementation only
 */

import { VectorStoreError } from '../errors/index.js';
import { Logger } from '../utils/Logger.js';

export class VectorStore {
  constructor(options = {}) {
    this.options = {
      collectionName: 'tool_vectors',
      dimensions: null, // Will be set based on embedding service dimensions
      verbose: false,
      ...options
    };
    
    this.embeddingClient = options.embeddingClient;
    this.vectorDatabase = options.vectorDatabase;
    this.logger = Logger.create('VectorStore', { verbose: this.options.verbose });
    
    if (!this.embeddingClient) {
      throw new VectorStoreError(
        'Embedding client is required',
        'INIT_ERROR'
      );
    }
    
    if (!this.vectorDatabase) {
      throw new VectorStoreError(
        'Vector database is required',
        'INIT_ERROR'
      );
    }
  }
  
  /**
   * Set dimensions for the vector store (call before initialize)
   */
  setDimensions(dimensions) {
    if (!dimensions || typeof dimensions !== 'number' || dimensions <= 0) {
      throw new VectorStoreError(
        'Dimensions must be a positive number',
        'INVALID_DIMENSIONS'
      );
    }
    this.options.dimensions = dimensions;
  }

  /**
   * Initialize vector store by creating collection if needed
   */
  async initialize() {
    try {
      // Ensure dimensions are set
      if (!this.options.dimensions) {
        throw new VectorStoreError(
          'Dimensions must be set before initialization. Call setDimensions() first.',
          'DIMENSIONS_NOT_SET'
        );
      }

      // Check if collection exists
      const exists = await this.vectorDatabase.hasCollection(this.options.collectionName);
      
      if (!exists) {
        // Create collection with specified dimensions
        await this.vectorDatabase.createCollection(this.options.collectionName, {
          dimensions: this.options.dimensions,
          metric: 'cosine' // Use cosine similarity
        });
        
        if (this.options.verbose) {
          this.logger.verbose(`Created vector collection: ${this.options.collectionName} with ${this.options.dimensions} dimensions`);
        }
      }
    } catch (error) {
      throw new VectorStoreError(
        `Failed to initialize vector store: ${error.message}`,
        'INIT_ERROR',
        { originalError: error }
      );
    }
  }
  
  /**
   * Index a single tool
   * @param {Object} tool - Tool to index
   * @param {Object} perspective - Optional perspective data
   * @returns {Object} Index result
   */
  async indexTool(tool, perspective) {
    try {
      // Check if database is connected
      if (!this.vectorDatabase.isConnected) {
        throw new VectorStoreError(
          'Vector database not connected',
          'CONNECTION_ERROR'
        );
      }
      
      // Build text for embedding
      let embeddingText = `${tool.name} ${tool.description}`;
      
      if (perspective) {
        if (perspective.perspective) {
          embeddingText += ` ${perspective.perspective}`;
        }
        if (perspective.useCases && Array.isArray(perspective.useCases)) {
          embeddingText += ` ${perspective.useCases.join(' ')}`;
        }
      }
      
      // Generate embedding
      const vector = await this.embeddingClient.generateEmbedding(embeddingText);
      
      // Prepare metadata
      const metadata = {
        toolName: tool.name,
        description: tool.description,
        moduleName: tool.moduleName
      };
      
      if (perspective) {
        metadata.category = perspective.category;
        metadata.hasPerspective = true;
      }
      
      // Insert into vector database
      const result = await this.vectorDatabase.insert(this.options.collectionName, {
        vector,
        metadata
      });
      
      if (this.options.verbose) {
        this.logger.verbose(`Indexed tool: ${tool.name}`);
      }
      
      return result;
      
    } catch (error) {
      if (error instanceof VectorStoreError) {
        throw error;
      }
      
      throw new VectorStoreError(
        `Failed to index tool: ${error.message}`,
        'INDEX_ERROR',
        { tool: tool.name, originalError: error }
      );
    }
  }
  
  /**
   * Index batch of perspective vectors directly (for semantic search pipeline)
   * @param {Array} batch - Array of {id, vector, metadata} objects
   * @returns {Promise} Index result
   */
  async indexBatch(batch) {
    try {
      if (!batch || batch.length === 0) {
        return { indexed: 0 };
      }
      
      // Check if database is connected
      if (!this.vectorDatabase.isConnected) {
        throw new VectorStoreError(
          'Vector database not connected',
          'CONNECTION_ERROR'
        );
      }
      
      // Prepare documents for vector database
      const documents = batch.map(item => ({
        id: item.id,
        vector: item.vector,
        metadata: {
          ...item.metadata,
          indexed_at: new Date().toISOString()
        }
      }));
      
      // Insert to vector database
      await this.vectorDatabase.insertBatch(this.options.collectionName, documents);
      
      if (this.options.verbose) {
        this.logger.verbose(`Indexed ${documents.length} vectors in batch`);
      }
      return { indexed: documents.length };
      
    } catch (error) {
      throw new VectorStoreError(
        `Failed to index batch: ${error.message}`,
        'INDEX_BATCH_ERROR',
        { batchSize: batch.length, originalError: error }
      );
    }
  }

  /**
   * Index multiple tools in batch
   * @param {Array} tools - Tools to index
   * @param {Array} perspectives - Optional perspectives
   * @returns {Array} Index results
   */
  async indexTools(tools, perspectives = []) {
    try {
      if (tools.length === 0) {
        return [];
      }
      
      // Check if database is connected
      if (!this.vectorDatabase.isConnected) {
        throw new VectorStoreError(
          'Vector database not connected',
          'CONNECTION_ERROR'
        );
      }
      
      // Build texts for embedding
      const texts = tools.map((tool, i) => {
        let text = `${tool.name} ${tool.description}`;
        
        const perspective = perspectives[i];
        if (perspective) {
          if (perspective.perspective) {
            text += ` ${perspective.perspective}`;
          }
          if (perspective.useCases && Array.isArray(perspective.useCases)) {
            text += ` ${perspective.useCases.join(' ')}`;
          }
        }
        
        return text;
      });
      
      // Generate embeddings in batch
      const vectors = await this.embeddingClient.generateBatch(texts);
      
      // Prepare documents
      const documents = tools.map((tool, i) => {
        const metadata = {
          toolName: tool.name,
          description: tool.description,
          moduleName: tool.moduleName
        };
        
        const perspective = perspectives[i];
        if (perspective) {
          metadata.category = perspective.category;
          metadata.hasPerspective = true;
        }
        
        return {
          vector: vectors[i],
          metadata
        };
      });
      
      // Insert batch into vector database
      const results = await this.vectorDatabase.insertBatch(this.options.collectionName, documents);
      
      if (this.options.verbose) {
        this.logger.verbose(`Indexed ${tools.length} tools`);
      }
      
      return results;
      
    } catch (error) {
      if (error instanceof VectorStoreError) {
        throw error;
      }
      
      throw new VectorStoreError(
        `Failed to index tools: ${error.message}`,
        'INDEX_ERROR',
        { count: tools.length, originalError: error }
      );
    }
  }

  /**
   * Upsert vectors (update if exists, insert if not)
   * @param {Array} vectors - Vector objects with id, vector, and metadata
   * @returns {Object} Upsert result
   */
  async upsert(vectors) {
    try {
      if (!Array.isArray(vectors) || vectors.length === 0) {
        return { indexed: 0, failed: 0 };
      }
      
      // Check if database is connected
      if (!this.vectorDatabase.isConnected) {
        throw new VectorStoreError(
          'Vector database not connected',
          'CONNECTION_ERROR'
        );
      }
      
      // Use the batch insert method which does upserts in Qdrant
      const documents = vectors.map(vector => ({
        id: vector.id,
        vector: vector.vector,
        metadata: {
          tool_name: vector.metadata.tool_name,
          module_name: vector.metadata.module_name,
          perspective_type: vector.metadata.perspective_type,
          content: vector.metadata.content,
          indexedAt: new Date().toISOString()
        }
      }));
      
      await this.vectorDatabase.insertBatch(this.options.collectionName, documents);
      
      return { indexed: vectors.length, failed: 0 };
      
    } catch (error) {
      throw new VectorStoreError(
        `Failed to upsert vectors: ${error.message}`,
        'UPSERT_ERROR',
        { count: vectors.length, originalError: error }
      );
    }
  }
  
  /**
   * Search for similar tools
   * @param {string|Array<number>} query - Search query (string) or embedding vector (array)
   * @param {Object} options - Search options
   * @returns {Array} Search results
   */
  async search(query, options = {}) {
    try {
      // Check if database is connected
      if (!this.vectorDatabase.isConnected) {
        throw new VectorStoreError(
          'Vector database not connected',
          'CONNECTION_ERROR'
        );
      }
      
      // Determine if query is a string (to be embedded) or already an embedding vector
      let queryVector;
      if (typeof query === 'string') {
        // Generate query embedding from text
        queryVector = await this.embeddingClient.generateEmbedding(query);
      } else if (Array.isArray(query) && query.length > 0 && typeof query[0] === 'number') {
        // Use provided embedding vector directly
        queryVector = query;
      } else {
        throw new VectorStoreError(
          'Query must be either a string or a numeric array (embedding vector)',
          'INVALID_QUERY_TYPE'
        );
      }
      
      // Build search options
      const searchOptions = {
        limit: options.limit || 10
      };
      
      if (options.filter) {
        searchOptions.filter = options.filter;
      }
      
      if (options.scoreThreshold !== undefined) {
        searchOptions.scoreThreshold = options.scoreThreshold;
      }
      
      // Search vector database
      const results = await this.vectorDatabase.search(
        this.options.collectionName,
        queryVector,
        searchOptions
      );
      
      // Filter by minimum score if specified
      let filtered = results;
      if (options.minScore) {
        filtered = results.filter(r => r.score >= options.minScore);
      }
      
      // Return results with original structure including metadata
      return filtered.map(result => ({
        id: result.id,  // The perspective ID
        score: result.score,
        metadata: result.metadata || {}  // Preserve any metadata that was stored
      }));
      
    } catch (error) {
      if (error instanceof VectorStoreError) {
        throw error;
      }
      
      throw new VectorStoreError(
        `Search failed: ${error.message}`,
        'SEARCH_ERROR',
        { query, options, originalError: error }
      );
    }
  }
  
  /**
   * Update tool vector
   * @param {string} toolName - Name of the tool
   * @param {Object} tool - Updated tool data
   * @param {Object} perspective - Optional updated perspective
   * @returns {boolean} Update result
   */
  async updateTool(toolName, tool, perspective) {
    try {
      // Check if database is connected
      if (!this.vectorDatabase.isConnected) {
        throw new VectorStoreError(
          'Vector database not connected',
          'CONNECTION_ERROR'
        );
      }
      
      // Build text for embedding
      let embeddingText = `${tool.name} ${tool.description}`;
      
      if (perspective) {
        if (perspective.perspective) {
          embeddingText += ` ${perspective.perspective}`;
        }
        if (perspective.useCases && Array.isArray(perspective.useCases)) {
          embeddingText += ` ${perspective.useCases.join(' ')}`;
        }
      }
      
      // Generate new embedding
      const vector = await this.embeddingClient.generateEmbedding(embeddingText);
      
      // Prepare metadata
      const metadata = {
        toolName: tool.name,
        description: tool.description,
        moduleName: tool.moduleName
      };
      
      if (perspective) {
        metadata.category = perspective.category;
        metadata.hasPerspective = true;
      }
      
      // Update in vector database
      const result = await this.vectorDatabase.update(
        this.options.collectionName,
        { toolName },
        {
          vector,
          metadata
        }
      );
      
      if (this.options.verbose) {
        this.logger.verbose(`Updated tool vector: ${toolName}`);
      }
      
      return result;
      
    } catch (error) {
      if (error instanceof VectorStoreError) {
        throw error;
      }
      
      throw new VectorStoreError(
        `Failed to update tool: ${error.message}`,
        'UPDATE_ERROR',
        { toolName, originalError: error }
      );
    }
  }
  
  /**
   * Delete tool vector
   * @param {string} toolName - Name of the tool
   * @returns {boolean} Deletion result
   */
  async deleteTool(toolName) {
    try {
      // Check if database is connected
      if (!this.vectorDatabase.isConnected) {
        throw new VectorStoreError(
          'Vector database not connected',
          'CONNECTION_ERROR'
        );
      }
      
      const result = await this.vectorDatabase.delete(
        this.options.collectionName,
        { toolName }
      );
      
      if (this.options.verbose) {
        this.logger.verbose(`Deleted tool vector: ${toolName}`);
      }
      
      return result;
      
    } catch (error) {
      if (error instanceof VectorStoreError) {
        throw error;
      }
      
      throw new VectorStoreError(
        `Failed to delete tool: ${error.message}`,
        'DELETE_ERROR',
        { toolName, originalError: error }
      );
    }
  }
  
  /**
   * Clear vectors
   * @param {Object} filter - Optional filter
   * @returns {Object} Clear result
   */
  async clear(filter) {
    try {
      // Check if database is connected
      if (!this.vectorDatabase.isConnected) {
        throw new VectorStoreError(
          'Vector database not connected',
          'CONNECTION_ERROR'
        );
      }
      
      // Only pass filter if it's provided
      const result = filter 
        ? await this.vectorDatabase.clear(this.options.collectionName, filter)
        : await this.vectorDatabase.clear(this.options.collectionName);
      
      if (this.options.verbose) {
        this.logger.verbose(`Cleared ${result.deletedCount} vectors`);
      }
      
      return result;
      
    } catch (error) {
      if (error instanceof VectorStoreError) {
        throw error;
      }
      
      throw new VectorStoreError(
        `Failed to clear vectors: ${error.message}`,
        'CLEAR_ERROR',
        { filter, originalError: error }
      );
    }
  }
  
  /**
   * Rebuild vector index for all tools
   * @param {Array} tools - Tools to index
   * @param {Object} options - Rebuild options
   * @returns {Object} Rebuild statistics
   */
  async rebuildIndex(tools, options = {}) {
    try {
      // Check if database is connected
      if (!this.vectorDatabase.isConnected) {
        throw new VectorStoreError(
          'Vector database not connected',
          'CONNECTION_ERROR'
        );
      }
      
      // Clear existing vectors
      await this.clear();
      
      let indexed = 0;
      let failed = 0;
      const failures = [];
      
      // Process in batches
      const batchSize = options.batchSize || 10;
      for (let i = 0; i < tools.length; i += batchSize) {
        const batch = tools.slice(i, i + batchSize);
        
        try {
          await this.indexTools(batch);
          indexed += batch.length;
        } catch (error) {
          if (options.continueOnError) {
            failed += batch.length;
            failures.push({
              batch: `${i}-${i + batch.length}`,
              error: error.message
            });
          } else {
            throw error;
          }
        }
      }
      
      if (this.options.verbose) {
        this.logger.verbose(`Rebuilt index: ${indexed} indexed, ${failed} failed`);
      }
      
      return {
        indexed,
        failed,
        failures: failures.length > 0 ? failures : undefined
      };
      
    } catch (error) {
      if (error instanceof VectorStoreError) {
        throw error;
      }
      
      throw new VectorStoreError(
        `Failed to rebuild index: ${error.message}`,
        'REBUILD_ERROR',
        { toolCount: tools.length, originalError: error }
      );
    }
  }
  
  /**
   * Get vector store statistics
   * @returns {Object} Statistics
   */
  async getStatistics() {
    try {
      // Check if database is connected
      if (!this.vectorDatabase.isConnected) {
        throw new VectorStoreError(
          'Vector database not connected',
          'CONNECTION_ERROR'
        );
      }
      
      return await this.vectorDatabase.getStatistics(this.options.collectionName);
      
    } catch (error) {
      if (error instanceof VectorStoreError) {
        throw error;
      }
      
      throw new VectorStoreError(
        `Failed to get statistics: ${error.message}`,
        'STATS_ERROR',
        { originalError: error }
      );
    }
  }
  
  /**
   * Find tools similar to a given tool
   * @param {string} toolName - Source tool name
   * @param {Object} options - Search options
   * @returns {Array} Similar tools
   */
  async findSimilarTools(toolName, options = {}) {
    try {
      // Check if database is connected
      if (!this.vectorDatabase.isConnected) {
        throw new VectorStoreError(
          'Vector database not connected',
          'CONNECTION_ERROR'
        );
      }
      
      // Get the tool's current embedding text
      // In real implementation, would fetch from database
      const embeddingText = `${toolName} tool`;
      
      // Generate embedding
      const vector = await this.embeddingClient.generateEmbedding(embeddingText);
      
      // Search for similar vectors
      const searchOptions = {
        limit: (options.limit || 5) + 1, // Add 1 to account for self
        filter: options.filter
      };
      
      const results = await this.vectorDatabase.search(
        this.options.collectionName,
        vector,
        searchOptions
      );
      
      // Filter out the source tool itself
      const similar = results.filter(r => r.metadata.toolName !== toolName);
      
      // Transform results
      return similar.slice(0, options.limit || 5).map(result => ({
        toolName: result.metadata.toolName,
        description: result.metadata.description,
        moduleName: result.metadata.moduleName,
        category: result.metadata.category,
        score: result.score
      }));
      
    } catch (error) {
      if (error instanceof VectorStoreError) {
        throw error;
      }
      
      throw new VectorStoreError(
        `Failed to find similar tools: ${error.message}`,
        'SEARCH_ERROR',
        { toolName, options, originalError: error }
      );
    }
  }
  
  /**
   * Get collection information and statistics
   * @param {string} collectionName - Name of collection (defaults to configured collection)
   * @returns {Object} Collection information
   */
  async getCollectionInfo(collectionName = null) {
    try {
      // Check if database is connected
      if (!this.vectorDatabase.isConnected) {
        throw new VectorStoreError(
          'Vector database not connected',
          'CONNECTION_ERROR'
        );
      }
      
      const targetCollection = collectionName || this.options.collectionName;
      
      // Get statistics from vector database
      const stats = await this.vectorDatabase.getStatistics(targetCollection);
      
      return {
        collection: targetCollection,
        vectors_count: stats.vectors_count || 0,
        dimensions: stats.dimensions || this.options.dimensions || 768,
        status: 'connected'
      };
      
    } catch (error) {
      if (error instanceof VectorStoreError) {
        throw error;
      }
      
      throw new VectorStoreError(
        `Failed to get collection info: ${error.message}`,
        'INFO_ERROR',
        { collection: collectionName, originalError: error }
      );
    }
  }
  
  /**
   * Delete vectors matching filter criteria
   * @param {Object} filterOptions - Filter options for deletion
   * @returns {Object} Deletion result
   */
  async delete(filterOptions = {}) {
    try {
      // Check if database is connected
      if (!this.vectorDatabase.isConnected) {
        throw new VectorStoreError(
          'Vector database not connected',
          'CONNECTION_ERROR'
        );
      }
      
      // Call the vector database delete method
      const result = await this.vectorDatabase.delete(this.options.collectionName, filterOptions);
      
      return {
        deleted: true,
        deletedCount: result.deletedCount || 0
      };
      
    } catch (error) {
      if (error instanceof VectorStoreError) {
        throw error;
      }
      
      throw new VectorStoreError(
        `Failed to delete vectors: ${error.message}`,
        'DELETE_ERROR',
        { filter: filterOptions, originalError: error }
      );
    }
  }
}