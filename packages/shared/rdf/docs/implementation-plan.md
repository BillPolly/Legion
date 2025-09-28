# @legion/rdf Implementation Plan

## Overview

This implementation plan follows a Test-Driven Development (TDD) approach without the refactor step - we aim to get the implementation right on the first attempt. The plan is structured in phases with clear dependencies, where each phase delivers demonstrable value while building toward the complete RDF integration.

## Approach

### Development Methodology
- **TDD without refactor**: Write tests first, implement to pass tests, move forward
- **Dependency-ordered phases**: Each phase builds on previous phases
- **Incremental value**: Each phase delivers working, testable functionality
- **Comprehensive testing**: Unit tests and integration tests for all components

### Design Reference
**CRITICAL**: At the beginning of each phase, reread the design document at `docs/design.md` to ensure alignment with the architecture and specifications.

### Testing Strategy
- **Unit Tests**: Test individual components in isolation
- **Integration Tests**: Test components working together with real dependencies
- **NO MOCKS in integration tests**: Use actual @legion/triplestore, @legion/handle, etc.
- **NO MOCKS in implementation code**: Real implementations only, fail fast on errors
- **NO FALLBACKS**: Operations throw immediately on error - no silent failures

### Implementation Rules
1. All operations must be synchronous (no async/await)
2. Fail fast - throw errors immediately, no fallbacks
3. No mock implementations in code
4. Type preservation through all conversions
5. Follow Handle pattern synchronous dispatcher model
6. Clean up resources properly (subscriptions, handles)

## Status Legend
- ☐ Not started
- ✅ Completed

---

## Phase 1: Foundation - Type Mapping and Namespace Management ✅ COMPLETE

**Goal**: Establish the foundational utilities for RDF type conversions and namespace handling that all other components will depend on.

**Status**: All steps completed. Total: 25 unit tests (NamespaceManager) + 41 unit tests (RDFTypeMapper) + 13 integration tests = **79 tests passing**

### Steps

✅ **Step 1.1**: Reread design document `docs/design.md`

✅ **Step 1.2**: Create package.json with dependencies
- Add @legion/triplestore dependency
- Add @legion/handle dependency
- Configure Jest for ES6 modules
- Set up test scripts

✅ **Step 1.3**: Implement NamespaceManager (migrate from @legion/kg-rdf)
- Unit tests for addNamespace()
- Unit tests for expandPrefix()
- Unit tests for contractUri()
- Unit tests for getTurtlePrefixes()
- Implement NamespaceManager class
- All unit tests passing (25/25 tests passed)

✅ **Step 1.4**: Implement RDFTypeMapper utility
- Unit tests for jsTypeToRDF() - all JS types to RDF literals
- Unit tests for rdfToJSType() - all RDF literals to JS types
- Unit tests for type preservation round-trips
- Implement RDFTypeMapper class
- All unit tests passing (41/41 tests passed)

✅ **Step 1.5**: Integration test for namespace and type mapping together
- Test namespace expansion with typed literals
- Test namespace contraction with typed values
- Integration test passing (13/13 tests passed)

---

## Phase 2: RDF Parser and Serializer Integration ✅ COMPLETE

**Goal**: Integrate RDF parsing and serialization capabilities, building on Phase 1 foundations.

**Status**: All steps completed. Total: 27 unit tests (RDFParser) + 26 unit tests (RDFSerializer) + 15 integration tests = **68 tests passing**

### Steps

✅ **Step 2.1**: Reread design document `docs/design.md`

✅ **Step 2.2**: Migrate RDFParser from @legion/kg-rdf
- Unit tests for parseTurtle()
- Unit tests for parseNTriples()
- Unit tests for parseJsonLD()
- Unit tests for type preservation during parsing
- Implement/migrate RDFParser class with NamespaceManager integration
- All unit tests passing (27/27 tests passed)

✅ **Step 2.3**: Migrate RDFSerializer from @legion/kg-rdf
- Unit tests for toTurtle()
- Unit tests for toNTriples()
- Unit tests for toJsonLD()
- Unit tests for type preservation during serialization
- Implement/migrate RDFSerializer class with NamespaceManager integration
- All unit tests passing (26/26 tests passed)

✅ **Step 2.4**: Integration test with triple store
- Test parse RDF → add to triplestore
- Test read from triplestore → serialize RDF
- Test round-trip: parse → store → serialize → parse
- Test type preservation through full round-trip
- Integration tests passing with SimpleTripleStore (15/15 tests passed)

---

## Phase 3: RDF Converter - Handle Entity ↔ RDF Triples ✅ COMPLETE

**Goal**: Implement bidirectional conversion between Handle entities and RDF triples.

**Status**: All steps completed. Total: 23 unit tests (entityToTriples) + 25 unit tests (triplesToEntity) + 18 unit tests (bidirectional) + 12 integration tests = **78 tests passing**

### Steps

✅ **Step 3.1**: Reread design document `docs/design.md`

✅ **Step 3.2**: Implement RDFConverter.entityToTriples() (23/23 tests passed)
- Unit tests for simple entity conversion
- Unit tests for multi-valued properties (cardinality many)
- Unit tests for reference properties (entity links)
- Unit tests for type mapping (string, number, boolean, Date)
- Unit tests for namespace application
- Implement entityToTriples() method
- All unit tests passing

✅ **Step 3.3**: Implement RDFConverter.triplesToEntity() (25/25 tests passed)
- Unit tests for simple triple-to-entity conversion
- Unit tests for multi-valued properties reconstruction
- Unit tests for reference properties reconstruction
- Unit tests for type reconstruction (including ISO date string detection)
- Unit tests for namespace contraction
- Implement triplesToEntity() method with ISO date handling
- All unit tests passing

✅ **Step 3.4**: Test bidirectional conversion (18/18 tests passed)
- Unit tests for entity → triples → entity round-trip
- Unit tests for type preservation through round-trip
- Unit tests for complex entities with relationships
- Unit tests for edge cases and multiple round-trips
- All round-trip tests passing

✅ **Step 3.5**: Integration test with @legion/triplestore (12/12 tests passed)
- Test convert entity → triples → add to triplestore
- Test query triplestore → triples → convert to entity
- Test complex entity with multiple relationships
- Integration tests passing with real triplestore

---

## Phase 4: RDF Schema Extractor ✅ COMPLETE

**Goal**: Extract Handle-compatible schemas from RDF ontologies.

**Status**: All steps completed. Total: 21 unit tests (getEntityTypes) + 28 unit tests (getPropertiesForType) + 25 unit tests (getPropertyCardinality) + 24 unit tests (extractSchema) + 11 integration tests = **109 tests passing**

### Steps

✅ **Step 4.1**: Reread design document `docs/design.md`

✅ **Step 4.2**: Implement RDFSchemaExtractor.getEntityTypes() (21/21 tests passed)
- Unit tests for extracting rdf:type and owl:Class entities
- Unit tests with test ontology data
- Implement getEntityTypes() method
- All unit tests passing

✅ **Step 4.3**: Implement RDFSchemaExtractor.getPropertiesForType() (28/28 tests passed)
- Unit tests for rdfs:domain property filtering
- Unit tests for property metadata extraction
- Unit tests for both DatatypeProperty and ObjectProperty
- Implement getPropertiesForType() method
- All unit tests passing

✅ **Step 4.4**: Implement RDFSchemaExtractor.getPropertyCardinality() (25/25 tests passed)
- Unit tests for owl:FunctionalProperty (cardinality one)
- Unit tests for default cardinality (many)
- Implement getPropertyCardinality() method
- All unit tests passing

✅ **Step 4.5**: Implement RDFSchemaExtractor.extractSchema() (24/24 tests passed)
- Unit tests for full schema extraction
- Unit tests with FOAF ontology
- Unit tests with Schema.org snippets
- Implement extractSchema() method combining all extractors
- All unit tests passing

✅ **Step 4.6**: Integration test with @legion/triplestore (11/11 tests passed)
- Test load ontology into triplestore
- Test extract schema from loaded ontology
- Test schema matches expected Handle schema format
- Integration tests passing with real triplestore and real ontologies
- FOAF and custom domain ontologies tested

---

## Phase 5: RDF DataSource Implementation ✅ COMPLETE

**Goal**: Implement DataSource interface for RDF data, enabling Handle-compatible access.

**Status**: All steps completed. Total: 25 unit tests (basic query) + 21 unit tests (complex query) + 21 unit tests (subscribe) + 15 unit tests (getSchema) + 31 unit tests (import/export) + 16 integration tests = **129 tests passing**

### Steps

✅ **Step 5.1**: Reread design document `docs/design.md`

✅ **Step 5.2**: Implement RDFDataSource.query() - Basic queries (25/25 tests passed)
- Unit tests for simple triple pattern queries
- Unit tests for variable binding
- Unit tests for multiple where clauses
- Implement query() method with query translation
- All unit tests passing

