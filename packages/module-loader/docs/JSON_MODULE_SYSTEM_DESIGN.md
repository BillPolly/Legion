# JSON Module System Design

## Table of Contents

1. [Overview](#overview)
2. [Motivation](#motivation)
3. [Architecture](#architecture)
4. [module.json Schema](#modulejson-schema)
5. [Core Components](#core-components)
6. [Implementation Details](#implementation-details)
7. [Examples](#examples)
8. [Migration Guide](#migration-guide)
9. [Best Practices](#best-practices)

## Overview

The JSON Module System allows any JavaScript library to be used as a jsEnvoy module through declarative JSON configuration files, without requiring the library to implement Module or Tool classes. This system provides a bridge between the jsEnvoy tool ecosystem and the vast npm ecosystem.

### Key Features

- **Zero-code module creation** - Define modules entirely in JSON
- **Universal library support** - Works with any JavaScript library pattern
- **Type-safe** - Full schema validation and TypeScript support
- **Dependency injection** - Automatic resource management
- **Tool discovery** - Automatic function-to-tool mapping
- **Version control friendly** - JSON diffs are easy to review

## Motivation

Currently, creating a jsEnvoy module requires:
1. Creating a class that extends `Module`
2. Creating tool classes that extend `Tool`
3. Implementing specific methods and patterns
4. Understanding the jsEnvoy architecture

This creates barriers to adoption and makes it difficult to quickly wrap existing libraries. The JSON Module System removes these barriers by:

- Allowing module creation without writing code
- Supporting any library architecture (constructors, factories, singletons)
- Providing a declarative way to map library functions to tools
- Enabling rapid prototyping and experimentation

## Architecture

### System Overview

```
┌─────────────────────┐
│   module.json       │
│  Configuration      │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│  JsonModuleLoader   │
│  Reads & Validates  │
└──────────┬──────────┘
           │
┌──────────▼──────────┐     ┌──────────────────┐
│   GenericModule     │────▶│ Library Instance │
│  Dynamic Wrapper    │     │   (axios, etc)   │
└──────────┬──────────┘     └──────────────────┘
           │
┌──────────▼──────────┐
│   GenericTool       │
│  Function Wrapper   │
└─────────────────────┘
```

### Component Relationships

1. **module.json** - Declarative configuration file
2. **JsonModuleLoader** - Reads and validates module.json files
3. **GenericModule** - Runtime Module implementation
4. **GenericTool** - Runtime Tool wrapper for library functions
5. **Library Instance** - The actual npm package being wrapped

## module.json Schema

### Basic Structure

```json
{
  "$schema": "https://jsenvoy.dev/schemas/module.json",
  "name": "module-name",
  "version": "1.0.0",
  "description": "Module description",
  "package": "npm-package-name",
  "packageVersion": "^1.0.0",
  "type": "constructor|factory|singleton|static",
  "dependencies": {},
  "initialization": {},
  "tools": []
}
```

### Schema Properties

#### Root Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| $schema | string | No | JSON schema reference |
| name | string | Yes | Module identifier (lowercase, hyphens) |
| version | string | Yes | Module version (semver) |
| description | string | Yes | Human-readable description |
| package | string | Yes | npm package name or path |
| packageVersion | string | No | npm package version constraint |
| type | enum | Yes | Library type: constructor, factory, singleton, static |
| dependencies | object | No | Resource dependencies |
| initialization | object | No | Library initialization config |
| tools | array | Yes | Tool definitions |

#### Dependencies Object

Maps dependency names to their types and descriptions:

```json
"dependencies": {
  "apiKey": {
    "type": "string",
    "description": "API key for authentication",
    "required": true
  },
  "baseURL": {
    "type": "string", 
    "description": "Base URL for requests",
    "default": "https://api.example.com"
  }
}
```

#### Initialization Object

Configures how to initialize the library:

```json
"initialization": {
  "type": "constructor",
  "config": {
    "baseURL": "${baseURL}",
    "headers": {
      "Authorization": "Bearer ${apiKey}"
    }
  }
}
```

Initialization types:
- **constructor** - Use `new Library(config)`
- **factory** - Call `Library.create(config)` or similar
- **singleton** - Use `Library.getInstance()` or similar
- **static** - No initialization needed

#### Tools Array

Each tool maps a library function to a jsEnvoy tool:

```json
"tools": [{
  "name": "http_get",
  "description": "Make HTTP GET request",
  "function": "get",
  "async": true,
  "instanceMethod": true,
  "parameters": {
    "type": "object",
    "properties": {
      "url": {
        "type": "string",
        "description": "URL to fetch"
      }
    },
    "required": ["url"]
  },
  "output": {
    "success": {
      "type": "object",
      "properties": {
        "data": { "type": "any" },
        "status": { "type": "number" }
      }
    },
    "failure": {
      "type": "object",
      "properties": {
        "error": { "type": "string" }
      }
    }
  },
  "resultMapping": {
    "success": {
      "data": "$.data",
      "status": "$.status"
    }
  }
}]
```

Tool properties:
- **name** - Tool identifier
- **description** - Tool description
- **function** - Library function name or path (e.g., "utils.format")
- **async** - Whether the function is async
- **instanceMethod** - Whether it's an instance method vs static
- **parameters** - OpenAI function calling parameter schema
- **output** - Success/failure output schemas
- **resultMapping** - Optional JSONPath mapping for results

## Core Components

### JsonModuleLoader

Responsible for discovering and loading module.json files:

```javascript
class JsonModuleLoader {
  async loadJsonModule(jsonPath) {
    const config = await this.readAndValidate(jsonPath);
    return new GenericModule(config);
  }
  
  async discoverJsonModules(directory) {
    // Find all module.json files
  }
  
  validateConfiguration(config) {
    // Validate against JSON schema
  }
}
```

### GenericModule

Dynamic Module implementation that works with any library:

```javascript
class GenericModule extends Module {
  constructor(config, dependencies) {
    super();
    this.config = config;
    this.dependencies = dependencies;
    this.name = config.name;
    this.library = null;
    this.instance = null;
    this.tools = [];
    this._initialized = false;
    
    // Initialize asynchronously
    this._initPromise = this.initialize();
  }
  
  async initialize() {
    this.library = this.loadLibrary();
    this.instance = this.initializeLibrary(this.dependencies);
    this.tools = await this.createTools();
    this._initialized = true;
  }
  
  loadLibrary() {
    // Sophisticated loading with ESM/CommonJS fallback
    // Test environment support for Jest mocks
    // Local vs npm package resolution
  }
  
  initializeLibrary(dependencies) {
    // Initialize based on type: constructor, factory, singleton, static
    // Dependency injection with ${variable} substitution
  }
  
  async createTools() {
    // Create GenericTool instances with error handling
    // Supports both strict and lenient modes
  }
  
  async getTools() {
    await this._initPromise; // Ensure initialization complete
    return this.tools;
  }
}
```

**Implementation Insights:**
- Initialization is asynchronous to support ES module imports
- The `_initPromise` ensures tools are not accessed before initialization completes
- Dependency resolution supports template variable substitution like `${apiKey}`
- Error handling supports both strict mode (fail fast) and lenient mode (warn and continue)

### GenericTool

Wraps library functions as Tool instances:

```javascript
class GenericTool extends Tool {
  constructor(config, libraryInstance, functionPath) {
    super();
    this.name = config.name;
    this.description = config.description;
    this.config = config;
    this.library = libraryInstance;
    this.functionPath = functionPath || config.function;
    
    // Resolve function at construction time
    this.targetFunction = this.resolveFunction(this.functionPath);
    this.resultMapper = new ResultMapper();
  }
  
  resolveFunction(path) {
    // Parse path like "utils.format" or "methods[0]"
    // Handle dot notation, array indices, nested traversal
    // Validate resolved value is a function
  }
  
  async invoke(toolCall) {
    try {
      const args = this.parseArguments(toolCall.function.arguments);
      const result = await this.callFunction(args);
      const mappedResult = this.mapResult(result);
      return ToolResult.success(mappedResult);
    } catch (error) {
      const errorData = {
        functionName: this.functionPath,
        errorType: error.constructor.name,
        stack: error.stack,
        originalError: error
      };
      return ToolResult.failure(error.message, errorData);
    }
  }
  
  async callFunction(args) {
    const { instanceMethod = true, async: isAsync = true } = this.config;
    const argArray = this.prepareArguments(args);
    const context = instanceMethod ? this.library : null;
    
    if (isAsync) {
      return await this.targetFunction.apply(context, argArray);
    } else {
      return this.targetFunction.apply(context, argArray);
    }
  }
  
  prepareArguments(args) {
    // Convert object args to array based on parameter schema
    // Handle both single object and multiple parameter patterns
  }
}
```

**Implementation Insights:**
- Function resolution happens at construction time for early error detection
- Argument preparation intelligently converts object parameters to function arguments
- Context binding (`this`) is configurable via `instanceMethod` property
- Error data includes detailed debugging information including stack traces
- ResultMapper provides flexible result transformation capabilities

## Implementation Details

### Library Loading

The system supports multiple library loading patterns with sophisticated fallback logic:

1. **npm packages** - Load from node_modules using require() or import()
2. **Local modules** - Load from file paths relative to module.json location
3. **Scoped packages** - Support @scope/package names
4. **ESM and CommonJS** - Handle both module systems with automatic fallback
5. **Test environment support** - Respects Jest mocks by preferring CommonJS in test environments

**Implementation Insights:**
- The GenericModule.js:51-95 implements sophisticated module loading that tries CommonJS first, then falls back to ES modules if ERR_REQUIRE_ESM is encountered
- Test environments (NODE_ENV=test or JEST_WORKER_ID) are handled specially to respect Jest mocks
- Local modules are resolved relative to the module.json directory using `config._metadata.directory`

### Function Resolution

Functions can be specified in multiple ways with robust path resolution:

```json
// Simple method
"function": "get"

// Nested method  
"function": "utils.format"

// Array index
"function": "methods[0]"

// Dynamic path (not yet implemented)
"function": "${methodName}"
```

**Implementation Insights:**
- GenericTool.js:35-57 implements a sophisticated path resolver that handles dot notation, array indices, and nested object traversal
- The resolver validates that the final resolved value is actually a function
- Error messages provide clear context about which part of the path failed

### Error Handling

The system provides comprehensive error handling with detailed error propagation:

1. **Configuration errors** - Invalid module.json with validation details
2. **Loading errors** - Package not found with enhanced error messages
3. **Initialization errors** - Constructor failures with context
4. **Runtime errors** - Function call failures with stack traces
5. **Tool result validation** - Output schema validation with warnings

**Implementation Insights:**
- Tool.js:55-89 implements a `safeInvoke` wrapper that guarantees ToolResult objects are returned
- Error messages are enhanced with context like tool name, error type, and original stack traces
- GenericModule.js includes fallback behavior when tools fail to create (warnings vs strict mode failures)

### Type Safety and Validation

Full validation system implemented through:

1. **Schema validation** - SchemaValidator.js provides comprehensive module.json validation
2. **Runtime parameter validation** - Tool.js:173-178 validates required parameters
3. **Output schema validation** - ToolResult.js:69-144 validates results against output schemas
4. **Dependency type checking** - ResourceManager validates dependency availability

**Implementation Insights:**
- Manual schema validation is implemented instead of external JSON schema libraries for better control
- ToolResult validation includes both success and failure schema validation
- The system includes property-level type checking and enum validation

## Examples

### Example 1: Axios HTTP Client

```json
{
  "name": "axios",
  "version": "1.0.0",
  "description": "HTTP client for browsers and node.js",
  "package": "axios",
  "packageVersion": "^1.0.0",
  "type": "factory",
  "dependencies": {
    "baseURL": {
      "type": "string",
      "description": "Base URL for all requests",
      "required": false
    }
  },
  "initialization": {
    "type": "factory",
    "method": "create",
    "config": {
      "baseURL": "${baseURL}",
      "timeout": 30000
    }
  },
  "tools": [
    {
      "name": "http_get",
      "description": "Make HTTP GET request",
      "function": "get",
      "async": true,
      "parameters": {
        "type": "object",
        "properties": {
          "url": {
            "type": "string",
            "description": "URL to fetch"
          },
          "params": {
            "type": "object",
            "description": "Query parameters"
          },
          "headers": {
            "type": "object",
            "description": "Request headers"
          }
        },
        "required": ["url"]
      },
      "output": {
        "success": {
          "type": "object",
          "properties": {
            "data": { "type": "any" },
            "status": { "type": "number" },
            "statusText": { "type": "string" },
            "headers": { "type": "object" }
          }
        },
        "failure": {
          "type": "object",
          "properties": {
            "message": { "type": "string" },
            "code": { "type": "string" },
            "status": { "type": "number" }
          }
        }
      }
    },
    {
      "name": "http_post",
      "description": "Make HTTP POST request",
      "function": "post",
      "async": true,
      "parameters": {
        "type": "object",
        "properties": {
          "url": { "type": "string" },
          "data": { "type": "any" },
          "headers": { "type": "object" }
        },
        "required": ["url"]
      }
    }
  ]
}
```

### Example 2: Lodash Utilities

```json
{
  "name": "lodash",
  "version": "1.0.0",
  "description": "JavaScript utility library",
  "package": "lodash",
  "type": "static",
  "tools": [
    {
      "name": "array_chunk",
      "description": "Split array into chunks",
      "function": "chunk",
      "parameters": {
        "type": "object",
        "properties": {
          "array": {
            "type": "array",
            "description": "Array to split"
          },
          "size": {
            "type": "number",
            "description": "Chunk size",
            "default": 1
          }
        },
        "required": ["array"]
      }
    },
    {
      "name": "object_merge",
      "description": "Deep merge objects",
      "function": "merge",
      "parameters": {
        "type": "object",
        "properties": {
          "target": { "type": "object" },
          "sources": { 
            "type": "array",
            "items": { "type": "object" }
          }
        },
        "required": ["target", "sources"]
      }
    }
  ]
}
```

### Example 3: Moment.js Date Library

```json
{
  "name": "moment",
  "version": "1.0.0",
  "description": "Parse, validate and display dates",
  "package": "moment",
  "type": "factory",
  "initialization": {
    "type": "factory",
    "treatAsConstructor": true
  },
  "tools": [
    {
      "name": "date_parse",
      "description": "Parse date string",
      "function": "root",
      "parameters": {
        "type": "object", 
        "properties": {
          "date": {
            "type": "string",
            "description": "Date string to parse"
          },
          "format": {
            "type": "string",
            "description": "Date format"
          }
        },
        "required": ["date"]
      },
      "resultMapping": {
        "transform": "instance"
      }
    },
    {
      "name": "date_format",
      "description": "Format a date",
      "instanceMethod": true,
      "function": "format",
      "parameters": {
        "type": "object",
        "properties": {
          "format": {
            "type": "string",
            "description": "Output format",
            "default": "YYYY-MM-DD"
          }
        }
      }
    }
  ]
}
```

## Migration Guide

### Converting Existing Modules

To convert a traditional Module to JSON:

1. **Identify the module structure**
   ```javascript
   class MyModule extends Module {
     static dependencies = ['apiKey'];
     constructor({apiKey}) {
       this.client = new Library({apiKey});
     }
   }
   ```

2. **Create module.json**
   ```json
   {
     "name": "my-module",
     "package": "library-name",
     "dependencies": {
       "apiKey": {"type": "string", "required": true}
     },
     "initialization": {
       "type": "constructor",
       "config": {"apiKey": "${apiKey}"}
     }
   }
   ```

3. **Map tools**
   - List all tools in the module
   - Map each tool's execute method to library functions
   - Define parameters and output schemas

### Gradual Migration

The system supports gradual migration:

1. Start with simple, stateless utilities
2. Move to configured clients
3. Finally migrate complex modules

Both systems can coexist - use JSON modules for simple cases and traditional modules for complex logic.

## Best Practices

### 1. Module Design

- **Single responsibility** - One library per module
- **Clear naming** - Use descriptive tool names
- **Consistent patterns** - Similar functions should have similar interfaces

### 2. Parameter Design

- **Required vs optional** - Mark truly required parameters
- **Defaults** - Provide sensible defaults
- **Validation** - Use detailed schemas

### 3. Error Handling

- **Graceful failures** - Always return ToolResult
- **Meaningful errors** - Include context in error messages
- **Partial success** - Return what succeeded

### 4. Documentation

- **Descriptions** - Every tool needs a clear description
- **Examples** - Include usage examples in descriptions
- **Parameter docs** - Document each parameter

### 5. Testing

- **Schema validation** - Test module.json validity
- **Mock testing** - Test with mock libraries
- **Integration testing** - Test with real libraries

## Implementation Status and Insights

### Current Implementation State

The JSON Module System has been **fully implemented** with the following components:

#### ✅ Completed Features

1. **Core Infrastructure** (packages/module-loader/src/)
   - `Tool.js` - Base tool class with OpenAI function calling format
   - `ToolResult.js` - Standardized result format with validation
   - `Module.js` - Base module class 
   - `ResourceManager.js` - Dependency injection with .env file support
   - `ModuleFactory.js` - Factory with JSON module creation

2. **JSON Module System** 
   - `JsonModuleLoader.js` - Loads and validates module.json files
   - `GenericModule.js` - Dynamic module wrapper for any library
   - `GenericTool.js` - Dynamic tool wrapper for library functions
   - `SchemaValidator.js` - Manual schema validation system
   - `ResultMapper.js` - Result transformation utilities

3. **Advanced Features**
   - **Asynchronous initialization** - Modules initialize asynchronously to support ES imports
   - **ES Module/CommonJS hybrid loading** - Automatic fallback between module systems
   - **Test environment support** - Jest mock compatibility 
   - **Dependency injection** - Template variable substitution (`${apiKey}`)
   - **Function path resolution** - Dot notation, array indices, nested object traversal
   - **Error handling** - Comprehensive error context and stack traces
   - **Schema validation** - Full validation of module.json configurations

#### 🔄 Key Implementation Insights

1. **Module Loading Complexity**
   - The implementation handles the complexity of mixed ES module/CommonJS environments
   - Test environments require special handling to respect Jest mocks
   - Local module resolution is relative to the module.json file location

2. **Asynchronous Architecture**
   - Module initialization is inherently async due to dynamic imports
   - The `_initPromise` pattern ensures tools aren't accessed before initialization
   - Tool creation is also async to handle dynamic imports

3. **Error Handling Philosophy**
   - Tools **never throw exceptions** - they always return ToolResult objects
   - The `safeInvoke` wrapper provides additional safety for poorly implemented tools
   - Error messages include rich context for debugging

4. **Validation Strategy**
   - Manual schema validation instead of external libraries for better control
   - Both strict and lenient validation modes supported
   - Runtime validation of tool results against output schemas

5. **Argument Handling Intelligence**
   - Smart conversion between OpenAI function calling format and library function calls
   - Support for both single-object and multi-parameter function signatures
   - Context binding (`this`) configurable per tool

### Real-World Usage Patterns

The implementation supports several discovered patterns:

1. **Library Initialization Patterns**
   ```javascript
   // Constructor: new Library(config)
   // Factory: Library.create(config) 
   // Singleton: Library.getInstance()
   // Static: Library.method() directly
   ```

2. **Function Resolution Patterns**
   ```javascript
   "function": "method"           // Simple method
   "function": "utils.format"     // Nested property
   "function": "methods[0]"       // Array index
   ```

3. **Dependency Injection Patterns**
   ```json
   "config": {
     "apiKey": "${env.API_KEY}",
     "baseURL": "${baseURL}"
   }
   ```

### Performance Considerations

- **Lazy loading** - Libraries are only loaded when modules are instantiated
- **Function resolution caching** - Functions are resolved once at construction time
- **Module caching** - JsonModuleLoader includes optional caching
- **Minimal validation overhead** - Manual validation is faster than external JSON schema libraries

## Conclusion

The JSON Module System has evolved from design to a robust, production-ready implementation that democratizes tool creation in jsEnvoy. The implementation includes sophisticated handling of JavaScript module systems, comprehensive error handling, and intelligent argument processing that makes it possible to wrap virtually any JavaScript library without writing code.

Key implementation strengths:
- **Universal compatibility** - Works with ESM, CommonJS, constructors, factories, singletons
- **Developer experience** - Rich error messages, validation, and debugging support  
- **Test friendliness** - Jest mock support and comprehensive test coverage
- **Production readiness** - Async architecture, error handling, and performance optimizations

This system provides a foundation for a rich ecosystem of tools while maintaining the type safety and consistency of the jsEnvoy framework.