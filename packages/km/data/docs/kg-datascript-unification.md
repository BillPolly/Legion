# KG System Evolution: Datom-Based Architecture

## Executive Summary

This document describes the evolution of the KG (Knowledge Graph) system to be based on DataScript's datom model. The key changes are:

1. **Rebasing on Datoms**: KG triples are now recognized as datoms `[entity, attribute, value]`, allowing KG to inherit DataScript's powerful infrastructure
2. **Query System Upgrade**: Replacing KG's primitive pattern-matching with DataScript's full Datalog query engine
3. **Unified Proxy Objects**: Merging KG's object proxies with DataScript's EntityProxy to provide both querying capabilities and reactive notifications in a single abstraction

## Core Architectural Change

The fundamental change is recognizing that KG triples `[subject, predicate, object]` are structurally identical to DataScript datoms `[entity, attribute, value]`. This allows us to:
- Base the entire KG system on DataScript's proven datom model
- Inherit DataScript's sophisticated query and indexing infrastructure
- Maintain full backward compatibility with existing KG code

## Architecture Overview

### System Evolution

```
Before:
  KG: Simple triple store with pattern matching
  DataScript: Separate system with datoms and Datalog

After:
  KG: Built on DataScript's datom foundation
      - Upgraded query system (pattern → Datalog)
      - Unified proxy objects (query + notifications)
```

### Key Changes

#### 1. KG Now Based on Datoms with Live Store

The KG system now inherits from DataScript, with all operations going through the live store:

```javascript
class KGEngine extends DataScriptCore {
  constructor(schema = {}) {
    super(schema);
    this.objectExtensions = new ObjectExtensions();
    this.liveObjects = new WeakMap(); // Track live object instances
  }
  
  // Live operations work with actual objects
  add(object, predicate, value) {
    // For live systems, 'object' is an actual JS object instance
    const id = this.getOrCreateId(object);
    return this.transact([['+', id, predicate, value]]);
  }
  
  remove(object, predicate, value) {
    const id = this.getId(object);
    return this.transact([['-', id, predicate, value]]);
  }
  
  // String-based operations are for serialization/deserialization only
  addTriple(subjectString, predicate, objectString) {
    // Used when loading from disk or network
    return this.transact([['+', subjectString, predicate, objectString]]);
  }
```

#### 2. Query System Upgrade

Replacing KG's primitive pattern matching with DataScript's Datalog:

```javascript
// BEFORE: KG's simple pattern matching
kg.query('user:1', 'name', null);  // Limited to triple patterns

// AFTER: Full Datalog queries (while keeping simple API)
kg.q({
  find: ['?name', '?age'],
  where: [
    ['?e', 'name', '?name'],
    ['?e', 'age', '?age'],
    ['?e', 'friend', '?f'],
    ['?f', 'name', 'Alice']
  ]
});

// Backward compatibility maintained:
kg.queryPattern('user:1', 'name', null);  // Still works, translates to Datalog
```

#### 3. Unified Proxy Objects

The key innovation is unifying KG's object proxies with DataScript's EntityProxy to provide both querying and notifications:

```javascript
class KGEntityProxy extends EntityProxy {
  // From DataScript - Notification capabilities:
  onChange(callback)      // React to entity changes
  subscribe(query, cb)    // Subscribe to query results
  computed(name, query)   // Computed properties with auto-update
  
  // From KG - Query capabilities:
  query(predicate)        // Query from this entity's perspective
  toTriples()            // Serialize to triples
  
  // Unified benefits:
  // - Single proxy object for all data operations
  // - Reactive notifications on data changes
  // - Entity-rooted queries
  // - Automatic updates via subscriptions
}
```

#### 4. Storage Layer Mapping

The existing storage indexes map directly:

| KG Index | DataScript Index | Purpose |
|----------|------------------|---------|
| spo | eavt | Subject → Predicate → Object |
| pos | aevt | Predicate → Object → Subject |
| osp | vaet | Object → Subject → Predicate |

No data migration required - the structures are identical.

## API Design

### Live Object Operations (Primary API)

```javascript
// Live systems work with actual objects
const alice = { name: 'Alice', age: 30 };
const bob = { name: 'Bob', age: 25 };

// All updates go through the live store
kg.add(alice, 'friend', bob);     // Adding relationship between objects
kg.add(alice, 'age', 31);         // Updating property
kg.remove(alice, 'age', 30);      // Removing old value

// Queries return actual objects, not IDs
const friends = kg.query(alice, 'friend');  // Returns [bob] (actual object)
```

### String Operations (Serialization Only)

