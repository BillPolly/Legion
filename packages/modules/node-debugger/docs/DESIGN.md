# Node Debugger - MVP Design Document

## MVP Scope

This is an **MVP (Minimum Viable Product)** implementation focused on core debugging functionality. Non-functional requirements such as performance optimization, security hardening, or production scaling are **explicitly out of scope** for this initial version.

## Conceptual Overview & Motivation

### The Node.js Debugging Challenge

Current Node.js debugging approaches have fundamental limitations for AI agents:

- **Static analysis tools** (ESLint, AST parsers) see code structure but miss runtime behavior
- **Runtime debuggers** (Node Inspector, VS Code) see live state but require manual interaction
- **Logging systems** capture output but lack introspection capabilities
- **No unified query interface** for both static code structure AND runtime state
- **No programmatic event subscription** for debugging events
- **Agent-unfriendly interfaces** requiring human interaction

### The Node Debugger Solution

The `@legion/node-debugger` provides **unified introspection and control** of Node.js processes through Legion's handle architecture:

1. **NodeProcessHandle**: Running Node.js process becomes a queryable, controllable handle
2. **Unified Query Engine**: Single interface for static (Tree-sitter AST) and runtime (V8 Inspector) queries
3. **Handle Projection**: Create specialized handles for breakpoints, variables, functions from the process handle
4. **Event Subscription**: Subscribe to debugging events through Legion's actor protocol
5. **Agent-First Design**: All operations designed for programmatic use by AI agents

### Key Innovation: Handle Projection with Event Subscription

The critical innovation is **projecting specialized handles from the main process handle** that agents can subscribe to:

```javascript
// Agent starts debugging session
const processHandle = await node_start_debug('/path/to/script.js');

// Agent queries both static and runtime state
const functions = await node_query(processHandle, 'ast.functions');
const callStack = await node_query(processHandle, 'runtime.callStack');

// Agent creates projected handles for specific debugging objects
const breakpointHandle = await node_project_breakpoint(processHandle, 'myFunction', 15);
const variableHandle = await node_project_variable(processHandle, 'userId');

// Agent subscribes to events on projected handles
await node_subscribe(breakpointHandle, 'hit', (context) => {
  console.log('Breakpoint hit!', context);
});

await node_subscribe(variableHandle, 'changed', (oldVal, newVal) => {
  console.log('Variable changed:', oldVal, '->', newVal);
});
```

## Technical Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Node Debugger Module                          │
│                      (Legion Backend)                            │
├───────────────────────────────────────────────────────────────────┤
│                        Legion Tools Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ node_start_  │  │ node_query   │  │ node_project │          │
│  │ debug        │  │              │  │ _breakpoint  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
├───────────────────────────────────────────────────────────────────┤
│                    Core Management Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Process    │  │    Query     │  │    Handle    │          │
│  │   Manager    │  │   Engine     │  │  Projector   │          │
│  │ (node-runner)│  │              │  │              │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Inspector   │  │     AST      │  │   Event      │          │
│  │   Manager    │  │   Manager    │  │ Subscription │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
├───────────────────────────────────────────────────────────────────┤
│                   Integration Layer                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │     V8       │  │ Tree-sitter  │  │    Legion    │          │
│  │  Inspector   │  │     AST      │  │    Handle    │          │
│  │  Protocol    │  │   Parsing    │  │   System     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└───────────────────────────────────────────────────────────────────┘
```

### Data Flow Architecture

```
Node.js Process (--inspect)            Tree-sitter Parser
        │                                      │
        │ V8 Inspector Protocol                │ Static AST
        │                                      │
        ▼                                      ▼
Inspector Manager ◄────── Query Engine ──────► AST Manager
        │                     │                     │
        └──────┬──────────────┼──────────────┬──────┘
               │              │              │
               ▼              ▼              ▼
        Handle Projector ◄────────────► Event Subscription
               │                             │
               ▼                             ▼
    Projected Handles ◄──────────────► Actor Protocol
  (Breakpoints, Variables, Functions)    (Legion Events)
```

## Architecture Components

### 1. NodeDebugServerActor (Server-Side Actor)

**Purpose**: Server-side actor that manages real Node.js debugging sessions and creates handle objects

```javascript
class NodeDebugServerActor {
  constructor(services) {
    this.services = services;
    this.remoteActor = null;
    this.nodeRunner = services.nodeRunner;
    this.inspectorManager = new InspectorManager();
    this.astManager = new ASTManager();
    this.queryEngine = new QueryEngine(this.astManager, this.inspectorManager);
    this.handleProjector = new HandleProjector();
    this.activeProcesses = new Map(); // processId -> NodeProcessHandle
  }
  
