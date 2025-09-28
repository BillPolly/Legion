# Handle Implementation Guide

## Quick Start Guide

This guide provides step-by-step instructions for implementing Handle subclasses and DataSource implementations.

## Implementing a Handle Subclass

### Step 1: Basic Handle Subclass Structure

```javascript
import { Handle } from '@legion/handle';

export class MyResourceHandle extends Handle {
  constructor(dataSource, additionalOptions = {}) {
    // REQUIRED: Call super with DataSource
    super(dataSource);
    
    // Store any additional options
    this.options = additionalOptions;
    
    // Enable prototype factory if introspection needed
    if (additionalOptions.enableIntrospection) {
      this._enablePrototypeFactory(dataSource.getSchema());
    }
  }
  
  // REQUIRED: Implement value() - must be synchronous
  value() {
    this._validateNotDestroyed(); // Use inherited validation
    
    // Get current data from DataSource (synchronous)
    return this.dataSource.query({
      find: ['?data'],
      where: [['?e', ':resource/data', '?data']]
    });
  }
  
  // REQUIRED: Implement query() - must be synchronous  
  query(querySpec) {
    this._validateNotDestroyed(); // Use inherited validation
    this._validateQuerySpec(querySpec); // Use inherited validation
    
    // Delegate to DataSource (synchronous)
    return this.dataSource.query(querySpec);
  }
}
```

### Step 2: Add Resource-Specific Methods

```javascript
export class MyResourceHandle extends Handle {
  // ... constructor, value(), query() from Step 1 ...
  
  // Add resource-specific convenience methods
  getById(id) {
    this._validateNotDestroyed();
    
    if (!id) {
      throw new Error('ID is required');
    }
    
    return this.query({
      find: ['?attr', '?value'],
      where: [[id, '?attr', '?value']]
    });
  }
  
  updateById(id, data) {
    this._validateNotDestroyed();
    
    if (!id) {
      throw new Error('ID is required');
    }
    
    if (!data || typeof data !== 'object') {
      throw new Error('Update data must be an object');
    }
    
    // Delegate to DataSource if it supports updates
    if (typeof this.dataSource.update === 'function') {
      return this.dataSource.update({ id, data });
    }
    
    throw new Error('DataSource does not support updates');
  }
  
  // Resource-specific subscription patterns
  subscribeToId(id, callback) {
    this._validateNotDestroyed();
    this._validateCallback(callback);
    
    if (!id) {
      throw new Error('ID is required');
    }
    
    return this.subscribe({
      find: ['?attr', '?value'],
      where: [[id, '?attr', '?value']]
    }, callback);
  }
}
```

### Step 3: Add Caching (Optional)

```javascript
import { CachedHandle } from '@legion/handle';

export class MyCachedResourceHandle extends CachedHandle {
  constructor(dataSource, options = {}) {
    // CachedHandle provides caching capabilities
    super(dataSource, {
      cacheTTL: options.cacheTTL || 30000, // 30 seconds default
      enableIntrospection: options.enableIntrospection
    });
  }
  
  // Implement required methods with caching support
  value() {
    this._validateNotDestroyed();
    
    // Check cache first (inherited from CachedHandle)
    if (this._isLocalCacheValid()) {
      return this._cachedData;
    }
    
    // Query DataSource and cache result
    const data = this.dataSource.query({
      find: ['?data'],
      where: [['?e', ':resource/data', '?data']]
    });
    
    // Update cache (inherited from CachedHandle)
    this._updateLocalCache(data);
    
    return data;
  }
  
  query(querySpec) {
    this._validateNotDestroyed();
    this._validateQuerySpec(querySpec);
    
    // For queries, typically bypass cache and go direct to DataSource
    return this.dataSource.query(querySpec);
  }
}
```

## Implementing a DataSource

### Step 1: Basic DataSource Implementation

```javascript
export class MyDataSource {
  constructor(backendStore, options = {}) {
    this.backendStore = backendStore; // Your underlying storage
    this.options = options;
    this._subscriptions = new Map(); // Track subscriptions
    this._schema = options.schema || this._generateSchema();
  }
  
  // REQUIRED: Implement query() - must be synchronous
  query(querySpec) {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }
    
    // Implement your query logic here - MUST BE SYNCHRONOUS
    return this._executeQuery(querySpec);
  }
  
  // REQUIRED: Implement subscribe() - must be synchronous
  subscribe(querySpec, callback) {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }
    
    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback function is required');
    }
    
    // Create subscription synchronously
    const subscriptionId = Date.now() + Math.random();
    const subscription = {
      id: subscriptionId,
      querySpec,
      callback,
      unsubscribe: () => {
        this._subscriptions.delete(subscriptionId);
        this._unregisterSubscription(subscriptionId);
      }
    };
    
    // Register subscription synchronously
    this._subscriptions.set(subscriptionId, subscription);
    this._registerSubscription(subscription);
    
    return subscription;
  }
  
  // REQUIRED: Implement getSchema() - must be synchronous
  getSchema() {
    return this._schema;
  }
  
  // Your implementation-specific methods
  _executeQuery(querySpec) {
    // Implement based on your backend store
    // Examples: SQL query, DataScript query, API call, etc.
    return this.backendStore.query(querySpec);
  }
  
  _registerSubscription(subscription) {
    // Register with your backend store for change notifications
    this.backendStore.onChanges((changes) => {
      // Check if changes match subscription query
      if (this._matchesQuery(changes, subscription.querySpec)) {
        // Invoke callback synchronously
        subscription.callback(changes);
      }
    });
  }
  
  _unregisterSubscription(subscriptionId) {
    // Clean up subscription registration
    // Implementation depends on your backend store
  }
  
  _matchesQuery(changes, querySpec) {
    // Implement query matching logic
    // Return true if changes should trigger callback
    return true; // Simplified
  }
  
  _generateSchema() {
    // Generate schema from backend store if not provided
    return {
      attributes: {},
      relationships: {},
      constraints: {}
    };
  }
}
```

