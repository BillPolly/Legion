# Legion Storage Package - Comprehensive Design Document

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Components](#core-components)
3. [Provider Architecture](#provider-architecture)
4. [Actor System Integration](#actor-system-integration)
5. [ResourceManager Integration](#resourcemanager-integration)
6. [MongoDB Provider Specification](#mongodb-provider-specification)
7. [Query System](#query-system)
8. [Transaction Management](#transaction-management)
9. [API Documentation](#api-documentation)
10. [Usage Examples](#usage-examples)
11. [Extension Guide](#extension-guide)
12. [Testing Strategy](#testing-strategy)
13. [Performance Considerations](#performance-considerations)
14. [Configuration](#configuration)
15. [Error Handling](#error-handling)

## Architecture Overview

The Legion Storage package implements a **provider-based architecture** that abstracts storage operations across different backends while integrating seamlessly with Legion's ResourceManager and Actor communication system.

### Design Principles

1. **Provider Agnostic** - Unified interface for different storage backends
2. **Actor Integration** - Distributed storage operations via message passing
3. **ResourceManager Driven** - Configuration and dependency injection via ResourceManager
4. **Extensible** - Easy to add new storage providers
5. **Type Safe** - Comprehensive validation and error handling
6. **Performance Focused** - Connection pooling, caching, and optimization

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Applications                       │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼──────────────────────────────────────────┐
│                   StorageManager                               │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐│
│  │ ResourceManager │  │   ActorSpace     │  │ Provider Registry││
│  │   Integration   │  │   Integration    │  │   Management    ││
│  └─────────────────┘  └──────────────────┘  └─────────────────┘│
└─────────────────────┬──────────────────────────────────────────┘
                      │
┌─────────────────────▼──────────────────────────────────────────┐
│                    Provider Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   MongoDB    │  │   Memory     │  │   Future     │         │
│  │   Provider   │  │   Provider   │  │  Providers   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────┬──────────────────────────────────────────┘
                      │
┌─────────────────────▼──────────────────────────────────────────┐
│                 Actor Communication Layer                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐│
│  │ CollectionActor  │  │  DocumentActor   │  │   QueryActor     ││
│  │   (CRUD Ops)     │  │ (Document Ops)   │  │  (Query Exec)    ││
│  └──────────────────┘  └──────────────────┘  └──────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. StorageManager

The main orchestration layer that manages providers and integrates with the Legion ecosystem.

**Key Responsibilities:**
- Provider lifecycle management (registration, initialization, cleanup)
- ResourceManager integration for configuration and dependency injection
- ActorSpace management for distributed storage operations
- Auto-configuration based on environment variables

**Implementation Pattern:**
```javascript
// Follows async ResourceManager pattern from Legion CLAUDE.md
class StorageManager {
  private constructor(resourceManager, config) { /* ... */ }
  
  static async create(resourceManager) {
    // Async factory pattern - all initialization here
    const manager = new StorageManager(resourceManager, config);
    await manager._autoConfigureProviders();
    return manager;
  }
}
```

### 2. Provider Base Class

Abstract base class defining the standard interface for all storage providers.

**Standard CRUD Operations:**
- `find(collection, query, options)` - Query documents
- `findOne(collection, query, options)` - Find single document
- `insert(collection, documents, options)` - Insert documents
- `update(collection, query, update, options)` - Update documents
- `delete(collection, query, options)` - Delete documents
- `count(collection, query, options)` - Count documents

**Optional Advanced Operations:**
- `aggregate(collection, pipeline, options)` - Aggregation operations
- `createIndex(collection, spec, options)` - Index management
- `watch(collection, pipeline, options)` - Change streams
- `listCollections()` - Collection listing
- `dropCollection(collection)` - Collection management

### 3. StorageActor Base Class

Extends Legion's Actor system to provide storage-specific messaging patterns.

**Message Protocol:**
```javascript
{
  operation: 'find|insert|update|delete|count|aggregate',
  data: { /* operation-specific data */ },
  options: { /* operation options */ },
  requestId: 'unique-request-id'
}
```

**Response Protocol:**
```javascript
{
  success: true|false,
  result: { /* operation result */ },
  error: { message, type, stack },
  requestId: 'matching-request-id',
  timestamp: 'ISO-8601-timestamp',
  actor: 'ActorClassName'
}
```

## Provider Architecture

### Provider Interface Design

All providers must implement the `Provider` base class and its required methods. The architecture supports both synchronous and asynchronous operations with comprehensive error handling.

```javascript
class CustomProvider extends Provider {
  constructor(config) {
    super(config);
    // Provider-specific initialization
  }

  async connect() {
    // Establish connection to storage backend
  }

  async disconnect() {
    // Clean up connections and resources
  }

  // Implement required CRUD operations
  async find(collection, query, options) { /* ... */ }
  async insert(collection, documents, options) { /* ... */ }
  // ... other required methods

  // Optional: Override advanced operations
  async aggregate(collection, pipeline, options) { /* ... */ }
  
  getCapabilities() {
    return [...super.getCapabilities(), 'custom-feature'];
  }
}
```

### Provider Registration

Providers are registered with the StorageManager either automatically (via ResourceManager configuration) or manually:

```javascript
// Automatic registration (via environment variables)
const storage = await StorageManager.create(resourceManager);

// Manual registration
const customProvider = new CustomProvider(config);
await storage.addProvider('custom', customProvider);
```

## Actor System Integration

### Actor-Based Storage Operations

The storage system integrates deeply with Legion's Actor framework to enable distributed storage operations with location transparency.

#### StorageActor Hierarchy

```
StorageActor (base)
├── CollectionActor (collection-level operations)
│   ├── MongoDBCollectionActor (MongoDB-specific)
│   └── PostgreSQLCollectionActor (future)
├── DocumentActor (document-level operations)
└── QueryActor (query execution)
```

#### Message Flow

1. **Client Request** → StorageManager
2. **StorageManager** → Creates/Routes to appropriate Actor
3. **Actor** → Executes operation via Provider
4. **Provider** → Interacts with storage backend
5. **Response** → Flows back through Actor → StorageManager → Client

#### Distributed Operations

Using Legion's RemoteActor system, storage operations can be distributed across different ActorSpaces:

```javascript
// Local storage actor
const localActor = await storage.createCollectionActor('mongodb', 'users');

// Remote storage actor (different process/machine)
const remoteActor = actorSpace.makeRemote('remote-storage-guid', channel);

// Both actors use identical interface
const localResult = await localActor.executeOperation('find', { query: {} });
const remoteResult = await remoteActor.receive({ operation: 'find', data: { query: {} } });
```

### Real-time Updates via Actors

Change streams and real-time updates are handled through the Actor system:

```javascript
class MongoDBCollectionActor extends StorageActor {
  async startWatching(pipeline, options) {
    const changeStream = await this.provider.watch(this.collection, pipeline, options);
    
    changeStream.on('change', (change) => {
      // Broadcast change to interested actors
      this.broadcast({
        type: 'collection-change',
        collection: this.collection,
        change: change
      });
    });
  }
}
```

## ResourceManager Integration

### Automatic Configuration

The StorageManager integrates with Legion's ResourceManager to automatically configure providers based on environment variables:

```javascript
// Environment variables automatically loaded by ResourceManager
MONGODB_URL=mongodb://localhost:27017/mydb
POSTGRESQL_URL=postgresql://user:pass@localhost:5432/mydb
REDIS_URL=redis://localhost:6379
STORAGE_CONFIG={"maxConnections": 10, "timeout": 5000}
```

### Dependency Injection Pattern

Following Legion's async ResourceManager pattern:

```javascript
class StorageManager {
  static async create(resourceManager) {
    // ResourceManager provides all configuration
    const mongoUrl = resourceManager.get('env.MONGODB_URL');
    const storageConfig = resourceManager.get('env.STORAGE_CONFIG') || {};
    
    const manager = new StorageManager(resourceManager, storageConfig);
    
    // Auto-configure providers based on available URLs
    if (mongoUrl) {
      await manager.addProvider('mongodb', new MongoDBProvider({
        connectionString: mongoUrl,
        ...resourceManager.get('env.MONGODB_CONFIG') || {}
      }));
    }
    
    return manager;
  }
}
```

### Configuration Hierarchy

1. **Environment Variables** (via ResourceManager)
2. **Provider-specific Configuration**
3. **Runtime Configuration** (passed to methods)

```javascript
// Configuration priority (lowest to highest)
const finalOptions = {
  ...providerDefaults,
  ...resourceManager.get('env.PROVIDER_CONFIG'),
  ...providerConfig,
  ...runtimeOptions
};
```

## MongoDB Provider Specification

### Connection Management

```javascript
class MongoDBProvider extends Provider {
  constructor(config) {
    super(config);
    this.client = null;
    this.db = null;
    this.connectionString = config.connectionString;
    this.databaseName = config.database || this._extractDatabaseFromUrl();
  }

  async connect() {
    this.client = new MongoClient(this.connectionString, {
      maxPoolSize: this.config.maxPoolSize || 10,
      serverSelectionTimeoutMS: this.config.timeout || 5000,
      retryWrites: true,
      retryReads: true,
      ...this.config.clientOptions
    });
    
    await this.client.connect();
    this.db = this.client.db(this.databaseName);
    this.connected = true;
  }
}
```

### CRUD Operations Implementation

#### Find Operations
```javascript
async find(collection, query = {}, options = {}) {
  const cursor = this.db.collection(collection).find(query);
  
  if (options.sort) cursor.sort(options.sort);
  if (options.skip) cursor.skip(options.skip);
  if (options.limit) cursor.limit(options.limit);
  if (options.projection) cursor.project(options.projection);
  
  return await cursor.toArray();
}
```

#### Insert Operations
```javascript
async insert(collection, documents, options = {}) {
  const isArray = Array.isArray(documents);
  const docs = isArray ? documents : [documents];
  
  const result = await this.db.collection(collection).insertMany(docs, options);
  
  return {
    acknowledged: result.acknowledged,
    insertedCount: result.insertedCount,
    insertedIds: result.insertedIds
  };
}
```

### MongoDB-Specific Features

#### Aggregation Pipeline
```javascript
async aggregate(collection, pipeline = [], options = {}) {
  const cursor = this.db.collection(collection).aggregate(pipeline, options);
  return await cursor.toArray();
}
```

#### Change Streams
```javascript
async watch(collection, pipeline = [], options = {}) {
  const changeStream = this.db.collection(collection).watch(pipeline, options);
  
  // Return enhanced change stream with Legion integration
  return new MongoDBChangeStream(changeStream, this.actorSpace);
}
```

#### Index Management
```javascript
async createIndex(collection, spec, options = {}) {
  return await this.db.collection(collection).createIndex(spec, options);
}

async listIndexes(collection) {
  return await this.db.collection(collection).listIndexes().toArray();
}

async dropIndex(collection, indexName) {
  return await this.db.collection(collection).dropIndex(indexName);
}
```

### Transaction Support

```javascript
async createTransaction(options = {}) {
  const session = this.client.startSession();
  return new MongoDBTransaction(this, session, options);
}

class MongoDBTransaction extends Transaction {
  async commit() {
    try {
      await this.session.commitTransaction();
      this.state = 'committed';
    } finally {
      await this.session.endSession();
    }
  }
}
```

## Query System

### Universal Query Builder

The Query class provides a provider-agnostic way to build queries:

```javascript
const query = new Query('users')
  .where('active', true)
  .gt('age', 18)
  .in('role', ['admin', 'user'])
  .sort('created', -1)
  .limit(10)
  .skip(20);

const result = await provider.find(query.collection, query.criteria, query.options);
```

### Provider-Specific Query Extensions

Providers can extend the base Query class to add provider-specific features:

```javascript
class MongoDBQuery extends Query {
  // MongoDB-specific aggregation methods
  match(criteria) {
    this.pipeline.push({ $match: criteria });
    return this;
  }
  
  group(groupSpec) {
    this.pipeline.push({ $group: groupSpec });
    return this;
  }
  
  lookup(from, localField, foreignField, as) {
    this.pipeline.push({
      $lookup: { from, localField, foreignField, as }
    });
    return this;
  }
}
```

### Query Optimization

```javascript
class QueryOptimizer {
  static optimize(query, provider) {
    // Provider-specific query optimization
    if (provider instanceof MongoDBProvider) {
      return MongoDBQueryOptimizer.optimize(query);
    }
    return query;
  }
}
```

## Transaction Management

### Abstract Transaction Interface

```javascript
class Transaction {
  constructor(provider, session = null) {
    this.provider = provider;
    this.session = session;
    this.operations = [];
    this.state = 'idle'; // idle, active, committed, aborted
  }

  async start(options = {}) {
    this.state = 'active';
    if (this.provider.startTransaction) {
      this.session = await this.provider.startTransaction(options);
    }
  }

  insert(collection, documents, options = {}) {
    this.operations.push({ type: 'insert', collection, data: { documents }, options });
    return this;
  }

  async commit() {
    const results = [];
    
    try {
      // Execute all operations
      for (const op of this.operations) {
        const result = await this._executeOperation(op);
        results.push(result);
      }
      
      // Commit transaction
      if (this.provider.commitTransaction && this.session) {
        await this.provider.commitTransaction(this.session);
      }
      
      this.state = 'committed';
      return results;
    } catch (error) {
      await this.abort();
      throw error;
    }
  }
}
```

### Usage Examples

```javascript
// MongoDB transaction
const transaction = await provider.createTransaction();
await transaction.start();

transaction
  .insert('users', { name: 'John' })
  .update('profiles', { userId: 'john' }, { $set: { active: true } })
  .delete('temp_users', { name: 'John' });

const results = await transaction.commit();
```

## API Documentation

### StorageManager API

#### `StorageManager.create(resourceManager)`
Creates a new StorageManager instance with automatic provider configuration.

**Parameters:**
- `resourceManager` (ResourceManager): Initialized ResourceManager instance

**Returns:** `Promise<StorageManager>`

#### `addProvider(name, provider)`
Manually add a storage provider.

**Parameters:**
- `name` (string): Provider identifier
- `provider` (Provider): Provider instance

**Returns:** `Promise<void>`

#### `getProvider(name)`
Get a registered provider by name.

**Parameters:**
- `name` (string): Provider identifier

**Returns:** `Provider`

#### `createCollectionActor(providerName, collection)`
Create an actor for collection-level operations.

**Parameters:**
- `providerName` (string): Provider to use
- `collection` (string): Collection name

**Returns:** `Promise<Actor>`

### Provider API

#### Standard CRUD Methods

```javascript
// Find documents
await provider.find(collection, query, options);

// Insert documents
await provider.insert(collection, documents, options);

// Update documents
await provider.update(collection, query, update, options);

// Delete documents
await provider.delete(collection, query, options);

// Count documents
await provider.count(collection, query, options);
```

#### Advanced Operations

```javascript
// Aggregation
await provider.aggregate(collection, pipeline, options);

// Index management
await provider.createIndex(collection, spec, options);

// Change streams
const stream = await provider.watch(collection, pipeline, options);

// Collection management
await provider.listCollections();
await provider.dropCollection(collection);
```

### Actor API

#### `executeOperation(operation, data, options)`
Execute a storage operation through the actor.

**Parameters:**
- `operation` (string): Operation type ('find', 'insert', etc.)
- `data` (Object): Operation-specific data
- `options` (Object): Operation options

**Returns:** `Promise<Object>` - Operation result

## Usage Examples

### Basic Usage

```javascript
import { ResourceManager } from '@legion/module-loader';
import { StorageManager } from '@legion/storage';

// Initialize ResourceManager with environment variables
const resourceManager = new ResourceManager();
await resourceManager.initialize();

// Create StorageManager (auto-configures from env)
const storage = await StorageManager.create(resourceManager);

// Get MongoDB provider
const mongo = storage.getProvider('mongodb');

// Basic CRUD operations
const users = await mongo.find('users', { active: true });
await mongo.insert('users', { name: 'John Doe', email: 'john@example.com' });
await mongo.update('users', { name: 'John Doe' }, { $set: { lastLogin: new Date() } });
await mongo.delete('users', { active: false });
```

### Actor-Based Operations

```javascript
// Create collection actor
const userActor = await storage.createCollectionActor('mongodb', 'users');

// Execute operations through actor
const result = await userActor.executeOperation('find', {
  query: { active: true }
}, {
  limit: 10,
  sort: { created: -1 }
});

if (result.success) {
  console.log('Found users:', result.result);
} else {
  console.error('Error:', result.error);
}
```

### Advanced MongoDB Features

```javascript
const mongo = storage.getProvider('mongodb');

// Aggregation pipeline
const pipeline = [
  { $match: { active: true } },
  { $group: { _id: '$role', count: { $sum: 1 } } },
  { $sort: { count: -1 } }
];

const aggregateResult = await mongo.aggregate('users', pipeline);

// Change streams for real-time updates
const changeStream = await mongo.watch('users', [
  { $match: { 'fullDocument.role': 'admin' } }
]);

changeStream.on('change', (change) => {
  console.log('Admin user changed:', change);
});
```

### Transaction Example

```javascript
const transaction = await mongo.createTransaction();
await transaction.start();

try {
  transaction
    .insert('orders', { userId: '123', total: 100 })
    .update('users', { _id: '123' }, { $inc: { orderCount: 1 } })
    .update('inventory', { productId: 'abc' }, { $dec: { stock: 1 } });
  
  const results = await transaction.commit();
  console.log('Transaction completed:', results);
} catch (error) {
  await transaction.abort();
  console.error('Transaction failed:', error);
}
```

### Query Builder Usage

```javascript
import { Query } from '@legion/storage';

const query = new Query('products')
  .where('category', 'electronics')
  .gte('price', 100)
  .lte('price', 1000)
  .in('brand', ['Apple', 'Samsung', 'Google'])
  .exists('inStock', true)
  .sort('price', 1)
  .limit(20);

const products = await mongo.find(query.collection, query.criteria, query.options);
```

## Extension Guide

### Creating a Custom Provider

1. **Extend the Provider base class:**

```javascript
import { Provider } from '@legion/storage';

class PostgreSQLProvider extends Provider {
  constructor(config) {
    super(config);
    this.client = null;
    this.connectionString = config.connectionString;
  }

  async connect() {
    const { Client } = await import('pg');
    this.client = new Client({ connectionString: this.connectionString });
    await this.client.connect();
    this.connected = true;
  }

  async disconnect() {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
    this.connected = false;
  }

  async find(collection, query = {}, options = {}) {
    // Implement PostgreSQL-specific find logic
    // Convert query object to SQL WHERE clause
    // Execute query and return results
  }

  // Implement other required methods...
  
  getCapabilities() {
    return [
      ...super.getCapabilities(),
      'sql',
      'joins',
      'acid-transactions'
    ];
  }
}
```

2. **Register the provider:**

```javascript
const storage = await StorageManager.create(resourceManager);
const pgProvider = new PostgreSQLProvider({
  connectionString: resourceManager.get('env.POSTGRESQL_URL')
});

await storage.addProvider('postgresql', pgProvider);
```

### Creating Custom Actors

```javascript
import { StorageActor } from '@legion/storage';

class CacheActor extends StorageActor {
  constructor(provider, collection) {
    super(provider, collection);
    this.cache = new Map();
  }

  async _routeOperation(operation, data, options) {
    // Add caching logic
    if (operation === 'find') {
      const cacheKey = JSON.stringify({ collection: this.collection, query: data.query });
      
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }
      
      const result = await super._routeOperation(operation, data, options);
      this.cache.set(cacheKey, result);
      return result;
    }
    
    return super._routeOperation(operation, data, options);
  }
}
```

### Adding Provider-Specific Query Extensions

```javascript
import { Query } from '@legion/storage';

class ElasticsearchQuery extends Query {
  // Add Elasticsearch-specific methods
  fuzzy(field, value, fuzziness = 'AUTO') {
    if (!this.criteria.bool) this.criteria.bool = {};
    if (!this.criteria.bool.must) this.criteria.bool.must = [];
    
    this.criteria.bool.must.push({
      fuzzy: { [field]: { value, fuzziness } }
    });
    
    return this;
  }
  
  highlight(fields) {
    this.options.highlight = {
      fields: Array.isArray(fields) ? 
        fields.reduce((acc, field) => ({ ...acc, [field]: {} }), {}) :
        fields
    };
    return this;
  }
}
```

## Testing Strategy

### Unit Testing

Each component has comprehensive unit tests with mocked dependencies:

```javascript
// StorageManager.test.js
describe('StorageManager', () => {
  let resourceManager;
  let storage;

  beforeEach(() => {
    resourceManager = global.testUtils.createMockResourceManager();
  });

  test('should create StorageManager with ResourceManager', async () => {
    storage = await StorageManager.create(resourceManager);
    
    expect(storage).toBeInstanceOf(StorageManager);
    expect(storage.resourceManager).toBe(resourceManager);
    expect(storage.initialized).toBe(true);
  });

  test('should auto-configure MongoDB provider when URL available', async () => {
    resourceManager.get.mockImplementation((key) => {
      if (key === 'env.MONGODB_URL') return 'mongodb://localhost:27017/test';
      return null;
    });

    storage = await StorageManager.create(resourceManager);
    
    expect(storage.providers.has('mongodb')).toBe(true);
    expect(storage.getProvider('mongodb')).toBeInstanceOf(MongoDBProvider);
  });
});
```

### Integration Testing

Integration tests use real database connections with test data:

```javascript
// MongoDBProvider.integration.test.js
describe('MongoDBProvider Integration', () => {
  let provider;
  let testDb;

  beforeAll(async () => {
    // Use mongodb-memory-server for isolated testing
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    
    provider = new MongoDBProvider({
      connectionString: mongod.getUri(),
      database: 'test'
    });
    
    await provider.connect();
  });

  afterAll(async () => {
    await provider.disconnect();
  });

  beforeEach(async () => {
    // Clear test data
    await provider.db.collection('test').deleteMany({});
  });

  test('should perform CRUD operations', async () => {
    const testDoc = { name: 'Test', value: 42 };
    
    // Insert
    const insertResult = await provider.insert('test', testDoc);
    expect(insertResult.acknowledged).toBe(true);
    expect(insertResult.insertedCount).toBe(1);
    
    // Find
    const findResult = await provider.find('test', { name: 'Test' });
    expect(findResult).toHaveLength(1);
    expect(findResult[0].name).toBe('Test');
    
    // Update
    const updateResult = await provider.update('test', 
      { name: 'Test' }, 
      { $set: { value: 84 } }
    );
    expect(updateResult.modifiedCount).toBe(1);
    
    // Delete
    const deleteResult = await provider.delete('test', { name: 'Test' });
    expect(deleteResult.deletedCount).toBe(1);
  });
});
```

### Actor Communication Testing

```javascript
// StorageActor.test.js
describe('StorageActor', () => {
  let provider;
  let actor;

  beforeEach(() => {
    provider = {
      isConnected: () => true,
      find: jest.fn().mockResolvedValue([{ id: 1, name: 'test' }])
    };
    
    actor = new StorageActor(provider, 'test-collection');
  });

  test('should handle find operation message', async () => {
    const message = {
      operation: 'find',
      data: { query: { active: true } },
      options: { limit: 10 },
      requestId: 'test-123'
    };

    const result = await actor.receive(message);

    expect(result.success).toBe(true);
    expect(result.result).toEqual([{ id: 1, name: 'test' }]);
    expect(result.requestId).toBe('test-123');
    expect(provider.find).toHaveBeenCalledWith('test-collection', 
      { active: true }, 
      { limit: 10 }
    );
  });
});
```

### Performance Testing

```javascript
// Performance.test.js
describe('Storage Performance', () => {
  test('should handle concurrent operations efficiently', async () => {
    const operations = Array.from({ length: 100 }, (_, i) => 
      provider.insert('test', { id: i, value: Math.random() })
    );

    const startTime = performance.now();
    await Promise.all(operations);
    const endTime = performance.now();

    const duration = endTime - startTime;
    expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
  });

  test('should maintain connection pool efficiency', async () => {
    const queries = Array.from({ length: 50 }, () =>
      provider.find('test', {}, { limit: 100 })
    );

    const results = await Promise.all(queries);
    
    // All queries should succeed
    expect(results.every(r => Array.isArray(r))).toBe(true);
    
    // Connection pool should not be exhausted
    expect(provider.client.topology.s.poolMap.size).toBeGreaterThan(0);
  });
});
```

## Performance Considerations

### Connection Pooling

```javascript
class MongoDBProvider extends Provider {
  constructor(config) {
    super(config);
    this.poolOptions = {
      maxPoolSize: config.maxPoolSize || 10,
      minPoolSize: config.minPoolSize || 2,
      maxIdleTimeMS: config.maxIdleTimeMS || 30000,
      waitQueueTimeoutMS: config.waitQueueTimeoutMS || 5000
    };
  }
}
```

### Query Optimization

```javascript
class QueryOptimizer {
  static optimizeMongoDBQuery(query, options) {
    const optimized = { ...query };
    
    // Add index hints based on query patterns
    if (query.userId && query.created) {
      options.hint = { userId: 1, created: -1 };
    }
    
    // Optimize projection
    if (!options.projection && query._id) {
      options.projection = { _id: 1 }; // Only return _id if that's all we need
    }
    
    return { query: optimized, options };
  }
}
```

### Caching Strategy

```javascript
class CachedProvider extends Provider {
  constructor(baseProvider, cacheConfig) {
    super(cacheConfig);
    this.baseProvider = baseProvider;
    this.cache = new Map();
    this.cacheTimeout = cacheConfig.timeout || 300000; // 5 minutes
  }

  async find(collection, query, options) {
    const cacheKey = this._generateCacheKey(collection, query, options);
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }
    
    const result = await this.baseProvider.find(collection, query, options);
    
    this.cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    
    return result;
  }
}
```

### Batch Operations

```javascript
class BatchProcessor {
  constructor(provider, batchSize = 100) {
    this.provider = provider;
    this.batchSize = batchSize;
  }

  async batchInsert(collection, documents) {
    const batches = this._chunkArray(documents, this.batchSize);
    const results = [];
    
    for (const batch of batches) {
      const result = await this.provider.insert(collection, batch);
      results.push(result);
    }
    
    return this._mergeBatchResults(results);
  }

  _chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
```

## Configuration

### Environment Variables

```bash
# MongoDB Configuration
MONGODB_URL=mongodb://localhost:27017/myapp
MONGODB_CONFIG='{"maxPoolSize": 20, "serverSelectionTimeout": 10000}'

# General Storage Configuration
STORAGE_CONFIG='{"defaultTimeout": 5000, "retryAttempts": 3}'

# Provider-specific configurations
STORAGE_MONGODB_CONFIG='{"aggregationTimeout": 30000}'
STORAGE_REDIS_CONFIG='{"keyPrefix": "legion:", "ttl": 3600}'
```

### Configuration Schema

```javascript
const storageConfigSchema = {
  defaultTimeout: { type: 'number', default: 5000 },
  retryAttempts: { type: 'number', default: 3 },
  maxConcurrentOperations: { type: 'number', default: 100 },
  enableMetrics: { type: 'boolean', default: false },
  providers: {
    type: 'object',
    properties: {
      mongodb: {
        type: 'object',
        properties: {
          maxPoolSize: { type: 'number', default: 10 },
          serverSelectionTimeout: { type: 'number', default: 5000 },
          retryWrites: { type: 'boolean', default: true }
        }
      }
    }
  }
};
```

### Runtime Configuration

```javascript
// Override configuration at runtime
const storage = await StorageManager.create(resourceManager);

await storage.addProvider('mongodb', new MongoDBProvider({
  connectionString: 'mongodb://localhost:27017/myapp',
  maxPoolSize: 20,
  serverSelectionTimeout: 10000,
  // Provider-specific options
  writeConcern: { w: 'majority', j: true },
  readPreference: 'primaryPreferred'
}));
```

## Error Handling

### Error Categories

1. **Connection Errors** - Network, authentication, timeout issues
2. **Validation Errors** - Invalid data, schema violations
3. **Operation Errors** - Query failures, constraint violations
4. **System Errors** - Resource exhaustion, internal failures

### Error Handling Strategy

```javascript
class StorageError extends Error {
  constructor(message, code, provider, operation, details = {}) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    this.provider = provider;
    this.operation = operation;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

class ErrorHandler {
  static handle(error, context) {
    if (error.code === 11000) { // MongoDB duplicate key
      return new StorageError(
        'Duplicate key violation',
        'DUPLICATE_KEY',
        context.provider,
        context.operation,
        { originalError: error }
      );
    }
    
    if (error.name === 'MongoNetworkError') {
      return new StorageError(
        'Database connection failed',
        'CONNECTION_ERROR',
        context.provider,
        context.operation,
        { originalError: error }
      );
    }
    
    return error;
  }
}
```

### Retry Logic

```javascript
class RetryableOperation {
  constructor(maxRetries = 3, baseDelay = 1000) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
  }

  async execute(operation, context) {
    let lastError;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (!this._isRetryable(error) || attempt === this.maxRetries) {
          throw ErrorHandler.handle(error, context);
        }
        
        const delay = this.baseDelay * Math.pow(2, attempt);
        await this._delay(delay);
      }
    }
    
    throw lastError;
  }

  _isRetryable(error) {
    const retryableCodes = [
      'ECONNRESET',
      'ENOTFOUND', 
      'ETIMEDOUT',
      'MongoNetworkError'
    ];
    
    return retryableCodes.some(code => 
      error.code === code || error.name === code
    );
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

This comprehensive design document covers all aspects of the Legion Storage package architecture. The system provides a robust, extensible foundation for storage operations while integrating seamlessly with Legion's existing ResourceManager and Actor systems.

**Key Benefits:**
- **Unified Interface** - Single API for multiple storage backends
- **Actor Integration** - Distributed operations with location transparency
- **ResourceManager Integration** - Automatic configuration and dependency injection
- **Extensible Architecture** - Easy to add new providers and features
- **Production Ready** - Comprehensive error handling, testing, and performance optimization

The MongoDB provider serves as the primary implementation, with the architecture designed to easily accommodate additional providers like PostgreSQL, Redis, Elasticsearch, and others as needed.

**Ready for Review** - Please review this design document and provide feedback on any architectural decisions, missing features, or areas that need clarification before implementation begins.