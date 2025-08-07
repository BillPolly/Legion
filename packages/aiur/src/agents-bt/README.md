# BT-Based Agents for Aiur Server

Next-generation agents built on the Behavior Tree framework, providing configurable, composable, and extensible agent functionality alongside existing Aiur agents.

## Overview

This system provides BT-based alternatives to the current Aiur agents:

- **ChatBTAgent** - Replaces ChatAgent with configurable conversation workflows
- **TerminalBTAgent** - Replaces TerminalAgent with modular tool execution 
- **ArtifactBTAgent** - Replaces ArtifactAgent with reactive processing patterns

## Key Benefits

### 🧩 **Composability**
- Build complex agent behaviors from reusable BT node components
- Mix and match nodes to create custom agent types
- Share common patterns across different agents

### ⚙️ **Configurability** 
- Complete agent behavior defined in JSON configurations
- Runtime configuration changes without redeployment
- LLMs can generate and modify agent workflows

### 🔧 **Maintainability**
- Replace monolithic 1400-line agents with modular <200-line nodes
- Each node has single responsibility and clear testing boundaries
- Easier debugging through workflow visualization

### 🚀 **Extensibility**
- Add new capabilities by creating new node types
- Extend existing agents without modifying core code
- Plugin architecture for domain-specific behaviors

### 💪 **Robustness**
- Built-in retry, fallback, and error handling patterns
- Circuit breakers for failing dependencies
- Graceful degradation under adverse conditions

## Architecture

### Core Components

```
agents-bt/
├── core/                    # Core infrastructure
│   ├── BTAgentBase.js      # Base class for all BT agents
│   ├── AgentNodeRegistry.js # Registry for BT nodes
│   └── AgentConfigurator.js # Configuration management
├── agents/                  # BT-based agents
│   ├── ChatBTAgent.js      # Next-gen chat agent
│   ├── TerminalBTAgent.js  # Next-gen terminal agent
│   └── ArtifactBTAgent.js  # Next-gen artifact agent
├── nodes/                   # Specialized BT nodes
│   ├── MessageHandlerNode.js
│   ├── LLMInteractionNode.js
│   ├── ToolExecutionNode.js
│   └── ...
├── configs/                 # JSON workflow definitions
│   ├── chat-agent.json
│   ├── terminal-agent.json
│   └── artifact-agent.json
└── index.js                # Main exports
```

### BT Node Types

**Core Nodes:**
- `MessageHandlerNode` - Route messages to appropriate workflows
- `SessionManagerNode` - Handle session lifecycle
- `ErrorHandlerNode` - Centralized error handling with retry patterns
- `ResponseSenderNode` - Send responses back to remote actors

**Chat Nodes:**
- `LLMInteractionNode` - Handle LLM calls with streaming and tool execution
- `ConversationManagerNode` - Manage conversation history
- `VoiceIntegrationNode` - Handle speech-to-text/text-to-speech

**Tool Nodes:**
- `ToolExecutionNode` - Execute tools with parameter validation
- `ArtifactProcessingNode` - Process and store artifacts from tool results

## Usage

### Basic Agent Creation

```javascript
import { createChatBTAgent, createAgentSet } from './agents-bt/index.js';

// Create individual agent
const chatAgent = await createChatBTAgent({
  sessionId: 'session-123',
  sessionManager: sessionManager,
  moduleLoader: moduleLoader,
  resourceManager: resourceManager
});

// Create complete agent set
const agents = await createAgentSet({
  agentType: 'bt', // or 'classic' for existing agents
  sessionId: 'session-123',
  sessionManager: sessionManager,
  moduleLoader: moduleLoader,
  resourceManager: resourceManager
});
```

### Configuration-Driven Workflows

```json
{
  "type": "message_router",
  "routes": {
    "chat_message": {
      "type": "sequence",
      "children": [
        {
          "type": "conversation_manager",
          "action": "add_user_message"
        },
        {
          "type": "llm_interaction",
          "streaming": true,
          "tools": true
        },
        {
          "type": "response_sender",
          "responseType": "chat_response"
        }
      ]
    }
  }
}
```

