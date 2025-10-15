# Project Management Agent - Design Document

## Overview

The Project Management Agent is a persistent MCP (Model Context Protocol) server that maintains a knowledge graph of project state, task dependencies, and agent progress. It serves as the central coordination point for multi-agent workflows, enabling autonomous task assignment and progress tracking.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────┐
│         Claude Code Session                     │
│  ┌────────────┐  ┌────────────┐  ┌───────────┐ │
│  │Orchestrator│  │ UAT Tester │  │ Debugger  │ │
│  │   Agent    │  │   Agent    │  │   Agent   │ │
│  └──────┬─────┘  └──────┬─────┘  └─────┬─────┘ │
│         │                │                │      │
│         └────────────────┴────────────────┘      │
│                          │                       │
│                   MCP Tool Calls                 │
└──────────────────────────┼──────────────────────┘
                           │
┌──────────────────────────┼──────────────────────┐
│  MCP Project Management Server (Always Running) │
│                          │                       │
│  ┌───────────────────────┴─────────────────┐   │
│  │  Tool Handlers                           │   │
│  │  - pm_get_next_task()                    │   │
│  │  - pm_report_progress()                  │   │
│  │  - pm_create_task()                      │   │
│  │  - pm_query_graph()                      │   │
│  │  - pm_report_bug()                       │   │
│  │  - pm_get_project_status()               │   │
│  └───────────────────┬──────────────────────┘   │
│                      │                           │
│           ┌──────────┴──────────┐                │
│           │  Neo4j Connection   │                │
│           │  Pool (persistent)  │                │
│           └──────────┬──────────┘                │
└──────────────────────┼───────────────────────────┘
                       │
            ┌──────────┴──────────┐
            │   Neo4j Database    │
            │  (Knowledge Graph)  │
            └─────────────────────┘
```

### Why MCP Server?

**Advantages:**
- **Persistent**: Server runs continuously, maintains Neo4j connection pool
- **Fast**: Sub-second responses (vs 20-30s for spawning sub-agents)
- **Standard**: Uses MCP protocol - all agents can use same interface
- **Concurrent**: Handles multiple agent requests simultaneously
- **Observable**: Centralized logging of all project interactions

## Knowledge Graph Ontology

### Entity Types

#### Project
Represents a top-level project or feature.

**Properties:**
- `id` (string, unique): Project identifier
- `name` (string): Human-readable name
- `description` (string): Project description
- `status` (enum): `active`, `completed`, `on_hold`
- `created` (datetime): Creation timestamp
- `updated` (datetime): Last update timestamp

#### Epic
A collection of related tasks within a project.

**Properties:**
- `id` (string, unique): Epic identifier
- `name` (string): Epic name
- `description` (string): Epic description
- `status` (enum): `pending`, `in_progress`, `completed`
- `priority` (enum): `low`, `medium`, `high`, `critical`

#### Task
A single unit of work.

**Properties:**
- `id` (string, unique): Task identifier (e.g., "UAT-001")
- `name` (string): Task name
- `description` (string): Detailed task description
- `status` (enum): `pending`, `in_progress`, `blocked`, `completed`, `failed`
- `priority` (enum): `low`, `medium`, `high`, `critical`
- `assignedTo` (string, optional): Agent name currently assigned
- `estimatedDuration` (string, optional): Time estimate (e.g., "30m")
- `actualDuration` (string, optional): Actual time taken
- `created` (datetime): Creation timestamp
- `started` (datetime, optional): Start timestamp
- `completed` (datetime, optional): Completion timestamp
- `requiredCapabilities` (array): Capabilities needed (e.g., ["browser-automation"])

#### Agent
Represents an AI agent that can perform work.

**Properties:**
- `name` (string, unique): Agent name
- `type` (string): Agent type (e.g., "uat-writer", "integration-tester")
- `capabilities` (array): Agent capabilities
- `status` (enum): `idle`, `busy`, `offline`
- `currentTask` (string, optional): Currently assigned task ID
- `lastActive` (datetime): Last activity timestamp

#### Artifact
Output produced by completing a task.

**Properties:**
- `id` (string, unique): Artifact identifier
- `path` (string): File system path
- `type` (enum): `code`, `test`, `report`, `screenshot`, `documentation`
- `created` (datetime): Creation timestamp
- `size` (integer, optional): File size in bytes

#### Bug
A discovered issue that blocks work.

**Properties:**
- `id` (string, unique): Bug identifier
- `title` (string): Bug title
- `description` (string): Detailed description
- `severity` (enum): `low`, `medium`, `high`, `critical`
- `status` (enum): `open`, `investigating`, `fixed`, `wont_fix`
- `foundBy` (string): Agent that discovered the bug
- `created` (datetime): Discovery timestamp
- `resolved` (datetime, optional): Resolution timestamp

#### TestScenario
A UAT test scenario.

**Properties:**
- `id` (string, unique): Scenario identifier (e.g., "UAT-001")
- `name` (string): Scenario name
- `description` (string): Test description
- `priority` (enum): `low`, `medium`, `high`, `critical`
- `status` (enum): `pending`, `running`, `passed`, `failed`
- `passRate` (float, optional): Pass rate percentage

### Relationship Types

#### Project Relationships
- `(Project)-[:CONTAINS]->(Epic)`: Project contains epics
- `(Project)-[:HAS_AGENT]->(Agent)`: Agents working on project

#### Epic Relationships
- `(Epic)-[:HAS_TASK]->(Task)`: Epic contains tasks

#### Task Relationships
- `(Task)-[:DEPENDS_ON]->(Task)`: Task dependencies
- `(Task)-[:ASSIGNED_TO]->(Agent)`: Current assignment
- `(Task)-[:PRODUCES]->(Artifact)`: Task outputs
- `(Task)-[:BLOCKED_BY]->(Bug)`: Blocking bugs
- `(Task)-[:VALIDATES]->(TestScenario)`: Task validated by test

#### Agent Relationships
- `(Agent)-[:COMPLETED]->(Task)`: Historical completions
- `(Agent)-[:REPORTED]->(Bug)`: Bugs discovered by agent

#### Bug Relationships
- `(Bug)-[:BLOCKS]->(Task)`: Tasks blocked by bug
- `(Bug)-[:FOUND_IN]->(Artifact)`: Bug found in artifact

### Graph Schema Visualization

```
         ┌─────────┐
         │ Project │
         └────┬────┘
              │ CONTAINS
              ↓
         ┌────────┐
         │  Epic  │
         └────┬───┘
              │ HAS_TASK
              ↓
    ┌─────────────────────┐
    │       Task          │←──────────────────┐
    │  - pending          │                   │
    │  - in_progress      │                   │
    │  - blocked          │                   │
    │  - completed        │                   │
    └──┬──┬──┬──┬────────┘                   │
       │  │  │  │                             │
       │  │  │  └─DEPENDS_ON─────────────────┘
       │  │  │
       │  │  └─PRODUCES──→ ┌──────────┐
       │  │                │ Artifact │
       │  │                └──────────┘
       │  │
       │  └─BLOCKED_BY──→ ┌─────┐
       │                  │ Bug │
       │                  └─────┘
       │
       └─ASSIGNED_TO───→ ┌───────┐
                         │ Agent │
                         └───────┘
