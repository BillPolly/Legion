# Configurable Agent Implementation Plan

## Overview

This implementation plan follows Test-Driven Development (TDD) methodology without the refactor phase, aiming to get it right the first time. The implementation creates a JSON-configured agent runtime system that integrates with the Legion framework's existing components as specified in the [DESIGN.md](./DESIGN.md).

## Core Principles & Rules

**Fundamental Rules:**
- **NO MOCKS** in integration tests - use real components with real resources
- **NO FALLBACKS** - fail fast with clear error messages when resources are unavailable
- **NO MOCKS IN IMPLEMENTATION CODE** - never add mock implementations to production code
- ResourceManager singleton for ALL environment variables and configuration
- Schema validation ONLY through @legion/schema package
- Clean architecture with clear separation of concerns
- MVP focus - functional correctness only, no NFRs

**Testing Requirements:**
- 100% test pass rate - no exceptions
- All tests use Jest with `npm test` commands
- Integration tests use real LLM clients, real MongoDB, real tools
- Tests clean up before (not after) to allow result inspection
- Test outputs go to `__tests__/tmp/` directories

## Phase 1: Project Setup & Core Infrastructure

☑ **1.1** Create package.json with all dependencies from design doc

☑ **1.2** Set up directory structure matching design specification

☑ **1.3** Create index.js with proper exports

☑ **1.4** Write unit tests for configuration schema validation

☑ **1.5** Implement configuration schema using @legion/schema

☑ **1.6** Write unit tests for error handling utilities

☑ **1.7** Implement error handling utilities

☑ **1.8** Verify ResourceManager integration

☑ **1.9** Integration test for project setup

## Phase 2: State Management

☑ **2.1** Write unit tests for AgentState class initialization

☑ **2.2** Write tests for conversation history management (add, prune)

☑ **2.3** Write tests for context variable extraction and storage

☑ **2.4** Implement AgentState class with all state management features

☑ **2.5** Write integration tests for state persistence scenarios

☑ **2.6** Implement state persistence mechanisms using Handle pattern

## Phase 3: Capability Management

☑ **3.1** Write unit tests for CapabilityManager initialization

☑ **3.2** Write tests for module loading through ResourceManager

☑ **3.3** Write tests for tool permission validation logic

☑ **3.4** Implement CapabilityManager with tool loading and registry

☑ **3.5** Write integration tests with real Legion tool modules

☑ **3.6** Verify tool execution with actual file/calculator/json tools

## Phase 4: Prompt Management

☑ **4.1** Write unit tests for PromptManager template loading

☑ **4.2** Write tests for template variable replacement logic

☑ **4.3** Write tests for response formatting (json/markdown)

☑ **4.4** Implement PromptManager with all template features

☑ **4.5** Write integration tests with real prompt scenarios

☑ **4.6** Test with actual LLM responses from Anthropic/OpenAI

## Phase 5: Knowledge Graph Integration

☑ **5.1** Write unit tests for KnowledgeGraphInterface initialization

☑ **5.2** Write tests for entity storage operations

☑ **5.3** Write tests for relationship management

☑ **5.4** Implement KnowledgeGraphInterface using Handle-based triple store

☑ **5.5** Write integration tests with real MongoDB knowledge graph

☑ **5.6** Test persistence modes (session vs persistent storage)

## Phase 6: Core Agent Implementation

□ **6.1** Write comprehensive unit tests for ConfigurableAgent.receive()

□ **6.2** Write tests for message processing flow

□ **6.3** Write tests for LLM client integration via ResourceManager

□ **6.4** Implement full ConfigurableAgent class with all methods

□ **6.5** Write integration tests for complete message processing pipeline

□ **6.6** Test error handling and recovery mechanisms

## Phase 7: Behavior Tree Integration

□ **7.1** Write tests for behavior tree configuration parsing

□ **7.2** Write tests for behavior tree execution flow with BehaviorTreeExecutor

