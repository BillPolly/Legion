# Project Planning Slash Command

Create or update a project plan using the @legion/project-server HTTP API.

## Usage

```
/project-plan create <project-id> <plan-id> "<title>" "<content>"
/project-plan update <plan-id> <update-type> "<content>"
/project-plan get <plan-id> [version]
/project-plan list <project-id>
```

## Instructions for Claude

You are helping the user manage project plans via the HTTP API at `http://localhost:8347/api`.

### Create a New Plan

When the user wants to create a plan:

1. Ensure the project-server is running (check with `curl http://localhost:8347/health`)
2. If not running, start it: `npm start --workspace=@legion/project-server`
3. Create the plan using POST /api/plans:

```bash
curl -X POST http://localhost:8347/api/plans \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "<project-id>",
    "planId": "<plan-id>",
    "title": "<title>",
    "content": "<markdown-content>",
    "updateType": "create",
    "agentName": "claude-code"
  }'
```

### Update an Existing Plan

To append content to a plan:

```bash
curl -X POST http://localhost:8347/api/plans \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "<plan-id>",
    "content": "<additional-content>",
    "updateType": "append",
    "agentName": "claude-code"
  }'
```

To update a specific section:

```bash
curl -X POST http://localhost:8347/api/plans \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "<plan-id>",
    "section": "<section-heading>",
    "content": "<new-section-content>",
    "updateType": "update_section",
    "agentName": "claude-code"
  }'
```

### Get a Plan

Retrieve the current (or specific version) of a plan:

```bash
curl http://localhost:8347/api/plans/<plan-id>?version=<optional-version>
```

### List Plans for Project

Get all plans for a project:

```bash
curl http://localhost:8347/api/projects/<project-id>/plans
```

## Example Workflow

**User**: "Create a plan for building a todo app"

**Claude should**:
1. Check if project-server is running
2. Create a structured plan with phases, tasks, and success criteria
3. POST the plan to the API
4. Confirm creation and show the plan ID and version

**User**: "Add security requirements to the plan"

**Claude should**:
1. Retrieve the current plan
2. Analyze what security requirements are needed
3. Append a "Security Requirements" section
4. Show the updated version number

**User**: "Show me the plan"

**Claude should**:
1. GET the plan from API
2. Extract the `content` field (markdown)
3. Display it formatted as markdown in the response
4. Show version number and last updated timestamp

## Important Notes

- Always use `"agentName": "claude-code"` when creating/updating plans
- Plans are versioned - each update creates a new version
- Previous versions are preserved and can be retrieved
- Section updates allow targeted modifications without rewriting the entire plan
- Content should be in Markdown format
- **Display plans as formatted markdown**, not raw JSON - extract `content` field and render it
- Include metadata (planId, version, updated) above the markdown content
