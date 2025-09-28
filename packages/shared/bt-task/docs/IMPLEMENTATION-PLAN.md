# BT-Task Implementation Plan

## Overview

This plan follows a Test-Driven Development (TDD) approach without the refactor step - we aim to get it right first time. Implementation proceeds in phases, each building on the previous to create progressively more complete functionality. At each phase completion, we have working, tested code that demonstrates value.

## Core Rules

1. **TDD Approach**: Write tests first, then implementation to pass tests
2. **No Mocks in Integration Tests**: All integration tests use real components
3. **No Mocks in Implementation**: Implementation code never contains mocks
4. **No Fallbacks**: Errors are raised immediately, fail fast
5. **Reference Design**: Always refer to DESIGN.md for specifications
6. **Testing Coverage**: Every component has unit and integration tests
7. **Functional Correctness Only**: MVP focuses only on correct functionality

## Implementation Approach

Each phase builds upon the previous, creating a working system at each stage:
- Phase 1: Core infrastructure (BTTaskStrategy base)
- Phase 2: Basic node types (Sequence, Action)
- Phase 3: Control flow nodes (Selector, Condition)
- Phase 4: Advanced features (Retry, BTExecutor)
- Phase 5: Integration and tools

At the start of each phase, the design document must be re-read to ensure alignment.

---

## Phase 1: Core Infrastructure
**Goal**: Establish BTTaskStrategy base and factory pattern

✅ **Step 1.1**: Re-read DESIGN.md document

✅ **Step 1.2**: Create package structure
- Create package.json with dependencies (@legion/tasks)
- Create jest.config.js for ES6 modules
- Create src/index.js with initial exports
- Verify package can be imported

✅ **Step 1.3**: Write BTTaskStrategy base tests
- Test that BTTaskStrategy extends TaskStrategy
- Test onMessage routing for BT messages
- Test getNodeStatus mapping
- Test resolveParameters with @ syntax

✅ **Step 1.4**: Implement BTTaskStrategy
- Create src/core/BTTaskStrategy.js
- Implement onMessage with BT routing
- Implement executeBTNode stub
- Implement getNodeStatus mapping
- Implement resolveParameters

✅ **Step 1.5**: Write createBTTask factory tests
- Test task creation with BT strategy
- Test configuration attachment
- Test parent-child relationships

✅ **Step 1.6**: Implement createBTTask factory
- Create src/factory/createBTTask.js
- Use createTask from @legion/tasks
- Add BT-specific configuration

✅ **Step 1.7**: Integration test for basic BT task
- Test creating a BT task with BTTaskStrategy
- Test message passing between BT tasks
- Test artifact storage and retrieval

---

## Phase 2: Basic Node Types
**Goal**: Implement Sequence and Action strategies for core functionality

✅ **Step 2.1**: Re-read DESIGN.md document

✅ **Step 2.2**: Write SequenceStrategy unit tests
- Test sequential child execution
- Test fail-fast on child failure
- Test success when all children succeed
- Test child result handling

✅ **Step 2.3**: Implement SequenceStrategy
- Create src/strategies/SequenceStrategy.js
- Implement executeChildren for sequential execution
- Implement handleChildResult with fail-fast
- Track execution state

✅ **Step 2.4**: Write ActionStrategy unit tests
- Test tool execution
- Test parameter resolution from artifacts
- Test output variable storage
- Test success/failure mapping

✅ **Step 2.5**: Implement ActionStrategy
- Create src/strategies/ActionStrategy.js
- Implement executeBTNode for tool execution
- Implement parameter resolution
- Store results in artifacts

✅ **Step 2.6**: Integration test for Sequence with Actions
- Create test with real ToolRegistry
- Test sequence of action executions
- Test artifact flow between actions
- Test failure propagation

---

## Phase 3: Control Flow Nodes
**Goal**: Add Selector and Condition strategies for branching logic

✅ **Step 3.1**: Re-read DESIGN.md document

✅ **Step 3.2**: Write SelectorStrategy unit tests
- Test trying alternatives until success
- Test failure when all children fail
- Test stopping on first success

✅ **Step 3.3**: Implement SelectorStrategy
- Create src/strategies/SelectorStrategy.js
- Implement executeChildren for alternatives
- Implement handleChildResult
- Stop on first success

✅ **Step 3.4**: Write ConditionStrategy unit tests
- Test condition evaluation
- Test execution when condition true
- Test skipping when condition false
- Test artifact references in conditions

✅ **Step 3.5**: Implement ConditionStrategy
- Create src/strategies/ConditionStrategy.js
- Implement condition evaluation
- Execute children conditionally
- Support @ syntax in conditions

✅ **Step 3.6**: Integration test for complex trees
- Test Sequence with nested Selector
- Test Condition nodes with artifact checks
- Test mixed node type trees
- Verify correct execution flow

---

## Phase 4: Advanced Features
**Goal**: Add RetryStrategy and BTExecutor for complete functionality

✅ **Step 4.1**: Re-read DESIGN.md document

✅ **Step 4.2**: Write RetryStrategy unit tests
- Test retry on failure
- Test max retry limit
- Test success stops retries
- Test retry delay configuration

✅ **Step 4.3**: Implement RetryStrategy
- Create src/strategies/RetryStrategy.js
- Implement retry logic
- Track retry attempts
- Handle max retries

✅ **Step 4.4**: Write BTExecutor tests
- Test tree configuration loading
- Test recursive child initialization
- Test tool binding for action nodes
- Test execution completion tracking

✅ **Step 4.5**: Implement BTExecutor
- Create src/core/BTExecutor.js
- Implement executeTree method
- Implement initializeChildren recursively
- Bind tools at creation time
- Track execution completion

✅ **Step 4.6**: Integration test for BTExecutor
- Test executing complete tree configurations
- Test with mock tools (avoiding database dependencies)
- Test artifact flow through tree
- Test various tree structures

---

## Phase 5: Integration and Tools
**Goal**: Complete integration with tool system and configuration loading

✅ **Step 5.1**: Re-read DESIGN.md document

✅ **Step 5.2**: Write BTLoader tests
- Test loading JSON configurations
- Test validation of configurations
- Test node type mapping

✅ **Step 5.3**: Implement BTLoader
- Create src/integration/BTLoader.js
- Parse JSON configurations
- Validate structure
- Create tree from config

✅ **Step 5.4**: Write BTTool tests
- Test exposing BT as tool
- Test tool metadata generation
- Test execution through tool interface

✅ **Step 5.5**: Implement BTTool
- Create src/integration/BTTool.js
- Wrap BT execution as tool
- Generate metadata
- Handle tool protocol

✅ **Step 5.6**: End-to-end integration tests
- Test complete workflows with mock tools
- Test complex tree configurations
- Test artifact flow end-to-end
- Test error propagation
- Test all node types together

✅ **Step 5.7**: Update package exports
- Update src/index.js with all exports
- Verify all components accessible
- Test package can be imported and used

---

## Completion Criteria

Each phase is complete when:
1. All unit tests pass
2. All integration tests pass
3. Code follows design specifications
4. No mocks in tests or implementation
5. Errors raised without fallbacks

The implementation is complete when all phases are marked with ✅ and the package provides full BT functionality as tasks per the design document.

## Testing Standards

**Unit Tests**: Test individual strategies and components in isolation
**Integration Tests**: Test real component interactions without mocks
**End-to-End Tests**: Test complete workflows with actual tools

All tests use Jest with ES6 modules configuration. Tests go in `__tests__/` directory with `unit/` and `integration/` subdirectories.