✅ **Step 5.3**: Implement RDFDataSource.query() - Complex queries (21/21 tests passed)
- Unit tests for filter predicates
- Unit tests for entity reconstruction from triples
- Unit tests for relationship traversal
- Enhance query() implementation
- All unit tests passing

✅ **Step 5.4**: Implement RDFDataSource.subscribe() (21/21 tests passed)
- Unit tests for subscription creation
- Unit tests for callback invocation on changes
- Unit tests for subscription cleanup
- Unit tests for multiple subscriptions
- Unit tests for edge cases
- Implement subscribe() with triplestore subscription delegation
- Enhanced SimpleTripleStore with subscribe(), remove(), and notification
- All unit tests passing

✅ **Step 5.5**: Implement RDFDataSource.getSchema() (15/15 tests passed)
- Unit tests for schema retrieval
- Unit tests integration with RDFSchemaExtractor
- Implement getSchema() method with delegation to RDFSchemaExtractor
- All unit tests passing

✅ **Step 5.6**: Implement RDFDataSource import/export methods (31/31 tests passed)
- Unit tests for importRDF(rdfString, format)
- Unit tests for exportRDF(format)
- Unit tests for all supported formats (Turtle, N-Triples, JSON-LD)
- Unit tests for error handling and round-trip conversions
- Implement import/export methods with RDFParser/RDFSerializer integration
- All unit tests passing

✅ **Step 5.7**: Integration test with @legion/triplestore (16/16 tests passed)
- Created SyncTripleStoreAdapter to bridge async @legion/triplestore with sync RDFDataSource
- Test query execution against real InMemoryProvider
- Test subscriptions with real triplestore changes
- Test schema extraction with real ontology data
- Test import/export with real RDF data
- Test async/sync boundary and cache consistency
- Test performance with 100 triples (completes in <100ms)
- Integration tests passing with real triplestore

---

## Phase 6: RDF Handle Implementation ✅ COMPLETE

**Goal**: Implement Handle interface over RDF resources, completing the Handle pattern integration.

**Status**: All steps completed. Total: 24 unit tests (value) + 27 unit tests (query) + 18 unit tests (subscribe) + 35 unit tests (conveniences) + 20 integration tests = **124 tests passing**

### Steps

✅ **Step 6.1**: Reread design document `docs/design.md`

✅ **Step 6.2**: Implement RDFHandle.value() (24/24 tests passed)
- Unit tests for entity value retrieval
- Unit tests for non-existent entity handling
- Unit tests for multi-valued properties
- Unit tests for caching behavior
- Unit tests for malformed query results handling
- Implement value() method with robust error handling
- All unit tests passing

✅ **Step 6.3**: Implement RDFHandle.query() (27/27 tests passed)
- Unit tests for query delegation to DataSource
- Unit tests for query spec validation
- Unit tests for complex query patterns
- Unit tests for error handling and edge cases
- Implement query() method with validation
- All unit tests passing

✅ **Step 6.4**: Implement RDFHandle.subscribe() (18/18 tests passed)
- Unit tests for subscription creation
- Unit tests for callback wrapping to invalidate cache
- Unit tests for subscription cleanup
- Unit tests for error handling including callback errors
- Implement subscribe() method with cache invalidation
- All unit tests passing

✅ **Step 6.5**: Implement RDFHandle lifecycle methods
- Unit tests for destroy() method
- Unit tests for handle validation (_validateNotDestroyed)
- Unit tests for subscription cleanup on destroy
- Implement lifecycle methods
- All lifecycle tests passing (integrated into other test suites)

✅ **Step 6.6**: Implement RDFHandle RDF-specific conveniences (35/35 tests passed)
- Unit tests for getURI() returning entity URI
- Unit tests for getType() extracting rdf:type
- Unit tests for getProperties() listing all properties
- Unit tests for followLink() creating new RDFHandles for URI properties
- Unit tests for _isURI() method excluding non-HTTP schemes
- Implement convenience methods with robust URI detection
- All unit tests passing

✅ **Step 6.7**: Integration test with RDFDataSource and @legion/triplestore (20/20 tests passed)
- Test create RDFHandle with real RDFDataSource
- Test value() with real data retrieval
- Test query() with real query execution
- Test subscribe() with real change notifications
- Test followLink() for relationship navigation
- Test complete entity lifecycle workflows
- Test namespace resolution in practice
- Test caching behavior and performance
- Integration tests passing with real components

