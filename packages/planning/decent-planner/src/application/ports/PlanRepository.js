/**
 * PlanRepository Interface - Port for plan persistence
 * Following Clean Architecture - defines the contract for plan storage
 */

export class PlanRepository {
  /**
   * Save a plan
   * @param {Plan} plan - The plan to save
   * @returns {Promise<Plan>} The saved plan
   */
  async save(plan) {
    throw new Error('PlanRepository.save() must be implemented');
  }

  /**
   * Find a plan by ID
   * @param {PlanId} planId - The plan ID
   * @returns {Promise<Plan|null>} The plan or null if not found
   */
  async findById(planId) {
    throw new Error('PlanRepository.findById() must be implemented');
  }

  /**
   * Find plans by status
   * @param {PlanStatus} status - The status to filter by
   * @returns {Promise<Plan[]>} Array of plans with the given status
   */
  async findByStatus(status) {
    throw new Error('PlanRepository.findByStatus() must be implemented');
  }

  /**
   * Update a plan
   * @param {Plan} plan - The plan to update
   * @returns {Promise<Plan>} The updated plan
   */
  async update(plan) {
    throw new Error('PlanRepository.update() must be implemented');
  }

  /**
   * Delete a plan
   * @param {PlanId} planId - The plan ID to delete
   * @returns {Promise<boolean>} True if deleted, false otherwise
   */
  async delete(planId) {
    throw new Error('PlanRepository.delete() must be implemented');
  }

  /**
   * Find all plans
   * @param {Object} options - Query options (limit, offset, etc.)
   * @returns {Promise<Plan[]>} Array of plans
   */
  async findAll(options = {}) {
    throw new Error('PlanRepository.findAll() must be implemented');
  }
}