/**
 * IPerspectiveRepository - Repository interface for perspective data operations
 * 
 * Defines the contract for perspective and perspective type data access
 * following Clean Architecture principles. Handles both perspective_types
 * and tool_perspectives collections.
 * 
 * This interface represents the boundary between domain/application layers
 * and the infrastructure layer.
 */

export class IPerspectiveRepository {
  // === Perspective Types Operations ===
  
  /**
   * Find perspective type by name
   * @param {string} name - Perspective type name
   * @returns {Promise<Object|null>} Perspective type document or null
   */
  async findPerspectiveTypeByName(name) {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  /**
   * Find all perspective types
   * @param {Object} filters - Query filters (e.g., enabled: true)
   * @param {Object} options - Query options (sort, limit, etc.)
   * @returns {Promise<Array>} Array of perspective type documents
   */
  async findAllPerspectiveTypes(filters = {}, options = {}) {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  /**
   * Save perspective type (insert or update)
   * @param {Object} perspectiveType - Perspective type document
   * @returns {Promise<Object>} Saved perspective type document
   */
  async savePerspectiveType(perspectiveType) {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  /**
   * Delete perspective type by name
   * @param {string} name - Perspective type name
   * @returns {Promise<boolean>} Success status
   */
  async deletePerspectiveType(name) {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  /**
   * Update perspective type order
   * @param {Array} orderedNames - Array of perspective type names in order
   * @returns {Promise<void>}
   */
  async reorderPerspectiveTypes(orderedNames) {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  // === Tool Perspectives Operations ===
  
  /**
   * Find perspectives for a tool
   * @param {string} toolName - Tool name
   * @returns {Promise<Array>} Array of perspective documents
   */
  async findPerspectivesByTool(toolName) {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  /**
   * Find perspectives by module
   * @param {string} moduleName - Module name
   * @returns {Promise<Array>} Array of perspective documents
   */
  async findPerspectivesByModule(moduleName) {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  /**
   * Find perspectives by type
   * @param {string} perspectiveType - Perspective type name
   * @returns {Promise<Array>} Array of perspective documents
   */
  async findPerspectivesByType(perspectiveType) {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  /**
   * Save tool perspective
   * @param {Object} perspective - Tool perspective document
   * @returns {Promise<Object>} Saved perspective document
   */
  async savePerspective(perspective) {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  /**
   * Save multiple tool perspectives
   * @param {Array} perspectives - Array of perspective documents
   * @returns {Promise<Array>} Array of saved perspective documents
   */
  async saveManyPerspectives(perspectives) {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  /**
   * Delete perspectives by tool
   * @param {string} toolName - Tool name
   * @returns {Promise<number>} Number of deleted documents
   */
  async deletePerspectivesByTool(toolName) {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  /**
   * Delete perspectives by module
   * @param {string} moduleName - Module name
   * @returns {Promise<number>} Number of deleted documents
   */
  async deletePerspectivesByModule(moduleName) {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  /**
   * Delete all perspectives
   * @returns {Promise<number>} Number of deleted documents
   */
  async deleteAllPerspectives() {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  /**
   * Search perspectives by text
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Array of matching perspectives
   */
  async searchPerspectives(query, options = {}) {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  /**
   * Update perspectives with embeddings
   * @param {Array} perspectivesWithEmbeddings - Perspectives with embedding data
   * @returns {Promise<number>} Number of updated documents
   */
  async updatePerspectiveEmbeddings(perspectivesWithEmbeddings) {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  /**
   * Get perspective statistics
   * @returns {Promise<Object>} Statistics object
   */
  async getStatistics() {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  /**
   * Initialize collections and indexes
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error('Method must be implemented by concrete repository');
  }
}