### Step 2: Add Optional Capabilities

```javascript
export class MyDataSource {
  // ... basic implementation from Step 1 ...
  
  // OPTIONAL: Implement update() for data modification
  update(updateSpec) {
    if (!updateSpec || typeof updateSpec !== 'object') {
      throw new Error('Update specification must be an object');
    }
    
    // Execute update synchronously
    const result = this.backendStore.update(updateSpec);
    
    // Notify subscribers of changes
    this._notifySubscribers(result.changes);
    
    return result;
  }
  
  // OPTIONAL: Implement validate() for data validation
  validate(data) {
    if (!data || typeof data !== 'object') {
      return false;
    }
    
    // Validate against schema
    return this._validateAgainstSchema(data, this._schema);
  }
  
  // OPTIONAL: Implement getMetadata() for additional info
  getMetadata() {
    return {
      backendStoreType: this.backendStore.constructor.name,
      subscriptionCount: this._subscriptions.size,
      schemaVersion: this._schema.version || '1.0.0',
      capabilities: {
        query: true,
        subscribe: true,
        update: typeof this.update === 'function',
        validate: typeof this.validate === 'function'
      }
    };
  }
  
  // Helper methods
  _notifySubscribers(changes) {
    for (const subscription of this._subscriptions.values()) {
      if (this._matchesQuery(changes, subscription.querySpec)) {
        // Invoke callback synchronously
        subscription.callback(changes);
      }
    }
  }
  
  _validateAgainstSchema(data, schema) {
    // Implement schema validation logic
    // Return true if data is valid
    return true; // Simplified
  }
}
```

## Common Patterns and Best Practices

### 1. Validation Patterns

```javascript
// Use inherited validation methods
export class MyHandle extends Handle {
  customMethod(param1, param2) {
    // Standard validations
    this._validateNotDestroyed();
    
    // Custom validations
    if (!param1) {
      throw new Error('Parameter 1 is required');
    }
    
    if (typeof param2 !== 'string') {
      throw new Error('Parameter 2 must be a string');
    }
    
    // Proceed with implementation...
  }
}
```

### 2. Subscription Patterns

```javascript
// Pattern: Entity-specific subscriptions
subscribeToEntity(entityId, callback) {
  return this.subscribe({
    find: ['?attr', '?value'],
    where: [[entityId, '?attr', '?value']]
  }, callback);
}

// Pattern: Filtered subscriptions  
subscribeToType(type, callback) {
  return this.subscribe({
    find: ['?e'],
    where: [['?e', ':entity/type', type]]
  }, callback);
}

// Pattern: Subscription cleanup
setupAutoCleanup() {
  // Handle will automatically clean up all subscriptions on destroy()
  // No manual cleanup needed if using Handle.subscribe()
}
```

### 3. Error Handling Patterns

```javascript
// Pattern: Fail-fast validation
validateInput(input) {
  if (!input) {
    throw new Error('Input is required'); // Immediate failure
  }
  
  if (typeof input !== 'object') {
    throw new Error('Input must be an object'); // Immediate failure
  }
  
  // No fallbacks, no retries, no recovery
}

// Pattern: Clean error propagation
query(querySpec) {
  this._validateNotDestroyed(); // May throw
  this._validateQuerySpec(querySpec); // May throw
  
  try {
    return this.resourceManager.query(querySpec); // May throw
  } catch (error) {
    // Re-throw with additional context
    throw new Error(`Query failed: ${error.message}`);
  }
}
```

### 4. Caching Patterns

```javascript
// Pattern: Cache with invalidation
export class CachedResourceHandle extends CachedHandle {
  value() {
    // Check cache validity
    if (this._isLocalCacheValid()) {
      return this._cachedData;
    }
    
    // Fetch fresh data
    const data = this.dataSource.query(this._buildValueQuery());
    
    // Update cache
    this._updateLocalCache(data);
    
    // Setup invalidation if not already done
    if (!this._cacheInvalidationSetup) {
      this._setupCacheInvalidation();
      this._cacheInvalidationSetup = true;
    }
    
    return data;
  }
  
  _setupCacheInvalidation() {
    // Subscribe to changes that should invalidate cache
    this.subscribe(this._buildInvalidationQuery(), () => {
      this._invalidateCache();
    });
  }
}
```

