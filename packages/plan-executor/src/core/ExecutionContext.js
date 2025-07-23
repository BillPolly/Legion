/**
 * ExecutionContext - Manages hierarchical execution state and context
 */

export class ExecutionContext {
  constructor(plan, options = {}) {
    this.plan = plan;
    this.options = options;
    
    // Initialize state
    this.state = {
      status: 'pending',
      completedSteps: [],
      failedSteps: [],
      skippedSteps: [],
      stepResults: new Map(),
      actionResults: new Map(),
      variables: new Map(),
      errors: new Map()
    };
    
    // Initialize hierarchical navigation
    this.executionStack = []; // Stack of step contexts
    this.currentPath = []; // Path from root to current position
  }
  
  // Hierarchical navigation methods
  enterStep(step) {
    const stepContext = {
      step: step,
      stepId: step.id,
      variables: new Map(), // Step-scoped variables
      startTime: new Date()
    };
    
    this.executionStack.push(stepContext);
    this.currentPath.push(step.id);
  }
  
  exitStep() {
    if (this.executionStack.length > 0) {
      this.executionStack.pop();
      this.currentPath.pop();
    }
  }
  
  getCurrentStep() {
    return this.executionStack.length > 0 
      ? this.executionStack[this.executionStack.length - 1].step 
      : null;
  }
  
  getParentStep() {
    return this.executionStack.length > 1 
      ? this.executionStack[this.executionStack.length - 2].step 
      : null;
  }
  
  getCurrentPath() {
    return this.currentPath.join('.');
  }
  
  getStepAtPath(path) {
    const pathParts = path.split('.');
    let current = { steps: this.plan.steps };
    
    for (const part of pathParts) {
      if (!current.steps) return null;
      current = current.steps.find(step => step.id === part);
      if (!current) return null;
    }
    
    return current;
  }
  
  // State management methods
  completeStep(stepId) {
    if (!this.state.completedSteps.includes(stepId)) {
      this.state.completedSteps.push(stepId);
    }
  }
  
  failStep(stepId, error) {
    if (!this.state.failedSteps.includes(stepId)) {
      this.state.failedSteps.push(stepId);
      this.state.errors.set(stepId, error);
    }
  }
  
  skipStep(stepId) {
    if (!this.state.skippedSteps.includes(stepId)) {
      this.state.skippedSteps.push(stepId);
    }
  }
  
  // Variable management with hierarchical scoping
  setVariable(name, value) {
    // Set variable in current step context
    if (this.executionStack.length > 0) {
      const currentContext = this.executionStack[this.executionStack.length - 1];
      currentContext.variables.set(name, value);
    } else {
      // Set in global context
      this.state.variables.set(name, value);
    }
  }
  
  getVariable(name) {
    // Search up the execution stack for the variable
    for (let i = this.executionStack.length - 1; i >= 0; i--) {
      const context = this.executionStack[i];
      if (context.variables.has(name)) {
        return context.variables.get(name);
      }
    }
    
    // Check global context
    return this.state.variables.get(name);
  }
  
  hasVariable(name) {
    // Search up the execution stack
    for (let i = this.executionStack.length - 1; i >= 0; i--) {
      const context = this.executionStack[i];
      if (context.variables.has(name)) {
        return true;
      }
    }
    
    return this.state.variables.has(name);
  }
  
  // Result management
  setStepResult(stepId, result) {
    this.state.stepResults.set(stepId, result);
  }
  
  getStepResult(stepId) {
    return this.state.stepResults.get(stepId);
  }
  
  setActionResult(stepId, actionType, result) {
    const key = `${stepId}.${actionType}`;
    this.state.actionResults.set(key, result);
  }
  
  getActionResult(stepId, actionType) {
    const key = `${stepId}.${actionType}`;
    return this.state.actionResults.get(key);
  }
  
  // Parameter resolution with variable substitution
  resolveParameters(parameters) {
    if (!parameters || typeof parameters !== 'object') {
      return parameters;
    }
    
    return this._resolveObject(parameters);
  }
  
  _resolveObject(obj) {
    if (Array.isArray(obj)) {
      return obj.map(item => this._resolveValue(item));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const resolved = {};
      for (const [key, value] of Object.entries(obj)) {
        resolved[key] = this._resolveValue(value);
      }
      return resolved;
    }
    
    return this._resolveValue(obj);
  }
  
  _resolveValue(value) {
    if (typeof value === 'string') {
      // Variable reference: $variableName
      if (value.startsWith('$') && !value.startsWith('${')) {
        const varName = value.substring(1);
        return this.getVariable(varName) || value;
      }
      
      // Step result reference: @stepId
      if (value.startsWith('@')) {
        const stepId = value.substring(1);
        return this.getStepResult(stepId) || value;
      }
      
      // Environment variable: ${ENV_VAR}
      const envMatch = value.match(/^\$\{([^}]+)\}$/);
      if (envMatch) {
        return process.env[envMatch[1]] || value;
      }
    }
    
    if (typeof value === 'object' && value !== null) {
      return this._resolveObject(value);
    }
    
    return value;
  }
}