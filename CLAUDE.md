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

**Configuration file:** `scripts/config/gitsubtree.config` contains the mapping of local directories to remote repositories

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

## CRITICAL: Environment Variables and Configuration

**ALWAYS use ResourceManager to access environment variables!** The project has a `.env` file in the root directory that contains all necessary API keys and configuration. 

### Correct Way to Access Environment Variables:

```javascript
import { ResourceManager } from '@jsenvoy/module-loader';

// Initialize ResourceManager
const resourceManager = new ResourceManager();
await resourceManager.initialize();

// Access environment variables
const githubToken = resourceManager.get('env.GITHUB_PAT');
const railwayToken = resourceManager.get('env.RAILWAY_API_TOKEN');
const anthropicKey = resourceManager.get('env.ANTHROPIC_API_KEY');
```

### NEVER DO THIS:
```javascript
// DON'T access process.env directly
const token = process.env.GITHUB_PAT; // WRONG!

// DON'T check for environment variables like this
if (!process.env.RAILWAY_API_TOKEN) { // WRONG!
  console.error('Missing token');
}
```

### Examples in the Codebase:
- See `packages/code-gen/code-agent/__tests__/integration/CodeAgent.step-by-step.test.js` for correct usage
- See `packages/code-gen/code-agent/__tests__/integration/LiveGitHubIntegration.test.js` for GitHub integration examples
- All integration tests use ResourceManager to access credentials

The ResourceManager automatically loads the `.env` file from the project root and makes all variables available via the `env.` prefix.

## Using GitHub Tools

To use GitHub tools in scripts, follow this pattern:

```javascript
import { ResourceManager, ModuleFactory } from '@jsenvoy/module-loader';
import GitHubModule from '../../packages/general-tools/src/github/GitHubModule.js';

// Initialize ResourceManager
const resourceManager = new ResourceManager();
await resourceManager.initialize();

// Register GitHub resources from environment
resourceManager.register('GITHUB_PAT', resourceManager.get('env.GITHUB_PAT'));
resourceManager.register('GITHUB_ORG', resourceManager.get('env.GITHUB_ORG'));
resourceManager.register('GITHUB_USER', resourceManager.get('env.GITHUB_USER'));

// Create module using ModuleFactory
const moduleFactory = new ModuleFactory(resourceManager);
const githubModule = moduleFactory.createModule(GitHubModule);

// Get tools from the module
const tools = githubModule.getTools();
const githubTool = tools.find(tool => tool.name === 'github');
const polyRepoTool = tools.find(tool => tool.name === 'polyrepo');

// Use the tool with invoke method
const result = await githubTool.invoke({
  function: {
    name: 'github_get_repo',
    arguments: JSON.stringify({
      owner: 'Bill234',
      repo: 'test-app'
    })
  }
});
```

### Available GitHub Functions:
- `github_get_repo` - Get repository information
- `github_list_user_repos` - List user repositories
- `github_list_branches` - List repository branches
- `github_create_repo` - Create a new repository
- `github_delete_repo` - Delete a repository
- `polyrepo_*` - Various polyrepo management functions

## Project Structure Guidelines

### Directory Organization

**IMPORTANT: Follow these directory organization rules to maintain a clean codebase:**

```
Legion/
├── packages/                    # All packages in monorepo
│   ├── module-loader/          # Core infrastructure
│   ├── cli/                    # CLI package
│   ├── general-tools/          # Tool collection
│   ├── llm/                    # LLM client
│   ├── agent/                  # AI agent
│   └── code-gen/               # Code generation packages
│       └── jester/             # Jest test generator
├── scripts/                    # All scripts organized by purpose
│   ├── build/                  # Build scripts
│   ├── test/                   # Test runners
│   ├── git/                    # Git operations
│   ├── split/                  # Polyrepo management
│   ├── utils/                  # Shared utilities
│   └── config/                 # Configuration files
│       └── gitsubtree.config   # Polyrepo mappings
├── docs/                       # Documentation
├── scratch/                    # Temporary files (gitignored)
├── .env                        # Environment variables
└── [config files]              # Standard root configs only
```

### CRITICAL: File Creation Discipline

**BEFORE creating ANY file, you MUST:**

1. **Check if an existing file serves this purpose** - ALWAYS prefer editing over creating
2. **If creating temporary/test files:**
   - Create in `scratch/` directory (create it if needed)
   - IMMEDIATELY add to .gitignore BEFORE creating the file
   - Delete when done or explain why it needs to stay
3. **If creating permanent files:**
   - Justify why it can't go in an existing file
   - Place in the correct directory from the start
   - Never use generic names like `test.js`, `temp.js`, `utils.js`
4. **For scripts:** 
   - MUST go in `scripts/[purpose]/` - NEVER in root
   - Use descriptive names like `build-all-packages.js`

**Proactive .gitignore Management:**
- Before creating `scratch/` → Add `scratch/` to .gitignore
- Before generating files → Add pattern to .gitignore
- Before running commands that create artifacts → Check .gitignore first

### Common Mistakes to Avoid

- ❌ Creating `test.js`, `temp.js`, `foo.js` files anywhere
- ❌ Leaving scripts in the root directory  
- ❌ Creating new files when you should edit existing ones
- ❌ Not organizing imports properly
- ❌ Creating README files without being asked
- ❌ Using `console.log` instead of proper logging

## Important Notes

- All packages use ES modules (`"type": "module"`)
- Requires Node.js >= 18.0.0
- No build step needed - runs directly from source
- GitHub tools require `GITHUB_PAT` environment variable
- Model providers require respective API keys
- File operations are sandboxed by default
- Web tools use Puppeteer for browser automation
- Keep all directories clean, never leave files around, always use nice directory structure

## CRITICAL: Always Use Railway Tools

**NEVER use raw Railway API calls or GraphQL queries directly!** Always use the Railway tools and modules we've built:
- Use `RailwayProvider` from `@jsenvoy/railway` for API operations
- Use `RailwayCLI` for CLI operations
- Use the Railway module tools when working with jsEnvoy framework
- This ensures consistency and proper error handling