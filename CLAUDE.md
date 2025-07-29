# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Legion is a modular framework for building AI agent tools with consistent interfaces. It's organized as a monorepo using npm workspaces with 20+ packages organized in four main categories:

### Core Infrastructure
1. **@legion/module-loader** - Core infrastructure with base classes, dependency injection, and module management
2. **@legion/cli** - Command-line interface for executing tools with REPL and autocomplete
3. **@legion/resource-manager** - Advanced dependency injection and resource lifecycle management

### AI & LLM Packages
4. **@legion/llm** - LLM client with multiple providers (OpenAI, Anthropic, DeepSeek, OpenRouter)
5. **@legion/agent** - AI agent implementation with retry logic and tool execution
6. **@legion/llm-planner** - AI-powered planning system for complex multi-step workflows

### Tool Collections
7. **@legion/general-tools** - Collection of AI agent tools (file operations, web tools, GitHub integration, etc.)
8. **@legion/railway** - Railway deployment and management tools
9. **@legion/playwright** - Browser automation and web testing tools
10. **@legion/node-runner** - Node.js process management and execution tools
11. **@legion/log-manager** - Advanced logging, monitoring, and log analysis tools
12. **@legion/conan-the-deployer** - Comprehensive deployment management system

### Specialized Systems
13. **@legion/aiur** - Advanced MCP server with persistent context management and planning
14. **@legion/plan-executor** - Execution engine for complex plans with dependency management
15. **@legion/code-gen** - Code generation packages including Jester (test generator) and CodeAgent

### Applications
16. **@legion/web-frontend** - React-based web interface for Legion interactions
17. **@legion/web-backend** - Express server providing API and WebSocket support
18. **@legion/aiur-debug-ui** - Debug interface for Aiur MCP server

## Essential Commands

### Development and Testing

```bash
# Run tests for all packages
npm test

# Run tests for specific packages
npm run test:module-loader
npm run test:cli
npm run test:tools              # @legion/general-tools
npm run test:llm
npm run test:agent
npm run test:resource-manager
npm run test:playwright
npm run test:node-runner
npm run test:log-manager
npm run test:railway
npm run test:aiur

# Run tests in watch mode
npm run test:watch

# Generate coverage reports
npm run test:coverage

# Lint all code
npm run lint

# Build all packages
npm run build

# Clean all node_modules and coverage
npm run clean
```

### Working with Individual Packages

```bash
# Navigate to a package and run its tests
cd packages/general-tools
npm test
npm run test:watch
npm run test:coverage

# Run a single test file
npm test -- __tests__/unit/calculator.test.js

# Run tests with specific pattern
npm test -- --testNamePattern="should evaluate"
```

### CLI Usage

```bash
# Run the CLI (from root)
node packages/cli/src/index.js
npm run cli                     # Interactive mode
npm run cli:help               # Show help
npm run cli:list               # List available tools

# Quick alias for interactive mode
npm run cli

# Execute a specific tool
node packages/cli/src/index.js -t <toolName> -p '{"param": "value"}'

# Interactive REPL mode
node packages/cli/src/index.js -i
npm run cli                     # Same as above
```

### Web Applications

```bash
# Start web backend with frontend served at http://localhost:3000
npm run dev:backend
npm run chat                    # Same as above

# Aiur MCP Server
npm run aiur                    # Start Aiur MCP server
npm run aiur:start             # Same as above

# Static web server
npm run server                  # Start static web server
npm run server:kill             # Kill server on port 3000
```

### Agent System

