# @legion/decent-planner

Hierarchical task decomposition and planning system for AI agents. Enables complex goal achievement through recursive decomposition into simple, executable tasks.

**Now refactored following Uncle Bob's Clean Code and Clean Architecture principles.**

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

### Using the Refactored Clean Architecture Version (Recommended)

```javascript
import { DecentPlannerRefactored } from '@legion/decent-planner';

// Create planner with configuration
const planner = new DecentPlannerRefactored({
  maxDepth: 5,
  confidenceThreshold: 0.7,
  enableFormalPlanning: true,
  logLevel: 'info'
});

// Initialize (creates dependencies)
await planner.initialize();

// Plan a complex task
const result = await planner.plan(
  "Build a task management web application",
  { domain: "web-development" }
);

if (result.success) {
  console.log('Plan:', result.data);
  console.log('Statistics:', result.data.statistics);
  
  // Generate human-readable report
  const report = planner.generateReport(result.data);
  console.log(report);
}
```

### Using the Legacy Version (for backward compatibility)

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

The package follows **Clean Architecture** with clear separation of concerns across four layers:

### 1. Domain Layer (`src/domain/`)
Pure business logic with no external dependencies:
- **Entities**: `Task`, `Plan` - Core business models
- **Value Objects**: `TaskComplexity`, `TaskStatus`, `PlanStatus` - Immutable domain values
- **Domain Services**: `TaskHierarchyService` - Pure domain operations
- **Domain Errors**: Specific error types for domain violations

### 2. Application Layer (`src/application/`)
Application-specific business rules:
- **Use Cases**: 
  - `CreatePlanUseCase` - Creates new planning sessions
  - `DecomposeTaskUseCase` - Handles task decomposition
  - `DiscoverToolsUseCase` - Manages tool discovery
  - `GenerateBehaviorTreeUseCase` - Creates behavior trees
  - `ValidatePlanUseCase` - Validates plans
- **Ports**: Interface definitions for external dependencies
- **Application Errors**: Use case and service errors

### 3. Infrastructure Layer (`src/infrastructure/`)
External interface implementations:
- **Adapters**:
  - `LLMComplexityClassifier` - LLM-based classification
  - `LLMTaskDecomposer` - LLM-based decomposition
  - `RegistryToolDiscoveryService` - Tool discovery via registry
  - `ConsoleLogger` - Logging implementation
  - `InMemoryPlanRepository` - Plan storage
  - `InMemoryTaskRepository` - Task storage
- **Infrastructure Errors**: Adapter and external service errors

### 4. Configuration Layer (`src/config/`)
- **PlannerConfiguration**: Centralized configuration management

### Legacy Components (for backward compatibility)
- **DecentPlanner**: Original implementation (use `DecentPlannerRefactored` for new projects)
- **InformalPlanner**: Legacy informal planning orchestrator

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

### DecentPlannerRefactored (Clean Architecture)

```javascript
// Create instance with configuration
const planner = new DecentPlannerRefactored({
  // Decomposition settings
  maxDepth: 5,              // Maximum recursion depth
  minSubtasks: 2,           // Minimum subtasks for COMPLEX
  maxSubtasks: 10,          // Maximum subtasks for COMPLEX
  
  // Tool discovery settings
  confidenceThreshold: 0.7,  // Minimum tool confidence
  maxToolsPerTask: 10,      // Max tools per SIMPLE task
  
  // Formal planning settings
  enableFormalPlanning: true,     // Generate behavior trees
  validateBehaviorTrees: true,    // Validate generated trees
  
  // Logging settings
  logLevel: 'info',         // debug|info|warn|error
  
  // Performance settings
  timeout: 300000,          // Operation timeout (5 min)
  parallelExecution: true   // Enable parallel processing
});

// Initialize dependencies
await planner.initialize();

// Plan a task
const result = await planner.plan(goal, context, progressCallback);

// Cancel operation
planner.cancel();
```

**Context Options:**
- `domain`: Task domain (e.g., 'web-development', 'data-analysis')
- `inputs`: Expected inputs for the task
- `outputs`: Expected outputs from the task

### DecentPlanner (Legacy)

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

# Run integration tests (requires real LLM)
npm test -- __tests__/integration/

# Run example
node examples/basic-usage.js

# Build
npm run build
```

## Testing Philosophy

Following TDD principles:
- **No mocks in integration tests** - Use real LLM and tool registry
- **Domain tests** - Pure unit tests with no external dependencies
- **Use case tests** - Test with real adapters
- **End-to-end tests** - Complete workflows with real components

## Clean Architecture Benefits

1. **Testability**: Domain logic testable without external dependencies
2. **Maintainability**: Clear separation of concerns
3. **Flexibility**: Easy to swap implementations (e.g., different LLM providers)
4. **Scalability**: Clear boundaries enable team separation
5. **Framework Agnostic**: Domain logic independent of frameworks

## Dependencies

- `@legion/planner`: Behavior tree generation
- `@legion/bt-validator`: Plan validation
- `@legion/tools-registry`: Semantic tool search
- `@legion/resource-manager`: Singleton resource management
- `@legion/ai-agent-core`: LLM integration (via ResourceManager)

## Migration Guide

To migrate from legacy to Clean Architecture version:

```javascript
// Old
import { DecentPlanner } from '@legion/decent-planner';
const planner = new DecentPlanner(llmClient);

// New
import { DecentPlannerRefactored } from '@legion/decent-planner';
const planner = new DecentPlannerRefactored();
await planner.initialize();
```

The API is largely compatible, making migration straightforward.

## Documentation

- [Clean Architecture Documentation](./CLEAN_ARCHITECTURE.md) - Detailed architecture guide
- [Design Document](./docs/DESIGN.md) - System design and concepts
- [API Documentation](./docs/API.md) - Complete API reference

## License

MIT