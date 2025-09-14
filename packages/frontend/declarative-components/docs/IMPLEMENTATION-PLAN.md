# Declarative Components Implementation Plan

## Overview

This document outlines the Test-Driven Development (TDD) implementation plan for the Declarative Components system as specified in the DESIGN.md document. The implementation will follow TDD methodology without the refactor step, aiming to get the implementation correct on the first attempt.

### Core Principles

1. **TDD Approach**: Write tests first, then implement to make tests pass
2. **No Refactor Step**: Get implementation right first time
3. **Comprehensive Testing**: Both unit and integration tests for all functionality
4. **No Mocks in Integration Tests**: All integration tests use real components
5. **No Mocks in Implementation**: Implementation code never contains mock objects
6. **No Fallbacks**: Raise errors instead of providing fallbacks
7. **MVP Focus**: Functional correctness only, no NFRs (security, performance, migration)
8. **Local Running**: No deployment or publishing concerns

### Testing Strategy

- **Unit Tests**: Test individual components in isolation
- **Integration Tests**: Test complete system with real DataStore and DOM
- **Test Location**: All tests in `__tests__` directory
- **Test Framework**: Jest with ES6 modules
- **Real Resources**: Integration tests use real DataStore, real DOM elements
- **Error Testing**: Verify proper error raising, no silent failures

## Phase 1: Core Infrastructure ✅

### Step 1.1: Project Setup ✅
- [x] Create package.json with dependencies
- [x] Configure Jest for ES6 modules
- [x] Set up test directory structure
- [x] Create index.js entry point

### Step 1.2: Handle Extension for DOM ✅
- [x] Write tests for DOMElementProxy extending Handle
- [x] Implement DOMElementProxy class
- [x] Write tests for element projection methods
- [x] Implement projection methods (div, span, etc.)
- [x] Write tests for event stream properties
- [x] Implement event stream getters (clicks, values, etc.)

### Step 1.3: DOM Projection System ✅
- [x] Write tests for parent-child projection
- [x] Implement projection from parent elements
- [x] Write tests for element creation via projection
- [x] Implement element factory methods
- [x] Write tests for projection hierarchy
- [x] Implement hierarchy tracking

## Phase 2: DSL Parser

### Step 2.1: Template Literal Parser Setup ✅
- [x] Write tests for template literal tag function
- [x] Implement component tag function
- [x] Write tests for string interpolation handling
- [x] Implement expression extraction

### Step 2.2: Component Declaration Parser ✅
- [x] Write tests for component signature parsing
- [x] Implement component name and parameter extraction
- [x] Write tests for component body parsing
- [x] Implement body structure analysis

### Step 2.3: Element Structure Parser ✅
- [x] Write tests for element declaration syntax
- [x] Implement element type parsing
- [x] Write tests for class and id parsing
- [x] Implement selector extraction
- [x] Write tests for attribute parsing
- [x] Implement attribute extraction

### Step 2.4: Children and Nesting Parser ✅
- [x] Write tests for children array syntax
- [x] Implement children parsing
- [x] Write tests for nested element structures
- [x] Implement recursive structure parsing

## Phase 3: Binding System ✅

### Step 3.1: Text Content Binding ✅
- [x] Write tests for text content binding syntax
- [x] Implement text binding parser
- [x] Write tests for expression evaluation
- [x] Implement expression to text binding

### Step 3.2: Attribute Binding ✅
- [x] Write tests for attribute binding syntax
- [x] Implement attribute binding parser
- [x] Write tests for dynamic attribute updates
- [x] Implement attribute binding execution

### Step 3.3: Two-Way Binding ✅
- [x] Write tests for two-way binding operator (<=>)
- [x] Implement bidirectional binding parser
- [x] Write tests for state-to-DOM sync
- [x] Implement state-to-DOM updates
- [x] Write tests for DOM-to-state sync
- [x] Implement DOM-to-state updates

### Step 3.4: Event Binding ✅
- [x] Write tests for event binding syntax (=>)
- [x] Implement event binding parser
- [x] Write tests for event handler execution
- [x] Implement event to action mapping
- [x] Write tests for event stream integration
- [x] Implement stream-based event handling

## Phase 4: Control Flow

### Step 4.1: Conditional Rendering ✅
- [x] Write tests for conditional syntax (? :)
- [x] Implement conditional parser
- [x] Write tests for condition evaluation
- [x] Implement conditional rendering logic
- [x] Write tests for branch switching
- [x] Implement dynamic branch updates

### Step 4.2: Iteration ✅
- [x] Write tests for iteration syntax (collection => item =>)
- [x] Implement iteration parser
- [x] Write tests for collection rendering
- [x] Implement list rendering logic
- [x] Write tests for dynamic list updates
- [x] Implement efficient list reconciliation

## Phase 5: Equation Solver ✅

