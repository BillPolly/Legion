# MongoDB DataSource Design

## Overview

The MongoDB DataSource provides comprehensive MongoDB database access implementing the Legion DataSource interface. It enables synchronous database operations including CRUD, aggregation, indexing, and change streams through a hierarchical handle system that mirrors MongoDB's organizational structure.

## Core Architecture

### DataSource Interface Implementation

The `MongoDBDataSource` class implements the standard DataSource interface with MongoDB-specific operations:

```javascript
class MongoDBDataSource {
  constructor(config) {
    // MongoDB connection configuration
    this.connectionString = config.connectionString || 'mongodb://localhost:27017';
    this.options = config.options || {};
    
    // MongoDB client and connection state
    this.client = null;
    this.connected = false;
    
    // Subscription and change stream management
    this._subscriptions = new Map();
    this._changeStreams = new Map();
    this._subscriptionId = 0;
    
    // Schema cache for introspection
    this._schemaCache = null;
    this._schemaCacheTime = 0;
    this._schemaCacheTTL = config.schemaCacheTTL || 60000; // 1 minute
  }
  
  // Core DataSource methods (all synchronous)
  query(querySpec) { /* synchronous MongoDB queries */ }
  subscribe(querySpec, callback) { /* change stream subscriptions */ }
  getSchema() { /* MongoDB schema definition */ }
  update(updateSpec) { /* document/collection modifications */ }
  validate(data) { /* validate MongoDB operations */ }
  queryBuilder(sourceHandle) { /* create MongoDB-specific query builders */ }
}
```

### Handle Hierarchy

The MongoDB DataSource implements a four-level handle hierarchy that directly maps to MongoDB's organizational structure:

```
MongoServerHandle (Server Connection)
    └── MongoDatabaseHandle (Database)
            └── MongoCollectionHandle (Collection)
                    └── MongoDocumentHandle (Document)
```

Each handle level provides operations appropriate to its scope, with handles creating child handles through projection.

## Query Specification

The MongoDB query system uses a comprehensive specification format that covers all MongoDB query operations:

```javascript
{
  // Target specification
  level: 'server' | 'database' | 'collection' | 'document',
  database: 'databaseName',
  collection: 'collectionName',
  documentId: ObjectId | string,
  
  // Query operations
  operation: 'find' | 'findOne' | 'aggregate' | 'count' | 'distinct' | 
             'stats' | 'indexes' | 'listDatabases' | 'listCollections' |
             'serverStatus' | 'currentOp' | 'ping',
  
  // MongoDB query components
  filter: { /* MongoDB filter document */ },
  projection: { /* field projection */ },
  sort: { /* sort specification */ },
  limit: number,
  skip: number,
  
  // Aggregation pipeline
  pipeline: [ /* aggregation stages */ ],
  
  // Collection-specific queries
  field: 'fieldName',  // for distinct
  
  // Command execution
  command: { /* MongoDB command document */ },
  
  // Query options
  options: {
    collation: { /* collation specification */ },
    hint: { /* index hint */ },
    comment: string,
    maxTimeMS: number,
    readPreference: 'primary' | 'secondary' | 'primaryPreferred' | 
                    'secondaryPreferred' | 'nearest',
    readConcern: { level: 'local' | 'available' | 'majority' | 'linearizable' | 'snapshot' }
  }
}
```

## Update Specification

The MongoDB update system supports all modification operations:

