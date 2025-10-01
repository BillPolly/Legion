# Server Framework Architecture

## Overview

The Legion server framework provides a clean, actor-based architecture for building WebSocket applications with automatic Legion package serving and consistent client/server communication.

## Key Components

### 1. BaseServer

Core server that:
- Sets up HTTP and WebSocket servers
- Manages ActorSpaces for each port
- Serves static resources and Legion packages
- Handles connection lifecycle

### 2. ConfigurableActorServer

Configuration-driven server that:
- Takes a config object defining routes, actors, services
- Automatically loads and instantiates actors
- Supports custom space actors per route
- Provides clean separation between configuration and implementation

### 3. ActorSpace & Channel System

**ActorSpace**: Manages actors within a scope
- Registers actors with GUIDs
- Handles message serialization/deserialization
- Manages channels for communication

**Channel**: Wraps WebSocket connections
- Bridges ActorSpace to WebSocket
- Routes messages to registered actors
- Handles lifecycle events (connected, closed, error)

**Space Actor**: Optional actor that receives lifecycle events
- `channel_connected` - When channel opens
- `channel_closed` - When channel closes
- `channel_error` - On errors

### 4. Actor Communication Protocol

**NEW PROTOCOL (Server Sends First):**

1. Client creates ActorSpace with 'client-root' actor
2. Client creates Channel with WebSocket (BEFORE WebSocket opens!)
3. WebSocket connects
4. Server receives connection, creates Channel with space actor
5. Server's space actor receives `channel_connected` event
6. Space actor creates session actor and sends `session-ready` to client
7. Client receives `session-ready` and can start communicating

**Critical Timing:** Client MUST create Channel before WebSocket opens, or first message will be lost!

## Import Map System

### Browser Code Uses `@legion/...` Imports

```javascript
import { ActorSpace } from '@legion/actors';
import { Window } from '@legion/components';
```

### Import Map Maps to Server Routes

The HTML template includes an import map:

```html
<script type="importmap">
{
  "imports": {
    "@legion/actors": "/legion/actors/src/index.js",
    "@legion/actors/": "/legion/actors/src/",
    "@legion/components": "/legion/components/src/index.js",
    "@legion/components/": "/legion/components/src/"
  }
}
</script>
```

### Server Serves on `/legion/` Routes

BaseServer automatically discovers and serves Legion packages:
- Searches in `packages/shared/`, `packages/modules/`, `packages/frontend/`, etc.
- Serves with proper Content-Type headers
- Caches for performance

**See [IMPORT-MAP.md](./IMPORT-MAP.md) for full details.**

## Configuration Example

```javascript
import { createConfigurableServer } from '@legion/server-framework';

const server = await createConfigurableServer({
  name: 'MyApp',
  port: 8080,
  routes: [{
    path: '/app',
    serverActor: './ServerActor.js',      // Session actor factory
    clientActor: './ClientActor.js',      // Client-side actor
    spaceActor: './SpaceActor.js',        // Optional space actor
    title: 'My Application'
  }],
  services: {
    myService: './services/MyService.js'
  },
  static: {
    '/assets': './public/assets'
  }
});

await server.start();
```

## Actor Types

### Session Actor (serverActor)
- Created per WebSocket connection
- Handles user session logic
- Receives messages from client
- Can store session state

### Client Actor (clientActor)
- Runs in browser
- Handles UI interactions
- Sends messages to server
- Receives `session-ready` to get server actor ID

### Space Actor (spaceActor) - Optional
- Receives lifecycle events
- Can manage multiple sessions
- Controls connection setup
- Default implementation provided if not specified

## Directory Structure

```
server-framework/
├── src/
│   ├── BaseServer.js           # Core server
│   ├── ConfigurableActorServer.js  # Config-driven server
│   ├── htmlTemplate.js         # HTML generation with import map
│   └── config.js               # Config utilities
├── docs/
│   ├── ARCHITECTURE.md         # This file
│   ├── IMPORT-MAP.md           # Import map system
│   └── PROTOCOL.md             # Communication protocol
└── __tests__/
    ├── unit/                   # Unit tests
    └── integration/            # Integration tests
```

## Best Practices

### 1. Always Create Channel Before WebSocket Opens

```javascript
// CORRECT
const ws = new WebSocket(url);
const channel = actorSpace.addChannel(ws, spaceActor);
await new Promise(resolve => ws.on('open', resolve));

// WRONG - First message will be lost!
const ws = new WebSocket(url);
await new Promise(resolve => ws.on('open', resolve));
const channel = actorSpace.addChannel(ws, spaceActor);
```

### 2. Use @legion/... Imports in Browser Code

```javascript
// CORRECT - Works with import map
import { ActorSpace } from '@legion/actors';

// WRONG - Hard-coded server path
import { ActorSpace } from '/legion/actors/src/ActorSpace.js';
```

### 3. Space Actor is Optional

If you don't provide a space actor, a default one is created that:
- Creates session actor on `channel_connected`
- Sends `session-ready` to client
- Cleans up on `channel_closed`

### 4. Session Actors are Stateful

Each connection gets its own session actor instance:
- Store user-specific state
- Track connection-specific data
- Clean up in destructor if needed

## Testing

**Test Structure:**
- Unit tests: Mock-free, test individual components
- Integration tests: Real HTTP/WebSocket, no mocks
- E2E tests: Full browser testing (when needed)

**Key Test Files:**
- `BaseServer.test.js` - Core server functionality
- `ConfigurableActorServer.test.js` - Config-driven setup
- `htmlTemplate.test.js` - HTML generation and import map
- `LegionComponentServing.test.js` - Package serving

## Migration from Old System

**Old (ActorSpaceManager):**
```javascript
const manager = new ActorSpaceManager(actorSpace);
manager.handleConnection(ws, route);
```

**New (Direct ActorSpace):**
```javascript
const spaceActor = createMySpaceActor();
const channel = actorSpace.addChannel(ws, spaceActor);
// Space actor receives channel_connected automatically
```

## Troubleshooting

### Messages Not Received

1. Check client creates Channel BEFORE awaiting WebSocket open
2. Verify actor is registered with correct GUID
3. Check console logs for routing errors

### Import Map Not Working

1. Verify import map is in HTML template
2. Check package exists at `/legion/[package]/src/index.js`
3. Check browser console for 404 errors

### Actor Not Found

1. Check actor is registered in ActorSpace
2. Verify GUID matches between send/receive
3. Check serialization isn't changing GUID
