# Tools Registry API Documentation

## Table of Contents
- [Perspectives Class](#perspectives-class)
- [PerspectiveTypeManager Class](#perspectivetypemanager-class)
- [DatabaseInitializer Class](#databaseinitializer-class)
- [DatabaseStorage Class](#databasestorage-class)

---

## Perspectives Class

Main class for perspective generation and management using the 3-collection architecture.

### Constructor

```javascript
new Perspectives(config)
```

**Parameters:**
- `config` (Object)
  - `resourceManager` (ResourceManager) - Required. ResourceManager instance
  - `options` (Object) - Optional configuration
    - `verbose` (Boolean) - Enable verbose logging. Default: `false`
    - `batchSize` (Number) - Batch size for operations. Default: `100`
    - `mockMode` (Boolean) - Force mock mode. Default: `false`

### Methods

#### initialize()

Initialize the Perspectives system.

```javascript
await perspectives.initialize()
```

**Returns:** `Promise<void>`

**Throws:** Error if initialization fails

---

#### generatePerspectivesForTool(toolName, options)

Generate all perspective types for a single tool in one LLM call.

```javascript
const perspectives = await perspectives.generatePerspectivesForTool('file_read', {
  forceRegenerate: false,
  perspectiveTypes: null
})
```

**Parameters:**
- `toolName` (String) - Name of the tool
- `options` (Object) - Optional
  - `forceRegenerate` (Boolean) - Regenerate even if exists. Default: `false`
  - `perspectiveTypes` (Array<String>) - Specific types to generate. Default: all enabled

**Returns:** `Promise<Array<Object>>` - Generated perspectives

**Throws:** Error if tool not found or generation fails

---

#### generateForModule(moduleName, options)

Generate perspectives for all tools in a module.

```javascript
const results = await perspectives.generateForModule('FileModule', {
  forceRegenerate: false,
  useBatch: true,
  onProgress: (tool, index, total) => {}
})
```

**Parameters:**
- `moduleName` (String) - Module name
- `options` (Object) - Optional
  - `forceRegenerate` (Boolean) - Force regeneration. Default: `false`
  - `useBatch` (Boolean) - Use same batch ID. Default: `true`
  - `onProgress` (Function) - Progress callback

**Returns:** `Promise<Array<Object>>` - All generated perspectives

---

#### generateAll(options)

Generate perspectives for all tools in the database.

```javascript
const summary = await perspectives.generateAll({
  forceRegenerate: false
})
// Returns: { generated: 120, skipped: 30, failed: 2, failures: [...] }
```

**Parameters:**
- `options` (Object) - Optional
  - `forceRegenerate` (Boolean) - Force regeneration. Default: `false`

**Returns:** `Promise<Object>` - Summary with counts and failures

---

#### getPerspectivesForTool(toolName, perspectiveType)

Retrieve perspectives for a tool.

```javascript
const perspectives = await perspectives.getPerspectivesForTool('file_read')
const examples = await perspectives.getPerspectivesForTool('file_read', 'usage_examples')
```

**Parameters:**
- `toolName` (String) - Tool name
- `perspectiveType` (String) - Optional. Specific type to retrieve

**Returns:** `Promise<Array<Object>>` - Tool perspectives

---

#### searchPerspectives(query, options)

Search perspectives using text search.

```javascript
const results = await perspectives.searchPerspectives('file handling', {
  limit: 10,
  perspectiveType: 'usage_examples',
  moduleName: 'FileModule'
})
```

**Parameters:**
- `query` (String) - Search query
- `options` (Object) - Optional
  - `limit` (Number) - Max results. Default: `20`
  - `perspectiveType` (String) - Filter by type
  - `moduleName` (String) - Filter by module

**Returns:** `Promise<Array<Object>>` - Matching perspectives

---

#### getStatistics()

Get comprehensive statistics about perspectives.

```javascript
const stats = await perspectives.getStatistics()
// {
//   total: 480,
//   perspectiveTypes: { total: 4, enabled: 4 },
//   coverage: { tools: 120, withPerspectives: 118, percentage: 98.3 },
//   byType: { usage_examples: 120, semantic_description: 120, ... },
//   byModule: { FileModule: 40, CalculatorModule: 20, ... },
//   recentBatches: [...]
// }
```

**Returns:** `Promise<Object>` - Detailed statistics

---

#### deletePerspectivesForTool(toolName)

Delete all perspectives for a tool.

```javascript
const deletedCount = await perspectives.deletePerspectivesForTool('obsolete_tool')
```

**Parameters:**
- `toolName` (String) - Tool name

**Returns:** `Promise<Number>` - Number of deleted perspectives

---

## PerspectiveTypeManager Class

Manages perspective type definitions.

### Constructor

```javascript
new PerspectiveTypeManager({ db, verbose })
```

**Parameters:**
- `config` (Object)
  - `db` (Db) - MongoDB database instance
  - `verbose` (Boolean) - Enable logging. Default: `false`

### Methods

#### createType(typeData)

Create a new perspective type.

```javascript
const type = await manager.createType({
  name: 'performance_tips',
  description: 'Performance optimization tips',
  prompt_template: 'Generate performance tips for {tool_name}',
  category: 'optimization',
  order: 5,
  enabled: true
})
```

**Parameters:**
- `typeData` (Object)
  - `name` (String) - Unique type name
  - `description` (String) - Type description
  - `prompt_template` (String) - LLM prompt template
  - `category` (String) - Type category
  - `order` (Number) - Display order
  - `enabled` (Boolean) - Whether enabled

**Returns:** `Promise<Object>` - Created type

**Throws:** Error if name already exists

---

#### updateType(name, updates)

Update an existing perspective type.

```javascript
const updated = await manager.updateType('usage_examples', {
  enabled: false,
  description: 'Updated description'
})
```

**Parameters:**
- `name` (String) - Type name
- `updates` (Object) - Fields to update

**Returns:** `Promise<Object>` - Updated type

**Throws:** Error if type not found

---

#### getType(name)

Get a perspective type by name.

```javascript
const type = await manager.getType('usage_examples')
```

**Parameters:**
- `name` (String) - Type name

**Returns:** `Promise<Object|null>` - Type or null

---

#### getAllTypes()

Get all perspective types.

```javascript
const types = await manager.getAllTypes()
```

**Returns:** `Promise<Array<Object>>` - All types sorted by order

---

#### getEnabledTypes()

Get only enabled perspective types.

```javascript
const enabledTypes = await manager.getEnabledTypes()
```

**Returns:** `Promise<Array<Object>>` - Enabled types

---

#### deleteType(name)

Delete a perspective type.

```javascript
const deleted = await manager.deleteType('obsolete_type')
```

**Parameters:**
- `name` (String) - Type name

**Returns:** `Promise<Boolean>` - Success status

**Note:** Also deletes all perspectives of this type

---

## DatabaseInitializer Class

Handles database initialization and setup.

### Constructor

```javascript
new DatabaseInitializer(config)
```

**Parameters:**
- `config` (Object)
  - `db` (Db) - MongoDB database instance
  - `resourceManager` (ResourceManager) - ResourceManager instance
  - `options` (Object) - Optional
    - `verbose` (Boolean) - Enable logging. Default: `true`
    - `seedData` (Boolean) - Seed default data. Default: `true`
    - `createIndexes` (Boolean) - Create indexes. Default: `true`

### Methods

#### initialize()

Run full initialization process.

```javascript
await initializer.initialize()
```

**Returns:** `Promise<Object>` - Initialization summary

**Process:**
1. Creates collections if needed
2. Seeds default perspective types
3. Creates indexes
4. Validates schema

---

#### createCollections()

Create required collections.

```javascript
await initializer.createCollections()
```

**Returns:** `Promise<void>`

---

#### seedPerspectiveTypes()

Seed default perspective types.

```javascript
await initializer.seedPerspectiveTypes()
```

**Returns:** `Promise<Number>` - Number of types seeded

**Default Types:**
- `usage_examples`
- `semantic_description`
- `related_tools`
- `troubleshooting`

---

#### createIndexes()

Create database indexes for optimal performance.

```javascript
await initializer.createIndexes()
```

**Returns:** `Promise<void>`

**Created Indexes:**
- perspective_types: `name` (unique), `category,order`
- tools: `name` (unique), `moduleName`
- tool_perspectives: `tool_id,perspective_type_id` (unique), `tool_name`, `batch_id`

---

## DatabaseStorage Class

Extended database storage with 3-collection support.

### Constructor

```javascript
new DatabaseStorage(config)
```

**Parameters:**
- `config` (Object)
  - `resourceManager` (ResourceManager) - Required
  - `databaseName` (String) - Database name. Default: `'legion_tools'`
  - `mongoUrl` (String) - MongoDB URL. Default: from env

### New Methods for 3-Collection Architecture

#### findTools(filter, options)

Find tools with filtering.

```javascript
const tools = await storage.findTools(
  { moduleName: 'FileModule' },
  { limit: 10, projection: { name: 1, description: 1 } }
)
```

**Parameters:**
- `filter` (Object) - MongoDB filter
- `options` (Object) - Query options

**Returns:** `Promise<Array<Object>>` - Matching tools

---

#### savePerspectives(perspectives)

Save multiple perspectives efficiently.

```javascript
await storage.savePerspectives([
  { tool_id: 'file:read', perspective_type_id: '...', content: '...' },
  { tool_id: 'file:write', perspective_type_id: '...', content: '...' }
])
```

**Parameters:**
- `perspectives` (Array<Object>) - Perspectives to save

**Returns:** `Promise<Object>` - Insert result

---

#### getPerspectives(filter, options)

Query tool perspectives.

```javascript
const perspectives = await storage.getPerspectives(
  { tool_name: 'file_read' },
  { sort: { generated_at: -1 } }
)
```

**Parameters:**
- `filter` (Object) - MongoDB filter
- `options` (Object) - Query options

**Returns:** `Promise<Array<Object>>` - Perspectives

---

#### deletePerspectives(filter)

Delete perspectives matching filter.

```javascript
const result = await storage.deletePerspectives({
  tool_name: 'deprecated_tool'
})
```

**Parameters:**
- `filter` (Object) - MongoDB filter

**Returns:** `Promise<Number>` - Deleted count

---

## Error Handling

All methods follow consistent error handling:

```javascript
try {
  const result = await perspectives.generatePerspectivesForTool('tool_name')
} catch (error) {
  if (error.code === 'TOOL_NOT_FOUND') {
    // Handle missing tool
  } else if (error.code === 'LLM_ERROR') {
    // Handle LLM failure
  } else {
    // Handle other errors
  }
}
```

**Common Error Codes:**
- `TOOL_NOT_FOUND` - Tool doesn't exist
- `LLM_ERROR` - LLM generation failed
- `DB_ERROR` - Database operation failed
- `VALIDATION_ERROR` - Invalid input
- `DUPLICATE_KEY` - Unique constraint violation

## TypeScript Support

TypeScript definitions are available:

```typescript
import { 
  Perspectives, 
  PerspectiveTypeManager,
  DatabaseInitializer,
  IPerspective,
  IPerspectiveType,
  IGenerationOptions,
  IStatistics
} from '@legion/tools-registry'
```