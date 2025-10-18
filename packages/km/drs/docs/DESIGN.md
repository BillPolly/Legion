# DRS (Discourse Representation Structure) Package - Design Document

## Overview

The DRS package transforms natural language text into precise, verifiable Discourse Representation Structures using a staged pipeline that combines frontier LLMs with hard constraints, schemas, and validators. The system integrates WordNet vector search to supply closed symbol inventories (entity types, predicates, roles) to the LLM at each stage, ensuring correctness through validation and repair loops.

**Goal:** Turn arbitrary natural language into a precise, verifiable DRS that captures:
- Entities and their properties
- Events and their participants (semantic roles)
- Quantification and scope (Every, Some, Not, If, Or)
- Cross-sentence phenomena (anaphora, coreference)
- Negation and conditionals

## Scope

**In Scope:**
- Single and multi-sentence texts (short documents)
- Cross-sentence anaphora and coreference resolution
- Quantification (universal, existential) with scope planning
- Negation and conditionals
- Deterministic clausal DRS output with well-formedness checks
- Staged LLM orchestration with JSON schema-constrained decoding
- Validator-driven repair loops (one attempt per stage)
- Semantic inventory discovery via WordNet vector search

**Out of Scope:**
- Deep world-knowledge reasoning
- Large-scale knowledge base integration
- Complex discourse phenomena (presupposition projection, RST)
- Multilingual support (English-first MVP)
- CNL (Controlled Natural Language) backstop (future enhancement)
- PMB (Parallel Meaning Bank) gold standard evaluation (future)

## Architecture

### System Overview

The system comprises **six processing stages** orchestrated by a **DRSOrchestrator**. Each LLM-facing stage uses **structured outputs** (JSON Schema), immediate **validation**, and optional **one-step repair** when invalid.

```
Text → [Stage 0] Discourse Memory Init
     → [Stage 1] Mention Extraction (NER + nominals)
     → [Stage 2] Coreference Resolution & Canonicalization
     → [Stage 3] Event & Relation Extraction (SRL + binary relations)
     → [Stage 4] Quantification & Scope Planning (minimal DSL)
     → [Stage 5] Deterministic DRS Builder → Clausal DRS JSON
     → [Stage 6] DRS Validation (well-formedness) → OK / Repair
```

### WordNet Semantic Inventory Service

All stages requiring **types/predicates/roles** call the **Semantic Inventory Service**, which:
- Queries a **vector index built from WordNet** (synsets, glosses, usage examples, lemma forms)
- Returns **closed sets** of allowed symbols ranked by semantic similarity to the input text
- Provides entity types, unary predicates, semantic roles, and binary relations
- Integrates with `@legion/semantic-search` (Qdrant) and `@legion/wordnet` (MongoDB triple store)

**Key APIs:**
- `semanticSearchEntityTypes(text: string) → string[]`
- `semanticSearchRelationTypes(text: string) → RelationInventory`

### Integration with Legion Framework

The DRS package leverages existing Legion infrastructure:

| Component | Legion Package | Purpose |
|-----------|---------------|---------|
| LLM Integration | `@legion/llm-client` | Structured outputs with TemplatedPrompt |
| Validation | `@legion/schema` | JSON schema validation (NO Zod) |
| Semantic Inventory | `@legion/semantic-inventory` | Production-ready WordNet semantic search (189K vectors) |
| WordNet Access | `@legion/wordnet` | Synset/relation data from MongoDB triple store |
| Semantic Search | `@legion/semantic-search` | Vector search with Qdrant + local embeddings |
| Configuration | `@legion/resource-manager` | Singleton config from .env |
| NLP Services | `@legion/nlp` | Entity/relationship extraction patterns |

**Design Principles:**
- **Fail Fast:** No fallbacks or mock implementations
- **Real Resources:** All tests use actual LLM, MongoDB, Qdrant
- **TDD:** Tests written first, must always pass
- **One Way:** No backward compatibility, single implementation path
- **Workspace Imports:** Always use `@legion/...` imports

## Data Model

### Core Types

#### Span
Character offsets in the original text (half-open intervals).

```javascript
{
  start: number,  // Inclusive
  end: number     // Exclusive
}
```

#### Mention
A textual reference to an entity (NER span or nominal).

```javascript
{
  id: string,           // "m1", "m2", ...
  span: Span,           // Character offsets
  text: string,         // Substring from original text
  head: string,         // Head word (e.g., "professor" in "the professor")
  coarseType: string,   // From semantic inventory: PERSON, LOCATION, etc.
  sentenceId: number    // Which sentence (0-indexed)
}
```

#### Entity
Abstract discourse referent with canonical representation.

```javascript
{
  id: string,           // "x1", "x2", ...
  canonical: string,    // Canonical name (e.g., "Alice")
  type: string,         // Entity type from inventory
  mentions: string[],   // Mention IDs that refer to this entity
  number: string,       // "SING" | "PLUR"
  gender: string,       // "MASC" | "FEM" | "NEUT" | "UNKNOWN"
  kbId: string          // Optional WordNet synset ID (e.g., "wn:person.n.01")
}
```

