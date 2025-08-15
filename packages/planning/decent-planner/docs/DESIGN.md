# Descent-Planner: Hierarchical Task Decomposition and Planning System

## Executive Summary

The Descent-Planner is a hierarchical planning system that enables AI agents to accomplish complex, multi-step goals through intelligent task decomposition and tool orchestration. It uses a two-step process: recursive decomposition of complex tasks into simple atomic blocks, followed by semantic tool discovery and behavior tree generation for execution.

## Core Architecture

### Two-Step Process

```
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Recursive Decomposition with Classification         │
├─────────────────────────────────────────────────────────────┤
│  Task → LLM Decomposes into subtasks with complexity labels  │
│                      ↓                                       │
│         For each subtask:                                    │
│         • COMPLEX → Recurse (go to Step 1)                   │
│         • SIMPLE → Continue to Step 2                        │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Tool Discovery and Planning                         │
├─────────────────────────────────────────────────────────────┤
│  Simple Task → Semantic Search → Relevant Tools              │
│                      ↓                                       │
│              Tools → Planner → Behavior Tree                 │
│                      ↓                                       │
│              Validator → Execution Ready                     │
└─────────────────────────────────────────────────────────────┘
```

## Key Concepts

### 1. Complexity Classification

Tasks are classified as either **SIMPLE** or **COMPLEX** based on clear guidelines:

**SIMPLE Tasks:**
- Can be accomplished with a focused set of tools (typically 1-10)
- Have a clear, plannable structure (may include sequences, choices, loops, retries)
- Well-defined inputs and outputs
- Self-contained logic that doesn't require coordination between multiple subsystems
- May include:
  - **Sequences**: Step-by-step operations
  - **Choices**: Conditional paths based on results
  - **Loops**: Iterating over items or until condition met
  - **Retries**: Handling transient failures
  - **Parallel operations**: Independent actions that can run simultaneously
- Examples:
  - "Create a database table with validation" (sequence + condition)
  - "Process all files in a directory" (loop + action)
  - "Try multiple API endpoints until one succeeds" (selector + retry)
  - "Parse JSON with error handling" (action + condition + fallback)
  - "Download and validate a file" (sequence + retry + validation)

**COMPLEX Tasks:**
- Require coordination between multiple distinct subsystems
- Involve multiple domains or areas of concern
- Have interdependencies between major components
- Need architectural decisions or design choices
- Examples:
  - "Build a web application with authentication"
  - "Set up CI/CD pipeline"
  - "Create a data analysis dashboard"
  - "Implement user management system"

### 2. Recursive Descent with I/O Hints

The system recursively decomposes complex tasks until all leaf nodes are simple, with informal input/output hints at each level:

```
"Build task management app" 
  Outputs: [working_app, deployment_config]
├── "Set up database" [COMPLEX]
│     Inputs: [requirements]
│     Outputs: [db_connection, schema]
│   ├── "Create database schema" [SIMPLE]
│   │     Inputs: [data_requirements]
│   │     Outputs: [schema_definition, models]
│   ├── "Set up connection pool" [SIMPLE]
│   │     Inputs: [db_url, credentials]
│   │     Outputs: [connection_pool, db_client]
│   └── "Create migration scripts" [SIMPLE]
│         Inputs: [schema_definition]
│         Outputs: [migration_files, seed_data]
├── "Create API endpoints" [COMPLEX]
│     Inputs: [db_connection, schema]
│     Outputs: [api_endpoints, api_docs]
│   ├── "Set up Express server" [SIMPLE]
│   │     Inputs: [port_config]
│   │     Outputs: [express_app, server_config]
│   ├── "Create task CRUD routes" [SIMPLE]
│   │     Inputs: [express_app, db_client, models]
│   │     Outputs: [task_endpoints, route_handlers]
│   └── "Add authentication middleware" [SIMPLE]
│         Inputs: [express_app, user_model]
│         Outputs: [auth_middleware, jwt_config]
└── "Build frontend" [COMPLEX]
      Inputs: [api_endpoints, api_docs]
      Outputs: [frontend_app, ui_components]
    ├── "Create React app structure" [SIMPLE]
    │     Inputs: [design_requirements]
    │     Outputs: [react_app, component_structure]
    ├── "Build task components" [SIMPLE]
    │     Inputs: [component_structure, api_docs]
    │     Outputs: [task_ui, state_management]
    └── "Connect to API" [SIMPLE]
          Inputs: [api_endpoints, task_ui]
          Outputs: [connected_app, api_client]
```

