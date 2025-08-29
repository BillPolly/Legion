/**
 * ToolConsumer - Clean Architecture Consumer Interface
 * 
 * Single Responsibility: Fast tool consumption for production applications
 * 
 * Use Case: "I need to find and execute tools quickly"
 * 
 * Uncle Bob's Clean Architecture:
 * - Application Layer: Handles tool consumption use cases
 * - Interface Segregation: Only exposes methods needed by consumers
 * - Dependency Inversion: Depends on abstractions (ToolRegistry)
 * - Single Responsibility: Tool consumption ONLY
 * 
 * This is a FACADE that accesses the ONE ToolRegistry singleton
 */

import { ToolRegistry } from '../integration/ToolRegistry.js';
import { Logger } from '../utils/Logger.js';

export class ToolConsumer {
  static _instance = null;

  constructor(options = {}) {
    if (ToolConsumer._instance) {
      throw new Error('ToolConsumer is a singleton. Use ToolConsumer.getInstance() instead.');
    }

    this.toolRegistry = null;
    this.isInitialized = false;
    this.logger = Logger.create('ToolConsumer', { verbose: options.verbose });
  }

  /**
   * Get the singleton instance
   */
  static async getInstance(options = {}) {
    if (!ToolConsumer._instance) {
      ToolConsumer._instance = new ToolConsumer(options);
      await ToolConsumer._instance.initialize();
    }
    return ToolConsumer._instance;
  }

  /**
   * Reset singleton (for testing)
   */
  static reset() {
    ToolConsumer._instance = null;
  }

  /**
   * Initialize the consumer
   */
  async initialize() {
    if (this.isInitialized) return;

    // Get the ONE ToolRegistry singleton
    this.toolRegistry = await ToolRegistry.getInstance();
    this.isInitialized = true;
    
    this.logger.info('ToolConsumer initialized for production use');
  }

