# Tool Perspectives System

A sophisticated 3-collection MongoDB architecture for generating and managing multiple perspective types for tools, optimized with single LLM call generation.

## Quick Start

```bash
# 1. Reset and initialize database
node scripts/reset-database.js --all --confirm

# 2. Load tools from modules
node scripts/load-tools.js --module FileModule

# 3. Generate perspectives (all types in one LLM call)
node scripts/generate-perspectives.js --module FileModule

# 4. Check status
node scripts/check-status.js --verbose
```

## Key Features

✨ **Single LLM Call Generation** - All perspective types generated in one API call  
📊 **3-Collection Architecture** - Relational design with MongoDB  
🚀 **Batch Processing** - Efficient module-level generation  
🔍 **Rich Search** - Text search across perspectives  
📈 **Comprehensive Statistics** - Coverage and performance metrics  
🎯 **Type Management** - Customizable perspective types  
🧪 **Mock Mode** - Testing without LLM configuration  
📝 **Canonical Scripts** - Production-ready CLI tools  

## Architecture Overview

```
┌─────────────────────┐
│  perspective_types  │ ← Defines what perspectives to generate
└─────────────────────┘
           ↓
┌─────────────────────┐
│       tools         │ ← Tool metadata and definitions  
└─────────────────────┘
           ↓
┌─────────────────────┐
│  tool_perspectives  │ ← Generated perspectives (all types)
└─────────────────────┘
```

## Installation

```bash
# From the tools-registry package directory
npm install

# Ensure MongoDB is running
mongod --dbpath /path/to/data
```

## Basic Usage

```javascript
import { ResourceManager } from '@legion/resource-manager';
import { Perspectives } from '@legion/tools-registry';

// Initialize
const resourceManager = await ResourceManager.getResourceManager();
const perspectives = new Perspectives({ resourceManager });
await perspectives.initialize();

// Generate all perspectives for a tool (single LLM call)
const results = await perspectives.generatePerspectivesForTool('file_read');
console.log(`Generated ${results.length} perspectives in one call`);

// Retrieve perspectives
const toolPerspectives = await perspectives.getPerspectivesForTool('file_read');
```

## Perspective Types

The system includes 4 default perspective types, all generated together:

### 1. Usage Examples
```javascript
{
  name: 'usage_examples',
  description: 'Common usage patterns and code examples',
  category: 'technical'
}
```

### 2. Semantic Description
```javascript
{
  name: 'semantic_description',
  description: 'Natural language description for semantic search',
  category: 'semantic'
}
```

### 3. Related Tools
```javascript
{
  name: 'related_tools',
  description: 'Tools that work well together',
  category: 'relational'
}
```

### 4. Troubleshooting
```javascript
{
  name: 'troubleshooting',
  description: 'Common issues and solutions',
  category: 'support'
}
```

## Single LLM Call Optimization

The system generates ALL perspective types in a single LLM API call:

```javascript
// Instead of this (old way - multiple calls):
const examples = await generateExamples(tool);      // Call 1
const semantic = await generateSemantic(tool);      // Call 2  
const related = await generateRelated(tool);        // Call 3
const troubleshoot = await generateTrouble(tool);   // Call 4

// We do this (new way - single call):
const allPerspectives = await generatePerspectivesForTool(tool); // 1 Call!
// Returns array with all 4 perspective types
```

### Benefits:
- **4x faster** generation
- **75% less** API costs
- **Consistent** context across perspectives
- **Atomic** operations (all succeed or fail together)

## CLI Scripts

### load-tools.js
```bash
# Load all default modules
node scripts/load-tools.js

# Load specific module
node scripts/load-tools.js --module FileModule

# Clear and reload
node scripts/load-tools.js --clear --verbose
```

### generate-perspectives.js
```bash
# Generate for all tools
node scripts/generate-perspectives.js

# Generate for specific tool
node scripts/generate-perspectives.js --tool file_read

# Generate for module
node scripts/generate-perspectives.js --module FileModule

# Force regeneration
node scripts/generate-perspectives.js --force

# Dry run
node scripts/generate-perspectives.js --dry-run
```

