# ProjectPlannerStrategy Implementation Plan

## Overview

This document outlines the Test-Driven Development (TDD) implementation plan for the ProjectPlannerStrategy as specified in PROJECT_PLANNER_DESIGN.md. The implementation follows a phased approach with comprehensive unit and integration testing at each step.

## Implementation Approach

### Core Principles
1. **TDD Without Refactor**: Write tests first, implement to pass, get it right the first time
2. **No Mocks in Integration Tests**: Use real services for integration testing
3. **No Fallbacks**: Fail fast with clear error messages
4. **Single Responsibility**: Each component has one clear purpose
5. **Progressive Enhancement**: Build incrementally with working code at each step

### Technical Rules
- **ResourceManager**: All environment variables accessed through ResourceManager singleton
- **Error Handling**: No fallbacks, raise errors immediately
- **Testing**: Jest for all tests, no test skipping
- **Dependencies**: Use existing Legion packages, no duplication
- **Code Style**: Clean architecture and clean code principles

## Phase 1: Foundation Setup
**Goal**: Establish core infrastructure and basic component structure

- [ ] **Step 1.1**: Re-read PROJECT_PLANNER_DESIGN.md
- [ ] **Step 1.2**: Create test structure and directories
  - Create `__tests__/unit/strategies/coding/ProjectPlannerStrategy.test.js`
  - Create `__tests__/integration/strategies/coding/ProjectPlannerStrategy.integration.test.js`
  - Create test fixtures directory structure
  
- [ ] **Step 1.3**: Write unit tests for ProjectPlannerStrategy constructor and initialization
  - Test constructor with various option combinations
  - Test getName() returns 'ProjectPlanner'
  - Test initialize() sets up all required components
  - Test error handling for missing dependencies

- [ ] **Step 1.4**: Implement ProjectPlannerStrategy base class
  - Create `src/strategies/coding/ProjectPlannerStrategy.js`
  - Implement constructor with options handling
  - Implement getName() method
  - Implement initialize() method with component setup
  - Ensure all tests pass

## Phase 2: Requirements Analyzer Component
**Goal**: Build the requirements analysis system

- [ ] **Step 2.1**: Re-read PROJECT_PLANNER_DESIGN.md Section 2.2 (Requirements Analyzer)
- [ ] **Step 2.2**: Write unit tests for RequirementsAnalyzer
  - Test project type detection (api, web, cli, library)
  - Test feature extraction from natural language
  - Test constraint identification
  - Test technology stack inference
  - Test error handling for ambiguous requirements

- [ ] **Step 2.3**: Implement RequirementsAnalyzer class
  - Create `src/strategies/coding/components/RequirementsAnalyzer.js`
  - Implement analyze() method with LLM integration
  - Implement parsing logic for structured extraction
  - Ensure all unit tests pass

- [ ] **Step 2.4**: Write integration tests for RequirementsAnalyzer
  - Test with real LLM client
  - Test various project descriptions
  - Verify output format matches schema

## Phase 3: Project Structure Planner Component
**Goal**: Implement project planning and structure generation

- [ ] **Step 3.1**: Re-read PROJECT_PLANNER_DESIGN.md Section 2.2 (Project Structure Planner)
- [ ] **Step 3.2**: Write unit tests for ProjectStructurePlanner
  - Test directory structure generation
  - Test file organization planning
  - Test module boundary definition
  - Test dependency graph creation
  - Test plan versioning

- [ ] **Step 3.3**: Implement ProjectStructurePlanner class
  - Create `src/strategies/coding/components/ProjectStructurePlanner.js`
  - Implement createPlan() method
  - Implement structure generation logic
  - Implement phase breakdown (setup, core, features, testing, integration)
  - Ensure all unit tests pass

- [ ] **Step 3.4**: Write integration tests for ProjectStructurePlanner
  - Test plan generation with real requirements
  - Test phase dependencies
  - Verify plan schema compliance

## Phase 4: State Management System
**Goal**: Build persistent state management

