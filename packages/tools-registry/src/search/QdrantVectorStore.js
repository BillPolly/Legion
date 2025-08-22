/**
 * QdrantVectorStore - Handles vector storage and search using Qdrant
 * 
 * Uses ResourceManager for singleton Qdrant client management.
 * NO FALLBACKS - fails immediately if Qdrant is not available.
 */

import { ResourceManager } from '@legion/resource-manager';

export class QdrantVectorStore {
  constructor(config, resourceManager = null) {
    this.config = {
      url: config.url || 'http://localhost:6333',
      apiKey: config.apiKey,
      timeout: config.timeout || 30000
    };
    
    // Use provided ResourceManager or get singleton
    this.resourceManager = resourceManager || ResourceManager.getInstance();
    this.client = null;
    this.connected = false;
  }
  
  
  async _ensureClient() {
    if (this.client) return this.client;
    
    // Create unique key for this Qdrant connection (avoid dots as they trigger dot notation parsing)
    const clientKey = `qdrant_client_${this.config.url.replace(/[^a-zA-Z0-9]/g, '_')}`;
    
    // Use ResourceManager to get or create singleton Qdrant client
    this.client = await this.resourceManager.getOrInitialize(clientKey, async () => {
      try {
        // Dynamic import to avoid hard dependency
        const qdrantModule = await import('@qdrant/js-client-rest').catch((error) => {
          console.error('❌ Failed to import @qdrant/js-client-rest:', error.message);
          return { QdrantClient: null };
        });
        
        const { QdrantClient } = qdrantModule;
        
        if (!QdrantClient) {
          throw new Error('Qdrant client not available - @qdrant/js-client-rest may not be installed');
        }
        
        console.log(`Creating new Qdrant client for ${this.config.url}`);
        return new QdrantClient({
          url: this.config.url,
          apiKey: this.config.apiKey,
          timeout: this.config.timeout
        });
      } catch (error) {
        console.warn('Qdrant client initialization failed:', error.message);
        throw error;
      }
    });
    
    return this.client;
  }
  
  async connect() {
    // Ensure client is initialized through ResourceManager
    await this._ensureClient();
    
    if (!this.client) {
      throw new Error('Failed to initialize Qdrant client - @qdrant/js-client-rest may not be installed');
    }
    
    try {
      // Use getCollections() to test connection - it's a simpler API call
      await this.client.getCollections();
      this.connected = true;
      console.log('✅ Connected to Qdrant at', this.config.url);
    } catch (error) {
      // NO FALLBACK - just fail immediately as requested
      this.connected = false;
      throw new Error(`Failed to connect to Qdrant at ${this.config.url}: ${error.message}`);
    }
  }
  
  async disconnect() {
    this.connected = false;
  }
  
  async collectionExists(name) {
    if (!this.client) {
      await this._ensureClient();
    }
    
    if (!this.client) {
      throw new Error('Qdrant client not initialized');
    }
    
    const collections = await this.client.getCollections();
    return collections.collections.some(c => c.name === name);
  }
  
  async ensureCollection(name, vectorSize = 1536, options = {}) {
    if (!this.client) {
      await this._ensureClient();
    }
    
    if (!this.client) {
      throw new Error('Qdrant client not initialized');
    }
    
    const collections = await this.client.getCollections();
    const exists = collections.collections.some(c => c.name === name);
    
    if (!exists) {
      console.log(`📝 Creating new Qdrant collection: ${name} with ${vectorSize} dimensions`);
      await this.client.createCollection(name, {
        vectors: {
          size: vectorSize,
          distance: options.distance || 'Cosine'
        }
      });
      console.log(`✅ Created new Qdrant collection: ${name} (${vectorSize}D)`);
    } else {
      // Collection exists - don't log unless verbose
      if (process.env.QDRANT_VERBOSE === 'true') {
        console.log(`📋 Qdrant collection ${name} already exists`);
      }
    }
  }

