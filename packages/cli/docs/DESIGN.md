# Legion CLI - Design Document

## Overview

The Legion CLI is a Handle-centric command-line interface that provides a unified, consistent way to interact with any resource, tool, or artifact through the Legion framework's Handle system. Everything in the CLI - commands, tools, memory, sessions, configuration - is accessed through Handles, creating an elegant and powerful interface.

## Handle-Centric Architecture

### Everything is a Handle

The CLI operates on the principle that **every resource, tool, command, and artifact** is accessed through a Handle. This creates a consistent, discoverable, and automatically displayable interface:

**1. Tools as Handles**
- `legion://local/tools/file_read` - File reading tool
- `legion://local/tools/calculator` - Calculator functionality  
- `legion://local/tools/web_scraper` - Web scraping capabilities

**2. Memory as Handles**
- `legion://local/memory/entities` - Knowledge graph entities
- `legion://local/memory/sessions/current` - Current session data
- `legion://local/memory/conversations` - Conversation history

**3. Configuration as Handles**
- `legion://local/env/ANTHROPIC_API_KEY` - API configuration
- `legion://local/config/cli/theme` - CLI appearance settings
- `legion://local/config/agent/model` - LLM model selection

**4. Tasks and Artifacts as Handles**
- `legion://local/tasks/current` - Currently executing task
- `legion://local/artifacts/generated_code` - Generated code artifacts
- `legion://local/workspace/project.json` - Project files

### Core Integration Components

**1. ConfigurableAgent (Agent Runtime via Handles)**
- Agent accessed as: `legion://local/agent/current`
- Memory via: `legion://local/agent/memory/*`
- Tool capabilities via: `legion://local/agent/tools/*`
- Message-based Actor pattern communication

**2. ResourceManager (Universal Handle Provider)**
- Singleton pattern with Handle creation and caching
- Legion URI system: `legion://server/type/path`
- Transparent Handle abstraction for all resource types
- Automatic Handle discovery and registration

**3. Actor/Message System (Handle Communication)**
- Handles can send/receive messages via Actor pattern
- Fire-and-forget messaging between Handle instances
- Event-driven Handle coordination and updates

**4. Tasks System (Handle-based Execution)**
- Tasks accessed as Handles: `legion://local/tasks/{id}`
- Artifacts flow between tasks via Handle references
- ExecutionContext provides Handle-based dependency injection

## System Architecture

### CLI as Handle Gateway

```
CLI (Handle-based Interface)
├── ResourceManager (Handle Provider)
├── HandleRegistry (Auto-discovery)
├── DisplayEngine (Handle Visualization)
├── CommandProcessor (Handle Command Routing)
└── SessionContext (Handle-based State)
```

### Handle-First Design

**CLI Class**
- Primary Handle gateway and user interface
- Discovers and presents available Handles
- Routes user input to appropriate Handles
- Manages Handle-based session state

**HandleRegistry**
- Auto-discovers available Handles by type
- Maintains Handle metadata and capabilities
- Provides Handle search and filtering
- Enables dynamic Handle loading

**DisplayEngine**
- Automatically renders Handle states and capabilities
- Provides consistent Handle visualization
- Supports multiple output formats (table, tree, json)
- Enables Handle introspection and help

**CommandProcessor**
- Maps user commands to Handle operations
- Supports both slash commands and natural language
- Routes complex operations to ConfigurableAgent Handle
- Provides Handle-based command completion

**SessionContext**
- All session state stored as Handles
- Session persistence via Handle serialization
- Cross-session Handle reference resolution
- Handle-based session switching and management

### Handle-Based Message Flow

**User Input Processing:**
1. User enters command or query via CLI
2. CLI accesses HandleRegistry to resolve available commands/tools
3. Input routes to appropriate Handle based on URI pattern
4. Handles communicate via Actor messaging system
5. Complex queries route to ConfigurableAgent Handle
6. Tool execution requests route through Tool Handles
7. All responses flow through Handle Actor messaging

**Handle-Based Task Execution:**
1. Complex requests create Task Handles via TaskOrchestrator Handle
2. Task Handles inherit strategy from parent Handle context
3. ExecutionContext provides Handle-based dependency injection
4. Task hierarchy manages artifact flow between Handles
5. Completion messages propagate through Handle Actor system

### Handle Integration

