# @jsenvoy/core

Core framework for jsEnvoy - A modular system for building AI agent tools using OpenAI function calling format.

## Features

- **Modular Architecture**: Modules contain related tools
- **Dependency Injection**: Declarative dependency management via ResourceManager
- **OpenAI Compatible**: All tools return OpenAI function calling format
- **Type Safe**: Built-in parameter validation
- **Extensible**: Easy to add new modules and tools

## Installation

```bash
npm install @jsenvoy/core
```

## Usage

```javascript
const { ResourceManager, ModuleFactory } = require('@jsenvoy/core');
const { CalculatorModule, FileModule } = require('@jsenvoy/core/modules');

// Set up resources
const resourceManager = new ResourceManager();
resourceManager.register('basePath', './data');
resourceManager.register('encoding', 'utf8');

// Create modules
const moduleFactory = new ModuleFactory(resourceManager);
const calculator = moduleFactory.createModule(CalculatorModule);
const fileModule = moduleFactory.createModule(FileModule);

// Use tools
const calcTool = calculator.getTools()[0];
const result = await calcTool.execute({ expression: '2 + 2' });
```

## Modules

- **CalculatorModule**: Mathematical calculations
- **FileModule**: File system operations
- **GitHub Module**: GitHub repository management (in tools/openai/github)

## Documentation

See the [docs](../../docs) directory for architecture and implementation details.