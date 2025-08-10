/**
 * SemanticSearchProvider - Semantic search provider for Legion
 * 
 * Extends the Legion Provider base class to provide semantic search capabilities
 * using OpenAI embeddings and Qdrant vector database.
 * 
 * Follows Legion's ResourceManager pattern for configuration and initialization.
 */

import { Provider } from '@legion/storage';
import { OpenAIEmbeddingService } from './services/OpenAIEmbeddingService.js';
import { LocalEmbeddingService } from './services/LocalEmbeddingService.js';
import { QdrantVectorStore } from './services/QdrantVectorStore.js';
import { EmbeddingCache } from './utils/EmbeddingCache.js';
import { DocumentProcessor } from './utils/DocumentProcessor.js';
import { SearchValidators, SEARCH_TYPES } from './types/SearchTypes.js';

export class SemanticSearchProvider {
  /**
   * Private constructor - use SemanticSearchProvider.create() instead
   * @private
   */
  constructor(config, dependencies) {
    // Enforce factory pattern
    if (!dependencies || !dependencies._factoryCall) {
      throw new Error('SemanticSearchProvider must be created using SemanticSearchProvider.create()');
    }
    
    this.name = 'SemanticSearchProvider';
    this.type = 'semantic';
    this.config = {
      embeddingModel: 'text-embedding-3-small',
      batchSize: 100,
      cacheTtl: 3600,
      enableCache: true,
      ...config
    };
    
    this.resourceManager = dependencies.resourceManager;
    this.embeddingService = dependencies.embeddingService;
    this.embeddingDimensions = dependencies.embeddingDimensions;
    this.useLocalEmbeddings = dependencies.useLocalEmbeddings;
    this.vectorStore = dependencies.vectorStore;
    this.cache = dependencies.cache;
    this.documentProcessor = dependencies.documentProcessor;
    this.initialized = true;
    this.connected = false;
  }

  /**
   * Async factory method following Legion ResourceManager pattern
   * 🚨 ResourceManager provides ALL configuration automatically from .env
   * @param {ResourceManager} resourceManager - Initialized ResourceManager instance
   * @returns {Promise<SemanticSearchProvider>}
   */
  static async create(resourceManager) {
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }
    
    if (!resourceManager.initialized) {
      throw new Error('SemanticSearchProvider requires an initialized ResourceManager');
    }

    // Check if already registered (singleton pattern)
    const existing = resourceManager.get ? resourceManager.get('semanticSearchProvider') : null;
    if (existing) {
      return existing;
    }

    // Get configuration from ResourceManager (.env loaded automatically)
    // Fallback to process.env if ResourceManager doesn't return values
    const config = {
      openaiApiKey: resourceManager.get('env.OPENAI_API_KEY') || process.env.OPENAI_API_KEY,
      localModelPath: resourceManager.get('env.LOCAL_EMBEDDING_MODEL_PATH') || process.env.LOCAL_EMBEDDING_MODEL_PATH,
      qdrantUrl: resourceManager.get('env.QDRANT_URL') || process.env.QDRANT_URL || 'http://localhost:6333',
      qdrantApiKey: resourceManager.get('env.QDRANT_API_KEY') || process.env.QDRANT_API_KEY,
      embeddingModel: resourceManager.get('env.SEMANTIC_SEARCH_MODEL') || process.env.SEMANTIC_SEARCH_MODEL || 'text-embedding-3-small',
      batchSize: parseInt(resourceManager.get('env.SEMANTIC_SEARCH_BATCH_SIZE') || process.env.SEMANTIC_SEARCH_BATCH_SIZE || '100'),
      cacheTtl: parseInt(resourceManager.get('env.SEMANTIC_SEARCH_CACHE_TTL') || process.env.SEMANTIC_SEARCH_CACHE_TTL || '3600'),
      enableCache: (resourceManager.get('env.SEMANTIC_SEARCH_ENABLE_CACHE') || process.env.SEMANTIC_SEARCH_ENABLE_CACHE) !== 'false',
      useLocalEmbeddings: (resourceManager.get('env.USE_LOCAL_EMBEDDINGS') || process.env.USE_LOCAL_EMBEDDINGS) === 'true'
    };

    // Determine embedding service to use
    let useLocalEmbeddings = config.useLocalEmbeddings;
    
    // Auto-detect if neither is explicitly configured
    if (!config.useLocalEmbeddings && !config.openaiApiKey && config.localModelPath) {
      useLocalEmbeddings = true;
      console.log('🔍 Auto-detected local embeddings (no OpenAI key, local model path provided)');
    }
    
    if (!useLocalEmbeddings && !config.openaiApiKey) {
      throw new Error('Either OPENAI_API_KEY or LOCAL_EMBEDDING_MODEL_PATH is required for semantic search');
    }

    // Create embedding service based on configuration
    let embeddingService;
    let embeddingDimensions;
    
