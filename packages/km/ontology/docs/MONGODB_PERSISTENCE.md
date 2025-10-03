# MongoDB Persistence for RDF Ontology

## Overview

The ontology system now stores RDF triples persistently in MongoDB instead of in-memory. This ensures that:
- Ontology survives application restarts
- No data loss during disconnections
- Scalable storage for large ontologies
- Unified MongoDB backend for both ontology schema and entity instances

## Architecture

### Two MongoDB Collections

1. **`ontology_triples`** - RDF ontology schema (types, classes, relationships)
2. **`knowledge_graph`** - Entity instances and relationship instances

### MongoTripleStore

**Location:** `packages/km/ontology/src/stores/MongoTripleStore.js`

Drop-in replacement for `SimpleTripleStore` with the same API but persistent storage.

#### Key Features

- **Flat document structure:** `{ subject, predicate, object, createdAt }`
- **Efficient indexes:** Subject, predicate, object, and compound indexes
- **Duplicate prevention:** Unique index on (subject, predicate, object)
- **Statistics:** Aggregation queries for ontology analytics
- **Subscriptions:** Change notifications compatible with SimpleTripleStore API

#### Example Document

```javascript
{
  _id: ObjectId("..."),
  subject: "kg:WaterHeater",
  predicate: "rdfs:subClassOf",
  object: "kg:PhysicalEntity",
  createdAt: ISODate("2025-10-02T21:00:00Z")
}
```

### Async API Throughout

All components updated to support async triple stores:

- **HierarchyTraversalService** - `getAncestors()`, `getDescendants()`, `getHierarchyContext()` now async
- **SubsumptionChecker** - `checkPropertySubsumption()`, `checkRelationshipSubsumption()` now async
- **OntologyExtensionService** - `findLowestCommonAncestor()`, `findCompatibleRelationships()` now async

This enables both SimpleTripleStore (synchronous, in-memory) and MongoTripleStore (asynchronous, persistent) to work seamlessly.

## Usage

### Basic Setup

```javascript
import { MongoTripleStore } from './stores/MongoTripleStore.js';
import { OntologyBuilder } from './OntologyBuilder.js';

// Create MongoDB-backed triple store
const tripleStore = new MongoTripleStore({
  connectionString: 'mongodb://localhost:27017',
  database: 'knowledge-graph',
  collection: 'ontology_triples'
});

await tripleStore.connect();

// Use with OntologyBuilder
const ontologyBuilder = new OntologyBuilder({
  tripleStore,
  semanticSearch,
  llmClient
});

// Build ontology - persists automatically
await ontologyBuilder.processText(text, { domain: 'plumbing' });
```

### Querying Triples

```javascript
// Pattern matching (null = wildcard)
const classes = await tripleStore.query(null, 'rdf:type', 'owl:Class');
// Returns: [['kg:WaterHeater', 'rdf:type', 'owl:Class'], ...]

const properties = await tripleStore.query('kg:WaterHeater', null, null);
// Returns all triples about WaterHeater

// Count triples
const total = await tripleStore.count();

// Get all triples
const all = await tripleStore.getAll();
```

### Statistics

```javascript
const stats = await tripleStore.getStatistics();

console.log(stats);
// {
//   totalTriples: 114,
//   classes: 7,
//   datatypeProperties: 2,
//   objectProperties: 7,
//   byPredicate: {
//     'rdf:type': 16,
//     'rdfs:label': 16,
//     'rdfs:subClassOf': 14,
//     ...
//   }
// }
```

### Subscriptions

```javascript
// Subscribe to changes
const subscriptionId = tripleStore.subscribe(() => {
  console.log('Ontology changed!');
});

// Add triple - triggers notification
await tripleStore.add('kg:Pump', 'rdf:type', 'owl:Class');

// Unsubscribe
tripleStore.unsubscribe(subscriptionId);
```

### Removing Triples

```javascript
// Remove specific triple
await tripleStore.remove('kg:Pump', 'rdfs:label', '"Pump"');

// Remove by pattern
await tripleStore.removePattern(null, 'rdf:type', 'kg:WaterHeater');
// Removes all instances of WaterHeater type

// Clear all
await tripleStore.clear();
```

## Persistence Demonstration

### Session 1: Build Ontology

```javascript
const tripleStore1 = new MongoTripleStore({
  connectionString: uri,
  database: 'ontology-db',
  collection: 'ontology_triples'
});

await tripleStore1.connect();

const ontologyBuilder = new OntologyBuilder({
  tripleStore: tripleStore1,
  semanticSearch,
  llmClient
});

await ontologyBuilder.processText(
  'The water heater heats incoming water to 140 degrees.',
  { domain: 'plumbing' }
);

const count1 = await tripleStore1.count();
console.log(`Triples stored: ${count1}`);
// Triples stored: 114

await tripleStore1.disconnect();
```

### Session 2: Verify Persistence

