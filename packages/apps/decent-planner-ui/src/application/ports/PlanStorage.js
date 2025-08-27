/**
 * PlanStorage Port
 * Interface for plan persistence
 */

export class PlanStorage {
  /**
   * Save a planning session
   * @param {string} name - Plan name
   * @param {object} session - Planning session to save
   * @returns {Promise<string>} Saved plan identifier
   */
  async save(name, session) {
    throw new Error('PlanStorage.save must be implemented');
  }
  
  /**
   * Load a planning session
   * @param {string} identifier - Plan identifier
   * @returns {Promise<object>} Loaded planning session
   */
  async load(identifier) {
    throw new Error('PlanStorage.load must be implemented');
  }
  
  /**
   * List all saved plans
   * @returns {Promise<array>} List of saved plans
   */
  async list() {
    throw new Error('PlanStorage.list must be implemented');
  }
  
  /**
   * Delete a saved plan
   * @param {string} identifier - Plan identifier
   * @returns {Promise<void>}
   */
  async delete(identifier) {
    throw new Error('PlanStorage.delete must be implemented');
  }
  
  /**
   * Check if a plan exists
   * @param {string} identifier - Plan identifier
   * @returns {Promise<boolean>} Existence check
   */
  async exists(identifier) {
    throw new Error('PlanStorage.exists must be implemented');
  }
}