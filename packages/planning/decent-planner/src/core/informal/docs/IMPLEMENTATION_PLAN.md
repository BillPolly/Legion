# Informal Planner Implementation Plan

## Overview

This implementation plan follows Test-Driven Development (TDD) principles for building the informal planner as specified in the design document. Each component will be developed with tests written first, followed by implementation to make tests pass.

## Approach and Rules

### TDD Approach
1. Write failing tests first (RED)
2. Implement code to make tests pass (GREEN)
3. No refactor step - get it right first time

### Testing Rules
- **Unit Tests**: Test individual components in isolation (mocks allowed)
- **Integration Tests**: Test real component interactions (NO MOCKS)
- **All tests must use real ToolRegistry** when testing tool discovery
- **All tests must use real LLM client** when available for integration tests

### Implementation Rules
- **NO MOCKS in implementation code** - only in unit tests
- **NO FALLBACKS** - raise errors for failures
- **Direct integration** with ToolRegistry - no wrappers or bridges
- **Follow design document** exactly as specified

### Error Handling
- All errors must be thrown/raised
- No silent failures or fallbacks
- Clear error messages for debugging

---

## Phase 1: Core Data Structures and Types

### Step 1.1: Define Task Node Structure
- [ ] Write unit tests for task node structure validation
- [ ] Implement TaskNode class with required fields per design doc
- [ ] Test complexity enum values (SIMPLE/COMPLEX)
- [ ] Test ID generation and uniqueness

### Step 1.2: Define Hierarchy Structure  
- [ ] Write unit tests for hierarchy tree structure
- [ ] Implement TaskHierarchy class
- [ ] Test parent-child relationships
- [ ] Test tree traversal methods

### Step 1.3: Define Tool Discovery Result Structure
- [ ] Write unit tests for tool result structure
- [ ] Implement ToolDiscoveryResult type
- [ ] Test confidence score validation
- [ ] Test tool list structure

---

## Phase 2: Complexity Classifier

### Step 2.1: Create ComplexityClassifier Tests
- [ ] Write unit tests for classification logic
- [ ] Test SIMPLE classification scenarios
- [ ] Test COMPLEX classification scenarios
- [ ] Test edge cases and ambiguous tasks

### Step 2.2: Implement ComplexityClassifier
- [ ] Implement classification prompt generation
- [ ] Implement LLM response parsing
- [ ] Implement classification decision logic
- [ ] Ensure all tests pass

### Step 2.3: Integration Test ComplexityClassifier
- [ ] Write integration test with real LLM client
- [ ] Test classification accuracy on known examples
- [ ] Test reasoning extraction
- [ ] Verify no mocks used

---

## Phase 3: Task Decomposer

### Step 3.1: Create TaskDecomposer Unit Tests
- [ ] Write tests for single-level decomposition
- [ ] Test subtask generation
- [ ] Test I/O hint generation
- [ ] Test decomposition prompt formatting

### Step 3.2: Implement Basic TaskDecomposer
- [ ] Implement decomposition prompt generation
- [ ] Implement LLM response parsing
- [ ] Implement subtask extraction logic
- [ ] Ensure unit tests pass

### Step 3.3: Add Recursive Decomposition
- [ ] Write tests for recursive decomposition
- [ ] Test depth limiting
- [ ] Test COMPLEX task recursion
- [ ] Implement recursive decomposition logic

### Step 3.4: Integration Test TaskDecomposer
- [ ] Write integration test with real LLM
- [ ] Test end-to-end decomposition
- [ ] Test various goal complexities
- [ ] Verify proper hierarchy generation

---

## Phase 4: Tool Feasibility Checker

### Step 4.1: Create ToolFeasibilityChecker Tests
- [ ] Write unit tests for tool discovery interface
- [ ] Test confidence threshold logic
- [ ] Test feasibility determination
- [ ] Test tool list compilation

### Step 4.2: Implement ToolFeasibilityChecker
- [ ] Implement ToolRegistry integration
- [ ] Implement semantic search calls
- [ ] Implement feasibility assessment logic
- [ ] Ensure unit tests pass

### Step 4.3: Integration Test with Real ToolRegistry
- [ ] Write integration tests with real ToolRegistry
- [ ] Test tool discovery for various tasks
- [ ] Test confidence score accuracy
- [ ] Verify NO MOCKS used

---

## Phase 5: Decomposition Validator

### Step 5.1: Create DecompositionValidator Tests
- [ ] Write tests for hierarchy validation
- [ ] Test circular dependency detection
- [ ] Test completeness validation
- [ ] Test I/O consistency checks

