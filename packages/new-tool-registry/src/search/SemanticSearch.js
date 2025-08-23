/**
 * SemanticSearch - Semantic search using vector embeddings and hybrid search
 * 
 * Provides semantic search capabilities by combining:
 * - Vector search using embeddings
 * - Text-based search using MongoDB
 * - Hybrid scoring combining both approaches
 * 
 * Uses ResourceManager pattern for dependency injection
 * No mocks, no fallbacks - real implementation only
 */

import { SemanticSearchError } from '../errors/index.js';
import { LRUCache } from '../utils/LRUCache.js';

export class SemanticSearch {
  constructor({ resourceManager, options = {} }) {
    if (!resourceManager) {
      throw new SemanticSearchError(
        'ResourceManager is required',
        'INIT_ERROR'
      );
    }

    this.resourceManager = resourceManager;
    this.options = {
      vectorCollection: 'perspectives',  // Default vector collection name
      topK: 20,                         // Default number of results
      similarityThreshold: 0.7,         // Minimum similarity score
      hybridWeight: 0.6,               // Weight for semantic vs text search (0.6 = 60% semantic, 40% text)
      enableCaching: true,             // Enable query embedding caching
      cacheSize: 1000,                 // Cache size for query embeddings
      ...options
    };

    // Dependencies - initialized in initialize()
    this.embeddingService = null;
    this.vectorStore = null;
    this.databaseStorage = null;
    this.initialized = false;

    // Query embedding cache
    this.queryCache = this.options.enableCaching 
      ? new LRUCache({ maxSize: this.options.cacheSize })
      : null;

    // Search statistics
    this.stats = {
      totalQueries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalSearchTime: 0
    };
  }

  /**
   * Initialize the service by getting dependencies from ResourceManager
   */
  async initialize() {
    if (this.initialized) return;

    // Get embedding service from resource manager
    this.embeddingService = this.resourceManager.get('embeddingService');
    if (!this.embeddingService) {
      throw new SemanticSearchError(
        'EmbeddingService not available from ResourceManager',
        'INIT_ERROR'
      );
    }

    // Get vector store from resource manager
    this.vectorStore = this.resourceManager.get('vectorStore');
    if (!this.vectorStore) {
      throw new SemanticSearchError(
        'VectorStore not available from ResourceManager',
        'INIT_ERROR'
      );
    }

    // Get database storage from resource manager
    this.databaseStorage = this.resourceManager.get('databaseStorage');
    if (!this.databaseStorage) {
      throw new SemanticSearchError(
        'DatabaseStorage not available from ResourceManager',
        'INIT_ERROR'
      );
    }

    // Initialize dependencies
    await this.embeddingService.initialize();
    await this.vectorStore.initialize();

    // Verify dependencies are working
    if (!this.embeddingService.isInitialized()) {
      throw new SemanticSearchError(
        'EmbeddingService failed to initialize',
        'DEPENDENCY_ERROR'
      );
    }

    // VectorStore doesn't have isConnected method - check via vectorDatabase property
    if (!this.vectorStore.vectorDatabase || !this.vectorStore.vectorDatabase.isConnected) {
      throw new SemanticSearchError(
        'VectorStore is not connected',
        'DEPENDENCY_ERROR'
      );
    }

    this.initialized = true;
  }

  /**
   * Perform semantic search using vector similarity
   * @param {string} queryText - Text to search for
   * @param {Object} options - Search options
   * @returns {Array} Array of search results with tools and scores
   */
  async searchSemantic(queryText, options = {}) {
    if (!this.initialized) {
      throw new SemanticSearchError(
        'SemanticSearch not initialized',
        'NOT_INITIALIZED'
      );
    }

    const startTime = Date.now();
    this.stats.totalQueries++;

    try {
      // Validate input
      this._validateQueryText(queryText);

      // Get search options
      const searchOptions = {
        topK: options.topK || this.options.topK,
        similarityThreshold: options.similarityThreshold || this.options.similarityThreshold
      };

      // Generate or retrieve cached query embedding
      const queryEmbedding = await this._getQueryEmbedding(queryText);

      // Check if vector store is still available (may be null after shutdown)
      if (!this.vectorStore) {
        throw new SemanticSearchError(
          'VectorStore not available - service may be shutting down',
          'SERVICE_UNAVAILABLE'
        );
      }

      // Search vector store
      const vectorResults = await this.vectorStore.search(queryEmbedding, {
        limit: searchOptions.topK,
        scoreThreshold: searchOptions.similarityThreshold
      });

      // Convert vector results to semantic search results
      const semanticResults = await this._processVectorResults(vectorResults);

      // Update statistics
      this.stats.totalSearchTime += Date.now() - startTime;

      // Ensure we respect topK limit (in case vector store returned more)
      return semanticResults.slice(0, searchOptions.topK);

    } catch (error) {
      if (error instanceof SemanticSearchError) {
        throw error;
      }

      throw new SemanticSearchError(
        `Semantic search failed: ${error.message}`,
        'SEARCH_ERROR',
        error
      );
    }
  }

