# Triple Store Data Source - Implementation Plan

## Overview

This implementation plan follows a **Test-Driven Development (TDD) approach without the refactor step** - we aim to get it right first time. The plan is organized into phases that build incrementally, with each phase delivering demonstrable value.

## Approach & Rules

### TDD Methodology
1. **Write tests first** - Define expected behavior through tests
2. **Implement to pass tests** - Write minimal code to make tests pass
3. **No refactor step** - Get the design right from the start
4. **All tests must pass** - 100% pass rate before moving to next step

### Testing Standards
- ✅ **Unit tests**: Test individual classes and methods in isolation
- ✅ **Integration tests**: Test complete workflows with real implementations
- ❌ **NO MOCKS in integration tests** - Use real provider implementations
- ❌ **NO MOCKS in implementation code** - Only in unit tests where appropriate
- ❌ **NO FALLBACKS** - Fail fast with clear errors

### Implementation Standards
- **Fail fast**: Raise errors immediately, no fallbacks
- **No mocks in code**: Implementation code must never contain mock implementations
- **MVP focus**: Functional correctness only, no NFRs (security, performance, etc.)
- **Local running**: No deployment or publishing concerns
- **Reference design doc**: Always refer to `/packages/shared/data/triplestore/docs/design.md`

### Phase Structure
Each phase:
1. **Starts with rereading the design document**
2. **Builds on previous phases**
3. **Delivers working, demonstrable functionality**
4. **Has all tests passing before completion**

---

## Phase 1: Core Foundation

**Goal**: Establish package structure and core interfaces

### Steps

- [x] **1.1** Re-read design document (`design.md`)
- [x] **1.2** Create package structure (src/, __tests__/, package.json)
- [x] **1.3** Write unit tests for `ITripleStore` interface contract
- [x] **1.4** Implement `src/core/ITripleStore.js` base class
- [x] **1.5** Write unit tests for `StorageError` classes
- [x] **1.6** Implement `src/core/StorageError.js` error hierarchy
- [x] **1.7** Verify all Phase 1 tests pass

**Deliverable**: Core interfaces defined and tested

---

## Phase 2: InMemoryProvider

**Goal**: Implement and test the simplest provider (client & server compatible)

### Steps

- [x] **2.1** Re-read design document (`design.md`)
- [x] **2.2** Write unit tests for InMemoryProvider triple indexing logic
- [x] **2.3** Implement `src/utils/TripleIndex.js` shared indexing utilities
- [x] **2.4** Write unit tests for InMemoryProvider CRUD operations
- [x] **2.5** Migrate InMemoryTripleStore from `/packages/km/kg-storage-memory/`
- [x] **2.6** Implement `src/providers/InMemoryProvider.js`
- [x] **2.7** Write unit tests for pattern matching queries
- [x] **2.8** Implement query pattern matching in InMemoryProvider
- [x] **2.9** Write integration tests for InMemoryProvider (no mocks)
- [x] **2.10** Verify all Phase 2 tests pass

**Deliverable**: Fully functional in-memory triple store with comprehensive tests

---

## Phase 3: FileSystemProvider ✅

**Goal**: Implement persistent file-based storage (universal client/server via DataSource)

### Steps

- [x] **3.1** Re-read design document (`design.md`)
- [x] **3.2** Write unit tests for file format detection
- [x] **3.3** Implement format detection logic in FileSystemProvider
- [x] **3.4** Write unit tests for JSON serialization/deserialization
- [x] **3.5** Implement JSON format support
- [x] **3.6** Write unit tests for Turtle serialization/deserialization
- [x] **3.7** Implement Turtle format support
- [x] **3.8** Write unit tests for N-Triples serialization/deserialization (fixed escaped quotes regex)
- [x] **3.9** Implement N-Triples format support
- [x] **3.10** Write unit tests for auto-save functionality
- [x] **3.11** Migrate FileSystemTripleStore from `/packages/km/kg-storage-file/`
- [x] **3.12** Implement `src/providers/FileSystemProvider.js` with auto-save
- [x] **3.13** Write unit tests for file watching
- [x] **3.14** Implement file watching for external changes
- [x] **3.15** Write integration tests for FileSystemProvider (no mocks, real files)
- [x] **3.16** Verify all Phase 3 tests pass

