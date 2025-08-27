# MongoDB Query Tool for Legion

## Overview

A Legion tool that provides direct MongoDB database access through the existing Legion infrastructure. This tool leverages the ResourceManager pattern to automatically obtain a fully configured MongoDBProvider without manual configuration, enabling powerful database operations with native MongoDB JSON syntax.

## Architecture

### Module Structure

The mongo-query package follows Legion's standard module pattern:

```
packages/mongo-query/
├── src/
│   ├── index.js            # Module exportsV
│   ├── MongoQueryModule.js # Module implementation
│   └── MongoQueryTool.js   # Tool implementation
├── __tests__/
│   ├── unit/              # Unit tests
│   └── integration/       # Integration tests with real MongoDB
├── docs/
│   └── DESIGN.md         # This document
└── package.json
```

### Dependency Flow

```
ResourceManager (singleton, auto-initialized with .env)
    ↓
MongoQueryModule.create(resourceManager)
    ↓
Gets MongoDBProvider from ResourceManager
    ↓
Creates MongoQueryTool with provider
    ↓
Tool executes MongoDB operations
```

## Tool Interface

### Tool Description

```javascript
{
  name: 'mongo_query',
  description: 'Execute MongoDB database operations with native JSON syntax',
  inputSchema: {
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
        enum: [
          'find', 'findOne', 'insertOne', 'insertMany', 
          'updateOne', 'updateMany', 'deleteOne', 'deleteMany',
          'aggregate', 'countDocuments', 'distinct',
          'createIndex', 'dropCollection', 'listCollections'
        ],
        description: 'MongoDB command to execute'
      },
      params: {
        type: 'object',
        description: 'Parameters for the command in standard MongoDB JSON format'
      }
    },
    required: ['collection', 'command', 'params']
  }
}
```

### Command Parameter Mapping

Each MongoDB command accepts specific parameters matching MongoDB's native API:

#### Query Operations
- **find**: `{ query, options: { sort, limit, skip, projection } }`
- **findOne**: `{ query, options: { projection } }`
- **countDocuments**: `{ query }`
- **distinct**: `{ field, query }`
- **aggregate**: `{ pipeline }`

#### Write Operations
- **insertOne**: `{ document }`
- **insertMany**: `{ documents }`
- **updateOne**: `{ filter, update, options: { upsert } }`
- **updateMany**: `{ filter, update, options: { upsert } }`
- **deleteOne**: `{ filter }`
- **deleteMany**: `{ filter }`

#### Admin Operations
- **createIndex**: `{ keys, options }`
- **dropCollection**: `{}` (no params needed)
- **listCollections**: `{}` (no params needed)

## Implementation Details

### MongoQueryModule

```javascript
import { Module } from '@legion/tools-registry';
import { MongoQueryTool } from './MongoQueryTool.js';

export default class MongoQueryModule extends Module {
  constructor(dependencies = {}) {
    super();
    this.name = 'mongo-query';
    this.description = 'MongoDB query and manipulation tools';
    this.mongoProvider = dependencies.mongoProvider;
  }

  /**
   * Async factory method following ResourceManager pattern
   * Gets MongoDBProvider automatically from ResourceManager
   */
  static async create(resourceManager) {
    // Get MongoDB connection from ResourceManager
    const mongoUrl = resourceManager.get('env.MONGODB_URL');
    if (!mongoUrl) {
      throw new Error('MONGODB_URL environment variable is required');
    }

    // Get or create MongoDBProvider
    let mongoProvider = resourceManager.get('MongoDBProvider');
    if (!mongoProvider) {
      // Create provider if not already in ResourceManager
      const { MongoDBProvider } = await import('@legion/storage');
      const database = resourceManager.get('env.MONGODB_DATABASE') || 
                      resourceManager.get('env.TOOLS_DATABASE_NAME');
      
      mongoProvider = new MongoDBProvider({
        connectionString: mongoUrl,
        database: database
      });
      
      await mongoProvider.connect();
      resourceManager.set('MongoDBProvider', mongoProvider);
    }

    const module = new MongoQueryModule({ mongoProvider });
    await module.initialize();
    return module;
  }

  async initialize() {
    await super.initialize();
    
    // Create and register the query tool
    const queryTool = new MongoQueryTool({ 
      mongoProvider: this.mongoProvider 
    });
    
    this.registerTool(queryTool.name, queryTool);
  }
}
```

