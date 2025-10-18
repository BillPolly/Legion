# Semantic Inventory Package - Design Document

## Overview

The `@legion/semantic-inventory` package provides semantic symbol selection services for the DRS (Discourse Representation Structure) pipeline. It creates and manages specialized Qdrant vector collections that categorize WordNet synsets into entity types, semantic roles, predicates, and relations needed for natural language understanding.

**Purpose:** Provide DRS with closed symbol inventories retrieved via semantic search:
- **Entity Types** - Coarse semantic categories (PERSON, LOCATION, ORGANIZATION, etc.)
- **Semantic Roles** - Event participant labels (Agent, Theme, Recipient, etc.)
- **Unary Predicates** - Properties and types (adjectives and nouns)
- **Binary Relations** - Spatial, temporal, and logical relationships

**Key Principle:** Full WordNet coverage through denormalized Qdrant collections optimized for semantic search.

## Architecture

### System Position

```
┌─────────────────────┐
│  @legion/wordnet    │  ← Source data: MongoDB (117,791 synsets)
│  MongoDB Storage    │
└──────────┬──────────┘
           │ reads
           ↓
┌─────────────────────────────┐
│ @legion/semantic-inventory  │  ← Categorization & Indexing
│ SemanticInventoryIndexer    │     Creates 4 specialized collections
└──────────┬──────────────────┘
           │ creates
           ↓
┌─────────────────────────────┐
│ Qdrant Collections:         │
│  - wordnet_entity_types     │  ← Entity categories from nouns
│  - wordnet_roles            │  ← Semantic roles (predefined)
│  - wordnet_predicates       │  ← Adjectives + noun predicates
│  - wordnet_relations        │  ← Spatial/temporal relations
└──────────┬──────────────────┘
           │ queried by
           ↓
┌─────────────────────────────┐
│ @legion/semantic-inventory  │  ← Query API
│ SemanticInventoryService    │     semanticSearchEntityTypes()
│                             │     semanticSearchRelationTypes()
└──────────┬──────────────────┘
           │ consumed by
           ↓
┌─────────────────────┐
│   @legion/drs       │  ← DRS pipeline
└─────────────────────┘
```

### Core Principles

1. **Denormalized Qdrant Collections** - Each collection stores complete data (no MongoDB joins needed during queries)
2. **Full WordNet Coverage** - ALL 117,791 synsets indexed across collections (no arbitrary limits)
3. **Semantic Search Optimized** - Collections designed for sentence-by-sentence retrieval
4. **Fail Fast** - No fallbacks, real resources only (per Legion standards)

### Coverage Summary

**Total WordNet synsets:** 117,791

**Collection Coverage:**
- `wordnet_entity_types`: 82,192 points (ALL nouns with entity type tags)
- `wordnet_roles`: ~14-20 points (predefined semantic roles)
- `wordnet_predicates`: 114,166 points (ALL adjectives + ALL nouns + ALL verbs)
- `wordnet_relations`: 3,625 points (ALL adverbs with relation type tags)

**Total indexed:** ~200,000 points (synsets appear in multiple collections by design)

**Note:** Nouns appear in BOTH `wordnet_entity_types` (as entities) AND `wordnet_predicates` (as type predicates). This is intentional - "book" is both an entity type AND a predicate (x is a book).

## Data Model

### Qdrant Collection Structure

All collections follow this pattern:

```javascript
{
  id: string,              // Point ID: "{synsetOffset}_{pos}" or custom ID
  vector: number[],        // Embedding vector (1536 dimensions)
  payload: {
    // Collection-specific fields (see below)
    synsetOffset: string,  // MongoDB reference (if applicable)
    pos: string,           // Part of speech
    label: string,         // Primary label for this entry
    definition: string,    // Human-readable definition
    examples: string[]     // Usage examples
  }
}
```

### wordnet_entity_types Collection

**Purpose:** Categorize noun synsets into coarse entity types for mention extraction.

**Source:** ALL noun synsets from `wordnet.synsets` where `pos = 'n'` with entity type categorization.

