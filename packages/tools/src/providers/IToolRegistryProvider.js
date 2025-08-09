/**
 * Tool Registry Provider Interface
 * 
 * Defines the contract for tool registry data providers.
 * This allows the ToolRegistry to work with different storage backends
 * (MongoDB, JSON files, memory, etc.) without being coupled to any specific implementation.
 */

/**
 * Abstract base class for tool registry providers
 */
export class IToolRegistryProvider {
  constructor(config = {}) {
    this.config = config;
    this.initialized = false;
    this.connected = false;
  }

  /**
   * Initialize the provider
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error('initialize() must be implemented by provider');
  }

  /**
   * Connect to the underlying storage
   * @returns {Promise<void>}
   */
  async connect() {
    throw new Error('connect() must be implemented by provider');
  }

  /**
   * Disconnect from the underlying storage
   * @returns {Promise<void>}
   */
  async disconnect() {
    throw new Error('disconnect() must be implemented by provider');
  }

  // ============================================================================
  // MODULE OPERATIONS
  // ============================================================================

  /**
   * Get module by name
   * @param {string} name - Module name
   * @returns {Promise<Object|null>} Module data or null if not found
   */
  async getModule(name) {
    throw new Error('getModule() must be implemented by provider');
  }

  /**
   * List all modules with optional filtering
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} Array of module data
   */
  async listModules(options = {}) {
    throw new Error('listModules() must be implemented by provider');
  }

  /**
   * Save or update a module
   * @param {Object} moduleData - Module data to save
   * @returns {Promise<Object>} Saved module data with ID
   */
  async saveModule(moduleData) {
    throw new Error('saveModule() must be implemented by provider');
  }

  /**
   * Delete a module
   * @param {string} name - Module name
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteModule(name) {
    throw new Error('deleteModule() must be implemented by provider');
  }

  /**
   * Search modules by text
   * @param {string} searchText - Text to search for
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Array of matching modules
   */
  async searchModules(searchText, options = {}) {
    throw new Error('searchModules() must be implemented by provider');
  }

  // ============================================================================
  // TOOL OPERATIONS
  // ============================================================================

  /**
   * Get tool by name, optionally within a specific module
   * @param {string} toolName - Tool name
   * @param {string} [moduleName] - Module name (optional)
   * @returns {Promise<Object|null>} Tool data or null if not found
   */
  async getTool(toolName, moduleName = null) {
    throw new Error('getTool() must be implemented by provider');
  }

  /**
   * List tools with optional filtering
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} Array of tool data
   */
  async listTools(options = {}) {
    throw new Error('listTools() must be implemented by provider');
  }

  /**
   * Save or update a tool
   * @param {Object} toolData - Tool data to save
   * @returns {Promise<Object>} Saved tool data with ID
   */
  async saveTool(toolData) {
    throw new Error('saveTool() must be implemented by provider');
  }

  /**
   * Delete a tool
   * @param {string} toolName - Tool name
   * @param {string} moduleName - Module name
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteTool(toolName, moduleName) {
    throw new Error('deleteTool() must be implemented by provider');
  }

  /**
   * Search tools by text
   * @param {string} searchText - Text to search for
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Array of matching tools
   */
  async searchTools(searchText, options = {}) {
    throw new Error('searchTools() must be implemented by provider');
  }

  /**
   * Find similar tools (for semantic search)
   * @param {Array<number>} embedding - Embedding vector
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Array of similar tools with similarity scores
   */
  async findSimilarTools(embedding, options = {}) {
    // Default implementation returns empty array for providers without semantic search
    return [];
  }

  /**
   * Update tool embedding
   * @param {string} toolId - Tool ID
   * @param {Array<number>} embedding - Embedding vector
   * @param {string} model - Model used to generate embedding
   * @returns {Promise<boolean>} Success status
   */
  async updateToolEmbedding(toolId, embedding, model) {
    // Default implementation does nothing for providers without semantic search
    return true;
  }

  /**
   * Get tools without embeddings
   * @param {number} limit - Maximum number of tools to return
   * @returns {Promise<Array>} Array of tools without embeddings
   */
  async getToolsWithoutEmbeddings(limit = 100) {
    // Default implementation returns empty array for providers without semantic search
    return [];
  }

  // ============================================================================
  // USAGE TRACKING
  // ============================================================================

  /**
   * Record tool usage
   * @param {Object} usageData - Usage data to record
   * @returns {Promise<void>}
   */
  async recordUsage(usageData) {
    // Default implementation does nothing for providers without usage tracking
  }

  /**
   * Get usage statistics for a tool
   * @param {string} toolName - Tool name
   * @param {string} moduleName - Module name
   * @param {Object} options - Options
   * @returns {Promise<Object>} Usage statistics
   */
  async getUsageStats(toolName, moduleName, options = {}) {
    // Default implementation returns empty stats
    return {
      totalUsage: 0,
      successfulUsage: 0,
      averageExecutionTime: null,
      lastUsed: null
    };
  }

  /**
   * Get trending tools
   * @param {Object} options - Options
   * @returns {Promise<Array>} Array of trending tools
   */
  async getTrendingTools(options = {}) {
    // Default implementation returns empty array
    return [];
  }

  // ============================================================================
  // METADATA AND STATS
  // ============================================================================

  /**
   * Get provider statistics
   * @returns {Promise<Object>} Provider statistics
   */
  async getStats() {
    throw new Error('getStats() must be implemented by provider');
  }

  /**
   * Health check
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    return {
      status: this.connected ? 'healthy' : 'disconnected',
      initialized: this.initialized,
      connected: this.connected,
      provider: this.constructor.name
    };
  }

  /**
   * Get provider capabilities
   * @returns {Array<string>} Array of capability names
   */
  getCapabilities() {
    return [
      'modules',
      'tools', 
      'search'
    ];
  }

  /**
   * Check if provider supports a capability
   * @param {string} capability - Capability name
   * @returns {boolean} True if supported
   */
  hasCapability(capability) {
    return this.getCapabilities().includes(capability);
  }
}

/**
 * Provider capability constants
 */
export const PROVIDER_CAPABILITIES = {
  MODULES: 'modules',
  TOOLS: 'tools',
  SEARCH: 'search',
  SEMANTIC_SEARCH: 'semantic_search',
  USAGE_TRACKING: 'usage_tracking',
  RECOMMENDATIONS: 'recommendations',
  TRANSACTIONS: 'transactions',
  REAL_TIME: 'real_time'
};