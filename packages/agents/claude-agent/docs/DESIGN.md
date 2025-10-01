# Claude Agent Integration - Design Document

## Executive Summary

This package (`@legion/claude-agent`) integrates Anthropic's Claude Agent SDK with Legion's task-based agent framework, providing production-grade AI agent capabilities while maintaining Legion's architectural principles.

## Goals

1. **Seamless Integration**: Claude SDK agents work as TaskStrategies within Legion's existing architecture
2. **Tool Interoperability**: Legion tools automatically available to Claude agents
3. **Context Synchronization**: Bidirectional context flow between Legion and Claude SDK
4. **Production Ready**: Leverage Claude SDK's battle-tested infrastructure (context management, error handling, caching)
5. **No Breaking Changes**: Existing Legion agents and patterns remain unchanged

## Non-Goals

- Replace Legion's task/strategy system
- Reimplement Claude SDK functionality
- Create backward compatibility layers (single way of doing things)
- Support non-Claude LLM providers (use existing Legion llm-client for that)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Legion Task                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              ClaudeAgentStrategy                           │  │
│  │  (extends TaskStrategy)                                    │  │
│  │                                                            │  │
│  │  ┌─────────────────┐  ┌──────────────────┐               │  │
│  │  │ ClaudeToolBridge│  │ClaudeContextAdapter│              │  │
│  │  └─────────────────┘  └──────────────────┘               │  │
│  │           │                     │                          │  │
│  │           └─────────┬───────────┘                          │  │
│  │                     │                                      │  │
│  │           ┌─────────▼──────────┐                          │  │
│  │           │ Claude Agent SDK   │                          │  │
│  │           │  (TypeScript npm)  │                          │  │
│  │           └────────────────────┘                          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────┐  ┌─────────────┐  ┌──────────────┐              │
│  │Artifacts │  │Conversation │  │ExecutionContext│             │
│  └──────────┘  └─────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────┘
         │                                │
         │  Legion Message Passing        │  ResourceManager
         │  (Fire-and-Forget Actor Model) │  (Singleton)
         │                                │
```

## Core Components

### 1. ClaudeAgentStrategy

**Purpose**: TaskStrategy implementation that wraps Claude Agent SDK

**Responsibilities**:
- Implements `onMessage()` for Legion's actor model message passing
- Manages Claude SDK lifecycle (initialization, cleanup)
- Orchestrates tool bridge and context adapter
- Handles error recovery with FAIL FAST principle

**Key Design Decisions**:
- **Inherits from TaskStrategy**: Pure prototypal inheritance, no classes
- **Fire-and-Forget Messages**: Uses `send()` not async returns
- **No State Duplication**: Single source of truth in Legion Task
- **API Key from ResourceManager**: `await ResourceManager.getInstance()` then `get('env.ANTHROPIC_API_KEY')`

**Interface**:
```javascript
const strategy = Object.create(ClaudeAgentStrategy);
strategy.initialize(context); // Gets ResourceManager, toolRegistry
strategy.onMessage(task, senderTask, message); // Actor message handler
```

### 2. ClaudeToolBridge

**Purpose**: Bidirectional translation between Legion tools and Claude SDK tools

**Responsibilities**:
- Convert Legion tool definitions to Claude input_schema format
- Execute Legion tools when Claude requests them
- Format tool results for Claude consumption
- Handle tool errors gracefully

**Key Design Decisions**:
- **No Tool Duplication**: Uses Legion's ToolRegistry as source of truth
- **Schema Translation**: Converts Legion JSON Schema to Claude format
- **Synchronous Tool Lookup**: Async only for execution
- **Result Formatting**: Handles both success and error cases

**Interface**:
```javascript
const bridge = new ClaudeToolBridge(toolRegistry);
const claudeTools = bridge.legionToolsToClaudeTools(['tool1', 'tool2']);
const result = await bridge.executeLegionTool('toolName', inputs);
```

### 3. ClaudeContextAdapter

**Purpose**: Synchronize context between Legion Tasks and Claude SDK

**Responsibilities**:
- Convert Legion conversation history to Claude messages format
- Extract system prompts from Legion tasks
- Format Legion artifacts for Claude context
- Store Claude responses back in Legion task conversation

**Key Design Decisions**:
- **Read-Only from Claude SDK Perspective**: Claude SDK doesn't modify Legion state directly
- **Conversation Translation**: Maps Legion roles (system/user/assistant/tool) to Claude format
- **Artifact Context Injection**: Adds artifacts to system prompt, not messages
- **No Persistent Storage**: Uses Legion Task as the source of truth

**Interface**:
```javascript
const adapter = new ClaudeContextAdapter(legionContext);
const messages = adapter.legionConversationToClaudeMessages(task.conversation);
const systemPrompt = adapter.extractSystemPrompt(task);
adapter.storeClaudeResponseInTask(task, claudeResponse);
```

## Integration with Legion Architecture

### ResourceManager Integration

```javascript
// Strategy initialization
async initialize(context) {
  // Get singleton ResourceManager (auto-initializes)
  const resourceManager = await ResourceManager.getInstance();

  // Get API key from environment
  const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not found in ResourceManager');
  }

  // Initialize Claude SDK client
  this.claudeClient = new ClaudeSDK({ apiKey });
}
```

### Task/Strategy Integration

```javascript
// Creating a Claude-powered task
import { createTask } from '@legion/tasks';
import { ClaudeAgentStrategy } from '@legion/claude-agent';

