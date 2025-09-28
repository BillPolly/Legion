# Triple Store Data Source - Design Document

## Overview

The **Triple Store Data Source** consolidates existing triple store implementations from `/packages/km/` into the unified Handle/DataSource architecture. This package provides a standardized interface for Subject-Predicate-Object (SPO) triple storage with multiple backend implementations.

## Core Concepts

### Triple Store Pattern

A triple store stores knowledge as **triples**: `[subject, predicate, object]`
- **Subject**: The entity being described
- **Predicate**: The property or relationship 
- **Object**: The value or related entity

Example: `["user:123", "hasName", "Alice"]`

### Pattern Matching Queries

Triples support pattern matching with `null` wildcards:
- `query("user:123", null, null)` - All facts about user:123
- `query(null, "hasName", null)` - All entities with names
- `query(null, "friendOf", "user:456")` - Who is friends with user:456
- `query(null, null, null)` - All triples

### Multi-Index Storage

Triple stores maintain three indices for fast queries:
- **SPO**: Subject → Predicate → Objects
- **POS**: Predicate → Object → Subjects  
- **OSP**: Object → Subject → Predicates

## Architecture

### Package Structure

```
packages/shared/data/triplestore/
├── src/
│   ├── index.js                    # Main exports
│   ├── TripleStoreDataSource.js    # DataSource implementation
│   ├── providers/
│   │   ├── InMemoryProvider.js     # Memory-based storage
│   │   ├── FileSystemProvider.js   # File-based persistence
│   │   └── DataScriptProvider.js   # DataScript backend
│   ├── core/
│   │   ├── ITripleStore.js         # Interface definition
│   │   └── StorageError.js         # Error types
│   └── utils/
│       └── TripleIndex.js          # Shared indexing logic
├── docs/
│   └── design.md                   # This document
└── package.json
```

### TripleStoreDataSource

The main DataSource implementation that wraps triple store providers:

```javascript
class TripleStoreDataSource {
  constructor(provider) {
    this.provider = provider; // ITripleStore implementation
  }
  
  // DataSource interface - SYNCHRONOUS
  query(querySpec) {
    // Convert Handle querySpec to triple patterns
    // Execute via provider
    // Return results as Handles
  }
  
  subscribe(querySpec, callback) {
    // Setup pattern-based subscriptions
    // Notify on triple changes
  }
  
  getSchema() {
    return {
      type: 'triplestore',
      supportedPatterns: ['s-p-o', 's-p-?', ...],
      provider: this.provider.getMetadata()
    };
  }
}
```

### ITripleStore Interface

Base interface that all providers implement:

```javascript
class ITripleStore {
  async addTriple(subject, predicate, object) {}
  async removeTriple(subject, predicate, object) {}
  async query(subject, predicate, object) {}
  async size() {}
  async clear() {}
  
  getMetadata() {
    return {
      type: 'memory|file|datascript',
      supportsTransactions: boolean,
      supportsPersistence: boolean,
      supportsAsync: boolean
    };
  }
}
```

## Provider Implementations

**Note:** This package is in `/packages/shared/` because the TripleStoreDataSource interface can be used on both client and server. However, most provider implementations require server-side code (filesystem, databases, etc.). Only InMemoryProvider is truly universal.

### InMemoryProvider

Pure in-memory storage with triple indexing:

**Features:**
- Fast SPO/POS/OSP indices
- No persistence
- Synchronous operations available
- Suitable for caching and temporary data

**Runtime:** ✅ **Client & Server** - Works in browser and Node.js

**Source:** `/packages/km/kg-storage-memory/`

### FileSystemProvider  

File-based persistence with format support:

**Features:**
- Auto-save on changes
- File watching for external updates
- Multiple formats: JSON, Turtle, N-Triples
- Atomic writes via temp files

**Runtime:** 🖥️ **Server Only** - Requires Node.js `fs` module

**Source:** `/packages/km/kg-storage-file/`

### DataScriptProvider

DataScript backend for rich queries:

**Features:**
- DataScript's Datalog queries
- Object mapping layer
- Change notifications
- Schema validation support

**Runtime:** ✅ **Client & Server** - DataScript works in browser and Node.js

**Source:** `/packages/km/kg-datascript/`

## Integration with Handle Pattern

### Query Translation

Handle queries map to triple patterns:

```javascript
// Handle query
handle.query({ 
  subject: 'user:123',
  predicate: 'hasName'
})

// Becomes triple query
provider.query('user:123', 'hasName', null)

// Results returned as Handles
[
  TripleHandle({ subject: 'user:123', predicate: 'hasName', object: 'Alice' })
]
```

### TripleHandle Type

Specialized Handle for triple access:

```javascript
const triple = tripleStore.triple('user:123', 'hasName', 'Alice');
console.log(triple.subject);   // 'user:123'
console.log(triple.predicate); // 'hasName' 
console.log(triple.object);    // 'Alice'

// Can also query as Handle
const results = tripleStore.query({ subject: 'user:123' });
```

### Subscriptions

Pattern-based reactive queries:

```javascript
// Subscribe to all changes for a subject
tripleStore.subscribe(
  { subject: 'user:123' },
  (changes) => {
    console.log('User facts changed:', changes);
  }
);

// Subscribe to specific predicate
tripleStore.subscribe(
  { predicate: 'hasName' },
  (changes) => {
    console.log('Names changed:', changes);
  }
);
```

## Error Handling

Specialized error types from `kg-storage-core`:

```javascript
import { 
  StorageError,        // Base error
  ValidationError,     // Invalid triple format
  ConnectionError,     // Provider connection failed
  CapacityError,       // Storage limit reached
  NetworkError         // Remote provider issue
} from './core/StorageError.js';
```

## Usage Examples

### Basic Operations

```javascript
import { createTripleStore } from '@legion/triplestore';

// Create with memory provider
const store = await createTripleStore('memory');

// Add triples
await store.addTriple('user:123', 'hasName', 'Alice');
await store.addTriple('user:123', 'hasAge', 30);
await store.addTriple('user:123', 'friendOf', 'user:456');

// Query patterns
const allUserFacts = await store.query('user:123', null, null);
const allNames = await store.query(null, 'hasName', null);
const aliceFriends = await store.query(null, 'friendOf', 'user:456');
```

### File-based Storage

```javascript
// Create with file provider
const store = await createTripleStore('file', {
  filePath: './data/knowledge.json',
  autoSave: true,
  watchForChanges: true
});

// Operations auto-save
await store.addTriple('doc:1', 'hasTitle', 'Design Doc');
// Automatically written to file
```

### DataScript Backend

```javascript
// Create with DataScript provider
const store = await createTripleStore('datascript', {
  schema: {
    'hasName': { cardinality: 'one' },
    'friendOf': { cardinality: 'many' }
  }
});

// Rich Datalog queries available
const results = await store.provider.query(
  '[:find ?name :where [?e "hasName" ?name]]'
);
```

### As DataSource with Handles

```javascript
import { ResourceManager } from '@legion/resource-manager';

const rm = await ResourceManager.getInstance();

// Register as data source
const tripleSource = await rm.createDataSource('triplestore', {
  provider: 'memory'
});

// Use via Handle pattern
const userHandle = tripleSource.entity('user:123');
userHandle.set('hasName', 'Alice');
userHandle.set('hasAge', 30);

// Query returns Handles
const friends = tripleSource.query({ predicate: 'friendOf' });
friends.forEach(triple => {
  console.log(triple.subject, 'is friends with', triple.object);
});
```

## Migration from kg- Packages

This package consolidates:

1. **kg-storage-core** → `src/core/`
   - ITripleStore interface
   - StorageError types
   
2. **kg-storage-memory** → `src/providers/InMemoryProvider.js`
   - In-memory implementation
   - Triple indexing logic
   
3. **kg-storage-file** → `src/providers/FileSystemProvider.js`
   - File-based storage
   - Format serialization
   
4. **kg-datascript** → `src/providers/DataScriptProvider.js`
   - DataScript wrapper
   - Object mapping

All existing functionality preserved with unified interface.

## Implementation Notes

### MVP Scope

For the initial MVP:
- Implement TripleStoreDataSource wrapper
- Migrate all three providers as-is
- Basic Handle integration (query/subscribe)
- No transaction support initially
- No remote provider support

### Provider Selection

```javascript
const store = await createTripleStore(providerType, options);
```

Where `providerType` is:
- `'memory'` - InMemoryProvider
- `'file'` - FileSystemProvider  
- `'datascript'` - DataScriptProvider

### Synchronous vs Async

- **ITripleStore interface**: async methods for consistency
- **InMemoryProvider**: also provides sync methods for performance
- **DataSource interface**: synchronous (Actor pattern requirement)
- Translation layer handles sync/async boundary

## Key Design Decisions

1. **Preserve existing implementations**: All kg- packages migrated as-is
2. **Pluggable providers**: Easy to add new backends (Neo4j, RDF stores, etc.)
3. **Handle integration**: Results are Handles, not plain objects
4. **Pattern matching**: Core triple store feature preserved
5. **Multi-index**: Maintain SPO/POS/OSP indices for performance
6. **DataSource wrapper**: Adapts triple stores to Handle/DataSource pattern
7. **Shared package location**: Interface is universal (client/server), but most providers are server-only

## Client vs Server Usage

### Client-Side

On the client, typically use:
- **InMemoryProvider**: For local caching, temporary state
- **DataScriptProvider**: For reactive queries on client-side data
- **Remote provider** (future): Query server triple store via WebSocket/API

### Server-Side

On the server, use any provider:
- **InMemoryProvider**: Fast caching layer
- **FileSystemProvider**: Persistence to disk
- **DataScriptProvider**: Rich Datalog queries
- **Database providers** (future): Neo4j, MongoDB, PostgreSQL triple extensions

### Typical Architecture

```
Client:
  TripleStoreDataSource(InMemoryProvider)
    ↓ sync from server
    ↓ or cache results
    
Server:
  TripleStoreDataSource(FileSystemProvider)
    ↓ or
  TripleStoreDataSource(DatabaseProvider)
```

---

**This is the MVP design document focusing solely on architecture and integration. No implementation timeline or future enhancements included as requested.**