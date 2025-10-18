# Semantic Inventory - TDD Implementation Plan

## Overview

This plan implements the `@legion/semantic-inventory` package using Test-Driven Development (TDD) without refactoring - we aim to get it right the first time. The implementation creates 4 Qdrant collections with full WordNet coverage (~200K vectors) to support DRS semantic analysis.

## Approach

**TDD Process:**
1. Write failing test for specific functionality
2. Implement minimum code to make test pass
3. Verify test passes
4. Move to next test (NO refactoring phase - design it right first time)

**CRITICAL - Controlled Indexing Strategy:**
1. **ALL development/testing uses SMALL curated test sets** (~50-100 synsets per collection)
2. **NO full indexing during development** - tests NEVER index all 200K vectors
3. **Full indexing happens ONCE** - controlled script run at the very end (Phase 9)
4. **After full indexing** - run verification tests to confirm correctness
5. **NO re-indexing** - get it right once, verify thoroughly

**Dependency Order:**
- Build core categorization logic first (unit tested with samples)
- Build indexing infrastructure (integration tested with SMALL test sets)
- Build query API (integration tested with small test data)
- Verify end-to-end with DRS integration tests (small data)
- Full indexing ONCE - controlled process
- Final verification with full data

## Rules

### Testing Rules
- ✅ **Unit tests:** May use mocks for external dependencies
- ❌ **Integration tests:** NO MOCKS for main functionality (only for peripheral things)
- ❌ **Integration tests:** NEVER index full data - use test-synsets/ only
- ❌ **Implementation code:** NO MOCKS EVER
- ❌ **Tests:** NO FALLBACKS - FAIL FAST
- ❌ **Tests:** NO SKIPPING - all resources available in .env

### Available Resources
- Real LLM API keys in .env
- MongoDB running locally (configured)
- Qdrant running locally (configured)
- Real semantic search with embeddings
- All Legion packages available

### Design Reference
- Read DESIGN.md at the start of each phase
- Refer to DESIGN.md for implementation details
- Follow architecture and patterns in DESIGN.md

## Implementation Phases

### Phase 1: Core Infrastructure - Entity Type Categorization (SMALL TEST SET)
**Goal:** Get entity type categorization working with SMALL test collection

**Value:** Demonstrates core mechanism works correctly before full indexing

**CRITICAL:** ALL testing uses data/test-synsets/ directory with ~50 carefully selected nouns

- [✅] **Step 1.1:** Read DESIGN.md sections: Overview, Architecture, wordnet_entity_types Collection
- [✅] **Step 1.2:** Create package structure (src/, data/, scripts/, __tests__/)
- [✅] **Step 1.3:** Set up package.json with dependencies (@legion/resource-manager, mongodb)
- [✅] **Step 1.4:** TDD - Write unit test for EntityTypeCategorizer.categorizeEntityType() with simple lexicalFile cases
- [✅] **Step 1.5:** Implement EntityTypeCategorizer.categorizeEntityType() using lexicalFile analysis
- [✅] **Step 1.6:** TDD - Write unit tests for all entity type categories (PERSON, LOCATION, ORGANIZATION, etc.)
- [✅] **Step 1.7:** Extend categorizeEntityType() to handle all categories with THING fallback
- [✅] **Step 1.8:** Create data/entity-type-roots.json with root synsets per DESIGN.md
- [✅] **Step 1.9:** Create data/test-synsets/entity-types.json with 50 nouns (5 per category) manually selected
- [✅] **Step 1.10:** TDD - Write integration test using ONLY test-synsets/entity-types.json (~50 nouns)
- [✅] **Step 1.11:** Implement SemanticInventoryIndexer with indexEntityTypes(options) - support testMode and collectionPrefix
- [✅] **Step 1.12:** Add testMode option to load from test-synsets/ instead of MongoDB query
- [✅] **Step 1.13:** Verify test indexes exactly 50 nouns with correct categorization to test_wordnet_entity_types
- [✅] **Step 1.14:** Add collectionPrefix option to use test_ prefix (avoids polluting production collections)
- [✅] **Step 1.15:** Update getStats() to support collectionPrefix option
- [✅] **Step 1.16:** Run unit tests - verify 100% pass rate (12/12 passed)
- [✅] **Step 1.17:** Run integration tests - verify 100% pass rate with small test data (5/5 passed)

### Phase 2: Semantic Roles Collection (SMALL TEST SET)
**Goal:** Add predefined semantic roles collection with small data

**Value:** Completes second collection, demonstrates non-WordNet data indexing

**CRITICAL:** Uses data/test-synsets/semantic-roles.json with ~10 roles

