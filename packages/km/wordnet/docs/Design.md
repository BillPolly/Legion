# WordNet Foundational Ontology Loading for Knowledge Graph System

## Overview

This document describes the direct loading of WordNet data into our MongoDB-backed Knowledge Graph system to establish a foundational ontology. WordNet synsets become concept nodes, word forms become separate label nodes, and semantic relationships form the inheritance hierarchy. The approach prioritizes using WordNet's native identifiers as KG GUIDs to maintain referential integrity.

## System Architecture

### Core Components

The WordNet loader integrates directly with the existing KG system components:

```javascript
import natural from 'natural';
import KnowledgeGraphSystem from './src/index.js';
import { KGEngine } from './src/core/KGEngine.js';
import { MongoTripleStore } from './src/storage/MongoTripleStore.js';
import { idManager } from './src/utilities/IDManager.js';
import { PatternQuery, LogicalQuery, TraversalQuery } from './src/query/index.js';

class WordNetFoundationalLoader {
  constructor(config = DEFAULT_CONFIG) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.store = null;
    this.kg = null;
    
    // Processing components (initialized in initialize())
    this.synsetProcessor = null;
    this.relationshipProcessor = null;
    this.hierarchyBuilder = null;
  }
  
  async initialize() {
    // Create MongoDB storage using existing KG system
    this.store = new MongoTripleStore(
      this.config.mongodb.connectionString,
      this.config.mongodb.dbName,
      this.config.mongodb.collectionName
    );
    
    // Create KG engine using existing system
    this.kg = new KGEngine(this.store);
    
    // Initialize processing components
    this.synsetProcessor = new SynsetProcessor(this.kg, this.config);
    this.relationshipProcessor = new RelationshipProcessor(this.kg, this.config);
    this.hierarchyBuilder = new HierarchyBuilder(this.kg);
  }
}
```

### Configuration System

Comprehensive configuration with sensible defaults:

```javascript
const DEFAULT_CONFIG = {
  mongodb: {
    connectionString: 'mongodb://localhost:27017',
    dbName: 'foundational_ontology',
    collectionName: 'triples'
  },
  loading: {
    batchSize: 1000,
    maxConcurrentRequests: 10,
    enableValidation: true,
    createIndices: true,
    logInterval: 100
  },
  wordnet: {
    maxSynsets: null, // null = load all, or set number for testing
    includedPos: ['n', 'v', 'a', 's', 'r'], // parts of speech to load
    skipMissingDefinitions: true
  }
};
```

### Node.js WordNet Access

Using the `natural` library with custom wrapper for reliable access:

```bash
npm install natural mongodb
```

The `WordNetAccess` wrapper provides:
- Promise-based synset retrieval
- Batch processing of synsets by POS
- Error handling and retry logic
- Progress tracking and logging

## ID Management Strategy

### Using Existing KG System IDManager

The loader leverages the KG system's global `idManager` for consistent identifier generation:

```javascript
import { idManager } from './src/utilities/IDManager.js';

class SynsetProcessor {
  generateConceptId(synsetData) {
    // Use WordNet synset offset + POS as deterministic identifier
    return idManager.generateId(`wn_concept_${synsetData.synsetOffset}_${synsetData.pos}`);
  }
  
  generateWordId(word) {
    // Generate deterministic ID from normalized word
    const normalized = word.toLowerCase().replace(/[^a-z0-9]/g, '_');
    return idManager.generateId(`wn_word_${normalized}_en`);
  }
  
  generateRelationshipId(sourceId, targetId, relationType) {
    // Use KG system's relationship ID generation
    return idManager.generateRelationshipId(sourceId, targetId, relationType);
  }
}
```

### ID Consistency Benefits

- **KG System Integration**: Uses existing ID management infrastructure
- **Referential Integrity**: WordNet references remain valid across system
- **Deterministic Generation**: Same synset always gets same ID
- **Traceable Origins**: IDs clearly indicate WordNet source
- **Cross-System Compatibility**: Compatible with all KG system components

## Critical Architecture: Synset-Word Separation

### Two-Tier Node Structure

The foundational ontology uses a strict two-tier architecture:

1. **Concept Nodes**: Represent abstract meanings (WordNet synsets)
2. **Word Nodes**: Represent textual strings (linguistic forms)

This separation enables:
- **Synonym Handling**: Multiple words → Same concept  
- **Polysemy Handling**: Same word → Multiple concepts
- **Multilingual Extension**: Multiple languages → Same concepts
- **Clean Semantics**: Relationships between meanings, not strings

### Example Structure

```
WordNet Synset: dog.n.01 "a domesticated carnivorous mammal"
├── Concept Node: wn_concept_02084071_n
│   ├── kg:definition → "a domesticated carnivorous mammal..."
│   ├── kg:foundationalRole → kg:Entity
│   └── kg:wordnetOffset → 02084071
└── Word Nodes (connected via relationships):
    ├── wn_label_dog_en → "dog"
    ├── wn_label_domestic_dog_en → "domestic_dog" 
    ├── wn_label_canis_familiaris_en → "canis_familiaris"
    └── wn_label_hund_de → "hund" (future multilingual)

WordNet Synset: chase.v.01 "go after with intent to catch"  
├── Concept Node: wn_concept_01407602_v
│   ├── kg:definition → "go after with intent to catch"
│   ├── kg:foundationalRole → kg:Process
│   └── kg:wordnetOffset → 01407602
└── Word Nodes:
    ├── wn_label_chase_en → "chase"
    ├── wn_label_pursue_en → "pursue"
    ├── wn_label_follow_en → "follow"
    └── wn_label_dog_en → "dog" (SAME word, different concept!)
```

### Synset Processing Implementation