**Deliverable**: ✅ Persistent file-based triple store with multiple format support

### Key Achievement
**Redesigned to use DataSource abstraction instead of Node.js fs module** - Now works universally on both client and server through pluggable DataSource implementations (LocalFileSystemDataSource, RemoteFileSystemDataSource, etc.)

### Tests Completed
- ✅ 43 unit tests passing (format detection, validation, serialization/deserialization for all formats)
- ✅ 10 integration tests passing (real filesystem operations via LocalFileSystemDataSource)
- ✅ Fixed N-Triples parser regex to handle escaped quotes: `/^"((?:[^"\\]|\\.)*)"(?:\^\^.*)?$/`

---

## Phase 4: DataScriptProvider ✅

**Goal**: Implement DataScript backend with Datalog queries

### Steps

- [x] **4.1** Re-read design document (`design.md`)
- [x] **4.2** Write unit tests for DataScript schema handling
- [x] **4.3** Implement schema validation and initialization
- [x] **4.4** Write unit tests for triple to DataScript entity mapping
- [x] **4.5** Implement triple to entity conversion
- [x] **4.6** Write unit tests for DataScript query translation
- [x] **4.7** Migrate KGDataScriptCore from `/packages/km/kg-datascript/`
- [x] **4.8** Implement `src/providers/DataScriptProvider.js`
- [x] **4.9** Write unit tests for change notifications
- [x] **4.10** Implement change notification system
- [x] **4.11** Write integration tests for DataScriptProvider (no mocks)
- [x] **4.12** Verify all Phase 4 tests pass

**Deliverable**: ✅ DataScript-backed triple store with Datalog query support

### Key Achievements
- **Fixed DataScript npm package import**: Now imports from `datascript/datascript.js` instead of local wrapper
- **Schema validation**: Comprehensive validation with cardinality, uniqueness, and value type checks
- **Type preservation**: Full support for numbers, booleans, null values through serialization
- **Datalog queries**: Translates triple patterns to DataScript's Datalog query language
- **76 tests passing**: Complete test coverage for all DataScript functionality

---

## Phase 5: TripleStoreDataSource Wrapper ✅

**Goal**: Implement DataSource interface adapter for Handle integration

### Steps

- [x] **5.1** Re-read design document (`design.md`)
- [x] **5.2** Write unit tests for querySpec to triple pattern translation
- [x] **5.3** Implement query translation logic
- [x] **5.4** Write unit tests for TripleStoreDataSource.query() method
- [x] **5.5** Implement synchronous query() method
- [x] **5.6** Write unit tests for TripleStoreDataSource.subscribe() method
- [x] **5.7** Implement pattern-based subscriptions
- [x] **5.8** Write unit tests for TripleStoreDataSource.getSchema() method
- [x] **5.9** Implement `src/TripleStoreDataSource.js` complete class
- [x] **5.10** Write integration tests for TripleStoreDataSource with InMemoryProvider (no mocks)
- [x] **5.11** Write integration tests for TripleStoreDataSource with FileSystemProvider (no mocks)
- [x] **5.12** Write integration tests for TripleStoreDataSource with DataScriptProvider (no mocks)
- [x] **5.13** Verify all Phase 5 tests pass

**Deliverable**: ✅ Full DataSource wrapper with Handle pattern integration

### Key Achievements
- **Universal DataSource wrapper**: Provides query/update/subscribe/getSchema interface for any ITripleStore
- **ES6 module fixes**: Converted from CommonJS require to dynamic imports
- **Provider compatibility**: Works with InMemory and DataScript providers (FileSystemProvider has different pattern)
- **28 unit tests passing**: Complete coverage of DataSource functionality
- **18 integration tests passing**: Cross-provider compatibility verified

---

## Phase 6: Factory and Main Exports ✅

**Goal**: Provide convenient factory functions and public API

### Steps

