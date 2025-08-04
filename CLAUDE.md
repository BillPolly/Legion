# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Legion is a modular framework for building AI agent tools with consistent interfaces. It's organized as a monorepo using npm workspaces with packages for core infrastructure, AI/LLM services, tool collections, and applications.

## 🚨 CRITICAL: Module Loading and API Key Management 🚨

### Complete Module Loading Flow

The Legion framework uses a sophisticated module loading system that automatically handles API keys and dependencies:

```
.env File → ResourceManager → ModuleFactory → Module Instance → Tools
```

### 1. ResourceManager Initialization

**THE RESOURCE MANAGER LOADS THE ENTIRE .env FILE ON INITIALIZATION**

When ResourceManager initializes, it automatically:

1. **Finds .env file** - Searches for "legion" directory in path, then checks parent directories
2. **Loads ALL environment variables** - Uses `dotenv.config()` to load the entire .env file  
3. **Registers every variable** - Makes ALL env vars available as `resourceManager.get('env.VARIABLE_NAME')`
4. **Provides automatic injection** - ModuleFactory uses these for dependency injection

### 2. Module Loading Patterns

#### Pattern A: JSON Module Configuration (Recommended for Simple Modules)
```json
// module.json
{
  "name": "my-module",
  "dependencies": {
    "OPENAI_API_KEY": {
      "type": "string",
      "description": "OpenAI API key"
    }
  },
  "initialization": {
    "config": {
      "apiKey": "${OPENAI_API_KEY}"  // Resolved by ModuleFactory
    }
  }
}
```

#### Pattern B: Async Factory Pattern (For Complex Modules)
```javascript
// MyModule.js
export default class MyModule extends Module {
  static async create(resourceManager) {
    const apiKey = resourceManager.get('env.OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY required');
    }
    const module = new MyModule({ apiKey });
    await module.initialize();
    return module;
  }
}
```

### 3. How ModuleFactory Resolves Dependencies

```javascript
// ModuleFactory.js behavior:
1. Check for static create method → Pass ResourceManager directly
2. Read module.json dependencies → For each dependency:
   - Call resourceManager.get('env.DEPENDENCY_NAME')
   - Resolve ${DEPENDENCY_NAME} placeholders in config
3. Instantiate module with resolved dependencies
```

### 4. API Keys Available to Modules

✅ **All API keys are automatically available**
- `ANTHROPIC_API_KEY` → `resourceManager.get('env.ANTHROPIC_API_KEY')`
- `OPENAI_API_KEY` → `resourceManager.get('env.OPENAI_API_KEY')`
- `GITHUB_PAT` → `resourceManager.get('env.GITHUB_PAT')`
- `SERPER_API_KEY` → `resourceManager.get('env.SERPER_API_KEY')`
- `RAILWAY_API_TOKEN` → `resourceManager.get('env.RAILWAY_API_TOKEN')`
- **Every .env variable is available without manual setup**

### 5. Module Loading in Aiur

```javascript
// AiurServer.js creates singleton ModuleLoader:
this.moduleLoader = new ModuleLoader(); // Creates ResourceManager internally
await this.moduleLoader.initialize();   // ResourceManager loads .env here

// Modules are loaded with automatic dependency injection:
await this.moduleLoader.loadModuleByName('ai-generation', AIGenerationModule);
```

### Critical Rules

❌ **NEVER access process.env directly** - Always use ResourceManager
❌ **NEVER manually register API keys** - ResourceManager does this automatically
❌ **NEVER create multiple ModuleLoader instances** - Use the singleton
❌ **NEVER bypass ModuleFactory dependency resolution** - It handles everything
❌ **NEVER load .env manually** - ResourceManager handles this during initialization

✅ **ALWAYS use resourceManager.get('env.KEY_NAME')** for env variables
✅ **ALWAYS throw errors if required API keys are missing**
✅ **ALWAYS follow async factory pattern for modules needing ResourceManager**
✅ **ALWAYS let ModuleFactory handle dependency injection**

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

## Actor System and WebSocket Communication

### Overview

The Legion actor system enables multiple actors to communicate over a single WebSocket connection using automatic GUID-based routing. This is implemented through ActorSpace, Channel, and RemoteActor classes in `packages/shared/actors/`.

### Core Concepts

1. **ActorSpace** - Container that manages actors and routing
   - Registers actors with GUIDs using `register(actor, guid)`
   - Handles message routing automatically via `handleIncomingMessage()`
   - Creates and manages Channel for WebSocket communication

2. **Channel** - WebSocket wrapper that handles actor protocol
   - Wraps WebSocket and handles encoding/decoding
   - Creates RemoteActor instances via `makeRemote(guid)`
   - Sends messages as `{targetGuid, payload}` format

