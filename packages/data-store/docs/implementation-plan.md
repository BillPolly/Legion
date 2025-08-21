# Immutable Data Store Implementation Plan

> **Goal:** Implement the immutable data store with constraint validation as specified in `immutable-design.md` using Test-Driven Development without refactoring. Focus solely on functional correctness for MVP.

---

## Implementation Approach

### Core Principles

1. **Test-Driven Development (No Refactor)**: Write tests first, implement to pass tests correctly on first attempt
2. **No Mocks Policy**: 
   - ❌ **NEVER use mocks in integration tests** - use real components only
   - ❌ **NEVER use mocks in implementation code** - no fallback implementations
3. **Fail Fast**: Errors must be raised immediately, no silent failures or fallbacks
4. **MVP Focus**: Functional correctness only - ignore NFRs (security, performance, migration, documentation)
5. **Local Development**: Implementation for local running and UAT only
6. **Design Reference**: All implementation details are specified in `immutable-design.md`

### Testing Strategy

- **Unit Tests**: Test individual classes/methods in isolation with real dependencies
- **Integration Tests**: Test component interactions using real implementations only
- **End-to-End Tests**: Test complete workflows through public API
- **Constraint Tests**: Comprehensive validation scenario testing
- All tests under `__tests__/immutable/` directory structure
- Test results and artifacts saved to `__tests__/results/immutable/` (gitignored)

### Success Criteria Per Phase

- [ ] All tests pass with `npm test`
- [ ] No mocks used anywhere in codebase
- [ ] All errors fail fast with clear messages
- [ ] Implementation matches design specification exactly
- [ ] Integration tests use real components only

---

## Implementation Phases

### Phase 1: Immutable Core Data Structures
**Objective**: Implement the fundamental immutable data structures as specified in Design §3

#### Step 1.1: ImmutableStoreRoot Foundation
- [ ] Create `src/immutable/ImmutableStoreRoot.js`
- [ ] Implement constructor with frozen state
- [ ] Implement `withAddedEdge()` pure function
- [ ] Implement `withRemovedEdge()` pure function  
- [ ] Implement `withAddedRelationType()` pure function
- [ ] Implement all read-only accessors
- [ ] Write unit tests: `__tests__/immutable/unit/ImmutableStoreRoot.test.js`

#### Step 1.2: ImmutableTrieNode Implementation
- [ ] Create `src/immutable/ImmutableTrieNode.js`
- [ ] Implement constructor with frozen state
- [ ] Implement `withAddedChild()` pure function
- [ ] Implement `withUpdatedChild()` pure function
- [ ] Implement `withAddedWitness()` pure function
- [ ] Implement `withRemovedWitness()` pure function
- [ ] Implement `withLeafMarking()` pure function
- [ ] Write unit tests: `__tests__/immutable/unit/ImmutableTrieNode.test.js`

#### Step 1.3: ImmutableTrieManager Coordination
- [ ] Create `src/immutable/ImmutableTrieManager.js`
- [ ] Implement constructor with frozen state
- [ ] Implement `withAddedRelationType()` pure function
- [ ] Implement `withAddedEdge()` pure function
- [ ] Implement `withRemovedEdge()` pure function
- [ ] Implement all read-only accessors
- [ ] Write unit tests: `__tests__/immutable/unit/ImmutableTrieManager.test.js`

#### Step 1.4: ImmutableOutTrie and ImmutableInTrie
- [ ] Create `src/immutable/ImmutableOutTrie.js`
- [ ] Create `src/immutable/ImmutableInTrie.js`
- [ ] Implement `withAddedEdge()` for both classes
- [ ] Implement `withRemovedEdge()` for both classes
- [ ] Implement leapfrog operations for both classes
- [ ] Write unit tests: `__tests__/immutable/unit/ImmutableOutTrie.test.js`
- [ ] Write unit tests: `__tests__/immutable/unit/ImmutableInTrie.test.js`

#### Step 1.5: Core Data Structure Integration Tests
- [ ] Write integration tests: `__tests__/immutable/integration/CoreDataStructures.test.js`
- [ ] Test StoreRoot ↔ TrieManager integration
- [ ] Test TrieManager ↔ OutTrie/InTrie coordination
- [ ] Test edge addition/removal through full stack
- [ ] Test structural sharing and immutability
- [ ] Verify no mocks used in integration tests

---

### Phase 2: Constraint Validation Framework
**Objective**: Implement the constraint system as specified in Design §4

#### Step 2.1: Base Constraint Framework
- [ ] Create `src/immutable/constraints/Constraint.js`
- [ ] Create `src/immutable/constraints/ConstraintResult.js`
- [ ] Create `src/immutable/constraints/ConstraintViolation.js`
- [ ] Implement base constraint interface
- [ ] Write unit tests: `__tests__/immutable/unit/constraints/BaseConstraints.test.js`