### Integration with ServerActorSpace

```javascript
// In ServerActorSpace.js
const agentType = config.agentType || 'classic';

if (agentType === 'bt') {
  // Use BT-based agents
  const agents = await createAgentSet({
    agentType: 'bt',
    sessionId: clientId,
    sessionManager: this.sessionManager,
    moduleLoader: this.moduleLoader,
    resourceManager: this.resourceManager
  });
  
  this.chatAgent = agents.chatAgent;
  this.terminalAgent = agents.terminalAgent;
  this.artifactAgent = agents.artifactAgent;
} else {
  // Use existing agents (default)
  // ... existing agent creation code
}
```

## Configuration Examples

### Chat Agent Workflow

The chat agent supports complex workflow patterns:

```json
{
  "routes": {
    "chat_message": {
      "type": "selector",
      "children": [
        {
          "type": "sequence",
          "name": "complex_task_handling",
          "condition": "requiresComplexHandling(message.content)",
          "children": [
            {"type": "tool_execution", "tool": "handle_complex_task"},
            {"type": "response_sender", "content": "Task delegated"}
          ]
        },
        {
          "type": "sequence", 
          "name": "standard_llm_interaction",
          "children": [
            {"type": "llm_interaction", "streaming": true},
            {"type": "conversation_manager", "action": "add_assistant_message"},
            {"type": "response_sender", "responseType": "chat_response"}
          ]
        }
      ]
    }
  }
}
```

### Terminal Agent Tool Execution

```json
{
  "routes": {
    "tool_request": {
      "type": "sequence",
      "children": [
        {
          "type": "tool_execution",
          "tool": "{{message.tool}}",
          "parameters": "{{message.arguments}}",
          "allowParameterResolution": true
        },
        {
          "type": "response_sender",
          "responseType": "tool_response"
        }
      ]
    }
  }
}
```

### Artifact Agent Reactive Processing

```json
{
  "routes": {
    "artifact_created": {
      "type": "sequence",
      "children": [
        {
          "type": "artifact_storage",
          "action": "store_multiple",
          "artifacts": "{{message.artifacts}}"
        },
        {
          "type": "artifact_sync",
          "action": "notify_frontend",
          "eventType": "artifact_created"
        }
      ]
    }
  }
}
```

## Development

### Creating Custom Nodes

```javascript
import { BehaviorTreeNode, NodeStatus } from '../../../shared/actor-BT/src/core/BehaviorTreeNode.js';

export class CustomNode extends BehaviorTreeNode {
  static getTypeName() {
    return 'custom_node';
  }

  async executeNode(context) {
    // Your custom logic here
    return {
      status: NodeStatus.SUCCESS,
      data: { result: 'Custom processing complete' }
    };
  }
}
```

### Testing Agent Configurations

```javascript
import { testAgentConfig } from './agents-bt/index.js';

const result = await testAgentConfig('chat', 'custom-chat-config.json');

if (result.valid) {
  console.log('Configuration is valid');
} else {
  console.log('Configuration errors:', result.errors);
}
```

## Migration Strategy

1. **Phase 1**: Deploy BT agents alongside existing agents
2. **Phase 2**: Add configuration option to choose agent implementation  
3. **Phase 3**: Test BT agents in development/staging environments
4. **Phase 4**: Gradually migrate production workloads to BT agents
5. **Phase 5**: Deprecate original agents once BT agents are proven

## Status

✅ **Core Infrastructure** - Complete  
✅ **ChatBTAgent** - Complete with LLM interaction, tool calling, voice  
✅ **TerminalBTAgent** - Complete with tool execution, module management  
✅ **ArtifactBTAgent** - Complete with reactive processing  
✅ **JSON Configurations** - Complete workflow definitions  
✅ **Integration Points** - Ready for ServerActorSpace integration  

**Next Steps:**
- Integration testing with existing Aiur infrastructure
- Performance benchmarking vs existing agents  
- Documentation and migration guides
- Advanced coordination patterns (parallel, circuit breaker)