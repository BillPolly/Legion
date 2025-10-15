# Project Task Management Slash Command

Manage tasks, agents, and workflows using the @legion/project-server HTTP API.

## Usage

```
/project-task next <agent-name>
/project-task create <task-id> "<name>" <epic-id> [priority]
/project-task progress <agent-name> <task-id> <status>
/project-task status <project-id>
```

## Instructions for Claude

You are helping the user manage project tasks via the HTTP API at `http://localhost:3001/api`.

### Get Next Available Task

When an agent needs work:

```bash
curl -X POST http://localhost:3001/api/tasks/next \
  -H "Content-Type: application/json" \
  -d '{
    "agentName": "<agent-name>",
    "capabilities": ["coding", "testing", "documentation"],
    "priority": "high"
  }'
```

This returns the highest priority task that:
- Matches the agent's capabilities
- Has no incomplete dependencies
- Is not blocked by bugs
- Is in "pending" status

### Create a New Task

```bash
curl -X POST http://localhost:3001/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "<task-id>",
    "name": "<task-name>",
    "description": "<description>",
    "epicId": "<epic-id>",
    "priority": "high|medium|low|critical",
    "requiredCapabilities": ["coding", "testing"],
    "estimatedEffort": "2h",
    "dependencies": ["OTHER-TASK-001"]
  }'
```

### Report Task Progress

```bash
curl -X POST http://localhost:3001/api/tasks/progress \
  -H "Content-Type: application/json" \
  -d '{
    "agentName": "<agent-name>",
    "taskId": "<task-id>",
    "status": "in_progress|completed|blocked",
    "progress": 75,
    "notes": "Implemented core logic, tests pending",
    "artifacts": [
      {
        "path": "src/feature.js",
        "type": "code",
        "description": "Main implementation"
      }
    ]
  }'
```

### Get Project Status

```bash
curl http://localhost:3001/api/projects/<project-id>/status
```

Returns:
- Total tasks and breakdown by status
- Completion percentage
- Active blockers
- Agent utilization

## Example Workflow

**Scenario**: AI agent working on tasks

1. **Agent requests work**:
   ```
   POST /api/tasks/next
   { "agentName": "dev-agent", "capabilities": ["coding"] }
   ```

2. **Agent starts task**:
   ```
   POST /api/tasks/progress
   { "agentName": "dev-agent", "taskId": "TASK-001", "status": "in_progress" }
   ```

3. **Agent completes task**:
   ```
   POST /api/tasks/progress
   {
     "agentName": "dev-agent",
     "taskId": "TASK-001",
     "status": "completed",
     "artifacts": [...]
   }
   ```

4. **Agent requests next task** (repeats from step 1)

## Important Notes

- Tasks have dependencies - blocked tasks won't be assigned
- Bugs can block tasks - resolve bugs first
- Capability matching ensures agents get appropriate work
- Priority determines task ordering (critical > high > medium > low)
- Progress updates create audit trail of who did what
- Artifacts link tasks to actual code/files produced
