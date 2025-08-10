/**
 * ContextHints - Manages informal context suggestions through decomposition
 * 
 * Tracks suggested inputs/outputs through the hierarchy to guide decomposition
 * and provide hints to the planner. The actual formal context management is
 * handled by the planner's artifact system.
 */

export class ContextHints {
  constructor() {
    this.hints = new Map();
  }

  /**
   * Store suggested inputs/outputs for a task
   * @param {string} taskId - Task identifier
   * @param {Object} suggestions - Suggested inputs/outputs
   */
  addHints(taskId, suggestions) {
    this.hints.set(taskId, {
      suggestedInputs: suggestions.suggestedInputs || [],
      suggestedOutputs: suggestions.suggestedOutputs || [],
      relatedTasks: suggestions.relatedTasks || []
    });
  }

  /**
   * Get hints for planning a specific task
   * @param {string} taskId - Task identifier
   * @returns {Object} Context hints for the planner
   */
  getHints(taskId) {
    return this.hints.get(taskId) || {
      suggestedInputs: [],
      suggestedOutputs: [],
      relatedTasks: []
    };
  }

  /**
   * Get all outputs from sibling tasks (informal)
   * @param {string} parentId - Parent task ID
   * @returns {Array} All suggested outputs from siblings
   */
  getSiblingOutputs(parentId) {
    const siblingOutputs = [];
    
    // Iterate through all hints to find tasks with same parent
    for (const [taskId, taskHints] of this.hints) {
      // Check if this task is related to the same parent
      if (taskHints.relatedTasks && taskHints.relatedTasks.includes(parentId)) {
        // Collect outputs from this sibling
        siblingOutputs.push(...(taskHints.suggestedOutputs || []));
      }
    }
    
    // Remove duplicates
    return [...new Set(siblingOutputs)];
  }
  
  /**
   * Track parent-child relationships
   * @param {string} taskId - Task identifier
   * @param {string} parentId - Parent task identifier
   */
  setParentRelation(taskId, parentId) {
    const existing = this.hints.get(taskId) || {
      suggestedInputs: [],
      suggestedOutputs: [],
      relatedTasks: []
    };
    
    if (!existing.relatedTasks.includes(parentId)) {
      existing.relatedTasks.push(parentId);
    }
    
    this.hints.set(taskId, existing);
  }
}