# Legion Module-Loader Design

## Overview

The `@legion/module-loader` package provides the core infrastructure for building modular tool systems in the Legion framework. It enables the creation of extensible tool libraries through clean base classes, dependency injection, and comprehensive event systems.

## Architecture Principles

### 1. Event-Driven Architecture
Both Tools and Modules extend `EventEmitter` and provide standardized event emission:
- **Tools** emit events directly using helper methods (`progress()`, `info()`, `warning()`, `error()`)
- **Modules** forward tool events and add module context
- **Event propagation** flows: Tool → Module → External listeners

### 2. Clean Base Classes
- **Tool** - Simple EventEmitter-based class for individual functions
- **Module** - Container for related tools with event forwarding
- **No complex delegation** - Direct event emission without intermediate layers

### 3. Dependency Injection
- **ResourceManager** - Central registry for all resources (API keys, configs, clients)
- **ModuleFactory** - Creates modules with resolved dependencies
- **Automatic .env loading** - ResourceManager loads entire .env file automatically

## Core Components

### Tool Class

The foundation class for all Legion tools:

```javascript
class Tool extends EventEmitter {
  constructor(config = {}) {
    super();
    this.name = config.name;
    this.description = config.description;
    this.inputSchema = config.inputSchema || z.any();
  }
  
  async execute(params) {
    // Must be implemented by subclasses
  }
  
  // Helper methods for standardized events
  progress(message, percentage = null, additionalData = {}) { ... }
  info(message, data = {}) { ... }
  warning(message, data = {}) { ... }
  error(message, data = {}) { ... }
}
```

**Key Features:**
- Extends `EventEmitter` directly for simple event emission
- Constructor accepts configuration object with name, description, and Zod schema
- Helper methods provide consistent event structure
- `execute()` method must be implemented by subclasses
- `run()` method handles validation and error wrapping

### Module Class

Container for related tools with automatic event forwarding:

```javascript
class Module extends EventEmitter {
  constructor(name = '') {
    super();
    this.name = name;
    this.tools = [];
    this.toolMap = new Map();
  }
  
  registerTool(tool) {
    this.tools.push(tool);
    this.toolMap.set(tool.name, tool);
    
    // Forward tool events with module context
    if (tool instanceof EventEmitter) {
      tool.on('event', (event) => {
        const moduleEvent = { ...event, module: this.name };
        this.emit(event.type, moduleEvent);
        this.emit('event', moduleEvent);
      });
    }
  }
}
```

**Key Features:**
- Automatic event forwarding from tools to module listeners
- Module context is added to all forwarded events
- Tool registration with name-based lookup
- OpenAI function calling adapter support

### ResourceManager

Central dependency injection container with automatic environment loading:

```javascript
class ResourceManager {
  constructor() {
    this.resources = new Map();
    this.parent = null;
  }
  
  async initialize() {
    // Automatically loads entire .env file
    dotenv.config();
    
    // Register all environment variables as env.VARIABLE_NAME
    for (const [key, value] of Object.entries(process.env)) {
      this.register(`env.${key}`, value);
    }
  }
  
  register(name, resource) {
    this.resources.set(name, resource);
  }
  
  get(name) {
    // Check local resources first, then parent hierarchy
    return this.resources.get(name) || 
           (this.parent && this.parent.get(name));
  }
}
```

**Critical Feature:** ResourceManager automatically loads the entire .env file and makes all environment variables available as `env.VARIABLE_NAME` without any manual setup.

### ModuleLoader

Primary interface for loading and managing modules:

```javascript
class ModuleLoader {
  constructor(resourceManager) {
    this.resourceManager = resourceManager;
    this.moduleFactory = new ModuleFactory(resourceManager);
    this.modules = new Map();
  }
  
  async loadModuleByName(name, ModuleClass) {
    const module = this.moduleFactory.createModule(ModuleClass);
    module.name = name; // Override with loader-provided name
    await module.initialize();
    this.modules.set(name, module);
    return module;
  }
  
  async loadModuleFromJson(jsonPath) {
    const config = await this.jsonModuleLoader.loadJsonModule(jsonPath);
    return new GenericModule(config);
  }
}
```

