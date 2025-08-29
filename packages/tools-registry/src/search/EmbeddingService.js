/**
 * EmbeddingService - Generate vector embeddings for text using LLM services
 * 
 * Provides embedding generation with caching, batch processing, and validation
 * Uses ResourceManager pattern for dependency injection
 * 
 * No mocks, no fallbacks - real implementation only
 */

import { EmbeddingError, ParameterValidationError } from '../errors/index.js';
import { LRUCache } from '../utils/LRUCache.js';
import { NomicEmbeddings } from '@legion/nomic';

export class EmbeddingService {
  constructor({ resourceManager, options = {} }) {
    if (!resourceManager) {
      throw new EmbeddingError(
        'ResourceManager is required',
        'INIT_ERROR'
      );
    }

    this.resourceManager = resourceManager;
    this.options = {
      dimensions: null,     // Will be set based on actual embedding model
      batchSize: 20,       // Default batch size for batch processing
      cacheSize: 1000,     // Default cache size
      maxTextLength: 8192, // Maximum text length for embedding
      ...options
    };

    this.nomicEmbeddings = null; // Use Nomic for local embeddings
    this.initialized = false;
    
    // Initialize cache for embeddings
    this.cache = new LRUCache({ maxSize: this.options.cacheSize });
    
    // Statistics tracking
    this.stats = {
      totalGenerated: 0,
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalGenerationTime: 0
    };
  }

  /**
   * Initialize the service using Nomic local embeddings
   */
  async initialize() {
    if (this.initialized) return;

    // Initialize Nomic local embeddings
    this.nomicEmbeddings = new NomicEmbeddings();
    await this.nomicEmbeddings.initialize();
    
    // Set dimensions based on actual Nomic model
    if (!this.options.dimensions) {
      this.options.dimensions = this.nomicEmbeddings.dimensions; // Nomic uses 768 dimensions
    }

    this.initialized = true;
  }

  /**
   * Generate embedding for a single text
   * @param {string} text - Text to generate embedding for
   * @returns {Array<number>} Generated embedding vector
   */
  async generateEmbedding(text) {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    this.stats.totalRequests++;

    try {
      // Validate and preprocess input
      const processedText = this._preprocessText(text);
      
      // Check cache first
      const cacheKey = this._createCacheKey(processedText);
      const cachedEmbedding = this.cache.get(cacheKey);
      if (cachedEmbedding) {
        this.stats.cacheHits++;
        return cachedEmbedding;
      }
      
      this.stats.cacheMisses++;

      // Generate embedding using Nomic local embeddings
      const embedding = await this.nomicEmbeddings.embed(processedText);
      
      // Validate generated embedding
      this._validateEmbedding(embedding);
      
      // Cache the result
      this.cache.set(cacheKey, embedding);
      
      // Update statistics
      this.stats.totalGenerated++;
      this.stats.totalGenerationTime += Math.max(1, Date.now() - startTime); // Minimum 1ms
      
      return embedding;

    } catch (error) {
      if (error instanceof EmbeddingError) {
        throw error;
      }
      
      throw new EmbeddingError(
        `Failed to generate embedding: ${error.message}`,
        'GENERATION_ERROR',
        error
      );
    }
  }

  /**
   * Generate embeddings for multiple texts in batches
   * @param {Array<string>} texts - Array of texts to generate embeddings for
   * @returns {Array<Array<number>>} Array of embedding vectors
   */
  async generateEmbeddings(texts) {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    // Validate input
    if (!Array.isArray(texts)) {
      throw new EmbeddingError(
        'Input must be an array of texts',
        'INVALID_INPUT'
      );
    }

    if (texts.length === 0) {
      return [];
    }

    try {
      // Filter and preprocess texts
      const validTexts = texts
        .filter(text => this._isValidText(text))
        .map(text => this._preprocessText(text));

      if (validTexts.length === 0) {
        throw new EmbeddingError(
          'No valid texts provided for embedding generation',
          'NO_VALID_INPUT'
        );
      }

      // Check cache for existing embeddings
      const results = [];
      const textsToGenerate = [];
      const resultIndexMap = new Map();

      for (let i = 0; i < validTexts.length; i++) {
        const text = validTexts[i];
        const cacheKey = this._createCacheKey(text);
        const cachedEmbedding = this.cache.get(cacheKey);
        
        if (cachedEmbedding) {
          results[i] = cachedEmbedding;
          this.stats.cacheHits++;
        } else {
          textsToGenerate.push(text);
          resultIndexMap.set(textsToGenerate.length - 1, i);
          this.stats.cacheMisses++;
        }
      }

      // Generate embeddings for uncached texts in batches
      if (textsToGenerate.length > 0) {
        const batches = this._createBatches(textsToGenerate);
        let batchStartIndex = 0;
        
        for (const batch of batches) {
          const batchEmbeddings = await this._generateBatch(batch);
          
          // Validate and cache each embedding
          for (let j = 0; j < batchEmbeddings.length; j++) {
            const embedding = batchEmbeddings[j];
            const text = batch[j];
            
            this._validateEmbedding(embedding);
            
            // Cache the embedding
            const cacheKey = this._createCacheKey(text);
            this.cache.set(cacheKey, embedding);
            
            // Add to results in correct position
            const textToGenerateIndex = batchStartIndex + j;
            const originalIndex = resultIndexMap.get(textToGenerateIndex);
            if (originalIndex !== undefined) {
              results[originalIndex] = embedding;
            }
          }
          
          batchStartIndex += batch.length;
        }
      }

      this.stats.totalGenerated += textsToGenerate.length;
      this.stats.totalRequests++;
      this.stats.totalGenerationTime += Math.max(1, Date.now() - startTime); // Minimum 1ms

      return results;

    } catch (error) {
      if (error instanceof EmbeddingError) {
        throw error;
      }
      
      throw new EmbeddingError(
        `Failed to generate batch embeddings: ${error.message}`,
        'BATCH_GENERATION_ERROR',
        error
      );
    }
  }

