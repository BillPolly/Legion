# Legion Tools Registry User Guide

## Overview

The Legion Tools Registry is a sophisticated module management and semantic search system designed for AI agent tools. It provides a complete pipeline from module discovery to semantic search capabilities, with a clean API that serves as the single entry point to all functionality.

## Architecture

### Core Design Principles

1. **Singleton Pattern**: `ToolRegistry.getInstance()` is the ONLY entry point - no direct instantiation allowed
2. **3-Collection MongoDB Architecture**: module-registry → modules → tools → tool_perspectives  
3. **No Mocks/Fallbacks**: Real implementations only - fails fast if dependencies unavailable
4. **TDD Approach**: All functionality is test-driven with comprehensive test coverage

### Database Collections

The system uses 5 MongoDB collections in the `legion_tools` database:

1. **`module-registry`** - Discovered modules awaiting load
2. **`modules`** - Successfully loaded module instances with metadata
3. **`tools`** - Individual tools extracted from modules with schemas
4. **`perspective_types`** - Types of perspectives that can be generated (functional, use-case, etc.)
5. **`tool_perspectives`** - AI-generated descriptions of tools with embeddings for semantic search

### Component Architecture

```
ToolRegistry (Singleton)
├── ModuleDiscovery - Finds modules in the monorepo
├── ModuleLoader - Loads and validates JavaScript modules  
├── DatabaseStorage - MongoDB operations for all collections
├── PerspectiveGenerator - LLM-based tool description generation
├── VectorIndexManager - Qdrant vector database for semantic search
└── SemanticSearchService - Embedding and search operations
```

## Getting Started

### Basic Usage

```javascript
import { ToolRegistry } from '@legion/tools-registry';

// Get the singleton instance (this is the ONLY way to access the registry)
const toolRegistry = await ToolRegistry.getInstance();

// The singleton is automatically initialized with ResourceManager and database connections
```

### Environment Requirements

The system requires these environment variables in the monorepo's single `.env` file:

```bash
MONGODB_URL=mongodb://localhost:27017
QDRANT_URL=http://localhost:6333
ANTHROPIC_API_KEY=your_anthropic_key_here
```

## Module System

### Module Requirements

All modules must extend the base `Module` class from `@legion/tools-registry`:

```javascript
import { Module, Tool, ToolResult } from '@legion/tools-registry';

class CalculatorModule extends Module {
  getName() { return 'Calculator'; }
  getDescription() { return 'Mathematical calculation tools'; }
  getVersion() { return '1.0.0'; }
  
  getTools() {
    return [
      new Tool({
        name: 'add',
        description: 'Add two numbers',
        inputSchema: {
          type: 'object',
          properties: {
            a: { type: 'number' },
            b: { type: 'number' }
          },
          required: ['a', 'b']
        },
        execute: async (params) => {
          const result = params.a + params.b;
          return new ToolResult({ success: true, result });
        }
      })
    ];
  }
}

export default CalculatorModule;
```

### Tool Structure

Tools must implement:
- `name` - Unique identifier within the module
- `description` - Human-readable description  
- `inputSchema` - JSON schema for input validation
- `outputSchema` - JSON schema for output validation (optional)
- `execute(params)` - Async function that returns a ToolResult

## Core Operations

### Discovery and Loading

```javascript
const toolRegistry = await ToolRegistry.getInstance();

// 1. Discover modules in the monorepo and save to module-registry
const discovery = await toolRegistry.discoverModules();
console.log(`Discovered ${discovery.discovered} modules`);

// 2. Load modules from registry into the database
const loading = await toolRegistry.loadModules();
console.log(`Loaded ${loading.successful} modules`);
```

### Tool Retrieval and Execution

```javascript
// Get a tool (returns executable tool instance)
const addTool = await toolRegistry.getTool('add');

// Execute the tool
const result = await addTool.execute({ a: 5, b: 3 });
console.log(result.result); // 8

// List all tools
const allTools = await toolRegistry.listTools();

// Search tools by text
const mathTools = await toolRegistry.searchTools('mathematical');
```