    if (useLocalEmbeddings) {
      console.log('🔧 Using local ONNX embeddings');
      embeddingService = new LocalEmbeddingService({
        batchSize: config.batchSize
        // LocalEmbeddingService handles its own model management
      });
      embeddingDimensions = 384; // Local model dimensions
      
      // Initialize the local embedding service
      try {
        await embeddingService.initialize();
      } catch (error) {
        console.error('❌ Local embedding service initialization failed:', error.message);
        throw new Error(`Local embeddings required but failed to initialize: ${error.message}`);
      }
    } else {
      console.log('🔧 Using OpenAI embeddings');
      embeddingService = new OpenAIEmbeddingService({
        apiKey: config.openaiApiKey,
        model: config.embeddingModel,
        batchSize: config.batchSize
      });
      embeddingDimensions = config.embeddingModel === 'text-embedding-3-large' ? 3072 : 1536;
    }

    // Create dependencies
    const dependencies = {
      _factoryCall: true,
      resourceManager,
      embeddingService,
      embeddingDimensions,
      useLocalEmbeddings,
      vectorStore: new QdrantVectorStore({
        url: config.qdrantUrl,
        apiKey: config.qdrantApiKey
      }),
      documentProcessor: new DocumentProcessor(config),
      cache: config.enableCache ? new EmbeddingCache({ 
        ttl: config.cacheTtl,
        resourceManager 
      }) : null
    };

    const provider = new SemanticSearchProvider(config, dependencies);
    
    // Register with ResourceManager if it supports registration
    if (resourceManager.register) {
      resourceManager.register('semanticSearchProvider', provider);
    }
    
