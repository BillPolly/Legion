# Configurable Agent System Design

## Executive Summary

The Configurable Agent System enables the creation of LLM-driven agents entirely through JSON configuration files. This package focuses solely on the agent runtime - taking a configuration and executing it as a functioning agent within the Legion framework.

## System Architecture

### Core Concept

An agent is a stateful actor that:
1. Receives messages through the Actor framework
2. Processes them using an LLM with configured prompts
3. Executes tools based on capabilities
4. Maintains state in memory and knowledge graphs
5. Follows behavior trees for complex workflows

### Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     ConfigurableAgent                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   AgentState │  │CapabilityMgr │  │  LLMClient   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  BehaviorTree│  │ KnowledgeGraph│  │PromptManager│     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   Actor Framework  │
                    └───────────────────┘
```

## Configuration Schema

### Agent Configuration Structure

```json
{
  "agent": {
    "id": "string",
    "name": "string",
    "type": "conversational|task|analytical|creative",
    "version": "string",
    
    "llm": {
      "provider": "anthropic|openai",
      "model": "string",
      "temperature": 0.0-1.0,
      "maxTokens": "number",
      "systemPrompt": "string",
      "retryStrategy": {
        "maxRetries": 3,
        "backoffMs": 1000
      }
    },
    
    "capabilities": [...],
    "behaviorTree": {...},
    "knowledge": {...},
    "prompts": {...},
    "state": {...}
  }
}
```

### Capabilities Configuration

Defines which Legion tools/modules the agent can use:

```json
"capabilities": [
  {
    "module": "file",
    "tools": ["file_read", "file_write", "directory_list"],
    "permissions": {
      "basePath": "/workspace",
      "maxFileSize": 1048576,
      "allowedExtensions": [".txt", ".json", ".md"]
    }
  },
  {
    "module": "calculator",
    "tools": ["*"],
    "permissions": {}
  }
]
```

### Behavior Tree Configuration

Defines complex agent workflows:

```json
"behaviorTree": {
  "type": "sequence",
  "children": [
    {
      "type": "action",
      "id": "analyze_request",
      "tool": "llm_classify",
      "params": {
        "categories": ["question", "command", "statement"]
      }
    },
    {
      "type": "selector",
      "children": [
        {
          "type": "sequence",
          "condition": {
            "variable": "classification",
            "equals": "command"
          },
          "children": [
            {
              "type": "action",
              "id": "execute_command",
              "tool": "tool_executor"
            }
          ]
        },
        {
          "type": "action",
          "id": "direct_response",
          "tool": "llm_response"
        }
      ]
    }
  ]
}
```

### Knowledge Graph Configuration

Defines how the agent stores and queries information:

```json
"knowledge": {
  "enabled": true,
  "persistence": "session|persistent",
  "storage": "memory|file|mongodb",
  "schemas": [
    {
      "name": "Conversation",
      "properties": {
        "id": "string",
        "timestamp": "datetime",
        "participants": "array",
        "topic": "string"
      }
    }
  ],
  "relationships": [
    {
      "type": "RELATES_TO",
      "from": "Conversation",
      "to": "Task"
    }
  ]
}
```

### Prompt Management Configuration

Defines templates and response formats:

```json
"prompts": {
  "templates": {
    "greeting": "Hello {{userName}}! I'm {{agentName}}.",
    "clarification": "I need more information about {{topic}}."
  },
  "responseFormats": {
    "default": {
      "type": "markdown",
      "includeMetadata": false
    },
    "structured": {
      "type": "json",
      "schema": {
        "type": "object",
        "properties": {
          "message": {"type": "string"},
          "actions": {"type": "array"}
        }
      }
    }
  }
}
```

### State Management Configuration

Defines how the agent maintains state:

```json
"state": {
  "conversationHistory": {
    "maxMessages": 50,
    "pruningStrategy": "sliding-window"
  },
  "contextVariables": {
    "userName": {
      "type": "string",
      "persistent": true
    },
    "currentTask": {
      "type": "object",
      "persistent": false
    }
  }
}
```

## Core Classes

### ConfigurableAgent

The main agent class that extends Actor:

```javascript
class ConfigurableAgent extends Actor {
  constructor(config) {
    super();
    this.config = config;
    this.agentId = config.agent.id;
    this.initialized = false;
  }
  
