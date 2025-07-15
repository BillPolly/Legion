# Event System Testing Documentation

This document provides comprehensive information about testing the jsEnvoy event system, including test structure, examples, and best practices.

## Overview

The jsEnvoy event system enables real-time communication between Tools, Modules, Agents, and WebSocket clients. The test suite comprehensively covers all aspects of this system to ensure reliability and backward compatibility.

## Test Structure

### Unit Tests

#### Module Event System Tests
- **Location**: `packages/module-loader/__tests__/unit/Module.events.test.js`
- **Coverage**: Module class event emission, EventEmitter inheritance, tool registration
- **Key Features**:
  - Event emission methods (`emitProgress`, `emitWarning`, `emitError`, `emitInfo`)
  - Event structure validation
  - Tool registration and module reference setting
  - Multiple event listener support

#### Tool Event System Tests
- **Location**: `packages/module-loader/__tests__/unit/Tool.events.test.js`
- **Coverage**: Tool class event emission, module interaction
- **Key Features**:
  - Tool event propagation through parent modules
  - Event emission during tool execution
  - Tool lifecycle and event handling
  - Performance testing with high-frequency events

### Integration Tests

#### Agent Event System Tests
- **Location**: `packages/agent/__tests__/integration/Agent.events.test.js`
- **Coverage**: Agent class event relay, module registration
- **Key Features**:
  - Module registration and event relay
  - Event enrichment with agent context
  - Complex workflow scenarios
  - Error handling and edge cases

#### WebSocket Event Streaming Tests
- **Location**: `packages/agent/__tests__/integration/websocket-events.test.js`
- **Coverage**: WebSocket server event broadcasting
- **Key Features**:
  - Client subscription management
  - Event broadcasting to multiple clients
  - High-frequency event handling
  - Performance and memory management

#### Backward Compatibility Tests
- **Location**: `packages/module-loader/__tests__/integration/backward-compatibility.test.js`
- **Coverage**: Legacy module and tool compatibility
- **Key Features**:
  - Legacy module support without event system
  - Mixed environment integration
  - API compatibility maintenance
  - Performance impact assessment

#### End-to-End Event Flow Tests
- **Location**: `packages/agent/__tests__/integration/e2e-event-flow.test.js`
- **Coverage**: Complete event pipeline from Tool to WebSocket
- **Key Features**:
  - Full event flow demonstration
  - Complex workflow testing
  - Real-time event updates
  - Performance benchmarking

## Test Examples

### Basic Module Event Testing

```javascript
import { Module } from '@jsenvoy/module-loader';

describe('Module Event System', () => {
  let module;
  let events;
  
  beforeEach(() => {
    module = new Module();
    module.name = 'TestModule';
    
    // Collect events
    events = [];
    module.on('event', (e) => events.push(e));
    
    // Prevent unhandled error events
    module.on('error', (e) => {
      // Handle error events
    });
  });

  test('should emit progress events', () => {
    module.emitProgress('Processing data', { step: 1, total: 3 });
    
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'progress',
      module: 'TestModule',
      message: 'Processing data',
      data: { step: 1, total: 3 },
      level: 'low'
    });
  });
});
```

### Tool Event Testing

```javascript
import Tool from '@jsenvoy/module-loader/src/tool/Tool.js';
import { Module } from '@jsenvoy/module-loader';

class TestTool extends Tool {
  constructor() {
    super();
    this.name = 'TestTool';
    this.description = 'Test tool with events';
  }

  async performOperation() {
    this.emitProgress('Starting operation');
    
    // Simulate work
    await new Promise(resolve => setTimeout(resolve, 100));
    
    this.emitInfo('Operation completed');
    return { success: true };
  }
}

describe('Tool Event System', () => {
  let tool;
  let module;
  let events;
  
  beforeEach(() => {
    tool = new TestTool();
    module = new Module();
    module.name = 'TestModule';
    
    // Register tool with module
    module.registerTool('TestTool', tool);
    
    // Collect events
    events = [];
    module.on('event', (e) => events.push(e));
  });

  test('should emit events during tool execution', async () => {
    await tool.performOperation();
    
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('progress');
    expect(events[1].type).toBe('info');
  });
});
```

### Agent Event Testing

