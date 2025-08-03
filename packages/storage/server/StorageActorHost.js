/**
 * Storage Actor Host
 * Manages Actor instances and provides StorageProvider integration
 */

export class StorageActorHost {
  constructor(resourceManager) {
    this.resourceManager = resourceManager;
    this.actors = new Map();
    this.storageProvider = null;
    this.actorIdCounter = 0;
  }

  /**
   * Initialize the host and register actors
   */
  async initialize() {
    try {
      // Initialize StorageProvider if ResourceManager available
      if (this.resourceManager) {
        const { StorageProvider } = await import('../src/index.js');
        this.storageProvider = await StorageProvider.create(this.resourceManager);
      }
    } catch (error) {
      console.error('Failed to initialize StorageProvider:', error.message);
      // Continue without StorageProvider - actors will use mock data
    }

    // Register core actors
    this.registerActor('DatabaseActor', new DatabaseActor(this.storageProvider));
    this.registerActor('CollectionActor', new CollectionActor(this.storageProvider));
    this.registerActor('DocumentActor', new DocumentActor(this.storageProvider));
    this.registerActor('QueryActor', new QueryActor(this.storageProvider));
  }

  /**
   * Register an actor
   */
  registerActor(name, actor) {
    actor.name = name;
    actor.storageProvider = this.storageProvider;
    this.actors.set(name, actor);
  }

  /**
   * Get an actor by name
   */
  getActor(name) {
    return this.actors.get(name) || null;
  }

  /**
   * Create a new actor instance
   */
  async createActor(type, config) {
    const actorId = `${type}-${++this.actorIdCounter}`;
    
    let actor;
    switch (type) {
      case 'CollectionActor':
        actor = new CollectionActor(this.storageProvider, config);
        break;
      case 'DocumentActor':
        actor = new DocumentActor(this.storageProvider, config);
        break;
      case 'QueryActor':
        actor = new QueryActor(this.storageProvider, config);
        break;
      default:
        throw new Error(`Unknown actor type: ${type}`);
    }

    actor.name = actorId;
    this.actors.set(actorId, actor);
    return actorId;
  }

  /**
   * Remove an actor instance
   */
  removeActor(actorId) {
    this.actors.delete(actorId);
  }

  /**
   * Cleanup all actors and resources
   */
  async cleanup() {
    // Clear all actors
    this.actors.clear();

    // Cleanup StorageProvider
    if (this.storageProvider) {
      await this.storageProvider.cleanup();
    }
  }
}

/**
 * DatabaseActor - Handles database-level operations
 */
class DatabaseActor {
  constructor(storageProvider) {
    this.storageProvider = storageProvider;
    this.currentDatabase = 'legion_storage'; // Default database
  }

  async receive(method, params) {
    switch (method) {
      case 'listDatabases':
        return await this.listDatabases(params);
      case 'switchDatabase':
        return await this.switchDatabase(params);
      case 'getCurrentDatabase':
        return await this.getCurrentDatabase(params);
      case 'createDatabase':
        return await this.createDatabase(params);
      case 'dropDatabase':
        return await this.dropDatabase(params);
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  async listDatabases({ provider = 'mongodb' } = {}) {
    if (!this.storageProvider) {
      return ['legion_storage', 'test', 'admin', 'local'];
    }

    try {
      const storageProvider = this.storageProvider.getProvider(provider);
      if (storageProvider && storageProvider.client) {
        const admin = storageProvider.client.db().admin();
        const result = await admin.listDatabases();
        return result.databases.map(db => ({
          name: db.name,
          sizeOnDisk: db.sizeOnDisk,
          empty: db.empty
        }));
      }
    } catch (error) {
      console.error('Error listing databases:', error);
      return [];
    }
  }

  async switchDatabase({ database, provider = 'mongodb' } = {}) {
    if (!database) {
      throw new Error('Database name is required');
    }

    console.log(`[DatabaseActor] Switching to database: ${database}`);
    this.currentDatabase = database;
    
    if (this.storageProvider) {
      try {
        const storageProvider = this.storageProvider.getProvider(provider);
        if (storageProvider && storageProvider.client) {
          // Switch the database in the provider
          console.log(`[DatabaseActor] Updating MongoDB provider to use database: ${database}`);
          storageProvider.db = storageProvider.client.db(database);
          storageProvider.databaseName = database;
          console.log(`[DatabaseActor] Database switched successfully. Provider now using: ${storageProvider.db.databaseName}`);
        }
      } catch (error) {
        console.error('Error switching database:', error);
      }
    }

    return { 
      success: true, 
      database: this.currentDatabase,
      message: `Switched to database: ${database}`
    };
  }

  async getCurrentDatabase() {
    return {
      database: this.currentDatabase
    };
  }

  async createDatabase({ database, provider = 'mongodb' } = {}) {
    if (!database) {
      throw new Error('Database name is required');
    }

    if (this.storageProvider) {
      try {
        const storageProvider = this.storageProvider.getProvider(provider);
        if (storageProvider && storageProvider.client) {
          // MongoDB creates database on first collection creation
          const db = storageProvider.client.db(database);
          await db.createCollection('_init');
          await db.collection('_init').drop();
          return { success: true, message: `Database ${database} created` };
        }
      } catch (error) {
        console.error('Error creating database:', error);
        return { success: false, error: error.message };
      }
    }
    
    return { success: false, error: 'Storage provider not available' };
  }

  async dropDatabase({ database, provider = 'mongodb' } = {}) {
    if (!database) {
      throw new Error('Database name is required');
    }

    // Prevent dropping system databases
    if (['admin', 'local', 'config'].includes(database)) {
      throw new Error('Cannot drop system database');
    }

    if (this.storageProvider) {
      try {
        const storageProvider = this.storageProvider.getProvider(provider);
        if (storageProvider && storageProvider.client) {
          const db = storageProvider.client.db(database);
          await db.dropDatabase();
          return { success: true, message: `Database ${database} dropped` };
        }
      } catch (error) {
        console.error('Error dropping database:', error);
        return { success: false, error: error.message };
      }
    }
    
    return { success: false, error: 'Storage provider not available' };
  }
}

/**
 * CollectionActor - Handles collection-level operations
 */
class CollectionActor {
  constructor(storageProvider, collection) {
    this.storageProvider = storageProvider;
    this.collection = collection;
  }

  async receive(method, params) {
    switch (method) {
      case 'find':
        return await this.find(params);
      case 'findOne':
        return await this.findOne(params);
      case 'insert':
        return await this.insert(params);
      case 'update':
        return await this.update(params);
      case 'delete':
        return await this.delete(params);
      case 'count':
        return await this.count(params);
      case 'listCollections':
        return await this.listCollections(params);
      case 'createCollection':
        return await this.createCollection(params);
      case 'dropCollection':
        return await this.dropCollection(params);
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  async find({ collection, query = {}, options = {} }) {
    console.log(`[CollectionActor] find - collection: ${collection}, query:`, query, 'options:', options);
    
    if (!this.storageProvider) {
      console.log('[CollectionActor] No storage provider, returning mock data');
      // Return mock data if no storage provider
      return [
        { _id: '1', name: 'Mock Document 1' },
        { _id: '2', name: 'Mock Document 2' }
      ];
    }

    const providerName = options.provider || 'memory';
    console.log(`[CollectionActor] Using provider: ${providerName}`);
    
    const provider = this.storageProvider.getProvider(providerName);
    const result = await provider.find(collection, query, options);
    
    console.log(`[CollectionActor] Found ${result.length} documents`);
    return result;
  }

  async findOne({ collection, query = {}, options = {} }) {
    if (!this.storageProvider) {
      return { _id: '1', name: 'Mock Document' };
    }

    const provider = this.storageProvider.getProvider(options.provider || 'memory');
    return await provider.findOne(collection, query, options);
  }

  async insert({ collection, documents, options = {} }) {
    if (!this.storageProvider) {
      return { 
        acknowledged: true, 
        insertedCount: Array.isArray(documents) ? documents.length : 1 
      };
    }

    const provider = this.storageProvider.getProvider(options.provider || 'memory');
    return await provider.insert(collection, documents, options);
  }

  async update({ collection, filter, update, options = {} }) {
    console.log(`[CollectionActor] update - collection: ${collection}, filter:`, filter, 'update:', update, 'options:', options);
    
    if (!this.storageProvider) {
      return { acknowledged: true, modifiedCount: 1 };
    }

    const providerName = options.provider || 'memory';
    const provider = this.storageProvider.getProvider(providerName);
    
    console.log(`[CollectionActor] Using provider: ${providerName} for update`);
    const result = await provider.update(collection, filter, update, options);
    
    console.log(`[CollectionActor] Update result:`, result);
    return result;
  }

  async delete({ collection, filter, options = {} }) {
    if (!this.storageProvider) {
      return { acknowledged: true, deletedCount: 1 };
    }

    const provider = this.storageProvider.getProvider(options.provider || 'memory');
    return await provider.delete(collection, filter, options);
  }

  async count({ collection, query = {}, options = {} }) {
    if (!this.storageProvider) {
      return 2;
    }

    const provider = this.storageProvider.getProvider(options.provider || 'memory');
    return await provider.count(collection, query, options);
  }

  async listCollections({ provider = 'memory' } = {}) {
    console.log(`[CollectionActor] listCollections - provider: ${provider}`);
    
    if (!this.storageProvider) {
      return ['users', 'products', 'orders'];
    }

    const storageProvider = this.storageProvider.getProvider(provider);
    
    // For MongoDB, ensure we're using the current database
    if (provider === 'mongodb' && storageProvider) {
      console.log(`[CollectionActor] Current database: ${storageProvider.databaseName || 'not set'}`);
    }
    
    const collections = await storageProvider.listCollections();
    console.log(`[CollectionActor] Found ${collections.length} collections:`, collections);
    
    return collections;
  }

  async createCollection({ name, options = {}, provider = 'memory' }) {
    if (!this.storageProvider) {
      return { created: true, name };
    }

    const storageProvider = this.storageProvider.getProvider(provider);
    return await storageProvider.createCollection(name, options);
  }

  async dropCollection({ name, provider = 'memory' }) {
    if (!this.storageProvider) {
      return { dropped: true, name };
    }

    const storageProvider = this.storageProvider.getProvider(provider);
    return await storageProvider.dropCollection(name);
  }
}

/**
 * DocumentActor - Handles single document operations
 */
class DocumentActor {
  constructor(storageProvider, documentId) {
    this.storageProvider = storageProvider;
    this.documentId = documentId;
  }

  async receive(method, params) {
    switch (method) {
      case 'get':
        return await this.get(params);
      case 'update':
        return await this.update(params);
      case 'delete':
        return await this.delete(params);
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  async get({ collection, id, options = {} }) {
    if (!this.storageProvider) {
      return { _id: id, name: 'Mock Document' };
    }

    const provider = this.storageProvider.getProvider(options.provider || 'memory');
    return await provider.findOne(collection, { _id: id }, options);
  }

  async update({ collection, id, update, options = {} }) {
    if (!this.storageProvider) {
      return { acknowledged: true, modifiedCount: 1 };
    }

    const provider = this.storageProvider.getProvider(options.provider || 'memory');
    return await provider.update(collection, { _id: id }, update, options);
  }

  async delete({ collection, id, options = {} }) {
    if (!this.storageProvider) {
      return { acknowledged: true, deletedCount: 1 };
    }

    const provider = this.storageProvider.getProvider(options.provider || 'memory');
    return await provider.delete(collection, { _id: id }, options);
  }
}

/**
 * QueryActor - Handles complex query operations
 */
class QueryActor {
  constructor(storageProvider) {
    this.storageProvider = storageProvider;
  }

  async receive(method, params) {
    switch (method) {
      case 'execute':
        return await this.execute(params);
      case 'aggregate':
        return await this.aggregate(params);
      case 'explain':
        return await this.explain(params);
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  async execute({ collection, query, options = {} }) {
    if (!this.storageProvider) {
      return {
        documents: [{ _id: '1', name: 'Mock Result' }],
        total: 1,
        executionTime: 5
      };
    }

    const provider = this.storageProvider.getProvider(options.provider || 'memory');
    const startTime = Date.now();
    const documents = await provider.find(collection, query, options);
    const executionTime = Date.now() - startTime;

    return {
      documents,
      total: documents.length,
      executionTime
    };
  }

  async aggregate({ collection, pipeline, options = {} }) {
    if (!this.storageProvider) {
      return [{ _id: 'group1', count: 5 }];
    }

    const provider = this.storageProvider.getProvider(options.provider || 'memory');
    
    // Basic aggregation support
    if (provider.aggregate) {
      return await provider.aggregate(collection, pipeline, options);
    }

    // Fallback for providers without aggregation
    throw new Error('Aggregation not supported by this provider');
  }

  async explain({ collection, query, options = {} }) {
    return {
      query,
      collection,
      indexesUsed: [],
      estimatedDocuments: 100,
      executionPlan: 'COLLSCAN'
    };
  }
}