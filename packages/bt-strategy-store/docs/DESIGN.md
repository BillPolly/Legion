# BT Strategy Store - Design Document

## Overview

The BT Strategy Store is a specialized DataSource implementation for storing, discovering, and composing Behavior Tree (BT) strategies. It provides a handle-based interface for managing JavaScript strategy implementations with embedded metadata, enabling semantic search and composition capabilities.

## Core Architecture

### Strategy Storage Format

Strategies are stored as JavaScript files with embedded metadata:

```javascript
/**
 * @guid {string} 7f3d2a1b-4c5e-6d7f-8a9b-0c1d2e3f4g5h
 * @name {string} SequentialFileProcessorStrategy
 * @description {string} Processes multiple files in sequence with error recovery
 * @inputs {object} { files: Array<string>, processType: string }
 * @outputs {object} { processedFiles: Array<string>, errors: Array<Error> }
 * @children {array} ["FileReaderStrategy", "DataTransformStrategy", "FileWriterStrategy"]
 * @parameters {object} { batchSize: number, retryCount: number }
 * @tags {array} ["file-processing", "sequential", "batch", "error-recovery"]
 * @version {string} 1.0.0
 */

import { BTTaskStrategy } from '@legion/bt-task';

export const SequentialFileProcessorStrategy = Object.create(BTTaskStrategy);

SequentialFileProcessorStrategy.executeBTNode = async function(task, message) {
  // Strategy implementation
};
```

### DataSource Implementation

The `StrategyDataSource` implements the standard DataSource interface:

```javascript
class StrategyDataSource {
  // Core DataSource methods (synchronous)
  query(spec) { }
  subscribe(spec, callback) { }
  update(spec, data) { }
  validate(spec) { }
  getSchema() { }
  getMetadata() { }
  queryBuilder() { }
}
```

### Handle Integration

Strategies are accessed through the Handle system:

```javascript
// Get strategy handle from ResourceManager
const strategyStore = resourceManager.getDataSource('btstrategies://localhost/strategies');
const strategy = strategyStore.query({ name: 'SequentialFileProcessorStrategy' });

// Handle provides introspection
const metadata = strategy.getMetadata();
const schema = strategy.getSchema();
```

## Data Model

### Strategy Entity

```javascript
{
  guid: "7f3d2a1b-4c5e-6d7f-8a9b-0c1d2e3f4g5h",
  name: "SequentialFileProcessorStrategy",
  description: "Processes multiple files in sequence",
  code: "// JavaScript implementation",
  metadata: {
    inputs: { /* JSON Schema */ },
    outputs: { /* JSON Schema */ },
    children: ["Strategy1", "Strategy2"],
    parameters: { /* Parameter definitions */ },
    tags: ["file", "sequential"],
    version: "1.0.0",
    created: "2025-01-29T10:00:00Z",
    modified: "2025-01-29T10:00:00Z"
  },
  embedding: [/* Vector representation */],
  prototype: "BTTaskStrategy"
}
```

### Composition Format

Strategies can be composed using JSON/YAML:

```json
{
  "guid": "composite-001",
  "name": "DataPipelineStrategy",
  "type": "composition",
  "components": [
    {
      "strategy": "guid:7f3d2a1b-4c5e-6d7f-8a9b-0c1d2e3f4g5h",
      "config": {
        "batchSize": 10,
        "retryCount": 3
      }
    },
    {
      "strategy": "name:DataValidationStrategy",
      "config": {
        "strict": true
      }
    }
  ]
}
```

## Storage Backend

### MongoDB Collections

1. **bt_strategies** - Main strategy storage
   - Indexed on: guid, name, tags
   - Text index on: description

2. **bt_strategy_embeddings** - Vector embeddings
   - Links to strategy by guid
   - Contains embedding vectors

### File System

Strategies are also stored as `.js` files:
```
/strategies/
  /core/
    SequenceStrategy.js
    SelectorStrategy.js
  /domain/
    FileProcessorStrategy.js
  /compositions/
    DataPipeline.json
```

## Discovery Mechanism

### Semantic Search

1. **Embedding Generation**
   - Strategy description and tags are embedded using local ONNX model
   - Embeddings stored in Qdrant vector database

2. **Search Process**
   ```javascript
   // Natural language search
   const results = await strategyStore.query({
     semantic: "strategy for processing CSV files in batches",
     limit: 5
   });
   ```

3. **Similarity Matching**
   - Cosine similarity on embeddings
   - Combined with tag matching and text search

### Query Interface

```javascript
// Find by GUID
strategyStore.query({ guid: "7f3d2a1b..." })

// Find by name
strategyStore.query({ name: "FileProcessor" })

// Find by tags
strategyStore.query({ tags: { $in: ["file", "batch"] } })

// Find by child dependencies
strategyStore.query({ children: { $contains: "FileReaderStrategy" } })

// Semantic search
strategyStore.query({ 
  semantic: "handle API responses with retry logic",
  threshold: 0.7
})
```

## Composition System

### Strategy Composition

Strategies can be composed from simpler strategies:

```javascript
const compositeStrategy = strategyStore.compose({
  name: "ComplexWorkflow",
  strategies: [
    { guid: "strategy-1", config: {...} },
    { guid: "strategy-2", config: {...} }
  ],
  flow: "sequence" // or "selector", "parallel"
});
```

### Dependency Resolution