#### Step 2.2: Constraint Registry System
- [ ] Create `src/immutable/constraints/ConstraintRegistry.js`
- [ ] Implement constraint registration and indexing
- [ ] Implement relationship-specific constraint lookup
- [ ] Implement global constraint management
- [ ] Write unit tests: `__tests__/immutable/unit/constraints/ConstraintRegistry.test.js`

#### Step 2.3: Constraint Validator Engine
- [ ] Create `src/immutable/constraints/ConstraintValidator.js`
- [ ] Implement validation orchestration
- [ ] Implement selective constraint execution
- [ ] Implement violation collection and reporting
- [ ] Write unit tests: `__tests__/immutable/unit/constraints/ConstraintValidator.test.js`

#### Step 2.4: Built-in Constraint Types
- [ ] Create `src/immutable/constraints/CardinalityConstraint.js`
- [ ] Create `src/immutable/constraints/EntityTypeConstraint.js`  
- [ ] Create `src/immutable/constraints/CustomConstraint.js`
- [ ] Implement validation logic for each constraint type
- [ ] Write unit tests: `__tests__/immutable/unit/constraints/BuiltinConstraints.test.js`

#### Step 2.5: Constraint System Integration Tests
- [ ] Write integration tests: `__tests__/immutable/integration/ConstraintValidation.test.js`
- [ ] Test constraint registration and validation pipeline
- [ ] Test violation detection and reporting
- [ ] Test constraint combinations and interactions
- [ ] Verify no mocks used in integration tests

---

### Phase 3: Immutable DataStore Implementation
**Objective**: Implement the main ImmutableDataStore class as specified in Design §5

#### Step 3.1: ImmutableDataStore Core
- [ ] Create `src/immutable/ImmutableDataStore.js`
- [ ] Implement constructor and initialization
- [ ] Implement `addEdge()` with constraint validation
- [ ] Implement `removeEdge()` with constraint validation
- [ ] Implement `defineRelationType()` with constraints
- [ ] Write unit tests: `__tests__/immutable/unit/ImmutableDataStore.test.js`

#### Step 3.2: Batch Operations
- [ ] Implement `batch()` method for atomic multi-operations
- [ ] Implement transaction-like semantics
- [ ] Implement rollback on constraint violations
- [ ] Write unit tests for batch operations

#### Step 3.3: Constraint Management API
- [ ] Implement `addConstraint()` method
- [ ] Implement `validateCurrentState()` method
- [ ] Implement `testOperation()` method for dry-run validation
- [ ] Write unit tests for constraint management

#### Step 3.4: State Management and Events
- [ ] Implement event emission for state transitions
- [ ] Implement history recording (basic)
- [ ] Implement read-only accessor methods
- [ ] Write unit tests for state management

#### Step 3.5: Error Handling
- [ ] Create `src/immutable/ConstraintViolationError.js`
- [ ] Implement comprehensive error reporting
- [ ] Implement error context and debugging information
- [ ] Write unit tests for error scenarios

#### Step 3.6: ImmutableDataStore Integration Tests
- [ ] Write integration tests: `__tests__/immutable/integration/ImmutableDataStore.test.js`
- [ ] Test complete edge lifecycle with constraints
- [ ] Test relationship type management
- [ ] Test batch operations with mixed success/failure
- [ ] Test error handling and violation reporting
- [ ] Verify no mocks used in integration tests

---

### Phase 4: Entity Schema System
**Objective**: Implement entity types and schema-driven constraints as specified in Design §6

#### Step 4.1: Entity Type Definition
- [ ] Create `src/immutable/schema/EntityType.js`
- [ ] Implement entity type with attribute schemas
- [ ] Implement entity validation against schema
- [ ] Implement attribute type checking
- [ ] Write unit tests: `__tests__/immutable/unit/schema/EntityType.test.js`

#### Step 4.2: Entity Type Registry
- [ ] Create `src/immutable/schema/EntityTypeRegistry.js`
- [ ] Implement entity type registration and lookup
- [ ] Implement schema validation
- [ ] Write unit tests: `__tests__/immutable/unit/schema/EntityTypeRegistry.test.js`

#### Step 4.3: Schema Constraint Generation
- [ ] Create `src/immutable/schema/SchemaConstraintGenerator.js`
- [ ] Implement automatic constraint generation from schemas
- [ ] Implement entity constraint generation
- [ ] Implement relationship constraint generation
- [ ] Write unit tests: `__tests__/immutable/unit/schema/SchemaConstraintGenerator.test.js`

#### Step 4.4: Schema Integration with DataStore
- [ ] Integrate EntityTypeRegistry with ImmutableDataStore
- [ ] Implement schema-driven validation
- [ ] Implement automatic constraint registration
- [ ] Write unit tests for schema integration