```

## Neo4j Schema Definitions

### Constraints

```cypher
// Unique constraints
CREATE CONSTRAINT project_id IF NOT EXISTS
FOR (p:Project) REQUIRE p.id IS UNIQUE;

CREATE CONSTRAINT epic_id IF NOT EXISTS
FOR (e:Epic) REQUIRE e.id IS UNIQUE;

CREATE CONSTRAINT task_id IF NOT EXISTS
FOR (t:Task) REQUIRE t.id IS UNIQUE;

CREATE CONSTRAINT agent_name IF NOT EXISTS
FOR (a:Agent) REQUIRE a.name IS UNIQUE;

CREATE CONSTRAINT artifact_id IF NOT EXISTS
FOR (a:Artifact) REQUIRE a.id IS UNIQUE;

CREATE CONSTRAINT bug_id IF NOT EXISTS
FOR (b:Bug) REQUIRE b.id IS UNIQUE;

CREATE CONSTRAINT test_scenario_id IF NOT EXISTS
FOR (ts:TestScenario) REQUIRE ts.id IS UNIQUE;
```

### Indexes

```cypher
// Status indexes for filtering
CREATE INDEX task_status IF NOT EXISTS
FOR (t:Task) ON (t.status);

CREATE INDEX task_priority IF NOT EXISTS
FOR (t:Task) ON (t.priority);

CREATE INDEX agent_status IF NOT EXISTS
FOR (a:Agent) ON (a.status);

CREATE INDEX bug_status IF NOT EXISTS
FOR (b:Bug) ON (b.status);

// Timestamp indexes for queries
CREATE INDEX task_created IF NOT EXISTS
FOR (t:Task) ON (t.created);

CREATE INDEX task_completed IF NOT EXISTS
FOR (t:Task) ON (t.completed);
```

## MCP Tool Specifications

### 1. pm_get_next_task

Get the next available task for an agent to work on.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "agentName": {
      "type": "string",
      "description": "Name of the requesting agent"
    },
    "capabilities": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Agent capabilities (e.g., ['browser-automation'])"
    },
    "priority": {
      "type": "string",
      "enum": ["low", "medium", "high", "critical"],
      "description": "Minimum priority level"
    },
    "projectId": {
      "type": "string",
      "description": "Optional: Filter by project"
    }
  },
  "required": ["agentName", "capabilities"]
}
```

**Output:**
```json
{
  "taskId": "UAT-001",
  "name": "Execute user registration test",
  "description": "Test user registration with valid credentials",
  "priority": "high",
  "estimatedDuration": "5m",
  "requiredCapabilities": ["browser-automation"],
  "dependencies": [],
  "context": {
    "epicName": "UAT Testing",
    "projectName": "Working Todo App"
  }
}
```

**Cypher Query:**
```cypher
MATCH (t:Task {status: 'pending'})
WHERE t.priority IN $priorities
  AND ALL(cap IN t.requiredCapabilities WHERE cap IN $capabilities)
  AND NOT EXISTS {
    MATCH (t)<-[:DEPENDS_ON]-(dep:Task)
    WHERE dep.status <> 'completed'
  }
  AND NOT EXISTS {
    MATCH (t)-[:BLOCKED_BY]->(b:Bug {status: 'open'})
  }
OPTIONAL MATCH (t)<-[:HAS_TASK]-(e:Epic)<-[:CONTAINS]-(p:Project)
RETURN t, e.name AS epicName, p.name AS projectName
ORDER BY
  CASE t.priority
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    ELSE 4
  END,
  t.created
LIMIT 1
```

