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

**Handles** are persistent, typed references to objects that live in the server's memory between tool calls. They represent anything from files and repositories to test suites and deployments.

#### Key Features

- **Named References**: Each handle has a user-defined name for easy reference
- **Type System**: Strongly typed with a comprehensive ontology
- **Hierarchical**: Handles can contain or reference other handles
- **Lifecycle Management**: LRU eviction with configurable TTL

#### Architecture

```javascript
class Handle {
  id: string;           // Unique identifier
  name: string;         // User-defined name
  type: string;         // Type from ontology
  data: any;           // The actual object/data
  metadata: {
    created: Date;
    lastAccessed: Date;
    accessCount: number;
    parent?: string;   // Parent handle ID
    children: string[]; // Child handle IDs
  };
  capabilities: string[]; // What operations are available
}
```

#### Type Ontology

Types are defined in a hierarchical ontology that describes:
- Properties each type must have
- Relationships to other types
- Available operations/capabilities
- Validation rules

Example type definition:
```json
{
  "GitHubRepository": {
    "extends": "Repository",
    "properties": {
      "owner": { "type": "string", "required": true },
      "name": { "type": "string", "required": true },
      "defaultBranch": { "type": "string", "required": true },
      "private": { "type": "boolean", "required": true }
    },
    "relationships": {
      "branches": { "type": "GitHubBranch", "cardinality": "many" },
      "pullRequests": { "type": "GitHubPullRequest", "cardinality": "many" }
    },
    "capabilities": [
      "list_branches",
      "create_branch",
      "create_pull_request",
      "get_file",
      "update_file"
    ]
  }
}
```

#### Memory Management

- **LRU Cache**: Least Recently Used eviction when memory limit reached
- **TTL**: Optional time-to-live for temporary handles
- **Reference Counting**: Handles with active references are protected
- **Explicit Cleanup**: Tools can mark handles for disposal

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

Complex tasks require structured planning with validation checkpoints and rollback capabilities.

#### Plan Structure

Plans are hierarchical with clear dependencies:

```javascript
class Plan {
  id: string;
  goal: string;
  phases: Phase[];
  currentPhase: number;
  status: 'planning' | 'executing' | 'completed' | 'failed';
  checkpoints: Checkpoint[];
}

class Phase {
  name: string;
  tasks: Task[];
  checkpoint: CheckpointDefinition;
  dependencies: string[]; // Other phase IDs
  rollbackStrategy: RollbackStrategy;
}

class Task {
  id: string;
  description: string;
  tool: string;
  parameters: any;
  requiredHandles: string[];
  producesHandles: HandleDefinition[];
  validation: ValidationRule[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
}
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

Legion modules will be extended to support:

```javascript
// module.json additions
{
  "handles": {
    "produces": ["GitHubRepository", "GitHubBranch"],
    "consumes": ["GitHubRepository"],
    "types": {
      "GitHubRepository": {
        // Type definition
      }
    }
  },
  "planning": {
    "goals": ["deploy application", "setup CI/CD"],
    "checkpoints": ["deployment_healthy", "tests_passing"]
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

### Phase 1: Core Handle System
- Basic handle registry
- Type definitions for common objects
- Handle resolution in tool calls

### Phase 2: Tool Management
- Tool registry with search
- Working set management
- Basic meta-tools

### Phase 3: Planning Foundation
- Plan data structures
- Simple linear execution
- Basic checkpoints

### Phase 4: Advanced Features
- Semantic search for tools
- Complex plan orchestration
- Distributed handle storage
- Multi-agent coordination

## Benefits

1. **Reduced Cognitive Load**: AI agents work with named objects instead of juggling parameters
2. **Stateful Workflows**: Complex multi-step operations become natural
3. **Better Error Recovery**: Checkpoints and rollbacks prevent cascading failures
4. **Tool Discovery**: Find the right tool without knowing its exact name
5. **Structured Execution**: Plans provide clear paths to achieve goals
6. **Type Safety**: Ontology prevents invalid operations
7. **Performance**: Handles eliminate redundant API calls

## Future Considerations

- **Multi-Agent Coordination**: Shared handle spaces for collaborative work
- **Distributed Handles**: Store handles across multiple servers
- **Handle Persistence**: Save/restore workspace state
- **Visual Planning**: Generate diagrams of plans and dependencies
- **Learning System**: Improve plans based on execution history
- **Handle Versioning**: Track changes to handles over time