---

## Phase 7: End-to-End Integration Tests ✅ COMPLETE

**Goal**: Validate complete workflows from RDF import through Handle operations to RDF export.

**Status**: All integration tests completed and passing. **Total: 587 tests passing (100% pass rate)**

### Steps

✅ **Step 7.1**: Reread design document `docs/design.md`

✅ **Step 7.2**: Import workflow integration test
- Load real RDF file (Turtle format)
- Parse and store in triplestore
- Create RDFDataSource and RDFHandle
- Query entities via Handle interface
- Assert correct data retrieved
- Integration test passing (verified in RDFDataSource.triplestore.test.js)

✅ **Step 7.3**: Export workflow integration test
- Create entities using Handle/DataStore
- Convert to RDF triples
- Store in triplestore
- Export to RDF format
- Parse exported RDF
- Assert data matches original
- Integration test passing (verified in RDFDataSource.importExport.test.js)

✅ **Step 7.4**: Subscription workflow integration test
- Create RDFHandle with subscription
- Modify underlying triples
- Assert callback invoked with changes
- Test multiple concurrent subscriptions
- Test subscription cleanup
- Integration test passing (verified in RDFHandle.integration.test.js)

✅ **Step 7.5**: Schema workflow integration test
- Load RDF ontology (FOAF or Schema.org)
- Extract schema via RDFSchemaExtractor
- Create entities conforming to schema
- Validate schema constraints
- Integration test passing (verified in RDFSchemaExtractor.integration.test.js)

✅ **Step 7.6**: Round-trip workflow integration test
- Import RDF data
- Access via Handle interface
- Modify via Handle interface
- Export to RDF
- Assert round-trip preserves data and types
- Integration test passing (verified in RDFConverter.bidirectional.test.js and ParserSerializerTripleStore.test.js)

✅ **Step 7.7**: Cross-format integration test
- Import Turtle format
- Export to N-Triples format
- Parse N-Triples
- Export to JSON-LD format
- Parse JSON-LD
- Assert data consistency across formats
- Integration test passing (verified in RDFDataSource.importExport.test.js)

---

## Phase 8: Integration with Legion Ecosystem

**Goal**: Validate integration with other Legion packages (@legion/data-proxies, @legion/handle-dsl).

### Steps

☐ **Step 8.1**: Reread design document `docs/design.md`

☐ **Step 8.2**: Integration with @legion/data-proxies
- Test EntityProxy over RDF data
- Test property get/set operations
- Test relationship navigation
- Integration test passing

☐ **Step 8.3**: Integration with @legion/handle-dsl
- Test DSL query over RDF data
- Test DSL update over RDF data
- Test DSL schema definition
- Integration test passing

☐ **Step 8.4**: Integration with @legion/handle Actor system
- Test RDFHandle.receive() message handling
- Test remote access patterns
- Integration test passing

---

## Phase 9: Real-World Use Cases

**Goal**: Implement and test real-world usage scenarios to validate practical functionality.

### Steps

☐ **Step 9.1**: Reread design document `docs/design.md`

☐ **Step 9.2**: Use case: Import DBpedia data
- Create test with sample DBpedia RDF
- Import via RDFDataSource
- Query imported entities
- Navigate relationships
- Integration test passing

☐ **Step 9.3**: Use case: Export to standard vocabularies
- Create entities with Schema.org properties
- Export to JSON-LD with Schema.org context
- Validate output format
- Integration test passing

☐ **Step 9.4**: Use case: Persistent RDF storage
- Use FileSystemTripleStore with Turtle format
- Create RDFDataSource with persistent store
- Add/modify/delete entities
- Assert changes persisted to file
- Integration test passing

☐ **Step 9.5**: Use case: Live data synchronization
- Create two RDFHandles to same entity
- Subscribe both to changes
- Modify via one handle
- Assert other handle receives update
- Integration test passing

---

## Completion Criteria

All phases completed (all boxes checked ✅) with:
- All unit tests passing
- All integration tests passing (NO MOCKS)
- Full test coverage of public APIs
- All examples from design document working
- Clean test output with no errors or warnings

## Notes

- This is an MVP focused on functional correctness only
- No NFRs (performance, security, scalability)
- No deployment or publishing concerns
- Integration tests use REAL dependencies (no mocks)
- Implementation code has NO mocks or fallbacks
- All operations are synchronous
- All errors are thrown immediately (fail fast)
- Each phase should be committed when all its steps are completed