### check-status.js
```bash
# Basic status
node scripts/check-status.js

# Detailed with samples
node scripts/check-status.js --verbose
```

### reset-database.js
```bash
# Reset everything
node scripts/reset-database.js --all --confirm

# Reset only perspectives
node scripts/reset-database.js --perspectives

# Reset only tools  
node scripts/reset-database.js --tools
```

## Advanced Usage

### Custom Perspective Types

```javascript
const typeManager = new PerspectiveTypeManager({ db });

// Add custom type
await typeManager.createType({
  name: 'security_considerations',
  description: 'Security best practices and warnings',
  prompt_template: 'List security considerations for {tool_name}...',
  category: 'security',
  enabled: true
});

// Generate with custom type (still single LLM call)
await perspectives.generatePerspectivesForTool('file_write');
```

### Batch Generation for Modules

```javascript
// Generate for entire module with progress
const results = await perspectives.generateForModule('FileModule', {
  useBatch: true,  // Same batch_id for all
  onProgress: (tool, index, total) => {
    console.log(`Processing ${tool} (${index}/${total})`);
  }
});
```

### Search Perspectives

```javascript
// Search across all perspectives
const results = await perspectives.searchPerspectives('error handling', {
  limit: 10,
  perspectiveType: 'troubleshooting'
});

// Search in specific module
const moduleResults = await perspectives.searchPerspectives('file', {
  moduleName: 'FileModule'
});
```

### Statistics and Coverage

```javascript
const stats = await perspectives.getStatistics();

console.log('Coverage:', stats.coverage.percentage + '%');
console.log('Total perspectives:', stats.total);
console.log('By type:', stats.byType);
console.log('By module:', stats.byModule);
```

## Testing

### Mock Mode
When no LLM client is configured, the system uses mock generation:

```javascript
// Automatically uses mock when no LLM client
const mockPerspectives = await perspectives.generatePerspectivesForTool('test_tool');
// Returns realistic mock data
```

### Test Configuration
```javascript
const perspectives = new Perspectives({
  resourceManager,
  options: {
    verbose: true,
    mockMode: true  // Force mock mode
  }
});
```

## Database Schema

### perspective_types
- Stores perspective type definitions
- Auto-seeded with 4 default types
- Supports custom types

### tools
- Tool metadata and schemas
- Linked to perspectives via _id

### tool_perspectives
- Generated perspective content
- All types for a tool share batch_id
- Indexed for fast search

## Performance

- **Generation**: ~2-3 seconds for all 4 types (single LLM call)
- **Batch saving**: MongoDB bulk operations
- **Search**: Indexed text search
- **Coverage query**: Aggregation pipeline with indexes

## Migration Guide

From old JSON-based system:

```bash
# 1. Clean slate
node scripts/reset-database.js --all --confirm

# 2. Load your tools
node scripts/load-tools.js

# 3. Generate all perspectives  
node scripts/generate-perspectives.js

# 4. Verify
node scripts/check-status.js --verbose
```

## Troubleshooting

### No perspectives generated
```bash
# Check LLM client
echo $ANTHROPIC_API_KEY

# Try mock mode
node scripts/generate-perspectives.js --dry-run
```

### Slow queries
```bash
# Check indexes
node scripts/check-status.js

# Rebuild indexes
node scripts/reset-database.js --all --confirm
```

### Generation failures
```bash
# Use verbose mode
node scripts/generate-perspectives.js --verbose

# Check specific tool
node scripts/generate-perspectives.js --tool file_read --verbose
```

## Best Practices

1. **Use batch generation** for modules (more efficient)
2. **Monitor batch IDs** to track generation sessions
3. **Don't over-use forceRegenerate** (preserves existing data)
4. **Enable only needed types** (faster generation)
5. **Use canonical scripts** (tested and production-ready)
6. **Index keywords** for better search

## Support

- Check status: `node scripts/check-status.js`
- View logs: Use `--verbose` flag
- Reset if needed: `node scripts/reset-database.js`

## License

Part of the Legion framework - see main LICENSE file.