These I/O hints help:
- **Guide decomposition**: Complex tasks know what outputs their subtasks need to produce
- **Show dependencies**: Clear data flow between sibling and parent-child tasks
- **Inform the planner**: Hints get formalized into the artifact system

### 3. Context Management (Handled by Planner)

The existing **planner already provides complete context management** through its artifact system:

- **Input/Output Variables**: Each action can store results via `outputVariable`
- **Artifact References**: Subsequent actions reference via `context.artifacts['variableName']`
- **Validation**: Condition nodes ensure dependencies are met
- **Automatic Flow**: The planner handles all artifact propagation and validation

The decent-planner doesn't need to manage context rigorously - it can optionally provide hints about relationships between tasks, but the planner's existing system handles all the actual context flow:

```javascript
// The planner already does this:
{
  "type": "action",
  "tool": "database_create",
  "outputVariable": "dbSchema",  // Stores result
},
{
  "type": "action", 
  "tool": "api_create",
  "params": {
    "schema": "{{context.artifacts['dbSchema']}}"  // Uses previous result
  }
}
```

## System Components

### 1. DecentPlanner (Main Orchestrator)

**Responsibilities:**
- Coordinates the entire planning process
- Manages the hierarchy of decomposed tasks
- Orchestrates context flow between levels
- Aggregates results from all levels

**Key Methods:**
```javascript
class DecentPlanner {
  async plan(goal, options = {})
  async decompose(task, context = {})
  async discoverTools(simpleTask)
  async generateBehaviorTree(task, tools, context)
  async validatePlan(behaviorTree, tools)
}
```

### 2. TaskDecomposer (Decomposition + Classification)

**Responsibilities:**
- Uses LLM to break down tasks into subtasks
- Classifies each subtask as SIMPLE or COMPLEX in the same step
- Maintains task hierarchy and relationships
- Preserves context through decomposition levels

**Decomposition Prompt Structure:**
```
Given this task: [TASK]
Parent context: [AVAILABLE_ARTIFACTS]
Domain: [WEB_DEV|DATA_ANALYSIS|SYSTEM_ADMIN]

Break this down into subtasks. For each subtask:
1. Provide a clear description
2. Suggest what inputs it might need (informal, natural language)
3. Suggest what outputs it should produce (informal, natural language)
4. Classify as SIMPLE or COMPLEX
5. Explain your reasoning

SIMPLE = Can be accomplished with specific tools in a focused plan
COMPLEX = Needs further breakdown into smaller subtasks

The input/output suggestions should:
- Help clarify what the task actually does
- Show dependencies between tasks
- Guide further decomposition for complex tasks
- Provide hints to the planner (but planner makes final decisions)

Return as structured JSON with subtasks, I/O hints, and complexity labels.
```

**Response Format:**
```json
{
  "task": "Original task description",
  "subtasks": [
    {
      "id": "subtask-1",
      "description": "Set up database connection",
      "complexity": "SIMPLE",
      "reasoning": "Direct configuration with connection tools",
      "suggestedInputs": ["database_url", "credentials"],
      "suggestedOutputs": ["db_connection", "connection_pool"]
    },
    {
      "id": "subtask-2", 
      "description": "Build authentication system",
      "complexity": "COMPLEX",
      "reasoning": "Requires JWT setup, middleware, routes, validation - multiple subsystems",
      "suggestedInputs": ["user_model", "db_connection"],
      "suggestedOutputs": ["auth_middleware", "jwt_config", "auth_routes"]
    }
  ]
}
```

