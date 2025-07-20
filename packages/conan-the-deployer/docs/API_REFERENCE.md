# Conan-the-Deployer API Reference

## Overview

Conan-the-Deployer provides six primary tools for deploying and managing Node.js applications across multiple providers (local, Docker, and Railway via @jsenvoy/railway). All tools are OpenAI function-calling compatible and integrate seamlessly with AI agents.

## Tools

### 1. deploy_application

Deploy Node.js applications to various providers.

**Function Schema:**
```json
{
  "name": "deploy_application",
  "description": "Deploy Node.js applications to various providers with configuration validation",
  "parameters": {
    "type": "object",
    "properties": {
      "provider": {
        "type": "string",
        "enum": ["local", "docker", "railway"],
        "description": "Deployment provider (railway requires @jsenvoy/railway)"
      },
      "config": {
        "type": "object",
        "description": "Deployment configuration",
        "properties": {
          "name": { "type": "string", "description": "Application name" },
          "source": { "type": "string", "description": "Source code path" },
          "command": { "type": "string", "description": "Start command" },
          "port": { "type": "number", "description": "Application port" },
          "environment": { "type": "object", "description": "Environment variables" },
          "healthCheck": {
            "type": "object",
            "properties": {
              "path": { "type": "string", "description": "Health check endpoint" },
              "interval": { "type": "number", "description": "Check interval in ms" },
              "timeout": { "type": "number", "description": "Timeout in ms" }
            }
          }
        },
        "required": ["name", "source"]
      }
    },
    "required": ["provider", "config"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "deployment": {
      "id": "deploy-123",
      "name": "my-app",
      "provider": "local",
      "status": "running",
      "url": "http://localhost:3000",
      "createdAt": "2024-01-01T10:00:00Z"
    },
    "summary": "Successfully deployed \"my-app\" to local provider",
    "nextSteps": [
      "Monitor deployment with: monitor_deployment --id deploy-123",
      "View logs with: get_deployment_logs --id deploy-123"
    ]
  }
}
```

**Example Usage:**
```javascript
const deployCall = {
  function: {
    name: 'deploy_application',
    arguments: JSON.stringify({
      provider: 'local',
      config: {
        name: 'my-express-app',
        source: '/path/to/my/app',
        environment: {
          NODE_ENV: 'production',
          PORT: '3000'
        },
        healthCheck: {
          path: '/health',
          interval: 30000,
          timeout: 5000
        }
      }
    })
  }
};
```

### 2. monitor_deployment

Monitor deployed applications with health checks and metrics.

**Function Schema:**
```json
{
  "name": "monitor_deployment",
  "description": "Monitor deployments with health checks, metrics, and logs",
  "parameters": {
    "type": "object",
    "properties": {
      "deploymentId": {
        "type": "string",
        "description": "ID of the deployment to monitor"
      },
      "action": {
        "type": "string",
        "enum": ["start", "stop", "status", "health", "metrics", "logs"],
        "description": "Monitoring action to perform",
        "default": "status"
      },
      "interval": {
        "type": "number",
        "description": "Monitoring interval in milliseconds",
        "minimum": 1000,
        "maximum": 300000,
        "default": 30000
      },
      "duration": {
        "type": "number",
        "description": "Monitoring duration in milliseconds (0 = continuous)",
        "minimum": 0,
        "default": 0
      }
    },
    "required": ["deploymentId"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "deployment": {
      "id": "deploy-123",
      "name": "my-app",
      "provider": "local"
    },
    "monitoring": {
      "status": "active",
      "interval": 30000,
      "startedAt": "2024-01-01T10:00:00Z"
    },
    "health": {
      "status": "healthy",
      "checks": {
        "http": "passing",
        "readiness": "passing"
      },
      "lastCheck": "2024-01-01T10:00:00Z"
    },
    "metrics": {
      "system": {
        "cpu": "15.2%",
        "memory": "128MB"
      },
      "http": {
        "requestCount": 147,
        "avgResponseTime": "45ms"
      }
    }
  }
}
```

### 3. update_deployment

Update deployments with various strategies and rollback capabilities.