  /**
   * Get a tool by name
   * Fast retrieval for production use
   * 
   * @param {string} toolName - Name of the tool
   * @returns {Promise<Object>} Tool instance ready for execution
   */
  async getTool(toolName) {
    await this._ensureInitialized();
    
    if (!toolName || typeof toolName !== 'string') {
      throw new Error('Tool name must be a non-empty string');
    }

    this.logger.debug(`Getting tool: ${toolName}`);
    
    try {
      const tool = await this.toolRegistry.getTool(toolName);
      
      if (!tool) {
        throw new Error(`Tool not found: ${toolName}`);
      }

      this.logger.debug(`Successfully retrieved tool: ${toolName}`);
      return tool;
    } catch (error) {
      this.logger.error(`Failed to get tool ${toolName}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Search for tools using semantic search
   * Primary discovery method for consumers
   * 
   * @param {string} query - Natural language query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Matching tools with relevance scores
   */
  async searchTools(query, options = {}) {
    await this._ensureInitialized();
    
    if (!query || typeof query !== 'string') {
      throw new Error('Search query must be a non-empty string');
    }

    const searchOptions = {
      useSemanticSearch: true,
      limit: options.limit,
      minScore: options.minScore || 0.5,
      ...options
    };

    this.logger.debug(`Searching tools for: "${query}"`);
    
    try {
      const results = await this.toolRegistry.searchTools(query, searchOptions);
      
      this.logger.debug(`Found ${results.length} tools for query: "${query}"`);
      return results;
    } catch (error) {
      this.logger.error(`Search failed for query: "${query}"`, { error: error.message });
      throw error;
    }
  }

  /**
   * List available tools
   * Browse what's available
   * 
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} List of available tools
   */
  async listTools(filters = {}) {
    await this._ensureInitialized();
    
    const options = {
      limit: filters.limit,
      category: filters.category,
      module: filters.module,
      ...filters
    };

    this.logger.debug('Listing available tools', { filters: options });
    
    try {
      const tools = await this.toolRegistry.listTools(options);
      
      this.logger.debug(`Listed ${tools.length} tools`);
      return tools;
    } catch (error) {
      this.logger.error('Failed to list tools', { error: error.message });
      throw error;
    }
  }

  /**
   * Execute a tool with parameters
   * Convenience method for one-step execution
   * 
   * @param {string} toolName - Name of tool to execute
   * @param {Object} parameters - Tool parameters
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Tool execution result
   */
  async executeTool(toolName, parameters = {}, options = {}) {
    await this._ensureInitialized();
    
    this.logger.debug(`Executing tool: ${toolName}`, { parameters });
    
    try {
      // Get the tool
      const tool = await this.getTool(toolName);
      
      // Execute it
      const result = await tool.execute(parameters, options);
      
      this.logger.debug(`Tool execution completed: ${toolName}`, { 
        success: result.success,
        hasData: !!result.data,
        hasError: !!result.error
      });
      
      return result;
    } catch (error) {
      this.logger.error(`Tool execution failed: ${toolName}`, { 
        error: error.message, 
        parameters 
      });
      throw error;
    }
  }

  /**
   * Get tool metadata
   * Information about a tool without loading it
   * 
   * @param {string} toolName - Name of the tool
   * @returns {Promise<Object>} Tool metadata
   */
  async getToolMetadata(toolName) {
    await this._ensureInitialized();
    
    if (!toolName || typeof toolName !== 'string') {
      throw new Error('Tool name must be a non-empty string');
    }

    this.logger.debug(`Getting metadata for tool: ${toolName}`);
    
    try {
      const tool = await this.getTool(toolName);
      
      if (!tool) {
        throw new Error(`Tool not found: ${toolName}`);
      }

      // Extract metadata
      const metadata = {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema || tool.schema?.input,
        outputSchema: tool.outputSchema || tool.schema?.output,
        moduleName: tool.moduleName,
        version: tool.version,
        category: tool.category,
        keywords: tool.keywords,
        examples: tool.examples,
        performance: tool.performance
      };

      this.logger.debug(`Retrieved metadata for tool: ${toolName}`);
      return metadata;
    } catch (error) {
      this.logger.error(`Failed to get metadata for tool: ${toolName}`, { 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get related tools
   * Discover similar tools
   * 
   * @param {string} toolName - Reference tool name
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Similar tools
   */
  async getRelatedTools(toolName, options = {}) {
    await this._ensureInitialized();
    
    if (!toolName || typeof toolName !== 'string') {
      throw new Error('Tool name must be a non-empty string');
    }

    this.logger.debug(`Finding tools related to: ${toolName}`);
    
    try {
      const relatedTools = await this.toolRegistry.getRelatedTools(toolName, {
        limit: options.limit,
        minSimilarity: options.minSimilarity || 0.6,
        ...options
      });

      this.logger.debug(`Found ${relatedTools.length} tools related to: ${toolName}`);
      return relatedTools;
    } catch (error) {
      this.logger.error(`Failed to find related tools for: ${toolName}`, { 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Health check for consumer operations
   * Quick system status for production monitoring
   * 
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    await this._ensureInitialized();
    
    try {
      const health = await this.toolRegistry.healthCheck();
      
      // Consumer-focused health info
      const consumerHealth = {
        healthy: health.healthy,
        toolsAvailable: health.tools?.available || 0,
        searchEnabled: health.search?.enabled || false,
        cacheStatus: health.cache?.status || 'unknown',
        responseTime: health.responseTime,
        timestamp: health.timestamp || new Date().toISOString()
      };

      this.logger.debug('Health check completed', { healthy: consumerHealth.healthy });
      return consumerHealth;
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
   * Get consumer statistics
   * Performance metrics for production monitoring
   * 
   * @returns {Promise<Object>} Consumer statistics
   */
  async getStatistics() {
    await this._ensureInitialized();
    
    try {
      const stats = await this.toolRegistry.getStatistics();
      
      // Consumer-focused stats
      return {
        tools: {
          total: stats.tools?.total || 0,
          cached: stats.tools?.cached || 0,
          modules: stats.tools?.modules || stats.modules?.totalLoaded || 0
        },
        cache: {
          size: stats.cache?.size || 0,
          hitRate: stats.cache?.hitRate || 0,
          hits: stats.cache?.hits || 0,
          misses: stats.cache?.misses || 0
        },
        search: {
          enabled: stats.search?.enabled || false,
          indexed: stats.search?.vectorsIndexed || 0
        },
        uptime: stats.uptime || 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Failed to get statistics', { error: error.message });
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
    this.logger.info('ToolConsumer cleaned up');
  }

  /**
   * Ensure the consumer is initialized
   * @private
   */
  async _ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }
}