**Document Structure:**
```javascript
{
  id: "02121808_n_PERSON",
  vector: [...],  // Embedding of: "professor teacher instructor: someone who is a member of faculty..."
  payload: {
    label: "PERSON",                    // Entity type category
    synsetOffset: "02121808",           // MongoDB reference
    pos: "n",
    synonyms: ["professor", "teacher"], // Representative words
    definition: "someone who is a member of the faculty at a college or university",
    examples: ["the professor gave a lecture"],
    lexicalFile: "noun.person",
    entityType: "PERSON"                // Tag for filtering
  }
}
```

**Categories:**
- `PERSON` - Humans, groups of people
- `LOCATION` - Places, geographic entities
- `ORGANIZATION` - Companies, institutions, groups
- `ARTIFACT` - Man-made objects
- `EVENT` - Occurrences, happenings
- `TIME` - Temporal expressions
- `QUANTITY` - Measurements, amounts
- `ABSTRACT` - Ideas, concepts
- `PHYSICAL_OBJECT` - Natural objects, things
- `THING` - Generic fallback

**Indexing Strategy:**
- Query MongoDB for ALL noun synsets (82,192 total)
- Categorize EVERY noun based on lexicalFile + hypernym chain analysis
- Every noun gets a category (use THING as fallback if needed)
- Create one Qdrant point per synset with entity type tag
- Embed searchText: `synonyms + definition + examples`

**Expected Size:** 82,192 points (ALL noun synsets)

### wordnet_roles Collection

**Purpose:** Provide semantic role inventory for event participant labeling.

**Source:** Predefined role set (NOT from WordNet - these come from VerbNet/PropBank/FrameNet).

**Document Structure:**
```javascript
{
  id: "role_agent",
  vector: [...],  // Embedding of definition + examples
  payload: {
    label: "Agent",
    definition: "The volitional causer of an action or event",
    examples: [
      "John kicked the ball (John = Agent)",
      "The company announced profits (company = Agent)"
    ],
    verbnetClass: "agent",
    roleType: "core"  // core | peripheral
  }
}
```

**Roles:**
- **Core Roles:**
  - `Agent` - Volitional causer
  - `Theme` - Entity undergoing change/movement
  - `Patient` - Entity affected by action
  - `Recipient` - Receiver or beneficiary
  - `Experiencer` - Entity experiencing mental/emotional state
  - `Stimulus` - Cause of mental/emotional state

- **Peripheral Roles:**
  - `Instrument` - Tool or means
  - `Location` - Spatial location
  - `Source` - Origin point
  - `Goal` - Destination or endpoint
  - `Time` - Temporal specification
  - `Manner` - How the action is performed
  - `Purpose` - Why the action is performed
  - `Cause` - What caused the action/state

**Indexing Strategy:**
- Load predefined role definitions from `data/semantic-roles.json`
- Embed each role's definition + examples
- Create Qdrant points (small collection, ~14 roles)

**Expected Size:** ~14-20 points

### wordnet_predicates Collection

**Purpose:** Provide unary predicates (properties and types) for entity and event descriptions.

**Source:** ALL adjective synsets + ALL noun synsets (nouns function as both entity types AND type predicates) + ALL verb synsets (event predicates).

**Document Structure:**
```javascript
{
  id: "00098756_a",
  vector: [...],  // Embedding of predicate text
  payload: {
    label: "heavy",                     // Primary predicate label
    synsetOffset: "00098756",
    pos: "a",
    synonyms: ["heavy", "weighty"],
    definition: "of comparatively great physical weight or density",
    examples: ["a heavy load", "heavy clouds"],
    lexicalFile: "adj.all",
    predicateType: "property"           // property | type
  }
}
```

**Predicate Types:**
- `property` - Adjectives describing qualities (heavy, red, fast)
- `type` - Nouns used as type predicates (book, student, house)
- `event` - Verbs describing actions/states (run, give, be)

