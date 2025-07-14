# Code Agent Design Document

## Overview

The **@jsenvoy/code-agent** is an intelligent coding agent that can generate, test, and validate vanilla JavaScript projects. It operates within specified directories, plans multi-file project layouts, writes frontend and backend code, and ensures all code passes ESLint validation and Jest tests before completion.

## Architecture

### Core Principles

1. **No Frameworks Required**: Focuses on vanilla JavaScript (HTML/CSS/JS for frontend, Node.js for backend)
2. **No Build Systems**: Generated code runs directly without compilation or bundling
3. **Programmatic Quality Control**: ESLint rules and Jest tests are managed entirely in code
4. **State Persistence**: Always knows what it's working on and never finishes until quality gates pass
5. **Directory-Scoped Operations**: Works within specified directories with proper isolation
6. **Integration with jsEnvoy Ecosystem**: Leverages existing tools and patterns

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Code Agent                               │
├─────────────────────────────────────────────────────────────┤
│  Planning Layer                                             │
│  ├── ProjectPlanner     (Multi-file directory layouts)     │
│  ├── TaskTracker       (State management and persistence)  │
│  ├── CodeAnalyzer      (Existing code pattern detection)   │
│  └── ArchitecturalPlanner (Frontend/backend coordination) │
├─────────────────────────────────────────────────────────────┤
│  Operations Layer                                           │
│  ├── CodeGenerator     (Vanilla JS code generation)        │
│  ├── TestGenerator     (Jest test creation)                │
│  ├── LintRunner        (Programmatic ESLint control)       │
│  └── QualityChecker    (Quality gate enforcement)          │
├─────────────────────────────────────────────────────────────┤
│  Workflow Layer                                             │
│  ├── WorkflowManager   (Orchestrates coding workflows)     │
│  ├── StepValidator     (Validates step completion)         │
│  ├── IterativeProcessor (Handles fixing cycles)            │
│  └── StateManager      (Persistent state tracking)         │
├─────────────────────────────────────────────────────────────┤
│  Integration Layer                                          │
│  ├── File Operations   (@jsenvoy/general-tools)           │
│  ├── LLM Client        (@jsenvoy/llm)                     │
│  ├── Module Loading    (@jsenvoy/module-loader)           │
│  └── Resource Management (@jsenvoy/resource-manager)       │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. CodeAgent (Main Class)

The central orchestrator that manages the entire coding workflow.

**Responsibilities:**
- Initialize working directory context
- Coordinate between planning, operations, and workflow layers
- Maintain persistent state across sessions
- Handle both initial development and iterative fixing modes

**Key Methods:**
- `initialize(workingDirectory)` - Set up agent in target directory
- `planProject(requirements)` - Create comprehensive project plan
- `generateCode(plan)` - Generate code following the plan
- `runQualityChecks()` - Execute ESLint and Jest validation
- `iterativelyFix(errors)` - Fix issues until all quality gates pass

### 2. Planning Layer

#### ProjectPlanner
Plans multi-file directory structures and project architecture.

**Features:**
- Analyzes requirements to determine project structure
- Creates directory layouts for frontend/backend projects
- Plans file dependencies and import structures
- Generates project scaffolding templates

#### TaskTracker
Manages state and tracks what the agent is currently working on.

**Features:**
- Persists current task state to disk
- Tracks completion status of individual files/components
- Maintains history of changes and iterations
- Provides resumption capabilities after interruptions

#### CodeAnalyzer
Analyzes existing code to understand patterns and conventions.

**Features:**
- Detects existing coding patterns and styles
- Identifies project structure conventions
- Analyzes import/export patterns
- Determines appropriate coding standards to follow

#### ArchitecturalPlanner
Plans coordination between frontend and backend components.

**Features:**
- Designs API interfaces between frontend and backend
- Plans data flow and communication patterns
- Coordinates file organization across project layers
- Ensures consistent coding patterns across components

### 3. Operations Layer