  /**
   * Perform hybrid search combining semantic and text search
   * @param {string} queryText - Text to search for
   * @param {Object} options - Search options
   * @returns {Array} Array of hybrid search results
   */
  async searchHybrid(queryText, options = {}) {
    if (!this.initialized) {
      throw new SemanticSearchError(
        'SemanticSearch not initialized',
        'NOT_INITIALIZED'
      );
    }

    try {
      // Validate input
      this._validateQueryText(queryText);

      const searchOptions = {
        topK: options.topK || this.options.topK,
        hybridWeight: options.hybridWeight || this.options.hybridWeight
      };

      // Perform both searches concurrently
      const [semanticResults, textResults] = await Promise.all([
        this.searchSemantic(queryText, options),
        this.searchByText(queryText, options)
      ]);

      // Combine and score results
      const hybridResults = this._combineHybridResults(
        semanticResults,
        textResults,
        searchOptions.hybridWeight
      );

      // Limit results and return
      return hybridResults.slice(0, searchOptions.topK);

    } catch (error) {
      if (error instanceof SemanticSearchError) {
        throw error;
      }

      throw new SemanticSearchError(
        `Hybrid search failed: ${error.message}`,
        'HYBRID_SEARCH_ERROR',
        error
      );
    }
  }

  /**
   * Perform text-based search using database
   * @param {string} queryText - Text to search for
   * @param {Object} options - Search options
   * @returns {Array} Array of text search results
   */
  async searchByText(queryText, options = {}) {
    if (!this.databaseStorage || !this.databaseStorage.isConnected) {
      throw new SemanticSearchError(
        'Database not connected',
        'DATABASE_ERROR'
      );
    }

    try {
      // Validate input
      this._validateQueryText(queryText);

      const collection = this.databaseStorage.getCollection('tools');
      
      // Create text search query
      const searchQuery = this._createTextSearchQuery(queryText);
      
      // Execute search
      const results = await collection.find(searchQuery).toArray();

      // Score and rank results
      const scoredResults = results.map(tool => ({
        ...tool,
        score: this._calculateTextSearchScore(tool, queryText)
      }));

      // Sort by score descending
      scoredResults.sort((a, b) => b.score - a.score);

      return scoredResults;

    } catch (error) {
      throw new SemanticSearchError(
        `Text search failed: ${error.message}`,
        'TEXT_SEARCH_ERROR',
        error
      );
    }
  }

  /**
   * Index tool perspectives as vectors for semantic search
   * @param {string} toolName - Name of the tool
   * @param {Array} perspectives - Array of perspective objects
   */
  async indexToolPerspectives(toolName, perspectives) {
    if (!this.initialized) {
      throw new SemanticSearchError(
        'SemanticSearch not initialized',
        'NOT_INITIALIZED'
      );
    }

    try {
      // Prepare texts for embedding
      const texts = perspectives.map(p => `${p.query} ${p.context}`);
      
      // Generate embeddings
      const embeddings = await this.embeddingService.generateEmbeddings(texts);
      
      // Prepare tools data for vector indexing
      const toolsToIndex = perspectives.map((perspective, index) => ({
        name: `${toolName}_perspective_${index}`,
        description: perspective.query,
        moduleName: toolName
      }));
      
      // Prepare perspectives for vector indexing
      const perspectivesForIndex = perspectives.map((perspective, index) => ({
        perspective: perspective.context,
        category: 'semantic-search',
        useCases: [perspective.query]
      }));

      // Index tools with perspectives using VectorStore
      await this.vectorStore.indexTools(toolsToIndex, perspectivesForIndex);

    } catch (error) {
      throw new SemanticSearchError(
        `Failed to index perspectives for tool ${toolName}: ${error.message}`,
        'INDEX_ERROR',
        error
      );
    }
  }

