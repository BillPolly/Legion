# Aiur MCP Server Design Document

## Overview

Aiur is an MCP (Model Context Protocol) server that serves as an intelligent gateway between AI agents and the Legion tool ecosystem. It transforms the traditional stateless tool-calling paradigm into a stateful, context-aware orchestration platform.

### Vision

Rather than treating each tool call as an isolated operation, Aiur maintains a living workspace where:
- Objects persist between calls (handles)
- Tools are dynamically loaded based on context
- Complex tasks are planned and executed with checkpoints
- The AI agent works with a coherent mental model of the system

## Core Concepts

### 1. Handle System

**Handles** are persistent references to objects that live in the server's memory between tool calls. They represent anything from files and repositories to test suites and deployments.

#### Key Features

- **Named References**: Each handle has a user-defined name for easy reference
- **Flexible Storage**: Any JavaScript object can be stored as a handle
- **Simple Resolution**: Use `@handleName` in parameters to reference handles
- **Lifecycle Management**: LRU eviction with configurable TTL

#### Architecture

```javascript
// Simple handle storage - just a Map
const handles = new Map();

// Store any object
handles.set("myRepo", { owner: "facebook", name: "react", /* any data */ });

// Retrieve by name
const repo = handles.get("myRepo");
```

#### Handle Convention

- Tools can request handle creation by returning: `{ result: data, saveAs: "handleName" }`
- Tools reference handles using: `{ repo: "@myRepo" }` (@ prefix indicates handle lookup)
- The system resolves `@handleName` to the actual object before calling the tool

#### Memory Management

- **LRU Cache**: Least Recently Used eviction when memory limit reached
- **TTL**: Optional time-to-live for temporary handles
- **Manual Cleanup**: Tools can delete handles when no longer needed

### 2. Tool Management System

With potentially hundreds of tools in the Legion ecosystem, Aiur implements intelligent tool management to keep the working set manageable.

#### Dynamic Tool Loading

- **Working Set**: Maximum of ~20 active tools at any time
- **Automatic Loading**: Tools loaded when relevant handles are created
- **Context Switching**: Different tool sets for different workflows

#### Meta-Tools

These special tools manage the tool ecosystem itself:

##### `tool_search`
Search for tools using natural language:
```javascript
{
  "query": "tools for running tests",
  "filters": {
    "tags": ["testing"],
    "handles": ["TestSuite"]  // Tools that work with these handle types
  }
}
// Returns ranked list of relevant tools with descriptions
```

##### `tool_activate`
Add tools to the working set:
```javascript
{
  "tools": ["jester", "coverage_analyzer"],
  "exclusive": false  // Whether to replace current set
}
// Returns tool descriptions for confirmation
```

##### `tool_suggest`
Get intelligent suggestions based on current context:
```javascript
{
  "handles": ["myRepo"],  // Current handles in workspace
  "recent_tools": ["github_get_repo"],  // Recently used tools
  "goal": "deploy application"  // Optional goal description
}
// Returns suggested tools with reasoning
```

#### Tool Registry

Each tool is indexed with:
- Semantic embeddings of descriptions
- Input/output handle types
- Tags and categories
- Dependency relationships
- Performance characteristics

### 3. Planning and Orchestration System

Complex tasks require structured planning with validation checkpoints and rollback capabilities. Aiur uses the `@legion/llm-planner` package as its foundation, extending it with checkpoint and handle integration.

#### Planning Foundation

The planning system is built on top of `@legion/llm-planner`, which provides:
- Hierarchical plan structure (Plan → Steps → Actions)
- Input/output flow validation
- Dependency management and execution ordering
- Parallel execution detection

#### Extended Plan Structure

```javascript
// Base structure from llm-planner
import { Plan, PlanStep, PlanAction } from '@legion/llm-planner';

// Aiur extends with checkpoints
class AiurPlan extends Plan {
  checkpoints: Map<string, CheckpointDefinition>;
  currentCheckpoint: string;
  
  // Checkpoint after each major phase
  addCheckpoint(stepId, definition) {
    this.checkpoints.set(stepId, {
      validate: definition.validate,
      captureState: definition.captureState,
      rollbackTo: definition.rollbackTo
    });
  }
}

// Steps already track inputs/outputs as object names
const step = new PlanStep({
  name: "Build frontend",
  inputs: ["sourceCode", "dependencies"],  // Handle names
  outputs: ["buildArtifact", "buildLog"],  // Creates these handles
  actions: [...]
});
```

#### Planning Tools

##### `plan_create`
Generate a structured plan from a goal:
```javascript
{
  "goal": "Add authentication to the API",
  "context": {
    "handles": ["apiProject"],
    "constraints": ["must use JWT", "backwards compatible"]
  }
}
// Returns complete plan with phases and checkpoints
```

##### `plan_execute`
Execute the plan with automatic checkpoint validation:
```javascript
{
  "planId": "plan_123",
  "mode": "step" | "phase" | "full",
  "dryRun": false
}
// Returns execution progress and any issues
```

##### `plan_checkpoint`
Validate current state at a checkpoint:
```javascript
{
  "planId": "plan_123",
  "checkpointId": "tests_passing",
  "additionalChecks": [...]
}
// Returns validation results and suggestions
```

