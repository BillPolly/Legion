/**
 * SearchTypes - Type definitions and interfaces for semantic search
 * 
 * Defines common types, interfaces, and validation schemas used
 * throughout the semantic search system.
 */

/**
 * Search result with similarity score
 * @typedef {Object} SemanticSearchResult
 * @property {Object} document - The matched document
 * @property {number} _similarity - Similarity score (0-1)
 * @property {string} _searchType - Type of search performed
 * @property {string} [_id] - Document ID
 * @property {Array<number>} [_vector] - Document vector (if requested)
 */

/**
 * Hybrid search result with multiple scores
 * @typedef {Object} HybridSearchResult
 * @extends SemanticSearchResult
 * @property {number} _hybridScore - Combined hybrid score
 * @property {number} _semanticScore - Semantic similarity score
 * @property {number} _keywordScore - Keyword matching score
 */

/**
 * Search options for semantic search
 * @typedef {Object} SemanticSearchOptions
 * @property {number} [limit=10] - Maximum number of results
 * @property {number} [threshold=0.7] - Minimum similarity threshold
 * @property {boolean} [includeMetadata=true] - Include document metadata
 * @property {boolean} [includeVectors=false] - Include embedding vectors
 * @property {Object} [filter={}] - Additional filters to apply
 * @property {boolean} [useCache=true] - Use embedding cache
 * @property {boolean} [exactSearch=false] - Use exact vector search
 */

/**
 * Hybrid search options
 * @typedef {Object} HybridSearchOptions
 * @extends SemanticSearchOptions
 * @property {number} [semanticWeight=0.7] - Weight for semantic score
 * @property {number} [keywordWeight=0.3] - Weight for keyword score
 */

/**
 * Tool document structure for search
 * @typedef {Object} ToolDocument
 * @property {string} name - Tool name
 * @property {string} description - Tool description
 * @property {Object} [parameters] - Tool parameters
 * @property {Object} [inputSchema] - Input schema definition
 * @property {Object} [outputSchema] - Output schema definition
 * @property {string} [module] - Module the tool belongs to
 * @property {string} [category] - Tool category
 * @property {Array<string>} [tags] - Tool tags
 * @property {Array<string>} [examples] - Usage examples
 * @property {Object} [metadata] - Additional metadata
 */

/**
 * Processed tool document with search text
 * @typedef {Object} ProcessedToolDocument
 * @extends ToolDocument
 * @property {string} searchText - Generated search text
 * @property {Array<string>} _processedFields - Fields used for search text
 * @property {Object} _metadata - Processing metadata
 * @property {string} _processedAt - Processing timestamp
 */

/**
 * Capability search query
 * @typedef {Object} CapabilityQuery
 * @property {string} description - Natural language description
 * @property {Array<string>} [keywords] - Additional keywords
 * @property {string} [context] - Context or domain
 * @property {Object} [filters] - Additional filters
 */

/**
 * Embedding generation request
 * @typedef {Object} EmbeddingRequest
 * @property {string|Array<string>} texts - Text(s) to embed
 * @property {string} [model] - Embedding model to use
 * @property {boolean} [useCache=true] - Use embedding cache
 * @property {Object} [metadata] - Request metadata
 */

/**
 * Embedding response
 * @typedef {Object} EmbeddingResponse
 * @property {Array<Array<number>>} embeddings - Generated embeddings
 * @property {number} tokensUsed - Total tokens consumed
 * @property {number} estimatedCost - Estimated cost in USD
 * @property {string} model - Model used for generation
 * @property {boolean} fromCache - Whether result was from cache
 */

/**
 * Vector search configuration
 * @typedef {Object} VectorSearchConfig
 * @property {string} collectionName - Name of the collection
 * @property {number} vectorSize - Dimension of vectors
 * @property {string} [distance='Cosine'] - Distance metric
 * @property {number} [segments=2] - Number of segments
 * @property {number} [replicationFactor=1] - Replication factor
 * @property {Array<Object>} [indexes] - Additional indexes
 */

/**
 * Search statistics
 * @typedef {Object} SearchStats
 * @property {number} totalSearches - Total number of searches
 * @property {number} cacheHits - Number of cache hits
 * @property {number} averageResponseTime - Average response time in ms
 * @property {number} totalTokensUsed - Total tokens consumed
 * @property {number} totalCost - Total estimated cost
 * @property {Object} modelUsage - Usage breakdown by model
 */

