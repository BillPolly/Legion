/**
 * QdrantVectorStore - Handles vector storage and search using Qdrant
 */

export class QdrantVectorStore {
  constructor(config) {
    this.config = {
      url: config.url || 'http://localhost:6333',
      apiKey: config.apiKey,
      timeout: config.timeout || 30000
    };
    
    this.client = null;
    this.connected = false;
    this._collections = new Map(); // In-memory storage for testing
    
    this._initializeClient();
  }
  
  async _initializeClient() {
    try {
      // Dynamic import to avoid hard dependency
      const { QdrantClient } = await import('@qdrant/js-client-rest').catch(() => ({ QdrantClient: null }));
      
      if (QdrantClient) {
        this.client = new QdrantClient({
          url: this.config.url,
          apiKey: this.config.apiKey,
          timeout: this.config.timeout
        });
      }
    } catch (error) {
      console.warn('Qdrant client initialization failed:', error.message);
    }
  }
  
  async connect() {
    if (this.client) {
      try {
        await this.client.getClusterInfo();
        this.connected = true;
      } catch (error) {
        // Fallback to in-memory mode
        this.connected = true;
      }
    } else {
      // Use in-memory mode for testing
      this.connected = true;
    }
  }
  
  async disconnect() {
    this.connected = false;
  }
  
  async ensureCollection(name, vectorSize = 1536, options = {}) {
    if (!this._collections.has(name)) {
      this._collections.set(name, {
        vectors: [],
        config: { vectorSize, ...options }
      });
    }
    
    if (this.client) {
      try {
        const collections = await this.client.getCollections();
        const exists = collections.collections.some(c => c.name === name);
        
        if (!exists) {
          await this.client.createCollection(name, {
            vectors: {
              size: vectorSize,
              distance: options.distance || 'Cosine'
            }
          });
        }
      } catch (error) {
        // Fallback to in-memory
      }
    }
  }
  
  async upsert(collection, vectors) {
    await this.ensureCollection(collection);
    
    if (this.client) {
      try {
        await this.client.upsert(collection, {
          wait: true,
          points: vectors.map(v => ({
            id: v.id || crypto.randomUUID(),
            vector: v.vector,
            payload: v.payload || {}
          }))
        });
      } catch (error) {
        // Fallback to in-memory
        this._upsertInMemory(collection, vectors);
      }
    } else {
      this._upsertInMemory(collection, vectors);
    }
  }
  
  _upsertInMemory(collection, vectors) {
    const coll = this._collections.get(collection);
    if (!coll) return;
    
    vectors.forEach(v => {
      const existing = coll.vectors.findIndex(vec => vec.id === v.id);
      if (existing >= 0) {
        coll.vectors[existing] = v;
      } else {
        coll.vectors.push(v);
      }
    });
  }
  
  async search(collection, queryVector, options = {}) {
    const { limit = 10, threshold = 0, filter = {} } = options;
    
    if (this.client) {
      try {
        const results = await this.client.search(collection, {
          vector: queryVector,
          limit,
          score_threshold: threshold,
          filter: Object.keys(filter).length > 0 ? filter : undefined,
          with_payload: true,
          with_vector: options.includeVectors
        });
        
        return results.map(r => ({
          id: r.id,
          score: r.score,
          payload: r.payload,
          vector: r.vector
        }));
      } catch (error) {
        // Fallback to in-memory
        return this._searchInMemory(collection, queryVector, options);
      }
    } else {
      return this._searchInMemory(collection, queryVector, options);
    }
  }
  
  _searchInMemory(collection, queryVector, options) {
    const coll = this._collections.get(collection);
    if (!coll) return [];
    
    const { limit = 10, threshold = 0 } = options;
    
    // Calculate cosine similarity for each vector
    const results = coll.vectors.map(v => ({
      id: v.id,
      score: this._cosineSimilarity(queryVector, v.vector),
      payload: v.payload,
      document: v.payload,
      vector: options.includeVectors ? v.vector : undefined
    }));
    
    // Filter by threshold and sort by score
    return results
      .filter(r => r.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
  
  _cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
  
  async find(collection, filter = {}, options = {}) {
    const coll = this._collections.get(collection);
    if (!coll) return [];
    
    // Simple filter implementation for in-memory
    return coll.vectors.filter(v => {
      for (const [key, value] of Object.entries(filter)) {
        // Check both the vector ID and payload fields
        if (key === 'id') {
          if (v.id !== value) return false;
        } else if (v.payload[key] !== value) {
          return false;
        }
      }
      return true;
    }).map(v => v.payload);
  }
  
  async update(collection, filter, update) {
    const coll = this._collections.get(collection);
    if (!coll) return { modifiedCount: 0 };
    
    let modifiedCount = 0;
    coll.vectors.forEach(v => {
      let matches = true;
      for (const [key, value] of Object.entries(filter)) {
        if (v.payload[key] !== value) {
          matches = false;
          break;
        }
      }
      
      if (matches) {
        Object.assign(v.payload, update);
        modifiedCount++;
      }
    });
    
    return { modifiedCount };
  }
  
  async delete(collection, filter) {
    const coll = this._collections.get(collection);
    if (!coll) return { deletedCount: 0 };
    
    const before = coll.vectors.length;
    coll.vectors = coll.vectors.filter(v => {
      for (const [key, value] of Object.entries(filter)) {
        if (v.payload[key] === value) return false;
      }
      return true;
    });
    
    return { deletedCount: before - coll.vectors.length };
  }
}