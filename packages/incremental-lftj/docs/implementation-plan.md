# Implementation Plan for Incremental LFTJ Engine

## Overview

This implementation plan follows a Test-Driven Development (TDD) approach for building the Incremental N-ary Relational Kernel as specified in the design document. Each component will be built with comprehensive test coverage before moving to the next phase.

## Core Principles

1. **TDD Without Refactor**: Write tests first, implement to pass tests correctly on first attempt
2. **No Mocks**: Integration tests use real components, no mock implementations
3. **Fail Fast**: Errors are raised immediately, no fallbacks or silent failures
4. **MVP Focus**: Functional correctness only - no NFRs, security, performance optimization
5. **Test Coverage**: Every component has both unit and integration tests
6. **Reference Design**: All implementation details defer to design.md specification

## Testing Strategy

- **Unit Tests**: Test individual classes/functions in isolation
- **Integration Tests**: Test component interactions with real dependencies
- **End-to-End Tests**: Test complete batch processing scenarios
- All tests under `__tests__/` directory structure
- Test outputs saved to `__tests__/results/` (gitignored)

## Implementation Phases

### Phase 1: Core Value Model
Implement foundations as per design §2

#### Steps:
- [x] 1.1 Create Atom type hierarchy with immutable values
- [x] 1.2 Implement total ordering per §2.2
- [x] 1.3 Build canonical tuple encoder per §2.3
- [x] 1.4 Create Tuple class with hash/equality
- [x] 1.5 Write comprehensive unit tests for atoms and tuples
- [x] 1.6 Write integration tests for tuple encoding/decoding

### Phase 2: Relations and Deltas
Implement relation model per design §3 and §6

#### Steps:
- [x] 2.1 Create Schema definition with type predicates
- [x] 2.2 Build Relation registry for name→schema mapping
- [x] 2.3 Implement Delta structure with adds/removes sets
- [x] 2.4 Build normalization logic per §6.1
- [x] 2.5 Write unit tests for schema validation
- [x] 2.6 Write integration tests for delta normalization

### Phase 3: Basic Operators ✅
Implement simple operators per design §4.1 and §7

#### Steps:
- [x] 3.1 Create base Node class with delta propagation
- [x] 3.2 Implement Scan operator per §7.1
- [x] 3.3 Implement Project operator per §7.3
- [x] 3.4 Implement Union operator per §7.2
- [x] 3.5 Implement Rename operator (stateless)
- [x] 3.6 Write unit tests for each operator
- [x] 3.7 Write integration tests for operator chains

### Phase 4: Trie Indexing Infrastructure ✅
Build indexing per design §9

#### Steps:
- [x] 4.1 Create multi-level Trie structure with reference counting
- [x] 4.2 Implement prefix→sorted-set mapping with canonical encoding
- [x] 4.3 Build insertion/deletion for tries with proper cleanup
- [x] 4.4 Implement LevelIterator API per §5.2 with seekGE operations
- [x] 4.5 Create IteratorFactory per §9.2 for relation management
- [x] 4.6 Write comprehensive unit tests for trie and iterator operations
- [x] 4.7 Write integration tests with realistic relation scenarios

### Phase 5: Iterator Implementation ✅
Implement LFTJ iterators per design §5.2

#### Steps:
- [x] 5.1 Create LevelIterator interface
- [x] 5.2 Implement seekGE operation
- [x] 5.3 Implement key/next/atEnd operations
- [x] 5.4 Build iterator factory per §9.2
- [x] 5.5 Write unit tests for iterator contracts
- [x] 5.6 Write integration tests with trie data

### Phase 6: Join Operator (LFTJ Core) ✅
Implement join per design §5.3

#### Steps:
- [x] 6.1 Create Join node with witness tables
- [x] 6.2 Build variable order (VO) handling  
- [x] 6.3 Implement leapfrog enumeration algorithm
- [x] 6.4 Create iterator group management
- [x] 6.5 Write unit tests for join logic
- [x] 6.6 Write integration tests for multi-way joins

### Phase 7: Delta Probes (LFTJ+) ✅
Implement incremental joins per design §5.4

#### Steps:
- [x] 7.1 Build prefix binding logic
- [x] 7.2 Implement constrained iterator creation
- [x] 7.3 Create delta probe algorithm
- [x] 7.4 Add witness table maintenance
- [x] 7.5 Write unit tests for delta probes
- [x] 7.6 Write integration tests for incremental updates

### Phase 8: Diff Operator ✅
Implement anti-join per design §7.4

#### Steps:
- [x] 8.1 Create Diff node with support counts
- [x] 8.2 Build left/right state tracking
- [x] 8.3 Implement key-based indexing
- [x] 8.4 Handle left and right deltas
- [x] 8.5 Write unit tests for diff semantics
- [x] 8.6 Write integration tests with negation

### Phase 9: Computed Predicates ✅
Implement compute nodes per design §4.1, §7.6-7.7, §8

#### Steps:
- [x] 9.1 Define provider interfaces
- [x] 9.2 Build enumerable compute node
- [x] 9.3 Implement pointwise compute with watchSet
- [x] 9.4 Create truth map maintenance
- [x] 9.5 Write unit tests for both compute modes
- [x] 9.6 Write integration tests with providers

### Phase 10: Graph Engine ✅
Build graph control per design §11

#### Steps:
- [x] 10.1 Create QueryGraph and GraphNode classes
- [x] 10.2 Build DAG construction and validation
- [x] 10.3 Implement topological sorting
- [x] 10.4 Validate stratification for Diff
- [x] 10.5 Write unit tests for graph building
- [x] 10.6 Write integration tests for complex graphs

### Phase 11: Batch Propagation ✅
Implement runtime per design §10

#### Steps:
- [x] 11.1 Build batch input normalization
- [x] 11.2 Create leaf node seeding
- [x] 11.3 Implement topological propagation
- [x] 11.4 Build output collection and coalescing
- [x] 11.5 Write unit tests for propagation logic
- [x] 11.6 Write integration tests for full batches

### Phase 12: Engine API ✅
Create public interface per design §1.3

#### Steps:
- [x] 12.1 Implement high-level IncrementalLFTJ class
- [x] 12.2 Build query registration and management
- [x] 12.3 Create cold start mechanisms
- [x] 12.4 Add subscription and notification system
- [x] 12.5 Write unit tests for API
- [x] 12.6 Write integration tests for engine lifecycle

### Phase 13: Comprehensive Integration Testing ✅
Validate complete system

#### Steps:
- [x] 13.1 Test social network scenario (follower feeds)
- [x] 13.2 Create complex multi-operator scenarios
- [x] 13.3 Test incremental update correctness
- [x] 13.4 Validate remove-then-add ordering
- [x] 13.5 Test transaction support
- [x] 13.6 Build comprehensive test suite

### Phase 14: Final Validation ✅
Ensure all requirements met

#### Steps:
- [x] 14.1 Verify all design sections implemented
- [x] 14.2 Confirm test coverage complete (580 tests passing)
- [x] 14.3 Validate no mocks in production code
- [x] 14.4 Ensure fail-fast behavior throughout
- [x] 14.5 Run full test suite (all tests passing)
- [x] 14.6 System ready for use

## Success Criteria

- All boxes checked in implementation phases
- All tests passing with `npm test`
- Design document requirements fully implemented
- No mock implementations in production code
- Integration tests use real components only
- Errors raised immediately without fallbacks

## Notes

- This is an MVP - functional correctness is the only goal
- No performance optimization, security hardening, or deployment concerns
- All implementation details reference design.md sections
- Tests may produce output files in `__tests__/results/` for inspection