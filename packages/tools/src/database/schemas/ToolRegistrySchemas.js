/**
 * MongoDB Collection Schemas for Tool Registry
 * 
 * Defines the structure and validation rules for tool registry collections
 * using MongoDB schema validation and indexing strategies.
 */

/**
 * Modules Collection Schema
 * Stores module definitions with metadata, dependencies, and tool references
 */
export const ModulesCollectionSchema = {
  name: 'modules',
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'description', 'type', 'path'],
      properties: {
        name: {
          bsonType: 'string',
          minLength: 1,
          maxLength: 100,
          pattern: '^[a-z0-9-]+$',
          description: 'Module name (kebab-case, unique identifier)'
        },
        description: {
          bsonType: 'string',
          minLength: 10,
          maxLength: 500,
          description: 'Human-readable description of the module\'s purpose'
        },
        version: {
          bsonType: 'string',
          pattern: '^\\d+\\.\\d+\\.\\d+$',
          description: 'Semantic version string'
        },
        path: {
          bsonType: 'string',
          minLength: 1,
          description: 'Relative path to module file from package root'
        },
        className: {
          bsonType: 'string',
          description: 'Class name for class-based modules'
        },
        type: {
          bsonType: 'string',
          enum: ['class', 'module.json', 'definition', 'dynamic'],
          description: 'Module loading strategy type'
        },
        dependencies: {
          bsonType: 'array',
          items: {
            bsonType: 'string'
          },
          description: 'List of environment variables or system dependencies'
        },
        tags: {
          bsonType: 'array',
          items: {
            bsonType: 'string',
            pattern: '^[a-z0-9-]+$'
          },
          description: 'Searchable tags for categorization'
        },
        category: {
          bsonType: 'string',
          enum: [
            'filesystem', 'network', 'data', 'ai', 'development', 
            'deployment', 'testing', 'utility', 'integration', 'storage'
          ],
          description: 'Primary functional category'
        },
        config: {
          bsonType: 'object',
          description: 'Module-specific configuration options'
        },
        status: {
          bsonType: 'string',
          enum: ['active', 'deprecated', 'experimental', 'maintenance'],
          description: 'Module lifecycle status'
        },
        maintainer: {
          bsonType: 'object',
          properties: {
            name: { bsonType: 'string' },
            email: { bsonType: 'string' },
            url: { bsonType: 'string' }
          },
          description: 'Module maintainer information'
        },
        toolCount: {
          bsonType: 'int',
          minimum: 0,
          description: 'Cached count of tools provided by this module'
        },
        createdAt: {
          bsonType: 'date',
          description: 'Module creation timestamp'
        },
        updatedAt: {
          bsonType: 'date', 
          description: 'Last modification timestamp'
        }
      }
    }
  },
  indexes: [
    { name: 1 }, // Unique index on module name
    { tags: 1 }, // Multi-key index for tag searches
    { category: 1 },
    { status: 1 },
    { 'name': 'text', 'description': 'text', 'tags': 'text' }, // Full-text search
    { createdAt: -1 },
    { updatedAt: -1 }
  ],
  uniqueIndexes: [
    { name: 1 } // Ensure module names are unique
  ]
};

/**
 * Tools Collection Schema
 * Stores individual tool definitions with schemas, examples, and semantic embeddings
 */
