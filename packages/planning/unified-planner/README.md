# @legion/unified-planner

Unified planning system for Legion framework that combines the best features from `llm-planner` and `recursive-planner` into a single, modular planning system that generates Behavior Tree structures for execution.

## Features

- 🧠 **Multiple Planning Strategies**: LLM-based, Template-based, and Rule-based planning
- 🌳 **Direct BT Generation**: Creates Behavior Tree structures natively (no conversion needed)  
- 🎯 **Intelligent Defaults**: Automatically applies sequence/action types where missing
- 🔄 **Retry with Context**: Failed plans trigger retry with error context
- 📝 **Template System**: Powerful prompt template engine for consistent LLM interactions
- ✅ **Comprehensive Validation**: Integrated with `@legion/bt-validator`
- 🏗️ **Clean Architecture**: Pure planning - no execution logic mixed in
- 🔧 **Factory Functions**: Easy setup for common use cases

## Installation

```bash
npm install @legion/unified-planner
```

## Quick Start

### Simple LLM-Based Planning (like original llm-planner)

```javascript
import { createLLMPlanner } from '@legion/unified-planner';
import { SomeOpenAIClient } from '@legion/llm';

const llmClient = new SomeOpenAIClient({ apiKey: 'your-key' });
const planner = createLLMPlanner(llmClient);

const bt = await planner.createPlan({
  description: 'Process a CSV file and generate a report',
  allowableActions: [
    {
      type: 'readFile',
      description: 'Read file content',
      inputSchema: {
        properties: {
          path: { type: 'string', description: 'File path' }
        },
        required: ['path']
      }
    },
    {
      type: 'processCSV', 
      description: 'Process CSV data',
      inputSchema: {
        properties: {
          data: { type: 'string', description: 'CSV content' },
          format: { type: 'string', description: 'Output format' }
        },
        required: ['data']
      }
    }
  ],
  inputs: ['csvFilePath'],
  requiredOutputs: ['processedData']
});

console.log('Generated BT:', JSON.stringify(bt, null, 2));
```

### Multi-Strategy Planning (like original recursive-planner)

```javascript
import { createMultiStrategyPlanner } from '@legion/unified-planner';

const planner = createMultiStrategyPlanner({
  llmClient: myLLMClient,
  templates: {
    'file processing': {
      type: 'sequence',
      id: 'file_processor',
      children: [
        { type: 'action', tool: 'readFile', params: { path: '{{inputFile}}' } },
        { type: 'action', tool: 'processData', params: { format: '{{format}}' } }
      ]
    }
  },
  debugMode: true
});

// Try LLM first, fallback to templates
const strategies = ['llm', 'template'];
const bt = await planner.createPlan(request, 'llm');

// Or let it select the best strategy
const bestStrategy = await planner.selectBestStrategy(request, strategies);
const bt2 = await planner.createPlan(request, bestStrategy);
```

## Architecture Overview

### Unified Design
```
Planning Request → PlannerEngine → Strategy → BT Structure → BT Validator → Validated BT
```

### Package Relationships
- **@legion/unified-planner**: Pure planning - generates BT structures
- **@legion/bt-validator**: Pure validation - validates BT schemas
- **@legion/actor-bt**: Pure execution - executes validated BTs

## API Reference

### PlannerEngine

The core orchestrator that manages multiple planning strategies.

```javascript
import { PlannerEngine, PlanningRequest } from '@legion/unified-planner';

const engine = new PlannerEngine({
  debugMode: false,
  maxRetries: 3,
  strictMode: true
});

// Register strategies
engine.registerStrategy('llm', new LLMStrategy(llmClient));
engine.registerStrategy('template', new TemplateStrategy(templates));

// Create plan
const request = new PlanningRequest({ description, allowableActions });
const result = await engine.createPlan(request, 'llm');
```

### Planning Strategies

#### LLMStrategy

Uses LLM reasoning to generate BT structures with retry support.

```javascript
import { LLMStrategy, PromptTemplateLoader } from '@legion/unified-planner';

const templateLoader = new PromptTemplateLoader('./templates');
const strategy = new LLMStrategy(llmClient, {
  templateLoader,
  model: 'claude-3-5-sonnet-20241022',
  temperature: 0.3,
  debugMode: true
});
```

#### TemplateStrategy

Uses predefined BT templates that match goal patterns.

```javascript
import { TemplateStrategy } from '@legion/unified-planner';

const strategy = new TemplateStrategy({
  'process data': {
    type: 'sequence',
    children: [
      { type: 'action', tool: 'loadData', params: { source: '{{input}}' } },
      { type: 'action', tool: 'transform', params: { format: '{{format}}' } }
    ]
  }
});

strategy.addTemplate('backup data', backupTemplate);
```

#### RuleStrategy

