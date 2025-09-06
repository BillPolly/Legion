# Legion Shared Handle System Design

## Overview

The Legion Shared Handle System provides a unified, actor-based architecture for creating transparent, introspectable resource handles that work identically on client and server. Handles are first-class objects that can be sent bidirectionally through the actor system while maintaining complete method call transparency and Smalltalk-style introspection capabilities.

## Core Principles

### 1. Actor-Based Identity
Handles extend the Actor class and inherit all actor capabilities including GUID assignment, remote method forwarding, and automatic proxy creation when sent across actor boundaries.

### 2. Bidirectional Transparency
A handle created on the server can be sent to the client and behave identically. A handle created on the client can be sent to the server with the same transparent behavior. The location of the handle is completely invisible to the user.

### 3. Smalltalk-Style Introspection
Every handle provides a `.type` property that returns a TypeHandle containing complete introspection capabilities: methods, attributes, documentation, and metadata - exactly like Smalltalk class objects.

### 4. Generic Base Capabilities
All handle functionality (method dispatch, caching, subscriptions, events) is implemented at the BaseHandle level. Specialized handles only implement domain-specific logic.

## Architecture

### BaseHandle Class

```javascript
class BaseHandle extends Actor {
  constructor(handleType, data = {}) {
    super();
    this.handleType = handleType;
    this.data = data;
    this.cache = new Map();
    this.subscriptions = new Map();
    this.attributes = new Map();
  }

  // Core introspection - returns TypeHandle for this handle's class
  get type() {
    return TypeHandleRegistry.getTypeHandle(this.handleType);
  }

  // Generic method call infrastructure
  async callMethod(methodName, args) { /* Generic dispatch */ }
  
  // Generic caching infrastructure  
  getCachedValue(key, ttl) { /* Generic caching */ }
  setCachedValue(key, value, ttl) { /* Cache management */ }
  invalidateCache(pattern) { /* Cache invalidation */ }
  
  // Generic subscription infrastructure
  subscribe(event, callback) { /* Event subscription */ }
  unsubscribe(event, callback) { /* Event cleanup */ }
  emit(event, data) { /* Event emission with remote forwarding */ }
  
  // Generic attribute system
  getAttribute(name) { /* Dynamic attribute access */ }
  setAttribute(name, value) { /* Dynamic attribute setting */ }
}
```

### TypeHandle Class

```javascript
class TypeHandle extends Actor {
  constructor(typeName, metadata) {
    super();
    this.name = typeName;
    this.methods = metadata.methods;
    this.attributes = metadata.attributes;
    this.documentation = metadata.documentation;
    this.version = metadata.version;
  }

  // Smalltalk-style introspection methods
  listMethods() { return this.methods; }
  listAttributes() { return this.attributes; }
  getMethodSignature(methodName) { /* Return method signature */ }
  getAttributeType(attrName) { /* Return attribute type */ }
  getDocumentation(item) { /* Return documentation */ }
  
  // Type compatibility
  isCompatibleWith(otherType) { /* Check compatibility */ }
  respondsTo(methodName) { /* Check if method exists */ }
}
```

## Key Features

### 1. Transparent Remote Method Calls

When a handle is sent across the actor system:

```javascript
// Server side
const fileHandle = new FileHandle('/path/to/file');
clientActor.send('handle-created', { handle: fileHandle });

// Client side receives RemoteHandle proxy
// clientSide.handle.read() automatically forwards to server's fileHandle.read()
const content = await handle.read(); // Transparent remote call
```

### 2. Complete Introspection

```javascript
// Works identically on local and remote handles
console.log(handle.type.name); // "FileHandle"
console.log(handle.type.listMethods()); // ["read", "write", "stat", "watch"]
console.log(handle.type.getMethodSignature('read')); // { params: [], returns: "string" }

// Even introspection works remotely
const remoteType = handle.type;
const methods = await remoteType.listMethods(); // Remote call to get methods
```

### 3. Generic Caching

```javascript
class FileHandle extends BaseHandle {
  async read() {
    // Generic caching automatically handled by BaseHandle
    return this.getCachedValue('content', 30000) || 
           this.setCachedValue('content', await this._readFromDisk(), 30000);
  }
}
```