```bash
# Run AI agent
npm run agent                   # Start Legion agent CLI
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

# Note: Do not use git subtree commands directly - always use the npm scripts

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
│   ├── module/         # Module, ModuleFactory, GenericModule
│   ├── resources/      # ResourceManager
│   ├── tool/           # Tool, GenericTool, ToolResult
│   ├── schemas/        # JSON schema validation
│   └── services/       # StaticServer, StaticServerFactory
├── cli/src/
│   ├── commands/       # CLI command implementations
│   ├── utils/          # Formatting and helper utilities
│   └── index.js        # Main CLI entry point
├── general-tools/src/          # Main tool collection
│   ├── calculator/            # Math operations
│   ├── file/                  # File system operations
│   ├── github/                # GitHub API integration
│   ├── json/                  # JSON manipulation
│   ├── crawler/               # Web crawling
│   ├── webpage-to-markdown/   # Web content conversion
│   └── youtube-transcript/    # YouTube transcript extraction
├── railway/src/               # Railway deployment tools
├── playwright/src/            # Browser automation
├── node-runner/src/           # Node.js process management
├── log-manager/src/           # Logging and monitoring
├── conan-the-deployer/src/    # Deployment management
├── llm/src/
│   ├── providers/     # LLM provider implementations
│   ├── validators/    # Response validation
│   └── LLMClient.js   # Main client with retry logic
├── agent/src/
│   ├── Agent.js               # Main agent implementation
│   ├── RetryManager.js        # Retry logic
│   ├── websocket-server.js    # WebSocket server
│   └── cli.js                 # Agent CLI interface
├── aiur/src/                  # Advanced MCP server
│   ├── server/                # Server components
│   ├── tools/                 # Tool management
│   ├── handles/               # Handle resolution system
│   ├── monitoring/            # Health and performance monitoring
│   └── checkpoint/            # State management
├── apps/                      # Application packages
│   ├── web-frontend/          # React web interface
│   ├── web-backend/           # Express API server
│   └── aiur-debug-ui/         # Aiur debug interface
└── code-gen/                  # Code generation packages
    ├── jester/                # Jest test generator
    ├── code-agent/            # AI code generation agent
    └── cerebrate/             # Advanced code generation system
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
   - Extend from `Tool` class in `@legion/module-loader`
   - Define Zod schema for input validation
   - Implement `execute` method
   - Add to module's `getTools()` method
   - Write comprehensive tests with mocks
   - Follow OpenAI function-calling format

2. **Working with Modules**:
   - Extend from `Module` class
   - Each module is self-contained in its directory
   - Use `ModuleFactory` for instantiation
   - Dependencies injected via ResourceManager
   - Emit events for progress tracking

3. **Environment Configuration**:
   - Use `.env` files for API keys and configuration
   - ALWAYS access via ResourceManager, never `process.env` directly
   - See "Environment Variables and Configuration" section below

## CRITICAL: Environment Variables and Configuration

**ALWAYS use ResourceManager to access environment variables!** The project has a `.env` file in the root directory that contains all necessary API keys and configuration. 

### Correct Way to Access Environment Variables:

```javascript
import { ResourceManager } from '@legion/module-loader';

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
import { ResourceManager, ModuleFactory } from '@legion/module-loader';
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

## Package-Specific Development

### Working with Aiur MCP Server

Aiur is the most advanced package, providing MCP server capabilities with persistent context:

```bash
# Start Aiur server
npm run aiur

# Run Aiur tests
npm run test:aiur

# Check Aiur logs
tail -f packages/aiur/logs/aiur-*.log
```

### Code Generation (Jester & CodeAgent)

```bash
# Navigate to code generation packages
cd packages/code-gen/jester         # Jest test generator
cd packages/code-gen/code-agent     # AI code generation agent

# Each has its own package.json and can be run independently
npm test                            # Run package-specific tests
npm start                           # Run package-specific commands
```

### Web Applications

```bash
# Web backend with integrated frontend
cd packages/apps/web-backend
npm start                           # Starts on port 3000

# Aiur debug UI
cd packages/apps/aiur-debug-ui  
npm start                           # Debug interface for Aiur
```

## Project Structure Guidelines

### Directory Organization

**IMPORTANT: Follow these directory organization rules to maintain a clean codebase:**

