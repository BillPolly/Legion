# Planning Interface Design Document

## Executive Summary

This document outlines the design for integrating a comprehensive planning interface into the Legion Tool Registry UI. The interface enables users to create, visualize, debug, and execute hierarchical task plans using the DecentPlanner system. This MVP provides an intuitive workspace for decomposing complex goals into executable tasks with real-time tool discovery and validation.

## System Architecture

### Overview

The planning interface extends the existing Tool Registry UI architecture, maintaining the MVVM pattern and actor-based communication model. It integrates seamlessly with the DecentPlanner for task decomposition and the Tool Registry for semantic tool discovery.

### Component Integration

```
┌─────────────────────────────────────────────────────────────┐
│                    Tool Registry UI                          │
├─────────────────────────────────────────────────────────────┤
│  Navigation Tabs                                             │
│  ├── Tool Search (existing)                                  │
│  ├── Module Browser (existing)                               │
│  ├── Planning Workspace (new) ◄──────────────┐              │
│  ├── Plan Library (new)                       │              │
│  └── Execution History (new)                  │              │
├────────────────────────────────────────────┬──┴──────────────┤
│         Client Actors                      │  Server Actors  │
│  ├── ClientPlanningActor (new)            │  ├── ServerPlanningActor (new)
│  ├── ClientPlanExecutionActor (new)       │  ├── ServerPlanExecutionActor (new)
│  └── ClientToolRegistryActor (existing)   │  └── ServerToolRegistryActor (existing)
├────────────────────────────────────────────┴──────────────────┤
│                    WebSocket Communication                     │
├─────────────────────────────────────────────────────────────┤
│  Backend Services                                            │
│  ├── DecentPlanner (informal + formal planning)              │
│  ├── Tool Registry (semantic search + tool metadata)         │
│  └── MongoDB (plans, executions, templates)                 │
└─────────────────────────────────────────────────────────────┘
```

## Component Design

### PlanningWorkspacePanel

The main planning interface providing an integrated environment for goal decomposition, validation, and execution.

#### Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    Goal Input Bar                           │
│  [Enter your goal...] [Context] [Options] [Plan] [Execute]  │
├─────────────────────────────────────────────────────────────┤
│          Decomposition Tree         │    Tools & Validation  │
│                                     │                        │
│  ▼ Build web app [COMPLEX]         │  Available Tools:      │
│    ▼ Setup database [COMPLEX]      │  ✓ create_table        │
│      ○ Create schema [SIMPLE]      │  ✓ setup_connection    │
│      ○ Setup connection [SIMPLE]   │  ⚠ migration_tool      │
│    ▶ Create API [COMPLEX]          │                        │
│    ▶ Build frontend [COMPLEX]      │  Validation:           │
│                                     │  ✓ Dependencies valid  │
│                                     │  ⚠ 2 tools missing     │
│                                     │                        │
├─────────────────────────────────────────────────────────────┤
│                 Execution Console                           │
│  [▶ Run] [⏸ Pause] [⏹ Stop] [⏭ Step]  Progress: 45%       │
│  ─────────────────────────────────────────────────          │
│  [12:34:15] Starting task: Create schema                    │
│  [12:34:16] Tool executed: create_table                     │
│  [12:34:17] Artifact created: db_schema                     │
└─────────────────────────────────────────────────────────────┘
```

#### Key Features

- **Goal Input Bar**: Natural language input with context configuration
- **Decomposition Tree**: Interactive hierarchical task visualization
- **Tool Panel**: Real-time tool availability and validation status
- **Execution Console**: Live execution monitoring with controls

### PlanVisualizationPanel

Provides advanced visualization of plan structures and dependencies.

#### Visualization Modes

1. **Tree View**: Hierarchical task decomposition
2. **Graph View**: Task dependencies and data flow
3. **Timeline View**: Execution sequence and parallelism
4. **Artifact Flow**: Input/output relationships

#### Interactive Elements

- Zoom and pan controls
- Node expansion/collapse
- Complexity indicators (color coding)
- Progress overlays during execution
- Hover tooltips with task details

### PlanExecutionPanel

Dedicated interface for monitoring and controlling plan execution.

#### Components

- **Execution Controls**: Start, pause, resume, stop, step-through
- **Progress Tracking**: Per-task and overall progress bars
- **Live Logs**: Streaming execution output
- **Artifact Inspector**: Current context and artifacts
- **Error Panel**: Failure details and recovery options

### PlanLibraryPanel

Repository for saved plans and templates.

#### Features

- **Plan Grid**: Searchable collection of saved plans
- **Template Browser**: Reusable plan templates by category
- **Plan Details**: View/edit saved plan configurations
- **Import/Export**: Share plans as JSON
- **Version History**: Track plan modifications

## Actor Communication

### Message Flow Patterns

#### Planning Request Flow
```
Client                          Server
  │                               │
  ├─[plan:create]────────────────►│
  │  {goal, context, options}     │
  │                               ├─> DecentPlanner.plan()
  │◄─[plan:decomposition:start]───┤
  │                               │
  │◄─[plan:decomposition:node]────┤   (streamed updates)
  │  {node, level, complexity}    │
  │                               │
  │◄─[plan:validation:result]─────┤
  │  {valid, feasibility, tools}  │
  │                               │
  │◄─[plan:complete]──────────────┤
  │  {hierarchy, behaviorTrees}   │
  └─────────────────────────────────┘
