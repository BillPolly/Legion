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
    
    // Preserve tool and function mapping if present (needed for execution)
    if (actionDef.tool) {
      this.tool = actionDef.tool;
    }
    if (actionDef.function) {
      this.function = actionDef.function;
    }
    
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
    // Check which inputs are satisfied by either:
    // 1. Available outputs from previous steps
    // 2. Parameters provided to this action
    const providedParameters = Object.keys(this.parameters || {});
    const allAvailableInputs = [...availableOutputs, ...providedParameters];
    
    const missingInputs = this.definedInputs.filter(input => !allAvailableInputs.includes(input));
    
    return {
      isValid: missingInputs.length === 0,
      missingInputs,
      satisfiedInputs: this.definedInputs.filter(input => allAvailableInputs.includes(input))
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
    const json = {
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
    
    // Include tool and function if present
    if (this.tool) {
      json.tool = this.tool;
    }
    if (this.function) {
      json.function = this.function;
    }
    
    return json;
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

    // Merge json tool/function into actionDef if not already present
    const mergedActionDef = { ...actionDef };
    if (json.tool && !mergedActionDef.tool) {
      mergedActionDef.tool = json.tool;
    }
    if (json.function && !mergedActionDef.function) {
      mergedActionDef.function = json.function;
    }
    
    const action = new PlanAction(mergedActionDef, json.parameters);
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