```
Legion/
├── packages/                    # All packages in monorepo
│   ├── module-loader/          # Core infrastructure
│   ├── cli/                    # CLI package
│   ├── resource-manager/       # Dependency injection
│   ├── general-tools/          # Main tool collection
│   ├── llm/                    # LLM client
│   ├── agent/                  # AI agent
│   ├── llm-planner/            # AI planning system
│   ├── railway/                # Railway deployment tools
│   ├── playwright/             # Browser automation
│   ├── node-runner/            # Node.js process management
│   ├── log-manager/            # Logging and monitoring
│   ├── conan-the-deployer/     # Deployment management
│   ├── aiur/                   # Advanced MCP server
│   ├── plan-executor/          # Plan execution engine
│   ├── apps/                   # Application packages
│   │   ├── web-frontend/       # React web interface
│   │   ├── web-backend/        # Express API server
│   │   └── aiur-debug-ui/      # Aiur debug interface
│   └── code-gen/               # Code generation packages
│       ├── jester/             # Jest test generator
│       ├── code-agent/         # AI code generation agent
│       └── cerebrate/          # Advanced code generation
├── scripts/                    # All scripts organized by purpose
│   ├── git/                    # Git operations
│   ├── split/                  # Polyrepo management
│   ├── server/                 # Server management
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
- Monorepo uses npm workspaces - always run commands from root unless working on specific package
- GitHub tools require `GITHUB_PAT` environment variable
- Model providers require respective API keys (OpenAI, Anthropic, DeepSeek, OpenRouter)
- Railway tools require `RAILWAY_API_TOKEN` environment variable
- File operations are sandboxed by default in general-tools
- Playwright tools use Chromium for browser automation
- Aiur provides persistent context across tool calls via MCP protocol
- Generated code and logs are stored in package-specific directories

## CRITICAL: Keep Repository Clean - Use Temporary Directories

**ALWAYS use temporary directories for any generated artifacts, test files, or temporary scripts:**

### Test Files and Artifacts
- **Use OS temp directory** for test files: `import { tmpdir } from 'os'`
- **Example**: `join(tmpdir(), 'legion-test-files')` instead of `__tests__/fixtures/`
- **Never create test artifacts** in git-tracked directories
- **Clean up after tests** - remove temp directories in test teardown

### Scripts and Temporary Code
- **Put ALL temporary scripts** in `/tmp/` or similar temp directories
- **Never create** `test.js`, `temp.js`, `foo.js` files in the main codebase
- **Use descriptive temp paths**: `/tmp/legion-debug-script.js` instead of `debug.js`
- **Delete immediately** when done or document why it needs to stay

### Generated Content
- **Use temp directories** for any generated files, debug output, or scratch work
- **Examples of what goes in temp**:
  - Test database files (`*.db`, `*.sqlite`)
  - Generated code artifacts
  - Debug logs and traces
  - Temporary HTML/JSON outputs
  - Script experiments and prototypes

### .gitignore Coverage
The `.gitignore` already covers many patterns, but always check:
```gitignore
# Temporary directories (already covered)
tmp/
temp/
**/tmp/
**/temp/

# Test patterns (already covered)  
**/__tests__/**/test-*
**/__tests__/**/temp-*
**/__tests__/**/*.tmp
```

**Golden Rule**: If it's not meant to be committed, put it in a temp directory that's gitignored. Keep the repository clean and professional.

## Server Management Commands

```bash
# Start a static web server
npm run server
# or
npm run server:start

# Kill process on port 3000
npm run server:kill

# Force kill port (if regular kill fails)
npm run server:force-kill

# Kill any port
npm run kill-port -- 8080
```

## CRITICAL: Always Use Railway Tools

**NEVER use raw Railway API calls or GraphQL queries directly!** Always use the Railway tools and modules we've built:
- Use `RailwayProvider` from `@legion/railway` for API operations
- Use `RailwayCLI` for CLI operations
- Use the Railway module tools when working with Legion framework
- This ensures consistency and proper error handling

## CRITICAL: Async Resource Manager Pattern

**ALL root-level objects and services MUST follow the [Async Resource Manager Pattern](docs/async-resource-manager-pattern.md):**

### Required Pattern:
```typescript
class MyService {
  private constructor(dependencies) {
    // Private constructor - no async operations here
  }

