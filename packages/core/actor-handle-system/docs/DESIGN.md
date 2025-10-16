# Actor-Handle System Integration Design

## Executive Summary

This document describes how to integrate Legion's **existing** Actor and Handle systems into a unified framework. Most of the infrastructure already exists - the main work is connecting pieces and filling small gaps.

**Key Discovery**: Handle already extends Actor (`packages/shared/data/handle/src/Handle.js:24`), providing the architectural bridge we need.

## What Already Exists (DO NOT REWRITE)

### ✅ Handle System (Fully Implemented)

**Location**: `/packages/shared/data/handle/src/`

1. **Handle.js** - Base class that extends Actor
   - Line 24: `export class Handle extends Actor`
   - Line 29: Validates DataSource using `validateDataSourceInterface()`
   - Takes DataSource in constructor, delegates all operations to it
   - Provides query(), subscribe(), value() interface
   - Actor receive() method handles remote calls (lines 95-123)
   - Query combinators: where(), select(), join(), orderBy(), limit(), etc.

2. **DataSource.js** - Complete interface definition
   - `DataSourceInterface` - documents required methods
   - `validateDataSourceInterface()` - validates implementations
   - `DataSourceTemplate` - reference implementation pattern
   - `DataSourceUtils` - helper functions
   - All operations MUST be synchronous (documented extensively)

3. **SimpleObjectDataSource.js** - Working implementation example

### ✅ DataSource Implementations (Already Exist)

**Location**: `/packages/resource-manager/src/datasources/`

All these DataSources already implement the DataSource interface:
- `MongoDataSource.js` - MongoDB access
- `QdrantDataSource.js` - Qdrant vector store
- `Neo4jDataSource.js` - Neo4j graph database
- `FileDataSource.js` - Filesystem access
- `ServiceDataSource.js` - Generic service wrapper
- `ConfigDataSource.js` - Configuration access
- `NomicDataSource.js` - Nomic embeddings
- `StrategyDataSource.js` - Strategy pattern wrapper

**Action**: Review these to ensure they properly implement the DataSource interface. Update if needed, but don't rewrite.

### ✅ Actor System (Fully Implemented)

**Location**: `/packages/shared/actors/src/`

1. **Actor.js** - Base actor class with receive() method
2. **ActorSpace.js** - Actor lifecycle and communication
   - spawn() - register actors
   - connect() - client-side connection
   - listen() - server-side connections
   - Channel-based message routing
3. **Channel.js** - WebSocket message handling
   - Message chunking for large payloads
   - Lifecycle events (connected, error, closed)
4. **RemoteActor.js** - Proxy for remote actors
   - Creates placeholder with channel and GUID
   - receive() sends messages and awaits responses

**Action**: NO changes needed to actor system. Use as-is.

### ✅ Existing Handle Implementations

**MongoDB** (`/packages/data-sources/mongodb/src/handles/`):
- MongoServerHandle.js
- MongoDatabaseHandle.js
- MongoCollectionHandle.js

**Qdrant** (`/packages/resource-manager/src/handles/`):
- QdrantHandle.js

**Action**: Review to ensure they extend Handle and use DataSource properly. Update if needed.

## What Needs To Be Created (Minimal New Code)

### 1. DeclarativeActor (New - Shared Package)

**Location**: `/packages/shared/actors/src/DeclarativeActor.js`

**Purpose**: Protocol-based actors that work on both frontend and backend (like declarative-components).

**Why Needed**: ConfigurableActorServer needs a way to create actors from JSON configuration. Frontend needs the same for UI state actors.

**Implementation**:
```javascript
import { Actor } from './Actor.js';

export class DeclarativeActor extends Actor {
  constructor(protocol) {
    super();
    this.protocol = protocol;
    this.state = this._initializeState(protocol.state || {});
  }

  _initializeState(stateConfig) {
    const state = {};
    for (const [key, config] of Object.entries(stateConfig.schema || {})) {
      state[key] = config.default !== undefined ? config.default : null;
    }
    return state;
  }

  async receive(messageType, data) {
    const messageSpec = this.protocol.messages?.receives?.[messageType];
    if (!messageSpec) {
      throw new Error(`Unknown message type: ${messageType}`);
    }

    // Execute action if specified
    if (messageSpec.action) {
      await this._executeAction(messageSpec.action, data);
    }

    // Return result if specified
    if (messageSpec.returns) {
      return this._evaluateExpression(messageSpec.returns, data);
    }
  }

  _executeAction(actionString, data) {
    const fn = new Function('state', 'data', actionString);
    return fn(this.state, data);
  }

  _evaluateExpression(expression, data) {
    const fn = new Function('state', 'data', `return ${expression}`);
    return fn(this.state, data);
  }

  getProtocol() {
    return this.protocol;
  }
}
```

