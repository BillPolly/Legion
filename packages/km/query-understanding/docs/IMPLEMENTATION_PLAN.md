# Query Understanding System - Implementation Plan

**Package**: `@legion/km/query-understanding`
**Approach**: Test-Driven Development (no refactor phase - get it right first time)
**Strategy**: 80/20 rule - build core mechanisms first, then elaborate
**Quality**: 100% test pass rate, no skips, no fallbacks, FAIL FAST

---

## Overview

This plan implements the 4-phase natural language query understanding pipeline as specified in `DESIGN.md`. Each phase builds on the previous, with comprehensive testing at every step.

**Key Principles:**
- Build incrementally in natural dependency order
- Test thoroughly before moving forward (unit → integration → e2e)
- No mocks in integration tests (only for peripheral concerns)
- No fallbacks in implementation - FAIL FAST
- Every phase delivers demonstrable value
- Read DESIGN.md at each phase for implementation details

**Testing Rules:**
- ✅ Unit tests: Can use mocks for external dependencies
- ✅ Integration tests: Real services only (LLM, semantic search, MongoDB, Qdrant)
- ✅ All resources available in .env (API keys, database URLs)
- ✅ No skipping tests - they must pass or fail
- ✅ No fallback logic - explicit errors only

---

## Phase 0: Foundation & Schemas

### Purpose
Establish package structure, schemas, and validation infrastructure before implementing pipeline logic.

### Steps

- [ ] **0.1**: Read DESIGN.md Section "Data Contracts" and "Architecture Overview"

- [ ] **0.2**: Create package structure
  - Create `/packages/km/query-understanding` directory
  - Set up `package.json` with dependencies
  - Configure Jest for ES6 modules (no concurrent tests)
  - Add workspace imports for `@legion/schema`, `@legion/resource-manager`, `@legion/prompting`, `@legion/semantic-search`

- [ ] **0.3**: Define JSON schemas
  - Create `/schemas/CanonicalQuestion.schema.json` (from DESIGN.md Appendix)
  - Create `/schemas/NPVP_AST.schema.json` (from DESIGN.md Section "Phase 2 Output")
  - Create `/schemas/LogicalSkeleton.schema.json` (from DESIGN.md Section "Phase 3 Output")
  - Create `/schemas/AmbiguityReport.schema.json` (from DESIGN.md Section "Phase 3 Output")

- [ ] **0.4**: Unit test schemas
  - Test CanonicalQuestion validation with valid/invalid inputs
  - Test NPVP_AST validation with valid/invalid tree structures
  - Test LogicalSkeleton validation with valid/invalid atoms
  - Test AmbiguityReport validation
  - All tests must use `@legion/schema` validator
  - FAIL FAST on validation errors

- [ ] **0.5**: Create base pipeline class
  - Create `src/QueryUnderstandingPipeline.js` with constructor and initialize method
  - Accept ResourceManager in constructor
  - Accept dataSource option in initialize (specifies which DataSource to use)
  - Write unit tests for initialization
  - FAIL if ResourceManager not provided or not initialized
  - FAIL if DataSource not available

**Deliverable**: Working package with validated schemas, ready for phase implementations

---

## Phase 1: Rewrite & Resolve (LLM)

### Purpose
Implement Phase 1 that normalizes questions using LLM with structured output.

### Steps

- [ ] **1.1**: Read DESIGN.md Section "Phase 1: Rewrite & Resolve"

- [ ] **1.2**: Create Phase 1 processor
  - Create `src/phase1/RewriteResolver.js`
  - Implement reference resolution using `@legion/prompting` TemplatedPrompt
  - Implement entity normalization (names to IRIs)
  - Implement date normalization (relative/natural dates to ISO)
  - Implement unit normalization (parse quantities)
  - Implement lemma canonicalization (verb forms)

- [ ] **1.3**: Unit test Phase 1 components
  - Test date normalizer: "Q3 2023" → "2023-07-01/2023-09-30"
  - Test unit parser: "206k USD" → {value: 206000, unit: "USD"}
  - Test entity normalizer: "Ada Lovelace" → ":Ada_Lovelace"
  - Test pronoun resolution (can mock LLM for unit tests)
  - Test ellipsis resolution (can mock LLM for unit tests)
  - All outputs must validate against CanonicalQuestion schema

