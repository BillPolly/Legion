# @jsenvoy/agent

AI agent implementation with built-in retry logic, tool execution, and structured responses for jsEnvoy. Now includes integrated code generation capabilities through CodeAgent.

## Installation

```bash
npm install @jsenvoy/agent
```

## Usage

```javascript
const { Agent } = require('@jsenvoy/agent');

// Create an agent with built-in retry logic
const agent = new Agent({
  modelConfig: {
    provider: 'openai',
    model: 'gpt-4',
    apiKey: process.env.OPENAI_API_KEY
  },
  tools: [calculatorTool, fileReaderTool],
  maxRetries: 3,
  retryBackoff: 1000 // Optional: backoff multiplier for retries
});

// Execute a task
const result = await agent.execute(
  "Calculate the sum of numbers in data.txt"
);
console.log(result);
```

## Features

### Intelligent Tool Selection
- Automatically selects appropriate tools based on the task
- Chains multiple tools for complex operations
- Handles tool failures gracefully

### Code Generation Integration
- **NEW**: Full-stack application development with CodeAgent
- Generates complete web applications with frontend, backend, and tests
- Fixes code errors and improves existing code
- Supports multiple frameworks and technologies
- Includes documentation and deployment configurations

### Robust Retry Logic
- Built-in retry mechanism with exponential backoff
- Configurable retry strategies
- Error classification for smart retries
- Graceful error handling without process termination
- Detailed retry tracking and reporting

### Response Processing
- Robust JSON parsing and validation
- Automatic retry with intelligent error feedback
- Detailed retry tracking and error reporting


## API Reference

### Agent Class

```javascript
new Agent(config)
```

Config options:
- `modelConfig` - Model provider configuration
- `tools` - Array of available tools
- `systemPrompt` - Custom system prompt
- `maxRetries` - Maximum retry attempts (default: 3)
- `retryBackoff` - Backoff multiplier for retries (default: 1000ms)
- `timeout` - Execution timeout

Methods:
- `execute(task, context)` - Execute a task
- `executeWithTools(prompt, tools)` - Execute with specific tools
- `addTool(tool)` - Add a tool dynamically
- `removeTool(toolName)` - Remove a tool


### Response Format

Agent responses follow a standardized format handled by the RetryManager:

```javascript
{
  success: boolean,     // Whether the operation succeeded
  data: any,           // The parsed response data
  error: string|null,  // Error message if failed
  retries: number      // Number of retry attempts made
}
```

## Examples

### Basic Task Execution

```javascript
const { Agent } = require('@jsenvoy/agent');
const { calculatorTool } = require('@jsenvoy/tools');

const agent = new Agent({
  modelConfig: {
    provider: 'openai',
    model: 'gpt-3.5-turbo'
  },
  tools: [calculatorTool]
});

const result = await agent.execute("What is 15% of 200?");
console.log(result.data); // 30
```

### Code Generation with CodeAgent

```javascript
const agent = new Agent({
  modelConfig: { /* ... */ },
  tools: [/* tools loaded automatically including CodeAgent */]
});

// Generate a complete web application
const result = await agent.run(
  "Create a simple calculator web app with HTML, CSS, and JavaScript. Make it responsive and modern-looking."
);

// Fix existing code
const fixResult = await agent.run(
  "I have a JavaScript function that's not working. Fix this: function factorial(n) { if (n <= 1) return 1; return n * factorial(n - 1) }"
);
```

### Multi-Tool Task

```javascript
const agent = new Agent({
  modelConfig: { /* ... */ },
  tools: [fileReaderTool, calculatorTool, fileWriterTool]
});

const result = await agent.execute(
  "Read numbers from input.txt, calculate their average, and save to output.txt"
);
```

### Custom System Prompt

```javascript
const agent = new Agent({
  modelConfig: { /* ... */ },
  systemPrompt: "You are a helpful data analyst. Always explain your calculations.",
  tools: [/* ... */]
});
```

### Error Handling

```javascript
try {
  const result = await agent.execute("Complex task");
  if (!result.success) {
    console.error("Task failed:", result.error);
    console.log("Partial results:", result.data);
  }
} catch (error) {
  console.error("Agent error:", error);
}
```

### Streaming Responses

```javascript
const stream = await agent.executeStreaming("Generate a report");

for await (const chunk of stream) {
  process.stdout.write(chunk);
}
```

## Event System

The Agent package includes comprehensive event support for real-time monitoring of agent operations, module activities, and tool execution.

### Event Relay Architecture

The Agent acts as an event aggregator, collecting and relaying events from all registered modules and their tools:

```javascript
const agent = new Agent({
  name: 'MyAgent',
  modelConfig: { /* ... */ }
});

// Listen to all module events
agent.on('module-event', (event) => {
  console.log(`[${event.type}] ${event.module}: ${event.message}`);
});

// Register modules - their events will be automatically relayed
agent.registerModule(fileModule);
agent.registerModule(calculatorModule);
```

### Event Enrichment

Events from modules are automatically enriched with agent context:

```javascript
// Original module event
{
  type: 'progress',
  module: 'FileModule',
  message: 'Processing file',
  data: { file: 'data.txt' }
}

// Enriched agent event
{
  type: 'progress',
  module: 'FileModule',
  message: 'Processing file',
  data: { file: 'data.txt' },
  agentId: 'agent-123',
  agentName: 'MyAgent',
  timestamp: '2024-01-01T12:00:00.000Z'
}
```

### WebSocket Event Streaming

The Agent package includes a WebSocket server for real-time event streaming to clients:

```javascript
import { AgentWebSocketServer } from '@jsenvoy/agent/src/websocket-server.js';

// Create WebSocket server
const wsServer = new AgentWebSocketServer(agent, { port: 3001 });
await wsServer.start();

// Events are automatically broadcast to subscribed clients
```

### Client Subscription

Clients can subscribe to receive real-time events:

```javascript
// Client-side code
const ws = new WebSocket('ws://localhost:3001');

// Subscribe to events
ws.send(JSON.stringify({
  id: 'sub-1',
  type: 'subscribe-events'
}));

// Receive events
ws.on('message', (data) => {
  const message = JSON.parse(data);
  if (message.type === 'event') {
    const event = message.event;
    console.log(`[${event.type}] ${event.message}`);
  }
});
```

### Event Types and Examples

#### Progress Events
```javascript
// Module emits progress
module.emitProgress('Processing batch', { 
  current: 50, 
  total: 100,
  percentage: 50
});

// Client receives enriched event
{
  type: 'progress',
  module: 'DataProcessor',
  message: 'Processing batch',
  data: { current: 50, total: 100, percentage: 50 },
  agentId: 'agent-123',
  agentName: 'MyAgent',
  level: 'low'
}
```

#### Error Events
```javascript
// Tool emits error
tool.emitError('Failed to connect', { 
  code: 'ECONNREFUSED',
  host: 'api.example.com'
});

// Client receives enriched event
{
  type: 'error',
  module: 'APIModule',
  tool: 'HTTPClient',
  message: 'Failed to connect',
  data: { code: 'ECONNREFUSED', host: 'api.example.com' },
  agentId: 'agent-123',
  agentName: 'MyAgent',
  level: 'high'
}
```

### Complete Example with Events

```javascript
import { Agent } from '@jsenvoy/agent';
import { AgentWebSocketServer } from '@jsenvoy/agent/src/websocket-server.js';
import { FileModule } from '@jsenvoy/tools';

// Create agent
const agent = new Agent({
  name: 'FileProcessorAgent',
  modelConfig: {
    provider: 'openai',
    model: 'gpt-4',
    apiKey: process.env.OPENAI_API_KEY
  }
});

// Register event listeners
agent.on('module-event', (event) => {
  if (event.type === 'error') {
    console.error(`Error in ${event.module}: ${event.message}`);
  } else if (event.type === 'progress') {
    console.log(`Progress: ${event.message}`);
  }
});

// Register modules
agent.registerModule(new FileModule());

// Start WebSocket server for real-time streaming
const wsServer = new AgentWebSocketServer(agent, { port: 3001 });
await wsServer.start();

// Execute task - events will stream to console and WebSocket clients
const result = await agent.execute(
  "Process all CSV files in the data directory and generate a summary report"
);
```

### Event Filtering

You can filter events by type or module:

```javascript
// Listen to errors only
agent.on('module-event', (event) => {
  if (event.type === 'error') {
    alertAdmin(event);
  }
});

// Listen to specific module
agent.on('module-event', (event) => {
  if (event.module === 'DatabaseModule') {
    logDatabaseActivity(event);
  }
});

// WebSocket client filtering
ws.send(JSON.stringify({
  id: 'sub-2',
  type: 'subscribe-events',
  filter: {
    types: ['error', 'warning'],
    modules: ['DatabaseModule', 'APIModule']
  }
}));
```

### Performance Considerations

- Events are emitted asynchronously to avoid blocking execution
- WebSocket broadcasting is throttled for high-frequency events
- Client connections are managed with automatic cleanup
- Memory-efficient event buffering for disconnected clients

## CLI Usage

The agent package includes a CLI for interactive use:

```bash
# Interactive mode
node src/cli.js

# WebSocket server mode
node src/cli.js --server

# Custom port
node src/cli.js --server --port 8080
```

### Example Script

Run the included example script to see CodeAgent integration in action:

```bash
# Run predefined examples
node examples/chat-with-codeagent.js

# Interactive mode
node examples/chat-with-codeagent.js interactive
```

## Real LLM Integration Testing

To test with real LLM providers, set the environment variable:

```bash
export RUN_REAL_LLM_TESTS=true
export OPENAI_API_KEY=your-key-here
# or
export ANTHROPIC_API_KEY=your-key-here

npm test
```

The tests will verify that the LLM can intelligently recognize when to use code generation tools.

## Advanced Usage

### Custom Tool Integration

```javascript
const customTool = {
  name: 'custom_tool',
  description: 'My custom tool',
  execute: async (params) => {
    // Tool implementation
    return { result: 'success' };
  }
};

agent.addTool(customTool);
```

### Execution Context

```javascript
const context = {
  user: 'john_doe',
  session: 'abc123',
  preferences: {
    verbosity: 'high'
  }
};

const result = await agent.execute("Task description", context);
```

## License

MIT