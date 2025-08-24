/**
 * DatabaseInitializer - Automatic database setup and seeding
 * 
 * Handles dynamic creation of collections, seeding of default data,
 * and schema management for seamless test/production database switching
 * 
 * No mocks, no fallbacks - real database operations only
 */

import { DatabaseError, ValidationError } from '../errors/index.js';

// Default perspective types that will be auto-seeded
const DEFAULT_PERSPECTIVE_TYPES = [
  {
    name: "input_perspective",
    description: "Describes the tool from its input parameters perspective",
    prompt_template: "Analyze this tool's input parameters and describe what it accepts and how they're used: Tool: {toolName} - {description}. Input schema: {inputSchema}. Focus on the input requirements, parameter types, and how inputs are processed.",
    category: "technical",
    order: 1,
    enabled: true
  },
  {
    name: "definition_perspective", 
    description: "Technical definition and core purpose of the tool",
    prompt_template: "Provide a clear technical definition of what this tool does and its core purpose: Tool: {toolName} - {description}. Output schema: {outputSchema}. Focus on the tool's primary function and what it accomplishes.",
    category: "conceptual",
    order: 2,
    enabled: true
  },
  {
    name: "keyword_perspective",
    description: "Key searchable terms and concepts for semantic discovery",
    prompt_template: "Generate key searchable terms, keywords, and concepts for this tool: Tool: {toolName} - {description}. Include synonyms, related terms, domain-specific vocabulary, and alternative names that users might search for.",
    category: "searchability", 
    order: 3,
    enabled: true
  },
  {
    name: "use_case_perspective",
    description: "Practical usage scenarios and real-world applications",
    prompt_template: "Describe practical use cases, scenarios, and real-world applications where this tool would be used: Tool: {toolName} - {description}. Include specific examples, common workflows, and integration patterns.",
    category: "practical",
    order: 4,
    enabled: true
  }
];

// Collection schemas for validation
const COLLECTION_SCHEMAS = {
  perspective_types: {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["name", "description", "prompt_template", "category", "order", "enabled"],
        properties: {
          name: {
            bsonType: "string",
            description: "Unique name for the perspective type"
          },
          description: {
            bsonType: "string", 
            description: "Human-readable description of the perspective type"
          },
          prompt_template: {
            bsonType: "string",
            description: "Template for LLM prompt with placeholders"
          },
          category: {
            bsonType: "string",
            description: "Category for grouping perspective types"
          },
          order: {
            bsonType: "int",
            description: "Display/processing order"
          },
          enabled: {
            bsonType: "bool",
            description: "Whether this perspective type is active"
          },
          created_at: {
            bsonType: "date",
            description: "When this perspective type was created"
          },
          updated_at: {
            bsonType: "date",
            description: "When this perspective type was last updated"
          }
        }
      }
    }
  },
  
  tool_perspectives: {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["tool_name", "perspective_type_name", "content", "generated_at"],
        properties: {
          tool_id: {
            bsonType: "string", 
            description: "Reference to tools collection (composite key format)"
          },
          tool_name: {
            bsonType: "string",
            description: "Name of the tool (denormalized for performance)"
          },
          perspective_type_id: {
            bsonType: ["objectId", "string"], 
            description: "Reference to perspective_types collection"
          },
          perspective_type_name: {
            bsonType: "string",
            description: "Name of perspective type (denormalized for performance)"
          },
          content: {
            bsonType: "string",
            description: "The generated perspective content"
          },
          keywords: {
            bsonType: "array",
            description: "Extracted keywords from the perspective",
            items: {
              bsonType: "string"
            }
          },
          embedding: {
            bsonType: "array",
            description: "Vector embedding for semantic search",
            items: {
              bsonType: "double"
            }
          },
          generated_at: {
            bsonType: "date",
            description: "When this perspective was generated"
          },
          llm_model: {
            bsonType: "string",
            description: "LLM model used for generation"
          },
          batch_id: {
            bsonType: "string",
            description: "Links perspectives generated together in one batch"
          }
        }
      }
    }
  }
};