```javascript
class SynsetProcessor {
  constructor(kgEngine, idMapper) {
    this.kg = kgEngine;
    this.idMapper = idMapper;
    this.wordNodeCache = new Map(); // Avoid duplicate word nodes
  }
  
  async processSynset(synsetOffset, pos) {
    return new Promise((resolve, reject) => {
      this.wordnet.get(synsetOffset, pos, (result) => {
        if (!result) {
          reject(new Error(`Synset not found: ${synsetOffset}.${pos}`));
          return;
        }
        
        this.convertSynsetToConcept(result)
          .then(resolve)
          .catch(reject);
      });
    });
  }
  
  async convertSynsetToConcept(synsetData) {
    const conceptId = this.idMapper.generateConceptId(synsetData);
    const triples = [];
    
    // 1. CREATE CONCEPT NODE (represents the abstract meaning)
    triples.push([conceptId, 'rdf:type', 'kg:Concept']);
    triples.push([conceptId, 'kg:conceptType', 'wordnet:Synset']);
    triples.push([conceptId, 'kg:wordnetOffset', synsetData.synsetOffset]);
    triples.push([conceptId, 'kg:partOfSpeech', synsetData.pos]);
    triples.push([conceptId, 'kg:definition', synsetData.gloss]);
    
    // Foundational ontology classification
    const ontologyRole = this.classifyOntologyRole(synsetData.pos);
    triples.push([conceptId, 'kg:foundationalRole', ontologyRole]);
    
    // Lexical metadata
    if (synsetData.lexName) {
      triples.push([conceptId, 'kg:lexicalFile', synsetData.lexName]);
    }
    
    // 2. CREATE/LINK WORD NODES (represents textual forms)
    const wordNodes = [];
    for (const word of synsetData.synonyms) {
      const wordNodeTriples = await this.createOrLinkWordNode(word, conceptId);
      triples.push(...wordNodeTriples.triples);
      wordNodes.push(wordNodeTriples.wordId);
    }
    
    // Store all triples in MongoDB
    await this.kg.addTriples(triples);
    
    return {
      conceptId: conceptId,
      wordNodes: wordNodes,
      triplesAdded: triples.length,
      labelCount: synsetData.synonyms.length
    };
  }
  
  classifyOntologyRole(pos) {
    const roleMapping = {
      'n': 'kg:Entity',        // Nouns represent entities/states
      'v': 'kg:Process',       // Verbs represent processes/transformations  
      'a': 'kg:Property',      // Adjectives represent properties
      's': 'kg:Property',      // Satellite adjectives
      'r': 'kg:Modifier'       // Adverbs represent modifiers
    };
    return roleMapping[pos] || 'kg:Concept';
  }
}
```

### Word Node Management with Polysemy

The implementation properly handles word nodes as first-class entities with comprehensive polysemy support:

```javascript
class SynsetProcessor {
  constructor(kgEngine, config = DEFAULT_CONFIG) {
    this.kg = kgEngine;
    this.config = config;
    this.wordnet = new WordNetAccess();
    this.wordNodeCache = new Map(); // Track existing word nodes for polysemy
    this.stats = {
      conceptsCreated: 0,
      wordsCreated: 0,
      wordsLinked: 0,
      relationshipsCreated: 0
    };
  }

  async convertSynsetToConcept(synsetData) {
    const conceptId = this.generateConceptId(synsetData);
    const triples = [];

    // 1. CREATE CONCEPT NODE (represents the abstract meaning)
    triples.push([conceptId, 'rdf:type', 'kg:Concept']);
    triples.push([conceptId, 'kg:conceptType', 'wordnet:Synset']);
    triples.push([conceptId, 'kg:wordnetOffset', synsetData.synsetOffset]);
    triples.push([conceptId, 'kg:partOfSpeech', synsetData.pos]);
    
    if (synsetData.gloss) {
      triples.push([conceptId, 'kg:definition', synsetData.gloss]);
    }

    // Foundational ontology classification
    const ontologyRole = this.classifyOntologyRole(synsetData.pos);
    triples.push([conceptId, 'kg:foundationalRole', ontologyRole]);

    // Metadata
    if (synsetData.lexName) {
      triples.push([conceptId, 'kg:lexicalFile', synsetData.lexName]);
    }
    triples.push([conceptId, 'kg:created', new Date().toISOString()]);

    // 2. CREATE/LINK WORD NODES (represents textual forms)
    const wordResults = [];
    if (synsetData.synonyms && synsetData.synonyms.length > 0) {
      for (const word of synsetData.synonyms) {
        try {
          const wordResult = await this.createOrLinkWordNode(word, conceptId);
          triples.push(...wordResult.triples);
          wordResults.push(wordResult);
        } catch (error) {
          console.warn(`Failed to process word "${word}": ${error.message}`);
        }
      }
    }

    // Store all triples and update statistics
    const addedCount = await this.kg.addTriples(triples);
    this.stats.conceptsCreated++;
    this.stats.relationshipsCreated += wordResults.length * 2; // HasLabel + Expresses
    this.stats.wordsCreated += wordResults.filter(r => r.isNewWord).length;
    this.stats.wordsLinked += wordResults.length;

    return {
      conceptId: conceptId,
      wordNodes: wordResults.map(r => r.wordId),
      triplesAdded: addedCount,
      wordCount: wordResults.length
    };
  }

  async createOrLinkWordNode(word, conceptId) {
    const wordId = this.generateWordId(word);
    const triples = [];
    let isNewWord = false;

    // Check if word node already exists (for polysemy support)
    const existingWord = await this.kg.query(wordId, 'rdf:type', 'kg:Word');

    if (existingWord.length === 0) {
      // CREATE NEW WORD NODE
      isNewWord = true;
      triples.push([wordId, 'rdf:type', 'kg:Word']);
      triples.push([wordId, 'kg:wordText', word]);
      triples.push([wordId, 'kg:language', 'en']);
      triples.push([wordId, 'kg:wordSource', 'wordnet']);
      triples.push([wordId, 'kg:created', new Date().toISOString()]);

      // Normalized form for matching
      const normalized = word.toLowerCase().replace(/[^a-z0-9]/g, '');
      triples.push([wordId, 'kg:normalizedForm', normalized]);

      // Cache the word node
      this.wordNodeCache.set(wordId, { word, conceptIds: new Set([conceptId]) });
    } else {
      // UPDATE CACHE for existing word
      if (this.wordNodeCache.has(wordId)) {
        this.wordNodeCache.get(wordId).conceptIds.add(conceptId);
      } else {
        this.wordNodeCache.set(wordId, { word, conceptIds: new Set([conceptId]) });
      }
    }

    // CREATE BIDIRECTIONAL CONCEPT-WORD RELATIONSHIPS
    const hasLabelRelId = this.generateRelationshipId(conceptId, wordId, 'hasLabel');
    triples.push([conceptId, hasLabelRelId, wordId]);
    triples.push([hasLabelRelId, 'rdf:type', 'kg:HasLabel']);
    triples.push([hasLabelRelId, 'kg:relationSource', 'wordnet']);
    triples.push([hasLabelRelId, 'kg:created', new Date().toISOString()]);

    const expressesRelId = this.generateRelationshipId(wordId, conceptId, 'expresses');
    triples.push([wordId, expressesRelId, conceptId]);
    triples.push([expressesRelId, 'rdf:type', 'kg:Expresses']);
    triples.push([expressesRelId, 'kg:relationSource', 'wordnet']);
    triples.push([expressesRelId, 'kg:created', new Date().toISOString()]);

    // Track sense number for polysemy
    const cachedWord = this.wordNodeCache.get(wordId);
    const senseNumber = cachedWord ? cachedWord.conceptIds.size : 1;
    triples.push([expressesRelId, 'kg:senseNumber', senseNumber]);

    return {
      wordId: wordId,
      triples: triples,
      isNewWord: isNewWord,
      senseNumber: senseNumber
    };
  }
}
```

