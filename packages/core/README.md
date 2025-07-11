# @jsenvoy/core

Core infrastructure for jsEnvoy - A modular framework for building AI agent tools. This package provides the essential building blocks for creating modular AI agents.

## Installation

```bash
npm install @jsenvoy/core
```

## Overview

The core package has been refactored into a lightweight infrastructure package that provides:
- **ResourceManager** - Dependency injection system
- **ModuleFactory** - Module instantiation with automatic dependency resolution
- **Base Classes** - OpenAIModule and OpenAITool for creating new modules
- **Built-in Modules** - Calculator and File modules

The heavier components have been split into separate packages for better modularity:
- `@jsenvoy/tools` - All AI agent tools
- `@jsenvoy/model-providers` - LLM provider implementations
- `@jsenvoy/response-parser` - Response parsing and validation
- `@jsenvoy/agent` - Agent implementation with retry logic

## Usage

### Basic Module Creation

```javascript
const { ResourceManager, ModuleFactory } = require('@jsenvoy/core');
const { CalculatorModule, FileModule } = require('@jsenvoy/core');

// Set up resources
const resourceManager = new ResourceManager();
resourceManager.register('basePath', './data');
resourceManager.register('encoding', 'utf8');
resourceManager.register('createDirectories', true);
resourceManager.register('permissions', 0o755);

// Create module factory
const moduleFactory = new ModuleFactory(resourceManager);

// Create module instances
const calculator = moduleFactory.createModule(CalculatorModule);
const fileModule = moduleFactory.createModule(FileModule);

// Use tools
const calcTool = calculator.getTools()[0];
const result = await calcTool.execute({ expression: '2 + 2' });
console.log(result); // { result: 4 }
```

### Creating Custom Modules

```javascript
const { OpenAIModule, OpenAITool } = require('@jsenvoy/core');

class CustomTool extends OpenAITool {
  constructor() {
    super(
      'custom_tool',
      'My custom tool',
      {
        type: 'object',
        properties: {
          input: { type: 'string', description: 'Input data' }
        },
        required: ['input']
      }
    );
  }

  async execute(args) {
    // Tool implementation
    return { result: `Processed: ${args.input}` };
  }
}

class CustomModule extends OpenAIModule {
  constructor(dependencies = {}) {
    super('CustomModule', dependencies);
    this.tools = [new CustomTool()];
  }
  
  static dependencies = ['apiKey', 'endpoint'];
}

// Use the custom module
const resourceManager = new ResourceManager();
resourceManager.register('apiKey', process.env.API_KEY);
resourceManager.register('endpoint', 'https://api.example.com');

const moduleFactory = new ModuleFactory(resourceManager);
const customModule = moduleFactory.createModule(CustomModule);
```

## Core Components

### ResourceManager

Manages dependency injection across modules:

```javascript
const resourceManager = new ResourceManager();

// Register resources
resourceManager.register('key', 'value');
resourceManager.registerMultiple({
  basePath: '/data',
  timeout: 5000,
  retries: 3
});

// Check and retrieve
if (resourceManager.has('basePath')) {
  const path = resourceManager.get('basePath');
}

// Get all resources
const all = resourceManager.getAll();
```

### ModuleFactory

Creates module instances with automatic dependency injection:

```javascript
const moduleFactory = new ModuleFactory(resourceManager);

// Create module with dependencies resolved
const module = moduleFactory.createModule(ModuleClass);

// Create with override dependencies
const moduleWithOverrides = moduleFactory.createModule(ModuleClass, {
  customDep: 'override value'
});
```

### OpenAIModule Base Class

Base class for creating OpenAI-compatible modules:

```javascript
class MyModule extends OpenAIModule {
  constructor(dependencies = {}) {
    super('MyModule', dependencies);
    this.tools = [/* tool instances */];
  }
  
  static dependencies = ['requiredDep1', 'requiredDep2'];
  
  getTools() {
    return this.tools;
  }
}
```

### OpenAITool Base Class

Base class for creating OpenAI-compatible tools:

```javascript
class MyTool extends OpenAITool {
  constructor() {
    super(
      'tool_name',
      'Tool description',
      { /* JSON Schema for parameters */ }
    );
  }
  
  async execute(args) {
    // Implementation
    return { /* results */ };
  }
}
```

## Built-in Modules

### CalculatorModule

Evaluates mathematical expressions:

```javascript
const calculator = moduleFactory.createModule(CalculatorModule);
const tool = calculator.getTools()[0];
const result = await tool.execute({ 
  expression: "Math.sqrt(16) + Math.pow(2, 3)" 
});
// result: { result: 12 }
```

### FileModule

File system operations with safety features:

```javascript
const fileModule = moduleFactory.createModule(FileModule);
const tools = fileModule.getTools();

// File reader
const reader = tools.find(t => t.name === 'file_reader');
const content = await reader.execute({ 
  filePath: 'data.txt' 
});

// File writer
const writer = tools.find(t => t.name === 'file_writer');
await writer.execute({ 
  filePath: 'output.txt',
  content: 'Hello World',
  append: false 
});

// Directory creator
const dirCreator = tools.find(t => t.name === 'directory_creator');
await dirCreator.execute({ 
  directoryPath: 'new-folder',
  recursive: true 
});
```

Required resources for FileModule:
- `basePath` - Base directory for file operations
- `encoding` - File encoding (default: 'utf8')
- `createDirectories` - Auto-create parent directories
- `permissions` - Directory permissions (default: 0o755)

## Migration from Monolithic Core

If you're upgrading from the previous monolithic @jsenvoy/core:

1. Install the new packages:
```bash
npm install @jsenvoy/core@latest @jsenvoy/tools @jsenvoy/model-providers @jsenvoy/agent
```

2. Update imports:
```javascript
// Old
const { Agent, Model, calculatorTool } = require('@jsenvoy/core');

// New
const { ResourceManager, ModuleFactory } = require('@jsenvoy/core');
const { Agent } = require('@jsenvoy/agent');
const { Model } = require('@jsenvoy/model-providers');
const { calculatorTool } = require('@jsenvoy/tools');
```

## Benefits of the Split Architecture

1. **Smaller Bundle Sizes** - Only include what you need
2. **Independent Versioning** - Each package can evolve separately
3. **Clearer Dependencies** - See exactly what each package requires
4. **Better Type Safety** - Focused type definitions per package
5. **Easier Testing** - Test packages in isolation

## License

MIT