```

#### Execution Flow
```
Client                          Server
  │                               │
  ├─[execution:start]─────────────►│
  │  {planId, options}            │
  │                               ├─> Execute BehaviorTree
  │◄─[execution:task:start]───────┤
  │  {taskId, taskName}           │
  │                               │
  │◄─[execution:tool:execute]─────┤
  │  {toolName, params}           │
  │                               │
  │◄─[execution:artifact:created]─┤
  │  {name, value}                │
  │                               │
  │◄─[execution:task:complete]────┤
  │  {taskId, status, outputs}    │
  │                               │
  │◄─[execution:complete]─────────┤
  │  {status, results, artifacts} │
  └─────────────────────────────────┘
```

### Actor Responsibilities

#### ServerPlanningActor
- Interfaces with DecentPlanner
- Manages decomposition sessions
- Coordinates tool discovery
- Handles validation requests
- Persists plans to MongoDB

#### ServerPlanExecutionActor
- Orchestrates behavior tree execution
- Manages execution state
- Coordinates tool invocations
- Tracks artifacts and context
- Streams execution updates

#### ClientPlanningActor
- Manages UI state for planning
- Handles user interactions
- Updates decomposition tree
- Displays validation results
- Synchronizes with server state

#### ClientPlanExecutionActor
- Controls execution UI
- Displays progress updates
- Renders execution logs
- Updates artifact viewer
- Handles execution controls

## Data Models

### Plan Document
```javascript
{
  _id: ObjectId,
  name: String,
  goal: String,
  context: Object,
  hierarchy: {
    root: TaskNode,
    levels: Array<Array<TaskNode>>,
    depth: Number
  },
  validation: {
    valid: Boolean,
    feasibility: Object,
    errors: Array
  },
  behaviorTrees: Object,
  metadata: {
    createdAt: Date,
    updatedAt: Date,
    createdBy: String,
    tags: Array<String>
  }
}
```

### TaskNode Structure
```javascript
{
  id: String,
  description: String,
  complexity: 'SIMPLE' | 'COMPLEX',
  suggestedInputs: Array<String>,
  suggestedOutputs: Array<String>,
  children: Array<TaskNode>,
  tools: Array<ToolReference>,
  validation: {
    feasible: Boolean,
    missingTools: Array,
    confidence: Number
  }
}
```

### Execution Record
```javascript
{
  _id: ObjectId,
  planId: ObjectId,
  status: 'running' | 'paused' | 'completed' | 'failed',
  startTime: Date,
  endTime: Date,
  progress: {
    totalTasks: Number,
    completedTasks: Number,
    currentTask: String
  },
  artifacts: Map<String, Any>,
  logs: Array<LogEntry>,
  errors: Array<ErrorEntry>
}
```

## User Workflows

### Creating a Plan

1. **Goal Entry**: User enters natural language goal
2. **Configuration**: Optional context and planning parameters
3. **Decomposition**: System recursively decomposes goal
4. **Review**: User reviews task hierarchy and complexity
5. **Validation**: System validates feasibility with available tools
6. **Refinement**: User can adjust goals or add missing tools
7. **Save**: Plan saved to library for execution

### Debugging a Plan

1. **Load Plan**: Select from library or recent plans
2. **Inspect Tree**: Navigate decomposition hierarchy
3. **Check Validation**: Review feasibility and tool availability
4. **Identify Issues**: Locate infeasible tasks or missing tools
5. **Modify**: Adjust task descriptions or complexity
6. **Re-validate**: Confirm changes resolve issues
7. **Save Version**: Store updated plan

### Executing a Plan

1. **Select Plan**: Choose validated plan from workspace or library
2. **Configure Execution**: Set execution mode (full/step/debug)
3. **Start Execution**: Initiate behavior tree execution
4. **Monitor Progress**: Watch real-time task completion
5. **Review Artifacts**: Inspect generated artifacts
6. **Handle Failures**: Pause and debug on errors
7. **Complete**: Review final results and logs

## UI/UX Design

### Visual Language

#### Complexity Indicators
- **COMPLEX** tasks: Blue nodes with folder icon
- **SIMPLE** tasks: Green nodes with gear icon
- **Running** tasks: Pulsing yellow border
- **Completed** tasks: Green checkmark overlay
- **Failed** tasks: Red X overlay with error icon

#### Status Colors
- **Valid/Feasible**: Green (#4CAF50)
- **Warning/Missing Tools**: Yellow (#FF9800)
- **Error/Infeasible**: Red (#F44336)
- **Running/Active**: Blue (#2196F3)
- **Pending**: Gray (#9E9E9E)

### Interaction Patterns

#### Tree Navigation
- Click to select node
- Double-click to expand/collapse
- Right-click for context menu
- Drag to pan (in graph view)
- Scroll to zoom

#### Execution Controls
- Play button starts execution
- Pause suspends at next safe point
- Step executes one task at a time
- Stop terminates with cleanup
- Reset returns to initial state

### Responsive Behavior

#### Panel Resizing
- Draggable splitters between panels
- Minimum panel widths maintained
- Collapsible side panels
- Full-screen mode for visualization

#### Performance Optimization
- Virtual scrolling for large trees
- Lazy loading of node details
- Debounced validation checks
- Progressive rendering of updates

## Integration Points

### DecentPlanner Integration

#### Initialization
```javascript
const planner = new DecentPlanner(llmClient, toolRegistry, {
  maxDepth: 5,
  confidenceThreshold: 0.7,
  enableFormalPlanning: true
});
```

#### Planning Flow
1. Submit goal to DecentPlanner
2. Receive hierarchical decomposition
3. Get tool feasibility analysis
4. Obtain formal behavior trees
5. Execute synthesized plan

### Tool Registry Integration

#### Tool Discovery
```javascript
const tools = await semanticSearch.searchTools(taskDescription, {
  limit: 10,
  threshold: 0.3
});
```

#### Features Leveraged
- Semantic tool search for each simple task
- Tool metadata and schemas
- Module browsing for tool availability
- Tool execution through registry

### MongoDB Integration

#### Collections Used
- `plans`: Persistent plan storage
- `plan_executions`: Execution history
- `plan_templates`: Reusable templates
- `tools`: Existing tool registry

#### Indexes Required
```javascript
db.plans.createIndex({ "metadata.createdAt": -1 })
db.plans.createIndex({ "metadata.tags": 1 })
db.plan_executions.createIndex({ "planId": 1, "startTime": -1 })
```

## Error Handling

### Planning Errors
- **LLM Failures**: Retry with exponential backoff
- **Invalid Goals**: User-friendly error messages
- **Timeout**: Configurable decomposition timeouts
- **Validation Failures**: Detailed issue reporting

### Execution Errors
- **Tool Failures**: Capture and display error details
- **Missing Artifacts**: Highlight dependency issues
- **Network Issues**: Reconnection with state recovery
- **Resource Limits**: Graceful degradation

### Recovery Strategies
- Checkpoint saving during execution
- Partial plan execution from breakpoints
- Alternative tool suggestions
- Manual intervention points

## Security Considerations

### Input Validation
- Sanitize goal text input
- Validate context parameters
- Limit decomposition depth
- Rate limit planning requests

### Execution Safety
- Tool parameter validation
- Artifact size limits
- Execution timeout controls
- Resource usage monitoring

### Data Protection
- User-scoped plan access
- Audit logging of executions
- Secure WebSocket connections
- Encrypted sensitive artifacts

---

This design document provides the complete specification for the Planning Interface MVP. The implementation follows established patterns in the Tool Registry UI while introducing powerful planning capabilities through tight integration with the DecentPlanner system.