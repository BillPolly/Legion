# CodeAgent JSON Module

## Overview

The CodeAgent can be used as a JSON module in the jsEnvoy ecosystem, allowing it to be integrated as a tool in AI agents without writing any Module or Tool classes.

## Module Configuration

The `module.json` file defines two main tools:

### 1. `develop_code` Tool

Generates complete applications from requirements.

**Parameters:**
- `workingDirectory` (required): Directory where code should be generated
- `task` (required): High-level description of what to build
- `requirements`: Detailed requirements object with:
  - `frontend`: Frontend requirements
  - `backend`: Backend requirements  
  - `features`: Array of specific features
- `projectType`: Type of project (frontend/backend/fullstack)
- `config`: Additional CodeAgent configuration

**Output:**
- `projectType`: Type of project generated
- `filesGenerated`: Number of files created
- `testsCreated`: Number of test files created
- `qualityGatesPassed`: Whether quality checks passed
- `duration`: Time taken in milliseconds
- `workingDirectory`: Where code was generated

### 2. `fix_code` Tool

Fixes specific errors in existing code.

**Parameters:**
- `workingDirectory` (required): Directory containing code to fix
- `errors` (required): Array of error messages to fix
- `requirements`: Additional fix requirements

**Output:**
- `issuesFixed`: Number of issues resolved
- `qualityGatesPassed`: Whether quality checks passed
- `duration`: Time taken in milliseconds
- `filesModified`: List of modified files

## Usage Example

```javascript
import { ModuleFactory } from '@jsenvoy/module-loader';
import ResourceManager from '@jsenvoy/module-loader/src/resources/ResourceManager.js';
import { Agent } from '@jsenvoy/agent';

// Initialize ResourceManager
const resourceManager = new ResourceManager();
await resourceManager.initialize();

// Create ModuleFactory
const factory = new ModuleFactory(resourceManager);

// Load CodeAgent module
const codeAgentModule = await factory.createJsonModule('./module.json');
const tools = await codeAgentModule.getTools();

// Create an agent with code generation capabilities
const agent = new Agent({
  name: 'code-assistant',
  bio: 'I can generate complete applications',
  modelConfig: { /* your LLM config */ },
  tools: tools
});

// Use the agent
const response = await agent.run(
  'Create a todo list app with HTML frontend and REST API backend'
);
```

## Integration with Chat Agents

The CodeAgent tools integrate seamlessly with jsEnvoy chat agents:

1. **Load the module** using ModuleFactory
2. **Extract tools** using `getTools()`
3. **Pass tools** to Agent configuration
4. **Use natural language** to invoke code generation

The agent will automatically:
- Parse user requirements
- Call the appropriate tool (develop_code or fix_code)
- Handle the async code generation process
- Return structured results

## Error Handling

Both tools provide comprehensive error information:
- Error phase (initialization, planning, generation, etc.)
- Detailed error messages
- Stack traces for debugging

Errors are returned as ToolResult failures with structured data.

## Testing

The module includes comprehensive integration tests:

```bash
npm test -- __tests__/integration/json-module.test.js
```

Tests verify:
- Module loading from JSON
- Tool creation and configuration
- Parameter validation
- Error handling
- Output schemas

## Benefits

1. **No code required** - Just the module.json configuration
2. **Standard interface** - Works with any jsEnvoy agent
3. **Type-safe** - Full parameter and output validation
4. **Async support** - Handles long-running operations
5. **Error resilient** - Graceful error handling and reporting