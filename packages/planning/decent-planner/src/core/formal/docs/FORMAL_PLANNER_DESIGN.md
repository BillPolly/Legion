# Formal Planner Design Document

## Overview

The Formal Planner is the second phase of the Decent-Planner system. It takes the hierarchical task decomposition from the Informal Planner and synthesizes executable Behavior Trees (BTs) using a bottom-up approach. The key innovation is that **Behavior Trees generated at lower levels become synthetic tools at higher levels**, enabling compositional planning where complex behaviors are built from simpler ones.

## Core Concepts

### Bottom-Up Synthesis

The formal planner processes the task hierarchy from leaves to root:

1. **Start at leaf nodes** - All SIMPLE tasks with discovered tools
2. **Generate BTs for leaves** - Create executable plans using real tools
3. **Transform BTs to tools** - Each leaf BT becomes a synthetic tool
4. **Process parent level** - Use synthetic tools from children plus real tools
5. **Continue upward** - Until root task has a complete BT

### BT-as-Tool Transformation

The fundamental innovation: **The Planner creates complete, valid BTs which are then wrapped as tools** - no transformation of the BT itself is needed.

```
Level 2: [SIMPLE Task] → [Planner generates valid BT] → [Wrap as Synthetic Tool]
                                                         ↓
Level 1: [COMPLEX Task] → [Planner generates valid BT using synthetic tools]
                                                         ↓
Level 0: [Root Task] → [Final executable BT]
```

### Synthetic Tools

A synthetic tool is a **wrapper around a complete, valid Behavior Tree** that:
- Stores the BT directly in its `executionPlan` field (no modification)
- Has a defined interface (inputs/outputs extracted from the BT)
- Appears as a single atomic operation to the parent level
- When executed, simply passes its BT to BehaviorTreeExecutor
- Returns the BT execution results to the parent

## Architecture

### Processing Flow

```
Informal Planner Output (Task Hierarchy)
            ↓
    Identify Leaf Nodes
            ↓
    For Each Leaf Node:
        - Get discovered tools
        - Generate BT using existing planner
        - Validate BT
        - Create Synthetic Tool
        - Register in temporary registry
            ↓
    Process Parent Level:
        - Gather child synthetic tools
        - Combine with real tools if needed
        - Generate parent BT
        - Create parent synthetic tool
            ↓
    Continue Until Root
            ↓
    Final Executable BT
```

### Synthetic Tool Creation

When a BT is transformed into a tool:

```javascript
// Original BT at child level
{
  type: "sequence",
  id: "create-database",
  children: [
    { type: "action", tool: "create_schema", outputVariable: "schema" },
    { type: "action", tool: "run_migrations", params: { schema: "{{schema}}" } }
  ]
}

// Becomes synthetic tool at parent level
{
  name: "task_create_database",
  description: "Create database with schema and migrations",
  inputSchema: {
    database_config: "object",
    migration_path: "string"
  },
  outputSchema: {
    schema: "object",
    connection: "object"
  },
  executionPlan: { /* original BT */ },
  type: "synthetic"
}
```

### Level Processing

Each level is processed independently but in sequence:

1. **Collect all nodes at current level**
2. **Separate SIMPLE (plan now) from COMPLEX (plan later)**
3. **For SIMPLE nodes:**
   - Use real tools + child synthetic tools
   - Generate BT via existing planner
   - Validate and optimize
4. **For COMPLEX nodes:**
   - Wait for child processing
   - Then treat as SIMPLE with synthetic tools

## Key Components

### FormalPlanner

The main orchestrator that:
- Manages bottom-up traversal
- Coordinates level processing
- Maintains synthetic tool registry
- Aggregates final results

```javascript
class FormalPlanner {
  async synthesize(taskHierarchy)
  async processLevel(nodes, syntheticTools)
  async createFinalPlan(rootBT, allSyntheticTools)
}
```

### SyntheticToolFactory

Transforms BTs into tools:
- Extracts interface from BT artifacts
- Generates tool metadata
- Creates execution wrapper
- Handles artifact mapping

```javascript
class SyntheticToolFactory {
  createFromBT(behaviorTree, taskNode)
  extractInterface(bt, ioHints)
  generateMetadata(task, bt)
  createExecutor(bt)
}
```

### LevelProcessor

Handles one level of the hierarchy:
- Collects nodes at current depth
- Manages tool availability (real + synthetic)
- Invokes planner for each task
- Validates results

```javascript
class LevelProcessor {
  async processNodes(nodes, availableTools)
  async planTask(task, tools)
  validateLevelConsistency(plans)
}
```

### ArtifactMapper

Maps artifacts between levels:
- Traces artifact flow from child to parent
- Renames artifacts to avoid conflicts
- Maintains artifact lineage
- Handles aggregation patterns

```javascript
class ArtifactMapper {
  mapChildArtifacts(childBTs, parentContext)
  resolveConflicts(artifacts)
  createAggregateArtifact(childArtifacts)
}
```

