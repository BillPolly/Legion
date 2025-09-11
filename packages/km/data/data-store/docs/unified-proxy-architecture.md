# Unified Proxy Architecture Design Document

## Overview

Design a unified proxy architecture where all queries return proxy objects instead of raw JavaScript arrays/values. This creates a consistent, queryable interface throughout the entire data-store system.

## Current Problem

**Inconsistent Return Types**: Currently the system has mixed return types:
- `entityProxy.get(':user/name')` → Returns raw strings, numbers, or EntityProxy objects  
- `entityProxy.name` → Returns raw strings (dynamic property access)
- `entityProxy.query({...})` → Returns raw JavaScript arrays `[["Alice"], ["Bob"]]`
- `store.query({...})` → Returns raw JavaScript arrays

This breaks the "everything is queryable and returns more queryable things" principle.

## Solution: Three Proxy Types

### 1. EntityProxy (Existing - Enhanced)
Represents a single entity with reactive property access.

**Current Capabilities:**
- Property access: `user.name`, `user.friends`
- Updates: `user.update({':user/age': 30})`
- Queries: `user.query({...})` (currently returns arrays)
- Subscriptions: `user.subscribe({...}, callback)`

**Enhancement:**
- `.query()` now returns appropriate proxy type instead of raw arrays
- **All property access** now returns proxy objects instead of raw values
- Add `.value()` method to get current JavaScript representation

### 2. CollectionProxy (New)
Represents query results that return multiple items.

**Use Cases:**
- Multi-field queries: `find: ['?name', '?age']`
- Multi-entity queries: `find: ['?e']` (multiple entities)
- Collection relationships: `user.friends` could return CollectionProxy

**Interface:**
```javascript
class CollectionProxy {
  value()           // Returns current JavaScript array
  query(querySpec)  // Further querying - returns appropriate proxy type
  subscribe(callback) // Reactive updates
  
  // Array-like interface
  [Symbol.iterator]() // for...of support
  map(fn)           // Transform items
  filter(fn)        // Filter items  
  find(fn)          // Find single item
  length            // Item count
}
```

### 3. StreamProxy (New)
Represents computed/aggregate values that change over time.

**Use Cases:**
- Aggregate queries: `find: [['(count ?post)']]`
- Computed properties: `user.postCount`
- Single value projections: `find: ['?name']` (single result)

**Interface:**
```javascript
class StreamProxy {
  value()           // Returns current scalar value (number, string, etc.)
  query(querySpec)  // Transform/filter the stream
  subscribe(callback) // Reactive updates to the value
}
```

## Query Result Type Detection

Smart analysis of query structure to determine appropriate proxy type:

```javascript
function determineProxyType(querySpec, results, schema) {
  const findClause = querySpec.find;
  
  // Single aggregate function → StreamProxy
  if (findClause.length === 1 && Array.isArray(findClause[0])) {
    // find: [['(count ?post)']] 
    return 'StreamProxy';
  }
  
  // Single variable → Check if entity ID or value
  if (findClause.length === 1) {
    // find: ['?e'] or find: ['?name']
    if (isEntityVariable(querySpec, schema)) {
      return results.length === 1 ? 'EntityProxy' : 'CollectionProxy';
    }
    return 'StreamProxy'; // Single value
  }
  
  // Multiple variables → CollectionProxy
  // find: ['?name', '?age'] or find: ['?e', '?friend']
  return 'CollectionProxy';
}
```

## Uniform API Design

**All proxy types support the core reactive interface:**

```javascript
// Common methods across all proxy types
.value()           // Get current JavaScript representation
.query(querySpec)  // Further querying
.subscribe(callback) // Reactive updates
```

**Usage Examples:**