#### Event
An occurrence with semantic roles.

```javascript
{
  id: string,           // "e1", "e2", ...
  lemma: string,        // Base verb form (e.g., "read")
  tense: string,        // "PAST" | "PRESENT" | "FUTURE"
  aspect: string,       // "NONE" | "PROGRESSIVE" | "PERFECT"
  modal: string | null, // "can", "must", "should", etc.
  neg: boolean,         // Negation flag
  roles: object         // { "Agent": "x1", "Theme": "x2" }
}
```

#### UnaryFact
Property or type assertion about an entity.

```javascript
{
  pred: string,         // Predicate from inventory (e.g., "book", "heavy")
  args: string[]        // [entityId] (arity 1)
}
```

#### BinaryFact
Relation between two referents.

```javascript
{
  pred: string,         // Relation from inventory (e.g., "in", "before")
  args: string[]        // [ref1, ref2] (arity 2)
}
```

#### DiscourseMemory
Shared state passed through all stages.

```javascript
{
  text: string,               // Original input text
  sentences: string[],        // Sentence-split text
  mentions: Mention[],        // All extracted mentions
  entities: Entity[],         // Canonical entities (after coref)
  events: Event[],            // All events
  unaryFacts: UnaryFact[],    // Property assertions
  binaryFacts: BinaryFact[]   // Binary relations
}
```

#### ScopePlan
Quantifier scope structure (DSL).

```javascript
{
  boxes: string[],            // ["S0", "S1", ...]
  ops: ScopeOp[],             // Scope operators
  assign: {
    events: object,           // { "e1": "S1" }
    entities: object          // { "x1": "S1", "x2": "S1" }
  }
}

// ScopeOp types:
{ kind: "Every", var: "x1", over: "S1" }
{ kind: "Some", var: "x2", in: "S1" }
{ kind: "Not", box: "S1" }
{ kind: "If", cond: "S1", then: "S2" }
{ kind: "Or", left: "S1", right: "S2" }
```

#### ClausalDRS
Final output: flat list of conditions.

```javascript
{
  referents: string[],        // ["x1", "x2", "e1"]
  conditions: Condition[]     // Predicates and relations
}

// Condition types:
{ pred: "student", args: ["x1"] }           // Unary predicate
{ pred: "read", args: ["e1"] }              // Event predicate
{ rel: "Agent", args: ["e1", "x1"] }        // Semantic role
{ rel: "Every", args: ["x1"] }              // Quantifier
{ rel: "Some", args: ["x2"] }               // Quantifier
{ rel: "Not", args: ["S1"] }                // Negation
```

### RelationInventory
Closed set of allowed symbols from semantic search.

```javascript
{
  unaryPredicates: string[],  // ["person", "book", "heavy", "student"]
  roles: string[],            // ["Agent", "Theme", "Recipient", "Location", ...]
  binaryRelations: string[]   // ["in", "on", "before", "after", "part_of", ...]
}
```

## Processing Stages

### Stage 0: Discourse Memory Initialization

**Input:** Raw text string

**Process:**
1. Sentence splitting (using NLP library or simple regex)
2. Initialize empty DiscourseMemory with sentences
3. Create empty arrays for mentions, entities, events, facts

**Output:** DiscourseMemory skeleton

**Validation:** None (deterministic)

**Implementation:** Pure JavaScript, no LLM

---

### Stage 1: Mention Extraction

**Input:** DiscourseMemory (text + sentences)

**LLM Prompt:**
- **System:** "You are a mention extractor. Output ONLY JSON matching the schema."
- **Instruction:** "Extract entity mentions with character spans (start, end), head word, and coarse type from the allowed set. Do not hallucinate tokens or reorder text."
- **Context:** Original text, sentence indices, allowed entity types from `semanticSearchEntityTypes(text)`
- **Output Schema:** `Mention[]` (JSON Schema enforced)

**Semantic Inventory:**
```javascript
const allowedTypes = await semanticInventory.semanticSearchEntityTypes(text);
// Returns: ["PERSON", "LOCATION", "ORGANIZATION", "THING", ...]
```

**Validation (MentionValidator):**
- Spans must match actual substrings in original text
- `end > start` and within text bounds
- `coarseType ∈ allowedTypes`
- No overlapping spans for same entity (relaxed: same span can have multiple types)
- `sentenceId` must be valid

**Repair:** If invalid, return validator errors and ask LLM for minimal fixes (one attempt)

**Output:** DiscourseMemory with `mentions` populated

---

### Stage 2: Coreference Resolution & Canonicalization

**Input:** DiscourseMemory (with mentions)

**LLM Prompt:**
- **System:** "You are a coreference resolver."
- **Instruction:** "Cluster the given mentions into entities. Each entity must list its mention IDs and a canonical string. Do not invent mention IDs. Use only the provided mention table."
- **Context:** Mention table (all mentions from Stage 1), allowed entity types
- **Output Schema:** `Entity[]` (JSON Schema)