**Function Schema:**
```json
{
  "name": "update_deployment",
  "description": "Update deployment configurations with various strategies",
  "parameters": {
    "type": "object",
    "properties": {
      "deploymentId": {
        "type": "string",
        "description": "ID of the deployment to update"
      },
      "updates": {
        "type": "object",
        "description": "Updates to apply to the deployment"
      },
      "strategy": {
        "type": "string",
        "enum": ["rolling", "blue-green", "recreate", "scaling", "config"],
        "description": "Update strategy",
        "default": "rolling"
      },
      "rollbackOnFailure": {
        "type": "boolean",
        "description": "Automatically rollback on failure",
        "default": true
      },
      "verifyUpdate": {
        "type": "boolean",
        "description": "Verify update success with health checks",
        "default": true
      }
    },
    "required": ["deploymentId", "updates"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "deployment": {
      "id": "deploy-123",
      "name": "my-app",
      "provider": "docker"
    },
    "update": {
      "strategy": "rolling",
      "status": "completed",
      "previousVersion": "v1.0.0",
      "newVersion": "v1.1.0",
      "verified": true,
      "rollbackAvailable": true
    },
    "summary": "Rolling update completed successfully for \"my-app\"",
    "nextSteps": [
      "Monitor the updated deployment",
      "Verify application functionality"
    ]
  }
}
```

### 4. list_deployments

List and filter deployments across all providers.

**Function Schema:**
```json
{
  "name": "list_deployments",
  "description": "List and filter deployments across all providers",
  "parameters": {
    "type": "object",
    "properties": {
      "provider": {
        "type": "string",
        "enum": ["local", "docker", "railway"],
        "description": "Filter by deployment provider (railway requires @jsenvoy/railway)"
      },
      "status": {
        "type": "string",
        "enum": ["running", "stopped", "building", "failed", "pending"],
        "description": "Filter by deployment status"
      },
      "search": {
        "type": "string",
        "description": "Search deployments by name or ID"
      },
      "format": {
        "type": "string",
        "enum": ["table", "json", "summary"],
        "description": "Output format",
        "default": "table"
      },
      "sortBy": {
        "type": "string",
        "enum": ["name", "provider", "status", "createdAt", "updatedAt"],
        "description": "Field to sort by",
        "default": "createdAt"
      },
      "sortOrder": {
        "type": "string",
        "enum": ["asc", "desc"],
        "description": "Sort order",
        "default": "desc"
      },
      "limit": {
        "type": "number",
        "description": "Maximum number of deployments to return",
        "minimum": 1,
        "maximum": 1000,
        "default": 50
      },
      "offset": {
        "type": "number",
        "description": "Number of deployments to skip",
        "minimum": 0,
        "default": 0
      }
    },
    "required": []
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "deployments": [
      {
        "id": "deploy-123",
        "name": "my-app",
        "provider": "local",
        "status": "running",
        "url": "http://localhost:3000",
        "createdAt": "2024-01-01T10:00:00Z"
      }
    ],
    "summary": {
      "total": 3,
      "byProvider": { "local": 1, "docker": 1, "railway": 1 },
      "byStatus": { "running": 2, "stopped": 1 }
    },
    "format": "table",
    "pagination": {
      "total": 3,
      "limit": 50,
      "offset": 0,
      "hasMore": false
    },
    "table": {
      "headers": ["ID", "Name", "Provider", "Status", "URL", "Created"],
      "rows": [["deploy-123...", "my-app", "local", "running", "http://localhost:3000", "Today"]]
    }
  }
}
```

### 5. stop_deployment

Stop running deployments with graceful shutdown options.

