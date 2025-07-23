# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Legion is a modular framework for building AI agent tools with consistent interfaces. It's organized as a monorepo using npm workspaces with six main packages:

1. **@legion/module-loader** - Core infrastructure with base classes, dependency injection, and module management
2. **@legion/cli** - Command-line interface for executing tools with REPL and autocomplete
3. **@legion/tools** - Collection of AI agent tools (file operations, web tools, GitHub integration, etc.)
4. **@legion/llm** - LLM client with multiple providers (OpenAI, Anthropic, DeepSeek, OpenRouter) and response parsing/validation
5. **@legion/agent** - AI agent implementation with retry logic and tool execution

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
- Use `RailwayProvider` from `@legion/railway` for API operations
- Use `RailwayCLI` for CLI operations
- Use the Railway module tools when working with Legion framework
- This ensures consistency and proper error handling

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