  // Standard actor methods
  async setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
  }
  
  async receive(messageType, data) {
    switch (messageType) {
      case 'debug:start':
        return await this.handleStartDebug(data);
      case 'debug:query':
        return await this.handleQuery(data);
      case 'debug:project':
        return await this.handleProject(data);
      case 'debug:step':
        return await this.handleStep(data);
      case 'debug:execute':
        return await this.handleExecute(data);
    }
  }
  
  async handleStartDebug({ scriptPath, debugPort, breakOnStart, workingDir, env, sessionName }) {
    // Use node-runner to start process with inspector flags
    const runResult = await this.nodeRunner.processManager.start({
      command: 'node',
      args: [`--inspect-brk=${debugPort}`, scriptPath],
      workingDir,
      env
    });
    
    // Connect Inspector and parse AST
    await this.inspectorManager.connect(runResult.processId, debugPort);
    await this.astManager.parseFile(scriptPath);
    
    // Create handle object (NOT extending Actor - it's data managed by actor)
    const processHandle = this.createNodeProcessHandle(runResult);
    this.activeProcesses.set(runResult.processId, processHandle);
    
    // Send handle metadata to client for proxy creation
    await this.remoteActor.receive('resource:handle', {
      handleId: processHandle.handleId,
      resourceType: 'NodeProcessHandle',
      metadata: {
        processId: runResult.processId,
        sessionId: runResult.sessionId,
        debugPort,
        scriptPath
      }
    });
    
    return processHandle.getSerializationData();
  }
  
  createNodeProcessHandle(runResult) {
    const handleId = this.generateHandleId();
    
    return {
      handleId,
      resourceType: 'NodeProcessHandle',
      processId: runResult.processId,
      sessionId: runResult.sessionId,
      
      // Handle methods (called by transparent proxy via actor protocol)
      async query(queryPath, context = {}) {
        return await this.services.queryEngine.execute(queryPath, {
          processId: this.processId,
          ...context
        });
      },
      
      async project(type, ...args) {
        return await this.services.handleProjector.project(this, type, ...args);
      },
      
      async step(stepType) {
        const session = this.services.inspectorManager.getSession(this.processId);
        return await session.post(`Debugger.${stepType}`);
      },
      
      async execute(expression, context = {}) {
        const session = this.services.inspectorManager.getSession(this.processId);
        return await session.post('Runtime.evaluate', {
          expression,
          ...context
        });
      },
      
      async destroy() {
        await this.services.nodeRunner.processManager.stop(this.processId);
        await this.services.inspectorManager.disconnect(this.processId);
        this.services.activeProcesses.delete(this.processId);
      },
      
      getSerializationData() {
        return {
          handleId: this.handleId,
          resourceType: this.resourceType,
          processId: this.processId,
          sessionId: this.sessionId
        };
      }
    };
  }
}
```

**Integration with Legion Handle System**:
- Server actor creates handle objects (not Actor instances)
- ResourceHandleManager tracks handle lifecycle
- TransparentResourceProxy routes method calls through actor protocol
- Handle methods execute on server through NodeDebugServerActor

### 2. Query Engine (Unified Static + Runtime Queries)

**Purpose**: Single interface for querying both static code structure AND live runtime state

```javascript
class QueryEngine {
  constructor(astManager, inspectorManager) {
    this.ast = astManager;
    this.inspector = inspectorManager;
  }
  
  async execute(queryPath, context = {}) {
    const parts = queryPath.split('.');
    const domain = parts[0]; // 'ast' or 'runtime'
    const query = parts.slice(1).join('.');
    
    switch (domain) {
      case 'ast':
        return await this.ast.query(query, context);
      case 'runtime':
        return await this.inspector.query(query, context);
      default:
        throw new Error(`Unknown query domain: ${domain}`);
    }
  }
}
```

**Query Examples**:
```javascript
// Static code structure queries
await node_query(handle, 'ast.functions');                    // All function definitions
await node_query(handle, 'ast.functions.myFunction.params');  // Function parameters
await node_query(handle, 'ast.imports');                      // Import statements
await node_query(handle, 'ast.classes.MyClass.methods');      // Class methods

// Runtime state queries
await node_query(handle, 'runtime.callStack');               // Current call stack
await node_query(handle, 'runtime.locals');                  // Local variables
await node_query(handle, 'runtime.globals.process.env');     // Environment variables
await node_query(handle, 'runtime.heap.objects');           // Memory objects

// Combined queries
await node_query(handle, 'ast.functions', { 
  filter: (fn) => fn.name.includes('test') 
});
```

### 3. AST Manager (Static Code Analysis)

**Purpose**: Provides Tree-sitter based static analysis of source code

```javascript
class ASTManager {
  constructor() {
    this.parser = new Parser();
    this.parser.setLanguage(JavaScript);
    this.asts = new Map(); // filePath -> parsed AST
  }
  
