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
- Each step should have a name, description, and type (setup, implementation, validation, cleanup, documentation, testing, deployment)
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
          "toolName": "directory_create",
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
          "toolName": "file_write",
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
      "name": "user_request",
      "type": "string", 
      "required": true,
      "description": "User's requirements for the task"
    }
  ],
  "steps": [
    {
      "id": "step-id",
      "name": "Step Name",
      "description": "Step description",
      "type": "setup",
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
- Actions MUST use "toolName" field (NOT "type")
- Actions MUST have "inputs" object and optional "outputs" object
- Step "type" MUST be one of: setup, implementation, validation, cleanup, documentation, testing, deployment
- Plan inputs array: Each object must have "name" field (can be lowercase, uppercase, or mixed case)
- Input names must start with letter or underscore and contain only letters, numbers, and underscores
- NO extra fields allowed - schema is strict
- Follow exact field structure shown above

**CRITICAL JSON FORMATTING - THIS BREAKS PARSING:**
🚨 **NEVER use backticks (`) - they create invalid JSON that cannot be parsed!**
- ❌ WRONG: "content": `multiline string`
- ✅ CORRECT: "content": "multiline\\nstring"
- Use \\n for line breaks in strings
- Use double quotes only, never single quotes
- For multiline content like README files, use escaped newlines: "Line 1\\nLine 2\\nLine 3"
- Backticks inside strings are fine: "Run `npm install` to setup"

Generate a complete, executable plan that produces all required outputs and follows proper variable flow.