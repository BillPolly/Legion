# CLAUDE.md

Never unstructure objects using spread if it is possible to avoid! Do proper OO coding where you are manipulating objects that mantain their identity.
use of spread where you do not use proper clasess must be avoided at all costs. 

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ CRITICAL - REAL LLM CALLS ARE AVAILABLE! (READ THIS FIRST!)

**STOP MAKING INCORRECT ASSUMPTIONS ABOUT LLM AVAILABILITY!**

✅ **ALL RESOURCES ARE AVAILABLE FOR TESTING:**
- ✅ Real LLM clients (Anthropic Claude, OpenAI, etc.)
- ✅ Real MongoDB connections
- ✅ Real Qdrant vector database
- ✅ Real semantic search with embeddings
- ✅ ALL integration test resources are LIVE and WORKING

❌ **NEVER ASSUME:**
- ❌ "We can't use real LLM calls in tests" - WRONG! We have them!
- ❌ "We need to mock LLM responses" - WRONG! Use real calls!
- ❌ "Integration tests should avoid external services" - WRONG! Use them!
- ❌ "Tests will be too slow with real LLM" - WRONG! They work fine!

**IF A TEST REQUIRES LLM, MONGODB, OR QDRANT - USE THE REAL THING!**

The ResourceManager provides ALL real services. Just get them:
```javascript
const resourceManager = await ResourceManager.getInstance();
const llmClient = await resourceManager.get('llmClient');  // REAL LLM!
const semanticSearch = await resourceManager.get('semanticSearch');  // REAL!
```

**Integration tests use NO MOCKS unless for incidental things!**

Never use .sh files, we only use javasrcipt or jest to run things

## ResourceManager Usage (CRITICAL)

**THE ResourceManager is a singleton that MUST be used for ALL environment variables and configuration!**

### How to use ResourceManager:
```javascript
// ALWAYS get ResourceManager like this (it auto-initializes):
const resourceManager = await ResourceManager.getInstance();

// Get environment variables:
const apiKey = resourceManager.get('env.API_KEY');
const mongoUri = resourceManager.get('env.MONGO_URI');

// Get LLM client:
const llmClient = await resourceManager.get('llmClient');
```

### NEVER DO THIS:
```javascript
// ❌ NEVER use process.env directly
const apiKey = process.env.API_KEY;  // WRONG!

// ❌ NEVER create new ResourceManager instances
const rm = new ResourceManager();  // WRONG!

// ❌ NEVER use dotenv directly
require('dotenv').config();  // WRONG!
```

**ALL environment values MUST ALWAYS come from ResourceManager and NOWHERE ELSE!**
- ResourceManager automatically loads the .env file from the monorepo root
- It is a singleton - only ONE instance exists across the entire application
- It self-initializes on first access - no manual initialization needed

## Actor Framework Testing with MockWebSocket (CRITICAL - READ THIS!)

**NEVER wire actors directly in tests! ALWAYS use MockWebSocket!**

### ❌ WRONG - Direct Actor Wiring (BYPASSES EVERYTHING!)
```javascript
// This tests NOTHING about real browser flow!
const browserActor = new BrowserCLIClientActor();
cli.sessionActor.remoteActor = browserActor;  // ❌ WRONG!
browserActor.setRemoteActor(cli.sessionActor); // ❌ WRONG!
```

**Why this is wrong:**
- Bypasses WebSocket layer completely
- No message serialization/deserialization
- No ConfigurableActorServer routing
- Tests pass but real browser fails
- Wastes time debugging wrong things

### ✅ CORRECT - Use MockWebSocket
```javascript
// Create mock WebSocket pair
const { serverWs, clientWs } = MockWebSocket.createPair();

// Server side - ConfigurableActorServer uses serverWs
// Framework handles serialization, routing, actor creation

// Client side - BrowserCLIClientActor uses clientWs
// Receives serialized messages via WebSocket
// Deserializes and renders to JSDOM

// This tests FULL STACK:
// ✅ WebSocket message flow
// ✅ Message serialization/deserialization
// ✅ ConfigurableActorServer routing
// ✅ CLISessionActor logic
// ✅ BrowserCLIClientActor rendering
```