  async parseFile(filePath) {
    const source = await readFile(filePath, 'utf8');
    const ast = this.parser.parse(source);
    this.asts.set(filePath, { ast, source });
    return ast;
  }
  
  async query(queryPath, context = {}) {
    const parts = queryPath.split('.');
    const operation = parts[0];
    
    switch (operation) {
      case 'functions':
        return this.extractFunctions(context.filePath);
      case 'classes':
        return this.extractClasses(context.filePath);
      case 'imports':
        return this.extractImports(context.filePath);
      case 'exports':
        return this.extractExports(context.filePath);
      default:
        return this.executeTreeSitterQuery(queryPath, context);
    }
  }
  
  extractFunctions(filePath) {
    const { ast } = this.asts.get(filePath);
    const functions = [];
    
    // Tree-sitter query for function declarations
    const query = this.parser.getLanguage().query(`
      (function_declaration name: (identifier) @name
        parameters: (formal_parameters) @params
        body: (statement_block) @body) @function
    `);
    
    const captures = query.captures(ast.rootNode);
    // Process captures to extract function metadata
    return functions;
  }
}
```

### 4. Inspector Manager (V8 Debugger Integration)

**Purpose**: Manages V8 Inspector connections and runtime introspection

```javascript
class InspectorManager {
  constructor() {
    this.sessions = new Map(); // processId -> Inspector session
    this.breakpoints = new Map();
    this.watchers = new Map();
  }
  
  async connect(processId, debugPort = 9229) {
    const session = new inspector.Session();
    session.connect(debugPort);
    
    // Enable debugging domains
    await session.post('Debugger.enable');
    await session.post('Runtime.enable');
    await session.post('Profiler.enable');
    
    this.sessions.set(processId, session);
    return session;
  }
  
  async query(queryPath, context = {}) {
    const session = this.sessions.get(context.processId);
    const parts = queryPath.split('.');
    const operation = parts[0];
    
    switch (operation) {
      case 'callStack':
        const { result } = await session.post('Debugger.pauseOnExceptions', { state: 'none' });
        return await session.post('Debugger.getStackTrace');
        
      case 'locals':
        return await this.getLocalVariables(session);
        
      case 'globals':
        return await this.getGlobalVariables(session, parts.slice(1));
        
      case 'heap':
        return await this.getHeapSnapshot(session);
        
      default:
        throw new Error(`Unknown runtime query: ${operation}`);
    }
  }
  
  async setBreakpoint(filePath, lineNumber) {
    const breakpointId = generateId();
    const session = this.getCurrentSession();
    
    const { result } = await session.post('Debugger.setBreakpointByUrl', {
      lineNumber: lineNumber - 1, // V8 uses 0-based line numbers
      url: `file://${filePath}`
    });
    
    this.breakpoints.set(breakpointId, {
      id: breakpointId,
      v8BreakpointId: result.breakpointId,
      filePath,
      lineNumber
    });
    
    return breakpointId;
  }
}
```

### 5. Handle Projector (Specialized Handle Creation)

**Purpose**: Creates specialized handles from the main process handle for specific debugging objects

```javascript
class HandleProjector {
  constructor(handleRegistry) {
    this.registry = handleRegistry;
    this.projectedHandles = new Map();
  }
  
  async project(processHandle, type, ...args) {
    const projectionId = generateId();
    
    let projectedHandle;
    switch (type) {
      case 'breakpoint':
        projectedHandle = await this.createBreakpointHandle(processHandle, ...args);
        break;
      case 'variable':
        projectedHandle = await this.createVariableHandle(processHandle, ...args);
        break;
      case 'function':
        projectedHandle = await this.createFunctionHandle(processHandle, ...args);
        break;
      default:
        throw new Error(`Unknown projection type: ${type}`);
    }
    
    // Register with handle system
    const handleId = this.registry.create(`${type}-${projectionId}`, projectedHandle);
    this.projectedHandles.set(projectionId, { handleId, type, handle: projectedHandle });
    
    return projectedHandle;
  }
  
  async createBreakpointHandle(processHandle, filePath, lineNumber) {
    const breakpointId = await processHandle.inspector.setBreakpoint(filePath, lineNumber);
    
    return new BreakpointHandle({
      breakpointId,
      filePath,
      lineNumber,
      processHandle,
      events: ['hit', 'removed', 'enabled', 'disabled']
    });
  }
  
  async createVariableHandle(processHandle, variableName, scope = 'local') {
    return new VariableHandle({
      variableName,
      scope,
      processHandle,
      events: ['changed', 'created', 'destroyed']
    });
  }
  