  static async create(rm: ResourceManager): Promise<MyService> {
    // Get all dependencies from ResourceManager
    const config = rm.get<Config>('Config');
    const database = rm.get<Database>('Database');
    
    // Perform any async initialization here
    await someAsyncSetup();
    
    return new MyService({ config, database });
  }
}
```

### Rules:
- **NEVER use `new` directly** - always use `static async create(rm)` 
- **NEVER use async constructors** - constructors must be synchronous
- **ALL dependencies come from ResourceManager** - no direct imports or hardcoded values
- **ALL services are testable** by mocking the ResourceManager
- **Follow the pattern exactly** as documented in `/docs/async-resource-manager-pattern.md`

### Examples in Codebase:
- `LLMPlannerModule.create(resourceManager)` - Correct async factory pattern
- `PlanExecutorModule` should be updated to follow this pattern
- `FileModule` should be updated to follow this pattern

This pattern ensures proper dependency injection, testability, and eliminates async constructor issues.

## Aiur MCP Server Context Management

### Overview

Aiur is an advanced MCP (Model Context Protocol) server that provides AI agent coordination with persistent memory and context management. It's located in `/packages/aiur/` and offers sophisticated tools for:

- **Persistent Context Management** - Store and retrieve data across multiple tool calls
- **Automatic Parameter Resolution** - Reference saved context using `@contextName` syntax
- **Plan Creation and Execution** - Create multi-step execution plans with dependencies
- **Auto-Save Functionality** - Automatically save tool results to context for later reference

The Aiur server runs as an MCP server that can be connected to Claude or other AI agents, providing them with persistent memory and advanced orchestration capabilities.

### Context Management System

Aiur provides a persistent memory system that allows AI agents to save data and reference it across multiple tool calls. This creates continuity and allows for complex multi-step workflows.

**Key Features:**
- **Persistent Storage** - Context survives across tool calls within a session
- **Automatic Resolution** - `@contextName` references are automatically resolved to actual data
- **Rich Metadata** - Each context item includes timestamps, source tools, and descriptions
- **Discovery** - List and inspect all available context data

### Available Tools

#### Context Management Tools

**`context_add`** - Add data to the context for AI agents to reference
```json
{
  "name": "user_preferences",
  "data": {"theme": "dark", "language": "en", "timezone": "PST"},
  "description": "User interface preferences"
}
```

**`context_get`** - Retrieve context data by name
```json
{
  "name": "user_preferences"
}
```

**`context_list`** - List all available context data
```json
{
  "filter": "deploy*"  // Optional: filter by pattern
}
```

#### Planning Tools

**`plan_create`** - Create a new execution plan with steps and dependencies
```json
{
  "title": "Deploy Application",
  "description": "Complete deployment workflow",
  "steps": [
    {
      "id": "build",
      "action": "build_app",
      "parameters": {"config": "@build_config"}
    },
    {
      "id": "deploy", 
      "action": "deploy_app",
      "dependsOn": ["build"],
      "parameters": {"target": "production"}
    }
  ],
  "saveAs": "deployment_plan"  // Auto-save result to context
}
```

**`plan_execute`** - Execute a plan and return the results
```json
{
  "planHandle": "@deployment_plan",  // Reference saved plan
  "options": {"parallel": false, "stopOnError": true}
}
```

**`plan_status`** - Get the current status and progress of a plan
```json
{
  "planHandle": "my_plan",
  "includeSteps": true,
  "includeHandles": true
}
```

**`plan_validate`** - Validate a plan structure and dependencies
```json
{
  "planHandle": "my_plan",
  "checkDependencies": true,
  "checkToolAvailability": true
}
```

### Parameter Resolution (@contextName)

**Automatic Reference Resolution:**
When you use `@contextName` in tool parameters, Aiur automatically resolves these references to the actual stored data before executing the tool.

**Syntax:** `@contextName` or `@context_specific_name`

**Examples:**
```json
// Reference single context
{
  "tool": "deploy_app",
  "args": {
    "config": "@deployment_config",  // → Resolves to stored config object
    "target": "production"
  }
}

