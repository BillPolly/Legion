# ShowMe Module Implementation Plan

## Overview

This implementation plan follows a **Test-Driven Development (TDD) approach without refactoring phases** - we aim to get the implementation right on the first try. The plan focuses exclusively on **functional correctness** for MVP delivery.

## Implementation Rules

### Core Principles
1. **TDD Without Refactor**: Write test → Write minimal code to pass → Move to next test
2. **Get It Right First Time**: Design implementation carefully to avoid refactoring needs
3. **Comprehensive Testing**: Every component must have both unit and integration tests
4. **MVP Focus**: Only functional correctness matters - no NFRs (security, performance, etc.)

### Strict Requirements
- ✅ **NO MOCKS in integration tests** - All integration tests use real dependencies
- ✅ **NO MOCKS in implementation code** - Never mock anything in production code
- ✅ **NO FALLBACKS** - Always fail fast with clear error messages
- ✅ **FAIL FAST** - Raise errors immediately when conditions are not met
- ✅ **Local/UAT only** - No publishing, deployment, or production concerns

### Testing Strategy
- **Unit Tests**: Test individual classes/functions in isolation (mocks allowed here only)
- **Integration Tests**: Test component interactions with real dependencies (NO MOCKS)
- **End-to-End Tests**: Test complete workflow from tool call to UI display (NO MOCKS)

## Implementation Phases

### Phase 1: Foundation & Core Detection
**Objective**: Establish basic module structure and asset detection capabilities

#### 1.1 Project Setup
- [x] Set up Jest test configuration with ES6 modules support
- [x] Create basic module structure following Legion patterns
- [x] Set up test utilities and helpers (no mocks for integration)
- [x] Verify all dependencies are correctly configured

#### 1.2 Asset Detection System
- [x] Write unit tests for AssetTypeDetector class
- [x] Implement AssetTypeDetector with all detection methods
- [x] Write integration tests for detection with real asset samples
- [x] Verify detection accuracy across all supported asset types

#### 1.3 Core Module Framework
- [x] Write unit tests for ShowMeModule class
- [x] Implement ShowMeModule class with tool registration
- [x] Write integration tests for module loading and initialization
- [x] Verify module integrates correctly with Legion module system

**Phase 1 Progress**: ✅ 12/12 steps complete (100%)

### Phase 2: Tool Implementation
**Objective**: Implement the core ShowMeTool with full functionality

#### 2.1 Tool Interface
- [x] Write unit tests for ShowMeTool input validation
- [x] Write unit tests for ShowMeTool schema compliance
- [x] Implement ShowMeTool class with input/output handling
- [x] Write integration tests for tool execution with real assets

#### 2.2 Tool-Server Communication
- [x] Write unit tests for server management functionality
- [x] Write unit tests for asset transmission logic
- [x] Implement server startup and communication methods
- [x] Write integration tests for tool-server interaction (no mocks)

#### 2.3 Tool Error Handling
- [x] Write unit tests for all error scenarios
- [x] Implement comprehensive error handling with fail-fast approach
- [x] Write integration tests for error propagation
- [x] Verify error messages are clear and actionable

**Phase 2 Progress**: ✅ 12/12 steps complete (100%)

### Phase 3: Server Infrastructure
**Objective**: Build the ShowMe server using ConfigurableActorServer

#### 3.1 Server Setup
- [x] Write unit tests for ShowMeServer configuration
- [x] Write unit tests for server initialization logic
- [x] Implement ShowMeServer class extending ConfigurableActorServer
- [x] Write integration tests for server startup and configuration *(completed via ToolServerInteraction.test.js)*

#### 3.2 Asset Storage & API
- [x] Write unit tests for asset storage functionality
- [x] Write unit tests for API endpoint handlers
- [x] Implement asset storage and retrieval system
- [x] Write integration tests for API endpoints with real HTTP requests *(completed via ToolServerInteraction.test.js)*

#### 3.3 Actor System Integration
- [x] Write unit tests for ShowMeServerActor protocol compliance
- [x] Implement ShowMeServerActor with message handling
- [x] Write integration tests for server actor communication
- [x] Verify protocol contract enforcement and validation

**Phase 3 Progress**: ✅ 12/12 steps complete (100%)

### Phase 4: UI Client Implementation
**Objective**: Build the client-side UI system for asset display

#### 4.1 Client Actor
- [x] Write unit tests for ShowMeClientActor protocol compliance
- [x] Write unit tests for client actor message handling
- [x] Implement ShowMeClientActor with server communication
- [x] Write integration tests for client-server actor communication (real WebSocket)

#### 4.2 Asset Display Manager
- [x] Write unit tests for AssetDisplayManager window management
- [x] Write unit tests for viewer creation logic
- [x] Implement AssetDisplayManager extending ResourceWindowManager
- [x] Write integration tests for display manager with real Legion components

#### 4.3 Viewer Implementations
- [x] Write unit tests for each viewer type (Image, Code, JSON, Data, Web)
- [x] Implement all viewer creation methods
- [x] Write integration tests for viewers with real Legion components
- [x] Verify each viewer displays assets correctly in actual windows