  async createFunctionHandle(processHandle, functionName) {
    return new FunctionHandle({
      functionName,
      processHandle,
      events: ['called', 'returned', 'exception']
    });
  }
}
```

### 6. Projected Handle Objects (Created by Server Actor)

**BreakpointHandle** (Handle object managed by NodeDebugServerActor):
```javascript
// Created by NodeDebugServerActor.createBreakpointHandle()
const breakpointHandle = {
  handleId: generateHandleId(),
  resourceType: 'BreakpointHandle',
  breakpointId,
  filePath,
  lineNumber,
  processId,
  supportedEvents: ['hit', 'enabled', 'disabled', 'removed'],
  
  // Methods called via transparent proxy → actor protocol → server actor
  async enable() {
    const serverActor = this.getServerActor();
    await serverActor.inspectorManager.enableBreakpoint(this.breakpointId);
    
    // Emit event through actor protocol
    await serverActor.remoteActor.receive('handle:event', {
      handleId: this.handleId,
      eventName: 'enabled',
      data: { breakpointId: this.breakpointId }
    });
  },
  
  async disable() {
    const serverActor = this.getServerActor();
    await serverActor.inspectorManager.disableBreakpoint(this.breakpointId);
    
    await serverActor.remoteActor.receive('handle:event', {
      handleId: this.handleId,
      eventName: 'disabled', 
      data: { breakpointId: this.breakpointId }
    });
  },
  
  async remove() {
    const serverActor = this.getServerActor();
    await serverActor.inspectorManager.removeBreakpoint(this.breakpointId);
    
    await serverActor.remoteActor.receive('handle:event', {
      handleId: this.handleId,
      eventName: 'removed',
      data: { breakpointId: this.breakpointId }
    });
  }
};
```

**VariableHandle** (Handle object managed by NodeDebugServerActor):
```javascript
const variableHandle = {
  handleId: generateHandleId(),
  resourceType: 'VariableHandle', 
  variableName,
  scope,
  processId,
  supportedEvents: ['changed', 'created', 'destroyed'],
  
  async getValue() {
    const serverActor = this.getServerActor();
    const session = serverActor.inspectorManager.getSession(this.processId);
    const result = await session.post('Runtime.evaluate', {
      expression: this.variableName
    });
    return result.result.value;
  },
  
  async setValue(newValue) {
    const serverActor = this.getServerActor();
    const session = serverActor.inspectorManager.getSession(this.processId);
    
    const oldValue = await this.getValue();
    await session.post('Runtime.evaluate', {
      expression: `${this.variableName} = ${JSON.stringify(newValue)}`
    });
    
    // Emit change event through actor protocol
    await serverActor.remoteActor.receive('handle:event', {
      handleId: this.handleId,
      eventName: 'changed',
      data: { oldValue, newValue, variable: this.variableName }
    });
  },
  
  async startWatching() {
    const serverActor = this.getServerActor();
    // Set up V8 Inspector variable watching
    await serverActor.inspectorManager.watchVariable(this.variableName, async (oldVal, newVal) => {
      await serverActor.remoteActor.receive('handle:event', {
        handleId: this.handleId,
        eventName: 'changed',
        data: { oldValue: oldVal, newValue: newVal, variable: this.variableName }
      });
    });
  }
};
```

**FunctionHandle** (Handle object managed by NodeDebugServerActor):
```javascript
const functionHandle = {
  handleId: generateHandleId(),
  resourceType: 'FunctionHandle',
  functionName,
  processId,
  supportedEvents: ['called', 'returned', 'exception'],
  
  async setEntryBreakpoint() {
    const serverActor = this.getServerActor();
    const astInfo = await serverActor.queryEngine.execute(`ast.functions.${this.functionName}`, {
      processId: this.processId
    });
    
    // Create breakpoint handle through server actor
    return await serverActor.handleProjector.project(
      serverActor.activeProcesses.get(this.processId),
      'breakpoint',
      astInfo.filePath,
      astInfo.startLine
    );
  },
  
  async getCallCount() {
    const serverActor = this.getServerActor();
    return await serverActor.inspectorManager.getFunctionCallCount(this.functionName);
  },
  
  async profile() {
    const serverActor = this.getServerActor();
    return await serverActor.inspectorManager.profileFunction(this.functionName);
  }
};
```

## Module Architecture

### NodeDebuggerModule (Composition with node-runner)

```javascript
import NodeRunnerModule from '@legion/node-runner';

export class NodeDebuggerModule extends Module {
  constructor() {
    super();
    this.name = 'node-debugger';
    this.description = 'Node.js process debugging and introspection with handle projection';
    this.version = '1.0.0';
    this.metadataPath = './tools-metadata.json';
    
    // Will be initialized in initialize()
    this.nodeRunner = null;
    this.inspectorManager = null;
    this.astManager = null;
    this.queryEngine = null;
    this.handleProjector = null;
  }
  
  static async create(resourceManager) {
    const module = new NodeDebuggerModule();
    module.resourceManager = resourceManager;
    
    // Create node-runner module as dependency
    module.nodeRunner = await NodeRunnerModule.create(resourceManager);
    
    await module.initialize();
    return module;
  }
  
