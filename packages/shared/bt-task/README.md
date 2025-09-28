# @legion/bt-task

Behavior Trees as Task Strategies - A unified execution model that treats behavior tree nodes as specialized task strategies.

## Overview

The `bt-task` package unifies Behavior Trees (BT) with the Legion task system by recognizing that behavior trees are simply a specific type of task where the strategy defines node control patterns. This eliminates the artificial separation between tasks and behavior trees, creating a more cohesive execution model.

## Installation

```bash
npm install @legion/bt-task
```

## Core Concepts

### BTs as Task Strategies

Every behavior tree node is a task with a specific strategy:
- **Sequence nodes** are tasks with a `SequenceStrategy` that executes children in order
- **Selector nodes** are tasks with a `SelectorStrategy` that tries alternatives  
- **Action nodes** are tasks with an `ActionStrategy` that executes tools
- **Condition nodes** are tasks with a `ConditionStrategy` that evaluates conditions
- **Retry nodes** are tasks with a `RetryStrategy` that retries failed children

## Quick Start

```javascript
import { BTExecutor } from '@legion/bt-task';

// Get toolRegistry from ResourceManager
const resourceManager = await ResourceManager.getInstance();
const toolRegistry = resourceManager.get('toolRegistry');

// Create executor
const executor = new BTExecutor(toolRegistry);

// Define tree configuration
const treeConfig = {
  type: 'sequence',
  name: 'Build Project',
  children: [
    {
      type: 'action',
      tool: 'npm_install',
      params: { directory: '.' }
    },
    {
      type: 'action',
      tool: 'npm_build',
      params: { directory: '.' },
      outputVariable: 'buildResult'
    },
    {
      type: 'condition',
      condition: '@buildResult.success',
      children: [
        {
          type: 'action',
          tool: 'npm_test',
          params: { directory: '.' }
        }
      ]
    }
  ]
};

// Execute tree
const result = await executor.executeTree(treeConfig, {
  artifacts: {},
  workspaceDir: process.cwd()
});

console.log('Execution result:', result.status);
```

## Loading from JSON

```javascript
import { BTLoader } from '@legion/bt-task';

const loader = new BTLoader(toolRegistry);

// Load from file
await loader.loadFile('./behavior-tree.json');

// Or load from JSON string
loader.loadJSON(jsonString);

// Execute loaded tree
const result = await loader.execute({ artifacts: {} });
```

## Using as a Tool

The BTTool allows behavior trees to be exposed as tools themselves:

```javascript
import { BTTool } from '@legion/bt-task';

const btTool = new BTTool(toolRegistry);

// Execute behavior tree through tool interface
const result = await btTool.execute({
  treeConfig: {
    type: 'sequence',
    children: [/* ... */]
  },
  context: { artifacts: {} }
});
```

## Node Types

### Sequence
Executes children in order. Fails if any child fails.

```javascript
{
  type: 'sequence',
  children: [/* ... */]
}
```

### Selector
Tries children until one succeeds. Fails only if all children fail.

```javascript
{
  type: 'selector',
  children: [/* ... */]
}
```

### Action
Executes a tool from the ToolRegistry.

```javascript
{
  type: 'action',
  tool: 'tool_name',
  params: { /* tool parameters */ },
  outputVariable: 'resultName'  // Optional: store result
}
```

### Condition
Executes children only if condition is true.

```javascript
{
  type: 'condition',
  condition: '@artifact.value === true',
  children: [/* ... */]
}
```

### Retry
Retries failed children up to maxAttempts.

```javascript
{
  type: 'retry',
  maxAttempts: 3,
  delay: 1000,  // Optional: delay between retries
  children: [/* ... */]
}
```

## Artifact Management

The `@` syntax references artifacts in parameters:

```javascript
{
  type: 'sequence',
  children: [
    {
      type: 'action',
      tool: 'read_file',
      params: { path: 'config.json' },
      outputVariable: 'config'
    },
    {
      type: 'action',
      tool: 'process_data',
      params: { 
        data: '@config.content',  // Reference artifact
        setting: '@config.settings.value'
      }
    }
  ]
}
```

## API Reference

### BTExecutor
- `executeTree(config, context)`: Execute a behavior tree
- `registerStrategy(type, strategy)`: Register custom node strategy

### BTLoader
- `loadConfig(config)`: Load configuration object
- `loadJSON(jsonString)`: Load from JSON string
- `loadFile(filePath)`: Load from file
- `execute(context)`: Execute loaded tree

### BTTool
- `execute(params)`: Execute tree as tool
- `getMetadata()`: Get tool metadata

## Status Mapping

| Task Status | BT Status | Description |
|-------------|-----------|-------------|
| pending | PENDING | Not yet started |
| in-progress | RUNNING | Currently executing |
| completed | SUCCESS | Completed successfully |
| failed | FAILURE | Failed with error |

## Testing

The package includes comprehensive tests:

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- __tests__/unit
npm test -- __tests__/integration
```

## Implementation Status

✅ **Phase 1**: Core Infrastructure - BTTaskStrategy base and factory pattern
✅ **Phase 2**: Basic Node Types - Sequence and Action strategies
✅ **Phase 3**: Control Flow Nodes - Selector and Condition strategies  
✅ **Phase 4**: Advanced Features - Retry strategy and BTExecutor
✅ **Phase 5**: Integration - BTLoader, BTTool, and E2E tests

**Total Tests**: 177 passing

## Architecture

The package follows pure prototypal inheritance patterns:
- No ES6 classes, only prototypes using `Object.create()`
- Fire-and-forget async messaging with `defer()`
- Strategies define node behavior entirely
- Full integration with task system capabilities

## License

MIT