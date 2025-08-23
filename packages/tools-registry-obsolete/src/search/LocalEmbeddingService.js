/**
 * LocalEmbeddingService - Real semantic embeddings using Nomic model
 * 
 * Generates real 768-dimensional semantic embeddings using nomic-embed-text model.
 * Zero configuration, completely self-contained with bundled model.
 */

import { NomicEmbeddings } from '@legion/nomic';

export class LocalEmbeddingService {
  constructor() {
    this.dimensions = 768; // Nomic model dimensions
    this.initialized = false;
    this.embedder = null;
    this.totalEmbeddings = 0;
    this.totalTime = 0;
  }

  /**
   * Initialize the Nomic embeddings model
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      this.embedder = new NomicEmbeddings();
      await this.embedder.initialize();
      this.initialized = true;
      console.log('LocalEmbeddingService initialized with Nomic embeddings');
    } catch (error) {
      console.error('Failed to initialize LocalEmbeddingService:', error);
      throw error;
    }
  }

  /**
   * Generate embedding for a single text using Nomic model
   */
  async embed(text) {
    if (!this.initialized) {
      await this.initialize();
    }

    // Convert non-string inputs to string
    const textStr = String(text || '');
    
    // Handle empty or whitespace-only strings by using a placeholder
    const textToEmbed = (!textStr || textStr.trim() === '') ? '[EMPTY]' : textStr;

    const startTime = Date.now();
    const embedding = await this.embedder.embed(textToEmbed);
    
    // Ensure we always return a proper embedding
    if (!embedding || embedding.length !== 768) {
      console.error(`Invalid embedding returned for text: "${text}" (length: ${embedding ? embedding.length : 'null'})`);
      // Return a zero vector of the correct dimensions as fallback
      const fallback = new Array(768).fill(0);
      return fallback;
    }
    
    // Update stats
    this.totalEmbeddings++;
    this.totalTime += Date.now() - startTime;
    
    return embedding;
  }

  /**
   * Generate embeddings for multiple texts (batch processing)
   */
  async embedBatch(texts) {
    if (!texts || texts.length === 0) return [];
    
    if (!this.initialized) {
      await this.initialize();
    }
    
    const startTime = Date.now();
    const embeddings = await this.embedder.embedBatch(texts);
    
    // Update stats
    this.totalEmbeddings += texts.length;
    this.totalTime += Date.now() - startTime;
    
    return embeddings;
  }

  /**
   * Generate query embedding (optimized for search queries)
   */
  async embedQuery(text) {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const embedding = await this.embedder.embed(text);
    
    // Update stats
    this.totalEmbeddings++;
    this.totalTime += Date.now() - startTime;
    
    return embedding;
  }

  /**
   * Generate embeddings - interface compatibility
   */
  async generateEmbeddings(texts, options = {}) {
    if (!texts || texts.length === 0) return [];
    
    // Ensure texts is an array
    const textArray = Array.isArray(texts) ? texts : [texts];
    
    return await this.embedBatch(textArray);
  }

  /**
   * Generate embedding for a single text - alias for embed
   */
  async generateEmbedding(text) {
    return await this.embed(text);
  }

  /**
   * Specialized embedding for log/event text
   */
  async embedLogEvent(event) {
    // Extract relevant text from event for embedding
    const text = this.extractEmbeddingText(event);
    return await this.embed(text);
  }

  /**
   * Extract relevant text from event for embedding
   */
  extractEmbeddingText(event) {
    const parts = [];
    
    // Event type and level
    if (event.type) parts.push(`Type: ${event.type}`);
    if (event.level) parts.push(`Level: ${event.level}`);
    
    // Main message or error
    if (event.message) parts.push(event.message);
    if (event.error?.message) parts.push(`Error: ${event.error.message}`);
    
    // Context information
    if (event.service) parts.push(`Service: ${event.service}`);
    if (event.eventType) parts.push(`Event: ${event.eventType}`);
    if (event.testName) parts.push(`Test: ${event.testName}`);
    
    // API call information
    if (event.method && event.url) {
      parts.push(`${event.method} ${event.url}`);
    }
    
    return parts.join('. ').substring(0, 512); // Reasonable length limit
  }

  /**
   * Compute similarity between two embeddings
   */
  async similarity(embedding1, embedding2) {
    if (!this.embedder) {
      throw new Error('Service not initialized');
    }
    
    return await this.embedder.similarity(embedding1, embedding2);
  }

  /**
   * Find most similar embeddings
   */
  async findSimilar(queryEmbedding, documentEmbeddings, topK = 5) {
    if (!this.embedder) {
      throw new Error('Service not initialized');
    }
    
    return await this.embedder.findSimilar(queryEmbedding, documentEmbeddings, topK);
  }

  /**
   * Get performance statistics
   */
  getStats() {
    const avgTime = this.totalEmbeddings > 0 ? this.totalTime / this.totalEmbeddings : 0;
    
    return {
      totalEmbeddings: this.totalEmbeddings,
      totalTime: this.totalTime,
      averageTime: avgTime,
      throughput: this.totalTime > 0 ? (this.totalEmbeddings / this.totalTime) * 1000 : 0,
      dimensions: this.dimensions,
      initialized: this.initialized,
      model: 'nomic-embed-text-v1.5'
    };
  }

  /**
   * Get model information
   */
  getModelInfo() {
    return {
      name: 'Nomic Embed Text v1.5',
      type: 'transformer',
      dimensions: this.dimensions,
      model: 'nomic-embed-text-v1.5',
      provider: 'Nomic AI (local)'
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.embedder) {
      await this.embedder.close();
      this.embedder = null;
    }
    this.initialized = false;
  }

  /**
   * Alias for cleanup
   */
  async close() {
    await this.cleanup();
  }
}