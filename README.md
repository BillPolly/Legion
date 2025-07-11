# jsEnvoy - Modular AI Agent Tools Framework

A monorepo containing a modular framework for building AI agent tools with OpenAI function calling format and a generic CLI for tool execution.

## Packages

### [@jsenvoy/core](packages/core)
Core framework providing:
- 🏗️ **Modular Architecture**: Modules contain related tools
- 💉 **Dependency Injection**: Declarative dependency management
- 🤖 **OpenAI Compatible**: Tools use OpenAI function calling format
- 🛡️ **Type Safe**: Built-in parameter validation
- 🔧 **Extensible**: Easy to add new modules and tools

### [@jsenvoy/cli](packages/cli) 
Generic command-line interface providing:
- 🔍 **Dynamic Discovery**: Auto-discovers all modules and tools
- ⚡ **Zero Config**: Works out-of-the-box
- 💬 **Interactive Mode**: REPL with autocomplete
- 🎯 **Flexible**: Multiple argument formats
- 📦 **Module Agnostic**: Works with any jsEnvoy module

## Quick Start

### Using the CLI

```bash
# Install globally
npm install -g @jsenvoy/cli

# Execute a tool
jsenvoy calculator.calculator_evaluate --expression "2 + 2"

# Interactive mode
jsenvoy -i
```

### Using the Core Framework

```javascript
const { ResourceManager, ModuleFactory } = require('@jsenvoy/core');
const { CalculatorModule } = require('@jsenvoy/core/modules');

const resourceManager = new ResourceManager();
const moduleFactory = new ModuleFactory(resourceManager);
const calculator = moduleFactory.createModule(CalculatorModule);

const tool = calculator.getTools()[0];
const result = await tool.execute({ expression: '2 + 2' });
```

## Project Structure

```
jsEnvoy/
├── packages/
│   ├── core/           # Core framework
│   │   ├── src/
│   │   ├── __tests__/
│   │   └── package.json
│   └── cli/            # CLI tool
│       ├── src/
│       ├── docs/
│       └── package.json
├── docs/               # Project documentation
└── package.json        # Monorepo root
```

## Development

This is a monorepo managed with npm workspaces.

```bash
# Install dependencies
npm install

# Run tests for all packages
npm test

# Run tests for specific package
npm run test:core
npm run test:cli

# Run tests with coverage
npm run test:coverage
```

## Available Modules

### Core Modules
- **CalculatorModule**: Mathematical calculations
- **FileModule**: File system operations (read, write, create directories)

### Additional Tools
- **GitHub Tool**: Repository creation and management
- Web crawler, screenshot, and other legacy tools

## Architecture

The framework uses a modular architecture with dependency injection:

1. **Modules** are containers for related tools
2. **Tools** implement specific functionality in OpenAI function format
3. **ResourceManager** handles dependency injection
4. **ModuleFactory** creates module instances with resolved dependencies

See [Architecture Documentation](docs/ARCHITECTURE.md) for details.

## Contributing

1. Create new modules in `packages/core/src/modules/`
2. Follow the existing patterns for OpenAIModule and OpenAITool
3. Write tests using TDD approach
4. Update documentation

## License

MIT