The suggested inputs/outputs serve two purposes:
1. **Guide further decomposition** - Complex tasks can use these to understand what their subtasks need to produce
2. **Inform the planner** - When a simple task reaches the planner, these suggestions help it create the rigorous artifact flow

### 3. Informal to Formal Context Flow

The decent-planner provides **informal suggestions** about inputs/outputs during decomposition, which eventually feed into the planner's **formal artifact system**.

**Two-Layer Context System:**

1. **Informal (Decomposition Layer)**
   - Suggested inputs/outputs in natural language
   - Non-rigorous but helpful for understanding dependencies
   - Guides both further decomposition and final planning
   - Example: "needs database_connection, produces api_endpoints"

2. **Formal (Planner Layer)**
   - Rigorous artifact management via outputVariable
   - Validated dependencies through condition nodes
   - Actual execution context with `context.artifacts['variableName']`
   - The planner converts informal suggestions into formal artifact flow

**Flow from Informal to Formal:**
```javascript
// Decomposition suggests (informal):
{
  "task": "Create user API",
  "suggestedInputs": ["database_schema", "auth_config"],
  "suggestedOutputs": ["user_endpoints", "api_docs"]
}

// Planner creates (formal):
{
  "type": "action",
  "tool": "generate_api_endpoints",
  "params": {
    "schema": "{{context.artifacts['dbSchema']}}",  // Formal reference
    "auth": "{{context.artifacts['authConfig']}}"
  },
  "outputVariable": "userEndpoints"  // Formal output
}
```

This two-layer approach provides flexibility during decomposition while ensuring rigorous execution through the planner's proven artifact system.

### 4. ToolDiscoveryBridge

**Responsibilities:**
- Interfaces with `@legion/tools-registry` SemanticToolSearch
- Maps simple tasks to relevant tools using existing semantic search
- Manages tool registry connection
- Handles tool availability and metadata

**Integration with @legion/tools-registry:**
```javascript
import { SemanticToolSearch } from '@legion/tools-registry';
import { ToolRegistry } from '@legion/tools-registry';

// Use the existing semantic search infrastructure
const toolSearch = await SemanticToolSearch.create(resourceManager, provider);
const tools = await toolSearch.searchTools(taskDescription, {
  limit: 10,
  threshold: 0.3
});
```

The tools package already provides:
- Natural language tool discovery
- MongoDB-backed tool registry with embeddings
- ONNX-based semantic search (384-dim vectors)
- Tool metadata and schema management

### 5. PlanOrchestrator

**Responsibilities:**
- Feeds tool collections to existing planner
- Manages behavior tree generation
- Handles validation and correction
- Optimizes execution order

## Data Flow

### 1. Decomposition Phase

```
User Goal
    ↓
TaskDecomposer.decompose(goal)
    ↓
Returns subtasks with:
  - Description (clarified by I/O)
  - Suggested inputs (informal)
  - Suggested outputs (informal)
  - Complexity label (SIMPLE/COMPLEX)
    ↓
For each subtask:
    if COMPLEX → Recursive decompose()
                  (using parent outputs as child inputs)
    if SIMPLE → Add to simple task list
                (with I/O hints for planner)
    ↓
Hierarchy of simple tasks with I/O hints
```

### 2. Planning Phase

```
Simple Task + I/O Hints + Context
    ↓
ToolDiscoveryBridge.discoverTools(task, hints)
    ↓
SemanticSearch.searchTools(enhanced_query)
    (Query enhanced with I/O hints for better tool matching)
    ↓
Relevant Tools Collection
    ↓
Planner.makePlan(requirements, tools, context_with_hints)
    (I/O hints help planner understand data flow)
    ↓
Planner converts informal I/O to formal artifacts:
  - suggestedInputs → context.artifacts references
  - suggestedOutputs → outputVariable assignments
    ↓
BTValidator.validate(behaviorTree, tools)
    ↓
Validated Behavior Tree with rigorous artifact flow
```

### 3. Context Propagation

