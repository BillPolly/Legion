# Project Management

Core business logic for project management operations using Neo4j knowledge graph. This package provides pure functions for task management, planning, and progress tracking.

**Note**: For HTTP server implementation, see `@legion/project-server` in `packages/apps/project-server`.

## Features

- **Knowledge Graph Architecture**: Neo4j-backed graph database with Projects, Epics, Tasks, Agents, Bugs, Artifacts, and Plans
- **Task Dependency Management**: Automatic dependency resolution and task unblocking
- **Bug Tracking**: Report bugs that block tasks, automatic task filtering
- **Agent Coordination**: Multi-agent task assignment with capability matching
- **Progress Tracking**: Real-time status updates, artifact creation, metrics collection
- **Plan Management**: Incremental planning with version history for multi-agent collaboration
- **Pure Business Logic**: No transport layer - can be used by any server (HTTP, WebSocket, etc.)

## Architecture

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
│  │  - pm_update_plan()                      │   │
│  │  - pm_get_plan()                         │   │
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

## Installation

### Prerequisites

1. **Node.js**: Version 18+ required
2. **Docker**: Required for Neo4j (ResourceManager auto-starts Neo4j container)
3. **Claude Code**: Latest version

### Setup

The Project Management Agent is part of the Legion monorepo. From the monorepo root:

```bash
# Install dependencies
npm install

# Navigate to project-management package
cd packages/project-management

# Run tests to verify installation
npm test
```

## Configuration

### Environment Variables

Add these to your **monorepo root `.env` file** (the ResourceManager singleton automatically loads from there):

```bash
# Neo4j Connection (used by ResourceManager)
# These are the defaults - only add if you need custom values
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password123

# Auto-start Neo4j on ResourceManager initialization
AUTO_START_SERVICES=neo4j

# Server Configuration (optional)
PM_SERVER_NAME=project-management
PM_SERVER_VERSION=1.0.0
PM_LOG_LEVEL=info

# Query Timeout (optional)
QUERY_TIMEOUT_MS=30000
```

**Important Notes:**
- NO manual Neo4j setup required - ResourceManager automatically starts Neo4j Docker container
- NO manual driver creation - ResourceManager provides Neo4j connection with pooling
- ALL environment variables must be in monorepo root `.env` file (NOT package-level)
- ResourceManager is a singleton - all packages share the same instance

### Claude Code Configuration

Add the MCP server to your Claude Code config at `~/.config/claude-code/config.json`:

```json
{
  "mcpServers": {
    "project-management": {
      "command": "node",
      "args": [
        "/absolute/path/to/Legion/packages/project-management/src/index.js"
      ]
    }
  }
}
```

**Replace `/absolute/path/to/Legion` with your actual Legion monorepo path.**

Example (macOS/Linux):
```json
{
  "mcpServers": {
    "project-management": {
      "command": "node",
      "args": [
        "/Users/username/Legion/packages/project-management/src/index.js"
      ]
    }
  }
}
```

Example (Windows):
```json
{
  "mcpServers": {
    "project-management": {
      "command": "node",
      "args": [
        "C:\\Users\\username\\Legion\\packages\\project-management\\src\\index.js"
      ]
    }
  }
}
```

### Verification

After configuration, verify the MCP server is working:

1. **Start Claude Code** - The MCP server will start automatically
2. **Check MCP Tools** - In Claude Code, you should see 8 new tools:
   - `pm_get_next_task`
   - `pm_report_progress`
   - `pm_create_task`
   - `pm_report_bug`
   - `pm_query_graph`
   - `pm_get_project_status`
   - `pm_update_plan`
   - `pm_get_plan`

3. **Test Neo4j Connection** - The server logs will show:
   ```
   [INFO] Neo4j connection established
   [INFO] MCP Server initialized successfully
   ```

## MCP Tools

### 1. pm_get_next_task

Get the next available task for an agent to work on.

**Input:**
```json
{
  "agentName": "orchestrator",
  "capabilities": ["browser-automation"],
  "priority": "high"
}
```

**Output:**
```json
{
  "taskId": "UAT-001",
  "taskName": "Execute user registration test",
  "description": "Test user registration with valid credentials",
  "priority": "high",
  "dependencies": []
}
```

**Logic:**
- Filters by agent capabilities
- Excludes tasks with incomplete dependencies
- Excludes tasks blocked by open bugs
- Returns highest priority unblocked task

### 2. pm_report_progress

Report task progress or completion.

**Input:**
```json
{
  "agentName": "integration-tester",
  "taskId": "UAT-001",
  "status": "completed",
  "artifacts": [
    { "path": "screenshots/scenario-001/", "type": "screenshot" },
    { "path": "reports/UAT-001.md", "type": "report" }
  ]
}
```

