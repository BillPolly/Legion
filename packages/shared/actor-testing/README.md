# @legion/actor-testing

Comprehensive testing framework for Actor-based systems in the Legion framework. Provides mocks, harnesses, utilities, and automated protocol testing for building robust actor communication tests.

## Features

- ✅ **MockWebSocket** - Full-featured WebSocket mock with event support
- ✅ **ActorTestHarness** - Integrated server+client testing environment
- ✅ **JSDOM Integration** - Browser environment simulation for client-side actors
- ✅ **Protocol Testing** - Automated test generation for ProtocolActor implementations
- ✅ **Test Data Generators** - Smart data generation from JSON schemas
- ✅ **Paired Communication** - Bidirectional WebSocket testing out of the box

## Installation

```bash
npm install --save-dev @legion/actor-testing
```

## Quick Start

### Basic Actor Testing with MockWebSocket

```javascript
import { MockWebSocket } from '@legion/actor-testing';

test('should send and receive messages', async () => {
  // Create paired WebSockets
  const { clientWs, serverWs } = MockWebSocket.createPair();

  // Setup message handler
  clientWs.addEventListener('message', (event) => {
    console.log('Client received:', event.data);
  });

  // Send from server to client
  serverWs.send('Hello from server!');

  // Check what was sent
  expect(serverWs.getSentMessages()).toContain('Hello from server!');
});
```

### Full Integration Testing with ActorTestHarness

```javascript
import { ActorTestHarness } from '@legion/actor-testing';
import { MyServerActor } from './MyServerActor.js';
import { MyClientActor } from './MyClientActor.js';

describe('Client-Server Communication', () => {
  let harness;

  beforeEach(async () => {
    harness = new ActorTestHarness({
      serverActor: MyServerActor,
      clientActor: MyClientActor,
      useDom: true  // Enable browser environment
    });
    await harness.setup();
  });

  afterEach(async () => {
    await harness.teardown();
  });

  test('should handle full request/response cycle', async () => {
    // Send message from client
    const response = await harness.clientSend('request', { data: 'test' });

    // Verify response
    expect(response.success).toBe(true);

    // Check message history
    const sentMessages = harness.getClientSentMessages();
    expect(sentMessages.length).toBeGreaterThan(0);
  });
});
```

### Protocol Testing with ProtocolTestSuite

```javascript
import { ProtocolTestSuite } from '@legion/actor-testing';
import { ProtocolActor } from '@legion/actors';

// Define your protocol actor
class ChatActor extends ProtocolActor {
  getProtocol() {
    return {
      name: 'ChatActor',
      version: '1.0.0',
      state: {
        schema: {
          connected: { type: 'boolean', required: true },
          username: { type: 'string', required: false }
        },
        initial: {
          connected: false,
          username: null
        }
      },
      messages: {
        receives: {
          'connect': {
            schema: {
              username: { type: 'string', required: true }
            },
            preconditions: ['state.connected === false'],
            postconditions: ['state.connected === true']
          },
          'send-message': {
            schema: {
              message: { type: 'string', required: true }
            },
            preconditions: ['state.connected === true']
          }
        },
        sends: {
          'message': {
            schema: {
              from: { type: 'string', required: true },
              text: { type: 'string', required: true }
            },
            preconditions: ['state.connected === true']
          }
        }
      }
    };
  }

  handleMessage(messageType, data) {
    switch (messageType) {
      case 'connect':
        this.state.connected = true;
        this.state.username = data.username;
        return { success: true };
      case 'send-message':
        return { success: true, sent: true };
      default:
        throw new Error(`Unknown message: ${messageType}`);
    }
  }

  doSend(messageType, data) {
    // Implementation for sending messages
    return Promise.resolve({ sent: true });
  }
}

// Auto-generate comprehensive test suite
ProtocolTestSuite.generateTests(ChatActor, {
  includeIntegrationTests: true,
  testPostconditions: true
});
```

This automatically generates tests for:
- Protocol structure validation
- State management
- Message schema validation
- Preconditions and postconditions
- Complete message flows

## API Reference

### MockWebSocket

Full-featured WebSocket mock supporting all WebSocket APIs.

```javascript
const ws = new MockWebSocket('ws://test', [], {
  autoConnect: true,
  connectionDelay: 10,
  sendDelay: 0
});

// Event handling
ws.addEventListener('open', () => console.log('Connected'));
ws.addEventListener('message', (event) => console.log(event.data));

// Send messages
ws.send('Hello!');

// Simulate receiving
ws.simulateMessage('Incoming message');

// Get sent messages
const sent = ws.getSentMessages();

// Create paired WebSockets
const { clientWs, serverWs } = MockWebSocket.createPair();
```

**Options:**
- `autoConnect` - Auto-simulate connection (default: true)
- `connectionDelay` - Delay before connection in ms (default: 10)
- `sendDelay` - Delay when sending to partner (default: 0)
- `closeDelay` - Delay when closing (default: 10)

### ActorTestHarness