### MongoQueryTool

```javascript
import { Tool } from '@legion/tools-registry';
import { z } from 'zod';

export class MongoQueryTool extends Tool {
  constructor(dependencies = {}) {
    const inputSchema = z.object({
      database: z.string().optional()
        .describe('MongoDB database name (optional, defaults to .env)'),
      collection: z.string()
        .describe('Collection name to operate on'),
      command: z.enum([
        'find', 'findOne', 'insertOne', 'insertMany', 
        'updateOne', 'updateMany', 'deleteOne', 'deleteMany',
        'aggregate', 'countDocuments', 'distinct',
        'createIndex', 'dropCollection', 'listCollections'
      ]).describe('MongoDB command to execute'),
      params: z.object({}).passthrough()
        .describe('Command parameters in MongoDB JSON format')
    });

    super({
      name: 'mongo_query',
      description: 'Execute MongoDB database operations with native JSON syntax',
      inputSchema
    });
    
    this.mongoProvider = dependencies.mongoProvider;
    if (!this.mongoProvider) {
      throw new Error('MongoDBProvider is required');
    }
  }

  async _execute(args) {
    const { database, collection, command, params } = args;
    
    // Emit progress
    this.progress(`Executing ${command} on ${collection}`, 0);
    
    // Switch database if specified
    const originalDb = this.mongoProvider.databaseName;
    if (database && database !== originalDb) {
      await this.mongoProvider.useDatabase(database);
    }
    
    try {
      const result = await this.executeCommand(collection, command, params);
      
      this.info(`Command ${command} completed successfully`);
      
      return {
        database: database || originalDb,
        collection,
        command,
        result
      };
    } finally {
      // Restore original database if changed
      if (database && database !== originalDb) {
        await this.mongoProvider.useDatabase(originalDb);
      }
    }
  }

  async executeCommand(collection, command, params) {
    switch (command) {
      // Query operations
      case 'find':
        return await this.mongoProvider.find(
          collection, 
          params.query || {}, 
          params.options || {}
        );
      
      case 'findOne':
        return await this.mongoProvider.findOne(
          collection,
          params.query || {},
          params.options || {}
        );
      
      case 'countDocuments':
        return await this.mongoProvider.count(
          collection,
          params.query || {}
        );
      
      case 'distinct':
        return await this.mongoProvider.distinct(
          collection,
          params.field,
          params.query || {}
        );
      
      case 'aggregate':
        return await this.mongoProvider.aggregate(
          collection,
          params.pipeline || []
        );
      
      // Write operations
      case 'insertOne':
        return await this.mongoProvider.insert(
          collection,
          params.document
        );
      
      case 'insertMany':
        return await this.mongoProvider.insert(
          collection,
          params.documents
        );
      
      case 'updateOne':
        return await this.mongoProvider.update(
          collection,
          params.filter,
          params.update,
          { ...params.options, multi: false }
        );
      
      case 'updateMany':
        return await this.mongoProvider.update(
          collection,
          params.filter,
          params.update,
          { ...params.options, multi: true }
        );
      
      case 'deleteOne':
        return await this.mongoProvider.delete(
          collection,
          params.filter,
          { multi: false }
        );
      
      case 'deleteMany':
        return await this.mongoProvider.delete(
          collection,
          params.filter,
          { multi: true }
        );
      
      // Admin operations
      case 'createIndex':
        return await this.mongoProvider.createIndex(
          collection,
          params.keys,
          params.options || {}
        );
      
      case 'dropCollection':
        return await this.mongoProvider.dropCollection(collection);
      
      case 'listCollections':
        return await this.mongoProvider.listCollections();
      
      default:
        throw new Error(`Unsupported command: ${command}`);
    }
  }
}
```

