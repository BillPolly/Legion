# Legion CLI - Design Document

## Overview

The Legion CLI is a unified command-line interface that integrates four core Legion framework components to provide a powerful, memory-enabled, tool-executing CLI system with persistent context and hierarchical task execution.

## Architecture Foundation

### Core Integration Components

**1. ConfigurableAgent (Agent Runtime)**
- JSON-configured agent with LLM integration
- Memory management via AgentState and KnowledgeGraph
- Tool execution through CapabilityManager
- Message-based Actor pattern communication

**2. ResourceManager (Unified Resource Access)**
- Singleton pattern with transparent Proxy-based access
- Legion URI system: `legion://server/type/path`
- Handle abstraction for different resource types
- Environment variable and service management

**3. Actor/Message System (Communication Framework)**
- Fire-and-forget messaging via `send()` and `defer()`
- Message routing through `receive()` method
- Asynchronous coordination between components

**4. Tasks System (Hierarchical Execution)**
- Parent-child task relationships with artifact flow
- ExecutionContext for dependency injection
- Strategy pattern for pluggable task behaviors
- Conversation history per task context

## System Architecture

### CLI Class (Primary Interface)

```
CLI
├── ConfigurableAgent (agent runtime)
├── ResourceManager (resource access)
├── CommandRouter (slash command routing)
├── TaskOrchestrator (task execution)
├── MemoryManager (persistent context)
└── SessionManager (session lifecycle)
```

### Core Components

**CLI Class**
- Main entry point and session coordinator
- Integrates all subsystems
- Manages readline interface and user interaction
- Handles session persistence and restoration

**CommandRouter**
- Routes slash commands (`/help`, `/tools`, `/memory`, etc.)
- Integrates with ConfigurableAgent's message routing
- Provides command discovery and help system
- Maps commands to agent message types

**TaskOrchestrator**
- Creates Task objects for complex operations
- Manages hierarchical task execution
- Coordinates artifact flow between tasks
- Provides task status and progress tracking

**MemoryManager**
- Wraps ConfigurableAgent's KnowledgeGraph
- Provides persistent memory across sessions
- Manages entity/relationship storage
- Offers memory search and retrieval

**SessionManager**
- Handles session lifecycle (create, save, restore)
- Manages session metadata and indexing
- Provides session switching capabilities
- Integrates with ResourceManager for storage

### Message Flow Architecture

**User Input Processing:**
1. User enters command or query
2. CLI determines if it's a slash command or natural language
3. CommandRouter handles slash commands directly
4. Natural language goes to ConfigurableAgent via Actor pattern
5. ConfigurableAgent processes with LLM and memory context
6. Tool execution requests route through CapabilityManager
7. Responses flow back through Actor messaging

**Task Execution Flow:**
1. Complex requests create Task objects via TaskOrchestrator
2. Tasks inherit strategy from parent context
3. ExecutionContext provides dependency injection
4. Task hierarchy manages artifact flow
5. Completion messages propagate through Actor system

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

## Core Components Detail

### CLI Class

**Responsibilities:**
- Session management and persistence
- User interface (readline integration)
- Component coordination and lifecycle
- Error handling and graceful degradation

**Key Methods:**
- `start()` - Initialize components and start interactive session
- `processInput(input)` - Route user input to appropriate handler
- `executeCommand(command, args)` - Execute slash commands
- `handleNaturalLanguage(query)` - Send to ConfigurableAgent
- `shutdown()` - Clean shutdown with session save

### CommandRouter

**Slash Command Implementation:**
- `/help` - Show available commands and usage
- `/tools` - List available tools and capabilities
- `/memory` - Memory search and management commands
- `/tasks` - Task status and management
- `/session` - Session operations (save, load, list, switch)
- `/clear` - Clear current conversation context
- `/config` - Configuration management
- `/exit` - Graceful shutdown

**Command Pattern:**
```javascript
class Command {
  async execute(args, context) {
    // Command implementation
  }
  
  getHelp() {
    // Return help text
  }
}
```

### TaskOrchestrator

**Task Management:**
- Creates Task objects with appropriate ExecutionContext
- Manages task hierarchy and parent-child relationships
- Coordinates artifact flow between tasks
- Provides task status monitoring and reporting

**Integration Points:**
- Uses ConfigurableAgent for LLM-based task processing
- Leverages ResourceManager for tool access
- Employs Actor pattern for async coordination
- Manages memory persistence through KnowledgeGraph

### MemoryManager

**Memory Operations:**
- Entity storage and retrieval
- Relationship management
- Memory search and filtering
- Cross-session persistence

**Handle Integration:**
```javascript
const memoryHandle = await rm.createHandleFromURI('legion://local/memory/session123');
await memoryHandle.storeEntity('user-preference', { theme: 'dark' });
const preferences = await memoryHandle.findEntities({ type: 'user-preference' });
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