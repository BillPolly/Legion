/**
 * MongoQueryModule - Module for MongoDB query operations
 */

import { Module } from '@legion/tools-registry';
import { MongoQueryTool } from './MongoQueryTool.js';
import { MongoDBProvider } from '@legion/storage';

export default class MongoQueryModule extends Module {
  constructor() {
    super();
    this.name = 'mongo-query';
    this.description = 'MongoDB query and manipulation tools';
    this.version = '1.0.0';
    this.mongoProvider = null;
  }

  /**
   * Async factory method following ResourceManager pattern
   * Gets MongoDBProvider automatically from ResourceManager
   * @param {ResourceManager} resourceManager - The resource manager for dependency injection
   * @returns {Promise<MongoQueryModule>} Initialized module instance
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
      const database = resourceManager.get('env.MONGODB_DATABASE') || 
                      resourceManager.get('env.TOOLS_DATABASE_NAME') ||
                      'legion';
      
      mongoProvider = new MongoDBProvider({
        connectionString: mongoUrl,
        database: database
      });
      
      await mongoProvider.connect();
      resourceManager.set('MongoDBProvider', mongoProvider);
    }

    const module = new MongoQueryModule();
    module.mongoProvider = mongoProvider;
    await module.initialize();
    return module;
  }

  /**
   * Initialize the module and register tools
   */
  async initialize() {
    await super.initialize();
    
    // Create and register the query tool
    const queryTool = new MongoQueryTool({ 
      mongoProvider: this.mongoProvider 
    });
    
    this.registerTool(queryTool.name, queryTool);
  }
}