**Use MockWebSocket from:** `__tests__/helpers/MockWebSocket.js`

**When testing browser UI with JSDOM:**
1. Use MockWebSocket.createPair()
2. Wire serverWs to ConfigurableActorServer
3. Wire clientWs to BrowserCLIClientActor
4. Send messages through WebSocket
5. Verify JSDOM is updated correctly

This is the ONLY way to test the real flow!

NO tests must ever skip, they must fail!

ALL resources are available, real llm, mon

ALL UI components must be MVVM and work with the actor framework only. 
HTML must be dynamically generated and have incremental 2 way mapping to the state for easy updating and event dispatch.
Whenever possible use and improve generic compoents.

When running webapp clients and servers prefere the MCP tool as that enables you to look at all logs and interact with the web page and really debug it.



## Project Overview

Legion is a modular framework for building AI agent tools with consistent interfaces. It's organized as a monorepo using npm workspaces with packages for core infrastructure, AI/LLM services, tool collections, and applications.

All packages as far as possible should be self configuring with defaults that just work.

Everything must all ways be done in a TDD way with all tests passing.

All tests must use Jest and work with npm test .... tests to run

For integration tests NO Mocks must be used unless unavoidable for particular situations if you are testing one part with live components. and the use of mocks must be fully commenteted.

No fallbacks in tests or skipping, just FAIL the test if resoruce are not there.

In implementation code THERE MUST NEVER be any mock implementations or fallbacks, just fail fast.

All tests must be under the __tests__ directories and all results and such should go under there as well, but they should be in directores and added to gitignore. 
if a test is producing files and such it is better to clean up before rather than after as then the results can be viewed

There must only ever be one .env file in the monorepo root and it must ONLY EVER be accessed through the ResourceManager singleton.
The ResourceManager should supply everything needed - NEVER access environment variables directly from process.env or dotenv! 

We are making an MVP we dont care about NFRs or future extensions we just need to get it working

Always keep package root directories as clean as possible! NEVER put scripts there. if scripts are temporary they must be put in a /tmp directory and cleaned up when finished with.


DO NOT recreate functionality, this is a monorepo whereeveer possible use existing packages. if it follows good design principles extend or enhance them as requried.

## Declarative Components - AI-Friendly UI Framework (CRITICAL FOR AI AGENTS)

**Declarative Components is Legion's reactive UI system specifically designed for AI agents to generate user interfaces.**

### Why It's AI-Friendly

The system provides **three equivalent ways** to define the same component - all compile to identical JSON:

1. **CNL (Controlled Natural Language)** - Natural language UI definitions (BEST FOR AI!)
2. **DSL** - Concise template syntax for developers
3. **JSON** - Direct structured data for tools/serialization

**Key Insight**: AI agents can describe UIs in near-natural language and the system compiles them to fully reactive components!

### Quick Start for AI Agents

```javascript
import { ComponentLifecycle } from '@legion/declarative-components';
import { DataStore } from '@legion/data-store';

// 1. Create DataStore (state management)
const dataStore = new DataStore({
  ':name': {}, ':email': {}, ':age': {}, ':active': {}
});

// 2. Create lifecycle manager
const lifecycle = new ComponentLifecycle(dataStore);

// 3. Define component using CNL (AI-friendly!)
const cnl = `
Define UserCard with user:
  A container with class "user-card" containing:
    A heading showing the user name
    A paragraph showing "Email: " plus the user email
    A span showing "Active" if user active, otherwise "Inactive"
    A button labeled "Toggle" that toggles user active on click
`;

// 4. Mount component
const container = document.getElementById('app');
const component = await lifecycle.mount(cnl, container, {
  name: 'John Doe',
  email: 'john@example.com',
  age: 30,
  active: true
});

// 5. Component is now REACTIVE - updates propagate automatically!
await component.update({ name: 'Jane Smith', active: false });

// 6. Cleanup
await component.unmount();
```

