# Plan Generation Template

Create a structured plan for: {{description}}

## REQUIREMENTS
- Available inputs: {{inputs}}
- Required outputs: {{requiredOutputs}}  
- Maximum steps: {{maxSteps}}

## ALLOWABLE ACTIONS
You MUST only use these exact action types:

{{actionsList}}

## PLAN STRUCTURE REQUIREMENTS

### New Format (REQUIRED)
- Use **inputs** and **outputs** fields for actions (NOT "parameters")
- Use **@variable** syntax to reference variables from previous steps
- Variables flow forward through the plan execution
- Each step's outputs become available as variables for subsequent steps

### Plan Structure
- Create a hierarchical plan with steps that can contain sub-steps or actions
- Each step should have a name, description, and type (setup, implementation, integration, testing, deployment)
- Steps can have dependencies on other steps (use step IDs)
- At the leaf level, use only the allowable actions listed above
- Each action must use the exact type and input/output signature from the allowable actions

### Variable Flow Example
```json
{
  "steps": [
    {
      "id": "step-1",
      "actions": [
        {
          "type": "directory_create",
          "inputs": {
            "dirpath": "/project"
          },
          "outputs": {
            "dirpath": "projectDir",
            "created": "dirCreated"
          }
        }
      ]
    },
    {
      "id": "step-2", 
      "dependencies": ["step-1"],
      "actions": [
        {
          "type": "file_write",
          "inputs": {
            "filepath": "@projectDir/README.md",
            "content": "Project documentation"
          },
          "outputs": {
            "filepath": "readmeFile"
          }
        }
      ]
    }
  ]
}
```

## CRITICAL ACTION FORMAT
- Each action MUST have a "toolName" field that exactly matches one of the allowable tool names above
- Each action MUST have an "inputs" object with the exact input field names shown in the allowable actions  
- Each action MUST have an "outputs" object mapping output field names to variable names
- Use @variableName syntax to reference variables from previous step outputs
- DO NOT use a "parameters" field - use "inputs" instead
- DO NOT use tool names that are not in the allowable actions list

## CONSTRAINTS  
- You can only use the tool names provided in the allowable actions list
- Each action must specify its inputs and outputs exactly as defined
- Steps can be hierarchical (steps containing sub-steps)
- Dependencies must reference actual step IDs
- The plan must be executable in the specified order
- Ensure input/output variable flow is valid (each @variable must be defined by previous steps)

## RETURN FORMAT

Return a JSON object with this exact structure:

```json
{
  "id": "unique-plan-id",
  "name": "Plan Name",
  "description": "Plan description", 
  "version": "1.0.0",
  "status": "draft",
  "inputs": [
    {
      "name": "INPUT_NAME",
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
      "type": "setup|implementation|validation|cleanup",
      "dependencies": ["dependent-step-id"],
      "steps": [
        // Optional sub-steps (same structure)
      ],
      "actions": [
        {
          "toolName": "exact-tool-name-from-allowable-actions",
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

**CRITICAL REQUIREMENTS:**
- Plan MUST have "id" field (unique identifier)
- Step "type" MUST be one of: setup, implementation, validation, cleanup
- Input names MUST be UPPERCASE (e.g., "INPUT_NAME")
- Follow exact field structure shown above

Generate a complete, executable plan that produces all required outputs and follows proper variable flow.