### Step 5.1: Component Compiler ✅
- [x] Write tests for DSL to JSON compilation
- [x] Implement DSL compiler
- [x] Write tests for structure generation
- [x] Implement structure definition builder
- [x] Write tests for binding generation
- [x] Implement binding equation extraction

### Step 5.2: Equation Maintenance ✅
- [x] Write tests for equation solver initialization
- [x] Implement equation solver
- [x] Write tests for state subscription
- [x] Implement DataStore subscription
- [x] Write tests for DOM update propagation
- [x] Implement DOM update logic
- [x] Write tests for event propagation
- [x] Implement event to state updates

### Step 5.3: Subscription Management ✅
- [x] Write tests for subscription lifecycle
- [x] Implement subscription tracking
- [x] Write tests for cleanup on unmount
- [x] Implement cleanup logic
- [x] Write tests for memory leak prevention
- [x] Verify proper resource disposal

## Phase 6: DataStore Integration ✅

### Step 6.1: Entity Binding ✅
- [x] Write tests for entity proxy integration
- [x] Implement entity to component binding
- [x] Write tests for entity attribute access
- [x] Implement attribute value extraction
- [x] Write tests for entity updates
- [x] Implement entity update propagation

### Step 6.2: Query Integration ✅
- [x] Write tests for query result binding
- [x] Implement query to component binding
- [x] Write tests for query subscription
- [x] Implement reactive query updates
- [x] Write tests for collection queries
- [x] Implement collection rendering from queries

### Step 6.3: Transaction Integration ✅
- [x] Write tests for component-triggered transactions
- [x] Implement transaction generation from events
- [x] Write tests for batch updates
- [x] Implement atomic update batching

## Phase 7: Component Lifecycle ✅

### Step 7.1: Mounting ✅
- [x] Write tests for component mount
- [x] Implement mount logic
- [x] Write tests for initial render
- [x] Implement first render from state
- [x] Write tests for subscription setup
- [x] Implement initial subscriptions

### Step 7.2: Updates ✅
- [x] Write tests for automatic updates
- [x] Implement reactive update system
- [x] Write tests for minimal DOM updates
- [x] Implement efficient diff and patch
- [x] Write tests for concurrent updates
- [x] Implement update batching

### Step 7.3: Unmounting ✅
- [x] Write tests for component unmount
- [x] Implement unmount logic
- [x] Write tests for subscription cleanup
- [x] Implement subscription disposal
- [x] Write tests for DOM cleanup
- [x] Implement element removal

## Phase 8: Integration Testing ✅

### Step 8.1: Complete Component Tests ✅
- [x] Write integration test for UserCard component
- [x] Verify UserCard renders correctly
- [x] Write integration test for Counter component
- [x] Verify Counter state updates work
- [x] Write integration test for TodoList component
- [x] Verify TodoList CRUD operations

### Step 8.2: Complex Scenarios ✅
- [x] Write test for nested components
- [x] Verify component composition works
- [x] Write test for multiple component instances
- [x] Verify instance isolation
- [x] Write test for rapid state changes
- [x] Verify update efficiency

### Step 8.3: Error Scenarios ✅
- [x] Write test for invalid DSL syntax
- [x] Verify proper error messages
- [x] Write test for missing entity attributes
- [x] Verify error propagation
- [x] Write test for circular dependencies
- [x] Verify detection and error raising

## Phase 9: Full System Validation ✅

### Step 9.1: Todo App Implementation ✅
- [x] Write integration test for complete Todo app
- [x] Implement Todo app using declarative components
- [x] Verify all Todo features work
- [x] Test add, edit, delete, complete operations
- [x] Test filter functionality
- [x] Test persistence via DataStore

### Step 9.2: Performance Validation ✅
- [x] Write test for large list rendering
- [x] Verify acceptable render times
- [x] Write test for many simultaneous updates
- [x] Verify update batching works
- [x] Write test for memory usage
- [x] Verify no memory leaks

### Step 9.3: User Acceptance Testing ✅
- [x] Create UAT test scenarios
- [x] Run manual testing of all features
- [x] Verify developer experience
- [x] Test debugging capabilities
- [x] Validate error messages
- [x] Confirm all design requirements met

## Success Criteria

### Required for Completion

1. All test boxes checked (✓)
2. 100% test pass rate
3. No mock objects in code
4. No fallback behavior
5. Proper error raising
6. Todo app fully functional
7. All design document features implemented

### Test Coverage Requirements

- Unit test coverage: 100% of public APIs
- Integration test coverage: All user scenarios
- Error case coverage: All error conditions tested
- No skipped tests
- No disabled tests

## Notes

- This plan will be updated with green ticks (✓) as steps are completed
- Each step represents a test-first implementation cycle
- No step proceeds until its tests pass
- Integration tests use real DataStore and real DOM
- All temporary test artifacts go in `__tests__/tmp/`
- Run tests with `npm test` from package directory

---

*This document is a living plan and will be updated with progress markers as implementation proceeds.*