**Validation (EntityValidator):**
- All `mentions` arrays must be disjoint (no mention belongs to multiple entities)
- All mention IDs must exist in DiscourseMemory
- `type` must be from allowed types
- Optional: gender/number heuristics (e.g., "he" → MASC, "they" → PLUR)

**Post-Processing:**
- Generate unique entity IDs (`x1`, `x2`, ...)
- Internally treat pronouns as references to Entity.id (pronoun-free representation)

**Repair:** If invalid, show validator errors and request fixes (one attempt)

**Output:** DiscourseMemory with `entities` populated

---

### Stage 3: Event & Relation Extraction

**Input:** DiscourseMemory (with entities)

**LLM Prompt:**
- **System:** "You are an event and relation extractor using semantic role labeling."
- **Instruction:** "For each sentence, enumerate events with lemma, tense, aspect, modal, negation, and semantic roles. Emit unary facts (adjectives/nouns as predicates over entities) and binary relations (PPs, adverbials). Use only the provided role and predicate inventories."
- **Context:** Text, entity table, relation inventory from `semanticSearchRelationTypes(text)`
- **Output Schema:** `{ events: Event[], unaryFacts: UnaryFact[], binaryFacts: BinaryFact[] }`

**Semantic Inventory:**
```javascript
const inventory = await semanticInventory.semanticSearchRelationTypes(text);
// Returns: {
//   unaryPredicates: [...],
//   roles: ["Agent", "Theme", "Recipient", "Location", ...],
//   binaryRelations: ["in", "on", "before", ...]
// }
```

**Validation (EventValidator):**
- Role names must be from `inventory.roles`
- Role targets must be known entity IDs (from DiscourseMemory.entities)
- No duplicate event IDs
- Unary predicates must be from `inventory.unaryPredicates`
- Binary relations must be from `inventory.binaryRelations`
- Arity checks: unary = 1 arg, binary = 2 args
- All args must be valid referents (entity IDs or event IDs)

**Repair:** Validator errors → one repair attempt

**Output:** DiscourseMemory with `events`, `unaryFacts`, `binaryFacts` populated

---

### Stage 4: Quantification & Scope Planning

**Input:** DiscourseMemory (with entities and events)

**LLM Prompt:**
- **System:** "You are a quantifier scope planner."
- **Instruction:** "Provide a scope plan over boxes with operators: Some(var in box), Every(var over box), Not(box), If(cond, then), Or(left, right). Assign each entity and event to its introduction/host box. Respect indefinites → Some, universals → Every, negation/conditionals from text cues."
- **Context:** Entities, events, text with quantifier cues
- **Output Schema:** `ScopePlan`

**Validation (ScopeValidator):**
- All referenced `boxes` exist in `ScopePlan.boxes`
- All `var` references must be known entity or event IDs
- Simple structural well-formedness:
  - Every/Some ops reference valid variables
  - If ops reference valid condition/then boxes
  - Or ops reference valid left/right boxes
- All entities and events must be assigned to exactly one box

**Repair:** Minimal structural fixes (one attempt)

**Output:** ScopePlan object

---

### Stage 5: Deterministic DRS Builder

**Input:** DiscourseMemory + ScopePlan

**Process (NO LLM - pure deterministic translation):**

1. **Collect Referents:**
   - All entity IDs from `DiscourseMemory.entities`
   - All event IDs from `DiscourseMemory.events`
   - All quantified variables from `ScopePlan.ops`

2. **Add Type Predicates:**
   - For each entity: `{ pred: entity.type, args: [entity.id] }`

3. **Add Attribute Predicates:**
   - For each unaryFact: `{ pred: fact.pred, args: fact.args }`

4. **Add Event Predicates:**
   - For each event: `{ pred: event.lemma, args: [event.id] }`

5. **Add Role Relations:**
   - For each event role: `{ rel: roleName, args: [event.id, target] }`

6. **Add Binary Relations:**
   - For each binaryFact: `{ rel: fact.pred, args: fact.args }`

7. **Translate Scope Operators:**
   - `Some(x2 in S1)` → `{ rel: "Some", args: ["x2"] }`
   - `Every(x1 over S1)` → `{ rel: "Every", args: ["x1"] }`
   - `Not(S1)` → `{ rel: "Not", args: ["S1"] }`
   - `If(S1, S2)` → `{ rel: "Imp", args: ["S1", "S2"] }`
   - `Or(S1, S2)` → `{ rel: "Or", args: ["S1", "S2"] }`

**Output:** ClausalDRS (referents + conditions)

---

### Stage 6: DRS Validation

**Input:** ClausalDRS

**Validation Checks (DRSValidator):**
- **Unique Referents:** All referents in `ClausalDRS.referents` are unique
- **Bound Arguments:** All arguments in conditions are bound referents (except box IDs in meta-relations like Not, Imp, Or)
- **Allowed Formats:** All predicates/relations match expected formats
- **Role Arity:** All semantic roles have arity 2 (event + participant)
- **Scope Sanity:** Basic box structure checks (no orphaned boxes)