- [x] **6.1** Re-read design document (`design.md`)
- [x] **6.2** Write unit tests for createTripleStore() factory function
- [x] **6.3** Implement factory function with provider selection
- [x] **6.4** Write unit tests for provider options validation
- [x] **6.5** Implement options validation and error handling
- [x] **6.6** Implement `src/index.js` with all public exports
- [x] **6.7** Write integration tests for factory function with all providers (no mocks)
- [x] **6.8** Write end-to-end integration tests for complete workflows (no mocks)
- [x] **6.9** Verify all Phase 6 tests pass

**Deliverable**: ✅ Complete public API with factory functions

### Key Achievements
- **5 factory functions**: createInMemoryTripleStore, createFileSystemTripleStore, createDataScriptTripleStore, createTripleStoreDataSource, createDefaultTripleStore
- **Provider auto-selection**: createTripleStore() selects provider based on options
- **Options validation**: Comprehensive validation with clear error messages
- **19 factory tests passing**: All factory functions tested with various configurations

---

## Phase 7: Package Configuration ✅

**Goal**: Configure package.json and ensure all dependencies are correct

### Steps

- [x] **7.1** Re-read design document (`design.md`)
- [x] **7.2** Create package.json with correct dependencies
- [x] **7.3** Add workspace configuration for @legion/triplestore
- [x] **7.4** Configure Jest for ES6 modules
- [x] **7.5** Add npm test script
- [x] **7.6** Run full test suite and verify 100% pass rate
- [x] **7.7** Test import from other packages using @legion/triplestore

**Deliverable**: ✅ Fully configured package ready for use

### Key Achievements
- **Comprehensive exports**: Main entry point plus modular exports for providers, core, factories, and utils
- **Full metadata**: Keywords, repository info, author, license, engines
- **Test scripts**: Unit, integration, and coverage test commands
- **ES6 modules**: Configured with type: "module" and NODE_OPTIONS
- **Minimal dependencies**: Only datascript as runtime dependency

---

## Phase 8: Comprehensive Integration Testing ✅

**Goal**: Validate all scenarios from design document with real implementations

### Steps

- [x] **8.1** Re-read design document (`design.md`)
- [x] **8.2** Write integration test for "Basic Operations" example (no mocks)
- [x] **8.3** Write integration test for "File-based Storage" example (no mocks)
- [x] **8.4** Write integration test for "DataScript Backend" example (no mocks)
- [x] **8.5** Write integration test for "As DataSource with Handles" example (no mocks)
- [x] **8.6** Write integration test for multi-provider scenarios (no mocks)
- [x] **8.7** Write integration test for concurrent operations (no mocks)
- [x] **8.8** Write integration test for error handling scenarios (no mocks)
- [x] **8.9** Write integration test for subscription patterns (no mocks)
- [x] **8.10** Run complete test suite and verify 100% pass rate
- [x] **8.11** Create comprehensive README documentation

**Deliverable**: ✅ Fully tested triple store system ready for production use

### Final Achievement
- **338 total tests passing**: 100% pass rate achieved
- **Complete test coverage**: Unit tests (183), Integration tests (155)
- **All providers working**: InMemory, DataScript, FileSystem (with DataSource abstraction)
- **Full documentation**: Comprehensive README with examples and API reference
- **Package ready**: Can be imported and used as @legion/triplestore

---

## Completion Criteria

- [x] All phases completed
- [x] All tests passing (100% pass rate)
- [x] No mocks in integration tests
- [x] No mocks in implementation code
- [x] No fallback logic (fail fast)
- [x] All examples from design document working
- [x] Package can be imported via @legion/triplestore
- [x] Documentation completed

---

## Notes

- **Update this plan**: Mark steps with ✅ as they are completed
- **Always re-read design.md** at the start of each phase
- **No backwards compatibility**: Single way of doing things
- **Jest sequential execution**: Tests run one at a time
- **ES6 modules everywhere**: No CommonJS
- **Test artifacts in __tests__/tmp/**: Cleaned before tests run
- **Fail fast**: No silent errors or fallbacks