### 5. Actor Integration Patterns

```javascript
// Pattern: Custom message handling
receive(message) {
  // Handle custom message types
  if (message.type === 'custom-operation') {
    return this.customOperation(message.params);
  }
  
  // Delegate to parent for standard messages
  return super.receive(message);
}

// Pattern: Remote-friendly methods
customOperation(params) {
  // Method works both locally and remotely
  this._validateNotDestroyed();
  
  // Validate params for remote safety
  if (typeof params !== 'object' || params === null) {
    throw new Error('Parameters must be a non-null object');
  }
  
  // Execute operation
  return this.dataSource.customOperation(params);
}
```

## Testing Your Implementation

### Unit Testing Handle Subclass

```javascript
import { MyResourceHandle } from './MyResourceHandle.js';

describe('MyResourceHandle', () => {
  let mockDataSource;
  let handle;
  
  beforeEach(() => {
    // Create mock DataSource with required methods
    mockDataSource = {
      query: jest.fn(),
      subscribe: jest.fn(),
      getSchema: jest.fn(() => ({ attributes: {} }))
    };
    
    handle = new MyResourceHandle(mockDataSource);
  });
  
  afterEach(() => {
    // Clean up handle
    handle.destroy();
  });
  
  test('should implement required methods', () => {
    expect(typeof handle.value).toBe('function');
    expect(typeof handle.query).toBe('function');
  });
  
  test('should delegate query to DataSource', () => {
    const querySpec = { find: ['?e'], where: [] };
    const expectedResults = [1, 2, 3];
    
    mockDataSource.query.mockReturnValue(expectedResults);
    
    const results = handle.query(querySpec);
    
    expect(mockDataSource.query).toHaveBeenCalledWith(querySpec);
    expect(results).toBe(expectedResults);
  });
  
  test('should validate destroyed state', () => {
    handle.destroy();
    
    expect(() => handle.query({})).toThrow('Handle has been destroyed');
  });
});
```

### Integration Testing with Real DataSource

```javascript
import { MyResourceHandle } from './MyResourceHandle.js';
import { MyDataSource } from './MyDataSource.js';

describe('MyResourceHandle Integration', () => {
  let dataSource;
  let handle;
  
  beforeEach(() => {
    // Create real DataSource with test backend
    dataSource = new MyDataSource(createTestBackend());
    handle = new MyResourceHandle(dataSource);
  });
  
  test('should retrieve real data', () => {
    const results = handle.value();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });
  
  test('should handle subscriptions', (done) => {
    const querySpec = { find: ['?e'], where: [] };
    
    const subscription = handle.subscribe(querySpec, (data) => {
      expect(Array.isArray(data)).toBe(true);
      subscription.unsubscribe();
      done();
    });
    
    // Trigger change in DataSource
    dataSource.update({ /* test update */ });
  });
});
```

## Common Pitfalls and Solutions

### 1. Async Operations in Handle Infrastructure
```javascript
// ❌ WRONG: Using async/await in Handle
async query(querySpec) {
  await this.dataSource.query(querySpec);
}

// ✅ CORRECT: Synchronous operations only
query(querySpec) {
  return this.dataSource.query(querySpec);
}
```

### 2. Missing DataSource Interface Methods
```javascript
// ❌ WRONG: DataSource missing required methods
class BadDataSource {
  query() { /* ... */ }
  // Missing subscribe() and getSchema()
}

// ✅ CORRECT: Implement all required methods
class GoodDataSource {
  query(querySpec) { /* ... */ }
  subscribe(querySpec, callback) { /* ... */ }
  getSchema() { /* ... */ }
}
```

### 3. Subscription Memory Leaks
```javascript
// ❌ WRONG: Manual subscription tracking
class BadHandle extends Handle {
  constructor(dataSource) {
    super(dataSource);
    this.mySubscriptions = []; // Manual tracking
  }
}

// ✅ CORRECT: Use inherited subscription tracking
class GoodHandle extends Handle {
  customSubscribe(querySpec, callback) {
    // Use inherited subscribe() for automatic tracking
    return this.subscribe(querySpec, callback);
  }
}
```

### 4. Validation Bypass
```javascript
// ❌ WRONG: Skip validation
query(querySpec) {
  return this.dataSource.query(querySpec); // No validation
}

// ✅ CORRECT: Always validate
query(querySpec) {
  this._validateNotDestroyed();
  this._validateQuerySpec(querySpec);
  return this.dataSource.query(querySpec);
}
```

Following this implementation guide ensures your Handle subclasses and DataSource implementations integrate seamlessly with the Actor system while maintaining the synchronous dispatcher pattern and providing comprehensive functionality.