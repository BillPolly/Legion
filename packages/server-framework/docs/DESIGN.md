# Legion Server Framework Design Document

## Overview

The Legion Server Framework provides a **configuration-driven, zero-boilerplate** foundation for creating Legion applications with standardized Express + WebSocket servers and automatic actor-based communication. The framework eliminates complexity by providing:

- **Configuration-driven development** using `legion-serve` CLI and config files
- **Modular resource serving** via Resource Provider pattern for customizable static assets
- **Automatic actor handshake protocol** with proper lifecycle management
- **Flux pattern state management** preventing race conditions and timing issues
- **Clean Architecture principles** with Dependency Inversion and separation of concerns

## Problem Statement

Previously, Legion applications required significant boilerplate and suffered from common issues:

**Before Framework (Problems Solved):**
- 🔴 **Manual server setup** - 200+ lines of Express/WebSocket configuration per app  
- 🔴 **Actor handshake bugs** - "unknown local target GUID" errors from improper protocol
- 🔴 **Race condition issues** - Async/await in actor interfaces causing timing problems
- 🔴 **Static resource complexity** - Manual serving of HTML, CSS, JS, favicons
- 🔴 **Configuration boilerplate** - Repeated middleware, CORS, health checks
- 🔴 **Debugging difficulty** - Complex server setup obscuring actor logic issues

**After Framework (Solutions Provided):**
- ✅ **Configuration-driven** - Define apps with simple config files, no manual setup
- ✅ **Proper handshake protocol** - Automatic actor pairing with error-free communication
- ✅ **Flux pattern enforcement** - State management preventing race conditions  
- ✅ **Resource Provider pattern** - Modular, customizable static asset serving
- ✅ **Zero boilerplate** - Focus on actor logic, not infrastructure
- ✅ **Built-in debugging** - Clear error messages and protocol visibility

## Solution Architecture

### Core Philosophy

The framework follows a **"configuration-driven development"** philosophy with three key principles:

#### 1. Configuration Over Code
Developers define applications declaratively using simple config files:
```javascript
// actor-server.config.js - Complete app definition
export default {
  name: 'todo-app',
  routes: [{
    path: '/todos',
    serverActor: './ServerTodoActor.js',
    clientActor: './ClientTodoActor.js', 
    port: 8081
  }]
};
```

#### 2. Hollywood Principle ("Don't call us, we'll call you")
The framework asks server actors for customization instead of forcing global configuration:
```javascript
// Server actors can provide custom resources
export default function createTodoActor(services) { /* ... */ }

// Framework calls this static method to get resource customization
createTodoActor.createResourceProvider = (defaultProvider) => {
  return new TodoResourceProvider(defaultProvider);
};
```

#### 3. Flux Pattern State Management
Actors use synchronous state updates with asynchronous I/O to prevent race conditions:
- State updates are immediate and synchronous
- Client notifications happen immediately  
- File I/O and external operations happen asynchronously in background
- **No async/await in actor `receive()` methods**

### Framework Automation

The framework automatically handles:
1. **HTML page generation** with embedded WebSocket and actor initialization
2. **Client actor serving** as ES modules with proper MIME types
3. **Server actor creation** using factory pattern for connection isolation
4. **Actor handshake protocol** with proper sequencing and error handling
5. **Resource customization** through Resource Provider pattern
6. **Legion package serving** with automatic import rewriting for browsers

## Resource Provider Architecture

### Overview

The Resource Provider pattern follows **Clean Architecture principles** to enable modular, customizable static resource serving without framework changes. This solves the problem of how server actors can provide custom HTML, CSS, JavaScript, favicons, and other static assets.

### Design Principles

#### 1. Dependency Inversion Principle
The framework depends on abstract `ResourceProvider` interface, not concrete implementations:

```javascript
// src/resources/ResourceProvider.js - Abstract base class
export class ResourceProvider {
  async getResource(path, req) {
    throw new Error('ResourceProvider.getResource() must be implemented');
  }
}
```

#### 2. Strategy Pattern
Different resource providers can be swapped without changing framework code:

```javascript
// Framework uses any ResourceProvider implementation
const resourceProvider = serverActor.createResourceProvider 
  ? serverActor.createResourceProvider(defaultProvider)
  : defaultProvider;
```

#### 3. Composite Pattern
Resource providers can be chained using `CompositeResourceProvider`:

```javascript
export class CompositeResourceProvider extends ResourceProvider {
  constructor(providers) {
    super();
    this.providers = providers; // Array of providers to try in order
  }
  
  async getResource(path, req) {
    for (const provider of this.providers) {
      const resource = await provider.getResource(path, req);
      if (resource) return resource;
    }
    return null;
  }
}
```

### Provider Implementations

#### DefaultResourceProvider
Provides minimal HTML template, favicon, and client.js with proper actor handshake protocol:

```javascript
export class DefaultResourceProvider extends ResourceProvider {
  async getResource(path, req) {
    switch (path) {
      case this.config.route: // Main HTML page
        return {
          content: this.generateHTML(),
          contentType: 'text/html'
        };
        
      case `${this.config.route}/client.js`: // Client actor
        return {
          content: await fs.readFile(this.config.clientActorFile, 'utf8'),
          contentType: 'application/javascript'
        };
        
      case `${this.config.route}/favicon.ico`: // Default favicon
        return {
          content: await fs.readFile('./assets/default-favicon.ico'),
          contentType: 'image/x-icon'
        };
    }
    return null;
  }
  
  generateHTML() {
    return `<!DOCTYPE html>
<html>
<head>
  <title>${this.config.title}</title>
  <link rel="icon" href="${this.config.route}/favicon.ico">
