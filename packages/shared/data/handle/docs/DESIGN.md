# Handle Package Design

## Overview

The Handle package provides the universal base implementation for all proxy functionality across the Legion framework. It serves as the foundation for proxying monolithic resources with Actor system integration, enabling remote capability sharing between frontend and backend components.

## Core Architecture

### Handle Class

The `Handle` class is the universal abstract base class that inherits from `Actor` to provide remote capability. It implements the **Synchronous Dispatcher Pattern** where all operations are synchronous internally (no `await`, no promises), while appearing asynchronous externally through message passing and callbacks.

```javascript
export class Handle extends Actor {
  constructor(dataSource) {
    super(); // Actor inheritance for remote capability
    this.dataSource = dataSource; // DataSource representative
    this._subscriptions = new Set(); // Synchronous subscription tracking
    this._destroyed = false; // Destruction lifecycle
  }
  
  // Abstract methods - must be implemented by subclasses
  value() // Get current value/data - SYNCHRONOUS
  query(querySpec) // Execute queries - SYNCHRONOUS
  
  // Actor system integration
  receive(message) // Route Actor messages to handle methods
}
```

### DataSource Interface

The DataSource is an **abstract interface contract** that actual data sources must implement. It represents the actual data backend that the Handle proxies, following the conceptual pattern where the Handle is a placeholder that delegates to the DataSource.

**Important**: DataSources are not required to inherit from this interface - they must simply implement the required methods.

```javascript
// Abstract interface - not a class to inherit from
export const DataSourceInterface = {
  // Required methods that all DataSources must implement
  query: (querySpec) => {}, // Execute query synchronously
  subscribe: (querySpec, callback) => {}, // Set up subscription synchronously
  getSchema: () => {}, // Get resource schema for introspection
  
  // Optional methods for enhanced functionality
  update: (updateSpec) => {}, // Update resource data
  validate: (data) => {}, // Validate data against schema
  getMetadata: () => {} // Get resource metadata
};
```

## Key Design Principles

### 1. Synchronous Dispatcher Pattern

**CRITICAL**: All Handle infrastructure operates synchronously - no `await`, no promises internally.

- **External View**: Appears asynchronous through message passing and callbacks
- **Internal View**: Pure synchronous operations prevent race conditions
- **Implementation**: Callbacks are invoked synchronously by the resource manager

```javascript
// CORRECT: Synchronous subscription setup
subscribe(querySpec, callback) {
  // Synchronous validation
  this._validateQuerySpec(querySpec);
  
  // Synchronous DataSource delegation
  const dataSourceSubscription = this.dataSource.subscribe(querySpec, callback);
  
  // Synchronous tracking wrapper creation
  const trackingWrapper = {
    id: dataSourceSubscription.id,
    unsubscribe: () => {
      this._subscriptions.delete(trackingWrapper); // Synchronous cleanup
      dataSourceSubscription.unsubscribe();
    }
  };
  
  // Synchronous tracking addition
  this._subscriptions.add(trackingWrapper);
  return trackingWrapper;
}

// WRONG: Asynchronous patterns in Handle infrastructure
async subscribe(querySpec, callback) { // ❌ NO async in Handle!
  await this.dataSource.subscribe(querySpec, callback); // ❌ NO await!
}
```

### 2. Actor System Integration

Handle inherits from `Actor` to provide remote capability for sharing between frontend and backend:

```javascript
// Actor message routing
receive(message) {
  switch (message.type) {
    case 'query': return this.query(message.querySpec);
    case 'value': return this.value();
    case 'subscribe': return this.subscribe(message.querySpec, message.callback);
    case 'introspect': return this.getIntrospectionInfo();
  }
}
```

### 3. Universal Knowledge Layer

Handles provide introspection capabilities through prototype manufacturing:

- **Schema Analysis**: Extract entity types and relationships from resource schemas
- **Dynamic Prototypes**: Generate entity prototypes at runtime based on schema
- **Introspection API**: Uniform interface for discovering capabilities across all resources

### 4. DataSource Delegation

The Handle is a **placeholder proxy** that delegates all actual work to the DataSource:

- **Handle Role**: Message routing, subscription tracking, lifecycle management, validation
- **DataSource Role**: Actual data access, query execution, schema management
- **Pattern**: Handle receives requests → validates → delegates to DataSource → tracks subscriptions

## Package Structure

```
packages/km/data/handle/
├── package.json                 # Package configuration with Actor dependency
├── src/
│   ├── index.js                # Main exports
│   ├── Handle.js               # Universal Handle base class
│   ├── DataSource.js           # Abstract DataSource interface
│   ├── PrototypeFactory.js     # Universal knowledge layer
│   ├── CachedHandle.js         # Caching patterns and utilities
│   └── ValidationUtils.js      # Common validation utilities
├── docs/
│   ├── DESIGN.md              # This file - overall design
│   ├── ARCHITECTURE.md        # Technical architecture details
│   └── IMPLEMENTATION_GUIDE.md # Implementation guidance for subclasses
└── __tests__/
    ├── unit/                   # Unit tests for each component
    └── integration/            # Integration tests with Actor system
```