### CNL Syntax Patterns (Natural Language)

```
Define ComponentName with entityName:
  A container [with class "className"] containing:
    A heading showing property
    A paragraph showing "text " plus property
    A span showing expression if condition, otherwise otherExpression
    A button labeled "text" that performs action on click
    For each item in collection:
      A list item showing item property
```

### DSL Syntax (Concise Alternative)

```javascript
const dsl = `
  UserCard :: user =>
    div.user-card [
      h2 { user.name }
      p { "Email: " + user.email }
      span { user.active ? "Active" : "Inactive" }
      button { "Toggle" } => user.active = !user.active
    ]
`;
```

### Component Methods, Computed Properties, and Helpers

**Methods** - Reusable component logic:
```javascript
const dsl = `
  Counter :: state =>
    methods: {
      increment() {
        state.count = state.count + 1
      },
      decrement() {
        state.count = state.count - 1
      }
    }
    div.counter [
      div.count { state.count }
      button @click="increment()" { "+" }
      button @click="decrement()" { "-" }
    ]
`;
```

**Computed Properties** - Derived values that auto-update:
```javascript
const dsl = `
  ShoppingCart :: cart =>
    computed: {
      subtotal() {
        return cart.price * cart.quantity
      },
      tax() {
        return computed.subtotal * 0.1
      },
      total() {
        return computed.subtotal + computed.tax
      }
    }
    div.cart [
      div.subtotal { computed.subtotal }
      div.tax { computed.tax }
      div.total { computed.total }
      button @click="cart.quantity = cart.quantity + 1" { "Add Item" }
    ]
`;
```

**Helper Functions** - Global utility functions:
```javascript
// Register helpers on lifecycle
lifecycle.registerHelper('formatCurrency', (amount) => {
  return '$' + amount.toFixed(2);
});

lifecycle.registerHelpers({
  uppercase: (text) => String(text).toUpperCase(),
  formatDate: (date) => new Date(date).toLocaleDateString()
});

const dsl = `
  Product :: product =>
    computed: {
      formattedPrice() {
        return helpers.formatCurrency(product.price)
      }
    }
    div.product [
      h3 { helpers.uppercase(product.name) }
      p { computed.formattedPrice }
    ]
`;
```

### JSON Format (For Tools/Serialization)

All DSL/CNL compiles to this format:
```json
{
  "name": "UserCard",
  "entity": "user",
  "structure": {
    "root": { "element": "div", "class": "user-card" },
    "root_child_0": { "element": "h2", "parent": "root" }
  },
  "bindings": [
    { "source": "user.name", "target": "root_child_0.textContent", "transform": "identity" }
  ],
  "events": [
    { "element": "root_child_1", "event": "click", "action": "user.active = !user.active" }
  ]
}
```

### Key Features for AI Agents

1. **Automatic Reactivity**: State changes → DOM updates automatically
2. **No Manual DOM Manipulation**: Declare relationships, system maintains them
3. **DataStore Integration**: Full persistence, queries, transactions
4. **Lifecycle Hooks**: beforeMount, afterUpdate, beforeUnmount
5. **Error Handling**: Clear error messages for debugging
6. **100% Test Coverage**: 563 passing tests - production ready

### Common Patterns

**Form with Validation**:
```javascript
const dsl = `
  LoginForm :: form =>
    div.login-form [
      input.username[type=text][value={form.username}]
      input.password[type=password][value={form.password}]
      div.error { form.error || "" }
      button { "Login" } => form.error = form.username ? "" : "Username required"
    ]
`;
```

**List with Iteration** (CNL):
```
Define TodoList with todos:
  A container containing:
    A heading showing "My Todos"
    For each item in todos items:
      A list item containing:
        A checkbox bound to item done
        A span showing item title
        A button labeled "×" that removes item on click
```