/**
 * Provider configuration
 * @typedef {Object} SemanticSearchConfig
 * @property {string} openaiApiKey - OpenAI API key
 * @property {string} [qdrantUrl='http://localhost:6333'] - Qdrant URL
 * @property {string} [qdrantApiKey] - Qdrant API key
 * @property {string} [embeddingModel='text-embedding-3-small'] - Embedding model
 * @property {number} [batchSize=100] - Batch size for processing
 * @property {number} [cacheTtl=3600] - Cache TTL in seconds
 * @property {boolean} [enableCache=true] - Enable embedding cache
 */

// Validation helpers
export const SearchValidators = {
  /**
   * Validate semantic search options
   * @param {Object} options - Options to validate
   * @throws {Error} If validation fails
   */
  validateSemanticSearchOptions(options) {
    const { limit, threshold, includeMetadata, includeVectors, filter } = options;
    
    if (limit !== undefined && (typeof limit !== 'number' || limit < 1 || limit > 1000)) {
      throw new Error('limit must be a number between 1 and 1000');
    }
    
    if (threshold !== undefined && (typeof threshold !== 'number' || threshold < 0 || threshold > 1)) {
      throw new Error('threshold must be a number between 0 and 1');
    }
    
    if (includeMetadata !== undefined && typeof includeMetadata !== 'boolean') {
      throw new Error('includeMetadata must be a boolean');
    }
    
    if (includeVectors !== undefined && typeof includeVectors !== 'boolean') {
      throw new Error('includeVectors must be a boolean');
    }
    
    if (filter !== undefined && (typeof filter !== 'object' || Array.isArray(filter))) {
      throw new Error('filter must be an object');
    }
  },

  /**
   * Validate hybrid search options
   * @param {Object} options - Options to validate
   * @throws {Error} If validation fails
   */
  validateHybridSearchOptions(options) {
    this.validateSemanticSearchOptions(options);
    
    const { semanticWeight, keywordWeight } = options;
    
    if (semanticWeight !== undefined && (typeof semanticWeight !== 'number' || semanticWeight < 0 || semanticWeight > 1)) {
      throw new Error('semanticWeight must be a number between 0 and 1');
    }
    
    if (keywordWeight !== undefined && (typeof keywordWeight !== 'number' || keywordWeight < 0 || keywordWeight > 1)) {
      throw new Error('keywordWeight must be a number between 0 and 1');
    }
    
    if (semanticWeight !== undefined && keywordWeight !== undefined && 
        Math.abs((semanticWeight + keywordWeight) - 1.0) > 0.001) {
      throw new Error('semanticWeight and keywordWeight must sum to 1.0');
    }
  },

  /**
   * Validate tool document structure
   * @param {Object} tool - Tool document to validate
   * @throws {Error} If validation fails
   */
  validateToolDocument(tool) {
    if (!tool || typeof tool !== 'object') {
      throw new Error('Tool document must be an object');
    }
    
    if (!tool.name || typeof tool.name !== 'string') {
      throw new Error('Tool must have a string name');
    }
    
    if (!tool.description || typeof tool.description !== 'string') {
      throw new Error('Tool must have a string description');
    }
    
    if (tool.parameters !== undefined && typeof tool.parameters !== 'object') {
      throw new Error('Tool parameters must be an object');
    }
    
    if (tool.tags !== undefined && (!Array.isArray(tool.tags) || 
        !tool.tags.every(tag => typeof tag === 'string'))) {
      throw new Error('Tool tags must be an array of strings');
    }
  }
};

// Constants
export const SEARCH_TYPES = {
  SEMANTIC: 'semantic',
  HYBRID: 'hybrid',
  KEYWORD: 'keyword',
  SIMILARITY: 'similarity'
};

export const EMBEDDING_MODELS = {
  SMALL: 'text-embedding-3-small',
  LARGE: 'text-embedding-3-large',
  ADA: 'text-embedding-ada-002'
};

export const DISTANCE_METRICS = {
  COSINE: 'Cosine',
  EUCLIDEAN: 'Euclid',
  DOT_PRODUCT: 'Dot'
};

export const DEFAULT_CONFIG = {
  embeddingModel: EMBEDDING_MODELS.SMALL,
  batchSize: 100,
  cacheTtl: 3600,
  enableCache: true,
  qdrantUrl: 'http://localhost:6333',
  maxTextLength: 8000,
  truncateStrategy: 'smart',
  weightedFields: {
    name: 3.0,
    title: 2.5,
    description: 2.0,
    content: 1.0,
    tags: 1.5
  }
};