```javascript
{
  // Target specification
  level: 'database' | 'collection' | 'document',
  database: 'databaseName',
  collection: 'collectionName',
  
  // Update operations
  operation: 'insert' | 'update' | 'replace' | 'delete' | 
             'createCollection' | 'dropCollection' | 
             'createIndex' | 'dropIndex' | 'dropDatabase',
  
  // Document modification
  filter: { /* filter for update/delete */ },
  update: { /* update operators ($set, $push, etc.) */ },
  replacement: { /* full document replacement */ },
  documents: [ /* documents to insert */ ],
  
  // Collection operations
  collectionOptions: {
    capped: boolean,
    size: number,
    max: number,
    validator: { /* JSON schema validator */ },
    validationLevel: 'off' | 'moderate' | 'strict',
    validationAction: 'error' | 'warn'
  },
  
  // Index operations
  keys: { /* index key specification */ },
  indexOptions: {
    unique: boolean,
    sparse: boolean,
    background: boolean,
    expireAfterSeconds: number,
    name: string
  },
  
  // Write options
  options: {
    upsert: boolean,
    multi: boolean,
    ordered: boolean,
    bypassDocumentValidation: boolean,
    writeConcern: { 
      w: number | 'majority', 
      j: boolean, 
      wtimeout: number 
    }
  }
}
```

## Handle Implementations

### MongoServerHandle

Represents a MongoDB server connection with server-level operations:

```javascript
class MongoServerHandle extends Handle {
  constructor(dataSource, connectionString) {
    super(dataSource);
    this.connectionString = connectionString;
  }
  
  // Get server status and information
  value() {
    return this.dataSource.query({
      level: 'server',
      operation: 'serverStatus'
    });
  }
  
  // List all databases on server
  databases() {
    return this.dataSource.query({
      level: 'server',
      operation: 'listDatabases'
    });
  }
  
  // Get handle for specific database
  database(dbName) {
    return new MongoDatabaseHandle(this.dataSource, dbName);
  }
  
  // Server statistics
  stats() {
    return this.dataSource.query({
      level: 'server',
      operation: 'serverStatus'
    });
  }
  
  // Current operations on server
  currentOps(options = {}) {
    return this.dataSource.query({
      level: 'server',
      operation: 'currentOp',
      options
    });
  }
  
  // Check server connectivity
  ping() {
    return this.dataSource.query({
      level: 'server',
      operation: 'ping'
    });
  }
  
  // Get server build information
  buildInfo() {
    return this.dataSource.query({
      level: 'server',
      operation: 'buildInfo'
    });
  }
  
  // Host information
  hostInfo() {
    return this.dataSource.query({
      level: 'server',
      operation: 'hostInfo'
    });
  }
  
  // Watch for server-wide changes
  watch(pipeline = [], callback) {
    return this.dataSource.subscribe({
      level: 'server',
      pipeline,
      changeStream: true
    }, callback);
  }
}
```

### MongoDatabaseHandle

Represents a specific database with database-level operations:

```javascript
class MongoDatabaseHandle extends Handle {
  constructor(dataSource, dbName) {
    super(dataSource);
    this.database = dbName;
  }
  
  // Get database statistics
  value() {
    return this.dataSource.query({
      level: 'database',
      database: this.database,
      operation: 'stats'
    });
  }
  
  // List all collections in database
  collections() {
    return this.dataSource.query({
      level: 'database',
      database: this.database,
      operation: 'listCollections'
    });
  }
  
  // Get handle for specific collection
  collection(collectionName) {
    return new MongoCollectionHandle(this.dataSource, this.database, collectionName);
  }
  
  // Create new collection
  createCollection(name, options = {}) {
    return this.dataSource.update({
      level: 'database',
      database: this.database,
      operation: 'createCollection',
      collection: name,
      collectionOptions: options
    });
  }
  
  // Drop entire database
  drop() {
    return this.dataSource.update({
      level: 'database',
      database: this.database,
      operation: 'dropDatabase'
    });
  }
  
  // Execute database command
  command(command) {
    return this.dataSource.query({
      level: 'database',
      database: this.database,
      operation: 'command',
      command
    });
  }
  
  // Get collection names
  collectionNames() {
    const collections = this.collections();
    return collections.map(col => col.name);
  }
  
  // Check if collection exists
  hasCollection(name) {
    const names = this.collectionNames();
    return names.includes(name);
  }
  
  // Watch database for changes
  watch(pipeline = [], callback) {
    return this.dataSource.subscribe({
      level: 'database',
      database: this.database,
      pipeline,
      changeStream: true
    }, callback);
  }
}
```

