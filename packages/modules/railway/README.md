# @legion/railway

Railway deployment provider and tools for the Legion framework.

## Overview

This package provides a comprehensive Railway integration for deploying applications to Railway's cloud platform. It includes both a provider API and Legion tools for Railway operations.

## Features

- Deploy applications from GitHub repositories
- Manage Railway projects (create, list, delete)
- Handle environment variables
- Generate and manage domains
- Monitor deployment status
- Automatic CLI fallback for operations not supported by the API

## Installation

```bash
npm install @legion/railway
```

## Usage

### As a Railway Provider

```javascript
import { RailwayProvider } from '@legion/railway';

// Initialize with API key
const provider = new RailwayProvider(apiKey);

// Deploy from GitHub
const result = await provider.deploy({
  name: 'my-app',
  source: 'github',
  githubRepo: 'owner/repo',
  branch: 'main',
  environment: {
    NODE_ENV: 'production',
    PORT: '3000'
  }
});

// List projects
const projects = await provider.listProjects();

// Get project details
const details = await provider.getProjectDetails(projectId);
```

### As Legion Tools

When using with the Legion framework:

```javascript
import { ModuleFactory } from '@legion/module-loader';
import RailwayModule from '@legion/railway';

const moduleFactory = new ModuleFactory(resourceManager);
const railwayModule = moduleFactory.createModule(RailwayModule);
const tools = railwayModule.getTools();
```

Available tools:
- `railway_deploy` - Deploy applications to Railway
- `railway_list` - List Railway projects
- `railway_status` - Check deployment status
- `railway_logs` - Get deployment logs
- `railway_remove` - Delete Railway projects
- `railway_update_env` - Update environment variables

## CLI Requirements

For GitHub deployments, the Railway CLI must be installed and authenticated:

```bash
# Install Railway CLI
brew install railway

# Login to Railway
railway login
```

## Configuration

Set your Railway API key in the environment:

```bash
RAILWAY=your-api-key-here
# or
RAILWAY_API_KEY=your-api-key-here
```

## Scripts

The package includes utility scripts in the `scripts/` directory:

- `deploy-from-github.js` - Deploy a GitHub repository
- `manage-projects.js` - Manage Railway projects

See [scripts/README.md](scripts/README.md) for detailed usage.

## Examples

See the `examples/` directory for a sample Express application that can be deployed to Railway.

## Architecture

The package uses a hybrid approach:
- Railway GraphQL API v2 for most operations
- Railway CLI subprocess for GitHub deployments (due to API limitations)

This ensures maximum compatibility and functionality while providing a seamless developer experience.

## License

MIT