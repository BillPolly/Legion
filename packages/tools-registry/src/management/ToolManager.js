/**
 * ToolManager - Clean Architecture Management Interface
 * 
 * Single Responsibility: Administrative operations for system management
 * 
 * Use Case: "I need to administer and configure the tool system"
 * 
 * Uncle Bob's Clean Architecture:
 * - Application Layer: Handles administrative use cases
 * - Interface Segregation: Only exposes methods needed by administrators
 * - Dependency Inversion: Depends on abstractions (ToolRegistry)
 * - Single Responsibility: System administration ONLY
 * 
 * This is a FACADE that accesses the ONE ToolRegistry singleton
 */

import { ToolRegistry } from '../integration/ToolRegistry.js';
import { Logger } from '../utils/Logger.js';

export class ToolManager {
  static _instance = null;

  constructor(options = {}) {
    if (ToolManager._instance) {
      throw new Error('ToolManager is a singleton. Use ToolManager.getInstance() instead.');
    }

    this.toolRegistry = null;
    this.isInitialized = false;
    this.logger = Logger.create('ToolManager', { verbose: options.verbose });
  }

  /**
   * Get the singleton instance
   */
  static async getInstance(options = {}) {
    if (!ToolManager._instance) {
      ToolManager._instance = new ToolManager(options);
      await ToolManager._instance.initialize();
    }
    return ToolManager._instance;
  }

  /**
   * Reset singleton (for testing)
   */
  static reset() {
    ToolManager._instance = null;
  }

  /**
   * Initialize the manager
   */
  async initialize() {
    if (this.isInitialized) return;

    // Get the ONE ToolRegistry singleton
    this.toolRegistry = await ToolRegistry.getInstance();
    this.isInitialized = true;
    
    this.logger.info('ToolManager initialized for administrative use');
  }

  /**
   * Discover modules in filesystem paths
   * Administrative operation for system setup
   * 
   * @param {Array<string>} searchPaths - Paths to search for modules
   * @returns {Promise<Object>} Discovery results with modules found
   */
  async discoverModules(searchPaths) {
    await this._ensureInitialized();
    
    if (!Array.isArray(searchPaths) || searchPaths.length === 0) {
      throw new Error('Search paths must be a non-empty array');
    }

    this.logger.info(`Discovering modules in ${searchPaths.length} paths`, { searchPaths });
    
    try {
      const results = await this.toolRegistry.discoverModules(searchPaths);
      
      this.logger.info(`Discovery completed: ${results.discovered} modules found`, {
        discovered: results.discovered,
        errors: results.errors?.length || 0
      });
      
      return results;
    } catch (error) {
      this.logger.error('Module discovery failed', { error: error.message, searchPaths });
      throw error;
    }
  }