- [✅] **Step 2.1:** Read DESIGN.md sections: wordnet_roles Collection, data/semantic-roles.json
- [✅] **Step 2.2:** Create data/test-synsets/semantic-roles.json with 10 role definitions (Agent, Theme, Patient, Recipient, Experiencer, Instrument, Location, Source, Goal, Time)
- [✅] **Step 2.3:** TDD - Write integration test for indexRoles() using test data (~10 roles)
- [✅] **Step 2.4:** Implement SemanticInventoryIndexer.indexRoles(options) - support testMode and collectionPrefix
- [✅] **Step 2.5:** Add role loading logic (loads from test-synsets/ in testMode, from data/ in production)
- [✅] **Step 2.6:** Add _buildRoleSearchText() helper method for role indexing
- [✅] **Step 2.7:** Verify test_wordnet_roles collection has exactly 10 test points
- [✅] **Step 2.8:** TDD - Write integration tests for querying roles with test data
- [✅] **Step 2.9:** Test role querying with semantic search
- [✅] **Step 2.10:** Verify role structure (label, definition, examples, roleType)
- [✅] **Step 2.11:** Run integration tests - verify 100% pass rate (8/8 tests passed)

### Phase 3: Predicates Collection (SMALL TEST SET) ✅ COMPLETE
**Goal:** Index predicates with small test data

**Value:** Tests multi-POS indexing without full data overhead

**CRITICAL:** Uses data/test-synsets/predicates.json with ~60 items (20 adj, 20 nouns, 20 verbs)

- [✅] **Step 3.1:** Read DESIGN.md sections: wordnet_predicates Collection
- [✅] **Step 3.2:** Create data/test-synsets/predicates.json with 60 synsets (20 per POS)
- [✅] **Step 3.3:** TDD - Write integration test for indexPredicates() using test data (~60 synsets)
- [✅] **Step 3.4:** Implement indexPredicates(options) with testMode - load from test file
- [✅] **Step 3.5:** Verify wordnet_predicates has exactly 60 test points
- [✅] **Step 3.6:** TDD - Write integration test for querying predicates with test data
- [✅] **Step 3.7:** Tests restructured into data-preparation.test.js and semantic-queries.test.js
- [✅] **Step 3.8:** Run integration test - verify predicates returned correctly
- [✅] **Step 3.9:** Verify 100% test pass rate before proceeding (35/35 passing, 0.928s)

### Phase 4: Relations Collection (SMALL TEST SET) ✅ COMPLETE
**Goal:** Index adverbs as binary relations with small test data

**Value:** Completes all 4 collections with small data, proves architecture

**CRITICAL:** Uses data/test-synsets/relations.json with ~30 adverbs

- [✅] **Step 4.1:** Read DESIGN.md sections: wordnet_relations Collection, Relation Type Categorization
- [✅] **Step 4.2:** Create data/test-synsets/relations.json with 30 adverbs (10 spatial, 10 temporal, 10 logical)
- [✅] **Step 4.3:** TDD - Write unit test for RelationCategorizer.categorizeRelationType() with test data
- [✅] **Step 4.4:** Implement RelationCategorizer.categorizeRelationType() (spatial, temporal, logical)
- [✅] **Step 4.5:** TDD - Write integration test for indexRelations() using test data (~30 adverbs)
- [✅] **Step 4.6:** Implement SemanticInventoryIndexer.indexRelations(options) with testMode
- [✅] **Step 4.7:** Verify wordnet_relations collection has exactly 30 test points
- [✅] **Step 4.8:** TDD - Write integration test for querying relations with test data
- [✅] **Step 4.9:** Integration tests verify all relation types (spatial, temporal, logical)
- [✅] **Step 4.10:** All semantic query tests passing with test data
- [✅] **Step 4.11:** Verify 100% test pass rate before proceeding (35/35 passing)

**BONUS IMPROVEMENTS:**
- [✅] Parallel embedding generation (10x speedup - 50 items in 456ms vs 10s+)
- [✅] Test data reuse architecture (100x speedup - subsequent runs skip indexing)
- [✅] ResourceManager auto-starts Qdrant containers
- [✅] Proper test cleanup and separation of concerns

### Phase 5: Service Integration (SMALL TEST SET) ✅ COMPLETE
**Goal:** Create complete workflow with small test data

**Value:** Demonstrates full system working end-to-end before full indexing

**CRITICAL:** Uses all test-synsets/ data, verifies complete workflow