**Resource Access Pattern:**
- CLI components access resources via ResourceManager Handles
- ConfigHandle: `legion://local/env/ANTHROPIC_API_KEY`
- FileHandle: `legion://local/filesystem/workspace/project.json`
- MongoHandle: `legion://local/mongodb/sessions/current`
- ServiceHandle: `legion://local/service/llm/status`

**Transparent Property Access:**
```javascript
const config = await resourceManager.createHandleFromURI('legion://local/env/API_KEY');
const apiKey = config.getValue(); // or simply: config.API_KEY
```

### Memory System Integration

**KnowledgeGraph Integration:**
- ConfigurableAgent's KnowledgeGraphInterface provides persistent memory
- Entities and relationships extracted from conversations
- Memory queries via Handle pattern: `legion://local/memory/entities`
- Cross-session memory persistence via ResourceManager

**Memory Access Patterns:**
```javascript
// Through MemoryManager
await memoryManager.storeEntity('project', { name: 'CLI', type: 'software' });
const entities = await memoryManager.findEntities({ type: 'software' });

// Through Handles
const memory = await rm.createHandleFromURI('legion://local/memory/entities');
await memory.store('project', entityData);
```

## Core Components Detail - Handle-Based Design

### CLI Gateway (Handle-Based Interface)

**Responsibilities:**
- Serve as the primary Handle gateway for user interaction
- Auto-discover and present available Handles to users
- Route user input to appropriate Handle operations
- Manage Handle-based session state and persistence

**Handle-Centric Design:**
- CLI itself is accessible as `legion://local/cli/current`
- All CLI operations performed through Handle method invocation
- Session state stored as Handles: `legion://local/cli/session/{id}`
- Configuration accessed via Handles: `legion://local/cli/config/*`

**Key Handle Operations:**
```javascript
// CLI accessed as Handle
const cli = await rm.createHandleFromURI('legion://local/cli/current');

// All CLI functions via Handle methods
await cli.start();
await cli.processInput(userInput);
await cli.executeCommand('/help', []);
await cli.shutdown();
```

### HandleRegistry (Auto-Discovery Engine)

**Handle Discovery and Management:**
- Automatically discovers all available Handles by type
- Maintains Handle metadata, capabilities, and relationships
- Provides Handle search, filtering, and categorization
- Enables dynamic Handle loading and registration

**Registry as Handle:**
```javascript
// Access registry itself as Handle
const registry = await rm.createHandleFromURI('legion://local/handles/registry');

// Discover available tools
const toolHandles = await registry.discoverByType('tools');
const memoryHandles = await registry.discoverByType('memory');

// Search Handle capabilities
const fileHandles = await registry.search('file operations');
```

### DisplayEngine (Handle Visualization)

**Hybrid Terminal + Browser Approach:**
- **Terminal-First**: Text rendering with tables, trees, colors in terminal (blessed/ink for rich TUI)
- **ShowMe Integration**: Complex visualizations delegated to ShowMe browser windows
- **Actor-Based Control**: CLI controls ShowMe browser via Actor messaging
- **Chromeless Windows**: Browser launched in app mode (--app flag, no tabs/chrome)
- **Seamless Flow**: Terminal for navigation, browser for rich Handle visualization

**Display Engine Modes:**

```javascript
class DisplayEngine {
  constructor(resourceManager) {
    this.resourceManager = resourceManager;
    this.showMeService = null;
    this.mode = 'auto'; // 'terminal', 'browser', 'auto'
  }

  async render(handle, format = 'auto') {
    // Terminal rendering for simple displays
    if (this.shouldUseTerminal(handle, format)) {
      return this.renderTerminal(handle, format);
    }

    // Browser rendering for complex displays
    return this.renderBrowser(handle, format);
  }

  // Terminal rendering (fast, SSH-friendly)
  async renderTerminal(handle, format) {
    switch (format) {
      case 'table':
        return this.renderTable(handle);
      case 'tree':
        return this.renderTree(handle);
      case 'json':
        return this.renderJSON(handle);
      default:
        return this.renderSummary(handle);
    }
  }

  // Browser rendering via ShowMe (rich, interactive)
  async renderBrowser(handle, options = {}) {
    // Get ShowMe service
    if (!this.showMeService) {
      this.showMeService = this.resourceManager.get('showme');
    }

    // Send Handle URI to ShowMe via Actor messaging
    await this.showMeService.display(handle, {
      window: {
        title: options.title || `${handle.resourceType}: ${handle.toURI()}`,
        width: options.width || 1000,
        height: options.height || 700,
        chromeless: true // Launch in app mode
      }
    });

    console.log(chalk.green('✓ Displaying in browser window'));
  }

  // Interactive exploration in browser
  async exploreInteractive(handle) {
    console.log(chalk.cyan('🔍 Opening interactive explorer...'));

    await this.renderBrowser(handle, {
      title: `Explore: ${handle.resourceType}`,
      width: 1200,
      height: 800
    });
  }

  shouldUseTerminal(handle, format) {
    // Use terminal for simple formats
    if (['table', 'json', 'summary'].includes(format)) {
      return true;
    }

    // Use browser for complex Handle types
    if (handle.resourceType === 'strategy') {
      return false;
    }

    return this.mode === 'terminal';
  }
}
```

