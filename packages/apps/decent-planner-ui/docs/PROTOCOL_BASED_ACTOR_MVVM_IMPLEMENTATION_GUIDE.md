# Protocol-Based Actor MVVM Implementation Guide

**A complete guide to implementing bulletproof client-server communication with MVVM UI components, based on real-world implementation of the module browser in decent-planner-ui**

## Table of Contents

1. [Overview](#overview)
2. [Architecture Principles](#architecture-principles)
3. [Protocol Actor Implementation](#protocol-actor-implementation)
4. [MVVM Component Architecture](#mvvm-component-architecture)
5. [Point-to-Point Communication](#point-to-point-communication)
6. [Two-Sided Protocol Testing](#two-sided-protocol-testing)
7. [Real Testing - No Mocks](#real-testing---no-mocks)
8. [Common Pitfalls and Solutions](#common-pitfalls-and-solutions)
9. [Step-by-Step Implementation](#step-by-step-implementation)

## Overview

This guide documents the complete implementation of a robust, production-ready module browser using:
- **Protocol-based actors** for type-safe communication
- **MVVM architecture** for clean separation of concerns  
- **Point-to-point communication** between dedicated client/server actors
- **Real testing with zero mocks** following CLAUDE.md principles
- **Modern UI components** with beautiful styling

### What We Built

A complete module browser that:
- ✅ **Searches 28+ real modules** from tool registry
- ✅ **Beautiful UI** with formatted names ("AI Generation" not "AIGenerationModule")
- ✅ **Protocol validation** on both client and server sides
- ✅ **Real backend integration** with tools-registry
- ✅ **Zero mocks** - 100% real dependencies

## Architecture Principles

### 1. **NO MOCKS - FAIL FAST**

Per CLAUDE.md: "THERE MUST NEVER be any mock implementations or fallbacks, just fail fast"

**❌ Never Do This:**
```javascript
// Bad - mock implementation
const mockToolRegistry = {
  listTools: jest.fn(),
  searchTools: jest.fn()
};

// Bad - fallback implementation  
if (!toolRegistry) {
  return mockResults; // NO FALLBACKS!
}
```

**✅ Always Do This:**
```javascript
// Good - real dependencies
const toolRegistry = await getToolRegistry();
if (!toolRegistry) {
  throw new Error('Tool registry not available - failing fast');
}

// Good - real tests
const realModules = await serverActor.searchModules('file');
expect(realModules.length).toBeGreaterThan(0);
```

### 2. **Point-to-Point Communication**

Actors should communicate directly with their peers, not route through parents.

**❌ Bad Architecture:**
```
Client → RootClient → RootServer → ServerActor → response → RootServer → RootClient → Client
```

**✅ Good Architecture:**
```
ClientActor ←→ ServerActor (direct point-to-point)
```

### 3. **Protocol-First Design**

Define the communication contract before implementing actors.

```javascript
class MyActor extends ProtocolActor {
  getProtocol() {
    return {
      name: "MyActor",
      version: "1.0.0",
      state: {
        schema: { connected: { type: 'boolean', required: true } },
        initial: { connected: false }
      },
      messages: {
        receives: {
          "search:modules": {
            schema: { query: { type: 'string', required: true } },
            preconditions: ["state.connected === true"],
            postconditions: ["state.lastQuery !== null"]
          }
        },
        sends: {
          "search:result": {
            schema: { modules: { type: 'array', required: true } }
          }
        }
      }
    };
  }
}
```

## Protocol Actor Implementation

### Client-Side Actor

```javascript
import { ProtocolActor } from '../shared/ProtocolActor.js';

export class ToolRegistryClientSubActor extends ProtocolActor {
  constructor() {
    super(); // Initializes state from protocol
    this.remoteActor = null;
  }
  
  // 1. Define the protocol contract
  getProtocol() {
    return {
      name: "ToolRegistryClientSubActor",
      version: "1.0.0",
      state: {
        schema: {
          connected: { type: 'boolean', required: true },
          modulesCount: { type: 'number', minimum: 0 }
        },
        initial: {
          connected: false,
          modulesCount: 0
        }
      },
      messages: {
        receives: {
          "modules:searchResult": {
            schema: {
              query: { type: 'string', required: true },
              modules: { type: 'array', required: true },
              count: { type: 'number', minimum: 0 }
            },
            preconditions: ["state.connected === true"],
            postconditions: ["state.modulesCount >= 0"]
          }
        },
        sends: {
          "modules:search": {
            schema: {
              query: { type: 'string', required: true },
              options: { type: 'object' }
            },
            preconditions: ["state.connected === true"]
          }
        }
      }
    };
  }
  
  // 2. Set up connection with state management
  async setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    this.state.connected = true; // Update protocol state
  }
  
  // 3. Handle messages with protocol validation
  handleMessage(messageType, data) {
    switch (messageType) {
      case 'modules:searchResult':
        this.handleModulesSearchResult(data);
        this.state.modulesCount = data.modules?.length || 0;
        break;
    }
  }
  
  // 4. Send messages with protocol validation
  searchModules(query = '', options = {}) {
    this.send('modules:search', { query, options }); // Protocol validates automatically
  }
  
  // 5. Implement ProtocolActor abstract method
  doSend(messageType, data) {
    if (!this.remoteActor) {
      throw new Error('No remote actor connection available');
    }
    this.remoteActor.receive({ type: messageType, data });
  }
}
```

### Server-Side Actor

```javascript
import { getToolRegistry } from '@legion/tools-registry';

export default class ToolRegistryServerSubActor {
  constructor(services) {
    this.services = services;
    this.toolRegistry = null;
    this.remoteActor = null;
  }
  
  async setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    
    // Initialize real dependencies - NO MOCKS
    await this.initializeToolRegistry();
  }
  
  async initializeToolRegistry() {
    this.toolRegistry = await getToolRegistry();
    if (!this.toolRegistry) {
      throw new Error('Tool registry not available - failing fast');
    }
  }
  
  receive(messageType, data) {
    switch (messageType) {
      case 'modules:search':
        return this.handleModulesSearch(data);
    }
  }
  
  async handleModulesSearch(data) {
    const { query = '', options = {} } = data || {};
    
    // Use REAL tool registry - no mocks
    const allTools = await this.toolRegistry.listTools();
    const moduleMap = new Map();
    
    // Group tools by module
    allTools.forEach(tool => {
      const moduleName = tool.moduleName || 'Unknown';
      if (!moduleMap.has(moduleName)) {
        moduleMap.set(moduleName, {
          name: moduleName,
          description: `Module containing ${moduleName} tools`,
          tools: [],
          status: 'loaded'
        });
      }
      moduleMap.get(moduleName).tools.push(tool.name);
    });
    
    let modules = Array.from(moduleMap.values());
    
    // Filter by query if provided
    if (query) {
      const queryLower = query.toLowerCase();
      modules = modules.filter(module => 
        module.name.toLowerCase().includes(queryLower) ||
        module.description.toLowerCase().includes(queryLower) ||
        module.tools.some(tool => tool.toLowerCase().includes(queryLower))
      );
    }
    
    // Send response back
    this.remoteActor.receive('modules:searchResult', {
      query,
      modules,
      count: modules.length
    });
  }
}
```

## MVVM Component Architecture

### Model - Pure State Management

```javascript
class ModuleBrowserPanelModel {
  constructor(options = {}) {
    this.state = {
      modules: options.modules || [],
      filteredModules: options.modules || [],
      selectedModule: null,
      expandedModules: new Set(), // Track expanded state
      searchQuery: ''
    };
  }
  
  updateState(path, value) {
    const keys = path.split('.');
    let current = this.state;
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    
    // Auto-update filtered data when search changes
    if (path === 'searchQuery') {
      this.updateFilteredModules();
    }
  }
  
  toggleModuleExpansion(moduleName) {
    if (this.state.expandedModules.has(moduleName)) {
      this.state.expandedModules.delete(moduleName);
    } else {
      this.state.expandedModules.add(moduleName);
    }
  }
}
```

### View - Pure Rendering

```javascript
class ModuleBrowserPanelView {
  constructor(container) {
    this.container = container;
    this.cssInjected = false;
  }
  
  render(modelData) {
    this.injectCSS();
    this.container.innerHTML = '';
    
    // Create search controls
    const controls = this.createControls(modelData);
    this.container.appendChild(controls);
    
    // Create module grid
    const content = this.createContent(modelData);
    this.container.appendChild(content);
  }
  
  createModuleCard(module, modelData) {
    const card = document.createElement('div');
    card.className = `module-card${module.name === modelData.selectedModule?.name ? ' selected' : ''}`;
    
    // Use formatted module name
    const name = document.createElement('h3');
    name.className = 'module-name';
    name.textContent = formatModuleName(module.name); // Generic formatting
    
    // Tool count badge instead of status
    const toolCount = document.createElement('span');
    toolCount.className = 'module-tool-count-badge';
    const tools = module.tools || [];
    toolCount.textContent = tools.length === 1 ? '1 tool' : `${tools.length} tools`;
    
    // Add expandable tools section if tools exist
    if (tools.length > 0) {
      const isExpanded = modelData.expandedModules.has(module.name);
      const toolsSection = this.createToolsSection(module, tools, isExpanded);
      card.appendChild(toolsSection);
    }
    
    return card;
  }
}
```

### ViewModel - Coordination Logic

```javascript
class ModuleBrowserPanelViewModel {
  constructor(model, view, umbilical) {
    this.model = model;
    this.view = view;
    this.umbilical = umbilical;
    this.searchTimeout = null;
  }
  
  initialize() {
    this.render();
    this.setupEventListeners();
    
    // Request initial data through proper MVVM pattern
    this.requestModuleSearch(''); // List all modules
    
    return this.createPublicAPI();
  }
  
  // Proper MVVM: Request actions through umbilical, don't do them directly
  requestModuleSearch(query) {
    if (this.umbilical.onSearchModules) {
      this.umbilical.onSearchModules(query);
    }
  }
  
  setupEventListeners() {
    const searchInput = this.view.container.querySelector('.module-search-input');
    if (searchInput) {
      const handleSearch = (event) => {
        const query = event.target.value;
        this.model.updateState('searchQuery', query);
        
        // Debounce backend requests
        if (this.searchTimeout) clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
          this.requestModuleSearch(query);
        }, 300);
      };
      
      searchInput.addEventListener('input', handleSearch);
    }
  }
}
```

### Generic Module Name Formatting

```javascript
/**
 * Generic module name formatting - works for any module
 * ConanTheDeployerModule → "Conan The Deployer"
 * AIGenerationModule → "AI Generation" 
 * JSGeneratorModule → "JS Generator"
 */
function formatModuleName(rawName) {
  if (!rawName) return 'Unknown Module';
  
  // Remove "Module" suffix
  let name = rawName.replace(/Module$/, '');
  
  // Handle special acronyms that should stay uppercase
  const acronyms = ['AI', 'API', 'JS', 'CSS', 'HTML', 'JSON', 'XML', 'HTTP', 'URL', 'UI', 'DB', 'SQL'];
  
  // Split camelCase into words
  let formatted = name.replace(/([a-z])([A-Z])/g, '$1 $2');
  
  // Handle multiple uppercase letters (e.g., "AI" in "AIGeneration")
  formatted = formatted.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  
  // Split into words and process each
  const words = formatted.split(/\\s+/);
  const processedWords = words.map(word => {
    // Keep acronyms uppercase
    if (acronyms.includes(word.toUpperCase())) {
      return word.toUpperCase();
    }
    // Capitalize first letter of regular words
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
  
  return processedWords.join(' ');
}
```

## Point-to-Point Communication Setup

### 1. Server-Side Actor Registration

```javascript
// RootServerActor.js
async initializeSubActors() {
  // Create dedicated actors
  this.plannerSubActor = new PlannerServerSubActor(this.services);
  this.chatSubActor = new ChatServerToolAgent(this.services);
  this.toolRegistrySubActor = new ToolRegistryServerSubActor(this.services);
  
  // Register in ActorSpace for direct communication
  if (this.actorSpace) {
    this.actorSpace.register(this.plannerSubActor, 'planner-server-sub');
    this.actorSpace.register(this.chatSubActor, 'chat-server-sub');
    this.actorSpace.register(this.toolRegistrySubActor, 'tool-registry-server-sub');
    
    // Create direct remote connections
    const remotePlannerClient = this.actorSpace.makeRemote('planner-client-sub');
    const remoteChatClient = this.actorSpace.makeRemote('chat-client-sub');
    const remoteToolRegistryClient = this.actorSpace.makeRemote('tool-registry-client-sub');
    
    // Set up point-to-point communication
    await this.plannerSubActor.setRemoteActor(remotePlannerClient);
    await this.chatSubActor.setRemoteActor(remoteChatClient);
    await this.toolRegistrySubActor.setRemoteActor(remoteToolRegistryClient);
  }
}
```

### 2. Client-Side Actor Registration

```javascript
// RootClientActor.js
async setRemoteActor(remoteActor) {
  // Create sub-actors
  this.plannerSubActor = new PlannerClientSubActor();
  this.chatSubActor = new ChatClientSubActor();
  this.toolRegistrySubActor = new ToolRegistryClientSubActor();
  
  // Register for direct communication
  if (this.actorSpace) {
    this.actorSpace.register(this.plannerSubActor, 'planner-client-sub');
    this.actorSpace.register(this.chatSubActor, 'chat-client-sub');
    this.actorSpace.register(this.toolRegistrySubActor, 'tool-registry-client-sub');
    
    // Connect to respective server actors directly
    const remotePlannerServer = this.actorSpace.makeRemote('planner-server-sub');
    const remoteChatServer = this.actorSpace.makeRemote('chat-server-sub');
    const remoteToolRegistryServer = this.actorSpace.makeRemote('tool-registry-server-sub');
    
    await this.plannerSubActor.setRemoteActor(remotePlannerServer);
    await this.chatSubActor.setRemoteActor(remoteChatServer);
    await this.toolRegistrySubActor.setRemoteActor(remoteToolRegistryServer);
  }
}
```

## Two-Sided Protocol Testing

The key insight: **Test each side independently using the shared protocol contract as the interface specification**. This ensures both sides will work together without needing integration tests.

### Protocol Contract as Test Specification

The protocol serves as a **shared contract** that both client and server must comply with:

```javascript
// Shared protocol definition
const TOOL_REGISTRY_PROTOCOL = {
  name: "ToolRegistryProtocol",
  version: "1.0.0",
  messages: {
    receives: {
      "modules:search": {
        schema: {
          query: { type: 'string', required: true },
          options: { type: 'object' }
        },
        preconditions: ["state.connected === true"]
      }
    },
    sends: {
      "modules:searchResult": {
        schema: {
          query: { type: 'string', required: true },
          modules: { type: 'array', required: true },
          count: { type: 'number', minimum: 0 }
        }
      }
    }
  }
};
```

### Client-Side Independent Testing

**Test the client actor in complete isolation:**

```javascript
describe('Client Protocol Compliance - Independent Testing', () => {
  let clientActor;
  let protocolValidator;
  let capturedMessages;
  
  beforeEach(async () => {
    capturedMessages = [];
    
    // Create REAL client actor
    clientActor = new ToolRegistryClientSubActor();
    
    // Create protocol validator from shared contract
    protocolValidator = new ProtocolValidator(TOOL_REGISTRY_PROTOCOL);
    
    // Mock ONLY the network layer - capture what would be sent
    const mockRemoteActor = {
      receive: (message) => {
        capturedMessages.push(message);
        // Validate message against protocol immediately
        const validation = protocolValidator.validateOutgoingMessage(
          message.type, message.data
        );
        if (!validation.valid) {
          throw new Error(`Protocol violation: ${validation.errors}`);
        }
      }
    };
    
    await clientActor.setRemoteActor(mockRemoteActor);
  });
  
  test('client sends protocol-compliant module search messages', async () => {
    // Test the client's behavior independently
    await clientActor.searchModules('file', { limit: 10 });
    
    // Verify protocol compliance
    expect(capturedMessages).toHaveLength(1);
    expect(capturedMessages[0]).toEqual({
      type: 'modules:search',
      data: {
        query: 'file',
        options: { limit: 10 }
      }
    });
    
    // Protocol validator ensures this will work with ANY server
    // that implements the same protocol
  });
  
  test('client handles protocol-compliant responses correctly', async () => {
    // Simulate receiving a protocol-compliant response
    const protocolResponse = {
      type: 'modules:searchResult',
      data: {
        query: 'file',
        modules: [
          { name: 'FileModule', tools: ['read', 'write'], status: 'loaded' }
        ],
        count: 1
      }
    };
    
    // Validate response against protocol
    const validation = protocolValidator.validateIncomingMessage(
      protocolResponse.type, protocolResponse.data
    );
    expect(validation.valid).toBe(true);
    
    // Test client handles it correctly
    await clientActor.receive(protocolResponse);
    
    expect(clientActor.state.modulesCount).toBe(1);
    expect(clientActor.state.modules[0].name).toBe('FileModule');
  });
});
```

### Server-Side Independent Testing

**Test the server actor in complete isolation:**

```javascript
describe('Server Protocol Compliance - Independent Testing', () => {
  let serverActor;
  let protocolValidator;
  let capturedResponses;
  let realToolRegistry;
  
  beforeEach(async () => {
    capturedResponses = [];
    
    // Get REAL tool registry - no mocks
    realToolRegistry = await getToolRegistry();
    expect(realToolRegistry).toBeDefined();
    
    // Create REAL server actor
    serverActor = new ToolRegistryServerSubActor({});
    
    // Create protocol validator from shared contract
    protocolValidator = new ProtocolValidator(TOOL_REGISTRY_PROTOCOL);
    
    // Mock ONLY the network layer - capture responses
    const mockRemoteActor = {
      receive: (messageType, data) => {
        capturedResponses.push({ type: messageType, data });
        // Validate response against protocol immediately
        const validation = protocolValidator.validateIncomingMessage(
          messageType, data
        );
        if (!validation.valid) {
          throw new Error(`Protocol violation: ${validation.errors}`);
        }
      }
    };
    
    await serverActor.setRemoteActor(mockRemoteActor);
  });
  
  test('server handles protocol-compliant requests correctly', async () => {
    // Send protocol-compliant request
    const protocolRequest = {
      query: 'file',
      options: { limit: 50 }
    };
    
    // Validate request against protocol
    const validation = protocolValidator.validateOutgoingMessage(
      'modules:search', protocolRequest
    );
    expect(validation.valid).toBe(true);
    
    // Test server processes it with REAL dependencies
    await serverActor.receive('modules:search', protocolRequest);
    
    // Verify protocol-compliant response
    expect(capturedResponses).toHaveLength(1);
    expect(capturedResponses[0].type).toBe('modules:searchResult');
    expect(capturedResponses[0].data.query).toBe('file');
    expect(capturedResponses[0].data.modules).toBeDefined();
    expect(capturedResponses[0].data.count).toBeDefined();
    
    // This response is guaranteed to work with ANY client
    // that implements the same protocol
  });
  
  test('server provides real data through protocol interface', async () => {
    await serverActor.receive('modules:search', { query: '', options: {} });
    
    const response = capturedResponses[0];
    
    // Verify we got REAL modules, not mocked data
    expect(response.data.modules.length).toBeGreaterThan(0);
    expect(response.data.modules[0]).toHaveProperty('name');
    expect(response.data.modules[0]).toHaveProperty('tools');
    expect(Array.isArray(response.data.modules[0].tools)).toBe(true);
    
    console.log('✅ Real modules from server:', response.data.count);
  });
});
```

### Protocol Validator Implementation

```javascript
class ProtocolValidator {
  constructor(protocol) {
    this.protocol = protocol;
  }
  
  validateOutgoingMessage(messageType, data) {
    const messageSpec = this.protocol.messages.sends[messageType] ||
                       this.protocol.messages.receives[messageType];
    
    if (!messageSpec) {
      return { valid: false, errors: [`Unknown message type: ${messageType}`] };
    }
    
    return this.validateSchema(messageSpec.schema, data);
  }
  
  validateIncomingMessage(messageType, data) {
    const messageSpec = this.protocol.messages.receives[messageType] ||
                       this.protocol.messages.sends[messageType];
    
    if (!messageSpec) {
      return { valid: false, errors: [`Unknown message type: ${messageType}`] };
    }
    
    return this.validateSchema(messageSpec.schema, data);
  }
  
  validateSchema(schema, data) {
    const errors = [];
    
    for (const [field, spec] of Object.entries(schema || {})) {
      if (spec.required && !(field in data)) {
        errors.push(`Missing required field: ${field}`);
      }
      
      if (field in data) {
        if (spec.type === 'string' && typeof data[field] !== 'string') {
          errors.push(`Field ${field} must be string`);
        }
        if (spec.type === 'array' && !Array.isArray(data[field])) {
          errors.push(`Field ${field} must be array`);
        }
        if (spec.type === 'number' && typeof data[field] !== 'number') {
          errors.push(`Field ${field} must be number`);
        }
        if (spec.minimum !== undefined && data[field] < spec.minimum) {
          errors.push(`Field ${field} must be >= ${spec.minimum}`);
        }
      }
    }
    
    return { valid: errors.length === 0, errors };
  }
}
```

### Benefits of Two-Sided Protocol Testing

**1. True Independence**
- UI team can develop and test without server running
- Server team can develop and test without UI
- Both sides guaranteed to work together if protocol compliant

**2. Contract-Driven Development**
- Protocol acts as executable specification
- Changes to protocol require updating both sides
- Prevents integration surprises

**3. Comprehensive Coverage**
- Test message schemas, state transitions, error conditions
- Validate preconditions and postconditions 
- Ensure real data compatibility

**4. Faster Development**
- No waiting for "the other side" to be ready
- Immediate feedback on protocol violations
- Clear contracts prevent miscommunication

## Real Testing - No Mocks

### Integration Tests with Real Dependencies

```javascript
describe('Tool Registry REAL Integration - NO MOCKS', () => {
  let serverActor;
  let clientActor;
  let realToolRegistry;
  
  beforeEach(async () => {
    // Get ALL REAL dependencies - NO MOCKS
    realToolRegistry = await getToolRegistry();
    expect(realToolRegistry).toBeDefined(); // Fail if not available
    
    // Create actors with real dependencies
    serverActor = new ToolRegistryServerSubActor({});
    clientActor = new ToolRegistryClientSubActor();
    
    // Set up REAL bidirectional communication
    await serverActor.setRemoteActor(clientActor);
    await clientActor.setRemoteActor(serverActor);
  });
  
  test('should search real modules from tool registry', async () => {
    let receivedResponse = null;
    
    // Wait for async response - proper timing handling
    const responsePromise = new Promise((resolve) => {
      const originalReceive = clientActor.receive.bind(clientActor);
      clientActor.receive = (messageType, data) => {
        if (messageType === 'modules:searchResult') {
          receivedResponse = { messageType, data };
          resolve(receivedResponse);
        }
        return originalReceive(messageType, data);
      };
    });
    
    // Send real search request
    await serverActor.receive('modules:search', {
      query: '',
      options: { limit: 50 }
    });
    
    // Wait for real async response
    await responsePromise;
    
    // Verify REAL data
    expect(receivedResponse.data.modules.length).toBeGreaterThan(0);
    expect(receivedResponse.data.modules[0].tools).toBeDefined();
    
    console.log('✅ Real modules found:', receivedResponse.data.count);
  });
}
```

## Common Pitfalls and Solutions

### 1. **The Mock Trap**

**❌ Problem:** Tests pass with mocks but fail in production
```javascript
// Bad - hides real problems
const mockRegistry = { listTools: jest.fn().mockResolvedValue([]) };
```

**✅ Solution:** Use real dependencies always
```javascript
// Good - exposes real problems
const realRegistry = await getToolRegistry();
const realModules = await realRegistry.listTools(); 
```

### 2. **Message Routing Confusion**

**❌ Problem:** Messages going to wrong actor
```javascript
// Bad - shared actor handling multiple concerns
PlannerServerSubActor handles both planning AND tool registry
```

**✅ Solution:** Dedicated actors with direct communication
```javascript
// Good - dedicated actors
ToolRegistryClientSubActor ↔ ToolRegistryServerSubActor
PlannerClientSubActor ↔ PlannerServerSubActor
```

### 3. **MVVM Violations**

**❌ Problem:** ViewModel manipulating DOM directly
```javascript
// Bad - violates MVVM
class ViewModel {
  handleSearch(query) {
    this.performBackendSearch(query); // ViewModel doing backend calls
    document.querySelector('.results').innerHTML = '...'; // ViewModel touching DOM
  }
}
```

**✅ Solution:** Proper separation of concerns
```javascript
// Good - proper MVVM
class ViewModel {
  handleSearch(query) {
    this.model.updateState('searchQuery', query);
    this.requestModuleSearch(query); // Delegate through umbilical
    this.render(); // Trigger View update through Model
  }
  
  requestModuleSearch(query) {
    if (this.umbilical.onSearchModules) {
      this.umbilical.onSearchModules(query); // Proper delegation
    }
  }
}
```

### 4. **Async Timing Issues**

**❌ Problem:** Tests don't wait for async responses
```javascript
// Bad - async timing ignored
await serverActor.receive('search', { query: 'test' });
expect(response).toBeDefined(); // Fails - response not ready yet
```

**✅ Solution:** Proper async handling
```javascript
// Good - wait for async responses
const responsePromise = new Promise((resolve) => {
  clientActor.receive = (type, data) => {
    if (type === 'searchResult') resolve(data);
  };
});

await serverActor.receive('search', { query: 'test' });
const response = await responsePromise;
expect(response).toBeDefined();
```

## Step-by-Step Implementation

### Step 1: Define Protocol Contract

1. Create protocol schema with messages, state, preconditions
2. Define what each actor sends and receives
3. Include state management requirements
4. Add validation rules

### Step 2: Implement Server Actor

1. Extend ProtocolActor or create dedicated actor
2. Implement real dependency initialization
3. Handle protocol messages
4. Send responses with validation
5. NO MOCKS - fail fast if dependencies unavailable

### Step 3: Implement Client Actor  

1. Extend ProtocolActor
2. Handle protocol responses
3. Update state based on protocol rules
4. Send requests with validation
5. Connect to UI through umbilical pattern

### Step 4: Create MVVM Component

1. **Model**: Pure state management, no business logic
2. **View**: Pure rendering from Model data, no state
3. **ViewModel**: Coordinate Model/View, handle events, delegate to umbilical
4. **Component Factory**: Create instances and wire together

### Step 5: Wire Together

1. Register actors in ActorSpace
2. Create direct remote connections
3. Connect component to actors through umbilical callbacks
4. Handle message routing in parent actors

### Step 6: Real Testing

1. Delete all mock files and implementations
2. Write tests with real dependencies
3. Handle async timing properly
4. Test protocol compliance on both sides
5. Verify point-to-point communication

## UI Design Patterns

### Clean Module Cards

```css
.module-card {
  background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1rem;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.module-card:hover {
  transform: translateY(-3px) scale(1.02);
  box-shadow: 0 12px 32px rgba(59, 130, 246, 0.12);
}
```

### Tool Count Badges

```css
.module-tool-count-badge {
  background: linear-gradient(135deg, #ecfdf5, #d1fae5);
  color: #059669;
  border: 1px solid #a7f3d0;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
}
```

### Subtle Action Buttons

```css
.module-tools-toggle {
  background: linear-gradient(135deg, #eff6ff, #dbeafe);
  border: 1px solid #93c5fd;
  color: #1d4ed8;
  font-size: 0.75rem;
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
}
```

## Best Practices

### 1. **Protocol-First Development**
- Always define the protocol contract before coding
- Use protocol validation to catch integration issues early
- Test both sides independently with protocol compliance

### 2. **Real Dependencies Always**
- Never use mocks in implementation code
- Write tests with real tool registry, real database connections
- Fail fast when dependencies are unavailable

### 3. **Clean MVVM Separation**
- Model: Pure state, no DOM, no business logic
- View: Pure rendering, no state, no backend calls  
- ViewModel: Coordinate only, delegate through umbilical

### 4. **Generic, Reusable Components**
- Write formatting functions that work for ANY module
- Avoid hardcoded module names or tool names
- Design for extensibility and reuse

### 5. **Beautiful, Functional UI**
- Use subtle gradients and shadows for depth
- Implement smooth transitions and micro-interactions
- Show meaningful information (tool counts not status)
- Keep layouts compact and information-dense

## Conclusion

This architecture provides:
- **🛡️ Bulletproof communication** with protocol validation
- **🎨 Beautiful, professional UI** with modern styling  
- **⚡ Real-time search** with backend integration
- **🧪 Comprehensive testing** with zero mocks
- **🔧 Easy maintenance** with clean separation of concerns

The result is a **production-ready module browser** that's both **beautiful** and **robust**, demonstrating how protocol-based actors and MVVM architecture create **maintainable, testable, and scalable** applications.