/**
 * HandleSemanticSearchManager - Main orchestrator for handle semantic search
 *
 * Coordinates metadata extraction, gloss generation, vector storage, and search
 */

export class HandleSemanticSearchManager {
  /**
   * Create HandleSemanticSearchManager
   * @param {ResourceManager} resourceManager - ResourceManager instance
   * @param {HandleMetadataExtractor} metadataExtractor - Metadata extractor
   * @param {HandleGlossGenerator} glossGenerator - Gloss generator
   * @param {HandleVectorStore} vectorStore - Vector storage
   */
  constructor(resourceManager, metadataExtractor, glossGenerator, vectorStore) {
    if (!resourceManager) {
      throw new Error('ResourceManager is required for HandleSemanticSearchManager');
    }
    if (!metadataExtractor) {
      throw new Error('MetadataExtractor is required for HandleSemanticSearchManager');
    }
    if (!glossGenerator) {
      throw new Error('GlossGenerator is required for HandleSemanticSearchManager');
    }
    if (!vectorStore) {
      throw new Error('VectorStore is required for HandleSemanticSearchManager');
    }

    this.resourceManager = resourceManager;
    this.metadataExtractor = metadataExtractor;
    this.glossGenerator = glossGenerator;
    this.vectorStore = vectorStore;
  }

  /**
   * Store/index a handle with generated glosses
   * @param {Handle|string} handle - Handle instance or URI
   * @param {Object} options - Indexing options
   * @returns {Promise<Object>} Indexing result
   */
  async storeHandle(handle, options = {}) {
    // Convert URI to handle if needed
    let handleInstance = handle;
    let handleURI;

    if (typeof handle === 'string') {
      handleURI = handle;
      handleInstance = await this.resourceManager.createHandleFromURI(handle);
    } else {
      handleURI = handle.uri;
    }

    // Extract metadata from handle
    const metadata = await this.metadataExtractor.extractMetadata(handleInstance);

    // Generate glosses from metadata
    const glosses = await this.glossGenerator.generateGlosses(metadata);

    // Store in vector database and MongoDB
    const storeResult = await this.vectorStore.storeHandle(handleURI, metadata, glosses);

    return {
      success: storeResult.success,
      handleURI,
      vectorIds: storeResult.vectorIds,
      mongoId: storeResult.mongoId,
      glossCount: glosses.length
    };
  }

  /**
   * Search for handles using semantic similarity
   * @param {string} query - Natural language search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Formatted search results
   */
  async searchHandles(query, options = {}) {
    const {
      limit = 10,
      threshold = 0.7,
      handleTypes = null,
      server = null
    } = options;

    // Build search options
    const searchOptions = { limit };

    // Add filters if specified
    if (handleTypes || server || threshold) {
      searchOptions.filter = { must: [] };

      if (handleTypes) {
        searchOptions.filter.must.push({
          key: 'handle_type',
          match: { any: handleTypes }
        });
      }

      if (server) {
        searchOptions.filter.must.push({
          key: 'server',
          match: { value: server }
        });
      }
    }

    // Search vectors
    const vectorResults = await this.vectorStore.searchSimilar(query, searchOptions);

    // Enrich results with full handle records
    const enrichedResults = [];
    for (const vectorResult of vectorResults) {
      // Skip results below threshold
      if (threshold && vectorResult.similarity < threshold) {
        continue;
      }

      const handleRecord = await this.vectorStore.getHandleRecord(vectorResult.handleURI);

      if (handleRecord) {
        enrichedResults.push({
          handleURI: vectorResult.handleURI,
          handleType: handleRecord.handleType,
          similarity: vectorResult.similarity,
          matchedGloss: {
            type: vectorResult.glossType || 'unknown',
            content: vectorResult.description,
            keywords: vectorResult.keywords || []
          },
          metadata: handleRecord.metadata,
          indexed_at: handleRecord.indexed_at
        });
      }
    }

    return {
      query,
      results: enrichedResults,
      totalResults: enrichedResults.length
    };
  }

  /**
   * Recall handles using semantic search - returns instantiated handles
   * This is the primary recall interface: search semantically and get working handle instances
   * @param {string} query - Natural language search query
   * @param {Object} options - Search options (same as searchHandles)
   * @returns {Promise<Array>} Array of { searchResult, handle } objects
   */
  async recallHandles(query, options = {}) {
    // First, search for matching handles
    const searchResults = await this.searchHandles(query, options);

    // Then instantiate each handle
    const recalledHandles = [];
    for (const result of searchResults.results) {
      try {
        const handle = await this.resourceManager.createHandleFromURI(result.handleURI);
        recalledHandles.push({
          searchResult: result,
          handle: handle,
          handleURI: result.handleURI,
          similarity: result.similarity,
          handleType: result.handleType
        });
      } catch (err) {
        // Skip handles that can't be instantiated (might have been deleted)
        console.warn(`Failed to instantiate handle ${result.handleURI}:`, err.message);
      }
    }

    return recalledHandles;
  }

  /**
   * Restore handle from URI
   * @param {string} handleURI - Legion URI
   * @returns {Promise<Handle>} Restored handle instance
   */
  async restoreHandle(handleURI) {
    return await this.resourceManager.createHandleFromURI(handleURI);
  }

  /**
   * Get detailed information about indexed handle
   * @param {string} handleURI - Legion URI
   * @returns {Promise<Object>} Handle information and glosses
   */
  async getHandleInfo(handleURI) {
    return await this.vectorStore.getHandleRecord(handleURI);
  }

  /**
   * Update glosses for an existing handle
   * Re-extracts metadata, regenerates glosses, and updates both storages
   * @param {string} handleURI - Legion URI
   * @param {Object} options - Update options
   * @returns {Promise<Object>} Update result
   */
  async updateGlosses(handleURI, options = {}) {
    // Get the handle instance
    const handleInstance = await this.resourceManager.createHandleFromURI(handleURI);

    // Re-extract metadata
    const metadata = await this.metadataExtractor.extractMetadata(handleInstance);

    // Regenerate glosses
    const glosses = await this.glossGenerator.generateGlosses(metadata);

    // Delete old vectors first
    await this.vectorStore.deleteVectors(handleURI);

    // Store new vectors and metadata
    const storeResult = await this.vectorStore.storeHandle(handleURI, metadata, glosses);

    return {
      success: storeResult.success,
      handleURI,
      vectorIds: storeResult.vectorIds,
      mongoId: storeResult.mongoId,
      glossCount: glosses.length,
      updated: true
    };
  }

  /**
   * Remove handle from semantic search index
   * @param {string} handleURI - Legion URI
   * @returns {Promise<Object>} Removal result
   */
  async removeHandle(handleURI) {
    return await this.vectorStore.deleteVectors(handleURI);
  }
}