</head>
<body>
  <div id="${this.config.clientContainer}"></div>
  <script type="module">
    import ClientActor from '${this.config.clientActorPath}';
    import { ActorSpace } from '/legion/actors/ActorSpace.js';
    
    // Initialize client actor and WebSocket connection
    const ws = new WebSocket('${this.config.wsEndpoint}');
    const clientActor = new ClientActor();
    const actorSpace = new ActorSpace('client');
    
    actorSpace.register(clientActor, 'client-root');
    window.__legionActorSpace = actorSpace;
    
    ws.onopen = () => {
      const channel = actorSpace.addChannel(ws);
      
      // CRITICAL: Proper handshake protocol
      const handshake = {
        type: 'actor_handshake',
        clientRootActor: 'client-root',
        route: '${this.config.route}'
      };
      ws.send(JSON.stringify(handshake));
    };
    
    // Handle handshake acknowledgment
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'actor_handshake_ack') {
        const remoteActor = channel.makeRemote(message.serverRootActor);
        clientActor.setRemoteActor(remoteActor);
      }
    };
  </script>
</body>
</html>`;
  }
}
```

#### Custom Application Providers
Applications can provide their own resources by implementing the interface:

```javascript
// examples/todo-app/TodoResourceProvider.js
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
            .todo-header h1 { color: #2c3e50; text-align: center; }
            .todo-input { 
              width: 100%; 
              padding: 15px; 
              font-size: 16px;
              border: 2px solid #3498db;
              border-radius: 8px;
            }
          `,
          contentType: 'text/css'
        };
        
      case '/todos/favicon.ico':
        return {
          content: Buffer.from(base64TodoIcon, 'base64'),
          contentType: 'image/x-icon'
        };
        
      default:
        // Delegate to default provider for HTML, client.js, etc.
        return this.defaultProvider.getResource(path, req);
    }
  }
}
```

### Integration with Framework

#### Server Actor Factory Integration
Server actors can provide resource customization via static method:

```javascript
// ServerTodoActor.js
import { TodoResourceProvider } from './TodoResourceProvider.js';

export default function createTodoActor(services) {
  return {
    // ... actor implementation
  };
}

// Framework calls this method to get custom resource provider
createTodoActor.createResourceProvider = (defaultProvider) => {
  return new TodoResourceProvider(defaultProvider);
};
```

#### Framework Integration Flow
1. **ConfigurableActorServer** checks if server actor factory has `createResourceProvider` method
2. If present, calls method with `defaultProvider` to get custom provider
3. Uses custom provider; otherwise falls back to `defaultProvider`
4. Provider handles all resource requests for the route

```javascript
// src/ConfigurableActorServer.js
setupRoute(routeConfig) {
  const { serverActor, clientActor, path, port, title } = routeConfig;
  
  // Create default provider with proper configuration
  const defaultProvider = new DefaultResourceProvider({
    title: title || 'Legion App',
    clientActorFile: clientActor,
    clientActorPath: `${path}/client.js`,
    route: path,
    // ... other config
  });
  
  // Check if server actor provides custom resources
  const factory = await import(serverActor);
  const resourceProvider = factory.default.createResourceProvider
    ? factory.default.createResourceProvider(defaultProvider)
    : defaultProvider;
    
  // Use provider for all route resources
  this.server.use(path, async (req, res, next) => {
    const resource = await resourceProvider.getResource(req.path, req);
    if (resource) {
      res.setHeader('Content-Type', resource.contentType);
      res.send(resource.content);
    } else {
      next();
    }
  });
}
```

### Benefits of Resource Provider Pattern

1. **🔧 Modularity** - Each application can customize resources without framework changes
2. **🎨 Flexibility** - Support any static asset type (HTML, CSS, JS, images, fonts)
3. **🏗️ Clean Architecture** - Dependency Inversion prevents framework coupling
4. **🔄 Composability** - Providers can be chained and combined
5. **✅ Testability** - Easy to unit test providers in isolation
6. **🚀 Performance** - Resources served directly without file system lookups

### Core Components

## Actor Protocol and State Management

### Critical Protocol Rules

Based on extensive debugging and implementation experience, the actor protocol must follow these **critical rules** to prevent errors:

#### 🚨 Rule 1: No Race Conditions - Actors Handle Their Own State
- **Problem**: Using async/await in actor `receive()` methods causes timing issues
- **Solution**: Use Flux pattern with immediate synchronous state updates

```javascript
// ❌ BAD - Race conditions and timing issues
async receive(messageType, data) {
  const result = await this.loadFromDatabase();  // Async operation blocks
  this.updateState(result);                      // State update delayed
  this.notifyClients();                         // Notifications delayed
}

// ✅ GOOD - Flux pattern prevents race conditions  
receive(messageType, data) {
  switch (messageType) {
    case 'add_todo':
      // 1. Update state immediately (synchronous)
      this.todos.push({ id: ++this.nextId, text: data.text });
      
      // 2. Notify clients immediately (synchronous)
      this.clients.forEach(client => client.sendTodos());
      
      // 3. Handle I/O asynchronously without blocking
      setImmediate(async () => {
        await this.saveToFile(); // Background operation
      });
      break;
  }
}
```

#### 🚨 Rule 2: Server Sends First Message AFTER Handshake
- **Problem**: Sending messages before handshake completion causes "unknown local target GUID" errors
- **Solution**: Wait for handshake acknowledgment before any communication

```javascript
// ✅ GOOD - Proper handshake sequence
1. Client sends: { type: 'actor_handshake', clientRootActor: 'client-root' }
2. Server responds: { type: 'actor_handshake_ack', serverRootActor: 'server-123' }  
3. Both sides set remote references
4. NOW actors can send messages freely
```

#### 🚨 Rule 3: Never Bypass ActorSpace Protocol
- **Problem**: Manual WebSocket handling breaks actor pairing
- **Solution**: Always use ActorSpace.register() and proper handshake

### Fixed Handshake Protocol Implementation

The handshake protocol was debugged and fixed to prevent "unknown local target GUID" errors:

#### Client-Side Handshake (Fixed in DefaultResourceProvider)
```javascript
// CRITICAL: This is the correct client handshake implementation
ws.onopen = () => {
  const channel = actorSpace.addChannel(ws);
  
  // Send handshake to initiate actor connection  
  const handshake = {
    type: 'actor_handshake',
    clientRootActor: 'client-root',
    route: '${this.config.route}'
  };
  console.log('[CLIENT] Sending handshake:', handshake);
  ws.send(JSON.stringify(handshake));
};

