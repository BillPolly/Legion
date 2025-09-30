# RemoteHandle Design Document

## Overview

RemoteHandle provides transparent remote access to Handle resources across Actor channels. When a Handle is sent through an Actor channel, the receiving side gets a RemoteHandle that looks and behaves identically to the original Handle, but all operations proxy through the Actor communication layer.

This enables seamless resource sharing between client and server without changing Handle interface or usage patterns.

## Core Concept

**A RemoteHandle is both a Handle AND its own DataSource.**

When you access properties or call methods on a RemoteHandle, it:
1. Uses the PrototypeFactory to provide native property access (no Proxy overhead)
2. All property getters/setters delegate to DataSource methods
3. DataSource methods proxy through Actor channel to the server
4. Server's real Handle executes the operation and sends results back

```javascript
// Server side
const imageHandle = new ImageHandle(imageDataSource);
serverActor.send(imageHandle); // Serializes as {'#actorGuid': 'img-123'}

// Client side - receives RemoteHandle
const remoteImage = clientReceives; // RemoteHandle wrapping server's ImageHandle

// Property access works identically
const metadata = remoteImage.metadata;  // Proxies to server
remoteImage.title = "New Title";        // Proxies update to server

// Projection works identically
const thumbnail = remoteImage.thumbnail(); // Creates local Handle using RemoteHandle as DataSource
```

## Architecture

### Component Structure

```
RemoteHandle (extends Handle)
  ├── Implements DataSource interface (query, subscribe, getSchema, queryBuilder)
  ├── Passes self as DataSource: super(this)
  ├── All DataSource methods proxy through Actor channel
  └── PrototypeFactory manufactures properties based on schema
```

### Class Hierarchy

```
Actor (base for remote capability)
  ↓
Handle (universal proxy base)
  ↓
RemoteHandle (Handle that IS its own DataSource)
```

### Key Properties

- **self-referential**: `super(this)` - RemoteHandle is its own DataSource
- **stateless**: No local data cache, all queries go to server
- **typed**: Receives schema from serialization, enables PrototypeFactory
- **projectable**: Supports all Handle query combinators and projections

## Serialization Flow

### Critical Serialization Order

**ActorSerializer must check `isActor` BEFORE checking `serialize()` to properly handle Handles:**

```javascript
// In ActorSerializer.serialize() - CORRECTED ORDER
if (value?.isActor === true) {
  // Generate GUID and register in ActorSpace
  let guid = this.actorSpace.objectToGuid.get(value);
  if (!guid) {
    guid = this.actorSpace._generateGuid();
    this.actorSpace.objectToGuid.set(value, guid);
    this.actorSpace.guidToObject.set(guid, value);
  }

  // Check if Actor has custom serialization (like Handle)
  if (typeof value.serialize === 'function') {
    const customData = value.serialize();
    // Merge Actor GUID with custom serialization
    return {
      '#actorGuid': guid,
      ...customData
    };
  }

  // Standard Actor serialization
  return { '#actorGuid': guid };
}
```

### Server Side Serialization

1. Server has real Handle (e.g., ImageHandle) with real DataSource
2. ActorSerializer detects Handle is an Actor (`isActor: true`)
3. ActorSerializer generates GUID and registers Handle in ActorSpace
4. ActorSerializer calls Handle.serialize() for custom metadata
5. Final serialization merges GUID with Handle metadata:

```javascript
{
  '#actorGuid': 'server-123',           // Added by ActorSerializer
  __type: 'RemoteHandle',               // From Handle.serialize()
  handleType: 'ImageHandle',            // From Handle.serialize()
  schema: { /* schema object */ },      // From Handle.serialize()
  capabilities: ['query', 'update', 'subscribe']  // From Handle.serialize()
}
```

**Key Point**: Handle.serialize() returns metadata WITHOUT the GUID. ActorSerializer adds the GUID.

### Handle.serialize() Implementation

```javascript
// In Handle.js
serialize() {
  this._validateNotDestroyed();

  // Get schema from DataSource
  const schema = this.dataSource.getSchema();

  // Determine capabilities
  const capabilities = ['query', 'subscribe', 'getSchema', 'queryBuilder'];
  if (typeof this.dataSource.update === 'function') {
    capabilities.push('update');
  }

  return {
    __type: 'RemoteHandle',
    handleType: this.handleType,
    schema: schema,
    capabilities: capabilities
  };
}
```

### Client Side Deserialization

