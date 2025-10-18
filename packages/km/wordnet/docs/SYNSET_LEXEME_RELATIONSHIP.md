# Synset-Lexeme Relationship in WordNet Semantic Search

## Overview

WordNet has a **many-to-many relationship** between synsets and lexemes:
- **Synset**: A set of synonyms representing a single concept (e.g., {entity, thing})
- **Lexeme**: A word that can appear in multiple synsets with different meanings

This document explains how we handle this relationship in both MongoDB storage and Qdrant semantic search.

## The Relationship

### Example: The word "run"

The lexeme "run" appears in 57 different synsets in WordNet, each representing a different sense/meaning:

1. Synset 1926311.v: {**run**, go, pass, lead, extend}
   - Definition: "stretch out over a distance"
   - Example: "The park runs along the river"

2. Synset 2051878.v: {**run**, execute}
   - Definition: "carry out a command in a computer program"
   - Example: "Run the program"

3. Synset 1926311.v: {**run**, operate, go}
   - Definition: "perform a function"
   - Example: "The car runs smoothly"

And 54 more synsets...

### The Many-to-Many Pattern

```
Synset A: {run, sprint, race}      ←─┐
Synset B: {run, execute, perform}    ├─→ Lexeme: "run"
Synset C: {run, flow, stream}      ←─┘

Lexeme "execute" ←─┬─→ Synset B: {run, execute, perform}
                   └─→ Synset D: {execute, kill, put_to_death}
```

## MongoDB Storage

### Document Structure

Each synset is stored as a MongoDB document with its lexemes in an array:

```javascript
{
  synsetOffset: 2051878,
  pos: 'v',
  synonyms: ['run', 'execute'],          // ← Lexemes stored here
  definition: 'carry out a command in a computer program',
  examples: ['Run the program'],
  lexicalFile: 'verb.change',
  pointers: [...],
  created: ISODate("2025-01-15T10:30:00Z")
}
```

### MongoDB Indexes

Three indexes support efficient queries:

```javascript
// 1. Unique synset identifier
{ synsetOffset: 1, pos: 1 }  // unique: true

// 2. Query by part of speech
{ pos: 1 }

// 3. LEXEME LOOKUPS - enables reverse queries
{ synonyms: 1 }
```

### Query Patterns

#### 1. Synset → Lexemes (Direct Access)

```javascript
// Get all lexemes in a synset
const synset = await collection.findOne({
  synsetOffset: 2051878,
  pos: 'v'
});

console.log(synset.synonyms);
// ['run', 'execute']
```

**Performance**: O(1) - Direct document access

#### 2. Lexeme → Synsets (Reverse Lookup)

```javascript
// Find all synsets containing a lexeme
const synsets = await collection.find({
  synonyms: 'run'
}).toArray();

console.log(`Found ${synsets.length} synsets containing "run"`);
// Found 57 synsets containing "run"
```

**Performance**: O(log n) - Index scan on `synonyms` field

## Qdrant Semantic Search

### How Lexemes Are Embedded

When indexing synsets into Qdrant, we combine all information into a `searchText`:

```javascript
// Source synset from MongoDB
{
  synonyms: ['run', 'execute'],
  definition: 'carry out a command in a computer program',
  examples: ['Run the program']
}

// Combined into searchText
"run. execute. carry out a command in a computer program. Run the program"

// Embedded into 768-dimensional vector
[0.023, -0.145, 0.891, ..., 0.234]  // 768 numbers
```

### Vector Storage in Qdrant

Each synset becomes one vector in a POS-specific collection:

```javascript
// Qdrant document
{
  id: "2051878_v",
  vector: [0.023, -0.145, 0.891, ...],  // 768-dim embedding
  payload: {
    synsetOffset: 2051878,
    pos: 'v',
    synonyms: ['run', 'execute'],
    definition: 'carry out a command in a computer program',
    examples: ['Run the program'],
    lexicalFile: 'verb.change',
    searchText: "run. execute. carry out..."
  }
}
```

### Collections Organized by Part of Speech

- `wordnet_nouns`: ~82,000 noun synsets
- `wordnet_verbs`: ~13,000 verb synsets
- `wordnet_adjectives`: ~18,000 adjective synsets
- `wordnet_adverbs`: ~3,600 adverb synsets

### Semantic Search Behavior

#### Exact Lexeme Matches (High Scores)

```javascript
// Query: "run"
const results = await semanticSearch.search('wordnet_verbs', 'run', {
  limit: 5
});

// Returns synsets containing "run" with HIGH similarity scores
// Score: 0.95+ for exact matches
```

#### Semantic Similarity (Lower Scores)

```javascript
// Query: "execute"
const results = await semanticSearch.search('wordnet_verbs', 'execute', {
  limit: 5
});

// Returns:
// 1. Synsets containing "execute" (score ~0.95)
// 2. Synsets with "run", "perform", "carry out" (score ~0.75-0.85)
// 3. Semantically related synsets (score ~0.60-0.70)
```

### Why This Works Well

1. **Context-Rich Embeddings**: Each vector captures:
   - All lexemes in the synset
   - The definition explaining the concept
   - Example usage sentences

2. **Natural Disambiguation**: Different senses of "run" have different definitions/examples, creating distinct vectors

3. **Semantic Clustering**: Related concepts naturally cluster in vector space

