# LLM Planner Prompt Templates

This directory contains markdown templates used by the LLM planner for generating and fixing plans.

## Templates

### create-plan.md
Used for initial plan generation. Contains instructions for:
- Using the new inputs/outputs format (not legacy parameters)
- @variable syntax for variable references
- Proper plan structure with required fields
- Tool usage constraints and examples

**Template Variables:**
- `{{description}}` - Task description
- `{{inputs}}` - Available input variables (comma-separated)
- `{{requiredOutputs}}` - Required output variables (comma-separated)  
- `{{maxSteps}}` - Maximum number of steps allowed
- `{{actionsList}}` - Formatted list of allowable actions with schemas

### fix-plan.md
Used when validation fails on an initial plan. Contains:
- Original request context
- Failed plan JSON
- Specific validation errors
- Instructions to fix each type of error
- Emphasis on maintaining original requirements

**Template Variables:**
- All variables from create-plan.md plus:
- `{{failedPlan}}` - JSON of the plan that failed validation
- `{{validationErrors}}` - Formatted list of validation errors

## Template Processing

Templates are processed by the `PromptTemplateLoader` class which:

1. **Loads template files** from this directory
2. **Substitutes variables** using `{{variableName}}` syntax
3. **Formats complex data** like action lists and error lists
4. **Warns about missing variables** during development

## Key Features

### Variable Substitution
- Simple values: `{{description}}` → `"Create a web app"`
- Arrays: `{{inputs}}` → `"input1, input2, input3"`
- Objects: `{{failedPlan}}` → formatted JSON

### Action Formatting
Allowable actions are formatted with full schema information:

```
- **file_write**: Write content to a file
  Inputs:
    filepath: string (required) - Path to file
    content: string (required) - Content to write
  Outputs:
    filepath: string - Created file path
    created: boolean - Whether file was created
```

### Error Formatting
Validation errors are numbered for clarity:

```
1. Tool 'nonexistent_tool' not found
2. Missing required field: description  
3. Invalid step type: unknown
```

## Usage in Code

```javascript
import { PromptTemplateLoader } from './PromptTemplateLoader.js';

const loader = new PromptTemplateLoader();

// Load create-plan template
const prompt = await loader.loadCreatePlanTemplate({
  description: 'Create a web app',
  inputs: ['requirements'],
  requiredOutputs: ['deployed_app'],
  allowableActions: [...],
  maxSteps: 20
});

// Load fix-plan template  
const fixPrompt = await loader.loadFixPlanTemplate({
  description: 'Create a web app',
  inputs: ['requirements'],
  requiredOutputs: ['deployed_app'],
  allowableActions: [...],
  maxSteps: 20,
  failedPlan: {...},
  validationErrors: ['Tool not found', 'Invalid format']
});
```

## Template Guidelines

When editing templates:

1. **Keep placeholder syntax consistent** - Use `{{variableName}}` format
2. **Provide clear examples** - Show expected JSON structure
3. **Emphasize new format** - Always use inputs/outputs, never parameters
4. **Include validation context** - Help LLM understand what went wrong
5. **Maintain formatting** - Use markdown headers and lists for clarity