- [ ] **Step 4.1**: Re-read PROJECT_PLANNER_DESIGN.md Section 3.1 (Project State Schema)
- [ ] **Step 4.2**: Write unit tests for StateManager
  - Test state creation and initialization
  - Test state persistence to JSON
  - Test state loading from disk
  - Test state updates and versioning
  - Test rollback capabilities

- [ ] **Step 4.3**: Implement StateManager class
  - Create `src/strategies/coding/components/StateManager.js`
  - Implement loadOrCreate() method
  - Implement save() and update() methods
  - Implement state versioning
  - Ensure all unit tests pass

- [ ] **Step 4.4**: Write integration tests for StateManager
  - Test concurrent state updates
  - Test state recovery after failure
  - Test large state handling

## Phase 5: Execution Orchestrator
**Goal**: Implement task execution and coordination

- [ ] **Step 5.1**: Re-read PROJECT_PLANNER_DESIGN.md Section 4.2 (Task Execution Algorithm)
- [ ] **Step 5.2**: Write unit tests for ExecutionOrchestrator
  - Test single task execution
  - Test dependency resolution
  - Test retry logic with backoff
  - Test error classification
  - Test strategy selection

- [ ] **Step 5.3**: Implement ExecutionOrchestrator class
  - Create `src/strategies/coding/components/ExecutionOrchestrator.js`
  - Implement execute() method
  - Implement dependency waiting
  - Implement retry mechanisms
  - Ensure all unit tests pass

- [ ] **Step 5.4**: Write integration tests for ExecutionOrchestrator
  - Test with real sub-strategies
  - Test task failure and recovery
  - Test artifact generation

## Phase 6: Parallel Execution Engine
**Goal**: Enable concurrent task execution

- [ ] **Step 6.1**: Re-read PROJECT_PLANNER_DESIGN.md Section 4.3 (Parallel Execution Engine)
- [ ] **Step 6.2**: Write unit tests for ParallelExecutor
  - Test concurrent task limits
  - Test dependency-aware scheduling
  - Test task queue management
  - Test completion tracking

- [ ] **Step 6.3**: Implement ParallelExecutor class
  - Create `src/strategies/coding/components/ParallelExecutor.js`
  - Implement executeTasks() method
  - Implement canExecute() dependency checking
  - Implement selectNextTask() prioritization
  - Ensure all unit tests pass

- [ ] **Step 6.4**: Write integration tests for ParallelExecutor
  - Test parallel execution performance
  - Test complex dependency graphs
  - Test resource contention handling

## Phase 7: Quality Controller
**Goal**: Implement validation and quality assurance

- [ ] **Step 7.1**: Re-read PROJECT_PLANNER_DESIGN.md Section 6 (Quality Assurance)
- [ ] **Step 7.2**: Write unit tests for QualityController
  - Test syntax validation
  - Test requirements validation
  - Test quality metrics calculation
  - Test gate enforcement
  - Test continuous validation

- [ ] **Step 7.3**: Implement QualityController class
  - Create `src/strategies/coding/components/QualityController.js`
  - Implement validateProject() method
  - Implement quality gate checks
  - Implement continuous validation
  - Ensure all unit tests pass

- [ ] **Step 7.4**: Write integration tests for QualityController
  - Test with real generated code
  - Test test execution validation
  - Test coverage analysis

## Phase 8: Progress Tracking
**Goal**: Build progress monitoring system

- [ ] **Step 8.1**: Re-read PROJECT_PLANNER_DESIGN.md Section 2.2 (Progress Tracker)
- [ ] **Step 8.2**: Write unit tests for ProgressTracker
  - Test progress calculation
  - Test phase tracking
  - Test completion estimates
  - Test metrics collection

- [ ] **Step 8.3**: Implement ProgressTracker class
  - Create `src/strategies/coding/components/ProgressTracker.js`
  - Implement update() method
  - Implement getProgress() method
  - Implement metrics aggregation
  - Ensure all unit tests pass

## Phase 9: Error Recovery System
**Goal**: Implement error handling and recovery

- [ ] **Step 9.1**: Re-read PROJECT_PLANNER_DESIGN.md Section 7 (Error Handling and Recovery)
- [ ] **Step 9.2**: Write unit tests for RecoveryManager
  - Test error classification
  - Test recovery strategy selection
  - Test replanning logic
  - Test rollback mechanisms