**Terminal Rendering Examples:**

```javascript
// Simple table in terminal
await display.render(strategyHandle, 'table');
// Output:
// ┌──────────────┬────────────────────────────────────┐
// │ Property     │ Value                              │
// ├──────────────┼────────────────────────────────────┤
// │ URI          │ legion://local/strategy/...        │
// │ Type         │ strategy                           │
// │ Name         │ SimpleNodeTestStrategy             │
// │ Tools        │ file_write, file_read, command_... │
// └──────────────┴────────────────────────────────────┘

// JSON output
await display.render(strategyHandle, 'json');
// Output:
// {
//   "uri": "legion://local/strategy/...",
//   "resourceType": "strategy",
//   "strategyName": "SimpleNodeTestStrategy",
//   "requiredTools": ["file_write", "file_read"],
//   "promptSchemas": ["analyzeCode", "generateTest"]
// }
```

**Browser Rendering Examples:**

```javascript
// Complex interactive display
await display.exploreInteractive(strategyHandle);
// Action: Opens chromeless browser window with:
//   - Full Handle introspection
//   - Interactive property exploration
//   - Action buttons (Instantiate, View Source)
//   - Live updates via Handle subscriptions
//   - Syntax-highlighted source code
//   - Related strategies via semantic search
```

**Display Engine Decision Flow:**

```
User types command
       ↓
CLI receives input
       ↓
   Parse command
       ↓
  /show <handle-uri>
       ↓
  DisplayEngine.render()
       ↓
   ┌─────────────────┐
   │ Simple display? │
   └────┬───────┬────┘
        │       │
    Yes │       │ No
        │       │
        ↓       ↓
   Terminal   ShowMe
   (table,    (browser,
    tree,      interactive,
    json)      chromeless)
```

**ShowMe Actor Integration:**

```javascript
class DisplayEngine {
  async initializeShowMe() {
    // Get ShowMe service from ResourceManager
    this.showMeService = this.resourceManager.get('showme');

    // Get ShowMe server actor for direct messaging
    this.showMeActor = await this.showMeService.getServerActor();
  }

  async displayHandle(handle, options = {}) {
    // Send Actor message to ShowMe server
    await this.showMeActor.send({
      type: 'display-resource',
      resource: handle.toURI(),
      window: {
        title: options.title || `${handle.resourceType}: ${handle.toURI()}`,
        width: options.width || 1000,
        height: options.height || 700,
        position: options.position || 'center',
        chromeless: true
      }
    });

    // ShowMe server:
    //   1. Resolves Handle from URI
    //   2. Determines renderer (HandleRenderer/StrategyRenderer)
    //   3. Launches browser in app mode if needed
    //   4. Sends display message to browser via WebSocket
    //   5. Browser renders Handle with appropriate viewer
  }
}
```

### CommandProcessor (Handle-Based Command Routing)

**Handle Command Integration:**
- Maps slash commands to Handle operations
- Supports both command-style and natural language Handle interaction
- Routes complex operations to ConfigurableAgent Handle
- Provides Handle-based command completion and validation

**Commands as Handle Operations:**
```javascript
// Traditional slash commands become Handle operations
const processor = await rm.createHandleFromURI('legion://local/cli/commands');

// Each command routes to appropriate Handle
await processor.route('/tools', toolRegistryHandle);
await processor.route('/memory search', memoryHandle);
await processor.route('/session save', sessionHandle);

// Natural language routed to agent Handle
const agent = await rm.createHandleFromURI('legion://local/agent/current');
await processor.routeNaturalLanguage(query, agent);
```

### SessionContext (Handle-Based State Management)

**Session State as Handles:**
- All session state stored and accessed through Handles
- Session persistence via Handle serialization/deserialization
- Cross-session Handle reference resolution and restoration
- Handle-based session switching and management

