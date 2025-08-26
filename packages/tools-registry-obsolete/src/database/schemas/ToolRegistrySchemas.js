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
          pattern: '^[a-zA-Z0-9][a-zA-Z0-9_-]*$',
          description: 'Module name (supports kebab-case, snake_case, PascalCase, camelCase)'
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
        loadingStatus: {
          bsonType: 'string',
          enum: ['pending', 'loading', 'loaded', 'unloaded', 'failed'],
          description: 'Current module loading state'
        },
        indexingStatus: {
          bsonType: 'string',
          enum: ['pending', 'indexing', 'indexed', 'failed'],
          description: 'Current module indexing state for perspectives/vectors'
        },
        validationStatus: {
          bsonType: 'string',
          enum: ['pending', 'validating', 'validated', 'failed', 'warnings'],
          description: 'Current validation state'
        },
        lastLoadedAt: {
          bsonType: 'date',
          description: 'When module was last successfully loaded'
        },
        lastIndexedAt: {
          bsonType: 'date',
          description: 'When module perspectives were last indexed'
        },
        loadingError: {
          bsonType: 'string',
          description: 'Error message if loading failed'
        },
        indexingError: {
          bsonType: 'string',
          description: 'Error message if indexing failed'
        },
        perspectiveCount: {
          bsonType: 'int',
          minimum: 0,
          description: 'Cached count of perspectives generated for this module'
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
 * Perspective Types Collection Schema
 * Stores configurable perspective type definitions for dynamic perspective generation
 */
export const PerspectiveTypesCollectionSchema = {
  name: 'perspective_types',
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['type', 'name', 'description', 'textTemplate', 'enabled'],
      properties: {
        type: {
          bsonType: 'string',
          minLength: 1,
          maxLength: 50,
          pattern: '^[a-z_]+$',
          description: 'Unique identifier for perspective type (snake_case)'
        },
        name: {
          bsonType: 'string',
          minLength: 1,
          maxLength: 100,
          description: 'Human-readable name for this perspective type'
        },
        description: {
          bsonType: 'string',
          minLength: 10,
          maxLength: 500,
          description: 'Detailed description of what this perspective captures'
        },
        condition: {
          bsonType: 'string',
          enum: ['always', 'has_description', 'has_capabilities', 'has_examples', 'has_input_schema', 'has_name_variations'],
          description: 'Condition that must be met for this perspective to be generated'
        },
        textTemplate: {
          bsonType: 'string',
          minLength: 1,
          maxLength: 500,
          description: 'Template string with placeholders like ${name}, ${description}, etc.'
        },
        priority: {
          bsonType: 'int',
          minimum: 1,
          maximum: 100,
          description: 'Generation priority (lower numbers = higher priority)'
        },
        enabled: {
          bsonType: 'bool',
          description: 'Whether this perspective type is currently enabled'
        },
        createdAt: {
          bsonType: 'date',
          description: 'When this perspective type was created'
        },
        updatedAt: {
          bsonType: 'date',
          description: 'When this perspective type was last modified'
        }
      }
    }
  },
  indexes: [
    { type: 1 },
    { enabled: 1 },
    { priority: 1 },
    { condition: 1 }
  ],
  uniqueIndexes: [
    { type: 1 } // Ensure perspective type identifiers are unique
  ]
};

/**
 * Tool Perspectives Collection Schema
 * Stores generated glosses/perspectives for semantic search with different textual representations
 */
export const ToolPerspectivesCollectionSchema = {
  name: 'tool_perspectives',
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['toolId', 'toolName', 'perspectiveType', 'perspectiveText'],
      properties: {
        toolId: {
          bsonType: 'objectId',
          description: 'Reference to the parent tool in tools collection'
        },
        toolName: {
          bsonType: 'string',
          minLength: 1,
          maxLength: 100,
          description: 'Denormalized tool name for efficient queries'
        },
        perspectiveType: {
          bsonType: 'string',
          minLength: 1,
          maxLength: 50,
          description: 'Type of perspective/gloss generated (references perspective_types.type)'
        },
        perspectiveText: {
          bsonType: 'string',
          minLength: 1,
          maxLength: 1000,
          description: 'The actual text content of this perspective'
        },
        embeddingId: {
          bsonType: 'string',
          description: 'Unique identifier linking to vector database embedding'
        },
        embedding: {
          bsonType: 'array',
          items: {
            bsonType: 'double'
          },
          minItems: 768,
          maxItems: 768,
          description: 'Semantic embedding vector for this perspective text (768 dimensions for Nomic model)'
        },
        embeddingModel: {
          bsonType: 'string',
          enum: ['nomic-embed-text-v1', 'all-MiniLM-L6-v2', 'text-embedding-ada-002'],
          description: 'Model used to generate the embedding'
        },
        generatedAt: {
          bsonType: 'date',
          description: 'When this perspective was generated'
        },
        generationMethod: {
          bsonType: 'string',
          enum: ['automatic', 'llm-enhanced', 'manual'],
          description: 'How this perspective was generated'
        },
        metadata: {
          bsonType: 'object',
          description: 'Additional metadata about perspective generation'
        }
      }
    }
  },
  indexes: [
    { toolId: 1 },
    { toolName: 1 },
    { perspectiveType: 1 },
    { embeddingId: 1 },
    { toolId: 1, perspectiveType: 1 }, // Compound index for tool+type queries
    { generatedAt: -1 },
    { 'perspectiveText': 'text' } // Full-text search on perspective content
  ],
  uniqueIndexes: [
    { embeddingId: 1 } // Ensure embedding IDs are unique
  ]
};

