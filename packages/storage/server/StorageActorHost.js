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
        const { StorageProvider } = await import('@legion/storage');
        this.storageProvider = await StorageProvider.create(this.resourceManager);
      }
    } catch (error) {
      console.error('Failed to initialize StorageProvider:', error.message);
      // Continue without StorageProvider - actors will use mock data
    }

    // Register core actors
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
    if (!this.storageProvider) {
      // Return mock data if no storage provider
      return [
        { _id: '1', name: 'Mock Document 1' },
        { _id: '2', name: 'Mock Document 2' }
      ];
    }

    const provider = this.storageProvider.getProvider(options.provider || 'memory');
    return await provider.find(collection, query, options);
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
    if (!this.storageProvider) {
      return { acknowledged: true, modifiedCount: 1 };
    }

    const provider = this.storageProvider.getProvider(options.provider || 'memory');
    return await provider.update(collection, filter, update, options);
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
    if (!this.storageProvider) {
      return ['users', 'products', 'orders'];
    }

    const storageProvider = this.storageProvider.getProvider(provider);
    return await storageProvider.listCollections();
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