```javascript
import { Agent } from '@jsenvoy/agent';
import { Module } from '@jsenvoy/module-loader';

describe('Agent Event System', () => {
  let agent;
  let moduleEvents;
  
  beforeEach(() => {
    agent = new Agent({
      name: 'TestAgent',
      modelConfig: {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        apiKey: 'test-key'
      }
    });
    
    // Collect module events
    moduleEvents = [];
    agent.on('module-event', (event) => moduleEvents.push(event));
  });

  test('should relay module events with agent context', () => {
    const module = new Module();
    module.name = 'TestModule';
    
    agent.registerModule(module);
    
    module.emitInfo('Test message', { testData: 'value' });
    
    expect(moduleEvents).toHaveLength(1);
    expect(moduleEvents[0]).toMatchObject({
      type: 'info',
      module: 'TestModule',
      message: 'Test message',
      agentId: 'TestAgent',
      agentName: 'TestAgent'
    });
  });
});
```

### WebSocket Event Testing

```javascript
import { Agent } from '@jsenvoy/agent';
import { AgentWebSocketServer } from '@jsenvoy/agent/src/websocket-server.js';
import { Module } from '@jsenvoy/module-loader';
import WebSocket from 'ws';

describe('WebSocket Event System', () => {
  let agent;
  let server;
  let wsClient;
  
  beforeEach(async () => {
    agent = new Agent({
      name: 'WebSocketAgent',
      modelConfig: {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        apiKey: 'test-key'
      }
    });
    
    server = new AgentWebSocketServer(agent, { port: 3005 });
    await server.start();
    
    wsClient = new WebSocket('ws://localhost:3005');
    await new Promise(resolve => wsClient.on('open', resolve));
    
    // Subscribe to events
    wsClient.send(JSON.stringify({
      id: 'test-sub',
      type: 'subscribe-events'
    }));
  });

  test('should broadcast module events to WebSocket clients', async () => {
    const module = new Module();
    module.name = 'TestModule';
    agent.registerModule(module);
    
    // Collect WebSocket events
    const events = [];
    wsClient.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'event') {
        events.push(message);
      }
    });
    
    module.emitInfo('WebSocket test message');
    
    // Wait for event propagation
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(events).toHaveLength(2); // Generic + specific events
    expect(events[0].event.message).toBe('WebSocket test message');
  });
});
```

## Event System Usage Examples

### Creating an Event-Aware Module

```javascript
import { Module } from '@jsenvoy/module-loader';

class FileProcessorModule extends Module {
  constructor() {
    super();
    this.name = 'FileProcessor';
    
    // Register tools
    this.registerTool('ReadFile', new FileReaderTool());
    this.registerTool('WriteFile', new FileWriterTool());
  }

  async processFiles(files) {
    this.emitInfo('Starting file processing batch', { 
      totalFiles: files.length 
    });

    const results = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      this.emitProgress(`Processing file ${i + 1}/${files.length}`, {
        currentFile: file,
        progress: Math.round(((i + 1) / files.length) * 100)
      });
      
      try {
        const result = await this.processFile(file);
        results.push(result);
      } catch (error) {
        this.emitError(`Failed to process file: ${file}`, {
          file: file,
          error: error.message
        });
        throw error;
      }
    }
    
    this.emitInfo('File processing batch completed', {
      processedCount: results.length,
      totalFiles: files.length
    });
    
    return results;
  }
}
```

### Creating an Event-Aware Tool

```javascript
import Tool from '@jsenvoy/module-loader/src/tool/Tool.js';

class DataValidatorTool extends Tool {
  constructor() {
    super();
    this.name = 'DataValidator';
    this.description = 'Validates data with progress tracking';
  }

  async execute(args) {
    const data = args.data;
    
    this.emitInfo('Starting data validation', { 
      dataSize: Object.keys(data).length 
    });

    const validationResults = {
      valid: true,
      warnings: [],
      errors: []
    };

    // Validate each field
    const fields = Object.keys(data);
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      
      this.emitProgress(`Validating field: ${field}`, {
        currentField: field,
        progress: Math.round(((i + 1) / fields.length) * 100)
      });

      const fieldValidation = await this.validateField(field, data[field]);
      
      if (fieldValidation.warnings.length > 0) {
        this.emitWarning(`Field validation warnings: ${field}`, {
          field: field,
          warnings: fieldValidation.warnings
        });
        validationResults.warnings.push(...fieldValidation.warnings);
      }
      
      if (fieldValidation.errors.length > 0) {
        this.emitError(`Field validation errors: ${field}`, {
          field: field,
          errors: fieldValidation.errors
        });
        validationResults.errors.push(...fieldValidation.errors);
        validationResults.valid = false;
      }
    }

    this.emitInfo('Data validation completed', {
      valid: validationResults.valid,
      warningCount: validationResults.warnings.length,
      errorCount: validationResults.errors.length
    });

    return validationResults;
  }
}
```

