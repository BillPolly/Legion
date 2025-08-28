/**
 * MongoToolRepository - MongoDB implementation of IToolRepository
 * 
 * Concrete implementation of tool data operations using MongoDB.
 * Follows Clean Architecture by implementing the repository interface
 * and encapsulating all MongoDB-specific logic.
 * 
 * This is part of the infrastructure layer and depends on the
 * repository interface, not the other way around.
 */

import { IToolRepository } from '../interfaces/IToolRepository.js';
import { Logger } from '../../utils/Logger.js';
import {
  DatabaseError,
  ToolNotFoundError,
  DatabaseOperationError
} from '../../errors/index.js';

export class MongoToolRepository extends IToolRepository {
  constructor(databaseStorage, options = {}) {
    super();
    
    if (!databaseStorage) {
      throw new DatabaseError(
        'DatabaseStorage is required for MongoToolRepository',
        'INIT_ERROR',
        'MongoToolRepository'
      );
    }
    
    this.databaseStorage = databaseStorage;
    this.collectionName = 'tools';
    this.logger = Logger.create('MongoToolRepository', { verbose: options.verbose });
    
    this.options = {
      verbose: false,
      ...options
    };
  }
  
  /**
   * Get MongoDB collection
   * @private
   * @returns {Collection} MongoDB collection
   */
  _getCollection() {
    if (!this.databaseStorage.isConnected) {
      throw new DatabaseError(
        'Database not connected',
        'CONNECTION_ERROR',
        'MongoToolRepository'
      );
    }
    return this.databaseStorage.getCollection(this.collectionName);
  }
  
  /**
   * Find tool by name
   * @param {string} name - Tool name
   * @returns {Promise<Object|null>} Tool document or null
   */
  async findByName(name) {
    try {
      const collection = this._getCollection();
      const tool = await collection.findOne({ name });
      
      this.logger.verbose(`Tool lookup: ${name} ${tool ? 'found' : 'not found'}`);
      return tool;
    } catch (error) {
      this.logger.error(`Error finding tool by name ${name}: ${error.message}`);
      throw new DatabaseOperationError(
        `Failed to find tool by name: ${error.message}`,
        'FIND_ERROR',
        'MongoToolRepository',
        { name }
      );
    }
  }
  
  /**
   * Find tool by ID
   * @param {string} id - Tool ID
   * @returns {Promise<Object|null>} Tool document or null
   */
  async findById(id) {
    try {
      const collection = this._getCollection();
      const tool = await collection.findOne({ _id: id });
      
      this.logger.verbose(`Tool lookup by ID: ${id} ${tool ? 'found' : 'not found'}`);
      return tool;
    } catch (error) {
      this.logger.error(`Error finding tool by ID ${id}: ${error.message}`);
      throw new DatabaseOperationError(
        `Failed to find tool by ID: ${error.message}`,
        'FIND_ERROR',
        'MongoToolRepository',
        { id }
      );
    }
  }
  
  /**
   * Find tools by module name
   * @param {string} moduleName - Module name
   * @returns {Promise<Array>} Array of tool documents
   */
  async findByModuleName(moduleName) {
    try {
      const collection = this._getCollection();
      const tools = await collection.find({ moduleName }).toArray();
      
      this.logger.verbose(`Found ${tools.length} tools for module: ${moduleName}`);
      return tools;
    } catch (error) {
      this.logger.error(`Error finding tools by module ${moduleName}: ${error.message}`);
      throw new DatabaseOperationError(
        `Failed to find tools by module: ${error.message}`,
        'FIND_ERROR',
        'MongoToolRepository',
        { moduleName }
      );
    }
  }
  
