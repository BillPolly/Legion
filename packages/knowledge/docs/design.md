# @legion/knowledge - Design Document

## Executive Summary

The @legion/knowledge package unifies knowledge representation and the Handle pattern into a single, coherent abstraction. By recognizing that "knowledge" is simply non-executable Handle instances representing facts and relationships, we eliminate the artificial distinction between data access patterns and knowledge representation. This design leverages the existing Handle/DataSource architecture to provide a powerful, consistent interface for all knowledge operations.

## Core Concept: Knowledge as Handles

### The Fundamental Insight

The Handle pattern already provides everything needed for knowledge representation:
- **Introspection**: Handles can describe themselves through schemas and metadata
- **Querying**: The Handle query system supports complex pattern matching
- **Relationships**: Handles can reference and relate to other Handles
- **Meta-circularity**: Handles can describe other Handles (prototypes, schemas, types)

Knowledge entities are simply Handles that:
1. Don't execute operations (no side effects)
2. Represent pure facts and relationships
3. Can be queried and traversed
4. Support rich metadata and schemas

### Unified Abstraction

Instead of having separate systems for:
- **Handles**: For executable resources (files, APIs, services)
- **Triples**: For knowledge representation (facts, relationships)

We have ONE system where:
- **All resources are Handles** with appropriate DataSources
- **Knowledge is represented by KnowledgeHandles** backed by TripleDataSource
- **Triples become an implementation detail** hidden behind the Handle interface

## Architecture

### Component Overview

```
┌─────────────────────────────────────────┐
│         Application Layer               │
│  (Uses Handles uniformly for everything)│
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│            Handle Layer                 │
│  ┌──────────┐  ┌──────────────────┐   │
│  │  Handle  │  │ KnowledgeHandle   │   │
│  │(General) │  │  (extends Handle)  │   │
│  └──────────┘  └──────────────────┘   │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│         DataSource Layer                │
│  ┌──────────┐  ┌─────────────────┐    │
│  │   File   │  │TripleDataSource │    │
│  │DataSource│  │ (wraps stores)   │    │
│  └──────────┘  └─────────────────┘    │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│         Storage Layer                   │
│  ┌──────────┐  ┌─────────────────┐    │
│  │Filesystem│  │  Triple Stores   │    │
│  │          │  │(DataScript, etc) │    │
│  └──────────┘  └─────────────────┘    │
└─────────────────────────────────────────┘
```

### Key Classes

#### KnowledgeHandle

```javascript
class KnowledgeHandle extends Handle {
  // Inherits all Handle capabilities:
  // - Proxy-based property access
  // - Query through ResourceManager
  // - Subscription support
  // - Schema introspection
  
  // Knowledge-specific additions:
  
  // Navigate relationships
  related(predicate) { /* returns related KnowledgeHandles */ }
  
  // Check facts
  hasFact(predicate, object) { /* boolean check */ }
  
  // Get all facts about this entity
  facts() { /* returns array of {predicate, object} */ }
  
  // Get entity type information
  types() { /* returns type hierarchy */ }
}
```

#### TripleDataSource

```javascript
class TripleDataSource extends DataSource {
  constructor(backendStore) {
    // Can wrap any triple store implementation:
    // - DataScript for in-memory operations
    // - MongoDB for persistence
    // - GraphDB for complex queries
    this.store = backendStore;
  }
  
  // Implement DataSource interface:
  async query(querySpec) {
    // Translate Handle queries to triple patterns
    // Return results as Handle projections
  }
  
  async update(updateSpec) {
    // Translate Handle updates to triple operations
  }
  
  subscribe(querySpec, callback) {
    // Real-time updates when knowledge changes
  }
  
  getSchema() {
    // Return schema for knowledge entities
  }
}
```

### Integration with Existing Backends

The TripleDataSource acts as an adapter, allowing any triple store to be used as a Handle backend:

```javascript
// DataScript backend (in-memory, fast queries)
const dsBackend = new DataScriptTripleStore();
const dsSource = new TripleDataSource(dsBackend);

// MongoDB backend (persistent, scalable)  
const mongoBackend = new MongoTripleStore(mongoUrl);
const mongoSource = new TripleDataSource(mongoBackend);

// Graph database backend (complex traversals)
const graphBackend = new GraphDBTripleStore(config);
const graphSource = new TripleDataSource(graphBackend);
```

## Usage Patterns

### Creating Knowledge

```javascript
// Create a knowledge DataStore with schema
const knowledgeStore = createDataStore({
  ':entity/id': { unique: 'identity' },
  ':entity/type': {},
  ':person/name': {},
  ':person/age': { valueType: 'number' },
  ':person/occupation': {},
  ':person/knows': { valueType: 'ref', cardinality: 'many' },
  ':person/worksAt': { valueType: 'ref' }
});

// Create knowledge entities
const aliceId = knowledgeStore.createEntity({
  ':entity/type': 'Person',
  ':person/name': 'Alice',
  ':person/age': 30,
  ':person/occupation': 'Engineer'
});

const bobId = knowledgeStore.createEntity({
  ':entity/type': 'Person',
  ':person/name': 'Bob'
});

// Add relationships
knowledgeStore.updateEntity(aliceId.entityId, {
  ':person/knows': [bobId.entityId]
});
```

### Querying Knowledge

