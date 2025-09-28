# @legion/rdf Design Document

## Overview

The `@legion/rdf` package provides seamless integration between RDF (Resource Description Framework) data and Legion's Handle-based architecture. It enables importing RDF data from external sources, exporting Handle-based knowledge graphs to standard RDF formats, and working with RDF data using Legion's powerful Handle/DataSource patterns.

## Architecture

### Core Principles

1. **Handle-Native**: RDF data is exposed through Handle interfaces, making it work seamlessly with the rest of Legion
2. **Bidirectional**: Full conversion support between RDF and Handle entities
3. **Standards-Compliant**: Supports W3C RDF standards (Turtle, N-Triples, JSON-LD, RDF/XML)
4. **Synchronous Operations**: Follows Handle pattern's synchronous dispatcher model
5. **Type Preservation**: Maintains JavaScript types through RDF conversions

### System Integration

```
┌─────────────────────────────────────────────────────────┐
│                   Application Layer                      │
│              (Query, Subscribe, Update)                  │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                      RDFHandle                          │
│         (Handle interface over RDF resources)            │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                    RDFDataSource                        │
│     (DataSource implementation for RDF triple store)     │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                  @legion/triplestore                    │
│            (Backend storage with RDF I/O)                │
└─────────────────────────────────────────────────────────┘
```

## Core Components

### 1. RDFDataSource

Implements the DataSource interface to provide Handle-compatible access to RDF data stored in a triple store.

**Responsibilities:**
- Translate Handle queries to triple patterns
- Execute queries against triple store
- Manage subscriptions for reactive updates
- Extract and provide schema information from RDF ontologies
- Validate data against RDF schemas

**Interface:**
```javascript
class RDFDataSource {
  constructor(tripleStore, namespaceManager);
  
  // Required DataSource methods
  query(querySpec): results;
  subscribe(querySpec, callback): Subscription;
  getSchema(): Schema;
  
  // RDF-specific methods
  importRDF(rdfString, format): void;
  exportRDF(format): string;
  addNamespace(prefix, uri): void;
}
```

**Query Translation:**
- Handle query `{find: ['?entity'], where: [['?entity', 'type', 'Person']]}` 
- Triple pattern `query(null, 'rdf:type', 'Person')`

### 2. RDFHandle

Extends Handle base class to provide Handle interface over RDF resources.

**Responsibilities:**
- Wrap RDFDataSource with Handle lifecycle management
- Provide value() method for current RDF entity state
- Support Handle-based subscriptions
- Enable introspection of RDF schemas
- Support projection to related RDF entities

**Interface:**
```javascript
class RDFHandle extends Handle {
  constructor(dataSource, entityId);
  
  // Handle interface implementation
  value(): Entity;
  query(querySpec): results;
  subscribe(querySpec, callback): Subscription;
  
  // RDF-specific conveniences
  getURI(): string;
  getType(): string;
  getProperties(): Property[];
  followLink(property): RDFHandle;
}
```

### 3. RDFConverter

Handles bidirectional conversion between Handle entities and RDF triples.

**Responsibilities:**
- Convert Handle entities to RDF triples
- Convert RDF triples to Handle entities
- Map Handle schemas to RDF ontologies
- Preserve types during conversion
- Handle cardinality (one/many) correctly

**Interface:**
```javascript
class RDFConverter {
  constructor(namespaceManager);
  
  // Entity → RDF
  entityToTriples(entity, entityId): Triple[];
  schemaToOntology(schema): RDFOntology;
  
  // RDF → Entity
  triplesToEntity(triples, entityId): Entity;
  ontologyToSchema(ontology): Schema;
  
  // Type mapping
  jsTypeToRDF(value): RDFLiteral;
  rdfToJSType(literal): any;
}
```

### 4. RDFSchemaExtractor

Extracts Handle-compatible schema information from RDF ontologies.

**Responsibilities:**
- Parse RDFS/OWL ontologies
- Map RDF properties to Handle attributes
- Extract cardinality constraints
- Identify entity types (rdf:type, owl:Class)
- Build schema object for Handle introspection

**Interface:**
```javascript
class RDFSchemaExtractor {
  constructor(tripleStore, namespaceManager);
  
  extractSchema(): Schema;
  getEntityTypes(): string[];
  getPropertiesForType(typeURI): Property[];
  getPropertyCardinality(propertyURI): 'one' | 'many';
  getPropertyRange(propertyURI): string;
  getPropertyDomain(propertyURI): string;
}
```

## Data Flow

### Import Flow: RDF → Handle System

