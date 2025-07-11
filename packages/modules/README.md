# @jsenvoy/modules

Core infrastructure for building modular tool systems. This package provides the essential base classes, dependency injection, and module management capabilities that enable the creation of extensible tool libraries.

## What This Package Provides

- **Base Classes**: Foundation classes for building tools and modules
- **Dependency Injection**: ResourceManager for managing dependencies
- **Module Factory**: Factory pattern for creating modules with resolved dependencies
- **Tool Infrastructure**: Everything needed to build tool systems

## Key Components

- `OpenAITool` - Base class for individual tools
- `OpenAIModule` - Container for related tools  
- `ResourceManager` - Dependency injection container
- `ModuleFactory` - Creates modules with dependency resolution

## Usage

```javascript
const { OpenAITool, OpenAIModule, ResourceManager, ModuleFactory } = require('@jsenvoy/modules');

// Create a tool
class MyTool extends OpenAITool {
  constructor() {
    super();
    this.name = 'my_tool';
    this.description = 'My custom tool';
  }
  
  async execute(args) {
    return { result: 'success' };
  }
}

// Create a module
class MyModule extends OpenAIModule {
  constructor() {
    super();
    this.name = 'my_module';
    this.tools = [new MyTool()];
  }
}
```

This package contains **infrastructure only** - actual tools are in `@jsenvoy/tools`.