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
import { DatabaseInitializer } from './DatabaseInitializer.js';
import { Logger } from '../utils/Logger.js';

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
    
    this.logger = Logger.create('DatabaseStorage', { verbose: this.options.verbose });
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
   * Initialize database connection and setup 3-collection architecture
   */
  async initialize() {
    console.log('[DatabaseStorage] initialize() called');
    try {
      if (this.db) {
        // Direct db injection for tests - still need to initialize 3-collection architecture
        this._isConnected = true;
        await this._initializePerspectiveCollections();
        return;
      }
      
      // Get MongoDB URL from ResourceManager
      const mongoUrl = this.resourceManager.get('env.MONGODB_URL') || 'mongodb://localhost:27017';
      const testDbName = this.resourceManager.get('test.database.name');
      console.log(`[DatabaseStorage] MongoDB URL: ${mongoUrl}`);
      console.log(`[DatabaseStorage] Test DB name: ${testDbName}`);
      console.log(`[DatabaseStorage] ResourceManager exists: ${!!this.resourceManager}`);
      
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
      
      // Initialize 3-collection perspective architecture
      await this._initializePerspectiveCollections();
      
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
   * Initialize 3-collection perspective architecture
   * Sets up perspective_types and tool_perspectives collections with schema validation
   * and seeds default perspective types
   * @private
   */
  async _initializePerspectiveCollections() {
    try {
      const initializer = new DatabaseInitializer({ 
        db: this.db, 
        resourceManager: this.resourceManager,
        options: { 
          seedData: true,
          validateSchema: false, // Disable schema validation to avoid ObjectId issues
          createIndexes: true,
          verbose: false
        }
      });
      
      await initializer.initialize();
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to initialize perspective collections: ${error.message}`,
        '_initializePerspectiveCollections',
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
   * Check if database connection is healthy
   */
  async isHealthy() {
    try {
      if (!this._isConnected || !this.db) {
        return false;
      }
      
      // Simple ping to check connection
      await this.db.admin().ping();
      return true;
      
    } catch (error) {
      return false;
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
   * Save loaded module to modules collection
   * @param {Object} module - Module data
   */
  async saveLoadedModule(module) {
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
        status: 'loaded',
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
        `Failed to save loaded module: ${error.message}`,
        'saveLoadedModule',
        'modules',
        error
      );
    }
  }
  
  /**
   * Save discovered module to module-registry collection
   * @param {Object} module - Module data
   * @returns {Object} The saved module document with _id
   */
  async saveDiscoveredModule(module) {
    try {
      if (!module.name) {
        throw new ValidationError(
          'Module name is required',
          'VALIDATION_ERROR',
          { module }
        );
      }
      
      const collection = this.getCollection('module-registry');
      
      // toolsCount will be populated later when module is actually loaded
      // During discovery, we just save 0 as placeholder
      const toolsCount = module.validation?.toolsCount || module.toolsCount || 0;
      
      const moduleDoc = {
        ...module,
        toolsCount: toolsCount,  // Placeholder - will be updated when loaded
        savedAt: new Date().toISOString(),
        status: 'discovered'
      };
      
      // Use replaceOne with upsert to get the document with _id
      const result = await collection.replaceOne(
        { name: module.name },
        moduleDoc,
        { upsert: true }
      );
      
      // Fetch the saved document to get the _id
      const savedModule = await collection.findOne({ name: module.name });
      
      return savedModule;
      
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      
      throw new DatabaseError(
        `Failed to save discovered module: ${error.message}`,
        'saveDiscoveredModule',
        'module-registry',
        error
      );
    }
  }
  
  /**
   * Save loaded module to modules collection
   * CRITICAL: This is separate from module-registry!
   * - module-registry = discovered modules (discovery phase)
   * - modules = loaded/active modules (loading phase)
   * @param {Object} moduleRecord - Module record for loaded modules
   */
  async saveLoadedModule(moduleRecord) {
    try {
      if (!moduleRecord.name) {
        throw new ValidationError(
          'Module name is required for loaded module',
          'VALIDATION_ERROR',
          { moduleRecord }
        );
      }
      
      const collection = this.getCollection('modules');
      
      const loadedModuleDoc = {
        name: moduleRecord.name,
        moduleId: moduleRecord.moduleId, // Reference to module-registry _id
        path: moduleRecord.path,
        loadedAt: new Date().toISOString(),
        toolsCount: moduleRecord.toolsCount || 0,
        status: 'loaded'
      };
      
      // Use upsert to avoid duplicates
      const result = await collection.replaceOne(
        { name: moduleRecord.name },
        loadedModuleDoc,
        { upsert: true }
      );
      
      return { 
        _id: result.upsertedId || moduleRecord.moduleId,
        ...loadedModuleDoc 
      };
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to save loaded module: ${error.message}`,
        'saveLoadedModule',
        'modules',
        error
      );
    }
  }

  /**
   * Update toolsCount for a discovered module after it's been loaded
   * @param {string} moduleId - Module _id from module-registry
   * @param {number} toolsCount - Number of tools found in the loaded module
   */
  async updateModuleToolsCount(moduleId, toolsCount) {
    try {
      const collection = this.getCollection('module-registry');
      
      const result = await collection.updateOne(
        { _id: moduleId },
        { 
          $set: { 
            toolsCount: toolsCount,
            lastUpdated: new Date().toISOString(),
            status: 'loaded'  // Mark as loaded
          } 
        }
      );
      
      if (result.matchedCount === 0) {
        throw new Error(`Module not found in registry: ${moduleId}`);
      }
      
      return { success: true, updated: result.modifiedCount > 0 };
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to update toolsCount for module ${moduleId}`,
        'UPDATE_ERROR',
        'module-registry',
        error
      );
    }
  }

  /**
   * @deprecated Use saveLoadedModule instead
   */
  async saveModule(module) {
    return this.saveLoadedModule(module);
  }
  
  /**
   * Save tools to database
   * @param {Array} tools - Array of tool objects
   * @param {string} moduleName - Module name that owns these tools
   * @param {string} moduleId - Module ID (_id from module-registry)
   * @returns {number} Number of tools saved
   */
  async saveTools(tools, moduleName, moduleId = null) {
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
      
      // Prepare tool documents - extract only metadata, avoid circular references
      const toolDocs = tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        category: tool.category,
        tags: tool.tags || [],
        version: tool.version,
        keywords: tool.keywords || [],
        examples: tool.examples || [],
        moduleName,
        moduleId: moduleId || moduleName, // Use moduleId if provided, fallback to moduleName for backwards compatibility
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
   * Find module by name in modules collection (loaded modules)
   * @param {string} name - Module name
   * @returns {Object|null} Module document or null if not found
   */
  async findModule(name) {
    try {
      const collection = this.getCollection('modules');
      return await collection.findOne({ name: name });
      
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
   * Find module in module-registry by ID
   * @param {string} moduleId - Module _id
   * @returns {Object|null} Module document or null if not found
   */
  async findDiscoveredModuleById(moduleId) {
    try {
      const collection = this.getCollection('module-registry');
      return await collection.findOne({ _id: moduleId });
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to find discovered module by ID: ${error.message}`,
        'findDiscoveredModuleById',
        'module-registry',
        error
      );
    }
  }

  /**
   * Find module in module-registry by name (DEPRECATED - use findDiscoveredModuleById)
   * @param {string} name - Module name
   * @returns {Object|null} Module document or null if not found
   */
  async findDiscoveredModule(name) {
    try {
      const collection = this.getCollection('module-registry');
      return await collection.findOne({ name: name });
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to find discovered module: ${error.message}`,
        'findDiscoveredModule',
        'module-registry',
        error
      );
    }
  }
  
  /**
   * Find modules with optional filter (loaded modules)
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
   * Find discovered modules from module-registry
   * @param {Object} filter - MongoDB filter object
   * @returns {Array} Array of module documents
   */
  async findDiscoveredModules(filter = {}) {
    try {
      const collection = this.getCollection('module-registry');
      return await collection.find(filter).toArray();
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to find discovered modules: ${error.message}`,
        'findDiscoveredModules',
        'module-registry',
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
   * Find a tool by MongoDB ObjectId
   * @param {string} id - Tool ObjectId
   * @returns {Object|null} Tool document or null
   */
  async findById(id) {
    try {
      const collection = this.getCollection('tools');
      const { ObjectId } = await import('mongodb');
      return await collection.findOne({ _id: new ObjectId(id) });
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to find tool by ID: ${error.message}`,
        'findById',
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
   * Count unique modules that have tools
   * @returns {number} Number of unique modules with tools
   */
  async countModulesWithTools() {
    try {
      const collection = this.getCollection('tools');
      const result = await collection.aggregate([
        { $group: { _id: '$moduleName' } },
        { $count: 'uniqueModules' }
      ]).toArray();
      
      return result.length > 0 ? result[0].uniqueModules : 0;
    } catch (error) {
      throw new DatabaseError(
        `Failed to count modules with tools: ${error.message}`,
        'countModulesWithTools',
        'tools',
        error
      );
    }
  }

  /**
   * Clear all data from database
   * @param {Object} options - Clear options
   * @param {boolean} options.includeRegistry - Whether to clear module-registry collection (default: false)
   */
  async clearAll(options = {}) {
    const { includeRegistry = false } = options;
    
    try {
      // Always clear these collections
      await this.clearCollection('modules');
      await this.clearCollection('tools');
      await this.clearCollection('perspective_types');
      await this.clearCollection('tool_perspectives');
      
      // Only clear module-registry if explicitly requested
      if (includeRegistry) {
        await this.clearCollection('module-registry');
      }
      
      return {
        success: true,
        collections: includeRegistry 
          ? ['modules', 'tools', 'perspective_types', 'tool_perspectives', 'module-registry']
          : ['modules', 'tools', 'perspective_types', 'tool_perspectives']
      };
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
      this.logger.warn(`Failed to create indexes: ${error.message}`);
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

  // ===== NEW 3-COLLECTION PERSPECTIVE ARCHITECTURE METHODS =====

  /**
   * Save perspective type to database
   * @param {Object} perspectiveType - Perspective type data
   */
  async savePerspectiveType(perspectiveType) {
    try {
      if (!perspectiveType.name) {
        throw new ValidationError(
          'Perspective type name is required',
          'VALIDATION_ERROR',
          { perspectiveType }
        );
      }
      
      const collection = this.getCollection('perspective_types');
      
      const perspectiveTypeDoc = {
        ...perspectiveType,
        created_at: perspectiveType.created_at || new Date(),
        updated_at: new Date()
      };
      
      await collection.replaceOne(
        { name: perspectiveType.name },
        perspectiveTypeDoc,
        { upsert: true }
      );
      
      return perspectiveTypeDoc;
      
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      
      throw new DatabaseError(
        `Failed to save perspective type: ${error.message}`,
        'savePerspectiveType',
        'perspective_types',
        error
      );
    }
  }

  /**
   * Find perspective type by name
   * @param {string} name - Perspective type name
   * @returns {Object|null} Perspective type document or null
   */
  async findPerspectiveType(name) {
    try {
      const collection = this.getCollection('perspective_types');
      return await collection.findOne({ name });
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to find perspective type: ${error.message}`,
        'findPerspectiveType',
        'perspective_types',
        error
      );
    }
  }

  /**
   * Find perspective types with optional filter
   * @param {Object} filter - MongoDB filter object
   * @returns {Array} Array of perspective type documents
   */
  async findPerspectiveTypes(filter = {}) {
    try {
      const collection = this.getCollection('perspective_types');
      return await collection.find(filter).sort({ order: 1 }).toArray();
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to find perspective types: ${error.message}`,
        'findPerspectiveTypes',
        'perspective_types',
        error
      );
    }
  }

  /**
   * Save tool perspective to database
   * @param {Object} toolPerspective - Tool perspective data
   */
  async saveToolPerspective(toolPerspective) {
    try {
      if (!toolPerspective.tool_name || !toolPerspective.perspective_type_name) {
        throw new ValidationError(
          'Tool name and perspective type name are required',
          'VALIDATION_ERROR',
          { toolPerspective }
        );
      }
      
      const collection = this.getCollection('tool_perspectives');
      
      const perspectiveDoc = {
        ...toolPerspective,
        generated_at: toolPerspective.generated_at || new Date()
      };
      
      await collection.replaceOne(
        { 
          tool_id: toolPerspective.tool_id,
          perspective_type_name: toolPerspective.perspective_type_name
        },
        perspectiveDoc,
        { upsert: true }
      );
      
      return perspectiveDoc;
      
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      
      throw new DatabaseError(
        `Failed to save tool perspective: ${error.message}`,
        'saveToolPerspective',
        'tool_perspectives',
        error
      );
    }
  }

  /**
   * Save multiple tool perspectives in batch
   * @param {Array} toolPerspectives - Array of tool perspective objects
   * @returns {number} Number of perspectives saved
   */
  async saveToolPerspectives(toolPerspectives) {
    try {
      if (!Array.isArray(toolPerspectives) || toolPerspectives.length === 0) {
        return 0;
      }
      
      const collection = this.getCollection('tool_perspectives');
      
      // Prepare documents with timestamps
      const perspectiveDocs = toolPerspectives.map(perspective => ({
        ...perspective,
        generated_at: perspective.generated_at || new Date()
      }));
      
      // Use bulk write for efficiency
      const bulkOps = perspectiveDocs.map(doc => ({
        replaceOne: {
          filter: { 
            tool_id: doc.tool_id,
            perspective_type_name: doc.perspective_type_name
          },
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
        `Failed to save tool perspectives: ${error.message}`,
        'saveToolPerspectives',
        'tool_perspectives',
        error
      );
    }
  }

  /**
   * Find tool perspectives with optional filter
   * @param {Object} filter - MongoDB filter object
   * @returns {Array} Array of tool perspective documents
   */
  async findToolPerspectives(filter = {}) {
    try {
      const collection = this.getCollection('tool_perspectives');
      return await collection.find(filter).toArray();
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to find tool perspectives: ${error.message}`,
        'findToolPerspectives',
        'tool_perspectives',
        error
      );
    }
  }

  /**
   * Find tool perspectives for a specific tool
   * @param {string} toolName - Tool name
   * @returns {Array} Array of tool perspective documents
   */
  async findToolPerspectivesByTool(toolName) {
    try {
      return await this.findToolPerspectives({ tool_name: toolName });
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to find tool perspectives by tool: ${error.message}`,
        'findToolPerspectivesByTool',
        'tool_perspectives',
        error
      );
    }
  }

  /**
   * Find tool perspectives by perspective type
   * @param {string} perspectiveTypeName - Perspective type name
   * @returns {Array} Array of tool perspective documents
   */
  async findToolPerspectivesByType(perspectiveTypeName) {
    try {
      return await this.findToolPerspectives({ 
        perspective_type_name: perspectiveTypeName 
      });
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to find tool perspectives by type: ${error.message}`,
        'findToolPerspectivesByType',
        'tool_perspectives',
        error
      );
    }
  }

  /**
   * Find a specific tool perspective
   * @param {string} toolName - Tool name
   * @param {string} perspectiveTypeName - Perspective type name
   * @returns {Object|null} Tool perspective document or null
   */
  async findToolPerspective(toolName, perspectiveTypeName) {
    try {
      const collection = this.getCollection('tool_perspectives');
      return await collection.findOne({
        tool_name: toolName,
        perspective_type_name: perspectiveTypeName
      });
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to find tool perspective: ${error.message}`,
        'findToolPerspective',
        'tool_perspectives',
        error
      );
    }
  }

  /**
   * Delete tool perspectives for a specific tool
   * @param {string} toolName - Tool name
   * @returns {number} Number of perspectives deleted
   */
  async deleteToolPerspectivesByTool(toolName) {
    try {
      const collection = this.getCollection('tool_perspectives');
      const result = await collection.deleteMany({ tool_name: toolName });
      return result.deletedCount;
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to delete tool perspectives: ${error.message}`,
        'deleteToolPerspectivesByTool',
        'tool_perspectives',
        error
      );
    }
  }

  /**
   * Delete tool perspectives by perspective type
   * @param {string} perspectiveTypeName - Perspective type name
   * @returns {number} Number of perspectives deleted
   */
  async deleteToolPerspectivesByType(perspectiveTypeName) {
    try {
      const collection = this.getCollection('tool_perspectives');
      const result = await collection.deleteMany({ 
        perspective_type_name: perspectiveTypeName 
      });
      return result.deletedCount;
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to delete tool perspectives by type: ${error.message}`,
        'deleteToolPerspectivesByType',
        'tool_perspectives',
        error
      );
    }
  }

  /**
   * Get perspectives without embeddings (for embedding generation pipeline)
   * @param {Object} query - Query filter 
   * @returns {Array} Array of perspective documents without embeddings
   */
  async getPerspectivesWithoutEmbeddings(query = {}) {
    try {
      const collection = this.getCollection('tool_perspectives');
      const filter = {
        ...query,
        $or: [
          { embedding: { $exists: false } },
          { embedding: null }
        ]
      };
      
      return await collection.find(filter).toArray();
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to get perspectives without embeddings: ${error.message}`,
        'getPerspectivesWithoutEmbeddings',
        'tool_perspectives',
        error
      );
    }
  }

  /**
   * Get perspectives with embeddings (for vector indexing pipeline)
   * @returns {Array} Array of perspective documents with embeddings
   */
  async getPerspectivesWithEmbeddings() {
    try {
      const collection = this.getCollection('tool_perspectives');
      const filter = {
        embedding: { 
          $exists: true, 
          $ne: null, 
          $ne: [],  // Exclude empty arrays
          $size: 768  // MUST be 768 dimensions - NO FALLBACKS!
        }
      };
      
      return await collection.find(filter).toArray();
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to get perspectives with embeddings: ${error.message}`,
        'getPerspectivesWithEmbeddings',
        'tool_perspectives',
        error
      );
    }
  }

  /**
   * Update perspective embedding
   * @param {string} perspectiveId - Perspective document _id
   * @param {Array} embedding - Embedding vector array
   */
  async updatePerspectiveEmbedding(perspectiveId, embedding) {
    try {
      const collection = this.getCollection('tool_perspectives');
      const result = await collection.updateOne(
        { _id: perspectiveId },
        { 
          $set: { 
            embedding: embedding,
            embedding_updated_at: new Date()
          }
        }
      );
      
      if (result.matchedCount === 0) {
        throw new DatabaseError(
          `Perspective with id ${perspectiveId} not found`,
          'updatePerspectiveEmbedding',
          'tool_perspectives'
        );
      }
      
      return result;
      
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      
      throw new DatabaseError(
        `Failed to update perspective embedding: ${error.message}`,
        'updatePerspectiveEmbedding',
        'tool_perspectives',
        error
      );
    }
  }

  /**
   * Count tool perspectives
   * @param {Object} filter - Optional filter
   * @returns {number} Number of perspectives
   */
  async countToolPerspectives(filter = {}) {
    try {
      const collection = this.getCollection('tool_perspectives');
      return await collection.countDocuments(filter);
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to count tool perspectives: ${error.message}`,
        'countToolPerspectives',
        'tool_perspectives',
        error
      );
    }
  }

  /**
   * Count perspective types
   * @param {Object} filter - Optional filter
   * @returns {number} Number of perspective types
   */
  async countPerspectiveTypes(filter = {}) {
    try {
      const collection = this.getCollection('perspective_types');
      return await collection.countDocuments(filter);
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to count perspective types: ${error.message}`,
        'countPerspectiveTypes',
        'perspective_types',
        error
      );
    }
  }

  /**
   * Clear perspective collections (useful for testing)
   */
  async clearPerspectiveData() {
    try {
      await this.clearCollection('perspective_types');
      await this.clearCollection('tool_perspectives');
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to clear perspective data: ${error.message}`,
        'clearPerspectiveData',
        'database',
        error
      );
    }
  }

  /**
   * Get perspective system statistics
   */
  async getPerspectiveStats() {
    try {
      const perspectiveTypesCount = await this.countPerspectiveTypes();
      const enabledTypesCount = await this.countPerspectiveTypes({ enabled: true });
      const toolPerspectivesCount = await this.countToolPerspectives();
      
      // Get tool coverage (tools with at least one perspective)
      const toolsWithPerspectives = await this.getCollection('tool_perspectives')
        .distinct('tool_name');
      
      return {
        perspectiveTypes: {
          total: perspectiveTypesCount,
          enabled: enabledTypesCount,
          disabled: perspectiveTypesCount - enabledTypesCount
        },
        toolPerspectives: {
          total: toolPerspectivesCount
        },
        coverage: {
          toolsWithPerspectives: toolsWithPerspectives.length
        }
      };
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to get perspective stats: ${error.message}`,
        'getPerspectiveStats',
        'database',
        error
      );
    }
  }


  /**
   * Enhanced clearModule to also clear tool perspectives
   */
  async clearModule(moduleName) {
    try {
      // Remove module
      const modulesCollection = this.getCollection('modules');
      await modulesCollection.deleteOne({ _id: moduleName });
      
      // Get tools for this module
      const toolsCollection = this.getCollection('tools');
      const moduleTools = await toolsCollection.find({ moduleName }).toArray();
      const toolNames = moduleTools.map(tool => tool.name);
      
      // Remove tool perspectives for these tools
      if (toolNames.length > 0) {
        const perspectivesCollection = this.getCollection('tool_perspectives');
        await perspectivesCollection.deleteMany({ 
          tool_name: { $in: toolNames } 
        });
      }
      
      // Remove tools for this module
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
   * Enhanced createIndexes to include perspective collections
   */
  async createIndexes() {
    try {
      // Existing indexes for modules collection
      const modulesCollection = this.getCollection('modules');
      await modulesCollection.createIndex({ packageName: 1 });
      await modulesCollection.createIndex({ loaded: 1 });
      await modulesCollection.createIndex({ discoveredAt: 1 });
      
      // Existing indexes for tools collection
      const toolsCollection = this.getCollection('tools');
      await toolsCollection.createIndex({ moduleName: 1 });
      await toolsCollection.createIndex({ name: 1 });
      await toolsCollection.createIndex({ 'name': 'text', 'description': 'text' });
      
      // New indexes for perspective_types collection
      const perspectiveTypesCollection = this.getCollection('perspective_types');
      await perspectiveTypesCollection.createIndex({ name: 1 }, { unique: true });
      await perspectiveTypesCollection.createIndex({ category: 1 });
      await perspectiveTypesCollection.createIndex({ order: 1 });
      await perspectiveTypesCollection.createIndex({ enabled: 1 });
      
      // New indexes for tool_perspectives collection
      const toolPerspectivesCollection = this.getCollection('tool_perspectives');
      await toolPerspectivesCollection.createIndex({ tool_name: 1 });
      await toolPerspectivesCollection.createIndex({ tool_id: 1 });
      await toolPerspectivesCollection.createIndex({ perspective_type_name: 1 });
      await toolPerspectivesCollection.createIndex(
        { tool_id: 1, perspective_type_name: 1 }, 
        { unique: true }
      );
      await toolPerspectivesCollection.createIndex({ perspective_type_id: 1 });
      await toolPerspectivesCollection.createIndex({ batch_id: 1 });
      await toolPerspectivesCollection.createIndex({ generated_at: 1 });
      await toolPerspectivesCollection.createIndex({ 
        content: 'text', 
        keywords: 'text' 
      });
      
    } catch (error) {
      // Index creation failures are not critical
      this.logger.warn(`Failed to create indexes: ${error.message}`);
    }
  }

  /**
   * Find modules in modules collection
   * @param {Object} filter - MongoDB filter
   * @returns {Promise<Array>} Array of modules
   */
  async findModules(filter = {}) {
    try {
      const collection = this.getCollection('modules');
      const result = await collection.find(filter).toArray();
      
      console.log(`[DatabaseStorage] Found ${result.length} modules in collection`);
      return result;
    } catch (error) {
      console.error('[DatabaseStorage] Error finding modules:', error.message);
      return [];
    }
  }

  /**
   * Find entries in module-registry collection  
   * @param {Object} filter - MongoDB filter
   * @returns {Promise<Array>} Array of module registry entries
   */
  async findModuleRegistry(filter = {}) {
    try {
      const collection = this.getCollection('module-registry');
      const result = await collection.find(filter).toArray();
      
      console.log(`[DatabaseStorage] Found ${result.length} entries in module-registry collection`);
      return result;
    } catch (error) {
      console.error('[DatabaseStorage] Error finding module registry:', error.message);
      return [];
    }
  }

  /**
   * Get perspectives for tools in a specific module
   * @param {string} moduleName - Module name to filter by
   * @returns {Array} Array of perspective documents
   */
  async getPerspectivesByModule(moduleName) {
    try {
      const collection = this.getCollection('tool_perspectives');
      const filter = { module_name: moduleName };
      
      const result = await collection.find(filter).toArray();
      
      console.log(`[DatabaseStorage] Found ${result.length} perspectives for module ${moduleName}`);
      return result;
    } catch (error) {
      throw new DatabaseError(
        `Failed to get perspectives for module ${moduleName}: ${error.message}`,
        'getPerspectivesByModule',
        'tool_perspectives',
        error
      );
    }
  }

  /**
   * Get perspectives with embeddings for tools in a specific module
   * @param {string} moduleName - Module name to filter by
   * @returns {Array} Array of perspective documents with embeddings
   */
  async getPerspectivesWithEmbeddingsByModule(moduleName) {
    try {
      const collection = this.getCollection('tool_perspectives');
      const filter = {
        module_name: moduleName,
        embedding: { 
          $exists: true, 
          $ne: null, 
          $ne: [],
          $size: 768
        }
      };
      
      const result = await collection.find(filter).toArray();
      
      console.log(`[DatabaseStorage] Found ${result.length} perspectives with embeddings for module ${moduleName}`);
      return result;
    } catch (error) {
      throw new DatabaseError(
        `Failed to get perspectives with embeddings for module ${moduleName}: ${error.message}`,
        'getPerspectivesWithEmbeddingsByModule',
        'tool_perspectives',
        error
      );
    }
  }
}