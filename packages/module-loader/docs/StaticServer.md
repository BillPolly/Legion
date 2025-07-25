# StaticServer Service - ResourceManager Pattern

## Overview

The `StaticServer` service provides a centralized, configurable Express server that eliminates code duplication across the Legion polyrepo. Instead of each package implementing its own Express server setup, packages can request a `StaticServer` from the ResourceManager with their specific configuration needs.

## Key Benefits

- **Code Reduction**: ~70% reduction in server setup code per application
- **Consistency**: Standardized security, middleware, and error handling patterns
- **Maintainability**: Single source of truth for server functionality
- **Testing**: Centralized testing of server patterns
- **Best Practices**: Built-in security headers, CORS, graceful shutdown
- **Flexibility**: Highly configurable while providing sensible defaults

## Basic Usage

### Simple Static Server

```javascript
import { ResourceManager } from '@legion/module-loader';

// Initialize ResourceManager
const resourceManager = new ResourceManager();
await resourceManager.initialize();

// Create a simple static server (singleton - only one instance per ResourceManager)
const server = await resourceManager.getOrCreate('StaticServer', {
  server: { port: 3000, host: 'localhost' },
  static: { publicDir: './public' }
});

// Start the server
await server.start();
console.log('Server running on http://localhost:3000');

// Stop the server
await server.stop();
```

### Singleton Behavior with Dynamic Configuration

The StaticServer follows the **singleton pattern** - only one instance exists per ResourceManager. Subsequent calls to `getOrCreate` return the same instance:

```javascript
// First call creates the server
const server1 = await resourceManager.getOrCreate('StaticServer', {
  server: { port: 3000 },
  static: { publicDir: './public' }
});

// Second call returns the SAME instance (config ignored)
const server2 = await resourceManager.getOrCreate('StaticServer', {
  server: { port: 9999 }  // This config is ignored!
});

console.log(server1 === server2); // true

// Instead, configure the server dynamically after creation:
await server1.start();

// Add routes dynamically
server1.addEndpoint('GET', '/api/users', (req, res) => {
  res.json({ users: ['alice', 'bob'] });
});

// Add multiple endpoints
server1.addEndpoints({
  '/api/status': (req, res) => res.json({ status: 'ok' }),
  '/api/data': {
    method: 'POST', 
    handler: (req, res) => res.json({ received: req.body })
  }
});

// Add custom routers
const apiRouter = express.Router();
apiRouter.get('/health', (req, res) => res.json({ healthy: true }));
server1.addRouter('/v1', apiRouter);

// Configure CORS dynamically
await server1.configureCORS({
  enabled: true,
  origin: 'https://myapp.com'
});
```

### Advanced Configuration

```javascript
const server = await resourceManager.getOrCreate('StaticServer', {
  server: {
    port: 3000,
    host: 'localhost',
    timeout: 30000
  },
  static: {
    publicDir: './client',
    caching: true,
    compression: true,
    index: 'index.html'
  },
  security: {
    cors: {
      enabled: true,
      origin: 'https://mydomain.com',
      credentials: true
    },
    csp: true,
    headers: true,
    customHeaders: {
      'X-Custom-Header': 'MyValue'
    }
  },
  api: {
    prefix: '/api',
    endpoints: {
      '/config': (req, res) => res.json({ app: 'myapp' }),
      '/health': (req, res) => res.json({ status: 'healthy' })
    }
  },
  websocket: {
    enabled: true,
    path: '/ws',
    handler: (httpServer, wsConfig, logger) => {
      return createMyWebSocketServer(httpServer, wsConfig, logger);
    }
  },
  logging: {
    level: 'info',
    requests: true
  }
});
```

## Configuration Schema

### Server Configuration
```javascript
{
  server: {
    port: 3000,           // Port to listen on
    host: 'localhost',    // Host to bind to
    timeout: 30000        // Request timeout in milliseconds
  }
}
```

### Static File Configuration
```javascript
{
  static: {
    publicDir: './public',    // Directory to serve static files from
    caching: true,            // Enable/disable caching
    compression: true,        // Enable/disable gzip compression
    index: 'index.html'       // Default file to serve
  }
}
```

### Security Configuration
```javascript
{
  security: {
    cors: {
      enabled: true,
      origin: '*',                    // Allowed origins
      credentials: false,             // Allow credentials
      methods: ['GET', 'POST'],       // Allowed methods
      allowedHeaders: ['Content-Type'] // Allowed headers
    },
    csp: true,                        // Enable Content Security Policy
    headers: true,                    // Enable security headers
    customHeaders: {                  // Custom headers to add
      'X-Custom': 'value'
    },
    cspDirectives: [                  // Additional CSP directives
      "script-src 'self' 'unsafe-eval'"
    ]
  }
}
```

