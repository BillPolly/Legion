/**
 * PlanStep model - Represents an individual step in a plan
 */

class PlanStep {
  // Static valid types
  static VALID_TYPES = ['setup', 'implementation', 'integration', 'testing', 'validation', 'deployment'];
  
  constructor(data = {}) {
    // Generate ID if not provided
    this.id = data.id || this._generateId();
    
    // Required fields
    this.name = data.name || '';
    this.description = data.description || '';
    
    // Step type validation
    this.type = data.type || 'implementation';
    if (!PlanStep.VALID_TYPES.includes(this.type)) {
      throw new Error(`Invalid step type: ${this.type}`);
    }
    
    // Status validation
    const validStatuses = ['pending', 'in-progress', 'completed', 'failed', 'skipped'];
    this.status = data.status || 'pending';
    if (!validStatuses.includes(this.status)) {
      throw new Error(`Invalid status: ${this.status}`);
    }
    
    // Dependencies and workflow
    this.dependencies = data.dependencies || [];
    this.inputs = data.inputs || {};
    this.outputs = data.outputs || {};
    this.actions = data.actions || [];
    
    // Validation and rollback
    this.validation = data.validation || { criteria: [], validators: [] };
    this.rollback = data.rollback || { actions: [] };
    
    // Execution properties
    this.estimatedDuration = data.estimatedDuration || 0;
    this.retryable = data.retryable !== undefined ? data.retryable : true;
    this.maxRetries = data.maxRetries || 3;
    
    // Internal tracking
    this._statusHistory = [{ status: this.status, timestamp: new Date().toISOString() }];
    this._executionAttempts = [];
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
   * Update step status
   * @param {string} newStatus - New status
   */
  updateStatus(newStatus) {
    const validStatuses = ['pending', 'in-progress', 'completed', 'failed', 'skipped'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}`);
    }
    
    this.status = newStatus;
    this._statusHistory.push({
      status: newStatus,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get status history
   * @returns {Array} Status history
   */
  getStatusHistory() {
    return [...this._statusHistory];
  }

  /**
   * Add a dependency
   * @param {string} stepId - Step ID to depend on
   */
  addDependency(stepId) {
    if (!this.dependencies.includes(stepId)) {
      this.dependencies.push(stepId);
    }
  }

  /**
   * Remove a dependency
   * @param {string} stepId - Step ID to remove
   */
  removeDependency(stepId) {
    this.dependencies = this.dependencies.filter(id => id !== stepId);
  }

  /**
   * Add an action
   * @param {Object} action - Action to add
   */
  addAction(action) {
    this.actions.push(action);
  }

  /**
   * Validate step structure
   * @returns {Object} Validation result
   */
  validate() {
    const errors = [];
    
    // Check required fields
    if (!this.name) {
      errors.push('Step name is required');
    }
    
    // Validate actions
    for (const action of this.actions) {
      if (!action.type) {
        errors.push('Action type is required');
        continue;
      }
      
      // Validate based on action type
      switch (action.type) {
        case 'create-directory':
          if (!action.path) {
            errors.push(`Action of type ${action.type} is missing required field: path`);
          }
          break;
        case 'create-file':
          if (!action.path) {
            errors.push(`Action of type ${action.type} is missing required field: path`);
          }
          break;
        case 'run-command':
          if (!action.command) {
            errors.push(`Action of type ${action.type} is missing required field: command`);
          }
          break;
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if step can be executed
   * @param {Array<string>} completedSteps - List of completed step IDs
   * @returns {boolean} Can execute
   */
  canExecute(completedSteps) {
    return this.dependencies.every(dep => completedSteps.includes(dep));
  }

  /**
   * Get completion percentage based on completed actions
   * @returns {number} Percentage (0-100)
   */
  getCompletionPercentage() {
    if (this.actions.length === 0) {
      return this.status === 'completed' ? 100 : 0;
    }
    
    const completedActions = this.actions.filter(action => action.completed === true).length;
    return Math.round((completedActions / this.actions.length) * 100);
  }

  /**
   * Clone the step with a new ID
   * @returns {PlanStep} Cloned step
   */
  clone() {
    const clonedData = JSON.parse(JSON.stringify({
      name: this.name,
      description: this.description,
      type: this.type,
      status: 'pending', // Reset status
      dependencies: this.dependencies,
      inputs: this.inputs,
      outputs: this.outputs,
      actions: this.actions,
      validation: this.validation,
      rollback: this.rollback,
      estimatedDuration: this.estimatedDuration,
      retryable: this.retryable,
      maxRetries: this.maxRetries
    }));
    
    return new PlanStep(clonedData);
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
      actions: this.actions,
      validation: this.validation,
      rollback: this.rollback,
      estimatedDuration: this.estimatedDuration,
      retryable: this.retryable,
      maxRetries: this.maxRetries,
      statusHistory: this._statusHistory,
      executionAttempts: this._executionAttempts
    };
  }

  /**
   * Create from JSON
   * @param {Object} json - JSON data
   * @returns {PlanStep} PlanStep instance
   */
  static fromJSON(json) {
    const step = new PlanStep(json);
    
    // Restore history if available
    if (json.statusHistory) {
      step._statusHistory = json.statusHistory;
    }
    if (json.executionAttempts) {
      step._executionAttempts = json.executionAttempts;
    }
    
    return step;
  }

  /**
   * Record an execution attempt
   * @param {Object} attempt - Attempt details
   */
  recordExecutionAttempt(attempt) {
    this._executionAttempts.push({
      ...attempt,
      timestamp: new Date().toISOString(),
      attemptNumber: this._executionAttempts.length + 1
    });
  }

  /**
   * Get execution attempts
   * @returns {Array} Execution attempts
   */
  getExecutionAttempts() {
    return [...this._executionAttempts];
  }

  /**
   * Check if max retries exceeded
   * @returns {boolean} Exceeded
   */
  hasExceededMaxRetries() {
    if (!this.retryable) {
      return this._executionAttempts.length > 0 && 
             this._executionAttempts.some(a => !a.success);
    }
    
    const failedAttempts = this._executionAttempts.filter(a => !a.success).length;
    return failedAttempts >= this.maxRetries;
  }

  /**
   * Merge outputs with existing outputs
   * @param {Object} newOutputs - Outputs to merge
   */
  mergeOutputs(newOutputs) {
    for (const [key, value] of Object.entries(newOutputs)) {
      if (Array.isArray(this.outputs[key]) && Array.isArray(value)) {
        // Merge arrays
        this.outputs[key] = [...this.outputs[key], ...value];
      } else if (typeof this.outputs[key] === 'object' && typeof value === 'object') {
        // Merge objects
        this.outputs[key] = { ...this.outputs[key], ...value };
      } else {
        // Replace value
        this.outputs[key] = value;
      }
    }
  }

  /**
   * Check if a step type is valid
   * @param {string} type - Type to check
   * @returns {boolean} Is valid
   */
  static isValidType(type) {
    return PlanStep.VALID_TYPES.includes(type);
  }
}

export { PlanStep };