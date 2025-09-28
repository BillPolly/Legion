# @legion/triplestore

Universal triple store implementation with multiple backend providers for the Legion framework.

## Overview

`@legion/triplestore` provides a flexible, provider-based triple store implementation that works universally on both client and server. It implements the Subject-Predicate-Object (SPO) pattern for storing and querying graph data, with support for multiple backend storage providers.

## Features

- **Multiple Providers**: In-memory, file-based, and DataScript backends
- **Universal Compatibility**: Works on both client and server through abstractions
- **DataSource Pattern**: Integrates with Legion's Handle/Proxy system
- **Multiple Formats**: JSON, Turtle, and N-Triples for file storage
- **Type Preservation**: Maintains JavaScript types through serialization
- **Pattern Matching**: Flexible query patterns with wildcards
- **Subscriptions**: Real-time notifications for data changes
- **Factory Functions**: Convenient creation with sensible defaults

## Installation

```bash
npm install @legion/triplestore
```

## Quick Start

```javascript
import { createDefaultTripleStore } from '@legion/triplestore';

// Create an in-memory triple store
const store = createDefaultTripleStore();

// Add triples
await store.addTriple('john', 'knows', 'jane');
await store.addTriple('john', 'age', 42);
await store.addTriple('jane', 'knows', 'bob');

// Query with patterns (null = wildcard)
const johnKnows = await store.query('john', 'knows', null);
// Returns: [['john', 'knows', 'jane']]

const whoKnowsBob = await store.query(null, 'knows', 'bob');
// Returns: [['jane', 'knows', 'bob']]
```

## Providers

### InMemoryProvider

Fast, non-persistent storage ideal for testing and temporary data.

```javascript
import { createInMemoryTripleStore } from '@legion/triplestore';

const store = createInMemoryTripleStore({
  initialData: [
    ['subject1', 'predicate1', 'object1'],
    ['subject2', 'predicate2', 'object2']
  ]
});
```

### FileSystemProvider

Persistent file-based storage with auto-save and format detection.

```javascript
import { createFileSystemTripleStore } from '@legion/triplestore';
import { LocalFileSystemDataSource } from '@legion/datasource';

// Create with a DataSource abstraction
const dataSource = new LocalFileSystemDataSource('/base/path');
const store = createFileSystemTripleStore({
  dataSource,
  filePath: 'data.ttl',  // Supports .json, .ttl, .nt extensions
  autoSave: true,
  watchFile: true
});
```

#### Supported Formats

- **JSON** (`.json`): Human-readable with type preservation
- **Turtle** (`.ttl`): W3C standard RDF format
- **N-Triples** (`.nt`): Line-based RDF format

### DataScriptProvider

Advanced provider using DataScript's Datalog query engine.

```javascript
import { createDataScriptTripleStore } from '@legion/triplestore';

const store = createDataScriptTripleStore({
  schema: {
    // Define cardinality and uniqueness constraints
    ':db/cardinality': ':db.cardinality/many',
    ':db/unique': ':db.unique/identity'
  },
  initialData: [
    ['entity1', 'name', 'Alice'],
    ['entity1', 'age', 30]
  ]
});

// Use Datalog queries
const adults = await store.query(null, 'age', (age) => age >= 18);
```

## DataSource Integration

Triple stores can be wrapped as DataSources for use with Legion's Handle/Proxy pattern:

```javascript
import { createTripleStoreDataSource } from '@legion/triplestore';

// Create a DataSource wrapper
const dataSource = createTripleStoreDataSource({
  provider: 'memory',
  initialData: [
    ['user:1', 'name', 'Alice'],
    ['user:1', 'email', 'alice@example.com']
  ]
});

// Query using DataSource interface
const results = dataSource.query({
  subject: 'user:1',
  predicate: 'name'
});
// Returns: [{ subject: 'user:1', predicate: 'name', object: 'Alice' }]

// Subscribe to changes
const unsubscribe = dataSource.subscribe(
  { predicate: 'email' },
  (changes) => console.log('Email changed:', changes)
);
```

## API Reference

### ITripleStore Interface

