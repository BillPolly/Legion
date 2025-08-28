/**
 * ICacheService - Interface for Caching Operations
 * 
 * Clean Architecture: Application Layer Interface
 * Defines contract for caching without implementation details
 */

export class ICacheService {
  /**
   * Get item from cache
   * @param {string} key - Cache key
   * @param {Object} options - Cache options (force refresh)
   * @returns {Promise<Object|null>} Cached item or null if not found
   */
  async get(key, options = {}) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Store item in cache
   * @param {string} key - Cache key
   * @param {Object} value - Value to cache
   * @param {Object} options - Cache options (TTL, tags)
   * @returns {Promise<void>}
   */
  async set(key, value, options = {}) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Remove item from cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} True if item was removed
   */
  async remove(key) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Clear cache by pattern or tag
   * @param {Object} options - Clear options (pattern, tags)
   * @returns {Promise<number>} Number of items cleared
   */
  async clear(options = {}) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Cache statistics
   */
  async getStatistics() {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Check if cache is healthy
   * @returns {Promise<boolean>} True if cache is operational
   */
  async isHealthy() {
    throw new Error('Method must be implemented by concrete class');
  }
}