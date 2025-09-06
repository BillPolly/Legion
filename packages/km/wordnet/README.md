# WordNet Foundational Ontology Loader

A modular system for loading WordNet data into a Knowledge Graph to establish a foundational ontology. This project creates a comprehensive semantic foundation by converting WordNet synsets into concept nodes, word forms into label nodes, and semantic relationships into a structured hierarchy.

## Architecture

The project is organized into well-defined modules:

```
src/
├── index.js                    # Main entry point (minimal)
├── config/
│   └── default.js             # Configuration management
├── wordnet/
│   └── WordNetAccess.js       # WordNet data access wrapper
├── processors/
│   ├── SynsetProcessor.js     # Converts synsets to concepts
│   └── RelationshipProcessor.js # Processes semantic relationships
├── hierarchy/
│   └── HierarchyBuilder.js    # Builds foundational hierarchy
├── loader/
│   └── WordNetFoundationalLoader.js # Main orchestrator
└── scripts/
    └── validate-ontology.js   # Validation utilities
```

## Key Features

- **Two-Tier Architecture**: Clean separation between concepts (meanings) and words (textual forms)
- **Polysemy Support**: Proper handling of words with multiple meanings
- **Foundational Classification**: Automatic categorization into Entity/Process/Property/Relation
- **Comprehensive Relationships**: IS-A, PART-OF, HAS-PART, and similarity relationships
- **MongoDB Integration**: Scalable storage using the KG system's MongoDB backend
- **Batch Processing**: Efficient loading of large WordNet datasets
- **Statistics Tracking**: Detailed metrics throughout the loading process
- **Validation Framework**: Multi-level validation with cycle detection

## Installation

```bash
# Install dependencies
npm install

# The KG dependency is automatically linked from the sibling directory
```

## Usage

### Command Line Usage

```bash
# Load full WordNet ontology (production mode)
npm run load

# Load limited dataset for testing
npm run load-test
# or
node src/index.js --test

# Validate existing ontology
npm run validate
# or
node src/index.js --validate
```

### Programmatic Usage

```javascript
import { WordNetFoundationalLoader, DEFAULT_CONFIG, TEST_CONFIG } from './src/index.js';

// Basic usage with default configuration
const loader = new WordNetFoundationalLoader();
const results = await loader.loadFoundationalOntology();

// Custom configuration
const customConfig = {
  mongodb: {
    connectionString: 'mongodb://localhost:27017',
    dbName: 'my_ontology',
    collectionName: 'triples'
  },
  wordnet: {
    maxSynsets: 1000,        // Limit for testing
    includedPos: ['n', 'v']  // Only nouns and verbs
  }
};

const customLoader = new WordNetFoundationalLoader(customConfig);
const customResults = await customLoader.loadFoundationalOntology();
```

### Validation

```javascript
import { validateOntology } from './src/index.js';

const validationResult = await validateOntology();
console.log('Ontology is valid:', validationResult.isValid);
```

## Configuration

The system supports flexible configuration through `src/config/default.js`:

```javascript
const config = {
  mongodb: {
    connectionString: 'mongodb://localhost:27017',
    dbName: 'foundational_ontology',
    collectionName: 'triples'
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
```

## Data Structure

### Concept Nodes (Abstract Meanings)
```
wn_concept_02084071_n
├── rdf:type → kg:Concept
├── kg:conceptType → wordnet:Synset
├── kg:wordnetOffset → 02084071
├── kg:partOfSpeech → n
├── kg:definition → "a domesticated carnivorous mammal..."
├── kg:foundationalRole → kg:Entity
└── kg:lexicalFile → noun.animal
```

### Word Nodes (Textual Forms)
```
wn_word_dog_en
├── rdf:type → kg:Word
├── kg:wordText → "dog"
├── kg:language → en
├── kg:wordSource → wordnet
└── kg:normalizedForm → dog
```

### Relationships
- **HasLabel**: Concept → Word (concept has textual label)
- **Expresses**: Word → Concept (word expresses meaning)
- **IsA**: Concept → Concept (inheritance hierarchy)
- **PartOf**: Concept → Concept (compositional relationships)

## Loading Process

The system follows a structured 5-phase loading process:

1. **Phase 1**: Load synsets as foundational concepts
2. **Phase 2**: Process semantic relationships (hypernyms, meronyms, etc.)
3. **Phase 3**: Build foundational hierarchy (Entity/Process/Property/Relation)
4. **Phase 4**: Create database indices for performance
5. **Phase 5**: Final validation and statistics

## Statistics and Monitoring

The system provides comprehensive statistics:

```javascript
{
  conceptsLoaded: 8547,
  wordsCreated: 12834,
  relationshipsCreated: 15623,
  totalTriples: 89472,
  loadingTimeSeconds: 342.7,
  synsetStats: { /* detailed processor stats */ },
  relationshipStats: { /* relationship breakdown */ },
  hierarchyValidation: { /* hierarchy validation */ }
}
```

## Dependencies

- **knowledge-graph**: Sibling KG project (automatically linked)
- **natural**: WordNet access library
- **mongodb**: MongoDB driver for storage

## Development

### Running Tests
```bash
npm test
```

### Project Structure
The modular architecture allows for:
- Easy testing of individual components
- Clear separation of concerns
- Extensibility for additional processors
- Maintainable codebase with focused modules

### Adding New Processors
To add new processing capabilities:

1. Create processor in `src/processors/`
2. Import and initialize in `WordNetFoundationalLoader`
3. Add to the loading pipeline
4. Export from `src/index.js` if needed

## Integration with KG System

This loader integrates seamlessly with the Knowledge Graph system:

- Uses `KGEngine` for graph operations
- Leverages `MongoTripleStore` for persistence
- Utilizes `idManager` for consistent ID generation
- Compatible with all KG query and export systems

## Performance

- **Batch Processing**: Configurable batch sizes for memory efficiency
- **Concurrent Processing**: Parallel processing of synsets and relationships
- **Database Indices**: Automatic index creation for query performance
- **Memory Management**: Efficient caching and cleanup strategies

## Validation

The system includes comprehensive validation:
- Entity count verification
- Relationship integrity checks
- Hierarchy cycle detection
- Polysemy validation
- Foundational category verification

This foundational ontology serves as the semantic bedrock for domain-specific knowledge and service-oriented concepts in the complete Knowledge Graph system.
