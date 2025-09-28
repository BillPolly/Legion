# @legion/bt-validator

Comprehensive validation for Legion framework Behavior Tree structures. This package validates BT node types, tool availability, parameter schemas, and tree structural integrity using the powerful `@legion/schema` package for JSON Schema validation.

## Features

- ✅ BT node structure and hierarchy validation
- ✅ Intelligent defaults application (sequence, action types)
- ✅ Tool existence and availability validation  
- ✅ Parameter schema validation using `@legion/schema`
- ✅ Tree structural integrity (cycles, orphans, duplicates)
- ✅ Legacy plan array support with automatic conversion
- ✅ Comprehensive error messages with detailed context

## Installation

```bash
npm install @legion/bt-validator
```

## Quick Start

### Basic BT Validation

```javascript
import { BTValidator } from '@legion/bt-validator';

// Create a validator instance
const validator = new BTValidator({
  strictMode: true,        // Strict parameter validation
  validateTools: true,     // Check tool availability
  applyDefaults: true,     // Apply intelligent defaults
  coerceTypes: false      // Type coercion for lenient validation
});

// Define available tools
const tools = [
  {
    name: 'writeFile',
    description: 'Write content to a file',
    getMetadata: () => ({
      name: 'writeFile',
      input: { path: 'string', content: 'string' },
      output: { path: 'string', size: 'number' }
    })
  }
];

// Define a BT structure
const bt = {
  type: 'sequence',
  id: 'main',
  description: 'Write and verify file',
  children: [
    {
      type: 'action',
      id: 'write',
      tool: 'writeFile',
      inputs: { path: 'test.txt', content: 'Hello World' }
    },
    {
      type: 'action', 
      id: 'verify',
      tool: 'readFile',
      inputs: { path: 'test.txt' }
    }
  ]
};

// Validate the BT
const result = await validator.validate(bt, tools);

if (result.valid) {
  console.log('BT is valid!');
} else {
  console.log('Validation errors:', result.errors);
  console.log('Warnings:', result.warnings);
}
```

### Legacy Plan Array Support

The validator automatically converts legacy plan arrays to BT format:

```javascript
// Legacy plan array format
const legacyPlan = [
  { id: 'step1', tool: 'writeFile', inputs: { path: 'test.txt', content: 'data' } },
  { id: 'step2', tool: 'readFile', inputs: { path: 'test.txt' } }
];

// Automatically converted to BT structure during validation
const result = await validator.validate(legacyPlan, tools);
// Converted to: { type: 'sequence', children: [{ type: 'action', ... }, ...] }
```

### Intelligent Defaults

The validator applies intelligent defaults:

```javascript
// Minimal BT specification
const minimalBT = {
  children: [
    { tool: 'writeFile', inputs: { path: 'test.txt', content: 'data' } },  // → type: 'action'
    { tool: 'readFile', inputs: { path: 'test.txt' } }                     // → type: 'action'
  ]
  // → type: 'sequence' (has children, no type specified)
};

const result = await validator.validate(minimalBT, tools);
// Defaults applied automatically
```

## API Reference

### BTValidator

The main validator class for Behavior Tree structures.

```javascript
const validator = new BTValidator(options);
```

#### Options

- `strictMode` (boolean): Enable strict validation mode (default: true)
- `validateTools` (boolean): Check tool availability (default: true) 
- `applyDefaults` (boolean): Apply intelligent defaults (default: true)
- `debugMode` (boolean): Enable debug logging (default: false)
- `coerceTypes` (boolean): Enable type coercion for parameters (default: false)

#### Methods

##### `validate(bt, tools, context)`

Validates a BT structure with intelligent defaults.

- `bt` (Object|Array): BT structure or legacy plan array
- `tools` (Array): Available tools with metadata
- `context` (Object): Optional validation context
- Returns: `Promise<ValidationResult>`

### ValidationResult

Result object containing validation status and details.

```javascript
{
  valid: boolean,           // Overall validation status
  errors: Array<Error>,     // List of validation errors
  warnings: Array<Warning>, // List of validation warnings
  timestamp: number         // Validation timestamp
}
```

## BT Node Types

### Supported Node Types

- **sequence**: Execute children in order, stop on first failure
- **selector**: Execute children until first success (fallback)
- **parallel**: Execute children concurrently
- **action**: Execute a tool with parameters
- **retry**: Retry child node on failure
- **condition**: Evaluate a boolean expression to control flow

### Node Structure

```javascript
{
  type: 'sequence|selector|parallel|action|retry',
  id: 'unique-node-id',           // Required: Unique identifier
  description: 'Node description', // Optional: Human-readable description
  children: [...],                 // For composite nodes (sequence, selector, parallel)
  child: {...},                   // For decorator nodes (retry)
  tool: 'toolName',               // For action nodes
  inputs: { ... },                // For action nodes: tool input parameters
  outputs: { ... },               // For action nodes: output variable mappings
  maxRetries: 3,                  // For retry nodes
  check: 'expression',            // For condition nodes: boolean expression
  timeout: 5000                   // Optional: execution timeout
}
```

## Intelligent Defaults

The validator automatically applies these defaults:

### Type Detection
- **No type + has `children`** → `sequence`
- **No type + has `tool`** → `action`
- **No type + has `child`** → `retry`

