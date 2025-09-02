import { MongoClient } from 'mongodb';
import { Module } from '@legion/tools-registry';
import { createValidator } from '@legion/schema';
import { fileURLToPath } from 'url';
import MongoQueryTool from './MongoQueryTool.js';

const mongoConfigSchema = {
  type: 'object',
  properties: {
    connectionString: {
      type: 'string',
      description: 'MongoDB connection string'
    },
    database: {
      type: 'string',
      description: 'Default database name (optional)'
    },
    options: {
      type: 'object',
      properties: {
        maxPoolSize: {
          type: 'number',
          default: 10
        },
        serverSelectionTimeoutMS: {
          type: 'number',
          default: 5000
        },
        socketTimeoutMS: {
          type: 'number',
          default: 45000
        }
      },
      default: {}
    }
  },
  required: ['connectionString']
};

const MongoConfigValidator = createValidator(mongoConfigSchema);

class MongoDBModule extends Module {
  constructor() {
    super();
    this.name = 'mongodb';
    this.description = 'MongoDB integration module for database operations';
    this.version = '1.0.0';
    
    // Set metadata path for automatic loading
    this.metadataPath = './tools-metadata.json';
    
    this.resourceManager = null;
    this.config = null;
    this.client = null;
  }

  /**
   * Override getModulePath to support proper path resolution
   */
  getModulePath() {
    return fileURLToPath(import.meta.url);
  }

  /**
   * Static async factory method following the standard interface
   */
  static async create(resourceManager) {
    const module = new MongoDBModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }

  loadConfig(providedConfig = {}) {
    const envConfig = {
      connectionString: this.resourceManager.get('env.MONGODB_URL') || 
                       this.resourceManager.get('env.MONGO_URI') ||
                       'mongodb://localhost:27017',
      database: this.resourceManager.get('env.MONGODB_DATABASE') ||
                this.resourceManager.get('env.MONGO_DATABASE'),
      options: {
        maxPoolSize: parseInt(this.resourceManager.get('env.MONGODB_MAX_POOL_SIZE') || '10'),
        serverSelectionTimeoutMS: parseInt(this.resourceManager.get('env.MONGODB_SERVER_SELECTION_TIMEOUT') || '5000'),
        socketTimeoutMS: parseInt(this.resourceManager.get('env.MONGODB_SOCKET_TIMEOUT') || '45000')
      }
    };

    const mergedConfig = { ...envConfig, ...providedConfig };
    const result = MongoConfigValidator.validate(mergedConfig);
    if (!result.valid) {
      throw new Error(`MongoDB configuration validation failed: ${result.errors.map(e => e.message).join(', ')}`);
    }
    return result.data;
  }

  async initialize() {
    await super.initialize(); // This will load metadata automatically
    
    // Load config using resourceManager
    try {
      this.config = this.loadConfig({});
    } catch (error) {
      // If validation fails, use defaults
      this.config = {
        connectionString: this.resourceManager?.get('env.MONGODB_URL') || 
                         this.resourceManager?.get('env.MONGO_URI') ||
                         'mongodb://localhost:27017',
        database: this.resourceManager?.get('env.MONGODB_DATABASE') ||
                  this.resourceManager?.get('env.MONGO_DATABASE'),
        options: {
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000
        }
      };
    }
    
    // Initialize tools using metadata
    this.initializeTools();
    
    try {
      // Initialize MongoDB client
      this.client = new MongoClient(this.config.connectionString, this.config.options);
      
      // Test connection
      await this.client.connect();
      await this.client.db('admin').admin().ping();
      
      this.info('MongoDB connection established successfully');
      return true;
    } catch (error) {
      // Don't throw, just log - module can still be loaded
      this.warning(`MongoDB module initialization warning: ${error.message}`);
      return true;
    }
  }

  /**
   * Get MongoDB client
   */
  getClient() {
    if (!this.client) {
      throw new Error('MongoDB module not initialized. Call initialize() first.');
    }
    return this.client;
  }