### Step 5.2: Implement DecompositionValidator
- [ ] Implement structure validation
- [ ] Implement dependency checking
- [ ] Implement feasibility aggregation
- [ ] Ensure all validation tests pass

### Step 5.3: Integration Test Validator
- [ ] Write integration tests for full hierarchies
- [ ] Test valid decomposition scenarios
- [ ] Test invalid decomposition detection
- [ ] Verify error reporting accuracy

---

## Phase 6: Informal Planner Orchestrator

### Step 6.1: Create InformalPlanner Unit Tests
- [ ] Write tests for orchestration logic
- [ ] Test component coordination
- [ ] Test output structure generation
- [ ] Test statistics calculation

### Step 6.2: Implement InformalPlanner
- [ ] Implement main plan() method
- [ ] Implement component coordination
- [ ] Implement output assembly
- [ ] Ensure unit tests pass

### Step 6.3: End-to-End Integration Tests
- [ ] Write comprehensive integration tests
- [ ] Test complete flow with real LLM and ToolRegistry
- [ ] Test various goal complexities
- [ ] Test error conditions

---

## Phase 7: Error Handling and Edge Cases

### Step 7.1: Test Error Conditions
- [ ] Write tests for LLM failures
- [ ] Test ToolRegistry unavailability
- [ ] Test malformed responses
- [ ] Test depth limit exceeded

### Step 7.2: Implement Error Handling
- [ ] Implement proper error throwing
- [ ] Add descriptive error messages
- [ ] Ensure NO FALLBACKS
- [ ] Verify all error tests pass

---

## Phase 8: Comprehensive Testing Suite

### Step 8.1: Unit Test Coverage
- [ ] Achieve 100% unit test coverage
- [ ] Test all public methods
- [ ] Test all error paths
- [ ] Test all edge cases

### Step 8.2: Integration Test Scenarios
- [ ] Test "Build REST API" scenario
- [ ] Test "Create authentication system" scenario
- [ ] Test "Data processing pipeline" scenario
- [ ] Test infeasible task detection

### Step 8.3: Live Testing with Real Services
- [ ] Test with production ToolRegistry
- [ ] Test with production LLM (Anthropic/OpenAI)
- [ ] Test various domains
- [ ] Verify NO MOCKS in any integration test

---

## Phase 9: Output Validation

### Step 9.1: Test Output Structure
- [ ] Verify hierarchy structure per design doc
- [ ] Verify tool annotations on SIMPLE tasks
- [ ] Verify statistics accuracy
- [ ] Verify validation results

### Step 9.2: Test Output Guarantees
- [ ] Test complete decomposition guarantee
- [ ] Test tool annotation guarantee
- [ ] Test feasibility assessment guarantee
- [ ] Test reasoning transparency guarantee

---

## Phase 10: Final Integration

### Step 10.1: Create Full System Test
- [ ] Write test for complete informal planning flow
- [ ] Include all components working together
- [ ] Use real ToolRegistry and LLM
- [ ] Test multiple complex scenarios

### Step 10.2: UAT Preparation
- [ ] Create example usage scripts
- [ ] Test with real-world goals
- [ ] Verify output usability for formal planner
- [ ] Ensure all tests remain green

---

## Success Criteria

The implementation is complete when:
1. All boxes above are checked ✅
2. All tests pass (unit and integration)
3. NO MOCKS exist in implementation code
4. NO FALLBACKS exist - all errors raised properly
5. Integration tests use real ToolRegistry and LLM
6. Output matches design document specification exactly

## Test File Organization

```
__tests__/
├── unit/
│   ├── ComplexityClassifier.test.js
│   ├── TaskDecomposer.test.js
│   ├── ToolFeasibilityChecker.test.js
│   ├── DecompositionValidator.test.js
│   └── InformalPlanner.test.js
└── integration/
    ├── ComplexityClassifierLive.test.js
    ├── TaskDecomposerLive.test.js
    ├── ToolFeasibilityLive.test.js
    └── InformalPlannerE2E.test.js
```

## Component File Organization

```
src/core/informal/
├── InformalPlanner.js           # Main orchestrator
├── ComplexityClassifier.js      # SIMPLE vs COMPLEX logic
├── TaskDecomposer.js           # Recursive decomposition
├── ToolFeasibilityChecker.js   # Tool discovery & validation
├── DecompositionValidator.js   # Hierarchy validation
└── types/
    ├── TaskNode.js             # Task node structure
    └── TaskHierarchy.js        # Hierarchy structure
```

---

This plan ensures comprehensive testing and correct implementation on first attempt, with no mocks in production code and proper error handling throughout.