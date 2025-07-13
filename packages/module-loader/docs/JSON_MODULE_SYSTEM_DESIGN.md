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
    this.library = this.loadLibrary();
    this.instance = this.initializeLibrary(dependencies);
    this.tools = this.createTools();
  }
  
  loadLibrary() {
    // Dynamic import or require
  }
  
  initializeLibrary(dependencies) {
    // Initialize based on type and config
  }
  
  createTools() {
    // Create GenericTool instances
  }
}
```

### GenericTool

Wraps library functions as Tool instances:

```javascript
class GenericTool extends Tool {
  constructor(config, libraryInstance, functionPath) {
    super();
    this.config = config;
    this.library = libraryInstance;
    this.targetFunction = this.resolveFunction(functionPath);
  }
  
  async invoke(toolCall) {
    try {
      const args = this.parseArguments(toolCall.function.arguments);
      const result = await this.callFunction(args);
      return this.mapResult(result);
    } catch (error) {
      return ToolResult.failure(error.message);
    }
  }
}
```

## Implementation Details

### Library Loading

The system supports multiple library loading patterns:

1. **npm packages** - Load from node_modules
2. **Local modules** - Load from file paths
3. **Scoped packages** - Support @scope/package names
4. **ESM and CommonJS** - Handle both module systems

### Function Resolution

Functions can be specified in multiple ways:

```json
// Simple method
"function": "get"

// Nested method
"function": "utils.format"

// Array index
"function": "methods[0]"

// Dynamic path
"function": "${methodName}"
```

### Error Handling

The system provides comprehensive error handling:

1. **Configuration errors** - Invalid module.json
2. **Loading errors** - Package not found
3. **Initialization errors** - Constructor failures
4. **Runtime errors** - Function call failures

### Type Safety

Full TypeScript support through:

1. Generated type definitions from module.json
2. Runtime parameter validation
3. Output schema validation
4. Dependency type checking

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

## Conclusion

The JSON Module System democratizes tool creation in jsEnvoy by removing code barriers and enabling rapid integration of any JavaScript library. This design provides a foundation for a rich ecosystem of tools while maintaining the type safety and consistency of the jsEnvoy framework.