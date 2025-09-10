# KG-DataScript Unification Design

## Executive Summary

This document describes the unification of the KG (Knowledge Graph) and DataScript systems into a single, cohesive knowledge management platform. By recognizing that KG triples and DataScript datoms are fundamentally the same data structure, we can merge these systems through inheritance, providing both the simplicity of KG's object-oriented API and the power of DataScript's reactive query engine.

## Core Insight

KG triples `[subject, predicate, object]` are structurally identical to DataScript datoms `[entity, attribute, value]` when transaction metadata is omitted. This fundamental similarity enables a clean unification where KG inherits from DataScript, gaining all its capabilities while maintaining backward compatibility.

## Architecture Overview

### Inheritance Hierarchy

```
DataScriptCore (base)
      ↑
   KGEngine (extends DataScript with KG features)
      ↑
   Application Code (uses unified API)
```

### Key Components

#### 1. KGEngine (extends DataScriptCore)

The unified engine that inherits DataScript's capabilities while preserving KG's simpler API:

```javascript
class KGEngine extends DataScriptCore {
  constructor(schema = {}) {
    super(schema);
    this.objectExtensions = new ObjectExtensions();
  }
  
  // KG's simple triple API preserved as convenience methods
  addTriple(subject, predicate, object) {
    return this.transact([['+', subject, predicate, object]]);
  }
  
  removeTriple(subject, predicate, object) {
    return this.transact([['-', subject, predicate, object]]);
  }
  
  // Simple pattern query wrapper around Datalog
  queryPattern(subject, predicate, object) {
    // Translates to appropriate Datalog query
  }
}
```

#### 2. Unified Proxy System

Merges KG's object serialization with DataScript's reactive EntityProxy:

```javascript
class KGEntityProxy extends EntityProxy {
  // Inherits from DataScript EntityProxy:
  // - Reactive attribute access
  // - Query subscriptions
  // - Computed properties
  // - Change listeners
  
  // Adds KG serialization features:
  toTriples() {
    // Convert entity to triple representation
  }
  
  fromObject(obj) {
    // Import object data as triples
  }
  
  // Simplified query API
  query(predicate, object) {
    // Convenience wrapper around Datalog
  }
}
```

#### 3. Storage Layer Mapping

The existing storage indexes map directly:

| KG Index | DataScript Index | Purpose |
|----------|------------------|---------|
| spo | eavt | Subject → Predicate → Object |
| pos | aevt | Predicate → Object → Subject |
| osp | vaet | Object → Subject → Predicate |

No data migration required - the structures are identical.

## API Design

### Triple Operations (KG Compatibility)

```javascript
// Classic KG API still works
kg.addTriple('user:1', 'name', 'Alice');
kg.addTriple('user:1', 'age', 30);
kg.removeTriple('user:1', 'age', 30);

// Simple pattern queries
kg.queryPattern('user:1', 'name', null);  // Get name of user:1
kg.queryPattern(null, 'age', 30);         // Find all entities with age 30
```

### DataScript Operations (Enhanced)

```javascript
// Full DataScript API available
kg.transact([
  {':db/id': 'user:1', 'name': 'Alice', 'age': 30},
  {':db/id': 'user:2', 'name': 'Bob', 'friend': 'user:1'}
]);

// Datalog queries
kg.q({
  find: ['?name', '?age'],
  where: [
    ['?e', 'name', '?name'],
    ['?e', 'age', '?age'],
    ['?e', 'friend', '?f'],
    ['?f', 'name', 'Alice']
  ]
});
```

### Object Serialization (KG Feature)

```javascript
// KG's object extensions still work
const user = {
  id: 'user:3',
  name: 'Charlie',
  age: 25,
  skills: ['javascript', 'python']
};

// Serialize object to triples
const triples = user.toTriples();
kg.addTriples(triples);

// Get reactive proxy
const proxy = kg.getProxy(user);
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

## Query System Unification

### Query Translation Layer

Simple KG patterns translate to Datalog queries:

| KG Pattern | Datalog Equivalent |
|------------|-------------------|
| `(s, p, o)` | `[['s', 'p', 'o']]` |
| `(s, p, ?)` | `[['s', 'p', '?o']]` with find: `['?o']` |
| `(?, p, o)` | `[['?s', 'p', 'o']]` with find: `['?s']` |
| `(s, ?, ?)` | `[['s', '?p', '?o']]` with find: `['?p', '?o']` |

### Incremental Query Support

DataScript's incremental query engine provides:
- Automatic query invalidation based on transaction data
- Selective re-execution only when relevant data changes
- Subscription-based reactive updates
- Efficient caching of query results

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

// Add data using either API
kg.addTriple('alice', 'name', 'Alice');
kg.addTriple('alice', 'age', 30);

kg.transact([
  {':db/id': 'bob', 'name': 'Bob', 'age': 25, 'friend': 'alice'}
]);

// Query using either API
const aliceAge = kg.queryPattern('alice', 'age', null);
const friends = kg.q({
  find: ['?name'],
  where: [
    ['?e', 'friend', 'alice'],
    ['?e', 'name', '?name']
  ]
});
```

### Working with Proxies

```javascript
// Get proxy for entity
const alice = kg.getProxy('alice');

// Reactive access
console.log(alice.name);  // "Alice"
console.log(alice.age);   // 30

// Update through proxy
alice.update({ age: 31 });

// Subscribe to changes
alice.onChange((change) => {
  console.log('Changed:', change);
});

// Computed property
alice.computed('info', {
  find: ['?name', '?age'],
  where: [
    ['alice', 'name', '?name'],
    ['alice', 'age', '?age']
  ]
}, ([name, age]) => `${name} is ${age} years old`);

console.log(alice.info);  // "Alice is 31 years old"
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

## Benefits of Unification

### For KG Users
- **No breaking changes**: Existing KG code continues to work
- **Reactive queries**: Gain DataScript's incremental query capabilities
- **Entity proxies**: Get reactive data access with subscriptions
- **Richer queries**: Access to full Datalog query language
- **Transaction support**: Built-in transaction handling and history

### For DataScript Users
- **Object serialization**: Easy conversion between objects and triples
- **Simpler API**: Convenience methods for common operations
- **Object extensions**: Work with regular JavaScript objects
- **ID management**: Automatic ID generation and management

### For New Users
- **Best of both**: Choose simple or advanced API based on needs
- **Progressive complexity**: Start simple, adopt advanced features gradually
- **Unified mental model**: One system to learn, not two
- **Full feature set**: All capabilities available when needed

## Technical Considerations

### Schema Handling
- DataScript schemas are optional but recommended
- KG's schema-less approach still works
- Schema provides validation and indexing benefits

### ID Management
- KG uses string IDs (e.g., 'user:1')
- DataScript typically uses numeric IDs
- Unified system supports both through ID translation layer

### Performance
- Index structures are identical (no overhead)
- Query translation is compile-time (minimal runtime cost)
- Reactive features are opt-in (no cost if not used)

### Compatibility
- Full backward compatibility with existing KG code
- DataScript API fully available for new features
- Can mix and match APIs as needed

## Conclusion

The unification of KG and DataScript creates a powerful, flexible knowledge graph system that combines the best of both approaches. By recognizing that triples and datoms are fundamentally the same structure, we achieve a clean architectural merge through inheritance. This provides users with both a simple, intuitive API for basic operations and a sophisticated reactive query engine for advanced use cases, all within a single, cohesive system.