## Usage Patterns

### 1. Creating a Handle Subclass

```javascript
import { Handle } from '@legion/km-data-handle';

export class DataStoreHandle extends Handle {
  constructor(dataSource) {
    super(dataSource); // Validates DataSource interface
    this._enablePrototypeFactory(dataSource.getSchema());
  }
  
  // Required implementation
  value() {
    // Return current data from DataSource
    return this.dataSource.query({ find: ['?e', '?a', '?v'] });
  }
  
  // Required implementation  
  query(querySpec) {
    this._validateQuerySpec(querySpec);
    return this.dataSource.query(querySpec);
  }
}
```

### 2. Implementing a DataSource

```javascript
// DataSource implementation - does NOT need to inherit from anything
export class DataScriptDataSource {
  constructor(database) {
    this.database = database;
  }
  
  // Required: Implement DataSource interface
  query(querySpec) {
    return this.database.q(querySpec.find, this.database.db, ...querySpec.where);
  }
  
  subscribe(querySpec, callback) {
    return this.database.subscribe(querySpec, callback);
  }
  
  getSchema() {
    return this.database.schema;
  }
  
  // Optional: Additional capabilities
  update(updateSpec) {
    return this.database.transact(updateSpec);
  }
}
```

### 3. Actor System Usage

```javascript
// Frontend/Backend sharing through Actor system
const handle = new DataStoreHandle(dataSource);

// Local usage
const results = handle.query({ find: ['?e'], where: [['?e', ':user/name', 'John']] });

// Remote usage through Actor system
const remoteResults = await handle.receive({
  type: 'query',
  querySpec: { find: ['?e'], where: [['?e', ':user/name', 'John']] }
});
```

## Key Benefits

### 1. Universal Pattern
- **Consistency**: Same interface and patterns across all resource types
- **Interoperability**: Handles can work with any DataSource implementation
- **Extensibility**: Easy to add new resource types by implementing DataSource interface

### 2. Remote Capability
- **Actor Integration**: Inherits from Actor for seamless frontend/backend sharing
- **Message Routing**: Standardized message handling across all Handle types
- **Network Transparency**: Same API works locally and remotely

### 3. Synchronous Dispatcher
- **No Race Conditions**: Synchronous operations eliminate timing issues
- **Predictable Behavior**: Sequential execution model matches JavaScript's nature
- **Performance**: No await overhead in proxy infrastructure

### 4. Universal Introspection
- **Schema Discovery**: Automatic analysis of resource schemas
- **Dynamic Capabilities**: Runtime discovery of available operations
- **Consistent API**: Same introspection interface across all resource types

## Implementation Requirements

### For Handle Subclasses

1. **Must inherit from Handle**: Ensures Actor integration and common patterns
2. **Must implement value()**: Synchronous method to get current data
3. **Must implement query()**: Synchronous method to execute queries
4. **Should call super() in constructor**: Ensures proper initialization
5. **Should validate DataSource**: Use inherited validation or extend it

### For DataSource Implementations

1. **Must implement query()**: Execute queries synchronously
2. **Must implement subscribe()**: Set up subscriptions synchronously  
3. **Must implement getSchema()**: Return resource schema for introspection
4. **Should implement update()**: Enable data modification capabilities
5. **Should be stateless**: Avoid internal state to prevent synchronization issues

### For Both

1. **No async/await**: All operations must be synchronous in Handle infrastructure
2. **Fail fast**: Throw errors immediately, no fallbacks or retries
3. **Validate inputs**: Use provided validation utilities or extend them
4. **Clean lifecycle**: Proper subscription tracking and cleanup

## Migration Path

Existing proxy implementations can be migrated incrementally:

1. **Extract DataSource**: Move data access logic to DataSource implementation
2. **Inherit from Handle**: Replace existing base class with Handle
3. **Remove async**: Convert async operations to synchronous dispatcher pattern
4. **Add Actor support**: Implement receive() method for remote capability
5. **Enable introspection**: Use PrototypeFactory for universal knowledge layer

## Testing Strategy

- **Unit Tests**: Test each Handle method independently with mock DataSources
- **Integration Tests**: Test with real DataSource implementations
- **Actor Tests**: Verify remote capability through Actor message passing
- **Synchronous Tests**: Ensure no async operations in Handle infrastructure
- **Lifecycle Tests**: Verify proper subscription cleanup and destruction

This design provides a universal, Actor-integrated foundation for all proxy functionality while maintaining the synchronous dispatcher pattern and enabling comprehensive introspection capabilities.