# AgentToolsModule - Implementation Plan

**TDD implementation plan for MVP AgentTools that integrate with transparent resource handle system**

## Overview

This implementation follows Test-Driven Development (TDD) methodology without the refactor phase - we aim to get it right first try. All implementation follows the architecture described in `DESIGN.md`.

## Implementation Rules

### Testing Rules
- **NO MOCKS in integration tests** - Use real resource handles, real actors, real UI components
- **NO MOCKS in implementation code** - Mocks only allowed in unit tests for isolated component testing
- **NO FALLBACKS** - All errors must be raised immediately, no graceful degradation
- **FAIL FAST** - If dependencies are unavailable, tests and code must fail immediately
- **Comprehensive Coverage** - Both unit tests (isolated) and integration tests (end-to-end with real resources)

### Development Rules
- **TDD Approach** - Write failing test, implement minimal code to pass, move to next test
- **No Refactor Phase** - Get implementation right on first attempt
- **MVP Focus** - Only functional correctness, no NFRs (security, performance, migration)
- **Local Development** - No deployment, publishing, or production concerns
- **Context-First Pattern** - ALL AgentTools must take context as first parameter

## Implementation Phases

### Phase 1: Core AgentTools Infrastructure
**Foundation components for AgentTools module and tool base classes**

- [✅] Create AgentToolsModule class with standard tool module pattern
- [✅] Create base AgentTool class that enforces context-first parameter pattern
- [✅] Implement DisplayResourceTool with handle-based resource display
- [✅] Implement NotifyUserTool for user notifications and progress
- [✅] Implement CloseWindowTool for window management
- [✅] Write unit tests for each tool class in isolation
- [✅] Write integration tests with real resource handle system

### Phase 2: Context Service Integration  
**ResourceService implementation for context.resourceService access**

- [ ] Create ResourceService class for context integration
- [ ] Implement displayResource method with handle processing and window management
- [ ] Implement showNotification method with UI notification system
- [ ] Implement closeWindow method with window cleanup
- [ ] Add ResourceService to agent execution context
- [ ] Write unit tests for ResourceService with mocked dependencies
- [ ] Write integration tests with real ResourceWindowManager and actor communication

### Phase 3: Agent Planning Integration
**Test that agents can discover and plan with AgentTools**

- [ ] Test DisplayResourceTool discovery through agent tool search
- [ ] Test agent planning workflows that include UI tools
- [ ] Test mixed workflows with regular tools and AgentTools
- [ ] Test window ID management and reuse in multi-step workflows
- [ ] Write unit tests for individual tool planning scenarios
- [ ] Write integration tests with real agent planning and execution

### Phase 4: Resource Handle System Integration
**Complete integration with existing transparent resource handle architecture**

- [ ] Test DisplayResourceTool with real FileHandle objects from other tools
- [ ] Test DisplayResourceTool with real ImageHandle objects from image generation
- [ ] Test window reuse with windowId parameter
- [ ] Test window management with CloseWindowTool
- [ ] Write unit tests for handle processing and window creation
- [ ] Write integration tests with complete resource handle lifecycle

### Phase 5: End-to-End Agent Workflows
**Complete system testing with real agent execution of UI workflows**

- [ ] Test "show me a cat picture" workflow: generate_image → display_resource
- [ ] Test "create report and show me" workflow: generate_report → display_resource  
- [ ] Test window management: display → update → close workflows
- [ ] Test notification workflows with progress indicators
- [ ] Test error handling and fail-fast behavior
- [ ] Write integration tests with real agent execution and UI verification

## Testing Strategy

### Unit Tests
- **Isolated tool testing** with minimal mocked dependencies
- **Context parameter validation** with mocked context objects
- **Resource handle processing** with mocked handles
- **Tool metadata parsing** with mocked registry

### Integration Tests  
- **Real agent execution** with actual tool discovery and planning
- **Real resource handles** from actual file and image operations
- **Real UI components** with actual Window, CodeEditor, ImageViewer
- **Real actor communication** through actual ResourceServerSubActor and ResourceClientSubActor
- **Real window management** from creation to cleanup

## Completion Tracking

**Phase 1 - Core AgentTools Infrastructure**: ✅ 7/7 steps complete (100%)
**Phase 2 - Context Service Integration**: ⬜ 0/7 steps complete (0%)  
**Phase 3 - Agent Planning Integration**: ⬜ 0/6 steps complete (0%)
**Phase 4 - Resource Handle System Integration**: ⬜ 0/6 steps complete (0%)
**Phase 5 - End-to-End Agent Workflows**: ⬜ 0/6 steps complete (0%)

**Overall Progress**: ⬜ 0/32 total steps complete (0%)**

**Note**: Tool registry integration is automatic when using standard Legion module pattern with correct module.json and base classes.

## Success Criteria

The implementation is complete when:
- [ ] Agent can plan: generate_image("cat") → catHandle → display_resource(context, catHandle) → see cat in floating window
- [ ] Agent can plan: create_file("report") → reportHandle → display_resource(context, reportHandle) → edit file in floating window
- [ ] Agent can plan: display_resource(context, handle1) → windowId → display_resource(context, handle2, {windowId}) → replace window content
- [ ] All tests pass with real dependencies (no mocks in integration tests)
- [ ] Tools properly discoverable through normal agent tool search
- [ ] Window management works correctly (create, reuse, close)
- [ ] Error handling works correctly with fail-fast behavior for missing handles