**Repair (Optional):**
- Minimal edits (e.g., move `Some(y)` into proper box)
- One constrained LLM pass or deterministic fixups
- If still invalid, surface errors (fail fast)

**Output:** Validated ClausalDRS or ValidationError

## Prompt Templates

Prompts use Handlebars (`.hbs`) templates with `@legion/llm-client`'s `TemplatedPrompt`.

### mention-extraction.hbs
```handlebars
You are a mention extractor. Output ONLY JSON that matches the provided schema.

Task: From the text, extract entity mentions with character offsets, head word, coarse type.

Allowed types: {{json allowedTypes}}

Text:
<<<{{text}}>>>

Output a JSON array of mentions, each with:
- id: unique identifier (e.g., "m1", "m2")
- span: {start: number, end: number} (character offsets)
- text: exact substring from input text
- head: head word
- coarseType: one of the allowed types
- sentenceId: sentence index (0-based)

JSON Schema:
{{json schema}}
```

### coreference.hbs
```handlebars
Cluster these mentions into entities. Each entity must list its mention IDs and a canonical string.

Do not invent mention IDs. Use only the provided mention table.

Allowed types: {{json allowedTypes}}

Mentions:
{{json mentions}}

Output a JSON array of entities, each with:
- id: will be assigned later (use placeholder)
- canonical: canonical string for the entity
- type: entity type (from allowed types)
- mentions: array of mention IDs
- number: "SING" | "PLUR"
- gender: "MASC" | "FEM" | "NEUT" | "UNKNOWN"

JSON Schema:
{{json schema}}
```

### event-extraction.hbs
```handlebars
Extract events with roles, plus unary and binary facts.

Roles ∈ {{json roles}}
Unary predicates ∈ {{json unaryPredicates}}
Binary relations ∈ {{json binaryRelations}}

Use only these entity IDs: {{json entityIds}}

Text:
<<<{{text}}>>>

Entities:
{{json entities}}

Output JSON with three arrays:
- events: array of events with lemma, tense, aspect, modal, neg, roles
- unaryFacts: array of {pred, args: [entityId]}
- binaryFacts: array of {pred, args: [ref1, ref2]}

JSON Schema:
{{json schema}}
```

### scope-planning.hbs
```handlebars
Produce a scope plan using the operators Some, Every, Not, If, Or.

Assign each entity/event to a box where it is introduced/hosted.

Boxes seed: {{json seedBoxes}}

Entities:
{{json entities}}

Events:
{{json events}}

Output JSON with:
- boxes: array of box IDs (e.g., ["S0", "S1"])
- ops: array of scope operators
  - {kind: "Some", var: "x2", in: "S1"}
  - {kind: "Every", var: "x1", over: "S1"}
  - {kind: "Not", box: "S1"}
  - {kind: "If", cond: "S1", then: "S2"}
  - {kind: "Or", left: "S1", right: "S2"}
- assign: {events: {e1: "S1"}, entities: {x1: "S1", x2: "S1"}}

JSON Schema:
{{json schema}}
```

## JSON Schemas

All schemas use `@legion/schema` package (NO Zod per CLAUDE.md).

### MentionSchema.json
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "array",
  "items": {
    "type": "object",
    "required": ["id", "span", "text", "head", "coarseType", "sentenceId"],
    "properties": {
      "id": {"type": "string", "pattern": "^m\\d+$"},
      "span": {
        "type": "object",
        "required": ["start", "end"],
        "properties": {
          "start": {"type": "integer", "minimum": 0},
          "end": {"type": "integer", "minimum": 0}
        }
      },
      "text": {"type": "string", "minLength": 1},
      "head": {"type": "string", "minLength": 1},
      "coarseType": {"type": "string"},
      "sentenceId": {"type": "integer", "minimum": 0}
    }
  }
}
```

### CorefSchema.json
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "array",
  "items": {
    "type": "object",
    "required": ["canonical", "type", "mentions", "number", "gender"],
    "properties": {
      "canonical": {"type": "string", "minLength": 1},
      "type": {"type": "string"},
      "mentions": {
        "type": "array",
        "items": {"type": "string", "pattern": "^m\\d+$"},
        "minItems": 1
      },
      "number": {"type": "string", "enum": ["SING", "PLUR"]},
      "gender": {"type": "string", "enum": ["MASC", "FEM", "NEUT", "UNKNOWN"]},
      "kbId": {"type": "string"}
    }
  }
}
```

