/**
 * IToolRepository - Repository interface for tool data operations
 * 
 * Defines the contract for tool data access following Clean Architecture principles.
 * Business logic depends on this interface, not concrete database implementations.
 * 
 * This interface represents the boundary between domain/application layers
 * and the infrastructure layer.
 */

export class IToolRepository {
  /**
   * Find tool by name
   * @param {string} name - Tool name
   * @returns {Promise<Object|null>} Tool document or null
   */
  async findByName(name) {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  /**
   * Find tool by ID
   * @param {string} id - Tool ID
   * @returns {Promise<Object|null>} Tool document or null
   */
  async findById(id) {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  /**
   * Find tools by module name
   * @param {string} moduleName - Module name
   * @returns {Promise<Array>} Array of tool documents
   */
  async findByModuleName(moduleName) {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  /**
   * Find all tools with optional filters
   * @param {Object} filters - Query filters
   * @param {Object} options - Query options (limit, sort, etc.)
   * @returns {Promise<Array>} Array of tool documents
   */
  async findAll(filters = {}, options = {}) {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  /**
   * Save tool (insert or update)
   * @param {Object} tool - Tool document
   * @returns {Promise<Object>} Saved tool document
   */
  async save(tool) {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  /**
   * Save multiple tools
   * @param {Array} tools - Array of tool documents
   * @returns {Promise<Array>} Array of saved tool documents
   */
  async saveMany(tools) {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  /**
   * Delete tool by name
   * @param {string} name - Tool name
   * @returns {Promise<boolean>} Success status
   */
  async deleteByName(name) {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  /**
   * Delete tools by module name
   * @param {string} moduleName - Module name
   * @returns {Promise<number>} Number of deleted documents
   */
  async deleteByModuleName(moduleName) {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  /**
   * Delete all tools
   * @returns {Promise<number>} Number of deleted documents
   */
  async deleteAll() {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  /**
   * Count tools with optional filters
   * @param {Object} filters - Query filters
   * @returns {Promise<number>} Count of matching documents
   */
  async count(filters = {}) {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  /**
   * Text search tools
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Array of matching tools
   */
  async textSearch(query, options = {}) {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  /**
   * Create text search indexes
   * @returns {Promise<void>}
   */
  async createTextIndexes() {
    throw new Error('Method must be implemented by concrete repository');
  }
}