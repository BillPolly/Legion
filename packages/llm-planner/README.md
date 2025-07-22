# @jsenvoy/llm-planner

LLM-based planning component for intelligent task decomposition and structured plan generation.

## Overview

The LLM Planner provides an intelligent planning system that uses Large Language Models to understand natural language requirements and generate structured, actionable plans. Initially focused on code generation tasks, it's designed to be extensible for various planning domains.

## Features

- 🧠 **Natural Language Understanding**: Leverages LLMs to understand complex requirements
- 📋 **Structured Plans**: Generates hierarchical, dependency-aware execution plans
- 🔄 **Plan Refinement**: Iteratively improves plans based on validation and feedback
- 🎯 **Domain-Specific Planners**: Specialized planners for different tasks (coding, testing, etc.)
- 🔌 **Extensible Architecture**: Easy to add new planner types and domains
- ✅ **Plan Validation**: Ensures generated plans are complete and actionable

## Installation

```bash
npm install @jsenvoy/llm-planner
```

## Quick Start

```javascript
import { CodePlanner } from '@jsenvoy/llm-planner';

// Initialize the planner with LLM configuration
const planner = new CodePlanner({
  llmConfig: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4'
  }
});

// Generate a plan from requirements
const plan = await planner.createPlan({
  task: 'Create a todo list application',
  requirements: {
    frontend: 'React with TypeScript',
    backend: 'Node.js REST API',
    features: ['CRUD operations', 'user authentication', 'data persistence']
  }
});

// Execute the plan
const executor = new PlanExecutor();
const result = await executor.execute(plan);
```

## Core Concepts

### Planners

Planners are responsible for taking natural language requirements and generating structured plans:

- **BasePlanner**: Abstract base class for all planners
- **CodePlanner**: Specialized for software development tasks
- **TestPlanner**: Generates test plans for applications
- **ArchitecturePlanner**: Creates system architecture plans

### Plans

Plans are structured representations of tasks with:

- Hierarchical steps with clear dependencies
- Resource requirements for each step
- Success criteria and validation rules
- Rollback strategies for error recovery

### Plan Execution

The plan executor manages the execution lifecycle:

- Tracks progress through plan steps
- Handles dependencies between steps
- Provides rollback on failures
- Emits events for monitoring

## API Reference

See the [full API documentation](./docs/API.md) for detailed usage information.

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run linter
npm run lint
```

## Contributing

Contributions are welcome! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

MIT