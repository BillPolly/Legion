# Legion Server Framework - API Documentation

## Overview

The Legion Server Framework provides a simple, actor-based approach to building web applications with real-time communication between client and server. It automatically handles WebSocket connections, actor lifecycle management, and Legion package serving.

## Core Classes

### BaseServer

The main server class that manages HTTP servers, WebSocket connections, and actor spaces.

#### Constructor

```javascript
import { BaseServer } from '@legion/server-framework';

const server = new BaseServer();
```

#### Methods

##### `async initialize()`

Initializes the server with the ResourceManager singleton and discovers Legion packages.

```javascript
await server.initialize();
```

**Throws:** Error if initialization fails

##### `registerRoute(route, actorFactory, clientFile, port)`

Registers a route with an actor pair (server actor factory + client actor file).

```javascript
server.registerRoute('/app', createServerActor, './client.js', 8080);
```

**Parameters:**
- `route` (string): URL path (e.g., '/app', '/counter')
- `actorFactory` (function): Factory function that creates server actor instances
- `clientFile` (string): Path to client actor JavaScript file
- `port` (number): Port number for the HTTP server

**Example:**
```javascript
function createServerActor(services) {
  return {
    async receive(messageType, data) {
      // Handle messages from client
      return { type: 'response', data: 'Hello from server' };
    }
  };
}

server.registerRoute('/app', createServerActor, './client.js', 8080);
```

##### `registerStaticRoute(path, directory)`

Registers a static file serving route.

```javascript
server.registerStaticRoute('/static', './public');
```

**Parameters:**
- `path` (string): URL path prefix (e.g., '/static', '/assets')
- `directory` (string): Local directory to serve files from

##### `async start()`

Starts all registered HTTP servers and WebSocket handlers.

```javascript
await server.start();
```

**Throws:** Error if any server fails to start

##### `async stop()`

Gracefully stops all servers and closes WebSocket connections.

```javascript
await server.stop();
```

## Actor Interface

### Server Actor

Server actors are created by factory functions and handle messages from client actors.

#### Required Methods

##### `async receive(messageType, data)`

Handles incoming messages from the client actor.

```javascript
async receive(messageType, data) {
  switch (messageType) {
    case 'increment':
      this.count++;
      return { type: 'count_updated', count: this.count };
    default:
      throw new Error(`Unknown message type: ${messageType}`);
  }
}
```

**Parameters:**
- `messageType` (string): Type of message from client
- `data` (any): Message payload

**Returns:** Response object to send back to client

#### Optional Methods

##### `setRemoteActor(remoteActor)`

Called by the framework to provide a reference to the client actor.

```javascript
setRemoteActor(remoteActor) {
  this.remoteActor = remoteActor;
  // Can now send messages directly to client
}
```

##### `cleanup()`

Called when the actor is being destroyed (connection closed).

```javascript
cleanup() {
  // Clean up resources, timers, etc.
}
```

### Client Actor

Client actors run in the browser and communicate with server actors via WebSocket.

#### Required Structure

```javascript
export default class MyClientActor {
  constructor() {
    this.serverActor = null;
    this.ws = null;
  }

  async connect(ws, serverActorId) {
    this.ws = ws;
    this.serverActor = serverActorId;
    
    // Set up message listener
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'actor_message') {
        this.handleServerMessage(message.message);
      }
    });
  }

  handleServerMessage(message) {
    // Handle responses from server
  }

  async sendToServer(messageType, data = {}) {
    const message = {
      type: 'actor_message',
      from: 'client-root',
      to: this.serverActor,
      message: { type: messageType, data }
    };
    
    this.ws.send(JSON.stringify(message));
  }
}
```

## Configuration

### Environment Variables

The framework uses the ResourceManager for configuration. Common environment variables:

- `NODE_ENV`: Environment mode (development/production)
- `CORS_ORIGINS`: Comma-separated list of allowed CORS origins
- `HOST`: Server host (default: localhost)

### Production Configuration

```javascript
// In production, set appropriate CORS origins
process.env.CORS_ORIGINS = 'https://yourdomain.com,https://api.yourdomain.com';
process.env.NODE_ENV = 'production';

const server = new BaseServer();
await server.initialize();
```

## HTML Template

The framework automatically generates HTML pages for each route that include:

1. Basic HTML structure with app container (`<div id="app">`)
2. WebSocket connection setup
3. Actor initialization and handshake
4. Import rewriting for Legion packages
5. CSS link for static files

### Custom Styling

Add CSS files to your static directory and reference them:

```javascript
server.registerStaticRoute('/static', './public');
// CSS files in ./public will be available at /static/styles.css
```

## Legion Package Integration

The framework automatically:

1. Discovers Legion packages in the monorepo
2. Serves them at `/legion/<package-name>/*` routes
3. Rewrites `@legion/*` imports to work in browsers
4. Handles nested package dependencies

### Using Legion Packages in Client Code

```javascript
// In client.js - imports are automatically rewritten
import { SomeUtility } from '@legion/utils';
import { DatabaseClient } from '@legion/database';

// These become /legion/utils/index.js and /legion/database/index.js
```

## Error Handling

### Server-Side Error Handling

The framework includes comprehensive error handling:

```javascript
// Actor creation failures are logged and handled gracefully
function createServerActor(services) {
  return {
    async receive(messageType, data) {
      try {
        // Your logic here
      } catch (error) {
        console.error('Actor error:', error);
        return { type: 'error', message: error.message };
      }
    }
  };
}
```

### Client-Side Error Handling

```javascript
// In client actor
async sendToServer(messageType, data) {
  try {
    const message = {
      type: 'actor_message',
      from: 'client-root',
      to: this.serverActor,
      message: { type: messageType, data }
    };
    
    this.ws.send(JSON.stringify(message));
  } catch (error) {
    console.error('Failed to send message:', error);
    // Handle connection errors
  }
}
```

## Common Patterns

### State Management

```javascript
// Server actor with persistent state
function createStatefulActor(services) {
  return {
    state: { users: [], messages: [] },
    
    async receive(messageType, data) {
      switch (messageType) {
        case 'add_user':
          this.state.users.push(data.user);
          return { type: 'user_added', users: this.state.users };
          
        case 'get_state':
          return { type: 'state_update', state: this.state };
      }
    }
  };
}
```

### Real-time Updates

```javascript
// Push updates to client
function createRealtimeActor(services) {
  return {
    remoteActor: null,
    interval: null,
    
    setRemoteActor(remoteActor) {
      this.remoteActor = remoteActor;
      // Start sending periodic updates
      this.interval = setInterval(() => {
        this.remoteActor.handleServerMessage({
          type: 'heartbeat',
          timestamp: Date.now()
        });
      }, 5000);
    },
    
    cleanup() {
      if (this.interval) {
        clearInterval(this.interval);
      }
    }
  };
}
```

### Multiple Routes

```javascript
// Different actor types for different routes
server.registerRoute('/chat', createChatActor, './chat-client.js', 8080);
server.registerRoute('/game', createGameActor, './game-client.js', 8080);
server.registerRoute('/admin', createAdminActor, './admin-client.js', 8081);
```

## Troubleshooting

### Common Issues

1. **Actor not receiving messages**: Check that `receive()` method is implemented
2. **Import errors**: Ensure Legion packages are discoverable in monorepo
3. **WebSocket connection fails**: Check CORS configuration
4. **Static files not served**: Verify static route registration and file paths

### Debug Mode

```javascript
// Enable detailed logging
process.env.NODE_ENV = 'development';

// The framework will log:
// - Package discovery results
// - Route registration
// - WebSocket connections
// - Actor lifecycle events
```