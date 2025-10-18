# WordNet Semantic Search - Simple Design

## Overview

Load all WordNet synsets into MongoDB, then create semantic vector indexes in Qdrant for fast similarity search.

**Goal:** Enable semantic search across all 117K WordNet synsets organized by part of speech.

## Architecture

```
WordNet Data Files
       ↓
SimpleWordNetLoader
       ↓
MongoDB (wordnet.synsets)
  - 82,192 nouns
  - 13,767 verbs
  - 18,185 adjectives
  - 3,625 adverbs
       ↓
WordNetSemanticIndexer
       ↓
Qdrant Vector Store
  - wordnet_nouns
  - wordnet_verbs
  - wordnet_adjectives
  - wordnet_adverbs
```

## MongoDB Schema

Each synset is stored as a simple document:

```javascript
{
  _id: ObjectId(...),
  synsetOffset: 1740,                    // WordNet synset offset
  pos: 'n',                              // Part of speech: n, v, a, r
  synonyms: ['entity', 'thing'],         // Synonym words
  definition: 'that which is perceived or known or inferred...',
  examples: ['the entity was hard to describe'],
  lexicalFile: 'noun.Tops',
  pointers: [{                           // Relationships to other synsets
    pointerSymbol: '@',
    synsetOffset: 100001,
    pos: 'n',
    sourceTarget: '0000'
  }],
  created: ISODate(...)
}
```

**Indexes:**
- `{ synsetOffset: 1, pos: 1 }` - Unique
- `{ pos: 1 }` - Query by part of speech
- `{ synonyms: 1 }` - Word lookup

## Qdrant Schema

Each synset becomes a vector document:

```javascript
{
  id: '1740_n',                          // synsetOffset_pos
  synsetOffset: 1740,
  pos: 'n',
  synonyms: ['entity', 'thing'],
  definition: 'that which is perceived...',
  examples: ['the entity was hard to describe'],
  searchText: 'entity, thing. that which is perceived...',  // For embedding
  vector: [0.123, -0.456, ...]           // 384-dim embedding
}
```

**Collections:**
- `wordnet_nouns` - ~82K noun synsets
- `wordnet_verbs` - ~13K verb synsets
- `wordnet_adjectives` - ~18K adjective synsets (includes satellite adjectives)
- `wordnet_adverbs` - ~3.6K adverb synsets

## Implementation

### 1. Load WordNet into MongoDB

**Script:** `scripts/load-wordnet-simple.js`

```javascript
import { SimpleWordNetLoader } from '../src/loader/SimpleWordNetLoader.js';

const loader = new SimpleWordNetLoader({
  mongodb: {
    connectionString: 'mongodb://localhost:27017',
    dbName: 'wordnet',
    collectionName: 'synsets'
  },
  wordnet: {
    maxSynsets: null,                    // Load all
    includedPos: ['n', 'v', 'a', 'r']    // All parts of speech
  },
  loading: {
    batchSize: 1000
  }
});

await loader.loadWordNet();
```

**Run:**
```bash
npm run load-wordnet
```

**Expected Output:**
```
Loading n synsets...
Found 82192 synsets for POS: n
Loaded 82192 n synsets

Loading v synsets...
Found 13767 synsets for POS: v
Loaded 13767 v synsets

Loading a synsets...
Found 18185 synsets for POS: a
Loaded 18185 a synsets

Loading r synsets...
Found 3625 synsets for POS: r
Loaded 3625 r synsets

=== LOADING COMPLETE ===
Synsets loaded: 117791
Time: 60.23 seconds
Speed: 1956 synsets/second
========================
```

### 2. Index Synsets into Qdrant

**Class:** `src/semantic/WordNetSemanticIndexer.js`

