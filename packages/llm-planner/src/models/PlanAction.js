/**
 * PlanAction model - Represents a user-provided action that can be executed
 * 
 * Actions are the atomic operations provided by the user in the allowableActions array.
 * The LLM can only use these specific actions to build a plan.
 */

class PlanAction {
  /**
   * Create a PlanAction from user-provided action definition
   * @param {Object} actionDef - Action definition from allowableActions
   * @param {Object} parameters - Specific parameters for this action instance
   */
  constructor(actionDef, parameters = {}) {
    if (!actionDef || !actionDef.type) {
      throw new Error('Action definition with type is required');
    }

    // Core properties from action definition
    this.type = actionDef.type;
    this.definedInputs = Array.isArray(actionDef.inputs) ? [...actionDef.inputs] : [];
    this.definedOutputs = Array.isArray(actionDef.outputs) ? [...actionDef.outputs] : [];
    
    // Instance-specific properties
    this.id = parameters.id || this._generateId();
    this.parameters = { ...parameters };
    this.status = 'pending';
    this.result = null;
    
    // Optional properties
    this.description = parameters.description || '';
    this.estimatedDuration = parameters.estimatedDuration || 0;
  }

  /**
   * Generate a unique action ID
   * @private
   */
  _generateId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `action-${timestamp}-${random}`;
  }

  /**
   * Get the inputs this action requires
   * @returns {Array<string>} Array of input names
   */
  getInputs() {
    return [...this.definedInputs];
  }

  /**
   * Get the outputs this action produces
   * @returns {Array<string>} Array of output names
   */
  getOutputs() {
    return [...this.definedOutputs];
  }

  /**
   * Check if this action's inputs are satisfied by available outputs
   * @param {Array<string>} availableOutputs - Outputs available from previous actions
   * @returns {Object} Validation result
   */
  validateInputs(availableOutputs = []) {
    const missingInputs = this.definedInputs.filter(input => !availableOutputs.includes(input));
    
    return {
      isValid: missingInputs.length === 0,
      missingInputs,
      satisfiedInputs: this.definedInputs.filter(input => availableOutputs.includes(input))
    };
  }

  /**
   * Update action status
   * @param {string} newStatus - New status ('pending', 'in-progress', 'completed', 'failed', 'skipped')
   */
  updateStatus(newStatus) {
    const validStatuses = ['pending', 'in-progress', 'completed', 'failed', 'skipped'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}`);
    }
    this.status = newStatus;
  }

  /**
   * Record execution result
   * @param {Object} result - Execution result
   */
  recordResult(result) {
    this.result = {
      ...result,
      timestamp: new Date().toISOString()
    };
    
    // Update status based on result
    if (result.success) {
      this.status = 'completed';
    } else {
      this.status = 'failed';
    }
  }

  /**
   * Export to JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      inputs: this.definedInputs,
      outputs: this.definedOutputs,
      parameters: this.parameters,
      status: this.status,
      result: this.result,
      description: this.description,
      estimatedDuration: this.estimatedDuration
    };
  }

  /**
   * Create from JSON
   * @param {Object} json - JSON data
   * @param {Array} allowableActions - Available action definitions
   * @returns {PlanAction} PlanAction instance
   */
  static fromJSON(json, allowableActions = []) {
    // Find the action definition
    const actionDef = allowableActions.find(a => a.type === json.type);
    if (!actionDef) {
      throw new Error(`Unknown action type: ${json.type}`);
    }

    const action = new PlanAction(actionDef, json.parameters);
    action.id = json.id;
    action.status = json.status || 'pending';
    action.result = json.result || null;
    action.description = json.description || '';
    action.estimatedDuration = json.estimatedDuration || 0;
    
    return action;
  }

  /**
   * Create action from user-provided definition
   * @param {Object} actionDef - Action definition from allowableActions
   * @param {Object} parameters - Parameters for this instance
   * @returns {PlanAction} Created action
   */
  static create(actionDef, parameters = {}) {
    return new PlanAction(actionDef, parameters);
  }
}

export { PlanAction };