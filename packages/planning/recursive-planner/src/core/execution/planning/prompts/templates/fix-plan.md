You made a plan to meet this goal: **{{goal}}**

## Original Planning Context

### Available Tools
{{#each tools}}
- **{{name}}**: {{description}}
{{#if input}}
  - Input: {{json input}}
{{/if}}
{{#if output}}
  - Output: {{json output}}
{{/if}}

{{/each}}

### Context You Had
{{context}}

## The Plan You Generated
```json
{{invalidPlan}}
```

## Validation Errors Found
Your plan had the following validation errors that must be fixed:

{{#each errorsByStep}}
**Step: {{@key}}**
{{#each this}}
- **{{type}}**: {{message}}
{{#if details}}
{{#if details.availableTools}}
  - Available tools: {{join details.availableTools ", "}}
{{/if}}
{{#if details.expectedParameters}}
  - Expected parameters: {{join details.expectedParameters ", "}}
{{/if}}
{{#if details.availableArtifacts}}
  - Available artifacts: @{{join details.availableArtifacts ", @"}}
{{/if}}
{{#if details.parameter}}
  - Problem parameter: {{details.parameter}}
{{/if}}
{{#if details.expectedType}}
  - Expected type: {{details.expectedType}}
{{/if}}
{{/if}}
{{/each}}

{{/each}}

## What the Plan Needs to Look Like

You need to generate a CORRECTED plan in the exact same JSON format that:

1. **Uses only available tools** from the list above
2. **Uses correct parameter names** exactly as shown in tool input specifications
3. **References artifacts properly** - only reference outputs that were named in earlier steps using @name
4. **Fixes dependency issues** - ensure all dependencies reference existing step IDs
5. **Saves outputs correctly** - when naming outputs, use the format: `"outputField": {"name": "artifactName", "description": "what this is"}`

### JSON Format Required:
```json
[
  {
    "id": "step_id",
    "description": "Clear description of what this step does",
    "tool": "exact_tool_name_from_available_tools",
    "params": {
      "exact_parameter_name": "value_or_@artifact_reference"
    },
    "dependencies": ["list_of_step_ids_this_depends_on"],
    "saveOutputs": {
      "output_field_name": {
        "name": "artifact_name",
        "description": "description of what this artifact contains"
      }
    }
  }
]
```

**Generate the corrected plan now:**