**Key Features:**
- Unified interface for loading both class-based and JSON-defined modules
- Module name assignment and lifecycle management
- Integration with ResourceManager for dependency injection

## Event System

### Event Structure

All events follow a consistent structure:

```javascript
{
  type: 'progress' | 'info' | 'warning' | 'error',
  tool: 'tool_name',           // Source tool name
  module: 'module_name',       // Source module (added by Module)
  message: 'Human readable message',
  data: { /* event-specific data */ },
  timestamp: '2024-01-01T12:00:00.000Z'
}
```

### Event Flow

1. **Tool Emission** - Tools emit events using helper methods
2. **Module Forwarding** - Modules automatically forward tool events
3. **Context Addition** - Module name is added to forwarded events
4. **External Listening** - Applications listen to module events

### Event Types

- **progress** - Operation progress with optional percentage
- **info** - General informational messages
- **warning** - Non-critical issues or notices
- **error** - Critical errors (informational only - actual errors should be thrown)

## JSON Module System

### Overview

The JSON Module System allows any JavaScript library to be used as a Legion module through declarative JSON configuration files, without requiring custom Tool/Module classes.

### module.json Schema

```json
{
  "name": "module-name",
  "version": "1.0.0", 
  "description": "Module description",
  "package": "npm-package-name",
  "type": "constructor|factory|singleton|static",
  "dependencies": {
    "apiKey": {
      "type": "string",
      "description": "API key for authentication",
      "required": true
    }
  },
  "initialization": {
    "type": "constructor",
    "config": {
      "apiKey": "${apiKey}",
      "timeout": 30000
    }
  },
  "tools": [
    {
      "name": "tool_name",
      "description": "Tool description",
      "function": "methodName",
      "async": true,
      "parameters": {
        "type": "object",
        "properties": {
          "param": {"type": "string", "description": "Parameter"}
        },
        "required": ["param"]
      }
    }
  ]
}
```

### GenericModule and GenericTool

**GenericModule** dynamically wraps any JavaScript library:
- Supports constructor, factory, singleton, and static initialization patterns
- Handles ES modules and CommonJS with automatic fallback
- Dependency injection with template variable substitution
- Asynchronous initialization for dynamic imports

**GenericTool** wraps library functions as Legion tools:
- Function path resolution (dot notation, array indices)
- Argument conversion between OpenAI format and function calls
- Context binding (`this`) configuration
- Comprehensive error handling with stack traces

## Development Patterns

### Creating a Tool

```javascript
import Tool from '@legion/module-loader';
import { z } from 'zod';

class MyTool extends Tool {
  constructor() {
    super({
      name: 'my_tool',
      description: 'Does something useful',
      inputSchema: z.object({
        input: z.string().describe('Input value')
      })
    });
  }
  
  async execute(params) {
    this.progress('Starting processing', 0);
    
    try {
      const result = await doSomething(params.input);
      
      this.info('Processing complete', { itemCount: result.length });
      this.progress('Complete', 100);
      
      return result;
    } catch (error) {
      this.error('Processing failed', { error: error.message });
      throw error;
    }
  }
}
```

### Creating a Module

```javascript
import { Module } from '@legion/module-loader';

class MyModule extends Module {
  constructor(dependencies = {}) {
    super('my-module');
    this.dependencies = dependencies;
  }
  
  async initialize() {
    // Create and register tools
    this.registerTool(new MyTool(this.dependencies));
    this.registerTool(new AnotherTool(this.dependencies));
    return this;
  }
  
  getTools() {
    return this.tools;
  }
}
```

### Using the System

