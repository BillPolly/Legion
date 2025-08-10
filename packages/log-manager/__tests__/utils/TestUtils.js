/**
 * @fileoverview Test utilities for log-manager testing
 */

import { EventEmitter } from 'events';
import { Readable, Writable } from 'stream';

/**
 * Mock semantic search provider for testing
 */
export class MockSemanticSearchProvider extends EventEmitter {
  constructor(options = {}) {
    super();
    this.embeddings = new Map(); // Store embeddings by ID
    this.documents = new Map();   // Store documents by ID
    this.searchHistory = [];      // Track search operations
    this.config = {
      dimensions: 1536,
      threshold: 0.7,
      ...options
    };
  }

  async generateEmbedding(text) {
    // Generate a simple mock embedding based on text content
    const words = text.toLowerCase().split(' ');
    const embedding = new Array(this.config.dimensions).fill(0);
    
    // Simple hash-based embedding generation for consistent results
    for (let i = 0; i < words.length && i < embedding.length; i++) {
      const word = words[i];
      let hash = 0;
      for (let j = 0; j < word.length; j++) {
        hash = ((hash << 5) - hash + word.charCodeAt(j)) & 0xffffffff;
      }
      embedding[i] = (hash % 1000) / 1000; // Normalize to 0-1 range
    }
    
    return embedding;
  }

  async addDocument(document) {
    const { id, text, metadata = {} } = document;
    const embedding = await this.generateEmbedding(text);
    
    this.embeddings.set(id, embedding);
    this.documents.set(id, { id, text, metadata, embedding });
    
    this.emit('document-added', { id, text, metadata });
  }

  async search(queryEmbedding, options = {}) {
    const { limit = 10, threshold = this.config.threshold, filter = null } = options;
    
    this.searchHistory.push({
      queryEmbedding,
      options,
      timestamp: new Date()
    });

    const results = [];
    
    for (const [id, document] of this.documents.entries()) {
      // Apply filter if provided
      if (filter) {
        let matches = true;
        for (const [key, value] of Object.entries(filter)) {
          if (document.metadata[key] !== value) {
            matches = false;
            break;
          }
        }
        if (!matches) continue;
      }

      // Calculate cosine similarity (simplified)
      const score = this.calculateSimilarity(queryEmbedding, document.embedding);
      
      if (score >= threshold) {
        results.push({
          id,
          score,
          document: document.text,
          metadata: document.metadata
        });
      }
    }

    // Sort by score descending and apply limit
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  calculateSimilarity(embedding1, embedding2) {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < Math.min(embedding1.length, embedding2.length); i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }

  getStats() {
    return {
      totalDocuments: this.documents.size,
      totalSearches: this.searchHistory.length,
      dimensions: this.config.dimensions
    };
  }

  reset() {
    this.embeddings.clear();
    this.documents.clear();
    this.searchHistory = [];
  }
}

/**
 * Mock storage provider for testing
 */
export class MockStorageProvider {
  constructor() {
    this.data = new Map();
    this.operations = []; // Track all operations for testing
  }

  async store(collection, document) {
    if (!this.data.has(collection)) {
      this.data.set(collection, new Map());
    }
    
    const collectionData = this.data.get(collection);
    const id = document.id || document.logId || this.generateId();
    
    collectionData.set(id, { ...document, id });
    
    this.operations.push({
      type: 'store',
      collection,
      id,
      timestamp: new Date()
    });

    return { id, success: true };
  }

  async query(collection, filter = {}) {
    if (!this.data.has(collection)) {
      return [];
    }

    const collectionData = this.data.get(collection);
    const results = Array.from(collectionData.values());

    this.operations.push({
      type: 'query',
      collection,
      filter,
      resultCount: results.length,
      timestamp: new Date()
    });

    // Apply filters
    return results.filter(document => {
      return Object.entries(filter).every(([key, value]) => {
        return document[key] === value;
      });
    });
  }

  async get(collection, id) {
    if (!this.data.has(collection)) {
      return null;
    }

    const result = this.data.get(collection).get(id) || null;
    
    this.operations.push({
      type: 'get',
      collection,
      id,
      found: !!result,
      timestamp: new Date()
    });

    return result;
  }

