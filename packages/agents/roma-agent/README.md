# ROMA Agent

**R**ecursive **O**bjective **M**anagement **A**gent - A sophisticated AI agent that handles complex tasks through intelligent decomposition and recursive execution.

## Overview

ROMA Agent is designed to tackle both simple and complex tasks by:

1. **Task Classification**: Uses LLM-based classification to determine if tasks are SIMPLE (direct execution) or COMPLEX (requires decomposition)
2. **Tool Discovery**: Employs semantic search to find relevant tools for task execution
3. **Recursive Decomposition**: Breaks complex tasks into manageable subtasks
4. **Artifact Management**: Tracks and manages outputs between task steps

## Key Features

- **Intelligent Task Classification**: Automatically determines task complexity
- **Semantic Tool Discovery**: Finds appropriate tools using LLM-generated descriptions
- **TemplatedPrompt Integration**: All validation handled by modern prompt system
- **Session Logging**: Comprehensive logging with automatic rotation and cleanup
- **Recursive Strategy**: Handles arbitrarily complex task hierarchies

## Architecture

### Core Components

- **SimpleROMAAgent**: Main agent class that orchestrates task execution
- **RecursiveDecompositionStrategy**: Strategy for handling task decomposition and execution
- **TaskClassifier**: LLM-based classification of task complexity
- **ToolDiscovery**: Semantic tool discovery using LLM descriptions
- **SessionLogger**: Logging system with automatic cleanup

### Task Flow

1. **Classification**: Task is classified as SIMPLE or COMPLEX
2. **Tool Discovery**: Relevant tools are discovered using semantic search
3. **Execution**: 
   - **SIMPLE**: Direct tool execution with artifact management
   - **COMPLEX**: Recursive decomposition into subtasks
4. **Evaluation**: Progress evaluation and completion assessment

## Usage

```javascript
import SimpleROMAAgent from '@legion/roma-agent';

const agent = new SimpleROMAAgent();
await agent.initialize();

const result = await agent.execute({
  description: 'Create a Node.js REST API with authentication'
});

console.log(result);
```

## Dependencies

- `@legion/prompting-manager` - Modern prompt system with built-in validation
- `@legion/tasks` - Task and artifact management
- `@legion/tools-registry` - Tool discovery and execution
- `@legion/resource-manager` - Resource and configuration management

## Clean Architecture

This implementation follows clean architecture principles:
- No legacy ResponseValidator code (superseded by TemplatedPrompt)
- Focused, single-responsibility classes
- Clear separation of concerns
- Comprehensive test coverage