export const ToolsCollectionSchema = {
  name: 'tools',
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'moduleId', 'description'],
      properties: {
        name: {
          bsonType: 'string',
          minLength: 1,
          maxLength: 100,
          pattern: '^[a-z0-9_]+$',
          description: 'Tool name (snake_case)'
        },
        moduleId: {
          bsonType: 'objectId',
          description: 'Reference to the parent module'
        },
        moduleName: {
          bsonType: 'string',
          description: 'Denormalized module name for efficient queries'
        },
        description: {
          bsonType: 'string',
          minLength: 10,
          maxLength: 1000,
          description: 'Detailed description of tool functionality'
        },
        summary: {
          bsonType: 'string',
          maxLength: 200,
          description: 'Brief one-line summary for quick reference'
        },
        inputSchema: {
          bsonType: 'object',
          description: 'JSON Schema or Zod schema definition for tool inputs'
        },
        outputSchema: {
          bsonType: 'object',
          description: 'JSON Schema definition for expected outputs'
        },
        examples: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            required: ['title', 'input'],
            properties: {
              title: { bsonType: 'string' },
              description: { bsonType: 'string' },
              input: { bsonType: 'object' },
              output: { bsonType: 'object' }
            }
          },
          description: 'Example usage scenarios with inputs and outputs'
        },
        tags: {
          bsonType: 'array',
          items: {
            bsonType: 'string',
            pattern: '^[a-z0-9-]+$'
          },
          description: 'Searchable tags for functionality'
        },
        category: {
          bsonType: 'string',
          enum: [
            'read', 'write', 'create', 'delete', 'update', 'search',
            'transform', 'validate', 'execute', 'generate', 'analyze'
          ],
          description: 'Primary operation category'
        },
        complexity: {
          bsonType: 'string',
          enum: ['simple', 'moderate', 'complex'],
          description: 'Tool complexity level'
        },
        permissions: {
          bsonType: 'array',
          items: {
            bsonType: 'string'
          },
          description: 'Required permissions or capabilities'
        },
        embedding: {
          bsonType: 'array',
          items: {
            bsonType: 'double'
          },
          description: 'Semantic embedding vector for similarity search'
        },
        embeddingModel: {
          bsonType: 'string',
          description: 'Model used to generate the embedding'
        },
        status: {
          bsonType: 'string',
          enum: ['active', 'deprecated', 'experimental', 'maintenance'],
          description: 'Tool lifecycle status'
        },
        performance: {
          bsonType: 'object',
          properties: {
            avgExecutionTime: { bsonType: 'double' },
            successRate: { bsonType: 'double' },
            lastBenchmark: { bsonType: 'date' }
          },
          description: 'Performance metrics'
        },
        createdAt: {
          bsonType: 'date',
          description: 'Tool creation timestamp'
        },
        updatedAt: {
          bsonType: 'date',
          description: 'Last modification timestamp'
        }
      }
    }
  },
  indexes: [
    { name: 1 },
    { moduleId: 1 },
    { moduleName: 1 },
    { tags: 1 },
    { category: 1 },
    { status: 1 },
    { 'name': 'text', 'description': 'text', 'summary': 'text', 'tags': 'text' }, // Full-text search
    { createdAt: -1 },
    { updatedAt: -1 }
  ],
  uniqueIndexes: [
    { name: 1, moduleName: 1 } // Ensure tool names are unique within modules
  ]
};

/**
 * Collection initialization configurations
 */
export const ToolRegistryCollections = {
  modules: ModulesCollectionSchema,
  tools: ToolsCollectionSchema
};

/**
 * Database initialization helper
 * Creates collections with validation and indexes
 */
export class ToolRegistrySchemaManager {
  constructor(storageProvider) {
    this.storageProvider = storageProvider;
    this.mongoProvider = storageProvider.getProvider('mongodb');
  }

  /**
   * Initialize all tool registry collections with proper validation and indexes
   */
  async initializeCollections() {
    const results = [];

    for (const [collectionName, schema] of Object.entries(ToolRegistryCollections)) {
      try {
        console.log(`Creating collection ${collectionName}...`);
        
        // Create collection with validation
        await this.mongoProvider.db.createCollection(collectionName, {
          validator: schema.validator
        });

        // Create regular indexes
        if (schema.indexes) {
          for (const indexSpec of schema.indexes) {
            await this.mongoProvider.createIndex(collectionName, indexSpec);
          }
        }

        // Create unique indexes
        if (schema.uniqueIndexes) {
          for (const indexSpec of schema.uniqueIndexes) {
            await this.mongoProvider.createIndex(collectionName, indexSpec, { unique: true });
          }
        }

        results.push({
          collection: collectionName,
          status: 'created',
          indexes: (schema.indexes?.length || 0) + (schema.uniqueIndexes?.length || 0)
        });

      } catch (error) {
        if (error.code === 48) {
          // Collection already exists
          results.push({
            collection: collectionName,
            status: 'exists',
            message: 'Collection already exists'
          });
        } else {
          results.push({
            collection: collectionName,
            status: 'error',
            error: error.message
          });
        }
      }
    }

    return results;
  }

  /**
   * Drop all tool registry collections (use with caution)
   */
  async dropCollections() {
    const results = [];

    for (const collectionName of Object.keys(ToolRegistryCollections)) {
      try {
        const dropped = await this.mongoProvider.dropCollection(collectionName);
        results.push({
          collection: collectionName,
          status: dropped ? 'dropped' : 'not_found'
        });
      } catch (error) {
        results.push({
          collection: collectionName,
          status: 'error',
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Validate collection schemas
   */
  async validateCollections() {
    const results = [];

    for (const collectionName of Object.keys(ToolRegistryCollections)) {
      try {
        const collections = await this.mongoProvider.listCollections();
        const exists = collections.includes(collectionName);
        
        if (exists) {
          // TODO: Add schema validation check
          results.push({
            collection: collectionName,
            status: 'valid',
            exists: true
          });
        } else {
          results.push({
            collection: collectionName,
            status: 'missing',
            exists: false
          });
        }
      } catch (error) {
        results.push({
          collection: collectionName,
          status: 'error',
          error: error.message
        });
      }
    }

    return results;
  }
}