### MongoCollectionHandle

Represents a collection with comprehensive CRUD and query operations:

```javascript
class MongoCollectionHandle extends Handle {
  constructor(dataSource, dbName, collectionName) {
    super(dataSource);
    this.database = dbName;
    this.collection = collectionName;
  }
  
  // Get collection statistics
  value() {
    return this.dataSource.query({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'stats'
    });
  }
  
  // Query documents
  find(filter = {}, options = {}) {
    return this.dataSource.query({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'find',
      filter,
      projection: options.projection,
      sort: options.sort,
      limit: options.limit,
      skip: options.skip,
      options: options
    });
  }
  
  // Find single document
  findOne(filter = {}, options = {}) {
    return this.dataSource.query({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'findOne',
      filter,
      projection: options.projection,
      options: options
    });
  }
  
  // Get document handle by ID
  document(id) {
    return new MongoDocumentHandle(this.dataSource, this.database, this.collection, id);
  }
  
  // Aggregation pipeline
  aggregate(pipeline, options = {}) {
    return this.dataSource.query({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'aggregate',
      pipeline,
      options
    });
  }
  
  // Count documents matching filter
  countDocuments(filter = {}, options = {}) {
    return this.dataSource.query({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'count',
      filter,
      options
    });
  }
  
  // Get distinct values for field
  distinct(field, filter = {}, options = {}) {
    return this.dataSource.query({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'distinct',
      field,
      filter,
      options
    });
  }
  
  // Insert one document
  insertOne(document, options = {}) {
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'insert',
      documents: [document],
      options
    });
  }
  
  // Insert multiple documents
  insertMany(documents, options = {}) {
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'insert',
      documents: Array.isArray(documents) ? documents : [documents],
      options
    });
  }
  
  // Update one document
  updateOne(filter, update, options = {}) {
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'update',
      filter,
      update,
      options: { ...options, multi: false }
    });
  }
  
  // Update multiple documents
  updateMany(filter, update, options = {}) {
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'update',
      filter,
      update,
      options: { ...options, multi: true }
    });
  }
  
  // Replace document
  replaceOne(filter, replacement, options = {}) {
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'replace',
      filter,
      replacement,
      options
    });
  }
  
  // Delete one document
  deleteOne(filter, options = {}) {
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'delete',
      filter,
      options: { ...options, multi: false }
    });
  }
  
  // Delete multiple documents
  deleteMany(filter, options = {}) {
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'delete',
      filter,
      options: { ...options, multi: true }
    });
  }
  
  // Create index on collection
  createIndex(keys, options = {}) {
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'createIndex',
      keys,
      indexOptions: options
    });
  }
  
  // Drop index from collection
  dropIndex(indexName) {
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'dropIndex',
      indexName
    });
  }
  
  // List all indexes
  indexes() {
    return this.dataSource.query({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'indexes'
    });
  }
  
  // Drop collection
  drop() {
    return this.dataSource.update({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      operation: 'dropCollection'
    });
  }
  
  // Watch collection for changes
  watch(pipeline = [], callback) {
    return this.dataSource.subscribe({
      level: 'collection',
      database: this.database,
      collection: this.collection,
      pipeline,
      changeStream: true
    }, callback);
  }
}
```

### MongoDocumentHandle

Represents a specific document with document-level operations:

```javascript
class MongoDocumentHandle extends Handle {
  constructor(dataSource, dbName, collectionName, documentId) {
    super(dataSource);
    this.database = dbName;
    this.collection = collectionName;
    this.documentId = this._normalizeId(documentId);
  }
  
  // Normalize ID to ObjectId if needed
  _normalizeId(id) {
    if (typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/)) {
      return { $oid: id };  // Convert to ObjectId format
    }
    return id;
  }
  
  // Get document
  value() {
    return this.dataSource.query({
      level: 'document',
      database: this.database,
      collection: this.collection,
      operation: 'findOne',
      filter: { _id: this.documentId }
    });
  }
  
  // Check if document exists
  exists() {
    const result = this.dataSource.query({
      level: 'document',
      database: this.database,
      collection: this.collection,
      operation: 'count',
      filter: { _id: this.documentId }
    });
    return result.count > 0;
  }
  
  // Update document with update operators
  update(update, options = {}) {
    return this.dataSource.update({
      level: 'document',
      database: this.database,
      collection: this.collection,
      operation: 'update',
      filter: { _id: this.documentId },
      update,
      options
    });
  }
  
  // Replace entire document
  replace(replacement, options = {}) {
    // Ensure _id is not in replacement
    const { _id, ...docWithoutId } = replacement;
    return this.dataSource.update({
      level: 'document',
      database: this.database,
      collection: this.collection,
      operation: 'replace',
      filter: { _id: this.documentId },
      replacement: docWithoutId,
      options
    });
  }
  
  // Delete document
  delete() {
    return this.dataSource.update({
      level: 'document',
      database: this.database,
      collection: this.collection,
      operation: 'delete',
      filter: { _id: this.documentId }
    });
  }
  
  // Get specific field value
  field(fieldPath) {
    const doc = this.value();
    if (!doc) return undefined;
    return this._getFieldByPath(doc, fieldPath);
  }
  
  // Set specific field value
  setField(fieldPath, value) {
    return this.update({
      $set: { [fieldPath]: value }
    });
  }
  
  // Unset (remove) field
  unsetField(fieldPath) {
    return this.update({
      $unset: { [fieldPath]: 1 }
    });
  }
  
  // Push to array field
  push(fieldPath, value) {
    return this.update({
      $push: { [fieldPath]: value }
    });
  }
  
  // Pull from array field
  pull(fieldPath, value) {
    return this.update({
      $pull: { [fieldPath]: value }
    });
  }
  
  // Add to set (array with unique values)
  addToSet(fieldPath, value) {
    return this.update({
      $addToSet: { [fieldPath]: value }
    });
  }
  
  // Increment numeric field
  increment(fieldPath, amount = 1) {
    return this.update({
      $inc: { [fieldPath]: amount }
    });
  }
  
  // Watch document for changes
  watch(callback) {
    return this.dataSource.subscribe({
      level: 'document',
      database: this.database,
      collection: this.collection,
      pipeline: [
        { $match: { 'documentKey._id': this.documentId } }
      ],
      changeStream: true
    }, callback);
  }
  
  // Helper to get nested field value
  _getFieldByPath(doc, path) {
    const parts = path.split('.');
    let current = doc;
    for (const part of parts) {
      if (current && typeof current === 'object') {
        // Handle array index notation like "items.0.name"
        if (/^\d+$/.test(part) && Array.isArray(current)) {
          current = current[parseInt(part, 10)];
        } else {
          current = current[part];
        }
      } else {
        return undefined;
      }
    }
    return current;
  }
}
```

## Usage Examples

### Basic Connection and Database Operations

```javascript
import { MongoDBDataSource } from '@legion/mongodb-datasource';
import { MongoServerHandle } from '@legion/mongodb-datasource/handles';

// Create data source
const mongoDataSource = new MongoDBDataSource({
  connectionString: 'mongodb://localhost:27017',
  options: {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000
  }
});

// Create server handle
const server = new MongoServerHandle(mongoDataSource);

// List all databases
const databases = server.databases();
console.log('Available databases:', databases);

// Get specific database handle
const db = server.database('myapp');

// List collections
const collections = db.collections();
console.log('Collections:', collections.map(c => c.name));

// Create new collection
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      required: ['name', 'email'],
      properties: {
        name: { type: 'string' },
        email: { type: 'string', pattern: '^.+@.+$' }
      }
    }
  }
});
```

### Collection CRUD Operations