**Session Handle Patterns:**
```javascript
// Current session as Handle
const session = await rm.createHandleFromURI('legion://local/cli/session/current');

// Session data via Handle properties
session.startTime = new Date();
session.userId = 'user123';
session.preferences = { theme: 'dark' };

// Session persistence
await session.save();
await session.switchTo('legion://local/cli/session/previous');

// Session restoration
const savedSession = await rm.createHandleFromURI('legion://local/cli/session/workspace-2024');
await savedSession.restore();
```

## Package Structure

```
packages/cli/
├── docs/
│   ├── DESIGN.md
│   ├── API.md
│   └── EXAMPLES.md
├── src/
│   ├── index.js                 # Main entry point
│   ├── core/
│   │   ├── CLI.js              # Main CLI class
│   │   ├── CommandRouter.js    # Slash command routing
│   │   ├── TaskOrchestrator.js # Task execution management
│   │   ├── MemoryManager.js    # Memory system wrapper
│   │   └── SessionManager.js   # Session lifecycle
│   ├── commands/
│   │   ├── BaseCommand.js      # Command base class
│   │   ├── HelpCommand.js      # /help implementation
│   │   ├── ToolsCommand.js     # /tools implementation
│   │   ├── MemoryCommand.js    # /memory implementation
│   │   ├── TasksCommand.js     # /tasks implementation
│   │   ├── SessionCommand.js   # /session implementation
│   │   └── ConfigCommand.js    # /config implementation
│   ├── handlers/
│   │   ├── InputHandler.js     # User input processing
│   │   ├── OutputHandler.js    # Response formatting
│   │   └── ErrorHandler.js     # Error management
│   └── utils/
│       ├── prompt.js           # Readline utilities
│       ├── formatting.js       # Output formatting
│       └── validation.js       # Input validation
├── test/
│   └── __tests__/
├── package.json
└── README.md
```

## API Interface

### Main CLI Class

```javascript
class CLI {
  constructor(config = {})
  async initialize()
  async start()
  async processInput(input)
  async executeCommand(command, args)
  async handleNaturalLanguage(query)
  async shutdown()
  
  // Session management
  async saveSession(name)
  async loadSession(name)
  async listSessions()
  
  // Component access
  getAgent()
  getResourceManager()
  getMemoryManager()
  getTaskOrchestrator()
}
```

### CommandRouter

```javascript
class CommandRouter {
  constructor(cli)
  async route(command, args, context)
  registerCommand(name, commandClass)
  getAvailableCommands()
  getCommandHelp(command)
}
```

### TaskOrchestrator

```javascript
class TaskOrchestrator {
  constructor(agent, resourceManager)
  async createTask(description, context = {})
  async executeTask(task, strategy = null)
  getTaskStatus(taskId)
  getActiveTasks()
  getTaskHistory()
}
```

### MemoryManager

```javascript
class MemoryManager {
  constructor(knowledgeGraph)
  async storeEntity(id, data)
  async findEntities(query)
  async storeRelationship(subject, predicate, object)
  async findRelationships(query)
  async searchMemory(query)
  async exportMemory()
  async importMemory(data)
}
```

## Integration Patterns

### ResourceManager Integration

**Service Discovery:**
```javascript
// CLI components discover services through ResourceManager
const llmClient = await resourceManager.get('llmClient');
const toolRegistry = await resourceManager.get('toolRegistry');
```

**Handle-based Resource Access:**
```javascript
// Uniform resource access via Legion URIs
const config = await resourceManager.createHandleFromURI('legion://local/env/CONFIG');
const workspace = await resourceManager.createHandleFromURI('legion://local/filesystem/workspace');
const memory = await resourceManager.createHandleFromURI('legion://local/memory/current');
```

### ConfigurableAgent Integration

**Message-based Communication:**
```javascript
// CLI communicates with agent via Actor pattern
const response = await agent.receive({
  type: 'chat',
  content: userInput,
  from: 'cli',
  sessionId: currentSession.id
});
```

**Tool Execution:**
```javascript
// Tool requests through agent capability system
const toolResult = await agent.receive({
  type: 'tool_request',
  tool: 'file_manager',
  operation: 'read',
  params: { filepath: '/path/to/file' }
});
```

### Task System Integration

