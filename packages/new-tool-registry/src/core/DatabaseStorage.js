/**
 * DatabaseStorage - MongoDB connection and operations for tool registry
 * 
 * Provides MongoDB database access through ResourceManager pattern
 * Handles module and tool document operations
 * 
 * No mocks, no fallbacks - real MongoDB implementation only
 */

import { MongoClient } from 'mongodb';
import { 
  DatabaseError,
  DatabaseOperationError,
  ValidationError 
} from '../errors/index.js';

export class DatabaseStorage {
  constructor(options = {}) {
    this.options = {
      databaseName: 'legion_tools',
      connectTimeoutMS: 30000,
      serverSelectionTimeoutMS: 5000,
      ...options
    };
    
    this.resourceManager = options.resourceManager;
    this.db = options.db; // Allow direct db injection for tests
    this.client = null;
    this._isConnected = false;
    
    if (!this.resourceManager && !this.db) {
      throw new DatabaseError(
        'ResourceManager or db instance is required',
        'initialization',
        'DatabaseStorage'
      );
    }
  }
  
  /**
   * Connect to database (alias for initialize for API compatibility)
   */
  async connect() {
    return await this.initialize();
  }

  /**
   * Disconnect from database (alias for close for API compatibility)
   */
  async disconnect() {
    return await this.close();
  }

  /**
   * Check if database is connected (method for API compatibility)
   */
  isConnected() {
    return this._isConnected;
  }