### EventsSchema.json
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["events", "unaryFacts", "binaryFacts"],
  "properties": {
    "events": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "lemma", "tense", "aspect", "neg", "roles"],
        "properties": {
          "id": {"type": "string", "pattern": "^e\\d+$"},
          "lemma": {"type": "string"},
          "tense": {"type": "string", "enum": ["PAST", "PRESENT", "FUTURE"]},
          "aspect": {"type": "string", "enum": ["NONE", "PROGRESSIVE", "PERFECT"]},
          "modal": {"type": ["string", "null"]},
          "neg": {"type": "boolean"},
          "roles": {"type": "object"}
        }
      }
    },
    "unaryFacts": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["pred", "args"],
        "properties": {
          "pred": {"type": "string"},
          "args": {
            "type": "array",
            "items": {"type": "string"},
            "minItems": 1,
            "maxItems": 1
          }
        }
      }
    },
    "binaryFacts": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["pred", "args"],
        "properties": {
          "pred": {"type": "string"},
          "args": {
            "type": "array",
            "items": {"type": "string"},
            "minItems": 2,
            "maxItems": 2
          }
        }
      }
    }
  }
}
```

### ScopeSchema.json
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["boxes", "ops", "assign"],
  "properties": {
    "boxes": {
      "type": "array",
      "items": {"type": "string", "pattern": "^S\\d+$"}
    },
    "ops": {
      "type": "array",
      "items": {
        "oneOf": [
          {
            "type": "object",
            "required": ["kind", "var", "in"],
            "properties": {
              "kind": {"const": "Some"},
              "var": {"type": "string"},
              "in": {"type": "string"}
            }
          },
          {
            "type": "object",
            "required": ["kind", "var", "over"],
            "properties": {
              "kind": {"const": "Every"},
              "var": {"type": "string"},
              "over": {"type": "string"}
            }
          },
          {
            "type": "object",
            "required": ["kind", "box"],
            "properties": {
              "kind": {"const": "Not"},
              "box": {"type": "string"}
            }
          },
          {
            "type": "object",
            "required": ["kind", "cond", "then"],
            "properties": {
              "kind": {"const": "If"},
              "cond": {"type": "string"},
              "then": {"type": "string"}
            }
          },
          {
            "type": "object",
            "required": ["kind", "left", "right"],
            "properties": {
              "kind": {"const": "Or"},
              "left": {"type": "string"},
              "right": {"type": "string"}
            }
          }
        ]
      }
    },
    "assign": {
      "type": "object",
      "required": ["events", "entities"],
      "properties": {
        "events": {"type": "object"},
        "entities": {"type": "object"}
      }
    }
  }
}
```

### ClausalDRSSchema.json
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["referents", "conditions"],
  "properties": {
    "referents": {
      "type": "array",
      "items": {"type": "string"}
    },
    "conditions": {
      "type": "array",
      "items": {
        "oneOf": [
          {
            "type": "object",
            "required": ["pred", "args"],
            "properties": {
              "pred": {"type": "string"},
              "args": {
                "type": "array",
                "items": {"type": "string"}
              }
            }
          },
          {
            "type": "object",
            "required": ["rel", "args"],
            "properties": {
              "rel": {"type": "string"},
              "args": {
                "type": "array",
                "items": {"type": "string"}
              }
            }
          }
        ]
      }
    }
  }
}
```

## Semantic Inventory Service

### Implementation

**Purpose:** Query WordNet via vector search to provide closed symbol inventories.

**Package:** `@legion/semantic-inventory` (production-ready, fully indexed)

**Status:**
- ✅ 189,280 WordNet vectors indexed to Qdrant
- ✅ All collections production-ready with full data
- ✅ 62/62 tests passing
- ✅ Average query time: ~3ms

**Architecture:**
```javascript
import { SemanticInventoryService } from '@legion/semantic-inventory';

// The service is initialized via ResourceManager
const resourceManager = await ResourceManager.getInstance();
const semanticInventory = new SemanticInventoryService(resourceManager);
await semanticInventory.initialize();

// Query for entity types
const entityTypes = await semanticInventory.semanticSearchEntityTypes(text, {
  limit: 20    // Default: 10
});
// Returns: ["PERSON", "LOCATION", "ORGANIZATION", "THING", ...]

// Query for relation types (roles, predicates, relations)
const inventory = await semanticInventory.semanticSearchRelationTypes(text, {
  rolesLimit: 10,        // Default: 10
  predicatesLimit: 10,   // Default: 10
  relationsLimit: 10     // Default: 10
});
// Returns: {
//   roles: ["Agent", "Theme", "Recipient", ...],
//   unaryPredicates: ["student", "book", "heavy", ...],
//   binaryRelations: ["in", "on", "before", ...]
// }
```

### WordNet Embedding Strategy

**Approach:** Pre-compute embeddings for curated WordNet synsets and store in Qdrant.

**Production Collections (Fully Indexed):**
1. **wordnet_entity_types:** 82,192 noun synsets categorized into entity types (PERSON, LOCATION, ORGANIZATION, etc.)
2. **wordnet_roles:** 14 semantic roles from VerbNet (Agent, Theme, Patient, Recipient, Experiencer, Instrument, Location, Source, Goal, Time, Manner, Purpose, Cause, Stimulus)
3. **wordnet_predicates:** 103,449 synsets (adjectives, nouns, verbs as properties)
4. **wordnet_relations:** 3,625 adverb synsets as binary relations (spatially, temporally, causally, etc.)

**Indexing Process (Completed by `@legion/semantic-inventory`):**
1. Query `@legion/wordnet` MongoDB triple store for relevant synsets
2. Extract: synset ID, lemmas, gloss, examples, lexicalFile
3. Concatenate as searchable text: `"lemma1, lemma2: gloss. Example sentence."`
4. Generate embeddings using Nomic local embeddings (768D, nomic-embed-text-v1.5)
5. Insert into Qdrant with metadata (label, synset ID, POS, category)
6. Batch processing (100 vectors per batch) for efficient indexing

## Constrained Decoding & Repair

### Structured Outputs

**LLM Integration via `@legion/llm-client`:**

```javascript
const prompt = new TemplatedPrompt('mention-extraction.hbs', {
  text: discourseMemory.text,
  allowedTypes: allowedTypes,
  schema: mentionSchema
});