**Conditional Rendering**:
```javascript
const dsl = `
  Message :: state =>
    div [
      if (state.showMessage) [
        p { state.message }
        button { "Hide" } => state.showMessage = false
      ]
      if (!state.showMessage) [
        button { "Show" } => state.showMessage = true
      ]
    ]
`;
```

### When to Use Declarative Components

**✅ USE FOR**:
- Dynamic UI generation by AI agents
- Reactive dashboards and admin panels
- Forms with complex state management
- Data visualization components
- Agent-to-agent UI communication

**❌ DON'T USE FOR**:
- Static content (use plain HTML)
- Heavy animations (use CSS/Canvas directly)
- Performance-critical rendering (use virtual scrolling separately)

### Architecture Overview

```
CNL/DSL/JSON → Parser → AST → CodeGenerator → Component Definition
                                                       ↓
DataStore ←→ EquationSolver ←→ DOM Elements
     ↓              ↓                ↓
  State      Subscriptions    Event Handlers
```

**How Reactivity Works**:
1. Component mounts: creates DOM structure, establishes bindings
2. State change: DataStore notifies → EquationSolver updates → DOM updates
3. User interaction: DOM event → EquationSolver executes action → State updates
4. Computed properties: Dependencies tracked → Auto-recalculate when deps change

### Testing Declarative Components

```javascript
import { ComponentLifecycle } from '@legion/declarative-components';
import { DataStore } from '@legion/data-store';

test('should create reactive counter', async () => {
  const dataStore = new DataStore({ ':count': {} });
  const lifecycle = new ComponentLifecycle(dataStore);

  const dsl = `
    Counter :: state =>
      div [
        span.count { state.count }
        button.increment @click="state.count = state.count + 1" { "+" }
      ]
  `;

  const container = document.createElement('div');
  const component = await lifecycle.mount(dsl, container, { count: 0 });

  const span = container.querySelector('.count');
  const button = container.querySelector('.increment');

  expect(span.textContent).toBe('0');

  button.click();
  await new Promise(resolve => setTimeout(resolve, 50));

  expect(span.textContent).toBe('1');

  await component.unmount();
});
```

### Package Location

```
/packages/frontend/declarative-components/
├── src/
│   ├── compiler/        # DSL → AST → JSON
│   ├── cnl/            # CNL → JSON conversion
│   ├── solver/         # Reactive engine
│   ├── lifecycle/      # Component lifecycle
│   └── adapters/       # DataStore integration
└── __tests__/          # 563 passing tests
```

**Full Documentation**: `/packages/frontend/declarative-components/README.md`

## Methedology
Always use TDD methodolgy but without the refactor phase, try and get it right first time.
All tests must be passing before moving on to next phase. 
Always follow uncle Bob's CLEAN architecture principles
Alwasy follow uncle Bob's CLEAN code principles

All json schemas mus be check using the Schema package only, THERE MUST be no use of zod outside of this package.


all temporary things that should not form part of the project like screenshots or script files or  debugging tests, or tool outputs MUST be put in /tmp or /scratch directories, these are in gitignore and will be cleaned up automatically


ONLY the schema package must be used for json validation! now zod 

NO fallbacks! FAIL FAST! raise an error

WHEN you make changes you MUST fix up any tests and run full REGRESSION

## Handle/Proxy Pattern (CRITICAL)

**Handles are the universal proxy pattern providing a consistent interface for any resource type.**

### Key Handle Concepts:
- **NEVER create Handles directly** - Only ResourceManagers or parent Handles create them via projection
- **Handles appear as local objects** but properly transact through ResourceManager hierarchy
- **All Handle types extend from `@legion/handle`** - The universal base class
- **Prototypes provide rich interfaces** - Dynamic properties based on resource schemas