### 4. Event Subscriptions

```javascript
// Subscribe to handle events (works locally and remotely)
handle.subscribe('content-changed', (newContent) => {
  console.log('File content updated:', newContent);
});

// Server-side file handle emits event
fileHandle.emit('content-changed', newContent);
// Event automatically forwarded to all remote subscribers
```

### 5. Bidirectional Handle Flow

```javascript
// Client creates handle and sends to server
const clientHandle = new CustomHandle('client-data');
serverActor.send('process-handle', { handle: clientHandle });

// Server receives RemoteHandle proxy
// serverSide.handle.someMethod() forwards back to client
await handle.someMethod(); // Remote call to client's handle
```

## Specialized Handle Types

### FileHandle Example

```javascript
class FileHandle extends BaseHandle {
  constructor(filePath, fileSystem) {
    super('FileHandle', { path: filePath });
    this.fileSystem = fileSystem;
    this.setAttribute('path', filePath);
    this.setAttribute('extension', path.extname(filePath));
  }

  async read() {
    return this.getCachedValue('content') || 
           this.setCachedValue('content', await this.fileSystem.readFile(this.data.path));
  }

  async write(content) {
    await this.fileSystem.writeFile(this.data.path, content);
    this.invalidateCache('content');
    this.emit('content-changed', content);
    return true;
  }

  async stat() {
    return this.getCachedValue('stats', 5000) ||
           this.setCachedValue('stats', await this.fileSystem.stat(this.data.path), 5000);
  }

  // Computed attributes using generic system
  get size() {
    return this.getAttribute('size') || this.stat().then(s => s.size);
  }
}
```

### GitHubRepoHandle Example

```javascript
class GitHubRepoHandle extends BaseHandle {
  constructor(repoUrl, githubClient) {
    super('GitHubRepoHandle', { url: repoUrl });
    this.github = githubClient;
    this.setAttribute('url', repoUrl);
    this.setAttribute('owner', this._extractOwner(repoUrl));
    this.setAttribute('name', this._extractRepoName(repoUrl));
  }

  async branches() {
    return this.getCachedValue('branches', 60000) ||
           this.setCachedValue('branches', await this.github.listBranches(), 60000);
  }

  async clone(destination) {
    const result = await this.github.clone(this.data.url, destination);
    this.emit('cloned', { destination, result });
    return result;
  }

  async createBranch(name) {
    const branch = await this.github.createBranch(name);
    this.invalidateCache('branches');
    this.emit('branch-created', branch);
    return branch;
  }

  // Real-time subscriptions
  async watchIssues(callback) {
    return this.subscribe('issue-created', callback);
  }
}
```

### DatabaseHandle Example

```javascript
class DatabaseHandle extends BaseHandle {
  constructor(connectionString, dbClient) {
    super('DatabaseHandle', { connectionString });
    this.db = dbClient;
    this.setAttribute('host', this._extractHost(connectionString));
    this.setAttribute('database', this._extractDatabase(connectionString));
  }

  async query(sql, params = []) {
    // No caching for queries by default
    const result = await this.db.execute(sql, params);
    this.emit('query-executed', { sql, params, rowCount: result.length });
    return result;
  }

  async transaction(callback) {
    return await this.db.transaction(async (tx) => {
      // Create a TransactionHandle for the transaction context
      const txHandle = new TransactionHandle(tx);
      const result = await callback(txHandle);
      this.emit('transaction-completed', { result });
      return result;
    });
  }

  // Cached metadata
  async getTables() {
    return this.getCachedValue('tables', 300000) ||
           this.setCachedValue('tables', await this.db.listTables(), 300000);
  }
}
```

## Type Registration System

### TypeHandleRegistry