const result = await llmClient.generateStructured({
  prompt: prompt,
  schema: mentionSchema,
  temperature: 0.3,
  maxTokens: 2000
});

// result is already parsed JSON matching schema
```

**JSON Schema Enforcement:**
- Uses LLM provider's native structured output mode (e.g., OpenAI JSON mode, Anthropic tool calling)
- Schema validation happens in LLM provider before tokens are returned
- Additional validation with `@legion/schema` after receiving response

### Repair Loop

**Policy:** Each stage gets **at most one** repair attempt.

**Process:**
1. Stage executes LLM call with structured output
2. Validator checks result
3. If invalid:
   - Collect all validation errors
   - Send repair prompt with errors + original result
   - LLM produces fixed version
   - Validator checks again
4. If still invalid:
   - Surface errors (fail fast)
   - Throw ValidationError

**Example Repair Prompt:**
```handlebars
Your previous output had validation errors:

{{#each errors}}
- {{this.message}} (path: {{this.path}})
{{/each}}

Original output:
{{json originalOutput}}

Fix these errors and return valid JSON matching the schema.
Do not change anything else.

Schema:
{{json schema}}
```

## Error Handling

### Validation Errors

**Custom Error Class:**
```javascript
class ValidationError extends Error {
  constructor(stage, errors) {
    super(`Validation failed in ${stage}`);
    this.name = 'ValidationError';
    this.stage = stage;
    this.errors = errors;
  }
}
```

**Error Information:**
- Stage name (e.g., "Stage1_MentionExtraction")
- Detailed error list with paths and messages
- Original invalid output (for debugging)

### Fail Fast Philosophy

**NO fallbacks or degraded modes:**
- If LLM is unavailable → throw error
- If validation fails after repair → throw error
- If semantic search is empty → throw error
- If WordNet is missing → throw error

**Rationale:** Better to fail loudly than produce incorrect DRS structures.

## Example End-to-End

**Input Text:**
```
Every student read a book. It was heavy.
```

### Stage 0: Discourse Memory Init

**Output:**
```javascript
{
  text: "Every student read a book. It was heavy.",
  sentences: [
    "Every student read a book.",
    "It was heavy."
  ],
  mentions: [],
  entities: [],
  events: [],
  unaryFacts: [],
  binaryFacts: []
}
```

### Stage 1: Mention Extraction

**Semantic Inventory Call:**
```javascript
const allowedTypes = await semanticInventory.semanticSearchEntityTypes(text);
// Returns: ["PERSON", "THING", "ARTIFACT", "ENTITY", ...]
```

**LLM Output:**
```javascript
mentions: [
  { id: "m1", span: {start: 6, end: 13}, text: "student", head: "student",
    coarseType: "PERSON", sentenceId: 0 },
  { id: "m2", span: {start: 21, end: 26}, text: "a book", head: "book",
    coarseType: "ARTIFACT", sentenceId: 0 },
  { id: "m3", span: {start: 28, end: 30}, text: "It", head: "It",
    coarseType: "ARTIFACT", sentenceId: 1 }
]
```

### Stage 2: Coreference Resolution

**LLM Output:**
```javascript
entities: [
  { canonical: "student", type: "PERSON", mentions: ["m1"],
    number: "SING", gender: "UNKNOWN" },
  { canonical: "book", type: "ARTIFACT", mentions: ["m2", "m3"],
    number: "SING", gender: "NEUT" }
]
```

**Post-processing (assign IDs):**
```javascript
entities: [
  { id: "x1", canonical: "student", type: "PERSON", mentions: ["m1"],
    number: "SING", gender: "UNKNOWN" },
  { id: "x2", canonical: "book", type: "ARTIFACT", mentions: ["m2", "m3"],
    number: "SING", gender: "NEUT" }
]
```

### Stage 3: Event & Relation Extraction

**Semantic Inventory Call:**
```javascript
const inventory = await semanticInventory.semanticSearchRelationTypes(text);
// Returns: {
//   roles: ["Agent", "Theme", "Patient", ...],
//   unaryPredicates: ["student", "book", "heavy", "read", ...],
//   binaryRelations: ["in", "on", "of", ...]
// }
```

**LLM Output:**
```javascript
{
  events: [
    { id: "e1", lemma: "read", tense: "PAST", aspect: "NONE",
      modal: null, neg: false,
      roles: { Agent: "x1", Theme: "x2" } }
  ],
  unaryFacts: [
    { pred: "student", args: ["x1"] },
    { pred: "book", args: ["x2"] },
    { pred: "heavy", args: ["x2"] }
  ],
  binaryFacts: []
}
```

### Stage 4: Quantification & Scope Planning

**LLM Output:**
```javascript
{
  boxes: ["S0", "S1"],
  ops: [
    { kind: "Every", var: "x1", over: "S1" },
    { kind: "Some", var: "x2", in: "S1" }
  ],
  assign: {
    entities: { x1: "S1", x2: "S1" },
    events: { e1: "S1" }
  }
}
```

### Stage 5: Deterministic DRS Builder

**Output:**
```javascript
{
  referents: ["x1", "x2", "e1"],
  conditions: [
    { pred: "student", args: ["x1"] },
    { pred: "book", args: ["x2"] },
    { pred: "heavy", args: ["x2"] },
    { pred: "read", args: ["e1"] },
    { rel: "Agent", args: ["e1", "x1"] },
    { rel: "Theme", args: ["e1", "x2"] },
    { rel: "Every", args: ["x1"] },
    { rel: "Some", args: ["x2"] }
  ]
}
```

### Stage 6: DRS Validation

**Validation Checks:** ✅ All pass

**Final Output:** ClausalDRS (same as Stage 5 output)

## Testing Strategy

### Unit Tests

**Each stage tested independently:**
- Mock LLM responses for predictable testing
- Real validators (no mocking)
- Test valid inputs → expected outputs
- Test invalid inputs → ValidationError

**Example:**
```javascript
describe('Stage1_MentionExtraction', () => {
  test('should extract mentions with valid spans', async () => {
    const stage1 = new Stage1_MentionExtraction(mockLLM, mockInventory);
    const memory = createTestMemory("The cat sat.");

    const result = await stage1.process(memory);

    expect(result.mentions).toHaveLength(1);
    expect(result.mentions[0].text).toBe("The cat");
    expect(result.mentions[0].span).toEqual({start: 0, end: 7});
  });

  test('should fail on invalid spans', async () => {
    // Mock LLM returns invalid spans
    await expect(stage1.process(memory)).rejects.toThrow(ValidationError);
  });
});
```

### Integration Tests

**End-to-End Pipeline:**
- Use **real LLM** (via `@legion/llm-client`)
- Use **real WordNet** (via `@legion/wordnet`)
- Use **real semantic search** (via `@legion/semantic-search`)
- **NO MOCKS** (per CLAUDE.md)

**Test Cases:**
1. Simple sentence: "Alice reads."
2. Quantifiers: "Every student read a book."
3. Coreference: "John met Mary. She smiled."
4. Negation: "Alice did not read the book."
5. Conditional: "If it rains, Alice stays home."

**Example:**
```javascript
describe('DRS Pipeline Integration', () => {
  let orchestrator;
  let resourceManager;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    orchestrator = new DRSOrchestrator(resourceManager);
    await orchestrator.initialize();
  });

  test('should process quantified sentence', async () => {
    const text = "Every student read a book.";

    const result = await orchestrator.run(text);

    expect(result.drs.referents).toContain('x1'); // student
    expect(result.drs.referents).toContain('x2'); // book
    expect(result.drs.referents).toContain('e1'); // read

    const everyRel = result.drs.conditions.find(c => c.rel === 'Every');
    expect(everyRel).toBeDefined();
    expect(everyRel.args).toContain('x1');

    const someRel = result.drs.conditions.find(c => c.rel === 'Some');
    expect(someRel).toBeDefined();
    expect(someRel.args).toContain('x2');
  });
});
```

### Test Data

**Handcrafted Examples:**
- Start with ~20 carefully crafted examples covering core phenomena
- Include expected DRS outputs for regression testing
- Add edge cases (empty text, single word, complex nesting)

**Future:** PMB (Parallel Meaning Bank) gold standard integration for benchmarking

## Performance Considerations

### Latency Targets

**Per-Stage Estimates (with frontier LLM):**
- Stage 0: < 10ms (deterministic)
- Stage 1: ~500ms (LLM call)
- Stage 2: ~500ms (LLM call)
- Stage 3: ~500ms (LLM call)
- Stage 4: ~500ms (LLM call)
- Stage 5: < 50ms (deterministic)
- Stage 6: < 10ms (validation)

**Total:** ~2-3 seconds for typical 2-sentence input

### Optimization Strategies

**Batching (Future):**
- Process Stage 1 per-sentence in parallel
- Merge mention lists before Stage 2

**Caching:**
- Cache semantic inventory results by text hash
- Cache LLM stage outputs for idempotent re-runs (useful for testing)

**Streaming:**
- Not applicable (structured outputs don't support streaming)

## API Reference

### DRSOrchestrator

**Main entry point for the DRS pipeline.**

```javascript
class DRSOrchestrator {
  constructor(resourceManager)