/**
 * Tools Collection Schema
 * Stores individual tool definitions with schemas, examples, and semantic embeddings
 * SIMPLIFIED VALIDATION: Only validates essential fields to avoid MongoDB validation issues
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
          description: 'JSON Schema definition for tool inputs (flexible validation)'
        },
        outputSchema: {
          bsonType: 'object',
          description: 'JSON Schema definition for expected outputs (flexible validation)'
        },
        examples: {
          bsonType: 'array',
          description: 'Example usage scenarios with inputs and outputs'
        },
        tags: {
          bsonType: 'array',
          items: {
            bsonType: 'string'
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
          enum: ['nomic-embed-text-v1', 'all-MiniLM-L6-v2', 'text-embedding-ada-002'],
          description: 'Model used to generate the embedding'
        },
        status: {
          bsonType: 'string',
          enum: ['active', 'deprecated', 'experimental', 'maintenance'],
          description: 'Tool lifecycle status'
        },
        performance: {
          bsonType: 'object',
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
 * Module Registry Collection Schema
 * Permanent storage of discovered module metadata
 * This collection is NEVER cleared during normal operations
 */
export const ModuleRegistryCollectionSchema = {
  name: 'module_registry',
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'type', 'path'],
      properties: {
        name: {
          bsonType: 'string',
          minLength: 1,
          maxLength: 100,
          pattern: '^[a-zA-Z0-9][a-zA-Z0-9_-]*$',
          description: 'Module name (supports kebab-case, snake_case, PascalCase, camelCase)'
        },
        type: {
          bsonType: 'string',
          enum: ['class', 'json', 'module.json', 'definition', 'dynamic'],
          description: 'Module type for loading strategy'
        },
        path: {
          bsonType: 'string',
          minLength: 1,
          description: 'Relative path to module from monorepo root'
        },
        className: {
          bsonType: 'string',
          description: 'Class name for class-based modules'
        },
        filePath: {
          bsonType: 'string',
          description: 'Full file path relative to monorepo root'
        },
        package: {
          bsonType: 'string',
          description: 'Package name (e.g. @legion/tools)'
        },
        description: {
          bsonType: 'string',
          maxLength: 500,
          description: 'Module description extracted from code or metadata'
        },
        dependencies: {
          bsonType: 'array',
          items: {
            bsonType: 'string'
          },
          description: 'List of npm dependencies'
        },
        requiredEnvVars: {
          bsonType: 'array',
          items: {
            bsonType: 'string'
          },
          description: 'Environment variables required by this module'
        },
        loadable: {
          bsonType: 'bool',
          description: 'Whether this module can be loaded'
        },
        discoveredAt: {
          bsonType: 'date',
          description: 'When this module was first discovered'
        },
        lastValidatedAt: {
          bsonType: 'date',
          description: 'When this module was last validated'
        }
      }
    }
  },
  indexes: [
    { name: 1 }, // Unique index on module name
    { package: 1 },
    { type: 1 },
    { loadable: 1 },
    { discoveredAt: -1 }
  ],
  uniqueIndexes: [
    { name: 1, className: 1, filePath: 1 } // Ensure unique module entries
  ]
};

/**
 * Collection initialization configurations
 */
export const ToolRegistryCollections = {
  module_registry: ModuleRegistryCollectionSchema,  // Permanent module discovery storage
  modules: ModulesCollectionSchema,                 // Runtime module state
  tools: ToolsCollectionSchema,
  perspective_types: PerspectiveTypesCollectionSchema,
  tool_perspectives: ToolPerspectivesCollectionSchema
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
        if (error.code === 48 || error.message.includes('already exists')) {
          // Collection already exists (code 48) or exists message
          results.push({
            collection: collectionName,
            status: 'exists',
            message: 'Collection already exists'
          });
        } else {
          // Check if collection actually exists despite the error
          try {
            const collections = await this.mongoProvider.db.collections();
            const exists = collections.some(col => col.collectionName === collectionName);
            if (exists) {
              results.push({
                collection: collectionName,
                status: 'exists',
                message: 'Collection exists despite creation error'
              });
            } else {
              results.push({
                collection: collectionName,
                status: 'error',
                error: error.message
              });
            }
          } catch (checkError) {
            results.push({
              collection: collectionName,
              status: 'error',
              error: `${error.message} (check failed: ${checkError.message})`
            });
          }
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