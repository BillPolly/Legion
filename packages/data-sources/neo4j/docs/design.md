# Neo4j Graph Database DataSource - Design Document

## Overview

The Neo4j DataSource package provides a Handle-based interface to Neo4j graph databases, exposing full graph database capabilities through Legion's standard DataSource/Handle pattern. This implementation enables direct graph database operations while maintaining compatibility with existing Legion patterns like the TripleStore.

## Core Concepts

### Graph Database Model

Neo4j uses the labeled property graph model consisting of:
- **Nodes**: Entities with labels and properties
- **Relationships**: Directed connections between nodes with types and properties
- **Labels**: Node categories (e.g., Person, Company)
- **Properties**: Key-value pairs on nodes and relationships

### Handle/DataSource Architecture

Following Legion's patterns, this package provides:
- **DataSource**: Synchronous interface to Neo4j operations
- **Handles**: Proxy objects representing graph elements
- **Query Builders**: Fluent API for constructing Cypher queries
- **Subscriptions**: Change detection through transaction logs

## Architecture

### Package Structure

```
neo4j/
├── src/
│   ├── datasources/
│   │   └── Neo4jDataSource.js      # Main DataSource implementation
│   ├── handles/
│   │   ├── GraphDatabaseHandle.js  # Root database handle
│   │   ├── NodeHandle.js           # Graph node representation
│   │   ├── RelationshipHandle.js   # Graph edge representation
│   │   ├── PathHandle.js           # Query path results
│   │   ├── QueryResultHandle.js    # Query result wrapper
│   │   └── TransactionHandle.js    # Transaction context
│   ├── query/
│   │   ├── CypherQueryBuilder.js   # Cypher query construction
│   │   └── PatternMatcher.js       # Graph pattern matching
│   └── utils/
│       ├── Neo4jConnectionPool.js  # Connection management
│       └── TypeMapper.js           # Neo4j ↔ JavaScript type conversion
```

### DataSource Implementation

The `Neo4jDataSource` class implements Legion's DataSource interface with synchronous methods that internally manage asynchronous Neo4j operations through caching and queueing.

```javascript
class Neo4jDataSource {
  constructor(neo4jServer) {
    // Neo4j server handle from ResourceManager
    this.server = neo4jServer;
    this.uri = neo4jServer.uri;
    this.auth = neo4j.auth.basic(neo4jServer.user, neo4jServer.password);
    this.driver = neo4j.driver(this.uri, this.auth);
    
    // Internal cache for synchronous operations
    this._cache = new Map();
    this._subscriptions = new Map();
  }
  
  // Required DataSource methods (all synchronous)
  query(querySpec) { /* ... */ }
  subscribe(querySpec, callback) { /* ... */ }
  getSchema() { /* ... */ }
  update(updateSpec) { /* ... */ }
  validate(data) { /* ... */ }
}
```

## Handle Hierarchy

### GraphDatabaseHandle

Root handle providing database-level operations:

```javascript
class GraphDatabaseHandle extends Handle {
  // Node operations
  createNode(labels, properties) → NodeHandle
  findNode(labels, properties) → NodeHandle
  findNodes(labels, filter) → NodeHandle[]
  
  // Relationship operations
  createRelationship(fromNode, toNode, type, properties) → RelationshipHandle
  findRelationship(type, properties) → RelationshipHandle
  
  // Query operations
  query(cypher, parameters) → QueryResultHandle
  match(pattern) → PathHandle[]
  
  // Schema operations
  labels() → string[]
  relationshipTypes() → string[]
  constraints() → Constraint[]
  indexes() → Index[]
  
  // Transaction operations
  beginTransaction() → TransactionHandle
}
```

### NodeHandle

Represents a graph node with its properties and connections:

```javascript
class NodeHandle extends Handle {
  // Property access
  value() → { properties }
  get(propertyName) → any
  set(propertyName, value) → NodeHandle
  
  // Label operations
  labels() → string[]
  hasLabel(label) → boolean
  addLabel(label) → NodeHandle
  removeLabel(label) → NodeHandle
  
  // Relationship navigation
  relationships(direction?, type?) → RelationshipHandle[]
  neighbors(direction?, type?) → NodeHandle[]
  degree(direction?, type?) → number
  
  // Path operations
  shortestPathTo(targetNode, maxDepth?) → PathHandle
  allPathsTo(targetNode, maxDepth?) → PathHandle[]
  
  // Mutations
  update(properties) → UpdateResult
  delete(detachRelationships?) → DeleteResult
}
```

### RelationshipHandle

Represents a directed edge between nodes:

```javascript
class RelationshipHandle extends Handle {
  // Property access
  value() → { type, properties }
  get(propertyName) → any
  set(propertyName, value) → RelationshipHandle
  
  // Type operations
  type() → string
  
  // Node access
  startNode() → NodeHandle
  endNode() → NodeHandle
  otherNode(node) → NodeHandle
  
  // Mutations
  update(properties) → UpdateResult
  delete() → DeleteResult
}
```

### PathHandle

Represents a traversal path through the graph:

```javascript
class PathHandle extends Handle {
  // Path components
  nodes() → NodeHandle[]
  relationships() → RelationshipHandle[]
  
  // Path properties
  length() → number
  startNode() → NodeHandle
  endNode() → NodeHandle
  
  // Path operations
  contains(nodeOrRelationship) → boolean
  segment(startIndex, endIndex) → PathHandle
  reverse() → PathHandle
}
```

### QueryResultHandle

Wraps query results with metadata:

```javascript
class QueryResultHandle extends Handle {
  // Result access
  value() → any[]
  records() → Record[]
  first() → Record
  
  // Result metadata
  summary() → { counters, profile, notifications }
  keys() → string[]
  
  // Iteration
  forEach(callback) → void
  map(transformer) → any[]
  filter(predicate) → QueryResultHandle
}
```

### TransactionHandle

Manages transaction context:

```javascript
class TransactionHandle extends Handle {
  // Transaction operations
  run(cypher, parameters) → QueryResultHandle
  commit() → void
  rollback() → void
  
  // Transaction state
  isOpen() → boolean
  
  // Nested operations with transaction context
  createNode(labels, properties) → NodeHandle
  createRelationship(from, to, type, properties) → RelationshipHandle
}
```

## Query Patterns

### CypherQueryBuilder

Fluent API for building Cypher queries:

```javascript
const query = new CypherQueryBuilder()
  .match('(person:Person {name: $name})')
  .where('person.age > $minAge')
  .with('person')
  .match('(person)-[:KNOWS]->(friend:Person)')
  .return(['person', 'collect(friend) as friends'])
  .orderBy('person.name')
  .limit(10)
  .build();
```

### Pattern Matching

Graph pattern specification using JavaScript objects:

```javascript
const pattern = {
  nodes: [
    { variable: 'a', labels: ['Person'], properties: { active: true } },
    { variable: 'b', labels: ['Company'] }
  ],
  relationships: [
    { from: 'a', to: 'b', type: 'WORKS_FOR', properties: { since: 2020 } }
  ]
};

const paths = graph.match(pattern);
```

## Update Operations

### Node Creation

```javascript
const person = graph.createNode(
  ['Person', 'Employee'],
  { 
    name: 'Alice Smith',
    age: 30,
    email: 'alice@example.com'
  }
);
```

### Relationship Creation

```javascript
const knows = graph.createRelationship(
  alice,  // NodeHandle
  bob,    // NodeHandle
  'KNOWS',
  { since: 2020, context: 'work' }
);
```

### Batch Operations

```javascript
const transaction = graph.beginTransaction();
try {
  const nodes = data.map(item => 
    transaction.createNode(['Item'], item)
  );
  
  nodes.forEach((node, i) => {
    if (i > 0) {
      transaction.createRelationship(
        nodes[i-1], 
        node, 
        'NEXT'
      );
    }
  });
  
  transaction.commit();
} catch (error) {
  transaction.rollback();
  throw error;
}
```

## Subscription System

### Change Detection

Subscriptions monitor graph changes through transaction logs:

```javascript
// Subscribe to node changes
const subscription = graph.subscribe(
  {
    type: 'node',
    labels: ['Person'],
    operation: ['create', 'update', 'delete']
  },
  (change) => {
    console.log('Person node changed:', change);
  }
);

// Subscribe to relationship changes
graph.subscribe(
  {
    type: 'relationship',
    relationshipType: 'KNOWS',
    operation: 'create'
  },
  (change) => {
    console.log('New KNOWS relationship:', change);
  }
);
```

## TripleStore Integration

The Neo4j DataSource can serve as a backend for the TripleStore:

```javascript
class Neo4jTripleProvider {
  constructor(graphHandle) {
    this.graph = graphHandle;
  }
  
  async addTriple(subject, predicate, object) {
    // Find or create subject node
    let subjectNode = this.graph.findNode(
      ['TripleSubject'], 
      { value: subject }
    );
    
    if (!subjectNode) {
      subjectNode = this.graph.createNode(
        ['TripleSubject'],
        { value: subject, type: typeof subject }
      );
    }
    
    // Find or create object node
    let objectNode = this.graph.findNode(
      ['TripleObject'],
      { value: object }
    );
    
    if (!objectNode) {
      objectNode = this.graph.createNode(
        ['TripleObject'],
        { value: object, type: typeof object }
      );
    }
    
    // Create relationship
    this.graph.createRelationship(
      subjectNode,
      objectNode,
      predicate,
      { timestamp: Date.now() }
    );
  }
  
  async query(subject, predicate, object) {
    const pattern = this.buildCypherPattern(subject, predicate, object);
    const result = this.graph.query(pattern);
    return this.extractTriples(result);
  }
}
```

## Configuration

The ResourceManager automatically manages the Neo4j Docker container and provides connection details:

```javascript
// ResourceManager handles all Neo4j setup internally
const resourceManager = await ResourceManager.getInstance();
const neo4jServer = await resourceManager.getNeo4jServer();
// Returns: { uri, user, password, database }
```

Environment variables (optional overrides in .env):