```
1. RDF File (Turtle/N-Triples/JSON-LD)
   ↓
2. RDFParser.parse(rdfString, format)
   ↓
3. Triples added to TripleStore
   ↓
4. RDFDataSource wraps TripleStore
   ↓
5. RDFHandle provides Handle interface
   ↓
6. Application queries/subscribes via Handle API
```

**Example:**
```javascript
// Import RDF data
const rdfData = `
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix : <http://example.org/> .

:alice a foaf:Person ;
  foaf:name "Alice Smith" ;
  foaf:age 30 ;
  foaf:knows :bob .
`;

const dataSource = new RDFDataSource(tripleStore, namespaceManager);
dataSource.importRDF(rdfData, 'turtle');

// Access as Handle
const aliceHandle = new RDFHandle(dataSource, 'http://example.org/alice');
const alice = aliceHandle.value();
// Returns: { type: 'foaf:Person', name: 'Alice Smith', age: 30, knows: ['http://example.org/bob'] }
```

### Export Flow: Handle System → RDF

```
1. Application entities (Handle-based)
   ↓
2. RDFConverter.entityToTriples(entity)
   ↓
3. Triples added to TripleStore
   ↓
4. RDFSerializer.serialize(triples, format)
   ↓
5. RDF File (Turtle/N-Triples/JSON-LD)
```

**Example:**
```javascript
// Create entity using Handle system
const dataStore = createDataStore(schema);
const userId = dataStore.add({
  'user/name': 'Alice Smith',
  'user/email': 'alice@example.com',
  'user/age': 30
});

// Export to RDF
const rdfDataSource = new RDFDataSource(tripleStore, namespaceManager);
const converter = new RDFConverter(namespaceManager);

const triples = converter.entityToTriples(
  dataStore.entity(userId).value(),
  `http://example.org/user/${userId}`
);

triples.forEach(t => tripleStore.addTriple(...t));
const rdfOutput = rdfDataSource.exportRDF('turtle');
```

### Live Updates: Subscriptions

```
1. Application subscribes via RDFHandle
   ↓
2. RDFDataSource.subscribe() registers callback
   ↓
3. TripleStore watches for changes
   ↓
4. Triple added/removed
   ↓
5. TripleStore notifies subscribers
   ↓
6. RDFDataSource translates to entity changes
   ↓
7. Application callback invoked with changes
```

## Query Translation

### Handle Query → Triple Pattern

**Simple property query:**
```javascript
// Handle query
query({ 
  find: ['?entity'],
  where: [['?entity', 'name', 'Alice']]
})

// Triple pattern
tripleStore.query(null, 'foaf:name', 'Alice')
```

**Type query:**
```javascript
// Handle query
query({
  find: ['?entity'],
  where: [['?entity', 'type', 'Person']]
})

// Triple pattern
tripleStore.query(null, 'rdf:type', 'foaf:Person')
```

**Relationship query:**
```javascript
// Handle query
query({
  find: ['?person', '?friend'],
  where: [
    ['?person', 'name', 'Alice'],
    ['?person', 'knows', '?friend']
  ]
})

// Executed as:
1. tripleStore.query(null, 'foaf:name', 'Alice') → get Alice's ID
2. tripleStore.query(aliceId, 'foaf:knows', null) → get friends
```

## Type Mapping

### JavaScript Types → RDF Literals

| JS Type | RDF Type |
|---------|----------|
| string | xsd:string |
| number (integer) | xsd:integer |
| number (float) | xsd:decimal |
| boolean | xsd:boolean |
| Date | xsd:dateTime |
| null | - (omitted) |

### RDF Properties → Handle Attributes

**Single-valued (cardinality one):**
```javascript
// RDF: :alice foaf:name "Alice Smith" .
// Handle: { name: "Alice Smith" }
```

**Multi-valued (cardinality many):**
```javascript
// RDF: :alice foaf:knows :bob, :charlie .
// Handle: { knows: [':bob', ':charlie'] }
```

**Object properties (references):**
```javascript
// RDF: :alice foaf:knows :bob .
// Handle: { knows: 'http://example.org/bob' } // Entity reference
```

## Schema Extraction

### RDFS/OWL → Handle Schema

**RDF Ontology:**
```turtle
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix : <http://example.org/ontology#> .

:Person a owl:Class .
:name a owl:DatatypeProperty ;
  rdfs:domain :Person ;
  rdfs:range xsd:string .
:age a owl:DatatypeProperty ;
  rdfs:domain :Person ;
  rdfs:range xsd:integer .
:knows a owl:ObjectProperty ;
  rdfs:domain :Person ;
  rdfs:range :Person .