  async delete(collection, filter) {
    if (!this.data.has(collection)) {
      return { deletedCount: 0 };
    }

    const collectionData = this.data.get(collection);
    let deletedCount = 0;

    for (const [id, document] of collectionData.entries()) {
      const matches = Object.entries(filter).every(([key, value]) => {
        return document[key] === value;
      });

      if (matches) {
        collectionData.delete(id);
        deletedCount++;
      }
    }

    this.operations.push({
      type: 'delete',
      collection,
      filter,
      deletedCount,
      timestamp: new Date()
    });

    return { deletedCount };
  }

  generateId() {
    return `mock-id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getStats() {
    const collections = {};
    for (const [name, data] of this.data.entries()) {
      collections[name] = data.size;
    }

    return {
      collections,
      totalOperations: this.operations.length,
      lastOperation: this.operations[this.operations.length - 1] || null
    };
  }

  reset() {
    this.data.clear();
    this.operations = [];
  }
}

/**
 * Mock ResourceManager for Legion integration testing
 */
export class MockResourceManager {
  constructor() {
    this.resources = new Map();
    this.accessLog = [];
    
    // Pre-populate with common test resources
    this.resources.set('env.OPENAI_API_KEY', 'test-openai-key');
    this.resources.set('env.ANTHROPIC_API_KEY', 'test-anthropic-key');
    this.resources.set('MockStorageProvider', new MockStorageProvider());
    this.resources.set('MockSemanticSearchProvider', new MockSemanticSearchProvider());
  }

  get(key) {
    this.accessLog.push({
      key,
      timestamp: new Date(),
      found: this.resources.has(key)
    });

    return this.resources.get(key);
  }

  set(key, value) {
    this.resources.set(key, value);
    return this;
  }

  has(key) {
    return this.resources.has(key);
  }

  getAccessLog() {
    return [...this.accessLog];
  }

  reset() {
    this.accessLog = [];
    // Keep the basic resources but clear access log
  }
}

/**
 * Create a readable stream with test data
 */
export function createTestStream(data = [], options = {}) {
  const { delay = 10, autoEnd = true } = options;
  let index = 0;

  const stream = new Readable({
    read() {
      if (index < data.length) {
        setTimeout(() => {
          this.push(data[index++] + '\n');
          if (index >= data.length && autoEnd) {
            this.push(null);
          }
        }, delay);
      } else if (autoEnd && index >= data.length) {
        this.push(null);
      }
    }
  });

  return stream;
}

/**
 * Create a writable stream that collects data for testing
 */
export function createCollectorStream() {
  const collected = [];
  
  const stream = new Writable({
    write(chunk, encoding, callback) {
      collected.push(chunk.toString());
      callback();
    }
  });

  stream.getCollected = () => collected;
  stream.getCollectedString = () => collected.join('');
  
  return stream;
}

/**
 * Wait for a specified number of milliseconds
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for an event to be emitted
 */
export function waitForEvent(emitter, event, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Event '${event}' not emitted within ${timeout}ms`));
    }, timeout);

    emitter.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

/**
 * Generate test log entries
 */
export function generateTestLogs(count = 10, options = {}) {
  const {
    sessionId = 'test-session',
    sources = ['stdout', 'stderr'],
    levels = ['info', 'warn', 'error'],
    messagePrefix = 'Test message'
  } = options;

  const logs = [];
  
  for (let i = 0; i < count; i++) {
    logs.push({
      logId: `log-${i + 1}`,
      sessionId,
      processId: `process-${Math.floor(i / 3) + 1}`,
      source: sources[i % sources.length],
      level: levels[i % levels.length],
      message: `${messagePrefix} ${i + 1}`,
      timestamp: new Date(Date.now() - (count - i) * 1000),
      metadata: {
        index: i,
        category: i < count / 2 ? 'first-half' : 'second-half'
      }
    });
  }

  return logs;
}

/**
 * Create a temporary directory for test files
 */
export async function createTempDir() {
  const fs = await import('fs/promises');
  const path = await import('path');
  const os = await import('os');
  
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'log-manager-test-'));
  return tempDir;
}

/**
 * Clean up temporary directory
 */
export async function cleanupTempDir(dirPath) {
  const fs = await import('fs/promises');
  
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch (error) {
    console.warn(`Failed to cleanup temp directory ${dirPath}:`, error.message);
  }
}