**Logic:**
1. Filter tasks by status = 'pending'
2. Check agent has required capabilities
3. Exclude tasks with incomplete dependencies
4. Exclude tasks blocked by open bugs
5. Sort by priority and creation time
6. Return highest priority unblocked task

### 2. pm_report_progress

Report task progress or completion.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "agentName": {
      "type": "string",
      "description": "Name of the reporting agent"
    },
    "taskId": {
      "type": "string",
      "description": "Task identifier"
    },
    "status": {
      "type": "string",
      "enum": ["in_progress", "completed", "failed"],
      "description": "New task status"
    },
    "artifacts": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "path": { "type": "string" },
          "type": { "type": "string" }
        }
      },
      "description": "Artifacts produced"
    },
    "metrics": {
      "type": "object",
      "description": "Task metrics (e.g., duration, pass rate)"
    },
    "notes": {
      "type": "string",
      "description": "Optional notes"
    }
  },
  "required": ["agentName", "taskId", "status"]
}
```

**Output:**
```json
{
  "success": true,
  "taskId": "UAT-001",
  "previousStatus": "pending",
  "newStatus": "completed",
  "artifactsCreated": 2,
  "unblockedTasks": ["UAT-002", "UAT-003"]
}
```

**Cypher Queries:**

*Update task status:*
```cypher
MATCH (t:Task {id: $taskId})
MATCH (a:Agent {name: $agentName})
SET t.status = $status,
    t.updated = datetime(),
    t.assignedTo = CASE WHEN $status = 'completed' THEN null ELSE $agentName END,
    t.started = CASE WHEN $status = 'in_progress' AND t.started IS NULL
                     THEN datetime() ELSE t.started END,
    t.completed = CASE WHEN $status = 'completed'
                       THEN datetime() ELSE null END
MERGE (a)-[r:COMPLETED]->(t)
RETURN t.status AS previousStatus
```

*Create artifacts:*
```cypher
MATCH (t:Task {id: $taskId})
UNWIND $artifacts AS artifact
CREATE (a:Artifact {
  id: randomUUID(),
  path: artifact.path,
  type: artifact.type,
  created: datetime()
})
CREATE (t)-[:PRODUCES]->(a)
```

*Find unblocked tasks:*
```cypher
MATCH (completed:Task {status: 'completed'})
MATCH (pending:Task {status: 'pending'})-[:DEPENDS_ON]->(completed)
WHERE NOT EXISTS {
  MATCH (pending)-[:DEPENDS_ON]->(other:Task)
  WHERE other.status <> 'completed' AND other.id <> completed.id
}
RETURN COLLECT(pending.id) AS unblockedTasks
```

### 3. pm_create_task

Create a new task in the knowledge graph.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "taskId": {
      "type": "string",
      "description": "Unique task identifier"
    },
    "name": {
      "type": "string",
      "description": "Task name"
    },
    "description": {
      "type": "string",
      "description": "Task description"
    },
    "priority": {
      "type": "string",
      "enum": ["low", "medium", "high", "critical"]
    },
    "epicId": {
      "type": "string",
      "description": "Parent epic ID"
    },
    "dependencies": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Task IDs this task depends on"
    },
    "requiredCapabilities": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Required agent capabilities"
    },
    "estimatedDuration": {
      "type": "string",
      "description": "Estimated duration (e.g., '30m')"
    }
  },
  "required": ["taskId", "name", "epicId"]
}
```

**Output:**
```json
{
  "success": true,
  "taskId": "UAT-015",
  "status": "pending",
  "dependenciesMet": false
}
```

**Cypher Query:**
```cypher
MATCH (e:Epic {id: $epicId})
CREATE (t:Task {
  id: $taskId,
  name: $name,
  description: $description,
  priority: COALESCE($priority, 'medium'),
  status: 'pending',
  requiredCapabilities: $requiredCapabilities,
  estimatedDuration: $estimatedDuration,
  created: datetime(),
  updated: datetime()
})
CREATE (e)-[:HAS_TASK]->(t)
WITH t
UNWIND COALESCE($dependencies, []) AS depId
MATCH (dep:Task {id: depId})
CREATE (t)-[:DEPENDS_ON]->(dep)
RETURN t
```

### 4. pm_report_bug

Report a bug discovered during task execution.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "title": {
      "type": "string",
      "description": "Bug title"
    },
    "description": {
      "type": "string",
      "description": "Detailed bug description"
    },
    "severity": {
      "type": "string",
      "enum": ["low", "medium", "high", "critical"]
    },
    "foundBy": {
      "type": "string",
      "description": "Agent that discovered the bug"
    },
    "foundInTask": {
      "type": "string",
      "description": "Task ID where bug was found"
    },
    "blockedTasks": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Task IDs blocked by this bug"
    }
  },
  "required": ["title", "description", "severity", "foundBy"]
}
```

**Output:**
```json
{
  "success": true,
  "bugId": "BUG-001",
  "blockedTasksCount": 2,
  "tasksMarkedBlocked": ["UAT-016", "UAT-017"]
}
```

**Cypher Queries:**

*Create bug:*
```cypher
CREATE (b:Bug {
  id: 'BUG-' + toString(randomUUID()),
  title: $title,
  description: $description,
  severity: $severity,
  status: 'open',
  foundBy: $foundBy,
  created: datetime()
})
WITH b
MATCH (a:Agent {name: $foundBy})
CREATE (a)-[:REPORTED]->(b)
WITH b
MATCH (t:Task {id: $foundInTask})
CREATE (b)-[:FOUND_IN]->(t)
RETURN b.id AS bugId
```

*Block tasks:*
```cypher
MATCH (b:Bug {id: $bugId})
UNWIND $blockedTasks AS taskId
MATCH (t:Task {id: taskId})
SET t.status = 'blocked'
CREATE (t)-[:BLOCKED_BY]->(b)
RETURN COLLECT(t.id) AS blockedTasks
```

### 5. pm_query_graph

Execute a custom Cypher query on the knowledge graph.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "Cypher query to execute"
    },
    "parameters": {
      "type": "object",
      "description": "Query parameters"
    }
  },
  "required": ["query"]
}
```

