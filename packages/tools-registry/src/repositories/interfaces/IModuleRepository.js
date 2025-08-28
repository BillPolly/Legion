/**
 * IModuleRepository - Repository interface for module data operations
 * 
 * Defines the contract for module data access following Clean Architecture principles.
 * Business logic depends on this interface, not concrete database implementations.
 * 
 * This interface represents the boundary between domain/application layers
 * and the infrastructure layer.
 */

export class IModuleRepository {
  /**
   * Find module by name
   * @param {string} name - Module name
   * @returns {Promise<Object|null>} Module document or null
   */
  async findByName(name) {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  /**
   * Find module by ID
   * @param {string} id - Module ID
   * @returns {Promise<Object|null>} Module document or null
   */
  async findById(id) {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  /**
   * Find modules by package name
   * @param {string} packageName - Package name
   * @returns {Promise<Array>} Array of module documents
   */
  async findByPackageName(packageName) {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  /**
   * Find all modules with optional filters
   * @param {Object} filters - Query filters
   * @param {Object} options - Query options (limit, sort, etc.)
   * @returns {Promise<Array>} Array of module documents
   */
  async findAll(filters = {}, options = {}) {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  /**
   * Save module (insert or update)
   * @param {Object} module - Module document
   * @returns {Promise<Object>} Saved module document
   */
  async save(module) {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  /**
   * Save multiple modules
   * @param {Array} modules - Array of module documents
   * @returns {Promise<Array>} Array of saved module documents
   */
  async saveMany(modules) {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  /**
   * Delete module by name
   * @param {string} name - Module name
   * @returns {Promise<boolean>} Success status
   */
  async deleteByName(name) {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  /**
   * Delete modules by package name
   * @param {string} packageName - Package name
   * @returns {Promise<number>} Number of deleted documents
   */
  async deleteByPackageName(packageName) {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  /**
   * Delete all modules
   * @returns {Promise<number>} Number of deleted documents
   */
  async deleteAll() {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  /**
   * Count modules with optional filters
   * @param {Object} filters - Query filters
   * @returns {Promise<number>} Count of matching documents
   */
  async count(filters = {}) {
    throw new Error('Method must be implemented by concrete repository');
  }
  
  /**
   * Get module statistics
   * @returns {Promise<Object>} Statistics object
   */
  async getStatistics() {
    throw new Error('Method must be implemented by concrete repository');
  }
}