## Usage Examples

### Basic Query
```javascript
const result = await mongoQueryTool.execute({
  collection: 'users',
  command: 'find',
  params: {
    query: { active: true },
    options: {
      limit: 10,
      sort: { createdAt: -1 }
    }
  }
});
```

### Insert Document
```javascript
const result = await mongoQueryTool.execute({
  collection: 'logs',
  command: 'insertOne',
  params: {
    document: {
      timestamp: new Date(),
      level: 'info',
      message: 'Application started'
    }
  }
});
```

### Update Multiple Documents
```javascript
const result = await mongoQueryTool.execute({
  collection: 'users',
  command: 'updateMany',
  params: {
    filter: { status: 'pending' },
    update: { $set: { status: 'active' } },
    options: { upsert: false }
  }
});
```

### Aggregation Pipeline
```javascript
const result = await mongoQueryTool.execute({
  collection: 'orders',
  command: 'aggregate',
  params: {
    pipeline: [
      { $match: { status: 'completed' } },
      { $group: { 
        _id: '$customerId', 
        total: { $sum: '$amount' } 
      }},
      { $sort: { total: -1 } },
      { $limit: 10 }
    ]
  }
});
```

### Switch Database
```javascript
const result = await mongoQueryTool.execute({
  database: 'analytics',
  collection: 'events',
  command: 'countDocuments',
  params: {
    query: { type: 'click' }
  }
});
```

## Error Handling

The tool provides comprehensive error handling:

1. **Validation Errors**: Input validation via Zod schema
2. **Connection Errors**: MongoDB connection failures
3. **Command Errors**: Invalid commands or parameters
4. **Database Errors**: MongoDB operation failures

All errors are wrapped in Legion's standard error format:
```javascript
{
  success: false,
  data: {
    errorMessage: 'Detailed error message',
    code: 'ERROR_CODE',
    tool: 'mongo_query',
    database: 'database_name',
    collection: 'collection_name',
    command: 'command_name'
  }
}
```

## Testing Strategy

### Unit Tests
- Tool input validation
- Command parameter mapping
- Error handling scenarios
- Database switching logic

### Integration Tests
- Real MongoDB operations (using ResourceManager)
- All command types with various parameters
- Error conditions with actual database
- Multi-database operations
- Complex aggregation pipelines

## Benefits

1. **No Configuration Required** - ResourceManager handles all MongoDB setup
2. **Native MongoDB Syntax** - Uses familiar MongoDB JSON format
3. **Full Feature Support** - All major MongoDB operations available
4. **Legion Integration** - Follows Legion patterns and conventions
5. **Event Emission** - Progress, info, warning, error events
6. **Automatic Validation** - Zod schema validation on inputs
7. **Database Flexibility** - Switch databases on the fly
8. **Error Recovery** - Comprehensive error handling and reporting

## Security Considerations

1. **No Direct Code Execution** - Only predefined MongoDB operations
2. **Input Validation** - All inputs validated through Zod schema
3. **Connection Security** - Uses existing secure MongoDB connection from .env
4. **Operation Limits** - Can add limits on result sizes if needed
5. **Database Isolation** - Operations scoped to specified database/collection

## Future Enhancements

1. **Transaction Support** - Add multi-document transaction capabilities
2. **Bulk Operations** - Optimize for bulk write operations
3. **Change Streams** - Support for real-time change monitoring
4. **Schema Validation** - Add collection schema validation support
5. **Query Builder** - Helper methods for complex query construction
6. **Performance Metrics** - Track and report operation performance
7. **Caching Layer** - Optional result caching for read operations