    return provider;
  }

  /**
   * Connect to the semantic search backend
   */
  async connect() {
    if (!this.initialized) {
      throw new Error('Provider not initialized');
    }

    try {
      await this.vectorStore.connect();
      this.connected = true;
    } catch (error) {
      throw new Error(`Failed to connect: ${error.message}`);
    }
  }

  /**
   * Disconnect from the semantic search backend
   */
  async disconnect() {
    if (this.vectorStore) {
      await this.vectorStore.disconnect();
    }
    
    if (this.cache) {
      await this.cache.close();
    }
    
    this.connected = false;
  }

  /**
   * Perform semantic search using natural language queries
   * @param {string} collection - Collection name to search
   * @param {string} query - Natural language search query  
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Search results with similarity scores
   */
  async semanticSearch(collection, query, options = {}) {
    SearchValidators.validateSemanticSearchOptions(options);
    
    const {
      limit = 10,
      threshold = 0.7,
      includeMetadata = true,
      includeVectors = false,
      filter = {},
      useCache = true
    } = options;

    // Process query for better semantic matching
    const processedQuery = this.documentProcessor.processCapabilityQuery(query);

    // Generate embedding for query
    let queryEmbedding;
    if (useCache && this.cache) {
      queryEmbedding = await this.cache.get(processedQuery);
    }
    
    if (!queryEmbedding) {
      const embeddings = await this.embeddingService.generateEmbeddings([processedQuery]);
      queryEmbedding = embeddings[0];
      
      if (useCache && this.cache) {
        await this.cache.set(processedQuery, queryEmbedding);
      }
    }

    // Search in vector store
    const results = await this.vectorStore.search(collection, queryEmbedding, {
      limit,
      threshold,
      includeMetadata,
      includeVectors,
      filter
    });

    // Add search metadata
    return results.map(result => ({
      ...result,
      document: result.document || result.payload,
      _similarity: result.score,
      _searchType: SEARCH_TYPES.SEMANTIC,
      _id: result.id
    }));
  }

  /**
   * Perform hybrid search combining semantic and keyword matching
   * @param {string} collection - Collection name to search
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Combined search results
   */
  async hybridSearch(collection, query, options = {}) {
    SearchValidators.validateHybridSearchOptions(options);
    
    const {
      semanticWeight = 0.7,
      keywordWeight = 0.3,
      limit = 10,
      ...semanticOptions
    } = options;

    // Perform semantic search
    const semanticResults = await this.semanticSearch(collection, query, {
      ...semanticOptions,
      limit: limit * 2 // Get more results for merging
    });

    // Perform keyword search
    const keywordFilter = this._buildKeywordFilter(query);
    const keywordResults = await this.find(collection, keywordFilter, { limit: limit * 2 });

    // Combine and rank results
    const combinedResults = this._combineSearchResults(
      semanticResults,
      keywordResults,
      semanticWeight,
      keywordWeight
    );

    // Return top results
    return combinedResults.slice(0, limit);
  }

  /**
   * Find similar documents to a reference document
   * @param {string} collection - Collection name
   * @param {Object} document - Reference document
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Similar documents
   */
  async findSimilar(collection, document, options = {}) {
    const { limit = 10, threshold = 0.7 } = options;

    // Process document for search
    const processedDoc = this.documentProcessor.processDocument(document);
    
    // Generate embedding
    const embeddings = await this.embeddingService.generateEmbeddings([processedDoc.searchText]);
    
    // Search for similar
    const results = await this.vectorStore.search(collection, embeddings[0], {
      limit: limit + 1, // +1 in case the document itself is in the collection
      threshold
    });

    // Filter out the document itself if present
    const filtered = results.filter(r => r.id !== document.id);

    return filtered.slice(0, limit).map(result => ({
      ...result,
      document: result.document || result.payload,
      _similarity: result.score,
      _searchType: SEARCH_TYPES.SIMILARITY
    }));
  }

  /**
   * Insert documents with embedding generation
   * @param {string} collection - Collection name
   * @param {Object|Array} documents - Documents to insert
   * @returns {Promise<Object>} - Insert result
   */
  async insert(collection, documents) {
    const docs = Array.isArray(documents) ? documents : [documents];
    
    // Process documents
    const processedDocs = docs.map(doc => 
      this.documentProcessor.processDocument(doc)
    );

    // Generate embeddings
    const texts = processedDocs.map(doc => doc.searchText);
    const embeddings = await this.embeddingService.generateEmbeddings(texts);

    // Store in vector database
    const vectors = processedDocs.map((doc, i) => ({
      id: doc.id || `${collection}_${Date.now()}_${i}`,
      vector: embeddings[i],
      payload: doc
    }));

    await this.vectorStore.upsert(collection, vectors);

    return {
      success: true,
      insertedCount: docs.length,
      vectorsStored: vectors.length
    };
  }

  /**
   * Standard find operation (delegates to vector store)
   */
  async find(collection, filter = {}, options = {}) {
    return await this.vectorStore.find(collection, filter, options);
  }

  /**
   * Standard update operation (delegates to vector store)
   */
  async update(collection, filter, update) {
    return await this.vectorStore.update(collection, filter, update);
  }

  /**
   * Standard delete operation (delegates to vector store)
   */
  async delete(collection, filter) {
    return await this.vectorStore.delete(collection, filter);
  }

  /**
   * Get provider metadata
   */
  getMetadata() {
    return {
      name: this.name,
      type: this.type,
      initialized: this.initialized,
      connected: this.connected,
      embeddingService: this.useLocalEmbeddings ? 'local-onnx' : 'openai',
      embeddingModel: this.useLocalEmbeddings ? 'all-MiniLM-L6-v2' : this.config.embeddingModel,
      embeddingDimensions: this.embeddingDimensions,
      vectorDatabase: 'qdrant',
      cacheEnabled: this.config.enableCache,
      vectorStoreUrl: this.config.qdrantUrl
    };
  }

  /**
   * Create a collection in the vector store
   * @param {string} name - Collection name
   * @param {Object} options - Collection options
   */
  async createCollection(name, options = {}) {
    if (!this.connected) {
      throw new Error('Provider not connected');
    }

    const { dimension = this.embeddingDimensions, description = '' } = options;
    
    try {
      await this.vectorStore.createCollection(name, {
        dimension,
        description,
        distance: 'cosine'
      });
      console.log(`✅ Created collection: ${name} (${dimension}D)`);
    } catch (error) {
      // Collection might already exist
      if (!error.message.includes('already exists')) {
        throw error;
      }
      console.log(`📋 Collection already exists: ${name}`);
    }
  }

  /**
   * Count documents in a collection
   * @param {string} collection - Collection name
   * @returns {Promise<number>} - Document count
   */
  async count(collection) {
    if (!this.connected) {
      throw new Error('Provider not connected');
    }

    try {
      return await this.vectorStore.count(collection);
    } catch (error) {
      console.warn(`Failed to count collection ${collection}:`, error.message);
      return 0;
    }
  }

  /**
   * Get provider capabilities
   */
  getCapabilities() {
    return [
      'semanticSearch',
      'hybridSearch',
      'findSimilar',
      'vectorSearch',
      'embeddingGeneration',
      'batchProcessing',
      'caching',
      'collectionManagement'
    ];
  }

  // Private helper methods

  _buildKeywordFilter(query) {
    const keywords = query.toLowerCase().split(/\s+/);
    return {
      $or: keywords.map(keyword => ({
        $text: { $search: keyword }
      }))
    };
  }

  _combineSearchResults(semanticResults, keywordResults, semanticWeight, keywordWeight) {
    const scoreMap = new Map();

    // Add semantic results
    semanticResults.forEach(result => {
      const id = result._id || result.id;
      scoreMap.set(id, {
        ...result,
        _semanticScore: result._similarity || 0,
        _keywordScore: 0,
        _hybridScore: (result._similarity || 0) * semanticWeight
      });
    });

    // Add/update keyword results
    keywordResults.forEach((result, index) => {
      const id = result._id || result.id;
      const keywordScore = 1 - (index / keywordResults.length); // Simple ranking score
      
      if (scoreMap.has(id)) {
        const existing = scoreMap.get(id);
        existing._keywordScore = keywordScore;
        existing._hybridScore = (existing._semanticScore * semanticWeight) + (keywordScore * keywordWeight);
      } else {
        scoreMap.set(id, {
          ...result,
          _semanticScore: 0,
          _keywordScore: keywordScore,
          _hybridScore: keywordScore * keywordWeight,
          _searchType: SEARCH_TYPES.HYBRID
        });
      }
    });

    // Sort by hybrid score
    const combined = Array.from(scoreMap.values());
    combined.sort((a, b) => b._hybridScore - a._hybridScore);

    return combined;
  }
}