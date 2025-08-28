/**
 * ISystemService - Interface for System Operations
 * 
 * Clean Architecture: Application Layer Interface
 * Defines contract for system-wide operations without implementation details
 */

export class ISystemService {
  /**
   * Initialize the system
   * @param {Object} options - Initialization options
   * @returns {Promise<void>}
   */
  async initialize(options = {}) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Get system status
   * @param {Object} options - Status options (verbose, include details)
   * @returns {Promise<Object>} System status with health information
   */
  async getSystemStatus(options = {}) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Perform health check
   * @returns {Promise<Object>} Health check result
   */
  async healthCheck() {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Get system statistics
   * @returns {Promise<Object>} System statistics
   */
  async getStatistics() {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Clear all data (modules, tools, cache, vectors)
   * @param {Object} options - Clear options (confirm flags)
   * @returns {Promise<Object>} Clear result
   */
  async clearAll(options = {}) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Verify system integrity
   * @returns {Promise<Object>} Integrity verification result
   */
  async verifySystemIntegrity() {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Run complete pipeline (discover, load, generate, index)
   * @param {Object} options - Pipeline options
   * @returns {Promise<Object>} Pipeline execution result
   */
  async runCompletePipeline(options = {}) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Clean up resources
   * @returns {Promise<void>}
   */
  async cleanup() {
    throw new Error('Method must be implemented by concrete class');
  }
}