```
Parent Level Artifacts
    ↓
    ├── Child Task 1 (receives parent artifacts)
    │   ├── Generates: artifact1, artifact2
    │   └── Returns to parent
    │
    ├── Child Task 2 (receives parent + sibling artifacts)
    │   ├── Uses: artifact1 from sibling
    │   ├── Generates: artifact3
    │   └── Returns to parent
    │
    └── Parent aggregates all child artifacts
```

## Integration Points

### 1. With Existing Planner

The decent-planner wraps the existing planner at each level:

```javascript
// For each simple task
const plan = await planner.makePlan(
  simpleTask.requirements,
  discoveredTools,
  {
    context: {
      artifacts: currentLevelArtifacts,
      parentGoal: parentTask.description
    }
  }
);
```

### 2. With @legion/tools-registry SemanticToolSearch

Tool discovery for each simple task using the existing infrastructure:

```javascript
import { SemanticToolSearch, ToolRegistry } from '@legion/tools-registry';

// Initialize with existing tool registry
const toolRegistry = new ToolRegistry({ provider: mongoProvider });
const semanticSearch = await SemanticToolSearch.create(
  resourceManager, 
  toolRegistry.provider
);

// Search for relevant tools
const tools = await semanticSearch.searchTools(
  simpleTask.description,
  {
    limit: 10,
    threshold: 0.3  // Already tuned for ONNX embeddings
  }
);

// Get executable tools from registry
const executableTools = await Promise.all(
  tools.map(t => toolRegistry.getTool(t.name))
);
```

### 3. With BT Validator

Validation at each level ensures correctness:

```javascript
const validation = await btValidator.validate(
  behaviorTree,
  availableTools,
  {
    artifacts: expectedArtifacts,
    strictMode: true
  }
);
```

## Example Workflows

### Example 1: Create a REST API

**Initial Goal:** "Create a REST API for task management with authentication"

**Decomposition with I/O Hints:**
```
Level 0: Create REST API [COMPLEX]
  Outputs: [api_server, api_documentation, auth_system]
├── Level 1: Set up project structure [SIMPLE]
│     Inputs: [project_name, requirements]
│     Outputs: [project_dir, package_json, folder_structure]
├── Level 1: Implement data layer [COMPLEX]
│     Inputs: [project_dir, data_requirements]
│     Outputs: [db_connection, models, repositories]
│   ├── Level 2: Define schemas [SIMPLE]
│   │     Inputs: [data_requirements]
│   │     Outputs: [task_schema, user_schema, db_models]
│   ├── Level 2: Create database connection [SIMPLE]
│   │     Inputs: [db_config, connection_string]
│   │     Outputs: [db_client, connection_pool]
│   └── Level 2: Implement repositories [SIMPLE]
│         Inputs: [db_client, db_models]
│         Outputs: [task_repository, user_repository]
├── Level 1: Create API endpoints [COMPLEX]
│     Inputs: [repositories, models, project_dir]
│     Outputs: [api_routes, express_app, api_docs]
│   ├── Level 2: Set up Express server [SIMPLE]
│   │     Inputs: [project_dir, port_config]
│   │     Outputs: [express_app, middleware_stack]
│   ├── Level 2: Implement CRUD routes [SIMPLE]
│   │     Inputs: [express_app, task_repository]
│   │     Outputs: [task_routes, crud_handlers]
│   └── Level 2: Add validation middleware [SIMPLE]
│         Inputs: [express_app, schemas]
│         Outputs: [validation_middleware, error_handlers]
└── Level 1: Add authentication [COMPLEX]
      Inputs: [express_app, user_repository]
      Outputs: [auth_middleware, jwt_config, protected_routes]
    ├── Level 2: Set up JWT [SIMPLE]
    │     Inputs: [secret_key, token_config]
    │     Outputs: [jwt_service, token_generator]
    ├── Level 2: Create auth routes [SIMPLE]
    │     Inputs: [express_app, jwt_service, user_repository]
    │     Outputs: [login_route, register_route, refresh_route]
    └── Level 2: Protect endpoints [SIMPLE]
          Inputs: [express_app, jwt_service, task_routes]
          Outputs: [protected_api, auth_middleware]
```