**Indexing Strategy:**
- Include ALL adjective synsets (18,185)
- Include ALL noun synsets (82,192) - nouns serve dual purpose as entity types AND type predicates
- Include ALL verb synsets (13,789) - events are predicates
- Embed searchText: `synonyms + definition + examples`
- Tag with predicateType for filtering

**Expected Size:** 114,166 points (18K adjectives + 82K nouns + 13K verbs)

### wordnet_relations Collection

**Purpose:** Provide binary relations (spatial, temporal, logical) for linking entities and events.

**Source:** ALL adverb synsets (includes prepositions and relational adverbs).

**Document Structure:**
```javascript
{
  id: "00110426_r",
  vector: [...],  // Embedding of relation description
  payload: {
    label: "in",
    synsetOffset: "00110426",
    pos: "r",
    synonyms: ["in", "inside"],
    definition: "to or toward the inside of",
    examples: ["come in", "the boat is in"],
    lexicalFile: "adv.all",
    relationType: "spatial"             // spatial | temporal | logical
  }
}
```

**Relation Types:**
- `spatial` - Location/containment (in, on, under, near, above, below)
- `temporal` - Time relationships (before, after, during, while)
- `logical` - Causation/condition (because, if, therefore, unless)

**Indexing Strategy:**
- Query ALL adverb synsets (3,625 total)
- Categorize EVERY adverb by lexicalFile and definition analysis
- Every adverb gets a relationType (spatial, temporal, or logical)
- Embed searchText: `synonyms + definition + examples`
- Tag with relationType for filtering

**Expected Size:** 3,625 points (ALL adverb synsets)

## API Specification

### SemanticInventoryService

**Main service class providing semantic search over specialized collections.**

```javascript
class SemanticInventoryService {
  /**
   * Create a new SemanticInventoryService
   * @param {ResourceManager} resourceManager - Legion ResourceManager instance
   */
  constructor(resourceManager)

  /**
   * Initialize the service by getting semantic search provider
   * @throws {Error} If semantic search not available (FAIL FAST)
   */
  async initialize()

  /**
   * Search for entity type labels relevant to input text
   *
   * Queries wordnet_entity_types collection with semantic search.
   * Returns entity type labels ranked by semantic similarity.
   *
   * @param {string} text - Input text (sentence or phrase)
   * @returns {Promise<string[]>} Entity type labels (e.g., ["PERSON", "LOCATION", ...])
   *
   * @example
   * const types = await service.semanticSearchEntityTypes("the professor walked to the building");
   * // Returns: ["PERSON", "LOCATION", "ARTIFACT", "THING"]
   */
  async semanticSearchEntityTypes(text)

  /**
   * Search for relation types (roles, predicates, relations) relevant to input text
   *
   * Queries three collections in parallel:
   * - wordnet_roles: semantic roles
   * - wordnet_predicates: unary predicates
   * - wordnet_relations: binary relations
   *
   * @param {string} text - Input text (sentence or phrase)
   * @returns {Promise<RelationInventory>} Object with roles, predicates, relations
   *
   * @example
   * const inventory = await service.semanticSearchRelationTypes("John gave Mary a heavy book");
   * // Returns: {
   * //   roles: ["Agent", "Recipient", "Theme", ...],
   * //   unaryPredicates: ["give", "book", "heavy", ...],
   * //   binaryRelations: ["to", "from", ...]
   * // }
   */
  async semanticSearchRelationTypes(text)
}
```

### RelationInventory Type

```javascript
{
  roles: string[],            // Semantic role labels
  unaryPredicates: string[],  // Property/type predicates
  binaryRelations: string[]   // Spatial/temporal/logical relations
}
```

## Implementation Details

### Categorization Logic

**Entity Type Categorization:**