// Handle server acknowledgment
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'actor_handshake_ack') {
    console.log('[CLIENT] Received handshake ack:', message);
    const remoteActor = channel.makeRemote(message.serverRootActor);
    clientActor.setRemoteActor(remoteActor);
  }
};
```

#### Server-Side Handshake (Fixed in ActorSpaceManager)  
```javascript
// Handle incoming handshake messages
ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    if (message.type === 'actor_handshake') {
      console.log('[SERVER] Received actor handshake:', message);
      this.handleHandshake(ws, message);
    }
  } catch (error) {
    // Not a JSON message, let ActorSpace handle normally
  }
});

handleHandshake(ws, message) {
  const { route } = message;
  const routeConfig = this.routes.get(route);
  
  // Create server actor using factory
  const serverActor = routeConfig.factory(this.services);
  const actorId = `server-root-${Date.now()}`;
  
  // Register in ActorSpace
  connection.actorSpace.register(serverActor, actorId);
  
  // Set up remote reference to client
  const remoteActor = connection.channel.makeRemote('client-root');
  serverActor.setRemoteActor(remoteActor);
  
  // Send acknowledgment
  ws.send(JSON.stringify({
    type: 'actor_handshake_ack',
    serverRootActor: actorId,
    route: route
  }));
}
```

### Flux Pattern Implementation

#### State Management Pattern
```javascript
// Shared state across all connections (for multi-user apps)
const sharedState = {
  todos: [],
  nextId: 1,
  clients: new Set(),
  initialized: false,
  loading: false
};

function createTodoActor(services) {
  return {
    remoteActor: null,
    
    setRemoteActor(remoteActor) {
      this.remoteActor = remoteActor;
      sharedState.clients.add(this);
      
      // Load data if not already loaded
      loadTodos();
      
      // Send current state if already initialized
      if (sharedState.initialized) {
        this.sendTodos();
      }
    },
    
    // Flux pattern: no async/await, immediate state updates
    receive(messageType, data) {
      switch (messageType) {
        case 'add_todo':
          // 1. Update state immediately
          const newTodo = {
            id: ++sharedState.nextId,
            text: data.text,
            completed: false,
            createdAt: new Date().toISOString()
          };
          sharedState.todos.push(newTodo);
          
          // 2. Notify all clients immediately
          sharedState.clients.forEach(client => client.sendTodos());
          
          // 3. Persist asynchronously without blocking
          persistTodos();
          break;
      }
    },
    
    sendTodos() {
      if (this.remoteActor) {
        this.remoteActor.receive('todos_updated', {
          todos: sharedState.todos,
          stats: calculateStats()
        });
      }
    }
  };
}

// Background data loading with message passing
function loadTodos() {
  if (sharedState.loading || sharedState.initialized) return;
  
  sharedState.loading = true;
  setImmediate(async () => {
    try {
      const data = await fs.readFile('./data/todos.json', 'utf8');
      const parsed = JSON.parse(data);
      
      sharedState.todos = parsed.todos || [];
      sharedState.nextId = parsed.nextId || 1;
      sharedState.initialized = true;
      sharedState.loading = false;
      
      // Notify all waiting clients
      sharedState.clients.forEach(client => client.sendTodos());
    } catch (error) {
      console.error('Failed to load todos:', error);
      sharedState.initialized = true;
      sharedState.loading = false;
    }
  });
}
```

### Common Mistakes and Solutions

#### ❌ Mistake 1: "unknown local target GUID" Errors
**Root Cause**: Bypassing the handshake protocol or corrupting it

**Fix**: Never override the handshake JavaScript in resource providers. Use DefaultResourceProvider as reference.

#### ❌ Mistake 2: Client remoteActor is null  
**Root Cause**: Handshake didn't complete properly

**Debug**:
```javascript
// Check in browser console
console.log('Actor space:', window.__legionActorSpace);
console.log('Remote actor:', clientActor.remoteActor);
```

#### ❌ Mistake 3: Persistence not working
**Root Cause**: Using async/await in actor interfaces

**Fix**: Use Flux pattern with background I/O operations

### Core Components

#### 1. ConfigurableActorServer Class

The `ConfigurableActorServer` class provides configuration-driven server setup:
class BaseServer {
  constructor() {
    this.app = express();
    this.resourceManager = null;  // Will be initialized with singleton
    this.routes = new Map();      // route -> { ServerActor, ClientActor, port }
    this.services = new Map();
    this.actorManager = null;
    this.port = null;             // Set when route is registered
  }
  
  async initialize() {
    // Get ResourceManager singleton
    this.resourceManager = ResourceManager.getInstance();
    await this.resourceManager.initialize();
    
    // Get monorepo root for package discovery
    this.monorepoRoot = this.resourceManager.get('env.MONOREPO_ROOT');
  }
  
  // Register route with actor factory and client file
  registerRoute(route, serverActorFactory, clientActorFile, port = 8080)
  registerStaticRoute(path, directory)
  async start()
  async stop()
}
```

**Standard Features:**
- Express app with CORS, JSON parsing, logging middleware
- WebSocket server on `/ws` endpoint
- Health check endpoint at `/health`
- Automatic actor serving and pairing
- Graceful shutdown handling
- Error handling middleware

#### 2. Automatic Route Registration

When you register a route, the framework automatically sets up three things:

**1. HTML Page Generation:**
```javascript
// GET /tools → serves generated HTML page
app.get('/tools', (req, res) => {
  const html = generateHTML({
    title: 'Tools',
    clientActorPath: '/tools/client.js',
    wsEndpoint: `ws://localhost:${port}/ws`,
    route: '/tools'
  });
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});
```

**2. Client Actor Serving:**
```javascript
// GET /tools/client.js → serves the client actor file
app.get('/tools/client.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(clientActorFile); // Serve the actual file
});
```

**3. Server Actor Factory on Connection:**
```javascript
// When WebSocket connects, use factory to create new instance
wss.on('connection', (ws) => {
  const serverActor = serverActorFactory(services);
  actorSpace.register(serverActor, `server-root-${connectionId}`);
});
```

#### 3. HTML Template System

The framework uses a simple HTML template that:
- Loads the client actor script as an ES module
- Establishes WebSocket connection
- Creates the client actor instance
- Handles the handshake

```html
<!DOCTYPE html>
<html>
<head>
  <title>{{title}}</title>
  <script type="module">
    // Import the client actor (must export as default)
    import ClientActor from '{{clientActorPath}}';
    
    // Establish WebSocket connection
    const ws = new WebSocket('{{wsEndpoint}}');
    
    // Create client actor instance
    const clientActor = new ClientActor();
    const actorSpace = new ActorSpace('client');
    actorSpace.register(clientActor, 'client-root');
    
    // Set up channel when connected
    ws.onopen = () => {
      const channel = actorSpace.addChannel(ws);
      
      // Send handshake
      ws.send(JSON.stringify({
        type: 'actor_handshake',
        clientRootActor: 'client-root',
        route: '{{route}}'
      }));
    };
    
    // Handle server handshake response
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'actor_handshake_ack') {
        const remoteActor = channel.makeRemote(message.serverRootActor);
        clientActor.setRemoteActor(remoteActor);
      }
    };
  </script>
</head>
<body>
  <div id="app"></div>
</body>
</html>
```

#### 4. Actor Space Management

The `ActorSpaceManager` handles WebSocket connections with a simple root actor pattern:

```javascript
class ActorSpaceManager {
  constructor(services, routes) {
    this.services = services;
    this.routes = routes;            // route -> { factory, clientFile, port }
    this.connections = new Map();    // ws -> { actorSpace, serverActor }
  }
  
  handleConnection(ws, req) {
    const route = this.getRouteFromRequest(req);
    const { factory } = this.routes.get(route);
    
    // Create new server actor instance using factory
    const serverActor = factory(this.services);
    
    // Create actor space and register
    const actorSpace = new ActorSpace(`server-${Date.now()}`);
    actorSpace.register(serverActor, 'server-root');
    
    // Store connection info
    this.connections.set(ws, { actorSpace, serverActor });
  }
  