### Setting up WebSocket Event Streaming

```javascript
import { Agent } from '@jsenvoy/agent';
import { AgentWebSocketServer } from '@jsenvoy/agent/src/websocket-server.js';

// Create agent
const agent = new Agent({
  name: 'EventDemoAgent',
  bio: 'Demonstrates event system',
  modelConfig: {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    apiKey: process.env.OPENAI_API_KEY
  }
});

// Register modules
agent.registerModule(new FileProcessorModule());
agent.registerModule(new DataValidatorModule());

// Start WebSocket server
const server = new AgentWebSocketServer(agent, { port: 3001 });
await server.start();

console.log('WebSocket server started on port 3001');
console.log('Connect and subscribe to events with:');
console.log('{"id": "sub-1", "type": "subscribe-events"}');
```

### Client-Side Event Handling

```javascript
// Connect to WebSocket server
const ws = new WebSocket('ws://localhost:3001');

ws.on('open', () => {
  console.log('Connected to agent');
  
  // Subscribe to events
  ws.send(JSON.stringify({
    id: 'subscribe-1',
    type: 'subscribe-events'
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  
  if (message.type === 'event') {
    const event = message.event;
    
    // Handle different event types
    switch (event.type) {
      case 'progress':
        console.log(`Progress: ${event.message}`, event.data);
        break;
      case 'info':
        console.log(`Info: ${event.message}`, event.data);
        break;
      case 'warning':
        console.warn(`Warning: ${event.message}`, event.data);
        break;
      case 'error':
        console.error(`Error: ${event.message}`, event.data);
        break;
    }
  }
});
```

## Best Practices

### Testing Event Systems

1. **Always add error event listeners** to prevent unhandled error exceptions in tests
2. **Use specific event collection strategies** based on what you're testing
3. **Test event ordering** for complex workflows
4. **Verify event structure** and required fields
5. **Test backward compatibility** with non-event modules

### Event System Implementation

1. **Use appropriate event types** (`progress`, `info`, `warning`, `error`)
2. **Include relevant context data** in event payloads
3. **Emit events at logical points** in your workflow
4. **Handle events gracefully** in client applications
5. **Consider event frequency** to avoid overwhelming clients

### Performance Considerations

1. **Limit event frequency** for high-performance scenarios
2. **Use efficient event listeners** that don't block execution
3. **Clean up event listeners** when components are destroyed
4. **Monitor WebSocket connection health** for real-time applications
5. **Implement event buffering** for unreliable network connections

## Running the Tests

```bash
# Run all event system tests
npm test

# Run specific test suites
npm run test:module-loader  # Module and Tool event tests
npm run test:agent          # Agent and WebSocket event tests

# Run specific test files
npm test -- --testNamePattern="Module Event System"
npm test -- --testNamePattern="WebSocket Event Streaming"
npm test -- --testNamePattern="End-to-End Event Flow"

# Run with coverage
npm run test:coverage
```

## Troubleshooting

### Common Issues

1. **Unhandled Error Events**: Always add error event listeners in tests
2. **Event Duplication**: WebSocket server emits both generic and specific events
3. **Timing Issues**: Use proper event collection strategies with timeouts
4. **Memory Leaks**: Remove event listeners in cleanup functions
5. **Connection Issues**: Ensure WebSocket server is started before client connections

### Debug Tips

1. **Log event flow** to understand event propagation
2. **Use unique event identifiers** for tracing
3. **Test with minimal scenarios** first
4. **Check event timestamps** for timing issues
5. **Verify WebSocket connection states** for network tests

## Contributing

When adding new event system features:

1. **Add comprehensive tests** for new functionality
2. **Update documentation** with examples
3. **Maintain backward compatibility** with existing modules
4. **Follow event structure conventions**
5. **Test WebSocket integration** for real-time features

For more information, see the main jsEnvoy documentation and the specific package READMEs.