```javascript
function categorizeEntityType(synset) {
  // Strategy 1: Lexical file analysis
  if (synset.lexicalFile === 'noun.person') return 'PERSON';
  if (synset.lexicalFile === 'noun.location') return 'LOCATION';
  if (synset.lexicalFile === 'noun.group') return 'ORGANIZATION';

  // Strategy 2: Hypernym chain analysis
  // Query MongoDB for hypernyms, check if synset descends from:
  //   - person.n.01 → PERSON
  //   - location.n.01 → LOCATION
  //   - organization.n.01 → ORGANIZATION

  // Strategy 3: Definition keywords
  if (synset.definition.includes('person') || synset.definition.includes('human')) {
    return 'PERSON';
  }

  // Fallback
  return 'THING';
}
```

**Relation Type Categorization:**

```javascript
function categorizeRelationType(synset) {
  const spatialKeywords = ['location', 'place', 'position', 'direction'];
  const temporalKeywords = ['time', 'when', 'duration', 'sequence'];

  if (synset.lexicalFile.includes('space')) return 'spatial';
  if (synset.lexicalFile.includes('time')) return 'temporal';

  // Check definition for keywords
  for (const keyword of spatialKeywords) {
    if (synset.definition.toLowerCase().includes(keyword)) return 'spatial';
  }
  for (const keyword of temporalKeywords) {
    if (synset.definition.toLowerCase().includes(keyword)) return 'temporal';
  }

  return 'logical';
}
```

### Indexing Process

**High-Level Flow:**

```javascript
async function indexSemanticInventory() {
  const indexer = new SemanticInventoryIndexer(resourceManager);
  await indexer.initialize();

  // Index each collection
  await indexer.indexEntityTypes();    // Query nouns, categorize, index
  await indexer.indexRoles();          // Load predefined roles, index
  await indexer.indexPredicates();     // Query adjectives + nouns, index
  await indexer.indexRelations();      // Query adverbs + verbs, index

  const stats = await indexer.getStats();
  console.log('Indexing complete:', stats);
}
```

**Per-Collection Indexing:**

```javascript
async indexEntityTypes() {
  // 1. Query MongoDB for noun synsets
  const db = this.mongoClient.db('wordnet');
  const synsets = await db.collection('synsets').find({ pos: 'n' }).toArray();

  // 2. Categorize and build documents for ALL nouns
  const documents = [];
  for (const synset of synsets) {
    const entityType = this.categorizeEntityType(synset);
    // EVERY noun gets categorized (THING is a valid category, not a skip condition)

    documents.push({
      id: `${synset.synsetOffset}_${synset.pos}_${entityType}`,
      synsetOffset: synset.synsetOffset,
      pos: synset.pos,
      label: entityType,
      synonyms: synset.synonyms,
      definition: synset.definition,
      examples: synset.examples,
      lexicalFile: synset.lexicalFile,
      entityType: entityType,
      searchText: this.buildSearchText(synset)
    });
  }

  // 3. Insert into Qdrant with embeddings (batched)
  const batchSize = 100;
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    await this.semanticSearch.insert('wordnet_entity_types', batch);
    console.log(`Indexed ${i + batch.length}/${documents.length} entity types`);
  }
}
```

### Query Implementation

**semanticSearchEntityTypes:**

```javascript
async semanticSearchEntityTypes(text) {
  // Query wordnet_entity_types collection
  const results = await this.semanticSearch.semanticSearch(
    'wordnet_entity_types',
    text,
    { limit: 20, threshold: 0.6 }
  );

  // Extract unique entity type labels, ranked by score
  const seen = new Set();
  const labels = [];

  for (const result of results) {
    const label = result.document.label;
    if (!seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  }

  return labels;
}
```

**semanticSearchRelationTypes:**

```javascript
async semanticSearchRelationTypes(text) {
  // Query all three collections in parallel
  const [roleResults, predicateResults, relationResults] = await Promise.all([
    this.semanticSearch.semanticSearch('wordnet_roles', text, {
      limit: 30,
      threshold: 0.5
    }),
    this.semanticSearch.semanticSearch('wordnet_predicates', text, {
      limit: 50,
      threshold: 0.5
    }),
    this.semanticSearch.semanticSearch('wordnet_relations', text, {
      limit: 30,
      threshold: 0.5
    })
  ]);

  return {
    roles: roleResults.map(r => r.document.label),
    unaryPredicates: predicateResults.map(r => r.document.label),
    binaryRelations: relationResults.map(r => r.document.label)
  };
}
```