```javascript
export class WordNetSemanticIndexer {
  constructor(resourceManager) {
    this.resourceManager = resourceManager;
    this.mongoClient = null;
    this.semanticSearch = null;
    this.initialized = false;
  }

  async initialize() {
    // Get MongoDB client
    const { MongoClient } = await import('mongodb');
    const mongoUri = this.resourceManager.get('env.MONGODB_URI') || 'mongodb://localhost:27017';
    this.mongoClient = new MongoClient(mongoUri);
    await this.mongoClient.connect();

    // Get semantic search provider
    this.semanticSearch = await this.resourceManager.get('semanticSearch');

    this.initialized = true;
  }

  async indexAllSynsets() {
    if (!this.initialized) {
      throw new Error('Not initialized');
    }

    console.log('Starting semantic indexing...');

    const db = this.mongoClient.db('wordnet');
    const collection = db.collection('synsets');

    // Index each POS separately
    await this.indexByPOS(collection, 'n', 'wordnet_nouns');
    await this.indexByPOS(collection, 'v', 'wordnet_verbs');
    await this.indexByPOS(collection, 'a', 'wordnet_adjectives');
    await this.indexByPOS(collection, 'r', 'wordnet_adverbs');

    const stats = await this.getStats();
    console.log('Indexing complete!');
    console.log(`- Nouns: ${stats.nouns}`);
    console.log(`- Verbs: ${stats.verbs}`);
    console.log(`- Adjectives: ${stats.adjectives}`);
    console.log(`- Adverbs: ${stats.adverbs}`);
    console.log(`- Total: ${stats.total}`);
  }

  async indexByPOS(collection, pos, qdrantCollection) {
    console.log(`\nIndexing ${pos} synsets into ${qdrantCollection}...`);

    // Query MongoDB for this POS
    const synsets = await collection.find({ pos }).toArray();
    console.log(`Found ${synsets.length} synsets`);

    // Build documents for Qdrant
    const documents = synsets.map(synset => ({
      id: `${synset.synsetOffset}_${synset.pos}`,
      synsetOffset: synset.synsetOffset,
      pos: synset.pos,
      synonyms: synset.synonyms || [],
      definition: synset.definition || '',
      examples: synset.examples || [],
      searchText: this._buildSearchText(synset)
    }));

    // Insert into Qdrant with embeddings (batched)
    const batchSize = 100;
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      await this.semanticSearch.insert(qdrantCollection, batch);
      console.log(`  Indexed ${Math.min(i + batchSize, documents.length)}/${documents.length}`);
    }

    console.log(`Completed ${pos} indexing`);
  }

  _buildSearchText(synset) {
    // Combine all textual information for embedding
    const parts = [
      ...(synset.synonyms || []),
      synset.definition || '',
      ...(synset.examples || [])
    ];
    return parts.filter(p => p).join('. ');
  }

  async getStats() {
    const [nouns, verbs, adjectives, adverbs] = await Promise.all([
      this.semanticSearch.count('wordnet_nouns'),
      this.semanticSearch.count('wordnet_verbs'),
      this.semanticSearch.count('wordnet_adjectives'),
      this.semanticSearch.count('wordnet_adverbs')
    ]);

    return {
      nouns,
      verbs,
      adjectives,
      adverbs,
      total: nouns + verbs + adjectives + adverbs
    };
  }

  async close() {
    if (this.mongoClient) {
      await this.mongoClient.close();
    }
  }
}
```

**Script:** `scripts/index-semantic-search.js`

```javascript
import { ResourceManager } from '@legion/resource-manager';
import { WordNetSemanticIndexer } from '../src/semantic/WordNetSemanticIndexer.js';

async function main() {
  const resourceManager = await ResourceManager.getInstance();
  const indexer = new WordNetSemanticIndexer(resourceManager);

  try {
    await indexer.initialize();
    await indexer.indexAllSynsets();
  } finally {
    await indexer.close();
  }
}

main().catch(console.error);
```

**Run:**
```bash
npm run index-semantic
```

### 3. Query Interface

Simple semantic search by part of speech:

```javascript
import { ResourceManager } from '@legion/resource-manager';

const resourceManager = await ResourceManager.getInstance();
const semanticSearch = await resourceManager.get('semanticSearch');

// Find nouns similar to "person"
const personNouns = await semanticSearch.semanticSearch('wordnet_nouns', 'person', {
  limit: 10,
  threshold: 0.6
});

// Find adjectives similar to "heavy"
const heavyAdjectives = await semanticSearch.semanticSearch('wordnet_adjectives', 'heavy', {
  limit: 10,
  threshold: 0.6
});

// Find verbs similar to "run quickly"
const runVerbs = await semanticSearch.semanticSearch('wordnet_verbs', 'run quickly', {
  limit: 10,
  threshold: 0.5
});
```

**Result Format:**
```javascript
[
  {
    id: '1740_n',
    score: 0.89,
    document: {
      synsetOffset: 1740,
      pos: 'n',
      synonyms: ['entity', 'thing'],
      definition: 'that which is perceived...',
      examples: ['the entity was hard to describe'],
      searchText: '...'
    }
  },
  // ... more results
]
```

## Testing

### Unit Tests

```javascript
describe('WordNetSemanticIndexer', () => {
  let indexer;
  let resourceManager;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    indexer = new WordNetSemanticIndexer(resourceManager);
    await indexer.initialize();
  });

  afterAll(async () => {
    await indexer.close();
  });

  test('should index nouns from MongoDB', async () => {
    await indexer.indexByPOS(
      indexer.mongoClient.db('wordnet').collection('synsets'),
      'n',
      'wordnet_nouns'
    );

    const stats = await indexer.getStats();
    expect(stats.nouns).toBeGreaterThan(80000);
  });

  test('should find similar nouns', async () => {
    const semanticSearch = await resourceManager.get('semanticSearch');
    const results = await semanticSearch.semanticSearch('wordnet_nouns', 'person', {
      limit: 5
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].document.synonyms).toContain('person');
  });
});
```

### Integration Tests

```javascript
describe('WordNet Semantic Search Integration', () => {
  test('should provide semantic search across all POS', async () => {
    const resourceManager = await ResourceManager.getInstance();
    const semanticSearch = await resourceManager.get('semanticSearch');

    // Search each collection
    const [nouns, verbs, adjectives, adverbs] = await Promise.all([
      semanticSearch.semanticSearch('wordnet_nouns', 'person', { limit: 5 }),
      semanticSearch.semanticSearch('wordnet_verbs', 'run', { limit: 5 }),
      semanticSearch.semanticSearch('wordnet_adjectives', 'heavy', { limit: 5 }),
      semanticSearch.semanticSearch('wordnet_adverbs', 'quickly', { limit: 5 })
    ]);

    expect(nouns.length).toBeGreaterThan(0);
    expect(verbs.length).toBeGreaterThan(0);
    expect(adjectives.length).toBeGreaterThan(0);
    expect(adverbs.length).toBeGreaterThan(0);
  });
});
```

## Performance

**Indexing (Apple M4):**
- Embedding generation: ~2ms per synset
- Total indexing time: ~4-5 minutes for all 117K synsets
- Memory usage: ~500MB peak

**Query:**
- Single semantic search: 10-30ms
- Parallel search across all POS: 20-50ms

## Configuration

**Environment Variables:**
```bash
# MongoDB
MONGODB_URI=mongodb://localhost:27017

# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=  # Optional
```

**Package.json Scripts:**
```json
{
  "scripts": {
    "load-wordnet": "node scripts/load-wordnet-simple.js",
    "index-semantic": "node scripts/index-semantic-search.js",
    "check-wordnet": "node scripts/check-wordnet.js"
  }
}
```

## Summary

This is a simple, straightforward design:

1. **Load**: Parse WordNet files → Store in MongoDB (1 document per synset)
2. **Index**: Query MongoDB by POS → Embed → Store in Qdrant
3. **Query**: Semantic search by POS → Get similar synsets

No curation, no JSON files, no complex mappings. Just raw WordNet data with semantic search.
