# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Legion is a modular framework for building AI agent tools with consistent interfaces. It's organized as a monorepo using npm workspaces with packages for core infrastructure, AI/LLM services, tool collections, and applications.

## 🚨 CRITICAL: ResourceManager Automatically Contains ALL API Keys 🚨

**THE RESOURCE MANAGER LOADS THE ENTIRE .env FILE ON INITIALIZATION**

When ResourceManager initializes, it automatically:

1. **Finds .env file** - Searches project root and parent directories for .env file
2. **Loads ALL environment variables** - Uses `dotenv.config()` to load the entire .env file  
3. **Registers every variable** - Makes ALL env vars available as `resourceManager.get('env.VARIABLE_NAME')`
4. **Provides automatic injection** - ModuleFactory uses these for dependency injection to modules

### This Means:

✅ **All API keys are automatically available to modules**
- `ANTHROPIC_API_KEY` becomes `resourceManager.get('env.ANTHROPIC_API_KEY')`
- `GITHUB_PAT` becomes `resourceManager.get('env.GITHUB_PAT')`
- `RAILWAY_API_TOKEN` becomes `resourceManager.get('env.RAILWAY_API_TOKEN')`
- **Every .env variable is available without any manual setup**

✅ **Live tests get real API keys via ResourceManager**
- Integration tests use `resourceManager.get('env.API_KEY')` for real API calls
- No need to manually load .env or access process.env
- Follow existing patterns in `LiveGitHubIntegration.test.js`

✅ **Module loading provides automatic API key injection**
- When Aiur loads modules, ModuleFactory automatically injects required API keys
- Modules receive API keys through constructor dependency injection
- No manual key management required by module developers

❌ **NEVER access process.env directly** - Always use ResourceManager
❌ **NEVER manually register API keys** - ResourceManager does this automatically
❌ **NEVER load .env manually** - ResourceManager handles this during initialization

### The Complete Flow:
```
.env File → ResourceManager.initialize() → Load ALL vars as env.* → 
ModuleFactory dependency injection → Modules receive API keys automatically
```

## Essential Commands

```bash
# Testing and Development
npm test                         # Run all tests
npm run test:watch              # Run tests in watch mode
npm run lint                    # Lint all code
npm run build                   # Build all packages

# CLI and Applications
npm run cli                     # Interactive CLI mode
npm run agent                   # Start AI agent
npm run aiur                    # Start MCP server

# Git Subtree Management (IMPORTANT: Use scripts, not manual git commands)
npm run subtree:push            # Push all subtrees to remotes
npm run subtree:pull            # Pull changes from all subtree remotes
npm run subtree:discover        # List configured subtrees
```

## Architecture Overview

### Core Concepts

1. **Modules** - Containers that group related tools and manage dependencies
   - Extend `Module` class and use dependency injection through ResourceManager
   - Each module is self-contained in its directory

2. **Tools** - Individual functions that perform specific tasks
   - Must have `name`, `description`, `inputSchema`, and `execute` method
   - OpenAI function-calling compatible with Zod schema validation

3. **ResourceManager** - Central dependency injection container
   - Manages shared resources and ensures singleton instances across modules

### Testing Strategy

- All packages use Jest with ES modules support (`NODE_OPTIONS='--experimental-vm-modules'`)
- Tests organized in `__tests__/` directories: `unit/`, `integration/`, `utils/`, `testdata/`
- **Live integration tests use real ResourceManager and API calls** - never skip due to missing keys
- Follow existing patterns in `LiveGitHubIntegration.test.js` and similar files

### Development Patterns

1. **Creating Tools**: Extend `Tool` class, define Zod schemas, implement `execute` method
2. **Working with Modules**: Use `ModuleFactory` for instantiation, emit events for progress
3. **Environment Access**: ALWAYS use ResourceManager, never `process.env` directly

## CRITICAL: Environment Variables and Configuration

**🚨 THE RESOURCEMANAGER AUTOMATICALLY HAS ALL API KEYS FROM .env! 🚨**

**NEVER manually handle API keys - ResourceManager loads the entire .env file automatically during initialization!** Every environment variable becomes instantly available as `resourceManager.get('env.VARIABLE_NAME')` without any manual setup. 

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

**The ResourceManager is the ONLY way to access environment variables in Legion - it handles everything automatically!**

## Project Structure Guidelines

**Directory Organization:**
- `packages/` - All packages in monorepo (core, tools, apps, etc.)
- `scripts/` - All scripts organized by purpose (git/, split/, server/, utils/)
- `scratch/` - Temporary files (gitignored)
- `.env` - Environment variables

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

## Important Development Rules

- ❌ **NEVER** create `test.js`, `temp.js`, `foo.js` files anywhere
- ❌ **NEVER** leave scripts in root directory - use `scripts/[purpose]/`
- ❌ **NEVER** access `process.env` directly - always use ResourceManager
- ❌ **NEVER** create new files when you should edit existing ones
- ✅ **ALWAYS** prefer editing over creating files
- ✅ **ALWAYS** use temporary directories (`scratch/`, `/tmp/`) for generated artifacts
- ✅ **ALWAYS** follow existing patterns in live test examples

## Technical Requirements

- ES modules (`"type": "module"`) and Node.js >= 18.0.0
- Monorepo with npm workspaces - run commands from root unless working on specific package
- API keys accessed via ResourceManager only

## CRITICAL: Async Resource Manager Pattern

**ALL root-level objects and services MUST use the async factory pattern:**

```typescript
class MyService {
  private constructor(dependencies) {
    // Private constructor - no async operations here
  }

  static async create(rm: ResourceManager): Promise<MyService> {
    // Get all dependencies from ResourceManager
    const config = rm.get<Config>('Config');
    
    // Perform any async initialization here
    await someAsyncSetup();
    
    return new MyService({ config });
  }
}
```

**Rules:**
- **NEVER use `new` directly** - always use `static async create(rm)`
- **NEVER use async constructors** - constructors must be synchronous
- **ALL dependencies come from ResourceManager** - no direct imports or hardcoded values

## Creating New Modules and Tools

### Module Template
```javascript
import { Module } from '@legion/module-loader';

export default class MyModule extends Module {
  constructor(dependencies = {}) {
    super('MyModule', dependencies);
  }

  getTools() {
    return [new MyTool(this.dependencies)];
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
        param1: z.string().describe('Parameter description')
      })
    });
    this.dependencies = dependencies;
  }

  async execute(args) {
    this.emit('progress', { percentage: 0, status: 'Starting...' });
    const result = await doSomething(args);
    this.emit('progress', { percentage: 100, status: 'Complete' });
    return { result };
  }
}
```

**Event System:** Tools emit `progress`, `info`, `warning`, `error` events that propagate through the system.