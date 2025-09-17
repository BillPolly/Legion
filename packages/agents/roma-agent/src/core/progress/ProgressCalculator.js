/**
 * ProgressCalculator - Calculates and tracks task execution progress
 * 
 * Features:
 * - Percentage-based progress calculation
 * - Time estimation based on historical execution
 * - Weighted progress for complex tasks
 * - Support for nested subtask tracking
 */

export class ProgressCalculator {
  constructor(totalSteps, options = {}) {
    this.totalSteps = totalSteps;
    this.completedSteps = 0;
    this.weights = options.weights || {};
    this.startTime = Date.now();
    this.stepStartTimes = new Map();
    this.stepCompletionTimes = new Map();
    this.subtaskProgress = new Map();
    this.options = options;
  }

  /**
   * Calculate current progress percentage
   * @returns {number} Progress percentage (0-100)
   */
  calculatePercentage() {
    if (this.totalSteps === 0) return 0;
    return Math.round((this.completedSteps / this.totalSteps) * 100);
  }

  /**
   * Estimate remaining time based on average step duration
   * @returns {number} Estimated milliseconds remaining
   */
  estimateRemainingTime() {
    if (this.completedSteps === 0) return null;
    
    const elapsed = Date.now() - this.startTime;
    const avgTimePerStep = elapsed / Math.max(1, this.completedSteps);
    const remainingSteps = this.totalSteps - this.completedSteps;
    
    return Math.round(avgTimePerStep * remainingSteps);
  }

  /**
   * Calculate weighted progress for subtasks with different importance
   * @param {Map<string, number>} subtaskProgress - Map of subtask ID to progress (0-100)
   * @returns {number} Weighted progress percentage
   */
  calculateWeightedProgress(subtaskProgress) {
    let totalWeight = 0;
    let weightedSum = 0;
    
    for (const [taskId, progress] of subtaskProgress.entries()) {
      const weight = this.weights[taskId] || 1;
      totalWeight += weight;
      weightedSum += progress * weight;
    }
    
    return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  }

  /**
   * Mark a step as started
   * @param {string} stepId - Step identifier
   */
  startStep(stepId) {
    this.stepStartTimes.set(stepId, Date.now());
    this.subtaskProgress.set(stepId, 0);
  }

  /**
   * Mark a step as completed
   * @param {string} stepId - Step identifier
   */
  completeStep(stepId) {
    const startTime = this.stepStartTimes.get(stepId);
    if (startTime) {
      this.stepCompletionTimes.set(stepId, Date.now() - startTime);
    }
    
    this.subtaskProgress.set(stepId, 100);
    this.completedSteps++;
  }

  /**
   * Update progress for a specific subtask
   * @param {string} subtaskId - Subtask identifier
   * @param {number} progress - Progress percentage (0-100)
   */
  updateSubtaskProgress(subtaskId, progress) {
    this.subtaskProgress.set(subtaskId, Math.min(100, Math.max(0, progress)));
  }

  /**
   * Get detailed progress information
   * @returns {Object} Progress details
   */
  getProgressDetails() {
    const percentage = this.calculatePercentage();
    const weightedPercentage = this.calculateWeightedProgress(this.subtaskProgress);
    const remainingTime = this.estimateRemainingTime();
    const elapsedTime = Date.now() - this.startTime;
    
    return {
      percentage,
      weightedPercentage,
      completedSteps: this.completedSteps,
      totalSteps: this.totalSteps,
      elapsedTime,
      remainingTime,
      estimatedTotalTime: remainingTime ? elapsedTime + remainingTime : null,
      subtaskProgress: Object.fromEntries(this.subtaskProgress),
      averageStepTime: this.calculateAverageStepTime()
    };
  }

  /**
   * Calculate average step completion time
   * @returns {number|null} Average time in milliseconds
   */
  calculateAverageStepTime() {
    if (this.stepCompletionTimes.size === 0) return null;
    
    const times = Array.from(this.stepCompletionTimes.values());
    const sum = times.reduce((acc, time) => acc + time, 0);
    
    return Math.round(sum / times.length);
  }

  /**
   * Estimate initial completion time based on task complexity
   * @param {number} complexity - Task complexity score (0-1)
   * @returns {number} Estimated milliseconds
   */
  estimateInitialTime(complexity = 0.5) {
    // Base estimates per step type
    const baseTimePerStep = this.options.baseTimePerStep || 5000; // 5 seconds default
    const complexityMultiplier = 1 + (complexity * 2); // 1x to 3x based on complexity
    
    return Math.round(this.totalSteps * baseTimePerStep * complexityMultiplier);
  }

  /**
   * Reset progress calculator
   */
  reset() {
    this.completedSteps = 0;
    this.startTime = Date.now();
    this.stepStartTimes.clear();
    this.stepCompletionTimes.clear();
    this.subtaskProgress.clear();
  }

  /**
   * Add a new step dynamically
   * @param {string} stepId - Step identifier
   * @param {number} weight - Step weight (default 1)
   */
  addStep(stepId, weight = 1) {
    this.totalSteps++;
    if (weight !== 1) {
      this.weights[stepId] = weight;
    }
  }

  /**
   * Remove a step dynamically
   * @param {string} stepId - Step identifier
   */
  removeStep(stepId) {
    if (this.subtaskProgress.has(stepId)) {
      if (this.subtaskProgress.get(stepId) === 100) {
        this.completedSteps--;
      }
      this.subtaskProgress.delete(stepId);
      this.stepStartTimes.delete(stepId);
      this.stepCompletionTimes.delete(stepId);
      delete this.weights[stepId];
      this.totalSteps--;
    }
  }

  /**
   * Get progress as a formatted string
   * @returns {string} Progress string
   */
  toString() {
    const details = this.getProgressDetails();
    const timeRemaining = details.remainingTime 
      ? `~${Math.round(details.remainingTime / 1000)}s remaining`
      : '';
    
    return `Progress: ${details.percentage}% (${details.completedSteps}/${details.totalSteps}) ${timeRemaining}`.trim();
  }

  /**
   * Export progress data for persistence
   * @returns {Object} Serializable progress data
   */
  export() {
    return {
      totalSteps: this.totalSteps,
      completedSteps: this.completedSteps,
      weights: this.weights,
      startTime: this.startTime,
      stepStartTimes: Array.from(this.stepStartTimes.entries()),
      stepCompletionTimes: Array.from(this.stepCompletionTimes.entries()),
      subtaskProgress: Array.from(this.subtaskProgress.entries()),
      options: this.options
    };
  }

  /**
   * Import progress data from persistence
   * @param {Object} data - Serialized progress data
   */
  static import(data) {
    const calculator = new ProgressCalculator(data.totalSteps, data.options);
    calculator.completedSteps = data.completedSteps;
    calculator.weights = data.weights;
    calculator.startTime = data.startTime;
    calculator.stepStartTimes = new Map(data.stepStartTimes);
    calculator.stepCompletionTimes = new Map(data.stepCompletionTimes);
    calculator.subtaskProgress = new Map(data.subtaskProgress);
    
    return calculator;
  }
}

export default ProgressCalculator;