  handleHandshake(ws, message)      // Pair with client root actor
  cleanup(ws)                       // Clean up on disconnect
}
```

**Simple Actor Lifecycle:**
1. Client loads HTML page with embedded WebSocket code
2. Client actor script loads and creates client actor instance
3. WebSocket connection established
4. Server uses factory to create new server actor instance
5. Simple handshake pairs client and server root actors
6. Root actors can create and manage their own sub-actors
7. Cleanup on disconnection

#### 5. Automatic Static File Serving

The framework automatically serves:

**1. Client Actors at Routes:**
- `/tools` → serves the registered ClientToolActor
- `/database` → serves the registered ClientDatabaseActor

**2. Legion Package Files (Critical for Browser Imports):**

Since browsers cannot resolve `@legion/*` imports, the framework automatically maps `/legion/` URLs to the actual package directories:

```javascript
// Browser import:
import { Actor } from '/legion/actors/Actor.js';
// Framework maps to: packages/shared/actors/src/Actor.js

// Browser import:
import { Button } from '/legion/frontend-components/Button.js';
// Framework maps to: packages/frontend/components/src/Button.js
```

**Automatic Package Serving:**
```javascript
// In BaseServer.initialize()
// Framework automatically discovers all Legion packages and serves them
const monorepoRoot = path.resolve(__dirname, '../../../');
const packages = await discoverLegionPackages(monorepoRoot);

packages.forEach(pkg => {
  // Serve each package at /legion/packagename
  app.use(`/legion/${pkg.name}`, express.static(pkg.srcPath));
});
```

**Standard Legion Package Mappings:**
- `/legion/shared` → `packages/shared/src`
- `/legion/tools` → `packages/tools/src`
- `/legion/frontend-components` → `packages/frontend/components/src`
- `/legion/actors` → `packages/shared/actors/src`
- `/legion/llm` → `packages/llm/src`
- `/legion/resource-manager` → `packages/resource-manager/src`

**Automatic Resolution:**
1. **Route actors**: Directly serve registered client actor classes
2. **Legion packages**: Auto-discover and map all `@legion/*` packages to `/legion/*` routes
3. **Package name normalization**: Handle both `@legion/package-name` and `/legion/package-name` formats
4. **MIME types**: Automatically set based on file extension (`.js` → `application/javascript`)
5. **ES modules**: Proper headers for browser module loading
6. **Source maps**: Serve `.map` files for debugging in development

### Configuration System

The framework uses ResourceManager singleton for all configuration:

```javascript
class BaseServer {
  async getConfig() {
    const rm = this.resourceManager;
    
    return {
      // Port comes from route registration, not env
      host: 'localhost',  // Always localhost for now
      env: rm.get('env.NODE_ENV') || 'development',
      corsOrigins: rm.get('env.CORS_ORIGINS')?.split(',') || ['http://localhost:3000'],
      logLevel: rm.get('env.LOG_LEVEL') || 'info',
      monorepoRoot: rm.get('env.MONOREPO_ROOT') // Required for package discovery
    };
  }
}
```

**No Direct Environment Access:**
- ❌ Never use `process.env` directly
- ✅ Always use `resourceManager.get('env.VARIABLE_NAME')`
- ✅ ResourceManager handles .env file loading and validation
- ✅ Consistent configuration across all Legion components

## Automatic Framework Handling

### How Route Registration Works

When you call `server.registerRoute('/tools', serverActorFactory, './client/ToolsClient.js', 8090)`:

**1. HTML Route Setup:**
```javascript
// GET /tools → serves generated HTML with embedded WebSocket code
app.get('/tools', (req, res) => {
  const html = generateHTMLFromTemplate({
    clientActorPath: '/tools/client.js',
    wsEndpoint: `ws://localhost:8090/ws`
  });
  res.send(html);
});
```

**2. Client Actor File Serving:**
```javascript
// GET /tools/client.js → serves the actual client actor file
app.get('/tools/client.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile('./client/ToolsClient.js');
});
```

**3. Server Actor Factory on WebSocket:**
```javascript
// On each WebSocket connection, use factory for new instance:
wss.on('connection', (ws) => {
  const serverActor = serverActorFactory(services);
  actorSpace.register(serverActor, 'server-root');
  // Each connection gets its own server actor instance
});
```

**4. Legion Package Import Resolution:**
```javascript
// When ClientToolActor imports Legion packages:
import { Actor } from '@legion/actors';
import { Button } from '@legion/frontend-components';

// Framework serves these at:
// GET /legion/actors/index.js → packages/shared/actors/src/index.js
// GET /legion/frontend-components/Button.js → packages/frontend/components/src/Button.js
```

### Complete Automation

The framework handles:
- ✅ **File serving** - Client actors served at routes
- ✅ **Legion package serving** - All `@legion/*` packages available at `/legion/*` URLs for browser imports
- ✅ **Import rewriting** - Transform `@legion/*` to `/legion/*` in served files
- ✅ **Actor creation** - Server actors created on connection  
- ✅ **Actor pairing** - Automatic client/server pairing
- ✅ **Message routing** - Transparent bidirectional communication
- ✅ **Lifecycle management** - Creation and cleanup
- ✅ **Error handling** - Connection failures and actor errors

## Legion Package Serving System

### Why This Is Critical

Browsers cannot resolve Node.js-style module imports like `@legion/actors`. When client-side code tries to:
```javascript
import { Actor } from '@legion/actors';
```

The browser doesn't know where `@legion/actors` is located. The framework solves this by:
1. **Serving Legion packages** at predictable `/legion/*` URLs
2. **Rewriting imports** in served JavaScript files to use browser-compatible paths
3. **Auto-discovering** all Legion packages in the monorepo

### Package Discovery Algorithm

```javascript
class PackageDiscovery {
  async discoverPackages(monorepoRoot) {
    const packages = new Map();
    
    // Scan packages directory
    const packagesDir = path.join(monorepoRoot, 'packages');
    const categories = await fs.readdir(packagesDir);
    
    for (const category of categories) {
      const categoryPath = path.join(packagesDir, category);
      
      // Handle both flat and nested structures
      if (await this.isLegionPackage(categoryPath)) {
        // Direct package (e.g., packages/gmail)
        const pkg = await this.loadPackage(categoryPath);
        packages.set(pkg.name, pkg);
      } else {
        // Category folder (e.g., packages/shared/*)
        const subPackages = await fs.readdir(categoryPath);
        for (const subPkg of subPackages) {
          const pkgPath = path.join(categoryPath, subPkg);
          if (await this.isLegionPackage(pkgPath)) {
            const pkg = await this.loadPackage(pkgPath);
            packages.set(pkg.name, pkg);
          }
        }
      }
    }
    
    return packages;
  }
}
```

### Import Rewriting

When serving JavaScript files, the framework automatically rewrites imports:

```javascript
class ImportRewriter {
  rewrite(content) {
    // Transform @legion/* imports to /legion/* URLs
    return content
      .replace(/from ['"]@legion\/([^'"]+)['"]/g, "from '/legion/$1/index.js'")
      .replace(/import ['"]@legion\/([^'"]+)['"]/g, "import '/legion/$1/index.js'");
  }
}
```

### Serving Strategy

```javascript
// In BaseServer.initializeLegionPackages()
async initializeLegionPackages() {
  // Get monorepo root from ResourceManager
  const monorepoRoot = this.resourceManager.get('env.MONOREPO_ROOT');
  
  if (!monorepoRoot) {
    throw new Error('MONOREPO_ROOT not set in .env file');
  }
  
  // Discover all Legion packages
  const discovery = new PackageDiscovery(this.resourceManager);
  const packages = await discovery.discoverPackages(monorepoRoot);
  
  // Serve each package at /legion/packagename
  packages.forEach((pkg, name) => {
    const servePath = `/legion/${name.replace('@legion/', '')}`;
    
    // Serve with import rewriting middleware
    this.app.use(servePath, (req, res, next) => {
      if (req.path.endsWith('.js')) {
        const filePath = path.join(pkg.srcPath, req.path);
        const content = fs.readFileSync(filePath, 'utf8');
        const rewritten = this.importRewriter.rewrite(content);
        
        res.setHeader('Content-Type', 'application/javascript');
        res.send(rewritten);
      } else {
        next();
      }
    });
    
    // Fallback to static serving for non-JS files
    this.app.use(servePath, express.static(pkg.srcPath));
  });
}
```

## Service Integration

### ResourceManager Integration

The framework uses ResourceManager singleton as the ONLY source of configuration:

```javascript
// In BaseServer.initialize()
async initialize() {
  // Get the singleton instance - NEVER create a new one
  this.resourceManager = ResourceManager.getInstance();
  await this.resourceManager.initialize();
  
  // Make ResourceManager available to all services and actors
  this.services.set('resourceManager', this.resourceManager);
  
  // Get configuration from ResourceManager
  const config = await this.getConfig();
  this.host = 'localhost';  // Always localhost
  this.monorepoRoot = config.monorepoRoot;
  
  // Initialize other services with ResourceManager
  await this.initializeServices();
}

async initializeServices() {
  // Pass ResourceManager to all services that need config
  const mongoProvider = new MongoDBProvider(this.resourceManager);
  const toolRegistry = new ToolRegistry(this.resourceManager);
  const llmClient = new LLMClient(this.resourceManager);
  
  // Services use ResourceManager for their config:
  // - Database URLs from env.MONGODB_URL
  // - API keys from env.OPENAI_API_KEY, etc.
  // - Feature flags from env.ENABLE_FEATURE_X
}
```

**ResourceManager Rules:**
1. **Singleton Only** - Use `ResourceManager.getInstance()`, never `new ResourceManager()`
2. **No process.env** - All environment access through `resourceManager.get('env.VARIABLE')`
3. **Centralized Config** - ResourceManager reads .env file once at startup
4. **Pass to Services** - All services receive ResourceManager for their configuration
5. **Consistent Access** - Same configuration interface across entire framework

### Actor Space Integration

Actor spaces are created per WebSocket connection and managed automatically:

```javascript
// In ActorSpaceManager.handleConnection()
const actorSpace = new ActorSpace(`conn-${Date.now()}`);
const channel = actorSpace.addChannel(ws);

// Plugins register their actors
this.plugins.forEach(plugin => {
  plugin.registerActors(actorSpace);
});
```

## Actor Protocol and Initialization

### Actor Protocol Overview

The Legion Server Framework implements a sophisticated actor-based communication protocol that automatically establishes bidirectional communication between client and server actors. The protocol is built on top of WebSockets and the Legion ActorSpace system, providing transparent message passing between actors across the network boundary.

### Initialization Sequence

The actor initialization follows a carefully orchestrated sequence that ensures both client and server actors are properly created, registered, and connected:

#### 1. Client Page Load
When a user navigates to a registered route (e.g., `/counter`), the server generates an HTML page with embedded JavaScript that:
- Imports the client actor module
- Imports the ActorSpace library from `/legion/actors/ActorSpace.js`
- Sets up WebSocket connection and actor initialization code

#### 2. Client-Side Initialization
```javascript
// Generated HTML template initializes the client:
1. Creates client actor instance: new ClientActor()
2. Creates client ActorSpace: new ActorSpace('client')
3. Registers actor: actorSpace.register(clientActor, 'client-root')
4. Establishes WebSocket: new WebSocket('ws://localhost:8080/ws')
5. On connection: creates channel via actorSpace.addChannel(ws)
```

#### 3. Server-Side Connection Handling
When the WebSocket connection is established:
```javascript
// ActorSpaceManager handles the connection:
1. Creates unique ActorSpace: new ActorSpace('server-timestamp-random')
2. Stores connection info with route extracted from query params
3. Sets up bidirectional ActorSpace channel immediately
4. Waits for handshake or creates actor based on route
```

#### 4. Actor Creation and Pairing
The framework supports two initialization modes:

**Automatic Mode (New Protocol):**
- Server creates actor immediately upon WebSocket connection
- Uses route from query parameters to select the correct factory
- Actor is registered in ActorSpace before any messages are exchanged
- Channel is established for bidirectional communication

**Handshake Mode (Legacy Compatibility):**
- Client sends explicit handshake message with actor GUID
- Server responds with acknowledgment containing server actor GUID
- Both sides create remote references to each other

### Actor Communication Protocol

Once initialized, actors communicate using the ActorSpace protocol:

#### Message Format
```javascript
// Actor-to-actor messages use the receive() method:
actor.receive(messageType, data)

// The ActorSpace handles serialization and transport:
{
  to: 'remote-actor-guid',
  from: 'local-actor-guid',
  type: 'actor_message',
  messageType: 'increment',
  data: { value: 1 }
}
```

#### Key Protocol Features

1. **Bidirectional Communication**: Both client and server actors can initiate messages
2. **Transparent Serialization**: ActorSpace handles JSON serialization/deserialization
3. **Remote References**: Actors hold references to remote actors as if they were local
4. **Type-Safe Messages**: Messages include type information for proper handling
5. **Error Propagation**: Errors in remote actors are propagated back to callers

### Actor Lifecycle

#### Creation
- **Server Actor**: Created via factory function on each WebSocket connection
- **Client Actor**: Created once when the page loads
- **Isolation**: Each connection gets its own server actor instance

#### Communication Methods
Actors implement standard methods for communication:

```javascript
class ServerActor {
  // Called by framework to set remote actor reference
  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
  }
  
  // Primary message handler (ActorSpace protocol)
  async receive(messageType, data) {
    // Process message and optionally respond
    const response = await this.processMessage(messageType, data);
    
    // Send response back through remote actor
    if (this.remoteActor && response) {
      this.remoteActor.receive(response.type, response);
    }
    
    return response;
  }
  
  // Alternative handler for compatibility
  async handle(message) {
    return this.receive(message.type, message.data);
  }
}
```

#### Cleanup
When a WebSocket connection closes:
1. ActorSpaceManager removes the connection from its registry
2. ActorSpace is destroyed, cleaning up all registered actors
3. Server actor instance is garbage collected
4. Resources are freed

### Implementation Details

#### Server-Side Actor Factory Pattern
The framework uses a factory pattern for server actors to ensure isolation:

```javascript
// Each connection gets a fresh actor instance
function createServerActor(services) {
  return {
    // Actor state is connection-specific
    state: { count: 0, users: [] },
    
    // Services are shared across all actors
    services: services,
    
    // Standard actor protocol methods
    receive(messageType, data) { /* ... */ },
    setRemoteActor(remote) { /* ... */ }
  };
}
```

#### Client-Side Actor Pattern
Client actors are ES6 modules that export a default class:

```javascript
export default class ClientActor {
  constructor() {
    // Initialize UI and state
  }
  