  /**
   * Load a single module
   * Administrative operation for selective loading
   * 
   * @param {string} moduleName - Name of module to load
   * @param {Object} moduleConfig - Module configuration
   * @returns {Promise<Object>} Load result
   */
  async loadModule(moduleName, moduleConfig = {}) {
    await this._ensureInitialized();
    
    if (!moduleName || typeof moduleName !== 'string') {
      throw new Error('Module name must be a non-empty string');
    }

    this.logger.info(`Loading module: ${moduleName}`, { moduleConfig });
    
    try {
      const result = await this.toolRegistry.loadModule(moduleName, moduleConfig);
      
      if (result.success) {
        this.logger.info(`Module loaded successfully: ${moduleName}`, {
          cached: result.cached,
          toolCount: result.toolCount
        });
      } else {
        this.logger.warn(`Module load failed: ${moduleName}`, { error: result.error });
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Module load error: ${moduleName}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Load multiple modules
   * Administrative bulk operation
   * 
   * @param {Array<string>} moduleNames - Names of modules to load
   * @param {Object} options - Loading options
   * @returns {Promise<Object>} Bulk load results
   */
  async loadMultipleModules(moduleNames, options = {}) {
    await this._ensureInitialized();
    
    if (!Array.isArray(moduleNames) || moduleNames.length === 0) {
      throw new Error('Module names must be a non-empty array');
    }

    this.logger.info(`Loading ${moduleNames.length} modules`, { moduleNames });
    
    try {
      const results = await this.toolRegistry.loadMultipleModules(moduleNames, options);
      
      this.logger.info('Bulk module loading completed', {
        loaded: results.loaded,
        failed: results.failed,
        total: moduleNames.length
      });
      
      return results;
    } catch (error) {
      this.logger.error('Bulk module loading failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Load all discovered modules
   * Administrative operation for complete system setup
   * 
   * @param {Object} options - Loading options
   * @returns {Promise<Object>} Load all results
   */
  async loadAllModules(options = {}) {
    await this._ensureInitialized();
    
    this.logger.info('Loading all discovered modules', { options });
    
    try {
      const results = await this.toolRegistry.loadAllModules(options);
      
      this.logger.info('Load all modules completed', {
        loaded: results.loaded,
        failed: results.failed
      });
      
      return results;
    } catch (error) {
      this.logger.error('Load all modules failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate perspectives for all tools
   * Administrative operation for search preparation
   * 
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generation results
   */
  async generatePerspectives(options = {}) {
    await this._ensureInitialized();
    
    this.logger.info('Generating perspectives for tools', { options });
    
    try {
      const results = await this.toolRegistry.generatePerspectives(options);
      
      this.logger.info('Perspective generation completed', {
        generated: results.generated,
        failed: results.failed || 0
      });
      
      return results;
    } catch (error) {
      this.logger.error('Perspective generation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate embeddings for perspectives
   * Administrative operation for semantic search setup
   * 
   * @param {Object} options - Embedding options
   * @returns {Promise<Object>} Embedding results
   */
  async generateEmbeddings(options = {}) {
    await this._ensureInitialized();
    
    this.logger.info('Generating embeddings for perspectives', { options });
    
    try {
      const results = await this.toolRegistry.generateEmbeddings(options);
      
      this.logger.info('Embedding generation completed', {
        generated: results.generated,
        failed: results.failed || 0
      });
      
      return results;
    } catch (error) {
      this.logger.error('Embedding generation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Index vectors in vector store
   * Administrative operation for vector database setup
   * 
   * @param {Object} options - Indexing options
   * @returns {Promise<Object>} Indexing results
   */
  async indexVectors(options = {}) {
    await this._ensureInitialized();
    
    this.logger.info('Indexing vectors in vector store', { options });
    
    try {
      const results = await this.toolRegistry.indexVectors(options);
      
      this.logger.info('Vector indexing completed', {
        indexed: results.indexed,
        failed: results.failed || 0
      });
      
      return results;
    } catch (error) {
      this.logger.error('Vector indexing failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Load vectors from perspectives into vector store (with clear option)
   * Administrative operation for vector loading with clearing
   * 
   * @param {Object} options - Loading options (clearFirst, batchSize, verbose)
   * @returns {Promise<Object>} Load results
   */
  async loadVectors(options = {}) {
    await this._ensureInitialized();
    
    this.logger.info('Loading vectors from perspectives with clear option', { options });
    
    try {
      const results = await this.toolRegistry.loadVectors(options);
      
      this.logger.info('Vector loading completed', {
        loaded: results.loaded,
        cleared: results.cleared,
        failed: results.failed || 0
      });
      
      return results;
    } catch (error) {
      this.logger.error('Vector loading failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Run complete initialization pipeline
   * Administrative operation for full system setup
   * 
   * @param {Object} options - Pipeline options
   * @returns {Promise<Object>} Pipeline results
   */
  async runCompletePipeline(options = {}) {
    await this._ensureInitialized();
    
    this.logger.info('Running complete initialization pipeline', { options });
    
    try {
      const results = await this.toolRegistry.runCompletePipeline(options);
      
      this.logger.info('Complete pipeline finished', {
        success: results.success,
        steps: results.steps?.length || 0
      });
      
      return results;
    } catch (error) {
      this.logger.error('Complete pipeline failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Clear all system data
   * Administrative operation for system reset
   * 
   * @param {Object} options - Clear options
   * @returns {Promise<Object>} Clear results
   */
  async clearAllData(options = {}) {
    await this._ensureInitialized();
    
    this.logger.warn('Clearing all system data', { options });
    
    try {
      const results = await this.toolRegistry.clearAllData(options);
      
      this.logger.info('System data cleared', { results });
      return results;
    } catch (error) {
      this.logger.error('Clear all data failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Clear specific module
   * Administrative operation for selective cleanup
   * 
   * @param {string} moduleName - Module to clear
   * @returns {Promise<Object>} Clear results
   */
  async clearModule(moduleName) {
    await this._ensureInitialized();
    
    if (!moduleName || typeof moduleName !== 'string') {
      throw new Error('Module name must be a non-empty string');
    }

    this.logger.info(`Clearing module: ${moduleName}`);
    
    try {
      const results = await this.toolRegistry.clearModule(moduleName);
      
      this.logger.info(`Module cleared: ${moduleName}`, {
        success: results.success,
        toolsCleared: results.toolsCleared
      });
      
      return results;
    } catch (error) {
      this.logger.error(`Clear module failed: ${moduleName}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Get comprehensive system statistics
   * Administrative monitoring operation
   * 
   * @returns {Promise<Object>} System statistics
   */
  async getStatistics() {
    await this._ensureInitialized();
    
    try {
      const stats = await this.toolRegistry.getStatistics();
      
      this.logger.debug('Retrieved system statistics', {
        modules: stats.modules?.loaded || 0,
        tools: stats.tools?.total || 0,
        search: stats.search?.enabled || false
      });
      
      return stats;
    } catch (error) {
      this.logger.error('Failed to get statistics', { error: error.message });
      throw error;
    }
  }

  /**
   * Comprehensive health check
   * Administrative monitoring operation
   * 
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    await this._ensureInitialized();
    
    try {
      const health = await this.toolRegistry.healthCheck();
      
      this.logger.debug('Health check completed', { healthy: health.healthy });
      return health;
    } catch (error) {
      this.logger.error('Health check failed', { error: error.message });
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get detailed system status
   * Administrative monitoring operation
   * 
   * @param {Object} options - Status options
   * @returns {Promise<Object>} System status
   */
  async getSystemStatus(options = {}) {
    await this._ensureInitialized();
    
    try {
      const status = await this.toolRegistry.getSystemStatus(options);
      
      this.logger.debug('Retrieved system status', {
        healthy: status.healthy,
        hasStatistics: !!status.statistics,
        hasConfiguration: !!status.configuration
      });
      
      return status;
    } catch (error) {
      this.logger.error('Failed to get system status', { error: error.message });
      throw error;
    }
  }

  /**
   * Verify system integrity
   * Administrative validation operation
   * 
   * @returns {Promise<Object>} Integrity results
   */
  async verifySystemIntegrity() {
    await this._ensureInitialized();
    
    this.logger.info('Verifying system integrity');
    
    try {
      const results = await this.toolRegistry.verifySystemIntegrity();
      
      this.logger.info('System integrity verification completed', {
        success: results.success,
        issues: results.issues?.length || 0
      });
      
      return results;
    } catch (error) {
      this.logger.error('System integrity verification failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Test semantic search functionality
   * Administrative testing operation
   * 
   * @param {Array<string>} queries - Test queries
   * @param {Object} options - Test options
   * @returns {Promise<Object>} Test results
   */
  async testSemanticSearch(queries = null, options = {}) {
    await this._ensureInitialized();
    
    this.logger.info('Testing semantic search functionality', { 
      customQueries: queries?.length || 0,
      options 
    });
    
    try {
      const results = await this.toolRegistry.testSemanticSearch(queries, options);
      
      this.logger.info('Semantic search test completed', {
        success: results.success,
        queriesRun: results.queriesRun || 0
      });
      
      return results;
    } catch (error) {
      this.logger.error('Semantic search test failed', { error: error.message });
      throw error;
    }
  }

  /**
   * List all tools with full administrative details
   * Administrative operation for system overview
   * 
   * @param {Object} filters - Filtering options
   * @returns {Promise<Array>} Complete tool list
   */
  async listAllTools(filters = {}) {
    await this._ensureInitialized();
    
    this.logger.debug('Listing all tools for administration', { filters });
    
    try {
      const tools = await this.toolRegistry.listTools({
        includeMetadata: true,
        includeStats: true,
        ...filters
      });
      
      this.logger.debug(`Listed ${tools.length} tools for administration`);
      return tools;
    } catch (error) {
      this.logger.error('Failed to list all tools', { error: error.message });
      throw error;
    }
  }

  /**
   * Get administrative tool details
   * Administrative operation for tool inspection
   * 
   * @param {string} toolName - Name of tool
   * @returns {Promise<Object>} Complete tool details
   */
  async getToolDetails(toolName) {
    await this._ensureInitialized();
    
    if (!toolName || typeof toolName !== 'string') {
      throw new Error('Tool name must be a non-empty string');
    }

    this.logger.debug(`Getting administrative details for tool: ${toolName}`);
    
    try {
      const tool = await this.toolRegistry.getToolWithPerspectives(toolName);
      
      if (!tool) {
        throw new Error(`Tool not found: ${toolName}`);
      }

      this.logger.debug(`Retrieved administrative details for tool: ${toolName}`);
      return tool;
    } catch (error) {
      this.logger.error(`Failed to get tool details: ${toolName}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Add a single module incrementally 
   * Administrative operation for incremental module management
   * 
   * @param {string} modulePath - Path to module file
   * @param {Object} options - Addition options
   * @returns {Promise<Object>} Addition result
   */
  async addModule(modulePath, options = {}) {
    await this._ensureInitialized();
    
    if (!modulePath || typeof modulePath !== 'string') {
      throw new Error('Module path must be a non-empty string');
    }

    this.logger.info(`Adding module incrementally: ${modulePath}`, { options });
    
    try {
      const result = await this.toolRegistry.addModule(modulePath, options);
      
      if (result.success) {
        this.logger.info(`Module added successfully: ${result.moduleName}`, {
          moduleId: result.moduleId,
          toolCount: result.toolCount,
          alreadyExists: result.alreadyExists
        });
      } else {
        this.logger.warn(`Module addition failed: ${modulePath}`, { error: result.error });
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Module addition error: ${modulePath}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Add a module with complete pipeline
   * Administrative operation for full incremental setup
   * 
   * @param {string} modulePath - Path to module file
   * @param {Object} options - Pipeline options
   * @returns {Promise<Object>} Complete addition result
   */
  async addModuleComplete(modulePath, options = {}) {
    await this._ensureInitialized();
    
    if (!modulePath || typeof modulePath !== 'string') {
      throw new Error('Module path must be a non-empty string');
    }

    this.logger.info(`Adding module with complete pipeline: ${modulePath}`, { options });
    
    try {
      const result = await this.toolRegistry.addModuleComplete(modulePath, options);
      
      if (result.success) {
        this.logger.info(`Module pipeline completed successfully: ${result.module?.moduleName}`, {
          steps: result.steps?.length || 0,
          errors: result.errors?.length || 0
        });
      } else {
        this.logger.warn(`Module pipeline failed: ${modulePath}`, { 
          errors: result.errors 
        });
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Module pipeline error: ${modulePath}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.toolRegistry) {
      await this.toolRegistry.cleanup();
    }
    this.logger.info('ToolManager cleaned up');
  }

  /**
   * Ensure the manager is initialized
   * @private
   */
  async _ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }
}