# @legion/claude-agent

Claude SDK integration for the Legion agent framework. Provides a TaskStrategy implementation that wraps Anthropic's Claude SDK with Legion's actor model.

## Installation

```bash
npm install @legion/claude-agent
```

## Prerequisites

- ANTHROPIC_API_KEY in `.env` file (at monorepo root)
- Legion ResourceManager configured
- Legion ToolRegistry (optional, for tool use)

## Usage

```javascript
import { ClaudeAgentStrategy } from '@legion/claude-agent';
import ResourceManager from '@legion/resource-manager';

// Get ResourceManager singleton
const resourceManager = await ResourceManager.getInstance();

// Create ExecutionContext
const context = {
  toolRegistry: myToolRegistry,  // Legion ToolRegistry instance
  resourceManager: resourceManager
};

// Create and initialize strategy
const strategy = Object.create(ClaudeAgentStrategy);
await strategy.initialize(context);

// Create a task
const task = {
  id: 'my-task',
  description: 'Answer a question',
  conversation: [
    { role: 'user', content: 'What is 2 + 2?' }
  ],
  context: {
    systemPrompt: 'You are a helpful assistant.',
    model: 'claude-3-5-sonnet-20241022',  // Optional
    max_tokens: 1024  // Optional
  },
  addResponse: function(content, source) { /* ... */ },
  addConversationEntry: function(role, content, metadata) { /* ... */ },
  getAllArtifacts: () => ({}),
  complete: function() { /* ... */ }
};

// Send message to trigger Claude query
await strategy.onMessage(task, null, { type: 'start' });
```

## Architecture

### Components

- **ClaudeAgentStrategy**: TaskStrategy implementation with actor model message passing
- **ClaudeToolBridge**: Bidirectional tool translation (Legion ↔ Claude)
- **ClaudeContextAdapter**: Context synchronization (Legion Task ↔ Claude SDK)

### Key Features

- **Fire-and-Forget Messages**: Actor model with `send()`, no async returns
- **FAIL FAST**: No fallbacks - raises errors immediately
- **Single Source of Truth**: Legion Task owns state, not Claude SDK
- **ResourceManager**: All config from ResourceManager singleton
- **Tool Integration**: Automatic tool translation and execution

## Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm test __tests__/unit

# Run integration tests (requires ANTHROPIC_API_KEY)
npm test __tests__/integration
```

**Test Coverage**: 90 tests (71 unit + 19 integration)
- NO MOCKS in integration tests
- Real Claude API calls
- Real ToolRegistry integration

## Design Documentation

See [`docs/DESIGN.md`](./docs/DESIGN.md) for complete architecture and design decisions.

See [`docs/IMPLEMENTATION-PLAN.md`](./docs/IMPLEMENTATION-PLAN.md) for TDD implementation details.

## License

ISC