  setRemoteActor(remoteActor) {
    // Store reference and begin communication
    this.remoteActor = remoteActor;
    this.initialize();
  }
  
  receive(messageType, data) {
    // Handle server messages and update UI
  }
}
```

#### ActorSpace Channel Management
The ActorSpace manages WebSocket channels transparently:

1. **Channel Creation**: `actorSpace.addChannel(websocket)` creates bidirectional channel
2. **Remote References**: `channel.makeRemote(actorGuid)` creates remote actor proxy
3. **Message Routing**: ActorSpace routes messages based on actor GUIDs
4. **Serialization**: Automatic JSON serialization for network transport

### Protocol Advantages

1. **Simplicity**: Developers only implement actor logic, not networking code
2. **Type Safety**: Message types are preserved across network boundary
3. **Isolation**: Each connection is completely isolated with its own actors
4. **Scalability**: Factory pattern allows unlimited concurrent connections
5. **Debugging**: Clean separation between actor logic and transport layer

## WebSocket Protocol

### Root Actor Handshake

The framework uses a simple root actor pattern where each side has one root actor that manages sub-actors:

1. **Client connects** to `/ws` with route path
2. **Server creates** root server actor for that route
3. **Client sends** `actor_handshake` with root client actor GUID
4. **Server responds** with `actor_handshake_ack` containing root server actor GUID
5. **Root actors connected** - they handle their own sub-actor creation and delegation

### Message Format

```javascript
// Client handshake - just one root actor
{
  type: 'actor_handshake',
  clientRootActor: 'client-root-guid',
  route: '/tools'
}

