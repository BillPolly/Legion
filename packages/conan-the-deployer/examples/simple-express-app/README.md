# Simple Express App Example

A basic Express.js application demonstrating deployment with Conan-the-Deployer.

## Features

- REST API with message storage
- Health check endpoint
- Statistics and monitoring
- Graceful shutdown handling
- Environment-aware configuration

## API Endpoints

- `GET /` - Welcome message with visitor count
- `GET /health` - Health check with system information
- `GET /api/stats` - Application statistics
- `GET /api/messages` - Get all messages
- `POST /api/messages` - Create a new message

## Local Development

```bash
npm install
npm start
```

The application will be available at `http://localhost:3000`.

## Deployment Examples

### Deploy to Local Provider

```javascript
import { DeployApplicationTool } from '@jsenvoy/conan-the-deployer';

const deployTool = new DeployApplicationTool();

const result = await deployTool.invoke({
  function: {
    name: 'deploy_application',
    arguments: JSON.stringify({
      provider: 'local',
      config: {
        name: 'simple-express-local',
        source: './examples/simple-express-app',
        environment: {
          NODE_ENV: 'development',
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
```

### Deploy to Docker

```javascript
const result = await deployTool.invoke({
  function: {
    name: 'deploy_application',
    arguments: JSON.stringify({
      provider: 'docker',
      config: {
        name: 'simple-express-docker',
        source: './examples/simple-express-app',
        port: 8080,
        environment: {
          NODE_ENV: 'production',
          PORT: '3000'
        },
        docker: {
          image: 'node:18-alpine',
          memory: '256m',
          cpus: '0.25'
        },
        healthCheck: {
          path: '/health',
          interval: 30000,
          timeout: 5000
        }
      }
    })
  }
});
```

### Deploy to Railway

```javascript
const result = await deployTool.invoke({
  function: {
    name: 'deploy_application',
    arguments: JSON.stringify({
      provider: 'railway',
      config: {
        name: 'simple-express-railway',
        source: 'https://github.com/your-username/simple-express-app',
        branch: 'main',
        environment: {
          NODE_ENV: 'production'
        },
        railway: {
          region: 'us-west-2'
        }
      }
    })
  }
});
```

## Monitoring Example

```javascript
import { MonitorDeploymentTool } from '@jsenvoy/conan-the-deployer';

const monitorTool = new MonitorDeploymentTool();

// Start monitoring
await monitorTool.invoke({
  function: {
    name: 'monitor_deployment',
    arguments: JSON.stringify({
      deploymentId: 'your-deployment-id',
      action: 'start',
      interval: 30000
    })
  }
});

// Check health
const healthResult = await monitorTool.invoke({
  function: {
    name: 'monitor_deployment',
    arguments: JSON.stringify({
      deploymentId: 'your-deployment-id',
      action: 'health'
    })
  }
});

console.log('Health status:', healthResult.data.health);
```

## Testing the Application

1. **Visit the home page:**
   ```bash
   curl http://localhost:3000/
   ```

2. **Check health:**
   ```bash
   curl http://localhost:3000/health
   ```

3. **View statistics:**
   ```bash
   curl http://localhost:3000/api/stats
   ```

4. **Post a message:**
   ```bash
   curl -X POST http://localhost:3000/api/messages \
     -H "Content-Type: application/json" \
     -d '{"message": "Hello World!", "author": "Test User"}'
   ```

5. **Get all messages:**
   ```bash
   curl http://localhost:3000/api/messages
   ```

## Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode (development/production)

## Production Considerations

This is a simple example application. For production use, consider:

- Adding authentication and authorization
- Implementing rate limiting
- Using a proper database instead of in-memory storage
- Adding request logging and monitoring
- Implementing proper error handling and validation
- Adding CORS configuration
- Using HTTPS
- Implementing proper session management