  async initialize() {
    // Get ResourceManager singleton
    const resourceManager = await ResourceManager.getInstance();
    
    // Initialize components
    this.state = new AgentState(this.config.agent.state);
    this.capabilities = new CapabilityManager(this.config.agent.capabilities);
    this.promptManager = new PromptManager(this.config.agent.prompts);
    
    // Create LLM client
    this.llmClient = await resourceManager.createLLMClient(this.config.agent.llm);
    
    // Initialize optional components
    if (this.config.agent.behaviorTree) {
      this.behaviorTree = new BehaviorTreeExecutor(this.config.agent.behaviorTree);
      await this.behaviorTree.initialize(this.capabilities.getToolRegistry());
    }
    
    if (this.config.agent.knowledge?.enabled) {
      this.knowledge = new KnowledgeGraphInterface(this.config.agent.knowledge);
      await this.knowledge.initialize();
    }
    
    this.initialized = true;
  }
  
  async receive(message) {
    if (!this.initialized) {
      throw new Error('Agent not initialized');
    }
    
    // Update state
    this.state.addMessage(message);
    
    // Store in knowledge graph if enabled
    if (this.knowledge) {
      await this.knowledge.storeInteraction(message);
    }
    
    // Process through behavior tree or direct
    let response;
    if (this.behaviorTree) {
      response = await this.behaviorTree.execute({
        message,
        state: this.state,
        llm: this.llmClient,
        tools: this.capabilities
      });
    } else {
      response = await this.processDirectMessage(message);
    }
    
    // Update state with response
    this.state.addMessage(response);
    
    return response;
  }
  
  async processDirectMessage(message) {
    // Build context from state
    const context = this.state.buildContext();
    
    // Apply prompt template if available
    const prompt = this.promptManager.buildPrompt(message, context);
    
    // Get LLM response
    const llmResponse = await this.llmClient.sendMessage(prompt);
    
    // Format response
    return this.promptManager.formatResponse(llmResponse);
  }
  
  async executeToolChain(tools, context) {
    const results = [];
    for (const toolCall of tools) {
      const result = await this.capabilities.executeTool(
        toolCall.name,
        toolCall.params,
        context
      );
      results.push(result);
      
      if (result.breakChain) break;
    }
    return results;
  }
  
  getMetadata() {
    return {
      id: this.agentId,
      name: this.config.agent.name,
      type: this.config.agent.type,
      capabilities: this.capabilities.getAvailableTools(),
      initialized: this.initialized
    };
  }
}
```

### AgentState

Manages agent state with persistence:

```javascript
class AgentState {
  constructor(stateConfig) {
    this.config = stateConfig;
    this.conversationHistory = [];
    this.contextVariables = {};
    this.shortTermMemory = new Map();
    
    this.initializeVariables();
  }
  
  initializeVariables() {
    for (const [key, schema] of Object.entries(this.config.contextVariables || {})) {
      this.contextVariables[key] = this.getDefaultValue(schema.type);
    }
  }
  
  addMessage(message) {
    this.conversationHistory.push({
      timestamp: Date.now(),
      message
    });
    
    this.pruneHistory();
    this.extractVariables(message);
  }
  
  pruneHistory() {
    const maxMessages = this.config.conversationHistory?.maxMessages || 50;
    if (this.conversationHistory.length > maxMessages) {
      const strategy = this.config.conversationHistory?.pruningStrategy || 'sliding-window';
      
      switch (strategy) {
        case 'sliding-window':
          this.conversationHistory = this.conversationHistory.slice(-maxMessages);
          break;
        case 'importance-based':
          // Keep important messages
          this.conversationHistory = this.pruneByImportance(maxMessages);
          break;
      }
    }
  }
  
  extractVariables(message) {
    // Extract variables based on patterns
    for (const [key, schema] of Object.entries(this.config.contextVariables || {})) {
      if (schema.extractionPattern) {
        const pattern = new RegExp(schema.extractionPattern);
        const match = message.content?.match(pattern);
        if (match) {
          this.setVariable(key, match[1]);
        }
      }
    }
  }
  
  setVariable(key, value) {
    this.contextVariables[key] = value;
    
    const schema = this.config.contextVariables?.[key];
    if (schema?.persistent) {
      this.persistVariable(key, value);
    }
  }
  
  getVariable(key) {
    return this.contextVariables[key];
  }
  
  buildContext() {
    return {
      variables: this.contextVariables,
      history: this.getRecentHistory(),
      memory: Object.fromEntries(this.shortTermMemory)
    };
  }
  
