# @legion/wordnet

WordNet Foundational Ontology Loader with Handle-based Architecture - A modular system for loading WordNet data using triple store patterns and data source abstraction.

## 🎯 Project Status: Handle Migration Complete ✅

**Current Version:** 1.0.0  
**Architecture:** Handle-based with TripleStoreDataSource abstraction  
**Migration Status:** Successfully migrated from deprecated @legion/kg to modern Handle patterns

### ✅ Current Achievements

- **Handle-based Architecture**: Complete migration to TripleStoreDataSource pattern
- **Triple Store Abstraction**: Universal storage layer supporting multiple implementations
- **WordNet Processing**: Comprehensive synset and relationship processing
- **Foundational Ontology**: Automatic categorization into Entity/Process/Property/Relation hierarchies
- **ID Generation**: Robust entity and relationship ID management
- **FAIL FAST Approach**: No fallbacks or mock implementations - real components only

## 🏗️ Architecture Overview

### Core Components

The project is organized into well-defined modules using Handle-based patterns:

```
src/
├── index.js                           # Main entry point
├── config/
│   └── default.js                     # Configuration management
├── wordnet/
│   └── WordNetAccess.js              # WordNet data access wrapper
├── processors/
│   ├── SynsetProcessor.js            # Converts synsets using DataSource
│   └── RelationshipProcessor.js      # Processes relationships through DataSource
├── hierarchy/
│   └── HierarchyBuilder.js           # Builds hierarchies with Handle patterns
├── loader/
│   └── WordNetFoundationalLoader.js  # Main orchestrator with TripleStoreDataSource
├── storage/
│   └── MongoDBTripleStore.js         # MongoDB triple store adapter
├── utils/
│   └── idGenerator.js                # ID generation utilities
└── scripts/
    └── validate-ontology.js          # Validation utilities
```

### Processing Pipeline

```
WordNet Data → SynsetProcessor → RelationshipProcessor → 
HierarchyBuilder → TripleStoreDataSource → Storage
```

## 🎯 Key Features

- **Handle-based Architecture**: Modern data access patterns with DataSource abstraction
- **Triple Store Integration**: Universal storage layer supporting multiple backends
- **Two-Tier Ontology**: Clean separation between concepts (meanings) and words (textual forms)
- **Polysemy Support**: Proper handling of words with multiple meanings
- **Foundational Classification**: Automatic categorization into Entity/Process/Property/Relation
- **Comprehensive Relationships**: IS-A, PART-OF, HAS-PART, and similarity relationships
- **MongoDB Adapter**: Custom triple store implementation using @legion/storage
- **Batch Processing**: Efficient loading of large WordNet datasets
- **Statistics Tracking**: Detailed metrics throughout the loading process
- **Validation Framework**: Multi-level validation with cycle detection

## 🚀 Quick Start

### Installation

```bash
# Install from workspace root
npm install @legion/wordnet
```

### Basic Usage

```javascript
import { WordNetFoundationalLoader } from '@legion/wordnet';

// Initialize with Handle-based architecture
const loader = new WordNetFoundationalLoader();
await loader.initialize();

// Load WordNet ontology
const results = await loader.loadFoundationalOntology();

if (results.success) {
  console.log(`Loaded ${results.conceptsLoaded} concepts`);
  console.log(`Created ${results.wordsCreated} word forms`);
  console.log(`Generated ${results.totalTriples} triples`);
}
```

### With Custom DataSource

```javascript
import { WordNetFoundationalLoader } from '@legion/wordnet';
import { TripleStoreDataSource } from '@legion/triplestore';

// Use with custom triple store
const tripleStore = new MongoDBTripleStore({
  uri: 'mongodb://localhost:27017',
  database: 'my_wordnet_ontology'
});

const dataSource = new TripleStoreDataSource(tripleStore);
const loader = new WordNetFoundationalLoader({ dataSource });
await loader.initialize();
```

### Command Line Usage

```bash
# Load full WordNet ontology (production mode)
npm run load

# Load limited dataset for testing
npm run load-test

# Validate existing ontology
npm run validate
```

### Running Tests

```bash
# Run all tests with Jest
npm test

# Run with watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

### Validation

```javascript
import { validateOntology } from '@legion/wordnet';

