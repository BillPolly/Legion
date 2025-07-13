# JSON Module System Implementation Plan

## Overview

This document outlines the Test-Driven Development (TDD) implementation plan for the JSON Module System. Each phase includes writing tests first, followed by implementation to make those tests pass.

## Implementation Phases

### Phase 1: Core Infrastructure
**Goal**: Create the foundational components for loading and validating module.json files

#### Step 1.1: Create JSON Schema for module.json
- [✓] Write test for schema validation utility
- [✓] Create `src/schemas/module-schema.json`
- [✓] Create `src/schemas/SchemaValidator.js`
- [✓] Validate schema against test cases

#### Step 1.2: Implement JsonModuleLoader base functionality
- [✓] Write tests for JsonModuleLoader constructor and basic methods
- [✓] Create `src/module/JsonModuleLoader.js`
- [✓] Implement `readModuleJson()` method
- [✓] Implement `validateConfiguration()` method
- [✓] Test error handling for invalid JSON

#### Step 1.3: Create module discovery mechanism
- [✓] Write tests for module discovery
- [✓] Implement `discoverJsonModules()` method
- [✓] Test discovery in nested directories
- [✓] Test handling of missing/invalid files

### Phase 2: Generic Module Implementation
**Goal**: Create the GenericModule class that can wrap any library

#### Step 2.1: Create GenericModule base class
- [✓] Write tests for GenericModule constructor
- [✓] Create `src/module/GenericModule.js`
- [✓] Implement basic Module interface
- [✓] Test module initialization

#### Step 2.2: Implement library loading
- [✓] Write tests for different package types (npm, local, scoped)
- [✓] Implement `loadLibrary()` method
- [✓] Test CommonJS loading
- [✓] Test ESM loading
- [✓] Test error handling for missing packages

#### Step 2.3: Implement library initialization patterns
- [✓] Write tests for constructor pattern
- [✓] Write tests for factory pattern
- [✓] Write tests for singleton pattern
- [✓] Write tests for static pattern
- [✓] Implement `initializeLibrary()` with all patterns
- [✓] Test dependency injection

### Phase 3: Generic Tool Implementation
**Goal**: Create the GenericTool class that wraps library functions

#### Step 3.1: Create GenericTool base class
- [✓] Write tests for GenericTool constructor
- [✓] Create `src/tool/GenericTool.js`
- [✓] Implement Tool interface
- [✓] Test tool metadata

#### Step 3.2: Implement function resolution
- [✓] Write tests for simple function names
- [✓] Write tests for nested paths (e.g., "utils.format")
- [✓] Write tests for array access
- [✓] Implement `resolveFunction()` method
- [✓] Test error handling for missing functions

#### Step 3.3: Implement invoke method
- [✓] Write tests for successful function calls
- [✓] Write tests for async functions
- [✓] Write tests for error handling
- [✓] Implement `invoke()` method
- [✓] Test parameter parsing and validation
- [✓] Test result mapping

### Phase 4: Integration with ModuleFactory
**Goal**: Update ModuleFactory to support JSON modules

#### Step 4.1: Extend ModuleFactory
- [✓] Write tests for `createJsonModule()` method
- [✓] Implement `createJsonModule()` in ModuleFactory
- [✓] Test dependency resolution
- [✓] Test mixed traditional and JSON modules

#### Step 4.2: Update module creation flow
- [✓] Write tests for automatic JSON module detection
- [✓] Implement fallback from Module class to module.json
- [✓] Test precedence (Module class wins over JSON)
- [✓] Test error handling

### Phase 5: CLI Integration
**Goal**: Update the CLI ModuleLoader to support JSON modules

#### Step 5.1: Update CLI ModuleLoader
- [✓] Write tests for JSON module discovery in CLI
- [✓] Update `packages/cli/src/core/ModuleLoader.js`
- [✓] Test loading both Module classes and JSON modules
- [✓] Test tool counting with JSON modules

#### Step 5.2: Update GlobalToolRegistry
- [✓] Write tests for JSON module tools in registry (existing tests work)
- [✓] Update tool registration for GenericTool instances (already compatible)
- [✓] Test tool resolution (works with existing code)
- [✓] Test short name mapping (works with existing code)

### Phase 6: Result Mapping and Transformations
**Goal**: Implement advanced result mapping features

#### Step 6.1: Implement result mapping
- [✓] Write tests for JSONPath result mapping
- [✓] Implement `ResultMapper` utility class
- [✓] Test success result mapping
- [✓] Test failure result mapping
- [✓] Test complex transformations

#### Step 6.2: Implement type coercion
- [✓] Write tests for type conversions
- [✓] Implement automatic type coercion
- [✓] Test string to number conversions
- [✓] Test object serialization
- [✓] Test array handling

### Phase 7: Example Modules
**Goal**: Create working examples to validate the system