**Output:**
```json
{
  "results": [
    { "name": "Task 1", "status": "completed" },
    { "name": "Task 2", "status": "pending" }
  ],
  "count": 2
}
```

**Security:**
- Read-only queries enforced
- No `CREATE`, `SET`, `DELETE`, `MERGE` allowed
- Query timeout: 30 seconds

### 6. pm_get_project_status

Get overall project status and metrics.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string",
      "description": "Project identifier"
    }
  },
  "required": ["projectId"]
}
```

**Output:**
```json
{
  "projectId": "working-todo-app",
  "projectName": "Working Todo App",
  "status": "active",
  "epics": {
    "total": 3,
    "completed": 1,
    "inProgress": 2
  },
  "tasks": {
    "total": 25,
    "pending": 15,
    "inProgress": 2,
    "blocked": 3,
    "completed": 5
  },
  "bugs": {
    "total": 2,
    "open": 2,
    "critical": 1
  },
  "agents": {
    "active": 3,
    "idle": 2
  },
  "progress": 20.0,
  "criticalPath": ["UAT-001", "UAT-002", "UAT-015"]
}
```

**Cypher Queries:**

*Task statistics:*
```cypher
MATCH (p:Project {id: $projectId})-[:CONTAINS]->(e:Epic)-[:HAS_TASK]->(t:Task)
RETURN
  COUNT(t) AS total,
  SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) AS pending,
  SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) AS inProgress,
  SUM(CASE WHEN t.status = 'blocked' THEN 1 ELSE 0 END) AS blocked,
  SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed
```

*Critical path:*
```cypher
MATCH path = (start:Task)-[:DEPENDS_ON*]->(end:Task)
WHERE NOT EXISTS((end)-[:DEPENDS_ON]->(:Task))
RETURN [node IN nodes(path) | node.id] AS taskIds
ORDER BY length(path) DESC
LIMIT 1
```

## Agent Interaction Patterns

### Pattern 1: Orchestrator Assigns Task

```
Orchestrator Agent
    ↓
1. Query: pm_get_next_task({
     agentName: 'orchestrator',
     capabilities: ['browser-automation'],
     priority: 'high'
   })
    ↓
PM Server queries Neo4j
    ↓
2. Returns: {taskId: 'UAT-001', name: '...', ...}
    ↓
3. Orchestrator spawns Integration Tester Agent
    ↓
4. Integration Tester executes task
    ↓
5. Report: pm_report_progress({
     agentName: 'integration-tester',
     taskId: 'UAT-001',
     status: 'completed',
     artifacts: [...]
   })
    ↓
PM Server updates Neo4j
```

### Pattern 2: Bug Discovery

```
Integration Tester Agent
    ↓
1. Discovers bug during execution
    ↓
2. Report: pm_report_bug({
     title: 'Login button not responding',
     severity: 'high',
     foundBy: 'integration-tester',
     blockedTasks: ['UAT-016', 'UAT-017']
   })
    ↓
PM Server:
  - Creates Bug node
  - Links to blocked tasks
  - Sets task status to 'blocked'
    ↓
3. Orchestrator queries pm_get_next_task()
    ↓
4. PM Server filters out blocked tasks
    ↓
5. Returns next unblocked task
```

### Pattern 3: Dependency Resolution

```
Agent completes Task A
    ↓
pm_report_progress({
  taskId: 'TASK-A',
  status: 'completed'
})
    ↓
PM Server:
  1. Marks Task A as completed
  2. Finds tasks that depend on Task A
  3. Checks if other dependencies met
  4. Returns list of newly unblocked tasks
    ↓
Orchestrator receives list of unblocked tasks
    ↓
Assigns next task from unblocked list
```

## Data Flow Examples

### Example 1: Complete UAT Flow

**Initial State:**
```cypher
// Project structure
(Project {id: 'working-todo-app'})
  -[:CONTAINS]->
(Epic {id: 'uat-testing', name: 'UAT Testing'})
  -[:HAS_TASK]->
(Task {id: 'UAT-001', status: 'pending', priority: 'high'})
  <-[:DEPENDS_ON]-
(Task {id: 'UAT-002', status: 'pending', priority: 'high'})
```

**Step 1: Orchestrator requests task**
```javascript
pm_get_next_task({
  agentName: 'orchestrator',
  capabilities: ['browser-automation']
})
// Returns: UAT-001 (no dependencies, not blocked)
```

**Step 2: Integration Tester starts work**
```javascript
pm_report_progress({
  agentName: 'integration-tester',
  taskId: 'UAT-001',
  status: 'in_progress'
})
```

**Graph State:**
```cypher
(Task {id: 'UAT-001', status: 'in_progress', assignedTo: 'integration-tester'})
  <-[:ASSIGNED_TO]-