const validationResult = await validateOntology();
console.log('Ontology is valid:', validationResult.isValid);
```

## 🔧 Configuration

### Loader Configuration

```javascript
const config = {
  tripleStore: {
    uri: 'mongodb://localhost:27017',
    database: 'foundational_ontology',
    collection: 'triples'
  },
  loading: {
    batchSize: 1000,           // Synsets per batch
    maxConcurrentRequests: 10, // Concurrent processing
    enableValidation: true,    // Enable validation steps
    createIndices: true,       // Create database indices
    logInterval: 100          // Progress logging frequency
  },
  wordnet: {
    maxSynsets: null,         // null = load all
    includedPos: ['n', 'v', 'a', 's', 'r'], // Parts of speech
    skipMissingDefinitions: true
  }
};

const loader = new WordNetFoundationalLoader(config);
```

### Triple Store Configuration

```javascript
import { MongoDBTripleStore } from '@legion/wordnet';

const tripleStore = new MongoDBTripleStore({
  uri: 'mongodb://localhost:27017',
  database: 'wordnet_ontology',
  collection: 'triples',
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }
});
```

## 📊 Data Structure

### Generated Triple Patterns

Using Handle-based architecture, the system generates RDF triples in object format:

### Concept Nodes (Abstract Meanings)
```javascript
{
  subject: 'wn_concept_02084071_n',
  predicate: 'rdf:type',
  object: 'kg:Concept'
}
{
  subject: 'wn_concept_02084071_n',
  predicate: 'kg:conceptType',
  object: 'wordnet:Synset'
}
{
  subject: 'wn_concept_02084071_n',
  predicate: 'kg:definition',
  object: 'a domesticated carnivorous mammal...'
}
```

### Word Nodes (Textual Forms)
```javascript
{
  subject: 'wn_word_dog_en',
  predicate: 'rdf:type',
  object: 'kg:Word'
}
{
  subject: 'wn_word_dog_en',
  predicate: 'kg:wordText',
  object: 'dog'
}
{
  subject: 'wn_word_dog_en',
  predicate: 'kg:language',
  object: 'en'
}
```

### Relationships
- **HasLabel**: Concept → Word (concept has textual label)
- **Expresses**: Word → Concept (word expresses meaning)
- **IsA**: Concept → Concept (inheritance hierarchy)
- **PartOf**: Concept → Concept (compositional relationships)

## 🔄 Loading Process

The system follows a structured 5-phase loading process using Handle-based patterns:

1. **Phase 1**: Initialize TripleStoreDataSource and processors
2. **Phase 2**: Load synsets as foundational concepts through DataSource
3. **Phase 3**: Process semantic relationships using Handle patterns
4. **Phase 4**: Build foundational hierarchy with triple store operations
5. **Phase 5**: Create indices and perform final validation

### Process Flow

```
WordNetAccess → SynsetProcessor → TripleStoreDataSource → MongoDBTripleStore
                     ↓