#### CodeGenerator
Generates vanilla JavaScript code for both frontend and backend.

**Frontend Generation:**
- HTML files with semantic structure
- CSS with modern layout techniques (Flexbox, Grid)
- Vanilla JavaScript with ES6+ features
- DOM manipulation and event handling
- Fetch API for backend communication

**Backend Generation:**
- Node.js modules using ES6 imports/exports
- Express.js servers with RESTful APIs
- File system operations and data persistence
- Error handling and validation
- Middleware and routing

#### TestGenerator
Creates comprehensive Jest tests for all generated code.

**Features:**
- Unit tests for individual functions/modules
- Integration tests for component interactions
- Mock implementations for external dependencies
- Test data generation and fixtures
- Coverage analysis and reporting

#### LintRunner
Manages ESLint validation entirely through code (no config files).

**Features:**
- Dynamic rule configuration based on project type
- Programmatic rule definitions in JavaScript
- Automatic fixing of common issues
- Custom rule sets for frontend vs backend code
- Integration with iterative fixing workflow

#### QualityChecker
Enforces quality gates before allowing completion.

**Features:**
- Validates that all ESLint rules pass
- Ensures all Jest tests pass with adequate coverage
- Checks for code consistency across files
- Validates import/export correctness
- Enforces coding standards compliance

### 4. Workflow Layer

#### WorkflowManager
Orchestrates the complete coding workflow from start to finish.

**Workflow Steps:**
1. **Analysis**: Understand requirements and existing code
2. **Planning**: Create project structure and file organization
3. **Generation**: Write code following established patterns
4. **Testing**: Create and run comprehensive tests
5. **Linting**: Apply and fix ESLint issues
6. **Validation**: Ensure all quality gates pass
7. **Iteration**: Fix any remaining issues
8. **Completion**: Finalize only when everything works

#### StepValidator
Validates that each workflow step completes successfully.

**Features:**
- Checks that generated files are syntactically correct
- Validates that tests execute successfully
- Ensures ESLint passes with zero errors/warnings
- Verifies import/export consistency
- Confirms quality gate compliance

#### IterativeProcessor
Handles the iterative fixing process until success.

**Features:**
- Analyzes error messages from tests and linting
- Generates targeted fixes for specific issues
- Applies fixes incrementally to avoid introducing new errors
- Tracks fix attempts to prevent infinite loops
- Escalates to human intervention when needed

#### StateManager
Manages persistent state across agent sessions.

**Features:**
- Saves current progress to `.code-agent-state.json`
- Tracks which files have been completed
- Maintains history of iterations and fixes
- Enables resumption after interruptions
- Provides progress reporting and status updates

## Technical Implementation

### ESLint Integration (Programmatic)

Instead of using `.eslintrc` files, all ESLint configuration is managed in code:

```javascript
// Example: Dynamic ESLint configuration
const createEslintConfig = (projectType) => {
  const baseRules = {
    'no-unused-vars': 'error',
    'no-console': 'warn',
    'semi': ['error', 'always'],
    'quotes': ['error', 'single']
  };

  const frontendRules = {
    ...baseRules,
    'no-undef': 'error',
    'no-global-assign': 'error'
  };

  const backendRules = {
    ...baseRules,
    'no-process-exit': 'warn',
    'handle-callback-err': 'error'
  };

  return projectType === 'frontend' ? frontendRules : backendRules;
};
```

### Jest Configuration (Programmatic)

Jest tests are generated and configured entirely through code:

```javascript
// Example: Dynamic Jest test generation
const generateTest = (moduleFile, functionName) => {
  return `
import { ${functionName} } from './${moduleFile}';

describe('${functionName}', () => {
  test('should handle valid input', () => {
    // Generated test based on function analysis
  });

  test('should handle edge cases', () => {
    // Generated edge case tests
  });
});
`;
};
```

### File Operations Integration

Uses existing jsEnvoy file tools for all file system operations:

```javascript
// Example: File operations through jsEnvoy tools
const fileOps = new FileOperationsTool();

// Create directory structure
await fileOps.invoke({
  function: { name: 'directory_create', arguments: '{"dirpath": "./src"}' }
});

// Write generated code
await fileOps.invoke({
  function: { name: 'file_write', arguments: JSON.stringify({
    filepath: './src/main.js',
    content: generatedCode
  })}
});
```

## Operating Modes

### 1. Initial Development Mode

**Input**: Task description and working directory
**Process**:
1. Analyze requirements and create project plan
2. Set up directory structure
3. Generate code files following the plan
4. Create comprehensive tests
5. Apply linting and fix issues
6. Iterate until all quality gates pass

**Example**:
```javascript
const agent = new CodeAgent();
await agent.initialize('./my-project');
await agent.develop({
  task: "Create a todo list application with frontend and backend",
  requirements: {
    frontend: "HTML form for adding todos, display list with delete functionality",
    backend: "REST API with endpoints for CRUD operations, file-based storage"
  }
});
```

### 2. Iterative Fixing Mode

**Input**: Error reports or required changes
**Process**:
1. Analyze specific errors or requirements
2. Plan targeted fixes
3. Apply fixes incrementally
4. Re-run tests and linting
5. Continue iterating until success

**Example**:
```javascript
const agent = new CodeAgent();
await agent.initialize('./my-project');
await agent.fix({
  errors: [
    "Test failed: Expected 3 todos, received 2",
    "ESLint error: Unused variable 'todoId' in todo.js:15"
  ]
});
```

## Quality Gates

The agent enforces strict quality gates before considering any step complete:

### 1. ESLint Validation
- Zero errors allowed
- Zero warnings allowed (configurable)
- All rules pass programmatically
- Code style consistency enforced

### 2. Jest Test Requirements
- All tests must pass
- Minimum coverage threshold (default 80%)
- No skipped or pending tests
- All async operations properly tested

### 3. Code Consistency
- Import/export statements validate correctly
- No broken dependencies
- Consistent naming conventions
- Proper error handling patterns

### 4. Project Structure
- Files organized according to plan
- No orphaned or unused files
- Proper separation of concerns
- Clear module boundaries

## Integration with jsEnvoy Ecosystem

### File Operations
- Uses `@jsenvoy/general-tools` for all file system operations
- Leverages existing file reading, writing, and directory management
- Maintains security and sandboxing provided by existing tools

### LLM Integration
- Uses `@jsenvoy/llm` for intelligent code generation
- Leverages existing provider abstraction (OpenAI, Anthropic, etc.)
- Utilizes structured response parsing and validation

### Module Loading
- Follows `@jsenvoy/module-loader` patterns for tool organization
- Implements proper dependency injection
- Maintains compatibility with existing module system

### Resource Management
- Can be managed by `@jsenvoy/resource-manager` for lifecycle control
- Supports health checks and status monitoring
- Integrates with existing orchestration capabilities

## Future Enhancements

### Planned Features
1. **Framework Support**: Optional React, Vue, Angular support
2. **Build System Integration**: Webpack, Vite integration when needed
3. **Database Integration**: Support for various database backends
4. **Deployment Planning**: Automated deployment configuration
5. **Documentation Generation**: Automatic README and API docs
6. **Performance Optimization**: Code optimization suggestions
7. **Security Analysis**: Automated security vulnerability scanning

### Extension Points
- **Custom Templates**: User-defined project templates
- **Custom Rules**: Project-specific ESLint rules
- **Custom Workflows**: Specialized development workflows
- **Integration Hooks**: Pre/post-generation hooks for customization

## Conclusion

The Code Agent provides a comprehensive solution for automated code generation, testing, and validation in vanilla JavaScript projects. By integrating deeply with the jsEnvoy ecosystem while maintaining independence in code quality enforcement, it delivers a robust platform for AI-assisted development that ensures code reliability and maintainability.