**Output:**
```json
{
  "success": true,
  "taskId": "UAT-001",
  "previousStatus": "in_progress",
  "newStatus": "completed",
  "artifactsCreated": 2,
  "unblockedTasks": ["UAT-002", "UAT-003"]
}
```

**Features:**
- Updates task status and timestamps
- Creates artifact nodes in graph
- Automatically unblocks dependent tasks
- Records agent completion history

### 3. pm_create_task

Create a new task in the knowledge graph.

**Input:**
```json
{
  "taskId": "UAT-015",
  "name": "Test user login",
  "description": "Verify user can log in with valid credentials",
  "priority": "high",
  "epicId": "uat-testing",
  "dependencies": ["UAT-001"],
  "requiredCapabilities": ["browser-automation"],
  "estimatedDuration": "5m"
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

### 4. pm_report_bug

Report a bug discovered during task execution.

**Input:**
```json
{
  "title": "Login button not responding",
  "description": "Clicking login button does nothing",
  "severity": "critical",
  "foundBy": "integration-tester",
  "foundInTask": "UAT-006",
  "blockedTasks": ["UAT-007", "UAT-008"]
}
```

**Output:**
```json
{
  "success": true,
  "bugId": "BUG-001",
  "blockedTasksCount": 2,
  "tasksMarkedBlocked": ["UAT-007", "UAT-008"]
}
```

### 5. pm_query_graph

Execute custom Cypher queries on the knowledge graph.

**Input:**
```json
{
  "query": "MATCH (t:Task {status: 'pending'}) RETURN t.id, t.name LIMIT 10",
  "parameters": {}
}
```

**Output:**
```json
{
  "results": [
    { "id": "UAT-001", "name": "Task 1" },
    { "id": "UAT-002", "name": "Task 2" }
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

**Input:**
```json
{
  "projectId": "working-todo-app"
}
```

**Output:**
```json
{
  "projectId": "working-todo-app",
  "projectName": "Working Todo App",
  "status": "active",
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
  "progress": 20.0
}
```

### 7. pm_update_plan

Create or update a plan document with incremental changes. Enables Claude sub-agents to document and evolve their thinking, architecture decisions, and implementation strategies over time.

**Input (create new plan):**
```json
{
  "projectId": "working-todo-app",
  "planId": "arch-plan",
  "title": "Architecture Implementation Plan",
  "content": "# Architecture Plan\n\n## Overview\nImplement modern React architecture...",
  "updateType": "create",
  "agentName": "planning-agent"
}
```

**Input (append to existing plan):**
```json
{
  "projectId": "working-todo-app",
  "planId": "arch-plan",
  "content": "\n\n## Security Requirements\n- Authentication: JWT tokens\n- Authorization: RBAC",
  "updateType": "append",
  "agentName": "security-agent"
}
```

**Input (update specific section):**
```json
{
  "projectId": "working-todo-app",
  "planId": "arch-plan",
  "content": "## Phase 1: Foundation ✅ COMPLETED\n- Database setup complete\n- Auth system implemented",
  "updateType": "update_section",
  "section": "Phase 1: Foundation",
  "agentName": "orchestrator"
}
```

**Output:**
```json
{
  "planId": "arch-plan-v2",
  "version": 2,
  "previousVersion": 1,
  "contentLength": 1245,
  "updateType": "append"
}
```

**Features:**
- **Four update modes**:
  - `create`: Create new plan (version 1)
  - `append`: Add content to end of plan
  - `replace`: Replace entire plan content
  - `update_section`: Update specific markdown section by heading
- **Automatic versioning**: Each update creates new version with PREVIOUS_VERSION relationship
- **Section-based updates**: Find and replace specific markdown sections without touching other content
- **Multi-agent collaboration**: Multiple agents can incrementally update the same plan
- **Full audit trail**: All previous versions preserved with timestamps and agent attribution

**Use Cases:**
- Planning Agent creates initial implementation plan
- Security Agent appends security requirements
- Orchestrator updates phase status as work progresses
- Architect adds performance optimization strategies
- All changes tracked with full version history

### 8. pm_get_plan

Retrieve current plan or specific version from history.

**Input (get latest plan by planId):**
```json
{
  "planId": "arch-plan"
}
```

**Input (get specific version):**
```json
{
  "planId": "arch-plan",
  "version": 2
}
```

**Input (get latest plan for project):**
```json
{
  "projectId": "working-todo-app"
}
```

**Output:**
```json
{
  "planId": "arch-plan-v3",
  "projectId": "working-todo-app",
  "title": "Architecture Implementation Plan",
  "content": "# Architecture Plan\n\n## Overview\n...",
  "version": 3,
  "status": "active",
  "createdBy": "planning-agent",
  "created": "2025-01-15T10:30:00Z",
  "updated": "2025-01-15T15:45:00Z",
  "previousVersions": [1, 2]
}
```

**Features:**
- Get latest active version by planId or projectId
- Access any historical version by number
- Full metadata including version history
- Markdown content ready for display or analysis

## Usage Examples

### Example 1: Basic Task Workflow

```javascript
// 1. Get next task
const task = await pm_get_next_task({
  agentName: 'orchestrator',
  capabilities: ['browser-automation']
});
// Returns: { taskId: 'UAT-001', taskName: '...', dependencies: [] }

// 2. Start work
await pm_report_progress({
  agentName: 'integration-tester',
  taskId: 'UAT-001',
  status: 'in_progress'
});

// 3. Complete with artifacts
await pm_report_progress({
  agentName: 'integration-tester',
  taskId: 'UAT-001',
  status: 'completed',
  artifacts: [
    { path: 'screenshots/scenario-001/', type: 'screenshot' },
    { path: 'reports/UAT-001.md', type: 'report' }
  ]
});
// Returns: { unblockedTasks: ['UAT-002'] }

// 4. Get next task (now UAT-002 is available)
const nextTask = await pm_get_next_task({
  agentName: 'orchestrator',
  capabilities: ['browser-automation']
});
// Returns: { taskId: 'UAT-002', dependencies: ['UAT-001'] }
```

### Example 2: Bug Reporting and Blocking

```javascript
// 1. Discover bug during testing
await pm_report_bug({
  title: 'Delete button removes wrong todo',
  description: 'Clicking delete removes random todo instead of selected one',
  severity: 'critical',
  foundBy: 'integration-tester',
  foundInTask: 'UAT-015',
  blockedTasks: ['UAT-016', 'UAT-017']
});
// Returns: { bugId: 'BUG-001', blockedTasksCount: 2 }

// 2. Get next task (UAT-016 and UAT-017 are now filtered out)
const task = await pm_get_next_task({
  agentName: 'orchestrator',
  capabilities: ['browser-automation']
});
// Returns: UAT-018 (or other unblocked task)

// 3. Fix bug and unblock tasks (using pm_query_graph)
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

### Example 3: Project Initialization

```javascript
// 1. Create project structure using pm_query_graph
await pm_query_graph({
  query: `
    CREATE (p:Project {
      id: 'my-project',
      name: 'My Project',
      description: 'Project description',
      status: 'active',
      created: datetime()
    })
    RETURN p
  `
});

await pm_query_graph({
  query: `
    MATCH (p:Project {id: 'my-project'})
    CREATE (e:Epic {
      id: 'epic-1',
      name: 'Feature Development',
      description: 'Core features',
      status: 'pending',
      priority: 'high'
    })
    CREATE (p)-[:CONTAINS]->(e)
    RETURN e
  `
});

// 2. Create tasks with dependencies
await pm_create_task({
  taskId: 'TASK-001',
  name: 'Implement user authentication',
  epicId: 'epic-1',
  priority: 'high',
  requiredCapabilities: ['coding', 'testing'],
  dependencies: []
});

await pm_create_task({
  taskId: 'TASK-002',
  name: 'Add password reset functionality',
  epicId: 'epic-1',
  priority: 'medium',
  requiredCapabilities: ['coding'],
  dependencies: ['TASK-001']
});

// 3. Monitor progress
const status = await pm_get_project_status({
  projectId: 'my-project'
});
console.log(`Progress: ${status.progress}%`);
```

## Knowledge Graph Schema

### Entity Types

- **Project**: Top-level project or feature
- **Epic**: Collection of related tasks
- **Task**: Single unit of work
- **Agent**: AI agent that performs work
- **Artifact**: Output produced by task completion
- **Bug**: Discovered issue that blocks work
- **Plan**: Markdown document containing planning, architecture, or implementation strategy with version history

### Relationships

- `(Project)-[:CONTAINS]->(Epic)`
- `(Project)-[:HAS_PLAN]->(Plan)` - Project plans
- `(Epic)-[:HAS_TASK]->(Task)`
- `(Task)-[:DEPENDS_ON]->(Task)` - Task dependencies
- `(Task)-[:PRODUCES]->(Artifact)` - Task outputs
- `(Task)-[:BLOCKED_BY]->(Bug)` - Blocking bugs
- `(Agent)-[:COMPLETED]->(Task)` - Completion history
- `(Agent)-[:CREATED]->(Plan)` - Plan authorship
- `(Plan)-[:PREVIOUS_VERSION]->(Plan)` - Version history chain

### Task States

- `pending`: Ready to be assigned (dependencies met, not blocked)
- `in_progress`: Currently being worked on
- `blocked`: Blocked by open bug
- `completed`: Successfully completed
- `failed`: Failed execution

## Performance

**Typical Query Times:**
- `pm_get_next_task`: < 50ms
- `pm_report_progress`: < 100ms
- `pm_create_task`: < 100ms
- `pm_report_bug`: < 100ms
- `pm_get_project_status`: < 200ms
- `pm_query_graph`: < 500ms (depends on complexity)

**Connection Pooling:**
- Max pool size: 50 connections
- Connection timeout: 30 seconds
- Automatic health checking and reconnection
- Managed by ResourceManager

## Testing

```bash
# Run all tests (106+ tests - 100% coverage)
npm test

# Run specific test suite
npm test -- progress-tracking
npm test -- get-next-task
npm test -- plan-operations
npm test -- e2e-uat-workflow

# Run with verbose output
npm test -- --verbose

# Run in watch mode
npm test -- --watch
```

**Test Coverage:**
- Unit tests: 85+ tests
- Integration tests: 20+ tests (including plan operations)
- End-to-end tests: 1 comprehensive workflow test
- NO MOCKS - all tests use real Neo4j database

## Development

### Project Structure

```
packages/project-management/
├── src/
│   ├── index.js                 # MCP server entry point
│   ├── mcp-server.js           # MCP tool handlers
│   ├── neo4j.js                # Neo4j connection (via ResourceManager)
│   ├── schema.js               # Graph schema initialization
│   ├── get-next-task.js        # Task assignment logic
│   ├── progress-tracking.js    # Progress reporting
│   ├── task-operations.js      # Task CRUD operations
│   ├── bug-operations.js       # Bug reporting and management
│   ├── agent-operations.js     # Agent registration
│   ├── plan-operations.js      # Plan CRUD with versioning
│   └── query-graph.js          # Custom query execution
├── __tests__/                  # 106+ passing tests
│   ├── plan-operations.test.js # Plan versioning tests
│   ├── unit/                   # Unit tests
│   ├── integration/            # Integration tests (real Neo4j)
│   └── e2e-uat-workflow.test.js  # End-to-end workflow test
├── examples/
│   └── incremental-planning-example.js  # Complete planning workflow demo
├── docs/
│   ├── DESIGN.md              # Complete design document
│   └── IMPLEMENTATION-PLAN.md # TDD implementation plan
└── package.json
```

### Adding New Tools

1. Add tool registration in `src/mcp-server.js`:
```javascript
{
  name: 'pm_my_new_tool',
  description: 'Description of tool',
  inputSchema: { /* JSON schema */ }
}
```

2. Add handler in `src/mcp-server.js`:
```javascript
case 'pm_my_new_tool':
  result = await handleMyNewTool(params);
  break;
```

3. Create implementation in appropriate module
4. Write tests in `__tests__/`
5. Update documentation

## Troubleshooting

### MCP Server Not Starting

**Problem**: Claude Code reports MCP server connection error

**Solutions**:
1. Check node version: `node --version` (must be 18+)
2. Verify absolute path in `config.json`
3. Check file exists: `ls /path/to/Legion/packages/project-management/src/index.js`
4. Check file permissions: `chmod +x src/index.js`
5. Check logs in Claude Code developer tools

### Neo4j Connection Failed

**Problem**: Server logs show "Failed to connect to Neo4j"

**Solutions**:
1. Verify Docker is running: `docker ps`
2. Check Neo4j container: `docker ps | grep neo4j`
3. ResourceManager should auto-start Neo4j - check logs
4. Manually start if needed: `docker start legion-neo4j`
5. Verify credentials in monorepo root `.env` file
6. Test connection: `docker exec -it legion-neo4j cypher-shell -u neo4j -p password123`

### Tools Not Appearing in Claude Code

**Problem**: MCP tools are not visible in Claude Code

**Solutions**:
1. Restart Claude Code completely
2. Check `~/.config/claude-code/config.json` syntax (valid JSON)
3. Verify server name matches: `"project-management"`
4. Check Claude Code logs for MCP initialization errors
5. Verify server starts without errors: `node src/index.js` (should output MCP protocol messages)

### Query Timeout

**Problem**: `pm_query_graph` times out

**Solutions**:
1. Simplify query - add `LIMIT` clauses
2. Use indexes - all status fields are indexed
3. Avoid cartesian products - use relationship patterns
4. Increase timeout in `.env`: `QUERY_TIMEOUT_MS=60000`
5. Profile query: `PROFILE MATCH (t:Task) RETURN t`

## Documentation

- **[DESIGN.md](docs/DESIGN.md)**: Complete architecture and design document
- **[IMPLEMENTATION-PLAN.md](docs/IMPLEMENTATION-PLAN.md)**: TDD implementation plan and progress

## License

Part of the Legion monorepo - see repository root for license information.

## Contributing

This project follows strict TDD methodology:
1. Write tests first
2. Implement to pass tests
3. NO mocks in integration tests (use real Neo4j)
4. ALL tests must pass before committing
5. Follow Uncle Bob's Clean Code principles

## Support

For issues, questions, or contributions, please use the Legion monorepo issue tracker.
