/**
 * TaskDecomposer Interface - Port for task decomposition
 * Following Clean Architecture - defines the contract for decomposition services
 */

export class TaskDecomposer {
  /**
   * Decompose a complex task into subtasks
   * @param {string} taskDescription - The task to decompose
   * @param {Object} context - Optional context for decomposition
   * @returns {Promise<Object>} Decomposition result with subtasks
   */
  async decompose(taskDescription, context = {}) {
    throw new Error('TaskDecomposer.decompose() must be implemented');
  }
}