- [ ] **1.4**: Integration test Phase 1 with real LLM
  - Test 20 questions with real LLM from .env
  - Include: pronouns, ellipsis, dates, entities, units
  - NO MOCKS - use real LLM client from ResourceManager
  - Verify CanonicalQuestion schema validation
  - FAIL FAST if LLM not available

- [ ] **1.5**: Create Phase 1 golden test suite
  - Create 50 test cases in `__tests__/golden/phase1/`
  - Include expected CanonicalQuestion output for each
  - Test conversation context resolution
  - Test temporal references (yesterday, Q3, this year)
  - Verify schema compliance for all outputs

**Deliverable**: Working Phase 1 that produces validated CanonicalQuestion JSON

---

## Phase 2: NP/VP AST Parser

### Purpose
Implement deterministic parser that converts canonical questions to NP/VP tree structures.

### Steps

- [ ] **2.1**: Read DESIGN.md Section "Phase 2: NP/VP AST"

- [ ] **2.2**: Create tree node classes
  - Create `src/phase2/nodes/NP.js` (Det, Head, Mods)
  - Create `src/phase2/nodes/VP.js` (Verb, Comps, Mods)
  - Create `src/phase2/nodes/Sentence.js` (NP, VP, Force)
  - Implement toJSON() for each node
  - Add validation methods for well-formedness

- [ ] **2.3**: Unit test tree nodes
  - Test NP construction and validation
  - Test VP construction and validation
  - Test Sentence construction and validation
  - Test modifier attachment (pp, adv, relcl, cmp, coord)
  - Test complement attachment (obj, pred, pp, ccomp, xcomp)
  - Verify well-formedness rules (single root, no cycles)

- [ ] **2.4**: Create NP/VP parser
  - Create `src/phase2/NPVPParser.js`
  - Implement tokenization and POS tagging
  - Implement dependency parse extraction
  - Implement WH-focus identification
  - Implement NP structure builder
  - Implement VP structure builder
  - Implement modifier/complement attachment

- [ ] **2.5**: Unit test parser components
  - Test WH-focus extraction: "which countries" → Det="which"
  - Test proper noun detection: "Germany" → {Name: "Germany"}
  - Test comparative conversion: "newer than X" → ["cmp", ">", ":releaseDate", X]
  - Test relative clause conversion: "that borders X" → ["relcl", S(...)]
  - Test coordination: "A and B" → ["coord", "and", A, B]

- [ ] **2.6**: Integration test parser
  - Test 150 questions producing golden trees
  - Include: simple, complex, nested, coordinated structures
  - NO MOCKS - use real NLP libraries
  - Validate all outputs against NPVP_AST schema
  - FAIL if tree validation fails

- [ ] **2.7**: Create Phase 2 golden test suite
  - Create test cases in `__tests__/golden/phase2/`
  - Include all linguistic constructs from DESIGN.md
  - Store expected tree structures
  - Test property-based rules (tree depth, well-formedness)

**Deliverable**: Deterministic parser producing validated NP/VP trees

---

## Phase 3: Semantic Mapping & Constraints

### Purpose
Map linguistic tokens to ontology concepts using semantic search, build LogicalSkeleton.

### Steps

- [ ] **3.1**: Read DESIGN.md Section "Phase 3: Semantic Mapping & Constraints"

- [ ] **3.2**: Create ontology indexer
  - Create `src/phase3/OntologyIndexer.js`
  - Index classes (label + description + synonyms)
  - Index properties (label + description + domain/range)
  - Index individuals (label + aliases)
  - Use `@legion/semantic-search` for vector storage
  - Store metadata (type, domain, propertyType)

- [ ] **3.3**: Unit test ontology indexer
  - Test class indexing: "Country nation state" → :Country
  - Test property indexing: "borders adjacent" → :borders
  - Test individual indexing: "USA United States" → :United_States
  - Mock semantic search for unit tests
  - Verify all documents indexed with correct metadata

- [ ] **3.4**: Integration test indexer with real semantic search
  - Index sample ontology (50 classes, 100 properties, 200 individuals)
  - Use real Qdrant from docker-compose
  - Use real Nomic embeddings
  - NO MOCKS - fail if services unavailable
  - Verify searchable via semantic search

- [ ] **3.5**: Create semantic mapper
  - Create `src/phase3/SemanticMapper.js`
  - Implement mapNoun(head, context) → IRI
  - Implement mapVerb(verb, context) → IRI
  - Implement mapPreposition(prep, npContext) → role IRI
  - Implement mapAdjective(adj, context) → attribute IRI
  - Implement confidence thresholds and ambiguity detection
  - Implement context-aware reranking (domain boost)

