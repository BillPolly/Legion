# @legion/data-proxies

Data proxy classes extending Handle base class for universal Actor system integration.

## Overview

This package provides data proxy classes that extend the Handle base class from `@legion/km-data-handle`, enabling universal Actor system integration while providing convenient interfaces for working with DataStore data.

## Architecture

All proxy classes extend the `Handle` base class, which provides:

- **Actor System Integration**: All proxies support `receive()`, `call()`, `query()` methods from Actor base
- **Resource Manager Pattern**: Synchronous data access through ResourceManager interface
- **Lifecycle Management**: Proper subscription cleanup and cascading destruction
- **Error Handling**: Consistent "Handle has been destroyed" error handling

## Proxy Classes

### EntityProxy
Proxy wrapper for individual entities with direct property access.

```javascript
import { EntityProxy, DataStoreResourceManager } from '@legion/data-proxies';

const store = createDataStore(schema);
const resourceManager = new DataStoreResourceManager(store);
const entityProxy = new EntityProxy(resourceManager, entityId);

// Access entity data
const name = entityProxy.get(':user/name');
entityProxy.set(':user/age', 31);
const entityData = entityProxy.value();

// Actor capabilities
const result = await entityProxy.call('someRemoteMethod', params);
```

### CollectionProxy
Proxy wrapper for collections of entities with iteration and filtering.

```javascript
import { CollectionProxy } from '@legion/data-proxies';

const collectionProxy = new CollectionProxy(resourceManager, {
  find: ['?e'],
  where: [['?e', ':user/active', true]],
  entityKey: '?e'
});

// Collection operations
const entities = collectionProxy.value();
const filtered = collectionProxy.filter(e => e[':user/age'] > 25);
const names = collectionProxy.map(e => e[':user/name']);
const alice = collectionProxy.find(e => e[':user/name'] === 'Alice');

// Bulk operations
collectionProxy.updateAll({ ':user/status': 'online' });
collectionProxy.updateWhere(e => e[':user/age'] < 30, { ':user/category': 'young' });

// Individual entity access
const entityProxy = collectionProxy.get(entityId);
```

### StreamProxy
Proxy wrapper for continuous query result streaming.

```javascript
import { StreamProxy } from '@legion/data-proxies';

const streamProxy = new StreamProxy(resourceManager, {
  find: ['?e', '?name'],
  where: [
    ['?e', ':user/active', true],
    ['?e', ':user/name', '?name']
  ]
});

// Stream operations
const results = streamProxy.value(); // Current query results
const filtered = streamProxy.filter(result => result[1].startsWith('A'));

// Subscriptions
const subscription = streamProxy.subscribe((results) => {
  console.log('Stream updated:', results);
});

// Cleanup
subscription.unsubscribe();
```

### DataStoreProxy
Factory for creating and managing different proxy types.

```javascript
import { DataStoreProxy } from '@legion/data-proxies';

const dataStoreProxy = new DataStoreProxy(store);

// Create different proxy types
const entityProxy = dataStoreProxy.entity(entityId);
const collectionProxy = dataStoreProxy.collection(querySpec);
const streamProxy = dataStoreProxy.stream(querySpec);

// Global operations
const subscription = dataStoreProxy.subscribe(querySpec, callback);
const queryResults = dataStoreProxy.query(querySpec);
```

## Resource Manager

### DataStoreResourceManager
Adapter that bridges DataStore to the ResourceManager interface required by Handle.

```javascript
import { DataStoreResourceManager } from '@legion/data-proxies';

const resourceManager = new DataStoreResourceManager(store);

// ResourceManager interface (all synchronous)
const results = resourceManager.query(querySpec);
const subscription = resourceManager.subscribe(querySpec, callback);
const schema = resourceManager.getSchema();
```

**Important**: All ResourceManager operations are synchronous to eliminate race conditions in rapid subscribe/unsubscribe scenarios.

## Cross-Proxy Integration

Different proxy types work together seamlessly:

```javascript
// Entity and Collection integration
const activeUsers = new CollectionProxy(resourceManager, {
  find: ['?e'],
  where: [['?e', ':user/active', true]],
  entityKey: '?e'
});

const aliceEntity = activeUsers.get(aliceId);
aliceEntity.set(':user/status', 'online');
// Collection automatically reflects the change

// Collection and Stream integration
const userStream = new StreamProxy(resourceManager, {
  find: ['?e', '?name'],
  where: [['?e', ':user/name', '?name']]
});

// Both see the same data in different formats
const collectionEntities = activeUsers.value(); // Array of objects
const streamResults = userStream.value(); // Array of tuples
```

## Error Handling

All proxy classes provide consistent error handling:

```javascript
const proxy = new EntityProxy(resourceManager, entityId);
proxy.destroy();

// All operations throw after destruction
try {
  proxy.value();
} catch (error) {
  console.log(error.message); // "Handle has been destroyed"
}
```

## Memory Management

Proper cleanup and cascading destruction:

```javascript
// CollectionProxy cleans up entity proxies
const collection = new CollectionProxy(resourceManager, querySpec);
const entity = collection.get(entityId); // Creates cached entity proxy

collection.destroy(); // Automatically destroys all cached entity proxies
console.log(entity.isDestroyed()); // true
```

## Testing

The package includes comprehensive tests covering:

- Handle inheritance and Actor system integration
- Core proxy functionality
- Cross-proxy interactions
- Memory management and cleanup
- Error handling consistency

```bash
npm test
```

## Dependencies

- `@legion/km-data-handle`: Handle base class and Actor system
- `@legion/data-store`: DataStore implementation
- `@legion/datascript`: DataScript query engine

## Architecture Benefits

1. **Universal Base Functionality**: All proxies share Handle's Actor capabilities
2. **Consistent Interface**: All proxies follow the same lifecycle and error patterns
3. **Actor Integration**: Seamless integration with Legion's actor-based architecture
4. **Memory Safety**: Proper resource cleanup and subscription management
5. **Cross-Proxy Compatibility**: Different proxy types work together harmoniously
6. **Synchronous Dispatch**: Eliminates race conditions in reactive scenarios