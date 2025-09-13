# Handle Package Architecture

## Technical Architecture Overview

The Handle package implements a three-layer architecture that provides universal proxy capabilities with Actor system integration and comprehensive introspection support.

## Architecture Layers

### Layer 1: Actor System Integration
```
┌─────────────────────────────────────────┐
│           Actor System Layer            │
├─────────────────────────────────────────┤
│ • Message routing (receive method)      │
│ • Remote capability (Actor inheritance) │
│ • Frontend/backend sharing             │
│ • Network transparency                  │
└─────────────────────────────────────────┘
                    ↓
```

### Layer 2: Handle Proxy Infrastructure
```
┌─────────────────────────────────────────┐
│          Handle Proxy Layer             │
├─────────────────────────────────────────┤
│ • Synchronous dispatcher pattern       │
│ • Subscription tracking & cleanup      │
│ • Lifecycle management                 │
│ • Input validation                     │
│ • ResourceManager delegation           │
└─────────────────────────────────────────┘
                    ↓
```

### Layer 3: Resource Management
```
┌─────────────────────────────────────────┐
│         Resource Manager Layer          │
├─────────────────────────────────────────┤
│ • Actual data access                   │
│ • Query execution                      │
│ • Schema management                    │
│ • Subscription implementation          │
└─────────────────────────────────────────┘
```

## Component Architecture

### Handle Base Class

```javascript
┌─────────────────────────────────────────┐
│               Handle                    │
│            (extends Actor)              │
├─────────────────────────────────────────┤
│ Fields:                                 │
│ • resourceManager: ResourceManager     │
│ • _subscriptions: Set<Subscription>    │
│ • _destroyed: boolean                   │
│ • _prototypeFactory: PrototypeFactory  │
├─────────────────────────────────────────┤
│ Abstract Methods:                       │
│ • value() → any                        │
│ • query(querySpec) → any               │
├─────────────────────────────────────────┤
│ Concrete Methods:                       │
│ • receive(message) → any               │
│ • subscribe(querySpec, callback) → Sub │
│ • getIntrospectionInfo() → Object      │
│ • destroy() → void                     │
│ • isDestroyed() → boolean              │
├─────────────────────────────────────────┤
│ Protected Methods:                      │
│ • _validateNotDestroyed() → void       │
│ • _validateQuerySpec(spec) → void      │
│ • _validateCallback(fn) → void         │
│ • _enablePrototypeFactory(schema) → void│
└─────────────────────────────────────────┘
```

### ResourceManager Interface

```javascript
┌─────────────────────────────────────────┐
│          ResourceManager                │
│         (Interface Contract)            │
├─────────────────────────────────────────┤
│ Required Methods:                       │
│ • query(querySpec) → results           │
│ • subscribe(querySpec, callback) → Sub │
│ • getSchema() → schema                  │
├─────────────────────────────────────────┤
│ Optional Methods:                       │
│ • update(updateSpec) → result          │
│ • validate(data) → boolean             │
│ • getMetadata() → metadata             │
└─────────────────────────────────────────┘
```

## Message Flow Architecture

### 1. Local Operation Flow
```
Client Code
    ↓
Handle.query()
    ↓ (validate)
ResourceManager.query()
    ↓ (execute)
Return Results
    ↓
Client Code
```

### 2. Remote Operation Flow (Actor System)
```
Frontend Client
    ↓ (Actor message)
Handle.receive()
    ↓ (route message)
Handle.query()
    ↓ (validate)
ResourceManager.query()
    ↓ (execute)
Return Results
    ↓ (Actor response)
Frontend Client
```

### 3. Subscription Flow
```
Client Code
    ↓
Handle.subscribe()
    ↓ (validate & track)
ResourceManager.subscribe()
    ↓ (register callback)
Resource Changes
    ↓ (callback invoked)
Client Callback
    ↓ (notification)
Client Code
```

## Synchronous Dispatcher Pattern Implementation

### Core Principle
All Handle infrastructure operations are **synchronous** to eliminate race conditions and timing issues that plague rapid subscribe/unsubscribe scenarios.

### Implementation Details

