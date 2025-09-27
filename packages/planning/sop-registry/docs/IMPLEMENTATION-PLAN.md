# SOP Registry Implementation Plan (MVP)

## Overview

This plan implements the SOP Registry using Test-Driven Development (TDD) without refactoring phases. Each phase delivers working, tested functionality following the dependency order: storage → loading → perspectives → search → integration.

The approach follows the 80/20 rule: get core mechanisms working first, then elaborate. Each phase produces demonstrable value with comprehensive tests.

## Approach

1. **Bottom-up implementation**: Build foundation (storage) first, then layer up
2. **TDD without refactor**: Write test, implement to pass, move on (get it right first time)
3. **Real dependencies only**: Use actual MongoDB, LLM, Nomic in all tests
4. **Fail-fast everywhere**: NO fallbacks, NO mocks in implementation, NO skipping
5. **Sequential phases**: Complete phase N before starting N+1
6. **Comprehensive testing**: Unit → Integration → End-to-end at each phase

## Rules

### Testing Rules
- **Unit tests**: May mock peripheral dependencies, NEVER mock core functionality
- **Integration tests**: NO MOCKS for main functionality, only for incidental peripherals
- **All tests**: Use real MongoDB, real LLM client, real Nomic embeddings
- **NO skipping**: Every test must pass or be deleted
- **NO fallbacks**: Tests fail fast if resources unavailable
- **Jest configuration**: ES6 modules, sequential execution (`--runInBand`)
- **Test location**: All in `__tests__/` directory (unit/ and integration/ subdirectories)

### Implementation Rules
- **NO MOCKS** in implementation code ever
- **NO FALLBACKS** in implementation code
- **FAIL FAST** on missing dependencies or errors
- **ResourceManager ONLY** for all env vars and services
- **Singleton pattern** for SOPRegistry
- **Clean Architecture**: Single responsibility per class
- **ES6 modules**: Import/export throughout
- **No comments** unless explicitly needed

### Progress Tracking
- **ONLY** use checkboxes [ ] in this document
- **NO OTHER** progress tracking (no inline comments, no separate files)
- Mark [✓] when step complete
- Mark [✓] when phase complete

---

## Phase 1: Foundation - Storage Layer [✓]

**Goal**: Working MongoDB storage with collections, schemas, and CRUD operations.

**Deliverable**: Can save/retrieve SOPs and perspectives from MongoDB with proper indexing.

### Steps

[✓] 1.1 Read DESIGN.md sections 2, 6, 7.2

[✓] 1.2 Create package structure and package.json with dependencies

[✓] 1.3 Create error classes (SOPRegistryError, SOPLoadError, SOPValidationError, SOPSearchError, PerspectiveGenerationError)

[✓] 1.4 Write SOPStorage.test.js unit tests:
- Connection and initialization
- Save/find/delete SOPs
- Perspective type operations
- Perspective CRUD operations
- Statistics queries
- Health check

[✓] 1.5 Implement SOPStorage.js to pass all tests:
- MongoDB connection via ResourceManager
- Collection initialization with indexes
- Seed default perspective types (5 types from DESIGN.md section 2.2)
- CRUD methods for all 3 collections
- Statistics aggregation

[✓] 1.6 Run tests and verify 100% pass rate

[✓] 1.7 Write SOPStorage integration test:
- Full initialization with real MongoDB
- Concurrent operations
- Index verification
- Data integrity checks

[✓] 1.8 Run integration test and verify pass

---

## Phase 2: Loading - SOP Files to Database [✓]

**Goal**: Load and validate SOPs from JSON files in data/sops/ directory.

**Deliverable**: Auto-discovery and loading of SOPs with validation, stored in MongoDB.

### Steps

[✓] 2.1 Read DESIGN.md sections 4, 7.3

[✓] 2.2 Create data/sops/ directory structure

[✓] 2.3 Create example SOP JSON files:
- train-booking.json (complete example from DESIGN.md section 4.2)
- file-operations.json (simple example)
- api-integration.json (tools-heavy example)

[✓] 2.4 Write SOPLoader.test.js unit tests:
- JSON parsing (valid and invalid)
- Structure validation
- Step index assignment
- Tool extraction from steps
- File discovery in data/sops/
- Timestamp addition

[✓] 2.5 Implement SOPLoader.js to pass all tests:
- File discovery in data/sops/
- JSON parsing with error handling
- Validation against schema (DESIGN.md section 2.1)
- Automatic processing (indices, timestamps, tool extraction)
- Integration with SOPStorage for saving

[✓] 2.6 Run tests and verify 100% pass rate

[✓] 2.7 Write SOPLoader integration test:
- Load all SOPs from data/sops/
- Verify all saved to MongoDB
- Verify validation catches bad SOPs
- Verify tool extraction works