// Reference multiple contexts in one call
{
  "tool": "plan_create", 
  "args": {
    "title": "Full Stack Deploy",
    "steps": [{
      "action": "deploy",
      "parameters": {
        "frontend": "@frontend_config",    // → Resolved automatically
        "backend": "@backend_config",      // → Resolved automatically  
        "database": "@db_config"           // → Resolved automatically
      }
    }]
  }
}

// Works in nested objects and arrays
{
  "servers": ["@server1", "@server2", {"host": "server3.com"}],
  "config": {
    "nested": {
      "setting": "@app_settings"
    }
  }
}
```

**What Happens:**
1. You call a tool with `@contextName` references
2. Aiur's HandleResolver automatically runs before tool execution
3. All `@contextName` strings are replaced with actual stored data
4. The tool receives fully resolved parameters (never sees `@` references)

### Auto-Save Feature (saveAs)

**Automatic Result Storage:**
Add `saveAs: "name"` to any tool call to automatically save the result to context.

**Benefits:**
- Save and reference tool results in one step
- No need for separate `context_add` calls
- Rich metadata tracking (source tool, timestamp, original args)

**Examples:**
```json
// Save plan creation result
{
  "tool": "plan_create",
  "args": {
    "title": "My Deployment",
    "steps": [...],
    "saveAs": "my_deployment"  // ✅ Auto-saves result as context_my_deployment
  }
}

// Later reference the saved plan
{
  "tool": "plan_execute", 
  "args": {
    "planHandle": "@my_deployment"  // ✅ References the auto-saved plan
  }
}
```

**Response includes confirmation:**
```json
{
  "success": true,
  "plan": {...},
  "savedToContext": {
    "contextName": "my_deployment",
    "handleId": "context_my_deployment",
    "message": "Result saved to context as 'my_deployment'"
  }
}
```

### Usage Patterns

#### Pattern 1: Explicit Context Management
```json
// Step 1: Save data explicitly
{"tool": "context_add", "args": {"name": "api_config", "data": {...}}}

// Step 2: Reference in other tools
{"tool": "api_call", "args": {"config": "@api_config"}}
```

#### Pattern 2: Auto-Save Workflow  
```json
// Step 1: Create and auto-save
{"tool": "plan_create", "args": {..., "saveAs": "my_plan"}}

// Step 2: Reference auto-saved result
{"tool": "plan_execute", "args": {"planHandle": "@my_plan"}}
```

#### Pattern 3: Chain Multiple References
```json
// Reference multiple contexts in single call
{
  "tool": "complex_operation",
  "args": {
    "config": "@app_config",
    "secrets": "@api_secrets", 
    "targets": ["@server1", "@server2"],
    "options": {"timeout": 300}
  }
}
```

#### Pattern 4: Context Discovery
```json
// List available context to see what's already saved
{"tool": "context_list", "args": {"filter": "deploy*"}}

// Get specific context details
{"tool": "context_get", "args": {"name": "deployment_config"}}
```

### Complete Examples

#### Example 1: Deployment Workflow
```json
// 1. Save configuration
{
  "tool": "context_add",
  "args": {
    "name": "prod_config",
    "data": {"env": "production", "replicas": 3, "port": 443},
    "description": "Production deployment configuration"
  }
}

// 2. Create deployment plan using saved config
{
  "tool": "plan_create", 
  "args": {
    "title": "Production Deployment",
    "steps": [
      {
        "id": "deploy",
        "action": "kubernetes_deploy",
        "parameters": {
          "config": "@prod_config",  // ← References saved config
          "target": "production"
        }
      }
    ],
    "saveAs": "prod_deployment"  // ← Auto-save the plan
  }
}

// 3. Execute the deployment plan
{
  "tool": "plan_execute",
  "args": {
    "planHandle": "@prod_deployment",  // ← References saved plan
    "options": {"stopOnError": true}
  }
}

// 4. Check deployment status
{
  "tool": "plan_status",
  "args": {
    "planHandle": "@prod_deployment",  // ← Same plan reference
    "includeSteps": true
  }
}
```

#### Example 2: Multi-Environment Setup
```json
// Save multiple environment configs
{"tool": "context_add", "args": {"name": "dev_config", "data": {...}}}
{"tool": "context_add", "args": {"name": "staging_config", "data": {...}}} 
{"tool": "context_add", "args": {"name": "prod_config", "data": {...}}}

