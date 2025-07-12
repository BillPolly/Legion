# LLM CLI Framework Usage Guide

This guide covers everything you need to know to build powerful command-line interfaces with natural language understanding using the LLM CLI Framework.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Basic Concepts](#basic-concepts)
3. [Creating Your First CLI](#creating-your-first-cli)
4. [Command Design](#command-design)
5. [Working with Context](#working-with-context)
6. [Session Management](#session-management)
7. [Plugin Development](#plugin-development)
8. [Advanced Features](#advanced-features)
9. [Testing Your CLI](#testing-your-cli)
10. [Deployment](#deployment)

## Getting Started

### Installation

```bash
npm install llm-cli
# or
yarn add llm-cli
```

### Prerequisites

- Node.js 16.x or higher
- TypeScript 5.x or higher
- An LLM provider API key (OpenAI, Anthropic, etc.)

### Setting Up Your Project

```bash
mkdir my-cli
cd my-cli
npm init -y
npm install typescript llm-cli @types/node
npx tsc --init
```

## Basic Concepts

### The Framework Architecture

The LLM CLI Framework consists of several key components:

1. **LLMCLIFramework**: The main orchestrator
2. **Intent Recognition**: Converts natural language to structured commands
3. **Command Execution**: Runs your business logic
4. **Response Generation**: Creates user-friendly responses
5. **Session Management**: Maintains state between interactions
6. **Context Providers**: Supply relevant information to commands
7. **Plugins**: Extend functionality

### How It Works

```
User Input → Intent Recognition → Command Validation → Execution → Response
                     ↑                                      ↓
                  Context ← Session State ← State Updates ←
```

## Creating Your First CLI

### Simple Example: Todo CLI

```typescript
import { LLMCLIFramework } from 'llm-cli';
import { OpenAIProvider } from 'llm-cli/providers';

interface Todo {
  id: number;
  task: string;
  completed: boolean;
}

const framework = new LLMCLIFramework({
  llmProvider: new OpenAIProvider({ 
    apiKey: process.env.OPENAI_API_KEY! 
  }),
  commands: {
    add_todo: {
      description: 'Add a new todo item',
      parameters: [
        { name: 'task', type: 'string', required: true }
      ],
      handler: async ({ task }, session) => {
        const todos = session.state.get('todos') || [];
        const newTodo: Todo = {
          id: Date.now(),
          task: task as string,
          completed: false
        };
        todos.push(newTodo);
        session.state.set('todos', todos);
        
        return {
          success: true,
          output: `Added todo: "${task}"`
        };
      }
    },
    
    list_todos: {
      description: 'List all todos',
      handler: async (_, session) => {
        const todos = session.state.get('todos') || [];
        if (todos.length === 0) {
          return {
            success: true,
            output: 'No todos yet. Add one with "add todo <task>"'
          };
        }
        
        const list = todos.map((t: Todo, i: number) => 
          `${i + 1}. [${t.completed ? '✓' : ' '}] ${t.task}`
        ).join('\n');
        
        return {
          success: true,
          output: `Your todos:\n${list}`
        };
      }
    }
  }
});

// Use the CLI
async function main() {
  const response1 = await framework.processInput('add a todo to buy milk');
  console.log(response1.message);
  // Output: "Added todo: "buy milk""
  
  const response2 = await framework.processInput('show my todos');
  console.log(response2.message);
  // Output: "Your todos:\n1. [ ] buy milk"
}

main();
```

## Command Design

### Command Structure

Commands consist of:

1. **Description**: What the command does
2. **Parameters**: Expected inputs
3. **Handler**: The function that executes
4. **Requirements**: Optional prerequisites
5. **Examples**: Usage examples

### Parameter Types

```typescript
framework.registerCommand('search', {
  description: 'Search for items',
  parameters: [
    {
      name: 'query',
      type: 'string',
      required: true,
      description: 'Search query'
    },
    {
      name: 'limit',
      type: 'number',
      required: false,
      default: 10,
      description: 'Maximum results'
    },
    {
      name: 'category',
      type: 'string',
      required: false,
      enum: ['books', 'movies', 'music'],
      description: 'Filter by category'
    },
    {
      name: 'tags',
      type: 'array',
      items: { type: 'string' },
      required: false,
      description: 'Filter by tags'
    }
  ],
  handler: async (params) => {
    // Implementation
  }
});
```

### Validation

```typescript
parameters: [
  {
    name: 'email',
    type: 'string',
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    validationError: 'Please provide a valid email address'
  },
  {
    name: 'age',
    type: 'number',
    required: true,
    validator: (value) => value >= 18 && value <= 120,
    validationError: 'Age must be between 18 and 120'
  }
]
```

### Command Requirements

```typescript
framework.registerCommand('deploy', {
  description: 'Deploy the application',
  requirements: {
    requiredState: ['project', 'environment'],
    customChecker: async (session) => {
      const user = session.state.get('user');
      return user?.role === 'admin';
    },
    errorMessage: 'You must be an admin and have a project selected'
  },
  handler: async () => {
    // Deploy logic
  }
});
```

## Working with Context

### Built-in Context Providers

```typescript
import { StateContextProvider, HistoryContextProvider } from 'llm-cli';

// These are automatically included
// StateContextProvider: Provides current session state
// HistoryContextProvider: Provides command history
```

### Custom Context Providers

```typescript
import { ContextProvider, ContextData, SessionState } from 'llm-cli';

class ProjectContextProvider implements ContextProvider {
  name = 'project_context';
  description = 'Provides current project information';
  priority = 10;
  
  async getContext(session: SessionState): Promise<ContextData> {
    const projectId = session.state.get('currentProject');
    if (!projectId) {
      return {
        summary: 'No project selected',
        relevantCommands: ['select_project', 'create_project']
      };
    }
    
    const project = await loadProject(projectId);
    return {
      summary: `Working on: ${project.name} (${project.status})`,
      details: {
        projectId: project.id,
        name: project.name,
        status: project.status,
        tasksCount: project.tasks.length
      },
      relevantCommands: ['add_task', 'list_tasks', 'project_status']
    };
  }
  
  async isRelevant(session: SessionState, command?: string): Promise<boolean> {
    // Only include context for project-related commands
    const projectCommands = ['add_task', 'list_tasks', 'project_status'];
    return !command || projectCommands.includes(command);
  }
}

// Add to framework
framework.addContextProvider(new ProjectContextProvider());
```

## Session Management

### Accessing Session State

```typescript
handler: async (params, session) => {
  // Get value
  const currentUser = session.state.get('user');
  
  // Set value
  session.state.set('user', { id: 123, name: 'Alice' });
  
  // Delete value
  session.state.delete('tempData');
  
  // Check if exists
  if (session.state.has('project')) {
    // ...
  }
  
  // Clear all state
  session.state.clear();
}
```

### Session Persistence

```typescript
import { FilePersistence } from 'llm-cli';

const framework = new LLMCLIFramework({
  // ... other config
  sessionConfig: {
    persistenceAdapter: new FilePersistence('./sessions'),
    maxHistoryLength: 100,
    timeout: 3600000 // 1 hour
  }
});

// Save session
await framework.getSession().save();

// Load session
await framework.getSession().load('session-id');
```

### Session History

```typescript
handler: async (params, session) => {
  // Get recent history
  const recentCommands = session.history.slice(-5);
  
  // Find specific command
  const lastSearch = session.history
    .reverse()
    .find(h => h.intent.command === 'search');
  
  if (lastSearch) {
    const query = lastSearch.intent.parameters.query;
    // Use previous search query
  }
}
```

## Plugin Development

### Creating a Plugin

```typescript
import { Plugin, LLMCLIFramework } from 'llm-cli';

class TimerPlugin implements Plugin {
  name = 'timer';
  version = '1.0.0';
  
  private timers = new Map<string, NodeJS.Timeout>();
  
  async initialize(framework: LLMCLIFramework): Promise<void> {
    framework.registerCommand('set_timer', {
      description: 'Set a timer',
      parameters: [
        { name: 'name', type: 'string', required: true },
        { name: 'seconds', type: 'number', required: true }
      ],
      handler: async ({ name, seconds }) => {
        const timerId = setTimeout(() => {
          console.log(`⏰ Timer "${name}" finished!`);
          this.timers.delete(name as string);
        }, (seconds as number) * 1000);
        
        this.timers.set(name as string, timerId);
        
        return {
          success: true,
          output: `Timer "${name}" set for ${seconds} seconds`
        };
      }
    });
    
    framework.registerCommand('cancel_timer', {
      description: 'Cancel a timer',
      parameters: [
        { name: 'name', type: 'string', required: true }
      ],
      handler: async ({ name }) => {
        const timer = this.timers.get(name as string);
        if (!timer) {
          return {
            success: false,
            error: `No timer named "${name}" found`
          };
        }
        
        clearTimeout(timer);
        this.timers.delete(name as string);
        
        return {
          success: true,
          output: `Timer "${name}" cancelled`
        };
      }
    });
  }
  
  async cleanup(): Promise<void> {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}

// Load the plugin
await framework.loadPlugin(new TimerPlugin());
```

### Plugin Hooks

```typescript
class AnalyticsPlugin implements Plugin {
  name = 'analytics';
  
  async initialize(framework: LLMCLIFramework): Promise<void> {
    // Hook into command execution
    framework.getPluginManager().registerHook(
      'beforeCommand',
      async (commandName, params) => {
        console.log(`Executing: ${commandName}`);
        // Track command usage
      }
    );
    
    framework.getPluginManager().registerHook(
      'afterCommand',
      async (commandName, result) => {
        if (!result.success) {
          console.log(`Command failed: ${commandName}`);
          // Track errors
        }
      }
    );
  }
}
```

## Advanced Features

### Command Flows

```typescript
import { FlowBuilder } from 'llm-cli';

const deploymentFlow = new FlowBuilder()
  .addStep('validate_environment', {
    environment: '${input.env}'
  })
  .addStep('run_tests')
  .addConditionalStep(
    'backup_database',
    {},
    'environment === "production"'
  )
  .addStep('deploy_application', {
    version: '${input.version}',
    environment: '${input.env}'
  })
  .addStep('verify_deployment')
  .build();

// Execute flow
const result = await framework.executeFlow(deploymentFlow, {
  input: {
    env: 'production',
    version: '1.2.3'
  }
});
```

### Error Recovery

```typescript
import { ErrorAnalyzer, ErrorRecoveryManager } from 'llm-cli';

const errorAnalyzer = new ErrorAnalyzer();
const recoveryManager = new ErrorRecoveryManager();

// Add recovery strategies
recoveryManager.addStrategy({
  name: 'network_retry',
  canHandle: (error) => error.message.includes('ECONNREFUSED'),
  recover: async (error, context) => {
    // Wait and retry
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { retry: true };
  }
});

// Use in command
handler: async (params, session) => {
  try {
    const result = await riskyOperation();
    return { success: true, output: result };
  } catch (error) {
    const analysis = errorAnalyzer.analyze(error);
    const recovery = await recoveryManager.attemptRecovery(
      error,
      { command: 'risky_command', params }
    );
    
    if (recovery.success) {
      return recovery.result;
    }
    
    return {
      success: false,
      error: analysis.userFriendlyMessage,
      suggestions: analysis.suggestions
    };
  }
}
```

### Performance Optimization

```typescript
import { PromptCache, ResponseCache, PerformanceMonitor } from 'llm-cli';

// Enable caching
const promptCache = new PromptCache({ maxSize: 100, ttl: 3600000 });
const responseCache = new ResponseCache({ maxSize: 50, ttl: 1800000 });

// Monitor performance
const monitor = new PerformanceMonitor();

framework.updateConfig({
  performance: {
    promptCache,
    responseCache,
    monitor
  }
});

// Get metrics
const metrics = monitor.getMetrics();
console.log(`Average latency: ${metrics.operations.get('processInput')?.average}ms`);
```

## Testing Your CLI

### Unit Testing Commands

```typescript
import { MockLLMProvider } from 'llm-cli/providers';
import { SessionManager } from 'llm-cli';

describe('TodoCLI', () => {
  let framework: LLMCLIFramework;
  let mockProvider: MockLLMProvider;
  
  beforeEach(() => {
    mockProvider = new MockLLMProvider();
    framework = new LLMCLIFramework({
      llmProvider: mockProvider,
      commands: { /* your commands */ }
    });
  });
  
  it('should add a todo', async () => {
    // Set up mock response
    mockProvider.setStructuredResponse({
      command: 'add_todo',
      parameters: { task: 'Buy milk' },
      confidence: 0.95
    });
    
    const response = await framework.processInput('add todo buy milk');
    
    expect(response.success).toBe(true);
    expect(response.message).toContain('Added todo');
    
    const todos = framework.getSession().state.get('todos');
    expect(todos).toHaveLength(1);
    expect(todos[0].task).toBe('Buy milk');
  });
});
```

### Integration Testing

For integration testing, you can use the MockLLMProvider directly:

```typescript
import { MockLLMProvider } from 'llm-cli/providers';
import { LLMCLIFramework } from 'llm-cli';

describe('TodoCLI Integration', () => {
  const mockProvider = new MockLLMProvider();
  const framework = new LLMCLIFramework({
    llmProvider: mockProvider,
    commands: { /* your commands */ }
  });
  
  it('should handle a complete workflow', async () => {
    // Set up mock responses
    mockProvider.addResponse({
      input: /add todo/,
      output: { command: 'add_todo', args: { text: 'Write tests' } }
    });
    
    // Test the workflow
    const response = await framework.execute('add todo "Write tests"');
    expect(response.success).toBe(true);
  });
});
```

### Testing Context Providers

```typescript
describe('ProjectContextProvider', () => {
  it('should provide project context', async () => {
    const provider = new ProjectContextProvider();
    const session = new SessionManager().getState();
    
    // Set up state
    session.state.set('currentProject', 'proj-123');
    
    const context = await provider.getContext(session);
    
    expect(context.summary).toContain('Working on:');
    expect(context.details?.projectId).toBe('proj-123');
    expect(context.relevantCommands).toContain('add_task');
  });
});
```

## Deployment

### Building for Production

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Creating a CLI Binary

```typescript
// src/cli.ts
#!/usr/bin/env node

import { LLMCLIFramework } from 'llm-cli';
import { program } from 'commander';
import * as readline from 'readline';

const framework = new LLMCLIFramework({
  // Your configuration
});

program
  .version('1.0.0')
  .description('My CLI Tool');

program
  .command('interactive')
  .alias('i')
  .description('Start interactive mode')
  .action(async () => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> '
    });
    
    console.log('Welcome! Type "help" for available commands.');
    rl.prompt();
    
    rl.on('line', async (input) => {
      if (input.toLowerCase() === 'exit') {
        rl.close();
        process.exit(0);
      }
      
      const response = await framework.processInput(input);
      console.log(response.message);
      rl.prompt();
    });
  });

program
  .command('run <command>')
  .description('Run a single command')
  .action(async (command) => {
    const response = await framework.processInput(command);
    console.log(response.message);
    process.exit(response.success ? 0 : 1);
  });

program.parse(process.argv);
```

### Package.json Setup

```json
{
  "name": "my-cli",
  "version": "1.0.0",
  "description": "My LLM-powered CLI",
  "bin": {
    "my-cli": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "ts-node src/cli.ts",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "llm-cli": "^1.0.0",
    "commander": "^9.0.0"
  },
  "devDependencies": {
    "@types/node": "^18.0.0",
    "typescript": "^5.0.0",
    "ts-node": "^10.0.0"
  }
}
```

### Distribution

```bash
# Build the project
npm run build

# Test locally
npm link
my-cli interactive

# Publish to npm
npm publish

# Users can install globally
npm install -g my-cli
```

## Best Practices

1. **Command Naming**: Use clear, action-oriented names (e.g., `create_project`, not `project`)
2. **Parameter Design**: Make required parameters truly required, provide sensible defaults
3. **Error Handling**: Always return helpful error messages with suggestions
4. **Context Usage**: Only include relevant context to minimize token usage
5. **State Management**: Keep session state minimal and well-organized
6. **Testing**: Write tests for all commands and edge cases
7. **Documentation**: Include examples in command descriptions
8. **Performance**: Cache expensive operations and monitor latency

## Common Patterns

### Confirmations

```typescript
framework.registerCommand('delete_all', {
  description: 'Delete all items',
  handler: async (params, session) => {
    // Store pending action
    session.state.set('pendingAction', {
      action: 'delete_all',
      timestamp: Date.now()
    });
    
    return {
      success: true,
      output: 'Are you sure you want to delete all items? Type "confirm" to proceed.'
    };
  }
});

framework.registerCommand('confirm', {
  description: 'Confirm a pending action',
  handler: async (params, session) => {
    const pending = session.state.get('pendingAction');
    if (!pending) {
      return { success: false, error: 'No pending action to confirm' };
    }
    
    // Check if action is recent (within 1 minute)
    if (Date.now() - pending.timestamp > 60000) {
      session.state.delete('pendingAction');
      return { success: false, error: 'Confirmation expired' };
    }
    
    // Execute the pending action
    switch (pending.action) {
      case 'delete_all':
        session.state.clear();
        session.state.delete('pendingAction');
        return { success: true, output: 'All items deleted' };
      default:
        return { success: false, error: 'Unknown action' };
    }
  }
});
```

### Pagination

```typescript
framework.registerCommand('list_items', {
  description: 'List items with pagination',
  parameters: [
    { name: 'page', type: 'number', default: 1 }
  ],
  handler: async ({ page }, session) => {
    const items = session.state.get('items') || [];
    const pageSize = 10;
    const totalPages = Math.ceil(items.length / pageSize);
    const currentPage = Math.max(1, Math.min(page as number, totalPages));
    
    const start = (currentPage - 1) * pageSize;
    const pageItems = items.slice(start, start + pageSize);
    
    const output = [
      `Items (Page ${currentPage}/${totalPages}):`,
      ...pageItems.map((item, i) => `${start + i + 1}. ${item}`),
      '',
      currentPage < totalPages ? 'Type "next" for more' : '',
      currentPage > 1 ? 'Type "previous" to go back' : ''
    ].filter(Boolean).join('\n');
    
    // Store current page for next/previous commands
    session.state.set('currentPage', currentPage);
    
    return { success: true, output };
  }
});
```

### Search with History

```typescript
framework.registerCommand('search', {
  description: 'Search with history',
  parameters: [
    { name: 'query', type: 'string', required: true }
  ],
  handler: async ({ query }, session) => {
    // Add to search history
    const searchHistory = session.state.get('searchHistory') || [];
    searchHistory.push({ query, timestamp: Date.now() });
    
    // Keep only last 10 searches
    if (searchHistory.length > 10) {
      searchHistory.shift();
    }
    session.state.set('searchHistory', searchHistory);
    session.state.set('lastSearch', query);
    
    // Perform search
    const results = await performSearch(query as string);
    
    return {
      success: true,
      output: `Found ${results.length} results for "${query}"`
    };
  }
});

framework.registerCommand('repeat_search', {
  description: 'Repeat the last search',
  handler: async (params, session) => {
    const lastSearch = session.state.get('lastSearch');
    if (!lastSearch) {
      return { success: false, error: 'No previous search to repeat' };
    }
    
    // Delegate to search command
    return framework.getCommandInfo('search')!.handler(
      { query: lastSearch },
      session
    );
  }
});
```

## Troubleshooting

### Common Issues

1. **Intent Recognition Failures**
   - Ensure command descriptions are clear and distinct
   - Add examples to commands
   - Consider increasing the similarity threshold

2. **Parameter Extraction Issues**
   - Use structured parameter definitions
   - Provide parameter examples
   - Consider custom validators

3. **Context Overload**
   - Limit context providers to relevant information
   - Use the `isRelevant` method to filter context
   - Monitor token usage

4. **Performance Problems**
   - Enable caching for repeated operations
   - Use the performance monitor to identify bottlenecks
   - Consider batching operations

5. **State Persistence Issues**
   - Ensure state is serializable (no functions, classes)
   - Handle versioning for state migrations
   - Implement proper error handling for corrupted state

## Next Steps

1. Explore the [examples](../examples) directory for complete implementations
2. Read the [API documentation](api/README.md) for detailed reference
3. Check out the [migration guide](MIGRATION_GUIDE.md) if upgrading
4. Join our community for support and discussions

Happy building! 🚀