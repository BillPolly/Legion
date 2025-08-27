# Railway Scripts

This directory contains utility scripts for working with the Railway provider.

## Available Scripts

### deploy-from-github.js
Deploy a GitHub repository to Railway.

```bash
node scripts/deploy-from-github.js <github-repo> [project-name]

# Example:
node scripts/deploy-from-github.js AgentResults/test-express-railway my-app
```

### manage-projects.js
Manage Railway projects - list, delete, or get details.

```bash
# List all projects
node scripts/manage-projects.js list

# Get project details
node scripts/manage-projects.js details <project-id>

# Delete a specific project
node scripts/manage-projects.js delete <project-id>

# Delete all projects
node scripts/manage-projects.js delete-all
```

## Prerequisites

- Railway API key configured in environment (RAILWAY or RAILWAY_API_KEY)
- Railway CLI installed and authenticated (for GitHub deployments)
- Node.js 18+ installed

## Notes

- GitHub deployments use the Railway CLI behind the scenes
- The Railway provider handles all the complexity internally
- Domains are automatically generated for deployed services