// Create plan that deploys to all environments
{
  "tool": "plan_create",
  "args": {
    "title": "Multi-Environment Deployment",
    "steps": [
      {
        "id": "deploy_dev",
        "action": "deploy",
        "parameters": {"config": "@dev_config", "env": "dev"}
      },
      {
        "id": "deploy_staging", 
        "action": "deploy",
        "parameters": {"config": "@staging_config", "env": "staging"},
        "dependsOn": ["deploy_dev"]
      },
      {
        "id": "deploy_prod",
        "action": "deploy", 
        "parameters": {"config": "@prod_config", "env": "production"},
        "dependsOn": ["deploy_staging"]
      }
    ],
    "saveAs": "multi_env_deployment"
  }
}
```

### Best Practices

#### Context Naming Conventions
- Use **descriptive names**: `deployment_config` not `config1`
- Use **prefixes for grouping**: `user_preferences`, `user_settings`, `user_profile`
- Use **environment indicators**: `prod_config`, `staging_secrets`

#### When to Use Context Management
- **Multi-step workflows** that need to reference previous results
- **Configuration data** that multiple tools will use
- **User preferences** or settings that persist across operations
- **Complex objects** that would be tedious to re-enter

#### Parameter Resolution Guidelines
- **Always use `@contextName`** to reference saved context in tool parameters
- **Check available context** with `context_list` when unsure what's available
- **Use `saveAs`** liberally to build up a library of reusable context
- **Combine references** - you can use multiple `@contextName` references in a single tool call

#### Error Handling
- **Missing references** will cause clear error messages
- **Use `context_list`** to verify context names exist before referencing
- **Use `plan_validate`** to check plan dependencies before execution

### Integration with AI Agents

When working with Aiur MCP server:

1. **Persistent Memory** - Use context management to maintain state across conversations
2. **Complex Workflows** - Break large tasks into plans with multiple steps
3. **Data Reuse** - Save configurations, credentials, and results for reuse
4. **Reference Management** - Use `@contextName` syntax consistently
5. **Auto-Save Results** - Use `saveAs` parameter to build context automatically

The Aiur MCP server transforms AI agents from stateless tools into persistent, memory-enabled coordinators capable of managing complex, multi-step workflows with full context awareness.

## Creating New Modules and Tools

### Module Template
```javascript
import { Module } from '@legion/module-loader';

export default class MyModule extends Module {
  constructor(dependencies = {}) {
    super('MyModule', dependencies);
  }

  async initialize() {
    // Optional: async initialization
    await super.initialize();
  }

  getTools() {
    return [
      new MyTool(this.dependencies)
    ];
  }
}
```

### Tool Template
```javascript
import { Tool } from '@legion/module-loader';
import { z } from 'zod';

class MyTool extends Tool {
  constructor(dependencies = {}) {
    super({
      name: 'my_tool',
      description: 'Description of what the tool does',
      inputSchema: z.object({
        param1: z.string().describe('Parameter description'),
        param2: z.number().optional().describe('Optional parameter')
      }),
      outputSchema: z.object({
        result: z.string()
      })
    });
    this.dependencies = dependencies;
  }

  async execute(args) {
    // Emit progress events
    this.emit('progress', { percentage: 0, status: 'Starting...' });
    
    try {
      // Tool implementation
      const result = await doSomething(args);
      
      this.emit('progress', { percentage: 100, status: 'Complete' });
      return { result };
    } catch (error) {
      this.emit('error', { message: error.message });
      throw error;
    }
  }
}
```

## Working with the Event System

All tools and modules support event emission for real-time monitoring:

```javascript
// In your tool's execute method
this.emit('progress', { percentage: 50, status: 'Processing...' });
this.emit('info', { message: 'Found 10 items to process' });
this.emit('warning', { message: 'API rate limit approaching' });
this.emit('error', { message: 'Failed to connect', error });
```

Events propagate: Tool → Module → Agent → WebSocket Server → Clients