## Integration with DRS

### Stage 1: Mention Extraction

```javascript
// DRS calls semantic inventory to get allowed entity types
const allowedTypes = await semanticInventory.semanticSearchEntityTypes(text);
// Returns: ["PERSON", "LOCATION", "ORGANIZATION", "THING", ...]

// LLM prompt includes these types as constraints
const prompt = new TemplatedPrompt('mention-extraction.hbs', {
  text: text,
  allowedTypes: allowedTypes
});
```

### Stage 3: Event & Relation Extraction

```javascript
// DRS calls semantic inventory to get relation types
const inventory = await semanticInventory.semanticSearchRelationTypes(text);
// Returns: {
//   roles: ["Agent", "Theme", "Recipient", ...],
//   unaryPredicates: ["give", "book", "heavy", ...],
//   binaryRelations: ["to", "from", ...]
// }

// LLM prompt uses these as allowed symbols
const prompt = new TemplatedPrompt('event-extraction.hbs', {
  text: text,
  roles: inventory.roles,
  unaryPredicates: inventory.unaryPredicates,
  binaryRelations: inventory.binaryRelations
});
```

## Data Files

### data/semantic-roles.json

**Predefined semantic role inventory (not derived from WordNet).**

```json
{
  "Agent": {
    "definition": "The volitional causer of an action or event",
    "examples": [
      "John kicked the ball (John = Agent)",
      "The company announced profits (company = Agent)"
    ],
    "verbnetClass": "agent",
    "roleType": "core"
  },
  "Theme": {
    "definition": "Entity undergoing change, movement, or being in a state",
    "examples": [
      "John kicked the ball (ball = Theme)",
      "Mary is in the room (Mary = Theme)"
    ],
    "verbnetClass": "theme",
    "roleType": "core"
  },
  "Patient": {
    "definition": "Entity that is affected by or undergoes the action",
    "examples": [
      "John broke the window (window = Patient)",
      "The storm damaged the house (house = Patient)"
    ],
    "verbnetClass": "patient",
    "roleType": "core"
  },
  "Recipient": {
    "definition": "Entity that receives something",
    "examples": [
      "John gave Mary the book (Mary = Recipient)",
      "She sent him a letter (him = Recipient)"
    ],
    "verbnetClass": "recipient",
    "roleType": "core"
  },
  "Experiencer": {
    "definition": "Entity that experiences a mental or emotional state",
    "examples": [
      "John fears spiders (John = Experiencer)",
      "Mary loves chocolate (Mary = Experiencer)"
    ],
    "verbnetClass": "experiencer",
    "roleType": "core"
  },
  "Stimulus": {
    "definition": "Cause of a mental or emotional state",
    "examples": [
      "John fears spiders (spiders = Stimulus)",
      "The news surprised her (news = Stimulus)"
    ],
    "verbnetClass": "stimulus",
    "roleType": "core"
  },
  "Instrument": {
    "definition": "Tool or means used to perform the action",
    "examples": [
      "John cut the bread with a knife (knife = Instrument)",
      "She opened the door with a key (key = Instrument)"
    ],
    "verbnetClass": "instrument",
    "roleType": "peripheral"
  },
  "Location": {
    "definition": "Where the event takes place",
    "examples": [
      "John works in Boston (Boston = Location)",
      "The meeting is in the conference room (conference room = Location)"
    ],
    "verbnetClass": "location",
    "roleType": "peripheral"
  },
  "Source": {
    "definition": "Starting point or origin",
    "examples": [
      "John traveled from Paris (Paris = Source)",
      "She took the book from the shelf (shelf = Source)"
    ],
    "verbnetClass": "source",
    "roleType": "peripheral"
  },
  "Goal": {
    "definition": "Endpoint or destination",
    "examples": [
      "John traveled to London (London = Goal)",
      "She put the book on the shelf (shelf = Goal)"
    ],
    "verbnetClass": "goal",
    "roleType": "peripheral"
  },
  "Time": {
    "definition": "Temporal specification of the event",
    "examples": [
      "John arrived at 3pm (3pm = Time)",
      "The meeting is on Monday (Monday = Time)"
    ],
    "verbnetClass": "time",
    "roleType": "peripheral"
  },
  "Manner": {
    "definition": "How the action is performed",
    "examples": [
      "John ran quickly (quickly = Manner)",
      "She spoke softly (softly = Manner)"
    ],
    "verbnetClass": "manner",
    "roleType": "peripheral"
  },
  "Purpose": {
    "definition": "Why the action is performed",
    "examples": [
      "John studied to pass the exam (to pass = Purpose)",
      "She works for money (for money = Purpose)"
    ],
    "verbnetClass": "purpose",
    "roleType": "peripheral"
  },
  "Cause": {
    "definition": "What caused the action or state",
    "examples": [
      "The heat melted the ice (heat = Cause)",
      "Fear made him run (fear = Cause)"
    ],
    "verbnetClass": "cause",
    "roleType": "peripheral"
  }
}
```

