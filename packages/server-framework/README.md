# @legion/server-framework

**Configuration-driven actor framework** for building real-time applications with automatic WebSocket communication and modular resource serving.

## Overview

The Legion Server Framework provides a powerful, zero-boilerplate foundation for creating web applications with real-time client-server communication:

- **📝 Configuration-driven development** - Define apps with simple config files, no manual setup
- **🎭 Actor-based architecture** - Isolated state per connection with bidirectional communication
- **🔄 Automatic WebSocket setup** - Complete handshake and actor pairing handled automatically
- **📦 Legion package integration** - Automatic import rewriting for browser compatibility
- **🎨 Modular resource serving** - Customizable static resources via server actor providers
- **🏗️ Production-ready** - Comprehensive error handling, graceful shutdown, CORS support

## Configuration-Driven Development

### Quick Start with `legion-serve`

The fastest way to create a Legion application is with the `legion-serve` CLI tool:

```bash
# Create actor-server.config.js
echo "export default {
  name: 'my-app',
  routes: [{
    path: '/app',
    serverActor: './ServerAppActor.js',
    clientActor: './ClientAppActor.js',
    port: 8080
  }]
};" > actor-server.config.js

# Start the server
npx legion-serve
# Visit http://localhost:8080/app
```

### Configuration Schema

```javascript
// actor-server.config.js
export default {
  name: 'my-app',
  routes: [
    {
      path: '/counter',           // URL path
      serverActor: './CounterServerActor.js',  // Server actor file
      clientActor: './CounterClientActor.js',  // Client actor file  
      port: 8080,                 // Optional: port (defaults to 8080)
      title: 'Counter App'        // Optional: page title
    }
  ],
  staticRoutes: [                 // Optional: static file serving
    {
      path: '/assets',
      directory: './public'
    }
  ]
};
```

## Actor Programming Model

### Core Principles

1. **🔄 Flux Pattern State Management** - Actors manage their own state, minimal async/await
2. **📡 Bidirectional Communication** - Both client and server actors can initiate messages
3. **🏭 Factory Pattern Isolation** - Each connection gets a fresh server actor instance
4. **🤝 Automatic Handshake** - Framework handles actor pairing and remote references
5. **❌ No Race Conditions** - Proper actor lifecycle prevents timing issues

### Server Actor Pattern

```javascript
// CounterServerActor.js
export default function createCounterActor(services) {
  return {
    count: 0,
    remoteActor: null,
    
    // Called by framework when client connects
    setRemoteActor(remoteActor) {
      this.remoteActor = remoteActor;
      // Send initial state to client
      this.remoteActor.receive('count_updated', { count: this.count });
    },
    
    // Handle messages from client (Flux pattern - no async needed)
    receive(messageType, data) {
      switch (messageType) {
        case 'increment':
          this.count++;
          // Immediately notify client of state change
          if (this.remoteActor) {
            this.remoteActor.receive('count_updated', { count: this.count });
          }
          break;
          
        case 'get_count':
          if (this.remoteActor) {
            this.remoteActor.receive('count_updated', { count: this.count });
          }
          break;
      }
    }
  };
}
```

### Client Actor Pattern

```javascript
// CounterClientActor.js  
export default class CounterClientActor {
  constructor() {
    this.count = 0;
    this.remoteActor = null;
    this.initializeUI();
  }
  
  // Called by framework when server actor connects
  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    console.log('[Client] Connected to server actor');
    // Request initial state
    this.remoteActor.receive('get_count', {});
  }
  
  // Handle messages from server
  receive(messageType, data) {
    switch (messageType) {
      case 'count_updated':
        this.count = data.count;
        this.updateUI();
        break;
    }
  }
  
  // UI interaction handlers
  onIncrementClick() {
    if (this.remoteActor) {
      this.remoteActor.receive('increment', {});
    }
  }
  
  initializeUI() {
    document.getElementById('app').innerHTML = `
      <div>
        <h1>Count: <span id="count">0</span></h1>
        <button id="increment">Increment</button>
      </div>
    `;
    
    document.getElementById('increment').addEventListener('click', () => {
      this.onIncrementClick();
    });
  }
  
  updateUI() {
    document.getElementById('count').textContent = this.count;
  }
}
```