Notice how I/O hints:
- **Clarify task purpose**: "Set up Express server" produces `express_app` and `middleware_stack`
- **Show dependencies**: "Implement CRUD routes" needs `task_repository` from data layer
- **Guide tool selection**: Knowing outputs helps find the right tools

**Tool Discovery Enhanced by I/O Hints:**
```javascript
// Task with I/O hints
{
  description: "Set up Express server",
  suggestedInputs: ["project_dir", "port_config"],
  suggestedOutputs: ["express_app", "middleware_stack"]
}

// Enhanced semantic search query
Semantic Search: "Set up Express server create express_app middleware_stack using project_dir port_config"

// Better tool matches due to I/O context
Found Tools: [
  "generate_express_app",   // Best match - creates express app
  "file_write",             // For server.js file
  "npm_install",            // For dependencies
  "configure_middleware",   // For middleware stack
  "set_port_config"        // For port configuration
]
```

**Behavior Tree Generation (Simple but not just sequential):**
```json
{
  "type": "sequence",
  "id": "setup-express",
  "children": [
    {
      "type": "retry",
      "id": "init-with-retry",
      "maxAttempts": 3,
      "child": {
        "type": "action",
        "tool": "npm_init",
        "outputVariable": "packageJson"
      }
    },
    {
      "type": "selector",
      "id": "install-dependencies",
      "description": "Try npm, fall back to yarn if fails",
      "children": [
        {
          "type": "action",
          "tool": "npm_install",
          "params": { "packages": ["express", "cors", "helmet"] },
          "outputVariable": "deps"
        },
        {
          "type": "action",
          "tool": "yarn_add",
          "params": { "packages": ["express", "cors", "helmet"] },
          "outputVariable": "deps"
        }
      ]
    },
    {
      "type": "parallel",
      "id": "create-structure",
      "description": "Create directories and files simultaneously",
      "children": [
        {
          "type": "action",
          "tool": "directory_create",
          "params": { "path": "src" }
        },
        {
          "type": "action",
          "tool": "directory_create",
          "params": { "path": "tests" }
        },
        {
          "type": "action",
          "tool": "file_write",
          "params": {
            "filepath": "src/server.js",
            "content": "/* server template */"
          }
        }
      ]
    },
    {
      "type": "condition",
      "id": "verify-setup",
      "check": "context.artifacts['deps'].success === true",
      "description": "Ensure dependencies installed successfully"
    }
  ]
}
```

This simple task includes retries, fallback options (selector), parallel operations, and validation - still simple enough to plan in detail, but not just a linear sequence.

### Example 2: Data Analysis Pipeline

**Initial Goal:** "Analyze sales data and create visualization dashboard"

**Decomposition:**
```
Level 0: Analyze and visualize sales data [COMPLEX]
├── Level 1: Load and clean data [COMPLEX]
│   ├── Level 2: Read CSV files [SIMPLE]
│   ├── Level 2: Handle missing values [SIMPLE]
│   └── Level 2: Normalize data formats [SIMPLE]
├── Level 1: Perform analysis [COMPLEX]
│   ├── Level 2: Calculate metrics [SIMPLE]
│   ├── Level 2: Find trends [SIMPLE]
│   └── Level 2: Generate insights [SIMPLE]
└── Level 1: Create visualizations [COMPLEX]
    ├── Level 2: Generate charts [SIMPLE]
    ├── Level 2: Create dashboard layout [SIMPLE]
    └── Level 2: Export as HTML [SIMPLE]
```

## API Design

### Public API

```javascript
import { DecentPlanner } from '@legion/decent-planner';

// Initialize with dependencies
const planner = await DecentPlanner.create(resourceManager);

// Plan a complex task
const result = await planner.plan(
  "Build a task management web application",
  {
    domain: "web-development",
    maxDepth: 5,
    debug: true
  }
);

// Result structure
{
  success: true,
  data: {
    hierarchy: { /* decomposed task tree */ },
    behaviorTrees: { /* BT for each simple task */ },
    artifacts: { /* expected artifacts */ },
    executionPlan: { /* ordered execution sequence */ }
  }
}
```

