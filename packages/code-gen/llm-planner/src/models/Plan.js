/**
 * Plan model - Represents a structured execution plan
 * 
 * Plans contain hierarchical steps that can have sub-steps or actions.
 * Actions are atomic operations from the user-provided allowableActions.
 */

import { PlanStep } from './PlanStep.js';
import { PlanAction } from './PlanAction.js';

class Plan {
  constructor(data = {}, allowableActions = []) {
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
      createdBy: data.metadata?.createdBy || 'GenericPlanner',
      estimatedDuration: data.metadata?.estimatedDuration,
      complexity: data.metadata?.complexity || 'unknown',
      ...data.metadata
    };
    
    // Context information
    this.context = data.context || {};
    
    // Plan components
    this.steps = [];
    this.executionOrder = data.executionOrder || [];
    this.successCriteria = data.successCriteria || [];
    
    // Input/Output tracking
    this.inputs = Array.isArray(data.inputs) ? [...data.inputs] : [];
    this.requiredOutputs = Array.isArray(data.requiredOutputs) ? [...data.requiredOutputs] : [];
    
    // Store allowable actions for validation
    this.allowableActions = allowableActions;
    
    // Initialize steps if provided
    if (data.steps && Array.isArray(data.steps)) {
      for (const stepData of data.steps) {
        this.addStep(new PlanStep(stepData, allowableActions));
      }
    }
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
   * @param {PlanStep} step - Step to add
   */
  addStep(step) {
    if (!(step instanceof PlanStep)) {
      throw new Error('Must be a PlanStep instance');
    }
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
      description: this.description,
      version: this.version,
      metadata: this.metadata,
      context: this.context,
      inputs: this.inputs,
      requiredOutputs: this.requiredOutputs,
      steps: this.steps.map(step => step.toJSON()),
      executionOrder: this.executionOrder,
      successCriteria: this.successCriteria
    };
  }

  /**
   * Create from JSON
   * @param {Object} json - JSON data
   * @param {Array} allowableActions - Available action definitions
   * @returns {Plan} Plan instance
   */
  static fromJSON(json, allowableActions = []) {
    const plan = new Plan(json, allowableActions);
    return plan;
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
   * Validate input/output flow of the plan
   * @returns {Object} Validation result
   */
  validateInputOutputFlow() {
    const errors = [];
    const warnings = [];
    
    // Track all available outputs (starting with plan inputs)
    const availableOutputs = [...this.inputs];
    
    // Check each step in execution order
    const executionOrder = this.executionOrder.length > 0 ? this.executionOrder : this.generateExecutionOrder();
    
    for (const stepId of executionOrder) {
      const step = this.getStep(stepId);
      if (!step) continue;
      
      // Validate step inputs
      const stepInputValidation = step.validateInputs(availableOutputs);
      if (!stepInputValidation.isValid) {
        errors.push(`Step '${step.name}' (${stepId}) missing required inputs: ${stepInputValidation.missingInputs.join(', ')}`);
      }
      
      // Add step outputs to available outputs
      const stepOutputs = step.getOutputs();
      for (const output of stepOutputs) {
        if (!availableOutputs.includes(output)) {
          availableOutputs.push(output);
        }
      }
    }
    
    // Check if all required outputs are produced
    const missingOutputs = this.requiredOutputs.filter(output => !availableOutputs.includes(output));
    if (missingOutputs.length > 0) {
      errors.push(`Plan does not produce required outputs: ${missingOutputs.join(', ')}`);
    }
    
    // Check for unused outputs
    const producedOutputs = this.steps.flatMap(step => step.getOutputs());
    const usedOutputs = this.steps.flatMap(step => step.getInputs());
    const unusedOutputs = producedOutputs.filter(output => 
      !usedOutputs.includes(output) && !this.requiredOutputs.includes(output)
    );
    if (unusedOutputs.length > 0) {
      warnings.push(`Unused outputs: ${unusedOutputs.join(', ')}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      availableOutputs,
      missingOutputs,
      unusedOutputs
    };
  }

  /**
   * Get all inputs required by the plan
   * @returns {Array<string>} Array of input names
   */
  getInputs() {
    return [...this.inputs];
  }

  /**
   * Get all required outputs of the plan
   * @returns {Array<string>} Array of output names
   */
  getRequiredOutputs() {
    return [...this.requiredOutputs];
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