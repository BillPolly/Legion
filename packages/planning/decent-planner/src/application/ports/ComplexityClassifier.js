/**
 * ComplexityClassifier Interface - Port for task complexity classification
 * Following Clean Architecture - defines the contract for classification services
 */

export class ComplexityClassifier {
  /**
   * Classify a task as SIMPLE or COMPLEX
   * @param {string} taskDescription - The task description to classify
   * @param {Object} context - Optional context for classification
   * @returns {Promise<Object>} Classification result with complexity and reasoning
   */
  async classify(taskDescription, context = {}) {
    throw new Error('ComplexityClassifier.classify() must be implemented');
  }
}