**Protocol Example**:
```javascript
{
  name: 'CounterActor',
  state: {
    schema: {
      count: { type: 'number', default: 0 }
    }
  },
  messages: {
    receives: {
      'increment': {
        action: 'state.count++',
        returns: 'state.count'
      },
      'get-count': {
        returns: 'state.count'
      }
    }
  }
}
```

### 2. ActorRegistry (New - Backend Package)

**Location**: `/packages/core/actor-handle-system/src/ActorRegistry.js`

**Purpose**: Manage actor definitions and instances on the backend. Integrate with ResourceManager.

**Why Needed**: ConfigurableActorServer needs centralized actor management. This provides the registry pattern.

**Implementation**:
```javascript
import { DeclarativeActor } from '@legion/actors';

export class ActorRegistry {
  constructor() {
    this.definitions = new Map();  // actorId -> { type, config }
    this.instances = new Map();    // actorId -> actor instance
  }

  // Register actor type
  register(actorId, definition) {
    if (typeof definition === 'function') {
      // Class-based actor
      this.definitions.set(actorId, { type: 'class', class: definition });
    } else if (definition.protocol) {
      // Declarative actor
      this.definitions.set(actorId, { type: 'declarative', protocol: definition.protocol });
    } else {
      throw new Error('Invalid actor definition');
    }
  }

  // Create instance from registered type
  spawn(actorId, config = {}) {
    const def = this.definitions.get(actorId);
    if (!def) throw new Error(`Actor not registered: ${actorId}`);

    let instance;
    if (def.type === 'class') {
      instance = new def.class(config);
    } else if (def.type === 'declarative') {
      instance = new DeclarativeActor(def.protocol);
    }

    this.instances.set(actorId, instance);
    return instance;
  }

  // Get existing instance
  get(actorId) {
    return this.instances.get(actorId);
  }

  // List registered types
  listTypes() {
    return Array.from(this.definitions.keys());
  }

  // List active instances
  listInstances() {
    return Array.from(this.instances.keys());
  }

  // Destroy instance
  destroy(actorId) {
    this.instances.delete(actorId);
  }
}
```

### 3. Update ResourceManager (Adapt Existing)

**Location**: `/packages/resource-manager/src/ResourceManager.js`

**Current State**: Singleton with service initialization and Proxy-based access.

**Changes Needed**:
1. Make ResourceManager extend Handle
2. Add ActorRegistry instance
3. Provide actor() accessor
4. Keep all existing functionality

**Minimal Changes**:
```javascript
import { Handle } from '@legion/handle';
import { ActorRegistry } from '@legion/actor-handle-system';

export class ResourceManager extends Handle {
  static _instance = null;

  constructor() {
    // Create a simple DataSource for ResourceManager itself
    const dataSource = {
      query: (querySpec) => {
        // Query available services/resources
        return this._queryResources(querySpec);
      },
      subscribe: (querySpec, callback) => {
        // Subscribe to resource changes
        return this._subscribeResources(querySpec, callback);
      },
      getSchema: () => {
        return { type: 'ResourceManager', resources: Object.keys(this._services) };
      },
      queryBuilder: (sourceHandle) => {
        // Return basic query builder
        return this._createQueryBuilder(sourceHandle);
      }
    };

    super(dataSource);

    // Existing ResourceManager initialization
    this._services = new Map();
    this._handleCache = new Map();
    this._config = null;

    // NEW: Add actor registry
    this._actorRegistry = new ActorRegistry();
  }

  // NEW: Actor accessor
  get actors() {
    return this._actorRegistry;
  }

  // Keep all existing methods...
  static async getInstance() { /* existing */ }
  async initialize() { /* existing */ }
  get(key) { /* existing */ }
  // ... etc
}
```

