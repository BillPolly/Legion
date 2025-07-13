# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

jsEnvoy is a modular framework for building AI agent tools with consistent interfaces. It's organized as a monorepo using npm workspaces with six main packages:

1. **@jsenvoy/module-loader** - Core infrastructure with base classes, dependency injection, and module management
2. **@jsenvoy/cli** - Command-line interface for executing tools with REPL and autocomplete
3. **@jsenvoy/tools** - Collection of AI agent tools (file operations, web tools, GitHub integration, etc.)
4. **@jsenvoy/llm** - LLM client with multiple providers (OpenAI, Anthropic, DeepSeek, OpenRouter) and response parsing/validation
5. **@jsenvoy/agent** - AI agent implementation with retry logic and tool execution

## Essential Commands

### Development and Testing

```bash
# Run tests for all packages
npm test

# Run tests for specific packages
npm run test:module-loader
npm run test:cli
npm run test:tools
npm run test:llm
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

### Git Subtree and Repository Management

**IMPORTANT: This project uses git subtrees for managing individual package repositories. Use these scripts instead of manual git commands:**

```bash
# Discover all configured subtrees
npm run subtree:discover

# Push all subtrees to their remote repositories
npm run subtree:push

# Pull changes from all subtree remotes
npm run subtree:pull

# Setup subtree remotes (run after cloning)
npm run subtree:setup

# Add a new package to polyrepo structure
npm run polyrepo:add

# Rename a GitHub repository (requires gh CLI)
npm run polyrepo:rename

# Other subtree operations
npm run split:check      # Check split configuration
npm run split:simple     # Simple split operation
npm run split:history    # Split with history preservation
npm run split           # Run package splitting
```

**Scripts are located in `/scripts` directory:**
- `push-all-subtrees.js` - Pushes all subtrees to their remotes
- `pull-all-subtrees.js` - Pulls all subtree changes
- `discover-subtrees.js` - Lists all configured subtrees
- `setup-subtree-remotes.js` - Sets up git remotes for subtrees
- `add-package-to-polyrepo.js` - Adds new package to polyrepo
- `rename-github-repo.js` - Renames GitHub repositories
- `split-*.js` - Various splitting operations

**Configuration file:** `.gitsubtree` contains the mapping of local directories to remote repositories

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
├── module-loader/src/
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
├── llm/src/
│   ├── providers/     # LLM provider implementations
│   ├── validators/    # Response validation
│   └── LLMClient.js   # Main client with retry logic
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