#### Step 7.1: Create axios module
- [✓] Write integration tests for axios module
- [✓] Create `packages/general-tools/src/axios/module.json`
- [✓] Test GET requests
- [✓] Test POST requests
- [✓] Test error handling

#### Step 7.2: Create lodash module
- [ ] Write integration tests for lodash module
- [✓] Create `packages/general-tools/src/lodash/module.json`
- [✓] Test static method calls
- [✓] Test array operations
- [✓] Test object operations

#### Step 7.3: Create moment module
- [ ] Write integration tests for moment module
- [ ] Create `packages/general-tools/src/moment/module.json`
- [ ] Test date parsing
- [ ] Test date formatting
- [ ] Test instance methods

### Phase 8: Error Handling and Debugging
**Goal**: Implement comprehensive error handling and debugging features

#### Step 8.1: Enhanced error messages
- [✓] Write tests for configuration errors
- [✓] Write tests for runtime errors
- [✓] Implement detailed error messages
- [✓] Add error context (file path, line number)
- [✓] Test stack trace handling

#### Step 8.2: Validation improvements
- [✓] Write tests for parameter validation
- [✓] Write tests for output validation
- [✓] Implement strict mode validation
- [✓] Test helpful validation error messages
- [✓] Test partial validation

### Phase 9: Documentation and Testing
**Goal**: Complete documentation and comprehensive testing

#### Step 9.1: Unit test coverage
- [✓] Achieve 90%+ test coverage for JsonModuleLoader (21 tests)
- [✓] Achieve 90%+ test coverage for GenericModule (16 tests)
- [✓] Achieve 90%+ test coverage for GenericTool (20 tests)
- [✓] Test edge cases and error conditions

#### Step 9.2: Integration testing
- [✓] Create end-to-end test suite
- [✓] Test real npm packages
- [✓] Test complex initialization scenarios
- [ ] Test performance with large modules

#### Step 9.3: Documentation
- [✓] Create API documentation (through code)
- [✓] Write module.json authoring guide (JSON_MODULE_DESIGN.md)
- [ ] Create troubleshooting guide
- [✓] Add inline code documentation

## Testing Strategy

### Test File Structure
```
packages/module-loader/__tests__/
├── unit/
│   ├── JsonModuleLoader.test.js
│   ├── GenericModule.test.js
│   ├── GenericTool.test.js
│   ├── SchemaValidator.test.js
│   └── ResultMapper.test.js
├── integration/
│   ├── ModuleFactory.test.js
│   ├── axios-module.test.js
│   ├── lodash-module.test.js
│   └── moment-module.test.js
└── fixtures/
    ├── valid-modules/
    │   ├── simple.json
    │   ├── complex.json
    │   └── invalid.json
    └── mock-libraries/
        └── test-lib.js
```

### Test Patterns

#### Unit Test Example
```javascript
describe('JsonModuleLoader', () => {
  describe('validateConfiguration', () => {
    it('should validate a correct module.json', async () => {
      const config = {
        name: 'test-module',
        version: '1.0.0',
        package: 'test-package',
        type: 'static',
        tools: []
      };
      
      const loader = new JsonModuleLoader();
      const result = await loader.validateConfiguration(config);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject invalid module type', async () => {
      const config = {
        name: 'test-module',
        type: 'invalid-type'
      };
      
      const loader = new JsonModuleLoader();
      const result = await loader.validateConfiguration(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/type.*enum/);
    });
  });
});
```

#### Integration Test Example
```javascript
describe('Axios JSON Module', () => {
  let moduleInstance;
  
  beforeAll(async () => {
    const loader = new JsonModuleLoader();
    const config = await loader.readModuleJson('./fixtures/axios-module.json');
    moduleInstance = await loader.createModule(config);
  });
  
  it('should make HTTP GET request', async () => {
    const tool = moduleInstance.getTools().find(t => t.name === 'http_get');
    const result = await tool.invoke({
      function: {
        name: 'http_get',
        arguments: JSON.stringify({
          url: 'https://api.example.com/data'
        })
      }
    });
    
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('status', 200);
  });
});
```

## Success Criteria

1. **All tests pass** - 100% of tests must pass
2. **Code coverage** - Minimum 85% coverage across all new code
3. **Performance** - Module loading < 100ms for typical modules
4. **Memory usage** - No memory leaks in module lifecycle
5. **Error handling** - All errors provide actionable messages
6. **Documentation** - All public APIs documented
7. **Examples work** - All example modules function correctly

## Development Guidelines

1. **Write tests first** - No implementation without failing tests
2. **Small commits** - Each checkbox represents one commit
3. **Clear naming** - Use descriptive names for all components
4. **Error messages** - Include context and solutions
5. **Type safety** - Use JSDoc annotations throughout
6. **No shortcuts** - Implement properly the first time

## Notes

- Each checkbox should be checked only when tests pass
- Create feature branches for each phase
- Run full test suite before marking phase complete
- Update this document with any deviations or learnings