```javascript
// Get collection handle
const users = db.collection('users');

// Insert documents
users.insertOne({
  name: 'John Doe',
  email: 'john@example.com',
  age: 30
});

users.insertMany([
  { name: 'Alice', email: 'alice@example.com', age: 25 },
  { name: 'Bob', email: 'bob@example.com', age: 35 }
]);

// Find documents
const allUsers = users.find();
const adults = users.find({ age: { $gte: 18 } });
const usersByName = users.find(
  { name: { $regex: '^J' } },
  { 
    projection: { name: 1, email: 1 },
    sort: { name: 1 },
    limit: 10
  }
);

// Update documents
users.updateOne(
  { email: 'john@example.com' },
  { $set: { lastLogin: new Date() } }
);

users.updateMany(
  { age: { $lt: 18 } },
  { $set: { category: 'minor' } }
);

// Delete documents
users.deleteOne({ email: 'old@example.com' });
users.deleteMany({ inactive: true });
```

### Document-Level Operations

```javascript
// Get document handle
const userId = '507f1f77bcf86cd799439011';
const userDoc = users.document(userId);

// Get document
const userData = userDoc.value();
console.log('User:', userData);

// Check existence
if (userDoc.exists()) {
  console.log('User exists');
}

// Update fields
userDoc.setField('profile.bio', 'Software developer');
userDoc.increment('loginCount');
userDoc.push('tags', 'javascript');
userDoc.addToSet('skills', 'mongodb');

// Get nested field
const email = userDoc.field('contact.email');
const city = userDoc.field('address.city');

// Replace entire document
userDoc.replace({
  name: 'John Updated',
  email: 'john.new@example.com',
  updatedAt: new Date()
});

// Delete document
userDoc.delete();
```

### Aggregation Pipeline

```javascript
// Complex aggregation
const salesReport = users.collection('orders').aggregate([
  // Match orders from last month
  {
    $match: {
      createdAt: {
        $gte: new Date('2024-01-01'),
        $lt: new Date('2024-02-01')
      }
    }
  },
  // Join with products collection
  {
    $lookup: {
      from: 'products',
      localField: 'productId',
      foreignField: '_id',
      as: 'product'
    }
  },
  // Unwind product array
  { $unwind: '$product' },
  // Group by category
  {
    $group: {
      _id: '$product.category',
      totalSales: { $sum: '$amount' },
      orderCount: { $sum: 1 },
      avgOrderValue: { $avg: '$amount' }
    }
  },
  // Sort by total sales
  { $sort: { totalSales: -1 } },
  // Limit to top 10
  { $limit: 10 }
]);

console.log('Sales Report:', salesReport);
```

### Index Management

```javascript
// Create indexes
users.createIndex({ email: 1 }, { unique: true });
users.createIndex({ name: 'text' });
users.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 86400 } // TTL index
);
users.createIndex(
  { location: '2dsphere' } // Geospatial index
);

// Compound index
users.createIndex(
  { category: 1, status: 1, createdAt: -1 },
  { name: 'category_status_date' }
);

// List indexes
const indexes = users.indexes();
console.log('Collection indexes:', indexes);

// Drop index
users.dropIndex('category_status_date');
```

### Change Streams (Subscriptions)

```javascript
// Watch entire server
const serverWatcher = server.watch([], (event) => {
  console.log('Server change:', event.operationType, event.ns);
});

// Watch database
const dbWatcher = db.watch([], (event) => {
  console.log('Database change:', event);
});

// Watch collection with pipeline
const collectionWatcher = users.watch([
  { $match: { operationType: { $in: ['insert', 'update'] } } },
  { $match: { 'fullDocument.status': 'active' } }
], (event) => {
  console.log('New/updated active user:', event.fullDocument);
});

// Watch specific document
const docWatcher = userDoc.watch((event) => {
  console.log('Document changed:', event.updateDescription);
});

// Unsubscribe
serverWatcher.unsubscribe();
collectionWatcher.unsubscribe();
```

### Distinct Values and Counting

