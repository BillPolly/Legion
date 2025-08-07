# @legion/plan-validator

Comprehensive validation for Legion framework execution plans. This package validates tool availability, parameter schemas, artifact flow, and dependencies using the powerful `@legion/schema` package for JSON Schema validation.

## Features

- ✅ Tool existence and availability validation
- ✅ Parameter schema validation using `@legion/schema`
- ✅ Artifact reference tracking and validation
- ✅ Dependency graph validation with cycle detection
- ✅ Output field mapping validation
- ✅ Comprehensive error messages with detailed context

## Installation

```bash
npm install @legion/plan-validator
```

## Quick Start

```javascript
import { PlanValidator } from '@legion/plan-validator';

// Create a validator instance
const validator = new PlanValidator({
  strictMode: true,        // Strict parameter validation
  validateArtifacts: true, // Check for unused artifacts
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

// Define a plan
const plan = [
  {
    id: 'step1',
    description: 'Write a file',
    tool: 'writeFile',
    params: { path: 'test.txt', content: 'Hello World' }
  }
];

// Validate the plan
const result = await validator.validate(plan, tools);

if (result.valid) {
  console.log('Plan is valid!');
} else {
  console.log('Validation errors:', result.errors);
  console.log('Warnings:', result.warnings);
}
```

## API Reference

### PlanValidator

The main validator class for execution plans.

```javascript
const validator = new PlanValidator(options);
```

#### Options

- `strictMode` (boolean): Enable strict validation mode (default: true)
- `validateArtifacts` (boolean): Check for unused artifacts (default: true)
- `debugMode` (boolean): Enable debug logging (default: false)
- `coerceTypes` (boolean): Enable type coercion for parameters (default: false)

#### Methods

##### `validate(plan, tools, context)`

Validates a complete execution plan.

- `plan` (Array): Array of plan steps to validate
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

### ValidationUtils

Utility functions for common validation tasks.

```javascript
import { ValidationUtils } from '@legion/plan-validator';

// Validate required fields
ValidationUtils.required(value, 'fieldName');

// Validate plan step structure
ValidationUtils.planStep(step);

// Validate resource constraints
ValidationUtils.resourceConstraints(constraints);
```

## Plan Step Structure

A valid plan step should have the following structure:

```javascript
{
  id: 'unique-step-id',           // Required: Unique identifier
  description: 'Step description', // Required: Human-readable description
  tool: 'toolName',                // Required: Tool to execute
  params: {                        // Optional: Tool parameters
    param1: 'value',
    param2: 123
  },
  dependencies: ['step1'],         // Optional: Step dependencies
  saveOutputs: {                   // Optional: Artifact creation
    outputField: {
      name: 'artifactName',
      description: 'Artifact description'
    }
  }
}
```

## Schema Format

Tool schemas use a simple format that's converted to JSON Schema internally:

```javascript
{
  // Simple types
  name: 'string',           // Required string
  age: 'number',            // Required number
  active: 'boolean',        // Required boolean
  
  // Optional fields (append ?)
  nickname: 'string?',      // Optional string
  score: 'number?',         // Optional number
  
  // Arrays
  tags: 'string[]',         // Array of strings
  values: 'number[]',       // Array of numbers
  
  // Union types
  id: 'string|number',      // String or number
  
  // Any type
  data: 'any'               // Any type allowed
}
```

## Validation Types

### Tool Validation

- Checks if referenced tools exist
- Validates tool parameters against schemas
- Ensures output fields exist for artifact creation

### Artifact Validation

- Tracks artifact creation through `saveOutputs`
- Validates artifact references (`@artifactName`)
- Detects duplicate artifact names
- Warns about unused artifacts

### Dependency Validation

- Validates dependency references exist
- Ensures dependencies come before dependent steps
- Detects circular dependencies
- Builds and validates dependency graph

### Schema Validation

- Uses `@legion/schema` for comprehensive JSON Schema validation
- Supports type checking, constraints, and formats
- Provides detailed error messages with paths
- Optional type coercion for lenient validation

## Error Types

The validator reports different types of errors:

- `EMPTY_PLAN`: Plan is empty or not an array
- `INVALID_STEP_STRUCTURE`: Step structure is invalid
- `TOOL_NOT_FOUND`: Referenced tool doesn't exist
- `SCHEMA_VALIDATION_ERROR`: Parameter validation failed
- `ARTIFACT_NOT_FOUND`: Referenced artifact doesn't exist
- `DUPLICATE_ARTIFACT_NAME`: Artifact name already used
- `INVALID_OUTPUT_FIELD`: Output field doesn't exist in tool
- `INVALID_DEPENDENCY`: Dependency doesn't exist
- `CIRCULAR_DEPENDENCY`: Circular dependency detected
- `MISSING_ARTIFACT_NAME`: Artifact missing required name
- `INVALID_SAVE_OUTPUT`: Invalid saveOutputs configuration

## Examples

### Complex Multi-Step Plan

```javascript
const plan = [
  {
    id: 'fetch',
    description: 'Fetch data from API',
    tool: 'httpRequest',
    params: {
      url: 'https://api.example.com/data',
      method: 'GET'
    },
    saveOutputs: {
      data: { name: 'apiData', description: 'Raw API response' }
    }
  },
  {
    id: 'process',
    description: 'Process the data',
    tool: 'processJson',
    params: {
      input: '@apiData',  // Reference artifact
      format: 'csv'
    },
    dependencies: ['fetch'],
    saveOutputs: {
      result: { name: 'processedData', description: 'Processed CSV data' }
    }
  },
  {
    id: 'save',
    description: 'Save to file',
    tool: 'writeFile',
    params: {
      path: 'output.csv',
      content: '@processedData'  // Reference artifact
    },
    dependencies: ['process']
  }
];

const result = await validator.validate(plan, tools);
```

### Custom Tool with Schema

```javascript
const customTool = {
  name: 'dataTransform',
  description: 'Transform data with options',
  getMetadata: () => ({
    name: 'dataTransform',
    description: 'Transform data with options',
    input: {
      data: 'any',
      format: 'string',
      options: {
        type: 'object',
        properties: {
          delimiter: { type: 'string' },
          headers: { type: 'boolean' }
        }
      }
    },
    output: {
      result: 'string',
      metadata: 'object'
    }
  })
};
```

### Non-Strict Mode

```javascript
// Allow extra parameters and lenient validation
const validator = new PlanValidator({
  strictMode: false,
  coerceTypes: true
});

const plan = [
  {
    id: 'step1',
    description: 'Flexible step',
    tool: 'someTool',
    params: {
      count: '42',        // Will be coerced to number
      active: 'true',     // Will be coerced to boolean
      extraParam: 'allowed' // Extra params allowed
    }
  }
];
```

## Integration with Legion Framework

This package is designed to work seamlessly with other Legion framework components:

- **@legion/schema**: Provides the underlying JSON Schema validation
- **@legion/recursive-planner**: Uses this validator for plan validation
- **@legion/module-loader**: Tool metadata format compatibility

## Contributing

Contributions are welcome! Please ensure all tests pass and add tests for new features.

## License

MIT

## See Also

- [@legion/schema](../schema) - JSON Schema to Zod conversion
- [@legion/recursive-planner](../recursive-planner) - Recursive planning framework
- [Legion Framework](https://github.com/maxximus-dev/Legion)