```javascript
class TypeHandleRegistry {
  static types = new Map();

  static registerType(typeName, metadata) {
    const typeHandle = new TypeHandle(typeName, metadata);
    this.types.set(typeName, typeHandle);
    return typeHandle;
  }

  static getTypeHandle(typeName) {
    return this.types.get(typeName);
  }

  // Auto-registration from handle classes
  static autoRegisterFromClass(HandleClass) {
    const metadata = this._extractMetadataFromClass(HandleClass);
    return this.registerType(HandleClass.name, metadata);
  }
}

// Example registration
TypeHandleRegistry.registerType('FileHandle', {
  methods: {
    read: { params: [], returns: 'string', cacheable: true },
    write: { params: ['content:string'], returns: 'boolean', sideEffects: ['content-changed'] },
    stat: { params: [], returns: 'object', cacheable: true },
    watch: { params: ['callback:function'], returns: 'subscription', async: true }
  },
  attributes: {
    path: { type: 'string', readonly: true },
    size: { type: 'number', computed: true },
    extension: { type: 'string', readonly: true }
  },
  documentation: {
    description: "Represents a file system file with read/write capabilities",
    examples: ["fileHandle.read()", "fileHandle.write('content')"]
  }
});
```

## Actor Integration

### Serialization Protocol

When a handle is sent through the actor system:

1. **Handle → Message**: BaseHandle's actor GUID is included
2. **Transmission**: Only GUID and type metadata sent (not full object)  
3. **Remote Side**: RemoteHandle proxy created with same interface
4. **Method Calls**: `remoteHandle.method()` sends actor message to real handle
5. **Introspection**: `remoteHandle.type` works via RemoteTypeHandle

### Message Flow

```javascript
// 1. Handle sent in actor message
serverActor.send('handle-data', { 
  fileHandle: fileHandle,  // BaseHandle instance
  metadata: { source: 'server' }
});

// 2. ActorSerializer detects BaseHandle (extends Actor)
// Serializes as: { '#actorGuid': 'handle-abc123', '#actorType': 'FileHandle' }

// 3. Client ActorDeserializer creates RemoteHandle proxy
// Client receives object that behaves exactly like original FileHandle

// 4. Method calls transparently forwarded
await clientFileHandle.read(); // Sends message to server's fileHandle.read()
```

## Core Generic Capabilities

### Method Call Infrastructure

```javascript
class BaseHandle extends Actor {
  // Generic method dispatcher
  async callMethod(methodName, args) {
    if (!this.type.respondsTo(methodName)) {
      throw new Error(`Method ${methodName} not supported by ${this.type.name}`);
    }

    const methodMeta = this.type.methods[methodName];
    
    // Check cache if method is cacheable
    if (methodMeta.cacheable) {
      const cached = this.getCachedValue(`method:${methodName}`, methodMeta.ttl);
      if (cached !== null) return cached;
    }

    // Execute actual method
    const result = await this[`_${methodName}`](...args);

    // Cache result if applicable
    if (methodMeta.cacheable) {
      this.setCachedValue(`method:${methodName}`, result, methodMeta.ttl);
    }

    // Emit side effects
    if (methodMeta.sideEffects) {
      methodMeta.sideEffects.forEach(event => this.emit(event, result));
    }

    return result;
  }
}
```

### Caching System

```javascript
class HandleCache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
  }

  set(key, value, ttl = 0) {
    this.cache.set(key, value);
    
    if (ttl > 0) {
      // Clear existing timer
      if (this.timers.has(key)) {
        clearTimeout(this.timers.get(key));
      }
      
      // Set new expiration timer
      const timer = setTimeout(() => {
        this.cache.delete(key);
        this.timers.delete(key);
      }, ttl);
      
      this.timers.set(key, timer);
    }
  }

  get(key) {
    return this.cache.get(key) || null;
  }

  invalidate(pattern) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        if (this.timers.has(key)) {
          clearTimeout(this.timers.get(key));
          this.timers.delete(key);
        }
      }
    }
  }
}
```

### Subscription System

