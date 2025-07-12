# LLM CLI Framework

A powerful TypeScript framework for building command-line interfaces with natural language understanding. Transform any CLI tool into an AI-powered assistant that understands conversational commands.

## Features

- 🤖 **Natural Language Understanding**: Convert user intent to structured commands
- 🔌 **Pluggable Architecture**: Extend with custom commands, context providers, and plugins
- 📝 **Session Management**: Maintain state across interactions with built-in persistence
- 🎯 **Intent Recognition**: Smart command matching with ambiguity resolution
- 🔄 **Context Awareness**: Commands can access session history and custom context
- ⚡ **Performance Optimized**: Built-in caching for prompts and responses
- 🛠️ **Developer Friendly**: Full TypeScript support with comprehensive types
- 🧪 **Well Tested**: Extensive test coverage with TDD approach

## Quick Start

### Installation

```bash
npm install @jsenvoy/llm-cli
# or
yarn add @jsenvoy/llm-cli
```

### Basic Usage

```typescript
import { LLMCLIFramework } from 'llm-cli';
import { OpenAIProvider } from 'llm-cli/providers';

// Create a simple calculator CLI
const framework = new LLMCLIFramework({
  llmProvider: new OpenAIProvider({ apiKey: 'your-key' }),
  commands: {
    add: {
      description: 'Add two numbers',
      parameters: [
        { name: 'a', type: 'number', required: true },
        { name: 'b', type: 'number', required: true }
      ],
      handler: async ({ a, b }) => ({
        success: true,
        output: `${a} + ${b} = ${a + b}`
      })
    }
  }
});

// Process natural language input
const response = await framework.processInput('add 5 and 3');
console.log(response.message); // "5 + 3 = 8"
```

## Architecture Overview

The framework follows a modular architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────┐
│                   User Input (Natural Language)         │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                  LLMCLIFramework                        │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │   Intent    │  │   Command    │  │   Response    │ │
│  │ Recognition │─▶│  Execution   │─▶│  Generation   │ │
│  └─────────────┘  └──────────────┘  └───────────────┘ │
│         ▲                 ▲                  ▲         │
│         │                 │                  │         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │   Context   │  │   Session    │  │    Prompt     │ │
│  │  Providers  │  │ Management   │  │   Building    │ │
│  └─────────────┘  └──────────────┘  └───────────────┘ │
│         ▲                 ▲                  ▲         │
│         │                 │                  │         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │   Plugins   │  │ Performance  │  │     LLM       │ │
│  │   System    │  │  Monitoring  │  │   Provider    │ │
│  └─────────────┘  └──────────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Core Concepts

### Default Chat Command

The framework automatically provides a built-in chat command that handles general conversational interactions. This ensures your CLI always has something meaningful to say, even when no specific command matches:

```typescript
// The chat command is automatically available
const framework = new LLMCLIFramework({
  llmProvider,
  commands: {} // Even with no custom commands, chat is available
});

// Users can naturally interact with your CLI
await framework.processInput("Hello, what can you do?");
// The default chat will respond conversationally

// You can disable the default chat if needed
const frameworkNoChat = new LLMCLIFramework({
  llmProvider,
  commands: {},
  disableDefaultChat: true // No default chat command
});

// Or override it with your own implementation
framework.registerCommand('chat', {
  description: 'Custom chat handler',
  handler: async ({ message }) => ({
    success: true,
    output: `Custom response to: ${message}`
  })
});
```

The default chat command:
- Automatically includes conversation history for context
- Serves as a fallback when intent recognition has low confidence
- Can be disabled or overridden as needed
- Provides a natural conversational interface out of the box

### Commands

Commands are the actions your CLI can perform:

```typescript
framework.registerCommand('search', {
  description: 'Search for documents',
  parameters: [
    { name: 'query', type: 'string', required: true },
    { name: 'limit', type: 'number', default: 10 }
  ],
  handler: async ({ query, limit }, session) => {
    const results = await searchDatabase(query, limit);
    return {
      success: true,
      output: `Found ${results.length} results for "${query}"`
    };
  }
});
```

### Context Providers

Context providers give commands access to relevant information:

```typescript
class UserContextProvider implements ContextProvider {
  name = 'user_context';
  
  async getContext(session: SessionState): Promise<ContextData> {
    const user = session.state.get('currentUser');
    return {
      summary: user ? `Logged in as ${user.name}` : 'Not logged in',
      details: { userId: user?.id }
    };
  }
}

framework.addContextProvider(new UserContextProvider());
```

### Session Management

Sessions maintain state between interactions:

```typescript
// Access session state
const session = framework.getSession();
session.state.set('currentProject', projectId);

// Export/import sessions
const sessionData = framework.exportSession();
framework.importSession(sessionData);
```

### Plugins

Extend the framework with plugins:

```typescript
class AutoCompletePlugin implements Plugin {
  name = 'autocomplete';
  
  async initialize(framework: LLMCLIFramework): Promise<void> {
    framework.registerCommand('complete', {
      description: 'Auto-complete the current input',
      handler: async (params, session) => {
        // Implementation
      }
    });
  }
}

await framework.loadPlugin(new AutoCompletePlugin());
```