## Data Flow Example

### Input: Task Hierarchy

```
Root: "Set up web server" [COMPLEX]
├── "Install dependencies" [SIMPLE]
│   Tools: [npm_install, package_json_create]
├── "Configure server" [COMPLEX]
│   ├── "Create config files" [SIMPLE]
│   │   Tools: [file_write, json_validate]
│   └── "Set up middleware" [SIMPLE]
│       Tools: [middleware_configure, express_setup]
└── "Start server" [SIMPLE]
    Tools: [node_execute, port_check]
```

### Level 2 Processing (Leaves)

```javascript
// "Create config files" → BT
{
  type: "sequence",
  children: [
    { type: "action", tool: "file_write", outputVariable: "configFile" },
    { type: "action", tool: "json_validate", params: { file: "{{configFile}}" } }
  ]
}
// → Synthetic Tool: "task_create_config_files"

// "Set up middleware" → BT
{
  type: "sequence",
  children: [
    { type: "action", tool: "express_setup", outputVariable: "app" },
    { type: "action", tool: "middleware_configure", params: { app: "{{app}}" } }
  ]
}
// → Synthetic Tool: "task_setup_middleware"
```

### Level 1 Processing (Complex Parent)

```javascript
// "Configure server" using synthetic tools from children
{
  type: "sequence",
  children: [
    { type: "action", tool: "task_create_config_files", outputVariable: "config" },
    { type: "action", tool: "task_setup_middleware", params: { config: "{{config}}" } }
  ]
}
// → Synthetic Tool: "task_configure_server"
```

### Level 0 Processing (Root)

```javascript
// Root task using mix of synthetic and simple tasks
{
  type: "sequence",
  children: [
    { type: "action", tool: "npm_install", outputVariable: "deps" },
    { type: "action", tool: "task_configure_server", outputVariable: "serverConfig" },
    { type: "action", tool: "node_execute", params: { config: "{{serverConfig}}" } }
  ]
}
```

## Artifact Propagation

### Within a Level

Each BT manages its own artifacts:
- Actions produce artifacts via `outputVariable`
- Subsequent actions reference via `context.artifacts`
- Standard BT artifact flow applies

### Between Levels

Synthetic tools handle artifact translation:
- Child BT outputs become tool outputs
- Parent receives aggregated results
- Naming conflicts resolved automatically
- Lineage preserved for debugging

Example:
```javascript
// Child BT produces
{ 
  artifacts: {
    "schema": { /* ... */ },
    "connection": { /* ... */ }
  }
}

// Parent sees synthetic tool output as
{
  "task_create_database": {
    success: true,
    outputs: {
      schema: { /* ... */ },
      connection: { /* ... */ }
    }
  }
}
```

## Tool Discovery Integration

### Augmented Tool Registry

During formal planning, the tool registry is augmented:

```javascript
class AugmentedToolRegistry {
  constructor(realToolRegistry) {
    this.realTools = realToolRegistry;
    this.syntheticTools = new Map();
  }
  
  addSyntheticTool(tool) {
    this.syntheticTools.set(tool.name, tool);
  }
  
  async searchTools(query) {
    const realResults = await this.realTools.searchTools(query);
    const syntheticResults = this.searchSynthetic(query);
    return [...realResults, ...syntheticResults];
  }
}
```

### Tool Selection Priority

When both real and synthetic tools are available:
1. **Prefer synthetic tools** for tasks matching child node descriptions
2. **Use real tools** for new operations not covered by children
3. **Combine both** when synthetic tool doesn't fully cover parent needs

## Integration with Existing Planner

The formal planner uses the existing planner at each level:

```javascript
// For each SIMPLE task at current level
const availableTools = [
  ...realTools,           // Original discovered tools
  ...childSyntheticTools  // BTs from children as tools
];

// Use existing planner with augmented tool set
const bt = await existingPlanner.makePlan(
  task.description,
  availableTools,
  {
    artifacts: levelArtifacts,
    hints: task.ioHints
  }
);

// Validate with existing validator
const validation = await btValidator.validate(bt, availableTools);
```

## Execution Model

### Key Insight: BTs are Already Valid

**CRITICAL**: The Planner generates **complete, valid, executable behavior trees**. The `executionPlan` stored in a synthetic tool IS the behavior tree itself - not a plan to create one, not a template, but the actual BT ready for execution.

### Synthetic Tool Execution

When a synthetic tool is executed, it simply:

1. **Pass the stored BT directly to BehaviorTreeExecutor**
2. **Map input parameters** to the BT's execution context
3. **Execute the BT** (which is already valid and complete)
4. **Collect outputs** from BT execution
5. **Return results** to parent context