```javascript
// Synchronous subscription tracking
subscribe(querySpec, callback) {
  // 1. Synchronous validation (no await)
  this._validateQuerySpec(querySpec);
  this._validateCallback(callback);
  
  // 2. Synchronous ResourceManager delegation (no await)
  const resourceSubscription = this.resourceManager.subscribe(querySpec, callback);
  
  // 3. Synchronous wrapper creation (no await)  
  const trackingWrapper = {
    id: resourceSubscription.id || Date.now() + Math.random(),
    unsubscribe: () => {
      // Synchronous cleanup - no race conditions possible
      this._subscriptions.delete(trackingWrapper);
      resourceSubscription.unsubscribe();
    }
  };
  
  // 4. Synchronous tracking (no await)
  this._subscriptions.add(trackingWrapper);
  
  // 5. Synchronous return (no await)
  return trackingWrapper;
}
```

### External vs Internal View

```javascript
// EXTERNAL VIEW: Appears asynchronous through callbacks
dataHandle.subscribe(query, (results) => {
  // This callback appears "async" from client perspective
  console.log('New results:', results);
});

// INTERNAL VIEW: All operations are synchronous
class ResourceManager {
  subscribe(querySpec, callback) {
    // Synchronous subscription setup
    const subscription = this.database.subscribe(querySpec, (data) => {
      // Callback is invoked synchronously by the database
      callback(data);
    });
    return subscription; // Synchronous return
  }
}
```

## Introspection Architecture

### Universal Knowledge Layer

The introspection system provides universal discovery capabilities across all resource types:

```javascript
┌─────────────────────────────────────────┐
│          PrototypeFactory               │
├─────────────────────────────────────────┤
│ • analyzeSchema(schema) → void          │
│ • detectEntityType(entity) → string    │
│ • getEntityPrototype(type) → Class     │
│ • generatePrototype(type) → Class      │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│       Generated Entity Prototypes       │
├─────────────────────────────────────────┤
│ • getAvailableAttributes() → string[]  │
│ • getRelationships() → Relationship[]  │
│ • getCapabilities() → Capability[]     │
│ • validateAttribute(name, val) → bool  │
└─────────────────────────────────────────┘
```

### Introspection Flow

```
1. ResourceManager.getSchema()
   ↓
2. PrototypeFactory.analyzeSchema()
   ↓
3. Generate entity type prototypes
   ↓
4. Handle.getIntrospectionInfo()
   ↓
5. Detect entity type from current data
   ↓
6. Instantiate appropriate prototype
   ↓
7. Return introspection capabilities
```

## Caching Architecture

### Multi-Level Caching Strategy

```javascript
┌─────────────────────────────────────────┐
│            CachedHandle                 │
│         (extends Handle)                │
├─────────────────────────────────────────┤
│ Local Cache:                            │
│ • _cachedData: any                      │
│ • _cacheTimestamp: number               │
│ • _cacheTTL: number                     │
├─────────────────────────────────────────┤
│ Global Cache Integration:               │
│ • cacheManager: CacheManager           │
│ • _setupCacheInvalidation() → void     │
│ • _invalidateCache() → void             │
└─────────────────────────────────────────┘
```

### Cache Invalidation Flow

```
Resource Changes
    ↓
Subscription Callback
    ↓
CachedHandle._invalidateCache()
    ↓
Clear Local Cache + Global Cache
    ↓
Next access triggers fresh query
```

## Actor System Integration Details

### Message Types and Routing

```javascript
const MessageTypes = {
  QUERY: 'query',           // Execute query
  VALUE: 'value',           // Get current value
  SUBSCRIBE: 'subscribe',   // Set up subscription
  DESTROY: 'destroy',       // Clean up resources
  INTROSPECT: 'introspect'  // Get introspection info
};

// Actor message routing
receive(message) {
  this._validateNotDestroyed();
  
  if (typeof message === 'object' && message.type) {
    switch (message.type) {
      case MessageTypes.QUERY:
        return this.query(message.querySpec);
      case MessageTypes.VALUE:
        return this.value();
      case MessageTypes.SUBSCRIBE:
        return this.subscribe(message.querySpec, message.callback);
      case MessageTypes.DESTROY:
        return this.destroy();
      case MessageTypes.INTROSPECT:
        return this.getIntrospectionInfo();
      default:
        return super.receive(message); // Actor system default handling
    }
  }
  
  return super.receive(message);
}
```