```

**Extracted Handle Schema:**
```javascript
{
  'Person/name': {
    type: 'string',
    cardinality: 'one'
  },
  'Person/age': {
    type: 'number',
    cardinality: 'one'
  },
  'Person/knows': {
    type: 'ref',
    cardinality: 'many',
    ref: 'Person'
  }
}
```

## Namespace Management

### Built-in Namespaces

Standard RDF/RDFS/OWL namespaces are pre-configured:
- `rdf:` - http://www.w3.org/1999/02/22-rdf-syntax-ns#
- `rdfs:` - http://www.w3.org/2000/01/rdf-schema#
- `owl:` - http://www.w3.org/2002/07/owl#
- `xsd:` - http://www.w3.org/2001/XMLSchema#

Common vocabularies:
- `foaf:` - http://xmlns.com/foaf/0.1/
- `schema:` - https://schema.org/
- `dc:` - http://purl.org/dc/elements/1.1/

### Custom Namespaces

```javascript
const dataSource = new RDFDataSource(tripleStore, namespaceManager);
dataSource.addNamespace('myapp', 'http://myapp.example.com/ontology#');

// Now can use: 'myapp:User', 'myapp:name', etc.
```

## API Examples

### Creating RDF Handles

```javascript
import { RDFDataSource, RDFHandle } from '@legion/rdf';
import { createInMemoryTripleStore } from '@legion/triplestore';

// Create triple store and data source
const tripleStore = createInMemoryTripleStore();
const dataSource = new RDFDataSource(tripleStore);

// Import RDF data
dataSource.importRDF(turtleData, 'turtle');

// Create Handle for specific entity
const personHandle = new RDFHandle(dataSource, 'http://example.org/alice');

// Get entity value
const person = personHandle.value();
console.log(person.name); // "Alice Smith"
```

### Querying RDF Data

```javascript
// Query via DataSource
const results = dataSource.query({
  find: ['?person', '?name'],
  where: [
    ['?person', 'rdf:type', 'foaf:Person'],
    ['?person', 'foaf:name', '?name'],
    ['?person', 'foaf:age', '?age']
  ],
  filter: (bindings) => bindings['?age'] >= 18
});

// Query via Handle
const adults = personHandle.query({
  find: ['?person'],
  where: [['?person', 'foaf:age', '?age']],
  filter: (bindings) => bindings['?age'] >= 18
});
```

### Subscribing to Changes

```javascript
// Subscribe to entity changes
const subscription = personHandle.subscribe((changes) => {
  console.log('Person changed:', changes);
  console.log('New name:', changes.name);
});

// Subscribe to query results
const querySubscription = dataSource.subscribe(
  {
    find: ['?person'],
    where: [['?person', 'rdf:type', 'foaf:Person']]
  },
  (results) => {
    console.log('Person collection updated:', results);
  }
);

// Clean up
subscription.unsubscribe();
querySubscription.unsubscribe();
```

### Exporting to RDF

```javascript
// Export entire triple store
const turtleOutput = dataSource.exportRDF('turtle');
const jsonldOutput = dataSource.exportRDF('jsonld');
const ntriplesOutput = dataSource.exportRDF('ntriples');

// Export specific entity
const entityTriples = dataSource.query({
  find: ['?s', '?p', '?o'],
  where: [
    ['?s', '?p', '?o'],
    ['?s', '=', 'http://example.org/alice']
  ]
});
```

### Converting Handle Entities

```javascript
import { RDFConverter } from '@legion/rdf';

const converter = new RDFConverter(namespaceManager);

// Convert Handle entity to triples
const entity = {
  ':db/id': 123,
  'user/name': 'Alice Smith',
  'user/email': 'alice@example.com',
  'user/age': 30
};

const triples = converter.entityToTriples(entity, 'http://example.org/alice');
// Returns: [
//   ['http://example.org/alice', 'rdf:type', 'user:User'],
//   ['http://example.org/alice', 'user:name', 'Alice Smith'],
//   ['http://example.org/alice', 'user:email', 'alice@example.com'],
//   ['http://example.org/alice', 'user:age', 30]
// ]

// Convert triples back to entity
const reconstituted = converter.triplesToEntity(triples, 'http://example.org/alice');
```

### Working with Schemas

```javascript
import { RDFSchemaExtractor } from '@legion/rdf';

const schemaExtractor = new RDFSchemaExtractor(tripleStore, namespaceManager);

// Extract schema from ontology
const schema = schemaExtractor.extractSchema();

// Get entity types
const types = schemaExtractor.getEntityTypes();
// Returns: ['foaf:Person', 'foaf:Organization', ...]

// Get properties for type
const personProps = schemaExtractor.getPropertiesForType('foaf:Person');
// Returns: [
//   { name: 'foaf:name', type: 'string', cardinality: 'one' },
//   { name: 'foaf:age', type: 'number', cardinality: 'one' },
//   { name: 'foaf:knows', type: 'ref', cardinality: 'many' }
// ]
```

## Use Cases

### 1. Import External RDF Data

```javascript
// Load DBpedia data
const dbpediaData = await fetch('http://dbpedia.org/resource/Albert_Einstein.ttl');
const rdfString = await dbpediaData.text();