  getRecentHistory(limit = 10) {
    return this.conversationHistory.slice(-limit);
  }
}
```

### CapabilityManager

Manages tool loading and permissions:

```javascript
class CapabilityManager {
  constructor(capabilitiesConfig) {
    this.config = capabilitiesConfig || [];
    this.loadedModules = new Map();
    this.toolRegistry = new Map();
  }
  
  async loadModules(resourceManager) {
    for (const capability of this.config) {
      try {
        // Load module through ResourceManager
        const module = await resourceManager.loadModule(capability.module);
        this.loadedModules.set(capability.module, module);
        
        // Register tools
        const tools = capability.tools.includes('*') 
          ? module.getAllTools() 
          : capability.tools;
          
        for (const toolName of tools) {
          const tool = module.getTool(toolName);
          if (tool) {
            this.toolRegistry.set(toolName, {
              tool,
              module: capability.module,
              permissions: capability.permissions
            });
          }
        }
      } catch (error) {
        console.error(`Failed to load module ${capability.module}:`, error);
      }
    }
  }
  
  async executeTool(toolName, params, context) {
    const toolEntry = this.toolRegistry.get(toolName);
    if (!toolEntry) {
      throw new Error(`Tool ${toolName} not found`);
    }
    
    // Check permissions
    this.validatePermissions(toolEntry, params);
    
    // Execute tool
    const result = await toolEntry.tool.execute({
      ...params,
      context,
      permissions: toolEntry.permissions
    });
    
    return result;
  }
  
  validatePermissions(toolEntry, params) {
    const permissions = toolEntry.permissions || {};
    
    // Example: Check file path restrictions
    if (permissions.basePath && params.path) {
      if (!params.path.startsWith(permissions.basePath)) {
        throw new Error(`Access denied: path outside allowed base`);
      }
    }
    
    // Add more permission checks as needed
  }
  
  getAvailableTools() {
    return Array.from(this.toolRegistry.keys());
  }
  
  getToolRegistry() {
    return this.toolRegistry;
  }
}
```

### PromptManager

Manages prompt templates and formatting:

```javascript
class PromptManager {
  constructor(promptConfig) {
    this.config = promptConfig || {};
    this.templates = this.config.templates || {};
    this.responseFormats = this.config.responseFormats || {};
  }
  
  buildPrompt(message, context) {
    // Check if there's a specific template for this message type
    const template = this.selectTemplate(message);
    
    if (template) {
      return this.applyTemplate(template, { message, ...context });
    }
    
    // Default prompt construction
    return this.buildDefaultPrompt(message, context);
  }
  
  selectTemplate(message) {
    // Logic to select appropriate template
    if (message.type && this.templates[message.type]) {
      return this.templates[message.type];
    }
    return null;
  }
  
  applyTemplate(template, data) {
    let result = template;
    
    // Replace variables {{varName}}
    const variables = template.match(/\{\{(\w+)\}\}/g) || [];
    for (const variable of variables) {
      const key = variable.slice(2, -2);
      const value = this.resolveVariable(key, data);
      result = result.replace(variable, value);
    }
    
    return result;
  }
  
  resolveVariable(key, data) {
    // Navigate nested data
    const keys = key.split('.');
    let value = data;
    
    for (const k of keys) {
      value = value?.[k];
    }
    
    return value || `{{${key}}}`;
  }
  
  formatResponse(llmResponse, format = 'default') {
    const formatConfig = this.responseFormats[format] || this.responseFormats.default;
    
    if (!formatConfig) {
      return llmResponse;
    }
    
    switch (formatConfig.type) {
      case 'json':
        return this.formatAsJson(llmResponse, formatConfig.schema);
      case 'markdown':
        return this.formatAsMarkdown(llmResponse);
      default:
        return llmResponse;
    }
  }
  
  formatAsJson(response, schema) {
    // Parse and validate against schema
    try {
      const parsed = typeof response === 'string' ? JSON.parse(response) : response;
      // Validate against schema if provided
      return JSON.stringify(parsed, null, 2);
    } catch (error) {
      return response;
    }
  }
  
  formatAsMarkdown(response) {
    // Ensure proper markdown formatting
    return response;
  }
}
```

### KnowledgeGraphInterface

Interface to the knowledge graph system:

```javascript
class KnowledgeGraphInterface {
  constructor(knowledgeConfig) {
    this.config = knowledgeConfig;
    this.enabled = knowledgeConfig.enabled;
    this.kg = null;
  }
  
