# @legion/decent-planner

Hierarchical task decomposition and planning system for AI agents. Enables complex goal achievement through recursive decomposition into simple, executable tasks.

## Overview

The Decent-Planner implements a two-phase planning approach:

1. **Informal Planning Phase**: 
   - Recursively decomposes COMPLEX tasks into SIMPLE ones
   - Discovers appropriate tools for each SIMPLE task via semantic search
   - Validates structure, dependencies, completeness, and feasibility
   - Generates comprehensive hierarchy with tool annotations

2. **Formal Planning Phase** (Integration Ready):
   - Synthesizes behavior trees from validated task hierarchy
   - Uses @legion/planner for BT generation
   - Validates with @legion/bt-validator
   - Bottom-up composition of validated subtrees

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

const llmClient = /* your LLM client */;

// Create planner (ToolRegistry singleton is used internally)
const planner = new DecentPlanner(llmClient, {
  maxDepth: 5,
  confidenceThreshold: 0.7
});

// Plan a complex task
const result = await planner.plan(
  "Build a task management web application",
  { domain: "web-development" }
);

if (result.success) {
  console.log('Hierarchy:', result.phases.informal.hierarchy);
  console.log('Statistics:', result.phases.informal.statistics);
  console.log('Validation:', result.phases.informal.validation);
  
  // Generate human-readable report
  const report = planner.generateReport(result);
  console.log(report);
}
```

## Architecture

### Components

#### Core Orchestrators
1. **DecentPlanner**: Main orchestrator for both planning phases
2. **InformalPlanner**: Orchestrates the informal planning phase

#### Informal Planning Components
3. **ComplexityClassifier**: Classifies tasks as SIMPLE or COMPLEX using LLM
4. **TaskDecomposer**: Recursively decomposes COMPLEX tasks with I/O hints
5. **ToolFeasibilityChecker**: Discovers tools via semantic search on ToolRegistry
6. **DecompositionValidator**: Validates structure, dependencies, completeness, and feasibility

#### Data Structures
7. **TaskNode**: Represents individual tasks with complexity, tools, and I/O hints
8. **TaskHierarchy**: Tree structure with traversal and statistics methods

#### Supporting Infrastructure
9. **PromptManager** (@legion/prompt-manager): Template-based prompt management with markdown files

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
  goal: string,
  phases: {
    informal: {
      hierarchy: TaskNode,           // Decomposed task tree
      validation: {                  // Comprehensive validation
        valid: boolean,
        structure: ValidationResult,
        dependencies: ValidationResult,
        completeness: ValidationResult,
        feasibility: FeasibilityResult
      },
      statistics: {
        totalTasks: number,
        simpleTasks: number,
        complexTasks: number,
        feasibleTasks: number,
        maxDepth: number,
        uniqueToolsCount: number
      },
      metadata: {
        timestamp: string,
        processingTime: number,
        plannerVersion: string
      }
    },
    formal: {                        // When enabled
      behaviorTrees: Array,
      validation: ValidationResult,
      status: string
    }
  },
  processingTime: number,
  summary: Object
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

Uses `@legion/tools-registry` for tool discovery:

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
- `@legion/tools-registry`: Semantic tool search
- `@legion/ai-agent-core`: LLM integration

## License

MIT