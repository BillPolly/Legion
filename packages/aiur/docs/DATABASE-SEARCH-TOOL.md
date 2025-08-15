# Database Search Tool for Aiur MCP Server

## Overview

Add a database search tool to the Aiur MCP server that provides direct MongoDB access through the existing Legion infrastructure. This tool will leverage the ResourceManager pattern to get a fully configured MongoDBProvider without any manual configuration.

## Architecture

### Clean Dependency Injection

```
AiurServer 
  ↓ creates
ModuleLoader (with internal ResourceManager)
  ↓ ResourceManager provides
StorageProvider 
  ↓ provides
MongoDBProvider (fully configured)
  ↓ used by
DatabaseSearchTool
```

### Key Design Principles

1. **Zero Configuration** - The tool gets a fully configured MongoDBProvider from ResourceManager
2. **No Manual Setup** - ResourceManager already loaded .env and configured MongoDB connection
3. **Direct Access** - Use the base MongoDBProvider, not wrapped abstractions
4. **Legion Pattern** - Follows existing dependency injection patterns

## Implementation

### 1. Tool Definition

```javascript
// packages/aiur/src/tools/DatabaseSearchTool.js
import { Tool } from '@legion/module-loader';
import { z } from 'zod';

export class DatabaseSearchTool extends Tool {
  constructor(dependencies = {}) {
    super({
      name: 'db_search',
      description: 'Search MongoDB collections with flexible query options',
      inputSchema: z.object({
        database: z.string().default('legion_tools'),
        collection: z.string().describe('Collection name (e.g., tools, modules, tool_perspectives)'),
        query: z.record(z.any()).optional().default({}),
        options: z.object({
          limit: z.number().optional().default(100),
          skip: z.number().optional(),
          sort: z.record(z.number()).optional(),
          projection: z.record(z.number()).optional()
        }).optional()
      })
    });
    
    this.mongoProvider = dependencies.mongoProvider;
  }

  async execute(args) {
    const { database, collection, query, options } = args;
    
    // Switch database if needed
    if (database !== 'legion_tools') {
      await this.mongoProvider.switchDatabase(database);
    }
    
    try {
      const results = await this.mongoProvider.find(collection, query, options);
      
      return {
        success: true,
        database,
        collection,
        count: results.length,
        data: results
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        database,
        collection
      };
    }
  }
}
```

### 2. Integration in AiurServer

```javascript
// In AiurServer._initializeSystems() after line 122

// Get the MongoDBProvider from ResourceManager
const storageProvider = await StorageProvider.create(this.moduleLoader.resourceManager);
const mongoProvider = storageProvider.getProvider('mongodb');

// Create and register the database search tool
const { DatabaseSearchTool } = await import('../tools/DatabaseSearchTool.js');
const dbSearchTool = new DatabaseSearchTool({ mongoProvider });

// Register with the module loader's tool registry
this.moduleLoader.toolRegistry.registerTool(dbSearchTool);
```

### 3. Alternative: Create as a Module

```javascript
// packages/aiur/src/modules/DatabaseModule.js
import { Module } from '@legion/module-loader';
import { DatabaseSearchTool } from '../tools/DatabaseSearchTool.js';

export default class DatabaseModule extends Module {
  static async create(resourceManager) {
    const storageProvider = await StorageProvider.create(resourceManager);
    const mongoProvider = storageProvider.getProvider('mongodb');
    
    return new DatabaseModule({ mongoProvider });
  }
  
  constructor(dependencies) {
    super('DatabaseModule', dependencies);
  }
  
  getTools() {
    return [
      new DatabaseSearchTool({ mongoProvider: this.dependencies.mongoProvider })
    ];
  }
}
```

## Usage Examples

### Search for Git Tools
```javascript
await db_search({
  collection: 'tools',
  query: { name: { $regex: 'git' } },
  options: {
    projection: { name: 1, description: 1 },
    limit: 10
  }
});
```

### Count Perspectives
```javascript
await db_search({
  collection: 'tool_perspectives', 
  query: {},
  options: { limit: 0 }  // Just count
});
```

### Get Module Statistics
```javascript
await db_search({
  collection: 'modules',
  query: {},
  options: {
    sort: { toolCount: -1 },
    projection: { name: 1, toolCount: 1 }
  }
});
```

## Benefits

1. **No Configuration Required** - ResourceManager handles everything
2. **Consistent with Legion** - Uses existing patterns
3. **Direct Database Access** - No abstraction overhead
4. **Flexible Queries** - Full MongoDB query syntax support
5. **Debugging Power** - Inspect any collection directly

## Testing

```javascript
// Test the tool after implementation
const result = await db_search({
  collection: 'tools',
  query: {},
  options: { limit: 5 }
});

console.log(`Found ${result.count} tools:`, result.data);
```

## Notes

- The MongoDBProvider is already configured with the connection string from .env
- Database defaults to 'legion_tools' but can be changed
- All MongoDB query operators are supported ($regex, $gt, $in, etc.)
- Results are returned as JSON, perfect for MCP protocol