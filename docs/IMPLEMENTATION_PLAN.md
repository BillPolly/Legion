# TDD Implementation Plan for Module/Tool Architecture

## Overview
This plan follows a Test-Driven Development approach where we write tests first, then implement the code to make them pass. We aim to get it right in one shot without refactoring.

## Implementation Phases

### Phase 1: Core Infrastructure

#### 1.1 ResourceManager
- [✅] Write tests for ResourceManager
  - [✅] Test register() method
  - [✅] Test get() method with existing resource
  - [✅] Test get() method with missing resource (should throw)
  - [✅] Test has() method
  - [✅] Test registering different types (strings, objects, functions)
- [✅] Implement ResourceManager class

#### 1.2 Base Tool Class (OpenAITool)
- [✅] Write tests for OpenAITool
  - [✅] Test constructor sets properties
  - [✅] Test getDescription() returns correct format
  - [✅] Test execute() throws when not implemented
  - [✅] Test tool with all parameter types
- [✅] Implement OpenAITool base class

#### 1.3 Base Module Class (OpenAIModule)
- [✅] Write tests for OpenAIModule
  - [✅] Test constructor initializes tools array
  - [✅] Test getTools() returns tools
  - [✅] Test module with no dependencies
  - [✅] Test module with dependencies
- [✅] Implement OpenAIModule base class

#### 1.4 ModuleFactory
- [✅] Write tests for ModuleFactory
  - [✅] Test constructor with ResourceManager
  - [✅] Test createModule() with no dependencies
  - [✅] Test createModule() with single dependency
  - [✅] Test createModule() with multiple dependencies
  - [✅] Test createModule() with missing dependency (should throw)
  - [✅] Test createAllModules() with array of module classes
- [✅] Implement ModuleFactory class

### Phase 2: Simple Module Implementation (Calculator)

#### 2.1 Calculator Tool
- [✅] Write tests for CalculatorEvaluateTool
  - [✅] Test simple arithmetic (2 + 2)
  - [✅] Test complex expressions
  - [✅] Test Math functions
  - [✅] Test invalid expressions
  - [✅] Test getDescription() format
- [✅] Implement CalculatorEvaluateTool

#### 2.2 Calculator Module
- [✅] Write tests for CalculatorModule
  - [✅] Test static dependencies (should be empty array)
  - [✅] Test constructor creates tool
  - [✅] Test getTools() returns calculator tool
- [✅] Implement CalculatorModule

### Phase 3: Module with Dependencies (File System)

#### 3.1 File Reader Tool
- [✅] Write tests for FileReaderTool
  - [✅] Test constructor with dependencies
  - [✅] Test reading existing file
  - [✅] Test reading non-existent file
  - [✅] Test path validation with basePath
  - [✅] Test permission checks
- [✅] Implement FileReaderTool

#### 3.2 File Writer Tool
- [✅] Write tests for FileWriterTool
  - [✅] Test writing new file
  - [✅] Test overwriting existing file
  - [✅] Test permission checks
  - [✅] Test path validation
- [✅] Implement FileWriterTool

#### 3.3 Directory Creator Tool
- [✅] Write tests for DirectoryCreatorTool
  - [✅] Test creating new directory
  - [✅] Test creating nested directories
  - [✅] Test permission checks
- [✅] Implement DirectoryCreatorTool

#### 3.4 File Module
- [✅] Write tests for FileModule
  - [✅] Test static dependencies declaration
  - [✅] Test constructor with all dependencies
  - [✅] Test getTools() returns all 3 tools
  - [✅] Test tools have access to dependencies
- [✅] Implement FileModule

### Phase 4: Complex Module (GitHub)

#### 4.1 GitHub API Client
- [ ] Write tests for GitHubAPIClient
  - [ ] Test constructor with config
  - [ ] Test createRepo() method
  - [ ] Test getUser() method
  - [ ] Test error handling
- [ ] Implement GitHubAPIClient

#### 4.2 GitHub Create Repo Tool
- [ ] Write tests for GitHubCreateRepoTool
  - [ ] Test constructor with dependencies
  - [ ] Test execute() with valid params
  - [ ] Test execute() with missing params
  - [ ] Test API error handling
- [ ] Implement GitHubCreateRepoTool

#### 4.3 GitHub Push Tool
- [ ] Write tests for GitHubPushToRepoTool
  - [ ] Test git operations
  - [ ] Test authentication
  - [ ] Test error scenarios
- [ ] Implement GitHubPushToRepoTool

#### 4.4 GitHub Create and Push Tool
- [ ] Write tests for GitHubCreateAndPushTool
  - [ ] Test combined operation
  - [ ] Test rollback on failure
- [ ] Implement GitHubCreateAndPushTool

#### 4.5 GitHub Module
- [ ] Write tests for GitHubModule
  - [ ] Test static dependencies
  - [ ] Test constructor
  - [ ] Test all tools created
- [ ] Implement GitHubModule

### Phase 5: Tool Registry and Integration

#### 5.1 Tool Registry
- [ ] Write tests for ToolRegistry
  - [ ] Test register() method
  - [ ] Test get() method
  - [ ] Test getAll() method
  - [ ] Test duplicate registration
- [ ] Implement ToolRegistry