- [✅] **Step 5.1:** Read DESIGN.md sections: Indexing Process, Coverage Summary
- [✅] **Step 5.2:** Implemented getStats() to return all 4 collection counts
- [✅] **Step 5.3:** Implement SemanticInventoryIndexer.indexAll(options) - orchestrates all 4 collections
- [✅] **Step 5.4:** Added test for getStats() in data-preparation.test.js - verifies 150 total vectors
- [✅] **Step 5.5:** Created SemanticInventoryService with semanticSearchEntityTypes() and semanticSearchRelationTypes()
- [✅] **Step 5.6:** Created service.test.js with complete E2E workflow tests (15 tests covering all API methods)
- [✅] **Step 5.7:** Created src/index.js to export SemanticInventoryService and SemanticInventoryIndexer
- [✅] **Step 5.8:** Service can be imported via @legion/semantic-inventory
- [✅] **Step 5.9:** Verified 100% test pass rate (51/51 tests passing in 1.774s)

### Phase 6: Enhanced Categorization (TESTED WITH SMALL DATA) ✅ COMPLETE
**Goal:** Improve categorization quality

**Value:** Better categorization quality for edge cases

**CRITICAL:** All testing uses existing test-synsets/ data

- [✅] **Step 6.1:** Read DESIGN.md sections: Categorization Logic, Entity Type Categorization
- [✅] **Step 6.2:** Implemented definition keyword analysis (11 new unit tests)
- [✅] **Step 6.3:** Extended EntityTypeCategorizer with keyword-based categorization
- [✅] **Step 6.4:** Added definitionKeywords mapping for all entity type categories
- [✅] **Step 6.5:** Keyword fallback now catches edge cases (PERSON, LOCATION, ORGANIZATION, etc.)
- [✅] **Step 6.6:** Keywords include: person, human, individual, place, location, company, organization, event, time, etc.
- [✅] **Step 6.7:** Lexical file analysis still has priority over keyword analysis
- [✅] **Step 6.8:** Verified 100% test pass rate (62/62 tests passing in 1.678s)

### Phase 7: End-to-End DRS Integration Testing (SMALL DATA)
**Goal:** Verify semantic inventory works correctly with DRS pipeline using test data

**Value:** Proves the package fulfills its purpose before full indexing

**CRITICAL:** All E2E tests use test-synsets/ data only

- [ ] **Step 7.1:** Read DESIGN.md sections: Integration with DRS, API Specification
- [ ] **Step 7.2:** TDD - Write E2E test for DRS Stage 1 (Mention Extraction) using small semantic inventory
- [ ] **Step 7.3:** Verify semanticSearchEntityTypes() provides correct entity types for DRS with test data
- [ ] **Step 7.4:** TDD - Write E2E test for DRS Stage 3 (Event & Relation Extraction) using test data
- [ ] **Step 7.5:** Verify semanticSearchRelationTypes() provides correct symbols for DRS
- [ ] **Step 7.6:** TDD - Write E2E test with complex multi-sentence input using test vocabulary
- [ ] **Step 7.7:** Verify semantic inventory handles sentence-by-sentence queries correctly
- [ ] **Step 7.8:** Run full E2E test suite with small data - verify all DRS integration points work
- [ ] **Step 7.9:** Verify 100% test pass rate before proceeding

### Phase 8: Pre-Indexing Validation (CRITICAL CHECKPOINT)
**Goal:** Final validation before full indexing - make sure EVERYTHING is 100% ready

**Value:** Prevents wasting time/resources on incorrect full indexing

**CHECKPOINT - DO NOT PROCEED TO PHASE 9 UNTIL 100% PASS RATE ACHIEVED**

- [ ] **Step 8.1:** Run ALL tests with test-synsets/ - verify 100% pass rate
- [ ] **Step 8.2:** Review all categorization logic - verify it's production ready
- [ ] **Step 8.3:** Review all indexing logic - verify batching, error handling, logging
- [ ] **Step 8.4:** Review all query logic - verify correct collection queries
- [ ] **Step 8.5:** Create pre-indexing checklist - verify all requirements met
- [ ] **Step 8.6:** Manual review of test-synsets/ results - spot check quality
- [ ] **Step 8.7:** Check Qdrant is ready - sufficient disk space, proper configuration
- [ ] **Step 8.8:** Check MongoDB connection - wordnet database accessible
- [ ] **Step 8.9:** Create backup plan - document how to clean up if indexing fails
- [ ] **Step 8.10:** FINAL DECISION - Only proceed if 100% confident everything is correct

### Phase 9: Full Indexing (ONE TIME CONTROLLED PROCESS)
**Goal:** Index ALL ~200K WordNet vectors into Qdrant collections

**Value:** Creates production semantic inventory

**CRITICAL:** This runs ONCE. Get it right. NO tests here - just controlled indexing.