  async initialize() {
    if (!this.enabled) return;
    
    // Initialize KG based on storage type
    const { KnowledgeGraphSystem } = await import('@legion/kg');
    
    this.kg = new KnowledgeGraphSystem({
      storage: this.config.storage,
      persistence: this.config.persistence,
      schemas: this.config.schemas
    });
    
    await this.kg.initialize();
    
    // Register relationships
    for (const rel of this.config.relationships || []) {
      this.kg.registerRelationship(rel);
    }
  }
  
  async storeInteraction(message) {
    if (!this.kg) return;
    
    const entity = {
      type: 'Interaction',
      properties: {
        id: `interaction_${Date.now()}`,
        timestamp: new Date().toISOString(),
        content: message.content,
        type: message.type
      }
    };
    
    await this.kg.addEntity(entity);
  }
  
  async query(pattern, params) {
    if (!this.kg) return null;
    
    return await this.kg.query(pattern, params);
  }
}
```

## Message Flow

### Standard Message Processing

```
1. Message Received via receive()
   ↓
2. State Update
   - Add to conversation history
   - Extract context variables
   ↓
3. Knowledge Graph Update (if enabled)
   - Store interaction
   - Update relationships
   ↓
4. Behavior Tree Execution (if configured)
   - Evaluate conditions
   - Select action path
   ↓
5. Tool Execution (if needed)
   - Validate permissions
   - Execute with params
   ↓
6. LLM Processing
   - Apply prompt templates
   - Generate response
   ↓
7. Response Formatting
   - Apply output schema
   - Include metadata
   ↓
8. State Persistence
   - Update variables
   - Compress history
   ↓
9. Return Response
```

## Integration Points

### ResourceManager Integration

- Obtains LLM clients
- Loads tool modules
- Accesses environment configuration
- No manual API key handling

### Actor Framework Integration

- Extends Actor base class
- Implements receive() method
- Supports actor composition
- Enables message passing

### Tool Registry Integration

- Dynamically loads tools
- Manages tool execution
- Handles tool permissions

### Knowledge Graph Integration

- Stores conversation entities
- Maintains relationships
- Enables pattern queries
- Supports persistence

### Behavior Tree Integration

- Executes complex workflows
- Manages conditional logic
- Coordinates tool usage

## Configuration Examples

### Simple Chat Agent

```json
{
  "agent": {
    "id": "simple-chat",
    "name": "Chat Assistant",
    "type": "conversational",
    "version": "1.0.0",
    "llm": {
      "provider": "anthropic",
      "model": "claude-3-5-sonnet-20241022",
      "systemPrompt": "You are a helpful assistant."
    }
  }
}
```

### Task Management Agent

```json
{
  "agent": {
    "id": "task-manager",
    "name": "Task Manager",
    "type": "task",
    "version": "1.0.0",
    "capabilities": [
      {
        "module": "file",
        "tools": ["file_read", "file_write"],
        "permissions": {
          "basePath": "/workspace/tasks"
        }
      }
    ],
    "knowledge": {
      "enabled": true,
      "schemas": [
        {
          "name": "Task",
          "properties": {
            "id": "string",
            "title": "string",
            "status": "string"
          }
        }
      ]
    }
  }
}
```

## Error Handling

### Initialization Errors

- Missing required configuration
- Module loading failures
- LLM client creation failures

### Runtime Errors

- Tool execution failures
- LLM API errors
- State corruption
- Knowledge graph conflicts

### Error Recovery

- Graceful degradation when optional components fail
- Fallback to direct message processing
- State rollback on critical errors

## Package Structure

```
packages/agents/configurable-agent/
├── package.json
├── README.md
├── docs/
│   └── DESIGN.md
├── src/
│   ├── index.js
│   ├── ConfigurableAgent.js
│   ├── state/
│   │   └── AgentState.js
│   ├── capabilities/
│   │   └── CapabilityManager.js
│   ├── prompts/
│   │   └── PromptManager.js
│   └── knowledge/
│       └── KnowledgeGraphInterface.js
└── examples/
    ├── simple-chat.json
    ├── task-manager.json
    └── analytical-agent.json
```

## Dependencies

```json
{
  "dependencies": {
    "@legion/actors": "workspace:*",
    "@legion/prompting": "workspace:*",
    "@legion/kg": "workspace:*",
    "@legion/actor-BT": "workspace:*",
    "@legion/resource-manager": "workspace:*",
    "@legion/llm": "workspace:*"
  }
}
```