  async initialize()

  async run(text: string): Promise<DRSResult>
}

// DRSResult
{
  success: boolean,
  text: string,
  memory: DiscourseMemory,
  scopePlan: ScopePlan,
  drs: ClausalDRS,
  metadata: {
    stages: StageResult[],
    totalTime: number,
    timestamp: string
  }
}
```

### SemanticInventoryService

**Provides closed symbol inventories via WordNet vector search.**

```javascript
class SemanticInventoryService {
  constructor(resourceManager)

  async initialize()

  async semanticSearchEntityTypes(text: string): Promise<string[]>

  async semanticSearchRelationTypes(text: string): Promise<RelationInventory>
}
```

### Validators

**Schema-based validation for each stage output.**

```javascript
class MentionValidator {
  static validate(mentions: Mention[], text: string, allowedTypes: string[]): ValidationResult
}

class EntityValidator {
  static validate(entities: Entity[], mentions: Mention[], allowedTypes: string[]): ValidationResult
}

class EventValidator {
  static validate(result: EventExtractionResult, memory: DiscourseMemory, inventory: RelationInventory): ValidationResult
}

class ScopeValidator {
  static validate(scopePlan: ScopePlan, memory: DiscourseMemory): ValidationResult
}

class DRSValidator {
  static validate(drs: ClausalDRS): ValidationResult
}