3. **RemoteActor** - Proxy for actors in different ActorSpace
   - Has a GUID and reference to Channel
   - When `receive()` is called, forwards through Channel using GUID
   - Actors communicate through RemoteActor references, not direct GUID handling

4. **Actor** - Base class for actors
   - Extends from `Actor` class in shared/actors
   - Implements `receive(payload, envelope)` method
   - Gets RemoteActor reference to communicate with counterpart

### Multi-Actor Architecture

**CRITICAL: Multiple actors share ONE WebSocket connection via the same ActorSpace and Channel!**

```
WebSocket Connection
      │
   Channel
      │
  ActorSpace
   ├─ Actor1 (guid: "space-actor1")
   ├─ Actor2 (guid: "space-actor2")
   └─ Actor3 (guid: "space-actor3")
```

### Handshake Protocol for Multi-Actor Systems

When establishing multi-actor communication:

1. **Server sends first** with all actor GUIDs:
```javascript
ws.send(JSON.stringify({
  type: 'actor_handshake',
  serverActors: {
    chat: 'server-123-chat',
    terminal: 'server-123-terminal',
    // ... more actors
  }
}));
```

2. **Client responds** with its actor GUIDs:
```javascript
ws.send(JSON.stringify({
  type: 'actor_handshake_ack',
  clientActors: {
    chat: 'frontend-chat',
    terminal: 'frontend-terminal',
    // ... more actors
  }
}));
```

3. **After handshake**, create Channel and RemoteActors:
```javascript
// Create Channel (takes over WebSocket message handling)
const channel = actorSpace.addChannel(ws);

// Create RemoteActors for each remote actor
const remoteChatActor = channel.makeRemote(remoteGuids.chat);
const remoteTerminalActor = channel.makeRemote(remoteGuids.terminal);

// Give RemoteActors to local actors
chatActor.setRemoteAgent(remoteChatActor);
terminalActor.setRemoteAgent(remoteTerminalActor);
```

### Implementation Pattern

**Frontend ActorSpace:**
```javascript
class FrontendActorSpace extends ActorSpace {
  async connect(url, ...dependencies) {
    const ws = new WebSocket(url);
    // Wait for handshake...
    
    // Register multiple actors in the SAME ActorSpace
    this.register(chatActor, `${this.spaceId}-chat`);
    this.register(terminalActor, `${this.spaceId}-terminal`);
    
    // Create ONE Channel for the WebSocket
    const channel = this.addChannel(ws);
    
    // Create RemoteActors and connect
    chatActor.setRemoteAgent(channel.makeRemote(serverGuids.chat));
    terminalActor.setRemoteAgent(channel.makeRemote(serverGuids.terminal));
  }
}
```

**Backend ActorSpace:**
```javascript
class ServerActorSpace extends ActorSpace {
  handleConnection(ws, clientId) {
    // Register multiple agents
    this.register(chatAgent, `${this.spaceId}-chat`);
    this.register(terminalAgent, `${this.spaceId}-terminal`);
    
    // Send handshake, wait for response, create Channel
    // Then create RemoteActors for client actors
  }
}
```

### Actor Communication Pattern

**Actors DON'T manage GUIDs directly!** They just use RemoteActor references:

```javascript
class ChatActor extends Actor {
  setRemoteAgent(remoteAgent) {
    this.remoteAgent = remoteAgent;
  }
  
  sendMessage(content) {
    // Just call receive on the RemoteActor
    // No GUID handling needed!
    this.remoteAgent.receive({
      type: 'chat_message',
      content: content
    });
  }
  
  receive(payload) {
    // Handle incoming messages
    console.log('Received:', payload);
  }
}
```

### Message Flow

1. Actor calls `remoteActor.receive(payload)`
2. RemoteActor forwards to Channel with its GUID
3. Channel sends `{targetGuid, payload}` through WebSocket
4. Remote Channel receives and decodes message
5. Remote ActorSpace looks up targetGuid
6. Remote ActorSpace calls `actor.receive(payload)` on target actor

### Key Rules

✅ **DO:**
- Register all actors in the SAME ActorSpace for shared WebSocket
- Use ONE Channel per WebSocket connection
- Create RemoteActor via `channel.makeRemote(guid)`
- Let actors communicate through RemoteActor references
- Let ActorSpace handle all routing automatically

❌ **DON'T:**
- Create multiple ActorSpaces for one connection
- Try to manually route messages between actors
- Have actors manage GUIDs directly
- Create multiple Channels for the same WebSocket
- Implement custom routing logic

### Benefits

- **Single WebSocket** - Multiple actors share one connection efficiently
- **Automatic Routing** - ActorSpace handles all GUID-based routing
- **Clean Separation** - Actors focus on logic, not transport
- **Point-to-Point** - Direct actor-to-actor communication
- **Scalable** - Easy to add more actors to existing connection