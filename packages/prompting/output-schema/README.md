# @legion/output-schema

Focused LLM response validator with dual functionality: generate format instructions for prompts and parse responses into structured data.

This package provides a `ResponseValidator` that serves as a reusable component for higher-level prompt orchestration systems. It uses extended JSON Schema to support multiple output formats while maintaining a clean, standardized API.

## Key Features

- **Dual-function**: Generate prompt instructions AND parse responses
- **Reusable validator**: Create once, use for multiple LLM interactions  
- **Multi-format**: Supports JSON, XML, delimited sections, tagged content, markdown
- **Standardized results**: Always returns `{success, data}` or `{success, errors}`
- **Structured errors**: Actionable error reports for reprompting systems
- **Schema-driven**: Extended JSON Schema with `x-format` specifications

## Quick Start

```javascript
import { ResponseValidator } from '@legion/output-schema';

// 1. Define response schema
const schema = {
  type: 'object',
  properties: {
    task: { type: 'string', description: 'Task description' },
    confidence: { type: 'number', minimum: 0, maximum: 1 }
  },
  required: ['task']
};

// 2. Create reusable validator
const validator = new ResponseValidator(schema);

// 3. Generate instructions for prompts
const exampleData = { task: "Analyze user feedback", confidence: 0.85 };
const instructions = validator.generateInstructions(exampleData);

// Use in your prompt:
const prompt = `${userTask}\n\n${instructions}`;

// 4. Process LLM responses (reusable)
const result = validator.process(llmResponse);

if (result.success) {
  console.log(result.data.task);
  console.log(result.data.confidence); 
} else {
  console.log('Structured errors:', result.errors);
}
```

## Documentation

See the [Design Document](./docs/DESIGN.md) for comprehensive specifications and examples.