[✓] 2.8 Run integration test and verify pass

---

## Phase 3: Perspectives - Semantic View Generation [✓]

**Goal**: Generate multi-perspective semantic views for SOPs with embeddings.

**Deliverable**: LLM-generated perspectives for whole SOPs and individual steps, embedded via Nomic.

### Steps

[✓] 3.1 Read DESIGN.md sections 2.2, 2.3, 5, 7.4

[✓] 3.2 Write SOPPerspectives.test.js unit tests:
- Initialize with ResourceManager
- Generate SOP-level perspectives (4 types, 1 LLM call)
- Generate step perspectives (batch LLM call)
- Embed perspectives via Nomic
- Save perspectives to database
- Retrieve perspectives by SOP
- Retrieve perspectives by step

[✓] 3.3 Implement SOPPerspectives.js to pass all tests:
- Get LLM client from ResourceManager
- Get Nomic service from ResourceManager
- Create prompts for SOP-level generation (DESIGN.md section 7.4)
- Create prompts for step-level generation
- Parse LLM responses
- Batch embed via Nomic (768-dim)
- Save with embeddings to sop_perspectives collection

[✓] 3.4 Run tests and verify 100% pass rate (real LLM, real Nomic)

[✓] 3.5 Write SOPPerspectives integration test:
- Load SOPs from database
- Generate all perspectives for multiple SOPs
- Verify embedding dimensions (768)
- Verify perspective counts (4 + N per SOP)
- Verify batch_id linking

[✓] 3.6 Run integration test and verify pass

---

## Phase 4: Search - Semantic Retrieval [✓]

**Goal**: Multi-angle semantic search over SOPs and steps.

**Deliverable**: Working semantic, text, and hybrid search with ranking.

### Steps

[✓] 4.1 Read DESIGN.md sections 7.5, 9

[✓] 4.2 Write SOPSearch.test.js unit tests:
- Initialize with ResourceManager
- Query embedding generation (with caching)
- Semantic search via vector similarity
- Text search via MongoDB
- Hybrid search with scoring
- Step-level search
- Result ranking
- Search statistics

[✓] 4.3 Implement SOPSearch.js to pass all tests:
- Get Nomic service for embeddings
- Query embedding with LRU cache
- Vector similarity search over sop_perspectives
- MongoDB text search over sops
- Hybrid result combination (DESIGN.md section 7.5)
- Step-level search filtering
- Result formatting

[✓] 4.4 Run tests and verify 100% pass rate

[✓] 4.5 Write SOPSearch integration test:
- End-to-end search with real embeddings
- Verify result ranking
- Verify matched perspectives
- Verify step search returns correct SOPs
- Test specialized searches (by intent, tools, preconditions)

[✓] 4.6 Run integration test and verify pass

---

## Phase 5: Registry - Singleton Orchestration [✓]

**Goal**: Complete SOPRegistry singleton with public API.

**Deliverable**: Production-ready registry with auto-initialization and full API.

### Steps

[✓] 5.1 Read DESIGN.md sections 3.1, 7.1, 8

[✓] 5.2 Write SOPRegistry.test.js unit tests:
- Singleton pattern enforcement
- getInstance() returns same instance
- Auto-initialization on first access
- Component orchestration
- Public API methods
- Statistics aggregation
- Health check
- Cleanup

[✓] 5.3 Implement SOPRegistry.js to pass all tests:
- Singleton pattern (NO direct instantiation)
- getInstance() with auto-init
- Initialize all components (storage, loader, perspectives, search)
- Auto-load SOPs from data/sops/ on init
- Delegate to components
- Public API facade
- Resource cleanup

[✓] 5.4 Run tests and verify 100% pass rate

[✓] 5.5 Create src/index.js with default export

[✓] 5.6 Write README.md with basic usage examples

---

## Phase 6: End-to-End Integration [✓]

**Goal**: Complete pipeline working together with comprehensive integration test.

**Deliverable**: Proven working system from file load through search.

### Steps

[✓] 6.1 Read DESIGN.md section 12.2

[✓] 6.2 Write FullPipeline.test.js integration test:
- Get SOPRegistry singleton
- Verify auto-loaded SOPs from data/sops/
- Generate perspectives for all SOPs
- Verify embedding generation (real Nomic)
- Search SOPs by query
- Verify result ranking and scoring
- Search steps by query
- Verify matched perspectives
- Test specialized searches (intent, tools, preconditions)
- Verify statistics accuracy

[✓] 6.3 Run integration test and verify pass

[✓] 6.4 Create examples/basic-usage.js demonstrating:
- Get singleton
- Search SOPs
- Retrieve SOP details
- Search steps
- Get statistics

[✓] 6.5 Run example and verify output

[✓] 6.6 Full regression: Run ALL tests sequentially

[✓] 6.7 Verify 100% pass rate across all tests

