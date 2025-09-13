# DataStore to Proxy Architecture Migration Guide

This guide helps developers migrate from direct DataStore usage to the new unified proxy architecture introduced in Phase 3-5 of the implementation.

## Overview

The unified proxy architecture provides:
- **StreamProxy**: For scalar values, aggregates, and single entity results
- **EntityProxy**: For direct entity manipulation with property access
- **CollectionProxy**: For collections of results
- **DataStoreProxy**: Main wrapper that returns appropriate proxy types

## Migration Patterns

### 1. Scalar Value Queries

**BEFORE (Legacy DataStore)**:
```javascript
const query = {
  find: ['?name'],
  where: [[userId, ':user/name', '?name']]
};

const results = store.query(query);
const name = results[0][0]; // Manual array extraction
```

**AFTER (Proxy Architecture)**:
```javascript
const query = {
  find: ['?name'],
  where: [[userId, ':user/name', '?name']]
};

const result = proxy.query(query); // Returns StreamProxy
const name = result.value(); // Clean value access
```

### 2. Entity Property Access

**BEFORE (Legacy DataStore)**:
```javascript
// Multiple queries needed
const nameQuery = {
  find: ['?name'],
  where: [[userId, ':user/name', '?name']]
};

const ageQuery = {
  find: ['?age'],
  where: [[userId, ':user/age', '?age']]
};

const nameResult = store.query(nameQuery);
const ageResult = store.query(ageQuery);

const name = nameResult[0][0];
const age = ageResult[0][0];
```

**AFTER (Proxy Architecture)**:
```javascript
const entity = proxy.getProxy(userId); // Returns EntityProxy
const name = entity.get(':user/name');
const age = entity.get(':user/age');
```

### 3. Entity Query Results

**BEFORE (Legacy DataStore)**:
```javascript
const query = {
  find: ['?user'],
  where: [['?user', ':user/name', 'Alice']]
};

const results = store.query(query);
const entityId = results[0][0]; // Get entity ID
// Then need additional queries for properties
```

**AFTER (Proxy Architecture)**:
```javascript
const query = {
  find: ['?user'],
  where: [['?user', ':user/name', 'Alice']]
};

const result = proxy.query(query); // Returns StreamProxy
const entity = result.value(); // Returns EntityProxy
const name = entity.get(':user/name'); // Direct property access
```

### 4. Multi-Value Attributes

**BEFORE (Legacy DataStore)**:
```javascript
const query = {
  find: ['?role'],
  where: [[userId, ':user/roles', '?role']]
};

const results = store.query(query); // Array of arrays
const roles = results.map(row => row[0]); // Manual collection
```

**AFTER (Proxy Architecture)**:
```javascript
const query = {
  find: ['?role'],
  where: [[userId, ':user/roles', '?role']]
};

const result = proxy.query(query); // Returns CollectionProxy
const roles = result.value(); // Clean collection access
const count = result.size(); // Collection methods available
```

### 5. Aggregate Queries

**BEFORE (Legacy DataStore)**:
```javascript
const query = {
  find: [['count', '?user']],
  where: [['?user', ':user/name', '_']]
};

const count = store.query(query); // Direct scalar return
```

**AFTER (Proxy Architecture)**:
```javascript
const query = {
  find: [['count', '?user']],
  where: [['?user', ':user/name', '_']]
};

const result = proxy.query(query); // Returns StreamProxy
const count = result.value(); // Value access

// Bonus: Reactive capabilities
result.subscribe(newCount => {
  console.log('Count updated:', newCount);
});
```

### 6. Reference Traversal

**BEFORE (Legacy DataStore)**:
```javascript
// Multiple queries to traverse references
const postQuery = {
  find: ['?post'],
  where: [['?post', ':post/title', 'Test Post']]
};
const postResults = store.query(postQuery);
const postId = postResults[0][0];

const authorQuery = {
  find: ['?author'],
  where: [[postId, ':post/author', '?author']]
};
const authorResults = store.query(authorQuery);
const authorId = authorResults[0][0];

const nameQuery = {
  find: ['?name'],
  where: [[authorId, ':user/name', '?name']]
};
const nameResults = store.query(nameQuery);
const authorName = nameResults[0][0];
```