Uses conditional rules to generate BT structures.

```javascript
import { RuleStrategy } from '@legion/unified-planner';

const strategy = new RuleStrategy();

// Add keyword-based rule
strategy.addKeywordRule('file-operations', ['file', 'read', 'write'], 
  (context) => ({
    type: 'sequence',
    children: [
      { type: 'action', tool: 'validatePath', params: { path: context.request.inputs[0] } },
      { type: 'action', tool: 'processFile', params: { operation: 'read' } }
    ]
  })
);

// Add tool availability rule  
strategy.addToolAvailabilityRule('has-database', ['connectDB', 'queryDB'],
  (context) => ({
    type: 'sequence', 
    children: [
      { type: 'action', tool: 'connectDB' },
      { type: 'action', tool: 'queryDB', params: { query: '{{query}}' } }
    ]
  })
);
```

## BT Structure Format

The unified-planner generates Behavior Tree structures with these node types:

### Node Types

- **sequence**: Execute children in order, stop on first failure
- **selector**: Execute children until first success (fallback)
- **parallel**: Execute children concurrently
- **action**: Execute a tool with parameters
- **retry**: Retry child node on failure

### BT Structure Example

```javascript
{
  "type": "selector", // Try primary, fallback to backup
  "id": "api_workflow",
  "description": "Fetch data with fallback strategy",
  "children": [
    {
      "type": "sequence",
      "id": "primary_flow", 
      "description": "Primary API approach",
      "children": [
        {
          "type": "action",
          "id": "fetch_primary",
          "tool": "httpRequest",
          "description": "Fetch from primary API",
          "params": {
            "url": "https://api.primary.com/data",
            "method": "GET"
          }
        },
        {
          "type": "action",
          "id": "validate_response",
          "tool": "validateJSON",
          "description": "Validate API response",
          "params": {
            "schema": "dataSchema"
          }
        }
      ]
    },
    {
      "type": "retry",
      "id": "backup_flow",
      "description": "Backup API with retry",
      "maxRetries": 3,
      "child": {
        "type": "action",
        "id": "fetch_backup", 
        "tool": "httpRequest",
        "description": "Fetch from backup API",
        "params": {
          "url": "https://api.backup.com/data",
          "method": "GET"
        }
      }
    }
  ]
}
```

### Intelligent Defaults

The planner automatically applies intelligent defaults:

```javascript
// Input with minimal specification
{
  children: [
    { tool: 'readFile', params: { path: 'input.txt' } },  // → type: 'action'
    { tool: 'processData', params: { format: 'json' } }   // → type: 'action'
  ]
  // → type: 'sequence' (has children, no type specified)
}

// Becomes fully specified BT
{
  type: 'sequence',
  id: 'sequence_0',
  children: [
    {
      type: 'action',
      id: 'action_0_readFile', 
      tool: 'readFile',
      params: { path: 'input.txt' }
    },
    {
      type: 'action',
      id: 'action_1_processData',
      tool: 'processData', 
      params: { format: 'json' }
    }
  ]
}
```

## Factory Functions

### createLLMPlanner(llmClient, options)

Creates a simple LLM-based planner (compatible with original llm-planner API).

```javascript
const planner = createLLMPlanner(llmClient, {
  model: 'claude-3-5-sonnet-20241022',
  temperature: 0.3,
  templatesDir: './templates',
  debugMode: true
});
```

### createMultiStrategyPlanner(options)

Creates a planner with multiple strategies (like recursive-planner).

```javascript
const planner = createMultiStrategyPlanner({
  llmClient: myLLMClient,
  templates: { /* template definitions */ },
  rules: { /* rule definitions */ },
  debugMode: true
});
```

### createTemplatePlanner(templates, options)

Creates a template-only planner for deterministic planning.

```javascript
const planner = createTemplatePlanner({
  'data processing': dataProcessingTemplate,
  'api workflow': apiWorkflowTemplate
});
```

### createRulePlanner(options)

Creates a rule-based planner for conditional logic.

```javascript
const planner = createRulePlanner({
  maxRulesApplied: 5,
  stopOnFirstMatch: false
});
```

## Template System

### Prompt Templates

Create `.md` files in your templates directory:

**templates/create-bt-plan.md:**
```markdown
Create a Behavior Tree for: {{description}}

Requirements:
- Inputs: {{inputs}}
- Outputs: {{requiredOutputs}}

Available Actions:
{{actionsList}}

Generate a BT structure with sequence, selector, action, and retry nodes.
Return JSON format only.
```

**templates/fix-bt-plan.md:**
```markdown
Fix the following BT that failed validation:

Errors:
{{validationErrors}}

Failed BT:
{{failedBT}}

Generate a corrected BT structure addressing all validation errors.
```

### Template Usage