// Server response - just one root actor
{
  type: 'actor_handshake_ack', 
  serverRootActor: 'server-root-guid'
}

// After handshake, root actors manage their own sub-actors
// Root actors can create child actors like:
// - ToolActor, DatabaseActor, SearchActor, etc.
// - And handle routing between them internally
```

### Root Actor Delegation Pattern

```javascript
class ServerRootActor extends Actor {
  constructor(services) {
    super();
    this.services = services;
    this.subActors = new Map();
  }
  
  async initialize() {
    // Root actor creates its own sub-actors
    this.subActors.set('tools', new ToolActor(this.services));
    this.subActors.set('database', new DatabaseActor(this.services));
    this.subActors.set('search', new SearchActor(this.services));
  }
  
  async handleMessage(message) {
    // Root actor routes messages to appropriate sub-actors
    const { target, ...payload } = message;
    const subActor = this.subActors.get(target);
    return subActor?.handleMessage(payload);
  }
}
```

## Usage Examples

### Creating a New Legion Application

```javascript
import { BaseServer } from '@legion/server-framework';
import { ServerToolActor } from './actors/ServerToolActor.js';
import { ServerDatabaseActor } from './actors/ServerDatabaseActor.js';

// Create server
const server = new BaseServer();

// Initialize with ResourceManager singleton
await server.initialize();

// Register routes with actor factories and client files
server.registerRoute(
  '/tools',
  (services) => new ServerToolActor(services),  // Factory function
  './client/ToolsClient.js',                     // Client actor file
  8090                                            // Port
);

server.registerRoute(
  '/database',
  (services) => new ServerDatabaseActor(services),
  './client/DatabaseClient.js'
  // Port defaults to 8080
);

// Start server
await server.start();
// Now visit http://localhost:8090/tools or http://localhost:8080/database
```

**Client Actor File Example (ToolsClient.js):**
```javascript
import { Actor } from '/legion/actors/Actor.js';

export default class ToolsClient extends Actor {
  constructor() {
    super();
    this.remoteActor = null;
  }
  
  setRemoteActor(remote) {
    this.remoteActor = remote;
    this.initialize();
  }
  
  async initialize() {
    // Set up UI, request initial data, etc.
    const tools = await this.remoteActor.send({ type: 'getTools' });
    this.renderTools(tools);
  }
  
  renderTools(tools) {
    // Render UI in #app div
  }
}
```

### Tool Registry Application

```javascript
import { BaseServer } from '@legion/server-framework';
import { createServerToolRegistryActor } from './actors/ServerToolRegistryActor.js';

const server = new BaseServer();
await server.initialize();

// Register with factory and client file
server.registerRoute(
  '/tools', 
  createServerToolRegistryActor,           // Factory function
  './client/ToolRegistryClient.js',        // Client file
  8090
);

await server.start();
// Now visit http://localhost:8090/tools to load the UI
```

### Gmail Package Integration

```javascript
import { BaseServer } from '@legion/server-framework';
import { createGmailServerActor } from '@legion/gmail/server';
// Client file is in the package
import { resolve } from 'path';

const server = new BaseServer();
await server.initialize();

// Add Gmail functionality
server.registerRoute(
  '/gmail',
  createGmailServerActor,
  resolve('@legion/gmail/client/GmailClient.js')
);

await server.start();
// Gmail UI now available at http://localhost:8080/gmail
```

### Migrating Existing Servers

Replace complex server setup with simple actor registration:

**Before (tool-registry-server):**
```javascript
// 200+ lines of Express setup, WebSocket handling, actor management...
```

**After:**
```javascript
import { BaseServer } from '@legion/server-framework';
import { ServerToolActor, ClientToolActor } from './actors/index.js';