- [ ] **Step 9.3**: Implement RecoveryManager class
  - Create `src/strategies/coding/components/RecoveryManager.js`
  - Implement recover() method
  - Implement replanTask() method
  - Implement error classification
  - Ensure all unit tests pass

- [ ] **Step 9.4**: Write integration tests for RecoveryManager
  - Test automatic recovery scenarios
  - Test replanning with constraints
  - Test cascading failure handling

## Phase 10: Strategy Integration
**Goal**: Connect all components into cohesive strategy

- [ ] **Step 10.1**: Re-read PROJECT_PLANNER_DESIGN.md Section 8.1 (Complete Implementation Structure)
- [ ] **Step 10.2**: Write integration tests for complete ProjectPlannerStrategy
  - Test onParentMessage handlers
  - Test complete project execution flow
  - Test state persistence across execution
  - Test artifact management

- [ ] **Step 10.3**: Implement main strategy orchestration
  - Implement onParentMessage() handlers
  - Implement _planAndExecuteProject() method
  - Implement _reportStatus() method
  - Implement _cancelExecution() method
  - Wire all components together
  - Ensure all integration tests pass

## Phase 11: End-to-End Testing
**Goal**: Validate complete system functionality

- [ ] **Step 11.1**: Re-read PROJECT_PLANNER_DESIGN.md Section 10.2 (Integration Testing)
- [ ] **Step 11.2**: Write end-to-end tests for various project types
  - Test Express API creation
  - Test CLI tool creation
  - Test library creation
  - Test web application creation

- [ ] **Step 11.3**: Write performance tests
  - Test parallel execution efficiency
  - Test large project handling
  - Test resource usage

- [ ] **Step 11.4**: Write stress tests
  - Test error recovery under load
  - Test concurrent project execution
  - Test state management under stress

## Phase 12: Monitoring and Observability
**Goal**: Add comprehensive monitoring

- [ ] **Step 12.1**: Re-read PROJECT_PLANNER_DESIGN.md Section 9 (Monitoring and Observability)
- [ ] **Step 12.2**: Write unit tests for EventStream
  - Test event emission
  - Test listener management
  - Test event persistence

- [ ] **Step 12.3**: Implement EventStream class
  - Create `src/strategies/coding/components/EventStream.js`
  - Implement emit() method
  - Implement listener registration
  - Ensure all unit tests pass

- [ ] **Step 12.4**: Integrate monitoring into all components
  - Add event emissions to key operations
  - Add metrics collection
  - Test event flow

## Phase 13: Final Integration and Validation
**Goal**: Complete system integration and validation

- [ ] **Step 13.1**: Re-read entire PROJECT_PLANNER_DESIGN.md
- [ ] **Step 13.2**: Run complete test suite
  - Ensure 100% test pass rate
  - Review test coverage
  - Fix any failing tests

- [ ] **Step 13.3**: Create demonstration projects
  - Create Express API project
  - Create Node.js CLI tool
  - Validate generated code quality

- [ ] **Step 13.4**: Performance validation
  - Measure execution times
  - Validate parallel execution benefits
  - Check resource usage

## Testing Standards

### Unit Tests
- Test each method in isolation
- Cover all code paths
- Test error conditions
- No external dependencies

### Integration Tests  
- Use real LLM client
- Use real ToolRegistry
- Test component interactions
- NO MOCKS

### End-to-End Tests
- Test complete workflows
- Validate generated artifacts
- Test real project creation
- Verify code execution

## Success Criteria

1. All tests passing (100% pass rate)
2. Generated projects are functional
3. Error recovery works automatically
4. Parallel execution improves performance
5. State persistence and recovery functional
6. Quality gates enforce standards
7. Monitoring provides visibility

## Notes

- Always refer to PROJECT_PLANNER_DESIGN.md for specifications
- Re-read design document at the start of each phase
- Update this plan with checkmarks as steps complete
- NO MOCKS in implementation code
- NO FALLBACKS - fail fast with errors
- Use ResourceManager for all configuration
- Follow Clean Architecture principles