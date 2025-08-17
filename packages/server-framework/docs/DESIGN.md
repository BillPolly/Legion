# Legion Server Framework Design Document

## Overview

The Legion Server Framework provides a reusable foundation for creating Legion applications with standardized Express + WebSocket servers and automatic actor-based communication. The framework eliminates boilerplate by automatically handling the connection between server-side and client-side actors.

## Problem Statement

Currently, Legion applications (tool-registry-ui, tool-registry-server, aiur-ui) duplicate significant server setup code:

- Express app configuration with similar middleware stacks
- WebSocket server setup with actor space management
- Static file serving with `/legion/packagename` patterns
- Manual actor pairing and message routing
- Service initialization (ResourceManager, ToolRegistry, etc.)
- Health check and API route patterns
- Graceful shutdown handling

This duplication makes it difficult to maintain consistency and adds complexity for developers who just want to create actor pairs.

## Solution Architecture

### Core Philosophy

The framework follows a **"route + actor pair"** philosophy where developers simply register:

1. **Route path** (where the application lives, e.g., `/tools`)
2. **Server actor factory** (function that creates a new server actor per connection)
3. **Client actor file path** (JavaScript file that exports the client actor as default)
4. **Port** (optional, defaults to 8080)

The framework automatically:
- Generates HTML pages with the client actor script and WebSocket handling
- Creates a new server actor instance for each connection using the factory
- Serves the client actor JavaScript file
- Handles WebSocket connection and actor pairing

### Core Components

#### 1. BaseServer Class

The `BaseServer` class provides the foundational Express + WebSocket server with a simplified API:

```javascript
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

## Implementation Notes

### MVP Scope
This design focuses on the core "route + actor pair" pattern. The framework should:
- Handle actor serving and pairing automatically
- Provide the simplest possible developer interface
- Work with existing Legion actor patterns
- Support the current tool-registry and aiur-ui use cases

### Key Simplifications
- **No complex plugins** - Just direct actor registration
- **No manual WebSocket handling** - Framework does it all
- **No Express route setup** - Automatic from actor registration
- **No actor space management** - Handled transparently

### Development Path
1. Create BaseServer with `registerRoute()` method
2. Implement automatic client actor serving
3. Implement automatic server actor creation and pairing
4. Add `/legion/*` package serving
5. Migrate existing servers to validate the approach