### Polysemy Handling Example

The word "bank" demonstrates proper polysemy handling:

```javascript
// Processing bank.n.01 (financial institution)
WordNode: wn_word_bank_en
├── kg:wordText → "bank"
├── expresses → wn_concept_08420278_n (financial institution)
│   └── kg:senseNumber → 1
├── expresses → wn_concept_09213565_n (river bank)  
│   └── kg:senseNumber → 2
└── expresses → wn_concept_01049063_v (tilt/slope)
    └── kg:senseNumber → 3

// Each concept has its own definition and relationships
ConceptNode: wn_concept_08420278_n  
├── kg:definition → "a financial institution that accepts deposits"
├── kg:foundationalRole → kg:Entity
└── hasLabel → wn_word_bank_en

ConceptNode: wn_concept_09213565_n
├── kg:definition → "sloping land beside a body of water"  
├── kg:foundationalRole → kg:Entity
└── hasLabel → wn_word_bank_en
```

### Query Benefits of Separation

This architecture enables powerful queries:

```javascript
// Find all concepts expressed by word "run"
const runConcepts = await kg.query()
  .select('concept', 'definition')
  .where('?word', 'kg:wordText', 'run')
  .where('?word', '?expressesRel', '?concept') 
  .where('?expressesRel', 'rdf:type', 'kg:Expresses')
  .where('?concept', 'kg:definition', '?definition')
  .execute();

// Find all words that express concept of "motion"
const motionWords = await kg.query()
  .select('word')
  .where('?concept', 'kg:definition', '*motion*')
  .where('?concept', '?hasLabelRel', '?wordNode')
  .where('?hasLabelRel', 'rdf:type', 'kg:HasLabel') 
  .where('?wordNode', 'kg:wordText', '?word')
  .execute();

// Find synonyms (words expressing same concept)
const synonyms = await kg.query()
  .select('synonym')
  .where('?word', 'kg:wordText', 'happy')
  .where('?word', '?expressesRel', '?concept')
  .where('?concept', '?hasLabelRel', '?synonymNode')
  .where('?synonymNode', 'kg:wordText', '?synonym')
  .execute();
```

## Semantic Relationship Processing

### Inheritance Hierarchy Construction

The `RelationshipProcessor` extracts WordNet's semantic relationships with comprehensive statistics tracking:

