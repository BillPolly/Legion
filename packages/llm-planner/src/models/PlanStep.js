/**
 * PlanStep model - Represents a hierarchical step in a plan
 * 
 * Steps can contain either:
 * - Actions (leaf nodes) - atomic operations from allowableActions
 * - Sub-steps (branches) - further hierarchical decomposition
 */

import { PlanAction } from './PlanAction.js';

class PlanStep {
  /**
   * Create a PlanStep
   * @param {Object} data - Step data
   * @param {Array} allowableActions - Available action definitions
   */
  constructor(data = {}, allowableActions = []) {
    // Core properties
    this.id = data.id || this._generateId();
    this.name = data.name || '';
    this.description = data.description || '';
    this.type = data.type || 'unknown';
    this.status = data.status || 'pending';
    
    // Hierarchical structure
    this.steps = []; // Sub-steps
    this.actions = []; // Actions (leaf nodes)
    
    // Dependencies
    this.dependencies = Array.isArray(data.dependencies) ? [...data.dependencies] : [];
    
    // Input/Output tracking
    this.inputs = Array.isArray(data.inputs) ? [...data.inputs] : [];
    this.outputs = Array.isArray(data.outputs) ? [...data.outputs] : [];
    
    // Execution properties
    this.estimatedDuration = data.estimatedDuration || 0;
    this.result = data.result || null;
    
    // Store allowable actions for validation
    this.allowableActions = allowableActions;
    
    // Initialize sub-steps if provided
    if (data.steps && Array.isArray(data.steps)) {
      for (const stepData of data.steps) {
        this.addStep(new PlanStep(stepData, allowableActions));
      }
    }
    
    // Initialize actions if provided
    if (data.actions && Array.isArray(data.actions)) {
      for (const actionData of data.actions) {
        this.addAction(actionData);
      }
    }
  }