Comprehensive testing environment for Actor systems.

```javascript
const harness = new ActorTestHarness({
  serverActor: ServerActorClass,
  clientActor: ClientActorClass,
  serverActorOptions: { /* options */ },
  clientActorOptions: { /* options */ },
  useDom: true,
  domOptions: { /* JSDOM options */ }
});

await harness.setup();

// Send messages
await harness.clientSend('message-type', { data });
await harness.serverSend('message-type', { data });

// Access components
harness.serverActor
harness.clientActor
harness.serverSpace
harness.clientSpace

// Get sent messages
harness.getServerSentMessages()
harness.getClientSentMessages()

// DOM access (if useDom: true)
harness.getDocument()
harness.getWindow()
harness.querySelector('#my-element')

// Utilities
await harness.wait(100)
await harness.waitFor(() => condition, 1000)

await harness.teardown();
```

### JSDOMEnvironment

Standalone JSDOM environment for browser testing.

```javascript
import { JSDOMEnvironment } from '@legion/actor-testing';

const env = new JSDOMEnvironment({
  html: '<div id="app"></div>',
  url: 'http://localhost:3000'
});

env.setup();

// Access DOM
const doc = env.getDocument();
const win = env.getWindow();

// Create elements
const button = env.createElement('button', {
  id: 'my-button',
  textContent: 'Click me'
});

// Simulate events
env.simulateClick(button);
env.simulateInput(input, 'test value');

env.teardown();
```

### TestDataGenerator

Generate test data from JSON schemas.

```javascript
import { TestDataGenerator } from '@legion/actor-testing';

const schema = {
  username: { type: 'string', minLength: 3, required: true },
  age: { type: 'integer', minimum: 0, maximum: 120 },
  email: { type: 'string', pattern: '^.+@.+$' }
};

// Generate valid data
const validData = TestDataGenerator.generateValidData(schema);
// { username: 'test-username', age: 42, email: 'test@example.com' }

// Generate invalid data
const invalidData = TestDataGenerator.generateInvalidData(schema);
// { username: 123, age: 42, email: 'test@example.com' } // wrong type

// Create mock actors
const mockActor = TestDataGenerator.createMockActor({
  receive: async (type, data) => ({ success: true, custom: 'value' })
});
```

### ProtocolTestSuite

Auto-generate comprehensive tests for ProtocolActor implementations.

```javascript
ProtocolTestSuite.generateTests(MyProtocolActorClass, {
  includeIntegrationTests: true,  // Test complete message flows
  testPostconditions: true         // Validate postconditions
});
```

**Generated Tests:**
- Protocol structure validation
- State schema validation
- Initial state verification
- Message schema validation (valid/invalid data)
- Precondition enforcement
- Postcondition validation
- Integration test flows

## Examples

### Example 1: Testing WebSocket Connection

```javascript
import { MockWebSocket } from '@legion/actor-testing';

test('WebSocket connection lifecycle', async () => {
  const ws = new MockWebSocket('ws://test');

  let connected = false;
  ws.addEventListener('open', () => { connected = true; });

  // Wait for connection
  await new Promise(resolve => setTimeout(resolve, 20));

  expect(connected).toBe(true);
  expect(ws.readyState).toBe(MockWebSocket.OPEN);

  ws.close();
  expect(ws.readyState).toBe(MockWebSocket.CLOSING);
});
```

### Example 2: Testing Bidirectional Communication

```javascript
import { ActorTestHarness } from '@legion/actor-testing';

test('bidirectional actor communication', async () => {
  class PingActor {
    async receive(type, data) {
      if (type === 'ping') {
        return { type: 'pong', data: data.value };
      }
    }
  }

  const harness = new ActorTestHarness({
    serverActor: PingActor,
    clientActor: PingActor
  });

  await harness.setup();

  const response = await harness.clientSend('ping', { value: 'test' });
  expect(response.type).toBe('pong');
  expect(response.data).toBe('test');

  await harness.teardown();
});
```

### Example 3: Testing with Browser DOM

```javascript
import { ActorTestHarness } from '@legion/actor-testing';

test('DOM manipulation in actor', async () => {
  class UIActor {
    constructor() {
      this.container = document.getElementById('app');
    }

    async receive(type, data) {
      if (type === 'render') {
        this.container.innerHTML = `<h1>${data.title}</h1>`;
        return { success: true };
      }
    }
  }

  const harness = new ActorTestHarness({
    clientActor: UIActor,
    useDom: true,
    domOptions: {
      html: '<div id="app"></div>'
    }
  });

  await harness.setup();

  await harness.clientSend('render', { title: 'Hello World' });

  const h1 = harness.querySelector('h1');
  expect(h1.textContent).toBe('Hello World');

  await harness.teardown();
});
```

### Example 4: Protocol Actor with Full Testing