dataSource.importRDF(rdfString, 'turtle');

const einstein = new RDFHandle(dataSource, 'http://dbpedia.org/resource/Albert_Einstein');
console.log(einstein.value());
```

### 2. Export Knowledge Graph

```javascript
// Build KG using Handle system
const store = createDataStore(schema);
store.add({ 'user/name': 'Alice', 'user/age': 30 });
store.add({ 'user/name': 'Bob', 'user/age': 25 });

// Convert to RDF and export
const rdfDataSource = createRDFDataSourceFromHandles(store);
const turtleOutput = rdfDataSource.exportRDF('turtle');

// Save to file
fs.writeFileSync('knowledge-graph.ttl', turtleOutput);
```

### 3. Integrate with Vocabulary

```javascript
// Use Schema.org vocabulary
dataSource.addNamespace('schema', 'https://schema.org/');

const article = {
  'schema:headline': 'Breaking News',
  'schema:author': 'http://example.org/alice',
  'schema:datePublished': new Date('2024-01-15'),
  'schema:articleBody': 'Article content here...'
};

const articleId = 'http://example.org/article/1';
const triples = converter.entityToTriples(article, articleId);
triples.forEach(t => tripleStore.addTriple(...t));
```

### 4. Persistent Storage with RDF

```javascript
import { createFileSystemTripleStore } from '@legion/triplestore';

// Create persistent triple store with RDF format
const tripleStore = createFileSystemTripleStore({
  dataSource: new LocalFileSystemDataSource('./data'),
  filePath: 'knowledge-graph.ttl',
  autoSave: true
});

const dataSource = new RDFDataSource(tripleStore);

// Changes automatically persisted to Turtle file
const handle = new RDFHandle(dataSource, entityId);
handle.value().name = 'Updated Name'; // Automatically saved
```

## Implementation Notes

### Synchronous Operations

All RDFDataSource and RDFHandle operations follow the Handle pattern's synchronous model:

```javascript
// All these operations are synchronous
const value = handle.value(); // No await
const results = dataSource.query(spec); // No await
const sub = dataSource.subscribe(spec, cb); // No await
```

### Error Handling

Fail-fast principle applies - operations throw immediately on error:

```javascript
// Invalid RDF throws immediately
try {
  dataSource.importRDF('invalid rdf', 'turtle');
} catch (error) {
  console.error('Import failed:', error);
}

// No fallback behavior - errors propagate
```

### Memory Management

RDFHandle manages subscription lifecycle:

```javascript
const handle = new RDFHandle(dataSource, entityId);
const sub = handle.subscribe(callback);

// Clean up
sub.unsubscribe();
handle.destroy(); // Cleans up all subscriptions
```

### Type Safety

Types are preserved through conversions:

```javascript
// JavaScript types maintained
const entity = { age: 30, active: true, score: 3.14 };
const triples = converter.entityToTriples(entity, uri);

// Round-trip preserves types
const restored = converter.triplesToEntity(triples, uri);
console.log(typeof restored.age); // 'number'
console.log(typeof restored.active); // 'boolean'
console.log(typeof restored.score); // 'number'
```

## Integration with Legion Ecosystem

### With @legion/triplestore

RDF package is built on top of triplestore:

```javascript
import { createInMemoryTripleStore } from '@legion/triplestore';
import { RDFDataSource } from '@legion/rdf';

const store = createInMemoryTripleStore();
const dataSource = new RDFDataSource(store);
```

### With @legion/handle

RDFHandle extends Handle base class:

```javascript
import { Handle } from '@legion/handle';
import { RDFHandle } from '@legion/rdf';

// RDFHandle IS-A Handle
const handle = new RDFHandle(dataSource, entityId);
handle instanceof Handle; // true

// Works with Handle ecosystem
handle.getIntrospectionInfo();
handle.receive({ type: 'query', querySpec });
```

### With @legion/data-proxies

RDF data works with proxy pattern:

```javascript
import { DataStoreProxy } from '@legion/data-proxies';

// Create proxy over RDF data source
const proxy = new DataStoreProxy(rdfDataSource);

// Access entities with property syntax
const person = proxy.entity('http://example.org/alice');
person.name = 'New Name'; // Updates RDF triple store
```

### With @legion/handle-dsl

RDF data supports DSL queries:

```javascript
import { query } from '@legion/handle-dsl';

const results = dataSource.query(query`
  find all Person
  where age >= 18
  return name, email
`);
```