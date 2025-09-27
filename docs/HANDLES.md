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

## Context Handle Delegation Pattern

The Handle pattern supports automatic delegation when handles are stored within other handles, enabling agents to use single expressions to query and update through multiple layers of handles. This is particularly powerful in ExecutionContext where heterogeneous handle types (MongoDB, files, directories, etc.) can be stored and accessed uniformly.

### How Delegation Works

When a handle contains another handle as a value or resource, query and update operations are automatically delegated to the nested handle's own methods:

```javascript
// PathHandle delegation (ContextHandle.js)
query(querySpec) {
  const value = this.value();
  // If value is queryable (has a query method), delegate to it
  if (value && typeof value.query === 'function') {
    return value.query(querySpec);
  }
  // Otherwise apply query to value as data
  // ...
}

// ResourceHandle delegation (ContextHandle.js)
query(querySpec) {
  // If resource is queryable, delegate to it
  if (this.resource && typeof this.resource.query === 'function') {
    return this.resource.query(querySpec);
  }
  // Similar for update operations
}
```

### Single Expression Pattern

Agents can drill through multiple handle layers with a single expression:

```javascript
// Store MongoDB handle in context
const mongoDS = new MongoDBDataSource('mongodb://localhost:27017');
context.set('resources.db', mongoDS.database('myapp'));

// Later, query through multiple layers in one expression
const activeUsers = context
  .resource('db')                    // Get database handle
  .collection('users')                // Get collection handle
  .find({ active: true })            // Query through delegation
  .toArray();                         // Execute query

// Or update deep within a document
context
  .resource('db')
  .collection('users')
  .document(userId)
  .update({ 
    $set: { 'profile.lastLogin': new Date() } 
  });
```

### Heterogeneous Handle Storage

ExecutionContext can store and uniformly access different handle types:

```javascript
// Store various handle types
context.set('resources.database', mongoDS.database('myapp'));
context.set('resources.files', fileSystem.directory('/project'));
context.set('resources.git', gitRepo.handle('/repo'));
context.set('resources.cache', redisHandle);

// Query any resource uniformly
const dbData = context.resource('database').query({ ... });
const files = context.resource('files').query({ pattern: '*.js' });
const branches = context.resource('git').query({ type: 'branches' });

// Delegation works regardless of handle type
context.path('resources.database.users').query({ active: true });
context.path('resources.files.src').query({ extension: '.ts' });
```

### Complex Delegation Chains

The pattern supports arbitrary nesting depth:

```javascript
// Set up nested structure with handles at various levels
context.set('resources.services.userDB', mongoDS.database('users'));
context.set('resources.services.orderDB', mongoDS.database('orders'));

// Query through multiple delegation levels
const userOrders = context
  .path('resources.services')        // Navigate to services
  .resource('orderDB')               // Get order database handle
  .collection('orders')               // Get collection handle
  .find({ userId: currentUserId })   // Query delegated to MongoDB
  .toArray();

// Update through delegation chain
context
  .path('resources.services.userDB.users')
  .document(userId)
  .update({ $inc: { loginCount: 1 } });
```

### Implementation in ContextResourceManager

The ContextResourceManager wraps ExecutionContext to enable this delegation:

```javascript
_queryResource(resourceName, resourceQuery) {
  const resource = this._queryPath(resourceName);
  
  // Check if it's a queryable resource (has query method)
  if (typeof resource.query === 'function') {
    return resource.query(resourceQuery);
  }
  
  // If it's a Handle, use its query method
  if (resource.handleType && typeof resource.query === 'function') {
    return resource.query(resourceQuery);
  }
  
  throw new Error(`Resource ${resourceName} is not queryable`);
}
```

### Benefits for Agents

1. **Uniform Interface**: Agents don't need to know the specific handle type
2. **Composability**: Complex queries can be built from simple parts
3. **Flexibility**: New handle types automatically work with delegation
4. **Clean Code**: Single expressions replace multi-step operations

### Example: Agent Task Execution

```javascript
class Agent {
  async executeTask(task, context) {
    // Agent can access any resource through uniform interface
    
    // Get user from database
    const user = context
      .resource('userDB')
      .collection('users')
      .findOne({ email: task.userEmail });
    
    // Read configuration file
    const config = context
      .resource('files')
      .file('config.json')
      .read();
    
    // Update task status in database
    context
      .resource('taskDB')
      .collection('tasks')
      .document(task.id)
      .update({ 
        $set: { 
          status: 'completed',
          completedBy: user.id,
          completedAt: new Date()
        }
      });
    
    // All operations use the same delegation pattern
  }
}
```

## Migration Notes

When migrating from old handle patterns:

1. Replace `@legion/data-handle` with `@legion/handle`
2. Remove any direct `this.handleType = 'TypeName'` assignments (it's now a getter)
3. Ensure ResourceManager implements required methods
4. Use projection pattern instead of direct instantiation for child handles
5. Enable PrototypeFactory for schema-based properties