  /**
   * Validate an embedding vector
   * @param {Array<number>} embedding - Embedding to validate
   * @returns {boolean} True if valid
   * @throws {EmbeddingError} If invalid
   */
  _validateEmbedding(embedding) {
    if (!embedding || !Array.isArray(embedding)) {
      throw new EmbeddingError(
        'Embedding must be a non-empty array',
        'INVALID_EMBEDDING'
      );
    }

    if (embedding.length !== this.options.dimensions) {
      throw new EmbeddingError(
        `Embedding dimensions mismatch: expected ${this.options.dimensions}, got ${embedding.length}`,
        'DIMENSION_MISMATCH'
      );
    }

    // Check all values are numbers and finite
    for (let i = 0; i < embedding.length; i++) {
      const value = embedding[i];
      if (typeof value !== 'number' || !isFinite(value)) {
        throw new EmbeddingError(
          `Embedding contains invalid value at index ${i}: ${value}`,
          'INVALID_VALUE'
        );
      }
    }

    return true;
  }

  /**
   * Preprocess text before embedding generation
   * @param {string} text - Text to preprocess
   * @returns {string} Processed text
   */
  _preprocessText(text) {
    // Validate input type
    if (typeof text !== 'string') {
      throw new EmbeddingError(
        `Text must be a string, got ${typeof text}`,
        'INVALID_TEXT_TYPE'
      );
    }

    // Validate text is not empty
    if (!text || text.trim().length === 0) {
      throw new EmbeddingError(
        'Text cannot be empty or whitespace only',
        'EMPTY_TEXT'
      );
    }

    // Normalize whitespace
    let processed = text.trim().replace(/\s+/g, ' ');
    
    // Truncate if too long
    if (processed.length > this.options.maxTextLength) {
      processed = processed.substring(0, this.options.maxTextLength);
    }

    return processed;
  }

  /**
   * Check if text is valid for embedding generation
   * @param {*} text - Text to check
   * @returns {boolean} True if valid
   */
  _isValidText(text) {
    try {
      this._preprocessText(text);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create cache key for text
   * @param {string} text - Text to create key for
   * @returns {string} Cache key
   */
  _createCacheKey(text) {
    // Simple hash function for cache key
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `emb_${Math.abs(hash)}`;
  }

  /**
   * Create batches from array of texts
   * @param {Array<string>} texts - Texts to batch
   * @returns {Array<Array<string>>} Batches
   */
  _createBatches(texts) {
    const batches = [];
    for (let i = 0; i < texts.length; i += this.options.batchSize) {
      batches.push(texts.slice(i, i + this.options.batchSize));
    }
    return batches;
  }

  /**
   * Generate embeddings for a single batch
   * @param {Array<string>} batch - Batch of texts
   * @returns {Array<Array<number>>} Batch embeddings
   */
  async _generateBatch(batch) {
    try {
      const embeddings = await this.nomicEmbeddings.embedBatch(batch);
      
      if (!Array.isArray(embeddings) || embeddings.length !== batch.length) {
        throw new Error(`Batch response mismatch: expected ${batch.length}, got ${embeddings?.length || 0}`);
      }

      return embeddings;
    } catch (error) {
      throw new EmbeddingError(
        `Batch generation failed: ${error.message}`,
        'BATCH_ERROR',
        error
      );
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    const totalRequests = this.stats.cacheHits + this.stats.cacheMisses;
    return {
      size: this.cache.size,
      maxSize: this.options.cacheSize,
      hitCount: this.stats.cacheHits,
      missCount: this.stats.cacheMisses,
      hitRate: totalRequests > 0 ? this.stats.cacheHits / totalRequests : 0
    };
  }

  /**
   * Get generation statistics
   * @returns {Object} Generation statistics
   */
  getStats() {
    return {
      totalGenerated: this.stats.totalGenerated,
      totalRequests: this.stats.totalRequests,
      averageGenerationTime: this.stats.totalGenerated > 0 
        ? this.stats.totalGenerationTime / this.stats.totalGenerated 
        : 0,
      cacheHitRate: this.getCacheStats().hitRate
    };
  }

  /**
   * Generate embeddings for multiple texts in batch (alias for generateEmbeddings)
   * This is an alias method for compatibility with VectorStore
   * @param {Array<string>} texts - Array of texts to generate embeddings for
   * @returns {Array<Array<number>>} Array of embedding vectors
   */
  async generateBatch(texts) {
    return await this.generateEmbeddings(texts);
  }

  /**
   * Check if service is initialized
   * @returns {boolean} True if initialized
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Clear the embedding cache
   */
  clearCache() {
    this.cache.clear();
    this.stats.cacheHits = 0;
    this.stats.cacheMisses = 0;
  }

  /**
   * Shutdown the service and cleanup resources
   */
  async shutdown() {
    this.clearCache();
    this.initialized = false;
    this.nomicEmbeddings = null;
  }
}