```javascript
// Entity access
const user = store.getProxy(userId);

// Property access - ALL return proxy objects
const nameProxy = user.name;        // Returns StreamProxy
const ageProxy = user.age;          // Returns StreamProxy  
const friendsProxy = user.friends;  // Returns CollectionProxy

// Get actual values using .value()
const actualName = user.name.value();     // "Alice" (string)
const actualAge = user.age.value();       // 30 (number)  
const actualFriends = user.friends.value(); // [EntityProxy, EntityProxy]

// Chain operations on proxy objects
const friendNames = user.friends
  .query({
    find: ['?name'],
    where: [['?friend', ':user/name', '?name']]
  })
  .value(); // ["Bob", "Charlie"]

// Entity queries
const posts = user.query({
  find: ['?post'],
  where: [['?post', ':post/author', '?this']]
}); 
// Returns CollectionProxy

// Further querying on query results
const publishedPosts = posts.query({
  find: ['?post'],  
  where: [['?post', ':post/published', true]]
});
// Returns CollectionProxy

// Aggregate queries
const postCount = user.query({
  find: [['(count ?post)']],
  where: [['?post', ':post/author', '?this']]
});
// Returns StreamProxy

const count = postCount.value(); // number

// Everything is subscribable
user.name.subscribe((newName) => {
  console.log('Name changed to:', newName);
});

user.friends.subscribe((friends) => {
  console.log('Friends updated, count:', friends.length);
});
```

## Reactive Behavior

**All proxy types maintain reactive capabilities:**

1. **Data Changes**: When underlying data changes, all dependent proxies update
2. **Query Re-execution**: Subscriptions automatically re-run queries  
3. **Cascade Updates**: Changes propagate through proxy chains
4. **Subscription Forwarding**: Parent proxy subscriptions notify child proxies

```javascript
// Subscribe to collection changes
posts.subscribe((updatedPosts) => {
  console.log('Posts changed:', updatedPosts.length);
});

// Subscribe to aggregate changes
postCount.subscribe((newCount) => {
  console.log('Post count:', newCount);
});
```

## Implementation Changes

### Dynamic Property Access Modification
```javascript
// Current (proxy.js:281-287)
Object.defineProperty(this, propertyName, {
  get: () => {
    return this.get(attribute); // Returns raw values
  },
  enumerable: true,
  configurable: true
});

// New
Object.defineProperty(this, propertyName, {
  get: () => {
    const value = this.get(attribute);
    const proxyType = this._determinePropertyProxyType(attribute, value);
    return this._createPropertyProxy(proxyType, attribute, value);
  },
  enumerable: true,
  configurable: true
});
```

### EntityProxy.query() Modification
```javascript
// Current (proxy.js:448)
query(querySpec) {
  const boundQuery = this._bindThisVariable(querySpec);
  const results = q(boundQuery, this.store.db());
  return results; // Raw array
}

// New
query(querySpec) {
  const boundQuery = this._bindThisVariable(querySpec);
  const results = q(boundQuery, this.store.db());
  
  const proxyType = this._determineProxyType(querySpec, results);
  return this._createProxy(proxyType, querySpec, results);
}
```

### Phase 3: DataStoreProxy Wrapper Approach

Instead of modifying the existing DataStore class, we will create a separate DataStoreProxy wrapper class that:
1. Wraps the existing DataStore instance
2. Intercepts query operations to return proxy objects
3. Maintains separation of concerns between storage and proxy functionality

