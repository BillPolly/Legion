# jsEnvoy - Modular AI Agent Tools Framework

A modular framework for building AI agent tools with consistent interfaces. This monorepo has been restructured into focused packages for better modularity and maintainability.

## Packages

### [@jsenvoy/core](packages/core) - Lightweight Infrastructure
Core framework providing:
- 🏗️ **ResourceManager**: Dependency injection system
- 🏭 **ModuleFactory**: Module instantiation with automatic dependency resolution
- 🧩 **Base Classes**: OpenAIModule and OpenAITool for creating new modules
- 📦 **Built-in Modules**: Calculator and File modules

### [@jsenvoy/cli](packages/cli) - Command Line Interface
Feature-complete CLI providing:
- 🔍 **Dynamic Discovery**: Auto-discovers all modules and tools
- 💬 **Interactive Mode**: REPL with autocomplete and multi-line input
- 🎯 **Flexible**: Command aliases, chaining, and batch execution
- 📊 **Multiple Formats**: Text, JSON, and colored output
- ⚡ **Optimized**: Caching and lazy loading for performance

### [@jsenvoy/tools](packages/tools) - AI Agent Tools
Comprehensive tool collection:
- 🧮 **Calculator**: Mathematical expression evaluation
- 📁 **File Operations**: Read, write, and manage files
- 🌐 **Web Tools**: Scraping, screenshots, and search
- 💻 **Development**: Code analysis, GitHub integration
- 🎥 **Content**: YouTube transcripts, format conversion

### [@jsenvoy/model-providers](packages/model-providers) - LLM Providers
Multi-provider LLM support:
- 🤖 **OpenAI**: GPT-4, GPT-3.5, function calling
- 🧠 **DeepSeek**: DeepSeek Chat and Coder models
- 🌐 **OpenRouter**: Access to multiple providers

### [@jsenvoy/response-parser](packages/response-parser) - Response Processing
Response handling utilities:
- 📝 **Parsing**: Extract structured data from AI responses
- ✅ **Validation**: Schema-based validation with Zod
- 🔄 **Retry Management**: Smart retry with exponential backoff

### [@jsenvoy/agent](packages/agent) - AI Agent Implementation
Complete agent system:
- 🤖 **Agent**: Base agent with tool execution
- 🔄 **Built-in Retry Logic**: Robust retry capabilities with exponential backoff
- 📊 **StructuredResponse**: Consistent response format

## Quick Start

### Using the CLI

```bash
# Install globally
npm install -g @jsenvoy/cli @jsenvoy/core

# Execute a tool
jsenvoy calculator.calculator_evaluate --expression "2 + 2"

# Interactive mode
jsenvoy interactive

# List available tools
jsenvoy list tools
```

### Building an Agent

```javascript
const { Agent } = require('@jsenvoy/agent');
const { calculatorTool, fileReaderTool } = require('@jsenvoy/tools');

const agent = new Agent({
  modelConfig: {
    provider: 'openai',
    model: 'gpt-4',
    apiKey: process.env.OPENAI_API_KEY
  },
  tools: [calculatorTool, fileReaderTool]
});

const result = await agent.execute("Calculate the sum of numbers in data.txt");
```

### Creating Custom Modules

```javascript
const { OpenAIModule, OpenAITool } = require('@jsenvoy/core');

class MyTool extends OpenAITool {
  constructor() {
    super('my_tool', 'Description', {
      type: 'object',
      properties: {
        input: { type: 'string' }
      },
      required: ['input']
    });
  }
  
  async execute(args) {
    return { result: `Processed: ${args.input}` };
  }
}

class MyModule extends OpenAIModule {
  constructor(dependencies = {}) {
    super('MyModule', dependencies);
    this.tools = [new MyTool()];
  }
}
```

## Project Structure

```
jsEnvoy/
├── packages/
│   ├── core/              # Core infrastructure
│   ├── cli/               # Command-line interface
│   ├── tools/             # AI agent tools
│   ├── model-providers/   # LLM providers
│   ├── response-parser/   # Response processing
│   └── agent/             # Agent implementation
├── docs/                  # Project documentation
└── package.json           # Monorepo root
```

## Development

This is a monorepo managed with npm workspaces.

```bash
# Install all dependencies
npm install

# Run all tests
npm test

# Run tests for specific packages
npm run test:core
npm run test:cli
npm run test:tools
npm run test:model-providers
npm run test:response-parser
npm run test:agent

# Run tests with coverage
npm run test:coverage

# Clean install
npm run clean
npm install
```

## Benefits of the New Architecture

1. **Smaller Bundle Sizes** - Applications only include needed packages
2. **Independent Versioning** - Each package can be updated separately
3. **Clearer Dependencies** - Each package declares its own dependencies
4. **Better Testing** - Packages can be tested in isolation
5. **Improved Modularity** - Clear separation of concerns

## Migration Guide

If upgrading from the monolithic @jsenvoy/core:

```javascript
// Old imports
const { Agent, Model, calculatorTool } = require('@jsenvoy/core');

// New imports
const { Agent } = require('@jsenvoy/agent');
const { Model } = require('@jsenvoy/model-providers');
const { calculatorTool } = require('@jsenvoy/tools');
```

## Architecture

The framework uses a modular architecture with dependency injection:

1. **Modules** are containers for related tools
2. **Tools** implement specific functionality in OpenAI function format
3. **ResourceManager** handles dependency injection
4. **ModuleFactory** creates module instances with resolved dependencies
5. **Agent** orchestrates tool execution with LLM integration

See [Architecture Documentation](docs/ARCHITECTURE.md) for details.

## Contributing

1. Choose the appropriate package for your contribution
2. Follow existing patterns and conventions
3. Write tests using TDD approach
4. Update package-specific documentation
5. Ensure all tests pass before submitting PR

## License

MIT