---

## Phase 7: Specialized Search Capabilities [✓]

**Goal**: Intent, tool, and precondition-based search methods.

**Deliverable**: Convenient search methods for common agent use cases.

### Steps

[✓] 7.1 Read DESIGN.md section 9.3

[✓] 7.2 Add tests to SOPSearch.test.js for specialized searches:
- searchSOPsByIntent()
- searchSOPsByTools()
- searchSOPsByPreconditions()

[✓] 7.3 Implement specialized search methods in SOPSearch.js:
- Intent search via intent_perspective
- Tool search via tools_perspective
- Precondition search via preconditions_perspective

[✓] 7.4 Add specialized search methods to SOPRegistry facade

[✓] 7.5 Run tests and verify 100% pass rate

[✓] 7.6 Add specialized search examples to examples/search-examples.js

[✓] 7.7 Run example and verify output

[✓] 7.8 Full regression: Run ALL tests

---

## Phase 8: Data Population [✓]

**Goal**: Create comprehensive SOP library for meaningful testing.

**Deliverable**: 10+ curated SOPs covering diverse domains.

### Steps

[✓] 8.1 Create additional SOP JSON files in data/sops/:
- file-read-write.json (file operations)
- api-authentication.json (API integration)
- data-transformation.json (data processing)
- error-recovery.json (error handling)
- user-confirmation.json (user interaction)
- batch-processing.json (iteration patterns)
- conditional-workflow.json (branching logic)
- resource-acquisition.json (setup/teardown)
- notification-delivery.json (messaging)
- report-generation.json (output formatting)

[✓] 8.2 Reload SOPs via sopRegistry.loadAllSOPs()

[✓] 8.3 Generate perspectives for all new SOPs

[✓] 8.4 Run search tests across expanded SOP set

[✓] 8.5 Verify search quality and relevance

[✓] 8.6 Update statistics validation in tests for new SOP count

[✓] 8.7 Full regression: Run ALL tests

---

## Phase 9: Final Validation [✓]

**Goal**: Confirm complete system functionality and test coverage.

**Deliverable**: Production-ready SOP Registry with all tests passing.

### Steps

[✓] 9.1 Run complete test suite sequentially: `npm test`

[✓] 9.2 Verify 100% pass rate (no skips, no failures)

[✓] 9.3 Run all examples and verify output

[✓] 9.4 Run health check and verify all systems healthy

[✓] 9.5 Get statistics and verify accuracy:
- SOP count matches data/sops/ file count
- Perspective count = (4 × SOPs) + (total steps across SOPs)
- 100% embedding coverage
- All 5 perspective types present

[✓] 9.6 Manual smoke test:
- Search for "booking" - verify train-booking.json appears
- Search for specific tool name - verify SOPs using that tool
- Search for step-level query - verify individual steps returned
- Verify hybrid scoring combines semantic + text results

[✓] 9.7 Review DESIGN.md and verify all in-scope features implemented

[✓] 9.8 Mark implementation complete

---

## Execution Notes

### Before Each Phase
1. Read relevant DESIGN.md sections listed in phase
2. Understand data models and interfaces
3. Review error handling requirements
4. Check ResourceManager integration points

### During Implementation
1. Write test first (TDD)
2. Run test and verify it fails
3. Implement minimum code to pass
4. Run test and verify it passes
5. NO refactoring step - get it right first time
6. Move to next test

### Testing Requirements
- **Real MongoDB**: Use local MongoDB instance (configured in .env)
- **Real LLM**: Use ANTHROPIC_API_KEY from .env via ResourceManager
- **Real Nomic**: Use Nomic embeddings from @legion/nomic package
- **Real Qdrant**: Use local Qdrant for vector storage (if needed)
- **NO MOCKS**: In implementation code (NEVER)
- **NO FALLBACKS**: In implementation or tests (FAIL FAST)
- **NO SKIPPING**: All tests must pass or be deleted
- **Sequential execution**: `npm test -- --runInBand`

### After Each Phase
1. Run all tests in phase
2. Verify 100% pass rate
3. Run full regression (all previous tests)
4. Verify no regressions
5. Mark phase complete [✓]

### Integration Test Guidelines
- Integration tests verify components working together
- Use real dependencies for ALL core functionality:
  - Real MongoDB for database operations
  - Real LLM client for perspective generation
  - Real Nomic for embeddings
- Mocks ONLY allowed for peripheral concerns:
  - File system operations (if testing error paths)
  - Network timeouts (if testing resilience)
- When in doubt: NO MOCKS

### Completion Criteria
- All phases marked complete [✓]
- All tests passing (100% pass rate)
- No skipped tests
- No TODO comments in code
- All examples run successfully
- Statistics match expectations
- Health check returns healthy

---

**Ready to execute. Begin with Phase 1.**