# @legion/actor-testing Architecture

## Overview

The `@legion/actor-testing` package provides a comprehensive testing framework for Actor-based systems in the Legion framework. It consolidates previously scattered testing utilities into a single, well-organized package.

## Package Structure

```
@legion/actor-testing/
├── src/
│   ├── mocks/
│   │   ├── MockWebSocket.js          # Full-featured WebSocket mock
│   │   └── index.js
│   ├── harness/
│   │   ├── ActorTestHarness.js       # Integrated test environment
│   │   └── index.js
│   ├── utils/
│   │   ├── JSDOMEnvironment.js       # Browser environment simulation
│   │   ├── TestDataGenerator.js      # Schema-based data generation
│   │   └── index.js
│   ├── ProtocolTestSuite.js          # Auto-test generation
│   └── index.js                      # Main exports
├── examples/
│   └── ChatActor.example.test.js     # Complete usage example
├── package.json
├── README.md
└── ARCHITECTURE.md (this file)
```

## Components

### 1. MockWebSocket

**Purpose:** Provide a complete WebSocket mock for testing without real network connections.

**Key Features:**
- Full WebSocket API compliance (readyState, send, close, etc.)
- Event-based communication (extends EventTarget)
- Paired mode for bidirectional testing
- Configurable delays and behaviors
- Message history tracking

**Design Decisions:**
- Extends `EventTarget` for proper event handling
- Supports both constructor-based and paired creation
- No external dependencies (pure JavaScript)
- Works in both Node and browser environments

**Usage Pattern:**
```javascript
// Simple usage
const ws = new MockWebSocket('ws://test');

// Paired usage (client-server)
const { clientWs, serverWs } = MockWebSocket.createPair();
clientWs.send('data');
// serverWs automatically receives it
```

### 2. ActorTestHarness

**Purpose:** Provide an integrated testing environment for Actor-based client-server communication.

**Key Features:**
- Paired WebSocket setup
- ActorSpace creation and management
- Channel configuration
- JSDOM integration for browser testing
- Lifecycle management (setup/teardown)
- Helper methods for common operations

**Design Decisions:**
- Single point of configuration
- Automatic cleanup in teardown
- Optional JSDOM integration
- Supports both actor classes and instances

**Usage Pattern:**
```javascript
const harness = new ActorTestHarness({
  serverActor: ServerActorClass,
  clientActor: ClientActorClass,
  useDom: true
});

await harness.setup();
// Run tests...
await harness.teardown();
```

### 3. JSDOMEnvironment

**Purpose:** Simplify JSDOM setup and teardown for browser environment testing.

**Key Features:**
- Automatic global setup (window, document, etc.)
- Mock browser APIs (ResizeObserver, IntersectionObserver, etc.)
- Helper methods for DOM manipulation
- Event simulation utilities
- Proper cleanup and restoration

**Design Decisions:**
- Saves and restores globals
- Provides both low-level and high-level APIs
- Mocks common missing browser APIs
- Works standalone or with ActorTestHarness

**Usage Pattern:**
```javascript
const env = new JSDOMEnvironment();
env.setup();

const element = env.createElement('div', { id: 'test' });
env.simulateClick(element);

env.teardown();
```

### 4. TestDataGenerator

**Purpose:** Generate test data from JSON schemas for validation testing.

**Key Features:**
- Schema-aware data generation
- Valid and invalid data generation
- Smart defaults for common types
- Support for constraints (min/max, patterns, etc.)
- Mock actor creation

**Design Decisions:**
- Static methods for easy usage
- Context-aware generation (e.g., 'email' field gets email format)
- Deterministic where possible, random where needed
- Compatible with @legion/schema validators

**Usage Pattern:**
```javascript
const schema = {
  name: { type: 'string', minLength: 3, required: true },
  age: { type: 'integer', minimum: 0, maximum: 120 }
};

const validData = TestDataGenerator.generateValidData(schema);
const invalidData = TestDataGenerator.generateInvalidData(schema);
```

### 5. ProtocolTestSuite

**Purpose:** Auto-generate comprehensive test suites for ProtocolActor implementations.

**Key Features:**
- Protocol structure validation
- State schema validation
- Message schema validation (valid/invalid)
- Precondition enforcement testing
- Postcondition validation
- Integration flow testing

**Design Decisions:**
- Uses describe/test from Jest
- Generates tests at runtime
- Highly configurable via options
- Integrates with TestDataGenerator
- Tests both positive and negative cases

