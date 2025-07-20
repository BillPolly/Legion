# Railway Scripts

This directory contains utility scripts for managing Railway deployments using the RailwayProvider.

## Available Scripts

### list-projects.js
Lists all Railway projects (personal and team projects) with their services and deployment status.

```bash
node scripts/railway/list-projects.js
```

### deploy-app.js
Deploys an application to Railway with automatic domain generation.

```bash
node scripts/railway/deploy-app.js
```

### delete-all-projects.js
Deletes all Railway projects. Use with caution!

```bash
node scripts/railway/delete-all-projects.js
```

### check-deployment-status.js
Checks the status of a specific deployment or lists all deployments.

```bash
# List all deployments
node scripts/railway/check-deployment-status.js

# Check specific deployment
node scripts/railway/check-deployment-status.js <deployment-id>
```

### manage-project.js
General purpose project management tool with multiple commands.

```bash
# Show help
node scripts/railway/manage-project.js help

# List projects
node scripts/railway/manage-project.js list

# Get project details
node scripts/railway/manage-project.js details <project-id>

# Delete a project
node scripts/railway/manage-project.js delete <project-id>

# Redeploy a service
node scripts/railway/manage-project.js redeploy <service-id>

# List domains for a service
node scripts/railway/manage-project.js domains <service-id> <environment-id>

# Generate domain for a service
node scripts/railway/manage-project.js generate-domain <service-id> <environment-id>
```

## Configuration

All scripts use the RailwayProvider which requires a Railway API key to be set in the environment:

```bash
# In .env file
RAILWAY=your-api-key-here
```

## Notes

- All scripts use the RailwayProvider class for consistent API interaction
- The scripts automatically handle ResourceManager initialization
- Error handling is built into each script
- Scripts are designed to be run from the package root directory