All providers implement this base interface:

```javascript
class ITripleStore {
  // Add a triple
  async addTriple(subject, predicate, object)
  
  // Remove triples matching pattern
  async removeTriple(subject, predicate, object)
  
  // Query triples (null = wildcard)
  async query(subject, predicate, object)
  
  // Get all triples
  async getAll()
  
  // Clear all triples
  async clear()
  
  // Get provider metadata
  getMetadata()
}
```

### Factory Functions

```javascript
// Create with automatic provider selection
createTripleStore(options)

// Provider-specific factories
createInMemoryTripleStore(options)
createFileSystemTripleStore(options)
createDataScriptTripleStore(options)

// Create as DataSource
createTripleStoreDataSource(options)

// Create with defaults (in-memory)
createDefaultTripleStore()
```

### TripleStoreDataSource Methods

```javascript
// Synchronous query (DataSource pattern)
query(querySpec)

// Update data
update(updateSpec)

// Subscribe to changes
subscribe(querySpec, callback)

// Get schema information
getSchema()
```

## Type Preservation

The triple store preserves JavaScript types through serialization:

```javascript
const store = createInMemoryTripleStore();

// Numbers preserved
await store.addTriple('john', 'age', 42);
const age = (await store.query('john', 'age', null))[0][2];
console.log(typeof age); // 'number'

// Booleans preserved
await store.addTriple('john', 'active', true);
const active = (await store.query('john', 'active', null))[0][2];
console.log(typeof active); // 'boolean'

// Null preserved
await store.addTriple('john', 'nickname', null);
const nickname = (await store.query('john', 'nickname', null))[0][2];
console.log(nickname === null); // true
```

## Pattern Matching

Query with flexible patterns using `null` as wildcard:

```javascript
// All triples about 'john'
await store.query('john', null, null);

// All 'knows' relationships
await store.query(null, 'knows', null);

// Everything that points to 'bob'
await store.query(null, null, 'bob');

// All triples
await store.query(null, null, null);
```

## Error Handling

The library provides specific error types:

```javascript
import { StorageError, ValidationError } from '@legion/triplestore';

try {
  await store.addTriple('', 'predicate', 'object');
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Invalid triple:', error.message);
  }
}
```

## Testing

The package includes comprehensive test coverage:

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Generate coverage report
npm run test:coverage
```

## Examples

### Knowledge Graph

```javascript
const kg = createInMemoryTripleStore();

// Build a social graph
await kg.addTriple('alice', 'type', 'Person');
await kg.addTriple('alice', 'name', 'Alice Smith');
await kg.addTriple('alice', 'knows', 'bob');
await kg.addTriple('bob', 'type', 'Person');
await kg.addTriple('bob', 'name', 'Bob Jones');
await kg.addTriple('bob', 'worksFor', 'acme');
await kg.addTriple('acme', 'type', 'Company');
await kg.addTriple('acme', 'name', 'Acme Corp');

// Find all people
const people = await kg.query(null, 'type', 'Person');
// Returns: [['alice', 'type', 'Person'], ['bob', 'type', 'Person']]

// Find Alice's connections
const connections = await kg.query('alice', 'knows', null);
// Returns: [['alice', 'knows', 'bob']]
```

### Configuration Store

```javascript
const config = createFileSystemTripleStore({
  dataSource: new LocalFileSystemDataSource('./config'),
  filePath: 'settings.json',
  autoSave: true
});

// Store configuration
await config.addTriple('app', 'theme', 'dark');
await config.addTriple('app', 'language', 'en');
await config.addTriple('user', 'notifications', true);

// Retrieve settings
const theme = (await config.query('app', 'theme', null))[0]?.[2];
```

## Design Principles

1. **Fail Fast**: No silent errors or fallbacks
2. **No Mocks**: Real implementations only, no mock code
3. **Type Safety**: Preserves JavaScript types through serialization
4. **Universal**: Works on client and server through abstractions
5. **TDD**: Comprehensive test coverage with 338+ tests passing

## License

MIT

## Contributing

This package is part of the Legion framework. For contribution guidelines, see the main Legion repository.