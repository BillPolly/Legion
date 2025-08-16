# ToolRegistry Singleton API

## Zero-Configuration Usage

The ToolRegistry is now a singleton that automatically configures itself using the ResourceManager from `@legion/core`. No initialization or configuration is required.

## Quick Start

```javascript
import toolRegistry from '@legion/tools-registry';

// That's it! Ready to use immediately
const tool = await toolRegistry.getTool('calculator');
const result = await tool.execute({ expression: '2 + 2' });
```

## API Reference

### Runtime Tool Access

#### `getTool(name)`
Get an executable tool by name.

```javascript
const tool = await toolRegistry.getTool('file_read');
const content = await tool.execute({ path: '/path/to/file.txt' });
```

#### `listTools(options)`
List available tools with optional filtering.

```javascript
const tools = await toolRegistry.listTools({ 
  limit: 10,
  module: 'file' 
});
```

#### `searchTools(query, options)`
Search for tools by text query.

```javascript
const tools = await toolRegistry.searchTools('json', {
  limit: 5
});
```

#### `semanticToolSearch(query, options)`
Search for tools using natural language (requires semantic search to be available).

```javascript
const results = await toolRegistry.semanticToolSearch(
  'I need to analyze code quality',
  { 
    limit: 5,
    minConfidence: 0.7 
  }
);
```

### Database Management

#### `getLoader()`
Get the LoadingManager instance for database operations.

```javascript
const loader = await toolRegistry.getLoader();

// Clear all data
await loader.clearAll();

// Load modules
await loader.loadModules();

// Generate perspectives
await loader.generatePerspectives();

// Index vectors
await loader.indexVectors();

// Or run everything at once
await loader.fullPipeline({
  clearFirst: true,
  includePerspectives: true,
  includeVectors: false
});
```

## Migration from Old API

### Before (Manual Configuration)
```javascript
import { ResourceManager } from '@legion/core';
import { ToolRegistry } from '@legion/tools-registry';
import { MongoDBToolRegistryProvider } from '@legion/tools-registry/providers';

// Manual setup required
const resourceManager = new ResourceManager();
await resourceManager.initialize();

const provider = await MongoDBToolRegistryProvider.create(resourceManager);
const toolRegistry = new ToolRegistry({ provider });
await toolRegistry.initialize();

// Now ready to use
const tool = await toolRegistry.getTool('calculator');
```

### After (Zero Configuration)
```javascript
import toolRegistry from '@legion/tools-registry';

// Ready immediately!
const tool = await toolRegistry.getTool('calculator');
```

## Advanced Usage

### Custom Provider
If you need a custom provider, you can still pass one:

```javascript
import { ToolRegistry } from '@legion/tools-registry';

const customRegistry = new ToolRegistry({ 
  provider: myCustomProvider,
  _forceNew: true  // Force new instance instead of singleton
});
```

### Accessing the Class
The class is still exported for typing and testing:

```javascript
import { ToolRegistry } from '@legion/tools-registry';

// For TypeScript typing
function processRegistry(registry: ToolRegistry) {
  // ...
}
```

### Singleton Behavior
- The singleton is created on first access
- Automatic initialization with ResourceManager
- Shared across all imports in your application
- Thread-safe initialization

## Benefits

1. **Zero Configuration** - No setup code required
2. **Automatic Resource Management** - ResourceManager handled internally
3. **Connection Sharing** - MongoDB and Qdrant connections are reused
4. **Lazy Initialization** - Resources created only when needed
5. **Simplified API** - Clean, intuitive interface
6. **Backward Compatible** - Old code continues to work

## Common Patterns

### Script Usage
```javascript
#!/usr/bin/env node
import toolRegistry from '@legion/tools-registry';

async function main() {
  // Get loader for database operations
  const loader = await toolRegistry.getLoader();
  
  // Populate database
  await loader.fullPipeline({ clearFirst: true });
  
  // Use tools
  const tool = await toolRegistry.getTool('my_tool');
  await tool.execute({ /* args */ });
}

main().catch(console.error);
```

### Application Usage
```javascript
import toolRegistry from '@legion/tools-registry';

export class MyService {
  async processWithTool(toolName, args) {
    const tool = await toolRegistry.getTool(toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }
    return await tool.execute(args);
  }
}
```

### Testing
```javascript
import toolRegistry from '@legion/tools-registry';

beforeAll(async () => {
  // Ensure database is populated for tests
  const loader = await toolRegistry.getLoader();
  await loader.fullPipeline({ clearFirst: true });
});

test('calculator tool works', async () => {
  const calc = await toolRegistry.getTool('calculator');
  const result = await calc.execute({ expression: '2 + 2' });
  expect(result.result).toBe(4);
});
```

## Troubleshooting

### Tool Not Found
If `getTool()` returns null:
1. Check if the database is populated: `loader.getPipelineState()`
2. Run population if needed: `loader.fullPipeline()`
3. Verify tool name is correct: `toolRegistry.listTools()`

### Semantic Search Not Available
If semantic search throws an error:
1. Ensure Qdrant is running: `docker ps`
2. Check QDRANT_URL in .env file
3. Generate vectors: `loader.indexVectors()`

### Connection Issues
If you see MongoDB connection errors:
1. Verify MONGODB_URI in .env file
2. Ensure MongoDB is running
3. Check network connectivity

## Environment Variables

The singleton automatically loads these from .env:
- `MONGODB_URI` - MongoDB connection string
- `QDRANT_URL` - Qdrant vector database URL (optional)
- `OPENAI_API_KEY` - For AI-powered tools (optional)
- Other API keys as needed by specific tools