1. ActorSerializer receives serialized data with both `'#actorGuid'` and `__type: 'RemoteHandle'`
2. Detects this is a RemoteHandle (not a generic RemoteActor)
3. Creates RemoteHandle instance with GUID, channel, and metadata
4. Registers RemoteHandle in ActorSpace with GUID
5. RemoteHandle constructor enables PrototypeFactory with schema
6. Client code receives fully-functional RemoteHandle

```javascript
// In ActorSerializer.deserialize() - UPDATED
const reviver = (key, value) => {
  if (typeof value === 'object' && value !== null) {
    // Check for Actor GUID (standard Actor deserialization)
    if (value.hasOwnProperty('#actorGuid')) {
      const guid = value['#actorGuid'];
      const existingObj = this.actorSpace.guidToObject.get(guid);

      if (existingObj) {
        return existingObj;
      }

      // Check if this is a RemoteHandle
      if (value.__type === 'RemoteHandle') {
        // Create RemoteHandle with all metadata
        const remoteHandle = new RemoteHandle(guid, channel, {
          handleType: value.handleType,
          schema: value.schema,
          capabilities: value.capabilities
        });

        // Register in ActorSpace
        this.actorSpace.guidToObject.set(guid, remoteHandle);
        this.actorSpace.objectToGuid.set(remoteHandle, guid);

        return remoteHandle;
      }

      // Standard RemoteActor for non-Handle Actors
      return this.actorSpace.makeRemote(guid, channel);
    }
  }
  return value;
};
```

## DataSource Implementation

RemoteHandle implements the complete DataSource interface:

### query(querySpec)

```javascript
query(querySpec) {
  // Send query message to server's Handle
  return this._callRemote('query', querySpec);
}
```

**Flow:**
1. Client calls `remoteHandle.query({find: ['?value'], where: [...]})`
2. RemoteHandle sends Actor message: `{targetGuid: 'server-123', payload: ['query', querySpec]}`
3. Server's ActorSpace routes to original Handle
4. Handle executes query on real DataSource
5. Result sent back through channel
6. RemoteHandle resolves promise with result

### subscribe(querySpec, callback)

```javascript
subscribe(querySpec, callback) {
  // Setup subscription through server
  const subscriptionId = this._generateSubscriptionId();

  // Store callback for incoming updates
  this._subscriptions.set(subscriptionId, callback);

  // Send subscribe message to server
  this._callRemote('subscribe', {
    subscriptionId,
    querySpec
  });

  // Return unsubscribe handle
  return {
    id: subscriptionId,
    unsubscribe: () => this._unsubscribe(subscriptionId)
  };
}
```

**Flow:**
1. Client subscribes to changes
2. Server's Handle creates real subscription
3. When data changes, server sends 'subscription-update' message
4. RemoteHandle routes to registered callback
5. Client callback invoked with change data

### getSchema()

```javascript
getSchema() {
  // Return cached schema from serialization
  return this._schema;
}
```

Schema is sent during serialization, cached locally, no round-trip needed.

### queryBuilder(sourceHandle)

```javascript
queryBuilder(sourceHandle) {
  // Return query builder that works with RemoteHandle as DataSource
  return new DefaultQueryBuilder(this, sourceHandle);
}
```

Standard query builder, all operations eventually call `this.query()` which proxies to server.

### update(updateSpec)

```javascript
update(updateSpec) {
  // Send update message to server's Handle
  return this._callRemote('update', updateSpec);
}
```

Optional method, only if server Handle supports updates.

## Remote Communication Pattern

### Request/Response Pattern

RemoteHandle uses promise-based request/response for method calls:

```javascript
_callRemote(method, ...args) {
  const callId = this._generateCallId();

  // Create promise for this call
  const promise = new Promise((resolve, reject) => {
    this._pendingCalls.set(callId, { resolve, reject });
  });

  // Send message through Actor channel
  this._channel.send(this.actorGuid, {
    type: 'remote-call',
    callId,
    method,
    args
  });

  return promise;
}

_handleResponse(response) {
  const { callId, result, error } = response;
  const pending = this._pendingCalls.get(callId);

  if (pending) {
    this._pendingCalls.delete(callId);
    if (error) {
      pending.reject(new Error(error));
    } else {
      pending.resolve(result);
    }
  }
}
```

### Subscription Pattern

Subscriptions use push-based updates:

```javascript
// Server sends updates
serverHandle.notifySubscribers(subscriptionId, changes);
  ↓
// Actor message: {type: 'subscription-update', subscriptionId, changes}
  ↓
// RemoteHandle receives and routes
remoteHandle._handleSubscriptionUpdate(subscriptionId, changes);
  ↓
// Callback invoked
callback(changes);
```

## PrototypeFactory Integration

RemoteHandle fully integrates with PrototypeFactory for native property access:

```javascript
class RemoteHandle extends Handle {
  constructor(actorGuid, channel, serializedData) {
    // RemoteHandle IS its own DataSource
    super(this); // Pass self as DataSource!

    this.actorGuid = actorGuid;
    this._channel = channel;
    this._schema = serializedData.schema;
    this.handleType = serializedData.handleType;

    // Enable PrototypeFactory with schema
    if (this._schema) {
      this._enablePrototypeFactory(this._schema);
    }
  }

  // Implement DataSource interface
  query(querySpec) { /* proxy to server */ }
  subscribe(querySpec, callback) { /* proxy to server */ }
  getSchema() { return this._schema; }
  queryBuilder(sourceHandle) { /* return builder */ }
}
```

### Property Access Flow

```javascript
// Server schema defines 'title' attribute
schema: {
  attributes: {
    title: { type: 'string', fullName: ':image/title' }
  }
}

// PrototypeFactory manufactures property:
Object.defineProperty(RemoteImageHandle.prototype, 'title', {
  get() {
    // Calls RemoteHandle.query()
    const results = this.dataSource.query({
      find: ['?value'],
      where: [[this.entityId, ':image/title', '?value']]
    });
    return results[0]?.[0];
  },
  set(value) {
    // Calls RemoteHandle.update()
    this.dataSource.update({
      entityId: this.entityId,
      attribute: ':image/title',
      value
    });
  }
});

// Usage - no Proxy overhead, just property access!
remoteImage.title           // → getter → dataSource.query() → Actor message
remoteImage.title = "New"   // → setter → dataSource.update() → Actor message
```

## Handle Projection

RemoteHandle supports all Handle query combinators and projections:

```javascript
// Create RemoteHandle
const remoteDataStore = /* received from server */;

// Project to entity - creates EntityProxy with RemoteHandle as DataSource
const remoteUser = remoteDataStore.entity(123);

// Query combinators work identically
const activeUsers = remoteDataStore
  .where(user => user.status === 'active')
  .orderBy('name')
  .limit(10);

// All operations proxy through RemoteHandle.query() to server
const users = activeUsers.toArray();
```

### Projection Flow

1. `remoteDataStore.entity(123)` called
2. Creates `EntityProxy(remoteDataStore.dataSource, 123)`
3. But `remoteDataStore.dataSource === remoteDataStore` (self-referential)
4. EntityProxy uses RemoteHandle's DataSource methods
5. All EntityProxy operations proxy to server through RemoteHandle

## ActorSerializer Integration

### Serialization Hook

```javascript
// In ActorSerializer.serialize()
if (typeof value.serialize === 'function') {
  const serialized = value.serialize();
  return serialized; // Returns {__type: 'RemoteHandle', ...}
}
```

### Deserialization Hook

```javascript
// In ActorSerializer.deserialize()
if (value.__type === 'RemoteHandle') {
  const { actorGuid, handleType, schema, capabilities } = value;

  // Create RemoteHandle
  const remoteHandle = new RemoteHandle(actorGuid, channel, {
    handleType,
    schema,
    capabilities
  });

  // Register in ActorSpace for message routing
  actorSpace.register(remoteHandle, actorGuid);

  return remoteHandle;
}
```

## Server-Side Handle Protocol

Server Handles need minimal changes to support RemoteHandle:

### Message Handling

```javascript
class Handle extends Actor {
  receive(message) {
    if (typeof message === 'object' && message.type === 'remote-call') {
      const { callId, method, args } = message;

      try {
        // Execute method on real DataSource
        const result = this.dataSource[method](...args);

        // Send response back
        return {
          type: 'remote-response',
          callId,
          result
        };
      } catch (error) {
        return {
          type: 'remote-response',
          callId,
          error: error.message
        };
      }
    }

    return super.receive(message);
  }
}
```

### Subscription Updates

```javascript
class Handle extends Actor {
  _notifySubscription(subscriptionId, changes) {
    if (this._remoteSubscriptions.has(subscriptionId)) {
      // Send update through Actor channel
      this._channel.send(this._remoteActorGuid, {
        type: 'subscription-update',
        subscriptionId,
        changes
      });
    }
  }
}
```

## Error Handling

### Network Errors

```javascript
_callRemote(method, ...args) {
  return new Promise((resolve, reject) => {
    // Timeout for network issues
    const timeout = setTimeout(() => {
      this._pendingCalls.delete(callId);
      reject(new Error(`Remote call timeout: ${method}`));
    }, 30000);

    this._pendingCalls.set(callId, {
      resolve: (result) => {
        clearTimeout(timeout);
        resolve(result);
      },
      reject: (error) => {
        clearTimeout(timeout);
        reject(error);
      }
    });

    // Send message
    this._channel.send(this.actorGuid, {...});
  });
}
```