### 4. RemoteHandle Convenience Wrapper (New - Shared)

**Location**: `/packages/shared/data/handle/src/RemoteHandle.js`

**Purpose**: Make it easier to use RemoteActors as if they were Handles.

**Why Needed**: Frontend code can use familiar Handle interface (query, subscribe) instead of raw actor messages.

**Implementation**:
```javascript
import { RemoteActor } from '@legion/actors';

export class RemoteHandle {
  constructor(actorSpace, guid) {
    this._actorSpace = actorSpace;
    this._guid = guid;
    this._remoteActor = actorSpace.makeRemote(guid);
  }

  async query(querySpec) {
    return this._remoteActor.receive({ type: 'query', querySpec });
  }

  async subscribe(querySpec, callback) {
    return this._remoteActor.receive({ type: 'subscribe', querySpec, callback });
  }

  async value() {
    return this._remoteActor.receive({ type: 'value' });
  }

  // Pass through any other method calls
  async call(method, ...args) {
    return this._remoteActor.receive({ type: 'remote-call', method, args });
  }
}
```

## Package Structure (Mostly Exists)

### Backend Packages

```
packages/core/
├── resource-manager/          ✅ EXISTS (needs small update)
│   ├── src/
│   │   ├── ResourceManager.js        (UPDATE: extend Handle, add actors property)
│   │   ├── datasources/              ✅ EXISTS - review only
│   │   │   ├── MongoDataSource.js
│   │   │   ├── QdrantDataSource.js
│   │   │   └── ... (7 more exist)
│   │   └── handles/                  ✅ EXISTS - review only
│   │       └── QdrantHandle.js
│   └── package.json

├── actor-handle-system/       🆕 NEW (minimal package)
│   ├── src/
│   │   └── ActorRegistry.js          (NEW: ~80 lines)
│   ├── docs/
│   │   └── DESIGN.md                 (this document)
│   └── package.json
```

### Data Source Packages

```
packages/data-sources/
├── mongodb/                   ✅ EXISTS
│   ├── src/
│   │   ├── handles/                  ✅ EXISTS - review only
│   │   │   ├── MongoServerHandle.js
│   │   │   ├── MongoDatabaseHandle.js
│   │   │   └── MongoCollectionHandle.js
│   │   └── datasources/              (check if exists, create if needed)
│   │       └── MongoDataSource.js
│   └── package.json
```

### Shared Packages

```
packages/shared/
├── actors/                    ✅ EXISTS (needs one addition)
│   ├── src/
│   │   ├── Actor.js                  ✅ EXISTS
│   │   ├── ActorSpace.js             ✅ EXISTS
│   │   ├── Channel.js                ✅ EXISTS
│   │   ├── RemoteActor.js            ✅ EXISTS
│   │   └── DeclarativeActor.js       🆕 NEW (~60 lines)
│   └── package.json

└── data/handle/               ✅ EXISTS (needs one addition)
    ├── src/
    │   ├── Handle.js                 ✅ EXISTS
    │   ├── DataSource.js             ✅ EXISTS
    │   ├── SimpleObjectDataSource.js ✅ EXISTS
    │   └── RemoteHandle.js           🆕 NEW (~30 lines)
    └── package.json
```

## Usage Patterns

### Backend: Using ActorRegistry with ResourceManager

```javascript
// Server setup
const rm = await ResourceManager.getInstance();

// Register declarative actor
rm.actors.register('counter', {
  protocol: {
    state: { schema: { count: { type: 'number', default: 0 } } },
    messages: {
      receives: {
        'increment': { action: 'state.count++', returns: 'state.count' }
      }
    }
  }
});

// Spawn instance
const counter = rm.actors.spawn('counter');
await counter.receive('increment');  // Returns 1

// Register in ActorSpace for remote access
const actorSpace = new ActorSpace();
actorSpace.spawn(() => counter, 'counter-actor');
await actorSpace.listen(8080, () => new ServerSpaceActor());
```

### Frontend: Using RemoteHandle

