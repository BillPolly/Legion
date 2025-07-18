# @jsenvoy/module-loader

Core infrastructure for building modular tool systems. This package provides the essential base classes, dependency injection, and module management capabilities that enable the creation of extensible tool libraries.

## What This Package Provides

- **Base Classes**: Foundation classes for building tools and modules
- **Dependency Injection**: ResourceManager for managing dependencies
- **Module Factory**: Factory pattern for creating modules with resolved dependencies
- **Tool Infrastructure**: Everything needed to build tool systems

## Key Components

- `Tool` - Base class for tools that follow standard function calling format
- `Module` - Container for related tools  
- `ResourceManager` - Dependency injection container
- `ModuleFactory` - Creates modules with dependency resolution
- `ToolResult` - Standard result type for tool execution

## Usage

```javascript
const { Tool, Module, ResourceManager, ModuleFactory, ToolResult } = require('@jsenvoy/module-loader');

// Create a tool
class MyTool extends Tool {
  constructor() {
    super();
    this.name = 'my_tool';
    this.description = 'My custom tool';
  }
  
  async execute(args) {
    return { result: 'success' };
  }
}

// Create a module
class MyModule extends Module {
  constructor() {
    super();
    this.name = 'my_module';
    this.tools = [new MyTool()];
  }
}
```

## Event System

The module-loader package includes a comprehensive event system that enables real-time monitoring and feedback from tools and modules during execution.

### Event Types

The event system supports four types of events:

- **progress** - Track operation progress
- **info** - General information messages
- **warning** - Non-critical issues or important notices
- **error** - Critical errors that may affect execution

### Event Structure

All events follow a consistent structure:

```javascript
{
  type: 'progress' | 'info' | 'warning' | 'error',
  module: 'ModuleName',           // Source module
  tool: 'ToolName',              // Source tool (if applicable)
  message: 'Event message',       // Human-readable message
  data: { /* custom data */ },    // Optional event-specific data
  timestamp: '2024-01-01T12:00:00.000Z',
  level: 'low' | 'medium' | 'high'  // Event priority level
}
```

### Module Events

Modules extend EventEmitter and provide convenience methods for emitting events:

```javascript
class DataProcessorModule extends Module {
  constructor() {
    super();
    this.name = 'DataProcessor';
  }

  async processData(data) {
    // Emit progress events
    this.emitProgress('Starting data processing', { 
      totalItems: data.length 
    });

    for (let i = 0; i < data.length; i++) {
      this.emitProgress(`Processing item ${i + 1}/${data.length}`, {
        progress: Math.round(((i + 1) / data.length) * 100)
      });
      
      try {
        await this.processItem(data[i]);
      } catch (error) {
        // Emit error events
        this.emitError(`Failed to process item ${i}`, {
          item: data[i],
          error: error.message
        });
      }
    }

    // Emit info events
    this.emitInfo('Data processing completed', {
      processedCount: data.length
    });
  }
}
```

### Tool Events

Tools can emit events that propagate through their parent module:

```javascript
class ValidationTool extends Tool {
  constructor() {
    super();
    this.name = 'Validator';
    this.description = 'Validates data with progress tracking';
  }

  async execute(args) {
    const { data } = args;
    
    // Emit info event at start
    this.emitInfo('Starting validation', { 
      dataSize: Object.keys(data).length 
    });

    const warnings = [];
    const errors = [];

    for (const [key, value] of Object.entries(data)) {
      // Emit progress for each field
      this.emitProgress(`Validating field: ${key}`);

      if (this.hasWarning(value)) {
        this.emitWarning(`Validation warning for ${key}`, {
          field: key,
          value: value
        });
        warnings.push({ field: key, message: 'Warning message' });
      }

      if (this.hasError(value)) {
        this.emitError(`Validation error for ${key}`, {
          field: key,
          value: value
        });
        errors.push({ field: key, message: 'Error message' });
      }
    }

    // Emit completion info
    this.emitInfo('Validation completed', {
      warnings: warnings.length,
      errors: errors.length
    });

    return { warnings, errors };
  }
}
```

### Listening to Events

You can listen to events from modules:

```javascript
const module = new DataProcessorModule();

// Listen to all events
module.on('event', (event) => {
  console.log(`[${event.type}] ${event.message}`, event.data);
});

// Listen to specific event types
module.on('progress', (event) => {
  updateProgressBar(event.data.progress);
});

module.on('error', (event) => {
  logError(event.message, event.data);
});

// Process data with event monitoring
await module.processData(myData);
```

### Event Propagation

Events flow through the system hierarchy:

1. **Tool → Module**: When a tool emits an event, it's automatically propagated to its parent module
2. **Module → Agent**: When used with `@jsenvoy/agent`, module events are relayed to the agent
3. **Agent → WebSocket**: Agents can broadcast events to connected WebSocket clients

### Best Practices

1. **Emit progress events** for long-running operations
2. **Include relevant context** in the data field
3. **Use appropriate event types** based on severity
4. **Set proper event levels** (low, medium, high) based on importance
5. **Keep messages concise** but informative
6. **Clean up listeners** when no longer needed to prevent memory leaks

### Backward Compatibility

The event system is designed to be non-breaking. Modules and tools that don't emit events continue to work normally. Event emission is optional and doesn't affect the core functionality of tools.

This package contains **infrastructure only** - actual tools are in `@jsenvoy/tools`.