#### 5.2 System Integration
- [ ] Write integration tests
  - [ ] Test full initialization flow
  - [ ] Test tool execution through registry
  - [ ] Test multiple modules
  - [ ] Test OpenAI format compatibility
- [ ] Implement system initialization

### Phase 6: Robust Response Parser

#### 6.1 JSON5 Parser with Pre-processing
- [ ] Write tests for ResponseParser
  - [ ] Test parsing valid JSON
  - [ ] Test parsing JSON5 (unquoted keys, trailing commas)
  - [ ] Test stripping markdown code blocks
  - [ ] Test handling malformed JSON
  - [ ] Test extracting JSON from mixed text
  - [ ] Test handling nested objects
  - [ ] Test handling arrays
- [ ] Implement ResponseParser with json5

#### 6.2 Response Cleaner
- [ ] Write tests for ResponseCleaner
  - [ ] Test removing code blocks (```json, ```)
  - [ ] Test fixing common LLM mistakes
  - [ ] Test handling incomplete JSON
  - [ ] Test handling extra text before/after JSON
- [ ] Implement ResponseCleaner utilities

### Phase 7: Response Validator

#### 7.1 Schema Validator
- [ ] Write tests for ResponseValidator
  - [ ] Test validating tool use structure
  - [ ] Test validating response structure
  - [ ] Test checking required fields
  - [ ] Test type validation
  - [ ] Test tool identifier validation
  - [ ] Test function name validation
  - [ ] Test argument validation
- [ ] Implement ResponseValidator

#### 7.2 Tool Definition Matcher
- [ ] Write tests for ToolMatcher
  - [ ] Test matching tool identifiers
  - [ ] Test matching function names
  - [ ] Test validating argument types
  - [ ] Test validating argument count
  - [ ] Test fuzzy matching for typos
- [ ] Implement ToolMatcher

### Phase 8: Retry Logic System

#### 8.1 Retry Manager
- [ ] Write tests for RetryManager
  - [ ] Test retry with parse errors
  - [ ] Test retry with validation errors
  - [ ] Test retry with tool not found
  - [ ] Test max retry limits
  - [ ] Test exponential backoff
  - [ ] Test error message formatting
- [ ] Implement RetryManager

#### 8.2 Error Feedback Formatter
- [ ] Write tests for ErrorFormatter
  - [ ] Test formatting JSON parse errors
  - [ ] Test formatting validation errors
  - [ ] Test formatting tool errors
  - [ ] Test creating helpful error messages
  - [ ] Test including original request context
- [ ] Implement ErrorFormatter

### Phase 9: Integration with Agent

#### 9.1 Update Agent Class
- [ ] Write integration tests
  - [ ] Test agent with new parser
  - [ ] Test agent with validator
  - [ ] Test agent with retry logic
  - [ ] Test end-to-end tool usage
  - [ ] Test error recovery
- [ ] Update Agent to use new components

#### 9.2 Update Model Providers
- [ ] Write tests for provider updates
  - [ ] Test response handling
  - [ ] Test error propagation
  - [ ] Test timeout handling
- [ ] Update providers to support new response handling

### Phase 6: Migration of Existing Tools

#### 6.1 Command Executor Module
- [ ] Write tests for CommandExecutorModule
- [ ] Implement CommandExecutorModule
- [ ] Implement CommandExecutorTool

#### 6.2 Server Starter Module
- [ ] Write tests for ServerStarterModule
- [ ] Implement ServerStarterModule
- [ ] Implement Start, Stop, ReadOutput tools

#### 6.3 Remaining Modules
- [ ] Serper/Google Search Module
- [ ] Web Crawler Module
- [ ] Page Screenshot Module
- [ ] Webpage to Markdown Module
- [ ] YouTube Transcript Module

### Phase 7: Backward Compatibility

#### 7.1 Legacy Adapter
- [ ] Write tests for legacy tool adapter
- [ ] Implement adapter to support old tool format
- [ ] Test with existing code

### Phase 8: Documentation and Examples

#### 8.1 API Documentation
- [ ] Document all public APIs
- [ ] Create JSDoc comments
- [ ] Generate API docs

#### 8.2 Usage Examples
- [ ] Create example for simple module
- [ ] Create example for complex module
- [ ] Create example for testing
- [ ] Create migration guide

## Test File Structure

```
__tests__/
├── core/
│   ├── ResourceManager.test.js
│   ├── OpenAITool.test.js
│   ├── OpenAIModule.test.js
│   └── ModuleFactory.test.js
├── modules/
│   ├── CalculatorModule.test.js
│   ├── FileModule.test.js
│   ├── GitHubModule.test.js
│   └── ...
├── tools/
│   ├── calculator/
│   │   └── CalculatorEvaluateTool.test.js
│   ├── file/
│   │   ├── FileReaderTool.test.js
│   │   ├── FileWriterTool.test.js
│   │   └── DirectoryCreatorTool.test.js
│   └── ...
└── integration/
    ├── system.test.js
    └── openai-compatibility.test.js
```

## Success Criteria

Each checkbox should be marked with ✅ when:
1. Tests are written and failing (red)
2. Implementation makes tests pass (green)
3. All edge cases are covered
4. Code follows the architecture design

## Notes

- Write comprehensive tests first
- Aim for >95% code coverage
- Consider edge cases in tests
- Mock external dependencies
- Use descriptive test names
- Group related tests with describe blocks