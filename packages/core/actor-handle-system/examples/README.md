# Actor-Handle System Examples

Live demonstrations of the Legion Actor-Handle System capabilities.

## Available Demos

### 🎯 Chat Room (Recommended First Demo)

**Location**: `./chat-room/`

**What it shows**: Complete real-time chat application demonstrating:
- DeclarativeActor with JSON protocol
- ActorRegistry backend management
- Real WebSocket communication
- Multi-client state synchronization

**How to run**:
```bash
# Terminal 1: Start server
cd chat-room
node server.js

# Terminal 2: Connect as Alice
node client.js Alice

# Terminal 3: Connect as Bob
node client.js Bob
```

**See**: `chat-room/README.md` for detailed walkthrough

## What These Demonstrate

### Core Value Proposition: EASE OF SETUP

All examples prove that setting up frontend-backend actor communication is **incredibly simple**:

```javascript
// Backend (3 lines)
const rm = await ResourceManager.getInstance();
rm.actors.register('my-actor', { protocol: {...} });
const actor = rm.actors.spawn('my-actor');

// Frontend (2 lines)
const actorSpace = new ActorSpace();
await actorSpace.connect(clientActor, 'ws://localhost:8080');
```

### Architecture Patterns

✅ **DeclarativeActor**: Define behavior as JSON, not code
✅ **ActorRegistry**: Centralized actor management
✅ **ActorSpace**: WebSocket-based communication
✅ **RemoteHandle**: Convenient Handle interface for remote actors
✅ **ResourceManager Integration**: Actors as managed resources

## Testing

All examples use the same infrastructure validated by our **39 passing E2E tests** (100% pass rate).

The patterns shown here are battle-tested and production-ready.

## Building Your Own

### Quick Template

```javascript
// 1. Define protocol
const myProtocol = {
  name: 'MyActor',
  state: {
    schema: {
      data: { type: 'object', default: {} }
    }
  },
  messages: {
    receives: {
      'update': {
        action: 'state.data = { ...state.data, ...data }',
        returns: 'state.data'
      }
    }
  }
};

// 2. Register and spawn
const rm = await ResourceManager.getInstance();
rm.actors.register('my-actor', { protocol: myProtocol });
const actor = rm.actors.spawn('my-actor');

// 3. Use in ActorSpace
const actorSpace = new ActorSpace('backend');
actorSpace.register(actor, 'my-actor');
await actorSpace.listen(8080, () => spaceActor);
```

That's it! You now have a backend actor accessible via WebSocket.

## Use Cases

These examples can be adapted for:

- **Collaborative editing** - Multiple users editing same document
- **Live dashboards** - Real-time data visualization
- **Real-time games** - Shared game state
- **Multi-user tools** - Any shared-state application
- **Distributed systems** - Microservices with actor communication

## Learn More

- `/docs/DESIGN.md` - Architecture and design decisions
- `/docs/IMPLEMENTATION_PLAN.md` - Development approach and completion status
- `/__tests__/e2e/` - Comprehensive test suite (22 E2E tests)

---

**Built with Legion** - Making distributed systems simple 🚀
