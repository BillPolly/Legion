# Handle Implementation Guide

## Quick Start Guide

This guide provides step-by-step instructions for implementing Handle subclasses and ResourceManager implementations.

## Implementing a Handle Subclass

### Step 1: Basic Handle Subclass Structure

```javascript
import { Handle } from '@legion/km-data-handle';

export class MyResourceHandle extends Handle {
  constructor(resourceManager, additionalOptions = {}) {
    // REQUIRED: Call super with ResourceManager
    super(resourceManager);
    
    // Store any additional options
    this.options = additionalOptions;
    
    // Enable prototype factory if introspection needed
    if (additionalOptions.enableIntrospection) {
      this._enablePrototypeFactory(resourceManager.getSchema());
    }
  }
  
  // REQUIRED: Implement value() - must be synchronous
  value() {
    this._validateNotDestroyed(); // Use inherited validation
    
    // Get current data from ResourceManager (synchronous)
    return this.resourceManager.query({
      find: ['?data'],
      where: [['?e', ':resource/data', '?data']]
    });
  }
  
  // REQUIRED: Implement query() - must be synchronous  
  query(querySpec) {
    this._validateNotDestroyed(); // Use inherited validation
    this._validateQuerySpec(querySpec); // Use inherited validation
    
    // Delegate to ResourceManager (synchronous)
    return this.resourceManager.query(querySpec);
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
    
    // Delegate to ResourceManager if it supports updates
    if (typeof this.resourceManager.update === 'function') {
      return this.resourceManager.update({ id, data });
    }
    
    throw new Error('ResourceManager does not support updates');
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
import { CachedHandle } from '@legion/km-data-handle';

export class MyCachedResourceHandle extends CachedHandle {
  constructor(resourceManager, options = {}) {
    // CachedHandle provides caching capabilities
    super(resourceManager, {
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
    
    // Query ResourceManager and cache result
    const data = this.resourceManager.query({
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
    
    // For queries, typically bypass cache and go direct to ResourceManager
    return this.resourceManager.query(querySpec);
  }
}
```

## Implementing a ResourceManager

### Step 1: Basic ResourceManager Implementation

```javascript
export class MyResourceManager {
  constructor(dataSource, options = {}) {
    this.dataSource = dataSource; // Your underlying data source
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
    // Implement based on your data source
    // Examples: SQL query, DataScript query, API call, etc.
    return this.dataSource.query(querySpec);
  }
  
  _registerSubscription(subscription) {
    // Register with your data source for change notifications
    this.dataSource.onChanges((changes) => {
      // Check if changes match subscription query
      if (this._matchesQuery(changes, subscription.querySpec)) {
        // Invoke callback synchronously
        subscription.callback(changes);
      }
    });
  }
  
  _unregisterSubscription(subscriptionId) {
    // Clean up subscription registration
    // Implementation depends on your data source
  }
  
  _matchesQuery(changes, querySpec) {
    // Implement query matching logic
    // Return true if changes should trigger callback
    return true; // Simplified
  }
  
  _generateSchema() {
    // Generate schema from data source if not provided
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
export class MyResourceManager {
  // ... basic implementation from Step 1 ...
  
  // OPTIONAL: Implement update() for data modification
  update(updateSpec) {
    if (!updateSpec || typeof updateSpec !== 'object') {
      throw new Error('Update specification must be an object');
    }
    
    // Execute update synchronously
    const result = this.dataSource.update(updateSpec);
    
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
      dataSourceType: this.dataSource.constructor.name,
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
    const data = this.resourceManager.query(this._buildValueQuery());
    
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
  return this.resourceManager.customOperation(params);
}
```

## Testing Your Implementation

### Unit Testing Handle Subclass

```javascript
import { MyResourceHandle } from './MyResourceHandle.js';

describe('MyResourceHandle', () => {
  let mockResourceManager;
  let handle;
  
  beforeEach(() => {
    // Create mock ResourceManager with required methods
    mockResourceManager = {
      query: jest.fn(),
      subscribe: jest.fn(),
      getSchema: jest.fn(() => ({ attributes: {} }))
    };
    
    handle = new MyResourceHandle(mockResourceManager);
  });
  
  afterEach(() => {
    // Clean up handle
    handle.destroy();
  });
  
  test('should implement required methods', () => {
    expect(typeof handle.value).toBe('function');
    expect(typeof handle.query).toBe('function');
  });
  
  test('should delegate query to ResourceManager', () => {
    const querySpec = { find: ['?e'], where: [] };
    const expectedResults = [1, 2, 3];
    
    mockResourceManager.query.mockReturnValue(expectedResults);
    
    const results = handle.query(querySpec);
    
    expect(mockResourceManager.query).toHaveBeenCalledWith(querySpec);
    expect(results).toBe(expectedResults);
  });
  
  test('should validate destroyed state', () => {
    handle.destroy();
    
    expect(() => handle.query({})).toThrow('Handle has been destroyed');
  });
});
```

### Integration Testing with Real ResourceManager

```javascript
import { MyResourceHandle } from './MyResourceHandle.js';
import { MyResourceManager } from './MyResourceManager.js';

describe('MyResourceHandle Integration', () => {
  let resourceManager;
  let handle;
  
  beforeEach(() => {
    // Create real ResourceManager with test data
    resourceManager = new MyResourceManager(createTestDataSource());
    handle = new MyResourceHandle(resourceManager);
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
    
    // Trigger change in ResourceManager
    resourceManager.update({ /* test update */ });
  });
});
```

## Common Pitfalls and Solutions

### 1. Async Operations in Handle Infrastructure
```javascript
// ❌ WRONG: Using async/await in Handle
async query(querySpec) {
  await this.resourceManager.query(querySpec);
}

// ✅ CORRECT: Synchronous operations only
query(querySpec) {
  return this.resourceManager.query(querySpec);
}
```

### 2. Missing ResourceManager Interface Methods
```javascript
// ❌ WRONG: ResourceManager missing required methods
class BadResourceManager {
  query() { /* ... */ }
  // Missing subscribe() and getSchema()
}

// ✅ CORRECT: Implement all required methods
class GoodResourceManager {
  query(querySpec) { /* ... */ }
  subscribe(querySpec, callback) { /* ... */ }
  getSchema() { /* ... */ }
}
```

### 3. Subscription Memory Leaks
```javascript
// ❌ WRONG: Manual subscription tracking
class BadHandle extends Handle {
  constructor(resourceManager) {
    super(resourceManager);
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
  return this.resourceManager.query(querySpec); // No validation
}

// ✅ CORRECT: Always validate
query(querySpec) {
  this._validateNotDestroyed();
  this._validateQuerySpec(querySpec);
  return this.resourceManager.query(querySpec);
}
```

Following this implementation guide ensures your Handle subclasses and ResourceManager implementations integrate seamlessly with the Actor system while maintaining the synchronous dispatcher pattern and providing comprehensive functionality.