# Database Search Tool for MCP Server

## Overview

Add a database search tool to the MCP server that provides direct MongoDB access through the existing Legion infrastructure. This tool will leverage the ResourceManager pattern to get a fully configured MongoDBProvider without any manual configuration.

## Tool Description (What LLMs See)

```
Tool: db_search
Description: Execute MongoDB database operations with native JSON syntax

Parameters:
  - database: (optional) MongoDB database name, defaults to the database configured in .env
  - collection: (required) Collection name to operate on  
  - command: (required) MongoDB command (find, insertOne, updateMany, deleteOne, aggregate, etc.)
  - json: (required) Parameters for the command in standard MongoDB JSON format
```

### How It Works

The tool accepts MongoDB commands exactly as you would write them, just split into command and parameters:
- **command** is the MongoDB method name (find, insertOne, updateMany, etc.)
- **json** contains the parameters that method expects (query, document, filter/update, pipeline, etc.)

This matches MongoDB's actual syntax where the operation is always separate from its data.

## Architecture

### Simple Pattern

```
MCP Server startup:
1. Create ResourceManager
2. Get StorageProvider from ResourceManager  
3. Get MongoDBProvider from StorageProvider
4. Use it in the tool - DONE!
```

The MongoDBProvider is fully configured from .env automatically. No additional setup needed.

## Implementation

### 1. Tool Definition

```javascript
// packages/mcps/mcp-monitor/tools/DatabaseSearchTool.js
import { Tool } from '@legion/tools-registry';

const inputSchema = {
  type: 'object',
  properties: {
    database: {
      type: 'string',
      description: 'MongoDB database name (optional, defaults to database from .env)'
    },
    collection: {
      type: 'string',
      description: 'Collection name to operate on'
    },
    command: {
      type: 'string',
      description: 'MongoDB command: find, insertOne, insertMany, updateOne, updateMany, deleteOne, deleteMany, aggregate, countDocuments, distinct, createIndex, dropCollection, etc.'
    },
    json: {
      type: 'object',
      description: 'Parameters for the command in standard MongoDB JSON format'
    }
  },
  required: ['collection', 'command', 'json'],
  additionalProperties: false
};

export class DatabaseSearchTool extends Tool {
  constructor(dependencies = {}) {
    super({
      name: 'db_search',
      description: 'Execute MongoDB database operations with native JSON syntax',
      inputSchema  // JSON Schema - Tool class handles validation automatically
    });
    
    this.mongoProvider = dependencies.mongoProvider;
  }

  async execute(args) {
    const { database, collection, command, json } = args;
    
    // Use specified database or keep the default from .env
    if (database) {
      await this.mongoProvider.useDatabase(database);
    }
    
    try {
      let result;
      
      switch (command) {
        // Query operations
        case 'find':
          result = await this.mongoProvider.find(collection, json.query || json, json.options);
          break;
        case 'findOne':
          result = await this.mongoProvider.findOne(collection, json.query || json, json.options);
          break;
        case 'countDocuments':
          result = await this.mongoProvider.count(collection, json.query || json);
          break;
        case 'distinct':
          result = await this.mongoProvider.distinct(collection, json.field, json.query);
          break;
        case 'aggregate':
          result = await this.mongoProvider.aggregate(collection, json.pipeline || json);
          break;
          
        // Write operations
        case 'insertOne':
          result = await this.mongoProvider.insert(collection, json.document || json);
          break;
        case 'insertMany':
          result = await this.mongoProvider.insertMany(collection, json.documents || json);
          break;
        case 'updateOne':
          result = await this.mongoProvider.update(collection, json.filter, json.update, json.options);
          break;
        case 'updateMany':
          result = await this.mongoProvider.updateMany(collection, json.filter, json.update, json.options);
          break;
        case 'deleteOne':
          result = await this.mongoProvider.delete(collection, json.filter || json);
          break;
        case 'deleteMany':
          result = await this.mongoProvider.deleteMany(collection, json.filter || json);
          break;
          
        // Admin operations
        case 'createCollection':
          result = await this.mongoProvider.createCollection(collection, json.options || json);
          break;
        case 'dropCollection':
          result = await this.mongoProvider.dropCollection(collection);
          break;
        case 'createIndex':
          result = await this.mongoProvider.createIndex(collection, json.keys, json.options);
          break;
        case 'dropDatabase':
          result = await this.mongoProvider.dropDatabase();
          break;
        case 'listCollections':
          result = await this.mongoProvider.listCollections();
          break;
          
        default:
          throw new Error(`Unsupported command: ${command}`);
      }
      
      return {
        success: true,
        database,
        command,
        collection,
        result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        database,
        command,
        collection
      };
    }
  }
}
```