  /**
   * Find all tools with optional filters
   * @param {Object} filters - Query filters
   * @param {Object} options - Query options (limit, sort, etc.)
   * @returns {Promise<Array>} Array of tool documents
   */
  async findAll(filters = {}, options = {}) {
    try {
      const collection = this._getCollection();
      let query = collection.find(filters);
      
      if (options.sort) {
        query = query.sort(options.sort);
      }
      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.skip) {
        query = query.skip(options.skip);
      }
      
      const tools = await query.toArray();
      
      this.logger.verbose(`Found ${tools.length} tools with filters`, { filters, options });
      return tools;
    } catch (error) {
      this.logger.error(`Error finding all tools: ${error.message}`);
      throw new DatabaseOperationError(
        `Failed to find tools: ${error.message}`,
        'FIND_ERROR',
        'MongoToolRepository',
        { filters, options }
      );
    }
  }
  
  /**
   * Save tool (insert or update)
   * @param {Object} tool - Tool document
   * @returns {Promise<Object>} Saved tool document
   */
  async save(tool) {
    try {
      const collection = this._getCollection();
      
      if (tool._id) {
        // Update existing
        const result = await collection.replaceOne(
          { _id: tool._id },
          tool,
          { upsert: true }
        );
        
        this.logger.verbose(`Tool updated: ${tool.name}`);
        return tool;
      } else {
        // Insert new
        const result = await collection.insertOne({
          ...tool,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        const savedTool = { ...tool, _id: result.insertedId };
        this.logger.verbose(`Tool created: ${tool.name}`);
        return savedTool;
      }
    } catch (error) {
      this.logger.error(`Error saving tool ${tool.name}: ${error.message}`);
      throw new DatabaseOperationError(
        `Failed to save tool: ${error.message}`,
        'SAVE_ERROR',
        'MongoToolRepository',
        { toolName: tool.name }
      );
    }
  }
  
  /**
   * Save multiple tools
   * @param {Array} tools - Array of tool documents
   * @returns {Promise<Array>} Array of saved tool documents
   */
  async saveMany(tools) {
    try {
      const collection = this._getCollection();
      
      if (tools.length === 0) {
        return [];
      }
      
      // Prepare documents with timestamps
      const documentsToInsert = tools.map(tool => ({
        ...tool,
        createdAt: tool.createdAt || new Date(),
        updatedAt: new Date()
      }));
      
      const result = await collection.insertMany(documentsToInsert);
      
      const savedTools = documentsToInsert.map((tool, index) => ({
        ...tool,
        _id: result.insertedIds[index]
      }));
      
      this.logger.verbose(`Bulk saved ${savedTools.length} tools`);
      return savedTools;
    } catch (error) {
      this.logger.error(`Error saving ${tools.length} tools: ${error.message}`);
      throw new DatabaseOperationError(
        `Failed to save multiple tools: ${error.message}`,
        'SAVE_ERROR',
        'MongoToolRepository',
        { count: tools.length }
      );
    }
  }
  
  /**
   * Delete tool by name
   * @param {string} name - Tool name
   * @returns {Promise<boolean>} Success status
   */
  async deleteByName(name) {
    try {
      const collection = this._getCollection();
      const result = await collection.deleteOne({ name });
      
      const deleted = result.deletedCount > 0;
      this.logger.verbose(`Tool deletion: ${name} ${deleted ? 'deleted' : 'not found'}`);
      return deleted;
    } catch (error) {
      this.logger.error(`Error deleting tool ${name}: ${error.message}`);
      throw new DatabaseOperationError(
        `Failed to delete tool: ${error.message}`,
        'DELETE_ERROR',
        'MongoToolRepository',
        { name }
      );
    }
  }
  
  /**
   * Delete tools by module name
   * @param {string} moduleName - Module name
   * @returns {Promise<number>} Number of deleted documents
   */
  async deleteByModuleName(moduleName) {
    try {
      const collection = this._getCollection();
      const result = await collection.deleteMany({ moduleName });
      
      this.logger.verbose(`Deleted ${result.deletedCount} tools from module: ${moduleName}`);
      return result.deletedCount;
    } catch (error) {
      this.logger.error(`Error deleting tools by module ${moduleName}: ${error.message}`);
      throw new DatabaseOperationError(
        `Failed to delete tools by module: ${error.message}`,
        'DELETE_ERROR',
        'MongoToolRepository',
        { moduleName }
      );
    }
  }
  
  /**
   * Delete all tools
   * @returns {Promise<number>} Number of deleted documents
   */
  async deleteAll() {
    try {
      const collection = this._getCollection();
      const result = await collection.deleteMany({});
      
      this.logger.verbose(`Deleted all ${result.deletedCount} tools`);
      return result.deletedCount;
    } catch (error) {
      this.logger.error(`Error deleting all tools: ${error.message}`);
      throw new DatabaseOperationError(
        `Failed to delete all tools: ${error.message}`,
        'DELETE_ERROR',
        'MongoToolRepository'
      );
    }
  }
  
  /**
   * Count tools with optional filters
   * @param {Object} filters - Query filters
   * @returns {Promise<number>} Count of matching documents
   */
  async count(filters = {}) {
    try {
      const collection = this._getCollection();
      const count = await collection.countDocuments(filters);
      
      this.logger.verbose(`Tool count: ${count} tools match filters`, { filters });
      return count;
    } catch (error) {
      this.logger.error(`Error counting tools: ${error.message}`);
      throw new DatabaseOperationError(
        `Failed to count tools: ${error.message}`,
        'COUNT_ERROR',
        'MongoToolRepository',
        { filters }
      );
    }
  }
  
  /**
   * Text search tools
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Array of matching tools
   */
  async textSearch(query, options = {}) {
    try {
      const collection = this._getCollection();
      
      let searchQuery = { $text: { $search: query } };
      let findOptions = {};
      
      if (options.sortByScore) {
        findOptions.projection = { score: { $meta: 'textScore' } };
      }
      
      let cursor = collection.find(searchQuery, findOptions);
      
      if (options.sortByScore) {
        cursor = cursor.sort({ score: { $meta: 'textScore' } });
      }
      if (options.limit) {
        cursor = cursor.limit(options.limit);
      }
      
      const results = await cursor.toArray();
      
      this.logger.verbose(`Text search found ${results.length} tools for query: "${query}"`);
      return results;
    } catch (error) {
      this.logger.error(`Error in text search: ${error.message}`);
      throw new DatabaseOperationError(
        `Failed to perform text search: ${error.message}`,
        'SEARCH_ERROR',
        'MongoToolRepository',
        { query, options }
      );
    }
  }
  
  /**
   * Create text search indexes
   * @returns {Promise<void>}
   */
  async createTextIndexes() {
    try {
      const collection = this._getCollection();
      
      await collection.createIndex(
        { name: 'text', description: 'text' },
        { 
          name: 'tool_text_index',
          weights: {
            name: 10,
            description: 5
          }
        }
      );
      
      this.logger.verbose('Created text search indexes for tools');
    } catch (error) {
      if (error.code !== 85) { // Index already exists
        this.logger.error(`Error creating text indexes: ${error.message}`);
        throw new DatabaseOperationError(
          `Failed to create text indexes: ${error.message}`,
          'INDEX_ERROR',
          'MongoToolRepository'
        );
      }
      this.logger.verbose('Text indexes already exist');
    }
  }
}