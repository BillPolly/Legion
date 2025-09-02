# Behavior Tree Generation Task

You are an expert Behavior Tree planner. Analyze the task and produce a single, executable behavior tree that uses ONLY the provided tools.

## Task
{{TASK_DESCRIPTION}}

## Available Tools (the ONLY tools you may use)
{{TOOLS}}

## Conventions

**JSON only**: Return ONLY valid JSON. No markdown, no code blocks, no comments, no explanations, no trailing commas.

**Node types**:
- `sequence`: Run children in order, stops on first failure
- `action`: Execute a tool with specific inputs and optional outputs

**Variables**:
- Store outputs with unique variable names: `"outputs": {"toolField": "unique_var_name"}`  
- Reference stored variables: `"@varName"`
- All variable names must be globally unique
- **IMPORTANT**: Only store outputs that will be used later - unused variables will cause validation failure
- You do NOT need to store every possible output - only store what you will reference with @varName

**Actions**:
- Use ONLY exact tool IDs from Available Tools (format: ModuleName.toolName)
- Use ONLY exact parameter names from tool specifications  
- Map only the output fields you need later
- Do not invent tools, parameters, or output fields

## Output Format

Return ONLY this JSON structure:

{
  "type": "sequence",
  "id": "root",
  "description": "Main task",
  "children": []
}

## Node Schemas

Action node:
{
  "type": "action",
  "id": "descriptive-id",
  "tool": "ModuleName.toolName",
  "description": "What this does",
  "inputs": {
    "paramName": "literal_value_or_@varName"
  },
  "outputs": {
    "toolOutputField": "unique_variable_name"
  }
}

Sequence node:
{
  "type": "sequence",
  "id": "descriptive-id", 
  "description": "What these steps accomplish",
  "children": []
}

## Rules

1. Use kebab-case for IDs
2. Keep variable names meaningful (user_id, output_path)
3. Order operations correctly (create before write, write before execute)
4. **CRITICAL**: Only store outputs you will use - the validator will REJECT plans with unused variables
5. If an output won't be referenced later with @varName, do NOT include it in outputs
6. Prefer simple, direct solutions

## Variable Reference Examples

✅ **CORRECT** - Store and use variable:
```json
"outputs": {"filepath": "script_path"}     // Store for later use
...
"inputs": {"script": "@script_path"}       // Use the stored variable
```

❌ **WRONG** - Store but never use (will be REJECTED):
```json
"outputs": {"code": "unused_code"}         // Stored but never used - VALIDATION ERROR
...  
"inputs": {"content": "hardcoded value"}   // Should use @unused_code instead
```

Generate the JSON now: