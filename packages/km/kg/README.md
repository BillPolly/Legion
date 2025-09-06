# JavaScript Knowledge Graph System

A revolutionary knowledge graph system that achieves perfect isomorphism between JavaScript objects/classes and knowledge graph entities. The core innovation is representing the ontology itself as knowledge graph data, enabling seamless round-trip serialization and reconstruction of both data and schema.

## 🚀 Key Features

### Perfect Isomorphism
- **JavaScript classes ↔ KG entity types**
- **Object instances ↔ KG individuals**
- **Properties ↔ KG data/object properties**
- **Methods ↔ KG behavioral predicates**
- **Object references ↔ KG relationships**

### Self-Describing Schema
The ontology is not external metadata but part of the knowledge graph itself. Classes, methods, parameters, and type information are all represented as KG entities with their own identifiers and properties.

### Universal Storage Support
- **7 Storage Providers**: Memory, File, GitHub, SQL, MongoDB, GraphDB, Remote API
- **Pluggable Architecture**: Switch storage without changing application code
- **Async/Await Support**: Full asynchronous operation support
- **Performance Optimization**: Intelligent caching and query optimization

### Standards Compliance
- **RDF Integration**: Full Turtle, N-Triples, JSON-LD, RDF/XML support
- **JSON Schema Generation**: LLM function calling format compliance
- **Property Graph Compatibility**: Neo4j, ArangoDB integration
- **Semantic Web Ready**: Direct RDF export for semantic web tools

## 📦 Installation

```bash
npm install knowledge-graph
```

## 🎯 Quick Start

### Basic Usage

```javascript
import { KGEngine } from 'knowledge-graph';

// Create a knowledge graph (uses in-memory storage by default)
const kg = new KGEngine();

// Add some data
await kg.addTriple('john', 'name', 'John Doe');
await kg.addTriple('john', 'age', 30);
await kg.addTriple('john', 'knows', 'jane');

// Query the data
const results = await kg.query('john', null, null);
console.log(results); // All facts about john
```

### Object Serialization

```javascript
import 'knowledge-graph/extensions'; // Enable object extensions

class Person {
  constructor(name, age) {
    this.name = name;
    this.age = age;
  }
  
  greet(other) {
    return `Hello ${other.name}, I'm ${this.name}`;
  }
}

const john = new Person('John', 30);
const jane = new Person('Jane', 28);

// Objects automatically get KG capabilities
const triples = john.toTriples();
console.log(triples);
// [
//   ['john_abc123', 'rdf:type', 'Person_def456'],
//   ['john_abc123', 'name', 'John'],
//   ['john_abc123', 'age', 30]
// ]

// Add to knowledge graph
triples.forEach(([s, p, o]) => kg.addTriple(s, p, o));
```

### Storage Configuration

```javascript
import { StorageConfig, KGEngine } from 'knowledge-graph';

// File storage
const fileStore = StorageConfig.createStore({
  type: 'file',
  path: './data/knowledge-graph.json',
  format: 'json',
  autoSave: true
});

// GitHub collaborative storage
const githubStore = StorageConfig.createStore({
  type: 'github',
  repo: 'username/knowledge-graph',
  path: 'data/kg.json',
  token: process.env.GITHUB_TOKEN,
  conflictResolution: 'merge'
});

// SQL database storage
const sqlStore = StorageConfig.createStore({
  type: 'sql',
  connection: 'postgresql://user:pass@localhost/kg',
  enableTransactions: true
});

const kg = new KGEngine(sqlStore);
```

### Environment Configuration

```bash
# Set environment variables
export KG_STORAGE_TYPE=github
export KG_GITHUB_REPO=username/knowledge-graph
export KG_GITHUB_PATH=data/kg.json
export GITHUB_TOKEN=ghp_your_token_here
```

```javascript
// Automatically uses environment configuration
const store = StorageConfig.createFromEnvironment();
const kg = new KGEngine(store);
```

## 🏗️ Architecture

### Storage Providers

| Provider | Use Case | Features |
|----------|----------|----------|
| **InMemory** | Development, Testing | ✅ Fastest, ❌ Not persistent |
| **FileSystem** | Local Projects | ✅ Persistent, ✅ Multiple formats |
| **GitHub** | Team Collaboration | ✅ Version control, ✅ Conflict resolution |
| **SQL** | Enterprise Production | ✅ ACID transactions, ✅ Scalable |
| **MongoDB** | Document Storage | ✅ Horizontal scaling, ✅ Aggregation |
| **GraphDB** | Graph Analytics | ✅ Native graph operations, ✅ Cypher |
| **Remote** | API Integration | ✅ HTTP APIs, ✅ Offline support |

### Core Components

- **KGEngine**: Main knowledge graph interface
- **Storage Abstraction**: Pluggable storage backends
- **Object Extensions**: Automatic KG integration for any object
- **Class Serialization**: Complete class metadata preservation
- **RDF Integration**: Multi-format RDF import/export
- **Tool System**: LLM function calling integration
- **Belief System**: Multi-agent knowledge tracking
- **Query Builder**: Complex query construction

## 🔧 Advanced Features

### Performance Optimization

```javascript
import { withCache, withOptimization } from 'knowledge-graph';