### Server Errors

Server exceptions are serialized and re-thrown on client:

```javascript
// Server
try {
  const result = this.dataSource.query(querySpec);
  return { callId, result };
} catch (error) {
  return {
    callId,
    error: error.message,
    errorType: error.constructor.name
  };
}

// Client
if (response.error) {
  const ErrorClass = this._getErrorClass(response.errorType);
  pending.reject(new ErrorClass(response.error));
}
```

## Performance Considerations

### Schema Caching

Schema sent once during serialization, cached locally:
- No round-trip for `getSchema()` calls
- PrototypeFactory can manufacture prototypes immediately
- Enables synchronous property introspection

### Batch Operations

For multiple queries, use batch protocol:

```javascript
async queryBatch(queries) {
  return this._callRemote('batch-query', queries);
}

// Server processes all queries in single round-trip
```

### Subscription Optimization

Server can batch subscription updates:

```javascript
// Instead of one message per change
subscription-update: { subscriptionId, changes: [change1] }
subscription-update: { subscriptionId, changes: [change2] }

// Batch multiple changes
subscription-update: { subscriptionId, changes: [change1, change2, change3] }
```

## Use Cases

### ShowMe Module

```javascript
// Server creates asset handle
const imageHandle = new ImageHandle(imageDataSource);
serverActor.send('display-asset', { asset: imageHandle });

// Client receives RemoteHandle
clientActor.receive('display-asset', ({ asset }) => {
  // asset is RemoteHandle wrapping server's ImageHandle

  // Property access works transparently
  const title = asset.title;
  const metadata = asset.metadata;

  // Display in UI
  displayImage(asset);
});
```

### Resource Sharing

```javascript
// Server exposes file handle
const fileHandle = fileSystem.file('/path/to/file.txt');
response.send({ file: fileHandle });

// Client receives RemoteHandle
const remoteFile = response.file;

// Read content
const content = await remoteFile.read();

// Watch for changes
remoteFile.subscribe({ type: 'content' }, (changes) => {
  console.log('File changed:', changes);
});
```

### DataStore Access

```javascript
// Server shares entire datastore
const dataStore = new DataStoreProxy(store);
client.send({ dataStore });

// Client gets remote datastore
const remoteDataStore = message.dataStore;

// Query works identically
const users = remoteDataStore
  .where(u => u.active)
  .toArray();

// Entity access works identically
const user = remoteDataStore.entity(123);
user.name = "New Name"; // Proxies update to server
```

## Implementation Files

### Core Files

- `RemoteHandle.js` - Main RemoteHandle class
- `RemoteCallManager.js` - Manages pending calls and responses
- `RemoteSubscriptionManager.js` - Manages subscriptions and updates

### Integration Files

- Updates to `ActorSerializer.js` - Deserialize RemoteHandle
- Updates to `Handle.js` - Support remote-call messages

### Test Files

- `RemoteHandle.test.js` - Unit tests
- `RemoteHandle.integration.test.js` - Integration tests with Actor channels
- `RemoteHandle.projection.test.js` - Test Handle projections
- `RemoteHandle.subscription.test.js` - Test subscriptions

## Migration Path

### Phase 1: Core Implementation
- Implement RemoteHandle class
- Implement RemoteCallManager
- Update ActorSerializer

### Phase 2: Handle Protocol
- Update Handle.receive() for remote-call messages
- Add subscription update support

### Phase 3: Testing
- Unit tests for RemoteHandle
- Integration tests with mock channels
- E2E tests with real Actor channels

### Phase 4: ShowMe Integration
- Replace AssetHandle with RemoteHandle pattern
- Update ShowMeServerActor to send Handles
- Update ShowMeClientActor to receive RemoteHandles
- Visual tests with actual browser display

## Benefits

1. **Transparent**: Client code doesn't know Handle is remote
2. **Type-safe**: Full schema support with PrototypeFactory
3. **Performant**: Native property access, no Proxy overhead
4. **Universal**: Works with any Handle type
5. **Consistent**: Same API for local and remote Handles
6. **Projectable**: Full support for Handle query combinators
7. **Subscribable**: Real-time updates through subscriptions

## Future Enhancements

- **Caching Layer**: Optional local cache for query results
- **Optimistic Updates**: Client-side updates with server reconciliation
- **Batch Protocol**: Batch multiple operations into single round-trip
- **Compression**: Compress large result sets
- **Partial Loading**: Stream large results progressively