const server = new BaseServer();
await server.initialize();
server.registerRoute('/tools', ServerToolActor, ClientToolActor, 8090);
await server.start();
```

## File Structure

```
packages/server-framework/
├── src/
│   ├── index.js                 # Main exports
│   ├── BaseServer.js            # Core server class with registerRoute()
│   ├── ActorSpaceManager.js     # Automatic WebSocket/actor management
│   ├── middleware/              # Standard middleware
│   │   ├── cors.js
│   │   ├── logging.js
│   │   └── errorHandler.js
│   ├── routes/
│   │   ├── health.js            # Health check endpoint
│   │   ├── actorRoutes.js       # Automatic actor serving
│   │   └── legionPackages.js    # /legion/* package serving
│   └── utils/
│       ├── config.js            # Configuration utilities
│       ├── actorSerializer.js   # Client actor serialization
│       ├── packageDiscovery.js  # Auto-discover Legion packages
│       ├── importRewriter.js    # Transform @legion/* imports
│       └── shutdown.js          # Graceful shutdown
├── docs/
│   └── DESIGN.md               # This document
└── package.json
```

## Benefits

### For Developers
- **Ultra-simple API** - Just `registerRoute(path, ServerActor, ClientActor)`
- **Zero boilerplate** - No Express setup, WebSocket handling, or actor management
- **Automatic everything** - File serving, actor pairing, message routing
- **Instant results** - Register a route and immediately have a working UI

### For Existing Applications
- **Massive code reduction** - 200+ lines becomes 3 lines
- **Eliminated complexity** - No manual WebSocket or actor space management
- **Standardized patterns** - All Legion apps work the same way
- **Easier maintenance** - Framework handles all the error-prone plumbing

### For New Applications  
- **Lightning-fast development** - Focus on actor logic, not infrastructure
- **Consistent architecture** - Every Legion app follows the same pattern
- **Built-in best practices** - CORS, logging, graceful shutdown automatic

### For the Legion Ecosystem
- **Actor pair ecosystem** - Reusable actor pairs across applications
- **One-line integration** - Add any Legion package with `registerRoute()`
- **Simplified deployment** - Standard server pattern for all apps

## Lessons Learned and Anti-Patterns

### 🎯 Key Insights from Implementation

#### 1. Configuration-Driven Development Works
**What we learned**: Moving from imperative server setup to declarative config files dramatically reduced complexity and bugs.

**Before**: 200+ lines of Express setup, WebSocket handling, static serving per app  
**After**: 10 lines of config, zero boilerplate, focus on actor logic

#### 2. Resource Provider Pattern Enables Modularity  
**What we learned**: Server actors providing their own resources through static methods follows Clean Architecture and enables customization without framework changes.

**Key insight**: The framework "asks" actors for customization (Hollywood Principle) rather than requiring global configuration.

#### 3. Handshake Protocol Must Be Bulletproof
**What we learned**: The "unknown local target GUID" errors were caused by bypassing or corrupting the ActorSpace handshake protocol.

**Critical fix**: DefaultResourceProvider must implement the EXACT handshake sequence from the working htmlTemplate.js.

#### 4. Flux Pattern Prevents Race Conditions
**What we learned**: Using async/await in actor `receive()` methods breaks the actor model and causes timing issues.

**Solution**: Immediate synchronous state updates with background asynchronous I/O operations.

#### 5. Message Passing for Data Loading
**What we learned**: Loading data synchronously in constructors blocks the entire system.

**Solution**: Load data asynchronously and notify clients via message passing when ready.

### 🚨 Anti-Patterns to Avoid

#### ❌ Anti-Pattern 1: Bypassing ActorSpace Protocol
```javascript
// ❌ NEVER DO THIS - Manual WebSocket handling breaks actor pairing
ws.onmessage = (event) => {
  // Direct message handling without ActorSpace
  this.handleMessage(JSON.parse(event.data));
};
```

#### ❌ Anti-Pattern 2: Async/Await in Actor Interfaces  
```javascript
// ❌ NEVER DO THIS - Breaks Flux pattern and causes race conditions
async receive(messageType, data) {
  const result = await this.database.save(data);
  this.updateState(result);
}
```

#### ❌ Anti-Pattern 3: Overriding Handshake JavaScript
```javascript
// ❌ NEVER DO THIS - Custom HTML that skips proper handshake
generateHTML() {
  return `<script>
    // Custom WebSocket code that doesn't follow handshake protocol
    const ws = new WebSocket('ws://localhost:8080/ws');
    ws.onopen = () => { /* custom logic */ };
  </script>`;
}
```

#### ❌ Anti-Pattern 4: Synchronous File I/O in Constructors
```javascript
// ❌ NEVER DO THIS - Blocks entire application startup
constructor() {
  this.data = fs.readFileSync('./data.json');  // Blocking
}
```

### ✅ Proven Patterns to Follow

#### ✅ Pattern 1: Configuration-First Development
```javascript
// ✅ ALWAYS DO THIS - Define apps declaratively
export default {
  name: 'my-app',
  routes: [{ 
    path: '/app', 
    serverActor: './ServerActor.js', 
    clientActor: './ClientActor.js' 
  }]
};
```

#### ✅ Pattern 2: Resource Provider with Delegation
```javascript  
// ✅ ALWAYS DO THIS - Delegate to default provider for standard resources
export class CustomResourceProvider extends ResourceProvider {
  async getResource(path, req) {
    switch (path) {
      case '/app/styles.css':
        return { content: myCustomCSS, contentType: 'text/css' };
      default:
        return this.defaultProvider.getResource(path, req); // Delegate
    }
  }
}
```

#### ✅ Pattern 3: Flux State Management with Background I/O
```javascript
// ✅ ALWAYS DO THIS - Immediate state updates, background persistence
receive(messageType, data) {
  // Synchronous state update
  this.state.items.push(data);
  this.notifyClients();
  
  // Background persistence  
  setImmediate(() => this.persistState());
}
```

#### ✅ Pattern 4: Message Passing for Data Loading
```javascript
// ✅ ALWAYS DO THIS - Load data asynchronously, notify when ready
setRemoteActor(remoteActor) {
  this.remoteActor = remoteActor;
  
  if (sharedState.initialized) {
    this.sendData(); // Data already loaded
  } else {
    loadData(); // Will notify all clients when ready
  }
}
```

## Production Considerations

### Performance Optimizations
1. **Connection pooling** - BaseServer reuses connections per port
2. **Resource caching** - DefaultResourceProvider caches generated HTML
3. **Memory management** - Proper cleanup on WebSocket disconnect

### Monitoring and Debugging  
1. **Actor lifecycle logging** - Handshake, connection, disconnection events
2. **Resource provider metrics** - Cache hits, generation time
3. **WebSocket connection health** - Connection count, message throughput

### Error Handling
1. **Graceful degradation** - Fallback to DefaultResourceProvider on errors
2. **Actor isolation** - One actor failure doesn't affect others  
3. **Resource validation** - MIME type validation, content sanitization

## Migration Path

### From Manual Express Setup
1. **Extract actor logic** from existing server code
2. **Create config file** defining routes and actors  
3. **Replace Express setup** with `legion-serve` CLI
4. **Add resource provider** for custom assets (optional)

### From Socket.IO Applications  
1. **Replace Socket.IO events** with actor `receive()` methods
2. **Convert to factory pattern** for server-side isolation
3. **Use Flux pattern** for state management
4. **Follow handshake protocol** for proper connection setup

## Implementation Complete

The Legion Server Framework has been successfully implemented with:
- ✅ **Configuration-driven development** via `legion-serve` CLI
- ✅ **Resource Provider architecture** following Clean Architecture
- ✅ **Fixed actor handshake protocol** preventing "unknown local target GUID" errors
- ✅ **Flux pattern state management** eliminating race conditions
- ✅ **Working examples** - todo app and counter demonstrating all patterns
- ✅ **Comprehensive documentation** - never debug these issues again