  /**
   * Remove all vectors for a specific tool
   * @param {string} toolName - Name of the tool to remove vectors for
   */
  async removeToolVectors(toolName) {
    if (!this.initialized) {
      throw new SemanticSearchError(
        'SemanticSearch not initialized',
        'NOT_INITIALIZED'
      );
    }

    try {
      await this.vectorStore.delete({
        filter: {
          must: [{
            key: 'toolName',
            match: { value: toolName }
          }]
        }
      });
    } catch (error) {
      throw new SemanticSearchError(
        `Failed to remove vectors for tool ${toolName}: ${error.message}`,
        'DELETE_ERROR',
        error
      );
    }
  }

  /**
   * Get vector collection statistics
   * @returns {Object} Collection statistics
   */
  async getVectorStats() {
    if (!this.initialized) {
      throw new SemanticSearchError(
        'SemanticSearch not initialized',
        'NOT_INITIALIZED'
      );
    }

    try {
      return await this.vectorStore.getCollectionInfo(this.options.vectorCollection);
    } catch (error) {
      throw new SemanticSearchError(
        `Failed to get vector stats: ${error.message}`,
        'STATS_ERROR',
        error
      );
    }
  }

  /**
   * Get search statistics
   * @returns {Object} Search statistics
   */
  getSearchStats() {
    const totalRequests = this.stats.cacheHits + this.stats.cacheMisses;
    return {
      totalQueries: this.stats.totalQueries,
      cacheHitRate: totalRequests > 0 ? this.stats.cacheHits / totalRequests : 0,
      averageSearchTime: this.stats.totalQueries > 0 
        ? this.stats.totalSearchTime / this.stats.totalQueries 
        : 0
    };
  }

  /**
   * Validate query text
   * @param {string} queryText - Text to validate
   * @throws {SemanticSearchError} If invalid
   */
  _validateQueryText(queryText) {
    if (!queryText || typeof queryText !== 'string') {
      throw new SemanticSearchError(
        'Query text must be a non-empty string',
        'INVALID_INPUT'
      );
    }

    if (queryText.trim().length === 0) {
      throw new SemanticSearchError(
        'Query text cannot be empty or whitespace only',
        'EMPTY_QUERY'
      );
    }
  }

  /**
   * Get query embedding (cached or generated)
   * @param {string} queryText - Query text
   * @returns {Array<number>} Query embedding vector
   */
  async _getQueryEmbedding(queryText) {
    // Check cache first if enabled
    if (this.queryCache) {
      const cacheKey = this._createQueryCacheKey(queryText);
      const cachedEmbedding = this.queryCache.get(cacheKey);
      
      if (cachedEmbedding) {
        this.stats.cacheHits++;
        return cachedEmbedding;
      }
      
      this.stats.cacheMisses++;
      
      // Generate and cache embedding
      const embedding = await this.embeddingService.generateEmbedding(queryText);
      this.queryCache.set(cacheKey, embedding);
      return embedding;
    }

    // Generate embedding without caching
    return await this.embeddingService.generateEmbedding(queryText);
  }

  /**
   * Process vector search results into semantic search results
   * @param {Array} vectorResults - Raw vector search results
   * @returns {Array} Processed semantic search results
   */
  async _processVectorResults(vectorResults) {
    if (!vectorResults || vectorResults.length === 0) {
      return [];
    }

    try {
      // Extract tool names from vector results
      const toolNames = [...new Set(vectorResults.map(r => r.payload?.toolName).filter(Boolean))];
      
      if (toolNames.length === 0) {
        return [];
      }

      // Get tool details from database
      const collection = this.databaseStorage.getCollection('tools');
      const tools = await collection.find({
        name: { $in: toolNames }
      }).toArray();

      // Create tool lookup map
      const toolMap = new Map(tools.map(tool => [tool.name, tool]));

      // Process results
      const results = [];
      for (const vectorResult of vectorResults) {
        const toolName = vectorResult.payload?.toolName;
        const tool = toolMap.get(toolName);
        
        if (tool) {
          results.push({
            tool,
            score: vectorResult.score,
            perspective: vectorResult.payload?.perspective || '',
            context: vectorResult.payload?.context || ''
          });
        }
      }

      return results;

    } catch (error) {
      throw new SemanticSearchError(
        `Failed to process vector results: ${error.message}`,
        'PROCESSING_ERROR',
        error
      );
    }
  }

