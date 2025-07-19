# Conan-the-Deployer User Guide

## Table of Contents

1. [Getting Started](#getting-started)
2. [Basic Deployment](#basic-deployment)
3. [Provider Guides](#provider-guides)
4. [Monitoring and Management](#monitoring-and-management)
5. [Advanced Features](#advanced-features)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- For Docker deployments: Docker installed and running
- For Railway deployments: Railway account and API key

### Installation

```bash
# Install the conan-the-deployer package
npm install @jsenvoy/conan-the-deployer

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration
```

### Environment Setup

Create a `.env` file with your provider credentials:

```bash
# Railway API Key (for Railway deployments)
RAILWAY=your-railway-api-key-here

# Docker configuration (optional)
DOCKER_HOST=unix:///var/run/docker.sock

# Default configuration
DEFAULT_PROVIDER=local
MONITORING_ENABLED=true
HEALTH_CHECK_INTERVAL=30000
```

## Basic Deployment

### Your First Deployment

Let's deploy a simple Express.js application:

1. **Prepare your application:**
```javascript
// app.js
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Conan-the-Deployer!' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
```

2. **Deploy to local provider:**
```javascript
import ConanTheDeployer from '@jsenvoy/conan-the-deployer';

const deployer = new ConanTheDeployer();

// Deploy the application
const deployResult = await deployer.tools.deploy_application.invoke({
  function: {
    name: 'deploy_application',
    arguments: JSON.stringify({
      provider: 'local',
      config: {
        name: 'my-first-app',
        source: '/path/to/your/app',
        environment: {
          NODE_ENV: 'production',
          PORT: '3000'
        },
        healthCheck: {
          path: '/health',
          interval: 30000
        }
      }
    })
  }
});

console.log('Deployment result:', deployResult);
```

3. **Check deployment status:**
```javascript
// List all deployments
const listResult = await deployer.tools.list_deployments.invoke({
  function: {
    name: 'list_deployments',
    arguments: JSON.stringify({})
  }
});

console.log('Active deployments:', listResult.data.deployments);
```

## Provider Guides

### Local Provider

The local provider runs your Node.js applications as local processes. Best for development and testing.

**Features:**
- Direct process spawning
- Automatic port allocation
- Process monitoring and restart
- Local log access

**Example deployment:**
```javascript
const localConfig = {
  provider: 'local',
  config: {
    name: 'dev-server',
    source: './my-app',
    command: 'npm run dev',
    port: 3000,
    environment: {
      NODE_ENV: 'development',
      DEBUG: 'app:*'
    },
    restart: {
      enabled: true,
      maxRetries: 3,
      delay: 5000
    }
  }
};
```

**When to use:**
- Local development
- Testing deployments
- Quick prototyping
- Single-machine deployments

### Docker Provider

The Docker provider containerizes your applications for consistent, isolated deployments.

**Features:**
- Automatic Dockerfile generation
- Container lifecycle management
- Volume mounting for data persistence
- Network configuration

**Example deployment:**
```javascript
const dockerConfig = {
  provider: 'docker',
  config: {
    name: 'containerized-app',
    source: './my-app',
    port: 8080,
    environment: {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://localhost:5432/mydb'
    },
    docker: {
      image: 'node:18-alpine',
      volumes: ['./data:/app/data', './logs:/app/logs'],
      memory: '512m',
      cpus: '0.5',
      ports: ['8080:3000'],
      networks: ['app-network']
    },
    healthCheck: {
      path: '/health',
      interval: 30000,
      timeout: 10000
    }
  }
};
```

**When to use:**
- Production deployments
- Microservices architecture
- Multi-environment consistency
- Resource isolation

### Railway Provider

The Railway provider deploys directly to the Railway cloud platform.

**Features:**
- Direct GitHub integration
- Automatic HTTPS and domain management
- Production-ready infrastructure
- Integrated databases and services

**Example deployment:**
```javascript
const railwayConfig = {
  provider: 'railway',
  config: {
    name: 'production-app',
    source: 'https://github.com/username/my-app',
    branch: 'main',
    environment: {
      NODE_ENV: 'production',
      API_KEY: process.env.API_KEY,
      DATABASE_URL: '${{Postgres.DATABASE_URL}}'
    },
    railway: {
      region: 'us-west-2',
      autoDeploy: true,
      buildCommand: 'npm run build',
      startCommand: 'npm start'
    }
  }
};
```

**When to use:**
- Production applications
- Scalable web services
- Applications requiring databases
- Teams needing collaboration features

## Monitoring and Management

### Starting Monitoring

```javascript
// Start monitoring a deployment
const monitorResult = await deployer.tools.monitor_deployment.invoke({
  function: {
    name: 'monitor_deployment',
    arguments: JSON.stringify({
      deploymentId: 'deploy-123',
      action: 'start',
      interval: 30000,  // Check every 30 seconds
      duration: 0       // Monitor continuously
    })
  }
});
```

### Getting Health Status

```javascript
// Check deployment health
const healthResult = await deployer.tools.monitor_deployment.invoke({
  function: {
    name: 'monitor_deployment',
    arguments: JSON.stringify({
      deploymentId: 'deploy-123',
      action: 'health'
    })
  }
});

console.log('Health status:', healthResult.data.health);
```

### Viewing Metrics

```javascript
// Get performance metrics
const metricsResult = await deployer.tools.monitor_deployment.invoke({
  function: {
    name: 'monitor_deployment',
    arguments: JSON.stringify({
      deploymentId: 'deploy-123',
      action: 'metrics'
    })
  }
});

console.log('System metrics:', metricsResult.data.metrics.system);
console.log('HTTP metrics:', metricsResult.data.metrics.http);
```

### Retrieving Logs

```javascript
// Get recent logs
const logsResult = await deployer.tools.get_deployment_logs.invoke({
  function: {
    name: 'get_deployment_logs',
    arguments: JSON.stringify({
      deploymentId: 'deploy-123',
      lines: 100,
      format: 'structured'
    })
  }
});

console.log('Recent logs:', logsResult.data.logs);

// Stream live logs
const liveLogsResult = await deployer.tools.get_deployment_logs.invoke({
  function: {
    name: 'get_deployment_logs',
    arguments: JSON.stringify({
      deploymentId: 'deploy-123',
      follow: true,
      lines: 0  // Start from end
    })
  }
});
```

### Filtering Logs

```javascript
// Get error logs from the last hour
const errorLogsResult = await deployer.tools.get_deployment_logs.invoke({
  function: {
    name: 'get_deployment_logs',
    arguments: JSON.stringify({
      deploymentId: 'deploy-123',
      level: 'error',
      since: new Date(Date.now() - 3600000).toISOString(),
      search: 'database'
    })
  }
});
```

## Advanced Features

### Rolling Updates

Update your deployment without downtime:

```javascript
const updateResult = await deployer.tools.update_deployment.invoke({
  function: {
    name: 'update_deployment',
    arguments: JSON.stringify({
      deploymentId: 'deploy-123',
      updates: {
        image: 'myapp:v2.0.0',
        environment: {
          FEATURE_FLAG_NEW_UI: 'enabled',
          API_VERSION: 'v2'
        }
      },
      strategy: 'rolling',
      rollbackOnFailure: true,
      verifyUpdate: true,
      healthCheckTimeout: 60000
    })
  }
});
```

### Blue-Green Deployments

Deploy a new version alongside the current one:

```javascript
const blueGreenUpdate = await deployer.tools.update_deployment.invoke({
  function: {
    name: 'update_deployment',
    arguments: JSON.stringify({
      deploymentId: 'deploy-123',
      updates: {
        branch: 'feature/new-version'
      },
      strategy: 'blue-green',
      trafficSplitPercentage: 10,  // Start with 10% traffic
      rollbackOnFailure: true
    })
  }
});
```

### Scaling Operations

Scale your deployment horizontally or vertically:

```javascript
// Horizontal scaling (more instances)
const scaleOut = await deployer.tools.update_deployment.invoke({
  function: {
    name: 'update_deployment',
    arguments: JSON.stringify({
      deploymentId: 'deploy-123',
      updates: {
        replicas: 5
      },
      strategy: 'scaling'
    })
  }
});

// Vertical scaling (more resources)
const scaleUp = await deployer.tools.update_deployment.invoke({
  function: {
    name: 'update_deployment',
    arguments: JSON.stringify({
      deploymentId: 'deploy-123',
      updates: {
        resources: {
          cpu: '2.0',
          memory: '4Gi'
        }
      },
      strategy: 'scaling'
    })
  }
});
```

### Multi-Provider Deployments

Deploy the same application to multiple providers:

```javascript
// Deploy to development (local)
const devDeploy = await deployer.tools.deploy_application.invoke({
  function: {
    name: 'deploy_application',
    arguments: JSON.stringify({
      provider: 'local',
      config: {
        name: 'myapp-dev',
        source: './my-app',
        environment: { NODE_ENV: 'development' }
      }
    })
  }
});

// Deploy to staging (Docker)
const stagingDeploy = await deployer.tools.deploy_application.invoke({
  function: {
    name: 'deploy_application',
    arguments: JSON.stringify({
      provider: 'docker',
      config: {
        name: 'myapp-staging',
        source: './my-app',
        environment: { NODE_ENV: 'staging' }
      }
    })
  }
});

// Deploy to production (Railway)
const prodDeploy = await deployer.tools.deploy_application.invoke({
  function: {
    name: 'deploy_application',
    arguments: JSON.stringify({
      provider: 'railway',
      config: {
        name: 'myapp-prod',
        source: 'https://github.com/user/my-app',
        branch: 'main',
        environment: { NODE_ENV: 'production' }
      }
    })
  }
});
```

## Troubleshooting

### Common Issues

#### Port Conflicts
```javascript
// Error: Port 3000 is already in use
// Solution: Let the system allocate a port automatically
const config = {
  name: 'my-app',
  source: './app',
  // Don't specify port, let system choose
  environment: { NODE_ENV: 'development' }
};
```

#### Docker Daemon Not Running
```bash
# Check Docker status
docker --version
docker ps

# Start Docker daemon (varies by OS)
# macOS: Open Docker Desktop
# Linux: sudo systemctl start docker
# Windows: Start Docker Desktop
```

#### Railway Authentication Issues
```javascript
// Verify your Railway API key is set
console.log('Railway API Key:', process.env.RAILWAY ? 'Set' : 'Missing');

// Check key format (should start with a specific prefix)
// Get your key from: https://railway.app/account/tokens
```

#### Memory Issues
```javascript
// For large applications, increase memory limits
const dockerConfig = {
  docker: {
    memory: '2g',  // Increase from default 512m
    cpus: '1.0'    // Increase CPU allocation
  }
};
```

### Debugging Deployments

#### Check Deployment Status
```javascript
const status = await deployer.tools.list_deployments.invoke({
  function: {
    name: 'list_deployments',
    arguments: JSON.stringify({
      search: 'my-app',
      format: 'json'
    })
  }
});
```

#### View Detailed Logs
```javascript
const logs = await deployer.tools.get_deployment_logs.invoke({
  function: {
    name: 'get_deployment_logs',
    arguments: JSON.stringify({
      deploymentId: 'deploy-123',
      lines: 500,
      level: 'error',
      format: 'structured'
    })
  }
});
```

#### Health Check Failures
```javascript
// Check health status
const health = await deployer.tools.monitor_deployment.invoke({
  function: {
    name: 'monitor_deployment',
    arguments: JSON.stringify({
      deploymentId: 'deploy-123',
      action: 'health'
    })
  }
});

// If health checks fail, verify your /health endpoint
// Make sure it returns 200 status and JSON response
```

### Recovery Procedures

#### Rollback Failed Deployment
```javascript
const rollback = await deployer.tools.update_deployment.invoke({
  function: {
    name: 'update_deployment',
    arguments: JSON.stringify({
      deploymentId: 'deploy-123',
      updates: {
        version: 'previous'  // Roll back to previous version
      },
      strategy: 'recreate',
      verifyUpdate: true
    })
  }
});
```

#### Clean Up Failed Resources
```javascript
const cleanup = await deployer.tools.stop_deployment.invoke({
  function: {
    name: 'stop_deployment',
    arguments: JSON.stringify({
      deploymentId: 'deploy-123',
      cleanup: true,
      removeVolumes: false,  // Preserve data
      force: true
    })
  }
});
```

## Best Practices

### 1. Environment Management

Use environment-specific configurations:

```javascript
const configs = {
  development: {
    provider: 'local',
    environment: {
      NODE_ENV: 'development',
      DEBUG: '*',
      LOG_LEVEL: 'debug'
    }
  },
  staging: {
    provider: 'docker',
    environment: {
      NODE_ENV: 'staging',
      LOG_LEVEL: 'info'
    }
  },
  production: {
    provider: 'railway',
    environment: {
      NODE_ENV: 'production',
      LOG_LEVEL: 'warn'
    }
  }
};
```

### 2. Health Checks

Always implement comprehensive health checks:

```javascript
// In your application
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version,
    checks: {
      database: 'connected',
      redis: 'connected',
      external_api: 'responding'
    }
  };
  
  res.json(health);
});

// In deployment config
const deployConfig = {
  healthCheck: {
    path: '/health',
    interval: 30000,
    timeout: 5000,
    retries: 3
  }
};
```

### 3. Logging Strategy

Implement structured logging:

```javascript
// Use a logging library like winston
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'app.log' })
  ]
});

// Log important events
logger.info('Application starting', { 
  port: process.env.PORT,
  environment: process.env.NODE_ENV 
});
```

### 4. Resource Management

Monitor and limit resource usage:

```javascript
const resourceConfig = {
  docker: {
    memory: '512m',
    cpus: '0.5',
    ulimits: {
      nofile: { soft: 1024, hard: 2048 }
    }
  },
  healthCheck: {
    interval: 30000,
    timeout: 10000
  }
};
```

### 5. Security Considerations

- Never commit secrets to version control
- Use environment variables for sensitive data
- Implement proper authentication and authorization
- Keep dependencies updated
- Use HTTPS in production

```javascript
const secureConfig = {
  environment: {
    NODE_ENV: 'production',
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    API_KEY: process.env.API_KEY
  },
  healthCheck: {
    path: '/health',
    // Don't expose sensitive health check paths
    headers: {
      'Authorization': `Bearer ${process.env.HEALTH_CHECK_TOKEN}`
    }
  }
};
```

### 6. Monitoring and Alerting

Set up comprehensive monitoring:

```javascript
// Start monitoring immediately after deployment
const deployResult = await deploy();
const deploymentId = deployResult.data.deployment.id;

await startMonitoring(deploymentId);

// Set up alerting based on metrics
const metrics = await getMetrics(deploymentId);
if (metrics.data.metrics.system.cpu > 80) {
  console.warn('High CPU usage detected');
  // Trigger alert or auto-scaling
}
```

This completes the comprehensive user guide for Conan-the-Deployer. The guide covers everything from basic setup to advanced deployment strategies and troubleshooting procedures.