  async initialize() {
    await super.initialize();
    
    // Create debugging-specific managers
    this.astManager = new ASTManager();
    this.inspectorManager = new InspectorManager();
    this.queryEngine = new QueryEngine(this.astManager, this.inspectorManager);
    this.handleProjector = new HandleProjector(this.resourceManager.get('HandleRegistry'));
    
    // Initialize tools
    this.initializeTools();
  }
  
  initializeTools() {
    const tools = [
      new NodeStartDebugTool(this),
      new NodeQueryTool(this),
      new NodeProjectBreakpointTool(this),
      new NodeProjectVariableTool(this),
      new NodeProjectFunctionTool(this),
      new NodeSubscribeTool(this),
      new NodeStepTool(this),
      new NodeExecuteTool(this)
    ];
    
    for (const tool of tools) {
      this.registerTool(tool.name, tool);
    }
  }
}
```

## Legion Tools Specification

### 1. NodeStartDebugTool

**Purpose**: Start a Node.js process in debug mode and create a NodeProcessHandle

```javascript
class NodeStartDebugTool extends Tool {
  constructor(module) {
    super({
      name: 'node_start_debug',
      description: 'Start Node.js process in debug mode and create debuggable process handle',
      inputSchema: {
        type: 'object',
        required: ['scriptPath'],
        properties: {
          scriptPath: { type: 'string', description: 'Path to Node.js script to debug' },
          debugPort: { type: 'number', default: 9229, description: 'V8 Inspector debug port' },
          breakOnStart: { type: 'boolean', default: true, description: 'Break on first line' },
          workingDir: { type: 'string', description: 'Working directory for process' },
          env: { type: 'object', description: 'Environment variables' },
          sessionName: { type: 'string', description: 'Session name for organization' }
        }
      }
    });
    this.module = module;
  }
  
  async _execute(args) {
    const { scriptPath, debugPort, breakOnStart, workingDir, env, sessionName } = args;
    
    // Use node-runner to start the process with inspector flags
    const runResult = await this.module.nodeRunner.processManager.start({
      command: 'node',
      args: [
        `--inspect-brk=${debugPort}`,  // Break on start if requested
        scriptPath
      ],
      workingDir: workingDir || path.dirname(scriptPath),
      sessionName,
      env
    });
    
    // Connect Inspector
    await this.module.inspectorManager.connect(runResult.processId, debugPort);
    
    // Parse source files
    await this.module.astManager.parseFile(scriptPath);
    
    // Create NodeProcessHandle
    const processHandle = new NodeProcessHandle(
      runResult.processId,
      runResult,
      this.module.inspectorManager,
      this.module.astManager
    );
    
    // Register handle
    const handleId = this.module.resourceManager.get('HandleRegistry')
      .create(`debug-process-${runResult.sessionId}`, processHandle);
    
    return {
      success: true,
      processHandle,
      handleId,
      processId: runResult.processId,
      sessionId: runResult.sessionId,
      debugPort
    };
  }
}
```

### 2. NodeQueryTool

**Purpose**: Query static code structure or runtime state through unified interface

```javascript
class NodeQueryTool extends Tool {
  constructor(module) {
    super({
      name: 'node_query',
      description: 'Query static code structure or runtime state of Node.js process',
      inputSchema: {
        type: 'object',
        required: ['processHandle', 'queryPath'],
        properties: {
          processHandle: { type: 'object', description: 'NodeProcessHandle to query' },
          queryPath: { type: 'string', description: 'Query path (e.g. "ast.functions", "runtime.callStack")' },
          context: { type: 'object', description: 'Additional query context' },
          format: { type: 'string', enum: ['full', 'summary', 'minimal'], default: 'full' }
        }
      }
    });
    this.module = module;
  }
  
  async _execute(args) {
    const { processHandle, queryPath, context = {}, format } = args;
    
    // Validate handle type
    if (processHandle.__resourceType !== 'NodeProcessHandle') {
      throw new Error('Invalid handle type. Expected NodeProcessHandle.');
    }
    
    // Execute query
    const result = await processHandle.query(queryPath, context);
    
    // Format result based on requested format
    const formatted = this.formatResult(result, format);
    
    return {
      success: true,
      queryPath,
      result: formatted,
      timestamp: new Date().toISOString()
    };
  }
  
