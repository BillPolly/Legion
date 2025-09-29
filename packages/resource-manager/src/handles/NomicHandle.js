/**
 * NomicHandle - Handle implementation for Nomic embeddings
 * 
 * Provides Handle interface for generating and managing semantic embeddings
 * using the Nomic model through the Handle/DataSource pattern.
 * 
 * URI Examples:
 * - legion://local/nomic/embed
 * - legion://local/nomic/embed/query
 * - legion://remote/nomic/embed/batch
 */

export class NomicHandle {
  constructor(dataSource, parsed) {
    if (!dataSource) {
      throw new Error('DataSource is required for NomicHandle');
    }
    
    if (!parsed) {
      throw new Error('Parsed URI components are required for NomicHandle');
    }

    this.dataSource = dataSource;
    this.parsed = parsed;
    this._destroyed = false;
    
    // Nomic-specific properties
    this.embeddingPath = parsed.path;
    this.server = parsed.server;
    this.resourceType = parsed.resourceType;
    
    // Event subscriptions
    this._subscriptions = new Map();
    this._subscriptionId = 0;
    
    // Create proxy for transparent property access
    return new Proxy(this, {
      get(target, prop, receiver) {
        // Handle methods and private properties directly
        if (prop in target || prop.startsWith('_') || typeof target[prop] === 'function') {
          return Reflect.get(target, prop, receiver);
        }
        
        // For dynamic properties, return from internal storage
        if (target._dynamicProps && prop in target._dynamicProps) {
          return target._dynamicProps[prop];
        }
        
        return Reflect.get(target, prop, receiver);
      },
      
      set(target, prop, value) {
        // Don't allow setting private properties or methods
        if (prop.startsWith('_') || typeof target[prop] === 'function') {
          return Reflect.set(target, prop, value);
        }
        
        // Allow setting Handle properties
        if (prop in target) {
          return Reflect.set(target, prop, value);
        }
        
        // Store dynamic properties
        if (!target._dynamicProps) {
          target._dynamicProps = {};
        }
        target._dynamicProps[prop] = value;
        return true;
      },
      
      has(target, prop) {
        // Check if it's a NomicHandle property/method
        if (prop in target) {
          return true;
        }
        
        // Check dynamic properties
        if (target._dynamicProps && prop in target._dynamicProps) {
          return true;
        }
        
        return false;
      }
    });
  }

  /**
   * Embed a single text
   * @param {string} text - Text to embed
   * @returns {Promise<Array>} Embedding vector array
   */
  async embed(text) {
    this._checkDestroyed();
    
    const result = await this.dataSource.embedAsync(text);
    
    // Notify subscribers
    this._notifySubscribers('embedding.generated', {
      text,
      embedding: result.embedding,
      cached: result.cached
    });
    
    return result.embedding;
  }

  /**
   * Embed multiple texts in batch
   * @param {Array<string>} texts - Texts to embed
   * @returns {Promise<Array<Array>>} Array of embedding vectors
   */
  async embedBatch(texts) {
    this._checkDestroyed();
    
    const result = await this.dataSource.embedBatchAsync(texts);
    
    // Notify subscribers
    this._notifySubscribers('embedding.batch', {
      texts,
      embeddings: result.embeddings,
      count: texts.length
    });
    
    return result.embeddings;
  }

  /**
   * Calculate similarity between two embeddings
   * @param {Array<number>} embedding1 - First embedding
   * @param {Array<number>} embedding2 - Second embedding
   * @returns {Promise<number>} Cosine similarity score
   */
  async similarity(embedding1, embedding2) {
    this._checkDestroyed();
    
    return await this.dataSource.similarityAsync(embedding1, embedding2);
  }

  /**
   * Find most similar embeddings
   * @param {Array<number>} queryEmbedding - Query embedding
   * @param {Array<Array<number>>} documentEmbeddings - Document embeddings to search
   * @param {number} topK - Number of results to return
   * @returns {Promise<Array>} Top K similar items with indices and scores
   */
  async findSimilar(queryEmbedding, documentEmbeddings, topK = 5) {
    this._checkDestroyed();
    
    // Calculate similarities for all documents
    const similarities = await Promise.all(
      documentEmbeddings.map(async (docEmbed, index) => ({
        index,
        similarity: await this.dataSource.similarityAsync(queryEmbedding, docEmbed)
      }))
    );
    
    // Sort by similarity and take top K
    similarities.sort((a, b) => b.similarity - a.similarity);
    return similarities.slice(0, topK);
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    this._checkDestroyed();
    return this.dataSource.getCacheStats();
  }

  /**
   * Clear the embedding cache
   */
  clearCache() {
    this._checkDestroyed();
    this.dataSource.clearCache();
  }

  /**
   * Get embedding metadata
   * @returns {Object} Metadata including dimensions and model info
   */
  getMetadata() {
    this._checkDestroyed();
    
    return {
      dimensions: 768,
      model: 'nomic-embed-text-v1.5',
      server: this.server,
      path: this.embeddingPath,
      type: 'nomic'
    };
  }