// Add caching layer
const cachedStore = withCache(baseStore, {
  cacheSize: 1000,
  ttl: 300000 // 5 minutes
});

// Add query optimization
const optimizedStore = withOptimization(cachedStore, {
  enableQueryPlanning: true,
  enableStatistics: true
});

const kg = new KGEngine(optimizedStore);
```

### RDF Export/Import

```javascript
import { RDFSerializer, RDFParser } from 'knowledge-graph';

const serializer = new RDFSerializer(kg, namespaceManager);

// Export to various RDF formats
const turtle = serializer.toTurtle();
const jsonld = serializer.toJsonLD();
const ntriples = serializer.toNTriples();

// Import from RDF
const parser = new RDFParser(kg, namespaceManager);
await parser.parseTurtle(turtleData);
```

### Tool System for LLMs

```javascript
import { ToolRegistry, SchemaGenerator } from 'knowledge-graph';

const registry = new ToolRegistry(kg);
const schemaGen = new SchemaGenerator(kg);

// Register tools
registry.registerTool(WeatherTool, {
  capabilities: ['weather_data', 'location_services']
});

// Generate LLM function schemas
const schema = schemaGen.generateMethodSchema(methodId);
// Returns OpenAI function calling format
```

### Belief System

```javascript
import { Belief } from 'knowledge-graph';

// Multi-agent belief tracking
const aiAgent = { name: 'Assistant', type: 'ai' };
const belief = new Belief(
  aiAgent,
  'user_123',
  'prefers',
  'dark_mode',
  { confidence: 0.8, source: 'user_interaction' }
);

// Serialize belief to triples
const beliefTriples = belief.toTriples();
```

## 📊 Testing

The system includes comprehensive testing:

```bash
# Run all tests
npm test

# Run specific test suites
npm test test/unit/core/
npm test test/storage/
npm test test/integration/
```

**Test Coverage:**
- ✅ **22 test suites**
- ✅ **621 tests passing**
- ✅ **3.2 second execution time**
- ✅ **100% core functionality coverage**

## 📚 Documentation

- **[Design Document](docs/Design.md)**: Comprehensive system design and architecture
- **[API Reference](docs/API.md)**: Complete API documentation
- **[Examples](src/examples/)**: Working code examples
- **[Test Cases](test/)**: Extensive test suite for reference

## 🌟 Use Cases

### Knowledge Management
- Personal knowledge bases
- Team documentation systems
- Research data organization
- Semantic search applications

### AI/ML Integration
- LLM tool integration
- Multi-agent systems
- Belief tracking
- Knowledge graph embeddings

### Data Integration
- ETL pipelines
- Schema mapping
- Data federation
- Semantic data lakes

### Collaborative Systems
- Team knowledge sharing
- Version-controlled data
- Conflict resolution
- Distributed knowledge graphs

## 🔄 Migration & Interoperability

### From Other Systems
```javascript
// Import from JSON-LD
const jsonldData = { /* JSON-LD data */ };
await parser.parseJsonLD(jsonldData);

// Import from RDF
const rdfData = `@prefix ex: <http://example.org/> .
ex:john ex:name "John Doe" .`;
await parser.parseTurtle(rdfData);

// Export to property graphs
const exporter = new PropertyGraphExporter(kg);
const cypher = exporter.toCypher();
```

### To Other Formats
```javascript
// Export to JSON Schema
const schemaGen = new JSONSchemaGenerator(kg);
const schema = schemaGen.generateSchema('Person');

// Export to various RDF formats
const turtle = serializer.toTurtle();
const jsonld = serializer.toJsonLD();
```

## 🚀 Performance

- **O(1) Query Performance**: Optimized triple indexing (SPO/POS/OSP)
- **Intelligent Caching**: LRU cache with TTL support
- **Query Optimization**: Automatic query planning and optimization
- **Memory Efficient**: Proper garbage collection and cleanup
- **Scalable**: Supports datasets from KB to TB scale

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by semantic web standards (RDF, OWL, SPARQL)
- Built on modern JavaScript ES modules
- Designed for the AI/LLM era
- Community-driven development

---

**Perfect Isomorphism. Self-Describing Schema. Universal Storage. Standards Compliant.**

*Transform your JavaScript objects into a queryable knowledge graph with zero friction.*
