# Semantic Search & Gloss Generation Flow

## Yes, It's Actually Running!

The system uses **real semantic search** with:
- **Nomic embeddings** (nomic-embed-text-v1.5.Q4_K_M.gguf) - Local GGUF model
- **Qdrant vector store** (localhost:6333) - Vector database
- **LocalEmbeddingService** - Wraps Nomic for embedding generation

You can verify this in the demo output:
```
🔧 Creating local hash-based embedding service
🔧 Creating Qdrant vector store
Loading model: nomic-embed-text-v1.5.Q4_K_M.gguf
NomicEmbeddings initialized successfully
```

## How Glosses (Descriptions) Are Generated

### 1. LLM Extracts Types from Sentences

**Source:** `src/prompts/extract-implied-types.hbs`

When processing a sentence like:
```
"The centrifugal pump operates at 150 PSI"
```

The LLM extracts structured types:
```json
{
  "classes": [
    {
      "name": "CentrifugalPump",
      "description": "Pump using centrifugal force"  ← LLM generates this!
    }
  ],
  "relationships": [
    {
      "name": "connectsTo",
      "description": "Physical connection between components",  ← LLM generates this!
      "domain": "Pump",
      "range": "Tank"
    }
  ]
}
```

**The LLM generates descriptions based on:**
- Sentence context
- Domain knowledge
- Semantic understanding of the concept

### 2. Descriptions Become RDF Comments

**Source:** `OntologyExtensionService.extendFromGaps()` (lines 76-166)

Extracted descriptions are stored as `rdfs:comment` triples:
```javascript
[
  ['kg:CentrifugalPump', 'rdf:type', 'owl:Class'],
  ['kg:CentrifugalPump', 'rdfs:label', '"CentrifugalPump"'],
  ['kg:CentrifugalPump', 'rdfs:comment', '"Pump using centrifugal force"'],  ← Description
  ['kg:CentrifugalPump', 'rdfs:subClassOf', 'kg:Pump']
]
```

### 3. Indexed into Semantic Search

**Source:** `OntologyExtensionService.indexNewClasses()` (lines 335-360)

```javascript
async indexNewClasses(additions) {
  for (const classTriple of classTriples) {
    const classURI = classTriple[0];

    // Get label and description from triples
    const label = labelTriples[0]?.[2]?.replace(/"/g, '') || '';
    const description = commentTriples[0]?.[2]?.replace(/"/g, '') || '';

    // Build text for embedding: "label: description"
    const text = description ? `${label}: ${description}` : label;

    // Insert into Qdrant with Nomic embeddings
    await this.semanticSearch.insert('ontology-classes', {
      text,  // "CentrifugalPump: Pump using centrifugal force"
      metadata: {
        classURI: 'kg:CentrifugalPump',
        label: 'CentrifugalPump'
      }
    });
  }
}
```

**What gets embedded:**
- Format: `"Label: Description"`
- Example: `"CentrifugalPump: Pump using centrifugal force"`
- Falls back to just label if no description

### 4. Finding Existing Types with Semantic Search

**Source:** `OntologyQueryService.findRelevantTypesForSentence()` (lines 45-86)

When processing a new sentence:

```javascript
// 1. Extract mentions from new sentence using LLM
const mentions = await this.extractTypeMentions(sentence, llmClient);
// mentions = ["pump", "centrifugal pump", "heat exchanger"]

// 2. For each mention, search the vector index
for (const mention of mentions) {
  const similar = await this.semanticSearch.semanticSearch(
    'ontology-classes',
    mention,  // Search query
    { limit: 3 }  // Top 3 results
  );

  // 3. Check similarity threshold
  if (similar.length > 0 && similar[0]._similarity > 0.75) {
    const classURI = similar[0].id;  // Found existing class!

    // 4. Get full hierarchical context
    const hierarchy = await this.hierarchyTraversal.getHierarchyContext(classURI);
    const properties = await this.getInheritedProperties(classURI);
    const relationships = await this.getInheritedRelationships(classURI);

    results.push({
      mention,
      matchedClass: classURI,
      similarity: similar[0]._similarity,
      hierarchy,
      properties,
      relationships
    });
  } else {
    // Gap identified - need to create new class
    results.push({
      mention,
      matchedClass: null,
      isGap: true
    });
  }
}
```

## Complete Flow Example

### Sentence 1: "The plumber installs a copper pipe"
```
1. LLM extracts: Plumber, Pipe, installs relationship
2. LLM generates descriptions:
   - Plumber: "Professional who works with pipes and fixtures"
   - Pipe: "Tubular conduit for conveying fluids"
3. No existing types found (empty ontology)
4. Creates classes with descriptions
5. Indexes into Qdrant:
   - "Plumber: Professional who works with pipes and fixtures"
   - "Pipe: Tubular conduit for conveying fluids"
```

### Sentence 2: "The plumber repairs a faucet"
```
1. LLM extracts: Plumber, Faucet
2. Semantic search finds "Plumber" (similarity: 0.98)
3. Returns full context: hierarchy, properties, relationships
4. Gap analysis: Faucet not found (new)
5. LLM generates: Faucet: "Fixture for controlling water flow"
6. Creates Faucet class and indexes it
```

## Similarity Threshold

**Threshold: 0.75**

```javascript
if (similar[0]._similarity > 0.75) {
  // Match found - reuse existing class
} else {
  // Gap identified - create new class
}
```

This ensures:
- High confidence matches reuse existing types
- Avoids false positives
- Creates new types when genuinely new concepts appear

## Vector Collections

The system uses a single collection for classes:
- **Collection:** `ontology-classes`
- **Indexed:** Entity classes (not relationships)
- **Text format:** `"Label: Description"` or `"Label"`
- **Metadata:** `{classURI, label}`

**Note:** Relationships are NOT currently indexed in semantic search. They're found through:
- Domain compatibility checking
- Mathematical subsumption filtering
- LLM semantic pattern recognition

## Technical Stack

```
┌─────────────────────────────────────────┐
│  Sentence: "centrifugal pump..."        │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  LLM (Claude/GPT)                       │
│  Extracts: {name, description}          │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  RDF Triple Store                       │
│  rdfs:comment = description             │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Nomic Embeddings                       │
│  Generates vector for "Label: Desc"     │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Qdrant Vector Store                    │
│  Stores embeddings + metadata           │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Semantic Search                        │
│  Finds similar types (threshold: 0.75)  │
└─────────────────────────────────────────┘
```

## Key Insights

1. **Glosses are LLM-generated** - Not hardcoded or extracted from dictionaries
2. **Context-aware** - Descriptions reflect how concepts are used in sentences
3. **Incremental learning** - Each new sentence adds to the searchable knowledge
4. **Real embeddings** - Uses actual Nomic model, not mocks or hashes
5. **Production-ready** - Connects to real Qdrant instance on localhost

## Verification

Run the demo and watch for:
```bash
NODE_OPTIONS='--experimental-vm-modules' node __tests__/tmp/demo-plumbing-walkthrough.js 2>&1 | grep -i "semantic\|embed\|nomic"
```

You'll see:
- Nomic model loading
- Qdrant connections
- Collection operations
- Semantic search queries
