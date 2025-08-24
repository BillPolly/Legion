# 3-Collection Perspective Architecture

## Overview

The tools-registry package implements a sophisticated 3-collection MongoDB architecture for managing tool perspectives. This architecture enables efficient generation, storage, and retrieval of multiple perspective types for tools, all generated in a single LLM API call for optimal performance.

## Architecture Components

### Collections

#### 1. `perspective_types` Collection
Stores the definitions of perspective types that can be generated for tools.

**Schema:**
```javascript
{
  _id: ObjectId,
  name: String,           // e.g., "usage_examples"
  description: String,    // Human-readable description
  prompt_template: String,// Template for LLM generation
  category: String,       // e.g., "technical", "semantic"
  order: Number,         // Display order
  enabled: Boolean,      // Whether to generate this type
  createdAt: Date,
  updatedAt: Date
}
```

**Default Types (auto-seeded):**
- `usage_examples` - Common usage patterns and examples
- `semantic_description` - Natural language description for semantic search
- `related_tools` - Tools that work well together
- `troubleshooting` - Common issues and solutions

#### 2. `tools` Collection
Stores tool metadata and definitions.

**Schema:**
```javascript
{
  _id: String,           // Format: "modulename:toolname"
  name: String,          // Tool name
  description: String,   // Tool description
  moduleName: String,    // Parent module name
  inputSchema: Object,   // JSON Schema for inputs
  outputSchema: Object,  // JSON Schema for outputs
  category: String,      // Tool category
  tags: Array,          // Searchable tags
  createdAt: Date,
  updatedAt: Date
}
```

#### 3. `tool_perspectives` Collection
Stores generated perspectives for each tool-type combination.

**Schema:**
```javascript
{
  _id: ObjectId,
  tool_id: String,              // Reference to tools._id
  tool_name: String,            // Denormalized for queries
  perspective_type_id: ObjectId,// Reference to perspective_types._id
  perspective_type_name: String, // Denormalized for queries
  content: String,              // Generated perspective content
  keywords: Array,              // Extracted keywords for search
  metadata: Object,             // Additional metadata
  batch_id: String,             // Groups perspectives from same generation
  generated_at: Date,           // When perspective was generated
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes

The system automatically creates these indexes for optimal performance:

**perspective_types:**
- `name` (unique)
- `category, order` (compound)

**tools:**
- `name` (unique)
- `moduleName`

**tool_perspectives:**
- `tool_id, perspective_type_id` (unique compound)
- `tool_name`
- `perspective_type_name`
- `batch_id`
- `keywords` (text)

## Core Classes

### DatabaseInitializer

Handles database setup and initialization.

**Key Features:**
- Auto-creates collections if they don't exist
- Seeds default perspective types
- Creates optimal indexes
- Validates schema consistency

**Usage:**
```javascript
const initializer = new DatabaseInitializer({
  db: mongoDb,
  resourceManager: resourceManager,
  options: {
    verbose: true,
    seedData: true,
    createIndexes: true
  }
});

await initializer.initialize();
```

### PerspectiveTypeManager

Manages perspective type definitions and operations.

**Key Methods:**
- `createType(typeData)` - Create new perspective type
- `updateType(name, updates)` - Update existing type
- `getType(name)` - Get single type by name
- `getAllTypes()` - Get all perspective types
- `getEnabledTypes()` - Get only enabled types
- `deleteType(name)` - Delete a perspective type

**Usage:**
```javascript
const manager = new PerspectiveTypeManager({ db });

// Get all enabled types for generation
const types = await manager.getEnabledTypes();

// Create custom type
await manager.createType({
  name: 'performance_tips',
  description: 'Performance optimization suggestions',
  prompt_template: 'Generate performance tips for {tool_name}...',
  category: 'optimization',
  enabled: true
});
```

### Perspectives (Main Class)

Handles perspective generation and retrieval with single LLM call optimization.

**Key Features:**
- Generates ALL perspective types in one LLM call
- Supports batch generation for modules
- Automatic caching and deduplication
- Mock generation for testing
- Rich statistics and coverage reporting

**Core Methods:**

```javascript
// Generate perspectives for a single tool
const perspectives = await perspectives.generatePerspectivesForTool('file_read', {
  forceRegenerate: false,  // Skip if already exists
  perspectiveTypes: null   // Use all enabled types
});

// Generate for entire module
const results = await perspectives.generateForModule('FileModule', {
  forceRegenerate: false,
  useBatch: true           // Use same batch_id
});

// Generate for all tools
const summary = await perspectives.generateAll({
  forceRegenerate: false
});

// Get perspectives for a tool
const toolPerspectives = await perspectives.getPerspectivesForTool('file_read');

// Search perspectives
const results = await perspectives.searchPerspectives('file handling', {
  limit: 10,
  perspectiveType: 'usage_examples'
});

// Get statistics
const stats = await perspectives.getStatistics();
```

## Canonical Scripts

The package includes production-ready CLI scripts for common operations:

### 1. load-tools.js
Loads tools from modules into the database.

```bash
# Load all tools
node scripts/load-tools.js

# Load specific module
node scripts/load-tools.js --module FileModule

# Clear and reload
node scripts/load-tools.js --clear --verbose
```

### 2. generate-perspectives.js
Generates perspectives using the 3-collection architecture.

```bash
# Generate for all tools
node scripts/generate-perspectives.js

# Generate for specific tool
node scripts/generate-perspectives.js --tool file_read

# Generate for module
node scripts/generate-perspectives.js --module FileModule

