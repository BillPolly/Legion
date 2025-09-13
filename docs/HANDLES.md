# Handle/Proxy Pattern Documentation

## Overview

Handles are the universal proxy pattern in Legion that provide a consistent interface for accessing any type of resource - whether local or remote, synchronous or asynchronous, simple or complex. A Handle appears to be a local object with direct property access and methods, but it's actually a facade that properly transacts with the underlying resource through the ResourceManager hierarchy.

## Core Principles

### 1. Handles are Never Created Directly by Client Code
```javascript
// ❌ WRONG - Never do this
const handle = new Handle(resourceManager);

// ✅ CORRECT - Handles are created by ResourceManagers or through projection
const handle = resourceManager.createHandle();
const projectedHandle = parentHandle.project(querySpec);
```

### 2. Handles are Universal Base Classes
All proxy types (DataStoreProxy, EntityProxy, FileHandle, GitRepoHandle, etc.) extend from the base Handle class, which itself extends Actor for remote capability.

### 3. Handles Use Prototypes for Rich Object Interface
Each Handle type has a prototype that provides:
- Direct property access (`gitRepo.branches`, `entity.name`)
- Convenient methods (`gitRepo.commit()`, `entity.update()`)
- Introspection capabilities
- All while routing operations through the proper ResourceManager

## Architecture

```
Actor (base class for remote capability)
  ↓
Handle (universal proxy base)
  ↓
Specific Handle Types (with custom prototypes)
  - EntityProxy
  - StreamProxy
  - CollectionProxy
  - FileHandle
  - GitRepoHandle
  - etc.
```

## ResourceManager Interface

Every Handle requires a ResourceManager that implements these REQUIRED methods:

```javascript
const ResourceManagerInterface = {
  // REQUIRED - Execute query against the resource (MUST be synchronous!)
  query: (querySpec) => Array,
  
  // REQUIRED - Set up subscription for changes (MUST be synchronous!)
  subscribe: (querySpec, callback) => ({ id, unsubscribe }),
  
  // REQUIRED - Get resource schema for introspection (MUST be synchronous!)
  getSchema: () => Object,
  
  // OPTIONAL - Update resource data
  update: (updateSpec) => Object,
  
  // OPTIONAL - Validate data against schema
  validate: (data) => Boolean,
  
  // OPTIONAL - Get metadata and capabilities
  getMetadata: () => Object
};
```

**CRITICAL**: All ResourceManager operations MUST be synchronous - NO await, NO promises! The synchronous dispatcher pattern eliminates race conditions.

## Prototype Factory Pattern

The PrototypeFactory creates dynamic prototypes based on resource schemas to provide the convenient object-like interface:

```javascript
// Example: Git Repository Handle
class GitRepoHandle extends Handle {
  constructor(resourceManager) {
    super(resourceManager);
    
    // Enable prototype factory with schema
    const schema = resourceManager.getSchema();
    this._enablePrototypeFactory(schema, 'git-schema');
  }
}

// Usage appears local but goes through ResourceManager
const repo = gitResourceManager.createRepoHandle();
console.log(repo.branches);        // Appears like direct property access
await repo.commit('message');      // Appears like direct method call
repo.currentBranch = 'develop';    // Appears like direct property setting

// But actually all operations go through ResourceManager hierarchy
```

## Handle Projection Pattern

Handles can create projected handles (sub-handles) that provide specialized views:

```javascript
class DataStoreProxy extends Handle {
  // Parent handle creates projected child handles
  entity(entityId) {
    // Create specialized ResourceManager for entity operations
    const entityResourceManager = new EntityResourceManager(
      this.resourceManager, 
      entityId
    );
    
    // Return projected handle with entity-specific prototype
    return new EntityProxy(entityResourceManager);
  }
  
  stream(querySpec) {
    // Create specialized ResourceManager for streaming
    const streamResourceManager = new StreamResourceManager(
      this.resourceManager,
      querySpec
    );
    
    // Return projected handle with stream-specific prototype
    return new StreamProxy(streamResourceManager);
  }
}
```

## Example: Complete Entity Handle Implementation