### Semantic Search

```javascript
// Generate perspectives for semantic search (requires LLM)
await toolRegistry.generatePerspectives();

// Index perspectives in vector database (requires Qdrant)
await toolRegistry.indexVectors();

// Semantic search using natural language
const results = await toolRegistry.semanticSearch('I need to calculate totals');
console.log(results.tools); // Returns ranked list of relevant tools
```

## Available Scripts

The package provides several command-line scripts for operations:

### Core Scripts

```bash
# Discover modules and save to registry
node scripts/discover-modules.js --save

# Load specific module  
node scripts/load-complete-pipeline.js --module Calculator --verbose

# Load all modules with full pipeline
node scripts/load-complete-pipeline.js --clear --verbose

# Check system status
node scripts/check-status.js --verbose

# Reset database completely
node scripts/reset-database.js --confirm
```

### Perspective Generation

```bash
# Generate perspectives for all tools
node scripts/generate-perspectives.js --all

# Generate for specific module
node scripts/generate-perspectives.js --module Calculator --verbose

# Index vectors in Qdrant
node scripts/populate-vector-index.js --clear
```

## API Reference

### ToolRegistry Main Interface

```javascript
class ToolRegistry {
  // Singleton access (ONLY way to get instance)
  static async getInstance()
  
  // Module Operations
  async discoverModules(paths?)           // Find modules in monorepo
  async loadModules(filter?)              // Load discovered modules
  async loadModule(name)                  // Load single module
  
  // Tool Operations  
  async getTool(name)                     // Get executable tool
  async listTools(filter?)                // List tools with filtering
  async searchTools(query)                // Text-based search
  
  // Perspective Operations (requires LLM)
  async generatePerspectives(filter?)     // Generate tool descriptions
  async indexVectors()                    // Index in vector database
  async semanticSearch(query, options?)   // Semantic search
  
  // Database Operations
  async clearAll()                        // Clear all collections
  async clearModule(name)                 // Clear specific module
  async getStats()                        // System statistics
  
  // Resource Management
  async cleanup()                         // Clean shutdown
}
```

### Module Discovery Results

```javascript
{
  discovered: 28,           // Number of modules found
  saved: 28,               // Number saved to module-registry  
  modules: [               // Array of discovered modules
    {
      name: 'Calculator',
      path: '/path/to/calculator/index.js',
      type: 'class'
    }
  ]
}
```

### Module Loading Results

```javascript
{
  successful: 10,          // Successfully loaded modules
  failed: 2,              // Failed module loads
  tools: 45,              // Total tools extracted
  results: [              // Detailed results per module
    {
      module: 'Calculator',
      success: true,
      tools: 5,
      error: null
    }
  ]
}
```

## Testing

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only  
npm run test:integration

# With coverage
npm run test:coverage
```

### Test Structure

```
__tests__/
├── unit/                   # Unit tests with mocks
│   ├── ToolRegistry.test.js
│   ├── ModuleLoader.test.js
│   └── DatabaseStorage.test.js
├── integration/            # Integration tests with real services
│   ├── FullPipeline.test.js
│   ├── DatabaseOps.test.js
│   └── SemanticSearch.test.js
└── fixtures/              # Test data and mock modules
```

### Test Requirements

- **No Skipping**: All tests must pass or fail, never skip
- **Real Services**: Integration tests use real MongoDB/Qdrant/LLM
- **Resource Cleanup**: All tests clean up after themselves
- **Deterministic**: Tests are reproducible and non-flaky

## Error Handling

### Common Errors

```javascript
// Module not found
ToolNotFoundError: Tool 'nonexistent' not found

// Database connection issues
DatabaseConnectionError: Failed to connect to MongoDB

// Module loading failures  
ModuleLoadError: Failed to load module at /path/to/module.js