### 2. Integration in MCP Server

```javascript
// In MCP server initialization - SIMPLE!

import { getResourceManager } from '@legion/core';

// Get the singleton ResourceManager (auto-initializes)
const resourceManager = await getResourceManager();

// Get the MongoDBProvider by name - generic pattern
const mongoProvider = resourceManager.get('MongoDBProvider');

// Store it and use it in the tool
this.mongoProvider = mongoProvider;
```

## Usage Examples

### Find Documents
```javascript
// Simple find with query
await db_search({
  collection: 'tools',
  command: 'find',
  json: { name: { $regex: 'git' } }
});

// Find with options
await db_search({
  collection: 'tools',
  command: 'find',
  json: {
    query: { module: 'GitModule' },
    options: {
      limit: 10,
      sort: { name: 1 },
      projection: { name: 1, description: 1 }
    }
  }
});
```

### Insert Documents
```javascript
// Insert one document
await db_search({
  collection: 'tools',
  command: 'insertOne',
  json: {
    name: 'my_tool',
    description: 'A custom tool',
    module: 'CustomModule'
  }
});

// Insert multiple documents
await db_search({
  collection: 'tools',
  command: 'insertMany',
  json: [
    { name: 'tool1', description: 'First tool' },
    { name: 'tool2', description: 'Second tool' }
  ]
});
```

### Update Documents
```javascript
// Update many documents
await db_search({
  collection: 'tools',
  command: 'updateMany',
  json: {
    filter: { module: 'OldModule' },
    update: { $set: { module: 'NewModule' } }
  }
});

// Update with options
await db_search({
  collection: 'tools',
  command: 'updateOne',
  json: {
    filter: { name: 'my_tool' },
    update: { $inc: { version: 1 } },
    options: { upsert: true }
  }
});
```

### Delete Documents
```javascript
// Delete multiple documents
await db_search({
  collection: 'tool_perspectives',
  command: 'deleteMany',
  json: { createdAt: { $lt: '2024-01-01' } }
});

// Delete with filter object
await db_search({
  collection: 'tools',
  command: 'deleteOne',
  json: {
    filter: { _id: 'some-id' }
  }
});
```

### Aggregation Pipeline
```javascript
await db_search({
  collection: 'tools',
  command: 'aggregate',
  json: [
    { $match: { module: { $exists: true } } },
    { $group: { _id: '$module', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]
});
```

### Count Documents
```javascript
await db_search({
  collection: 'tools',
  command: 'countDocuments',
  json: { module: 'GitModule' }
});
```

### Admin Operations
```javascript
// Create a new collection
await db_search({
  collection: 'custom_data',
  command: 'createCollection',
  json: {
    validator: { $jsonSchema: { /* schema */ } }
  }
});

// Drop a collection
await db_search({
  collection: 'temp_data',
  command: 'dropCollection',
  json: {}
});

// List all collections (no collection needed)
await db_search({
  collection: '',
  command: 'listCollections',
  json: {}
});

// Use default database from .env
await db_search({
  collection: 'users',
  command: 'find',
  json: { active: true }
});

// Override to use a different database
await db_search({
  database: 'custom_db',
  collection: 'users',
  command: 'find',
  json: { active: true }
});
```

## Benefits

1. **No Configuration Required** - ResourceManager handles everything
2. **Consistent with Legion** - Uses existing patterns
3. **Direct Database Access** - No abstraction overhead
4. **Flexible Queries** - Full MongoDB query syntax support with Legion schema validation
5. **Debugging Power** - Inspect any collection directly

## Testing

```javascript
// Test the tool after implementation
const result = await db_search({
  collection: 'tools',
  command: 'find',
  json: {
    query: {},
    options: { limit: 5 }
  }
});

console.log(`Found ${result.result.length} tools:`, result.result);
```

## Notes

- The MongoDBProvider is already configured with the connection string and default database from .env
- Database defaults to the one specified in MONGODB_URL but can be overridden
- All MongoDB query operators are supported ($regex, $gt, $in, etc.)
- Results are returned as JSON, perfect for MCP protocol
- Input validation is handled by the Tool class using JSON Schema automatically