(Agent {name: 'integration-tester', status: 'busy'})
```

**Step 3: Task completed**
```javascript
pm_report_progress({
  agentName: 'integration-tester',
  taskId: 'UAT-001',
  status: 'completed',
  artifacts: [
    {path: 'screenshots/scenario-001/', type: 'screenshot'},
    {path: 'reports/UAT-001.md', type: 'report'}
  ]
})
// Returns: {unblockedTasks: ['UAT-002']}
```

**Graph State:**
```cypher
(Task {id: 'UAT-001', status: 'completed', completed: '2025-10-14T...'})
  -[:PRODUCES]->
(Artifact {path: 'screenshots/scenario-001/', type: 'screenshot'})

(Task {id: 'UAT-002', status: 'pending'})
  -[:DEPENDS_ON]->
(Task {id: 'UAT-001', status: 'completed'})
// UAT-002 now unblocked and ready
```

**Step 4: Next task assignment**
```javascript
pm_get_next_task({
  agentName: 'orchestrator',
  capabilities: ['browser-automation']
})
// Returns: UAT-002 (dependency met)
```

### Example 2: Bug Blocking Flow

**Initial State:**
```cypher
(Task {id: 'UAT-015', status: 'in_progress'})
(Task {id: 'UAT-016', status: 'pending'})-[:DEPENDS_ON]->(Task {id: 'UAT-015'})
(Task {id: 'UAT-017', status: 'pending'})-[:DEPENDS_ON]->(Task {id: 'UAT-015'})
```

**Step 1: Bug discovered**
```javascript
pm_report_bug({
  title: 'Delete button removes wrong todo',
  description: 'Clicking delete removes random todo instead of selected one',
  severity: 'critical',
  foundBy: 'integration-tester',
  foundInTask: 'UAT-015',
  blockedTasks: ['UAT-016', 'UAT-017']
})
```

**Graph State:**
```cypher
(Bug {id: 'BUG-001', severity: 'critical', status: 'open'})
  -[:BLOCKS]->
(Task {id: 'UAT-016', status: 'blocked'})

(Bug {id: 'BUG-001'})
  -[:BLOCKS]->
(Task {id: 'UAT-017', status: 'blocked'})

(Agent {name: 'integration-tester'})-[:REPORTED]->(Bug {id: 'BUG-001'})
```

**Step 2: Orchestrator requests task**
```javascript
pm_get_next_task({capabilities: ['browser-automation']})
// Returns: UAT-018 (UAT-016 and UAT-017 filtered out - blocked)
```

**Step 3: Bug fixed**
```javascript
pm_query_graph({
  query: `
    MATCH (b:Bug {id: 'BUG-001'})
    SET b.status = 'fixed', b.resolved = datetime()
    WITH b
    MATCH (t:Task)-[r:BLOCKED_BY]->(b)
    DELETE r
    SET t.status = 'pending'
    RETURN COLLECT(t.id) AS unblocked
  `
})
// Returns: {unblocked: ['UAT-016', 'UAT-017']}
```

## Concurrency Model

### Transaction Isolation

**Neo4j Transactions:**
- Each MCP tool call = one Neo4j transaction
- Read committed isolation level
- Automatic retry on transient failures

**Example:**
```javascript
async function handleReportProgress(params) {
  const resourceManager = await ResourceManager.getInstance();
  const neo4j = await resourceManager.getNeo4jServer();

  // Use ResourceManager's transaction helper
  return neo4j.transaction(async (tx) => {
    // Update task
    await tx.run(updateTaskQuery, params);

    // Create artifacts
    await tx.run(createArtifactsQuery, params);

    // Find unblocked tasks
    const result = await tx.run(findUnblockedQuery, params);

    return processResult(result);
  });
  // ResourceManager handles commit/rollback/session cleanup automatically
}
```

### Concurrent Agent Requests

**Scenario:** Multiple agents request tasks simultaneously

**Handling:**
1. Each request gets its own Neo4j session
2. Task assignment uses `SET` with optimistic locking
3. If task already assigned → retry with next task
4. Max 3 retries before returning "no tasks available"

**Optimistic Locking:**
```cypher
MATCH (t:Task {id: $taskId, status: 'pending', assignedTo: null})
SET t.assignedTo = $agentName,
    t.status = 'in_progress',
    t.started = datetime()