**Phase 4 Progress**: ✅ 12/12 steps complete (100%)

### Phase 5: Integration & End-to-End Testing
**Objective**: Verify complete system integration and workflow

#### 5.1 Component Integration
- [x] Write integration tests for Tool → Server communication (real HTTP)
- [x] Write integration tests for Server → Client actor communication (real WebSocket)
- [x] Write integration tests for Client → UI component flow (real DOM)
- [x] Verify all components work together without mocks

#### 5.2 Complete Workflow Testing
- [x] Write end-to-end tests for image asset display workflow
- [x] Write end-to-end tests for code asset display workflow  
- [x] Write end-to-end tests for JSON asset display workflow
- [x] Write end-to-end tests for data asset display workflow

#### 5.3 Error Scenario Testing
- [x] Write integration tests for server unavailable scenarios
- [x] Write integration tests for invalid asset scenarios
- [x] Write integration tests for component loading failures
- [x] Verify all error paths fail fast with clear messages

#### 5.4 Multi-Asset Scenarios
- [ ] Write integration tests for concurrent asset display
- [ ] Write integration tests for multiple window management
- [ ] Write integration tests for asset type switching
- [ ] Verify system handles complex real-world usage patterns

**Phase 5 Progress**: ✅ 12/16 steps complete (75%)

### Phase 6: Tool Registry Integration
**Objective**: Integrate ShowMe tool with Legion tool registry system

#### 6.1 Registry Integration
- [ ] Write unit tests for module registration process
- [ ] Write unit tests for tool discovery functionality
- [ ] Implement complete module registration with tool registry
- [ ] Write integration tests for tool registry discovery (real registry)

#### 6.2 Tool Execution Integration
- [ ] Write integration tests for tool execution via registry (real execution)
- [ ] Write integration tests for tool result handling
- [ ] Verify tool works identically whether called directly or via registry
- [ ] Write integration tests for concurrent tool executions

#### 6.3 Agent Integration Testing
- [ ] Write integration tests simulating agent tool usage patterns
- [ ] Write integration tests for various asset types from agents
- [ ] Verify tool interface meets agent workflow requirements
- [ ] Test tool usage in realistic agent automation scenarios

**Phase 6 Progress**: ⬜ 0/12 steps complete (0%)

### Phase 7: System Validation & UAT Preparation
**Objective**: Validate complete system functionality for UAT readiness

#### 7.1 Comprehensive System Testing
- [ ] Run complete test suite and verify 100% pass rate
- [ ] Test all asset types with real-world sample files
- [ ] Verify error handling in all failure scenarios
- [ ] Test system resource usage and basic performance

#### 7.2 UAT Scenario Testing
- [ ] Test ShowMe with real agent-generated assets
- [ ] Test ShowMe with various file formats and data structures
- [ ] Test ShowMe with edge cases and boundary conditions
- [ ] Verify system stability under typical usage patterns

#### 7.3 Integration Verification
- [ ] Verify integration with existing Legion tools and modules
- [ ] Test ShowMe in context of complete Legion agent workflows
- [ ] Verify no conflicts with other Legion components
- [ ] Confirm MVP functionality meets all design requirements

**Phase 7 Progress**: ⬜ 0/12 steps complete (0%)

## Testing Requirements Summary

### Unit Tests Required
- AssetTypeDetector (all detection methods) ✅
- ShowMeTool (interface, validation, execution) ✅
- ShowMeServer (configuration, initialization, API) ✅
- ShowMeServerActor (protocol compliance, message handling) ✅
- ShowMeClientActor (protocol compliance, message handling) ✅
- AssetDisplayManager (window management, viewer creation) ✅
- All viewer implementations (Image, Code, JSON, Data, Web) ✅

### Integration Tests Required
- Asset detection with real asset samples ✅
- Tool execution with real server communication ⬜
- Server-client actor communication with real WebSocket ⬜
- UI component integration with real Legion components ⬜
- Complete workflow testing with real dependencies ⬜
- Error scenario testing with real failure conditions ⬜

### End-to-End Tests Required
- Complete agent → tool → server → client → UI workflow
- Multiple asset type display scenarios
- Concurrent asset display scenarios
- Error recovery scenarios

## Success Criteria

### MVP Completion Criteria
- [ ] All 88 implementation steps completed with green ticks
- [ ] 100% test pass rate across all test suites
- [ ] Successfully displays all supported asset types (image, code, JSON, data, web)
- [ ] Integrates seamlessly with Legion tool registry
- [ ] Fails fast with clear error messages in all failure scenarios
- [ ] No mocks used in integration tests or implementation code
- [ ] Ready for UAT with real agent workflows

**Total Progress**: ✅ 60/88 steps complete (68.2%)

---

*Note: This implementation plan focuses exclusively on functional correctness for MVP delivery. No NFRs, deployment concerns, or production optimizations are included.*