// ValidationResult
{
  valid: boolean,
  errors: ValidationError[]
}
```

## Evaluation Utilities

### DRS-to-Text Converter

**Purpose:** Convert ClausalDRS back to natural language for semantic evaluation.

**Approach:** Deterministic template-based rendering (no LLM).

**Output:** Literal but accurate paraphrase (e.g., "Every student read a book").

```javascript
class DRSToText {
  generateParaphrase(drs: ClausalDRS): string
}
```

**Algorithm:**
1. Walk the DRS structure (referents + conditions)
2. Apply templates for each pattern:
   - Quantifiers: `Every(x1) + student(x1)` → "Every student"
   - Events: `read(e1) + Agent(e1,x1) + Theme(e1,x2)` → "[x1] read [x2]"
   - Negation: `Not(S1)` → "It is not the case that [S1]"
   - Conditionals: `Imp(S1,S2)` → "If [S1] then [S2]"
3. Handle verb conjugation and determiners with simple rules
4. Return literal paraphrase

**Advantages:**
- Fast (no API calls)
- Deterministic and reproducible
- No LLM costs
- Easy to test and debug

**Future Enhancement:** Add LLM-based "fluent mode" for more natural paraphrases.

### Semantic Equivalence Evaluator

**Purpose:** Judge if DRS paraphrase captures the same meaning as original text.

**Approach:** LLM-based semantic comparison.

```javascript
class SemanticEquivalenceEvaluator {
  constructor(llmClient)
  async evaluate(originalText: string, paraphrase: string): Promise<EvaluationResult>
}

// EvaluationResult
{
  equivalent: boolean,      // True if semantically equivalent
  confidence: number,       // 0.0-1.0 confidence score
  explanation: string       // LLM's reasoning
}
```

**Use Case:** End-to-end validation of DRS pipeline accuracy.

**Workflow:**
1. Text → DRS (Stages 0-6)
2. DRS → Paraphrase (DRSToText)
3. Compare original vs paraphrase (SemanticEquivalenceEvaluator)
4. High equivalence score = DRS correctly captured meaning

## Dependencies

### Legion Packages

| Package | Purpose |
|---------|---------|
| `@legion/llm-client` | LLM integration with TemplatedPrompt |
| `@legion/schema` | JSON schema validation |
| `@legion/semantic-inventory` | Production WordNet semantic search (189K vectors) |
| `@legion/wordnet` | WordNet triple store access |
| `@legion/semantic-search` | Vector search with Qdrant |
| `@legion/resource-manager` | Configuration and dependency injection |
| `@legion/nlp` | Text preprocessing utilities |

### External Dependencies

| Package | Purpose |
|---------|---------|
| `natural` | NLP utilities (sentence splitting, tokenization) |
| `handlebars` | Template engine for prompts |

## Glossary

| Term | Definition |
|------|------------|
| **DRS** | Discourse Representation Structure - box/condition formalism capturing scope and discourse referents |
| **Clausal DRS** | Flat representation of DRS as a list of conditions (predicates and relations) |
| **Mention** | Textual reference to an entity (NER span or nominal phrase) |
| **Entity** | Abstract discourse referent with canonical representation |
| **Event** | Occurrence with semantic roles (Agent, Theme, etc.) |
| **Coreference** | Multiple mentions referring to the same entity |
| **Quantifier Scope** | Structural relationships between quantifiers (Every, Some, Not, etc.) |
| **SRL** | Semantic Role Labeling - identifying predicate-argument structure |
| **WordNet** | Lexical database of English, used as semantic inventory via vector search |
| **Semantic Inventory** | Closed set of allowed symbols (entity types, predicates, roles) |
| **Constrained Decoding** | LLM generation restricted to valid JSON schema |

---

**Document Version:** 1.1
**Last Updated:** 2025-10-18
**Status:** MVP Design Complete | Semantic Inventory: Production Ready (189K vectors indexed)