```javascript
const tripleStore2 = new MongoTripleStore({
  connectionString: uri,
  database: 'ontology-db',
  collection: 'ontology_triples'
});

await tripleStore2.connect();

const count2 = await tripleStore2.count();
console.log(`Triples persisted: ${count2}`);
// Triples persisted: 114

// Verify specific data
const waterHeater = await tripleStore2.query('kg:WaterHeater', null, null);
console.log(`WaterHeater triples: ${waterHeater.length}`);
// WaterHeater triples: 7

// Bootstrap ontology still there
const continuant = await tripleStore2.query('kg:Continuant', 'rdf:type', 'owl:Class');
console.log(`Bootstrap loaded: ${continuant.length > 0}`);
// Bootstrap loaded: true
```

## Testing

### Unit Tests

**File:** `__tests__/integration/MongoTripleStore.test.js`

7 tests covering:
- Basic storage and querying
- Persistence across disconnect/reconnect
- Duplicate handling
- Triple removal
- Pattern-based removal
- Subscriptions
- Statistics

**Run tests:**
```bash
NODE_OPTIONS='--experimental-vm-modules' npx jest __tests__/integration/MongoTripleStore.test.js --runInBand --no-coverage
```

**Results:**
```
✓ should store and query triples in MongoDB (22 ms)
✓ should persist triples across disconnect/reconnect (10 ms)
✓ should handle duplicate triples gracefully (4 ms)
✓ should remove triples correctly (5 ms)
✓ should remove triples by pattern (5 ms)
✓ should support subscriptions to changes (3 ms)
✓ should provide statistics about stored triples (9 ms)

Test Suites: 1 passed, 1 total
Tests:       7 passed, 7 total
Time:        0.579 s
```

### Integration Tests

All existing tests continue to pass with async hierarchy traversal:

**Upper-Level Ontology Unit Tests:**
```bash
NODE_OPTIONS='--experimental-vm-modules' npx jest __tests__/unit/UpperLevelOntology.test.js --runInBand --no-coverage
```

**Plumbing Domain Demo:**
```bash
NODE_OPTIONS='--experimental-vm-modules' npx jest __tests__/integration/PlumbingDomain.Demo.test.js --runInBand --no-coverage
```

## MongoDB Indexes

The following indexes are automatically created for efficient querying:

```javascript
// Single-field indexes
{ subject: 1 }
{ predicate: 1 }
{ object: 1 }

// Compound indexes for common patterns
{ subject: 1, predicate: 1 }
{ predicate: 1, object: 1 }

// Unique index to prevent duplicates
{ subject: 1, predicate: 1, object: 1 } (unique)
```

## Benefits

### 1. Persistence
- Ontology survives restarts
- No bootstrap reload on every startup
- Incremental ontology building across sessions

### 2. Scalability
- Handles large ontologies efficiently
- MongoDB aggregation for statistics
- Indexed queries for fast retrieval

### 3. Unified Storage
- Both ontology schema AND entity instances in MongoDB
- Consistent backup/restore strategy
- Single database connection

### 4. Flexibility
- Drop-in replacement for SimpleTripleStore
- Async API enables future optimizations
- Subscription support for reactive updates

## Migration from SimpleTripleStore

### Before (In-Memory)

```javascript
import { SimpleTripleStore } from '@legion/rdf';

const tripleStore = new SimpleTripleStore();

const ontologyBuilder = new OntologyBuilder({
  tripleStore,
  semanticSearch,
  llmClient
});
```

### After (MongoDB Persistent)

```javascript
import { MongoTripleStore } from './stores/MongoTripleStore.js';

const tripleStore = new MongoTripleStore({
  connectionString: 'mongodb://localhost:27017',
  database: 'knowledge-graph',
  collection: 'ontology_triples'
});

await tripleStore.connect();

const ontologyBuilder = new OntologyBuilder({
  tripleStore,
  semanticSearch,
  llmClient
});
```

**No other code changes required!** The API is identical.

## Performance Considerations

### Read Operations
- Indexed queries are fast (subject, predicate, object)
- Pattern matching uses MongoDB's native query capabilities
- Statistics use aggregation pipeline

### Write Operations
- Unique index ensures no duplicates
- Subscriptions triggered after successful write
- Batch operations not yet implemented (future enhancement)

### Connection Management
- Reuses MongoDB connection
- Auto-reconnect on first query if disconnected
- Proper cleanup on disconnect()

## Future Enhancements

### Potential Improvements
1. **Batch operations** - Insert multiple triples atomically
2. **Transactions** - ACID guarantees for multi-triple operations
3. **Versioning** - Track ontology changes over time
4. **Reification** - Store metadata about triples
5. **Named graphs** - Support multiple ontology contexts

### Optimization Opportunities
1. **Caching** - In-memory cache for frequently accessed triples
2. **Lazy loading** - Load bootstrap on-demand
3. **Connection pooling** - Share connections across instances
4. **Bulk indexing** - Optimize semantic search indexing

## Summary

The MongoDB persistence implementation provides a robust, scalable foundation for ontology storage. By storing RDF triples in MongoDB:

- **Ontology schema persists** across application restarts
- **Unified storage architecture** with entity instances
- **Efficient querying** via MongoDB indexes
- **Drop-in compatibility** with existing code
- **Full test coverage** ensures reliability

The system now has two MongoDB collections:
1. `ontology_triples` - Type definitions (classes, properties, relationships)
2. `knowledge_graph` - Instance data (entities, relationships)

Both use MongoDB ObjectIds as canonical identifiers and support the same rich querying capabilities.