  formatResult(result, format) {
    switch (format) {
      case 'summary':
        return this.createSummary(result);
      case 'minimal':
        return this.createMinimal(result);
      default:
        return result;
    }
  }
}
```

### 3. NodeProjectBreakpointTool

**Purpose**: Create a BreakpointHandle from a NodeProcessHandle

```javascript
class NodeProjectBreakpointTool extends Tool {
  constructor(module) {
    super({
      name: 'node_project_breakpoint',
      description: 'Create breakpoint handle that can be subscribed to for debugging events',
      inputSchema: {
        type: 'object',
        required: ['processHandle', 'filePath', 'lineNumber'],
        properties: {
          processHandle: { type: 'object', description: 'NodeProcessHandle to create breakpoint in' },
          filePath: { type: 'string', description: 'File path for breakpoint' },
          lineNumber: { type: 'number', description: 'Line number for breakpoint (1-based)' },
          condition: { type: 'string', description: 'Optional breakpoint condition' },
          enabled: { type: 'boolean', default: true, description: 'Enable breakpoint immediately' }
        }
      }
    });
    this.module = module;
  }
  
  async _execute(args) {
    const { processHandle, filePath, lineNumber, condition, enabled } = args;
    
    // Create breakpoint handle through projection
    const breakpointHandle = await processHandle.project('breakpoint', filePath, lineNumber);
    
    // Set condition if provided
    if (condition) {
      await breakpointHandle.setCondition(condition);
    }
    
    // Disable if requested
    if (!enabled) {
      await breakpointHandle.disable();
    }
    
    return {
      success: true,
      breakpointHandle,
      filePath,
      lineNumber,
      condition,
      enabled,
      supportedEvents: breakpointHandle.supportedEvents
    };
  }
}
```

### 4. NodeSubscribeTool

**Purpose**: Subscribe to events on projected handles

```javascript
class NodeSubscribeTool extends Tool {
  constructor(module) {
    super({
      name: 'node_subscribe',
      description: 'Subscribe to events on projected handles (breakpoints, variables, functions)',
      inputSchema: {
        type: 'object',
        required: ['projectedHandle', 'eventName', 'callback'],
        properties: {
          projectedHandle: { type: 'object', description: 'Projected handle to subscribe to' },
          eventName: { type: 'string', description: 'Event name to subscribe to' },
          callback: { type: 'function', description: 'Callback function for event' },
          once: { type: 'boolean', default: false, description: 'Subscribe only once' }
        }
      }
    });
    this.module = module;
  }
  
  async _execute(args) {
    const { projectedHandle, eventName, callback, once } = args;
    
    // Validate event is supported
    if (!projectedHandle.supportedEvents.includes(eventName)) {
      throw new Error(`Event '${eventName}' not supported. Available: ${projectedHandle.supportedEvents.join(', ')}`);
    }
    
    // Set up subscription
    if (once) {
      projectedHandle.once(eventName, callback);
    } else {
      projectedHandle.on(eventName, callback);
    }
    
    return {
      success: true,
      subscribed: true,
      eventName,
      handleType: projectedHandle.__resourceType,
      once
    };
  }
}
```

### 5. NodeStepTool

**Purpose**: Step through code execution (step into, over, out)

```javascript
class NodeStepTool extends Tool {
  constructor(module) {
    super({
      name: 'node_step',
      description: 'Step through Node.js code execution',
      inputSchema: {
        type: 'object',
        required: ['processHandle', 'stepType'],
        properties: {
          processHandle: { type: 'object', description: 'NodeProcessHandle to step in' },
          stepType: { 
            type: 'string', 
            enum: ['into', 'over', 'out', 'continue'],
            description: 'Type of step operation' 
          }
        }
      }
    });
    this.module = module;
  }
  
  async _execute(args) {
    const { processHandle, stepType } = args;
    
    const session = processHandle.inspector.getSession(processHandle.processId);
    
    let result;
    switch (stepType) {
      case 'into':
        result = await session.post('Debugger.stepInto');
        break;
      case 'over':
        result = await session.post('Debugger.stepOver');
        break;
      case 'out':
        result = await session.post('Debugger.stepOut');
        break;
      case 'continue':
        result = await session.post('Debugger.resume');
        break;
    }
    
    // Get current execution state after step
    const callStack = await session.post('Runtime.getCallFrames');
    const location = callStack.result.callFrames[0];
    
    return {
      success: true,
      stepType,
      location: {
        filePath: location.url,
        lineNumber: location.lineNumber + 1, // Convert to 1-based
        columnNumber: location.columnNumber,
        functionName: location.functionName
      },
      callStack: callStack.result.callFrames
    };
  }
}
```

### 6. NodeExecuteTool

**Purpose**: Execute expressions in the debugging context

```javascript
class NodeExecuteTool extends Tool {
  constructor(module) {
    super({
      name: 'node_execute',
      description: 'Execute JavaScript expression in debugging context',
      inputSchema: {
        type: 'object',
        required: ['processHandle', 'expression'],
        properties: {
          processHandle: { type: 'object', description: 'NodeProcessHandle to execute in' },
          expression: { type: 'string', description: 'JavaScript expression to execute' },
          context: { 
            type: 'string', 
            enum: ['global', 'local', 'current'],
            default: 'current',
            description: 'Execution context' 
          },
          timeout: { type: 'number', default: 5000, description: 'Execution timeout in ms' }
        }
      }
    });
    this.module = module;
  }
  