## Advanced Features

### Intent Recognition with Ambiguity Handling

The framework handles ambiguous commands intelligently:

```typescript
// User input: "show me the stats"
// Framework might ask: "Did you mean 'show statistics' or 'show status'?"

framework.updateConfig({
  ambiguityHandling: {
    enabled: true,
    askForClarification: true,
    similarityThreshold: 0.7
  }
});
```

### Performance Optimization

Built-in caching and monitoring:

```typescript
const performanceMonitor = framework.getPerformanceMonitor();

// Get metrics
const metrics = performanceMonitor.getMetrics();
console.log(`Average latency: ${metrics.averageLatency}ms`);

// Enable response caching
framework.updateConfig({
  performance: {
    enablePromptCache: true,
    enableResponseCache: true,
    cacheMaxSize: 1000,
    cacheTTL: 3600000 // 1 hour
  }
});
```

### Command Flows

Chain commands together for complex workflows:

```typescript
const flow = new FlowBuilder()
  .addStep('authenticate', { username: '${input.username}' })
  .addConditionalStep('loadProject', 
    { projectId: '${context.lastProject}' },
    'authenticated === true'
  )
  .addStep('showDashboard')
  .build();

await framework.executeFlow(flow);
```

### Error Recovery

Intelligent error handling with recovery suggestions:

```typescript
framework.updateConfig({
  errorRecovery: {
    enabled: true,
    maxRetries: 2,
    suggestAlternatives: true,
    learnFromErrors: true
  }
});
```

## Examples

### Calculator CLI

```typescript
// See examples/calculator for a complete implementation
const calc = new CalculatorCLI({ llmProvider });

await calc.process("What's 15% of 200?");
// Output: "15% of 200 = 30"

await calc.process("Convert 100 fahrenheit to celsius");
// Output: "100°F = 37.78°C"
```

### Project Manager CLI

```typescript
// See examples/project-manager for a complete implementation
const pm = new ProjectManagerCLI({ llmProvider });

await pm.process("Create a new project called Website Redesign");
await pm.process("Add task 'Design homepage'");
await pm.process("Assign it to Alice");
await pm.process("Show project status");
```

### Semantic Search CLI

```typescript
// See examples/semantic-search for a complete implementation
const search = new SemanticSearchCLI({ 
  llmProvider,
  searchService 
});

await search.process("Find documents about machine learning");
await search.process("Show me the second result in detail");
```

## API Reference

### LLMCLIFramework

The main framework class:

- `constructor(config: LLMCLIConfig)`
- `processInput(input: string): Promise<GeneratedResponse>`
- `registerCommand(name: string, command: CommandDefinition): void`
- `unregisterCommand(name: string): void`
- `getSession(): SessionState`
- `addContextProvider(provider: ContextProvider): void`
- `loadPlugin(plugin: Plugin): Promise<void>`

### Types

```typescript
interface CommandResult {
  success: boolean;
  output?: string;
  error?: string;
  data?: any;
  suggestions?: string[];
}

interface Intent {
  command: string;
  parameters: Record<string, any>;
  confidence: number;
  rawQuery: string;
}

interface ContextData {
  summary: string;
  details?: Record<string, any>;
  relevantCommands?: string[];
}
```

## Testing

The framework includes comprehensive testing utilities:

```typescript
import { MockLLMProvider } from 'llm-cli/providers';

const mockProvider = new MockLLMProvider();
mockProvider.addResponse('search query', 'Search results...');

const framework = new LLMCLIFramework({
  llmProvider: mockProvider,
  commands: { /* ... */ }
});

// Test your CLI
const response = await framework.processInput('search for tests');
expect(response.success).toBe(true);
```

## Best Practices

1. **Command Design**: Keep commands focused and single-purpose
2. **Parameter Validation**: Always validate parameters in handlers
3. **Error Messages**: Provide helpful, actionable error messages
4. **Context Usage**: Only include relevant context to minimize token usage
5. **Testing**: Write tests for all commands and edge cases
6. **Documentation**: Document commands with examples and use cases

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Installation

```bash
npm install @jsenvoy/llm-cli
# or
yarn add @jsenvoy/llm-cli
# or
pnpm add @jsenvoy/llm-cli
```

## Support

- 📖 [Usage Guide](docs/USAGE_GUIDE.md) - Complete guide to building CLIs
- 📖 [API Documentation](docs/api/README.md) - Detailed API reference
- 📖 [Best Practices](docs/BEST_PRACTICES.md) - Recommended patterns and practices
- 📖 [Migration Guide](docs/MIGRATION_GUIDE.md) - Upgrade instructions
- 📖 [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues and solutions
- 🐛 [Issue Tracker](https://github.com/llm-cli/llm-cli/issues)
- 💬 [Discussions](https://github.com/llm-cli/llm-cli/discussions)
- 📧 [Email Support](mailto:team@llm-cli.dev)