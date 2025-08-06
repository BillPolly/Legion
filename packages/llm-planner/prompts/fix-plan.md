# Plan Fix Template

## CONTEXT
You previously generated a plan that failed validation. You need to fix the specific validation errors while maintaining the original requirements.

### Original Request
**Description:** {{description}}
**Available inputs:** {{inputs}}
**Required outputs:** {{requiredOutputs}}
**Maximum steps:** {{maxSteps}}

### Allowable Actions
You MUST only use these exact action types:

{{actionsList}}

### Previous Plan (FAILED VALIDATION)
```json
{{failedPlan}}
```

### Validation Errors
The plan failed validation with these specific errors:

{{validationErrors}}

## FIX REQUIREMENTS

### Address Each Error
1. **Schema Errors**: Fix any structural issues (missing required fields, invalid formats, etc.)
2. **Tool Validation Errors**: Ensure all action types exist in allowable actions list
3. **Input/Output Field Errors**: Match exact field names from tool schemas
4. **Variable Flow Errors**: Ensure @variables are defined before use
5. **Dependency Errors**: Reference only existing step IDs

### Maintain Original Intent
- Keep the same overall plan structure and approach where possible
- Preserve the logical flow and sequencing of operations
- Maintain all original requirements (inputs, outputs, description)

### Use Correct Format
- Use **inputs** and **outputs** fields for actions (NOT "parameters") 
- Use **@variable** syntax to reference variables from previous steps
- Follow the exact JSON schema structure required

### Variable Flow Rules
- Variables must be defined in step outputs before being used in subsequent step inputs
- Use @variableName syntax consistently  
- Ensure proper dependency ordering so variables are available when needed

## RETURN FORMAT

Return a corrected JSON object with this exact structure:

```json
{
  "id": "unique-plan-id",
  "name": "Plan Name", 
  "description": "Plan description",
  "version": "1.0.0",
  "status": "draft",
  "inputs": [
    {
      "name": "inputName",
      "type": "string",
      "required": true, 
      "description": "Input description"
    }
  ],
  "steps": [
    {
      "id": "step-id",
      "name": "Step Name",
      "description": "Step description", 
      "type": "setup|implementation|integration|testing|deployment",
      "dependencies": ["dependent-step-id"],
      "actions": [
        {
          "type": "exact-action-type-from-allowable-actions",
          "inputs": {
            "inputField": "value-or-@variable"
          },
          "outputs": {
            "outputField": "variableName"
          }
        }
      ]
    }
  ]
}
```

Fix ALL the validation errors listed above and return a corrected plan that will pass validation.