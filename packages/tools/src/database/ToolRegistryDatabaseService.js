/**
 * Tool Registry Database Service
 * 
 * Database service layer for the Tool Registry using the Legion storage package.
 * Provides high-level database operations for modules, tools, and usage tracking.
 * 
 * 🚨 FOLLOWS LEGION RESOURCEMANAGER PATTERN 🚨
 * Uses async factory pattern with ResourceManager for dependency injection.
 */

import { StorageProvider } from '@legion/storage';
import { ToolRegistrySchemaManager } from './schemas/ToolRegistrySchemas.js';
import { ObjectId } from 'mongodb';

export class ToolRegistryDatabaseService {
  /**
   * Private constructor - use create() factory method
   */
  constructor(dependencies) {
    if (!dependencies?._factoryCall) {
      throw new Error('ToolRegistryDatabaseService must be created using create() factory method');
    }

    this.resourceManager = dependencies.resourceManager;
    this.storageProvider = dependencies.storageProvider;
    this.mongoProvider = this.storageProvider.getProvider('mongodb');
    this.schemaManager = new ToolRegistrySchemaManager(this.storageProvider);
    this.initialized = false;
  }

  /**
   * Async factory method following Legion ResourceManager pattern
   */
  static async create(resourceManager) {
    if (!resourceManager?.initialized) {
      throw new Error('ToolRegistryDatabaseService requires initialized ResourceManager');
    }

    // Check for singleton
    const existing = resourceManager.get?.('toolRegistryDatabaseService');
    if (existing) return existing;

    // Create StorageProvider with ResourceManager
    // Note: StorageProvider auto-configures and connects providers during create()
    const storageProvider = await StorageProvider.create(resourceManager);

    const service = new ToolRegistryDatabaseService({
      _factoryCall: true,
      resourceManager,
      storageProvider
    });

    await service.initialize();

    // Register as singleton
    if (resourceManager.register) {
      resourceManager.register('toolRegistryDatabaseService', service);
    }

    return service;
  }

  /**
   * Initialize database collections and indexes
   */
  async initialize() {
    if (this.initialized) return;

    console.log('🗄️ Initializing Tool Registry Database Service...');

    try {
      // Ensure database connection
      if (!this.mongoProvider.connected) {
        await this.mongoProvider.connect();
      }

      // Initialize collections with validation and indexes
      const initResults = await this.schemaManager.initializeCollections();
      
      console.log('📋 Collection initialization results:');
      initResults.forEach(result => {
        const status = result.status === 'created' ? '✅' : 
                      result.status === 'exists' ? '📁' : '❌';
        console.log(`  ${status} ${result.collection}: ${result.status}`);
      });

      this.initialized = true;
      console.log('✅ Tool Registry Database Service initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize Tool Registry Database Service:', error);
      throw error;
    }
  }

  // ============================================================================
  // MODULE OPERATIONS
  // ============================================================================

  /**
   * Create or update a module
   */
  async upsertModule(moduleData) {
    const now = new Date();
    const isUpdate = !!moduleData._id;

    const document = {
      ...moduleData,
      updatedAt: now
    };

    if (!isUpdate) {
      document.createdAt = now;
      document.toolCount = 0; // Initialize tool count
      document.status = document.status || 'active';
    }

    if (isUpdate) {
      const result = await this.mongoProvider.update(
        'modules',
        { _id: new ObjectId(moduleData._id) },
        { $set: document }
      );
      return { ...document, _id: moduleData._id };
    } else {
      const result = await this.mongoProvider.insert('modules', document);
      return { ...document, _id: result.insertedIds[0] };
    }
  }

  /**
   * Get module by name
   */
  async getModuleByName(name) {
    return await this.mongoProvider.findOne('modules', { name });
  }

  /**
   * Get module by ID
   */
  async getModuleById(id) {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return await this.mongoProvider.findOne('modules', { _id: objectId });
  }

  /**
   * List all modules with optional filtering
   */
  async listModules(options = {}) {
    const query = {};
    
    if (options.status) query.status = options.status;
    if (options.category) query.category = options.category;
    if (options.tags) query.tags = { $in: options.tags };

    const findOptions = {};
    if (options.sort) findOptions.sort = options.sort;
    if (options.limit) findOptions.limit = options.limit;
    if (options.skip) findOptions.skip = options.skip;

    return await this.mongoProvider.find('modules', query, findOptions);
  }