##### `plan_rollback`
Revert to a previous checkpoint:
```javascript
{
  "planId": "plan_123",
  "checkpointId": "before_auth_changes",
  "preserveHandles": ["debugLog"]  // Handles to keep
}
// Returns rollback status and restored state
```

#### Checkpoint System

Checkpoints capture:
- Handle states (serialized references)
- File system snapshots (for modified files)
- Git commit references
- Test results
- Custom validation results

#### Execution Features

- **Dependency Resolution**: Automatic ordering of tasks
- **Parallel Execution**: When tasks have no dependencies
- **Progress Streaming**: Real-time updates via MCP resources
- **Failure Recovery**: Automatic retry with exponential backoff
- **Human-in-the-Loop**: Pause for approval at critical points

## Integration with Legion

### Module System Extensions

Legion modules will be extended to support planning and handle integration:

```javascript
// module.json additions
{
  "tools": {
    "github_get_repo": {
      "inputs": [],  // No required input handles
      "outputs": ["repository"],  // Produces a repository handle
      "description": "Get GitHub repository information"
    },
    "github_create_branch": {
      "inputs": ["repository"],  // Requires repository handle
      "outputs": ["branch"],  // Produces branch handle
      "description": "Create a new branch in repository"
    }
  },
  "planning": {
    "actions": [
      {
        "type": "fetch_repo",
        "inputs": [],
        "outputs": ["repository"],
        "description": "Fetch repository data"
      }
    ],
    "goals": ["deploy application", "setup CI/CD"]
  },
  "metadata": {
    "tags": ["vcs", "github", "deployment"],
    "embedding": "base64_encoded_vector"
  }
}
```

### Tool Adaptation

Legion tools will be wrapped to support:
- Handle input/output
- Progress reporting
- Checkpoint participation
- Validation rules

Example adapter:
```javascript
class MCPToolAdapter {
  constructor(legionTool, handleRegistry) {
    this.tool = legionTool;
    this.handles = handleRegistry;
  }

  async invoke(params) {
    // Resolve handle references to actual objects
    const resolved = await this.resolveHandles(params);
    
    // Call Legion tool
    const result = await this.tool.invoke(resolved);
    
    // Create handles for outputs
    const outputHandles = await this.createHandles(result);
    
    // Return MCP-formatted response
    return {
      result: result.data,
      handles: outputHandles
    };
  }
}
```

## API Examples

### Creating and Using Handles

```javascript
// Tool call: github_get_repo
{
  "owner": "facebook",
  "repo": "react",
  "saveAs": "reactRepo"  // Creates a handle
}

// Response includes handle reference
{
  "success": true,
  "data": { ...repo details... },
  "handle": {
    "id": "handle_123",
    "name": "reactRepo",
    "type": "GitHubRepository"
  }
}

// Subsequent calls use the handle
// Tool call: github_create_branch
{
  "repo": "@reactRepo",  // @ prefix indicates handle reference
  "branch": "my-feature"
}
```

### Tool Discovery Workflow

```javascript
// 1. Search for relevant tools
tool_search({ "query": "deploy to kubernetes" })

// 2. Activate selected tools
tool_activate({ "tools": ["k8s_deploy", "k8s_monitor"] })

// 3. Tools now available in working set
k8s_deploy({ "manifest": "@myManifest", "cluster": "production" })
```

### Planning Example

```javascript
// Create plan
const plan = await plan_create({
  "goal": "Refactor authentication system",
  "context": {
    "handles": ["authModule"],
    "constraints": ["maintain backwards compatibility", "100% test coverage"]
  }
});

// Execute with progress tracking
await plan_execute({
  "planId": plan.id,
  "mode": "phase"  // Execute one phase at a time
});

// If something goes wrong
await plan_rollback({
  "planId": plan.id,
  "checkpointId": "before_refactor"
});
```

## Implementation Phases

### Phase 1: Foundation Setup
- Move llm-planner to packages root
- Update code-agent to use @legion/llm-planner
- Basic handle registry (Map-based)
- Handle resolution in tool calls

### Phase 2: Tool Management
- Tool registry with search
- Working set management
- Basic meta-tools
- Legion tool wrapper for MCP

### Phase 3: Planning Integration
- Extend llm-planner with checkpoints
- Connect plan execution to handles
- Plan execution orchestrator
- Progress tracking

### Phase 4: Advanced Features
- Semantic search for tools
- Complex checkpoint strategies
- Handle persistence
- Multi-agent coordination

## Benefits

1. **Reduced Cognitive Load**: AI agents work with named objects instead of juggling parameters
2. **Stateful Workflows**: Complex multi-step operations become natural
3. **Better Error Recovery**: Checkpoints and rollbacks prevent cascading failures
4. **Tool Discovery**: Find the right tool without knowing its exact name
5. **Structured Execution**: Plans provide clear paths to achieve goals
6. **Flexibility**: No rigid type system - handles can store any JavaScript object
7. **Performance**: Handles eliminate redundant API calls
8. **Proven Foundation**: Built on battle-tested llm-planner package

## Future Considerations

- **Multi-Agent Coordination**: Shared handle spaces for collaborative work
- **Distributed Handles**: Store handles across multiple servers
- **Handle Persistence**: Save/restore workspace state
- **Visual Planning**: Generate diagrams of plans and dependencies
- **Learning System**: Improve plans based on execution history
- **Handle Versioning**: Track changes to handles over time