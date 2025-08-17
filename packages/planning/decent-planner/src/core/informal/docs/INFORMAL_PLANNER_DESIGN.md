# Informal Planner Design Document

## Overview

The Informal Planner is the first phase of the Decent-Planner system. It takes a high-level goal and recursively decomposes it into a hierarchy of tasks, classifying each as either SIMPLE (can be accomplished with tools) or COMPLEX (needs further decomposition). For each SIMPLE task, it discovers relevant tools to validate feasibility.

## Core Concepts

### Task Hierarchy

The informal planner produces a tree structure where:
- **Root node**: The original goal
- **Internal nodes**: COMPLEX tasks that were decomposed
- **Leaf nodes**: SIMPLE tasks that can be directly executed with tools

Each node contains:
- Task description
- Complexity classification (SIMPLE/COMPLEX)
- Informal I/O hints (natural language)
- For SIMPLE tasks: discovered tools that can accomplish the task

### Complexity Classification

Tasks are classified based on whether they can be accomplished with a focused set of tools:

**SIMPLE Tasks:**
- Can be accomplished with available tools (typically 1-10 tools)
- Have clear, well-defined scope
- May include sequences, conditionals, loops, retries
- Examples:
  - "Write content to a file"
  - "Parse JSON data"
  - "Create database connection"
  - "Install npm packages"

**COMPLEX Tasks:**
- Require coordination between multiple subsystems
- Too broad to plan directly with tools
- Need architectural decisions
- Examples:
  - "Build a web application"
  - "Create authentication system"
  - "Set up CI/CD pipeline"

### Informal I/O Hints

Each task includes informal hints about inputs and outputs in natural language:
- **Inputs**: What data/artifacts the task needs
- **Outputs**: What the task produces
- **Purpose**: Help understand task dependencies and data flow
- **Format**: Natural language descriptions, not formal schemas

Example:
```
Task: "Create Express server"
Inputs: ["port configuration", "middleware settings"]
Outputs: ["running server instance", "app object for routes"]
```

### Tool Discovery and Validation

For each SIMPLE task, the informal planner:
1. Uses semantic search to find relevant tools
2. Validates that sufficient tools exist
3. Includes discovered tools in the output
4. Marks the task as feasible or infeasible

This early validation ensures we don't decompose into tasks that cannot be executed.

## Architecture

### Input

The informal planner accepts:
```javascript
{
  goal: "Build a REST API for task management",
  context: {
    domain: "web-development",  // optional domain hint
    constraints: [],             // optional constraints
    preferences: []              // optional preferences
  }
}
```

### Output

The informal planner produces:
```javascript
{
  success: true,
  hierarchy: {
    id: "root-task-id",
    description: "Build a REST API for task management",
    complexity: "COMPLEX",
    reasoning: "Requires multiple subsystems: database, API, auth",
    subtasks: [
      {
        id: "task-1",
        description: "Initialize Node.js project",
        complexity: "SIMPLE",
        reasoning: "Can be done with npm and file tools",
        suggestedInputs: ["project name", "package config"],
        suggestedOutputs: ["package.json", "project structure"],
        tools: [
          { name: "npm_init", confidence: 0.95 },
          { name: "file_write", confidence: 0.90 },
          { name: "directory_create", confidence: 0.88 }
        ],
        feasible: true
      },
      {
        id: "task-2",
        description: "Set up database layer",
        complexity: "COMPLEX",
        reasoning: "Involves schema, connections, and migrations",
        suggestedInputs: ["database requirements"],
        suggestedOutputs: ["database connection", "models"],
        subtasks: [
          {
            id: "task-2-1",
            description: "Create database schema",
            complexity: "SIMPLE",
            reasoning: "Can use database and file tools",
            suggestedInputs: ["entity definitions"],
            suggestedOutputs: ["schema files", "model definitions"],
            tools: [
              { name: "file_write", confidence: 0.92 },
              { name: "database_execute", confidence: 0.85 }
            ],
            feasible: true
          }
        ]
      }
    ]
  },
  statistics: {
    totalTasks: 15,
    simpleTasks: 10,
    complexTasks: 5,
    maxDepth: 3,
    feasibleTasks: 10,
    infeasibleTasks: 0
  },
  validation: {
    allTasksFeasible: true,
    missingCapabilities: [],
    warnings: []
  }
}
```

## Processing Flow

### 1. Initial Decomposition

The LLM receives the goal and decomposes it:
```
Input: "Build a REST API for task management"
↓
LLM analyzes and identifies major components
↓
Output: Subtasks with complexity classifications
```

### 2. Recursive Processing

For each subtask:
```
If COMPLEX:
  → Recursively decompose (go to step 1)
  → Add subtasks as children

If SIMPLE:
  → Discover relevant tools via semantic search
  → Validate feasibility
  → Add tool list to task
```

### 3. Tool Discovery