  async createCollection(name, options = {}) {
    const { dimension = 1536, distance = 'cosine', description = '' } = options;
    
    // Always delete existing collection first to avoid dimension conflicts
    try {
      await this.deleteCollection(name);
    } catch (error) {
      // Collection might not exist, which is fine
    }
    
    await this.ensureCollection(name, dimension, { distance: distance.charAt(0).toUpperCase() + distance.slice(1), description });
  }

  async count(collection) {
    if (!this.client) {
      await this._ensureClient();
    }
    
    if (!this.client) {
      throw new Error('Qdrant client not initialized');
    }
    
    try {
      const result = await this.client.count(collection);
      return result.count;
    } catch (error) {
      // Collection might not exist
      if (error.message.includes('Not found')) {
        return 0;
      }
      throw error;
    }
  }
  
  async upsert(collection, vectors) {
    if (!this.client) {
      await this._ensureClient();
    }
    
    if (!this.client) {
      throw new Error('Qdrant client not initialized');
    }
    
    if (!vectors || vectors.length === 0) {
      return { success: true, message: 'No vectors to upsert' };
    }
    
    // Detect vector dimensions from first vector
    const vectorSize = vectors[0].vector.length;
    await this.ensureCollection(collection, vectorSize);
    
    // Create points for upsert - IDs should already be in valid format (numeric or UUID)
    const points = vectors.map((v) => ({
      id: v.id,
      vector: v.vector,
      payload: v.payload
    }));
    
    // Only log for large batches or in verbose mode
    if (points.length > 10 || process.env.DEBUG_QDRANT === 'true') {
      console.log(`📝 Upserting ${points.length} vectors to Qdrant collection: ${collection} (${vectorSize}D)`);
    }
    
    try {
      const result = await this.client.upsert(collection, {
        wait: true,
        points: points
      });
      return result;
    } catch (error) {
      console.error('❌ Upsert error:', error.message);
      console.error('❌ Error type:', error.constructor.name);
      
      // Try multiple approaches to get error details from Qdrant client
      if (error.response) {
        try {
          const text = await error.response.text();
          console.error('   Response body:', text);
        } catch (responseError) {
          console.error('   Could not read response body:', responseError.message);
        }
      }
      
      // Log additional error properties that might contain details
      if (error.status) console.error('   Status:', error.status);
      if (error.statusText) console.error('   Status text:', error.statusText);
      if (error.body) console.error('   Body:', error.body);
      if (error.data) console.error('   Data:', error.data);
      
      // For debugging: log first vector sample on error
      if (points && points.length > 0) {
        console.error('🔍 Debug - First vector sample:', {
          id: points[0].id,
          idType: typeof points[0].id,
          vectorLength: points[0].vector?.length,
          vectorType: Array.isArray(points[0].vector) ? 'array' : typeof points[0].vector,
          payloadKeys: points[0].payload ? Object.keys(points[0].payload) : 'none'
        });
      }
      
      throw error;
    }
  }
  
  async search(collection, queryVector, options = {}) {
    if (!this.client) {
      await this._ensureClient();
    }
    
    if (!this.client) {
      throw new Error('Qdrant client not initialized');
    }
    
    const { limit = 10, threshold = 0, filter = {} } = options;
    
    // Convert simple filter format to Qdrant filter format
    let qdrantFilter = undefined;
    if (Object.keys(filter).length > 0) {
      qdrantFilter = {
        must: Object.entries(filter).map(([key, value]) => ({
          key: key,
          match: { value: value }
        }))
      };
    }
    
    const results = await this.client.search(collection, {
      vector: queryVector,
      limit,
      score_threshold: threshold,
      filter: qdrantFilter,
      with_payload: true,
      with_vector: options.includeVectors
    });
    
    return results.map(r => ({
      id: r.id,
      score: r.score,
      payload: r.payload,
      vector: r.vector
    }));
  }
  
  async find(collection, filter = {}, options = {}) {
    if (!this.client) {
      await this._ensureClient();
    }
    
    if (!this.client) {
      throw new Error('Qdrant client not initialized');
    }
    
    // Qdrant doesn't have a direct "find" - use scroll with filter
    const { limit = 100 } = options;
    
    // Convert simple filter format to Qdrant filter format
    let qdrantFilter = undefined;
    if (Object.keys(filter).length > 0) {
      qdrantFilter = {
        must: Object.entries(filter).map(([key, value]) => ({
          key: key,
          match: { value: value }
        }))
      };
    }
    
    try {
      const result = await this.client.scroll(collection, {
        filter: qdrantFilter,
        limit,
        with_payload: true
      });
      
      return result.points.map(p => p.payload);
    } catch (error) {
      if (error.message.includes('Not found')) {
        return [];
      }
      throw error;
    }
  }
  
  async update(collection, filter, update) {
    if (!this.client) {
      await this._ensureClient();
    }
    
    if (!this.client) {
      throw new Error('Qdrant client not initialized');
    }
    
    // Qdrant doesn't have direct update by filter - need to find and update points
    throw new Error('Update by filter not implemented for Qdrant - use upsert with specific IDs');
  }
  
  async delete(collection, filter) {
    if (!this.client) {
      await this._ensureClient();
    }
    
    if (!this.client) {
      throw new Error('Qdrant client not initialized');
    }
    
    // Delete by IDs (IDs should already be in valid Qdrant format)
    if (filter.ids) {
      
      // Delete by IDs
      const result = await this.client.delete(collection, {
        points: filter.ids,
        wait: true
      });
      
      return { deletedCount: filter.ids.length };
    }
    
    // Build Qdrant filter format for other filters
    const qdrantFilter = {
      must: Object.entries(filter).map(([key, value]) => ({
        key: key,
        match: { value: value }
      }))
    };
    
    const result = await this.client.delete(collection, {
      filter: qdrantFilter,
      wait: true
    });
    
    return { deletedCount: result.operation_id ? 1 : 0 };
  }
  
  /**
   * Clear all points from a collection without deleting the collection itself
   */
  async clearCollection(collectionName) {
    if (!this.client) {
      await this._ensureClient();
    }
    
    if (!this.client) {
      throw new Error('Qdrant client not initialized');
    }
    
    try {
      // Check if collection exists first
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(c => c.name === collectionName);
      
      if (!exists) {
        return { success: true, message: `Collection ${collectionName} does not exist` };
      }
      
      // Use an empty filter to match all points
      await this.client.delete(collectionName, {
        filter: {}, // Empty filter matches all points
        wait: true  // Wait for the operation to complete
      });
      
      return { success: true, message: `All points cleared from collection ${collectionName}` };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete entire collection (for complete index clearing)
   */
  async deleteCollection(collectionName) {
    if (!this.client) {
      await this._ensureClient();
    }
    
    if (!this.client) {
      throw new Error('Qdrant client not initialized');
    }
    
    try {
      await this.client.deleteCollection(collectionName);
      return { success: true, message: `Collection ${collectionName} deleted` };
    } catch (error) {
      if (error.message.includes('Not found')) {
        return { success: true, message: `Collection ${collectionName} did not exist` };
      }
      throw error;
    }
  }
  
  /**
   * Delete vectors by filter (for selective module clearing)
   */
  async deleteByFilter(collection, filter) {
    if (!this.client) {
      await this._ensureClient();
    }
    
    if (!this.client) {
      throw new Error('Qdrant client not initialized');
    }
    
    // Build Qdrant filter format
    const qdrantFilter = {
      must: Object.entries(filter).map(([key, value]) => ({
        key: key,
        match: { value: value }
      }))
    };
    
    const result = await this.client.delete(collection, {
      filter: qdrantFilter,
      wait: true
    });
    
    return { deletedCount: result.operation_id ? 1 : 0 };
  }
}