```javascript
class EntityProxy extends Handle {
  constructor(resourceManager, entityId) {
    super(resourceManager);
    
    this.entityId = entityId;
    
    // Get schema for this entity type
    const schema = resourceManager.getSchema();
    
    // Enable prototype factory to add entity-specific properties
    this._enablePrototypeFactory(schema, 'datastore-entity');
    
    // Now the handle has properties based on schema
    // e.g., if schema defines 'name', 'email', 'age' attributes
    // this handle will appear to have those properties
  }
  
  // The prototype factory automatically adds getters/setters that:
  // - Get: calls this.resourceManager.query() 
  // - Set: calls this.resourceManager.update()
}

// Usage
const user = dataStore.entity(userId);
console.log(user.name);           // Appears like property access
user.email = 'new@example.com';   // Appears like property setting
await user.save();                 // Explicit save if needed
```

## Handle Lifecycle

1. **Creation**: ResourceManager or parent Handle creates the Handle
2. **Prototype Application**: PrototypeFactory applies schema-based prototype
3. **Usage**: Client code uses Handle like a local object
4. **Operations**: All operations route through ResourceManager hierarchy
5. **Cleanup**: Handle.destroy() cleans up subscriptions and resources

## Key Handle Methods

```javascript
class Handle extends Actor {
  // Get the handle type (returns constructor name)
  get handleType() { return this.constructor.name; }
  
  // Serialize for remote transmission
  serialize() {
    return {
      __type: 'RemoteHandle',
      handleType: this.handleType,
      handleId: this.id,
      isDestroyed: this._destroyed
    };
  }
  
  // Get introspection information
  getIntrospectionInfo() {
    return {
      methods: [...],
      attributes: [...],
      typeName: this.handleType
    };
  }
  
  // Query through ResourceManager
  query(querySpec) {
    return this.resourceManager.query(querySpec);
  }
  
  // Subscribe to changes
  subscribe(querySpec, callback) {
    return this.resourceManager.subscribe(querySpec, callback);
  }
  
  // Clean up resources
  destroy() {
    // Cleanup subscriptions, cache, etc.
    this._destroyed = true;
  }
}
```

## Common Patterns

### 1. File System Handle
```javascript
class FileHandle extends Handle {
  constructor(path, fileSystem) {
    const fileResourceManager = {
      path: path,
      fileSystem: fileSystem,
      
      query: (querySpec) => {
        if (querySpec.type === 'content') {
          return [fileSystem.readFile(path)];
        }
        if (querySpec.type === 'stats') {
          return [fileSystem.stat(path)];
        }
      },
      
      subscribe: (querySpec, callback) => {
        const watchId = fileSystem.watch(path, callback);
        return { id: watchId, unsubscribe: () => fileSystem.unwatch(watchId) };
      },
      
      getSchema: () => ({
        type: 'file',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
          size: { type: 'number' }
        }
      })
    };
    
    super(fileResourceManager);
  }
}
```

### 2. Collection Handle with Filtering
```javascript
class CollectionProxy extends Handle {
  filter(predicate) {
    // Create projected handle with filtered view
    const filteredResourceManager = {
      ...this.resourceManager,
      query: (querySpec) => {
        const results = this.resourceManager.query(querySpec);
        return results.filter(predicate);
      }
    };
    
    return new CollectionProxy(filteredResourceManager);
  }
}
```

## Best Practices

1. **Always validate ResourceManager interface** in Handle constructor
2. **Use synchronous operations** in ResourceManager for consistency
3. **Enable PrototypeFactory** for rich object interface when schema is available
4. **Cache prototypes** to avoid recreating them
5. **Clean up subscriptions** in destroy() method
6. **Use projection** for creating specialized child handles
7. **Never expose ResourceManager directly** to client code

## Testing Handles

When testing Handles, create mock ResourceManagers with the required interface:

```javascript
function createMockResourceManager(data) {
  return {
    query: (querySpec) => [data],
    subscribe: (querySpec, callback) => ({
      id: Date.now(),
      unsubscribe: () => {}
    }),
    getSchema: () => ({
      type: 'mock',
      properties: {}
    })
  };
}

// Test
const mockRM = createMockResourceManager({ foo: 'bar' });
const handle = new TestHandle(mockRM);
expect(handle.query({})).toEqual([{ foo: 'bar' }]);
```

## Migration Notes

When migrating from old handle patterns:

1. Replace `@legion/data-handle` with `@legion/handle`
2. Remove any direct `this.handleType = 'TypeName'` assignments (it's now a getter)
3. Ensure ResourceManager implements required methods
4. Use projection pattern instead of direct instantiation for child handles
5. Enable PrototypeFactory for schema-based properties