  /**
   * Get database instance
   */
  getDatabase(databaseName = null) {
    const client = this.getClient();
    const dbName = databaseName || this.config.database;
    if (!dbName) {
      throw new Error('No database name specified. Either provide one or set default in config.');
    }
    return client.db(dbName);
  }

  /**
   * Get collection instance
   */
  getCollection(collectionName, databaseName = null) {
    const db = this.getDatabase(databaseName);
    return db.collection(collectionName);
  }

  /**
   * Execute MongoDB operation
   */
  async executeOperation(collection, command, params = {}) {
    if (!this.client) {
      throw new Error('MongoDB module not initialized. Call initialize() first.');
    }

    const { query = {}, options = {}, update = {}, documents = [], pipeline = [] } = params;

    switch (command.toLowerCase()) {
      // Query operations
      case 'find':
        return await collection.find(query, options).toArray();
      case 'findone':
        return await collection.findOne(query, options);
      case 'countdocuments':
        return await collection.countDocuments(query, options);
      case 'distinct':
        const field = params.field;
        if (!field) throw new Error('distinct operation requires "field" parameter');
        return await collection.distinct(field, query, options);
      case 'aggregate':
        return await collection.aggregate(pipeline, options).toArray();

      // Write operations
      case 'insertone':
        const document = params.document;
        if (!document) throw new Error('insertOne operation requires "document" parameter');
        return await collection.insertOne(document, options);
      case 'insertmany':
        if (!documents.length) throw new Error('insertMany operation requires "documents" parameter');
        return await collection.insertMany(documents, options);
      case 'updateone':
        if (!update || Object.keys(update).length === 0) {
          throw new Error('updateOne operation requires "update" parameter');
        }
        return await collection.updateOne(query, update, options);
      case 'updatemany':
        if (!update || Object.keys(update).length === 0) {
          throw new Error('updateMany operation requires "update" parameter');
        }
        return await collection.updateMany(query, update, options);
      case 'deleteone':
        return await collection.deleteOne(query, options);
      case 'deletemany':
        return await collection.deleteMany(query, options);

      // Admin operations
      case 'createindex':
        const keys = params.keys;
        if (!keys) throw new Error('createIndex operation requires "keys" parameter');
        return await collection.createIndex(keys, options);
      case 'dropcollection':
        return await collection.drop();
      case 'listcollections':
        const db = this.getDatabase(params.database);
        return await db.listCollections().toArray();

      default:
        throw new Error(`Unsupported MongoDB operation: ${command}`);
    }
  }

  /**
   * Test connection
   */
  async testConnection() {
    if (!this.client) {
      throw new Error('MongoDB module not initialized. Call initialize() first.');
    }

    try {
      await this.client.db('admin').admin().ping();
      return { success: true, message: 'MongoDB connection successful' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Get configuration (without sensitive data)
   */
  getConfig() {
    const maskedConnectionString = this.config.connectionString.includes('@') 
      ? this.config.connectionString.replace(/:\/\/[^@]*@/, '://***:***@')
      : this.config.connectionString;
      
    return {
      connectionString: maskedConnectionString,
      database: this.config.database,
      options: this.config.options
    };
  }

  /**
   * Initialize tools for this module
   */
  initializeTools() {
    const tools = [
      { key: 'mongo_query', class: MongoQueryTool }
    ];

    for (const { key, class: ToolClass } of tools) {
      const tool = this.createToolFromMetadata(key, ToolClass);
      // Pass MongoDB module reference to tool for execution
      tool.mongoModule = this;
      this.registerTool(tool.name, tool);
    }
  }


  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.client) {
      try {
        await this.client.close();
        this.info('MongoDB connection closed');
      } catch (error) {
        this.warning(`Error closing MongoDB connection: ${error.message}`);
      }
    }
    await super.cleanup();
  }
}

export default MongoDBModule;