### Handle Usage:
```javascript
// ❌ WRONG - Never create directly
const handle = new Handle(resourceManager);

// ✅ CORRECT - Created by ResourceManager or projection
const dataStore = resourceManager.createDataStore();
const entity = dataStore.entity(123);  // Projection from parent
entity.name = 'New Name';  // Appears local but routes through ResourceManager
```

### ResourceManager Interface for Handles:
All ResourceManagers MUST implement these synchronous methods:
- `query(querySpec)` - Execute queries (MUST be synchronous!)
- `subscribe(querySpec, callback)` - Setup subscriptions (MUST be synchronous!)
- `getSchema()` - Get resource schema for introspection

See `/docs/HANDLES.md` for complete architectural documentation.

## Testing (CRITICAL)

### Actor Framework Testing (CRITICAL - READ THIS FIRST!)
**ALL CLI/Server integration tests MUST use the actor framework via CLI class!**

**NEVER EVER create raw WebSocket connections in tests! The actor framework handles ALL messaging!**

```javascript
// ✅ CORRECT - Use CLI class with actor framework
import { CLI } from '../../src/CLI.js';
import { ResourceManager } from '@legion/resource-manager';

test('should execute command via actor framework', async () => {
  const resourceManager = await ResourceManager.getInstance();
  const cli = new CLI(resourceManager, { port: 6500 });
  await cli.initialize();
  await cli.start();

  // Mock browser launch
  cli.showme.server.launchBrowser = async () => { return; };
  cli.showme._waitForConnection = async () => { return; };

  // Execute command via ACTOR FRAMEWORK
  const result = await cli.sessionActor.receive('execute-command', {
    command: '/show legion://test/image'
  });

  expect(result.success).toBe(true);
  await cli.shutdown();
});
```

```javascript
// ❌ WRONG - NEVER DO THIS! NO RAW WEBSOCKETS!
import WebSocket from 'ws';

test('should execute command', async () => {
  // ❌ WRONG! Don't create raw WebSocket connections!
  const ws = new WebSocket('ws://localhost:5500/ws?route=/cli');
  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    // ❌ WRONG! Don't manually handle actor protocol messages!
  });
});
```

**WHY?**
1. The actor framework handles ALL message routing and serialization
2. Raw WebSockets bypass the actor framework completely
3. You end up reimplementing what CLI class already does
4. Tests become complex, fragile, and wrong

**ALWAYS:**
- Use `CLI` class
- Call `cli.sessionActor.receive('execute-command', { command: '...' })`
- Let the actor framework handle everything

### JSDOM Testing for Web UIs (CRITICAL - READ CAREFULLY!)

**JSDOM IS THE BROWSER ENVIRONMENT - USE THE REAL BROWSER CLIENT CODE IN IT!**

**CRITICAL MISTAKE TO AVOID**: DO NOT create a mock remoteActor that simulates what BrowserCLIClientActor does. This doesn't test the actual browser client code!

```javascript
// ❌ ABSOLUTELY WRONG - NEVER DO THIS! MOCKING THE BROWSER CLIENT!
import { JSDOM } from 'jsdom';
import { CLI } from '../../src/CLI.js';

test('should display image in DOM', async () => {
  const dom = new JSDOM(`<!DOCTYPE html><body><div id="app"></div></body>`);
  global.document = dom.window.document;
  global.window = dom.window;

  const cli = new CLI(resourceManager, { port: 6500 });
  await cli.initialize();
  await cli.start();

  // ❌ WRONG! This is a mock that simulates BrowserCLIClientActor!
  const mockRemoteActor = {
    receive: (messageType, data) => {
      if (messageType === 'display-asset') {
        const container = document.getElementById('asset-container');
        const img = document.createElement('img');
        img.src = data.assetData;
        container.appendChild(img);
      }
    }
  };

  // ❌ WRONG! This doesn't test the REAL browser client code!
  cli.sessionActor.remoteActor = mockRemoteActor;

  // This test passes but doesn't guarantee the real BrowserCLIClientActor works!
  const result = await cli.sessionActor.receive('execute-command', {
    command: '/show legion://test'
  });

  const img = document.querySelector('img');
  expect(img).toBeTruthy();  // Test passes but means nothing!
});
```