### data/entity-type-roots.json

**Root synsets for entity type categorization (used by categorization logic).**

```json
{
  "PERSON": {
    "description": "Humans, groups of people",
    "lexicalFiles": ["noun.person"],
    "rootSynsets": [
      "00007846_n",  // person.n.01
      "00001740_n",  // entity.n.01 > human.n.01
      "07942152_n"   // group.n.01 (when refers to people)
    ]
  },
  "LOCATION": {
    "description": "Places, geographic entities",
    "lexicalFiles": ["noun.location"],
    "rootSynsets": [
      "00027167_n",  // location.n.01
      "08493064_n",  // region.n.01
      "08516276_n"   // place.n.01
    ]
  },
  "ORGANIZATION": {
    "description": "Companies, institutions, groups",
    "lexicalFiles": ["noun.group"],
    "rootSynsets": [
      "08008335_n",  // organization.n.01
      "08053576_n",  // institution.n.01
      "08058098_n"   // company.n.01
    ]
  },
  "ARTIFACT": {
    "description": "Man-made objects",
    "lexicalFiles": ["noun.artifact"],
    "rootSynsets": [
      "00021939_n",  // artifact.n.01
      "03076708_n"   // creation.n.02
    ]
  },
  "EVENT": {
    "description": "Occurrences, happenings",
    "lexicalFiles": ["noun.event"],
    "rootSynsets": [
      "00029378_n",  // event.n.01
      "00030358_n",  // happening.n.01
      "00027167_n"   // occurrence.n.01
    ]
  },
  "TIME": {
    "description": "Temporal expressions",
    "lexicalFiles": ["noun.time"],
    "rootSynsets": [
      "00028270_n",  // time.n.01
      "05052889_n"   // temporal_property.n.01
    ]
  },
  "QUANTITY": {
    "description": "Measurements, amounts",
    "lexicalFiles": ["noun.quantity"],
    "rootSynsets": [
      "00033615_n",  // quantity.n.01
      "00033615_n",  // measure.n.02
      "00033615_n"   // amount.n.01
    ]
  },
  "ABSTRACT": {
    "description": "Ideas, concepts",
    "lexicalFiles": ["noun.cognition", "noun.communication"],
    "rootSynsets": [
      "00031563_n",  // abstraction.n.01
      "05803379_n"   // idea.n.01
    ]
  },
  "PHYSICAL_OBJECT": {
    "description": "Natural physical things",
    "lexicalFiles": ["noun.object", "noun.substance"],
    "rootSynsets": [
      "00019128_n",  // physical_object.n.01
      "00002684_n",  // object.n.01
      "00004258_n"   // thing.n.01
    ]
  }
}
```

## Package Structure

