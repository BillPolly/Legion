# Tool Registry Server

WebSocket and HTTP server for the Legion Tool Registry system, providing real-time actor-based communication and REST API access to tool management capabilities.

## Features

- **Singleton Pattern**: Uses the singleton ToolRegistry instance for consistent state management
- **Actor-Based Communication**: WebSocket connections use actor model for real-time bidirectional communication
- **REST API**: Full HTTP API for tool discovery, execution, and management
- **Health Monitoring**: Comprehensive health check endpoints for production deployment
- **Graceful Shutdown**: Proper cleanup of resources and connections
- **Zero Configuration**: Automatically uses ResourceManager for dependency injection

## Installation

```bash
npm install
```

## Usage

### Starting the Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

The server will start on:
- HTTP: `http://localhost:8090`
- WebSocket: `ws://localhost:8090/ws`

### Environment Variables

- `PORT` - Server port (default: 8090)
- `HOST` - Server host (default: localhost)
- `NODE_ENV` - Environment mode (development/production)

## API Endpoints

### Health Checks

- `GET /health` - Basic health status
- `GET /health/detailed` - Detailed health with subsystem checks
- `GET /health/ready` - Readiness probe for Kubernetes
- `GET /health/live` - Liveness probe for Kubernetes

### Tool Registry API

- `GET /api/stats` - Registry statistics and metrics
- `GET /api/tools` - List available tools
- `GET /api/tools/:name` - Get specific tool details
- `POST /api/tools/:name/execute` - Execute a tool
- `GET /api/search?q=query` - Search for tools
- `GET /api/modules` - List loaded modules
- `POST /api/modules/load` - Load modules from filesystem
- `DELETE /api/database/clear` - Clear database (dev only)

## WebSocket Protocol

### Connection Flow

1. Client connects to `/ws` endpoint
2. Server sends welcome message with connection ID
3. Client sends actor handshake with client actor GUIDs
4. Server responds with server actor GUIDs
5. Bidirectional actor communication established

### Message Format

```javascript
// Client handshake
{
  type: 'actor_handshake',
  clientActors: {
    registry: 'client-guid-registry',
    database: 'client-guid-database',
    search: 'client-guid-search'
  }
}

// Server acknowledgment
{
  type: 'actor_handshake_ack',
  serverActors: {
    registry: 'server-guid-registry',
    database: 'server-guid-database',
    search: 'server-guid-search'
  }
}
```

## Architecture

### Services

- **ToolRegistryService**: Wrapper around singleton ToolRegistry
- **ActorSpaceManager**: Manages actor spaces for WebSocket connections
- **WebSocketService**: Handles WebSocket connections and messaging

### Actors

- **ServerToolRegistryActor**: Handles tool registry operations
- **ServerDatabaseActor**: Manages database operations
- **ServerSemanticSearchActor**: Provides semantic search capabilities

### Middleware

- **loggingMiddleware**: Request/response logging
- **corsMiddleware**: CORS configuration
- **errorHandler**: Global error handling

## Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
npm run test:e2e         # End-to-end tests only

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# Verbose output
npm run test:verbose
```

### Test Structure

- `__tests__/unit/` - Unit tests for individual components
- `__tests__/integration/` - Integration tests for API endpoints
- `__tests__/e2e/` - End-to-end tests for WebSocket communication

## Development

### Project Structure

```
tool-registry-server/
├── src/
│   ├── server.js           # Main server entry point
│   ├── actors/             # Actor implementations
│   ├── middleware/         # Express middleware
│   ├── routes/            # API route handlers
│   └── services/          # Service layer
├── __tests__/             # Test suites
└── package.json
```

### Key Design Decisions

1. **Singleton Pattern**: The server uses the singleton ToolRegistry instance to ensure consistent state across all connections and requests.

2. **Actor Model**: WebSocket communication uses the actor model for clean separation of concerns and scalable message handling.

3. **Service Layer**: All business logic is encapsulated in services, making the code testable and maintainable.

4. **Zero Configuration**: The server automatically initializes with ResourceManager, requiring no manual API key configuration.

## Deployment

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8090
CMD ["npm", "start"]
```

### Kubernetes

```yaml
apiVersion: v1
kind: Service
metadata:
  name: tool-registry-server
spec:
  ports:
  - port: 8090
    targetPort: 8090
  selector:
    app: tool-registry-server
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tool-registry-server
spec:
  replicas: 1
  selector:
    matchLabels:
      app: tool-registry-server
  template:
    metadata:
      labels:
        app: tool-registry-server
    spec:
      containers:
      - name: server
        image: tool-registry-server:latest
        ports:
        - containerPort: 8090
        livenessProbe:
          httpGet:
            path: /health/live
            port: 8090
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8090
```

## Monitoring

The server provides comprehensive metrics through the `/api/stats` endpoint:

- Tool registry statistics
- Module loading pipeline state
- Database connection status
- Actor space metrics
- WebSocket connection stats

## Security

- CORS configuration for cross-origin requests
- Input validation on all API endpoints
- Error messages sanitized in production
- Database operations require authorization in production

## License

ISC