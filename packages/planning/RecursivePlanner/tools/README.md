# Tool Architecture Framework

A comprehensive, modular tool system for the Recursive Planning Agent Framework.

## Overview

This framework provides a structured approach to creating and managing tools that can be used by AI agents. It implements a clean architecture with proper abstractions, error handling, and extensive test coverage.

## Current Status

**329 passing tests** across 21 test suites

### Completed Phases

✅ **Phase 1: Foundation - Base Classes & Interfaces** (40 tests)
- `ModuleDefinition` - Abstract base class for defining tool modules
- `ModuleInstance` - Base class for module instances that provide tools
- `Tool` - Core tool class with execution and metadata
- Error handling and validation utilities

✅ **Phase 2: Core Implementation - Working Classes** (39 tests)
- Concrete implementations with examples
- Tool factory patterns for creating tools from various sources
- Handle management system for resource tracking
- Validation and error handling utilities

✅ **Phase 3: Wrapping Framework - Data-Driven Configuration** (80 tests)
- Method wrapping utilities (14 tests)
- Configuration-driven tool creation (21 tests)
- Library integration patterns for Node.js and NPM packages (23 tests)
- CLI tool wrapping with process management (22 tests)

✅ **Phase 4: Example Modules** (68 tests)
- **FileSystem Module** (18 tests) - Complete file system operations
- **HTTP Module** (21 tests) - HTTP client with all verbs, streaming, and batch operations
- **Git Module** (29 tests) - Comprehensive Git operations with simple-git

✅ **Phase 5: Integration - Framework Integration & Registry** (61 tests)
- **Tool Registry** (30 tests) - Central registry for module registration, discovery, and lifecycle management
- **Planning Agent Integration** (12 tests) - Integration with existing PlanningAgent framework
- **Configuration Management** (19 tests) - Comprehensive configuration system with JSON/YAML support
- Module provider system with lazy loading
- Capability-based tool search and resolution
- Tool resolution from registry within planning execution
- Module instance management and handle preservation
- Environment variable integration and hot reload
- Configuration validation and default management

✅ **Phase 7: Testing & Quality Assurance** (41 tests)
- **End-to-End Workflow Tests** (6 tests) - Complete workflow testing with file processing, multi-module coordination, complex dependencies, and error propagation
- **Performance Benchmarks** (13 tests) - Tool execution performance, memory usage, concurrent execution, and resource monitoring
- **Error Scenario Testing** (22 tests) - Invalid configurations, network failures, resource exhaustion, and error recovery scenarios

## Architecture

### Core Components

```
tools/
├── src/
│   ├── modules/           # Core module classes
│   │   ├── ModuleDefinition.js
│   │   ├── ModuleInstance.js
│   │   ├── Tool.js
│   │   ├── FileSystemModule.js
│   │   ├── HTTPModule.js
│   │   └── GitModule.js
│   ├── utils/             # Utility functions
│   │   ├── ErrorHandling.js
│   │   ├── Validation.js
│   │   ├── HandleManager.js
│   │   ├── ToolFactory.js
│   │   ├── MethodWrapper.js
│   │   ├── ConfigurationWrapper.js
│   │   ├── LibraryIntegration.js
│   │   └── CLIWrapper.js
│   ├── integration/       # Framework integration
│   │   ├── ToolRegistry.js
│   │   └── ConfigurationManager.js
│   └── examples/          # Example implementations
│       └── ExampleModule.js
└── tests/
    ├── unit/             # Unit tests (159 tests)
    ├── integration/      # Integration tests (129 tests)
    ├── e2e/              # End-to-end tests (28 tests)
    └── performance/      # Performance tests (13 tests)
```

### Key Features

1. **Modular Design**: Each tool module is self-contained with its own configuration and tools
2. **Type Safety**: Comprehensive validation and error handling
3. **Resource Management**: Handle system for tracking resources across tool calls
4. **Security**: Path traversal prevention, permission management, size limits
5. **Flexibility**: Multiple ways to create tools:
   - Direct implementation
   - Method wrapping
   - Configuration-driven
   - Library integration
   - CLI wrapping

## Usage Examples

### Creating a Simple Tool Module

```javascript
import { ModuleDefinition, ModuleInstance, Tool } from './tools/src/modules/index.js';

class MyModuleDefinition extends ModuleDefinition {
  static async create(config) {
    const instance = new MyModuleInstance(this, config);
    await instance.initialize();
    return instance;
  }
  
  static getMetadata() {
    return {
      name: 'MyModule',
      description: 'Custom module',
      tools: {
        myTool: {
          description: 'Does something',
          input: { data: 'string' },
          output: { result: 'string' }
        }
      }
    };
  }
}
```

### Using the FileSystem Module

```javascript
import { FileSystemModuleDefinition } from './tools/src/modules/FileSystemModule.js';

const fsModule = await FileSystemModuleDefinition.create({
  basePath: './workspace',
  allowWrite: true,
  maxFileSize: 10 * 1024 * 1024 // 10MB
});

const readFile = fsModule.getTool('readFile');
const result = await readFile.execute({ path: 'example.txt' });
console.log(result.content);
```

### Using the HTTP Module

```javascript
import { HTTPModuleDefinition } from './tools/src/modules/HTTPModule.js';

const httpModule = await HTTPModuleDefinition.create({
  baseURL: 'https://api.example.com',
  timeout: 5000
});

const getTool = httpModule.getTool('get');
const response = await getTool.execute({ 
  url: '/users/1',
  headers: { 'Authorization': 'Bearer token' }
});
```

### Using the Git Module

```javascript
import { GitModuleDefinition } from './tools/src/modules/GitModule.js';

const gitModule = await GitModuleDefinition.create({
  repoPath: './my-repo'
});

const statusTool = gitModule.getTool('status');
const status = await statusTool.execute({});
console.log('Current branch:', status.current);
```

## Testing

Run all tests:
```bash
npm test
```

Run specific test suites:
```bash
# Unit tests only
NODE_ENV=test NODE_OPTIONS=--experimental-vm-modules jest tools/tests/unit/

# Integration tests only  
NODE_ENV=test NODE_OPTIONS=--experimental-vm-modules jest tools/tests/integration/

# End-to-end tests only
NODE_ENV=test NODE_OPTIONS=--experimental-vm-modules jest tools/tests/e2e/

# Performance tests only
NODE_ENV=test NODE_OPTIONS=--experimental-vm-modules jest tools/tests/performance/
```

## Security Considerations

- **Path Traversal Protection**: FileSystem module prevents access outside base directory
- **Permission Management**: Configurable read/write/delete permissions
- **Size Limits**: File size validation to prevent resource exhaustion
- **Input Validation**: Schema-based validation for all tool inputs
- **Error Handling**: Comprehensive error wrapping and reporting

## Future Enhancements

- Database Module for SQL/NoSQL operations
- Cloud provider modules (AWS, Azure, GCP)
- Monitoring and observability tools
- Performance optimization with caching
- Rate limiting and throttling
- WebSocket support for real-time operations

## Contributing

The framework follows Test-Driven Development (TDD) principles. When adding new features:

1. Write failing tests first (RED phase)
2. Implement minimal code to pass tests (GREEN phase)
3. Document your module with examples
4. Ensure all tests pass before submitting

## License

MIT