# NLP and WordNet Migration Plan

## Overview

This document outlines the migration plan for the NLP and WordNet packages from the deprecated `@legion/kg` to the Handle-based architecture.

## Current State

### Dependencies
- **NLP Package** (`@legion/nlp`):
  - Depends on deprecated `@legion/kg`
  - Uses `KGEngine` for ontology extraction
  - No dependency on WordNet

- **WordNet Package** (`@legion/wordnet`):
  - Imports `KGEngine` and `MongoTripleStore` from deprecated `@legion/kg`
  - Already has `@legion/triplestore` and `@legion/handle` as dependencies
  - Uses `natural` npm package for WordNet data access
  - No dependency on NLP

**These packages are independent and don't depend on each other.**

## Migration Strategy

### Phase 1: Migrate WordNet Package

#### 1.1 Update Dependencies
```json
// Remove from package.json
"@legion/kg": "*"

// Ensure these are present
"@legion/triplestore": "*"
"@legion/handle": "*"
"@legion/data-sources": "*"
```

#### 1.2 Update WordNetFoundationalLoader.js
```javascript
// Old imports to remove
import { KGEngine } from '@legion/kg';
import { MongoTripleStore } from '@legion/kg';

// New imports
import { TripleStoreDataSource, MongoDBTripleStore } from '@legion/triplestore';
import { Handle } from '@legion/handle';
import { ResourceManager } from '@legion/resource-manager';

// Old initialization
this.store = new MongoTripleStore(connectionString, dbName, collectionName);
this.kg = new KGEngine(this.store);

// New initialization
const resourceManager = await ResourceManager.getInstance();
this.tripleStore = new MongoDBTripleStore({
  uri: this.config.mongodb.connectionString,
  database: this.config.mongodb.dbName,
  collection: this.config.mongodb.collectionName
});
this.dataSource = new TripleStoreDataSource(this.tripleStore);
```

#### 1.3 Update Processors to Use Handle Pattern
```javascript
// SynsetProcessor.js - Old pattern
await this.kg.addEntity({
  id: synsetId,
  type: 'Concept',
  properties: { ... }
});

// New pattern
const handle = new Handle(this.dataSource, synsetId);
handle.update({
  type: 'Concept',
  properties: { ... }
});
```

#### 1.4 Update Relationship Processing
```javascript
// RelationshipProcessor.js - Old pattern
await this.kg.addRelationship(subjectId, relationshipType, objectId);

// New pattern
await this.dataSource.addTriple({
  subject: subjectId,
  predicate: relationshipType,
  object: objectId
});
```

### Phase 2: Migrate NLP Package

#### 2.1 Update Dependencies
```json
// Remove from package.json
"@legion/kg": "*"

// Add
"@legion/triplestore": "*"
"@legion/handle": "*"
"@legion/data-sources": "*"
```

#### 2.2 Update OntologyExtractor.js
```javascript
// Old pattern
class OntologyExtractor {
  constructor(kgEngine) {
    this.kg = kgEngine;
  }
  
  async extractRelevantSchema(text) {
    const schema = await this.kg.getSchema();
    // ...
  }
}

// New pattern
class OntologyExtractor {
  constructor(dataSource) {
    this.dataSource = dataSource;
  }
  
  async extractRelevantSchema(text) {
    const schema = await this.dataSource.getSchema();
    // ...
  }
}
```

#### 2.3 Update TripleGenerator.js
```javascript
// Old output format
{
  subject: entityId,
  predicate: 'hasType',
  object: entityType
}

// New Handle-compatible format
{
  id: entityId,
  type: entityType,
  properties: { ... },
  relationships: [ ... ]
}
```

#### 2.4 Update NLPSystem.js
```javascript
// Old initialization
this.options = {
  kgEngine: null,
  ...options
};
this.ontologyExtractor = new OntologyExtractor(this.options.kgEngine);

// New initialization
async initialize() {
  const resourceManager = await ResourceManager.getInstance();
  
  // Create data source if not provided
  if (!this.dataSource) {
    const tripleStore = new InMemoryTripleStore();
    this.dataSource = new TripleStoreDataSource(tripleStore);
  }
  
  this.ontologyExtractor = new OntologyExtractor(this.dataSource);
  // ...
}
```

