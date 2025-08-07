# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a modular, recursive agent framework for building intelligent systems. The framework implements autonomous agents that can plan, reason, delegate to tools or sub-agents, and report results. It's built with ES6 modules and designed for LLM-driven reasoning and tool use in production environments.

## Essential Commands

### Development and Testing

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run specific test file
NODE_ENV=test NODE_OPTIONS=--experimental-vm-modules jest tests/unit/agent-config.test.js

# Run integration tests only
NODE_ENV=test NODE_OPTIONS=--experimental-vm-modules jest tests/integration/

# Run e2e tests (requires LLM configuration)
NODE_ENV=test NODE_OPTIONS=--experimental-vm-modules jest tests/e2e/

# Start development with watch mode
npm run dev

# Run examples
node examples/basic-usage.js
node examples/config-demo.js
```

## Architecture Overview

### Core Components

The framework follows a recursive execution tree pattern with these key components:

1. **PlanningAgent** (`src/core/agents/base/PlanningAgent.js`): Main recursive agent that plans, executes, reflects, and delegates. Supports LLM-based reflection and decision-making.

2. **AgentConfig** (`src/core/agents/base/AgentConfig.js`): Configuration management for agents with validation and defaults.

3. **Planning Strategies** (`src/core/execution/planning/strategies/`): Modular strategies for generating execution plans (LLM-based, template-based, etc.).

4. **AtomicTool** (`src/core/execution/tools/AtomicTool.js`): Stateless, single-operation executables that agents can use.

5. **ArtifactStore** (`src/core/storage/artifacts/`): Working memory for storing intermediate results and managing agent state.

### Directory Structure

- `src/core/`: Core framework components (agents, execution, storage)
- `src/factories/`: Factory functions for creating agents and tools
- `src/foundation/`: Base types, interfaces, utilities, and error types
- `src/runtime/`: Configuration management, error handling, observability
- `tests/`: Comprehensive test suite (unit, integration, e2e)
- `examples/`: Usage examples and demos
- `docs/`: Design documentation

### Key Design Patterns

1. **Recursive Execution**: Agents can spawn sub-agents, creating execution trees
2. **Dependency Injection**: Dependencies are injected via `setDependencies()` method
3. **Strategy Pattern**: Pluggable planning, error recovery, and resource management strategies
4. **Observer Pattern**: Built-in tracing and monitoring capabilities
5. **Factory Pattern**: Simplified agent and tool creation via factory functions

## Testing Guidelines

The project uses Jest with ES6 module support. Key testing patterns:

1. **Mock Execution Environment** (`tests/utils/MockExecutionEnvironment.js`): Provides controlled testing environment for agents
2. **All tests must use ES6 module syntax** (import/export)
3. **Environment variable required**: `NODE_ENV=test` for all test runs
4. **Node options required**: `NODE_OPTIONS=--experimental-vm-modules` for Jest compatibility

## Common Development Tasks

### Creating a New Agent

```javascript
import { PlanningAgent, AgentConfig } from './src/core/agents/base/index.js';
import { TemplatePlanningStrategy } from './src/core/execution/planning/strategies/index.js';

const config = new AgentConfig({
  name: 'MyAgent',
  description: 'Custom agent for specific task',
  debugMode: true,
  maxRetries: 3
});

const planner = new TemplatePlanningStrategy(templates);
const agent = new PlanningAgent(config, planner);
```

### Creating a New Tool

```javascript
import { AtomicTool } from './src/core/execution/tools/index.js';

const tool = new AtomicTool(
  'toolName',
  'Tool description',
  async (input) => {
    // Implementation
    return result;
  },
  validator // Optional input validator
);
```

### Running Tests with LLM Integration

For e2e tests that require LLM integration, set environment variables:

```bash
export ANTHROPIC_API_KEY="your-key"
export OPENAI_API_KEY="your-key"
NODE_ENV=test NODE_OPTIONS=--experimental-vm-modules jest tests/e2e/
```

## Tool Architecture Development

The project is implementing a comprehensive tool architecture following the design in `tools/docs/TOOL_ARCHITECTURE.md`. 

### Development Plan Tracking

**CRITICAL RULE**: When working on the tool architecture implementation, you MUST update the development plan at `tools/docs/DEVELOPMENT_PLAN.md`. 

- Mark completed phases with GREEN TICK ✅ 
- Mark completed steps with GREEN TICK ✅
- Update progress regularly as work is completed
- Never leave completed work unmarked in the development plan

The development plan follows a Test-Driven Development (TDD) approach:
1. Write tests first (RED phase)  
2. Implement minimal code to make tests pass (GREEN phase)
3. Skip refactor (aim to get it right first time)

### Tool Architecture Structure

The tool architecture consists of three main classes:
1. **ModuleDefinition**: Defines module types with static `create()` and `getMetadata()` methods
2. **ModuleInstance**: Holds tools and provides them by name via `getTool(name)`
3. **Tool**: Executes operations with `execute(input)` and provides `getMetadata()`

The primary value is **wrapping existing functionality** (Node.js libraries, CLI tools, APIs, MCP servers) rather than building from scratch.

## BT-Driven Software Development Framework

The project includes a comprehensive BT-driven Software Development framework in the `BT/SD/` directory.

### SD Framework Development Plan Tracking

**CRITICAL RULE**: When working on the SD framework implementation, you MUST update the development plan at `BT/SD/docs/DEVELOPMENT_PLAN.md`. 

- Mark completed phases with GREEN TICK ✅ 
- Mark completed steps with GREEN TICK ✅
- Update progress IMMEDIATELY as work is completed
- Never leave completed work unmarked in the development plan

The SD framework development plan follows a strict Test-Driven Development (TDD) approach:
1. Write tests first that fail (RED phase)  
2. Implement code to make tests pass - aim to get it right first time (GREEN phase)
3. Skip refactor step - write clean, well-structured code from the start

### SD Framework Structure

The SD framework combines multiple software development methodologies:
1. **Domain-Driven Design (DDD)**: Domain modeling agents
2. **Test-Driven Development (TDD)**: Testing agents and workflows
3. **Clean Architecture**: Architecture enforcement agents
4. **Clean Code**: Quality assurance agents

The framework includes 35+ specialized agents orchestrated through Behavior Trees, with MongoDB persistence for all project artifacts.

## Important Notes

1. **ES6 Modules**: This project uses ES6 modules exclusively. Always use `import/export` syntax, not `require/module.exports`.

2. **Async/Await**: All agent and tool execution is asynchronous. Always use async/await patterns.

3. **Error Handling**: The framework includes comprehensive error types in `src/foundation/types/errors/`. Use appropriate error types for better debugging.

4. **Resource Management**: Agents support resource constraints (time, memory, tool calls). Configure appropriately for production use.

5. **Debugging**: Enable `debugMode` in AgentConfig for detailed console logging during development.

6. **Dependencies**: The framework supports both Anthropic and OpenAI LLMs. Configure via environment variables or direct instantiation.

7. **Development Plan Updates**: ALWAYS update `tools/docs/DEVELOPMENT_PLAN.md` with ✅ when phases/steps are completed.