/**
 * DataSourceFactory - Creates DataSource instances for different URI schemes with comprehensive caching
 * 
 * This factory creates appropriate DataSource instances based on parsed URI components.
 * Implements multi-level caching:
 * - DataSource instance cache (keyed by URI)
 * - Schema cache (keyed by resource type)
 * - Connection pool cache (keyed by server/connection string)
 * - Metadata cache (keyed by resource identifier)
 * 
 * Cache invalidation is handled through TTL and explicit invalidation methods.
 */

import { LRUCache } from './utils/LRUCache.js';

export class DataSourceFactory {
  constructor(resourceManager, options = {}) {
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }

    this.resourceManager = resourceManager;
    this.options = {
      // DataSource instance cache
      maxDataSources: options.maxDataSources || 500,
      dataSourceTTL: options.dataSourceTTL || 30 * 60 * 1000, // 30 minutes
      
      // Schema cache
      maxSchemas: options.maxSchemas || 100,
      schemaTTL: options.schemaTTL || 60 * 60 * 1000, // 1 hour
      
      // Connection cache
      maxConnections: options.maxConnections || 50,
      connectionTTL: options.connectionTTL || 10 * 60 * 1000, // 10 minutes
      
      // Metadata cache
      maxMetadata: options.maxMetadata || 1000,
      metadataTTL: options.metadataTTL || 5 * 60 * 1000, // 5 minutes
      
      ...options
    };

    // Multi-level cache system
    this.dataSourceCache = new LRUCache({ 
      maxSize: this.options.maxDataSources,
      ttl: this.options.dataSourceTTL
    });
    
    this.schemaCache = new LRUCache({ 
      maxSize: this.options.maxSchemas,
      ttl: this.options.schemaTTL
    });
    
    this.connectionCache = new LRUCache({ 
      maxSize: this.options.maxConnections,
      ttl: this.options.connectionTTL
    });
    
    this.metadataCache = new LRUCache({ 
      maxSize: this.options.maxMetadata,
      ttl: this.options.metadataTTL
    });

    // Cache statistics
    this.stats = {
      dataSourceHits: 0,
      dataSourceMisses: 0,
      schemaHits: 0,
      schemaMisses: 0,
      connectionHits: 0,
      connectionMisses: 0,
      metadataHits: 0,
      metadataMisses: 0,
      totalRequests: 0
    };