```
@legion/semantic-inventory/
├── src/
│   ├── SemanticInventoryService.js      # Query API
│   ├── SemanticInventoryIndexer.js      # Indexing logic
│   └── categorization/
│       ├── EntityTypeCategorizer.js     # Entity type logic
│       └── RelationCategorizer.js       # Relation type logic
├── data/
│   ├── semantic-roles.json              # Predefined roles
│   └── entity-type-roots.json           # Categorization roots
├── scripts/
│   └── index-semantic-inventory.js      # Indexing script
├── __tests__/
│   ├── integration/
│   │   ├── indexing.test.js             # Test indexing process
│   │   └── queries.test.js              # Test semantic search
│   └── unit/
│       ├── service.test.js              # Test SemanticInventoryService
│       └── categorization.test.js       # Test categorization logic
├── package.json
└── README.md
```

## Testing Strategy

### Integration Tests

**Test with real resources (no mocks):**

```javascript
describe('Semantic Inventory Integration', () => {
  let service;
  let resourceManager;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    service = new SemanticInventoryService(resourceManager);
    await service.initialize();
  });

  test('should find entity types for sentence', async () => {
    const types = await service.semanticSearchEntityTypes(
      'The professor walked to the university building'
    );

    expect(types).toContain('PERSON');
    expect(types).toContain('LOCATION');
    expect(types).toContain('ORGANIZATION');
  });

  test('should find relation types for sentence', async () => {
    const inventory = await service.semanticSearchRelationTypes(
      'John gave Mary a heavy book'
    );

    expect(inventory.roles).toContain('Agent');
    expect(inventory.roles).toContain('Recipient');
    expect(inventory.unaryPredicates).toContain('heavy');
    expect(inventory.unaryPredicates).toContain('book');
  });

  test('should handle complex sentence', async () => {
    const inventory = await service.semanticSearchRelationTypes(
      'The student read the book in the library before the exam'
    );

    expect(inventory.roles).toContain('Agent');
    expect(inventory.roles).toContain('Theme');
    expect(inventory.roles).toContain('Location');
    expect(inventory.binaryRelations).toContain('in');
    expect(inventory.binaryRelations).toContain('before');
  });
});
```

### Unit Tests

**Test categorization logic:**

```javascript
describe('EntityTypeCategorizer', () => {
  test('should categorize person synset', () => {
    const synset = {
      pos: 'n',
      lexicalFile: 'noun.person',
      definition: 'a teacher at a university'
    };

    const category = categorizer.categorizeEntityType(synset);
    expect(category).toBe('PERSON');
  });

  test('should categorize location synset', () => {
    const synset = {
      pos: 'n',
      lexicalFile: 'noun.location',
      definition: 'a building for meetings'
    };

    const category = categorizer.categorizeEntityType(synset);
    expect(category).toBe('LOCATION');
  });
});
```

## Dependencies

### Legion Packages

| Package | Purpose |
|---------|---------|
| `@legion/resource-manager` | Configuration and dependency injection |
| `@legion/semantic-search` | Qdrant vector search with embeddings |
| `@legion/wordnet` | MongoDB access to WordNet synsets |

### External Dependencies

| Package | Purpose |
|---------|---------|
| `mongodb` | MongoDB client for querying synsets |

## Glossary

| Term | Definition |
|------|------------|
| **Semantic Inventory** | Closed set of allowed symbols for semantic analysis |
| **Entity Type** | Coarse category for entities (PERSON, LOCATION, etc.) |
| **Semantic Role** | Participant relationship label (Agent, Theme, Recipient) |
| **Unary Predicate** | Property or type assertion about one entity |
| **Binary Relation** | Relationship between two entities or events |
| **Denormalized Collection** | Qdrant collection with complete data (no joins needed) |
| **Full Coverage** | Using all relevant WordNet synsets (no arbitrary limits) |
| **Categorization** | Assigning semantic tags to WordNet synsets |

---

**Document Version:** 1.0
**Last Updated:** 2025-10-18
**Status:** MVP Design Complete