For SIMPLE tasks:
```
Task description: "Create database connection"
↓
Semantic search in ToolRegistry
↓
Found tools: [database_connect, config_read, error_handler]
↓
Feasibility check: Do these tools suffice?
↓
Mark as feasible/infeasible with tool list
```

### 4. Validation

After full decomposition:
- Check all SIMPLE tasks have tools
- Verify no circular dependencies
- Ensure I/O hints are consistent
- Report any missing capabilities

## Interaction with Tool Registry

The informal planner uses the ToolRegistry's semantic search:

```javascript
// For each SIMPLE task
const tools = await toolRegistry.semanticToolSearch(
  taskDescription,
  {
    limit: 10,
    minConfidence: 0.7
  }
);

// Validate feasibility
const feasible = tools.length > 0 && 
                 tools[0].confidence > threshold;
```

## Decision Criteria

### When to Classify as SIMPLE

A task is SIMPLE when:
1. It has a clear, focused objective
2. Can be accomplished with available tools
3. Doesn't require architectural decisions
4. Has well-defined inputs and outputs

### When to Stop Decomposing

Decomposition stops when:
1. All leaf nodes are SIMPLE
2. Maximum depth is reached
3. A SIMPLE task has no matching tools (marked infeasible)

### Tool Sufficiency Threshold

A task is considered feasible when:
- At least one tool matches with confidence > 0.7
- OR multiple tools together can accomplish the task
- The tools' capabilities align with the task requirements

## Output Guarantees

The informal planner guarantees:

1. **Complete decomposition**: Every leaf node is SIMPLE
2. **Tool annotation**: Every SIMPLE task has discovered tools
3. **Feasibility assessment**: Each task marked as feasible/infeasible
4. **Dependency hints**: I/O relationships indicated informally
5. **Reasoning transparency**: Each classification includes reasoning

## Validation Rules

The output is valid when:

1. **Structure**: Proper tree hierarchy with unique IDs
2. **Classification**: Every task labeled SIMPLE or COMPLEX
3. **Completeness**: COMPLEX tasks have subtasks, SIMPLE tasks have tools
4. **Feasibility**: Infeasible tasks are clearly marked
5. **Consistency**: I/O hints align between parent-child tasks

## Error Conditions

The informal planner reports errors for:

1. **Circular dependencies**: Task A needs B, B needs A
2. **Missing capabilities**: No tools found for critical tasks
3. **Depth limit exceeded**: Recursion beyond safe limits
4. **Invalid decomposition**: LLM produces malformed structure
5. **Tool discovery failure**: Cannot access ToolRegistry

## Example Decomposition

### Input Goal
"Create a user authentication system with JWT"

### Output Hierarchy
```
Root: "Create user authentication system with JWT" [COMPLEX]
├── "Set up user model and database" [COMPLEX]
│   ├── "Define user schema" [SIMPLE]
│   │   Tools: [schema_generator, file_write]
│   ├── "Create database migrations" [SIMPLE]
│   │   Tools: [migration_create, database_execute]
│   └── "Implement user repository" [SIMPLE]
│       Tools: [code_generator, file_write]
├── "Implement JWT token management" [COMPLEX]
│   ├── "Generate JWT secrets" [SIMPLE]
│   │   Tools: [crypto_generate, env_write]
│   ├── "Create token generation function" [SIMPLE]
│   │   Tools: [code_generator, jwt_sign]
│   └── "Create token validation function" [SIMPLE]
│       Tools: [code_generator, jwt_verify]
└── "Create authentication endpoints" [COMPLEX]
    ├── "Implement registration endpoint" [SIMPLE]
    │   Tools: [express_route, password_hash, database_insert]
    ├── "Implement login endpoint" [SIMPLE]
    │   Tools: [express_route, password_verify, jwt_sign]
    └── "Implement logout endpoint" [SIMPLE]
        Tools: [express_route, token_invalidate]
```

## Integration Points

### With Formal Planner

The informal planner's output becomes input to the formal planner:
- Hierarchy structure guides synthesis order
- Tool lists inform behavior tree generation
- I/O hints help establish artifact flow

### With ToolRegistry

Direct integration for tool discovery:
- Uses `semanticToolSearch()` for natural language queries
- Accesses tool metadata for capability assessment
- No intermediate bridge or wrapper needed

### With LLM

The LLM provides:
- Task decomposition logic
- Complexity classification decisions
- I/O hint generation
- Reasoning explanations

## Success Criteria

The informal planner succeeds when:

1. **Decomposition quality**: Logical, complete breakdown of goal
2. **Tool discovery accuracy**: Relevant tools found for each task
3. **Feasibility correctness**: Accurate assessment of executability
4. **Hierarchy clarity**: Clear parent-child relationships
5. **Output usability**: Formal planner can use output directly

---

This design focuses on the MVP functionality of decomposing tasks and validating feasibility with available tools. The informal planner serves as the critical first phase that ensures we can actually execute what we're planning to do.