    // Registered DataSource creators (lazy loaded)
    this.creators = new Map();
    this._initialized = false;
  }

  /**
   * Create DataSource for parsed URI with comprehensive caching
   * @param {Object} parsed - Parsed URI components
   * @param {Object} resourceManager - ResourceManager instance
   * @returns {Promise<DataSource>} DataSource instance
   */
  async create(parsed, resourceManager = this.resourceManager) {
    this.stats.totalRequests++;
    
    // Create cache key from URI components
    const cacheKey = this._createDataSourceCacheKey(parsed);
    
    // Check DataSource cache first
    const cachedDataSource = this.dataSourceCache.get(cacheKey);
    if (cachedDataSource) {
      this.stats.dataSourceHits++;
      return cachedDataSource;
    }
    
    this.stats.dataSourceMisses++;
    
    // Ensure creators are initialized
    if (!this._initialized) {
      await this._initializeCreators();
    }

    // Get creator for resource type
    const creator = this.creators.get(parsed.resourceType);
    if (!creator) {
      throw new Error(`No DataSource creator registered for resource type: ${parsed.resourceType}`);
    }

    // Create DataSource with caching support
    const dataSource = await this._createWithCaching(creator, parsed, resourceManager);
    
    // Cache the DataSource
    this.dataSourceCache.set(cacheKey, dataSource);
    
    return dataSource;
  }

  /**
   * Get cached schema for resource type
   * @param {string} resourceType - Resource type
   * @param {Function} schemaGenerator - Function to generate schema if not cached
   * @returns {Object} Schema object
   */
  async getCachedSchema(resourceType, schemaGenerator) {
    const schemaKey = `schema:${resourceType}`;
    
    const cachedSchema = this.schemaCache.get(schemaKey);
    if (cachedSchema) {
      this.stats.schemaHits++;
      return cachedSchema;
    }
    
    this.stats.schemaMisses++;
    
    // Generate schema
    const schema = await schemaGenerator();
    
    // Cache schema
    this.schemaCache.set(schemaKey, schema);
    
    return schema;
  }

  /**
   * Get cached connection for server/connection string
   * @param {string} connectionKey - Connection identifier
   * @param {Function} connectionCreator - Function to create connection if not cached
   * @returns {Object} Connection object
   */
  async getCachedConnection(connectionKey, connectionCreator) {
    const cachedConnection = this.connectionCache.get(connectionKey);
    if (cachedConnection) {
      this.stats.connectionHits++;
      return cachedConnection;
    }
    
    this.stats.connectionMisses++;
    
    // Create connection
    const connection = await connectionCreator();
    
    // Cache connection
    this.connectionCache.set(connectionKey, connection);
    
    return connection;
  }

  /**
   * Get cached metadata for resource
   * @param {string} metadataKey - Metadata identifier
   * @param {Function} metadataGenerator - Function to generate metadata if not cached
   * @returns {Object} Metadata object
   */
  async getCachedMetadata(metadataKey, metadataGenerator) {
    const cachedMetadata = this.metadataCache.get(metadataKey);
    if (cachedMetadata) {
      this.stats.metadataHits++;
      return cachedMetadata;
    }
    
    this.stats.metadataMisses++;
    
    // Generate metadata
    const metadata = await metadataGenerator();
    
    // Cache metadata
    this.metadataCache.set(metadataKey, metadata);
    
    return metadata;
  }

  /**
   * Invalidate cache entries for specific resource
   * @param {string} resourceType - Resource type to invalidate
   * @param {string} path - Specific path to invalidate (optional)
   */
  invalidateCache(resourceType, path = null) {
    // Invalidate DataSource cache entries
    for (const [key] of this.dataSourceCache.entries()) {
      if (key.includes(`/${resourceType}/`)) {
        if (!path || key.includes(path)) {
          this.dataSourceCache.delete(key);
        }
      }
    }
    
    // Invalidate schema cache for resource type
    this.schemaCache.delete(`schema:${resourceType}`);
    
    // Invalidate related metadata
    for (const [key] of this.metadataCache.entries()) {
      if (key.includes(resourceType)) {
        if (!path || key.includes(path)) {
          this.metadataCache.delete(key);
        }
      }
    }
  }

  /**
   * Clear all caches
   */
  clearAllCaches() {
    this.dataSourceCache.clear();
    this.schemaCache.clear();
    this.connectionCache.clear();
    this.metadataCache.clear();
    
    // Reset stats
    this.stats = {
      dataSourceHits: 0,
      dataSourceMisses: 0,
      schemaHits: 0,
      schemaMisses: 0,
      connectionHits: 0,
      connectionMisses: 0,
      metadataHits: 0,
      metadataMisses: 0,
      totalRequests: 0
    };
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    const dataSourceTotal = this.stats.dataSourceHits + this.stats.dataSourceMisses;
    const schemaTotal = this.stats.schemaHits + this.stats.schemaMisses;
    const connectionTotal = this.stats.connectionHits + this.stats.connectionMisses;
    const metadataTotal = this.stats.metadataHits + this.stats.metadataMisses;
    
    return {
      dataSource: {
        hits: this.stats.dataSourceHits,
        misses: this.stats.dataSourceMisses,
        hitRate: dataSourceTotal > 0 ? this.stats.dataSourceHits / dataSourceTotal : 0,
        cacheSize: this.dataSourceCache.size,
        maxSize: this.options.maxDataSources
      },
      schema: {
        hits: this.stats.schemaHits,
        misses: this.stats.schemaMisses,
        hitRate: schemaTotal > 0 ? this.stats.schemaHits / schemaTotal : 0,
        cacheSize: this.schemaCache.size,
        maxSize: this.options.maxSchemas
      },
      connection: {
        hits: this.stats.connectionHits,
        misses: this.stats.connectionMisses,
        hitRate: connectionTotal > 0 ? this.stats.connectionHits / connectionTotal : 0,
        cacheSize: this.connectionCache.size,
        maxSize: this.options.maxConnections
      },
      metadata: {
        hits: this.stats.metadataHits,
        misses: this.stats.metadataMisses,
        hitRate: metadataTotal > 0 ? this.stats.metadataHits / metadataTotal : 0,
        cacheSize: this.metadataCache.size,
        maxSize: this.options.maxMetadata
      },
      totalRequests: this.stats.totalRequests,
      overallHitRate: this.stats.totalRequests > 0 ? 
        (this.stats.dataSourceHits + this.stats.schemaHits + this.stats.connectionHits + this.stats.metadataHits) / 
        (this.stats.totalRequests * 4) : 0
    };
  }

  /**
   * Create cache key for DataSource
   * @param {Object} parsed - Parsed URI components
   * @returns {string} Cache key
   * @private
   */
  _createDataSourceCacheKey(parsed) {
    return `ds:${parsed.server}/${parsed.resourceType}/${parsed.path}`;
  }

  /**
   * Create DataSource with caching support
   * @param {Function} creator - DataSource creator function
   * @param {Object} parsed - Parsed URI components
   * @param {Object} resourceManager - ResourceManager instance
   * @returns {Promise<DataSource>} DataSource instance
   * @private
   */
  async _createWithCaching(creator, parsed, resourceManager) {
    // Create context with caching support
    const context = {
      parsed,
      resourceManager,
      factory: this,
      
      // Helper methods for DataSource implementations
      getCachedSchema: (schemaGenerator) => this.getCachedSchema(parsed.resourceType, schemaGenerator),
      getCachedConnection: (connectionKey, connectionCreator) => this.getCachedConnection(connectionKey, connectionCreator),
      getCachedMetadata: (metadataKey, metadataGenerator) => this.getCachedMetadata(metadataKey, metadataGenerator),
      invalidateCache: (path) => this.invalidateCache(parsed.resourceType, path)
    };

    // Create DataSource with caching context
    return await creator(context);
  }

  /**
   * Initialize DataSource creators (lazy loading)
   * @private
   */
  async _initializeCreators() {
    if (this._initialized) return;

    // Register default DataSource creators
    this.creators.set('env', async (context) => {
      const { ConfigDataSource } = await import('./datasources/ConfigDataSource.js');
      return new ConfigDataSource(context);
    });

    this.creators.set('mongodb', async (context) => {
      const { MongoDataSource } = await import('./datasources/MongoDataSource.js');
      return new MongoDataSource(context);
    });

    this.creators.set('filesystem', async (context) => {
      const { FileDataSource } = await import('./datasources/FileDataSource.js');
      return new FileDataSource(context);
    });

    this.creators.set('service', async (context) => {
      const { ServiceDataSource } = await import('./datasources/ServiceDataSource.js');
      return new ServiceDataSource(context);
    });

    // Register additional creators from ResourceManager configuration
    const additionalCreators = this.resourceManager.get('dataSourceCreators');
    if (additionalCreators && typeof additionalCreators === 'object') {
      for (const [type, creator] of Object.entries(additionalCreators)) {
        this.creators.set(type, creator);
      }
    }

    this._initialized = true;
  }

  /**
   * Register custom DataSource creator
   * @param {string} resourceType - Resource type
   * @param {Function} creator - Creator function
   */
  registerCreator(resourceType, creator) {
    if (!resourceType || typeof resourceType !== 'string') {
      throw new Error('Resource type must be a non-empty string');
    }
    
    if (!creator || typeof creator !== 'function') {
      throw new Error('Creator must be a function');
    }
    
    this.creators.set(resourceType, creator);
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    // Clean up any open connections in connection cache
    for (const [key, connection] of this.connectionCache.entries()) {
      if (connection && typeof connection.close === 'function') {
        try {
          await connection.close();
        } catch (error) {
          console.warn(`Error closing connection ${key}:`, error.message);
        }
      }
    }
    
    // Clear all caches
    this.clearAllCaches();
    
    this._initialized = false;
  }
}