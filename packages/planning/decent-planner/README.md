# @legion/decent-planner

Hierarchical task decomposition and planning system for AI agents. Enables complex goal achievement through recursive decomposition into simple, executable tasks.

## Overview

The Decent-Planner uses a two-step process with bottom-up synthesis:

1. **Recursive Decomposition** (Top-Down): Breaks down complex tasks into subtasks, classifying each as SIMPLE or COMPLEX
2. **Bottom-Up Synthesis & Validation**: 
   - Plans and validates simple leaf tasks first
   - Composes validated subtrees into parent behavior trees
   - Each validated subtree becomes an atomic unit at higher levels
   - Validation propagates up, ensuring correctness at every level

## Key Features

- 🎯 **Intelligent Decomposition**: LLM-powered task breakdown with complexity classification
- 🔍 **Semantic Tool Discovery**: Finds relevant tools using ONNX embeddings
- 🌳 **Bottom-Up Synthesis**: Builds and validates behavior trees from leaves to root
- ✅ **Hierarchical Validation**: Each subtree is independently validated and composable
- 📊 **Context Management**: Tracks informal I/O hints that guide decomposition and planning
- 🔄 **Smart Composition**: Automatically determines sequence vs parallel execution based on dependencies
- ⚡ **Integration Ready**: Works with existing Legion planner and validator

## Installation

```bash
npm install @legion/decent-planner
```

## Quick Start

```javascript
import { DecentPlanner } from '@legion/decent-planner';
import { ResourceManager } from '@legion/tools';

// Initialize ResourceManager with dependencies
const resourceManager = new ResourceManager();
await resourceManager.initialize();

// Create planner
const planner = await DecentPlanner.create(resourceManager);

// Plan a complex task
const result = await planner.plan(
  "Build a task management web application",
  {
    domain: "web-development",
    maxDepth: 5,
    debug: true
  }
);

if (result.success) {
  console.log('Hierarchy:', result.data.hierarchy);
  console.log('Behavior Trees:', result.data.behaviorTrees);
  console.log('Execution Plan:', result.data.executionPlan);
}
```

## Architecture

### Components

1. **DecentPlanner**: Main orchestrator
2. **TaskDecomposer**: LLM-based decomposition with classification
3. **PlanSynthesizer**: Bottom-up behavior tree synthesis and validation
4. **ValidatedSubtree**: Encapsulates validated components with I/O contracts
5. **ContextHints**: Manages informal I/O suggestions
6. **ToolDiscoveryBridge**: Interfaces with semantic tool search

### Task Classification

**SIMPLE Tasks:**
- Can be accomplished with focused tools (1-10)
- Clear, plannable structure
- May include sequences, loops, conditions, retries
- Self-contained logic

**COMPLEX Tasks:**
- Require multiple subsystems
- Cross-domain coordination
- Architectural decisions needed
- Further decomposition required

### Context Flow

The system uses a two-layer context approach:

1. **Informal Hints** (Decomposition)
   - Natural language I/O suggestions
   - Guide further breakdown
   - Show task dependencies

2. **Formal Artifacts** (Planner)
   - Rigorous variable management
   - Validated dependencies
   - Execution context

## API Reference

### DecentPlanner

```javascript
// Create instance
const planner = await DecentPlanner.create(resourceManager);

// Plan a task
const result = await planner.plan(goal, options);
```

**Options:**
- `domain`: Task domain (e.g., 'web-development', 'data-analysis')
- `maxDepth`: Maximum decomposition depth (default: 5)
- `maxWidth`: Maximum subtasks per level (default: 10)
- `debug`: Enable debug logging

**Result Structure:**
```javascript
{
  success: boolean,
  data: {
    hierarchy: TaskNode,        // Decomposed task tree
    behaviorTrees: Object,      // BT for each simple task
    artifacts: Object,          // Expected I/O artifacts
    executionPlan: Array,       // Ordered task sequence
    statistics: {
      totalTasks: number,
      decompositionLevels: number,
      totalNodes: number
    }
  },
  error: string | null
}
```

## Examples

### Web Application

```javascript
const result = await planner.plan(
  "Create a REST API with authentication",
  { domain: "web-development" }
);

// Result includes:
// - Database setup tasks
// - API endpoint creation
// - Authentication implementation
// - Each with specific tools and behavior trees
```

### Data Pipeline

```javascript
const result = await planner.plan(
  "Analyze CSV data and create visualizations",
  { domain: "data-analysis" }
);

// Result includes:
// - Data loading tasks
// - Cleaning and transformation
// - Analysis and visualization
// - Each broken down to executable steps
```

## Integration

### With Legion Planner

The decent-planner wraps the existing planner at each level:

```javascript
// Internally uses:
const plan = await planner.makePlan(
  requirements,
  discoveredTools,
  context
);
```

### With Semantic Search

Uses `@legion/tools` for tool discovery:

```javascript
// Internally uses:
const tools = await semanticSearch.searchTools(
  taskDescription,
  { limit: 10, threshold: 0.3 }
);
```

## Development

```bash
# Run tests
npm test

# Run example
node examples/basic-usage.js

# Build
npm run build
```

## Dependencies

- `@legion/planner`: Behavior tree generation
- `@legion/bt-validator`: Plan validation
- `@legion/tools`: Semantic tool search
- `@legion/ai-agent-core`: LLM integration

## License

MIT