**WHY IS THIS WRONG?**
1. JSDOM provides the DOM environment for testing browser code
2. The REAL BrowserCLIClientActor should run in that JSDOM environment
3. Mocking what the actor "should do" doesn't test the actual implementation
4. If BrowserCLIClientActor has bugs, the mock won't catch them!

```javascript
// ✅ CORRECT - Use the ACTUAL BrowserCLIClientActor in JSDOM
import { JSDOM } from 'jsdom';
import { CLI } from '../../src/CLI.js';
import { BrowserCLIClientActor } from '../../apps/cli-ui/src/client/BrowserCLIClientActor.js';

test('should display image in DOM with REAL browser client', async () => {
  // Set up JSDOM environment
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <body><div id="app"></div></body>
  `);
  global.document = dom.window.document;
  global.window = dom.window;

  // Create CLI server
  const cli = new CLI(resourceManager, { port: 6500 });
  await cli.initialize();
  await cli.start();

  // Create REAL BrowserCLIClientActor with JSDOM container
  const container = document.getElementById('app');
  const browserActor = new BrowserCLIClientActor({
    container: container,
    serverUrl: `ws://localhost:${cli.port}/ws?route=/cli`
  });

  // Initialize the REAL actor
  await browserActor.initialize();

  // Set it as the remote actor - this is the REAL browser client!
  cli.sessionActor.remoteActor = browserActor;

  // Execute command - the REAL BrowserCLIClientActor handles it
  const result = await cli.sessionActor.receive('execute-command', {
    command: '/show legion://test'
  });

  // VERIFY the REAL actor updated JSDOM correctly
  const img = container.querySelector('img');
  expect(img).toBeTruthy();
  expect(img.src).toContain('data:image');

  // This actually tests the real browser client code!
  await cli.shutdown();
});
```

**THE CORRECT PATTERN:**
1. JSDOM provides the browser DOM environment
2. Import and instantiate the ACTUAL BrowserCLIClientActor
3. Pass JSDOM container to the actor
4. Set the real actor as cli.sessionActor.remoteActor
5. Execute commands - the REAL actor code runs in JSDOM
6. Verify the REAL actor updated JSDOM correctly

**This tests the actual code path that runs in the real browser!**

**Tests must verify:**
1. The REAL BrowserCLIClientActor receives `display-asset` messages
2. The REAL actor's code correctly updates the DOM
3. Images appear with correct src, classes, and structure
4. Any bugs in the actual actor implementation will cause test failures

**Important Discovery - JSDOM Limitations**:
When testing with the REAL BrowserCLIClientActor in JSDOM, we discovered that some components have browser-specific dependencies:

```javascript
// The @legion/components package eagerly loads ALL components when imported
await import('@legion/components');
// This triggers CodeEditor to load CodeMirror, which fails in JSDOM:
// "Cannot find module '/lib/codemirror/view'"
```

**Key Insight**: Using the REAL browser actor instead of mocks revealed this architectural issue:
- The components package should use lazy loading or separate entry points
- JSDOM tests have inherent limitations with browser-specific libraries (CodeMirror, etc.)
- For full E2E testing with real browser dependencies, use Playwright or MCP chrome-devtools

**This is a GOOD outcome** - the test revealed real issues that mocks would have hidden!

### General Testing Rules
FOR tests there must be NO skipping and NO fallback under any circumstance, they must just FAIL in those circumstances.

unless you are specifically testing their functionality Resource manager and tool registry singletons should be got once at the beginning of the test suite with no timeout and then just reused.

NOTHING should be setting anything on resource manager! it provides values it does nothing else

ALWAYS run tests with npm test ....selection to run

THERE is no problem getting real llm clients for testing!!!! always use them in integration tests when required.

ALL temporary scripts must go in tmp/ directories

ALL ways use the fullstack tool to debug a server front end and back end

when we make changes THERE MUST NEVER BE ANY CODE FOR BACKWARDS COMPATIBILIT! there must only ever be one way of doing anything, and we will fix everything to use it

We do not use APIs in legion, all communications to frontend is done with websockets

ALL TESTS MUST PASS. no execuses like timing, or that it doesnt matter. if the tests dont matter they should not be there!

NEVER Under any circumstances add mocks to implementation code, you do it all the time and it makes NO SENSE WHATSOEVER! there are no circumstances where it is justified.

THERE MUST be no fallbacks, FAIL FAST

NO INLINE CSS style under ANY circustances, use classes and css-variables

WE ALWAYS NEED 100% pass rate

NO BASH Scripts, theis javascript ES6 project! if you need scritps they must be written in javascript and go in the script directory and get called from package.json

LIVE TESTS MUST PASS, all the resoruces required are availble, if it didnt have to pass it would not be there!!!!

where apropriate you must use the proper workspace improts ALWAYS so "@legion/ .... not relative imports to outside your package!

ALL inter package imports should use "@legion/...  never relative imports outside a package.

## Workspace Imports (CRITICAL)

**ALWAYS use @legion/... imports! NEVER use relative imports outside a package!**

### ❌ WRONG - Relative imports
```javascript
import { ResourceManager } from '../packages/shared/resource-manager/src/ResourceManager.js';
import { CLI } from '../../packages/cli/src/index.js';
```

### ✅ CORRECT - Workspace imports
```javascript
import { ResourceManager } from '@legion/resource-manager';
import { CLI } from '@legion/cli';
```

**If workspace imports don't work, FIX THE WORKSPACE CONFIGURATION!**
- Check package.json has correct "exports" field
- Check package.json has correct "name" field
- DO NOT work around it with relative imports!

Scripts in the /scripts directory that need to import workspace packages must either:
1. Be run from package.json scripts (which resolve workspaces correctly)
2. Fix the import resolution by ensuring workspaces are properly configured

Jest must always be configured for ES6 modules.

In general always run jest tests sequentially unless you absolutley know that they can run in parallel.

Only ever use Jest for tests. no node test runner, no plain js scripts used as tests.

If you do need to right js scripts for testing or debuging then always put them in a /tmp directory and remeber to clear them up

NEVER pollute package root directories or monorepo root! they must be kept as clean as possible! any scripts must go in scripts directory. and test artifacts should go under /tmp in __tests__

all tests go in __tests__ in the package root, not in src

NEVER skip tests under any circumstances, either the tests is not needed in which case it must be deleted or it must pass.

NEVER mock in integration tests unless it is for incidental things.

NEVER EVER HAVE FALLBACKS IN TESTS OR IMPLEMENTATION code, FAIL FAST!

WE NEVER WANT BACKWARDS COMPATABILITY, WE ALWAYS WNNT JUST ONE WAY OF DOING THINGS!

FIX TEST FAILURES ONE BY ONE.

IF you are having difficulty debugging a test, then write in depth debug scripts and tests in a /tmp direcotry and really drill into the problem with a detailed breakdown and step by step testing and logging.

when tests are timing out, check with console logs that they are rerally not just hanging or looping

if tests are taking a long time, try to simplify them, but make sure they have enough time to run in the configuration! we need to fix it so that nmp test always works!

NO backwards compatability! we always have one way of doing things and move everything to that

ALWAYS do proper Object orientated programming. We do not just pass around anonymous javascript objects with spreading. 

NO CONCURRENT JEST TESTS EVER. 

ALWAYS USE ES6 MODULES EVERYWHERE.

NO mocks in integration tests!

when you are fixing tests READ THE ACTAUL code being tested! do not guess

NO BACWARDS COMPATIBILITY EVER! we only ever have one way of doing things.

NEVER skip tests, FAIL FAST!

test files always use jest and always go under __tests__ in the package root

ALWAYS use TemplatedPrompt from prompt manager for any llm interaction
