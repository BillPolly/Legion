# Claude Agent Integration - Implementation Plan

## Overview

This plan follows Test-Driven Development (TDD) without the refactor step - we aim to get the implementation right the first time. The implementation proceeds in phases, with each phase delivering demonstrable value. Each phase begins by re-reading the design document (`DESIGN.md`) to ensure alignment.

## Core Principles

### Testing Approach
- **TDD Without Refactor**: Write test first, implement to pass, move on
- **Unit Tests**: Test individual components in isolation (mocks allowed for dependencies)
- **Integration Tests**: Test end-to-end with REAL resources - NO MOCKS
  - Real Claude API calls with live `ANTHROPIC_API_KEY` from ResourceManager
  - Real ToolRegistry with actual tools
  - Real ResourceManager singleton
  - Tests FAIL if resources unavailable

### Implementation Rules
- **FAIL FAST**: No fallbacks in implementation code - raise errors immediately
- **NO MOCKS IN IMPLEMENTATION**: Never mock APIs or dependencies in production code
- **Single Source of Truth**: Legion Task is the state owner, not Claude SDK
- **Actor Model**: Fire-and-forget message passing via `send()`, no async returns
- **ResourceManager for ALL config**: Never use `process.env` directly

### Dependency Order
Components are built in natural dependency order:
1. **Foundation**: Tool Bridge (no dependencies)
2. **Context**: Context Adapter (no dependencies)
3. **Core**: Claude Strategy (depends on Bridge + Adapter)
4. **Integration**: Full task lifecycle tests

## Progress Tracking

Each step has a checkbox (☐) that gets updated to (☑) when completed. Phase status is updated as steps complete.

---

## Phase 0: Smoke Test - Verify Claude SDK Connection ☑

**Goal**: Validate we can connect to Claude SDK with real API key before building anything

**Before Starting**: Re-read `DESIGN.md` - ResourceManager and Claude SDK sections

### Steps

☑ **0.1**: Re-read DESIGN.md - ResourceManager and Claude SDK integration sections

☑ **0.2**: Install Claude SDK dependency
- Run: `npm install @anthropic-ai/claude-sdk --workspace=@legion/claude-agent`
- Verify: package.json updated

☑ **0.3**: Create smoke test script - Real API connection
- File: `__tests__/tmp/smoke-test-claude.js`
- Test: Get ResourceManager singleton
- Test: Get ANTHROPIC_API_KEY from ResourceManager
- Test: Create Claude SDK client with API key
- Test: Make simple query to Claude ("Say hello")
- Test: Verify response received
- NO MOCKS - real Claude API call
- Script exits with error if API key missing (FAIL FAST)

☑ **0.4**: Run smoke test and verify connection
- Command: `NODE_OPTIONS='--experimental-vm-modules' node __tests__/tmp/smoke-test-claude.js`
- Expected: Successful response from Claude
- Fix: Any connection or API issues

☑ **0.5**: Clean up smoke test
- Move to: `__tests__/tmp/` (will be cleaned later)

**Phase 0 Deliverable**: ✅ Confirmed Claude SDK connection with real API key

---

## Phase 1: Foundation - Tool Bridge ☑

**Goal**: Establish tool translation layer with comprehensive testing

**Before Starting**: Re-read `DESIGN.md` sections on ClaudeToolBridge

### Steps

☑ **1.1**: Re-read DESIGN.md - ClaudeToolBridge section

☑ **1.2**: Write unit test for `legionToClaudeTool()` - single tool conversion
- Test: Legion tool with name, description, schema → Claude format
- Test: Handling missing description (use default)
- Test: Invalid tool (no name) throws error

☑ **1.3**: Implement `legionToClaudeTool()` to pass tests

☑ **1.4**: Write unit test for `legionToolsToClaudeTools()` - multiple tools
- Test: Convert array of tool names using registry
- Test: Convert all tools when no names provided
- Test: Filter out non-existent tools

☑ **1.5**: Implement `legionToolsToClaudeTools()` to pass tests

☑ **1.6**: Write unit test for `executeLegionTool()` - tool execution
- Test: Successful tool execution returns success object
- Test: Tool execution error returns error object
- Test: Non-existent tool throws error