  /**
   * Generate a unique step ID
   * @private
   */
  _generateId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `step-${timestamp}-${random}`;
  }

  /**
   * Add a sub-step
   * @param {PlanStep} step - Step to add
   */
  addStep(step) {
    if (!(step instanceof PlanStep)) {
      throw new Error('Must be a PlanStep instance');
    }
    this.steps.push(step);
  }

  /**
   * Add an action (leaf node)
   * @param {Object} actionData - Action data or PlanAction instance
   */
  addAction(actionData) {
    let action;
    
    if (actionData instanceof PlanAction) {
      action = actionData;
    } else {
      // Find the action definition
      const actionType = actionData.toolName || actionData.type;
      const actionDef = this.allowableActions.find(a => a.type === actionType);
      if (!actionDef) {
        throw new Error(`Unknown action type: ${actionType}`);
      }
      action = new PlanAction(actionDef, actionData.parameters || {});
    }
    
    this.actions.push(action);
  }

  /**
   * Check if this is a leaf step (has actions but no sub-steps)
   * @returns {boolean} True if leaf step
   */
  isLeaf() {
    return this.actions.length > 0 && this.steps.length === 0;
  }

  /**
   * Check if this is a branch step (has sub-steps)
   * @returns {boolean} True if branch step
   */
  isBranch() {
    return this.steps.length > 0;
  }

  /**
   * Get all leaf actions recursively
   * @returns {Array<PlanAction>} All actions in this step and sub-steps
   */
  getAllActions() {
    const allActions = [...this.actions];
    
    for (const step of this.steps) {
      allActions.push(...step.getAllActions());
    }
    
    return allActions;
  }

  /**
   * Get all inputs required by this step and its sub-steps
   * @returns {Array<string>} Array of input names
   */
  getInputs() {
    const inputs = new Set([...this.inputs]);
    
    // Add inputs from actions
    for (const action of this.actions) {
      action.getInputs().forEach(input => inputs.add(input));
    }
    
    // Add inputs from sub-steps
    for (const step of this.steps) {
      step.getInputs().forEach(input => inputs.add(input));
    }
    
    return Array.from(inputs);
  }

  /**
   * Get all outputs produced by this step and its sub-steps
   * @returns {Array<string>} Array of output names
   */
  getOutputs() {
    const outputs = new Set([...this.outputs]);
    
    // Add outputs from actions
    for (const action of this.actions) {
      action.getOutputs().forEach(output => outputs.add(output));
    }
    
    // Add outputs from sub-steps
    for (const step of this.steps) {
      step.getOutputs().forEach(output => outputs.add(output));
    }
    
    return Array.from(outputs);
  }

  /**
   * Validate this step's inputs against available outputs
   * @param {Array<string>} availableOutputs - Outputs available from previous steps
   * @returns {Object} Validation result
   */
  validateInputs(availableOutputs = []) {
    // For steps with actions, validate each action in sequence
    if (this.actions.length > 0) {
      return this._validateActionSequence(availableOutputs);
    }
    
    // For steps with sub-steps, validate recursively  
    const requiredInputs = this.getInputs();
    const missingInputs = requiredInputs.filter(input => !availableOutputs.includes(input));
    
    return {
      isValid: missingInputs.length === 0,
      missingInputs,
      satisfiedInputs: requiredInputs.filter(input => availableOutputs.includes(input))
    };
  }

  /**
   * Validate a sequence of actions within this step
   * @private
   */
  _validateActionSequence(availableOutputs = []) {
    const currentlyAvailable = [...availableOutputs];
    const missingInputs = [];
    const satisfiedInputs = [];
    
    // Validate each action in sequence using the action's own validation logic
    for (const action of this.actions) {
      // Use the action's validateInputs method which handles both outputs and parameters
      const actionValidation = action.validateInputs(currentlyAvailable);
      
      missingInputs.push(...actionValidation.missingInputs);
      satisfiedInputs.push(...actionValidation.satisfiedInputs);
      
      // Add this action's outputs to available outputs for next action
      const actionOutputs = action.getOutputs();
      for (const output of actionOutputs) {
        if (!currentlyAvailable.includes(output)) {
          currentlyAvailable.push(output);
        }
      }
    }
    
    return {
      isValid: missingInputs.length === 0,
      missingInputs: [...new Set(missingInputs)], // Remove duplicates
      satisfiedInputs: [...new Set(satisfiedInputs)] // Remove duplicates
    };
  }

  /**
   * Update step status
   * @param {string} newStatus - New status
   */
  updateStatus(newStatus) {
    const validStatuses = ['pending', 'in-progress', 'completed', 'failed', 'skipped'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}`);
    }
    this.status = newStatus;
  }

  /**
   * Get step depth in hierarchy
   * @returns {number} Depth (0 for root level)
   */
  getDepth() {
    if (this.steps.length === 0) {
      return 0;
    }
    return 1 + Math.max(...this.steps.map(step => step.getDepth()));
  }

  /**
   * Find a step by ID (recursive)
   * @param {string} stepId - Step ID to find
   * @returns {PlanStep|null} Found step or null
   */
  findStep(stepId) {
    if (this.id === stepId) {
      return this;
    }
    
    for (const step of this.steps) {
      const found = step.findStep(stepId);
      if (found) {
        return found;
      }
    }
    
    return null;
  }

  /**
   * Get flat list of all steps (breadth-first)
   * @returns {Array<PlanStep>} All steps
   */
  getFlatSteps() {
    const steps = [this];
    const queue = [...this.steps];
    
    while (queue.length > 0) {
      const step = queue.shift();
      steps.push(step);
      queue.push(...step.steps);
    }
    
    return steps;
  }

  /**
   * Export to JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      type: this.type,
      status: this.status,
      dependencies: this.dependencies,
      inputs: this.inputs,
      outputs: this.outputs,
      estimatedDuration: this.estimatedDuration,
      result: this.result,
      steps: this.steps.map(step => step.toJSON()),
      actions: this.actions.map(action => action.toJSON())
    };
  }

  /**
   * Create from JSON
   * @param {Object} json - JSON data
   * @param {Array} allowableActions - Available action definitions
   * @returns {PlanStep} PlanStep instance
   */
  static fromJSON(json, allowableActions = []) {
    const step = new PlanStep(json, allowableActions);
    return step;
  }
}

export { PlanStep };