### ID Generation
- **Missing ID** → Generated from type and index: `action_0_writeFile`

### Legacy Array Conversion
- **Array input** → Wrapped in sequence with action children

## Validation Types

### BT Structure Validation
- Node type validity (sequence, selector, action, retry, parallel)
- Required fields for each node type
- Children/child requirements for composite/decorator nodes

### Tool Validation
- Checks if referenced tools exist
- Validates tool parameters against schemas
- Ensures tools are properly configured

### Tree Integrity Validation
- Detects duplicate node IDs
- Checks for circular references
- Validates parent-child relationships

### Variable Reference Validation
- Validates artifact references in condition nodes
- Checks that referenced variables are defined
- Warns about unused variable outputs
- Ensures proper context references
- Detects forward references (using variables before they're defined)

### Schema Validation
- Uses `@legion/schema` for comprehensive parameter validation
- Supports type checking, constraints, and formats
- Provides detailed error messages with paths
- Optional type coercion for lenient validation

## Error Types

The validator reports different types of errors:

- `INVALID_BT_STRUCTURE`: BT structure is malformed
- `INVALID_NODE_TYPE`: Unknown or invalid node type
- `MISSING_NODE_TYPE`: Node missing required type field
- `MISSING_NODE_ID`: Node missing required ID field
- `MISSING_TOOL`: Action node missing tool specification
- `MISSING_CHILDREN`: Composite node missing children
- `TOOL_NOT_FOUND`: Referenced tool doesn't exist
- `SCHEMA_VALIDATION_ERROR`: Parameter validation failed
- `DUPLICATE_NODE_ID`: Duplicate node ID detected
- `CIRCULAR_REFERENCE`: Circular reference in tree structure
- `INVALID_NODE`: Node structure is invalid
- `INVALID_RETRY_STRUCTURE`: Retry node doesn't have exactly one child
- `MISSING_CONDITION`: Condition node missing check expression
- `UNDEFINED_VARIABLE`: Referenced variable is not defined
- `INVALID_ARTIFACT_REFERENCE`: Invalid artifact reference in condition
- `UNUSED_VARIABLE`: Variable output is never used (warning)
- `VALIDATION_ERROR`: General validation error occurred

## Examples

### Complex Multi-Node BT

```javascript
const complexBT = {
  type: 'selector',  // Try options until one succeeds
  id: 'backup-strategy',
  description: 'Try primary method, fallback to backup',
  children: [
    {
      type: 'sequence',
      id: 'primary',
      description: 'Primary approach',
      children: [
        { type: 'action', id: 'fetch', tool: 'httpRequest', inputs: { url: 'https://api.primary.com/data' } },
        { type: 'action', id: 'process', tool: 'processJson', inputs: { format: 'csv' } }
      ]
    },
    {
      type: 'retry',
      id: 'backup',
      description: 'Backup with retries',
      maxRetries: 3,
      child: {
        type: 'action',
        id: 'backup-fetch',
        tool: 'httpRequest',
        inputs: { url: 'https://api.backup.com/data' }
      }
    }
  ]
};

const result = await validator.validate(complexBT, tools);
```

### Parallel Execution

```javascript
const parallelBT = {
  type: 'parallel',
  id: 'concurrent-tasks',
  description: 'Execute multiple tasks concurrently',
  children: [
    { type: 'action', id: 'task1', tool: 'processDataA', inputs: { input: 'dataA' } },
    { type: 'action', id: 'task2', tool: 'processDataB', inputs: { input: 'dataB' } },
    { type: 'action', id: 'task3', tool: 'processDataC', inputs: { input: 'dataC' } }
  ]
};
```

### Condition Nodes with Variable References

```javascript
const conditionalBT = {
  type: 'sequence',
  id: 'conditional-flow',
  description: 'Process with conditional logic',
  children: [
    {
      type: 'action',
      id: 'fetch-data',
      tool: 'fetchData',
      inputs: { source: 'api' },
      outputs: { data: 'apiData' } // Store result in artifact 'apiData'
    },
    {
      type: 'condition',
      id: 'check-data',
      check: "artifacts['apiData'] !== null && artifacts['apiData'].length > 0",
      description: 'Check if data was fetched successfully'
    },
    {
      type: 'action',
      id: 'process-data',
      tool: 'processData',
      inputs: { data: "{{apiData}}" } // Reference the artifact
    }
  ]
};
```

## Integration with Legion Framework

This package is designed to work seamlessly with other Legion framework components:

- **@legion/schema**: Provides the underlying JSON Schema validation
- **@legion/unified-planner**: Uses this validator for BT plan validation
- **@legion/bt-task**: Executes validated BT structures

## Backward Compatibility

The package maintains backward compatibility with the old `@legion/plan-validator`:

```javascript
// Legacy import still works
import { PlanValidator } from '@legion/bt-validator';

// BTValidator is the new primary class
import { BTValidator } from '@legion/bt-validator';
```

## Contributing

Contributions are welcome! Please ensure all tests pass and add tests for new features.

## License

MIT

## See Also

- [@legion/schema](../schema) - JSON Schema to Zod conversion
- [@legion/unified-planner](../unified-planner) - Unified planning framework
- [@legion/bt-task](../../shared/bt-task) - Behavior Tree execution
- [Legion Framework](https://github.com/maxximus-dev/Legion)