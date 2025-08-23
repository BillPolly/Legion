# Tools Registry

A comprehensive tool registry system for the Legion AI agent framework, providing database-backed tool discovery, semantic search, and automated loading pipelines.

## Overview

The Tools Registry manages AI agent tools with:
- **MongoDB-backed storage** for tools, modules, and metadata
- **Qdrant vector database** for semantic tool search
- **Automated loading pipelines** for tool discovery and indexing
- **Staged processing** with resume capability and verification
- **Production-ready architecture** with comprehensive error handling

## Quick Start

```javascript
import toolRegistry from '@legion/tools-registry';

// Get and execute a tool
const tool = await toolRegistry.getTool('calculator');
const result = await tool.execute({ expression: '2 + 2' });
```

## Core Architecture

### Database Collections

- **`module_registry`** - Permanent registry of discovered modules (persistent)
- **`modules`** - Currently loaded module metadata (pipeline managed)
- **`tools`** - Available tool definitions (pipeline managed)
- **`tool_perspectives`** - AI-generated tool descriptions (pipeline managed) 
- **`pipeline_state`** - Pipeline execution state and progress tracking

### Staged Loading Pipeline

The system uses a 5-stage pipeline for tool processing:

1. **Clear Stage** - Removes existing data (preserves module_registry)
2. **LoadTools Stage** - Loads tools from discovered modules
3. **GeneratePerspectives Stage** - Creates AI descriptions for tools
4. **GenerateEmbeddings Stage** - Generates vector embeddings
5. **IndexVectors Stage** - Stores vectors in Qdrant for search

## Database Management

### Loading Manager API

```javascript
const loader = await toolRegistry.getLoader();

// Full pipeline with specific modules
await loader.runFullPipeline({
  forceRestart: true,
  clearModules: true, 
  module: 'calculator,json,file'
});

// Individual stage operations
await loader.clearAll();
await loader.loadModules({ module: 'calculator' });
await loader.generatePerspectives();
await loader.generateEmbeddings();
await loader.indexVectors();

// Check pipeline state
const progress = await loader.getPipelineProgress();
```

### Command Line Scripts

The tools-registry provides 4 core management scripts:

**Manager Script** - Complete pipeline management:
```bash
npm run manager pipeline --clear --verbose
npm run manager load --module calculator 
npm run manager status
```

**Search Script** - Testing and benchmarking:
```bash
npm run search test --verbose
npm run search semantic --query "file operations"
```

**Verify Script** - System health and validation:
```bash
npm run verify health --verbose
npm run verify relationships --deep
```

**Tools Script** - Tool operations and validation:
```bash
npm run tools list --module file
npm run tools execute calculator --args '{"expression": "10 + 5"}'
```

See `scripts/README.md` for detailed usage information.

## Tool Discovery and Search

### Basic Tool Access
```javascript
// Get single tool
const tool = await toolRegistry.getTool('file_read');

// List tools with filtering
const tools = await toolRegistry.listTools({ 
  limit: 10,
  moduleName: 'file'
});

// Text-based search
const results = await toolRegistry.searchTools('json parsing');
```

### Semantic Search
```javascript
// Natural language search (requires Qdrant + embeddings)
const results = await toolRegistry.semanticToolSearch(
  'I need to process CSV files',
  { limit: 5, minConfidence: 0.7 }
);
```

## Production Usage

### Environment Configuration

Required `.env` variables:
```bash
MONGODB_URL=mongodb://localhost:27017/legion_tools
TOOLS_DATABASE_NAME=legion_tools
QDRANT_URL=http://localhost:6333
ANTHROPIC_API_KEY=your_key_here
```

### Pipeline Resume Capability

The system supports resuming failed pipelines:
```javascript
// If pipeline fails at stage 3, simply run again
await loader.runFullPipeline({ forceRestart: false }); // Resumes from failure
```

### Verification and Monitoring

```javascript
// Get detailed pipeline state
const state = await loader.getPipelineState();
console.log(state.currentStage, state.percentComplete);

// Verify data consistency
const verificationResult = await loader.verifyPipelineState();
```

## Testing

All tests use the **production database** - no test database isolation:

```javascript
// Tests work with real production data
describe('Tool Registry', () => {
  it('should find calculator tool', async () => {
    const tool = await toolRegistry.getTool('calculator');
    expect(tool).toBeDefined();
    
    const result = await tool.execute({ expression: '5 * 8' });
    expect(result.success).toBe(true);
  });
});
```

Run tests:
```bash
npm test                           # Run all tests
npm test -- --testNamePattern="should execute complete pipeline"
```

## Error Handling and Recovery

### Pipeline Failures
- Automatic state tracking with resume capability
- Detailed error logging with stack traces
- Stage-level verification and rollback
- Connection failure recovery

### Common Issues

**Tool Not Found:**
```javascript
const tool = await toolRegistry.getTool('unknown_tool');
if (!tool) {
  // Tool doesn't exist or database not populated
  const loader = await toolRegistry.getLoader();
  await loader.runFullPipeline({ forceRestart: true });
}
```

**Database Connection Issues:**
- Verify MongoDB is running and accessible
- Check MONGODB_URL in environment
- Ensure database permissions are correct

**Semantic Search Failures:**
- Verify Qdrant is running on QDRANT_URL
- Run pipeline with vectors: `await loader.indexVectors()`
- Check embedding generation completed successfully

## Module Development

Tools are discovered from modules in the Legion monorepo:
- Modules must be in `packages/*/` directories
- Must export tools via `getTools()` method
- Tools require `name`, `description`, and `execute()` method
- Module registry persists discovered modules permanently

## Advanced Configuration

### Custom Provider
```javascript
import { ToolRegistry, MongoDBToolRegistryProvider } from '@legion/tools-registry';

const customProvider = await MongoDBToolRegistryProvider.create(resourceManager, {
  enableSemanticSearch: true,
  embeddingModel: 'custom-model'
});

const registry = new ToolRegistry({ provider: customProvider });
```

### Semantic Search Configuration
```javascript
// Configure local ONNX embeddings
process.env.USE_LOCAL_EMBEDDINGS = 'true';
process.env.LOCAL_EMBEDDING_MODEL_PATH = './models/embeddings.onnx';
```

## Performance Characteristics

- **Tool lookup:** ~1ms (cached)
- **Database operations:** ~10-50ms
- **Semantic search:** ~100-500ms (depends on vector count)
- **Pipeline execution:** ~30-180s (depends on module count)
- **Memory usage:** ~50-200MB (depends on loaded tools)

## Monitoring and Observability

The system provides extensive logging:
```bash
# Enable verbose logging
DEBUG=tools-registry:* node your-script.js

# Pipeline state tracking
curl http://localhost:3000/pipeline/state  # If monitoring endpoint enabled
```

## Deployment Considerations

- MongoDB requires persistent storage for `module_registry`
- Qdrant optional but required for semantic search
- Pipeline can be run as initialization job
- Supports horizontal scaling (singleton per process)
- Memory usage scales with tool count (~1KB per tool)