# Data-Driven Profile Architecture

The ProfilePlanner module now uses a data-driven architecture where profiles are defined as JSON files instead of JavaScript code. This makes it easy to add new development profiles without writing code.

## Architecture Overview

### 1. JSON Profile Format

Profiles are stored in `src/profiles/*.json` and follow this structure:

```json
{
  "name": "profile-name",
  "toolName": "profile_name_planner",
  "description": "What this profile does",
  "requiredModules": ["module1", "module2"],
  "defaultInputs": ["user_request", "project_context"],
  "defaultOutputs": ["file_created", "test_results"],
  "maxSteps": 25,
  "contextPrompts": [
    "Context about the development environment",
    "Best practices to follow"
  ],
  "allowableActions": [
    {
      "type": "action_type",
      "description": "What this action does",
      "inputs": {
        "param1": {
          "type": "string",
          "description": "Parameter description",
          "examples": ["example1", "example2"]
        }
      },
      "outputs": {
        "output1": {
          "type": "string",
          "description": "Output description"
        }
      }
    }
  ],
  "templates": {
    "template1": "Code template with {{PLACEHOLDERS}}"
  }
}
```

### 2. Automatic Tool Generation

Each JSON profile automatically becomes a Legion tool:

- Profile `javascript.json` → Tool `javascript_planner`
- Profile `python.json` → Tool `python_planner`
- Profile `web.json` → Tool `web_planner`

### 3. Tool Interface

Each generated tool has a simple interface:

```javascript
// Using the javascript_planner tool
const result = await tool.invoke({
  function: {
    name: 'javascript_planner',
    arguments: JSON.stringify({
      task: 'Create a calculator function that adds and subtracts',
      saveAs: 'calculator_plan' // Optional
    })
  }
});
```

### 4. ProfileManager

The ProfileManager handles:
- Loading JSON profiles from the filesystem
- Validating profiles against the schema
- Converting JSON actions to planner format
- Creating planning contexts for the LLM

### 5. Module Structure

```
ProfilePlannerModule
├── ProfileManager (loads JSON profiles)
├── ProfilePlannerTool (meta tool for listing profiles)
└── ProfileTool[] (one per JSON profile)
    ├── javascript_planner
    ├── python_planner
    └── web_planner
```

## Adding New Profiles

To add a new development profile:

1. Create a new JSON file in `src/profiles/`
2. Follow the schema defined in `profile-schema.json`
3. Define the profile's:
   - Name and tool name
   - Required Legion modules
   - Allowable actions with detailed inputs/outputs
   - Context prompts for the LLM
   - Optional code templates

The profile will automatically be loaded and exposed as a new tool.

## Benefits

1. **No Code Required**: Add new profiles by creating JSON files
2. **Self-Documenting**: JSON schema provides clear structure
3. **Validation**: Profiles are validated on load
4. **Consistent Interface**: All profile tools work the same way
5. **Easy Maintenance**: Update profiles without touching code
6. **Extensible**: Add new action types as needed

## Example Profiles

### JavaScript Profile
- Focus: Node.js development with Jest testing
- Actions: Create files, run tests, manage packages
- Required: file and node-runner modules

### Python Profile  
- Focus: Python development with pytest
- Actions: Create Python files, manage venv, run tests
- Required: file and python-runner modules

### Web Profile
- Focus: Frontend web development
- Actions: Create HTML/CSS/JS, start dev server
- Required: file, web-server, and node-runner modules