```javascript
class HandleSubscriptionManager {
  constructor(handle) {
    this.handle = handle;
    this.subscribers = new Map(); // event -> Set of callbacks
    this.remoteSubscribers = new Map(); // event -> Set of remote actor GUIDs
  }

  subscribe(event, callback) {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, new Set());
    }
    this.subscribers.get(event).add(callback);

    // Return unsubscribe function
    return () => this.unsubscribe(event, callback);
  }

  subscribeRemote(event, remoteActorGuid) {
    if (!this.remoteSubscribers.has(event)) {
      this.remoteSubscribers.set(event, new Set());
    }
    this.remoteSubscribers.get(event).add(remoteActorGuid);
  }

  emit(event, data) {
    // Emit to local subscribers
    const locals = this.subscribers.get(event);
    if (locals) {
      locals.forEach(callback => callback(data));
    }

    // Forward to remote subscribers via actor messages
    const remotes = this.remoteSubscribers.get(event);
    if (remotes) {
      remotes.forEach(guid => {
        this.handle.sendToActor(guid, 'handle-event', {
          handleId: this.handle.getGuid(),
          event,
          data
        });
      });
    }
  }
}
```

## Usage Examples

### File Operations

```javascript
// Server creates file handle
const fileHandle = new FileHandle('/data/config.json', fileSystem);

// Send to client
clientActor.send('config-file', { file: fileHandle });

// Client receives transparent proxy
// All operations work identically to server-side handle
const content = await file.read();
await file.write(newContent);

// Introspection works remotely
console.log(file.type.name); // "FileHandle"
console.log(file.type.listMethods()); // ["read", "write", "stat", "watch"]

// Subscriptions work across network
file.subscribe('content-changed', (newContent) => {
  console.log('File updated remotely:', newContent);
});
```

### GitHub Repository Operations

```javascript
// Server creates GitHub handle  
const repoHandle = new GitHubRepoHandle('https://github.com/user/repo', githubClient);

// Send to client
clientActor.send('repository', { repo: repoHandle });

// Client can perform all repo operations transparently
const branches = await repo.branches(); // Remote call to server
await repo.createBranch('feature-x'); // Remote call with local response

// Real-time updates work automatically
repo.subscribe('branch-created', (branch) => {
  console.log('New branch created:', branch.name);
});

// Type introspection reveals capabilities
console.log(repo.type.listMethods()); 
// ["clone", "branches", "createBranch", "issues", "pullRequests"]

console.log(repo.type.getMethodSignature('createBranch'));
// { params: ['name:string'], returns: 'object', sideEffects: ['branch-created'] }
```

### Database Operations

```javascript
// Server creates database handle
const dbHandle = new DatabaseHandle('postgres://localhost/mydb', pgClient);

// Send to client for query operations
clientActor.send('database', { db: dbHandle });

// Client can execute queries transparently
const users = await db.query('SELECT * FROM users WHERE active = ?', [true]);

// Transactions work with nested handles
await db.transaction(async (tx) => {
  await tx.query('INSERT INTO logs (action) VALUES (?)', ['user-login']);
  await tx.query('UPDATE users SET last_login = NOW() WHERE id = ?', [userId]);
  // tx is also a handle with full introspection and transparency
});

// Real-time subscriptions for database events
db.subscribe('query-executed', ({ sql, rowCount }) => {
  console.log(`Query executed: ${sql} (${rowCount} rows)`);
});
```

## Implementation Architecture

### Class Hierarchy

```
Actor (from @legion/actors)
├── BaseHandle (generic handle capabilities)
│   ├── FileHandle (file operations)
│   ├── ImageHandle (image operations)  
│   ├── DirectoryHandle (directory operations)
│   ├── GitHubRepoHandle (GitHub operations)
│   ├── DatabaseHandle (database operations)
│   └── TransactionHandle (database transaction operations)
└── TypeHandle (introspection metadata)
    ├── FileTypeHandle
    ├── ImageTypeHandle
    └── ... (auto-generated from handle classes)
```

### Package Structure

```
packages/shared/handles/
├── src/
│   ├── BaseHandle.js          # Core handle functionality
│   ├── TypeHandle.js          # Introspection system
│   ├── HandleCache.js         # Generic caching
│   ├── HandleSubscriptions.js # Event/subscription system
│   ├── TypeHandleRegistry.js  # Type registration
│   ├── handles/               # Specialized implementations
│   │   ├── FileHandle.js
│   │   ├── ImageHandle.js
│   │   ├── DirectoryHandle.js
│   │   ├── GitHubRepoHandle.js
│   │   └── DatabaseHandle.js
│   └── index.js              # Package exports
├── docs/
│   └── DESIGN.md             # This document
└── package.json
```

## API Specifications

### BaseHandle Methods

```javascript
// Core handle interface
handle.callMethod(methodName, args) -> Promise<any>
handle.getCachedValue(key, ttl?) -> any | null
handle.setCachedValue(key, value, ttl?) -> void
handle.invalidateCache(pattern?) -> void
handle.subscribe(event, callback) -> unsubscribe function
handle.emit(event, data) -> void
handle.getAttribute(name) -> any
handle.setAttribute(name, value) -> void

// Introspection interface
handle.type -> TypeHandle
handle.type.name -> string
handle.type.listMethods() -> string[]
handle.type.listAttributes() -> string[]  
handle.type.getMethodSignature(method) -> object
handle.type.respondsTo(method) -> boolean
```

### Handle Lifecycle

```javascript
// 1. Creation
const handle = new FileHandle('/path/to/file', fileSystem);

// 2. Registration (automatic via Actor base class)
// Handle gets GUID, registered with ActorSpace

// 3. Remote Transmission
remoteActor.send('data', { file: handle });
// ActorSerializer includes GUID reference, not full object

// 4. Remote Reconstruction  
// ActorDeserializer creates RemoteHandle proxy with same interface

// 5. Method Calls
await remoteHandle.read(); // Forwarded to original handle via actor messages

// 6. Cleanup (automatic via Actor lifecycle)
// Handle removed from ActorSpace when no longer referenced
```

## Error Handling

### Method Call Errors

```javascript
try {
  await handle.nonExistentMethod();
} catch (error) {
  // Error: Method nonExistentMethod not supported by FileHandle
}
```

### Remote Call Errors

```javascript
try {
  await remoteHandle.read(); // Remote file doesn't exist
} catch (error) {
  // Original error forwarded from server
  // Error: ENOENT: no such file or directory
}
```

### Type Safety

```javascript
// Compile-time checking via TypeHandle
if (handle.type.respondsTo('read')) {
  const content = await handle.read();
} else {
  throw new Error(`Handle type ${handle.type.name} does not support reading`);
}
```

## Backward Compatibility

The new handle system maintains complete backward compatibility:

1. **Existing ResourceHandleManager** continues to work
2. **Current /show command** can be gradually migrated  
3. **Plain object handles** can coexist with Actor-based handles
4. **Migration path** provided for existing code

### Migration Example

```javascript
// OLD: Plain object handle
const oldHandle = resourceManager.createFileHandle(path, fs);
await oldHandle.read(); // Direct method call

// NEW: Actor-based handle (same interface)
const newHandle = new FileHandle(path, fs);
await newHandle.read(); // Same method call, but with caching/events/remote support

// TRANSITION: Automatic wrapping
const wrappedHandle = BaseHandle.fromPlainObject(oldHandle);
// Now has full Actor capabilities while maintaining existing interface
```

## Performance Considerations

### Caching Strategy
- Method results cached by default with configurable TTL
- Attribute access cached for performance
- Cache invalidation on state-changing operations
- Memory management with automatic cleanup

### Network Optimization  
- Method call batching for multiple operations
- Subscription event coalescing
- Lazy loading of type metadata
- Connection pooling for remote handles

### Memory Management
- Automatic handle cleanup when no longer referenced
- Subscription cleanup on handle disposal
- Cache expiration and memory limits
- WeakRef usage for large handle graphs

## Security Model

### Access Control
- Method-level permissions via TypeHandle metadata
- Attribute access restrictions
- Event subscription filtering
- Remote call validation

### Data Protection
- Sensitive data flagged in TypeHandle
- Automatic redaction in logs and introspection
- Encryption for sensitive handle transmission
- Audit trail for security-critical operations

This design provides a complete, generic handle system that leverages the existing Actor architecture while providing powerful introspection and transparent remote operation capabilities.