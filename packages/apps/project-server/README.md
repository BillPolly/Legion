# Project Server

**Persistent HTTP server for project management operations**

Replaces the MCP stdio-based approach with a standard REST API that stays running as a daemon.

## Quick Start

```bash
# Start server (default port 3001)
npm start --workspace=@legion/project-server

# Or with custom port
PORT=4000 npm start --workspace=@legion/project-server

# Server is now running at http://localhost:3001
```

## Architecture

```
Client Apps → HTTP/WebSocket → Project Server → @legion/project-management → Neo4j
```

**Clean Separation:**
- `@legion/project-management`: Pure business logic (no transport layer)
- `@legion/project-server`: HTTP server exposing operations as REST endpoints

## API Endpoints

All endpoints return JSON. Base URL: `http://localhost:3001/api`

### 1. GET /health
Health check endpoint

**Response:**
```json
{
  "status": "ok",
  "service": "project-server",
  "version": "1.0.0"
}
```

### 2. POST /api/tasks/next
Get next available task for an agent

**Request:**
```json
{
  "agentName": "my-agent",
  "capabilities": ["coding", "testing"],
  "priority": "high"
}
```

**Response:**
```json
{
  "taskId": "TASK-001",
  "name": "Implement login feature",
  "description": "...",
  "priority": "high",
  "dependencies": []
}
```

### 3. POST /api/tasks/progress
Report task progress or completion

**Request:**
```json
{
  "agentName": "my-agent",
  "taskId": "TASK-001",
  "status": "completed",
  "artifacts": [
    { "path": "src/login.js", "type": "code" }
  ]
}
```

### 4. POST /api/tasks
Create a new task

**Request:**
```json
{
  "taskId": "TASK-002",
  "name": "Add tests",
  "epicId": "EPIC-001",
  "priority": "medium",
  "dependencies": ["TASK-001"]
}
```

### 5. POST /api/bugs
Report a bug

**Request:**
```json
{
  "title": "Login fails",
  "description": "...",
  "severity": "critical",
  "foundBy": "test-agent",
  "blockedTasks": ["TASK-003"]
}
```

### 6. POST /api/query
Execute custom Cypher query (read-only)

**Request:**
```json
{
  "query": "MATCH (t:Task {status: 'pending'}) RETURN t LIMIT 10",
  "parameters": {}
}
```

### 7. GET /api/projects/:projectId/status
Get project status and metrics

**Response:**
```json
{
  "projectId": "my-project",
  "projectName": "My Project",
  "tasks": {
    "total": 25,
    "pending": 15,
    "inProgress": 5,
    "completed": 5
  },
  "progress": 20.0
}
```

### 8. POST /api/plans
Create or update a plan

**Request (create):**
```json
{
  "projectId": "my-project",
  "planId": "arch-plan",
  "title": "Architecture Plan",
  "content": "# Architecture\\n\\n## Overview\\n...",
  "updateType": "create",
  "agentName": "planning-agent"
}
```

**Request (update):**
```json
{
  "projectId": "my-project",
  "planId": "arch-plan",
  "content": "\\n\\n## New Section\\n...",
  "updateType": "append",
  "agentName": "dev-agent"
}
```

### 9. GET /api/plans/:planId
Get plan by ID

**Query params:**
- `version` (optional): Specific version number

**Response:**
```json
{
  "planId": "arch-plan-v2",
  "projectId": "my-project",
  "title": "Architecture Plan",
  "content": "# Architecture\\n...",
  "version": 2,
  "previousVersions": [1]
}
```

### 10. GET /api/plans?projectId=X
Get latest plan for project

### 11. GET /api/projects/:projectId/plans
List all plans for project

## WebSocket

Real-time updates available at `ws://localhost:3001`

```javascript
const ws = new WebSocket('ws://localhost:3001');

ws.on('message', (data) => {
  const event = JSON.parse(data);
  console.log('Project event:', event);
});
```

## Daemon Mode (PM2)

For persistent server:

```bash
# Install PM2
npm install -g pm2

# Start as daemon
pm2 start packages/apps/project-server/src/index.js --name project-server

# Monitor
pm2 logs project-server
pm2 status

# Stop
pm2 stop project-server

# Restart
pm2 restart project-server
```

## Development

```bash
# Install dependencies
npm install

# Start in dev mode (auto-reload)
npm run dev --workspace=@legion/project-server

# Run tests
npm test --workspace=@legion/project-server
```

## Configuration

Environment variables (optional):
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment mode (development/production)

Neo4j configuration handled by `@legion/resource-manager` - see monorepo root `.env`

## Benefits Over MCP

✅ **Persistent**: Server stays running, no startup delay
✅ **Simple**: Standard REST API, no MCP protocol complexity
✅ **Debuggable**: Easy to test with curl/Postman
✅ **Flexible**: Can be called from any language/tool
✅ **Real-time**: WebSocket support for live updates
✅ **Standard**: Uses Express, familiar patterns

## Architecture

The server is a thin HTTP layer over pure business logic:

```
packages/apps/project-server/
├── src/
│   ├── index.js      # Server setup (Express + WebSocket)
│   └── routes.js     # REST endpoints
└── package.json

packages/project-management/
├── src/
│   ├── index.js              # Clean exports
│   ├── get-next-task.js      # Pure logic
│   ├── plan-operations.js    # Pure logic
│   └── ...                   # All business logic
└── __tests__/                # 106+ tests
```

**Key insight**: Separating transport (HTTP) from logic (`@legion/project-management`) makes both testable and reusable.