// Tool execution failures
ToolExecutionError: Tool 'add' execution failed: Invalid input
```

### Error Recovery

The system provides graceful degradation:
- **Cache Fallback**: If database fails, uses cached tools when available
- **Service Optional**: Semantic search is optional - core functionality works without it
- **Clear Errors**: All errors include context and actionable information

## Performance Characteristics

### Response Times (Typical)
- **Tool Retrieval**: < 50ms (cached), < 200ms (database)
- **Module Loading**: < 2 seconds per module
- **Text Search**: < 100ms for 1000+ tools
- **Semantic Search**: < 500ms vector lookup
- **Bulk Loading**: < 30 seconds for 30 modules

### Scalability Targets
- **Database**: 10,000+ tools across 1,000+ modules
- **Cache**: 1,000 most-used tools in memory
- **Vector Index**: 50,000+ perspective embeddings
- **Concurrent Users**: 50+ simultaneous requests

## Troubleshooting

### Common Issues

**Module Discovery Issues**
```bash
# Check what modules were found
node scripts/discover-modules.js --verbose

# Verify paths are correct
node scripts/check-status.js --verbose
```

**Module Loading Failures**
```bash
# Load with verbose output to see errors
node scripts/load-complete-pipeline.js --module ModuleName --verbose

# Check module structure matches requirements
```

**Database Connection Issues**
```bash
# Verify MongoDB is running
mongosh $MONGODB_URL

# Check environment variables
node -e "import {ResourceManager} from '@legion/resource-manager'; const rm = await ResourceManager.getResourceManager(); console.log('MongoDB URL:', rm.get('env.MONGODB_URL'));"
```

**Semantic Search Issues**
```bash
# Check Qdrant is running
curl http://localhost:6333/collections

# Verify API keys are set
node scripts/check-status.js --verbose
```

### Debugging

Enable debug logging:
```bash
DEBUG=tools-registry:* node scripts/your-script.js
```

Check system health:
```javascript
const toolRegistry = await ToolRegistry.getInstance();
const stats = await toolRegistry.getStats();
console.log('System Stats:', stats);
```

## Advanced Usage

### Custom Module Paths

```javascript
// Discover modules in custom locations
const discovery = await toolRegistry.discoverModules([
  '/custom/path/to/modules',
  '/another/module/location'
]);
```

### Filtered Operations

```javascript
// Load only specific modules
await toolRegistry.loadModules({ pattern: 'Calculator*' });

// Generate perspectives for specific tools
await toolRegistry.generatePerspectives({ 
  moduleName: 'Calculator' 
});

// Search within module
const tools = await toolRegistry.listTools({ 
  moduleName: 'Calculator' 
});
```

### Batch Operations

```javascript
// Process multiple modules efficiently
const modules = ['Calculator', 'FileSystem', 'WebScraper'];
for (const module of modules) {
  await toolRegistry.loadModule(module);
  await toolRegistry.generatePerspectives({ moduleName: module });
}
await toolRegistry.indexVectors();
```

### Resource Management

```javascript
// Always clean up in applications
try {
  const toolRegistry = await ToolRegistry.getInstance();
  // ... use registry
} finally {
  await toolRegistry.cleanup(); // Closes database connections
}
```

## Best Practices

### Module Development
1. Always extend the base `Module` class
2. Provide comprehensive input/output schemas  
3. Use descriptive tool names and descriptions
4. Handle errors gracefully in tool execution
5. Follow JSON schema standards for validation

### Error Handling
1. Never catch and ignore errors
2. Provide meaningful error messages
3. Include context in error details
4. Use appropriate error types
5. Clean up resources on failures

### Performance
1. Use caching for frequently accessed tools
2. Batch database operations when possible
3. Generate perspectives in background
4. Index vectors after bulk operations
5. Monitor memory usage with large datasets

### Testing
1. Write tests before implementation (TDD)
2. Use real services in integration tests
3. Clean up test data properly
4. Make tests deterministic and fast
5. Test error conditions thoroughly

---

This system provides a robust, scalable foundation for managing AI agent tools with both traditional text search and modern semantic search capabilities. The singleton pattern ensures consistent state management, while the comprehensive test suite ensures reliability in production environments.