```javascript
// The synthetic tool stores a COMPLETE BT
const syntheticTool = {
  name: "task_create_database",
  executionPlan: validBehaviorTree, // This IS the BT, ready to execute
  inputSchema: {...},
  outputSchema: {...}
};

// Execution is simply passing the BT to the executor
async execute(inputs) {
  const btExecutor = new BehaviorTreeExecutor();
  const result = await btExecutor.executeTree(
    this.executionPlan,  // Direct execution - no transformation needed
    { inputs }
  );
  return result.outputs;
}

### Nested Execution

The execution forms a tree:
```
Root BT Execution
├── Real Tool Execution
├── Synthetic Tool Execution
│   ├── Real Tool Execution
│   └── Real Tool Execution
└── Synthetic Tool Execution
    ├── Synthetic Tool Execution
    │   └── Real Tool Execution
    └── Real Tool Execution
```

## Validation

### Level Validation

Each level is validated independently:
- BT structure correctness
- Tool availability (real + synthetic)
- Artifact flow consistency
- No circular dependencies

### Cross-Level Validation

After full synthesis:
- Synthetic tool interfaces match usage
- Artifact mappings are complete
- No orphaned synthetic tools
- Execution depth is reasonable

### Validation Integration

```javascript
// Validate individual BT
const btValidation = await btValidator.validate(bt, tools);

// Validate synthetic tool creation
const toolValidation = validateSyntheticTool(
  syntheticTool,
  originalBT,
  taskNode
);

// Validate level consistency
const levelValidation = validateLevelConsistency(
  allBTsAtLevel,
  syntheticTools
);
```

## Output Format

### Final Plan Structure

```javascript
{
  success: true,
  rootBehaviorTree: {
    // Complete executable BT for root task
  },
  syntheticTools: {
    // All synthetic tools created during synthesis
    "task_configure_server": { /* ... */ },
    "task_create_database": { /* ... */ }
  },
  levelPlans: {
    // BTs for each level (for debugging/visualization)
    0: { /* root BT */ },
    1: { /* level 1 BTs */ },
    2: { /* level 2 BTs */ }
  },
  artifacts: {
    // Expected artifacts at each level
  },
  validation: {
    // Validation results for entire plan
  }
}
```

## Example: Multi-Level Synthesis

### Scenario: Create API Endpoint

**Input Hierarchy:**
```
"Create user API endpoint" [COMPLEX]
├── "Set up route handler" [COMPLEX]
│   ├── "Define route path" [SIMPLE]
│   └── "Create handler function" [SIMPLE]
└── "Add validation" [SIMPLE]
```

**Level 2 (Deepest Leaves):**

1. "Define route path" → BT:
```javascript
{
  type: "action",
  tool: "route_define",
  params: { path: "/api/users", method: "POST" },
  outputVariable: "routeDefinition"
}
```
→ Synthetic tool: `task_define_route_path`

2. "Create handler function" → BT:
```javascript
{
  type: "sequence",
  children: [
    { type: "action", tool: "function_create", outputVariable: "handler" },
    { type: "action", tool: "function_bind", params: { fn: "{{handler}}" } }
  ]
}
```
→ Synthetic tool: `task_create_handler_function`

**Level 1 (Complex Parent):**

"Set up route handler" using synthetic tools:
```javascript
{
  type: "sequence",
  children: [
    { type: "action", tool: "task_define_route_path", outputVariable: "route" },
    { type: "action", tool: "task_create_handler_function", outputVariable: "handler" },
    { type: "action", tool: "route_attach", params: { 
      route: "{{route}}", 
      handler: "{{handler}}" 
    }}
  ]
}
```
→ Synthetic tool: `task_setup_route_handler`

**Level 0 (Root):**

"Create user API endpoint" using synthetic tool:
```javascript
{
  type: "sequence",
  children: [
    { type: "action", tool: "task_setup_route_handler", outputVariable: "endpoint" },
    { type: "action", tool: "validation_add", params: { endpoint: "{{endpoint}}" } }
  ]
}
```

This is the final executable BT that orchestrates the entire task.

## Benefits of BT-as-Tool Approach

### Composability
- Complex behaviors built from simpler ones
- Reusable behavioral components
- Natural abstraction boundaries

### Encapsulation
- Each level manages its own complexity
- Internal details hidden from parent
- Clean interfaces between levels

### Debugging
- Each synthetic tool can be tested independently
- Clear execution boundaries
- Traceable artifact flow

### Flexibility
- Mix of real and synthetic tools
- Dynamic tool composition
- Adaptive to available capabilities

## Success Criteria

The formal planner succeeds when:

1. **Complete synthesis** - All tasks have executable BTs
2. **Valid composition** - Synthetic tools correctly encapsulate child behavior
3. **Artifact coherence** - Data flows correctly between levels
4. **Execution ready** - Final BT can be executed without modification
5. **Validation passing** - All BTs pass validation at their level

---

This design presents a novel approach to hierarchical planning where behavior trees serve dual purposes: as execution plans at their level and as composable tools at the parent level. This bottom-up synthesis ensures that complex behaviors are systematically built from validated, simpler components.