### Remote Capability Implementation

```javascript
// Frontend usage (same API)
const handle = new DataStoreHandle(resourceManager);
const results = handle.query(querySpec);

// Backend usage through Actor system (same API)
const remoteHandle = actorSystem.getActor('datastore-handle');
const results = await remoteHandle.receive({
  type: 'query',
  querySpec: querySpec
});
```

## Validation Architecture

### Input Validation Pipeline

```javascript
┌─────────────────────────────────────────┐
│           Validation Pipeline           │
├─────────────────────────────────────────┤
│ 1. Handle._validateNotDestroyed()       │
│ 2. Handle._validateQuerySpec()          │
│ 3. Handle._validateCallback()           │
│ 4. ResourceManager-specific validation  │
│ 5. Schema validation (if available)     │
└─────────────────────────────────────────┘
```

### Validation Utilities

```javascript
// Common validation patterns extracted for reuse
export class ValidationUtils {
  static validateQuerySpec(querySpec, context = 'Query specification') {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error(`${context} must be an object`);
    }
    
    if (!querySpec.find && !querySpec.where) {
      throw new Error(`${context} must have find or where clause`);
    }
  }
  
  static validateCallback(callback, context = 'Callback') {
    if (!callback || typeof callback !== 'function') {
      throw new Error(`${context} function is required`);
    }
  }
  
  static validateEntityId(entityId, context = 'Entity ID') {
    if (entityId === null || entityId === undefined) {
      throw new Error(`${context} is required`);
    }
  }
}
```

## Lifecycle Management Architecture

### Subscription Lifecycle

```
1. Handle.subscribe()
   ↓
2. Create ResourceManager subscription
   ↓
3. Wrap in tracking wrapper
   ↓
4. Add to _subscriptions Set
   ↓
5. Return tracking wrapper
   ↓
... subscription active ...
   ↓
6. Client calls trackingWrapper.unsubscribe()
   ↓
7. Remove from _subscriptions Set
   ↓
8. Call ResourceManager unsubscribe
```

### Destruction Lifecycle

```
1. Handle.destroy()
   ↓
2. Check if already destroyed
   ↓
3. Iterate through _subscriptions
   ↓
4. Call unsubscribe on each
   ↓
5. Clear _subscriptions Set
   ↓
6. Clean up PrototypeFactory
   ↓
7. Mark _destroyed = true
```

## Error Handling Architecture

### Fail-Fast Principle

All Handle operations follow fail-fast principle with immediate error throwing:

```javascript
// Validation errors
if (!resourceManager) {
  throw new Error('ResourceManager is required'); // Immediate failure
}

// State errors  
if (this._destroyed) {
  throw new Error('Handle has been destroyed'); // Immediate failure
}

// Input errors
if (!querySpec) {
  throw new Error('Query specification is required'); // Immediate failure
}
```

### Error Recovery Patterns

- **No fallbacks**: Operations either succeed or throw immediately
- **No retries**: Handle infrastructure does not retry failed operations
- **Clean failure**: Failed operations leave Handle in consistent state
- **Propagation**: Errors propagate to caller for handling

## Performance Architecture

### Synchronous Operations Benefits

1. **No await overhead**: All Handle operations execute synchronously
2. **No Promise creation**: Eliminates Promise allocation overhead  
3. **No microtask scheduling**: Direct execution without event loop delays
4. **Predictable timing**: Operations complete in deterministic order

### Memory Management

```javascript
// Subscription tracking prevents memory leaks
class Handle {
  destroy() {
    // Clean up all tracked subscriptions
    for (const subscription of this._subscriptions) {
      subscription.unsubscribe(); // ResourceManager cleanup
    }
    this._subscriptions.clear(); // Handle cleanup
  }
}
```

### Caching Strategy

- **Local cache**: Fast access for recently accessed data
- **Global cache**: Shared cache across Handle instances  
- **Automatic invalidation**: Subscriptions trigger cache invalidation
- **TTL expiration**: Time-based cache expiration for consistency

This architecture provides a robust, performant, and universally applicable foundation for all proxy functionality while maintaining strict synchronous operations and comprehensive introspection capabilities.