RelationshipProcessor → TripleStoreDataSource → Statistics & Validation
```

## 📈 Statistics and Monitoring

The system provides comprehensive statistics through Handle-compatible reporting:

```javascript
{
  success: true,
  conceptsLoaded: 8547,
  wordsCreated: 12834,
  relationshipsCreated: 15623,
  totalTriples: 89472,
  loadingTimeSeconds: 342.7,
  synsetStats: {
    processedSynsets: 8547,
    skippedSynsets: 23,
    averageProcessingTime: 45
  },
  relationshipStats: {
    hypernyms: 6234,
    hyponyms: 6234,
    meronyms: 1523,
    similarTo: 1632
  },
  tripleStoreStats: {
    connection: 'mongodb://localhost:27017',
    database: 'foundational_ontology',
    totalSize: '45.2MB'
  }
}
```

## 🔗 Dependencies

- **@legion/triplestore**: Triple store abstraction layer
- **@legion/handle**: Handle-based data access pattern  
- **@legion/storage**: Storage provider abstraction
- **@legion/resource-manager**: Configuration and dependency management
- **natural**: WordNet access library
- **mongodb**: MongoDB driver for storage

## 🔄 Migration from @legion/kg

This package has been successfully migrated from the deprecated `@legion/kg` package:

- **Old**: Used `KGEngine` for knowledge graph operations
- **New**: Uses `TripleStoreDataSource` with Handle-based architecture
- **Old**: Direct dependency on `@legion/kg`
- **New**: Uses `@legion/triplestore` and custom MongoDBTripleStore adapter
- **Old**: Used `idManager` from deprecated package
- **New**: Uses custom `IDGenerator` utility class
- **Old**: Triple format as arrays `[subject, predicate, object]`
- **New**: Triple format as objects `{subject, predicate, object}`

See `packages/km/MIGRATION_PLAN.md` for detailed migration information.

## 🛠️ Development

### Project Structure
The Handle-based modular architecture allows for:
- Easy testing of individual components with real dependencies
- Clear separation of concerns through DataSource abstraction
- Extensibility for additional processors using Handle patterns
- Maintainable codebase with focused modules
- FAIL FAST approach with no mock implementations

### Adding New Processors
To add new processing capabilities:

1. Create processor in `src/processors/`
2. Import and initialize in `WordNetFoundationalLoader`
3. Use `TripleStoreDataSource` for all data operations
4. Follow Handle patterns for data access
5. Export from `src/index.js` if needed

### Testing Strategy
- **Unit Tests**: Test individual components in isolation
- **Integration Tests**: Test with real triple stores and data sources
- **NO MOCKS**: Use actual @legion components in tests
- **FAIL FAST**: No fallback implementations in production code

## 🤝 Integration with Legion Framework

This loader integrates seamlessly with the Legion Handle ecosystem:

- **@legion/triplestore**: Uses TripleStoreDataSource for all graph operations
- **@legion/storage**: Leverages MongoDB providers through custom adapter
- **@legion/handle**: Compatible with Handle-based data access patterns
- **Custom Components**: IDGenerator for consistent ID management
- **Triple Store Abstraction**: Works with any triple store implementation

## 📈 Performance

- **Handle-based Operations**: Efficient data access through DataSource abstraction
- **Batch Processing**: Configurable batch sizes for memory efficiency
- **Concurrent Processing**: Parallel processing of synsets and relationships
- **Triple Store Optimization**: Automatic index creation for query performance
- **Memory Management**: Efficient caching and cleanup strategies through Handle patterns

## ✅ Validation

The system includes comprehensive validation using Handle-compatible patterns:
- Entity count verification through DataSource queries
- Relationship integrity checks using triple store operations
- Hierarchy cycle detection with Handle-based graph traversal
- Polysemy validation ensuring proper word-concept relationships
- Foundational category verification for Entity/Process/Property/Relation hierarchy

## 📚 Documentation

- [Implementation Plan](docs/implementation-plan.md) - Detailed development roadmap
- [API Documentation](docs/api.md) - Component APIs (coming soon)
- [Migration Guide](../MIGRATION_PLAN.md) - Migration from @legion/kg

## 🧪 Testing

### Test Coverage

- **Unit Tests**: Individual component testing with real dependencies
- **Integration Tests**: End-to-end pipeline testing with actual triple stores
- **Performance Tests**: Speed and scalability validation
- **Edge Case Tests**: Error handling and boundary conditions

### Test Examples

```bash
# Run specific test suites
npm test -- --testNamePattern="SynsetProcessor"
npm test -- --testNamePattern="RelationshipProcessor" 
npm test -- --testNamePattern="WordNetFoundationalLoader"

# Run integration tests
npm test -- --testPathPattern="integration"
```

## 📄 License

MIT License - See LICENSE file for details

## 👥 Contributing

This project follows Handle-based architecture patterns and maintains compatibility 
with the Legion framework ecosystem. Contributions should align with:

- Handle pattern data access
- TripleStoreDataSource abstraction
- FAIL FAST approach (no fallbacks)
- Real component integration (no mocks in implementation)

---

**Status**: Handle Migration Complete ✅ | **Architecture**: Modern DataSource Patterns 🚀

This foundational ontology serves as the semantic bedrock for domain-specific knowledge and service-oriented concepts in the complete Legion Handle ecosystem.