RETURN t
```

If task was already assigned, match fails → no update → retry.

### Connection Pooling

**Neo4j connection pooling is managed by ResourceManager:**
- Max pool size: 50 connections
- Connection acquisition timeout: 30 seconds
- Max transaction retry time: 30 seconds
- Automatic health checking and reconnection

ResourceManager creates the driver with optimal pooling configuration - no manual setup needed!

## Error Handling

### Error Categories

**1. Validation Errors (400)**
- Missing required parameters
- Invalid enum values
- Invalid task IDs

**Response:**
```json
{
  "error": "ValidationError",
  "message": "Invalid status: 'running'. Must be one of: pending, in_progress, blocked, completed, failed",
  "field": "status"
}
```

**2. Not Found Errors (404)**
- Task not found
- Agent not found
- Project not found

**Response:**
```json
{
  "error": "NotFoundError",
  "message": "Task not found: UAT-999",
  "entityType": "Task",
  "entityId": "UAT-999"
}
```

**3. Conflict Errors (409)**
- Task already assigned
- Task already completed
- Duplicate task ID

**Response:**
```json
{
  "error": "ConflictError",
  "message": "Task UAT-001 is already assigned to agent 'integration-tester'",
  "taskId": "UAT-001",
  "assignedTo": "integration-tester"
}
```

**4. Database Errors (500)**
- Neo4j connection failure
- Transaction timeout
- Query execution failure

**Response:**
```json
{
  "error": "DatabaseError",
  "message": "Failed to connect to Neo4j",
  "retryable": true
}
```

### Retry Logic

**Transient Failures:**
- Connection timeouts
- Deadlocks
- Constraint violations

**Strategy:**
- Max 3 retries
- Exponential backoff: 100ms, 200ms, 400ms
- Log each retry attempt

```javascript
async function executeWithRetry(fn, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isTransient(error) || attempt === maxRetries) {
        throw error;
      }
      await sleep(100 * Math.pow(2, attempt - 1));
    }
  }
}
```

## Configuration

### Neo4j via ResourceManager

**The PM Agent uses ResourceManager to access Neo4j - NO manual driver creation needed!**

ResourceManager automatically:
- Starts Neo4j Docker container (`legion-neo4j:5.13.0`)
- Creates connection driver with pooling
- Provides health checking
- Manages sessions and transactions

**Getting Neo4j:**
```javascript
import { ResourceManager } from '@legion/resource-manager';

// Get ResourceManager instance
const resourceManager = await ResourceManager.getInstance();

// Get Neo4j server handle - ResourceManager handles everything!
const neo4j = await resourceManager.getNeo4jServer();

// Execute queries
const result = await neo4j.run('MATCH (n) RETURN n LIMIT 10');

// Use transactions
await neo4j.transaction(async (tx) => {
  await tx.run('CREATE (t:Task {id: $id})', { id: 'TASK-001' });
});

// Check health
const healthy = await neo4j.isHealthy();
```

### Environment Variables

```bash
# Neo4j Connection (used by ResourceManager)
NEO4J_URI=bolt://localhost:7687        # Default
NEO4J_USER=neo4j                        # Default
NEO4J_PASSWORD=password123              # Default

# Auto-start Neo4j on ResourceManager initialization
AUTO_START_SERVICES=neo4j

# Server Configuration
PM_SERVER_NAME=project-management
PM_SERVER_VERSION=1.0.0
PM_LOG_LEVEL=info

# Query Timeout
QUERY_TIMEOUT_MS=30000
```

**ResourceManager provides:**
- `neo4j.driver` - Neo4j driver instance
- `neo4j.run(query, params)` - Execute query
- `neo4j.transaction(work, config)` - Transactional work
- `neo4j.session(config)` - Create session
- `neo4j.isHealthy()` - Health check
- `neo4j.close()` - Close connection

**Connection Pooling** (managed by ResourceManager):
- Max pool size: 50 connections
- Connection timeout: 30 seconds
- Auto-retry on transient failures

### MCP Server Configuration

**User's `~/.config/claude-code/config.json`:**
```json
{
  "mcpServers": {
    "project-management": {
      "command": "node",
      "args": [
        "/Users/user/Legion/packages/project-management/src/index.js"
      ]
    }
  }
}
```

**Note:** No environment variables needed in MCP config! ResourceManager reads from the monorepo root `.env` file automatically.

## Query Performance

### Optimization Strategies

**1. Use Indexes**
- All status fields indexed
- All timestamp fields indexed
- Unique constraints on IDs

**2. Limit Result Sets**
```cypher
// Bad: Returns all tasks
MATCH (t:Task) RETURN t

// Good: Limit results
MATCH (t:Task {status: 'pending'})
RETURN t
ORDER BY t.priority DESC, t.created
LIMIT 10
```

**3. Avoid Cartesian Products**
```cypher
// Bad: Creates cartesian product
MATCH (t:Task), (a:Agent)
WHERE t.status = 'pending'
RETURN t, a

// Good: Use relationships
MATCH (t:Task {status: 'pending'})-[:ASSIGNED_TO]->(a:Agent)
RETURN t, a
```

**4. Use Query Profiling**
```cypher
PROFILE MATCH (t:Task {status: 'pending'})
WHERE NOT EXISTS((t)-[:BLOCKED_BY]->(:Bug))
RETURN t
```

### Expected Performance

**Typical Query Times:**
- `pm_get_next_task`: < 50ms
- `pm_report_progress`: < 100ms
- `pm_get_project_status`: < 200ms
- `pm_query_graph`: < 500ms (depends on complexity)

## Logging

### Log Levels

**INFO:**
- Tool calls received
- Tool calls completed
- Task status changes
- Bug reports

**DEBUG:**
- Cypher queries executed
- Query parameters
- Transaction boundaries

**WARN:**
- Retry attempts
- Deprecated tool usage
- Performance degradation

**ERROR:**
- Query failures
- Connection failures
- Validation errors

### Log Format

```json
{
  "timestamp": "2025-10-14T17:45:23.123Z",
  "level": "INFO",
  "tool": "pm_get_next_task",
  "agentName": "orchestrator",
  "duration": 45,
  "result": {
    "taskId": "UAT-001",
    "taskName": "Execute user registration test"
  }
}
```

## Security Considerations

### Query Injection Prevention

**Safe:**
```javascript
// Parameterized query
await tx.run(
  'MATCH (t:Task {id: $taskId}) RETURN t',
  { taskId: userInput }
);
```

**Unsafe:**
```javascript
// String concatenation
await tx.run(
  `MATCH (t:Task {id: '${userInput}'}) RETURN t`
);
```

### Read-Only Query Tool

**`pm_query_graph` restrictions:**
- Only `MATCH` and `RETURN` allowed
- No `CREATE`, `SET`, `DELETE`, `MERGE`
- Regex validation before execution
- Query timeout enforced

```javascript
function validateReadOnlyQuery(query) {
  const writeKeywords = /\b(CREATE|SET|DELETE|MERGE|REMOVE)\b/i;
  if (writeKeywords.test(query)) {
    throw new Error('Write operations not allowed in query tool');
  }
}
```

### Authentication

**MCP Protocol Level:**
- No authentication built into MCP
- Server runs as user process
- Access control via file system permissions

**Neo4j Level:**
- Username/password authentication
- Credentials from environment variables
- Connection encryption via `bolt+s://`