  async _execute(args) {
    const { processHandle, expression, context, timeout } = args;
    
    const session = processHandle.inspector.getSession(processHandle.processId);
    
    let evalArgs = {
      expression,
      includeCommandLineAPI: true,
      timeout
    };
    
    // Set execution context
    if (context === 'global') {
      evalArgs.contextId = 0; // Global context
    }
    
    const result = await session.post('Runtime.evaluate', evalArgs);
    
    if (result.exceptionDetails) {
      return {
        success: false,
        error: result.exceptionDetails.text,
        expression,
        context
      };
    }
    
    return {
      success: true,
      expression,
      context,
      result: {
        value: result.result.value,
        type: result.result.type,
        description: result.result.description
      }
    };
  }
}
```

## Integration with Legion Handle System

### Handle Registry Integration

```javascript
// Register NodeProcessHandle as new resource type
const handleRegistry = resourceManager.get('HandleRegistry');

handleRegistry.registerResourceType('NodeProcessHandle', {
  methods: ['query', 'project', 'destroy'],
  projectionTypes: ['breakpoint', 'variable', 'function'],
  eventCapabilities: true
});

// Projected handles are also registered
handleRegistry.registerResourceType('BreakpointHandle', {
  methods: ['enable', 'disable', 'remove'],
  events: ['hit', 'enabled', 'disabled', 'removed']
});

handleRegistry.registerResourceType('VariableHandle', {
  methods: ['getValue', 'setValue', 'startWatching'],
  events: ['changed', 'created', 'destroyed']
});

handleRegistry.registerResourceType('FunctionHandle', {
  methods: ['setEntryBreakpoint', 'getCallCount', 'profile'],
  events: ['called', 'returned', 'exception']
});
```

### Transparent Resource Proxy Support

All handles work through Legion's transparent resource proxy system:
- Client-side proxies route method calls to server actors
- Events flow through actor protocol
- Handle lifecycle managed by ResourceHandleManager
- Cross-process handle references work seamlessly

## Event Subscription Architecture

### Actor Protocol Integration

```javascript
// Events flow through existing actor protocol
class ResourceServerSubActor {
  // Existing resource server functionality...
  
  async handleBreakpointHit(breakpointHandle, hitContext) {
    // Send event to client through actor protocol
    await this.sendToClient('handle:event', {
      handleId: breakpointHandle.id,
      eventName: 'hit',
      data: hitContext
    });
  }
  
  async handleVariableChanged(variableHandle, changeData) {
    await this.sendToClient('handle:event', {
      handleId: variableHandle.id,
      eventName: 'changed', 
      data: changeData
    });
  }
}

class ResourceClientSubActor extends ProtocolActor {
  // Existing resource client functionality...
  
  async handleEvent(messageType, { handleId, eventName, data }) {
    if (messageType === 'handle:event') {
      const proxy = this.handleProxies.get(handleId);
      if (proxy) {
        proxy.emit(eventName, data);
      }
    }
  }
}
```

### Event Routing Flow

```
V8 Inspector Event → InspectorManager → ProjectedHandle.emit() → ResourceServerSubActor → 
Actor Protocol → ResourceClientSubActor → TransparentProxy.emit() → Agent Callback
```

## Usage Examples

### Basic Debugging Workflow

```javascript
// 1. Start debugging session
const debugResult = await node_start_debug({
  scriptPath: '/path/to/server.js',
  breakOnStart: true,
  sessionName: 'server-debug'
});

const { processHandle } = debugResult;

// 2. Query static code structure
const functions = await node_query(processHandle, 'ast.functions');
console.log('Available functions:', functions.map(f => f.name));

// 3. Set breakpoint on specific function
const breakpointHandle = await node_project_breakpoint(processHandle, 
  '/path/to/server.js', 25);

// 4. Subscribe to breakpoint events
await node_subscribe(breakpointHandle, 'hit', async (context) => {
  console.log('Breakpoint hit!');
  
  // Query runtime state when breakpoint hits
  const locals = await node_query(processHandle, 'runtime.locals');
  console.log('Local variables:', locals);
  
  // Execute expression to inspect values
  const userIdResult = await node_execute(processHandle, 'userId');
  console.log('userId value:', userIdResult.result.value);
  
  // Continue execution
  await node_step(processHandle, 'continue');
});

// 5. Start execution
await node_step(processHandle, 'continue');
```

### Advanced Variable Watching

```javascript
// Start debugging session
const { processHandle } = await node_start_debug({
  scriptPath: '/path/to/app.js'
});

// Create variable handle for watching
const userStateHandle = await node_project_variable(processHandle, 'userState');