**Usage Pattern:**
```javascript
ProtocolTestSuite.generateTests(MyProtocolActor, {
  includeIntegrationTests: true,
  testPostconditions: true
});
```

## Integration with Legion Ecosystem

### Dependencies

```
@legion/actor-testing
├── @legion/actors (Protocol Actor, ActorSpace, Channel)
├── @legion/schema (JSON Schema validation)
└── jsdom (Browser environment simulation)
```

### Related Packages

- **@legion/actors** - Provides ProtocolActor base class
- **@legion/schema** - Provides JSON Schema validation via Zod
- **@legion/server-framework** - Uses actors for server communication

## Design Principles

### 1. Zero Configuration Defaults

All components work out of the box with sensible defaults:
- MockWebSocket auto-connects by default
- ActorTestHarness auto-connects WebSockets
- JSDOMEnvironment provides standard HTML template
- TestDataGenerator handles common field names

### 2. Composability

Components can be used independently or together:
- Use MockWebSocket alone for simple tests
- Use ActorTestHarness for full integration tests
- Mix and match as needed

### 3. Type Safety

While written in JavaScript, the package:
- Uses JSDoc for type hints
- Compatible with TypeScript
- Validates protocols via JSON Schema
- Provides clear error messages

### 4. Test Isolation

Each test should be independent:
- ActorTestHarness provides clean setup/teardown
- JSDOMEnvironment restores global state
- No shared state between tests
- Proper cleanup prevents leaks

### 5. Extensibility

Easy to extend for specific needs:
- MockWebSocket can be subclassed
- ActorTestHarness accepts custom options
- TestDataGenerator methods are static
- ProtocolTestSuite can be customized

## Testing Strategy

### Unit Tests

Test individual components in isolation:
- MockWebSocket: Event handling, state transitions
- TestDataGenerator: Data generation correctness
- Utilities: Helper functions

### Integration Tests

Test components working together:
- ActorTestHarness: Full client-server flow
- Protocol Testing: Message validation
- JSDOM Integration: Browser environment

### Example Tests

Real-world examples demonstrating:
- Complete actor implementations
- Protocol definitions
- Integration scenarios
- Best practices

## Performance Considerations

### Memory Management

- Proper cleanup in teardown methods
- Clear message history when needed
- Destroy JSDOM instances
- Remove event listeners

### Test Speed

- Fast by default (10ms delays)
- Configurable delays for specific needs
- No real network calls
- Synchronous where possible

### Scalability

- Can test multiple actor pairs
- Handles large message volumes
- Memory-efficient message storage
- Suitable for CI/CD pipelines

## Future Enhancements

### Potential Additions

1. **Visual Testing**
   - Screenshot comparison
   - DOM diffing
   - Visual regression

2. **Performance Profiling**
   - Message throughput measurement
   - Latency tracking
   - Resource usage monitoring

3. **Advanced Mocking**
   - Network delay simulation
   - Connection failures
   - Partial message delivery

4. **Test Reporting**
   - Protocol compliance reports
   - Coverage analysis
   - Test result visualization

5. **Code Generation**
   - Generate actors from protocols
   - Generate tests from OpenAPI specs
   - Generate mock data from examples

## Migration Guide

### From Scattered Utilities

If you were using scattered testing utilities:

**Before:**
```javascript
// From pdf-signer
import { TestUtils } from '../../__tests__/utils/TestUtils.js';
const ws = TestUtils.createMockWebSocket();

// From cli
import { MockWebSocket } from '../../__tests__/helpers/MockWebSocket.js';
```

**After:**
```javascript
import { MockWebSocket, TestDataGenerator } from '@legion/actor-testing';
```

### From Manual Setup

If you were manually setting up tests:

**Before:**
```javascript
let dom, serverActor, clientActor, serverWs, clientWs;

beforeEach(() => {
  dom = new JSDOM(/* ... */);
  global.window = dom.window;
  global.document = dom.window.document;

  serverWs = new MockWebSocket('ws://server');
  clientWs = new MockWebSocket('ws://client');
  // ... manual pairing
  // ... manual actor creation
  // ... manual channel setup
});
```

**After:**
```javascript
let harness;

beforeEach(async () => {
  harness = new ActorTestHarness({
    serverActor: MyServerActor,
    clientActor: MyClientActor,
    useDom: true
  });
  await harness.setup();
});

afterEach(async () => {
  await harness.teardown();
});
```

## Conclusion

The `@legion/actor-testing` package provides a complete, well-designed testing framework for Actor-based systems. It consolidates best practices, eliminates duplication, and makes testing easier and more reliable across the Legion framework.