```javascript
// String-based API is ONLY for serialization/deserialization
// Used when loading from disk, network, or persistence
kg.addTriple('user:1', 'name', 'Alice');  // Loading from storage
kg.addTriple('user:1', 'friend', 'user:2');  // Restoring relationships

// When deserializing, recreate actual objects
const loadedAlice = kg.hydrate('user:1');  // Returns actual object instance
```

### DataScript Operations (Enhanced)

```javascript
// Full DataScript API works with objects
const alice = { name: 'Alice', age: 30 };
const bob = { name: 'Bob' };

// Transact with actual objects
kg.transact([
  {':db/id': alice, 'age': 31, 'friend': bob},
  {':db/id': bob, 'age': 25}
]);

// Datalog queries work with objects
kg.q({
  find: ['?person', '?age'],
  where: [
    ['?person', 'age', '?age'],
    ['?person', 'friend', alice]  // Using actual object reference
  ]
});
```

### Object Serialization (For Persistence)

```javascript
// Serialization happens only when saving to disk/network
const alice = { name: 'Alice', age: 30 };

// For persistence, generate string representation
const serialized = kg.serialize(alice);
// Returns: [
//   ['obj:123', 'name', 'Alice'],
//   ['obj:123', 'age', 30]
// ]

// When loading, recreate live objects
const data = loadFromDisk();
const alice = kg.deserialize(data);  // Returns actual object instance

// The system maintains object identity
kg.add(alice, 'city', 'NYC');  // Works with the live object
```

### Reactive Queries (DataScript Feature)

```javascript
// Subscribe to query results
const unsubscribe = kg.subscribe({
  find: ['?name'],
  where: [['?e', 'age', '?a'], ['?a', '>', 25], ['?e', 'name', '?name']]
}, (results) => {
  console.log('Users over 25:', results);
});

// Entity proxy with reactive updates
const alice = kg.getProxy('user:1');
alice.onChange((change) => {
  console.log('Alice changed:', change);
});

// Computed properties
alice.computed('friendCount', {
  find: ['(count ?f)'],
  where: [['user:1', 'friend', '?f']]
}, ([count]) => count);
```

## Query System Upgrade Details

### From Pattern Matching to Datalog

The upgrade from KG's simple pattern matching to DataScript's Datalog is transformative:

#### Before (KG Pattern Matching):
- Limited to simple triple patterns
- No joins across multiple entities
- No aggregations or computations
- Manual result filtering

#### After (DataScript Datalog):
- Full relational queries with joins
- Aggregation functions (count, sum, min, max)
- Computed values and transformations
- Rule-based inference
- Incremental query updates

### Query Translation for Backward Compatibility

Simple KG patterns automatically translate to efficient Datalog:

| KG Pattern | Datalog Translation | Result |
|------------|-------------------|---------|
| `query(e1, 'name', null)` | `[['e1', 'name', '?v']]` | Get name of e1 |
| `query(null, 'age', 30)` | `[['?e', 'age', 30]]` | Find entities with age 30 |
| `query(e1, null, null)` | `[['e1', '?a', '?v']]` | All attributes of e1 |

### Incremental Query Benefits

With DataScript's query engine, KG now gets:
- **Smart Invalidation**: Queries only re-run when their specific data changes
- **Transaction Analysis**: System knows exactly which queries are affected by each transaction
- **Efficient Subscriptions**: Multiple subscribers to same query share computation
- **Automatic Caching**: Query results cached until relevant data changes

## Object Extensions Integration

KG's Object.prototype extensions work seamlessly with the unified system:

```javascript
Object.prototype.toTriples = function() {
  const id = this.getId();
  const triples = [];
  for (const [key, value] of Object.entries(this)) {
    if (key !== 'id') {
      triples.push([id, key, value]);
    }
  }
  return triples;
};

Object.prototype.getId = function() {
  return this.id || this._id || generateId();
};
```

These extensions enable:
- Direct object → triple serialization
- Automatic ID management
- Seamless integration with proxy system

## Usage Examples

### Creating and Querying Data

```javascript
const kg = new KGEngine({
  'friend': { valueType: 'ref', cardinality: 'many' },
  'age': { valueType: 'number' }
});

// Live systems use actual objects
const alice = { name: 'Alice', age: 30 };
const bob = { name: 'Bob', age: 25 };

// Add data through live store
kg.add(alice, 'friend', bob);
kg.add(bob, 'friend', alice);

// Queries work with objects
const aliceFriends = kg.query(alice, 'friend');  // Returns [bob]
const mutual = kg.q({
  find: ['?person'],
  where: [
    ['?person', 'friend', alice],
    [alice, 'friend', '?person']
  ]
});  // Returns [bob] (actual object)

// String operations only for loading persisted data
kg.loadFromDisk('data.kg');  // Uses addTriple internally
```