□ **7.3** Implement behavior tree integration in ConfigurableAgent

□ **7.4** Write integration tests with complex multi-step workflows

□ **7.5** Test conditional logic (selector nodes) and tool coordination

□ **7.6** Verify action node execution with real tool operations

## Phase 8: End-to-End Integration Testing

□ **8.1** Create example agent configurations (simple-chat.json, task-manager.json, analytical-agent.json)

□ **8.2** Write comprehensive integration tests for simple chat agent

□ **8.3** Write integration tests for task management agent with file operations

□ **8.4** Write integration tests for analytical agent with knowledge graph

□ **8.5** Test agent lifecycle (initialization, operation, shutdown)

□ **8.6** Test error scenarios and edge cases with real resources

## Phase 9: System Integration Testing

□ **9.1** Test agent within Actor framework messaging patterns

□ **9.2** Test agent composition with multiple agents communicating

□ **9.3** Test ResourceManager integration for all resource types

□ **9.4** Test with real LLM providers (Anthropic and OpenAI)

□ **9.5** Performance testing with sustained operation

□ **9.6** Memory leak and resource cleanup verification

## Phase 10: UAT & Final Validation

□ **10.1** Create test harness for manual testing

□ **10.2** Validate all example configurations work correctly

□ **10.3** Test agent hot-reloading from configuration changes

□ **10.4** Verify all error messages are clear and actionable

□ **10.5** Document any discovered limitations

□ **10.6** Final regression test suite execution

## Testing Strategy

### Unit Tests
- Test each class in isolation with real constructors
- Verify all public methods behave correctly
- Test error conditions thoroughly
- No mocks, use real objects

### Integration Tests
- Use real ResourceManager singleton (auto-initializes)
- Use real LLM clients with actual API keys from .env
- Use real tool modules from Legion packages
- Use real MongoDB for knowledge graph storage
- Test complete workflows end-to-end
- Never skip tests - they must fail if resources unavailable

### Test Execution
```bash
# Run all tests
npm test

# Run specific test file
npm test -- ConfigurableAgent.test.js

# Run with coverage
npm test -- --coverage

# Run integration tests
npm test -- __tests__/integration/
```

## Key Implementation Notes

### ResourceManager Usage
```javascript
// ALWAYS get ResourceManager like this:
const resourceManager = await ResourceManager.getInstance();

// Get environment variables:
const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');

// Get LLM client:
const llmClient = await resourceManager.get('llmClient');

// NEVER do this:
const apiKey = process.env.ANTHROPIC_API_KEY; // WRONG!
```

### Error Handling
```javascript
// Always fail fast with clear errors
if (!toolEntry) {
  throw new Error(`Tool ${toolName} not found in registry`);
}

// Never use fallbacks
// WRONG:
const tool = this.getTool(name) || this.getDefaultTool();

// RIGHT:
const tool = this.getTool(name);
if (!tool) {
  throw new Error(`Tool ${name} not available`);
}
```

## Success Criteria

- ✅ All tests pass with 100% success rate
- ✅ Agent can be configured entirely through JSON
- ✅ All Legion components integrate correctly
- ✅ Real LLM communication works properly
- ✅ Tools execute with proper permissions
- ✅ State persists correctly across sessions
- ✅ Knowledge graph stores and retrieves data
- ✅ Behavior trees execute complex workflows
- ✅ Error messages are clear and actionable
- ✅ No memory leaks or resource issues
- ✅ Examples work without modification

## Progress Tracking

Each checkbox (□) should be updated to checked (✅) when the step is completed. Steps must be completed in order within each phase. Integration tests at the end of each phase must pass before proceeding to the next phase.

## Notes

- This is an MVP implementation focused on functional correctness
- No concern for NFRs like security, performance, or migration
- No documentation beyond this plan and the design doc
- No deployment or publishing considerations
- Local running and UAT only