4. **Efficient Search**: O(log n) approximate nearest neighbor search

## Implementation Code

### Building searchText (WordNetSemanticIndexer.js)

```javascript
_buildSearchText(synset) {
  const parts = [
    ...(synset.synonyms || []),      // All lexemes
    synset.definition || '',          // Concept definition
    ...(synset.examples || [])        // Usage examples
  ];
  return parts.filter(p => p).join('. ');
}
```

### Indexing by POS (WordNetSemanticIndexer.js)

```javascript
async indexByPOS(collection, pos, qdrantCollection) {
  // Query MongoDB for all synsets with this POS
  const synsets = await collection.find({ pos }).toArray();

  // Build Qdrant documents
  const documents = synsets.map(synset => ({
    id: `${synset.synsetOffset}_${synset.pos}`,
    synsetOffset: synset.synsetOffset,
    pos: synset.pos,
    synonyms: synset.synonyms || [],
    definition: synset.definition || '',
    examples: synset.examples || [],
    lexicalFile: synset.lexicalFile || '',
    searchText: this._buildSearchText(synset)
  }));

  // Insert with embeddings (batched)
  const batchSize = 100;
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    await this.semanticSearch.insert(qdrantCollection, batch);
  }
}
```

## Advantages of This Approach

### ✅ Simplicity
- No separate lexeme collection needed
- No complex join operations
- Straightforward document model

### ✅ Performance
- MongoDB: O(log n) lexeme lookups via index
- Qdrant: O(log n) semantic similarity search
- Batch indexing handles 117K synsets efficiently

### ✅ Semantic Power
- Captures full context of each synset
- Disambiguates word senses naturally
- Finds semantically related concepts

### ✅ Flexibility
- Can query by exact lexeme (MongoDB)
- Can search by semantic similarity (Qdrant)
- Can filter by part of speech (both)

## Alternative Approaches (Not Used)

### ❌ Separate Lexeme Collection

```javascript
// NOT IMPLEMENTED - unnecessary complexity
{
  lexeme: 'run',
  synsets: [1926311, 2051878, ...57 refs]
}
```

**Why not**:
- Adds complexity with no benefit
- MongoDB index on synonyms provides same functionality
- Would complicate semantic search

### ❌ Embedding Individual Lexemes

```javascript
// NOT IMPLEMENTED - loses context
{
  lexeme: 'run',
  vector: [0.123, ...]  // Generic "run" embedding
}
```

**Why not**:
- Loses context of which synset/sense
- Can't distinguish "run a program" vs "run a race"
- Synset-level embeddings capture more meaning

### ❌ Graph Database

```javascript
// NOT IMPLEMENTED - overkill
(:Synset)-[:CONTAINS]->(:Lexeme)
(:Lexeme)-[:APPEARS_IN]->(:Synset)
```

**Why not**:
- MongoDB with indexes provides needed functionality
- Graph queries not required for this use case
- Would add infrastructure complexity

## Usage Examples

### Query All Synsets for a Lexeme

```javascript
import { MongoClient } from 'mongodb';

const client = new MongoClient('mongodb://localhost:27017');
await client.connect();
const collection = client.db('wordnet').collection('synsets');

// Find all senses of "run"
const senses = await collection.find({
  synonyms: 'run'
}).toArray();

senses.forEach(synset => {
  console.log(`${synset.pos}: ${synset.definition}`);
  console.log(`  Synonyms: [${synset.synonyms.join(', ')}]`);
});
```

### Semantic Search for Concept

```javascript
import { ResourceManager } from '@legion/resource-manager';

const resourceManager = await ResourceManager.getInstance();
const semanticSearch = await resourceManager.get('semanticSearch');

// Find synsets semantically similar to "execute command"
const results = await semanticSearch.search(
  'wordnet_verbs',
  'execute command',
  { limit: 5 }
);

results.forEach(result => {
  console.log(`[${result.document.synonyms.join(', ')}]`);
  console.log(`  ${result.document.definition}`);
  console.log(`  Score: ${result.score.toFixed(4)}`);
});
```

### Count Synsets per Lexeme

```javascript
// How many senses does this word have?
const wordCounts = await collection.aggregate([
  { $unwind: '$synonyms' },
  { $group: { _id: '$synonyms', count: { $sum: 1 } } },
  { $match: { _id: { $in: ['run', 'good', 'quickly'] } } },
  { $sort: { count: -1 } }
]).toArray();

// Results:
// run: 57 synsets
// good: 27 synsets
// quickly: 3 synsets
```

## Testing

See test scripts demonstrating the relationship:
- `__tests__/tmp/test-lexeme-lookup.js` - MongoDB queries
- `__tests__/tmp/test-semantic-lexeme-search.js` - Semantic search

Run tests:
```bash
node __tests__/tmp/test-lexeme-lookup.js
node __tests__/tmp/test-semantic-lexeme-search.js
```

## Summary

The synset-lexeme many-to-many relationship is handled elegantly:

1. **Storage**: MongoDB documents with synonyms arrays + index
2. **Retrieval**: Direct access (synset→lexemes) and indexed queries (lexeme→synsets)
3. **Semantic Search**: Qdrant vectors embedding full synset context
4. **Performance**: O(log n) for both MongoDB and Qdrant operations

No separate lexeme collection or graph database is needed. The simple document model with proper indexing provides all required functionality efficiently.