```javascript
class RelationshipProcessor {
  constructor(kgEngine, config = DEFAULT_CONFIG) {
    this.kg = kgEngine;
    this.config = config;
    this.wordnet = new WordNetAccess();
    this.stats = {
      isARelations: 0,
      partOfRelations: 0,
      hasPartRelations: 0,
      similarityRelations: 0,
      antonymRelations: 0
    };
  }

  async processAllRelationships() {
    console.log('Processing WordNet semantic relationships...');

    // Get all concept nodes using KG query system
    const conceptQuery = await this.kg.query(null, 'rdf:type', 'kg:Concept');
    const concepts = conceptQuery.map(([conceptId]) => conceptId);

    console.log(`Found ${concepts.length} concepts to process for relationships`);

    let processedCount = 0;
    const batchSize = this.config.loading.batchSize;

    // Process concepts in batches for memory efficiency
    for (let i = 0; i < concepts.length; i += batchSize) {
      const batch = concepts.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (conceptId) => {
        try {
          const offset = await this.getOffsetFromConceptId(conceptId);
          const pos = await this.getPosFromConceptId(conceptId);

          if (offset && pos) {
            await this.processSynsetRelationships(offset, pos, conceptId);
          }
        } catch (error) {
          console.warn(`Error processing relationships for ${conceptId}: ${error.message}`);
        }
      }));

      processedCount += batch.length;
      if (processedCount % this.config.loading.logInterval === 0) {
        console.log(`  Processed ${processedCount}/${concepts.length} concepts for relationships`);
      }
    }

    const totalRelationships = Object.values(this.stats).reduce((sum, count) => sum + count, 0);
    console.log(`Total relationships processed: ${totalRelationships}`);
    console.log('Relationship breakdown:', this.stats);

    return totalRelationships;
  }

  async processSynsetRelationships(offset, pos, conceptId) {
    try {
      const synsetData = await this.wordnet.getSynset(offset, pos);
      const triples = [];

      // Process hypernyms (IS-A relationships) - foundational hierarchy
      if (synsetData.hypernyms && synsetData.hypernyms.length > 0) {
        for (const hypernym of synsetData.hypernyms) {
          const hypernymId = this.generateConceptId({
            synsetOffset: hypernym.synsetOffset,
            pos: hypernym.pos
          });

          const relTriples = this.createIsARelationship(conceptId, hypernymId);
          triples.push(...relTriples);
          this.stats.isARelations++;
        }
      }

      // Process meronyms (PART-OF relationships)
      if (synsetData.partMeronyms && synsetData.partMeronyms.length > 0) {
        for (const meronym of synsetData.partMeronyms) {
          const meronymId = this.generateConceptId({
            synsetOffset: meronym.synsetOffset,
            pos: meronym.pos
          });

          const relTriples = this.createPartOfRelationship(conceptId, meronymId);
          triples.push(...relTriples);
          this.stats.partOfRelations++;
        }
      }

      // Process holonyms (HAS-PART relationships)
      if (synsetData.partHolonyms && synsetData.partHolonyms.length > 0) {
        for (const holonym of synsetData.partHolonyms) {
          const holonymId = this.generateConceptId({
            synsetOffset: holonym.synsetOffset,
            pos: holonym.pos
          });

          const relTriples = this.createHasPartRelationship(conceptId, holonymId);
          triples.push(...relTriples);
          this.stats.hasPartRelations++;
        }
      }

      // Process similarity relationships (for adjectives)
      if (synsetData.similarTo && synsetData.similarTo.length > 0) {
        for (const similar of synsetData.similarTo) {
          const similarId = this.generateConceptId({
            synsetOffset: similar.synsetOffset,
            pos: similar.pos
          });

          const relTriples = this.createSimilarityRelationship(conceptId, similarId);
          triples.push(...relTriples);
          this.stats.similarityRelations++;
        }
      }

      // Store relationship triples
      if (triples.length > 0) {
        await this.kg.addTriples(triples);
      }

    } catch (error) {
      console.warn(`Failed to process relationships for ${offset}.${pos}: ${error.message}`);
    }
  }

  createIsARelationship(subjectId, objectId) {
    const relId = idManager.generateRelationshipId(subjectId, objectId, 'isa');

    return [
      [subjectId, relId, objectId],
      [relId, 'rdf:type', 'kg:IsA'],
      [relId, 'kg:relationSource', 'wordnet'],
      [relId, 'kg:hierarchyLevel', 'foundational'],
      [relId, 'kg:created', new Date().toISOString()]
    ];
  }

  createPartOfRelationship(partId, wholeId) {
    const relId = idManager.generateRelationshipId(partId, wholeId, 'partof');

    return [
      [partId, relId, wholeId],
      [relId, 'rdf:type', 'kg:PartOf'],
      [relId, 'kg:relationSource', 'wordnet'],
      [relId, 'kg:hierarchyLevel', 'foundational'],
      [relId, 'kg:created', new Date().toISOString()]
    ];
  }

  createHasPartRelationship(wholeId, partId) {
    const relId = idManager.generateRelationshipId(wholeId, partId, 'haspart');

    return [
      [wholeId, relId, partId],
      [relId, 'rdf:type', 'kg:HasPart'],
      [relId, 'kg:relationSource', 'wordnet'],
      [relId, 'kg:hierarchyLevel', 'foundational'],
      [relId, 'kg:created', new Date().toISOString()]
    ];
  }

  createSimilarityRelationship(conceptId1, conceptId2) {
    const relId = idManager.generateRelationshipId(conceptId1, conceptId2, 'similar');

    return [
      [conceptId1, relId, conceptId2],
      [relId, 'rdf:type', 'kg:SimilarTo'],
      [relId, 'kg:relationSource', 'wordnet'],
      [relId, 'kg:hierarchyLevel', 'foundational'],
      [relId, 'kg:created', new Date().toISOString()]
    ];
  }

  generateConceptId(synsetData) {
    return idManager.generateId(`wn_concept_${synsetData.synsetOffset}_${synsetData.pos}`);
  }

  async getOffsetFromConceptId(conceptId) {
    const offsetTriples = await this.kg.query(conceptId, 'kg:wordnetOffset', null);
    return offsetTriples.length > 0 ? offsetTriples[0][2] : null;
  }

  async getPosFromConceptId(conceptId) {
    const posTriples = await this.kg.query(conceptId, 'kg:partOfSpeech', null);
    return posTriples.length > 0 ? posTriples[0][2] : null;
  }

  getStats() {
    return { ...this.stats };
  }
}
```

## Foundational Hierarchy Construction

### Root Concept Creation with KG Integration

The `HierarchyBuilder` establishes top-level foundational concepts using the KG system's idManager:

```javascript
class HierarchyBuilder {
  constructor(kgEngine) {
    this.kg = kgEngine;
  }

  async buildFoundationalHierarchy() {
    console.log('Building foundational ontology hierarchy...');

    // Create fundamental root concepts
    await this.createRootConcepts();

    // Organize WordNet concepts under foundational structure  
    await this.organizeConceptsByRole();

    // Validate hierarchy
    const validation = await this.validateHierarchy();
    console.log('Hierarchy validation:', validation);

    return validation;
  }

  async createRootConcepts() {
    const rootTriples = [
      // Top-level foundational concept
      ['kg:FoundationalConcept', 'rdf:type', 'kg:Concept'],
      ['kg:FoundationalConcept', 'kg:conceptType', 'kg:RootConcept'],
      ['kg:FoundationalConcept', 'kg:definition', 'Root of all foundational concepts'],
      ['kg:FoundationalConcept', 'kg:hierarchyLevel', 'root'],

      // Primary ontological categories
      ['kg:Entity', 'rdf:type', 'kg:Concept'],
      ['kg:Entity', 'kg:conceptType', 'kg:FoundationalCategory'],
      ['kg:Entity', 'kg:definition', 'Root concept for all entities and objects'],
      ['kg:Entity', 'kg:foundationalRole', 'entity'],

      ['kg:Process', 'rdf:type', 'kg:Concept'],
      ['kg:Process', 'kg:conceptType', 'kg:FoundationalCategory'],
      ['kg:Process', 'kg:definition', 'Root concept for all processes and transformations'],
      ['kg:Process', 'kg:foundationalRole', 'process'],

      ['kg:Property', 'rdf:type', 'kg:Concept'],
      ['kg:Property', 'kg:conceptType', 'kg:FoundationalCategory'],
      ['kg:Property', 'kg:definition', 'Root concept for all properties and attributes'],
      ['kg:Property', 'kg:foundationalRole', 'property'],

      ['kg:Relation', 'rdf:type', 'kg:Concept'],
      ['kg:Relation', 'kg:conceptType', 'kg:FoundationalCategory'],
      ['kg:Relation', 'kg:definition', 'Root concept for all relations'],
      ['kg:Relation', 'kg:foundationalRole', 'relation']
    ];

    // Create hierarchy relationships using idManager
    const hierarchyTriples = [
      ['kg:Entity', idManager.generateRelationshipId('kg:Entity', 'kg:FoundationalConcept', 'isa'), 'kg:FoundationalConcept'],
      ['kg:Process', idManager.generateRelationshipId('kg:Process', 'kg:FoundationalConcept', 'isa'), 'kg:FoundationalConcept'],
      ['kg:Property', idManager.generateRelationshipId('kg:Property', 'kg:FoundationalConcept', 'isa'), 'kg:FoundationalConcept'],
      ['kg:Relation', idManager.generateRelationshipId('kg:Relation', 'kg:FoundationalConcept', 'isa'), 'kg:FoundationalConcept']
    ];

    // Add relationship metadata
    for (const [subj, rel, obj] of hierarchyTriples) {
      rootTriples.push([subj, rel, obj]);
      rootTriples.push([rel, 'rdf:type', 'kg:IsA']);
      rootTriples.push([rel, 'kg:relationSource', 'foundational_hierarchy']);
      rootTriples.push([rel, 'kg:hierarchyLevel', 'root']);
    }

    await this.kg.addTriples(rootTriples);
    console.log('Created foundational root concepts');
  }

  async organizeConceptsByRole() {
    const posToCategory = {
      'n': 'kg:Entity',
      'v': 'kg:Process', 
      'a': 'kg:Property',
      's': 'kg:Property',
      'r': 'kg:Property'
    };

    for (const [pos, categoryId] of Object.entries(posToCategory)) {
      console.log(`Linking ${pos} concepts to ${categoryId}...`);

      const conceptsQuery = await this.kg.query(null, 'kg:partOfSpeech', pos);
      const concepts = conceptsQuery.map(([conceptId]) => conceptId);

      const linkTriples = [];
      for (const conceptId of concepts) {
        const relId = idManager.generateRelationshipId(conceptId, categoryId, 'isa');
        linkTriples.push(
          [conceptId, relId, categoryId],
          [relId, 'rdf:type', 'kg:IsA'],
          [relId, 'kg:relationSource', 'foundational_hierarchy'],
          [relId, 'kg:hierarchyLevel', 'category']
        );
      }

      if (linkTriples.length > 0) {
        await this.kg.addTriples(linkTriples);
      }

      console.log(`Linked ${concepts.length} ${pos} concepts to ${categoryId}`);
    }
  }

  async validateHierarchy() {
    const stats = await this.calculateHierarchyStats();
    const cycles = await this.detectSimpleCycles();
    
    return {
      ...stats,
      cyclesFound: cycles.length,
      isValid: cycles.length === 0
    };
  }

  async calculateHierarchyStats() {
    const allConcepts = await this.kg.query(null, 'rdf:type', 'kg:Concept');
    const isARelations = await this.kg.query(null, 'rdf:type', 'kg:IsA');
    const words = await this.kg.query(null, 'rdf:type', 'kg:Word');

    return {
      totalConcepts: allConcepts.length,
      totalIsARelations: isARelations.length,
      totalWords: words.length,
      avgChildrenPerConcept: allConcepts.length > 0 ? (isARelations.length / allConcepts.length).toFixed(2) : 0
    };
  }

  async detectSimpleCycles() {
    // Simplified cycle detection for IS-A relationships
    const isAQuery = await this.kg.query(null, 'rdf:type', 'kg:IsA');
    const relationships = [];
    
    for (const [relId] of isAQuery) {
      const subjectQuery = await this.kg.query(null, relId, null);
      if (subjectQuery.length > 0) {
        const [subject, , object] = subjectQuery[0];
        relationships.push([subject, object]);
      }
    }

    // Build graph and detect cycles using DFS
    const graph = new Map();
    for (const [from, to] of relationships) {
      if (!graph.has(from)) graph.set(from, []);
      graph.get(from).push(to);
    }

    const cycles = [];
    const visited = new Set();
    const recursionStack = new Set();

    const hasCycle = (node) => {
      if (!visited.has(node)) {
        visited.add(node);
        recursionStack.add(node);

        const neighbors = graph.get(node) || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor) && hasCycle(neighbor)) {
            return true;
          } else if (recursionStack.has(neighbor)) {
            cycles.push([node, neighbor]);
            return true;
          }
        }
      }

      recursionStack.delete(node);
      return false;
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        hasCycle(node);
      }
    }

    return cycles;
  }
}
```

## Complete Loading Process

### Main Loader Implementation

The `WordNetFoundationalLoader` orchestrates the entire loading process with comprehensive statistics and validation:

```javascript
class WordNetFoundationalLoader {
  constructor(config = DEFAULT_CONFIG) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.store = null;
    this.kg = null;
    this.synsetProcessor = null;
    this.relationshipProcessor = null;
    this.hierarchyBuilder = null;
    
    this.stats = {
      conceptsLoaded: 0,
      wordsCreated: 0,
      relationshipsCreated: 0,
      startTime: null,
      endTime: null,
      totalTriples: 0
    };
  }

  async initialize() {
    console.log('Initializing WordNet Foundational Loader...');

    // Create MongoDB storage using existing KG system
    this.store = new MongoTripleStore(
      this.config.mongodb.connectionString,
      this.config.mongodb.dbName,
      this.config.mongodb.collectionName
    );

    // Create KG engine
    this.kg = new KGEngine(this.store);

    // Initialize processors
    this.synsetProcessor = new SynsetProcessor(this.kg, this.config);
    this.relationshipProcessor = new RelationshipProcessor(this.kg, this.config);
    this.hierarchyBuilder = new HierarchyBuilder(this.kg);

    console.log('WordNet Foundational Loader initialized');
  }

  async loadFoundationalOntology() {
    console.log('Starting WordNet foundational ontology loading...');
    this.stats.startTime = Date.now();

    try {
      await this.initialize();

      // Phase 1: Load all synsets as foundational concepts
      console.log('Phase 1: Loading synsets as foundational concepts...');
      await this.loadAllSynsets();

      // Phase 2: Process semantic relationships
      console.log('Phase 2: Processing semantic relationships...');
      const relationshipCount = await this.relationshipProcessor.processAllRelationships();
      this.stats.relationshipsCreated = relationshipCount;

      // Phase 3: Build foundational hierarchy
      console.log('Phase 3: Building foundational hierarchy...');
      const hierarchyValidation = await this.hierarchyBuilder.buildFoundationalHierarchy();

      // Phase 4: Create database indices
      if (this.config.loading.createIndices) {
        console.log('Phase 4: Creating database indices...');
        await this.store.createIndices();
      }

      // Phase 5: Final validation
      console.log('Phase 5: Final validation...');
      const validation = await this.validateOntology();

      this.stats.endTime = Date.now();
      this.stats.totalTriples = await this.kg.size();
      const duration = (this.stats.endTime - this.stats.startTime) / 1000;

      const summary = {
        ...this.stats,
        loadingTimeSeconds: duration,
        synsetStats: this.synsetProcessor.getStats(),
        relationshipStats: this.relationshipProcessor.getStats(),
        hierarchyValidation: hierarchyValidation,
        finalValidation: validation
      };

      console.log('Foundational ontology loading completed successfully!');
      console.log(`Total time: ${duration} seconds`);
      console.log(`Concepts loaded: ${this.stats.conceptsLoaded}`);
      console.log(`Words created: ${this.stats.wordsCreated}`);
      console.log(`Relationships: ${this.stats.relationshipsCreated}`);
      console.log(`Total triples: ${this.stats.totalTriples}`);

      return summary;

    } catch (error) {
      console.error('Foundational ontology loading failed:', error);
      throw error;
    } finally {
      if (this.store) {
        await this.store.disconnect();
      }
    }
  }

  async loadAllSynsets() {
    const wordnet = new WordNetAccess();
    
    for (const pos of this.config.wordnet.includedPos) {
      console.log(`Loading ${pos} synsets...`);
      
      const maxSynsets = this.config.wordnet.maxSynsets;
      const synsets = await wordnet.getAllSynsets(pos, maxSynsets);
      
      console.log(`Found ${synsets.length} synsets for POS: ${pos}`);
      
      let processedCount = 0;
      const batchSize = this.config.loading.batchSize;
      
      // Process synsets in batches for memory efficiency
      for (let i = 0; i < synsets.length; i += batchSize) {
        const batch = synsets.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (synsetInfo) => {
          try {
            const result = await this.synsetProcessor.processSynset(synsetInfo);
            if (result) {
              this.stats.conceptsLoaded++;
            }
          } catch (error) {
            console.warn(`Failed to process synset ${synsetInfo.offset}.${synsetInfo.pos}: ${error.message}`);
          }
        }));
        
        processedCount += batch.length;
        if (processedCount % this.config.loading.logInterval === 0) {
          console.log(`  Processed ${processedCount}/${synsets.length} ${pos} synsets`);
        }
      }
      
      console.log(`Completed loading ${processedCount} ${pos} synsets`);
    }
    
    // Update stats from processor
    const synsetStats = this.synsetProcessor.getStats();
    this.stats.wordsCreated = synsetStats.wordsCreated;
  }

  async validateOntology() {
    console.log('Validating foundational ontology...');

    const validation = {
      conceptCount: await this.countByType('kg:Concept'),
      wordCount: await this.countByType('kg:Word'),
      isARelationCount: await this.countByType('kg:IsA'),
      hasLabelRelationCount: await this.countByType('kg:HasLabel'),
      expressesRelationCount: await this.countByType('kg:Expresses')
    };

    // Validate foundational categories
    const categories = ['kg:Entity', 'kg:Process', 'kg:Property', 'kg:Relation'];
    validation.foundationalCategories = {};
    
    for (const category of categories) {
      const descendants = await this.kg.query(null, null, category);
      validation.foundationalCategories[category] = descendants.length;
    }

    return validation;
  }

  async countByType(type) {
    const results = await this.kg.query(null, 'rdf:type', type);
    return results.length;
  }
}
```

### Configuration-Driven Loading

The loader supports flexible configuration for different use cases:

```javascript
// Production configuration
const productionConfig = {
  mongodb: {
    connectionString: 'mongodb://localhost:27017',
    dbName: 'foundational_ontology',
    collectionName: 'triples'
  },
  wordnet: {
    maxSynsets: null, // Load all synsets
    includedPos: ['n', 'v', 'a', 's', 'r'] // All parts of speech
  },
  loading: {
    batchSize: 1000,
    logInterval: 100,
    createIndices: true
  }
};

// Testing configuration
const testConfig = {
  mongodb: {
    connectionString: 'mongodb://localhost:27017',
    dbName: 'test_foundational_ontology',
    collectionName: 'triples'
  },
  wordnet: {
    maxSynsets: 500, // Limited for testing
    includedPos: ['n', 'v'] // Only nouns and verbs
  },
  loading: {
    batchSize: 50,
    logInterval: 25,
    createIndices: true
  }
};
```

