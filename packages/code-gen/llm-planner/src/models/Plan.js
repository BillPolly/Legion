/**
 * Plan model - Represents a structured execution plan
 */

class Plan {
  constructor(data = {}) {
    // Generate ID if not provided
    this.id = data.id || this._generateId();
    
    // Required fields
    this.name = data.name || '';
    this.description = data.description || '';
    
    // Version control
    this.version = data.version || '1.0.0';
    
    // Metadata with defaults
    this.metadata = {
      createdAt: data.metadata?.createdAt || new Date().toISOString(),
      createdBy: data.metadata?.createdBy || 'LLMPlanner',
      estimatedDuration: data.metadata?.estimatedDuration,
      complexity: data.metadata?.complexity || 'unknown',
      ...data.metadata
    };
    
    // Context information
    this.context = data.context || {};
    
    // Plan components
    this.steps = data.steps || [];
    this.executionOrder = data.executionOrder || [];
    this.successCriteria = data.successCriteria || [];
  }

  /**
   * Generate a unique plan ID
   * @private
   */
  _generateId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `plan-${timestamp}-${random}`;
  }

  /**
   * Add a step to the plan
   * @param {Object} step - Step to add
   */
  addStep(step) {
    this.steps.push(step);
  }

  /**
   * Remove a step from the plan
   * @param {string} stepId - ID of step to remove
   */
  removeStep(stepId) {
    this.steps = this.steps.filter(step => step.id !== stepId);
    this.executionOrder = this.executionOrder.filter(id => id !== stepId);
  }

  /**
   * Get a step by ID
   * @param {string} stepId - Step ID
   * @returns {Object|undefined} The step or undefined
   */
  getStep(stepId) {
    return this.steps.find(step => step.id === stepId);
  }

  /**
   * Alias for getStep for compatibility
   * @param {string} stepId - Step ID
   * @returns {Object|undefined} The step or undefined
   */
  getStepById(stepId) {
    return this.getStep(stepId);
  }

  /**
   * Update execution order
   * @param {Array<string>} newOrder - New execution order
   */
  updateExecutionOrder(newOrder) {
    this.executionOrder = newOrder;
  }

  /**
   * Validate plan structure
   * @returns {Object} Validation result
   */
  validate() {
    const errors = [];
    
    // Check required fields
    if (!this.name) {
      errors.push('Plan name is required');
    }
    
    // Validate step dependencies
    const stepIds = new Set(this.steps.map(step => step.id));
    
    for (const step of this.steps) {
      if (step.dependencies) {
        for (const dep of step.dependencies) {
          if (!stepIds.has(dep)) {
            errors.push(`Step ${step.id} depends on non-existent step: ${dep}`);
          }
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculate total estimated duration
   * @returns {number} Total duration in minutes
   */
  getTotalDuration() {
    return this.steps.reduce((total, step) => {
      return total + (step.estimatedDuration || 0);
    }, 0);
  }

  /**
   * Get steps by type
   * @param {string} type - Step type
   * @returns {Array} Steps of the specified type
   */
  getStepsByType(type) {
    return this.steps.filter(step => step.type === type);
  }

  /**
   * Clone the plan with a new ID
   * @returns {Plan} Cloned plan
   */
  clone() {
    const clonedData = JSON.parse(JSON.stringify({
      name: this.name,
      version: this.version,
      metadata: this.metadata,
      context: this.context,
      steps: this.steps,
      executionOrder: this.executionOrder,
      successCriteria: this.successCriteria
    }));
    
    return new Plan(clonedData);
  }

  /**
   * Export to JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      metadata: this.metadata,
      context: this.context,
      steps: this.steps,
      executionOrder: this.executionOrder,
      successCriteria: this.successCriteria
    };
  }

  /**
   * Create from JSON
   * @param {Object} json - JSON data
   * @returns {Plan} Plan instance
   */
  static fromJSON(json) {
    return new Plan(json);
  }

  /**
   * Check for circular dependencies
   * @returns {boolean} True if circular dependencies exist
   */
  hasCircularDependencies() {
    const visited = new Set();
    const recursionStack = new Set();
    
    const hasCycle = (stepId) => {
      visited.add(stepId);
      recursionStack.add(stepId);
      
      const step = this.getStep(stepId);
      if (step && step.dependencies) {
        for (const dep of step.dependencies) {
          if (!visited.has(dep)) {
            if (hasCycle(dep)) {
              return true;
            }
          } else if (recursionStack.has(dep)) {
            return true;
          }
        }
      }
      
      recursionStack.delete(stepId);
      return false;
    };
    
    for (const step of this.steps) {
      if (!visited.has(step.id)) {
        if (hasCycle(step.id)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Generate execution order based on dependencies
   * @returns {Array<string>} Execution order
   */
  generateExecutionOrder() {
    const visited = new Set();
    const order = [];
    
    const visit = (stepId) => {
      if (visited.has(stepId)) {
        return;
      }
      
      const step = this.getStep(stepId);
      if (step && step.dependencies) {
        for (const dep of step.dependencies) {
          visit(dep);
        }
      }
      
      visited.add(stepId);
      order.push(stepId);
    };
    
    // Visit all steps
    for (const step of this.steps) {
      visit(step.id);
    }
    
    return order;
  }

  /**
   * Get parallel execution groups
   * @returns {Array<Array<string>>} Groups of steps that can run in parallel
   */
  getParallelExecutionGroups() {
    const groups = [];
    const completed = new Set();
    const remaining = new Set(this.steps.map(s => s.id));
    
    while (remaining.size > 0) {
      const group = [];
      
      for (const stepId of remaining) {
        const step = this.getStep(stepId);
        const canExecute = !step.dependencies || 
          step.dependencies.every(dep => completed.has(dep));
        
        if (canExecute) {
          group.push(stepId);
        }
      }
      
      if (group.length === 0) {
        // No progress can be made - might have circular dependencies
        break;
      }
      
      groups.push(group);
      group.forEach(id => {
        completed.add(id);
        remaining.delete(id);
      });
    }
    
    return groups;
  }
}

export { Plan };