```javascript
// Frontend connects to backend
const actorSpace = new ActorSpace();
await actorSpace.connect(clientActor, 'ws://localhost:8080/ws');

// Access remote actor via RemoteHandle
const remoteCounter = new RemoteHandle(actorSpace, 'counter-actor');
const count = await remoteCounter.call('receive', 'increment');

// Or use RemoteActor directly (existing pattern)
const remoteActor = actorSpace.makeRemote('counter-actor');
await remoteActor.receive('increment');
```

### Frontend: Local Declarative Actors

```javascript
// Frontend can create local actors for UI state
import { DeclarativeActor } from '@legion/actors';

const uiState = new DeclarativeActor({
  name: 'UIStateActor',
  protocol: {
    state: {
      schema: {
        activeTab: { type: 'string', default: 'home' },
        sidebarOpen: { type: 'boolean', default: true }
      }
    },
    messages: {
      receives: {
        'switch-tab': { action: 'state.activeTab = data.tab', returns: 'state.activeTab' },
        'toggle-sidebar': { action: 'state.sidebarOpen = !state.sidebarOpen', returns: 'state.sidebarOpen' }
      }
    }
  }
});

await uiState.receive('switch-tab', { tab: 'profile' });
await uiState.receive('toggle-sidebar');
```

## Integration with ConfigurableActorServer

ConfigurableActorServer can now use ActorRegistry to manage actors from configuration:

```javascript
// Server configuration
const config = {
  actors: {
    'counter': {
      protocol: {
        state: { schema: { count: { type: 'number', default: 0 } } },
        messages: {
          receives: {
            'increment': { action: 'state.count++', returns: 'state.count' }
          }
        }
      }
    },
    'root-server': {
      class: RootServerActor,
      services: ['llm', 'mongodb']
    }
  }
};

// Server initialization
const rm = await ResourceManager.getInstance();

// Register actors from config
for (const [actorId, config] of Object.entries(config.actors)) {
  rm.actors.register(actorId, config);
}

// Spawn and register in ActorSpace
for (const actorId of rm.actors.listTypes()) {
  const actor = rm.actors.spawn(actorId);
  actorSpace.spawn(() => actor, actorId);
}
```

## Summary of Work Required

### New Files (Minimal)
1. `/packages/shared/actors/src/DeclarativeActor.js` (~60 lines)
2. `/packages/core/actor-handle-system/src/ActorRegistry.js` (~80 lines)
3. `/packages/shared/data/handle/src/RemoteHandle.js` (~30 lines)

**Total new code: ~170 lines**

### Existing Files to Update
1. `/packages/resource-manager/src/ResourceManager.js`
   - Make it extend Handle
   - Add ActorRegistry instance
   - Add actors property accessor
   - Keep all existing functionality
   - **Estimated: 20-30 lines changed/added**

### Existing Files to Review (No Rewrite)
1. All DataSource implementations in `/packages/resource-manager/src/datasources/`
   - Verify they implement DataSource interface correctly
   - Update only if interface not properly implemented
2. Existing Handle implementations (MongoDB, Qdrant)
   - Verify they extend Handle and use DataSource
   - Update only if not following pattern

## Key Design Principles

1. **Reuse First, Create Last**: 90% of the infrastructure already exists
2. **Minimal Changes**: Only add what's absolutely necessary
3. **No Rewrites**: Existing code works - adapt, don't replace
4. **Consistent Patterns**: Follow existing patterns (Handle extends Actor, DataSource interface)
5. **Shared = Universal**: DeclarativeActor works on frontend and backend (like declarative-components)

## Testing Strategy

1. **Unit Tests**:
   - DeclarativeActor protocol execution
   - ActorRegistry register/spawn/get operations
   - RemoteHandle message proxying

2. **Integration Tests**:
   - ResourceManager with ActorRegistry
   - Handle as Actor in ActorSpace
   - DeclarativeActor in ActorSpace
   - Frontend RemoteHandle to backend Handle

3. **E2E Tests**:
   - ConfigurableActorServer with declarative actors
   - Frontend-backend actor communication
   - Full handle hierarchy (ResourceManager -> Mongo -> Collection)

Use real services (MongoDB, Qdrant) from .env. NO MOCKS for main functionality. FAIL FAST on errors.