## Example Workflows

### Workflow 1: Initialize New Project

```javascript
// 1. Create project
pm_query_graph({
  query: `
    CREATE (p:Project {
      id: 'working-todo-app',
      name: 'Working Todo App',
      description: 'Production-ready todo application',
      status: 'active',
      created: datetime()
    })
    RETURN p
  `
});

// 2. Create epic
pm_query_graph({
  query: `
    MATCH (p:Project {id: 'working-todo-app'})
    CREATE (e:Epic {
      id: 'uat-testing',
      name: 'UAT Testing',
      description: 'User acceptance testing scenarios',
      status: 'pending',
      priority: 'high'
    })
    CREATE (p)-[:CONTAINS]->(e)
    RETURN e
  `
});

// 3. Create tasks with dependencies
pm_create_task({
  taskId: 'UAT-001',
  name: 'Test user registration',
  epicId: 'uat-testing',
  priority: 'high',
  requiredCapabilities: ['browser-automation'],
  dependencies: []
});

pm_create_task({
  taskId: 'UAT-002',
  name: 'Test duplicate email handling',
  epicId: 'uat-testing',
  priority: 'high',
  requiredCapabilities: ['browser-automation'],
  dependencies: ['UAT-001']  // Must complete UAT-001 first
});
```

### Workflow 2: Agent Execution Loop

```javascript
// Orchestrator agent loop
while (true) {
  // 1. Get next task
  const task = await pm_get_next_task({
    agentName: 'orchestrator',
    capabilities: ['browser-automation'],
    priority: 'medium'
  });

  if (!task) {
    console.log('No tasks available');
    break;
  }

  // 2. Spawn appropriate agent
  const agent = selectAgent(task.requiredCapabilities);
  await spawnAgent(agent, task);

  // 3. Agent executes and reports
  // (happens asynchronously)

  // 4. Check for newly unblocked tasks
  const status = await pm_get_project_status({
    projectId: 'working-todo-app'
  });

  console.log(`Progress: ${status.progress}%`);
}
```

### Workflow 3: Bug Triage

```javascript
// 1. Bug discovered
const bugReport = await pm_report_bug({
  title: 'Login fails with valid credentials',
  description: 'User cannot log in despite correct email/password',
  severity: 'critical',
  foundBy: 'integration-tester',
  foundInTask: 'UAT-006',
  blockedTasks: ['UAT-007', 'UAT-008', 'UAT-009']
});

console.log(`Created bug: ${bugReport.bugId}`);
console.log(`Blocked ${bugReport.blockedTasksCount} tasks`);

// 2. Get all open bugs
const bugs = await pm_query_graph({
  query: `
    MATCH (b:Bug {status: 'open'})
    OPTIONAL MATCH (b)-[:BLOCKS]->(t:Task)
    RETURN b.id, b.title, b.severity, COUNT(t) AS blockedCount
    ORDER BY
      CASE b.severity
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        ELSE 4
      END,
      blockedCount DESC
  `
});

// 3. Prioritize bugs by impact
// (Critical bugs blocking multiple tasks)

// 4. Fix bug and unblock tasks
await pm_query_graph({
  query: `
    MATCH (b:Bug {id: $bugId})
    SET b.status = 'fixed', b.resolved = datetime()
    WITH b
    MATCH (t:Task)-[r:BLOCKED_BY]->(b)
    DELETE r
    SET t.status = 'pending'
    RETURN COLLECT(t.id) AS unblocked
  `,
  parameters: { bugId: 'BUG-001' }
});
```

---

## Appendix A: Complete Cypher Schema