```javascript
// New DataStoreProxy class (datastore-proxy.js)
class DataStoreProxy {
  constructor(dataStore) {
    this.dataStore = dataStore;
    this.queryTypeDetector = new QueryTypeDetector(dataStore);
    this.propertyTypeDetector = new PropertyTypeDetector(dataStore.schema);
  }
  
  // Proxy-returning query method
  query(querySpec) {
    // Delegate actual query execution to DataStore
    const results = this.dataStore.query(querySpec);
    
    // Determine appropriate proxy type
    const proxyType = this.queryTypeDetector.detectProxyType(querySpec, results);
    
    // Create and return appropriate proxy
    return this._createProxy(proxyType, querySpec, results);
  }
  
  // Pass-through methods for non-query operations
  createEntity(entityData) {
    return this.dataStore.createEntity(entityData);
  }
  
  createEntities(entitiesData) {
    return this.dataStore.createEntities(entitiesData);
  }
  
  db() {
    return this.dataStore.db();
  }
  
  // Get entity proxy (existing functionality)
  getProxy(entityId) {
    return this.dataStore._getRegisteredProxy(entityId) || 
           new EntityProxy(entityId, this.dataStore);
  }
  
  // Private method to create appropriate proxy
  _createProxy(proxyType, querySpec, results) {
    switch(proxyType) {
      case 'EntityProxy':
        return new EntityProxy(results[0], this.dataStore);
      case 'CollectionProxy':
        return new CollectionProxy(querySpec, results, this.dataStore);
      case 'StreamProxy':
        return new StreamProxy(querySpec, results, this.dataStore);
      default:
        throw new Error(`Unknown proxy type: ${proxyType}`);
    }
  }
}

// Usage
const store = new DataStore(schema);
const proxyStore = new DataStoreProxy(store);

// Now all queries return proxies
const users = proxyStore.query({
  find: ['?e'],
  where: [['?e', ':user/name', '?name']]
}); // Returns CollectionProxy

// DataStore remains unchanged for backward compatibility
const rawResults = store.query(querySpec); // Still returns raw arrays
```

### Architectural Benefits of Wrapper Approach

1. **Separation of Concerns**: DataStore focuses on storage, DataStoreProxy handles proxy creation
2. **Backward Compatibility**: Existing code using DataStore directly continues to work
3. **Testability**: Can test DataStore and proxy functionality independently
4. **Incremental Migration**: Can gradually migrate code to use DataStoreProxy
5. **Clear Boundaries**: Storage logic remains separate from proxy/presentation logic

## Key Design Decisions

### No Backward Compatibility
- Clean break from array-returning queries
- All existing tests updated to use `.value()` pattern
- No fallback mechanisms or legacy support

### Fail Fast Approach
- If query analysis fails, throw clear error
- No fallbacks to raw arrays
- Pure proxy-first design

### Schema-Driven Intelligence
- Use schema information to distinguish entity IDs from values
- Smart type detection based on query patterns
- Leverage existing ref/value type information

### Uniform Interface
- Every queryable thing returns more queryable things
- `.value()` provides JavaScript representation when needed
- Consistent API across all proxy types

## Benefits

1. **Architectural Consistency**: Everything is queryable
2. **Powerful Composition**: Chain queries naturally
3. **Type Safety**: Clear distinction between proxy objects and values  
4. **Reactive Throughout**: All query results are reactive by default
5. **Clean API**: Single pattern to learn and use

## Property Type Detection

**Smart analysis for property access to determine proxy type:**

```javascript
function determinePropertyProxyType(attribute, value, schema) {
  const attrSpec = schema[attribute];
  
  // Reference attributes
  if (attrSpec && attrSpec.valueType === 'ref') {
    if (attrSpec.card === 'many') {
      return 'CollectionProxy'; // user.friends
    } else {
      return 'EntityProxy'; // user.manager
    }
  }
  
  // Scalar attributes  
  return 'StreamProxy'; // user.name, user.age, user.verified
}
```

## Result

A unified system where:
- **All property access returns proxies**: `user.name` → StreamProxy, `user.friends` → CollectionProxy
- **All query results return proxies**: `user.query({...})` → appropriate proxy type  
- **Proxy composition**: `user.friends.query({...})` enables further filtering/transformation
- **Raw value access**: All actual values accessed via `.value()` method
- **Everything is subscribable**: `user.name.subscribe(...)`, `user.friends.subscribe(...)`
- **Complete reactivity**: Changes propagate through entire proxy chain