- [ ] **3.6**: Unit test semantic mapper
  - Test noun mapping: "nation" → :Country (mock search results)
  - Test verb mapping: "borders" → :borders
  - Test ambiguity detection: "bank" → multiple candidates
  - Test threshold filtering (score < 0.7 → unmapped)
  - Test context boosting (domain match → higher score)

- [ ] **3.7**: Integration test mapper with real semantic search
  - Test 100 mappings with real indexed ontology
  - Test synonym resolution: "nation" → :Country
  - Test domain-specific terms
  - NO MOCKS for semantic search
  - Verify AmbiguityReport generation

- [ ] **3.8**: Create tree walker with 15 rules
  - Create `src/phase3/TreeWalker.js`
  - Implement all 15 rules from DESIGN.md Section "TreeWalker: 15 Core Rules"
  - Walk NP/VP AST and build LogicalSkeleton
  - Handle variables, type assertions, relationships, filters
  - Handle quantifiers, aggregations, operators
  - Generate AmbiguityReport

- [ ] **3.9**: Unit test tree walker rules
  - Test Rule 1: Subject NP → variable + type
  - Test Rule 2: Proper names → constants
  - Test Rule 3: Verb frame → predicate
  - Test Rule 4: Copula → type/attribute
  - Test Rule 5: PP mods → role assignment
  - Test all 15 rules individually with mock mapper
  - Verify LogicalSkeleton structure

- [ ] **3.10**: Create constraint propagator
  - Create `src/phase3/ConstraintPropagator.js`
  - Implement variable unification
  - Implement constraint pushing to correct arguments
  - Implement duplicate filter merging
  - Implement optional type checking (domain/range)

- [ ] **3.11**: Unit test constraint propagator
  - Test variable unification
  - Test duplicate constraint merging
  - Test constraint simplification
  - Verify LogicalSkeleton schema compliance

- [ ] **3.12**: Integration test Phase 3 end-to-end
  - Test 200 questions with real semantic mapping
  - Include: simple, complex, temporal, comparative queries
  - Use real ontology, real semantic search, real Qdrant
  - NO MOCKS
  - Validate LogicalSkeleton and AmbiguityReport schemas
  - FAIL FAST on mapping errors

- [ ] **3.13**: Create Phase 3 golden test suite
  - Create test cases in `__tests__/golden/phase3/`
  - Include expected LogicalSkeletons
  - Include expected AmbiguityReports
  - Cover all 15 tree walker rules
  - Test ambiguity handling edge cases

**Deliverable**: Complete semantic mapping system producing LogicalSkeleton + AmbiguityReport

---

## Phase 4: Query Generation (DataScript Format)

### Purpose
Convert LogicalSkeleton to generic DataScript query format, then integrate with DataSource adapters for backend execution.

**Key Insight**: We do NOT emit backend-specific queries! We convert to DataScript format and let DataSource adapters handle backend translation.

### Steps

- [ ] **4.1**: Read DESIGN.md Section "Phase 4: Query Generation (DataSource Integration)"

- [ ] **4.2**: Create DataScript converter
  - Create `src/phase4/DataScriptConverter.js`
  - Implement convert(logicalSkeleton) → dataScriptQuery
  - Implement 7 conversion rules from DESIGN.md:
    - Rule 1: Project → Find clause
    - Rule 2: ISA atoms → Type triples
    - Rule 3: REL atoms → Property triples
    - Rule 4: HAS atoms → Attribute triples
    - Rule 5: FILTER atoms → Predicate functions
    - Rule 6: Aggregations (COUNT, MAX, etc.)
    - Rule 7: Operations → Complex expressions

- [ ] **4.3**: Unit test DataScript converter
  - Test isa atom → `['?x', ':type', ':Country']`
  - Test rel atom → `['?x', ':borders', ':Germany']`
  - Test has atom → `['?entity', ':revenue', '?v']`
  - Test filter atom → predicate function conversion
  - Test COUNT projection → `['(count ?x)']`
  - Test complete conversions with all atom types
  - Verify output is valid DataScript format

- [ ] **4.4**: Create DataSource adapter
  - Create `src/phase4/DataSourceAdapter.js`
  - Accept ResourceManager in constructor
  - Implement getDataSource(sourceName) from ResourceManager
  - Implement executeQuery(dataScriptQuery, dataSource)
  - Handle query result formatting