// Subscribe to variable changes
await node_subscribe(userStateHandle, 'changed', async ({ oldValue, newValue }) => {
  console.log('userState changed:', oldValue, '->', newValue);
  
  // Trigger additional analysis when specific changes occur
  if (newValue.status === 'error') {
    const errorContext = await node_query(processHandle, 'runtime.callStack');
    console.log('Error occurred in context:', errorContext);
  }
});

// Start watching the variable
await userStateHandle.startWatching();
```

### Function Profiling Workflow

```javascript
// Start debugging session
const { processHandle } = await node_start_debug({
  scriptPath: '/path/to/performance-test.js'
});

// Query all functions to find performance-critical ones
const functions = await node_query(processHandle, 'ast.functions');
const criticalFunctions = functions.filter(f => f.name.includes('process') || f.name.includes('handle'));

// Create function handles for profiling
const functionHandles = await Promise.all(
  criticalFunctions.map(fn => 
    node_project_function(processHandle, fn.name)
  )
);

// Subscribe to function call events
for (const fnHandle of functionHandles) {
  await node_subscribe(fnHandle, 'called', async (callInfo) => {
    console.log(`Function ${fnHandle.functionName} called:`, callInfo);
    
    // Start profiling
    await fnHandle.profile();
  });
  
  await node_subscribe(fnHandle, 'returned', async (returnInfo) => {
    console.log(`Function ${fnHandle.functionName} returned:`, returnInfo);
  });
}

// Continue execution to trigger function calls
await node_step(processHandle, 'continue');
```

## Configuration

### Environment Variables (via ResourceManager)

```bash
# Core Configuration
NODE_DEBUGGER_DEFAULT_PORT=9229          # Default V8 Inspector port
NODE_DEBUGGER_PORT_RANGE=100             # Port search range

# AST Configuration  
NODE_DEBUGGER_AST_CACHE_SIZE=1000        # Parsed AST cache size
NODE_DEBUGGER_AST_TIMEOUT=30000          # AST parsing timeout

# Inspector Configuration
NODE_DEBUGGER_CONNECT_TIMEOUT=10000      # Inspector connection timeout
NODE_DEBUGGER_EVAL_TIMEOUT=5000          # Expression evaluation timeout

# Handle Configuration
NODE_DEBUGGER_HANDLE_TIMEOUT=300000      # Handle lifecycle timeout
NODE_DEBUGGER_MAX_PROJECTED=1000         # Max projected handles per process
```

## Dependencies

### Required Legion Packages
- `@legion/node-runner`: Process management and logging infrastructure
- `@legion/tools-registry`: Module and tool base classes
- `@legion/schema`: JSON schema validation

### External Dependencies  
- `node-inspect`: V8 Inspector protocol client
- `tree-sitter`: Source code parsing
- `tree-sitter-javascript`: JavaScript language support
- `tree-sitter-typescript`: TypeScript language support

## Key Benefits

### For AI Agents
1. **Unified Interface**: Single query system for static + runtime introspection
2. **Handle Composition**: Agents can create and manage debugging objects as handles
3. **Event-Driven**: Subscribe to debugging events for reactive agent behavior
4. **Programmatic Control**: All debugging operations accessible through consistent APIs
5. **State Persistence**: Handles maintain state across agent interactions

### For Developers  
1. **Zero Configuration**: Leverages Legion's auto-configuration
2. **Full Legion Integration**: Works with existing storage, search, and actor systems
3. **Handle Reusability**: Debugging objects can be passed between tools and agents
4. **Event Transparency**: All debugging events flow through Legion's actor protocol

### Architectural Excellence
1. **Clean Separation**: Debugging concerns cleanly separated from logging (node-runner)
2. **Composition**: Leverages node-runner's excellent process infrastructure
3. **Extensibility**: Easy to add new projected handle types and query capabilities
4. **Legion Native**: Uses all Legion patterns (handles, actors, tools, modules)

## Implementation Notes

### MVP Constraints
- **Single process debugging**: One NodeProcessHandle per debugging session
- **Basic projections**: Support for breakpoint, variable, and function handles only
- **JavaScript/TypeScript only**: Focus on common Legion language support
- **Local debugging**: No remote debugging capabilities
- **Simple queries**: Basic AST and runtime queries, not complex analysis

### Fail-Fast Philosophy
- **No fallbacks**: All operations either succeed or throw descriptive errors
- **Handle validation**: Strict type checking on all handle operations
- **Inspector failures**: Fail immediately if V8 Inspector connection fails
- **AST errors**: Fail if source code cannot be parsed
- **Resource cleanup**: Always clean up handles and connections on failure

This design provides agents with unprecedented introspection and control capabilities over Node.js processes while maintaining Legion's architectural principles and leveraging the excellent infrastructure already built in node-runner.