```javascript
import { PromptTemplateLoader } from '@legion/unified-planner';

const loader = new PromptTemplateLoader('./my-templates');

// Create default templates
await loader.createDefaultTemplates();

// Use with LLM strategy
const llmStrategy = new LLMStrategy(llmClient, { templateLoader: loader });
```

## Integration Examples

### With Actor BT Execution

```javascript
import { createLLMPlanner } from '@legion/unified-planner';
import { BehaviorTreeExecutor } from '@legion/actor-bt';

// 1. Plan generation
const planner = createLLMPlanner(llmClient);
const bt = await planner.createPlan(request);

// 2. BT execution  
const executor = new BehaviorTreeExecutor();
const results = await executor.executeBT(bt);
```

### Migration from Original Packages

#### From llm-planner

```javascript
// Old way
import { GenericPlanner } from '@legion/llm-planner';
const planner = new GenericPlanner({ llmClient, moduleLoader });

// New way  
import { createLLMPlanner } from '@legion/unified-planner';
const planner = createLLMPlanner(llmClient);
```

#### From recursive-planner

```javascript
// Old way
import { RecursivePlanner } from '@legion/recursive-planner';
const planner = new RecursivePlanner.createAgent(config);

// New way
import { createMultiStrategyPlanner } from '@legion/unified-planner';
const planner = createMultiStrategyPlanner({
  llmClient: config.llmClient,
  templates: config.templates
});
```

## Advanced Usage

### Custom Strategy Implementation

```javascript
import { PlanningStrategy } from '@legion/unified-planner';

class MyCustomStrategy extends PlanningStrategy {
  async generateBT(request, context = {}) {
    // Your custom BT generation logic
    return {
      type: 'sequence',
      id: 'custom_root',
      description: `Custom BT for: ${request.description}`,
      children: [
        // Custom BT structure
      ]
    };
  }
  
  canHandle(request) {
    // Return true if this strategy can handle the request
    return request.description.includes('custom');
  }
}

// Use custom strategy
const engine = new PlannerEngine();
engine.registerStrategy('custom', new MyCustomStrategy());
```

### Error Handling and Retries

```javascript
const planner = createLLMPlanner(llmClient, {
  maxRetries: 5,
  debugMode: true
});

try {
  const bt = await planner.createPlan(request);
  console.log('✅ Planning succeeded');
} catch (error) {
  console.error('❌ Planning failed:', error.message);
  
  if (error.message.includes('validation failed')) {
    console.error('Validation errors:', error.validationErrors);
  }
}
```

## Best Practices

### 1. Action Schema Definition
Define comprehensive schemas for your allowable actions:

```javascript
const allowableActions = [
  {
    type: 'processFile',
    description: 'Process a file with specified options',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { 
          type: 'string', 
          description: 'Path to the file' 
        },
        format: { 
          type: 'string', 
          enum: ['json', 'csv', 'xml'],
          description: 'Output format'
        },
        validate: { 
          type: 'boolean', 
          default: true,
          description: 'Whether to validate output' 
        }
      },
      required: ['filePath']
    },
    outputSchema: {
      type: 'object', 
      properties: {
        result: { type: 'string', description: 'Processed data' },
        metadata: { type: 'object', description: 'Processing metadata' }
      }
    },
    examples: [{
      description: 'Process JSON file',
      parameters: { filePath: 'data.json', format: 'json', validate: true }
    }]
  }
];
```

### 2. Template Organization
Organize templates by domain:

```
templates/
├── data-processing/
│   ├── csv-workflow.md
│   └── json-workflow.md
├── api-integration/
│   ├── rest-api.md
│   └── graphql-api.md
└── file-operations/
    ├── file-processing.md
    └── batch-processing.md
```

### 3. Strategy Selection
Choose strategies based on use case:

- **LLM Strategy**: Complex, novel tasks requiring reasoning
- **Template Strategy**: Well-defined, repeatable workflows
- **Rule Strategy**: Conditional logic based on context

### 4. Validation Integration
Always validate generated BTs:

```javascript
import { BTValidator } from '@legion/bt-validator';

const validator = new BTValidator({
  strictMode: true,
  validateTools: true,
  applyDefaults: true
});

const result = await validator.validate(bt, allowableActions);
if (!result.valid) {
  console.error('BT validation failed:', result.errors);
}
```

## Contributing

Contributions are welcome! Please ensure:

1. All tests pass: `npm test`
2. Code follows existing patterns
3. Add tests for new features
4. Update documentation

## License

MIT

## See Also

- [@legion/bt-validator](../bt-validator) - BT structure validation
- [@legion/actor-bt](../../shared/actor-bt) - BT execution engine
- [@legion/schema](../schema) - JSON Schema utilities
- [Legion Framework](https://github.com/maxximus-dev/Legion)