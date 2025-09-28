# BT-Task Design Document

## Overview

The `bt-task` package unifies Behavior Trees (BT) with the Legion task system by recognizing that behavior trees are simply a specific type of task where the strategy defines node control patterns. This design eliminates the artificial separation between tasks and behavior trees, creating a more cohesive execution model.

## Core Concept: BTs as Task Strategies

### Fundamental Insight

Every behavior tree node is a task with a specific strategy:
- **Sequence nodes** are tasks with a `SequenceStrategy` that executes children in order
- **Selector nodes** are tasks with a `SelectorStrategy` that tries alternatives
- **Action nodes** are tasks with an `ActionStrategy` that executes tools
- **Condition nodes** are tasks with a `ConditionStrategy` that evaluates conditions

This unification means:
1. BT nodes inherit all task capabilities (artifacts, conversation tracking, message passing)
2. BT execution uses the same infrastructure as regular tasks
3. BT trees are just hierarchical task structures with specific strategies

## Architecture

### Inheritance Hierarchy

```
TaskStrategy (from @legion/tasks)
    └── BTTaskStrategy (base for all BT nodes)
        ├── SequenceStrategy
        ├── SelectorStrategy
        ├── ActionStrategy
        ├── ConditionStrategy
        └── RetryStrategy
```

### Core Components

#### BTTaskStrategy

Base prototype for all behavior tree node strategies. Extends `TaskStrategy` with BT-specific behavior:

```javascript
const BTTaskStrategy = Object.create(TaskStrategy);

BTTaskStrategy.onMessage = function(senderTask, message) {
  // Route messages based on BT semantics
  if (message.type === 'execute') {
    this.executeBTNode(senderTask, message);
  } else if (message.type === 'child-result') {
    this.handleChildResult(senderTask, message);
  }
  // Delegate to parent implementation for other messages
  TaskStrategy.onMessage.call(this, senderTask, message);
};

BTTaskStrategy.executeBTNode = function(senderTask, message) {
  // BT node execution logic
  this.start();
  this.executeChildren(message.context);
};

BTTaskStrategy.getNodeStatus = function() {
  // Map task status to BT status
  switch(this.status) {
    case 'completed': return 'SUCCESS';
    case 'failed': return 'FAILURE';
    case 'in-progress': return 'RUNNING';
    default: return 'PENDING';
  }
};
```

#### Node Strategies

Each BT node type is implemented as a task strategy:

**SequenceStrategy**
```javascript
const SequenceStrategy = Object.create(BTTaskStrategy);

SequenceStrategy.executeChildren = function(context) {
  // Execute children sequentially
  this.currentChildIndex = 0;
  this.executeNextChild(context);
};

SequenceStrategy.handleChildResult = function(childTask, message) {
  if (message.status === 'FAILURE') {
    // Fail immediately on child failure
    this.complete({ status: 'FAILURE', failedAt: this.currentChildIndex });
  } else if (message.status === 'SUCCESS') {
    // Continue to next child or complete
    this.currentChildIndex++;
    if (this.currentChildIndex < this.children.length) {
      this.executeNextChild(message.context);
    } else {
      this.complete({ status: 'SUCCESS' });
    }
  }
};
```

**ActionStrategy**
```javascript
const ActionStrategy = Object.create(BTTaskStrategy);

ActionStrategy.executeBTNode = function(senderTask, message) {
  const toolRegistry = this.lookup('toolRegistry');
  const tool = toolRegistry.getTool(this.config.tool);
  
  // Resolve parameters with @ syntax for artifacts
  const params = this.resolveParameters(this.config.params, message.context);
  
  // Execute tool
  tool.execute(params).then(result => {
    if (result.success) {
      // Store result in artifacts if configured
      if (this.config.outputVariable) {
        this.storeArtifact(this.config.outputVariable, result.data);
      }
      this.complete({ status: 'SUCCESS', data: result.data });
    } else {
      this.complete({ status: 'FAILURE', error: result.error });
    }
  });
};
```

### BTExecutor

Manages execution of behavior tree tasks:

```javascript
const BTExecutor = {
  async executeTree(treeConfig, context) {
    // Create root task from tree configuration
    const rootTask = createBTTask(
      treeConfig.name || 'BehaviorTree',
      null,  // no parent
      this.getStrategyForType(treeConfig.type),
      { ...context, treeConfig }
    );
    
    // Initialize children recursively
    this.initializeChildren(rootTask, treeConfig.children);
    
    // Start execution
    rootTask.send(rootTask, { type: 'execute', context });
    
    // Wait for completion
    return this.waitForCompletion(rootTask);
  },
  
  initializeChildren(parentTask, childConfigs) {
    for (const childConfig of childConfigs || []) {
      const childTask = createBTTask(
        childConfig.name || childConfig.type,
        parentTask,
        this.getStrategyForType(childConfig.type),
        childConfig
      );
      
      // Bind tool if action node
      if (childConfig.type === 'action' && childConfig.tool) {
        childTask.toolInstance = this.toolRegistry.getTool(childConfig.tool);
      }
      
      // Recursively initialize children
      this.initializeChildren(childTask, childConfig.children);
    }
  }
};
```

### Factory Pattern

```javascript
export function createBTTask(description, parent, strategyPrototype, config = {}) {
  // Create task with BT strategy as prototype
  const btTask = createTask(description, parent, strategyPrototype, {
    ...config,
    nodeType: config.type,
    nodeId: config.id || generateId()
  });
  
  // Add BT-specific configuration
  btTask.config = config;
  
  return btTask;
}
```

## Configuration Format

BT configurations work identically to actor-BT but are executed as tasks:

```javascript
{
  "type": "sequence",
  "id": "main-sequence",
  "name": "Build and Test",
  "children": [
    {
      "type": "action",
      "id": "create-dir",
      "tool": "directory_create",
      "params": {
        "path": "./output"
      }
    },
    {
      "type": "action", 
      "id": "generate-code",
      "tool": "code_generator",
      "params": {
        "template": "@codeTemplate",  // Reference from artifacts
        "outputFile": "./output/generated.js"
      },
      "outputVariable": "generatedCode"
    },
    {
      "type": "condition",
      "id": "check-success",
      "condition": "@generatedCode.success === true",
      "children": [
        {
          "type": "action",
          "tool": "test_runner",
          "params": {
            "file": "./output/generated.js"
          }
        }
      ]
    }
  ]
}
```

## Message Flow

### Execution Flow

1. **Initiation**: Root task receives `execute` message
2. **Strategy Routing**: BTTaskStrategy routes to appropriate handler
3. **Child Execution**: Parent sends `execute` to children
4. **Result Propagation**: Children send `child-result` to parent
5. **Completion**: Root task completes with final status

### Message Types

- `execute`: Start node execution
- `child-result`: Child reports completion to parent
- `abort`: Cancel execution
- `pause`/`resume`: Control execution flow

## Artifact and Context Management

### Artifact Flow

BT tasks use standard task artifact management:
- Action nodes store tool results as artifacts
- `@variable` syntax references artifacts in parameters
- Artifacts flow through task hierarchy automatically

### Context Propagation

```javascript
// Context flows through the task tree
const context = {
  workspaceDir: '/project',
  artifacts: {
    config: { ... },
    template: '...'
  },
  toolRegistry: toolRegistry,
  nodeResults: {}  // Track each node's result
};
```

## Tool Integration

### Tool Binding

Tools are bound at tree creation time for efficiency:

```javascript
// During tree initialization
if (nodeConfig.type === 'action') {
  const tool = toolRegistry.getTool(nodeConfig.tool);
  if (!tool) throw new Error(`Tool not found: ${nodeConfig.tool}`);
  taskNode.toolInstance = tool;
}
```

### Parameter Resolution

Parameters support artifact references and context substitution:

```javascript
BTTaskStrategy.resolveParameters = function(params, context) {
  const resolved = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value.startsWith('@')) {
      // Resolve from artifacts
      const varName = value.substring(1);
      resolved[key] = context.artifacts?.[varName];
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
};
```

## Node Status Mapping

Task statuses map to BT statuses:

| Task Status | BT Status | Description |
|-------------|-----------|-------------|
| pending | PENDING | Not yet started |
| in-progress | RUNNING | Currently executing |
| completed | SUCCESS | Completed successfully |
| failed | FAILURE | Failed with error |

## Example Usage

### Creating and Executing a BT

