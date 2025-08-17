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
   * Alias for addHints for backward compatibility
   * @param {string} taskId - Task identifier
   * @param {Object} suggestions - Suggested inputs/outputs
   */
  addHint(taskId, suggestions) {
    const hints = {
      suggestedInputs: suggestions.inputs || suggestions.suggestedInputs || [],
      suggestedOutputs: suggestions.outputs || suggestions.suggestedOutputs || [],
      relatedTasks: suggestions.relatedTasks || []
    };
    this.addHints(taskId, hints);
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
  
  /**
   * Alias for getHints for backward compatibility
   * @param {string} taskId - Task identifier
   * @returns {Object} Context hints for the planner
   */
  getHintsForTask(taskId) {
    const hints = this.hints.get(taskId) || {
      suggestedInputs: [],
      suggestedOutputs: [],
      relatedTasks: [],
      availableInputs: []
    };
    return {
      inputs: hints.suggestedInputs,
      outputs: hints.suggestedOutputs,
      availableInputs: hints.availableInputs || [],
      relatedTasks: hints.relatedTasks
    };
  }
  
  /**
   * Merge hints from parent and child tasks
   * @param {string} parentId - Parent task identifier
   * @param {string} childId - Child task identifier
   * @returns {Object} Merged hints
   */
  mergeHints(parentId, childId) {
    const parentHints = this.getHints(parentId);
    const childHints = this.getHints(childId);
    
    // Combine unique inputs and outputs
    const mergedInputs = [...new Set([
      ...parentHints.suggestedInputs,
      ...childHints.suggestedInputs
    ])];
    
    const mergedOutputs = [...new Set([
      ...parentHints.suggestedOutputs,
      ...childHints.suggestedOutputs
    ])];
    
    const mergedRelated = [...new Set([
      ...parentHints.relatedTasks,
      ...childHints.relatedTasks
    ])];
    
    return {
      inputs: mergedInputs,
      outputs: mergedOutputs,
      relatedTasks: mergedRelated
    };
  }
  
  /**
   * Propagate hints through a task hierarchy
   * @param {Object} hierarchy - Task hierarchy to process
   */
  propagateHints(hierarchy) {
    // Helper function to recursively process hierarchy
    const processNode = (node, parentId = null) => {
      // Store hints for this node
      if (node.suggestedInputs || node.suggestedOutputs) {
        this.addHints(node.id, {
          suggestedInputs: node.suggestedInputs || [],
          suggestedOutputs: node.suggestedOutputs || [],
          relatedTasks: parentId ? [parentId] : []
        });
      }
      
      // Track parent relation
      if (parentId) {
        this.setParentRelation(node.id, parentId);
      }
      
      // Process subtasks
      if (node.subtasks && Array.isArray(node.subtasks)) {
        node.subtasks.forEach(subtask => {
          processNode(subtask, node.id);
        });
        
        // After processing all subtasks, update availableInputs
        // Each subtask can use outputs from its siblings
        const siblingOutputs = [];
        node.subtasks.forEach(subtask => {
          const subtaskHints = this.getHints(subtask.id);
          siblingOutputs.push(...subtaskHints.suggestedOutputs);
        });
        
        // Update each subtask with available inputs from siblings
        node.subtasks.forEach(subtask => {
          const existing = this.hints.get(subtask.id) || {
            suggestedInputs: [],
            suggestedOutputs: [],
            relatedTasks: []
          };
          
          // Store available inputs separately
          this.hints.set(subtask.id, {
            ...existing,
            availableInputs: siblingOutputs
          });
        });
      }
    };
    
    // Start processing from root
    processNode(hierarchy);
  }
}