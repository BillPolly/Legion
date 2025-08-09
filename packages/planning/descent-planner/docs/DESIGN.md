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

### 2. Recursive Descent

The system recursively decomposes complex tasks until all leaf nodes are simple:

```
"Build task management app"
├── "Set up database" [COMPLEX]
│   ├── "Create database schema" [SIMPLE]
│   ├── "Set up connection pool" [SIMPLE]
│   └── "Create migration scripts" [SIMPLE]
├── "Create API endpoints" [COMPLEX]
│   ├── "Set up Express server" [SIMPLE]
│   ├── "Create task CRUD routes" [SIMPLE]
│   └── "Add authentication middleware" [SIMPLE]
└── "Build frontend" [COMPLEX]
    ├── "Create React app structure" [SIMPLE]
    ├── "Build task components" [SIMPLE]
    └── "Connect to API" [SIMPLE]
```

### 3. Context Management

Context flows through the hierarchy via the **artifact system**:

- **Input Artifacts**: Available context from parent/sibling tasks
- **Output Artifacts**: Results produced by this task
- **Artifact Propagation**: 
  - Parent → Child: Parent artifacts available to children
  - Sibling → Sibling: Through shared parent artifact space
  - Child → Parent: Child outputs become parent artifacts

Each behavior tree node can:
- Store results via `outputVariable`
- Reference previous results via `context.artifacts['variableName']`
- Validate dependencies via condition nodes

## System Components

### 1. DescentPlanner (Main Orchestrator)

**Responsibilities:**
- Coordinates the entire planning process
- Manages the hierarchy of decomposed tasks
- Orchestrates context flow between levels
- Aggregates results from all levels

**Key Methods:**
```javascript
class DescentPlanner {
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
2. Classify as SIMPLE or COMPLEX
3. Explain your reasoning

SIMPLE = Can be accomplished with specific tools in a focused plan
COMPLEX = Needs further breakdown into smaller subtasks

Return as structured JSON with subtasks and complexity labels.
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
      "reasoning": "Direct configuration with connection tools"
    },
    {
      "id": "subtask-2", 
      "description": "Build authentication system",
      "complexity": "COMPLEX",
      "reasoning": "Requires JWT setup, middleware, routes, validation - multiple subsystems"
    }
  ]
}
```

### 3. ContextManager

**Responsibilities:**
- Tracks artifacts at each hierarchy level
- Manages artifact inheritance
- Validates artifact references
- Handles artifact conflicts

**Artifact Flow:**
```javascript
{
  level: 2,
  taskId: "create-api",
  inputArtifacts: {
    "databaseSchema": { /* from sibling */ },
    "projectConfig": { /* from parent */ }
  },
  outputArtifacts: {
    "apiEndpoints": { /* produced by this task */ },
    "apiDocs": { /* produced by this task */ }
  }
}
```

### 4. ToolDiscoveryBridge

**Responsibilities:**
- Interfaces with `@legion/tools` SemanticToolSearch
- Maps simple tasks to relevant tools using existing semantic search
- Manages tool registry connection
- Handles tool availability and metadata

**Integration with @legion/tools:**
```javascript
import { SemanticToolSearch } from '@legion/tools';
import { ToolRegistry } from '@legion/tools';

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
Returns subtasks with complexity labels
    ↓
For each subtask:
    if COMPLEX → Recursive decompose()
    if SIMPLE → Add to simple task list
    ↓
Hierarchy of simple tasks
```

### 2. Planning Phase

```
Simple Task + Context
    ↓
ToolDiscoveryBridge.discoverTools(task, context)
    ↓
SemanticSearch.searchTools(query)
    ↓
Relevant Tools Collection
    ↓
Planner.makePlan(requirements, tools, context)
    ↓
BTValidator.validate(behaviorTree, tools)
    ↓
Validated Behavior Tree
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

The descent-planner wraps the existing planner at each level:

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

### 2. With @legion/tools SemanticToolSearch

Tool discovery for each simple task using the existing infrastructure:

```javascript
import { SemanticToolSearch, ToolRegistry } from '@legion/tools';

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

**Decomposition:**
```
Level 0: Create REST API [COMPLEX]
├── Level 1: Set up project structure [SIMPLE]
├── Level 1: Implement data layer [COMPLEX]
│   ├── Level 2: Define schemas [SIMPLE]
│   ├── Level 2: Create database connection [SIMPLE]
│   └── Level 2: Implement repositories [SIMPLE]
├── Level 1: Create API endpoints [COMPLEX]
│   ├── Level 2: Set up Express server [SIMPLE]
│   ├── Level 2: Implement CRUD routes [SIMPLE]
│   └── Level 2: Add validation middleware [SIMPLE]
└── Level 1: Add authentication [COMPLEX]
    ├── Level 2: Set up JWT [SIMPLE]
    ├── Level 2: Create auth routes [SIMPLE]
    └── Level 2: Protect endpoints [SIMPLE]
```

**Tool Discovery (for "Set up Express server"):**
```javascript
Semantic Search: "Set up Express server"
Found Tools: [
  "npm_init",
  "npm_install",
  "file_write",
  "directory_create",
  "generate_express_app"
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
import { DescentPlanner } from '@legion/descent-planner';

// Initialize with dependencies
const planner = await DescentPlanner.create(resourceManager);

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
import { DescentPlanner } from '@legion/descent-planner';

const orchestrator = new TaskOrchestrator();
const planner = new DescentPlanner();

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