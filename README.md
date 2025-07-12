# @jsenvoy/agent

AI agent implementation with built-in retry logic, tool execution, and structured responses for jsEnvoy.

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