```cypher
// ============================================
// CONSTRAINTS
// ============================================

CREATE CONSTRAINT project_id IF NOT EXISTS
FOR (p:Project) REQUIRE p.id IS UNIQUE;

CREATE CONSTRAINT epic_id IF NOT EXISTS
FOR (e:Epic) REQUIRE e.id IS UNIQUE;

CREATE CONSTRAINT task_id IF NOT EXISTS
FOR (t:Task) REQUIRE t.id IS UNIQUE;

CREATE CONSTRAINT agent_name IF NOT EXISTS
FOR (a:Agent) REQUIRE a.name IS UNIQUE;

CREATE CONSTRAINT artifact_id IF NOT EXISTS
FOR (a:Artifact) REQUIRE a.id IS UNIQUE;

CREATE CONSTRAINT bug_id IF NOT EXISTS
FOR (b:Bug) REQUIRE b.id IS UNIQUE;

CREATE CONSTRAINT test_scenario_id IF NOT EXISTS
FOR (ts:TestScenario) REQUIRE ts.id IS UNIQUE;

// ============================================
// INDEXES
// ============================================

CREATE INDEX task_status IF NOT EXISTS
FOR (t:Task) ON (t.status);

CREATE INDEX task_priority IF NOT EXISTS
FOR (t:Task) ON (t.priority);

CREATE INDEX task_assignedTo IF NOT EXISTS
FOR (t:Task) ON (t.assignedTo);

CREATE INDEX agent_status IF NOT EXISTS
FOR (a:Agent) ON (a.status);

CREATE INDEX bug_status IF NOT EXISTS
FOR (b:Bug) ON (b.status);

CREATE INDEX bug_severity IF NOT EXISTS
FOR (b:Bug) ON (b.severity);

CREATE INDEX task_created IF NOT EXISTS
FOR (t:Task) ON (t.created);

CREATE INDEX task_completed IF NOT EXISTS
FOR (t:Task) ON (t.completed);

// ============================================
// SAMPLE DATA
// ============================================

// Project
CREATE (p:Project {
  id: 'working-todo-app',
  name: 'Working Todo App',
  description: 'Production-ready todo application with UAT',
  status: 'active',
  created: datetime(),
  updated: datetime()
});

// Epic
MATCH (p:Project {id: 'working-todo-app'})
CREATE (e:Epic {
  id: 'uat-testing',
  name: 'UAT Testing',
  description: 'User acceptance testing scenarios',
  status: 'in_progress',
  priority: 'high'
})
CREATE (p)-[:CONTAINS]->(e);

// Tasks
MATCH (e:Epic {id: 'uat-testing'})
CREATE (t1:Task {
  id: 'UAT-001',
  name: 'Test user registration',
  description: 'Verify user can register with valid credentials',
  status: 'completed',
  priority: 'high',
  requiredCapabilities: ['browser-automation'],
  estimatedDuration: '5m',
  actualDuration: '4m 30s',
  created: datetime(),
  started: datetime(),
  completed: datetime(),
  updated: datetime()
})
CREATE (e)-[:HAS_TASK]->(t1);

MATCH (e:Epic {id: 'uat-testing'})
CREATE (t2:Task {
  id: 'UAT-002',
  name: 'Test duplicate email handling',
  description: 'Verify system rejects duplicate email addresses',
  status: 'pending',
  priority: 'high',
  requiredCapabilities: ['browser-automation'],
  estimatedDuration: '3m',
  created: datetime(),
  updated: datetime()
})
CREATE (e)-[:HAS_TASK]->(t2);

// Dependency
MATCH (t1:Task {id: 'UAT-001'})
MATCH (t2:Task {id: 'UAT-002'})
CREATE (t2)-[:DEPENDS_ON]->(t1);

// Agent
CREATE (a:Agent {
  name: 'integration-tester',
  type: 'integration-tester',
  capabilities: ['browser-automation', 'screenshot-capture', 'test-execution'],
  status: 'idle',
  lastActive: datetime()
});

// Agent completed task
MATCH (a:Agent {name: 'integration-tester'})
MATCH (t:Task {id: 'UAT-001'})
CREATE (a)-[:COMPLETED]->(t);

// Artifacts
MATCH (t:Task {id: 'UAT-001'})
CREATE (art1:Artifact {
  id: randomUUID(),
  path: 'screenshots/scenario-001/',
  type: 'screenshot',
  created: datetime(),
  size: 45678
})
CREATE (t)-[:PRODUCES]->(art1);

MATCH (t:Task {id: 'UAT-001'})
CREATE (art2:Artifact {
  id: randomUUID(),
  path: 'reports/UAT-001.md',
  type: 'report',
  created: datetime(),
  size: 12345
})
CREATE (t)-[:PRODUCES]->(art2);
```

## Appendix B: MCP Tool Reference

### Tool Summary Table

| Tool Name | Purpose | Key Parameters | Typical Response Time |
|-----------|---------|----------------|----------------------|
| `pm_get_next_task` | Get next available task | `capabilities`, `priority` | < 50ms |
| `pm_report_progress` | Report task progress | `taskId`, `status`, `artifacts` | < 100ms |
| `pm_create_task` | Create new task | `taskId`, `name`, `epicId` | < 100ms |
| `pm_report_bug` | Report discovered bug | `title`, `severity`, `blockedTasks` | < 100ms |
| `pm_query_graph` | Custom Cypher query | `query`, `parameters` | < 500ms |
| `pm_get_project_status` | Get project overview | `projectId` | < 200ms |

### Tool Call Examples

**Get next task:**
```javascript
mcp_project_management__pm_get_next_task({
  agentName: 'orchestrator',
  capabilities: ['browser-automation'],
  priority: 'high'
})
```

**Report completion:**
```javascript
mcp_project_management__pm_report_progress({
  agentName: 'integration-tester',
  taskId: 'UAT-001',
  status: 'completed',
  artifacts: [
    { path: 'screenshots/scenario-001/', type: 'screenshot' },
    { path: 'reports/UAT-001.md', type: 'report' }
  ],
  metrics: {
    passRate: 100,
    duration: '4m 30s'
  }
})
```

**Report bug:**
```javascript
mcp_project_management__pm_report_bug({
  title: 'Login button not responding',
  description: 'Clicking login button does nothing',
  severity: 'critical',
  foundBy: 'integration-tester',
  foundInTask: 'UAT-006',
  blockedTasks: ['UAT-007', 'UAT-008']
})
```

---

**End of Design Document**