// Index specifications for performance
const COLLECTION_INDEXES = {
  perspective_types: [
    { key: { name: 1 }, options: { unique: true } },
    { key: { category: 1 } },
    { key: { order: 1 } },
    { key: { enabled: 1 } }
  ],
  
  tool_perspectives: [
    { key: { tool_name: 1 } },
    { key: { perspective_type_name: 1 } },
    { key: { tool_name: 1, perspective_type_name: 1 }, options: { unique: true } },
    { key: { perspective_type_id: 1 } },
    { key: { batch_id: 1 } },
    { key: { generated_at: 1 } },
    { key: { content: "text", keywords: "text" } } // Text search index
  ]
};

export class DatabaseInitializer {
  constructor({ db, resourceManager, options = {} }) {
    if (!db) {
      throw new DatabaseError(
        'Database instance is required',
        'initialization',
        'DatabaseInitializer'
      );
    }
    
    this.db = db;
    this.resourceManager = resourceManager;
    this.options = {
      seedData: true,
      validateSchema: true,
      createIndexes: true,
      verbose: false,
      ...options
    };
    
    this.initialized = false;
  }
  
  /**
   * Complete database initialization
   * Creates collections, seeds data, creates indexes
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      if (this.options.verbose) {
        console.log('Initializing database collections and data...');
      }
      
      // 1. Ensure collections exist with proper schemas
      await this.ensureCollectionsExist();
      
      // 2. Seed default perspective types if empty
      if (this.options.seedData) {
        await this.seedPerspectiveTypes();
      }
      
      // 3. Create performance indexes
      if (this.options.createIndexes) {
        await this.createIndexes();
      }
      
      // 4. Validate setup
      if (this.options.validateSchema) {
        await this.validateSetup();
      }
      
      this.initialized = true;
      
      if (this.options.verbose) {
        console.log('Database initialization complete');
      }
      
    } catch (error) {
      throw new DatabaseError(
        `Database initialization failed: ${error.message}`,
        'initialize',
        'DatabaseInitializer',
        error
      );
    }
  }
  
  /**
   * Ensure all required collections exist with proper schemas
   */
  async ensureCollectionsExist() {
    try {
      const existingCollections = await this.db.listCollections().toArray();
      const existingNames = new Set(existingCollections.map(c => c.name));
      
      // Create perspective_types collection
      if (!existingNames.has('perspective_types')) {
        await this.createCollectionWithSchema('perspective_types');
      }
      
      // Create tool_perspectives collection  
      if (!existingNames.has('tool_perspectives')) {
        await this.createCollectionWithSchema('tool_perspectives');
      }
      
      // Tools collection should already exist, but ensure it's there
      if (!existingNames.has('tools')) {
        await this.db.createCollection('tools');
      }
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to create collections: ${error.message}`,
        'ensureCollectionsExist',
        'DatabaseInitializer',
        error
      );
    }
  }
  
  /**
   * Create a collection with schema validation
   */
  async createCollectionWithSchema(collectionName) {
    try {
      const schema = COLLECTION_SCHEMAS[collectionName];
      
      if (schema && this.options.validateSchema) {
        await this.db.createCollection(collectionName, schema);
      } else {
        await this.db.createCollection(collectionName);
      }
      
      if (this.options.verbose) {
        console.log(`Created collection: ${collectionName}`);
      }
      
    } catch (error) {
      // If collection already exists, that's okay
      if (error.code === 48) {
        return;
      }
      throw error;
    }
  }
  
  /**
   * Seed default perspective types if collection is empty
   */
  async seedPerspectiveTypes() {
    try {
      const collection = this.db.collection('perspective_types');
      const count = await collection.countDocuments();
      
      if (count === 0) {
        // Add timestamps to default perspective types
        const typesToInsert = DEFAULT_PERSPECTIVE_TYPES.map(type => ({
          ...type,
          created_at: new Date(),
          updated_at: new Date()
        }));
        
        const result = await collection.insertMany(typesToInsert);
        
        if (this.options.verbose) {
          console.log(`Seeded ${result.insertedCount} default perspective types`);
        }
        
        return result.insertedCount;
      }
      
      return 0;
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to seed perspective types: ${error.message}`,
        'seedPerspectiveTypes',
        'perspective_types',
        error
      );
    }
  }
  
  /**
   * Create performance indexes for all collections
   */
  async createIndexes() {
    try {
      for (const [collectionName, indexes] of Object.entries(COLLECTION_INDEXES)) {
        const collection = this.db.collection(collectionName);
        
        for (const indexSpec of indexes) {
          try {
            await collection.createIndex(indexSpec.key, indexSpec.options || {});
          } catch (error) {
            // Index might already exist, which is fine
            if (error.code !== 85) {
              console.warn(`Failed to create index on ${collectionName}:`, error.message);
            }
          }
        }
      }
      
      if (this.options.verbose) {
        console.log('Created performance indexes');
      }
      
    } catch (error) {
      // Index creation failures are not critical for basic functionality
      console.warn(`Index creation warning: ${error.message}`);
    }
  }
  
  /**
   * Validate that setup is complete and working
   */
  async validateSetup() {
    try {
      // Check that perspective types collection has data
      const perspectiveTypesCount = await this.db.collection('perspective_types').countDocuments();
      if (perspectiveTypesCount === 0) {
        throw new ValidationError(
          'No perspective types found after initialization',
          'VALIDATION_ERROR'
        );
      }
      
      // Check that collections exist
      const collections = await this.db.listCollections().toArray();
      const collectionNames = new Set(collections.map(c => c.name));
      
      const requiredCollections = ['perspective_types', 'tool_perspectives', 'tools'];
      for (const required of requiredCollections) {
        if (!collectionNames.has(required)) {
          throw new ValidationError(
            `Required collection missing: ${required}`,
            'VALIDATION_ERROR'
          );
        }
      }
      
      if (this.options.verbose) {
        console.log(`Validation complete: ${perspectiveTypesCount} perspective types available`);
      }
      
    } catch (error) {
      throw new DatabaseError(
        `Database validation failed: ${error.message}`,
        'validateSetup', 
        'DatabaseInitializer',
        error
      );
    }
  }
  
  /**
   * Get default perspective types (useful for testing)
   */
  getDefaultPerspectiveTypes() {
    return [...DEFAULT_PERSPECTIVE_TYPES];
  }
  
  /**
   * Reset collections (useful for testing)
   * WARNING: This will delete all data in perspective collections
   */
  async resetPerspectiveCollections() {
    try {
      await this.db.collection('perspective_types').deleteMany({});
      await this.db.collection('tool_perspectives').deleteMany({});
      
      // Re-seed perspective types
      await this.seedPerspectiveTypes();
      
      if (this.options.verbose) {
        console.log('Reset perspective collections and re-seeded data');
      }
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to reset collections: ${error.message}`,
        'resetPerspectiveCollections',
        'DatabaseInitializer',
        error
      );
    }
  }
  
  /**
   * Get initialization statistics
   */
  async getStats() {
    try {
      const perspectiveTypesCount = await this.db.collection('perspective_types').countDocuments();
      const toolPerspectivesCount = await this.db.collection('tool_perspectives').countDocuments();
      const toolsCount = await this.db.collection('tools').countDocuments();
      
      return {
        initialized: this.initialized,
        perspective_types: perspectiveTypesCount,
        tool_perspectives: toolPerspectivesCount,
        tools: toolsCount
      };
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to get stats: ${error.message}`,
        'getStats',
        'DatabaseInitializer', 
        error
      );
    }
  }
}