  /**
   * Combine semantic and text search results with hybrid scoring
   * @param {Array} semanticResults - Semantic search results
   * @param {Array} textResults - Text search results
   * @param {number} semanticWeight - Weight for semantic results (0-1)
   * @returns {Array} Combined hybrid results
   */
  _combineHybridResults(semanticResults, textResults, semanticWeight) {
    const textWeight = 1 - semanticWeight;
    const resultMap = new Map();

    // Process semantic results
    for (const result of semanticResults) {
      const toolName = result.tool.name;
      resultMap.set(toolName, {
        tool: result.tool,
        score: result.score * semanticWeight,
        sources: ['semantic'],
        perspective: result.perspective,
        context: result.context
      });
    }

    // Process text results and combine with existing
    for (const textResult of textResults) {
      const toolName = textResult.name;
      const existing = resultMap.get(toolName);

      if (existing) {
        // Combine scores
        existing.score += textResult.score * textWeight;
        existing.sources.push('text');
      } else {
        // Add new text-only result
        resultMap.set(toolName, {
          tool: textResult,
          score: textResult.score * textWeight,
          sources: ['text'],
          perspective: '',
          context: ''
        });
      }
    }

    // Convert to array and sort by combined score
    const hybridResults = Array.from(resultMap.values());
    hybridResults.sort((a, b) => b.score - a.score);

    return hybridResults;
  }

  /**
   * Create text search query for MongoDB
   * @param {string} queryText - Query text
   * @returns {Object} MongoDB query object
   */
  _createTextSearchQuery(queryText) {
    // Create a text search query that searches across name, description, and other fields
    return {
      $or: [
        { name: { $regex: queryText, $options: 'i' } },
        { description: { $regex: queryText, $options: 'i' } },
        { 'tags': { $in: [new RegExp(queryText, 'i')] } }
      ]
    };
  }

  /**
   * Calculate text search score based on query relevance
   * @param {Object} tool - Tool object
   * @param {string} queryText - Query text
   * @returns {number} Relevance score
   */
  _calculateTextSearchScore(tool, queryText) {
    let score = 0;
    const queryLower = queryText.toLowerCase();

    // Exact name match gets highest score
    if (tool.name && tool.name.toLowerCase() === queryLower) {
      score += 1.0;
    } else if (tool.name && tool.name.toLowerCase().includes(queryLower)) {
      score += 0.8;
    }

    // Description match
    if (tool.description) {
      const descLower = tool.description.toLowerCase();
      if (descLower.includes(queryLower)) {
        // Score based on how early the match appears
        const index = descLower.indexOf(queryLower);
        const earlyBonus = Math.max(0.5, 1.0 - (index / descLower.length));
        score += 0.6 * earlyBonus;
      }
    }

    // Tag matches
    if (tool.tags && Array.isArray(tool.tags)) {
      const matchingTags = tool.tags.filter(tag => 
        tag.toLowerCase().includes(queryLower)
      );
      score += matchingTags.length * 0.3;
    }

    return Math.min(score, 1.0); // Cap at 1.0
  }

  /**
   * Create cache key for query text
   * @param {string} queryText - Query text
   * @returns {string} Cache key
   */
  _createQueryCacheKey(queryText) {
    // Simple hash for cache key
    let hash = 0;
    for (let i = 0; i < queryText.length; i++) {
      const char = queryText.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `query_${Math.abs(hash)}`;
  }

  /**
   * Shutdown the service and cleanup resources
   */
  async shutdown() {
    if (this.embeddingService) {
      await this.embeddingService.shutdown();
    }
    
    // VectorStore doesn't have a shutdown method - it uses the underlying database connection
    // which is managed elsewhere

    if (this.queryCache) {
      this.queryCache.clear();
    }

    this.initialized = false;
    this.embeddingService = null;
    this.vectorStore = null;
    this.databaseStorage = null;
  }
}