**Function Schema:**
```json
{
  "name": "stop_deployment",
  "description": "Stop running deployments with graceful shutdown and cleanup options",
  "parameters": {
    "type": "object",
    "properties": {
      "deploymentId": {
        "type": "string",
        "description": "ID of the deployment to stop (or \"all\" to stop all deployments)"
      },
      "provider": {
        "type": "string",
        "enum": ["local", "docker", "railway"],
        "description": "Provider filter when stopping all deployments (railway requires @jsenvoy/railway)"
      },
      "graceful": {
        "type": "boolean",
        "description": "Attempt graceful shutdown before forcing",
        "default": true
      },
      "timeout": {
        "type": "number",
        "description": "Timeout for graceful shutdown in milliseconds",
        "minimum": 1000,
        "maximum": 300000,
        "default": 30000
      },
      "cleanup": {
        "type": "boolean",
        "description": "Perform cleanup after stopping",
        "default": false
      },
      "removeVolumes": {
        "type": "boolean",
        "description": "Remove associated volumes during cleanup",
        "default": false
      }
    },
    "required": ["deploymentId"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "deployment": {
      "id": "deploy-123",
      "name": "my-app",
      "provider": "local",
      "previousStatus": "running"
    },
    "stop": {
      "status": "stopped",
      "graceful": true,
      "shutdownTime": 2500,
      "stoppedAt": "2024-01-01T10:30:00Z",
      "cleanup": {
        "performed": true,
        "removedContainers": 1,
        "preservedVolumes": 2
      }
    },
    "summary": "Local process stopped for \"my-app\" (gracefully stopped in 2500ms), cleanup completed",
    "nextSteps": [
      "Verify the deployment is fully stopped with: list_deployments",
      "Restart the deployment when ready with: deploy_application"
    ]
  }
}
```

### 6. get_deployment_logs

Retrieve logs from deployments with filtering and search capabilities.

**Function Schema:**
```json
{
  "name": "get_deployment_logs",
  "description": "Retrieve logs from deployments with filtering and search capabilities",
  "parameters": {
    "type": "object",
    "properties": {
      "deploymentId": {
        "type": "string",
        "description": "ID of the deployment to retrieve logs from"
      },
      "lines": {
        "type": "number",
        "description": "Number of recent log lines to retrieve",
        "minimum": 0,
        "maximum": 10000,
        "default": 100
      },
      "follow": {
        "type": "boolean",
        "description": "Stream live logs",
        "default": false
      },
      "since": {
        "type": "string",
        "description": "Retrieve logs since this timestamp (ISO 8601 format)"
      },
      "until": {
        "type": "string",
        "description": "Retrieve logs until this timestamp (ISO 8601 format)"
      },
      "level": {
        "type": "string",
        "enum": ["debug", "info", "warn", "error", "fatal"],
        "description": "Filter logs by level"
      },
      "search": {
        "type": "string",
        "description": "Search logs for specific text content"
      },
      "format": {
        "type": "string",
        "enum": ["structured", "raw"],
        "description": "Output format for logs",
        "default": "structured"
      }
    },
    "required": ["deploymentId"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "deployment": {
      "id": "deploy-123",
      "name": "my-app",
      "provider": "local",
      "status": "running"
    },
    "logs": [
      {
        "timestamp": "2024-01-01T10:00:00Z",
        "level": "info",
        "message": "Application started on port 3000",
        "source": "app"
      },
      {
        "timestamp": "2024-01-01T10:01:00Z",
        "level": "info",
        "message": "GET / 200 - 45ms",
        "source": "http"
      }
    ],
    "summary": {
      "totalLines": 2,
      "truncated": false,
      "logSource": "process",
      "message": "Retrieved 2 log lines from \"my-app\""
    },
    "format": "structured",
    "nextSteps": [
      "Use --follow flag to stream live logs",
      "Filter logs by level with: --level error"
    ]
  }
}
```

## Provider-Specific Features

### Local Provider

- **Process Management**: Direct Node.js process spawning and management
- **Port Allocation**: Automatic port conflict resolution
- **Health Checks**: HTTP endpoint monitoring
- **Log Access**: Direct stdout/stderr capture

**Configuration:**
```json
{
  "provider": "local",
  "config": {
    "name": "my-local-app",
    "source": "/path/to/app",
    "command": "npm start",
    "port": 3000,
    "environment": {
      "NODE_ENV": "development"
    },
    "restart": {
      "enabled": true,
      "maxRetries": 3,
      "delay": 5000
    }
  }
}
```

### Docker Provider

- **Container Management**: Full Docker lifecycle management
- **Image Building**: Automatic Dockerfile generation for Node.js apps
- **Volume Mounting**: Persistent data storage
- **Network Configuration**: Container networking and port mapping

**Configuration:**
```json
{
  "provider": "docker",
  "config": {
    "name": "my-docker-app",
    "source": "/path/to/app",
    "port": 8080,
    "environment": {
      "NODE_ENV": "production"
    },
    "docker": {
      "image": "node:18-alpine",
      "volumes": ["./data:/app/data"],
      "memory": "512m",
      "cpus": "0.5"
    }
  }
}
```