const task = createTask(
  'Analyze code for security issues',
  null, // no parent
  ClaudeAgentStrategy,
  {
    systemPrompt: 'You are a security expert...',
    tools: ['file_read', 'grep_search']
  }
);

// Start task with message
task.send(task, { type: 'start' });
```

### Tool Registry Integration

```javascript
// Tools automatically available to Claude
const toolRegistry = await resourceManager.get('toolRegistry');

// ClaudeToolBridge converts them
const bridge = new ClaudeToolBridge(toolRegistry);
const claudeTools = bridge.legionToolsToClaudeTools();

// Claude SDK receives tools in its format
const response = await claudeClient.query({
  messages: [{ role: 'user', content: 'List files in /src' }],
  tools: claudeTools
});
```

## Message Passing Flow

### 1. Task Receives Start Message

```javascript
onMessage(task, senderTask, message) {
  if (message.type === 'start') {
    // 1. Convert task context to Claude request
    const claudeRequest = this.contextAdapter.enhanceClaudeRequest(task, {
      model: 'claude-sonnet-4.5-20250929',
      max_tokens: 4096
    });

    // 2. Add tools
    claudeRequest.tools = this.toolBridge.legionToolsToClaudeTools();

    // 3. Query Claude SDK
    this._queryClaudeAsync(task, claudeRequest);
  }
}
```

### 2. Claude Requests Tool Execution

```javascript
async _handleToolUse(task, toolUse) {
  // Execute Legion tool
  const result = await this.toolBridge.executeLegionTool(
    toolUse.name,
    toolUse.input
  );

  // Store result in task
  task.addToolResult(toolUse.name, toolUse.input, result);

  // Send result back to Claude
  const followUp = await this.claudeClient.continueWithToolResult(result);

  // Process Claude's response
  this._processClaudeResponse(task, followUp);
}
```

### 3. Task Completion

```javascript
_processClaudeResponse(task, claudeResponse) {
  // Store response in task
  this.contextAdapter.storeClaudeResponseInTask(task, claudeResponse);

  // Check for completion
  if (claudeResponse.stop_reason === 'end_turn') {
    task.complete({
      content: claudeResponse.content,
      usage: claudeResponse.usage
    });
  }

  // Or handle more tool uses
  if (claudeResponse.tool_uses) {
    for (const toolUse of claudeResponse.tool_uses) {
      await this._handleToolUse(task, toolUse);
    }
  }
}
```

## Configuration

### Required Environment Variables

```bash
# In .env at monorepo root
ANTHROPIC_API_KEY=sk-ant-...
```

### Strategy Configuration

```javascript
{
  model: 'claude-sonnet-4.5-20250929',  // Claude model to use
  max_tokens: 4096,                      // Max response tokens
  temperature: 0.7,                      // Sampling temperature
  tools: ['tool1', 'tool2'],             // Optional: specific tools
  systemPrompt: '...',                   // Optional: override system prompt
  maxRetries: 3,                         // Error retry count
  timeout: 30000                         // Request timeout ms
}
```

## Error Handling

### FAIL FAST Principle

No fallbacks, no mocks in implementation:

```javascript
// ❌ WRONG - has fallback
const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY') || 'fake-key';