# Force regeneration
node scripts/generate-perspectives.js --force --verbose

# Dry run to see what would be generated
node scripts/generate-perspectives.js --dry-run
```

### 3. check-status.js
Shows system status and health.

```bash
# Basic status
node scripts/check-status.js

# Detailed status with samples
node scripts/check-status.js --verbose
```

### 4. reset-database.js
Resets database to clean state.

```bash
# Reset everything
node scripts/reset-database.js

# Reset only perspectives
node scripts/reset-database.js --perspectives

# Reset only tools
node scripts/reset-database.js --tools

# Skip confirmation
node scripts/reset-database.js --all --confirm
```

## Single LLM Call Generation

The system optimizes LLM usage by generating all perspective types in a single API call:

### Generation Process

1. **Collect all enabled perspective types**
```javascript
const types = await perspectiveTypeManager.getEnabledTypes();
```

2. **Build combined prompt**
```javascript
const prompt = buildCombinedPrompt(tool, types);
// Includes all perspective types with clear delimiters
```

3. **Single LLM call**
```javascript
const response = await llmClient.generateText({
  prompt: prompt,
  maxTokens: 2000
});
```

4. **Parse multi-perspective response**
```javascript
const perspectives = parseMultiPerspectiveResponse(response, types);
// Extracts each perspective type from response
```

5. **Batch save to database**
```javascript
await savePerspectivesBatch(perspectives, batchId);
// All perspectives get same batch_id for tracking
```

### Benefits

- **Performance**: 1 LLM call instead of N calls
- **Consistency**: All perspectives generated with same context
- **Cost**: Reduced API usage and costs
- **Atomicity**: All perspectives succeed or fail together
- **Tracking**: Batch ID links related perspectives

## Usage Examples

### Basic Workflow

```javascript
import { ResourceManager } from '@legion/resource-manager';
import { DatabaseStorage } from '@legion/tools-registry';
import { Perspectives } from '@legion/tools-registry';

// Initialize
const resourceManager = await ResourceManager.getResourceManager();
const databaseStorage = new DatabaseStorage({ resourceManager });
await databaseStorage.initialize();

const perspectives = new Perspectives({ 
  resourceManager,
  options: { verbose: true }
});
await perspectives.initialize();

// Generate perspectives for a tool
const results = await perspectives.generatePerspectivesForTool('file_read');
console.log(`Generated ${results.length} perspectives`);

// Retrieve perspectives
const toolPerspectives = await perspectives.getPerspectivesForTool('file_read');
toolPerspectives.forEach(p => {
  console.log(`${p.perspective_type_name}: ${p.content}`);
});
```

### Custom Perspective Types

```javascript
// Add custom perspective type
const typeManager = new PerspectiveTypeManager({ db });
await typeManager.createType({
  name: 'api_documentation',
  description: 'API documentation format',
  prompt_template: 'Generate API docs for {tool_name}: {description}',
  category: 'documentation',
  enabled: true
});

// Generate with custom type
await perspectives.generatePerspectivesForTool('my_tool', {
  perspectiveTypes: ['api_documentation']
});
```

### Module-Level Generation

```javascript
// Generate for entire module with progress tracking
const results = await perspectives.generateForModule('FileModule', {
  forceRegenerate: false,
  useBatch: true,
  onProgress: (tool, index, total) => {
    console.log(`Processing ${tool} (${index}/${total})`);
  }
});

console.log(`Generated ${results.length} perspectives`);
```

## Testing

The architecture includes comprehensive testing support:

### Mock Generation
When no LLM client is configured, the system automatically uses mock generation:

```javascript
// Mock generation for testing
const mockPerspectives = await perspectives.generatePerspectivesForTool('test_tool');
// Returns realistic mock data with proper structure
```

### Test Helpers

```javascript
// Get statistics for assertions
const stats = await perspectives.getStatistics();
expect(stats.total).toBeGreaterThan(0);
expect(stats.perspectiveTypes.enabled).toBe(4);

// Check coverage
expect(stats.coverage.percentage).toBeGreaterThan(80);
```

## Best Practices

1. **Always use batch generation for modules** - More efficient than individual tool generation
2. **Monitor batch IDs** - Track related perspectives and generation sessions
3. **Use forceRegenerate sparingly** - Preserve existing perspectives when possible
4. **Enable only needed perspective types** - Reduce generation time and storage
5. **Index keywords properly** - Improves search performance
6. **Use canonical scripts** - Tested and production-ready

## Migration from Old Architecture

If migrating from the old JSON-based system:

1. Run database reset: `node scripts/reset-database.js --all --confirm`
2. Load tools: `node scripts/load-tools.js`
3. Generate perspectives: `node scripts/generate-perspectives.js`
4. Verify: `node scripts/check-status.js --verbose`

## Performance Considerations

- **Single LLM call**: ~2-3 seconds for all perspective types
- **Batch operations**: Use MongoDB bulk operations
- **Indexing**: Automatic index creation on initialization
- **Caching**: Perspectives cached in memory during session
- **Pagination**: Built-in support for large result sets

## Troubleshooting

### No perspectives generated
- Check LLM client configuration
- Verify tools are loaded in database
- Check perspective types are enabled

### Slow queries
- Run `check-status.js` to verify indexes
- Check MongoDB performance metrics
- Consider pagination for large results

### Generation failures
- Check LLM API key and limits
- Verify prompt templates are valid
- Check for network issues
- Use `--verbose` flag for detailed errors