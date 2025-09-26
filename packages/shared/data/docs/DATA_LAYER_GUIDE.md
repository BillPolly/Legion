# Legion Data Layer - Complete Guide

## Overview

The Legion Data Layer provides a sophisticated, unified approach to data management across the entire Legion framework. Built on reactive programming principles, immutable data structures, and the Actor model, it enables seamless data access whether you're working in the browser, Node.js, or distributed systems.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Packages](#core-packages)
3. [Key Concepts](#key-concepts)
4. [Getting Started](#getting-started)
5. [Usage Patterns](#usage-patterns)
6. [Advanced Topics](#advanced-topics)
7. [Integration Guide](#integration-guide)
8. [Best Practices](#best-practices)
9. [API Reference](#api-reference)

## Architecture Overview

The data layer follows a layered architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────┐
│                    Application Layer                     │
│         (Your application code using the APIs)           │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                      DSL Layer                          │
│         (handle-dsl: Natural language queries)           │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                     Proxy Layer                         │
│    (data-proxies: EntityProxy, CollectionProxy, etc)     │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                     Handle Layer                        │
│    (handle: Universal proxy pattern with Actor model)    │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                   Data Store Layer                      │
│    (data-store: Reactive DataScript with subscriptions)  │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                   DataScript Layer                      │
│       (datascript: Immutable database with Datalog)      │
└─────────────────────────────────────────────────────────┘
```

## Core Packages

### 1. `datascript` - Immutable Database Engine
The foundational layer providing an immutable, in-memory database with Datalog query capabilities.

**Key Features:**
- Immutable data structures with structural sharing
- Powerful Datalog query language
- Transaction log and time-travel capabilities
- Schema validation and entity relationships
- Change tracking and reactive updates

### 2. `data-store` - Reactive Data Management
Builds on DataScript to provide reactive data management with subscriptions and schema evolution.

**Key Features:**
- Reactive subscriptions to data changes
- Dynamic schema evolution
- Transaction coordination
- Optimistic updates and conflict resolution
- Integration with the Actor system

### 3. `handle` - Universal Proxy Pattern
Implements the Handle pattern - a universal abstraction for proxying any resource type.

**Key Features:**
- Actor system integration for distributed access
- Synchronous dispatcher pattern (no async/await needed)
- Lifecycle management and cleanup
- Universal introspection capabilities
- Extensible for any resource type

### 4. `data-proxies` - Convenient Data Access
Provides high-level proxy objects for intuitive data manipulation.

**Key Features:**
- EntityProxy - Individual entity access with property syntax
- CollectionProxy - Collection operations with iteration
- StreamProxy - Continuous query results
- DataStoreProxy - Factory for creating proxies
- Automatic change propagation

### 5. `handle-dsl` - Natural Language Queries
A template literal DSL for expressing queries and updates in natural language.

**Key Features:**
- Intuitive query syntax using template literals
- Schema definition in natural language
- Update operations with relationship management
- Type-safe with schema validation
- Works with any Handle implementation

### 6. `filesystem` - File System Abstractions
Unified file system API that works across different environments.

**Key Features:**
- DirectoryHandle and FileHandle abstractions
- Pluggable ResourceManager backends
- Same API for Node.js, browser, or remote systems
- File watching and search capabilities
- Actor-based remote file system access

## Key Concepts

### 1. The Handle Pattern

Handles are universal proxies that provide a consistent interface for any resource type:

```javascript
// All Handles follow this pattern
class MyHandle extends Handle {
  // Get current value - MUST be synchronous
  value() {
    return this.dataSource.query({ /* ... */ });
  }
  
  // Execute queries - MUST be synchronous
  query(querySpec) {
    return this.dataSource.query(querySpec);
  }
  
  // Subscribe to changes - MUST be synchronous
  subscribe(querySpec, callback) {
    return this.dataSource.subscribe(querySpec, callback);
  }
}
```

**Critical Rule:** All Handle operations are synchronous. No `async/await` or Promises!

### 2. DataSource Interface

Every Handle is backed by a DataSource that implements:

```javascript
interface DataSource {
  // Execute a query synchronously
  query(querySpec): any;
  
  // Subscribe to changes synchronously
  subscribe(querySpec, callback): Subscription;
  
  // Get schema for introspection (optional)
  getSchema(): Schema | null;
}
```

### 3. Reactive Subscriptions

The system uses synchronous subscriptions for reactive updates:

```javascript
// Subscribe to entity changes
const subscription = entity.subscribe((changes) => {
  console.log('Entity changed:', changes);
});

// Clean up when done
subscription.unsubscribe();
```

### 4. Schema Evolution

Schemas can evolve dynamically at runtime:

```javascript
const evolution = new SchemaEvolution(store);

// Add new attribute
evolution.addAttribute('user/email', {
  type: 'string',
  cardinality: 'one',
  unique: true
});

// Rename attribute
evolution.renameAttribute('user/name', 'user/fullName');
```

## Getting Started

### Basic Setup

```javascript
import { createDataStore } from '@legion/data-store';
import { DataStoreProxy } from '@legion/data-proxies';

// Define schema
const schema = {
  'user/name': { type: 'string' },
  'user/email': { type: 'string', unique: true },
  'user/age': { type: 'number' },
  'user/friends': { type: 'ref', cardinality: 'many' }
};

// Create data store
const store = createDataStore(schema);

// Create proxy for convenient access
const db = new DataStoreProxy(store);
```

### Creating and Updating Entities

```javascript
// Create an entity
const userId = db.add({
  'user/name': 'Alice',
  'user/email': 'alice@example.com',
  'user/age': 30
});

// Get entity proxy
const user = db.entity(userId);

// Update using property syntax
user.name = 'Alice Smith';
user.age = 31;

// Access properties
console.log(user.name); // "Alice Smith"
console.log(user.age);  // 31
```

### Querying with DSL

```javascript
import { query, update } from '@legion/handle-dsl';

// Natural language queries
const adults = query`
  find all users 
  where age >= 18
  return name, email
`;

const results = db.query(adults);

// Updates with DSL
const updateOp = update`
  for user with email = "alice@example.com"
  set age = 32
  add friend ${friendId}
`;

db.update(updateOp);
```

### Working with Collections

```javascript
// Get collection proxy
const users = db.collection('user');

// Iterate over entities
for (const user of users) {
  console.log(user.name);
}

// Filter collection
const adults = users.filter(u => u.age >= 18);

// Map over collection
const names = users.map(u => u.name);

// Bulk update
users.update({ active: true });
```

### Reactive Subscriptions

```javascript
// Subscribe to specific entity
const userSub = user.subscribe((changes) => {
  console.log('User changed:', changes);
});

// Subscribe to collection
const collectionSub = users.subscribe((changes) => {
  console.log('Collection changed:', changes);
});

// Subscribe to query results
const stream = db.stream(query`
  find all users where age >= 18
`);

stream.subscribe((results) => {
  console.log('Query results updated:', results);
});

// Clean up subscriptions
userSub.unsubscribe();
collectionSub.unsubscribe();
stream.destroy();
```

## Usage Patterns

### 1. Entity-Centric Pattern

Best for working with individual entities:

```javascript
const user = db.entity(userId);
user.name = 'New Name';
user.email = 'new@email.com';

// Navigate relationships
const friends = user.friends; // Returns CollectionProxy
for (const friend of friends) {
  console.log(friend.name);
}
```

### 2. Collection-Centric Pattern

Best for bulk operations:

```javascript
const users = db.collection('user');

// Bulk update
users.filter(u => u.age < 18).update({ status: 'minor' });

// Aggregations
const avgAge = users.reduce((sum, u) => sum + u.age, 0) / users.length;
```

### 3. Query-Centric Pattern

Best for complex queries:

```javascript
const results = db.query({
  find: ['?user', '?name', '?email'],
  where: [
    ['?user', 'user/age', '?age'],
    ['?age', '>=', 18],
    ['?user', 'user/name', '?name'],
    ['?user', 'user/email', '?email']
  ]
});
```

### 4. Stream-Centric Pattern

Best for real-time updates:

```javascript
const activeUsers = db.stream(query`
  find all users 
  where status = "active"
  order by lastSeen desc
  limit 10
`);

activeUsers.subscribe((users) => {
  updateUI(users);
});
```

## Advanced Topics

### 1. Actor System Integration

Handles inherit from Actor, enabling distributed access:

```javascript
// Server side
class UserServiceActor extends Actor {
  constructor() {
    super();
    this.store = createDataStore(schema);
    this.proxy = new DataStoreProxy(this.store);
  }
  
  receive(message) {
    if (message.type === 'getUser') {
      const user = this.proxy.entity(message.userId);
      return user.value();
    }
  }
}

// Client side
const userService = await Actor.lookup('UserService');
const userData = await userService.call({
  type: 'getUser',
  userId: 123
});
```

### 2. Custom Handle Types

Create specialized Handles for domain objects:

```javascript
class UserHandle extends Handle {
  constructor(dataSource, userId) {
    super(dataSource);
    this.userId = userId;
  }
  
  value() {
    return this.dataSource.query({
      find: ['?user'],
      where: [['?user', ':db/id', this.userId]],
      return: 'entity'
    })[0];
  }
  
  // Domain-specific methods
  addFriend(friendId) {
    this.dataSource.update({
      id: this.userId,
      'user/friends': { add: friendId }
    });
  }
  
  getFriends() {
    const user = this.value();
    return user['user/friends'] || [];
  }
}
```

### 3. Schema Validation and Evolution

```javascript
// Define schema with validation
const schema = {
  'user/email': {
    type: 'string',
    validate: (value) => {
      if (!value.includes('@')) {
        throw new Error('Invalid email format');
      }
    }
  },
  'user/age': {
    type: 'number',
    validate: (value) => {
      if (value < 0 || value > 150) {
        throw new Error('Invalid age');
      }
    }
  }
};

// Evolve schema at runtime
const evolution = new SchemaEvolution(store);

// Add computed attribute
evolution.addComputedAttribute('user/displayName', {
  compute: (entity) => {
    return `${entity['user/name']} (${entity['user/age']})`;
  }
});
```

### 4. Transaction Coordination

```javascript
// Batch multiple operations in a transaction
store.transact([
  { 
    'user/name': 'Alice',
    'user/email': 'alice@example.com'
  },
  {
    'user/name': 'Bob',
    'user/email': 'bob@example.com'
  }
]);

// Transaction with metadata
store.transact(
  [/* operations */],
  { 
    metadata: { 
      timestamp: Date.now(),
      source: 'import'
    }
  }
);
```

### 5. File System Integration

```javascript
import { createLocalFileSystem } from '@legion/filesystem';

// Create file system handle
const fs = createLocalFileSystem({ 
  rootPath: '/home/user/project' 
});

// Navigate directories
const srcDir = fs.directory('src');
const componentsDir = srcDir.directory('components');

// Work with files
const configFile = fs.file('config.json');
const config = JSON.parse(configFile.text());

// Watch for changes
configFile.watch((changes) => {
  console.log('Config file changed:', changes);
  reloadConfig();
});

// Search files
const jsFiles = srcDir.search('*.js', { recursive: true });
```

## Integration Guide

### 1. With ResourceManager

The ResourceManager provides centralized resource access:

```javascript
import { ResourceManager } from '@legion/resource-manager';

class AppResourceManager extends ResourceManager {
  async initialize() {
    // Create data store
    this.dataStore = createDataStore(schema);
    
    // Register with resource manager
    this.register('dataStore', this.dataStore);
    
    // Create proxy
    this.db = new DataStoreProxy(this.dataStore);
    this.register('db', this.db);
  }
  
  // Implement DataSource interface
  query(querySpec) {
    return this.dataStore.query(querySpec);
  }
  
  subscribe(querySpec, callback) {
    return this.dataStore.subscribe(querySpec, callback);
  }
}

// Usage
const rm = new AppResourceManager();
await rm.initialize();

const db = rm.get('db');
const users = db.collection('user');
```

### 2. With React

Create React hooks for reactive data:

```javascript
import { useState, useEffect } from 'react';

function useEntity(entityId) {
  const [entity, setEntity] = useState(null);
  
  useEffect(() => {
    const db = getDataStore();
    const entityProxy = db.entity(entityId);
    
    // Set initial value
    setEntity(entityProxy.value());
    
    // Subscribe to changes
    const sub = entityProxy.subscribe((changes) => {
      setEntity(entityProxy.value());
    });
    
    return () => sub.unsubscribe();
  }, [entityId]);
  
  return entity;
}

// Usage in component
function UserProfile({ userId }) {
  const user = useEntity(userId);
  
  if (!user) return <div>Loading...</div>;
  
  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}
```

### 3. With WebSockets

Stream data changes over WebSockets:

```javascript
// Server
class DataStreamServer {
  constructor(store) {
    this.store = store;
    this.clients = new Map();
  }
  
  handleConnection(ws) {
    ws.on('message', (msg) => {
      const { type, querySpec, id } = JSON.parse(msg);
      
      if (type === 'subscribe') {
        const sub = this.store.subscribe(querySpec, (changes) => {
          ws.send(JSON.stringify({
            type: 'update',
            id,
            changes
          }));
        });
        
        this.clients.set(id, sub);
      }
      
      if (type === 'unsubscribe') {
        const sub = this.clients.get(id);
        if (sub) {
          sub.unsubscribe();
          this.clients.delete(id);
        }
      }
    });
  }
}

// Client
class DataStreamClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.subscriptions = new Map();
  }
  
  subscribe(querySpec, callback) {
    const id = generateId();
    
    this.subscriptions.set(id, callback);
    
    this.ws.send(JSON.stringify({
      type: 'subscribe',
      querySpec,
      id
    }));
    
    return {
      unsubscribe: () => {
        this.ws.send(JSON.stringify({
          type: 'unsubscribe',
          id
        }));
        this.subscriptions.delete(id);
      }
    };
  }
}
```

## Best Practices

### 1. Handle Lifecycle Management

Always clean up subscriptions and destroy Handles:

```javascript
class Component {
  constructor() {
    this.subscriptions = [];
    this.handles = [];
  }
  
  initialize() {
    const user = db.entity(userId);
    this.handles.push(user);
    
    const sub = user.subscribe(this.handleChange.bind(this));
    this.subscriptions.push(sub);
  }
  
  cleanup() {
    // Unsubscribe all
    this.subscriptions.forEach(s => s.unsubscribe());
    
    // Destroy handles
    this.handles.forEach(h => h.destroy());
  }
}
```

### 2. Schema Design

Design schemas with relationships in mind:

```javascript
const schema = {
  // Use namespaced attributes
  'user/name': { type: 'string' },
  'user/email': { type: 'string', unique: true },
  
  // Define relationships
  'user/profile': { type: 'ref', cardinality: 'one' },
  'user/posts': { type: 'ref', cardinality: 'many' },
  
  // Use :db/ident for entity types
  ':db/ident': { unique: true },
  
  // Add indexes for performance
  'post/createdAt': { type: 'instant', index: true }
};
```

### 3. Query Optimization

Write efficient queries:

```javascript
// Good: Use indexes
const recent = db.query({
  find: ['?post'],
  where: [
    ['?post', 'post/createdAt', '?date'],
    ['?date', '>', oneWeekAgo]
  ],
  limit: 10
});

// Better: Use pull patterns for related data
const userWithPosts = db.pull(userId, {
  'user/name': true,
  'user/posts': {
    'post/title': true,
    'post/createdAt': true
  }
});

// Best: Use reactive streams for live data
const liveData = db.stream(query`
  find recent posts
  with comments > 10
  order by createdAt desc
  limit 20
`);
```

### 4. Error Handling

Handle errors gracefully:

```javascript
try {
  const user = db.entity(userId);
  user.email = 'invalid-email'; // Will throw if validation fails
} catch (error) {
  if (error.message.includes('Invalid email')) {
    // Handle validation error
  } else {
    // Handle other errors
  }
}

// For subscriptions
const sub = entity.subscribe(
  (changes) => {
    // Handle changes
  },
  (error) => {
    // Handle subscription errors
    console.error('Subscription error:', error);
  }
);
```

### 5. Performance Considerations

- **Use batching**: Combine multiple operations in a single transaction
- **Limit subscriptions**: Don't create too many active subscriptions
- **Index wisely**: Add indexes for frequently queried attributes
- **Clean up**: Always unsubscribe and destroy unused Handles
- **Cache when needed**: Use CachedHandle for expensive queries

## API Reference

### Core Classes

#### Handle
Base class for all proxy types.

**Methods:**
- `value()` - Get current value (synchronous)
- `query(querySpec)` - Execute query (synchronous)
- `subscribe(querySpec, callback)` - Subscribe to changes
- `destroy()` - Clean up resources
- `receive(message)` - Actor message handler

#### DataStore
Reactive data store with DataScript backend.

**Methods:**
- `add(entity)` - Add new entity
- `update(id, changes)` - Update entity
- `retract(id)` - Remove entity
- `transact(operations)` - Batch operations
- `query(querySpec)` - Execute query
- `pull(id, pattern)` - Pull entity with pattern
- `subscribe(querySpec, callback)` - Subscribe to changes

#### EntityProxy
Proxy for individual entities.

**Properties:**
- All entity attributes as properties

**Methods:**
- `value()` - Get raw entity data
- `update(changes)` - Update multiple attributes
- `retract()` - Delete entity
- `subscribe(callback)` - Subscribe to changes

#### CollectionProxy
Proxy for entity collections.

**Properties:**
- `length` - Number of entities
- Iterable (supports for...of)

**Methods:**
- `filter(predicate)` - Filter entities
- `map(transform)` - Transform entities
- `reduce(reducer, initial)` - Reduce to value
- `find(predicate)` - Find first match
- `update(changes)` - Bulk update
- `subscribe(callback)` - Subscribe to changes

#### StreamProxy
Proxy for continuous query results.

**Methods:**
- `value()` - Get current results
- `filter(predicate)` - Filter stream
- `map(transform)` - Transform results
- `subscribe(callback)` - Subscribe to updates
- `pause()` - Pause updates
- `resume()` - Resume updates
- `destroy()` - Clean up stream

### DSL Functions

#### query\`...\`
Create query specifications from template literals.

```javascript
const spec = query`
  find all users
  where age >= ${minAge}
  and status = "active"
  return name, email
`;
```

#### update\`...\`
Create update specifications from template literals.

```javascript
const spec = update`
  for user with id = ${userId}
  set name = ${newName}
  remove email
  add tag ${tagId}
`;
```

#### defineSchema\`...\`
Define schemas using template literals.

```javascript
const schema = defineSchema`
  entity User {
    name: string required
    email: string unique
    age: number min=0 max=150
    friends: ref many -> User
  }
`;
```

## Conclusion

The Legion Data Layer provides a powerful, flexible foundation for building reactive applications with sophisticated data management needs. By combining immutable data structures, reactive programming, and the Actor model, it enables applications that are both performant and maintainable.

The layered architecture ensures clean separation of concerns while the Handle pattern provides a universal abstraction that works across different resource types and environments. Whether you're building a simple CRUD application or a complex distributed system, the Legion Data Layer provides the tools and patterns you need.

For more detailed information on specific packages, refer to their individual documentation:
- [DataScript Documentation](../datascript/README.md)
- [Handle Architecture](../handle/docs/ARCHITECTURE.md)
- [Data Store Guide](../data-store/docs/DATA_STORE_PACKAGE.md)
- [Handle DSL Design](../handle-dsl/docs/design.md)
- [File System Guide](../filesystem/README.md)