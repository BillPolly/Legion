# Descent-Planner

Hierarchical task decomposition and planning system for complex goal achievement.

## Overview

The Descent-Planner enables AI agents to accomplish complex, multi-step goals through intelligent task decomposition and tool orchestration. It uses a two-step process:

1. **Recursive Decomposition**: Complex tasks are broken down into simple, atomic blocks
2. **Tool Discovery & Planning**: Simple tasks are matched with relevant tools and organized into behavior trees

## Documentation

- [Design Document](./docs/DESIGN.md) - Complete architecture and design specification
- [API Reference](./docs/API.md) - Public API documentation (coming soon)
- [Examples](./docs/examples/) - Usage examples and patterns (coming soon)

## Quick Start

```javascript
import { DescentPlanner } from '@legion/descent-planner';

// Initialize with dependencies
const planner = await DescentPlanner.create(resourceManager);

// Plan a complex task
const result = await planner.plan(
  "Build a task management web application",
  {
    domain: "web-development",
    maxDepth: 5
  }
);
```

## Key Features

- **Hierarchical Decomposition**: Recursively breaks down complex tasks
- **Semantic Tool Discovery**: Finds relevant tools using natural language
- **Context Management**: Maintains coherency across all hierarchy levels
- **Behavior Tree Generation**: Creates executable plans with validation
- **Domain Awareness**: Specialized handling for different domains

## License

MIT