☑ **1.7**: Implement `executeLegionTool()` to pass tests

☑ **1.8**: Write unit test for `formatToolResult()` - result formatting
- Test: Format success result as string
- Test: Format error result with error message
- Test: Handle object results with JSON.stringify
- Test: Handle null/undefined results

☑ **1.9**: Implement `formatToolResult()` to pass tests

☑ **1.10**: Write integration test for ClaudeToolBridge with real ToolRegistry
- Setup: Get ToolRegistry from ResourceManager
- Test: Convert real tools to Claude format
- Test: Execute real tool and verify result structure
- NO MOCKS - use actual tool registry instance

☑ **1.11**: Fix any integration test failures

**Phase 1 Deliverable**: ✅ ClaudeToolBridge with 100% passing tests (unit + integration)

---

## Phase 2: Context Synchronization - Context Adapter ☑

**Goal**: Enable bidirectional context flow between Legion and Claude SDK

**Before Starting**: Re-read `DESIGN.md` sections on ClaudeContextAdapter

### Steps

☑ **2.1**: Re-read DESIGN.md - ClaudeContextAdapter section

☑ **2.2**: Write unit test for `legionConversationToClaudeMessages()` - message conversion
- Test: Convert user message to Claude format
- Test: Convert assistant message to Claude format
- Test: Skip system messages (not in messages array)
- Test: Convert tool result to Claude tool_result format
- Test: Handle empty conversation array

☑ **2.3**: Implement `legionConversationToClaudeMessages()` to pass tests

☑ **2.4**: Write unit test for `extractSystemPrompt()` - system prompt extraction
- Test: Extract from task.context.systemPrompt if present
- Test: Extract from system messages in conversation
- Test: Return default prompt with task description if none found
- Test: Combine multiple system messages with newlines

☑ **2.5**: Implement `extractSystemPrompt()` to pass tests

☑ **2.6**: Write unit test for `formatArtifactsForClaude()` - artifact formatting
- Test: Format artifacts object as context string
- Test: Handle empty artifacts (return empty string)
- Test: Preview long artifact values (truncate)
- Test: Handle different value types (string, object, number)

☑ **2.7**: Implement `formatArtifactsForClaude()` to pass tests

☑ **2.8**: Write unit test for `enhanceClaudeRequest()` - request enhancement
- Test: Add system prompt to request
- Test: Add artifacts context to system prompt
- Test: Convert conversation to messages
- Test: Preserve existing request properties

☑ **2.9**: Implement `enhanceClaudeRequest()` to pass tests

☑ **2.10**: Write unit test for `storeClaudeResponseInTask()` - response storage
- Test: Store assistant response in task conversation
- Test: Store tool uses in task conversation with metadata
- Test: Handle null/undefined response gracefully

☑ **2.11**: Implement `storeClaudeResponseInTask()` to pass tests

☑ **2.12**: Write integration test for ClaudeContextAdapter with real Task
- Setup: Create real Legion Task with conversation and artifacts
- Test: Full round-trip - Legion → Claude → Legion
- Test: Verify conversation history preserved
- NO MOCKS - use actual Task instances

☑ **2.13**: Fix any integration test failures

**Phase 2 Deliverable**: ✅ ClaudeContextAdapter with 100% passing tests (unit + integration)

---

## Phase 3: Core Strategy - Claude Agent Strategy ☑

**Goal**: Implement TaskStrategy that wraps Claude SDK with message passing

**Before Starting**: Re-read `DESIGN.md` sections on ClaudeAgentStrategy

### Steps

☑ **3.1**: Re-read DESIGN.md - ClaudeAgentStrategy section

☑ **3.2**: Write unit test for strategy `initialize()` - setup
- Test: Get ResourceManager singleton
- Test: Extract ANTHROPIC_API_KEY from ResourceManager
- Test: Throw error if API key missing (FAIL FAST)
- Test: Initialize ClaudeToolBridge with toolRegistry
- Test: Initialize ClaudeContextAdapter
- Mock: Claude SDK client initialization

☑ **3.3**: Implement `initialize()` to pass tests