### Phase 3: Update Tests

#### 3.1 WordNet Tests
- Update all tests that mock `KGEngine` to use `TripleStoreDataSource`
- Replace `kg.addEntity()` assertions with Handle operations
- Update relationship tests to use triple store patterns

#### 3.2 NLP Tests
- Update tests to use `TripleStoreDataSource` instead of `KGEngine`
- Modify triple generation tests for new format
- Update integration tests to use Handle pattern

### Phase 4: Create Integration Examples

#### 4.1 WordNet Example
```javascript
import { WordNetFoundationalLoader } from '@legion/wordnet';
import { TripleStoreDataSource, MongoDBTripleStore } from '@legion/triplestore';
import { Handle } from '@legion/handle';

async function loadWordNet() {
  const loader = new WordNetFoundationalLoader();
  const results = await loader.loadFoundationalOntology();
  
  // Access loaded data via Handle
  const conceptHandle = new Handle(loader.dataSource, 'synset-123');
  const concept = await conceptHandle.value();
  
  return results;
}
```

#### 4.2 NLP Example
```javascript
import { NLPSystem } from '@legion/nlp';
import { TripleStoreDataSource, InMemoryTripleStore } from '@legion/triplestore';

async function processText(text) {
  // Create NLP system with Handle-based storage
  const tripleStore = new InMemoryTripleStore();
  const dataSource = new TripleStoreDataSource(tripleStore);
  
  const nlpSystem = new NLPSystem({ dataSource });
  await nlpSystem.initialize();
  
  const results = await nlpSystem.processText(text);
  
  // Access extracted entities via Handle
  for (const entity of results.extractions.entityDetails) {
    const handle = new Handle(dataSource, entity.id);
    const stored = await handle.value();
    console.log('Stored entity:', stored);
  }
  
  return results;
}
```

## Implementation Steps

1. **Create feature branch**: `feature/migrate-nlp-wordnet-to-handles`

2. **Migrate WordNet first** (simpler, fewer changes):
   - Update imports and dependencies
   - Refactor loader to use TripleStoreDataSource
   - Update processors for Handle pattern
   - Fix tests
   - Verify with test data

3. **Migrate NLP package**:
   - Update imports and dependencies
   - Refactor OntologyExtractor
   - Update TripleGenerator output format
   - Modify NLPSystem initialization
   - Fix tests

4. **Integration testing**:
   - Test WordNet loading with real data
   - Test NLP text processing
   - Verify data can be accessed via Handles
   - Test interoperability with other Handle-based systems

5. **Documentation updates**:
   - Update README files
   - Add migration notes
   - Update examples

## Breaking Changes

### For WordNet Users
- `KGEngine` no longer available, use `TripleStoreDataSource`
- Entity access now through Handle pattern
- Relationship format changed to triple store pattern

### For NLP Users
- Output format changed to Handle-compatible entities
- Must provide `TripleStoreDataSource` instead of `KGEngine`
- Triple generation returns different structure

## Backwards Compatibility

To ease migration, we could provide adapters:

```javascript
// Optional compatibility layer
class KGEngineAdapter {
  constructor(dataSource) {
    this.dataSource = dataSource;
  }
  
  async addEntity(entity) {
    const handle = new Handle(this.dataSource, entity.id);
    return handle.update(entity);
  }
  
  async addRelationship(subject, predicate, object) {
    return this.dataSource.addTriple({ subject, predicate, object });
  }
  
  // ... other compatibility methods
}
```

## Timeline

- **Week 1**: Migrate WordNet package and tests
- **Week 2**: Migrate NLP package and tests
- **Week 3**: Integration testing and documentation
- **Week 4**: Release and migration support

## Success Criteria

1. All tests pass with new Handle-based implementation
2. No dependencies on `@legion/kg`
3. Data is accessible via Handle pattern
4. Performance comparable to original implementation
5. Documentation updated with examples
6. Migration guide for existing users

## Notes

- Both packages should remain in `/packages/km/` as they are domain-specific tools
- Not suitable for `/packages/shared/` due to heavy dependencies (MongoDB, natural)
- Server-side only - cannot run in browser environments
- Optional features - not required for core Legion functionality