- [ ] **Step 9.1:** Create data/semantic-roles.json with FULL 14 role definitions per DESIGN.md
- [ ] **Step 9.2:** Create scripts/full-index.js - orchestrates full indexing with proper logging
- [ ] **Step 9.3:** Add progress tracking - log every 1000 vectors, report time estimates
- [ ] **Step 9.4:** Add error handling - log errors but continue, report summary at end
- [ ] **Step 9.5:** Add summary reporting - final counts, time taken, errors encountered
- [ ] **Step 9.6:** Dry run check - verify script loads correctly, shows what it will do
- [ ] **Step 9.7:** EXECUTE: Run scripts/full-index.js to index wordnet_entity_types (~82K nouns)
- [ ] **Step 9.8:** Monitor progress - verify steady indexing, no errors
- [ ] **Step 9.9:** EXECUTE: Run scripts/full-index.js to index wordnet_roles (14 roles)
- [ ] **Step 9.10:** EXECUTE: Run scripts/full-index.js to index wordnet_predicates (~114K)
- [ ] **Step 9.11:** EXECUTE: Run scripts/full-index.js to index wordnet_relations (~3.6K)
- [ ] **Step 9.12:** Verify final counts: ~200K total vectors across 4 collections
- [ ] **Step 9.13:** Create indexing log/report - document what was indexed, when, results

### Phase 10: Post-Indexing Verification
**Goal:** Verify full indexing worked correctly

**Value:** Confirms production semantic inventory is correct

**CRITICAL:** These tests run against FULL indexed data, NOT test-synsets/

- [ ] **Step 10.1:** Create __tests__/verification/ directory for full-data tests
- [ ] **Step 10.2:** Write verification test - check collection counts match expectations
- [ ] **Step 10.3:** Write verification test - spot check entity type categorization quality
- [ ] **Step 10.4:** Write verification test - verify all entity type categories represented
- [ ] **Step 10.5:** Write verification test - semantic search returns relevant results
- [ ] **Step 10.6:** Write verification test - all 14 semantic roles indexed correctly
- [ ] **Step 10.7:** Write verification test - predicates include adj/noun/verb as expected
- [ ] **Step 10.8:** Write verification test - relations categorized into spatial/temporal/logical
- [ ] **Step 10.9:** Run full verification suite - verify 100% pass rate
- [ ] **Step 10.10:** Manual spot checks - verify quality of returned results
- [ ] **Step 10.11:** Performance test - verify query response times acceptable
- [ ] **Step 10.12:** Integration test with real DRS input - verify end-to-end works
- [ ] **Step 10.13:** FINAL SIGN-OFF - Document that semantic inventory is production ready

### Phase 11: Edge Cases and Production Hardening
**Goal:** Handle edge cases, ensure robustness

**Value:** Production quality assurance

- [ ] **Step 11.1:** Read DESIGN.md sections: Testing Strategy
- [ ] **Step 11.2:** TDD - Write integration tests for empty results scenarios
- [ ] **Step 11.3:** Verify service handles queries with no matches gracefully (return empty arrays)
- [ ] **Step 11.4:** TDD - Write integration tests for threshold/limit parameters
- [ ] **Step 11.5:** Verify query options (limit, threshold) work correctly
- [ ] **Step 11.6:** TDD - Write integration tests for malformed inputs
- [ ] **Step 11.7:** Verify service fails fast on invalid inputs (no fallbacks)
- [ ] **Step 11.8:** Add error logging and monitoring hooks
- [ ] **Step 11.9:** Run complete test suite - verify 100% pass rate
- [ ] **Step 11.10:** Create package documentation - API reference, usage examples

---

## Progress Summary

**Completed Phases:**
- ✅ Phase 1: Core Infrastructure - Entity Type Categorization (50 test nouns)
- ✅ Phase 2: Semantic Roles Collection (10 test roles)
- ✅ Phase 3: Predicates Collection (60 test synsets)
- ✅ Phase 4: Relations Collection (30 test adverbs)
- ✅ Phase 5: Service Integration (Complete query API + indexAll())
- ✅ Phase 6: Enhanced Categorization (Definition keyword analysis)

**Current Phase:** Phase 7 - End-to-End DRS Integration Testing

**Test Status:** 62/62 tests passing (100%) in 1.678s

**Collections Indexed (Test Mode):**
- test_wordnet_entity_types: 50 items ✅
- test_wordnet_roles: 10 items ✅
- test_wordnet_predicates: 60 items ✅
- test_wordnet_relations: 30 items ✅
- Total: 150 test vectors

---

**Plan Version:** 2.1 - ENHANCED CATEGORIZATION
**Last Updated:** 2025-10-18
**Status:** Phase 5 Complete - Proceeding to Phase 6