// ✅ CORRECT - fail fast
const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
if (!apiKey) {
  throw new Error('ANTHROPIC_API_KEY required');
}
```

### Error Propagation

```javascript
try {
  const response = await this.claudeClient.query(request);
  return response;
} catch (error) {
  // Let task handle failure
  task.fail(error);
  throw error; // Re-throw, don't swallow
}
```

## Testing Strategy

### Unit Tests

- **ClaudeToolBridge**: Tool conversion and execution (mocked tool registry)
- **ClaudeContextAdapter**: Message format conversion (pure functions)
- **ClaudeAgentStrategy**: Message handling logic (mocked Claude SDK)

### Integration Tests

- **Real Claude API**: Actual calls to Claude SDK with live API key
- **Tool Execution**: End-to-end tool use with real Legion tools
- **Task Lifecycle**: Complete task execution from start to completion
- **ResourceManager**: Real singleton instance with .env loading

**No Mocks in Integration Tests**: All resources must be available, tests FAIL if not.

## Usage Examples

### Simple Query Agent

```javascript
import { createTask } from '@legion/tasks';
import { ClaudeAgentStrategy } from '@legion/claude-agent';
import { ResourceManager } from '@legion/resource-manager';

// Get resource manager
const rm = await ResourceManager.getInstance();

const task = createTask(
  'Explain how async/await works in JavaScript',
  null,
  ClaudeAgentStrategy,
  {
    model: 'claude-sonnet-4.5-20250929',
    max_tokens: 1024
  }
);

// Start task
task.send(task, { type: 'start' });

// Wait for completion (in real usage, use callbacks/events)
```

### Tool-Using Agent

```javascript
const task = createTask(
  'Analyze the codebase and find potential security issues',
  null,
  ClaudeAgentStrategy,
  {
    tools: ['file_read', 'grep_search', 'directory_list'],
    systemPrompt: 'You are a security auditor. Look for common vulnerabilities.'
  }
);

task.send(task, { type: 'start' });
```

### Multi-Task Workflow

```javascript
// Parent task
const parentTask = createTask('Build a feature', null, ClaudeAgentStrategy, {});

// Child tasks
const designTask = createTask('Design API', parentTask, ClaudeAgentStrategy, {});
const implementTask = createTask('Implement', parentTask, ClaudeAgentStrategy, {});

// Start workflow
parentTask.send(designTask, { type: 'start' });
// When design completes, start implementation
designTask.on('complete', () => {
  parentTask.send(implementTask, { type: 'start' });
});
```

## Dependencies

```json
{
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.1.0",
    "@legion/resource-manager": "*",
    "@legion/tasks": "*",
    "@legion/tools-registry": "*",
    "@legion/schema": "*"
  }
}
```

## Future Enhancements (Out of Scope for MVP)

- Streaming responses
- Multi-agent coordination via Claude SDK
- Custom MCP server integration
- Prompt caching optimization
- Token usage tracking and limits

## Open Questions for Review

1. **Claude SDK API Surface**: The actual `@anthropic-ai/claude-agent-sdk` package API is not fully documented yet. This design assumes it provides:
   - `ClaudeSDK` class with `query()` method
   - Tool definition format matching Anthropic API
   - Response format with `content`, `tool_uses`, `stop_reason`

2. **Message Handling**: Should `onMessage()` be fully synchronous (just queue work) or can it be async?

3. **Tool Permissions**: Should we expose Claude SDK's permission system through Legion's tool registry?

4. **Context Limit Handling**: How should we handle when context exceeds limits? Let Claude SDK's automatic compaction handle it, or give Legion control?

5. **Multi-Turn Conversations**: How to best represent multi-turn Claude conversations in Legion's task conversation array?

Please review and provide feedback on:
- Architecture decisions
- Integration points
- Error handling approach
- Any missing considerations