  /**
   * Get schema information
   * @returns {Object} Schema with operations and types
   */
  getSchema() {
    this._checkDestroyed();
    
    return {
      type: 'nomic',
      operations: ['embed', 'embedBatch', 'similarity', 'findSimilar'],
      dimensions: 768,
      inputTypes: {
        embed: 'string',
        embedBatch: 'string[]',
        similarity: 'number[][]'
      },
      outputTypes: {
        embed: 'object',
        embedBatch: 'object',
        similarity: 'number'
      }
    };
  }

  /**
   * Subscribe to Handle events
   * @param {Function} callback - Event callback
   * @param {Object} options - Subscription options
   * @returns {Object} Subscription object with unsubscribe method
   */
  subscribe(callback, options = {}) {
    this._checkDestroyed();
    
    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback function is required');
    }

    const id = this._subscriptionId++;
    const subscription = {
      callback,
      options,
      id
    };
    
    this._subscriptions.set(id, subscription);
    
    return {
      unsubscribe: () => {
        this._subscriptions.delete(id);
      }
    };
  }

  /**
   * Notify subscribers of events
   * @private
   */
  _notifySubscribers(event, data) {
    for (const sub of this._subscriptions.values()) {
      if (!sub.options.event || sub.options.event === event) {
        try {
          sub.callback({ event, data, timestamp: Date.now() });
        } catch (error) {
          console.error('Subscriber callback error:', error);
        }
      }
    }
  }

  /**
   * Check if the model is loaded
   * @returns {boolean} True if model is loaded
   */
  isModelLoaded() {
    this._checkDestroyed();
    return this.dataSource && this.dataSource.initialized;
  }

  /**
   * Validate text input
   * @param {*} text - Value to validate
   * @returns {boolean} True if valid text
   */
  validateText(text) {
    if (text === null || text === undefined) {
      return false;
    }
    if (typeof text !== 'string') {
      return false;
    }
    return true; // Empty string is valid
  }

  /**
   * Validate embedding array
   * @param {*} embedding - Value to validate
   * @returns {boolean} True if valid embedding
   */
  validateEmbedding(embedding) {
    if (!embedding || !Array.isArray(embedding)) {
      return false;
    }
    if (embedding.length !== 768) {
      return false;
    }
    return true;
  }

  /**
   * Get URI for this Handle
   * @returns {string} Legion URI
   */
  toURI() {
    return `legion://${this.server}/${this.resourceType}/${this.embeddingPath}`;
  }

  /**
   * Create child Handle for sub-operation
   * @param {string} subPath - Sub-path for child
   * @returns {NomicHandle} Child Handle
   */
  child(subPath) {
    this._checkDestroyed();
    
    const childPath = this.embeddingPath ? `${this.embeddingPath}/${subPath}` : subPath;
    const childParsed = {
      ...this.parsed,
      path: childPath
    };
    
    return new NomicHandle(this.dataSource, childParsed);
  }

  /**
   * Get parent Handle (if this is a nested path)
   * @returns {NomicHandle|null} Parent Handle or null if at root
   */
  parent() {
    this._checkDestroyed();
    
    if (!this.embeddingPath || !this.embeddingPath.includes('/')) {
      return null;
    }
    
    const parts = this.embeddingPath.split('/');
    parts.pop(); // Remove last part
    const parentPath = parts.join('/');
    
    const parentParsed = {
      ...this.parsed,
      path: parentPath
    };
    
    return new NomicHandle(this.dataSource, parentParsed);
  }

  /**
   * Export Handle state
   * @param {Object} options - Export options
   * @returns {Object} Exported state
   */
  export(options = {}) {
    this._checkDestroyed();
    
    const cacheStats = this.dataSource.getCacheStats();
    
    return {
      uri: this.toURI(),
      server: this.server,
      embeddingPath: this.embeddingPath,
      cacheStats,
      metadata: this.getMetadata(),
      schema: this.getSchema()
    };
  }

  /**
   * Clone this Handle
   * @returns {NomicHandle} Cloned Handle
   */
  clone() {
    this._checkDestroyed();
    return new NomicHandle(this.dataSource, { ...this.parsed });
  }

  /**
   * Check if Handle is destroyed
   * @returns {boolean} True if destroyed
   */
  isDestroyed() {
    return this._destroyed;
  }

  /**
   * Destroy this Handle and cleanup resources
   */
  destroy() {
    if (this._destroyed) return;
    
    // Clear subscriptions
    this._subscriptions.clear();
    
    // Mark as destroyed
    this._destroyed = true;
    this.dataSource = null;
    this.parsed = null;
  }

  /**
   * String representation
   * @returns {string} String representation
   */
  toString() {
    if (this._destroyed) {
      return '[NomicHandle (destroyed)]';
    }
    
    return `[NomicHandle: ${this.toURI()}]`;
  }

  /**
   * JSON representation
   * @returns {Object} JSON-serializable object
   */
  toJSON() {
    if (this._destroyed) {
      return { destroyed: true };
    }
    
    return {
      type: 'NomicHandle',
      uri: this.toURI(),
      embeddingPath: this.embeddingPath,
      server: this.server,
      dimensions: 768,
      model: 'nomic-embed-text-v1.5'
    };
  }

  // Private helper methods

  /**
   * Check if Handle is destroyed and throw if so
   * @private
   */
  _checkDestroyed() {
    if (this._destroyed) {
      throw new Error('NomicHandle has been destroyed');
    }
  }
}

export default NomicHandle;