### API Configuration
```javascript
{
  api: {
    prefix: '/api',                   // API route prefix
    endpoints: {                      // API endpoints
      '/users': (req, res) => { ... },
      '/data': {
        method: 'POST',
        handler: (req, res) => { ... }
      }
    },
    middleware: [                     // Custom middleware
      express.urlencoded({ extended: true })
    ]
  }
}
```

### WebSocket Configuration
```javascript
{
  websocket: {
    enabled: true,                    // Enable WebSocket support
    path: '/ws',                      // WebSocket endpoint path
    handler: (httpServer, wsConfig, logger) => {
      // Return WebSocket server instance
      return new WebSocketServer({ server: httpServer });
    },
    options: {                        // Additional options passed to handler
      // Custom options for your WebSocket implementation
    }
  }
}
```

### Logging Configuration
```javascript
{
  logging: {
    level: 'info',                    // Log level (error, warn, info, debug)
    requests: true,                   // Log HTTP requests
    format: 'combined'                // Log format
  }
}
```

## Environment Variable Integration

The StaticServer factory automatically enhances configuration with environment variables:

```bash
# Server settings
PORT=8080
HOST=0.0.0.0

# CORS settings
CORS_ORIGIN=https://example.com

# Static file settings
STATIC_DIR=/var/www/html

# Logging settings
LOG_LEVEL=debug

# Environment-based defaults
NODE_ENV=production  # Enables caching, compression, info logging
NODE_ENV=development # Disables caching, enables debug logging and permissive CORS
```

## Factory Functions

### createStaticServer (default)
```javascript
import { createStaticServer } from '@legion/module-loader';

const server = await createStaticServer(config, resourceManager);
```

### createSimpleStaticServer
```javascript
import { createSimpleStaticServer } from '@legion/module-loader';

const server = await createSimpleStaticServer('./public', 3000, resourceManager);
```

### createStaticServerWithWebSocket
```javascript
import { createStaticServerWithWebSocket } from '@legion/module-loader';

const server = await createStaticServerWithWebSocket(
  config, 
  wsHandler, 
  resourceManager
);
```

### createDevelopmentServer
```javascript
import { createDevelopmentServer } from '@legion/module-loader';

const server = await createDevelopmentServer(config, resourceManager);
```

## Migration Examples

### Before: Manual Express Setup (aiur-debug-ui)
```javascript
// 158 lines of Express setup code
import express from 'express';
import { createServer as createHttpServer } from 'http';
import cors from 'cors';

export async function createServer(config, logger) {
  const app = express();
  const httpServer = createHttpServer(app);
  
  // Middleware setup
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  
  // CORS configuration
  if (config.cors?.enabled) {
    app.use(cors({
      origin: config.cors.origin,
      credentials: true
    }));
  }
  
  // Security headers
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "connect-src 'self' ws: wss:",
        "img-src 'self' data:",
        "font-src 'self'"
      ].join('; ')
    });
    next();
  });
  
  // ... 120+ more lines of boilerplate
}
```

### After: ResourceManager Pattern
```javascript
// 20 lines with ResourceManager
import { ResourceManager } from '@legion/module-loader';

const resourceManager = new ResourceManager();
await resourceManager.initialize();

const server = await resourceManager.getOrCreate('StaticServer', {
  server: { port: config.server.port, host: config.server.host },
  static: { publicDir: './src/client', caching: true },
  security: { cors: config.cors, csp: true, headers: true },
  api: {
    endpoints: {
      '/api/config': (req, res) => res.json(clientConfig)
    }
  },
  websocket: {
    enabled: true,
    path: '/ws',
    handler: (httpServer, wsConfig, wsLogger) => {
      return createWebSocketServer(httpServer, config, wsLogger);
    }
  }
});

await server.start();
```

## API Reference

### StaticServer Class

#### Methods

**`static async create(config, resourceManager)`**
- Creates a new StaticServer instance
- Returns: `Promise<StaticServer>`

**`async start()`**
- Starts the HTTP server
- Returns: `Promise<void>`

**`async stop()`**
- Stops the HTTP server gracefully
- Returns: `Promise<void>`

**`getStatus()`**
- Returns server status information
- Returns: `Object` with running, port, host, publicDir, websocket, address

**`addEndpoint(method, path, handler)`**
- Dynamically adds an API endpoint
- Parameters: method (string), path (string), handler (function)

**`addEndpoints(endpoints)`**
- Adds multiple endpoints at once
- Parameters: endpoints (object) - `{'/path': handler}` or `{'/path': {method, handler}}`

**`addMiddleware(pathOrMiddleware, middleware?)`**
- Adds middleware dynamically (global or path-specific)
- Parameters: pathOrMiddleware (function|string), middleware? (function)