### Railway Provider (via @jsenvoy/railway)

**Note:** Railway support requires installing the separate @jsenvoy/railway package:
```bash
npm install @jsenvoy/railway
```

- **GraphQL API**: Full Railway platform integration
- **GitHub Integration**: Direct deployment from repositories
- **Custom Domains**: Automatic HTTPS and domain management
- **Environment Management**: Production-ready environment configuration

**Configuration:**
```json
{
  "provider": "railway",
  "config": {
    "name": "my-railway-app",
    "source": "https://github.com/user/repo",
    "branch": "main",
    "environment": {
      "NODE_ENV": "production",
      "DATABASE_URL": "postgresql://..."
    },
    "railway": {
      "projectId": "proj_abc123",
      "serviceId": "srv_def456",
      "region": "us-west-2"
    }
  }
}
```

## Error Handling

All tools return structured error responses with helpful suggestions:

```json
{
  "success": false,
  "error": "Port 3000 is already in use by another process",
  "deploymentId": "deploy-123",
  "provider": "local",
  "suggestions": [
    "Try using a different port number",
    "Stop the conflicting process first",
    "Use automatic port allocation"
  ]
}
```

## Integration Examples

### Basic Deployment Workflow

```javascript
// 1. Deploy application
const deployResult = await tool.invoke({
  function: {
    name: 'deploy_application',
    arguments: JSON.stringify({
      provider: 'local',
      config: {
        name: 'my-app',
        source: '/path/to/app',
        environment: { PORT: '3000' }
      }
    })
  }
});

const deploymentId = deployResult.data.deployment.id;

// 2. Start monitoring
await tool.invoke({
  function: {
    name: 'monitor_deployment',
    arguments: JSON.stringify({
      deploymentId: deploymentId,
      action: 'start',
      interval: 30000
    })
  }
});

// 3. Check logs
await tool.invoke({
  function: {
    name: 'get_deployment_logs',
    arguments: JSON.stringify({
      deploymentId: deploymentId,
      lines: 50
    })
  }
});
```

### Multi-Provider Migration

```javascript
// Deploy to local first
const localDeploy = await deployTool.invoke({
  function: {
    name: 'deploy_application',
    arguments: JSON.stringify({
      provider: 'local',
      config: { name: 'test-app', source: '/app' }
    })
  }
});

// Test and validate

// Deploy to production (Railway - requires @jsenvoy/railway)
// First install: npm install @jsenvoy/railway
const prodDeploy = await deployTool.invoke({
  function: {
    name: 'deploy_application',
    arguments: JSON.stringify({
      provider: 'railway',
      config: {
        name: 'prod-app',
        source: 'https://github.com/user/app',
        branch: 'main'
      }
    })
  }
});

// Stop local deployment
await stopTool.invoke({
  function: {
    name: 'stop_deployment',
    arguments: JSON.stringify({
      deploymentId: localDeploy.data.deployment.id,
      graceful: true
    })
  }
});
```

## Best Practices

### 1. Health Checks
Always configure health checks for production deployments:
```json
{
  "healthCheck": {
    "path": "/health",
    "interval": 30000,
    "timeout": 5000,
    "retries": 3
  }
}
```

### 2. Environment Variables
Use environment-specific configurations:
```json
{
  "environment": {
    "NODE_ENV": "production",
    "LOG_LEVEL": "info",
    "PORT": "3000"
  }
}
```

### 3. Monitoring
Start monitoring immediately after deployment:
```javascript
await monitorTool.invoke({
  function: {
    name: 'monitor_deployment',
    arguments: JSON.stringify({
      deploymentId: deploymentId,
      action: 'start',
      interval: 30000
    })
  }
});
```

### 4. Graceful Updates
Use rolling updates with rollback protection:
```json
{
  "strategy": "rolling",
  "rollbackOnFailure": true,
  "verifyUpdate": true,
  "healthCheckTimeout": 60000
}
```

### 5. Log Management
Use structured logging and appropriate retention:
```json
{
  "lines": 1000,
  "format": "structured",
  "level": "info",
  "since": "2024-01-01T00:00:00Z"
}
```