```bash
# Neo4j connection settings (ResourceManager defaults if not set)
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
NEO4J_DATABASE=neo4j

# Connection pool settings
NEO4J_MAX_CONNECTION_POOL_SIZE=50
NEO4J_CONNECTION_TIMEOUT=30000

# Query settings
NEO4J_MAX_TRANSACTION_RETRY_TIME=30000
```

## Usage Examples

### Basic Graph Operations

```javascript
import { ResourceManager } from '@legion/resource-manager';
import { Neo4jDataSource, GraphDatabaseHandle } from '@legion/neo4j';

// ResourceManager automatically manages Neo4j Docker container
const resourceManager = await ResourceManager.getInstance();
const neo4jServer = await resourceManager.getNeo4jServer();
// Neo4j Docker container is now running if it wasn't already

// Create DataSource using ResourceManager-provided server
const dataSource = new Neo4jDataSource(neo4jServer);
const graph = new GraphDatabaseHandle(dataSource);

// Create a social graph
const alice = graph.createNode(['Person'], { name: 'Alice', age: 30 });
const bob = graph.createNode(['Person'], { name: 'Bob', age: 25 });
const charlie = graph.createNode(['Person'], { name: 'Charlie', age: 35 });

graph.createRelationship(alice, bob, 'KNOWS', { since: 2020 });
graph.createRelationship(bob, charlie, 'KNOWS', { since: 2019 });
graph.createRelationship(alice, charlie, 'WORKS_WITH');
```

### Graph Traversal

```javascript
// Find all friends of Alice
const aliceFriends = alice.neighbors('outgoing', 'KNOWS');

// Find shortest path between Alice and Charlie
const path = alice.shortestPathTo(charlie);
console.log(`Path length: ${path.length()}`);
console.log(`Path nodes: ${path.nodes().map(n => n.get('name'))}`);

// Find all paths up to depth 3
const allPaths = alice.allPathsTo(charlie, 3);
console.log(`Found ${allPaths.length} paths`);
```

### Complex Queries

```javascript
// Using CypherQueryBuilder
const query = new CypherQueryBuilder()
  .match('(person:Person)')
  .where('person.age >= $minAge')
  .match('(person)-[:KNOWS]->(friend:Person)')
  .with('person, count(friend) as friendCount')
  .where('friendCount > $minFriends')
  .return('person.name as name, friendCount')
  .orderBy('friendCount DESC')
  .build();

const result = graph.query(query, { 
  minAge: 25, 
  minFriends: 2 
});

// Using pattern matching
const pattern = {
  nodes: [
    { variable: 'a', labels: ['Person'] },
    { variable: 'b', labels: ['Person'] },
    { variable: 'c', labels: ['Person'] }
  ],
  relationships: [
    { from: 'a', to: 'b', type: 'KNOWS' },
    { from: 'b', to: 'c', type: 'KNOWS' }
  ]
};

const triangles = graph.match(pattern);
```

### Using as TripleStore Backend

```javascript
import { createTripleStore } from '@legion/triplestore';

// Create triple store with Neo4j backend
const tripleStore = createTripleStore('neo4j', {
  graphHandle: graph
});

// Use as triple store
await tripleStore.addTriple('john', 'knows', 'jane');
await tripleStore.addTriple('john', 'age', 42);

const results = await tripleStore.query('john', null, null);
```

## Error Handling

All operations follow Legion's fail-fast principle:

```javascript
class Neo4jConnectionError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'Neo4jConnectionError';
    this.cause = cause;
  }
}

class CypherSyntaxError extends Error {
  constructor(query, message) {
    super(`Invalid Cypher query: ${message}`);
    this.name = 'CypherSyntaxError';
    this.query = query;
  }
}

class ConstraintViolationError extends Error {
  constructor(constraint, message) {
    super(`Constraint violation: ${message}`);
    this.name = 'ConstraintViolationError';
    this.constraint = constraint;
  }
}
```

## Testing Strategy

Testing follows TDD methodology with Jest:

```javascript
// Unit tests for Handles
describe('NodeHandle', () => {
  it('should create node with labels and properties', () => {
    const node = graph.createNode(['Person'], { name: 'Test' });
    expect(node.labels()).toContain('Person');
    expect(node.get('name')).toBe('Test');
  });
});

// Integration tests with real Neo4j
describe('Neo4j Integration', () => {
  beforeEach(async () => {
    await graph.query('MATCH (n) DETACH DELETE n');
  });
  
  it('should perform graph traversals', () => {
    // Test with real database operations
  });
});
```

## Type Safety

TypeScript definitions for all Handles and operations:

```typescript
interface IGraphDatabaseHandle {
  createNode(labels: string[], properties: object): INodeHandle;
  findNode(labels: string[], properties: object): INodeHandle | null;
  query(cypher: string, parameters?: object): IQueryResultHandle;
}

interface INodeHandle extends IHandle {
  labels(): string[];
  neighbors(direction?: Direction, type?: string): INodeHandle[];
  update(properties: object): UpdateResult;
}
```

---

This design provides a complete graph database integration following Legion's Handle/DataSource patterns while exposing full Neo4j capabilities. The synchronous DataSource interface maintains compatibility with the Actor pattern while internally managing Neo4j's asynchronous operations.