# 🧠 Recursive Planning Agent Framework

A modular, recursive agent framework for building intelligent systems that can plan, reason, delegate to tools or sub-agents, and report results.

## Quick Start

```bash
# Install dependencies
npm install

# Run tests
npm test

# Start development
npm run dev
```

## Project Structure

```
├── src/
│   ├── agents/          # Agent implementations
│   ├── tools/           # Atomic tool implementations
│   ├── planning/        # Planning strategies
│   ├── utils/           # Utility functions
│   └── types/           # TypeScript type definitions
├── tests/               # Test files
├── docs/                # Documentation
└── examples/            # Usage examples
```

## Architecture

The framework implements a recursive execution tree where each node is either:
- **Agent**: Autonomous, stateful entity that can plan and delegate
- **Tool**: Stateless, single-operation executable

See [Design Document](./docs/design.md) for comprehensive architecture details.

## Usage

### Quick Start

```javascript
import { createPlanningAgent, createTool } from './src/index.js';

// Create a simple tool
const greetTool = createTool(
  'greet',
  'Generate a greeting message',
  async (input) => {
    return { message: `Hello, ${input.name}!` };
  }
);

// Create an agent
const agent = createPlanningAgent({
  name: 'GreetingAgent',
  debugMode: true
});

// Run the agent
const result = await agent.run('Greet John', [greetTool]);
console.log(result.success); // true
```

### Advanced Usage

```javascript
import { 
  PlanningAgent,
  AgentConfig,
  TemplatePlanningStrategy,
  AtomicTool,
  PlanStep,
  IdGenerator
} from './src/index.js';

// Create tools
const analyzeTask = new AtomicTool(
  'analyze',
  'Analyze requirements',
  async (input) => ({ analysis: `Analyzed: ${input.task}` })
);

// Create planning templates
const templates = {
  'build application': [
    {
      id: IdGenerator.generateStepId('plan'),
      description: 'Plan the application architecture',
      tool: 'analyze',
      params: { task: '{{goal}}' },
      dependencies: []
    }
  ]
};

// Create agent with template planner
const planner = new TemplatePlanningStrategy(templates);
const config = new AgentConfig({
  name: 'BuilderAgent',
  description: 'Builds applications systematically'
});

const agent = new PlanningAgent(config, planner);

// Execute
const result = await agent.run('build application: Todo App', [analyzeTask]);
```

## Testing

Uses Jest with ES6 module support:

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

## Examples

Run the provided examples:

```bash
node examples/basic-usage.js
```

## Core Concepts

- **PlanningAgent**: Recursive agent that can plan, execute, and reflect
- **AtomicTool**: Stateless, single-operation executables
- **PlanningStrategy**: Strategies for generating execution plans
- **ArtifactStore**: Working memory for storing intermediate results
- **ErrorRecovery**: Automatic error handling and recovery

## License

MIT