- [ ] **4.5**: Unit test DataSource adapter
  - Mock ResourceManager for unit tests
  - Mock DataSource implementations
  - Test query routing to correct DataSource
  - Test result handling and formatting
  - Test error propagation (FAIL FAST)

- [ ] **4.6**: Integration test with DataStoreDataSource
  - Use real DataStoreDataSource from `@legion/data-store`
  - Test 50 DataScript queries through DataStore
  - Include: simple, joins, filters, aggregations
  - NO MOCKS for DataSource
  - Verify queries execute successfully
  - Verify results are correctly formatted

- [ ] **4.7**: Integration test with TripleStoreDataSource (optional)
  - If RDF triplestore available, use TripleStoreDataSource
  - Test 30 DataScript queries that translate to SPARQL
  - Verify backend translation works
  - NO MOCKS for DataSource
  - This validates the architecture supports SPARQL via DataSource

- [ ] **4.8**: Create Phase 4 test suite
  - Create test cases in `__tests__/phase4/`
  - Test 100 LogicalSkeleton → DataScript conversions
  - Test all conversion rules
  - Test edge cases (empty filters, complex aggregations)
  - Validate all outputs are valid DataScript format

**Deliverable**: Working DataScript converter + DataSource integration

**Benefits**:
- ✅ No backend-specific emitters to build
- ✅ Leverages existing DataSource infrastructure
- ✅ Completely pluggable - any DataSource works
- ✅ SPARQL/Cypher/MongoDB supported via DataSource adapters

---

## Phase 5: Pipeline Integration

### Purpose
Integrate all 4 phases into complete pipeline with comprehensive testing.

### Steps

- [ ] **5.1**: Read DESIGN.md Section "Integration Points" and "Pipeline Usage"

- [ ] **5.2**: Complete pipeline implementation
  - Update `src/QueryUnderstandingPipeline.js`
  - Wire Phase 1 → Phase 2 → Phase 3 → Phase 4
  - Add artifact logging at each phase (JSON files)
  - Add schema validation between phases
  - Add error propagation (FAIL FAST)

- [ ] **5.3**: Unit test pipeline integration
  - Test phase transitions (output → input)
  - Test schema validation between phases
  - Test error handling (fail at each phase)
  - Mock individual phases for unit testing

- [ ] **5.4**: Integration test complete pipeline
  - Test 50 questions through all phases
  - Use real LLM, real semantic search, real DataSource
  - NO MOCKS
  - Verify DataScript query output
  - Verify query execution through DataStoreDataSource
  - Validate all intermediate artifacts

- [ ] **5.5**: End-to-end test suite
  - Create `__tests__/e2e/` directory
  - Test 100 questions end-to-end
  - Execute generated DataScript queries via DataStoreDataSource
  - Verify results match expected entities
  - Test ambiguity reporting
  - Performance: < 5 seconds per question

- [ ] **5.6**: Create full golden test suite
  - Create 300 curated questions in `__tests__/golden/`
  - Finance: 100 questions
  - Geography: 100 questions
  - Biography: 50 questions
  - General: 50 questions
  - For each: expected output at all 4 phases (including DataScript query)
  - Test all linguistic constructs
  - Test DataStoreDataSource execution

**Deliverable**: Fully integrated pipeline with 100% passing tests

---

## Phase 6: Example Ontologies & Validation

### Purpose
Create sample ontologies for testing and validate system across domains.

### Steps

- [ ] **6.1**: Read DESIGN.md Section "Examples" and "Testing Strategy"

- [ ] **6.2**: Create geography ontology
  - Create `examples/ontologies/geography.ttl` (RDF/Turtle)
  - Define classes: Country, City, River, Mountain
  - Define properties: borders, capital, population, locatedIn
  - Define individuals: Germany, France, USA, Paris, Rhine
  - Index into semantic search

- [ ] **6.3**: Create finance ontology
  - Create `examples/ontologies/finance.ttl`
  - Define classes: Company, Financial Statement, Metric
  - Define properties: revenue, netCash, operatingActivities
  - Define measures and temporal properties
  - Index into semantic search

- [ ] **6.4**: Create biography ontology
  - Create `examples/ontologies/biography.ttl`
  - Define classes: Person, Event, Place
  - Define properties: born, died, livesIn, marriedTo
  - Define individuals: Ada Lovelace, Alan Turing
  - Index into semantic search

