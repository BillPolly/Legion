# Data-Store Package Documentation

## Table of Contents
- [Conceptual Overview](#conceptual-overview)
- [Architecture Deep Dive](#architecture-deep-dive)
- [API Reference](#api-reference)
- [Implementation Details](#implementation-details)
- [Usage Examples](#usage-examples)
- [Integration Points](#integration-points)

## Conceptual Overview

### Package Purpose

The `@legion/data-store` package is a reactive data management system built on top of DataScript JS, providing a sophisticated abstraction layer for managing immutable data with real-time change detection and subscription capabilities. It serves as the foundational data layer in the Legion framework.

**Key Package Information:**
- **Name**: `@legion/data-store`
- **Version**: 1.0.0  
- **Description**: "Reactive data store with proxy objects built on DataScript JS"
- **Dependencies**: `@legion/datascript`, `@legion/data-proxies`

### Core Philosophy

The data-store follows several key principles:

1. **Immutable State**: All data is stored in an immutable DataScript database, ensuring data consistency and enabling time-travel debugging
2. **Reactive Updates**: Changes to data automatically trigger subscriptions and update dependent components
3. **Entity-Centric Design**: Primary interface revolves around entity operations rather than raw database queries
4. **Proxy Integration**: Seamless integration with proxy objects for transparent, reactive data access
5. **Schema-Driven**: Type-safe operations based on explicit schema definitions

### Reactive Data Management

The system implements a comprehensive reactive data flow:

```
User Updates → DataStore → DataScript Transaction → Change Analysis → Subscription Updates
     ↑                                                                         ↓
Proxy Objects ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← Reactive Queries
```

## Architecture Deep Dive

### Core Components

#### 1. DataStore (`src/store.js`)

The `DataStore` class is the central coordinator that manages:
- **DataScript Connection**: Maintains the connection to the immutable database
- **Entity Operations**: Provides CRUD operations for entities
- **Proxy Registry**: Manages singleton proxy instances for entities
- **Schema Management**: Validates and enforces data schema constraints
- **Transaction Coordination**: Handles complex query-with-update operations

**Key Features:**
- Frozen schema for immutability
- Proxy singleton pattern enforcement
- Advanced query-with-update atomic operations
- Comprehensive entity validation

#### 2. ReactiveEngine (`src/reactor.js`)

The `ReactiveEngine` handles change detection and subscription management through two main classes:

**TransactionAnalyzer**: Analyzes DataScript transactions to extract change information:
- Identifies changed entities and attributes
- Categorizes additions vs retractions
- Tracks entity-attribute relationships
- Provides change summaries for optimization

**ReactiveEngine**: Manages the subscription lifecycle:
- Listens to DataScript transaction reports
- Processes transaction analysis results
- Matches changes with affected subscriptions
- Triggers subscription callbacks with relevant data
- Handles subscription cleanup and batching

#### 3. Subscription System (`src/subscription.js`)

Implements a sophisticated subscription management system:

**Subscription Class**: Represents individual reactive queries
- Stores query specifications and callbacks
- Tracks subscription state (active/inactive)
- Provides query metadata analysis
- Handles entity-rooted vs general subscriptions

**SubscriptionRegistry**: Manages collections of subscriptions
- Indexes subscriptions by entity and attribute
- Provides efficient lookup and filtering
- Handles subscription lifecycle management
- Supports cleanup of deactivated subscriptions

### Data Flow Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client Code   │───→│   DataStore      │───→│ DataScript DB   │
│                 │    │                  │    │ (Immutable)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         ↑                       │                       │
         │                       ▼                       ▼
         │              ┌──────────────────┐    ┌─────────────────┐
         │              │ ReactiveEngine   │◄───│ Transaction     │
         │              │                  │    │ Reports         │
         │              └──────────────────┘    └─────────────────┘
         │                       │
         │                       ▼
         │              ┌──────────────────┐
         │              │SubscriptionMgmt │
         │              │                  │
         │              └──────────────────┘
         │                       │
         └───────────────────────┘
            Subscription Callbacks
```

## API Reference

### DataStore Class

#### Constructor
```javascript
new DataStore(schema = {}, options = {})
```
- **schema**: Object defining entity attributes and constraints
- **options**: Configuration object (debounceMs, etc.)

#### Core Methods

##### Entity Management
```javascript
// Create single entity
createEntity(entityData) → { entityId, tempids, dbAfter }

// Update existing entity  
updateEntity(entityId, entityData) → { entityId, tempids, dbAfter }

// Create multiple entities atomically
createEntities(entitiesData) → { entityIds, tempids, dbAfter }
```

##### Query Operations
```javascript
// Execute query against current database
query(querySpec) → Array

// Atomic update-then-query operation
queryWithUpdate(spec) → { results, tempIds }
```

##### Database Access
```javascript
// Get current database state
db() → DataScript Database

// Access proxy registry (internal)
_getRegisteredProxy(entityId) → EntityProxy | undefined
_registerProxy(entityId, proxy) → void
_invalidateProxy(entityId) → void
```

#### Schema Validation

The DataStore enforces strict schema validation:

```javascript
// Valid schema format
const schema = {
  ':user/name': { unique: 'identity', valueType: 'string' },
  ':user/friends': { card: 'many', valueType: 'ref' },
  ':post/author': { valueType: 'ref' }
};
```

**Validation Rules:**
- Attributes must start with ':'
- Unique constraints: 'identity' or 'value'
- Cardinality: 'one' or 'many'
- Value types: 'string', 'number', 'boolean', 'ref', 'instant'

### ReactiveEngine Class

#### Constructor
```javascript
new ReactiveEngine(store)
```
- **store**: DataStore instance to monitor

#### Subscription Management
```javascript
// Start/stop transaction monitoring
startListening() → void
stopListening() → void

// Subscription registry operations
addSubscription(subscription) → void
removeSubscription(subscriptionId) → Subscription | undefined
getSubscription(subscriptionId) → Subscription | undefined

// Query subscriptions by criteria
findSubscriptionsByEntity(entityId) → Array<Subscription>
findSubscriptionsByAttribute(attribute) → Array<Subscription>
findAffectedSubscriptions(analysis) → Array<Subscription>

// Maintenance operations
cleanupSubscriptions() → number
```

#### Transaction Processing
```javascript
// Process transaction reports
processTransaction(report) → void
getLastAnalysis() → Object | null

// Batch processing
processBatchedChanges(analyses) → void
notifyAffectedSubscriptions(analysis) → void
```

### Subscription Classes

#### Subscription Constructor
```javascript
new Subscription(id, query, callback, rootEntity = null)
```
- **id**: Unique subscription identifier
- **query**: DataScript query specification
- **callback**: Function to call on changes
- **rootEntity**: Optional entity ID for entity-rooted subscriptions

#### Subscription Methods
```javascript
// State management
isActive() → boolean
isEntityRooted() → boolean  
deactivate() → void

// Notification
notify(results, changes) → void

// Metadata
getQueryMetadata() → { variables: Array, attributes: Array }
```

#### SubscriptionRegistry Methods
```javascript
// Registration
register(subscription) → void
unregister(subscriptionId) → Subscription | undefined

// Lookup
get(subscriptionId) → Subscription | undefined
getAll() → Array<Subscription>
size() → number

// Filtering
findByEntity(entityId) → Array<Subscription>
findByAttribute(attribute) → Array<Subscription>

// Maintenance
cleanup() → number
```

## Implementation Details

### Transaction Analysis System

The `TransactionAnalyzer` processes DataScript datoms to extract meaningful change information:

```javascript
const analysis = TransactionAnalyzer.analyze(txData);

// Analysis result structure
{
  changedEntities: Set,        // Entity IDs that changed
  changedAttributes: Set,      // Attributes that changed
  referencedEntities: Set,     // Referenced entity IDs
  addedDatoms: Array,          // Added datoms
  retractedDatoms: Array,      // Removed datoms
  changesByEntity: Map,        // Changes grouped by entity
  changesByAttribute: Map,     // Changes grouped by attribute
  affectedPairs: Set,          // Entity-attribute pairs
  getSummary() → Object        // Summary statistics
}
```

### Proxy Registry Management

The DataStore maintains a singleton registry of entity proxies:

- **Singleton Pattern**: One proxy per entity ID
- **Automatic Registration**: Proxies register themselves on creation
- **Invalidation**: Proxies marked invalid when entity deleted
- **Cleanup**: Periodic cleanup of invalid proxies

### Query-with-Update Pattern

Advanced atomic operation combining updates and queries:

```javascript
const result = store.queryWithUpdate({
  find: ['?title'],
  where: [
    ['?post', ':post/author', '?author'],
    ['?post', ':post/title', '?title']
  ],
  update: [
    { ':db/id': '?author', ':user/lastActive': new Date() },
    { ':db/id': -1, ':log/action': 'query-posts', ':log/timestamp': Date.now() }
  ]
});
```

**Execution Order:**
1. Process update operations first
2. Resolve temporary IDs to actual entity IDs
3. Execute query against updated database state
4. Return query results with tempID mappings

### Subscription Matching Algorithm

The ReactiveEngine uses sophisticated matching to determine affected subscriptions:

```javascript
function findAffectedSubscriptions(analysis) {
  // 1. Get all active subscriptions
  // 2. For each subscription, analyze its query metadata
  // 3. Check if subscription's attributes overlap with changed attributes
  // 4. Check if subscription's entities overlap with changed entities
  // 5. Return subscriptions that are potentially affected
}
```

**Optimization Strategies:**
- Index subscriptions by attributes for fast lookup
- Use Set intersections for efficient overlap detection
- Batch notifications to reduce callback overhead
- Periodic cleanup of inactive subscriptions

## Usage Examples

### Basic Store Setup

```javascript
import { createDataStore } from '@legion/data-store';

// Define schema
const schema = {
  ':user/id': { unique: 'identity' },
  ':user/name': { valueType: 'string' },
  ':user/email': { unique: 'value', valueType: 'string' },
  ':user/friends': { card: 'many', valueType: 'ref' },
  ':user/posts': { card: 'many', valueType: 'ref' },
  ':post/title': { valueType: 'string' },
  ':post/content': { valueType: 'string' },
  ':post/author': { valueType: 'ref' },
  ':post/published': { valueType: 'boolean' }
};

// Create store
const store = createDataStore({ schema });
```

### Entity Operations

```javascript
// Create single user
const { entityId: userId } = store.createEntity({
  ':user/name': 'Alice',
  ':user/email': 'alice@example.com'
});

// Create multiple entities atomically
const { entityIds: [postId1, postId2] } = store.createEntities([
  {
    ':post/title': 'Hello World',
    ':post/content': 'My first post',
    ':post/author': userId,
    ':post/published': true
  },
  {
    ':post/title': 'Draft Post',
    ':post/content': 'Work in progress',
    ':post/author': userId,
    ':post/published': false
  }
]);

// Update existing entity
store.updateEntity(userId, {
  ':user/posts': [postId1, postId2]
});
```

### Reactive Subscriptions

```javascript
// Set up reactive engine
const reactiveEngine = store._reactiveEngine;

// Create subscription for user changes
const userSubscription = new Subscription(
  'user-changes',
  {
    find: ['?name', '?email'],
    where: [
      [userId, ':user/name', '?name'],
      [userId, ':user/email', '?email']
    ]
  },
  (results, changes) => {
    console.log('User updated:', results);
    console.log('Change summary:', changes.summary);
  }
);

// Register subscription
reactiveEngine.addSubscription(userSubscription);

// Update user - triggers subscription
store.updateEntity(userId, {
  ':user/name': 'Alice Smith'
});
```

### Advanced Query Patterns

```javascript
// Query with aggregation
const postCount = store.query({
  find: [['(count ?post)']],
  where: [
    ['?post', ':post/author', userId],
    ['?post', ':post/published', true]
  ]
});

// Complex relational query  
const mutualFriends = store.query({
  find: ['?mutual'],
  where: [
    [userId, ':user/friends', '?friend'],
    ['?friend', ':user/friends', '?mutual'],
    [userId, ':user/friends', '?mutual']
  ]
});

// Query-with-update for complex operations
const result = store.queryWithUpdate({
  find: ['?post'],
  where: [
    ['?post', ':post/author', userId],
    ['?post', ':post/published', false]
  ],
  update: [
    {
      ':db/id': userId,
      ':user/lastLogin': new Date()
    }
  ]
});
```

### Subscription Management

```javascript
// Entity-rooted subscription
const entitySubscription = new Subscription(
  'entity-posts',
  {
    find: ['?title'],
    where: [
      ['?post', ':post/author', '?this'], // ?this bound to rootEntity
      ['?post', ':post/title', '?title']
    ]
  },
  (posts) => console.log('Posts updated:', posts),
  userId  // Root entity
);

// Attribute-based subscription
const titleSubscription = new Subscription(
  'title-changes',
  {
    find: ['?e', '?title'],
    where: [
      ['?e', ':post/title', '?title']
    ]
  },
  (results) => console.log('Any post title changed:', results)
);

// Batch subscription management
reactiveEngine.addSubscription(entitySubscription);
reactiveEngine.addSubscription(titleSubscription);

// Query subscriptions
const postSubscriptions = reactiveEngine.findSubscriptionsByAttribute(':post/title');
const userSubscriptions = reactiveEngine.findSubscriptionsByEntity(userId);

// Cleanup inactive subscriptions
const cleanedCount = reactiveEngine.cleanupSubscriptions();
```

## Integration Points

### DataScript Integration

The data-store builds directly on `@legion/datascript`:

```javascript
import { createConn, q } from '@legion/datascript';

// DataStore creates DataScript connection
this.conn = createConn(this.schema);

// Query execution delegates to DataScript
query(querySpec) {
  return q(querySpec, this.db());
}

// Transaction processing uses DataScript transactions
const { dbAfter, tempids } = this.conn.transact([txData]);
```

### Proxy System Integration

Seamless integration with `@legion/data-proxies`:

```javascript
// Re-export proxy classes
export { 
  EntityProxy,
  CollectionProxy,
  StreamProxy,
  DataStoreProxy
} from '@legion/data-proxies';

// DataStore maintains proxy registry
_registerProxy(entityId, proxy) {
  if (!this._proxyRegistry.has(entityId)) {
    this._proxyRegistry.set(entityId, proxy);
  }
}
```

### ResourceManager Integration

The data-store integrates with the Legion ResourceManager pattern for dependency injection and configuration management.

### Testing Patterns

The package includes comprehensive test coverage using Jest:

```javascript
// Example test structure
describe('DataStore', () => {
  describe('Entity Operations', () => {
    it('should create entity with valid data', () => {
      const store = new DataStore(schema);
      const result = store.createEntity({
        ':user/name': 'Alice'
      });
      expect(result.entityId).toBeDefined();
    });
  });
});
```

**Test Categories:**
- Unit tests for individual components
- Integration tests for component interaction
- Comprehensive edge case coverage
- Performance benchmarks for large datasets

### Handle Pattern Alignment

The data-store aligns with Legion's Handle/Proxy pattern by:
- Providing reactive handles to data entities
- Maintaining consistent proxy interfaces
- Supporting query projections and subscriptions
- Integrating with the ResourceManager hierarchy

---

This comprehensive documentation provides both conceptual understanding and practical implementation guidance for developers working with the `@legion/data-store` package within the Legion framework ecosystem.