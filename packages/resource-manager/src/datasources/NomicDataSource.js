/**
 * NomicDataSource - DataSource implementation for Nomic embeddings
 * 
 * Provides embedding generation and similarity computation using Nomic model.
 * Integrates with ResourceManager for singleton service management.
 */

import { NomicEmbeddings } from '@legion/nomic';

export class NomicDataSource {
  constructor(resourceManager) {
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }
    
    this.resourceManager = resourceManager;
    this.nomicEmbeddings = null;
    this.initialized = false;
    
    // Embedding cache with LRU behavior
    this._embedCache = new Map();
    this._cacheMaxSize = 1000;
    this._cacheStats = {
      hits: 0,
      misses: 0
    };
    
    // For testing error scenarios
    this._forceInitError = false;
  }

  /**
   * Initialize the DataSource with Nomic embeddings
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    if (this._forceInitError) {
      throw new Error('Forced initialization error for testing');
    }
    
    // Use ResourceManager to get or create singleton Nomic service
    const nomicKey = 'nomic_embeddings_service';
    
    this.nomicEmbeddings = await this.resourceManager.getOrInitialize(nomicKey, async () => {
      console.log('[NomicDataSource] Creating Nomic embeddings service');
      const embeddings = new NomicEmbeddings();
      await embeddings.initialize();
      return embeddings;
    });
    
    this.initialized = true;
    console.log('[NomicDataSource] Initialized');
  }

  /**
   * Embed a single text asynchronously
   */
  async embedAsync(text) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Truncate very long text to prevent context overflow
    const maxLength = 2000; // Safe limit for context
    let processedText = text;
    if (text && text.length > maxLength) {
      processedText = text.substring(0, maxLength);
    }
    
    // Check cache first
    const cacheKey = this._getCacheKey(processedText);
    if (this._embedCache.has(cacheKey)) {
      this._cacheStats.hits++;
      const cached = this._embedCache.get(cacheKey);
      return {
        text: processedText,
        embedding: cached,
        cached: true
      };
    }
    
    this._cacheStats.misses++;
    
    // Generate embedding
    const embedding = await this.nomicEmbeddings.embed(processedText);
    
    // Cache the result
    this._addToCache(cacheKey, embedding);
    
    return {
      text: processedText,
      embedding,
      cached: false
    };
  }

  /**
   * Embed multiple texts in batch
   */
  async embedBatchAsync(texts) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const embeddings = await this.nomicEmbeddings.embedBatch(texts);
    
    // Cache each embedding
    texts.forEach((text, index) => {
      const cacheKey = this._getCacheKey(text);
      this._addToCache(cacheKey, embeddings[index]);
    });
    
    return {
      texts,
      embeddings
    };
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  async similarityAsync(embedding1, embedding2) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    return await this.nomicEmbeddings.similarity(embedding1, embedding2);
  }

  /**
   * Execute a query asynchronously (primary interface)
   */
  async queryAsync(querySpec, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    switch (querySpec.type) {
      case 'embed':
        return await this.embedAsync(querySpec.text);
        
      case 'embedBatch':
        return await this.embedBatchAsync(querySpec.texts);
        
      case 'similarity':
        const similarity = await this.similarityAsync(
          querySpec.embedding1,
          querySpec.embedding2
        );
        return { similarity };
        
      default:
        throw new Error(`Unsupported query type: ${querySpec.type}`);
    }
  }

  /**
   * Execute a query synchronously (not yet implemented)
   * Will use ResourceManager message passing in future
   */
  query(querySpec) {
    throw new Error('Synchronous query not yet implemented for Nomic - use queryAsync()');
  }

  /**
   * Get cache key for text
   */
  _getCacheKey(text) {
    // Simple string key for now, could hash for very long texts
    return text;
  }

  /**
   * Add embedding to cache with LRU eviction
   */
  _addToCache(key, embedding) {
    // Remove oldest if at capacity
    if (this._embedCache.size >= this._cacheMaxSize) {
      const firstKey = this._embedCache.keys().next().value;
      this._embedCache.delete(firstKey);
    }
    
    // Add to end (most recent)
    this._embedCache.set(key, embedding);
  }

  /**
   * Get current cache size
   */
  getCacheSize() {
    return this._embedCache.size;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const total = this._cacheStats.hits + this._cacheStats.misses;
    const hitRate = total > 0 ? this._cacheStats.hits / total : 0;
    
    return {
      size: this._embedCache.size,
      hits: this._cacheStats.hits,
      misses: this._cacheStats.misses,
      hitRate
    };
  }

  /**
   * Clear the embedding cache
   */
  clearCache() {
    this._embedCache.clear();
    this._cacheStats.hits = 0;
    this._cacheStats.misses = 0;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.clearCache();
  }

  /**
   * Destroy the DataSource and release resources
   */
  destroy() {
    this.initialized = false;
    this.nomicEmbeddings = null;
    this.clearCache();
  }
}