The system automatically resolves strategy dependencies:

```javascript
const resolved = await strategyStore.resolveDependencies("strategy-guid");
// Returns ordered list of strategies needed
```

## Integration Points

### ResourceManager Integration

```javascript
// Register StrategyDataSource with ResourceManager
resourceManager.registerDataSource('btstrategies', StrategyDataSource);

// Access through URI
const store = resourceManager.getDataSource('btstrategies://localhost/strategies');
```

### BT Executor Integration

```javascript
// BTExecutor can load strategies dynamically
const strategy = await strategyStore.query({ name: "MyStrategy" });
const instance = Object.create(strategy.prototype);
await executor.registerStrategy("MyStrategy", instance);
```

### Tool Registry Integration

```javascript
// Strategies can be exposed as tools
const strategy = await strategyStore.query({ name: "FileProcessor" });
toolRegistry.registerTool({
  name: strategy.name,
  execute: strategy.execute,
  metadata: strategy.metadata
});
```

## Testing Framework

### Strategy Testing

```javascript
// Test harness for strategies
const tester = new StrategyTester(strategyStore);

// Unit test
await tester.test("strategy-guid", {
  input: { files: ["test.csv"] },
  expectedOutput: { processedFiles: ["test.csv"] },
  mockContext: { /* mocked dependencies */ }
});

// Integration test with real BT executor
await tester.integrationTest("strategy-guid", {
  btConfig: { /* BT configuration */ },
  realContext: { /* real dependencies */ }
});
```

### Validation

```javascript
// Validate strategy metadata
const valid = await strategyStore.validate({
  guid: "test-guid",
  metadata: { /* strategy metadata */ }
});

// Validate composition
const compositionValid = await strategyStore.validateComposition({
  components: [/* strategy references */]
});
```

## Usage Examples

### Storing a New Strategy

```javascript
// Store new strategy
await strategyStore.update({
  operation: 'create',
  data: {
    name: "CustomStrategy",
    code: "// JavaScript code",
    metadata: {
      inputs: { type: "object" },
      outputs: { type: "object" },
      tags: ["custom", "example"]
    }
  }
});
```

### Discovering Strategies

```javascript
// Find strategies for a task
const strategies = await strategyStore.query({
  semantic: "read JSON files and transform to CSV",
  tags: { $in: ["json", "csv"] },
  limit: 10
});

// Get strategy with dependencies
const fullStrategy = await strategyStore.query({
  guid: "strategy-guid",
  include: ["dependencies", "compositions"]
});
```

### Composing Strategies

```javascript
// Create composite strategy
const pipeline = await strategyStore.compose({
  name: "ETLPipeline",
  description: "Extract, transform, and load data",
  strategies: [
    { ref: "guid:extractor-001", config: { source: "api" } },
    { ref: "name:DataTransformer", config: { format: "json" } },
    { ref: "guid:loader-002", config: { target: "database" } }
  ]
});
```

## API Summary

### StrategyDataSource Methods

| Method | Description | Synchronous |
|--------|-------------|-------------|
| `query(spec)` | Query strategies | Yes |
| `subscribe(spec, callback)` | Subscribe to changes | Yes |
| `update(spec, data)` | Create/update strategies | No* |
| `validate(spec)` | Validate strategy/composition | Yes |
| `getSchema()` | Get strategy schema | Yes |
| `getMetadata()` | Get DataSource metadata | Yes |
| `compose(spec)` | Compose strategies | No* |
| `resolveDependencies(guid)` | Resolve strategy dependencies | No* |
| `test(guid, testSpec)` | Test strategy | No* |

*Returns immediately with handle, async operation completes in background

## Implementation Notes

### Pure Prototypal Pattern

All strategies follow the pure prototypal pattern:

```javascript
// No classes, only prototypes
export const MyStrategy = Object.create(BTTaskStrategy);
MyStrategy.executeBTNode = async function(task, message) {
  // Implementation
};
```

### Metadata Extraction

Metadata is extracted from JSDoc comments:

```javascript
function extractMetadata(code) {
  const jsdoc = parseJSDoc(code);
  return {
    guid: jsdoc.tags.guid,
    name: jsdoc.tags.name,
    inputs: JSON.parse(jsdoc.tags.inputs),
    outputs: JSON.parse(jsdoc.tags.outputs),
    // ... other metadata
  };
}
```

### Caching

The DataSource implements multi-level caching:

1. **Strategy cache** - Loaded strategy objects
2. **Metadata cache** - Extracted metadata
3. **Embedding cache** - Vector embeddings
4. **Composition cache** - Resolved compositions

### Error Handling

All errors follow the standard DataSource pattern:

```javascript
{
  success: false,
  error: "Strategy not found",
  code: "STRATEGY_NOT_FOUND",
  details: { guid: "requested-guid" }
}
```

## Summary

The BT Strategy Store provides a complete solution for managing BT strategies as first-class entities in the Legion framework. By implementing the DataSource interface and integrating with the Handle system, it enables:

1. **Storage** - Persistent storage with embedded metadata
2. **Discovery** - Semantic search and query capabilities  
3. **Composition** - Building complex strategies from simple ones
4. **Testing** - Comprehensive testing framework
5. **Integration** - Seamless integration with existing Legion components

The system follows Legion's patterns of pure prototypal inheritance, synchronous Handle operations, and ResourceManager integration, making it a natural extension of the existing architecture.