### Unified Proxy Objects in Action

```javascript
// Get unified proxy for actual object
const alice = { name: 'Alice', age: 30 };
const aliceProxy = kg.getProxy(alice);  // Proxy for live object

// QUERYING: From entity's perspective (returns actual objects)
const friends = aliceProxy.query('friend');  // Returns actual friend objects
const attributes = aliceProxy.getAll();  // All attributes

// NOTIFICATIONS: React to changes through live store
aliceProxy.onChange((change) => {
  console.log('Alice data changed:', change);
  // Fires when kg.add(alice, ...) or kg.remove(alice, ...) is called
});

// SUBSCRIPTIONS: Live query results with actual objects
aliceProxy.subscribe({
  find: ['?friend'],
  where: [
    [alice, 'friend', '?friend']
  ]
}, (friends) => {
  console.log('Alice\'s friends:', friends);  // Array of actual objects
});

// COMPUTED PROPERTIES: Auto-updating derived values
aliceProxy.computed('friendCount', {
  find: ['(count ?f)'],
  where: [[alice, 'friend', '?f']]
}, ([count]) => count);

console.log(aliceProxy.friendCount);  // Updates when friends change

// All operations go through the live store
kg.add(alice, 'friend', bob);  // Triggers onChange and updates friendCount
```

### Object Serialization

```javascript
// Create complex object
const company = {
  id: 'acme',
  name: 'ACME Corp',
  employees: ['alice', 'bob'],
  metadata: {
    founded: 2020,
    industry: 'tech'
  }
};

// Serialize and store
const triples = company.toTriples();
kg.addTriples(triples);

// Get proxy for reactive access
const acme = kg.getProxy('acme');
console.log(acme.name);  // "ACME Corp"
```

## Key Benefits of the Changes

### 1. Basing KG on Datoms
- **Proven Foundation**: Inherit DataScript's battle-tested datom model
- **No Data Migration**: Triples map directly to datoms (same structure)
- **Transaction Support**: Get transaction metadata when needed
- **Index Reuse**: KG's indexes (spo, pos, osp) map directly to datom indexes

### 2. Query System Upgrade
- **From Limited to Powerful**: Simple patterns → full relational queries
- **Incremental Updates**: Queries automatically update when data changes
- **Performance**: DataScript's query optimizer and caching
- **Backward Compatible**: Old pattern queries still work via translation

### 3. Unified Proxy Objects
- **Single Abstraction**: One proxy for both queries and notifications
- **Entity-Centric**: Query from an entity's perspective
- **Reactive**: Automatic updates via subscriptions
- **Computed Properties**: Derived values that auto-update
- **Change Tracking**: Know exactly what changed and when

## Technical Considerations

### Object Identity Management
- **Live Objects**: System uses WeakMap to track object identity
- **No String IDs in Runtime**: Objects are identified by reference
- **Serialization IDs**: Generated only when persisting to disk/network
- **Object Lifecycle**: Objects remain live until garbage collected

### Live Store Architecture
- **All Updates Through Store**: No direct manipulation of datoms
- **Transactional**: All changes are atomic transactions
- **Change Propagation**: Updates trigger notifications to all proxies
- **Referential Integrity**: Object references maintained automatically

### Performance
- **Object References**: Direct memory references (fast)
- **No ID Lookups**: No string→object mapping needed at runtime
- **WeakMap Caching**: Automatic cleanup when objects are GC'd
- **Reactive Updates**: Only affected queries re-run

### Serialization Strategy
- **On-Demand**: IDs generated only when saving
- **Stable IDs**: Same object gets same ID across saves
- **Hydration**: Recreates object graph on load
- **Reference Preservation**: Maintains relationships between objects

## Summary

The evolution of KG to be based on DataScript's datom model represents a fundamental upgrade to the system:

1. **Foundation Change**: KG now built on datoms instead of standalone triples
2. **Query Upgrade**: Full Datalog replaces simple pattern matching
3. **Unified Proxies**: Single object provides both querying and notifications

This is not just a merger but a transformation - KG gains DataScript's powerful capabilities while maintaining its simple API. The unified proxy object pattern is particularly powerful, providing a single abstraction for all data operations with built-in reactivity.

The result is a modern knowledge graph system that combines simplicity with power, suitable for both simple scripts and complex reactive applications.