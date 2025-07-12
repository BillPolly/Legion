# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

jsEnvoy is a modular framework for building AI agent tools with consistent interfaces. It's organized as a monorepo using npm workspaces with six main packages:

1. **@jsenvoy/modules** - Core infrastructure with base classes, dependency injection, and module management
2. **@jsenvoy/cli** - Command-line interface for executing tools with REPL and autocomplete
3. **@jsenvoy/tools** - Collection of AI agent tools (file operations, web tools, GitHub integration, etc.)
4. **@jsenvoy/model-providers** - LLM provider integrations (OpenAI, DeepSeek, OpenRouter)
5. **@jsenvoy/response-parser** - Response parsing and validation utilities
6. **@jsenvoy/agent** - AI agent implementation with retry logic and tool execution

## Essential Commands

### Development and Testing

```bash
# Run tests for all packages
npm test

# Run tests for specific packages
npm run test:modules
npm run test:cli
npm run test:tools
npm run test:model-providers
npm run test:response-parser
npm run test:agent

# Run tests in watch mode
npm run test:watch

# Generate coverage reports
npm run test:coverage

# Lint all code
npm run lint

# Clean all node_modules and coverage
npm run clean
```

### Working with Individual Packages

```bash
# Navigate to a package and run its tests
cd packages/tools
npm test
npm run test:watch
npm run test:coverage
```

### CLI Usage

```bash
# Run the CLI (from root)
node packages/cli/src/index.js

# Execute a specific tool
node packages/cli/src/index.js -t <toolName> -p '{"param": "value"}'

# Interactive REPL mode
node packages/cli/src/index.js -i
```

## Architecture Overview

### Core Concepts

1. **Modules** - Containers that group related tools and manage dependencies
   - Extend `BaseModule` class
   - Register tools via `moduleFactory.js`
   - Use dependency injection through ResourceManager

2. **Tools** - Individual functions that perform specific tasks
   - Must have `name`, `description`, `inputSchema`, and `execute` method
   - OpenAI function-calling compatible
   - Schema validation using Zod

3. **ResourceManager** - Central dependency injection container
   - Manages shared resources (file systems, API clients, etc.)
   - Ensures singleton instances across modules

### Package Structure

```
packages/
├── modules/src/
│   ├── base/           # Base classes (BaseModule, BaseTool)
│   ├── core/           # ResourceManager, ModuleFactory
│   └── __tests__/      # Comprehensive test suite
├── cli/src/
│   ├── commands/       # CLI command implementations
│   ├── utils/          # Formatting and helper utilities
│   └── index.js        # Main CLI entry point
├── tools/src/
│   ├── calculator/     # Math operations
│   ├── file/          # File system operations
│   ├── github/        # GitHub API integration
│   ├── json/          # JSON manipulation
│   └── web/           # Web scraping and search
├── model-providers/src/
│   ├── openai/        # OpenAI integration
│   ├── deepseek/      # DeepSeek integration
│   └── openrouter/    # OpenRouter integration
├── response-parser/src/
│   └── parser/        # Response parsing logic
└── agent/src/
    └── Agent.js       # Main agent implementation
```

### Testing Strategy

- All packages use Jest with ES modules support
- Tests are organized in `__tests__/` directories:
  - `unit/` - Unit tests for individual components
  - `integration/` - Integration tests
  - `utils/` - Test utilities and helpers
  - `testdata/` - Test fixtures and mock data
- Run with `NODE_OPTIONS='--experimental-vm-modules'` for ESM support
- Mock external dependencies using Jest mocks

### Key Development Patterns

1. **Creating New Tools**:
   - Extend from appropriate base class
   - Define Zod schema for input validation
   - Implement `execute` method
   - Add to module's tool registry
   - Write comprehensive tests

2. **Working with Modules**:
   - Each module is self-contained in its directory
   - Use `moduleFactory.js` for registration
   - Dependencies injected via ResourceManager

3. **Environment Configuration**:
   - Use `.env` files for API keys and configuration
   - Environment variables accessed via `process.env`

## Important Notes

- All packages use ES modules (`"type": "module"`)
- Requires Node.js >= 18.0.0
- No build step needed - runs directly from source
- GitHub tools require `GITHUB_PAT` environment variable
- Model providers require respective API keys
- File operations are sandboxed by default
- Web tools use Puppeteer for browser automation