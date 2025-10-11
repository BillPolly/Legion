# Design Document: Natural Language Question Understanding & Query Generation

**Package**: `@legion/km/query-understanding`
**Version**: 1.0.0-MVP
**Status**: Design
**Last Updated**: 2025-01-11

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Goals & Constraints](#goals--constraints)
3. [Architecture Overview](#architecture-overview)
4. [Data Contracts](#data-contracts)
5. [Phase 1: Rewrite & Resolve](#phase-1-rewrite--resolve)
6. [Phase 2: NP/VP AST](#phase-2-npvp-ast)
7. [Phase 3: Semantic Mapping & Constraints](#phase-3-semantic-mapping--constraints)
8. [Phase 4: Query Generation](#phase-4-query-generation)
9. [Integration Points](#integration-points)
10. [Testing Strategy](#testing-strategy)
11. [Examples](#examples)

---

## Executive Summary

This system transforms **natural language questions** into **executable queries** against multiple backend systems (SPARQL, Cypher, MongoDB, Datalog). The pipeline consists of four deterministic phases:

1. **Phase 1 (LLM)**: Normalize questions by resolving references, canonicalizing entities, dates, and units
2. **Phase 2 (Deterministic)**: Parse into a pure NP/VP tree structure
3. **Phase 3 (Deterministic + Semantic Search)**: Map linguistic tokens to ontology concepts using vector embeddings
4. **Phase 4 (DataSource Integration)**: Convert to generic DataScript queries, pass to DataSource adapters for backend translation

**Key Innovations**:
- Separates language understanding (Phases 1-3) from data access (Phase 4)
- LLMs are used **only** in Phase 1. Phases 2-4 are deterministic, testable, and auditable
- Phase 3 uses semantic search for robust ontology matching
- **Phase 4 uses Legion's DataSource architecture** - no backend-specific emitters needed!

**MVP Focus**: Production-ready system for factual question answering with no fallbacks, 100% test coverage, and fail-fast error handling.

---

## Goals & Constraints

### Functional Goals

✅ Handle factual questions across domains (finance, geography, biography, etc.)
✅ Support complex linguistic constructs: comparatives, quantifiers, coordination, relative clauses
✅ Map natural language to ontology concepts robustly (synonyms, paraphrases)
✅ Generate generic DataScript queries that work with any DataSource backend
✅ Support multiple backends via DataSource adapters (SPARQL, Cypher, MongoDB, Datalog)
✅ Report ambiguities explicitly (don't guess!)
✅ Single-turn question + context (no multi-turn dialog)

### Non-Functional Constraints (MVP)

✅ **Deterministic core**: Phases 2-4 produce same output for same input
✅ **Fail fast**: No fallbacks, no defaults, explicit errors
✅ **100% test pass rate**: No skipped tests, no mocks in integration tests
✅ **Linear performance**: O(n) in tree size
✅ **Debuggable**: JSON artifacts at every phase with schema validation

### Non-Goals (Out of Scope)

❌ Multi-turn conversation management
❌ Explanatory text generation beyond query results
❌ Knowledge inference or reasoning
❌ Multilingual support (English only)
❌ Real-time streaming queries
❌ Query optimization (use backend optimizers)

---

## Architecture Overview

### Four-Phase Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    User Question + Context                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ Phase 1: Rewrite & Resolve (LLM)                                │
│ - Resolve anaphora, ellipsis, implicit references               │
│ - Normalize entities (Ada Lovelace → :Ada_Lovelace)             │
│ - Normalize dates (yesterday → 2025-01-10)                      │
│ - Normalize units (206k USD → {value: 206000, unit: "USD"})     │
│ - Canonicalize lemmas (was born → born)                         │
│                                                                  │
│ Input:  "what about in 2008?" + context                         │
│ Output: "what is net cash from operating activities in 2008?"   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼ CanonicalQuestion JSON
┌─────────────────────────────────────────────────────────────────┐
│ Phase 2: NP/VP AST (Deterministic)                              │
│ - Parse into minimal NP/VP tree structure                       │
│ - Support: NP, VP, Comp (obj/pred/pp/ccomp/xcomp)               │
│ - Support: Mods (pp/adv/relcl/cmp/coord)                        │
│ - Identify WH-focus (what/which/who/how-many)                   │
│ - Handle nesting: relative clauses, coordination, comparatives  │
│                                                                  │
│ Input:  "Which countries border Germany?"                       │
│ Output: S(NP(which, countries), VP(border, [obj=NP(Germany)]))  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼ NPVP_AST JSON
┌─────────────────────────────────────────────────────────────────┐
│ Phase 3: Semantic Mapping & Constraints (Deterministic)         │
│ - Map tokens → ontology using semantic search                   │
│   • "country" → :Country (via vector embeddings)                │
│   • "nation" → :Country (handles synonyms!)                     │
│   • "borders" → :borders (via property matching)                │
│ - Handle ambiguity: "bank" → :FinancialInstitution vs :RiverBank│
│ - Propagate constraints (comparatives, quantifiers, time/place) │
│ - Build backend-agnostic logical skeleton                       │
│                                                                  │
│ Input:  NP/VP tree + ontology                                   │
│ Output: LogicalSkeleton (vars, atoms, filters, projection)      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼ LogicalSkeleton JSON + AmbiguityReport
┌─────────────────────────────────────────────────────────────────┐
│ Phase 4: Query Generation (DataSource Integration)              │
│ - DataScriptConverter: LogicalSkeleton → DataScript format      │
│   {:find ['?x'] :where [['?x' ':type' ':Country']...]}          │
│                                                                  │
│ Input:  LogicalSkeleton                                         │
│ Output: Generic DataScript query                                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼ DataScript Query
                    ┌────────┴─────────┐
                    │  DataSource Layer │
                    │  (Pluggable)      │
                    └────────┬─────────┘
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
   TripleStoreDS      GraphDataSource    DataStoreDS
   (→ SPARQL)         (→ Cypher)         (→ Datalog)
          │                  │                  │
          ▼                  ▼                  ▼
    Execute & Return Results
```

### Design Principles

1. **Separation of Concerns**: Language understanding (1-3) vs data access (4)
2. **Single Responsibility**: Each phase has one job, produces validated JSON
3. **Pure Functions**: Phases 2-4 are deterministic (same input → same output)
4. **Explicit Artifacts**: Every phase writes structured logs and artifacts
5. **Fail Fast**: No guessing, no defaults - report errors/ambiguities explicitly

---

## Data Contracts

All phases communicate via validated JSON schemas using `@legion/schema`.

### Phase 1 Output: CanonicalQuestion

```json
{
  "text": "what is net cash from operating activities in 2008?",
  "entities": [
    {
      "span": [0, 3],
      "value": "net cash from operating activities",
      "type": "MEASURE",
      "canonical": ":NetCashFromOperatingActivities"
    }
  ],
  "dates": [
    {
      "span": [44, 48],
      "iso": "2008-01-01/2008-12-31"
    }
  ],
  "units": [],
  "wh_role": "what",
  "lang": "en"
}
```

**Schema**: `CanonicalQuestion.schema.json`

**Fields**:
- `text` (string, required): Canonicalized sentence with resolved references
- `entities` (array): Normalized named entities with spans and canonical IRIs
- `dates` (array): Parsed dates in ISO 8601 format
- `units` (array): Parsed numbers with units (e.g., {value: 206000, unit: "USD"})
- `wh_role` (enum): One of `what|which|who|where|when|how-many|how-much|why|how`
- `lang` (string): Language code (always "en" for MVP)

### Phase 2 Output: NPVP_AST

```json
{
  "S": {
    "NP": {
      "Det": "which",
      "Head": "countries",
      "Mods": []
    },
    "VP": {
      "Verb": "border",
      "Comps": [
        ["obj", {
          "Det": null,
          "Head": {"Name": "Germany"},
          "Mods": []
        }]
      ],
      "Mods": []
    },
    "Force": "ask",
    "Meta": {}
  }
}
```

**Schema**: `NPVP_AST.schema.json`

**Structure**:
- `S`: Root sentence node
  - `NP`: Subject noun phrase
    - `Det`: Determiner (what/which/the/a/every/null/number)
    - `Head`: String or `{Name: "..."}` for proper nouns
    - `Mods`: Array of modifiers
  - `VP`: Verb phrase
    - `Verb`: Main verb (lemmatized)
    - `Comps`: Array of complements `[type, value]`
      - Types: `obj`, `pred`, `pp`, `ccomp`, `xcomp`
    - `Mods`: Array of modifiers
  - `Force`: Question type (`ask|yn|explain|compare`)
  - `Meta`: Optional metadata (domain hints, etc.)

**Modifier Types**:
- `["pp", Prep, NP]` - Prepositional phrase
- `["adv", Adv]` - Adverb
- `["relcl", S]` - Relative clause (nested sentence)
- `["cmp", Op, Attr, Value]` - Comparative (>, <, >=, <=, =)
- `["coord", Conj, X, Y]` - Coordination (and/or)

### Phase 3 Output: LogicalSkeleton

```json
{
  "vars": ["?x", "?y"],
  "atoms": [
    ["isa", "?x", ":Country"],
    ["rel", ":borders", "?x", ":Germany"]
  ],
  "project": ["?x"],
  "order": [],
  "limit": null,
  "force": "select",
  "notes": []
}
```

**Schema**: `LogicalSkeleton.schema.json`

**Fields**:
- `vars` (array): All variables used in query
- `atoms` (array): Logical atoms (predicates, relations, filters, ops)
  - `["isa", Var, Class]` - Type assertion
  - `["rel", Pred, Subj, Obj]` - Relationship
  - `["has", Entity, Attr, Value]` - Attribute/property
  - `["filter", Op, Var, Value]` - Comparison filter
  - `["op", OpName, Arg1, Arg2, OutVar]` - Operations (difference, percent_change)
- `project` (array): Variables or aggregations to return
  - Simple: `["?x"]`
  - Aggregation: `["COUNT", "?x"]` or `["MAX", "?height"]`
- `order` (array): Sort specification `[["?x", "asc"], ["?y", "desc"]]`
- `limit` (number|null): Result limit
- `force` (enum): Query type (`ask|select|aggregate`)
- `notes` (array): Warnings, assumptions, clarifications

### Phase 3 Output: AmbiguityReport

```json
{
  "unmapped_tokens": ["in"],
  "multi_sense": [
    {
      "token": "bank",
      "candidates": [
        {"iri": ":FinancialInstitution", "score": 0.89},
        {"iri": ":RiverBank", "score": 0.82}
      ]
    }
  ],
  "role_conflicts": [
    {
      "prep": "in",
      "options": [
        {"role": ":year", "type": "temporal", "score": 0.91},
        {"role": ":inPlace", "type": "spatial", "score": 0.73}
      ]
    }
  ],
  "comparator_missing": false
}
```

**Schema**: `AmbiguityReport.schema.json`

**Fields**:
- `unmapped_tokens` (array): Tokens with no ontology mapping
- `multi_sense` (array): Tokens with multiple candidate mappings
- `role_conflicts` (array): Ambiguous role assignments (temporal vs spatial, etc.)
- `comparator_missing` (boolean): Comparative detected but no baseline found

---

## Phase 1: Rewrite & Resolve

### Purpose

Transform conversational/elliptical questions into explicit canonical form using an LLM with structured output.

### Responsibilities

1. **Resolve References**
   - Pronouns: "What about it?" → "What about Ada Lovelace?"
   - Demonstratives: "this company" → "Microsoft"
   - Ellipsis: "and in 2008?" → "what is net cash from operating activities in 2008?"

2. **Normalize Entities**
   - Names: "Ada Lovelace" → canonical IRI (light entity linking)
   - Aliases: "USA" → "United States" → `:United_States`

3. **Normalize Dates**
   - Relative: "yesterday" → "2025-01-10"
   - Natural: "Q3 2023" → "2023-07-01/2023-09-30"
   - Contextual: "this year" + context → "2024-01-01/2024-12-31"

4. **Normalize Units**
   - Parse: "206k USD" → `{value: 206000, unit: "USD"}`
   - Implicit: "5 million" → `{value: 5000000, unit: null}`

5. **Canonicalize Lemmas**
   - Verbs: "was born" → "born"
   - Be/Have forms: "is", "are", "was" → "be"

### Implementation

**Technology**: `@legion/prompting` with `TemplatedPrompt`

**LLM Provider**: Configurable via `ResourceManager` (OpenAI, Anthropic, etc.)

**Prompt Strategy**: Few-shot with structured JSON output enforced via schema

**Self-Check**: Second LLM pass verifies no unresolved references remain

### Error Handling

- Missing context → Return `{needs_clarification: true, missing: ["pronoun referent"]}`
- Ambiguous reference → Return `{alternatives: [{text: "...", confidence: 0.8}, ...]}`
- Date parsing failure → Keep original text, mark as `{unparsed: true}`

---

## Phase 2: NP/VP AST

### Purpose

Parse canonical question into a minimal NP/VP tree structure that captures linguistic relationships deterministically.

### Grammar

**Minimal closed inventory**:
- **NP** (Noun Phrase): `Det + Head + Mods*`
- **VP** (Verb Phrase): `Verb + Comps* + Mods*`
- **Comp** (Complement): obj, pred, pp, ccomp, xcomp
- **Mod** (Modifier): pp, adv, relcl, cmp, coord

**Key Features**:
- Single rooted tree (no DAG/reentrancy)
- WH-focus indicated by Det position (what/which/who/how-many)
- Free nesting support (relative clauses, coordination, etc.)
- Well-formedness validation

### Algorithm

1. **Tokenize + POS + NER**: Off-the-shelf (spaCy, Stanford NLP, etc.)
2. **Dependency Parse**: Extract syntactic dependencies
3. **Identify WH NP and Main Verb**: Find interrogative focus and root verb
4. **Build NP Structures**:
   - Extract head noun
   - Attach modifiers (PPs, relative clauses, adjectives)
   - Handle coordination ("A and B")
5. **Build VP Structures**:
   - Extract main verb
   - Identify complements (objects, predicates, clausal complements)
   - Attach modifiers (adverbs, PPs)
6. **Convert Comparatives**: "newer than X" → `Mod=["cmp", ">", ":releaseDate", X]`
7. **Convert Relative Clauses**: "that borders X" → `Mod=["relcl", S(...)]`
8. **Validate**: Check well-formedness (one WH-focus, rooted tree, etc.)

### Validation Rules

✅ Exactly one interrogative focus (unless yes/no question)
✅ Single rooted tree
✅ All NP/VP/Comp/Mod structures well-formed
✅ Tree depth < 20 (prevent runaway)
✅ No circular references

---

## Phase 3: Semantic Mapping & Constraints

### Purpose

Map linguistic tokens to ontology concepts using semantic search, then build a backend-agnostic logical query skeleton.

### Key Innovation: Semantic Search Integration

**Problem**: Static lexicons are brittle
- "nation" vs "country"
- "earnings" vs "revenue" vs "income"
- Domain-specific terminology

**Solution**: Use `@legion/semantic-search` with vector embeddings

### Architecture

```
Ontology (classes, properties, individuals)
        ↓
  OntologyIndexer
        ↓
Semantic Search Index (vector embeddings)
        ↓
  SemanticMapper (query-time lookup)
        ↓
Token → Top-K Candidates (with confidence scores)
        ↓
Disambiguation Logic (context, domain, thresholds)
        ↓
IRI Mapping or Ambiguity Report
```

### OntologyIndexer

**Responsibilities**: Index ontology into semantic search

**Indexed Content**:
1. **Classes**: Label + description + synonyms → `:Country`, `:Company`, etc.
2. **Properties**: Label + description + synonyms → `:borders`, `:revenue`, etc.
3. **Individuals**: Label + aliases → `:Germany`, `:Ada_Lovelace`, etc.

**Metadata**:
- `type`: class, property, individual
- `domain`: finance, geography, biography, etc.
- `propertyType`: temporal, spatial, measure, etc. (for properties)
- `range`: expected value type (for properties)

**Example**:
```javascript
await semanticSearch.indexDocument({
  id: ':Country',
  type: 'class',
  text: 'Country nation state sovereign territory',
  metadata: { domain: 'geography' }
});

await semanticSearch.indexDocument({
  id: ':borders',
  type: 'property',
  text: 'borders adjacent shares boundary neighbors',
  metadata: {
    domain: 'geography',
    propertyType: 'spatial'
  }
});
```

### SemanticMapper

**Responsibilities**: Map tokens to ontology IRIs using semantic search

**Methods**:
- `mapNoun(head, context)` → IRI or candidates
- `mapVerb(verb, context)` → IRI or candidates
- `mapPreposition(prep, npContext)` → role IRI or candidates
- `mapAdjective(adj, context)` → attribute IRI or candidates

**Mapping Logic**:
1. Query semantic search with token
2. Filter by type (class for nouns, property for verbs, etc.)
3. Apply confidence threshold (0.7)
4. Rerank by context (domain match → boost score)
5. Return result:
   - **Single match** (score > 0.9 or only 1 result) → Use directly
   - **Multiple matches** → Add to AmbiguityReport, use top candidate
   - **No matches** → Add to unmapped_tokens

**Example**:
```javascript
// "nation" → :Country (via embeddings)
const results = await semanticSearch.search("nation", {
  filter: { type: 'class' },
  limit: 3,
  threshold: 0.7
});
// Results: [{id: ':Country', score: 0.94}, {id: ':Nation', score: 0.88}]

// Context-aware: "in 2008"
const results = await semanticSearch.search("in 2008", {
  filter: { type: 'property' },
  limit: 5
});
// Filter by propertyType: temporal vs spatial
// Return: {role: ':year', type: 'temporal', confidence: 0.91}
```

### TreeWalker: 15 Core Rules

Walk the NP/VP AST and apply mapping rules to build the LogicalSkeleton.

**Rule 1: Subject NP → Variable + Type**
```
NP(Head=h) → ?x, ["isa", "?x", mapNoun(h)]
```

**Rule 2: Proper Names → Constants**
```
NP(Head={Name: "Germany"}) → ["isa", ":Germany", ":Country"]
```

**Rule 3: Verb Frame → Predicate**
```
VP(Verb=v, obj=NP(y)) → ["rel", mapVerb(v), ?subj, ?y]
```

**Rule 4: Copula → Type/Attribute**
```
VP(be, pred=NP(kind)) → ["isa", ?subj, mapNoun(kind)]
VP(be, pred=Adj) → ["has", ?subj, mapAdj(Adj), ?value]
```

**Rule 5: PP Mods → Role Assignment**
```
Mod=["pp", prep, NP(t)] → ["has", ?parent, mapPrep(prep, t), ?t]
```

**Rule 6: Relative Clause → Nested Constraints**
```
Mod=["relcl", S] → walk(S, ?parent as subject) → conjoin atoms
```

**Rule 7: CComp/XComp → Subordination**
```
Comp=["ccomp", S] → walk(S) → embed in main skeleton
```

**Rule 8: Comparative → Filter**
```
Mod=["cmp", op, attr, value] → ["filter", op, mapAttr(attr), value]
```

**Rule 9: Quantifiers → Aggregation**
```
Det="how-many" → project=["COUNT", ?subjVar]
```

**Rule 10: Coordination → Disjunction/Conjunction**
```
Mod=["coord", "and", X, Y] → walk(X) ∧ walk(Y)
Mod=["coord", "or", X, Y] → walk(X) ∨ walk(Y)
```

**Rule 11: Nominal Operations → Ops**
```
Head="difference" + PP("between", A) + PP("and", B)
  → ["op", "difference", ?vA, ?vB, ?out]
```

**Rule 12: Temporal Normalization**
```
PP("in", NP(2008)) + tense(past) → ["has", ?event, ":year", "2008"]
```

**Rule 13: Unit Handling**
```
Phase 1 units → carry as metadata for result formatting
```

**Rule 14: Projection Logic**
```
WH position → determine project vars
what/which → project subject or object var
how-many → COUNT(var)
yes/no → force="ask"
```

**Rule 15: Ambiguity Handling**
```
Multiple mappings → record in AmbiguityReport
No mapping → add to unmapped_tokens
Choose top candidate by confidence
```

### ConstraintPropagator

**Responsibilities**: Simplify and propagate constraints across the skeleton

**Operations**:
1. **Variable Unification**: Merge constraints on same entity
2. **Push Restrictions**: Move PP constraints to correct role arguments
3. **Simplify Expressions**: Merge duplicate filters
4. **Type Checking**: Validate property domains/ranges (optional, best-effort)

**Example**:
```javascript
// Before:
atoms = [
  ["isa", "?x", ":Country"],
  ["has", "?x", ":name", "?n"],
  ["has", "?x", ":name", "?n"]  // Duplicate
]

// After propagation:
atoms = [
  ["isa", "?x", ":Country"],
  ["has", "?x", ":name", "?n"]  // Merged
]
```

---

## Phase 4: Query Generation (DataSource Integration)

### Purpose

Convert the backend-agnostic LogicalSkeleton into **generic DataScript query format**, then pass to appropriate DataSource adapters for backend-specific translation.

### Key Architectural Insight

**The query understanding system does NOT emit backend-specific queries!**

Instead:
1. Phase 4 converts LogicalSkeleton → **DataScript query format**
2. DataSource adapters handle backend translation (SPARQL, Cypher, MongoDB, etc.)
3. This leverages Legion's existing **Handle/DataSource/Proxy architecture**

**Benefits**:
- ✅ Completely pluggable - any DataSource works
- ✅ Separates query understanding from backend specifics
- ✅ LogicalSkeleton already matches DataScript format (minimal conversion!)
- ✅ Can add new backends by implementing DataSource interface
- ✅ Simpler MVP - no backend-specific emitters to build

### DataScript Converter

**Responsibilities**: Convert LogicalSkeleton to DataScript query format

**Input**: LogicalSkeleton (from Phase 3)
```json
{
  "vars": ["?x"],
  "atoms": [
    ["isa", "?x", ":Country"],
    ["rel", ":borders", "?x", ":Germany"]
  ],
  "project": ["?x"],
  "force": "select"
}
```

**Output**: DataScript Query
```javascript
{
  find: ['?x'],
  where: [
    ['?x', ':type', ':Country'],
    ['?x', ':borders', ':Germany']
  ]
}
```

### Conversion Rules

**Rule 1: Project → Find Clause**
```javascript
// LogicalSkeleton
project: ["?x", "?y"]

// DataScript
find: ['?x', '?y']
```

**Rule 2: ISA Atoms → Type Triples**
```javascript
// LogicalSkeleton
["isa", "?x", ":Country"]

// DataScript
['?x', ':type', ':Country']
```

**Rule 3: REL Atoms → Property Triples**
```javascript
// LogicalSkeleton
["rel", ":borders", "?x", ":Germany"]

// DataScript
['?x', ':borders', ':Germany']
```

**Rule 4: HAS Atoms → Attribute Triples**
```javascript
// LogicalSkeleton
["has", "?entity", ":revenue", "?v"]

// DataScript
['?entity', ':revenue', '?v']
```

**Rule 5: FILTER Atoms → Predicate Functions**
```javascript
// LogicalSkeleton
["filter", ">", "?age", 30]

// DataScript
['?e', ':age', '?age'],
[(fn [age] (> age 30)) '?age']  // Inline predicate
```

**Rule 6: Aggregations**
```javascript
// LogicalSkeleton
project: ["COUNT", "?x"]

// DataScript
find: ['(count ?x)']
```

**Rule 7: Operations → Complex Expressions**
```javascript
// LogicalSkeleton
["op", "percent_change", "?v2009", "?v2008", "?pct"]

// DataScript
// Handled via post-processing or custom predicates
```

### DataSource Integration

Once the query is in DataScript format, pass it to the appropriate DataSource:

```javascript
import { DataScriptConverter } from './DataScriptConverter.js';

// Convert LogicalSkeleton to DataScript
const converter = new DataScriptConverter();
const dataScriptQuery = converter.convert(logicalSkeleton);

// Get appropriate DataSource from ResourceManager
const dataSource = await resourceManager.get('dataSource');

// Execute query through DataSource
const results = dataSource.query(dataScriptQuery);
```

### Backend-Specific DataSource Implementations

Different DataSources handle backend translation:

**1. DataStoreDataSource**
- Uses DataScript queries **directly** (no translation!)
- Target: In-memory `@legion/data-store`

**2. TripleStoreDataSource**
- Translates DataScript → Triple patterns `{subject, predicate, object}`
- Underlying ITripleStore implementation handles SPARQL generation
- Target: RDF triplestores via `@legion/rdf`

**3. GraphDataSource**
- Translates DataScript → Graph patterns `{type: 'nodes', type: 'connectedNodes'}`
- Target: Neo4j, in-memory graphs

**4. MongoDataSource (Future)**
- Translates DataScript → MongoDB aggregation pipeline
- Target: MongoDB via `@legion/data-sources/mongodb`

### Example: SPARQL Backend

```javascript
// 1. LogicalSkeleton from Phase 3
const skeleton = {
  vars: ["?x"],
  atoms: [
    ["isa", "?x", ":Country"],
    ["rel", ":borders", "?x", ":Germany"]
  ],
  project: ["?x"]
};

// 2. Convert to DataScript
const dataScriptQuery = {
  find: ['?x'],
  where: [
    ['?x', ':type', ':Country'],
    ['?x', ':borders', ':Germany']
  ]
};

// 3. Pass to TripleStoreDataSource
const tripleStoreDataSource = await resourceManager.get('tripleStoreDataSource');
const results = tripleStoreDataSource.query(dataScriptQuery);

// 4. TripleStoreDataSource internally:
//    - Converts to triple patterns
//    - Passes to ITripleStore implementation
//    - ITripleStore generates SPARQL:
//      SELECT ?x WHERE {
//        ?x a :Country .
//        ?x :borders :Germany .
//      }
```

### DataSource Interface Contract

All DataSources must implement:

```javascript
// REQUIRED methods (all synchronous!)
query(querySpec) → results          // Execute query
subscribe(querySpec, callback) → subscription  // Change notifications
getSchema() → schema                // Introspection
queryBuilder(sourceHandle) → builder  // Query combinators

// OPTIONAL methods
update(updateSpec) → result         // Data modifications
validate(data) → boolean            // Schema validation
getMetadata() → metadata            // Capabilities info
```

### Implementation Strategy

**Phase 4 Implementation**:
1. `DataScriptConverter.js` - LogicalSkeleton → DataScript format
2. `DataSourceAdapter.js` - Route to appropriate DataSource
3. Integration tests using existing DataSources (DataStoreDataSource, TripleStoreDataSource)

**No backend-specific emitters needed!** DataSources handle translation.

### Validation

**Converter Output**:
- Valid DataScript query format
- All variables from `vars` appear in `where` clauses
- `find` clause matches `project` specification
- Filters correctly translated to predicates

**DataSource Compatibility**:
- Query executes without errors
- Results match expected schema
- Subscriptions work for live updates

---

## Integration Points

### Legion Package Dependencies

```javascript
// Phase 1
import { TemplatedPrompt } from '@legion/prompting/prompt-manager';
import { ResourceManager } from '@legion/resource-manager';

// Phase 3
import { SemanticSearchProvider } from '@legion/semantic-search';
import { OntologyBuilder } from '@legion/km/ontology';

// Phase 4 - DataSource Architecture
import { DataStoreDataSource } from '@legion/data-store';
import { TripleStoreDataSource } from '@legion/triplestore';
import { GraphDataSource } from '@legion/graph';

// Schema Validation
import { validateSchema } from '@legion/schema';
```

### ResourceManager Integration

```javascript
const resourceManager = await ResourceManager.getInstance();

// Get dependencies
const llmClient = await resourceManager.get('llmClient');
const semanticSearch = await resourceManager.get('semanticSearch');
const ontology = await resourceManager.get('ontology');

// Get appropriate DataSource for backend
const dataSource = await resourceManager.get('dataSource');
// OR get specific DataSource implementations:
const tripleStoreDataSource = await resourceManager.get('tripleStoreDataSource');
const graphDataSource = await resourceManager.get('graphDataSource');
const dataStoreDataSource = await resourceManager.get('dataStoreDataSource');
```

### Pipeline Usage

```javascript
import { QueryUnderstandingPipeline } from '@legion/km/query-understanding';

// Initialize with DataSource
const pipeline = new QueryUnderstandingPipeline(resourceManager);
await pipeline.initialize({
  dataSource: 'tripleStoreDataSource'  // or 'graphDataSource', 'dataStoreDataSource'
});

// Process question
const result = await pipeline.process(
  "Which countries border Germany?",
  { domain: 'geography' }
);

console.log(result.dataScriptQuery);
// {
//   find: ['?x'],
//   where: [
//     ['?x', ':type', ':Country'],
//     ['?x', ':borders', ':Germany']
//   ]
// }

console.log(result.results);
// Query results from DataSource

console.log(result.ambiguities);
// { unmapped_tokens: [], multi_sense: [], ... }
```

---

## Testing Strategy

### Unit Tests

**Coverage**: Every rule, every normalizer, every mapper

**Tools**: Jest with `--runInBand`, `@legion/schema` validation

**Examples**:
- Date normalization: "Q3 2023" → "2023-07-01/2023-09-30"
- Semantic mapping: "nation" → `:Country` (score > 0.9)
- Tree validation: Reject trees with >1 WH-focus

### Integration Tests

**No Mocks**: Use real LLM, real semantic search, real ontology

**Coverage**:
- Phase 1: 50 questions with real LLM
- Phase 2: 150 golden trees
- Phase 3: 200 questions with semantic mapping
- Phase 4: 100 DataScript conversions + 80 DataSource integrations

**Tools**: Real resources via ResourceManager (FAIL if not available)
**DataSource Testing**: Use existing DataStoreDataSource and TripleStoreDataSource implementations

### Golden Test Suite

**300 curated questions** across domains:
- Finance: 100 (revenue, expenses, ratios, trends)
- Geography: 100 (borders, population, capitals)
- Biography: 50 (birth, death, relationships)
- General: 50 (temporal, comparatives, aggregations)

**For each question**:
- Expected CanonicalQuestion
- Expected NPVP_AST
- Expected LogicalSkeleton
- Expected DataScript query
- Expected results when executed via DataSource

### End-to-End Tests

**Flow**: Question → all 4 phases → executable query → verify results

**Validation**:
- Query executes without errors
- Results match expected entities
- Ambiguities reported correctly
- Performance < 5 seconds per question

### Property-Based Tests

**Focus**: Phase 2 tree building

**Properties**:
- Nested coordination maintains well-formedness
- Relative clauses preserve variable bindings
- Tree depth bounded

---

## Examples

### Example 1: Simple Entity Query

**Question**: "Which countries border Germany?"

**Phase 1 Output**:
```json
{
  "text": "which countries border Germany?",
  "entities": [
    {"span": [28, 35], "value": "Germany", "canonical": ":Germany"}
  ],
  "dates": [],
  "units": [],
  "wh_role": "which"
}
```

**Phase 2 Output**:
```json
{
  "S": {
    "NP": {"Det": "which", "Head": "countries", "Mods": []},
    "VP": {
      "Verb": "border",
      "Comps": [["obj", {"Det": null, "Head": {"Name": "Germany"}, "Mods": []}]],
      "Mods": []
    },
    "Force": "ask"
  }
}
```

**Phase 3 Output**:
```json
{
  "vars": ["?x"],
  "atoms": [
    ["isa", "?x", ":Country"],
    ["rel", ":borders", "?x", ":Germany"]
  ],
  "project": ["?x"],
  "order": [],
  "limit": null,
  "force": "select"
}
```

**Phase 4 Output (DataScript)**:
```javascript
{
  find: ['?x'],
  where: [
    ['?x', ':type', ':Country'],
    ['?x', ':borders', ':Germany']
  ]
}
```

**Backend Execution** (via TripleStoreDataSource → SPARQL):
```sparql
SELECT ?x
WHERE {
  ?x a :Country .
  ?x :borders :Germany .
}
```

---

### Example 2: Temporal Query with Comparatives

**Question**: "What is the percentage change in revenue between 2009 and 2008?"

**Phase 1 Output**:
```json
{
  "text": "what is the percentage change in revenue between 2009 and 2008?",
  "entities": [
    {"span": [34, 41], "value": "revenue", "canonical": ":revenue"}
  ],
  "dates": [
    {"span": [50, 54], "iso": "2009-01-01/2009-12-31"},
    {"span": [59, 63], "iso": "2008-01-01/2008-12-31"}
  ],
  "wh_role": "what"
}
```

**Phase 2 Output**:
```json
{
  "S": {
    "NP": {"Det": "what", "Head": "percentage change", "Mods": [
      ["pp", "in", {"Head": "revenue", "Mods": []}],
      ["pp", "between", {"Head": "2009", "Mods": []}],
      ["pp", "and", {"Head": "2008", "Mods": []}]
    ]},
    "VP": {"Verb": "be", "Comps": [], "Mods": []},
    "Force": "ask"
  }
}
```

**Phase 3 Output**:
```json
{
  "vars": ["?v2009", "?v2008", "?pct"],
  "atoms": [
    ["has", ":entity", ":revenue", "?v2009"],
    ["has", ":entity", ":year", "2009"],
    ["has", ":entity", ":revenue", "?v2008"],
    ["has", ":entity", ":year", "2008"],
    ["op", "percent_change", "?v2009", "?v2008", "?pct"]
  ],
  "project": ["?pct"],
  "force": "select"
}
```

---

### Example 3: Ambiguity Handling

**Question**: "Which banks are near the river?"

**Phase 3 Output**:
```json
{
  "vars": ["?x", "?r"],
  "atoms": [
    ["isa", "?x", ":FinancialInstitution"],
    ["rel", ":near", "?x", "?r"],
    ["isa", "?r", ":River"]
  ],
  "project": ["?x"]
}
```

**Ambiguity Report**:
```json
{
  "multi_sense": [
    {
      "token": "banks",
      "candidates": [
        {"iri": ":FinancialInstitution", "score": 0.89},
        {"iri": ":RiverBank", "score": 0.85}
      ]
    }
  ],
  "notes": ["Chose :FinancialInstitution based on context 'river' suggesting contrast"]
}
```

---

## Glossary

- **Canonical Question**: Explicit, unambiguous reformulation after reference resolution
- **NP/VP IR**: Minimal tree structure capturing noun phrases and verb phrases
- **Lexicon/Ontology Mapping**: Association between surface forms and schema IRIs
- **Logical Skeleton**: Backend-agnostic set of atoms/relations/filters
- **Semantic Search**: Vector-based similarity search using embeddings
- **WH-Focus**: Interrogative element (what/which/who) indicating query target

---

## Appendix: JSON Schema Definitions

### CanonicalQuestion.schema.json

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["text", "wh_role", "lang"],
  "properties": {
    "text": {"type": "string"},
    "entities": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["span", "value", "type"],
        "properties": {
          "span": {"type": "array", "items": {"type": "integer"}, "minItems": 2, "maxItems": 2},
          "value": {"type": "string"},
          "type": {"type": "string"},
          "canonical": {"type": "string"}
        }
      }
    },
    "dates": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["span", "iso"],
        "properties": {
          "span": {"type": "array", "items": {"type": "integer"}, "minItems": 2, "maxItems": 2},
          "iso": {"type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}"}
        }
      }
    },
    "units": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["span", "value"],
        "properties": {
          "span": {"type": "array", "items": {"type": "integer"}, "minItems": 2, "maxItems": 2},
          "value": {"type": "number"},
          "unit": {"type": ["string", "null"]}
        }
      }
    },
    "wh_role": {
      "type": "string",
      "enum": ["what", "which", "who", "where", "when", "how-many", "how-much", "why", "how"]
    },
    "lang": {"type": "string"}
  }
}
```

---

**End of Design Document**
