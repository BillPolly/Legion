/**
 * MongoModuleRepository - MongoDB implementation of IModuleRepository
 * 
 * Concrete implementation of module data operations using MongoDB.
 * Follows Clean Architecture by implementing the repository interface
 * and encapsulating all MongoDB-specific logic.
 */

import { IModuleRepository } from '../interfaces/IModuleRepository.js';
import { Logger } from '../../utils/Logger.js';
import {
  DatabaseError,
  DatabaseOperationError
} from '../../errors/index.js';

export class MongoModuleRepository extends IModuleRepository {
  constructor(databaseStorage, options = {}) {
    super();
    
    if (!databaseStorage) {
      throw new DatabaseError(
        'DatabaseStorage is required for MongoModuleRepository',
        'INIT_ERROR',
        'MongoModuleRepository'
      );
    }
    
    this.databaseStorage = databaseStorage;
    this.collectionName = 'modules';
    this.logger = Logger.create('MongoModuleRepository', { verbose: options.verbose });
    
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
        'MongoModuleRepository'
      );
    }
    return this.databaseStorage.getCollection(this.collectionName);
  }
  
  /**
   * Find module by name
   * @param {string} name - Module name
   * @returns {Promise<Object|null>} Module document or null
   */
  async findByName(name) {
    try {
      const collection = this._getCollection();
      const module = await collection.findOne({ name });
      
      this.logger.verbose(`Module lookup: ${name} ${module ? 'found' : 'not found'}`);
      return module;
    } catch (error) {
      this.logger.error(`Error finding module by name ${name}: ${error.message}`);
      throw new DatabaseOperationError(
        `Failed to find module by name: ${error.message}`,
        'FIND_ERROR',
        'MongoModuleRepository',
        { name }
      );
    }
  }
  
  /**
   * Find module by ID
   * @param {string} id - Module ID
   * @returns {Promise<Object|null>} Module document or null
   */
  async findById(id) {
    try {
      const collection = this._getCollection();
      const module = await collection.findOne({ _id: id });
      
      this.logger.verbose(`Module lookup by ID: ${id} ${module ? 'found' : 'not found'}`);
      return module;
    } catch (error) {
      this.logger.error(`Error finding module by ID ${id}: ${error.message}`);
      throw new DatabaseOperationError(
        `Failed to find module by ID: ${error.message}`,
        'FIND_ERROR',
        'MongoModuleRepository',
        { id }
      );
    }
  }
  
  /**
   * Find modules by package name
   * @param {string} packageName - Package name
   * @returns {Promise<Array>} Array of module documents
   */
  async findByPackageName(packageName) {
    try {
      const collection = this._getCollection();
      const modules = await collection.find({ packageName }).toArray();
      
      this.logger.verbose(`Found ${modules.length} modules in package: ${packageName}`);
      return modules;
    } catch (error) {
      this.logger.error(`Error finding modules by package ${packageName}: ${error.message}`);
      throw new DatabaseOperationError(
        `Failed to find modules by package: ${error.message}`,
        'FIND_ERROR',
        'MongoModuleRepository',
        { packageName }
      );
    }
  }
  
  /**
   * Find all modules with optional filters
   * @param {Object} filters - Query filters
   * @param {Object} options - Query options (limit, sort, etc.)
   * @returns {Promise<Array>} Array of module documents
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
      
      const modules = await query.toArray();
      
      this.logger.verbose(`Found ${modules.length} modules with filters`, { filters, options });
      return modules;
    } catch (error) {
      this.logger.error(`Error finding all modules: ${error.message}`);
      throw new DatabaseOperationError(
        `Failed to find modules: ${error.message}`,
        'FIND_ERROR',
        'MongoModuleRepository',
        { filters, options }
      );
    }
  }
  
  /**
   * Save module (insert or update)
   * @param {Object} module - Module document
   * @returns {Promise<Object>} Saved module document
   */
  async save(module) {
    try {
      const collection = this._getCollection();
      
      if (module._id) {
        // Update existing
        const result = await collection.replaceOne(
          { _id: module._id },
          module,
          { upsert: true }
        );
        
        this.logger.verbose(`Module updated: ${module.name}`);
        return module;
      } else {
        // Insert new
        const result = await collection.insertOne({
          ...module,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        const savedModule = { ...module, _id: result.insertedId };
        this.logger.verbose(`Module created: ${module.name}`);
        return savedModule;
      }
    } catch (error) {
      this.logger.error(`Error saving module ${module.name}: ${error.message}`);
      throw new DatabaseOperationError(
        `Failed to save module: ${error.message}`,
        'SAVE_ERROR',
        'MongoModuleRepository',
        { moduleName: module.name }
      );
    }
  }
  
  /**
   * Save multiple modules
   * @param {Array} modules - Array of module documents
   * @returns {Promise<Array>} Array of saved module documents
   */
  async saveMany(modules) {
    try {
      const collection = this._getCollection();
      
      if (modules.length === 0) {
        return [];
      }
      
      // Prepare documents with timestamps
      const documentsToInsert = modules.map(module => ({
        ...module,
        createdAt: module.createdAt || new Date(),
        updatedAt: new Date()
      }));
      
      const result = await collection.insertMany(documentsToInsert);
      
      const savedModules = documentsToInsert.map((module, index) => ({
        ...module,
        _id: result.insertedIds[index]
      }));
      
      this.logger.verbose(`Bulk saved ${savedModules.length} modules`);
      return savedModules;
    } catch (error) {
      this.logger.error(`Error saving ${modules.length} modules: ${error.message}`);
      throw new DatabaseOperationError(
        `Failed to save multiple modules: ${error.message}`,
        'SAVE_ERROR',
        'MongoModuleRepository',
        { count: modules.length }
      );
    }
  }
  
  /**
   * Delete module by name
   * @param {string} name - Module name
   * @returns {Promise<boolean>} Success status
   */
  async deleteByName(name) {
    try {
      const collection = this._getCollection();
      const result = await collection.deleteOne({ name });
      
      const deleted = result.deletedCount > 0;
      this.logger.verbose(`Module deletion: ${name} ${deleted ? 'deleted' : 'not found'}`);
      return deleted;
    } catch (error) {
      this.logger.error(`Error deleting module ${name}: ${error.message}`);
      throw new DatabaseOperationError(
        `Failed to delete module: ${error.message}`,
        'DELETE_ERROR',
        'MongoModuleRepository',
        { name }
      );
    }
  }
  
  /**
   * Delete modules by package name
   * @param {string} packageName - Package name
   * @returns {Promise<number>} Number of deleted documents
   */
  async deleteByPackageName(packageName) {
    try {
      const collection = this._getCollection();
      const result = await collection.deleteMany({ packageName });
      
      this.logger.verbose(`Deleted ${result.deletedCount} modules from package: ${packageName}`);
      return result.deletedCount;
    } catch (error) {
      this.logger.error(`Error deleting modules by package ${packageName}: ${error.message}`);
      throw new DatabaseOperationError(
        `Failed to delete modules by package: ${error.message}`,
        'DELETE_ERROR',
        'MongoModuleRepository',
        { packageName }
      );
    }
  }
  
  /**
   * Delete all modules
   * @returns {Promise<number>} Number of deleted documents
   */
  async deleteAll() {
    try {
      const collection = this._getCollection();
      const result = await collection.deleteMany({});
      
      this.logger.verbose(`Deleted all ${result.deletedCount} modules`);
      return result.deletedCount;
    } catch (error) {
      this.logger.error(`Error deleting all modules: ${error.message}`);
      throw new DatabaseOperationError(
        `Failed to delete all modules: ${error.message}`,
        'DELETE_ERROR',
        'MongoModuleRepository'
      );
    }
  }
  
  /**
   * Count modules with optional filters
   * @param {Object} filters - Query filters
   * @returns {Promise<number>} Count of matching documents
   */
  async count(filters = {}) {
    try {
      const collection = this._getCollection();
      const count = await collection.countDocuments(filters);
      
      this.logger.verbose(`Module count: ${count} modules match filters`, { filters });
      return count;
    } catch (error) {
      this.logger.error(`Error counting modules: ${error.message}`);
      throw new DatabaseOperationError(
        `Failed to count modules: ${error.message}`,
        'COUNT_ERROR',
        'MongoModuleRepository',
        { filters }
      );
    }
  }
  
  /**
   * Get module statistics
   * @returns {Promise<Object>} Statistics object
   */
  async getStatistics() {
    try {
      const collection = this._getCollection();
      
      const [
        totalCount,
        packageCount,
        recentCount
      ] = await Promise.all([
        collection.countDocuments({}),
        collection.distinct('packageName').then(packages => packages.length),
        collection.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        })
      ]);
      
      const stats = {
        totalModules: totalCount,
        uniquePackages: packageCount,
        recentModules: recentCount
      };
      
      this.logger.verbose('Module statistics generated', stats);
      return stats;
    } catch (error) {
      this.logger.error(`Error generating module statistics: ${error.message}`);
      throw new DatabaseOperationError(
        `Failed to generate module statistics: ${error.message}`,
        'STATS_ERROR',
        'MongoModuleRepository'
      );
    }
  }
}