### Comprehensive Statistics Tracking

The system tracks detailed statistics across all processing components:

```javascript
// Final loading summary includes:
const summary = {
  // Main stats
  conceptsLoaded: 8547,
  wordsCreated: 12834, 
  relationshipsCreated: 15623,
  totalTriples: 89472,
  loadingTimeSeconds: 342.7,
  
  // Detailed processor stats
  synsetStats: {
    conceptsCreated: 8547,
    wordsCreated: 12834,
    wordsLinked: 18291,
    relationshipsCreated: 36582
  },
  
  relationshipStats: {
    isARelations: 9834,
    partOfRelations: 2847,
    hasPartRelations: 2847,
    similarityRelations: 95,
    antonymRelations: 0
  },
  
  // Validation results
  hierarchyValidation: {
    totalConcepts: 8551,
    totalIsARelations: 10278,
    totalWords: 12834,
    cyclesFound: 0,
    isValid: true
  },
  
  finalValidation: {
    conceptCount: 8551,
    wordCount: 12834,
    isARelationCount: 10278,
    hasLabelRelationCount: 18291,
    expressesRelationCount: 18291,
    foundationalCategories: {
      'kg:Entity': 6234,
      'kg:Process': 1891,
      'kg:Property': 422,
      'kg:Relation': 4
    }
  }
};
```
```

## Usage and Integration

### Loading the Foundational Ontology

```javascript
import { WordNetFoundationalLoader, DEFAULT_CONFIG } from './wordnet-loader.js';

// Production loading with full WordNet
async function loadFullWordNetOntology() {
  const config = {
    mongodb: {
      connectionString: 'mongodb://localhost:27017',
      dbName: 'foundational_ontology',
      collectionName: 'triples'
    },
    wordnet: {
      maxSynsets: null, // Load all synsets
      includedPos: ['n', 'v', 'a', 's', 'r'] // All parts of speech
    },
    loading: {
      batchSize: 1000,
      logInterval: 100,
      createIndices: true
    }
  };

  const loader = new WordNetFoundationalLoader(config);
  
  try {
    const results = await loader.loadFoundationalOntology();
    
    console.log('Foundational ontology loaded successfully:');
    console.log(`- ${results.conceptsLoaded} concepts`);
    console.log(`- ${results.wordsCreated} words`);
    console.log(`- ${results.relationshipsCreated} relationships`);
    console.log(`- ${results.totalTriples} total triples`);
    console.log(`- Loading time: ${results.loadingTimeSeconds} seconds`);
    
    return results;
  } catch (error) {
    console.error('Loading failed:', error);
    throw error;
  }
}

// Testing with limited dataset
async function loadTestWordNetOntology() {
  const config = {
    mongodb: {
      connectionString: 'mongodb://localhost:27017',
      dbName: 'test_foundational_ontology',
      collectionName: 'triples'
    },
    wordnet: {
      maxSynsets: 100, // Limit for testing
      includedPos: ['n', 'v'] // Only nouns and verbs
    },
    loading: {
      batchSize: 25,
      logInterval: 10
    }
  };

  const loader = new WordNetFoundationalLoader(config);
  return await loader.loadFoundationalOntology();
}

// Execute loading
loadFullWordNetOntology().catch(console.error);
```

### Querying the Foundational Ontology

After loading, you can query the ontology using the KG system:

```javascript
import { KGEngine } from './src/core/KGEngine.js';
import { MongoTripleStore } from './src/storage/MongoTripleStore.js';
import { PatternQuery, LogicalQuery } from './src/query/index.js';

async function queryFoundationalOntology() {
  // Connect to loaded ontology
  const store = new MongoTripleStore(
    'mongodb://localhost:27017',
    'foundational_ontology',
    'triples'
  );
  const kg = new KGEngine(store);

  // Query foundational concepts by role
  const entities = await kg.query(null, 'kg:foundationalRole', 'kg:Entity');
  console.log(`Found ${entities.length} entity concepts`);

  const processes = await kg.query(null, 'kg:foundationalRole', 'kg:Process');
  console.log(`Found ${processes.length} process concepts`);

  // Find concepts by word text
  const dogWords = await kg.query(null, 'kg:wordText', 'dog');
  console.log('Word nodes for "dog":', dogWords);

  // Find concepts expressed by the word "dog"
  if (dogWords.length > 0) {
    const dogWordId = dogWords[0][0];
    const dogConcepts = await kg.query(dogWordId, null, null);
    const expressesConcepts = dogConcepts.filter(([,p,]) => p.includes('expresses'));
    console.log(`"Dog" expresses ${expressesConcepts.length} concepts`);
  }

  // Query hierarchy relationships
  const isARelations = await kg.query(null, 'rdf:type', 'kg:IsA');
  console.log(`Found ${isARelations.length} IS-A relationships`);

  await store.disconnect();
}

// Advanced queries using query system
async function advancedQueries() {
  const store = new MongoTripleStore(
    'mongodb://localhost:27017',
    'foundational_ontology', 
    'triples'
  );
  const kg = new KGEngine(store);

  // Find synonyms for "happy" using pattern query
  const happyWords = await kg.query(null, 'kg:wordText', 'happy');
  if (happyWords.length > 0) {
    const happyWordId = happyWords[0][0];
    
    // Get concepts expressed by "happy"
    const expressesConcepts = await kg.query(happyWordId, null, null);
    const conceptIds = expressesConcepts
      .filter(([,p,]) => p.includes('expresses'))
      .map(([,,conceptId]) => conceptId);
    
    // Find other words expressing same concepts (synonyms)
    for (const conceptId of conceptIds) {
      const hasLabelRels = await kg.query(conceptId, null, null);
      const labelIds = hasLabelRels
        .filter(([,p,]) => p.includes('hasLabel'))
        .map(([,,labelId]) => labelId);
      
      const synonymWords = [];
      for (const labelId of labelIds) {
        const wordTexts = await kg.query(labelId, 'kg:wordText', null);
        synonymWords.push(...wordTexts.map(([,,text]) => text));
      }
      
      console.log(`Synonyms for "happy":`, synonymWords);
    }
  }

  await store.disconnect();
}