```javascript
import { ProtocolActor } from '@legion/actors';
import { ProtocolTestSuite } from '@legion/actor-testing';

class TodoActor extends ProtocolActor {
  getProtocol() {
    return {
      name: 'TodoActor',
      version: '1.0.0',
      state: {
        schema: {
          todos: { type: 'array', required: true },
          filter: { type: 'string', required: true }
        },
        initial: {
          todos: [],
          filter: 'all'
        }
      },
      messages: {
        receives: {
          'add-todo': {
            schema: {
              text: { type: 'string', minLength: 1, required: true }
            },
            postconditions: ['state.todos.length > 0']
          },
          'set-filter': {
            schema: {
              filter: {
                type: 'string',
                enum: ['all', 'active', 'completed'],
                required: true
              }
            }
          }
        },
        sends: {
          'todo-added': {
            schema: {
              id: { type: 'string', required: true },
              text: { type: 'string', required: true }
            }
          }
        }
      }
    };
  }

  handleMessage(type, data) {
    switch (type) {
      case 'add-todo':
        const todo = { id: Date.now().toString(), text: data.text, completed: false };
        this.state.todos.push(todo);
        return { success: true, todo };

      case 'set-filter':
        this.state.filter = data.filter;
        return { success: true };

      default:
        throw new Error(`Unknown message: ${type}`);
    }
  }

  doSend(type, data) {
    // Implement sending logic
    return Promise.resolve({ sent: true });
  }
}

// Auto-generate all tests
ProtocolTestSuite.generateTests(TodoActor);
```

## Best Practices

### 1. Use ActorTestHarness for Integration Tests

```javascript
// ✅ Good - Full integration testing
const harness = new ActorTestHarness({
  serverActor: MyServerActor,
  clientActor: MyClientActor
});
await harness.setup();
// Test complete flows
await harness.teardown();

// ❌ Avoid - Manual setup is error-prone
const serverWs = new MockWebSocket('ws://server');
const clientWs = new MockWebSocket('ws://client');
// ... manual channel setup, etc.
```

### 2. Define Clear Protocols

```javascript
// ✅ Good - Well-defined protocol with schemas and conditions
getProtocol() {
  return {
    name: 'MyActor',
    version: '1.0.0',
    state: {
      schema: { connected: { type: 'boolean', required: true } },
      initial: { connected: false }
    },
    messages: {
      receives: {
        'connect': {
          schema: { token: { type: 'string', required: true } },
          preconditions: ['state.connected === false'],
          postconditions: ['state.connected === true']
        }
      }
    }
  };
}

// ❌ Avoid - Vague protocol without validation
getProtocol() {
  return {
    name: 'MyActor',
    version: '1.0.0',
    state: { schema: {}, initial: {} },
    messages: { receives: {}, sends: {} }
  };
}
```

### 3. Use ProtocolTestSuite for Comprehensive Coverage

```javascript
// ✅ Good - Auto-generated tests
ProtocolTestSuite.generateTests(MyActor, {
  includeIntegrationTests: true,
  testPostconditions: true
});

// ❌ Avoid - Manual testing of every message
test('should handle connect', () => { /* ... */ });
test('should validate connect schema', () => { /* ... */ });
test('should check connect preconditions', () => { /* ... */ });
// ... hundreds more tests
```

### 4. Clean Up Properly

```javascript
// ✅ Good - Always teardown
afterEach(async () => {
  await harness.teardown();
});

// ❌ Avoid - Leaving resources open
afterEach(() => {
  // Forgot to clean up!
});
```

## TypeScript Support

While this package is written in JavaScript, it works seamlessly with TypeScript:

```typescript
import { ActorTestHarness, MockWebSocket, ProtocolTestSuite } from '@legion/actor-testing';
import { ProtocolActor } from '@legion/actors';

interface MyActorState {
  connected: boolean;
  data: string | null;
}

class MyActor extends ProtocolActor {
  state!: MyActorState;

  getProtocol() {
    // ...
  }
}

const harness = new ActorTestHarness({
  serverActor: MyActor,
  clientActor: MyActor
});
```

## Troubleshooting

### WebSocket not connecting

```javascript
// Increase connection delay if needed
const harness = new ActorTestHarness({
  connectionDelay: 100  // More time for async operations
});

// Or manually wait
await harness.waitForConnections(1000);
```

### JSDOM errors

```javascript
// Ensure you setup JSDOM before accessing DOM
const harness = new ActorTestHarness({
  useDom: true  // Must be enabled!
});
await harness.setup();

// Or use standalone
const env = new JSDOMEnvironment();
env.setup();
// ... use DOM
env.teardown();
```

### Protocol validation failing

```javascript
// Check your protocol definition matches the schema
const validation = ProtocolActor.validateProtocol(myProtocol);
if (!validation.valid) {
  console.error('Protocol errors:', validation.errors);
}
```

## Contributing

Found a bug or have a feature request? Please open an issue on GitHub.

## License

MIT

## See Also

- [@legion/actors](../actors/README.md) - Core Actor system
- [@legion/schema](../schema/README.md) - JSON Schema validation
- [JSDOM](https://github.com/jsdom/jsdom) - JavaScript DOM implementation
