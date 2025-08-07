# Tool Architecture Enhancements

This enhanced version of tool-architecture adds minimal but powerful features while maintaining the clean, simple design.

## What's New (Only ~100 lines added!)

### 1. **Event System** ✅
Both `Tool` and `ModuleInstance` now extend `EventEmitter`:

```javascript
// Tools can emit events during execution
const tool = new Tool({
  name: 'my_tool',
  execute: async function(input) {
    tool.progress('Starting...', 0);
    // do work...
    tool.progress('Complete', 100);
    return result;
  }
});

tool.on('progress', event => console.log(event));
```

### 2. **Proxy-based ResourceManager** ✅
Transparent configuration that looks like a plain object:

```javascript
const rm = new ResourceManager();

// Set values like a plain object
rm.apiKey = 'sk-123';
rm.basePath = '/workspace';

// Use directly as config - no .get() needed!
console.log(rm.apiKey); // 'sk-123'

// Pass to modules - looks exactly like config object
const module = new FileSystemModule(rm);
```

### 3. **Schema Validation** ✅
Integrated with `@legion/schema` package (optional):

```javascript
const tool = new Tool({
  name: 'validated_tool',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'number', minimum: 0 }
    },
    required: ['name', 'age']
  },
  execute: async (input) => {
    // input is already validated!
    return { greeting: `Hello ${input.name}` };
  }
});
```

### 4. **Event Forwarding** ✅
Module automatically forwards tool events:

```javascript
class MyModule extends ModuleInstance {
  createTools() {
    const tool = new Tool({ /* ... */ });
    this.registerTool('my_tool', tool);
    // Tool events are automatically forwarded to module
  }
}

const module = new MyModule();
module.on('progress', e => {
  console.log(`${e.module}/${e.tool}: ${e.message}`);
});
```

## Comparison with module-loader

| Feature | tool-architecture (enhanced) | module-loader |
|---------|------------------------------|---------------|
| **Core Lines of Code** | ~400 | ~3000+ |
| **Event System** | ✅ Simple EventEmitter | ✅ Complex event chains |
| **Schema Validation** | ✅ Via @legion/schema | ✅ Via Zod |
| **Resource Management** | ✅ Proxy-based (transparent) | ✅ Explicit get/set |
| **Dependency Injection** | ✅ Simple config passing | ✅ Complex DI system |
| **Learning Curve** | Low | High |
| **API Complexity** | Simple | Complex |

## Usage Example

```javascript
import { 
  Tool, 
  ModuleInstance, 
  ResourceManager 
} from '@legion/tool-system';

// Setup resources transparently
const rm = new ResourceManager();
rm.apiKey = process.env.API_KEY;
rm.endpoint = 'https://api.example.com';

// Create a module
class APIModule extends ModuleInstance {
  constructor(config) {
    super({ name: 'API' }, config);
    this.createTools();
  }
  
  createTools() {
    const fetchTool = new Tool({
      name: 'fetch',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' }
        }
      },
      execute: async (input) => {
        // Access config naturally
        const url = `${this.config.endpoint}${input.path}`;
        
        fetchTool.progress('Fetching...', 50);
        const response = await fetch(url, {
          headers: { 'Authorization': `Bearer ${this.config.apiKey}` }
        });
        fetchTool.progress('Done', 100);
        
        return response.json();
      }
    });
    
    this.registerTool('fetch', fetchTool);
  }
}

// Use it
const api = new APIModule(rm);

// Listen to events
api.on('progress', e => console.log(`Progress: ${e.message}`));

// Execute tools
const result = await api.executeTool('fetch', { path: '/users' });
```

## Benefits

1. **Simplicity** - The entire enhancement is ~100 lines vs module-loader's 1000s
2. **Transparency** - ResourceManager looks exactly like a config object
3. **Compatibility** - Can work alongside module-loader during migration
4. **Clean API** - No complex abstractions or deep inheritance chains
5. **Performance** - Less overhead, fewer abstractions

## Migration Path

To migrate from module-loader to tool-architecture:

1. Replace `import { Module, Tool } from '@legion/module-loader'`  
   with `import { ModuleInstance, Tool } from '@legion/tool-system'`

2. Change `Module` base class to `ModuleInstance`

3. Replace `ResourceManager.get('key')` with direct property access `rm.key`

4. Schema validation works the same with `inputSchema` property

5. Events work the same - just simpler implementation

The enhanced tool-architecture provides all essential functionality with a much cleaner, simpler design!