#### Step 4.5: Schema System Integration Tests
- [ ] Write integration tests: `__tests__/immutable/integration/EntitySchema.test.js`
- [ ] Test complete schema definition and validation workflow
- [ ] Test automatic constraint generation and enforcement
- [ ] Test entity lifecycle with schema validation
- [ ] Verify no mocks used in integration tests

---

### Phase 5: End-to-End Validation
**Objective**: Comprehensive testing of complete system functionality

#### Step 5.1: Complete Workflow Tests
- [ ] Write end-to-end tests: `__tests__/immutable/e2e/CompleteWorkflows.test.js`
- [ ] Test Design §12 examples: "Suppliers in UK named Acme"
- [ ] Test Design §12 examples: "Projects with approved members"  
- [ ] Test Design §12 examples: "Disjunction and NOT queries"
- [ ] Test complex constraint scenarios

#### Step 5.2: Constraint Scenario Testing
- [ ] Write comprehensive constraint tests: `__tests__/immutable/e2e/ConstraintScenarios.test.js`
- [ ] Test cardinality constraint enforcement
- [ ] Test entity type constraint enforcement
- [ ] Test custom business rule constraints
- [ ] Test constraint violation handling

#### Step 5.3: Edge Case and Error Testing
- [ ] Write edge case tests: `__tests__/immutable/e2e/EdgeCases.test.js`
- [ ] Test boundary conditions
- [ ] Test invalid operations
- [ ] Test constraint violation edge cases
- [ ] Test error propagation and handling

#### Step 5.4: System Integration Testing
- [ ] Write system integration tests: `__tests__/immutable/e2e/SystemIntegration.test.js`
- [ ] Test all components working together
- [ ] Test state transitions and consistency
- [ ] Test event emission and handling
- [ ] Verify no mocks anywhere in test suite

#### Step 5.5: Final Validation
- [ ] Run complete test suite: `npm test`
- [ ] Verify all tests pass
- [ ] Verify no mocks used anywhere
- [ ] Verify fail-fast behavior throughout
- [ ] Verify compliance with design specification

---

### Phase 6: Compatibility and Integration
**Objective**: Ensure new immutable system works alongside existing codebase

#### Step 6.1: Compatibility Layer (Optional for MVP)
- [ ] Create `src/immutable/CompatibilityDataStore.js` (if needed)
- [ ] Implement mutable API wrapper over immutable store
- [ ] Write compatibility tests
- [ ] Note: May be deferred post-MVP

#### Step 6.2: Package Integration
- [ ] Update `src/index.js` to export immutable classes
- [ ] Ensure proper module structure
- [ ] Verify clean separation from mutable implementation

#### Step 6.3: Integration with Existing Tests
- [ ] Ensure existing tests still pass
- [ ] Verify no conflicts with existing implementation
- [ ] Verify clean coexistence

---

## Phase Completion Checklist

**Per Phase Requirements:**
- [ ] All step checkboxes completed
- [ ] All tests pass with `npm test`
- [ ] No mocks found in any code (`grep -r "mock\|stub\|spy" src/immutable/`)
- [ ] No fallback implementations in code
- [ ] All errors fail fast with clear messages
- [ ] Implementation matches design document specification
- [ ] Integration tests use real components only

**Overall Success Criteria:**
- [ ] Complete immutable data store implementation
- [ ] Comprehensive constraint validation system  
- [ ] Entity schema system with automatic constraint generation
- [ ] Full test coverage (unit + integration + e2e)
- [ ] Zero mocks in entire implementation
- [ ] Fail-fast error handling throughout
- [ ] MVP functional correctness achieved

---

## Implementation Notes

### File Structure
```
src/immutable/
  ├── ImmutableStoreRoot.js
  ├── ImmutableTrieNode.js
  ├── ImmutableTrieManager.js
  ├── ImmutableOutTrie.js
  ├── ImmutableInTrie.js
  ├── ImmutableDataStore.js
  ├── ConstraintViolationError.js
  ├── constraints/
  │   ├── Constraint.js
  │   ├── ConstraintResult.js
  │   ├── ConstraintViolation.js
  │   ├── ConstraintRegistry.js
  │   ├── ConstraintValidator.js
  │   ├── CardinalityConstraint.js
  │   ├── EntityTypeConstraint.js
  │   └── CustomConstraint.js
  └── schema/
      ├── EntityType.js
      ├── EntityTypeRegistry.js
      └── SchemaConstraintGenerator.js

__tests__/immutable/
  ├── unit/
  ├── integration/
  ├── e2e/
  └── results/ (gitignored)
```

### Key Implementation Rules
1. **Every class must be immutable** (Object.freeze)
2. **Every mutation method must return new instance** (pure functions)
3. **Every error must be raised immediately** (no silent failures)
4. **Every test must use real components** (no mocks)
5. **Every implementation must match design spec** (no deviations)

Ready to begin Phase 1 implementation following this TDD plan.