**Hierarchical Task Execution:**
```javascript
// Complex operations become Task hierarchies
const mainTask = await taskOrchestrator.createTask("Build a web application");
const strategy = new WebDevelopmentStrategy(agent, resourceManager);
mainTask.setStrategy(strategy);

// Strategy decomposes into subtasks with artifact flow
await taskOrchestrator.executeTask(mainTask);
```

### Memory System Integration

**Persistent Context:**
```javascript
// Memory flows through KnowledgeGraph to persistent storage
await memoryManager.storeEntity('user-request', {
  description: userInput,
  timestamp: new Date(),
  context: currentTask.getContext()
});

// Memory retrieval enhances future interactions
const relatedMemories = await memoryManager.findEntities({
  type: 'user-request',
  similarity: userInput
});
```

## Execution Flow Example

### User Session Flow

1. **CLI Startup:**
   - Initialize ResourceManager singleton
   - Create ConfigurableAgent with Legion configuration
   - Initialize TaskOrchestrator, MemoryManager, CommandRouter
   - Load or create session via SessionManager

2. **User Input: "Create a Node.js REST API"**
   - InputHandler parses natural language (not slash command)
   - CLI routes to ConfigurableAgent via Actor messaging
   - Agent processes with LLM, consulting memory for context
   - Agent decides task requires decomposition
   - TaskOrchestrator creates Task with WebDevelopmentStrategy
   - Strategy decomposes into subtasks with artifact dependencies

3. **Task Execution:**
   - Parent task creates file structure subtask
   - Subtask inherits ExecutionContext from parent
   - File operations execute via ResourceManager Handle system
   - Artifacts flow between subtasks (package.json → dependencies → server.js)
   - Progress messages flow via Actor pattern back to CLI

4. **Slash Command: "/memory search API"**
   - CommandRouter routes to MemoryCommand
   - MemoryManager queries KnowledgeGraph
   - Results formatted and displayed
   - Memory context enriches ongoing task execution

5. **Session Management:**
   - Conversation history, task progress, and memory stored
   - Session can be paused and resumed
   - Cross-session memory provides continuity

## Configuration

### Agent Configuration

```json
{
  "agent": {
    "id": "legion-cli",
    "name": "Legion CLI Assistant",
    "version": "1.0.0",
    "capabilities": [
      {
        "module": "file_manager",
        "tools": ["read", "write", "list", "create_directory"],
        "permissions": { "filesystem": "workspace" }
      },
      {
        "module": "web_tools",
        "tools": ["http_request", "parse_html", "download"],
        "permissions": { "network": "limited" }
      }
    ],
    "llm": {
      "maxTokens": 2000,
      "systemPrompt": "You are Legion CLI, a powerful development assistant..."
    },
    "knowledge": {
      "enabled": true,
      "persistence": "persistent"
    },
    "prompts": {
      "responseFormat": "markdown"
    }
  }
}
```

### CLI Configuration

```json
{
  "cli": {
    "prompt": "legion> ",
    "historySize": 1000,
    "autoSave": true,
    "sessionTimeout": "24h",
    "workspace": "~/legion-workspace",
    "logLevel": "info"
  },
  "commands": {
    "aliases": {
      "t": "tools",
      "m": "memory",
      "s": "session",
      "h": "help"
    },
    "defaultHelp": true
  },
  "memory": {
    "autoExtract": true,
    "persistAcrossSessions": true,
    "maxEntities": 10000
  }
}
```

## Benefits of This Architecture

### 1. Unified Resource Access
- All components access resources through consistent Handle pattern
- Legion URI system provides location-independent resource references
- ResourceManager singleton ensures configuration consistency

### 2. Persistent Memory
- KnowledgeGraph provides context across sessions
- Entity/relationship model captures conversation knowledge
- Memory enhances tool selection and task decomposition

### 3. Hierarchical Task Execution
- Complex operations decompose into manageable subtasks
- Artifact flow ensures data dependencies are met
- Task strategies provide domain-specific execution logic

### 4. Extensible Command System
- Slash commands integrate seamlessly with agent messaging
- New commands register through CommandRouter
- Commands can leverage full agent capabilities

### 5. Actor-based Coordination
- Fire-and-forget messaging enables async coordination
- Message routing provides loose coupling between components
- Event-driven architecture supports real-time updates

### 6. Framework Integration
- Built on proven Legion framework components
- Leverages existing ConfigurableAgent capabilities
- Integrates with broader Legion ecosystem

This design creates a powerful, extensible CLI that unifies the best aspects of the Legion framework into a cohesive, memory-enabled development tool that can grow with user needs while maintaining consistency and reliability.