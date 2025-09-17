# ROMA Agent Refactoring Suggestions

## Initial Thoughts

This document captures difficulties encountered during the ROMA agent refactoring process and suggestions for improvements that could have prevented or accelerated resolution of these issues.

### Context
The refactoring involved migrating ROMA agent from using low-level LLMClient message formatting to high-level SimplePromptClient abstractions. The user feedback was that "the way roma is handling messages seems very low level" and requested following the gemini-agent pattern for better abstraction.

## Difficulties Encountered During Refactoring

### 1. Test Mock Pattern Inconsistencies

**Difficulty**: Found inconsistent mock patterns between test files during the refactoring. Some tests were still using the old `mockLlmClient.complete` pattern while others had been updated to `mockSimplePromptClient.request`.

**Specific Issue**: In `DependencyResolver.test.js`, the semantic dependency analysis test was failing because:
- Mock setup was using `mockSimplePromptClient.request` 
- But the mock implementation was checking `messages[1].content` (old LLMClient pattern)
- Should have been checking `prompt` parameter (SimplePromptClient pattern)

**How Fixed**: 
- Updated mock implementation to use `{ prompt }` parameter destructuring instead of `{ messages }`
- Changed mock logic to look for specific task descriptions in the prompt string
- Updated all assertions from `mockLlmClient.complete` to `mockSimplePromptClient.request`

**How Could Have Been Avoided**:
- **Systematic Migration Script**: A script that scans all test files and identifies old mock patterns would have caught this immediately
- **Test Pattern Linting**: ESLint rules that flag usage of deprecated mock patterns
- **Centralized Mock Factory**: A shared mock factory that ensures consistent mock patterns across all tests

**How Problem Could Have Been Found Quicker**:
- **Test Naming Conventions**: More specific test descriptions that indicate which client type they're testing
- **Mock Validation**: Runtime checks in mocks that validate expected parameter structures
- **Better Test Error Messages**: More descriptive error messages that indicate which mock pattern is expected

### 2. Parameter Structure Mismatches

**Difficulty**: SimplePromptClient uses different parameter structures than LLMClient, causing subtle bugs in test implementations.

**Specific Issue**: 
- LLMClient expects `{ messages: [...] }` with message arrays
- SimplePromptClient expects `{ prompt: string, systemPrompt?: string, chatHistory?: [...] }`
- Tests were mixing these patterns

**How Fixed**: 
- Systematically reviewed all mock implementations to use correct parameter destructuring
- Updated mock logic to work with SimplePromptClient's flatter parameter structure

**How Could Have Been Avoided**:
- **Type-Safe Mocks**: Using TypeScript interfaces for mock definitions to catch parameter mismatches at compile time
- **Interface Documentation**: Clear documentation of parameter differences between client types
- **Migration Guide**: Step-by-step guide for converting from LLMClient to SimplePromptClient patterns

### 3. Cross-Strategy Dependencies

**Difficulty**: Different execution strategies (Atomic, Parallel, Recursive) have interdependencies that weren't immediately obvious during refactoring.

**Observation**: Looking at the code structure:
- `ParallelExecutionStrategy` imports and creates `AtomicExecutionStrategy` instances for subtask execution
- `RecursiveExecutionStrategy` can delegate to other strategies
- All strategies need consistent dependency injection patterns

**Potential Issues**: If one strategy's dependency injection pattern changes, it could break other strategies that instantiate it.

**Suggestions for Improvement**:
- **Strategy Factory Pattern**: Centralized factory for creating strategy instances with consistent dependency injection
- **Strategy Interface Validation**: Runtime validation that all strategies implement expected dependency patterns
- **Integration Tests**: More comprehensive tests that verify strategy interactions work correctly

## Suggestions for Future Development

### 1. Automated Migration Tools

**Need**: Tools to help with large-scale API migrations like LLMClient → SimplePromptClient

**Suggested Tools**:
- AST-based code transformation scripts
- Pattern detection and replacement utilities
- Automated test mock pattern updates

### 2. Better Dependency Injection Patterns

**Current State**: Each strategy manually handles dependency injection in constructor and update methods

**Suggestions**:
- Dependency injection container/framework
- Standardized dependency validation
- Automatic dependency wiring

### 3. Test Infrastructure Improvements

**Mock Management**:
- Centralized mock factory for consistent patterns
- Type-safe mock definitions
- Automated mock validation

**Test Organization**:
- Clear separation between unit tests (with mocks) and integration tests (with real dependencies)
- Shared test utilities for common patterns
- Better test categorization and naming

### 4. Documentation and Validation

**Code Documentation**:
- Clear interface documentation for all client types
- Migration guides for API changes
- Dependency relationship diagrams

**Runtime Validation**:
- Parameter validation in strategy constructors
- Client interface validation
- Better error messages for configuration issues

## Next Steps

Will continue documenting difficulties as I proceed with testing website building functionality. Key areas to watch:

1. **Real LLM Integration**: How well the SimplePromptClient abstraction works with actual LLM calls
2. **Strategy Selection**: Whether the refactored strategies correctly handle complex website building tasks
3. **Error Handling**: How gracefully the system handles failures during multi-step website creation
4. **Performance**: Whether the abstraction layer introduces any performance overhead

---

*This document will be updated as testing continues and new difficulties are encountered.*