- [ ] **6.5**: Test geography domain
  - Run 100 geography questions through pipeline
  - Verify correct semantic mappings
  - Verify correct DataScript query generation
  - Execute queries via DataStoreDataSource
  - All tests must pass - no skips

- [ ] **6.6**: Test finance domain
  - Run 100 finance questions through pipeline
  - Test complex queries (ratios, percent change, trends)
  - Verify temporal handling and operations
  - Execute queries via DataStoreDataSource
  - All tests must pass - no skips

- [ ] **6.7**: Test biography domain
  - Run 50 biography questions through pipeline
  - Test relationship queries and temporal facts
  - Execute queries via DataStoreDataSource
  - All tests must pass - no skips

- [ ] **6.8**: Cross-domain validation
  - Test questions spanning multiple domains
  - Verify ontology isolation and context handling
  - All tests must pass - no skips

**Deliverable**: Working system validated across 3 domains with sample ontologies

---

## Phase 7: Final Validation & Documentation

### Purpose
Comprehensive validation and working examples.

### Steps

- [ ] **7.1**: Read entire DESIGN.md for final review

- [ ] **7.2**: Run complete test suite
  - All unit tests (100% pass rate)
  - All integration tests (100% pass rate)
  - All end-to-end tests (100% pass rate)
  - All golden tests (100% pass rate)
  - Total: 800+ tests passing
  - NO SKIPPED TESTS
  - NO FALLBACKS

- [ ] **7.3**: Create usage examples
  - Create `examples/basic-usage.js`
  - Create `examples/ambiguity-handling.js`
  - Create `examples/datascript-queries.js`
  - Create `examples/custom-ontology.js`
  - Create `examples/datasource-integration.js`
  - All examples must run successfully

- [ ] **7.4**: Validate error handling
  - Test missing LLM → FAIL with clear error
  - Test missing semantic search → FAIL with clear error
  - Test invalid input → FAIL with schema validation error
  - Test unmapped tokens → report in AmbiguityReport
  - NO FALLBACKS - explicit errors only

- [ ] **7.5**: Performance validation
  - Test 100 questions < 5 seconds each
  - Profile Phase 1 (LLM) timing
  - Profile Phase 3 (semantic search) timing
  - Verify linear scaling O(n)

- [ ] **7.6**: Create README.md
  - Package overview
  - Installation instructions
  - Basic usage examples
  - API documentation
  - Link to DESIGN.md

**Deliverable**: Production-ready MVP with complete documentation

---

## Completion Criteria

### Phase Completion Checklist

- [ ] **Phase 0**: Foundation & Schemas
- [ ] **Phase 1**: Rewrite & Resolve (LLM)
- [ ] **Phase 2**: NP/VP AST Parser
- [ ] **Phase 3**: Semantic Mapping & Constraints
- [ ] **Phase 4**: Query Generation
- [ ] **Phase 5**: Pipeline Integration
- [ ] **Phase 6**: Example Ontologies & Validation
- [ ] **Phase 7**: Final Validation & Documentation

### Success Metrics

- ✅ 100% test pass rate (no skips, no fallbacks)
- ✅ All schemas validated with `@legion/schema`
- ✅ Integration tests use real services (LLM, MongoDB, Qdrant, DataSources)
- ✅ 300 golden test cases passing
- ✅ DataScript query generation working
- ✅ DataStoreDataSource integration working
- ✅ TripleStoreDataSource integration tested (validates SPARQL backend support)
- ✅ Ambiguity reporting functional
- ✅ Performance < 5 seconds per question
- ✅ FAIL FAST error handling
- ✅ Working examples for 3 domains

---

## Notes for Implementers

1. **Read DESIGN.md at each phase** - All implementation details are there
2. **No mocks in integration tests** - Use real ResourceManager services
3. **No fallbacks** - Explicit errors only, FAIL FAST
4. **Schema validation always** - Use `@legion/schema` at phase boundaries
5. **Test before proceeding** - Don't move to next step until tests pass
6. **80/20 rule** - Build core first, elaborate later
7. **Demonstrable value** - Each phase should work end-to-end for its scope

---

**IMPORTANT**: This is an MVP focused on functional correctness and capabilities only. No NFRs (security, performance optimization, migration strategies, deployment, publishing) are in scope. All testing is local with real services from .env and docker-compose.