**`addRouter(basePath, router)`**
- Adds an Express router at the specified base path
- Parameters: basePath (string), router (express.Router)

**`async configureCORS(corsConfig)`**
- Updates CORS configuration dynamically
- Parameters: corsConfig (object) - CORS options

**`addStaticDirectory(path, directory, options?)`**
- Adds additional static file serving paths
- Parameters: path (string), directory (string), options? (object)

**`getApp()`**
- Returns the Express application instance
- Returns: `Express`

**`getHttpServer()`**
- Returns the HTTP server instance
- Returns: `http.Server`

**`getWebSocketServer()`**
- Returns the WebSocket server instance (if enabled)
- Returns: WebSocket server implementation

### Configuration Validation

**`StaticServer.validateConfig(config)`**
- Validates and normalizes configuration
- Returns: Normalized configuration object

## Testing

The StaticServer service includes comprehensive tests covering:

- Server creation and configuration
- Static file serving with correct MIME types
- API endpoint registration and handling
- Security headers and CORS
- WebSocket integration
- Error handling and 404 responses
- Dynamic endpoint management
- Server lifecycle (start/stop)
- ResourceManager integration

Run tests:
```bash
cd packages/module-loader
npm test -- --testPathPattern=StaticServer
```

## Recommended Usage Pattern

The ideal way to use StaticServer is:

1. **Get the singleton instance** with minimal initial configuration
2. **Configure routes dynamically** as needed by different parts of your application
3. **Start the server** once everything is configured

```javascript
// 1. Get singleton instance with basic config
const server = await resourceManager.getOrCreate('StaticServer', {
  server: { port: 3000 },
  static: { publicDir: './public' },
  security: { cors: { enabled: true } }
});

// 2. Different modules can add their routes
// Module A adds user routes
server.addEndpoints({
  '/api/users': (req, res) => res.json(users),
  '/api/users/:id': (req, res) => res.json(getUserById(req.params.id))
});

// Module B adds admin routes  
const adminRouter = express.Router();
adminRouter.use(authMiddleware);
adminRouter.get('/stats', (req, res) => res.json(getStats()));
server.addRouter('/admin', adminRouter);

// Module C adds file uploads
server.addMiddleware('/uploads', uploadMiddleware);
server.addStaticDirectory('/files', './uploads');

// 3. Start server once everything is configured
await server.start();
```

This pattern allows multiple modules to contribute to a single server instance without conflicts.

## Best Practices

### 1. Use ResourceManager Pattern
Always get StaticServer through ResourceManager for proper dependency injection:

```javascript
// ✅ Good
const server = await resourceManager.getOrCreate('StaticServer', config);

// ❌ Avoid direct instantiation
const server = new StaticServer(config, logger, resourceManager);
```

### 2. Configure Security Appropriately
- Enable CORS only when needed with specific origins
- Use CSP to prevent XSS attacks
- Set appropriate cache headers for static assets

### 3. Environment-Based Configuration
- Use environment variables for deployment-specific settings
- Leverage NODE_ENV for automatic development/production defaults
- Keep sensitive configuration in environment variables

### 4. WebSocket Integration
- Pass WebSocket handler factory functions, not instances
- Ensure WebSocket server cleanup in handler
- Use proper error handling in WebSocket handlers

### 5. API Endpoint Organization
- Group related endpoints in configuration
- Use consistent API prefixes
- Implement proper error handling in endpoint handlers

## Troubleshooting

### Common Issues

**Port Already in Use**
```javascript
// Use port 0 for automatic port assignment in tests
const server = await resourceManager.getOrCreate('StaticServer', {
  server: { port: 0 }  // Auto-assigns available port
});
```

**Static Files Not Found**
```javascript
// Use absolute paths for publicDir
import { resolve } from 'path';

const config = {
  static: { publicDir: resolve('./client') }
};
```

**CORS Issues**
```javascript
// Configure CORS properly for your frontend
const config = {
  security: {
    cors: {
      enabled: true,
      origin: process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3000' 
        : 'https://yourdomain.com',
      credentials: true
    }
  }
};
```

**WebSocket Connection Problems**
```javascript
// Ensure WebSocket handler returns server instance
const config = {
  websocket: {
    enabled: true,
    handler: (httpServer, wsConfig, logger) => {
      const wss = new WebSocketServer({ server: httpServer });
      // Return the WebSocket server for proper cleanup
      return wss;
    }
  }
};
```

## Future Enhancements

- Hot reload support for development
- Automatic SSL/TLS configuration
- Built-in rate limiting
- Request/response caching
- Plugin system for custom middleware
- Performance monitoring integration