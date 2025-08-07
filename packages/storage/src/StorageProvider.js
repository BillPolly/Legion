/**
 * StorageProvider - Main orchestration layer for storage operations
 * 
 * 🚨 CRITICAL: ALL INITIALIZATION VIA RESOURCEMANAGER 🚨
 * ResourceManager automatically loads ALL .env variables including:
 * - MONGODB_URL, POSTGRESQL_URL, REDIS_AUTH_TOKEN, etc.
 * - All API keys and connection strings are available automatically
 * 
 * Follows the async ResourceManager pattern from Legion CLAUDE.md
 * Manages multiple storage providers with dual access patterns:
 * 1. Direct backend usage (other packages can use directly)
 * 2. Actor-based usage (for frontend and distributed operations)
 */

// Use dynamic imports for optional dependencies
import { Provider } from './core/Provider.js';

export class StorageProvider {
  /**
   * Private constructor - use StorageProvider.create() instead
   * @private
   */
  constructor(resourceManager, config) {
    this.resourceManager = resourceManager;
    this.config = config;
    this.providers = new Map();
    this.actorSpace = null;
    this.initialized = false;
  }

  /**
   * Async factory method following ResourceManager pattern
   * 🚨 ResourceManager provides ALL configuration automatically from .env
   * @param {ResourceManager} resourceManager - Initialized ResourceManager instance
   * @returns {Promise<StorageProvider>}
   */
  static async create(resourceManager) {
    if (!resourceManager || !resourceManager.initialized) {
      throw new Error('StorageProvider requires an initialized ResourceManager');
    }

    // 🚨 ALL configuration comes from ResourceManager (.env loaded automatically)
    const config = resourceManager.has('env.STORAGE_CONFIG') ? resourceManager.env.STORAGE_CONFIG : {};
    const mongoUrl = resourceManager.has('env.MONGODB_URL') ? resourceManager.env.MONGODB_URL : null;
    const postgresUrl = resourceManager.has('env.POSTGRESQL_URL') ? resourceManager.env.POSTGRESQL_URL : null;
    const redisUrl = resourceManager.has('env.REDIS_URL') ? resourceManager.env.REDIS_URL : null;
    const sqliteFile = resourceManager.has('env.SQLITE_FILE') ? resourceManager.env.SQLITE_FILE : null;

    const provider = new StorageProvider(resourceManager, config);

    // Initialize actor space for storage operations (optional - only if using actors)
    try {
      const { ActorSpace } = await import('@legion/actors');
      provider.actorSpace = new ActorSpace(`storage-${Date.now()}`);
      console.log('ActorSpace initialized successfully');
    } catch (error) {
      // ActorSpace is optional - only needed for actor-based usage
      console.log('ActorSpace not available - actor-based operations disabled:', error.message);
    }

    // Auto-configure providers based on available URLs from ResourceManager
    await provider._autoConfigureProviders({ mongoUrl, postgresUrl, redisUrl, sqliteFile });

    provider.initialized = true;
    return provider;
  }

  /**
   * Auto-configure providers based on available URLs from ResourceManager
   * 🚨 All URLs and API keys come from ResourceManager automatically
   * @private
   */
  async _autoConfigureProviders({ mongoUrl, postgresUrl, redisUrl, sqliteFile }) {
    // Auto-configure MongoDB if connection string is available
    if (mongoUrl) {
      const { MongoDBProvider } = await import('./providers/mongodb/MongoDBProvider.js');
      await this.addProvider('mongodb', new MongoDBProvider({
        connectionString: mongoUrl,
        ...this._getProviderConfig('mongodb')
      }));
    }

    // Auto-configure SQLite if file path is available
    if (sqliteFile) {
      const { SQLiteProvider } = await import('./providers/sqlite/SQLiteProvider.js');
      await this.addProvider('sqlite', new SQLiteProvider({
        filename: sqliteFile,
        ...this._getProviderConfig('sqlite')
      }));
    }

    // Auto-configure PostgreSQL if connection string is available  
    if (postgresUrl) {
      // Future: PostgreSQL provider implementation
      console.log('PostgreSQL URL found - provider implementation pending');
    }

    // Auto-configure Redis if connection string is available
    if (redisUrl) {
      // Future: Redis provider implementation  
      console.log('Redis URL found - provider implementation pending');
    }

    // Always add memory provider for testing/fallback
    const { MemoryProvider } = await import('./providers/memory/MemoryProvider.js');
    await this.addProvider('memory', new MemoryProvider(
      this._getProviderConfig('memory')
    ));
  }

  /**
   * Get provider-specific configuration from ResourceManager
   * @private
   */
  _getProviderConfig(providerName) {
    const configKey = `env.STORAGE_${providerName.toUpperCase()}_CONFIG`;
    return this.resourceManager.has(configKey) ? this.resourceManager.get(configKey) : {};
  }

  /**
   * Add a storage provider
   * @param {string} name - Provider name
   * @param {Provider} provider - Provider instance
   */
  async addProvider(name, provider) {
    if (!(provider instanceof Provider)) {
      throw new Error('Provider must extend Provider base class');
    }

    await provider.connect();
    this.providers.set(name, provider);
  }

  /**
   * Get a storage provider by name
   * @param {string} name - Provider name
   * @returns {Provider}
   */
  getProvider(name) {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Provider '${name}' not found`);
    }
    return provider;
  }

  /**
   * Create an actor for a specific collection
   * @param {string} providerName - Provider to use
   * @param {string} collection - Collection name
   * @returns {Actor}
   */
  async createCollectionActor(providerName, collection) {
    if (!this.actorSpace) {
      throw new Error('Actor-based operations not available - ActorSpace not initialized');
    }
    
    const provider = this.getProvider(providerName);
    const { CollectionActor } = await import('./actors/CollectionActor.js');
    
    const actor = new CollectionActor(provider, collection);
    return this.actorSpace.register(actor, `${providerName}-${collection}-${Date.now()}`);
  }

  /**
   * Cleanup all providers and resources
   */
  async cleanup() {
    for (const [name, provider] of this.providers) {
      try {
        await provider.disconnect();
      } catch (error) {
        console.error(`Error disconnecting provider '${name}':`, error);
      }
    }
    this.providers.clear();
  }
}