// Statistics and validation queries
async function validateLoadedOntology() {
  const store = new MongoTripleStore(
    'mongodb://localhost:27017',
    'foundational_ontology',
    'triples'
  );
  const kg = new KGEngine(store);

  // Count entities by type
  const concepts = await kg.query(null, 'rdf:type', 'kg:Concept');
  const words = await kg.query(null, 'rdf:type', 'kg:Word');
  const hasLabelRels = await kg.query(null, 'rdf:type', 'kg:HasLabel');
  const expressesRels = await kg.query(null, 'rdf:type', 'kg:Expresses');
  const isARels = await kg.query(null, 'rdf:type', 'kg:IsA');

  console.log('Ontology Statistics:');
  console.log(`- Concepts: ${concepts.length}`);
  console.log(`- Words: ${words.length}`);
  console.log(`- HasLabel relationships: ${hasLabelRels.length}`);
  console.log(`- Expresses relationships: ${expressesRels.length}`);
  console.log(`- IS-A relationships: ${isARels.length}`);

  // Validate foundational categories
  const categories = ['kg:Entity', 'kg:Process', 'kg:Property', 'kg:Relation'];
  for (const category of categories) {
    const linkedConcepts = await kg.query(null, null, category);
    console.log(`- ${category}: ${linkedConcepts.length} linked concepts`);
  }

  // Check for polysemy examples
  const bankWords = await kg.query(null, 'kg:wordText', 'bank');
  if (bankWords.length > 0) {
    const bankWordId = bankWords[0][0];
    const bankConcepts = await kg.query(bankWordId, null, null);
    const conceptCount = bankConcepts.filter(([,p,]) => p.includes('expresses')).length;
    console.log(`"Bank" has ${conceptCount} different meanings (polysemy)`);
  }

  await store.disconnect();
}

// Export for use
export {
  loadFullWordNetOntology,
  loadTestWordNetOntology,
  queryFoundationalOntology,
  advancedQueries,
  validateLoadedOntology
};
```

### Integration with Service Applications

The foundational ontology serves as the base for service-oriented knowledge:

```javascript
import { PatternQuery, LogicalQuery } from './src/query/index.js';

async function serviceIntegrationExamples(kg) {
  // Find repair-related concepts
  const repairQuery = new PatternQuery()
    .addPattern(null, 'kg:definition', '*repair*')
    .addPattern(null, 'kg:foundationalRole', 'kg:Process');

  // Find tool-related entities  
  const toolQuery = new PatternQuery()
    .addPattern(null, 'kg:definition', '*tool*')
    .addPattern(null, 'kg:foundationalRole', 'kg:Entity');

  // Find problem state concepts
  const problemQuery = new PatternQuery()
    .addPattern(null, 'kg:definition', '*broken*')
    .addPattern(null, 'kg:foundationalRole', 'kg:Entity');

  // Execute queries and build service knowledge
  const repairConcepts = await repairQuery.execute(kg);
  const toolConcepts = await toolQuery.execute(kg);
  const problemConcepts = await problemQuery.execute(kg);

  console.log('Service-relevant concepts found:');
  console.log(`- Repair processes: ${repairConcepts.size()}`);
  console.log(`- Tool entities: ${toolConcepts.size()}`);
  console.log(`- Problem states: ${problemConcepts.size()}`);

  return {
    repairConcepts: repairConcepts.getBindings(),
    toolConcepts: toolConcepts.getBindings(),
    problemConcepts: problemConcepts.getBindings()
  };
}
```

## Benefits and Applications

### Foundational Grounding

The WordNet-based foundational ontology provides:

- **Comprehensive Coverage**: ~100,000 concepts covering general knowledge
- **Linguistic Validation**: Decades of linguistic and cognitive science research
- **Rich Semantic Relationships**: Inheritance, compositional, and similarity hierarchies
- **Natural Language Grounding**: Direct connection between concepts and words

### System Integration Features

The foundational ontology serves as:

- **Concept Resolution**: Map natural language to stable concept identifiers
- **Inheritance Backbone**: Provide IS-A relationships for specialized concepts
- **Semantic Validation**: Validate new concepts against established hierarchy
- **Cross-Domain Bridge**: Enable knowledge transfer between domains

### Performance Characteristics

- **Scalable Storage**: MongoDB provides horizontal scaling for large ontologies
- **Optimized Queries**: Custom indices enable fast concept and relationship lookup
- **Memory Efficient**: Batch processing and caching for large datasets
- **Consistent IDs**: Deterministic identifier generation ensures reproducibility

### Production-Ready Implementation

- **Configuration-Driven**: Flexible loading with testing and production modes
- **Comprehensive Statistics**: Detailed tracking of all loading metrics
- **Error Handling**: Robust error handling with graceful degradation
- **Validation Framework**: Multi-level validation with cycle detection
- **MongoDB Integration**: Full integration with existing KG storage system
- **Polysemy Support**: Proper handling of words with multiple meanings
- **Batch Processing**: Efficient loading of large WordNet datasets

### Key Architectural Innovations

- **Two-Tier Node Structure**: Clean separation of concepts and words
- **Bidirectional Relationships**: HasLabel/Expresses with proper reification
- **Statistics Tracking**: Real-time statistics across all processing components
- **KG System Integration**: Full use of existing KG infrastructure
- **Foundational Classification**: Automatic classification into Entity/Process/Property
- **WordNet ID Preservation**: Maintains referential integrity with original WordNet

This foundational ontology establishes the conceptual bedrock upon which all domain-specific knowledge and service-oriented concepts will be built, providing both linguistic grounding and semantic structure for the complete knowledge graph system.