  /**
   * Search modules by text
   */
  async searchModules(searchText, options = {}) {
    const query = {
      $text: { $search: searchText }
    };

    if (options.category) query.category = options.category;
    if (options.status) query.status = options.status;

    const findOptions = {
      sort: { score: { $meta: 'textScore' } },
      limit: options.limit || 20
    };

    return await this.mongoProvider.find('modules', query, findOptions);
  }

  /**
   * Delete module (also removes all associated tools)
   */
  async deleteModule(moduleId) {
    const objectId = typeof moduleId === 'string' ? new ObjectId(moduleId) : moduleId;
    
    // Start transaction to ensure data consistency
    const session = this.mongoProvider.client.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Delete all tools for this module
        await this.mongoProvider.delete('tools', { moduleId: objectId }, { session });
        
        // Delete usage records for this module
        await this.mongoProvider.delete('tool_usage', { moduleId: objectId }, { session });
        
        // Delete the module
        await this.mongoProvider.delete('modules', { _id: objectId }, { session });
      });

      return true;
    } catch (error) {
      console.error('Failed to delete module:', error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  // ============================================================================
  // TOOL OPERATIONS
  // ============================================================================

  /**
   * Create or update a tool
   */
  async upsertTool(toolData) {
    const now = new Date();
    const isUpdate = !!toolData._id;

    // Ensure moduleId is ObjectId
    if (toolData.moduleId && typeof toolData.moduleId === 'string') {
      toolData.moduleId = new ObjectId(toolData.moduleId);
    }

    const document = {
      ...toolData,
      updatedAt: now
    };

    if (!isUpdate) {
      document.createdAt = now;
      document.status = document.status || 'active';
    }

    if (isUpdate) {
      const result = await this.mongoProvider.update(
        'tools',
        { _id: new ObjectId(toolData._id) },
        { $set: document }
      );
      return { ...document, _id: toolData._id };
    } else {
      const result = await this.mongoProvider.insert('tools', document);
      
      // Update module tool count
      await this.mongoProvider.update(
        'modules',
        { _id: toolData.moduleId },
        { $inc: { toolCount: 1 } }
      );

      return { ...document, _id: result.insertedIds[0] };
    }
  }

  /**
   * Get tool by name and module
   */
  async getToolByName(toolName, moduleName = null) {
    const query = { name: toolName };
    if (moduleName) {
      query.moduleName = moduleName;
    }
    return await this.mongoProvider.findOne('tools', query);
  }

  /**
   * Get tool by ID
   */
  async getToolById(id) {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return await this.mongoProvider.findOne('tools', { _id: objectId });
  }

  /**
   * List tools with optional filtering
   */
  async listTools(options = {}) {
    const query = {};
    
    if (options.moduleId) {
      const objectId = typeof options.moduleId === 'string' ? new ObjectId(options.moduleId) : options.moduleId;
      query.moduleId = objectId;
    }
    if (options.moduleName) query.moduleName = options.moduleName;
    if (options.category) query.category = options.category;
    if (options.status) query.status = options.status;
    if (options.tags) query.tags = { $in: options.tags };

    const findOptions = {};
    if (options.sort) findOptions.sort = options.sort;
    if (options.limit) findOptions.limit = options.limit;
    if (options.skip) findOptions.skip = options.skip;

    return await this.mongoProvider.find('tools', query, findOptions);
  }

  /**
   * Search tools by text
   */
  async searchTools(searchText, options = {}) {
    const query = {
      $text: { $search: searchText }
    };

    if (options.category) query.category = options.category;
    if (options.moduleName) query.moduleName = options.moduleName;
    if (options.status) query.status = options.status;

    const findOptions = {
      sort: { score: { $meta: 'textScore' } },
      limit: options.limit || 50
    };

    return await this.mongoProvider.find('tools', query, findOptions);
  }

  /**
   * Find similar tools by embedding vector
   */
  async findSimilarTools(embedding, options = {}) {
    const pipeline = [
      {
        $addFields: {
          similarity: {
            $reduce: {
              input: { $zip: { inputs: ['$embedding', embedding] } },
              initialValue: 0,
              in: { $add: ['$$value', { $multiply: [{ $arrayElemAt: ['$$this', 0] }, { $arrayElemAt: ['$$this', 1] }] }] }
            }
          }
        }
      },
      { $match: { embedding: { $exists: true }, similarity: { $gte: options.threshold || 0.5 } } },
      { $sort: { similarity: -1 } },
      { $limit: options.limit || 10 }
    ];

    return await this.mongoProvider.aggregate('tools', pipeline);
  }

  /**
   * Update tool embedding
   */
  async updateToolEmbedding(toolId, embedding, model) {
    const objectId = typeof toolId === 'string' ? new ObjectId(toolId) : toolId;
    
    return await this.mongoProvider.update(
      'tools',
      { _id: objectId },
      { 
        $set: { 
          embedding,
          embeddingModel: model,
          updatedAt: new Date()
        } 
      }
    );
  }

  /**
   * Get tools without embeddings
   */
  async getToolsWithoutEmbeddings(limit = 100) {
    return await this.mongoProvider.find(
      'tools',
      { embedding: { $exists: false } },
      { limit }
    );
  }

  // ============================================================================
  // USAGE TRACKING OPERATIONS
  // ============================================================================

  /**
   * Record tool usage
   */
  async recordToolUsage(usageData) {
    // Ensure toolId is ObjectId
    if (usageData.toolId && typeof usageData.toolId === 'string') {
      usageData.toolId = new ObjectId(usageData.toolId);
    }

    const document = {
      ...usageData,
      timestamp: usageData.timestamp || new Date()
    };

    return await this.mongoProvider.insert('tool_usage', document);
  }

  /**
   * Get usage statistics for a tool
   */
  async getToolUsageStats(toolId, options = {}) {
    const objectId = typeof toolId === 'string' ? new ObjectId(toolId) : toolId;
    
    const pipeline = [
      { $match: { toolId: objectId } },
      {
        $group: {
          _id: null,
          totalUsage: { $sum: 1 },
          successfulUsage: { $sum: { $cond: ['$success', 1, 0] } },
          averageExecutionTime: { $avg: '$executionTime' },
          lastUsed: { $max: '$timestamp' }
        }
      }
    ];

    const results = await this.mongoProvider.aggregate('tool_usage', pipeline);
    return results[0] || {
      totalUsage: 0,
      successfulUsage: 0,
      averageExecutionTime: null,
      lastUsed: null
    };
  }

  /**
   * Get usage statistics for all tools
   */
  async getAllToolsUsageStats(options = {}) {
    const pipeline = [
      {
        $group: {
          _id: '$toolId',
          toolName: { $first: '$toolName' },
          moduleName: { $first: '$moduleName' },
          totalUsage: { $sum: 1 },
          successfulUsage: { $sum: { $cond: ['$success', 1, 0] } },
          averageExecutionTime: { $avg: '$executionTime' },
          lastUsed: { $max: '$timestamp' }
        }
      },
      { $sort: { totalUsage: -1 } }
    ];

    if (options.limit) {
      pipeline.push({ $limit: options.limit });
    }

    return await this.mongoProvider.aggregate('tool_usage', pipeline);
  }

  /**
   * Get trending tools (most used in recent period)
   */
  async getTrendingTools(options = {}) {
    const hoursBack = options.hours || 24;
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    const pipeline = [
      { $match: { timestamp: { $gte: since } } },
      {
        $group: {
          _id: '$toolId',
          toolName: { $first: '$toolName' },
          moduleName: { $first: '$moduleName' },
          recentUsage: { $sum: 1 },
          successRate: { $avg: { $cond: ['$success', 1, 0] } }
        }
      },
      { $sort: { recentUsage: -1 } },
      { $limit: options.limit || 20 }
    ];

    return await this.mongoProvider.aggregate('tool_usage', pipeline);
  }

  // ============================================================================
  // UTILITY OPERATIONS
  // ============================================================================

  /**
   * Get database statistics
   */
  async getDatabaseStats() {
    const [moduleCount, toolCount, usageCount] = await Promise.all([
      this.mongoProvider.count('modules'),
      this.mongoProvider.count('tools'),
      this.mongoProvider.count('tool_usage')
    ]);

    return {
      modules: moduleCount,
      tools: toolCount,
      usageRecords: usageCount,
      collections: Object.keys(this.schemaManager.constructor.ToolRegistryCollections || {}).length
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const stats = await this.getDatabaseStats();
      const isConnected = this.mongoProvider.connected;

      return {
        status: isConnected ? 'healthy' : 'disconnected',
        initialized: this.initialized,
        connected: isConnected,
        database: this.mongoProvider.databaseName,
        stats
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        initialized: this.initialized,
        connected: false
      };
    }
  }

  /**
   * Cleanup and disconnect
   */
  async cleanup() {
    console.log('🔌 Cleaning up Tool Registry Database Service...');
    
    if (this.storageProvider && typeof this.storageProvider.disconnect === 'function') {
      await this.storageProvider.disconnect();
    } else if (this.mongoProvider && typeof this.mongoProvider.disconnect === 'function') {
      await this.mongoProvider.disconnect();
    }

    this.initialized = false;
    console.log('✅ Tool Registry Database Service cleanup complete');
  }
}