```javascript
// Query through DataStore interface
const engineers = knowledgeStore.query({
  find: ['?e'],
  where: [
    ['?e', ':entity/type', 'Person'],
    ['?e', ':person/occupation', 'Engineer']
  ]
});

// Use KnowledgeHandle for navigation
const knowledgeSource = new TripleDataSource(knowledgeStore);
const personHandle = new KnowledgeHandle(knowledgeSource, aliceId.entityId);

// Navigate relationships
const colleagues = personHandle.related(':person/worksAt').related(':company/employs');

// Complex queries
const results = knowledgeStore.query({
  find: ['?e', '?name', '?age'],
  where: [
    ['?e', ':entity/type', 'Person'],
    ['?e', ':person/knows', '?bob'],
    ['?bob', ':person/name', 'Bob'],
    ['?e', ':person/name', '?name'],
    ['?e', ':person/age', '?age'],
    ['?age', '>', 25]
  ]
});
```

### Knowledge About Handles

```javascript
// Create knowledge about an executable Handle
// (FileHandle is a different type of Handle, not from knowledge system)
const fileMetadataId = knowledgeStore.createEntity({
  ':entity/type': 'FileMetadata',
  ':metadata/describes': '/path/to/data.json',  // Store the path
  ':metadata/author': 'Alice',
  ':metadata/created': '2024-01-15',
  ':metadata/purpose': 'Configuration for production deployment'
});

// Query knowledge about files
const configs = knowledgeStore.query({
  find: ['?m', '?path', '?purpose'],
  where: [
    ['?m', ':entity/type', 'FileMetadata'],
    ['?m', ':metadata/describes', '?path'],
    ['?m', ':metadata/purpose', '?purpose'],
    // String pattern matching would be implemented in TripleDataSource
  ]
});
```

## Implementation Strategy

### Phase 1: Core Infrastructure
1. Implement KnowledgeHandle class extending Handle
2. Create TripleDataSource implementing DataSource interface
3. Create factory functions for easy instantiation

### Phase 2: Backend Adapters
1. Create DataScriptBackend adapter
2. Create MongoBackend adapter
3. Ensure seamless switching between backends

### Phase 3: Migration
1. Replace direct triple operations with Handle operations
2. Update existing code to use KnowledgeHandle
3. Retire the km directory structure

## Benefits

### Unified Interface
- Single abstraction for all resource types
- Consistent API across data and knowledge
- No cognitive overhead switching between patterns

### Simplicity
- Triples hidden as implementation detail
- No need to understand RDF or triple patterns
- Natural object-oriented interface

### Power
- All Handle capabilities available for knowledge
- Rich querying through existing Handle query system
- Real-time subscriptions for knowledge changes

### Flexibility
- Multiple backend stores supported
- Easy to add new storage backends
- Can mix storage strategies (memory, disk, cloud)

## Migration Path

### Current State (km directory)
- Complex multi-package structure
- Separate abstractions for triples vs data
- Prototype pollution from object extensions
- Mixed synchronous/asynchronous APIs

### Target State (@legion/knowledge)
- Single cohesive package
- Unified Handle abstraction
- Clean prototype chain
- Consistent async API

### Migration Steps
1. Create @legion/knowledge package with this design
2. Implement core classes with full test coverage
3. Create adapters for existing triple stores
4. Update dependent code to use new package
5. Deprecate and remove km directory

## API Reference

### Factory Functions

```javascript
import { createKnowledgeStore, createKnowledgeHandle } from '@legion/knowledge';

// Create a knowledge DataStore with triple-oriented schema
const store = createKnowledgeStore({
  entities: ['Person', 'Company', 'Document'],
  relationships: {
    'person/knows': { target: 'Person', cardinality: 'many' },
    'person/worksAt': { target: 'Company', cardinality: 'one' }
  }
});

// Create a KnowledgeHandle for an entity
const handle = createKnowledgeHandle(store, entityId);
```

### KnowledgeHandle Methods

```javascript
// Relationship navigation
handle.related(predicate)
handle.relatedBy(predicate)

// Fact management
handle.hasFact(predicate, object)
handle.addFact(predicate, object)
handle.getFacts(predicate?)

// Type management  
handle.addType(type)
handle.hasType(type)
handle.getTypes()

// Metadata
handle.describe()
handle.getSchema()
```

### TripleDataSource Configuration

```javascript
{
  backend: 'datascript' | 'mongodb' | 'graphdb',
  config: {
    // Backend-specific configuration
    url?: string,
    schema?: object,
    indexes?: array
  },
  options: {
    caching: boolean,
    realtime: boolean,
    validation: boolean
  }
}
```

## Summary

The @legion/knowledge package represents a fundamental simplification and unification of the Legion framework's data and knowledge layers. By recognizing that knowledge is just another type of Handle, we eliminate unnecessary complexity while gaining power and flexibility. This design fulfills the vision of a single, consistent abstraction for all resource types while hiding the complexity of triple stores and RDF behind a clean, intuitive interface.

The migration from the complex km directory structure to this unified approach will result in:
- Cleaner, more maintainable code
- Better performance through consistent caching strategies
- Easier onboarding for developers (one pattern to learn)
- More powerful querying capabilities
- Seamless integration between data and knowledge operations

This is not just a refactoring - it's a conceptual breakthrough that aligns perfectly with the Handle pattern's philosophy of uniform resource access.