```javascript
// Get distinct values
const categories = users.collection('products').distinct('category');
console.log('Product categories:', categories);

const cities = users.distinct('address.city', { country: 'USA' });
console.log('US cities:', cities);

// Count documents
const totalUsers = users.countDocuments();
const activeUsers = users.countDocuments({ status: 'active' });
const recentUsers = users.countDocuments({
  createdAt: { $gte: new Date('2024-01-01') }
});

console.log(`Total: ${totalUsers}, Active: ${activeUsers}, Recent: ${recentUsers}`);
```

### Collection Statistics

```javascript
// Get collection stats
const stats = users.value();
console.log('Collection stats:', {
  count: stats.count,
  size: stats.size,
  avgObjSize: stats.avgObjSize,
  storageSize: stats.storageSize,
  totalIndexSize: stats.totalIndexSize,
  indexSizes: stats.indexSizes
});

// Database stats
const dbStats = db.value();
console.log('Database stats:', {
  collections: dbStats.collections,
  dataSize: dbStats.dataSize,
  storageSize: dbStats.storageSize,
  indexes: dbStats.indexes,
  indexSize: dbStats.indexSize
});
```

## Schema Discovery

The MongoDB DataSource provides automatic schema discovery:

```javascript
const schema = mongoDataSource.getSchema();

// Returns comprehensive schema information:
{
  type: 'mongodb',
  version: '6.0.0',
  serverInfo: {
    host: 'localhost:27017',
    replicaSet: null,
    topology: 'standalone'
  },
  databases: {
    'myapp': {
      sizeOnDisk: 1073741824,
      collections: {
        'users': {
          count: 1000,
          size: 524288,
          indexes: [
            { name: '_id_', keys: { _id: 1 } },
            { name: 'email_1', keys: { email: 1 }, unique: true }
          ],
          validator: { /* JSON Schema */ },
          avgDocumentSize: 524,
          capped: false
        }
      }
    }
  },
  capabilities: {
    transactions: true,
    changeStreams: true,
    aggregation: {
      $lookup: true,
      $graphLookup: true,
      $facet: true
    },
    textSearch: true,
    geoSpatial: true,
    timeSeries: true
  }
}
```

## Synchronous Operation Design

Following the Handle/DataSource pattern requirements, all operations are synchronous:

### Query Execution
- All query methods return results immediately without promises
- The MongoDB driver's synchronous API is used internally
- Results are cached when appropriate for performance

### Subscription Management
- Change stream setup is synchronous
- Callbacks are invoked when changes occur (appearing async externally)
- Subscription/unsubscription happens immediately without race conditions

### Update Operations
- All modifications execute synchronously
- Write concern is handled internally
- Results include success status and affected document counts

### Connection Management
- Connection pooling is handled internally
- Operations wait for connection if needed (synchronous blocking)
- Connection errors are thrown immediately

This synchronous design:
- Eliminates timing bugs in rapid subscribe/unsubscribe scenarios
- Simplifies error handling throughout the stack
- Maintains consistency with the Handle/DataSource pattern
- Provides predictable, deterministic execution flow

## Error Handling

All operations include comprehensive error handling:

```javascript
try {
  const user = users.findOne({ email: 'invalid@example.com' });
} catch (error) {
  if (error.code === 11000) {
    console.log('Duplicate key error');
  } else if (error.code === 121) {
    console.log('Document validation failed');
  } else if (error.name === 'MongoNetworkError') {
    console.log('Network connection error');
  } else {
    console.log('MongoDB error:', error.message);
  }
}
```

## Transaction Support

While not shown in individual handles for simplicity, the DataSource supports transactions:

```javascript
// Start session (managed by DataSource)
const session = mongoDataSource.startSession();

try {
  // Start transaction
  session.startTransaction();
  
  // Operations use session context
  const order = orders.insertOne({ /* order data */ }, { session });
  inventory.updateOne(
    { productId: order.productId },
    { $inc: { quantity: -1 } },
    { session }
  );
  
  // Commit transaction
  session.commitTransaction();
} catch (error) {
  // Rollback on error
  session.abortTransaction();
  throw error;
} finally {
  // End session
  session.endSession();
}
```