```javascript
import { ModuleLoader, ResourceManager } from '@legion/module-loader';

// Initialize ResourceManager (automatically loads .env)
const resourceManager = new ResourceManager();
await resourceManager.initialize();

// Create ModuleLoader
const moduleLoader = new ModuleLoader(resourceManager);

// Load a module
const myModule = await moduleLoader.loadModuleByName('my-module', MyModule);

// Listen to events
myModule.on('event', (event) => {
  console.log(`[${event.type}] ${event.message}`, event.data);
});

// Execute tools
const tools = myModule.getTools();
const myTool = tools.find(t => t.name === 'my_tool');
const result = await myTool.execute({ input: 'test' });
```

## API Key Management

### Automatic Environment Loading

**Critical:** ResourceManager automatically loads the entire .env file on initialization and makes ALL environment variables available as `resourceManager.get('env.VARIABLE_NAME')`.

This means:
- `ANTHROPIC_API_KEY` → `resourceManager.get('env.ANTHROPIC_API_KEY')`
- `GITHUB_PAT` → `resourceManager.get('env.GITHUB_PAT')`
- `RAILWAY_API_TOKEN` → `resourceManager.get('env.RAILWAY_API_TOKEN')`

### Module Dependency Injection

```javascript
class GitHubModule extends Module {
  static dependencies = ['env.GITHUB_PAT', 'env.GITHUB_ORG'];
  
  constructor(dependencies) {
    super('github');
    this.githubPAT = dependencies['env.GITHUB_PAT'];
    this.githubOrg = dependencies['env.GITHUB_ORG'];
  }
}

// ModuleFactory automatically injects resolved dependencies
const moduleFactory = new ModuleFactory(resourceManager);
const githubModule = moduleFactory.createModule(GitHubModule);
```

## Testing Architecture

### Live Integration Testing

The package includes comprehensive live integration tests that validate:
- Real module loading from external packages
- Complete event system functionality
- Actual API key injection via ResourceManager
- End-to-end tool execution

### Event System Testing

Specialized testing infrastructure includes:
- **EventTestTool** - Comprehensive tool that emits all event types with realistic scenarios
- **EventTestModule** - Module wrapper demonstrating event forwarding
- **LiveEventTesting.test.js** - 9 comprehensive tests validating complete event flow

### Test Organization

```
__tests__/
├── unit/           # Unit tests for individual components
├── integration/    # Integration tests with real dependencies
└── utils/          # Test utilities and fixtures
```

## Migration from Legacy Systems

### Key Changes Made

1. **Simplified Tool Base Class**
   - Removed complex event delegation
   - Direct EventEmitter inheritance
   - Helper methods for standardized events

2. **Clean Module Architecture**
   - Automatic event forwarding
   - Module context addition
   - Simple tool registration

3. **Comprehensive Testing**
   - Live integration tests
   - Event system validation
   - Real API key testing

### Backward Compatibility

The system maintains backward compatibility through:
- **OpenAIToolAdapter** - Wraps tools for OpenAI function calling
- **LegacyToolAdapter** - Supports older tool patterns
- **Gradual migration** - Old and new systems can coexist

## Performance Considerations

- **Lazy loading** - Libraries loaded only when needed
- **Function caching** - Resolved functions cached at construction time
- **Minimal validation overhead** - Manual validation faster than external libraries
- **Event propagation** - Efficient forwarding without deep copying

## Security Considerations

- **Environment isolation** - ResourceManager controls access to environment variables
- **Input validation** - Zod schema validation for all tool inputs
- **Error boundary** - Tools never expose internal errors to external callers

## Conclusion

The Legion module-loader provides a robust, event-driven foundation for building modular tool systems. Key strengths include:

- **Clean Architecture** - Simple base classes without complex abstractions
- **Comprehensive Events** - Real-time progress and status reporting
- **Flexible Module Loading** - Support for both class-based and JSON-defined modules
- **Automatic Dependency Injection** - Seamless API key and resource management
- **Production Ready** - Comprehensive testing, error handling, and performance optimization

This design enables rapid development of AI agent tools while maintaining consistency, type safety, and excellent developer experience.