### Integration Example

```javascript
// With existing Legion tools
import { TaskOrchestrator } from '@legion/aiur';
import { DecentPlanner } from '@legion/decent-planner';

const orchestrator = new TaskOrchestrator();
const planner = new DecentPlanner();

// Generate hierarchical plan
const plan = await planner.plan(userGoal);

// Execute with task orchestrator
const result = await orchestrator.executePlan(plan.data.executionPlan);
```

## Configuration

### Decomposition Configuration

```javascript
{
  decomposition: {
    maxDepth: 5,              // Maximum recursion depth
    maxWidth: 10,             // Max subtasks per level
    llmModel: "claude-3-5-sonnet-20241022",
    temperature: 0.3,
    complexityGuidelines: {
      // Guidelines provided to LLM for classification
      simpleTaskExamples: [
        "Create a database table",
        "Process files in a directory",
        "Set up Express server with error handling"
      ],
      complexTaskExamples: [
        "Build authentication system",
        "Create full web application",
        "Set up CI/CD pipeline"
      ]
    }
  }
}
```

### Tool Discovery Configuration

```javascript
{
  toolDiscovery: {
    semanticThreshold: 0.3,   // Minimum similarity score
    maxToolsPerTask: 10,      // Maximum tools to consider
    preferredDomains: [],     // Prioritize tools from domains
    excludedTools: []         // Never select these tools
  }
}
```

## Error Handling

### Decomposition Failures

- **Circular dependencies**: Detected and broken
- **Max depth exceeded**: Returns partial decomposition
- **LLM errors**: Retry with exponential backoff

### Tool Discovery Failures

- **No tools found**: Suggests missing tool requirements
- **Insufficient tools**: Attempts broader search
- **Tool conflicts**: Resolves based on priority

### Planning Failures

- **Invalid BT structure**: Uses validator feedback to correct
- **Missing artifacts**: Identifies and reports gaps
- **Validation errors**: Attempts automatic correction

## Performance Considerations

### Caching Strategy

- Cache decompositions for similar tasks
- Cache tool discoveries for common patterns
- Cache validated behavior trees

### Parallel Processing

- Decompose sibling tasks in parallel
- Discover tools for multiple tasks concurrently
- Generate behavior trees in parallel where possible

### Optimization

- Prune redundant decomposition branches
- Merge similar simple tasks
- Optimize tool collection sizes

## Testing Strategy

### Unit Tests

- Test each component in isolation
- Mock LLM responses for consistency
- Validate artifact propagation logic

### Integration Tests

- Test complete decomposition → planning flow
- Verify context management across levels
- Validate tool discovery accuracy

### End-to-End Tests

- Test real-world scenarios
- Measure decomposition quality
- Validate execution success rate

## Future Enhancements

### 1. Learning System

- Learn from successful decompositions
- Improve complexity classification over time
- Optimize tool selection patterns

### 2. Domain Specialization

- Domain-specific decomposition strategies
- Specialized complexity rules per domain
- Custom tool preferences by domain

### 3. Interactive Planning

- Allow user intervention during decomposition
- Support plan modification and refinement
- Provide decomposition alternatives

### 4. Execution Feedback

- Use execution results to improve planning
- Detect and correct systematic failures
- Adaptive replanning based on outcomes

## Conclusion

The Descent-Planner provides a powerful abstraction for complex task achievement through hierarchical decomposition and intelligent planning. By leveraging existing Legion components (semantic search, planner, validator) and adding recursive decomposition with context management, it enables AI agents to tackle arbitrarily complex goals while maintaining coherency and correctness at all levels.

The key innovation is the two-step process that separates the concerns of task understanding (decomposition) from execution planning (tool orchestration), connected by a robust context management system based on artifacts. This architecture is both powerful and extensible, supporting new domains and capabilities as they are added to the Legion ecosystem.