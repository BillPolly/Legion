/**
 * QdrantVectorStore - Handles vector storage and search using Qdrant
 * 
 * Now uses ResourceManager for singleton Qdrant client management.
 * Includes automatic Qdrant startup when connection fails.
 */

import { ResourceManager } from '@legion/resource-manager';
import { QdrantAutoStarter } from '../utils/QdrantAutoStarter.js';

export class QdrantVectorStore {
  constructor(config, resourceManager = null) {
    this.config = {
      url: config.url || 'http://localhost:6333',
      apiKey: config.apiKey,
      timeout: config.timeout || 30000,
      autoStart: config.autoStart !== false // Default true
    };
    
    // Use provided ResourceManager or get singleton
    this.resourceManager = resourceManager || ResourceManager.getInstance();
    this.client = null;
    this.connected = false;
    
    // Initialize auto-starter with config
    // Extract port from URL (default to 6333 if not found)
    let port = 6333;
    try {
      const urlParts = this.config.url.split(':');
      if (urlParts.length > 2) {
        port = parseInt(urlParts[2].replace(/\D/g, '')) || 6333;
      }
    } catch {
      port = 6333;
    }
    
    this.autoStarter = new QdrantAutoStarter({
      port: port,
      autoStart: this.config.autoStart,
      verbose: config.verbose || process.env.QDRANT_VERBOSE === 'true'
    });
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
      // If connection fails and auto-start is enabled, try to start Qdrant
      // Check for various connection failure indicators
      const isConnectionError = error.message.includes('ECONNREFUSED') || 
                                error.message.includes('fetch failed') ||
                                error.message.includes('connect ECONNREFUSED') ||
                                error.message.includes('Unable to check client-server compatibility');
      
      if (this.config.autoStart && isConnectionError) {
        console.log('⚠️ Qdrant connection failed, attempting auto-start...');
        
        try {
          // Ensure Qdrant is running
          await this.autoStarter.ensureQdrantRunning();
          
          // Retry connection after Qdrant starts
          console.log('🔄 Retrying Qdrant connection...');
          await this.client.getCollections();
          this.connected = true;
          console.log('✅ Connected to Qdrant at', this.config.url);
        } catch (autoStartError) {
          this.connected = false;
          throw new Error(`Failed to auto-start Qdrant: ${autoStartError.message}`);
        }
      } else {
        this.connected = false;
        throw new Error(`Failed to connect to Qdrant at ${this.config.url}: ${error.message}`);
      }
    }
  }
  
  async disconnect() {
    this.connected = false;
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
      console.log(`📝 Creating Qdrant collection: ${name} with ${vectorSize} dimensions`);
      await this.client.createCollection(name, {
        vectors: {
          size: vectorSize,
          distance: options.distance || 'Cosine'
        }
      });
      console.log(`✅ Created Qdrant collection: ${name} (${vectorSize}D)`);
    } else {
      console.log(`📋 Collection ${name} already exists`);
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
    
    // Generate numeric IDs - Qdrant prefers numeric IDs for better performance
    const points = vectors.map((v, idx) => {
      let id = v.id;
      
      // If ID is already a number, use it
      if (typeof id === 'number') {
        // Keep as is
      } 
      // If ID is a string that looks like a number, convert it
      else if (typeof id === 'string' && /^\d+$/.test(id)) {
        id = parseInt(id, 10);
      }
      // Generate a numeric ID based on timestamp and index
      else {
        // Use timestamp + index to create a unique numeric ID
        id = Date.now() * 1000 + idx;
      }
      
      return {
        id: id,
        vector: v.vector,
        payload: v.payload || {}
      };
    });
    
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
      if (error.response) {
        const text = await error.response.text();
        console.error('   Response body:', text);
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
    
    try {
      const result = await this.client.scroll(collection, {
        filter: Object.keys(filter).length > 0 ? filter : undefined,
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