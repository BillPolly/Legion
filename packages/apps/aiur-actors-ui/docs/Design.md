# Aiur Actors UI - Design Document

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Actor Communication System](#actor-communication-system)
4. [Umbilical MVVM Components](#umbilical-mvvm-components)
5. [Server Integration](#server-integration)
6. [Communication Protocols](#communication-protocols)
7. [Component Specifications](#component-specifications)
8. [State Management](#state-management)
9. [Security Considerations](#security-considerations)
10. [Performance Considerations](#performance-considerations)
11. [Testing Strategy](#testing-strategy)
12. [Migration Path](#migration-path)
13. [Implementation Roadmap](#implementation-roadmap)

## Overview

Aiur Actors UI is a modern debugging interface for the Aiur server that combines the power of the Actor model for distributed communication with the Umbilical MVVM component architecture for creating testable, maintainable UI components.

### Goals

1. **Replace WebSocket direct messaging** with structured Actor-based communication
2. **Leverage Umbilical MVVM** for clean separation of concerns in UI components
3. **Maintain feature parity** with existing debug UI while improving UX
4. **Enable distributed debugging** across multiple sessions and clients
5. **Provide better testability** through component isolation and actor message mocking

### Key Technologies

- **@legion/actors**: Actor-based concurrency and messaging system
- **@legion/components**: Umbilical protocol MVVM component framework
- **WebSockets**: Transport layer for actor communication
- **ES6 Modules**: Modern JavaScript module system

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Browser Client                              │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │  UI Components   │  │  Actor System    │  │  State Manager  │    │
│  │  (Umbilical     │◄─┤  (Client-side    │◄─┤  (Session &     │    │
│  │   MVVM)         │  │   ActorSpace)    │  │   Tool State)   │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
│            ▲                    │                                    │
│            │                    │ WebSocket                          │
│            │                    ▼                                    │
├────────────┼────────────────────────────────────────────────────────┤
│            │              Aiur Server                                │
├────────────┼────────────────────────────────────────────────────────┤
│            │         ┌─────────────────┐                            │
│            └─────────┤  Actor System    │                            │
│                      │  (Server-side    │                            │
│                      │   ActorSpace)    │                            │
│                      └─────────────────┘                            │
│                               │                                      │
│  ┌─────────────────┐  ┌──────┴────────┐  ┌─────────────────┐     │
│  │  Tool Actor     │  │ Session Actor  │  │  Event Actor    │     │
│  │  (Executes      │  │ (Manages       │  │  (Streams       │     │
│  │   Legion tools) │  │  sessions)     │  │   updates)      │     │
│  └─────────────────┘  └────────────────┘  └─────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

### Layered Architecture

1. **Presentation Layer** (Umbilical MVVM Components)
   - View: DOM manipulation and event handling
   - ViewModel: Business logic and state coordination
   - Model: Data structures and validation

2. **Communication Layer** (Actor System)
   - Client ActorSpace: Manages client-side actors
   - Server ActorSpace: Manages server-side actors
   - Channel: WebSocket transport between spaces

3. **Service Layer**
   - Tool execution services
   - Session management
   - Context and variable management

4. **Protocol Layer**
   - Actor message serialization
   - Protocol version negotiation
   - Error handling and recovery

## Actor Communication System

### Actor Model Implementation

The system uses `@legion/actors` to implement location-transparent messaging between client and server.

#### Client-Side Actors

```javascript
// ClientCommandActor - Sends commands to server
class ClientCommandActor extends Actor {
  receive(message) {
    switch(message.type) {
      case 'execute':
        this.sendToServer({
          type: 'tool_execution',
          tool: message.tool,
          args: message.args,
          requestId: message.requestId
        });
        break;
      case 'response':
        this.handleResponse(message);
        break;
    }
  }
}

// UIUpdateActor - Receives UI updates from components
class UIUpdateActor extends Actor {
  receive(message) {
    switch(message.type) {
      case 'command_input':
        this.commandActor.receive({
          type: 'execute',
          tool: message.command,
          args: message.args
        });
        break;
      case 'refresh_tools':
        this.serverQueryActor.receive({ type: 'get_tools' });
        break;
    }
  }
}
```

#### Server-Side Actors

```javascript
// ToolExecutorActor - Executes Legion tools
class ToolExecutorActor extends Actor {
  constructor(toolRegistry) {
    super();
    this.toolRegistry = toolRegistry;
  }
  
  receive(message) {
    switch(message.type) {
      case 'tool_execution':
        const result = await this.executeTool(message.tool, message.args);
        this.reply({
          type: 'execution_result',
          requestId: message.requestId,
          result: result
        });
        break;
    }
  }
}

// SessionManagerActor - Manages client sessions
class SessionManagerActor extends Actor {
  receive(message) {
    switch(message.type) {
      case 'create_session':
        const session = this.createSession(message.clientId);
        this.reply({
          type: 'session_created',
          sessionId: session.id,
          tools: session.availableTools
        });
        break;
      case 'restore_session':
        // Handle session restoration
        break;
    }
  }
}
```

### Actor Space Configuration

```javascript
// Client-side setup
const clientSpace = new ActorSpace('ClientSpace');
const channel = clientSpace.addChannel(websocket);

// Register client actors
const commandActor = new ClientCommandActor();
clientSpace.register(commandActor, 'command-actor');

// Server-side setup
const serverSpace = new ActorSpace('ServerSpace');
serverSpace.addChannel(websocket);

// Register server actors
const toolActor = new ToolExecutorActor(toolRegistry);
serverSpace.register(toolActor, 'tool-executor');
```

## Umbilical MVVM Components

### Component Architecture

Each UI component follows the Umbilical protocol with MVVM internal architecture:

```javascript
// Terminal Component Structure
export const Terminal = MVVMComponentFactory.createComponent({
  ModelClass: TerminalModel,
  ViewClass: TerminalView,
  ViewModelClass: TerminalViewModel,
  
  defineRequirements(requirements) {
    requirements.add('dom', 'HTMLElement', 'Parent DOM element');
    requirements.add('actorSpace', 'ActorSpace', 'Actor communication space');
    requirements.add('onCommand', 'function', 'Command execution callback');
    requirements.add('theme', 'string', 'UI theme (light|dark)', false);
  },
  
  validateCapabilities(umbilical) {
    return {
      hasDom: !!umbilical.dom,
      hasActorSpace: !!umbilical.actorSpace && umbilical.actorSpace.isActorSpace,
      hasValidTheme: !umbilical.theme || ['light', 'dark'].includes(umbilical.theme)
    };
  }
});
```

### Core Components

#### 1. Terminal Component

**Purpose**: Main terminal interface for command input and output display

**Model**:
- Command history management
- Output buffer with scrollback
- Active command state
- Autocomplete suggestions

**View**:
- Command input field
- Output display area
- Autocomplete dropdown
- Progress indicators

**ViewModel**:
- Command parsing and validation
- Autocomplete logic
- Output formatting
- Actor message coordination

#### 2. ToolsPanel Component

**Purpose**: Display available tools with search and filtering

**Model**:
- Tool definitions map
- Search/filter state
- Category organization

**View**:
- Searchable tool list
- Category tabs
- Tool detail cards

**ViewModel**:
- Search implementation
- Tool selection handling
- Refresh coordination

#### 3. SessionPanel Component

**Purpose**: Manage and switch between active sessions

**Model**:
- Active sessions list
- Current session state
- Session metadata

**View**:
- Session list
- Current session indicator
- Session controls

**ViewModel**:
- Session switching logic
- Session creation/deletion
- State synchronization

#### 4. VariablesPanel Component

**Purpose**: Display and manage session variables and context

**Model**:
- Variable storage
- Context items
- Variable metadata

**View**:
- Variable tree view
- Value editors
- Search interface

**ViewModel**:
- Variable resolution
- Edit handling
- Refresh logic

### Component Communication

Components communicate through actors rather than direct coupling:

```javascript
// Terminal emits command through actor
terminalViewModel.executeCommand = (command, args) => {
  const commandActor = this.actorSpace.getActor('command-actor');
  commandActor.receive({
    type: 'execute',
    tool: command,
    args: args,
    source: 'terminal'
  });
};

// Tools panel receives updates through actor
toolsPanelViewModel.initialize = () => {
  const updateActor = this.actorSpace.getActor('ui-update-actor');
  updateActor.subscribe('tools_updated', (message) => {
    this.model.setTools(message.tools);
    this.render();
  });
};
```

## Server Integration

### WebSocket Endpoint

The Aiur server needs a new WebSocket endpoint specifically for actor communication:

```javascript
// In Aiur server
app.ws('/actors', (ws, req) => {
  // Create server-side ActorSpace for this connection
  const clientSpace = new ActorSpace(`Client-${generateId()}`);
  const channel = clientSpace.addChannel(ws);
  
  // Initialize server actors for this client
  const sessionActor = new SessionManagerActor(sessionManager);
  const toolActor = new ToolExecutorActor(toolRegistry);
  const eventActor = new EventStreamActor(eventEmitter);
  
  clientSpace.register(sessionActor, 'session-manager');
  clientSpace.register(toolActor, 'tool-executor');
  clientSpace.register(eventActor, 'event-stream');
  
  // Handle connection lifecycle
  ws.on('close', () => {
    clientSpace.destroy();
  });
});
```

### Integration with Existing Aiur Systems

```javascript
// Bridge between actor system and existing Aiur components
class AiurBridgeActor extends Actor {
  constructor(sessionManager, toolRegistry, moduleLoader) {
    super();
    this.sessionManager = sessionManager;
    this.toolRegistry = toolRegistry;
    this.moduleLoader = moduleLoader;
  }
  
  receive(message) {
    switch(message.type) {
      case 'load_module':
        const result = await this.moduleLoader.loadModule(message.moduleName);
        this.updateToolRegistry(result.tools);
        this.notifyClients({ type: 'module_loaded', tools: result.tools });
        break;
        
      case 'execute_tool':
        const session = this.sessionManager.getSession(message.sessionId);
        const tool = this.toolRegistry.getTool(message.toolName);
        const result = await tool.execute(message.args, session.context);
        this.reply({ type: 'execution_result', result });
        break;
    }
  }
}
```

## Communication Protocols

### Message Types

#### Client to Server Messages

```typescript
interface ClientMessage {
  type: 'session_create' | 'tool_execute' | 'tool_list' | 
        'module_load' | 'context_get' | 'variable_set';
  sessionId?: string;
  requestId: string;
  payload: any;
}

interface ToolExecuteMessage extends ClientMessage {
  type: 'tool_execute';
  payload: {
    toolName: string;
    arguments: Record<string, any>;
  };
}

interface ModuleLoadMessage extends ClientMessage {
  type: 'module_load';
  payload: {
    moduleName: string;
    options?: Record<string, any>;
  };
}
```

#### Server to Client Messages

```typescript
interface ServerMessage {
  type: 'response' | 'event' | 'error';
  requestId?: string;
  payload: any;
}

interface ToolResultMessage extends ServerMessage {
  type: 'response';
  payload: {
    success: boolean;
    result?: any;
    error?: string;
  };
}

interface EventMessage extends ServerMessage {
  type: 'event';
  payload: {
    eventType: 'tool_added' | 'module_loaded' | 'session_updated';
    data: any;
  };
}
```

### Actor Message Serialization

The actor system handles serialization automatically, but we define schemas for validation:

```javascript
// Message validation schemas
const messageSchemas = {
  tool_execute: {
    type: 'object',
    required: ['toolName', 'arguments'],
    properties: {
      toolName: { type: 'string' },
      arguments: { type: 'object' }
    }
  },
  
  execution_result: {
    type: 'object',
    required: ['success'],
    properties: {
      success: { type: 'boolean' },
      result: { type: 'any' },
      error: { type: 'string' }
    }
  }
};
```

## Component Specifications

### Terminal Component Detailed Specification

```javascript
// TerminalModel.js
export class TerminalModel extends BaseModel {
  constructor(initialData, config) {
    super(initialData, config);
    
    // Initialize terminal-specific state
    this.setState('history', []);
    this.setState('currentCommand', '');
    this.setState('outputBuffer', []);
    this.setState('autocompleteIndex', -1);
    this.setState('suggestions', []);
  }
  
  addToHistory(command) {
    const history = this.getState('history');
    history.push({
      id: generateId(),
      command,
      timestamp: Date.now()
    });
    this.setState('history', history);
  }
  
  addOutput(content, type = 'info') {
    const buffer = this.getState('outputBuffer');
    buffer.push({
      id: generateId(),
      content,
      type, // 'command', 'result', 'error', 'info'
      timestamp: Date.now()
    });
    
    // Limit buffer size
    if (buffer.length > 1000) {
      buffer.splice(0, buffer.length - 1000);
    }
    
    this.setState('outputBuffer', buffer);
  }
}

// TerminalView.js
export class TerminalView extends BaseView {
  constructor(dom, config) {
    super(dom, config);
    this.setupDOM();
    this.attachEventListeners();
  }
  
  setupDOM() {
    this.dom.innerHTML = `
      <div class="terminal-container">
        <div class="terminal-output" id="output"></div>
        <div class="terminal-input-container">
          <div class="terminal-prompt">aiur&gt;</div>
          <div class="terminal-input-wrapper">
            <input type="text" class="terminal-input" id="input" />
            <div class="terminal-ghost-text" id="ghost"></div>
          </div>
          <div class="terminal-autocomplete" id="autocomplete"></div>
        </div>
      </div>
    `;
    
    this.elements = {
      output: this.dom.querySelector('#output'),
      input: this.dom.querySelector('#input'),
      ghost: this.dom.querySelector('#ghost'),
      autocomplete: this.dom.querySelector('#autocomplete')
    };
  }
  
  renderOutput(outputBuffer) {
    this.elements.output.innerHTML = outputBuffer
      .map(entry => `
        <div class="output-entry output-${entry.type}">
          <span class="output-timestamp">${formatTime(entry.timestamp)}</span>
          <span class="output-content">${escapeHtml(entry.content)}</span>
        </div>
      `)
      .join('');
    
    // Auto-scroll to bottom
    this.elements.output.scrollTop = this.elements.output.scrollHeight;
  }
  
  renderAutocomplete(suggestions, selectedIndex) {
    if (suggestions.length === 0) {
      this.elements.autocomplete.style.display = 'none';
      return;
    }
    
    this.elements.autocomplete.style.display = 'block';
    this.elements.autocomplete.innerHTML = suggestions
      .map((suggestion, index) => `
        <div class="autocomplete-item ${index === selectedIndex ? 'selected' : ''}"
             data-index="${index}">
          <span class="autocomplete-text">${suggestion.text}</span>
          <span class="autocomplete-type">${suggestion.type}</span>
        </div>
      `)
      .join('');
  }
}

// TerminalViewModel.js
export class TerminalViewModel extends BaseViewModel {
  constructor(model, view, config) {
    super(model, view, config);
    
    // Get actor references
    this.commandActor = config.actorSpace.getActor('command-actor');
    this.responseActor = config.actorSpace.getActor('response-actor');
    
    // Subscribe to responses
    this.responseActor.subscribe('command_result', this.handleCommandResult.bind(this));
    
    // Initialize autocomplete
    this.autocomplete = new AutocompleteService(config.tools);
  }
  
  handleInput(value) {
    this.model.setState('currentCommand', value);
    
    // Update autocomplete
    const suggestions = this.autocomplete.getSuggestions(value);
    this.model.setState('suggestions', suggestions);
    
    // Update ghost text
    if (suggestions.length > 0) {
      this.view.updateGhostText(suggestions[0].text.slice(value.length));
    }
  }
  
  handleKeyDown(event) {
    switch(event.key) {
      case 'Enter':
        this.executeCommand();
        break;
      case 'Tab':
        event.preventDefault();
        this.acceptAutocomplete();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.navigateHistory(-1);
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.navigateHistory(1);
        break;
    }
  }
  
  executeCommand() {
    const command = this.model.getState('currentCommand');
    if (!command.trim()) return;
    
    // Add to history and output
    this.model.addToHistory(command);
    this.model.addOutput(`> ${command}`, 'command');
    
    // Parse and execute
    const parsed = this.parseCommand(command);
    
    // Send to command actor
    this.commandActor.receive({
      type: 'execute',
      tool: parsed.tool,
      args: parsed.args,
      requestId: generateId()
    });
    
    // Clear input
    this.model.setState('currentCommand', '');
    this.view.clearInput();
  }
  
  handleCommandResult(message) {
    const { result, error } = message;
    
    if (error) {
      this.model.addOutput(error, 'error');
    } else {
      this.model.addOutput(JSON.stringify(result, null, 2), 'result');
    }
    
    this.render();
  }
}
```

### Component Factory Configuration

```javascript
// Create all components with proper configuration
export function createUIComponents(actorSpace, config = {}) {
  const components = {};
  
  // Terminal Component
  components.terminal = Terminal.create({
    dom: document.getElementById('terminal-container'),
    actorSpace: actorSpace,
    theme: config.theme || 'dark',
    onCommand: (cmd) => console.log('Command:', cmd),
    onError: (err) => console.error('Terminal error:', err)
  });
  
  // Tools Panel
  components.toolsPanel = ToolsPanel.create({
    dom: document.getElementById('tools-container'),
    actorSpace: actorSpace,
    onToolSelect: (tool) => {
      components.terminal.insertCommand(tool.name);
    }
  });
  
  // Session Panel
  components.sessionPanel = SessionPanel.create({
    dom: document.getElementById('sessions-container'),
    actorSpace: actorSpace,
    onSessionChange: (sessionId) => {
      // Update all components with new session
      Object.values(components).forEach(component => {
        if (component.setSession) {
          component.setSession(sessionId);
        }
      });
    }
  });
  
  // Variables Panel
  components.variablesPanel = VariablesPanel.create({
    dom: document.getElementById('variables-container'),
    actorSpace: actorSpace,
    onVariableSelect: (variable) => {
      components.terminal.insertText(`@${variable.name}`);
    }
  });
  
  return components;
}
```

## State Management

### Client-Side State

State is managed at multiple levels:

1. **Component State** - Local to each MVVM component
2. **Session State** - Shared across components for a session
3. **Global State** - Application-wide settings and cache

```javascript
// SessionState.js
export class SessionState {
  constructor(sessionId, actorSpace) {
    this.sessionId = sessionId;
    this.actorSpace = actorSpace;
    
    this.state = {
      tools: new Map(),
      variables: new Map(),
      context: new Map(),
      history: [],
      activeModules: new Set()
    };
    
    // Subscribe to state updates from server
    this.stateActor = actorSpace.getActor('state-actor');
    this.stateActor.subscribe('state_update', this.handleStateUpdate.bind(this));
  }
  
  handleStateUpdate(message) {
    const { type, data } = message;
    
    switch(type) {
      case 'tools_changed':
        this.updateTools(data.tools);
        this.notifyComponents('tools', this.state.tools);
        break;
        
      case 'variable_changed':
        this.state.variables.set(data.name, data.value);
        this.notifyComponents('variables', this.state.variables);
        break;
    }
  }
  
  notifyComponents(stateType, data) {
    // Emit state change event that components can listen to
    this.emit('stateChanged', { type: stateType, data });
  }
}
```

### Server-Side State Synchronization

```javascript
// StateSyncActor.js (server-side)
export class StateSyncActor extends Actor {
  constructor(sessionManager) {
    super();
    this.sessionManager = sessionManager;
    
    // Listen for state changes
    sessionManager.on('stateChanged', this.handleStateChange.bind(this));
  }
  
  receive(message) {
    switch(message.type) {
      case 'subscribe':
        this.addSubscriber(message.sessionId, message.source);
        this.sendInitialState(message.sessionId);
        break;
        
      case 'unsubscribe':
        this.removeSubscriber(message.sessionId, message.source);
        break;
    }
  }
  
  handleStateChange(event) {
    const { sessionId, type, data } = event;
    
    // Notify all subscribers for this session
    const subscribers = this.getSubscribers(sessionId);
    subscribers.forEach(subscriber => {
      subscriber.receive({
        type: 'state_update',
        stateType: type,
        data: data
      });
    });
  }
}
```

## Security Considerations

### Authentication and Authorization

1. **Session Tokens**: Each client receives a unique session token
2. **Actor Identity**: Actors are authenticated before registration
3. **Message Validation**: All messages are validated against schemas
4. **Rate Limiting**: Command execution is rate-limited per session

```javascript
// Security middleware for actor messages
class SecurityActor extends Actor {
  receive(message) {
    // Validate session token
    if (!this.validateSession(message.sessionId, message.token)) {
      return this.reply({ type: 'error', error: 'Invalid session' });
    }
    
    // Check permissions
    if (!this.checkPermissions(message.sessionId, message.type)) {
      return this.reply({ type: 'error', error: 'Insufficient permissions' });
    }
    
    // Rate limiting
    if (!this.checkRateLimit(message.sessionId)) {
      return this.reply({ type: 'error', error: 'Rate limit exceeded' });
    }
    
    // Forward to actual handler
    this.forward(message);
  }
}
```

### Input Sanitization

All user input is sanitized before processing:

```javascript
// Input sanitization utilities
export const sanitize = {
  command: (input) => {
    // Remove potentially dangerous characters
    return input.replace(/[<>'"]/g, '');
  },
  
  arguments: (args) => {
    // Deep sanitize object arguments
    return JSON.parse(JSON.stringify(args, (key, value) => {
      if (typeof value === 'string') {
        return sanitize.command(value);
      }
      return value;
    }));
  }
};
```

## Performance Considerations

### Message Batching

To reduce WebSocket traffic, messages can be batched:

```javascript
// MessageBatcher.js
export class MessageBatcher {
  constructor(actor, options = {}) {
    this.actor = actor;
    this.batchSize = options.batchSize || 10;
    this.batchTimeout = options.batchTimeout || 100;
    this.queue = [];
    this.timer = null;
  }
  
  send(message) {
    this.queue.push(message);
    
    if (this.queue.length >= this.batchSize) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.batchTimeout);
    }
  }
  
  flush() {
    if (this.queue.length === 0) return;
    
    this.actor.receive({
      type: 'batch',
      messages: this.queue
    });
    
    this.queue = [];
    clearTimeout(this.timer);
    this.timer = null;
  }
}
```

### Component Rendering Optimization

```javascript
// Debounced rendering for high-frequency updates
export class DebouncedRenderer {
  constructor(renderFn, delay = 16) { // ~60fps
    this.renderFn = renderFn;
    this.delay = delay;
    this.pending = false;
    this.args = null;
  }
  
  render(...args) {
    this.args = args;
    
    if (!this.pending) {
      this.pending = true;
      requestAnimationFrame(() => {
        this.renderFn(...this.args);
        this.pending = false;
      });
    }
  }
}
```

### Memory Management

```javascript
// Circular buffer for output history
export class CircularBuffer {
  constructor(maxSize = 1000) {
    this.buffer = new Array(maxSize);
    this.maxSize = maxSize;
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }
  
  push(item) {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.maxSize;
    
    if (this.size < this.maxSize) {
      this.size++;
    } else {
      this.head = (this.head + 1) % this.maxSize;
    }
  }
  
  toArray() {
    const result = [];
    let i = this.head;
    let count = 0;
    
    while (count < this.size) {
      result.push(this.buffer[i]);
      i = (i + 1) % this.maxSize;
      count++;
    }
    
    return result;
  }
}
```

## Testing Strategy

### Unit Testing

Each component and actor is tested in isolation:

```javascript
// TerminalModel.test.js
describe('TerminalModel', () => {
  let model;
  
  beforeEach(() => {
    model = new TerminalModel();
  });
  
  test('adds commands to history', () => {
    model.addToHistory('test command');
    const history = model.getState('history');
    
    expect(history).toHaveLength(1);
    expect(history[0].command).toBe('test command');
  });
  
  test('limits output buffer size', () => {
    for (let i = 0; i < 1100; i++) {
      model.addOutput(`Line ${i}`);
    }
    
    const buffer = model.getState('outputBuffer');
    expect(buffer).toHaveLength(1000);
    expect(buffer[0].content).toBe('Line 100');
  });
});

// CommandActor.test.js
describe('CommandActor', () => {
  let actor;
  let mockSpace;
  
  beforeEach(() => {
    mockSpace = createMockActorSpace();
    actor = new CommandActor();
    mockSpace.register(actor, 'command-actor');
  });
  
  test('handles execute message', async () => {
    const mockReply = jest.fn();
    actor.reply = mockReply;
    
    actor.receive({
      type: 'execute',
      tool: 'file_read',
      args: { path: '/test.txt' }
    });
    
    await waitFor(() => {
      expect(mockReply).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'execution_result'
        })
      );
    });
  });
});
```

### Integration Testing

Test component and actor integration:

```javascript
// TerminalIntegration.test.js
describe('Terminal Integration', () => {
  let container;
  let actorSpace;
  let terminal;
  
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    
    actorSpace = new ActorSpace('TestSpace');
    setupMockActors(actorSpace);
    
    terminal = Terminal.create({
      dom: container,
      actorSpace: actorSpace
    });
  });
  
  test('executes commands through actors', async () => {
    const input = container.querySelector('.terminal-input');
    const output = container.querySelector('.terminal-output');
    
    // Type and execute command
    fireEvent.change(input, { target: { value: 'test_tool arg1' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    // Wait for actor communication and rendering
    await waitFor(() => {
      expect(output.textContent).toContain('> test_tool arg1');
      expect(output.textContent).toContain('Tool executed successfully');
    });
  });
});
```

### End-to-End Testing

Full system tests with real WebSocket connections:

```javascript
// e2e/FullSystem.test.js
describe('Full System E2E', () => {
  let server;
  let client;
  
  beforeAll(async () => {
    // Start test server
    server = await startTestAiurServer({ port: 9999 });
    
    // Create client page
    client = await createTestClient('http://localhost:9999');
  });
  
  test('complete workflow', async () => {
    // Connect to server
    await client.connect();
    
    // Load module
    await client.executeCommand('module_load file');
    await client.waitForToolsUpdate();
    
    // Execute tool
    const result = await client.executeCommand('file_read /test.txt');
    expect(result).toContain('File contents');
    
    // Check session state
    const variables = await client.getVariables();
    expect(variables).toHaveProperty('lastResult');
  });
});
```

## Migration Path

### Phase 1: Parallel Implementation
- Implement new UI alongside existing debug UI
- Share the same Aiur server backend
- Allow users to choose between UIs

### Phase 2: Feature Parity
- Ensure all features from old UI are available
- Implement any missing functionality
- Gather user feedback

### Phase 3: Migration Tools
- Provide session migration utilities
- Export/import saved commands
- Transfer user preferences

### Phase 4: Deprecation
- Mark old UI as deprecated
- Provide migration timeline
- Remove old UI in next major version

### Migration Utilities

```javascript
// Migration helper
export class DebugUIMigration {
  static async migrateSession(oldSessionId) {
    // Load old session data
    const oldData = await loadOldSession(oldSessionId);
    
    // Convert to new format
    const newSession = {
      id: generateId(),
      tools: oldData.toolDefinitions,
      variables: oldData.variables,
      history: oldData.commandHistory.map(cmd => ({
        command: cmd,
        timestamp: Date.now()
      }))
    };
    
    // Save in new format
    await saveNewSession(newSession);
    
    return newSession.id;
  }
  
  static async migratePreferences(oldPrefs) {
    return {
      theme: oldPrefs.theme || 'dark',
      fontSize: oldPrefs.fontSize || 14,
      keyBindings: oldPrefs.keyBindings || 'default',
      autoComplete: oldPrefs.autoComplete !== false
    };
  }
}
```

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Set up package structure
- [ ] Implement basic Actor communication
- [ ] Create WebSocket endpoint on Aiur server
- [ ] Build minimal Terminal component
- [ ] Establish client-server actor bridge

### Phase 2: Core Components (Week 3-4)
- [ ] Complete Terminal component with MVVM
- [ ] Implement ToolsPanel component
- [ ] Build SessionPanel component
- [ ] Create VariablesPanel component
- [ ] Add component communication via actors

### Phase 3: Advanced Features (Week 5-6)
- [ ] Implement autocomplete system
- [ ] Add syntax highlighting
- [ ] Build command history navigation
- [ ] Create session persistence
- [ ] Add real-time updates

### Phase 4: Polish and Testing (Week 7-8)
- [ ] Comprehensive unit tests
- [ ] Integration test suite
- [ ] Performance optimization
- [ ] UI polish and theming
- [ ] Documentation completion

### Phase 5: Migration and Deployment (Week 9-10)
- [ ] Migration utilities
- [ ] User documentation
- [ ] Deployment scripts
- [ ] Performance benchmarking
- [ ] User acceptance testing

## Conclusion

Aiur Actors UI represents a significant architectural improvement over the existing debug UI. By leveraging the Actor model for communication and Umbilical MVVM for component architecture, we achieve:

1. **Better Separation of Concerns**: Clear boundaries between communication, business logic, and presentation
2. **Enhanced Testability**: Every component and actor can be tested in isolation
3. **Improved Scalability**: Actor model enables distributed debugging scenarios
4. **Modern Development Experience**: Clean APIs, proper typing, and consistent patterns
5. **Future-Proof Architecture**: Easy to extend with new features and components

The implementation roadmap provides a clear path forward while maintaining the ability to run both UIs in parallel during the transition period.