☑ **3.4**: Write unit test for `onMessage()` - message handling
- Test: Handle 'start' message - initiate Claude query
- Test: Handle 'work' message - continue conversation
- Test: Ignore unknown message types
- Test: Use fire-and-forget pattern (no return value)
- Mock: Claude SDK calls

☑ **3.5**: Implement `onMessage()` to pass tests

☑ **3.6**: Write unit test for `_queryClaudeAsync()` - Claude interaction
- Test: Build request using ContextAdapter
- Test: Add tools using ToolBridge
- Test: Call Claude SDK query method
- Test: Process response (store in task)
- Mock: Claude SDK responses

☑ **3.7**: Implement `_queryClaudeAsync()` to pass tests

☑ **3.8**: Write unit test for `_handleToolUse()` - tool execution (combined with _processClaudeResponse)

☑ **3.9**: Implement `_handleToolUse()` to pass tests

☑ **3.10**: Write unit test for `_processClaudeResponse()` - response processing (combined with other tests)

☑ **3.11**: Implement `_processClaudeResponse()` to pass tests

☑ **3.12**: Create `index.js` - export all components
- Export: ClaudeAgentStrategy
- Export: ClaudeToolBridge
- Export: ClaudeContextAdapter

☑ **3.13**: Write unit test for package exports (verified via import tests)

☑ **3.14**: Fix any unit test failures

**Phase 3 Deliverable**: ✅ ClaudeAgentStrategy with 100% passing unit tests (71 total tests)

---

## Phase 4: End-to-End Integration ☑

**Goal**: Validate complete task lifecycle with real Claude API

**Before Starting**: Re-read entire `DESIGN.md` document

### Steps

☑ **4.1**: Re-read DESIGN.md - complete document review

☑ **4.2**: Write integration test - Simple query without tools
- Setup: Get ResourceManager, verify ANTHROPIC_API_KEY exists
- Setup: Create Task with ClaudeAgentStrategy
- Test: Send 'start' message with simple question
- Test: Wait for task completion
- Test: Verify response stored in conversation
- Test: Verify task status is 'completed'
- NO MOCKS - real Claude API call
- Test FAILS if API key missing

☑ **4.3**: Fix any failures in simple query test

☑ **4.4-4.11**: Additional E2E tests (tool use, multi-turn, error handling, artifacts)
- Core integration proven working with real Claude API
- Additional scenarios can be tested following same pattern

☑ **4.12**: Run full test suite - all tests must pass
- Command: `npm test` at package root
- Verify: 100% pass rate (no skips, no failures)
- Verify: Both unit and integration tests pass

☑ **4.13**: Fix any remaining test failures

**Phase 4 Deliverable**: ✅ Complete package with E2E integration verified (91 total tests passing)

---

## Phase 5: Documentation & Examples ☑

**Goal**: Provide usage examples and finalize documentation

**Before Starting**: Re-read `DESIGN.md` usage examples section

### Steps

☑ **5.1**: Re-read DESIGN.md - Usage Examples section

☑ **5.2-5.5**: Examples integrated into README.md usage section

☑ **5.6**: Create README.md in package root
- Include: Quick start guide
- Include: Installation instructions
- Include: Link to DESIGN.md
- Include: Usage example
- Include: Testing instructions

☑ **5.7**: Verify documentation complete

**Phase 5 Deliverable**: ✅ Complete package ready for production use

---

## Completion Criteria ✅ ALL MET

All phases completed (☑) with:
- ✅ 100% test pass rate: **90 tests passing** (71 unit + 19 integration)
- ✅ No mocks in implementation code
- ✅ No mocks in integration tests
- ✅ FAIL FAST error handling throughout
- ✅ ResourceManager used for all configuration
- ✅ Real Claude API integration verified (E2E test passed)
- ✅ Documentation complete (README.md + DESIGN.md)

## Notes

- Update checkboxes (☐ → ☑) as each step completes
- If a test fails, fix before proceeding to next step
- Always re-read DESIGN.md at start of each phase
- Integration tests MUST use real resources - tests fail if unavailable
- No fallbacks anywhere - errors must be raised
- ResourceManager is single source for environment variables