  /**
   * Initialize database connection
   */
  async initialize() {
    try {
      if (this.db) {
        // Direct db injection for tests
        this._isConnected = true;
        return;
      }
      
      // Get MongoDB URL from ResourceManager
      const mongoUrl = this.resourceManager.get('env.MONGODB_URL') || 'mongodb://localhost:27017';
      const testDbName = this.resourceManager.get('test.database.name');
      
      // Use test database name if provided
      if (testDbName) {
        this.options.databaseName = testDbName;
      }
      
      this.client = new MongoClient(mongoUrl, {
        connectTimeoutMS: this.options.connectTimeoutMS,
        serverSelectionTimeoutMS: this.options.serverSelectionTimeoutMS,
      });
      
      await this.client.connect();
      this.db = this.client.db(this.options.databaseName);
      this._isConnected = true;
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to connect to MongoDB: ${error.message}`,
        'connect',
        'DatabaseStorage',
        error
      );
    }
  }
  
  /**
   * Close database connection
   */
  async close() {
    try {
      this._isConnected = false;
      
      if (this.client) {
        await this.client.close();
        this.client = null;
      }
      
      this.db = null;
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to close database connection: ${error.message}`,
        'close',
        'DatabaseStorage',
        error
      );
    }
  }
  
  /**
   * Get MongoDB collection
   * @param {string} name - Collection name
   * @returns {Collection} MongoDB collection
   */
  getCollection(name) {
    if (!this._isConnected || !this.db) {
      throw new DatabaseError(
        'Database not connected',
        'getCollection',
        name
      );
    }
    
    return this.db.collection(name);
  }
  
  /**
   * Save module to database
   * @param {Object} module - Module data
   */
  async saveModule(module) {
    try {
      if (!module.name) {
        throw new ValidationError(
          'Module name is required',
          'VALIDATION_ERROR',
          { module }
        );
      }
      
      const collection = this.getCollection('modules');
      
      const moduleDoc = {
        ...module,
        savedAt: new Date().toISOString(),
        _id: module.name // Use name as _id for easy retrieval
      };
      
      await collection.replaceOne(
        { _id: module.name },
        moduleDoc,
        { upsert: true }
      );
      
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      
      throw new DatabaseError(
        `Failed to save module: ${error.message}`,
        'saveModule',
        'modules',
        error
      );
    }
  }
  
  /**
   * Save tools to database
   * @param {Array} tools - Array of tool objects
   * @param {string} moduleName - Module name that owns these tools
   * @returns {number} Number of tools saved
   */
  async saveTools(tools, moduleName) {
    try {
      if (!moduleName) {
        throw new ValidationError(
          'Module name is required for saving tools',
          'VALIDATION_ERROR',
          { toolsCount: tools.length }
        );
      }
      
      if (!Array.isArray(tools) || tools.length === 0) {
        return 0;
      }
      
      const collection = this.getCollection('tools');
      
      // Prepare tool documents
      const toolDocs = tools.map(tool => ({
        ...tool,
        moduleName,
        savedAt: new Date().toISOString(),
        _id: `${moduleName}:${tool.name}` // Composite key for uniqueness
      }));
      
      // Use bulk write for efficiency
      const bulkOps = toolDocs.map(doc => ({
        replaceOne: {
          filter: { _id: doc._id },
          replacement: doc,
          upsert: true
        }
      }));
      
      const result = await collection.bulkWrite(bulkOps);
      return result.upsertedCount + result.modifiedCount;
      
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      
      throw new DatabaseError(
        `Failed to save tools: ${error.message}`,
        'saveTools',
        'tools',
        error
      );
    }
  }
  
  /**
   * Save single tool to database
   * @param {Object} tool - Tool object
   * @param {string} moduleName - Module name that owns this tool
   */
  async saveTool(tool, moduleName) {
    return await this.saveTools([tool], moduleName);
  }
  
  /**
   * Find module by name
   * @param {string} name - Module name
   * @returns {Object|null} Module document or null if not found
   */
  async findModule(name) {
    try {
      const collection = this.getCollection('modules');
      return await collection.findOne({ _id: name });
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to find module: ${error.message}`,
        'findModule',
        'modules',
        error
      );
    }
  }
  
  /**
   * Find modules with optional filter
   * @param {Object} filter - MongoDB filter object
   * @returns {Array} Array of module documents
   */
  async findModules(filter = {}) {
    try {
      const collection = this.getCollection('modules');
      return await collection.find(filter).toArray();
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to find modules: ${error.message}`,
        'findModules',
        'modules',
        error
      );
    }
  }
  
  /**
   * Find tools with optional filter
   * @param {Object} filter - MongoDB filter object
   * @returns {Array} Array of tool documents
   */
  async findTools(filter = {}) {
    try {
      const collection = this.getCollection('tools');
      return await collection.find(filter).toArray();
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to find tools: ${error.message}`,
        'findTools',
        'tools',
        error
      );
    }
  }
  
  /**
   * Find a single tool by name
   * @param {string} name - Tool name  
   * @returns {Object|null} Tool document or null
   */
  async findTool(name) {
    try {
      const collection = this.getCollection('tools');
      return await collection.findOne({ name: name });
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to find tool: ${error.message}`,
        'findTool',
        'tools', 
        error
      );
    }
  }
  
  /**
   * Get a tool by name (alias for findTool)
   * @param {string} name - Tool name
   * @returns {Object|null} Tool document or null
   */
  async getTool(name) {
    return await this.findTool(name);
  }

  /**
   * List tools with optional filter (alias for findTools)  
   * @param {Object} options - Query options
   * @returns {Array} Array of tool documents
   */
  async listTools(options = {}) {
    const filter = {};
    
    // Apply module name filter if provided
    if (options.moduleName) {
      filter.moduleName = options.moduleName;
    }
    
    // Apply tool name filter if provided
    if (options.toolName) {
      filter.name = options.toolName;
    }
    
    return await this.findTools(filter);
  }

  /**
   * Count tools in database
   * @returns {number} Number of tools
   */
  async countTools() {
    try {
      const collection = this.getCollection('tools');
      return await collection.countDocuments();
    } catch (error) {
      throw new DatabaseError(
        `Failed to count tools: ${error.message}`,
        'countTools',
        'tools',
        error
      );
    }
  }

  /**
   * Clear all data from database
   */
  async clearAll() {
    try {
      await this.clearCollection('modules');
      await this.clearCollection('tools');
    } catch (error) {
      throw new DatabaseError(
        `Failed to clear all data: ${error.message}`,
        'clearAll',
        'database',
        error
      );
    }
  }

  /**
   * Clear a specific module and its tools
   * @param {string} moduleName - Module name to clear
   */
  async clearModule(moduleName) {
    try {
      // Remove module
      const modulesCollection = this.getCollection('modules');
      await modulesCollection.deleteOne({ _id: moduleName });
      
      // Remove tools for this module
      const toolsCollection = this.getCollection('tools');
      await toolsCollection.deleteMany({ moduleName });
    } catch (error) {
      throw new DatabaseError(
        `Failed to clear module: ${error.message}`,
        'clearModule',
        'modules',
        error
      );
    }
  }
  
  /**
   * Clear collection
   * @param {string} collectionName - Name of collection to clear
   * @returns {number} Number of documents deleted
   */
  async clearCollection(collectionName) {
    try {
      const collection = this.getCollection(collectionName);
      const result = await collection.deleteMany({});
      return result.deletedCount;
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to clear collection: ${error.message}`,
        'clearCollection',
        collectionName,
        error
      );
    }
  }
  
  /**
   * Get collection statistics
   * @param {string} collectionName - Name of collection
   * @returns {Object} Collection statistics
   */
  async getCollectionStats(collectionName) {
    try {
      const collection = this.getCollection(collectionName);
      const count = await collection.countDocuments();
      
      return {
        name: collectionName,
        documentCount: count
      };
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to get collection stats: ${error.message}`,
        'getCollectionStats',
        collectionName,
        error
      );
    }
  }
  
  /**
   * Create indexes for better performance
   */
  async createIndexes() {
    try {
      // Create indexes for modules collection
      const modulesCollection = this.getCollection('modules');
      await modulesCollection.createIndex({ packageName: 1 });
      await modulesCollection.createIndex({ loaded: 1 });
      await modulesCollection.createIndex({ discoveredAt: 1 });
      
      // Create indexes for tools collection
      const toolsCollection = this.getCollection('tools');
      await toolsCollection.createIndex({ moduleName: 1 });
      await toolsCollection.createIndex({ name: 1 });
      await toolsCollection.createIndex({ 'name': 'text', 'description': 'text' });
      
    } catch (error) {
      // Index creation failures are not critical
      console.warn(`Failed to create indexes: ${error.message}`);
    }
  }

  /**
   * Get module by name (alias for findModule for API compatibility)
   * @param {string} name - Module name
   * @returns {Object|null} Module document or null
   */
  async getModule(name) {
    return await this.findModule(name);
  }

  /**
   * Health check for database connection
   */
  async healthCheck() {
    try {
      if (!this._isConnected || !this.db) {
        return false;
      }
      
      // Simple ping to verify connection
      await this.db.admin().ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Cleanup database resources (alias for close)
   */
  async cleanup() {
    await this.close();
  }
}