## Resource Provider System

Server actors can customize the resources (HTML, CSS, JS, favicon) served to clients using the **Resource Provider pattern**:

### Custom Resource Provider

```javascript
// ServerTodoActor.js
import { TodoResourceProvider } from './TodoResourceProvider.js';

export default function createTodoActor(services) {
  return {
    // ... actor implementation
  };
}

// Static method for resource customization
createTodoActor.createResourceProvider = (defaultProvider) => {
  return new TodoResourceProvider(defaultProvider);
};
```

### Resource Provider Implementation

```javascript
// TodoResourceProvider.js
import { ResourceProvider } from '@legion/server-framework/resources';

export class TodoResourceProvider extends ResourceProvider {
  constructor(defaultProvider) {
    super();
    this.defaultProvider = defaultProvider;
  }
  
  async getResource(path, req) {
    switch (path) {
      case '/todos/styles.css':
        return {
          content: `
            .todo-app { max-width: 600px; margin: 0 auto; padding: 20px; }
            .todo-header h1 { color: #333; text-align: center; }
            .todo-input { width: 100%; padding: 10px; margin-bottom: 20px; }
          `,
          contentType: 'text/css'
        };
        
      case '/todos/favicon.ico':
        return {
          content: Buffer.from(todoIconData, 'base64'),
          contentType: 'image/x-icon'
        };
        
      default:
        // Delegate to default provider for HTML, client.js, etc.
        return this.defaultProvider.getResource(path, req);
    }
  }
}
```

## Working Examples

### Complete Todo Application

See `examples/todo-app/` for a complete implementation with:
- ✅ File-based persistence using Flux pattern
- ✅ Custom CSS and favicon via resource provider
- ✅ Bidirectional real-time updates
- ✅ MVVM client architecture
- ✅ Configuration-driven setup

### Simple Counter

See `examples/simple-counter/` for minimal actor communication:
- ✅ Pure in-memory state
- ✅ Default resource provider
- ✅ Basic increment/decrement actions

## Actor Handshake Protocol

Understanding the handshake protocol is crucial for debugging actor connection issues:

### Proper Handshake Sequence

1. **Client page loads** and initializes actor
2. **WebSocket connection** established to `/ws?route=/your-route`
3. **Client sends handshake**:
   ```javascript
   {
     type: 'actor_handshake',
     clientRootActor: 'client-root',
     route: '/your-route'
   }
   ```
4. **Server creates server actor** using route factory
5. **Server responds with acknowledgment**:
   ```javascript
   {
     type: 'actor_handshake_ack',
     serverRootActor: 'server-root-12345',
     route: '/your-route'
   }
   ```
6. **Both actors set remote references** and begin communication

### Critical Rules

- ✅ **Server sends first message AFTER handshake** - never before
- ✅ **No race conditions** - actors manage their own state
- ✅ **Never bypass ActorSpace** - always use the proper protocol
- ✅ **Use Flux pattern** - minimal async/await in actor interfaces

## Best Practices & Patterns

### ✅ Actor State Management (Flux Pattern)

```javascript
// ✅ GOOD - Flux pattern with immediate state updates
receive(messageType, data) {
  switch (messageType) {
    case 'add_todo':
      this.todos.push({ id: ++this.nextId, text: data.text, completed: false });
      this.notifyClient(); // Immediately notify of state change
      this.saveToFile();  // Handle I/O asynchronously without blocking
      break;
  }
}

// ❌ BAD - Don't use async/await in actor interfaces
async receive(messageType, data) {
  // This breaks the Flux pattern and can cause race conditions
  const result = await this.someAsyncOperation();
  this.updateState(result);
}
```

### ✅ Persistence Pattern

```javascript
// ✅ GOOD - Non-blocking persistence with Flux notifications
function addTodo(text) {
  // Update state immediately
  sharedState.todos.push({ id: ++sharedState.nextId, text, completed: false });
  
  // Notify all connected clients immediately  
  sharedState.clients.forEach(client => client.sendTodos());
  
  // Handle file I/O asynchronously without blocking actor
  setImmediate(async () => {
    try {
      await fs.writeFile('./data/todos.json', JSON.stringify(sharedState));
    } catch (error) {
      console.error('Failed to save todos:', error);
    }
  });
}
```

### ✅ Resource Customization Pattern

```javascript
// ✅ GOOD - Server actor provides resource customization
export default function createMyActor(services) {
  return {
    // ... actor implementation
  };
}

// Static method for framework integration
createMyActor.createResourceProvider = (defaultProvider) => {
  return new MyResourceProvider(defaultProvider);
};
```

## Troubleshooting

### "unknown local target GUID" Errors

**Root Cause**: Actor handshake protocol was bypassed or corrupted.

**Solution**: 
- Ensure your resource provider doesn't override the handshake JavaScript
- Use the DefaultResourceProvider template as reference
- Never manually create actor references outside the handshake

### Client Actor `remoteActor` is null

**Root Cause**: Handshake didn't complete or remote reference wasn't set.

**Debug Steps**:
1. Check browser console for handshake messages
2. Verify server actor factory is being called
3. Ensure `setRemoteActor()` method exists on both actors
4. Check WebSocket connection is established

```javascript
// Debug handshake in browser console
console.log('Actor space:', window.__legionActorSpace);
console.log('Remote actor:', clientActor.remoteActor);
```

### Race Conditions / Timing Issues

**Root Cause**: Trying to use async/await in actor interfaces.

**Solution**: Use Flux pattern with immediate state updates:
- Update actor state immediately (synchronously)
- Send notifications to clients immediately
- Handle I/O operations asynchronously in background
- Never wait for async operations in `receive()` methods

### Persistence Not Working

**Root Cause**: Async file operations blocking actor message handling.

**Solution**: Load data using message passing when ready:
```javascript
function loadTodos() {
  if (sharedState.initialized) return;
  
  sharedState.loading = true;
  setImmediate(async () => {
    const data = await loadFromFile();
    sharedState.todos = data.todos;
    sharedState.initialized = true;
    
    // Notify waiting clients that data is ready
    sharedState.clients.forEach(client => client.sendTodos());
  });
}
```

### Client Not Connecting to Server Actor

**Symptoms**: UI renders but interactions don't work.

**Debug Steps**:
1. Check browser DevTools Network tab for WebSocket connection
2. Verify correct route in URL query parameters
3. Check server logs for actor creation messages
4. Ensure client actor calls `setRemoteActor()` correctly

## Advanced Usage

### Multi-User State Synchronization

```javascript
// Shared state across all connections
const sharedState = {
  todos: [],
  clients: new Set()
};

function createTodoActor(services) {
  return {
    setRemoteActor(remoteActor) {
      this.remoteActor = remoteActor;
      sharedState.clients.add(this);
      this.sendTodos(); // Send current state to new client
    },
    
    receive(messageType, data) {
      switch (messageType) {
        case 'add_todo':
          sharedState.todos.push({ id: Date.now(), text: data.text });
          // Notify ALL connected clients
          sharedState.clients.forEach(client => client.sendTodos());
          break;
      }
    }
  };
}
```

### Environment Configuration

The framework uses ResourceManager singleton for all configuration:

```javascript
// Access environment variables through ResourceManager
const resourceManager = services.get('resourceManager');
const port = resourceManager.get('env.PORT') || 8080;
const dbUrl = resourceManager.get('env.DATABASE_URL');
```

## Documentation

- **[Design Document](./docs/DESIGN.md)** - Complete architecture and design decisions
- **[Examples](./examples/)** - Working example applications including todo and counter apps

## Features

- ✅ **Configuration-driven development** with `legion-serve` CLI
- ✅ **Actor-based architecture** with bidirectional WebSocket communication
- ✅ **Resource provider system** for customizable static resources
- ✅ **Automatic Legion package serving** with import rewriting
- ✅ **Flux pattern state management** preventing race conditions
- ✅ **Multi-user synchronization** with shared state patterns
- ✅ **File-based persistence** with non-blocking I/O
- ✅ **Production-ready** with error handling and graceful shutdown

## License

MIT