```javascript
import { BTExecutor } from '@legion/bt-task';
import { ResourceManager } from '@legion/resource-manager';

// Get dependencies
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
      params: { directory: '.' }
    }
  ]
};

// Execute tree
const result = await executor.executeTree(treeConfig, {
  workspaceDir: process.cwd()
});

console.log('Execution result:', result.status);
```

### Custom Strategy

```javascript
// Define custom BT node strategy
const CustomStrategy = Object.create(BTTaskStrategy);

CustomStrategy.executeBTNode = function(senderTask, message) {
  // Custom node logic
  console.log('Executing custom node:', this.description);
  
  // Do custom work...
  
  // Complete with result
  this.complete({ status: 'SUCCESS', data: { custom: true } });
};

// Register with executor
executor.registerStrategy('custom', CustomStrategy);
```

## API Reference

### BTExecutor

- `executeTree(config, context)`: Execute a behavior tree
- `registerStrategy(type, strategy)`: Register custom node strategy
- `getStrategyForType(type)`: Get strategy for node type

### BTTaskStrategy

- `executeBTNode(sender, message)`: Execute the BT node
- `handleChildResult(child, message)`: Handle child completion
- `getNodeStatus()`: Get BT status from task status
- `resolveParameters(params, context)`: Resolve @ references

### Node Strategies

**SequenceStrategy**
- Executes children in order
- Fails on first child failure
- Succeeds when all children succeed

**SelectorStrategy**
- Tries children until one succeeds
- Fails if all children fail
- Succeeds on first child success

**ActionStrategy**
- Executes a tool from ToolRegistry
- Stores results in artifacts
- Maps tool result to BT status

**ConditionStrategy**
- Evaluates condition expression
- Executes children if true
- Skips children if false

**RetryStrategy**
- Retries failed children
- Configurable retry count and delay
- Fails after max retries

## Benefits of Unification

### Simplified Mental Model
- One execution model for all coordination patterns
- BT nodes are just tasks with specific strategies
- No separate infrastructure for BTs vs tasks

### Reused Infrastructure
- Artifact management from tasks
- Conversation tracking for debugging
- Message passing for communication
- Context propagation through hierarchy

### Natural Composition
- BT nodes can create subtasks of any strategy type
- Regular tasks can include BT sequences
- Nested BTs are just nested task hierarchies

### Consistent Patterns
- Same factory pattern (`createBTTask` uses `createTask`)
- Same message passing (`send`/`onMessage`)
- Same lifecycle (pending → in-progress → completed/failed)

## Implementation Patterns

### Pure Prototypal Inheritance

Following the task system pattern, all strategies use `Object.create()`:

```javascript
// No classes, just prototypes
const MyStrategy = Object.create(BTTaskStrategy);
MyStrategy.executeBTNode = function(sender, message) {
  // Implementation
};
```

### Fire-and-Forget Messaging

All communication is async and fire-and-forget:

```javascript
// Send message without waiting
this.send(childTask, { type: 'execute', context });

// Handle response in onMessage
this.onMessage = function(sender, message) {
  if (message.type === 'child-result') {
    this.handleChildResult(sender, message);
  }
};
```

### Strategy as Behavior

The strategy defines the node's behavior entirely:

```javascript
// Different strategies = different behaviors
const task1 = createBTTask('Execute in sequence', null, SequenceStrategy);
const task2 = createBTTask('Try alternatives', null, SelectorStrategy);
const task3 = createBTTask('Run tool', null, ActionStrategy);
```

## Compatibility

The bt-task package maintains API compatibility with actor-BT:
- Same configuration format
- Same node types
- Same execution semantics
- Same tool integration

Migration involves:
1. Replacing `BehaviorTreeExecutor` with `BTExecutor`
2. Tree execution returns task results instead of BT-specific format
3. Node implementations become strategies instead of classes

## Summary

The bt-task package achieves true unification of behavior trees and tasks by recognizing that BT nodes are simply tasks with specific coordination strategies. This design:

- Eliminates duplicate infrastructure
- Provides a consistent execution model
- Enables natural composition of BT and non-BT patterns
- Maintains full BT functionality while gaining task capabilities

The result is a simpler, more powerful system where behavior trees are a natural part of the task execution framework rather than a separate concept.