**AFTER (Proxy Architecture)**:
```javascript
const post = proxy.getProxy(postId);
const authorName = post.get(':post/author').get(':user/name');

// Or with queries
const postQuery = {
  find: ['?post'],
  where: [['?post', ':post/title', 'Test Post']]
};
const postProxy = proxy.query(postQuery).value();
const authorName = postProxy.get(':post/author').get(':user/name');
```

## Key Changes to Understand

### 1. Query Result Types

The `DataStoreProxy.query()` method returns different proxy types based on the query:

- **Aggregate queries** → `StreamProxy`
- **Single-value scalar queries** → `StreamProxy`
- **Single entity queries** → `StreamProxy` (call `.value()` to get `EntityProxy`)
- **Multi-value/collection queries** → `CollectionProxy`

### 2. Entity ID Handling

- **Legacy**: Entity queries return arrays with entity IDs: `[[123]]`
- **Proxy**: Entity queries return `StreamProxy`, call `.value()` to get `EntityProxy`

### 3. Empty Results

- **Legacy**: Empty results return empty arrays: `[]`
- **Proxy**: Empty results return proxies with `null`/`undefined` values

### 4. Reactive Capabilities

All proxies support subscriptions:

```javascript
const stream = proxy.query(scalarQuery);
stream.subscribe(newValue => {
  console.log('Value changed:', newValue);
});

const entity = proxy.getProxy(entityId);
entity.subscribe(changes => {
  console.log('Entity changed:', changes);
});
```

## Migration Strategy

### Phase 1: Wrapper Introduction
1. Create `DataStoreProxy` wrapper around existing `DataStore`
2. Update high-level query methods to use proxy
3. Keep legacy methods working for backward compatibility

### Phase 2: Entity Access Migration
1. Replace direct entity ID manipulation with `EntityProxy`
2. Update property access patterns to use `.get()` and `.set()`
3. Migrate reference traversal to use proxy chains

### Phase 3: Collection Processing
1. Update multi-value attribute handling to use `CollectionProxy`
2. Migrate filtering and mapping operations
3. Update aggregation result processing

### Phase 4: Reactive Integration
1. Add subscriptions where real-time updates are needed
2. Replace polling patterns with reactive subscriptions
3. Implement proper cleanup for subscription management

## When NOT to Migrate

Keep legacy DataStore for:
- **Performance-critical code** where direct database access is needed
- **Batch operations** that don't benefit from proxy overhead
- **Schema operations** and administrative tasks
- **Custom query engines** or specialized data processing

## Best Practices

### 1. Lazy Migration
Migrate incrementally, starting with high-value areas:
- User-facing features that benefit from reactivity
- Complex entity relationship handling
- Areas with lots of manual result processing

### 2. Hybrid Usage
Both approaches can coexist:
```javascript
// Use DataStore directly for administrative tasks
const rawResults = store.query(complexAnalyticsQuery);

// Use DataStoreProxy for user-facing features
const userEntity = proxy.getProxy(userId);
const userName = userEntity.get(':user/name');
```

### 3. Testing Strategy
- Keep existing tests working with legacy DataStore
- Add new tests for proxy architecture
- Use migration tests to verify equivalent behavior

### 4. Performance Monitoring
- Monitor proxy creation overhead
- Watch for memory leaks in subscription management
- Profile query performance with proxies vs direct access

## Common Pitfalls

1. **Forgetting `.value()` calls**: Single entity queries return `StreamProxy`, not `EntityProxy`
2. **Subscription cleanup**: Always clean up subscriptions to prevent memory leaks
3. **Mixing patterns**: Don't mix direct DataStore and proxy access for the same data
4. **Over-proxying**: Not all data access needs proxies - use direct DataStore for bulk operations

## Support Resources

- See `__tests__/integration/proxy-migration.test.js` for comprehensive examples
- Check `__tests__/integration/end-to-end.test.js` for complete workflow examples  
- Review Phase 3-5 implementation tests for detailed proxy behavior