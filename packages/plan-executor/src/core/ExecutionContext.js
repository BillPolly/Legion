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
    
    // Initialize debugging state
    this.sessions = new Map(); // Active debugging sessions
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
      
      // Template variable substitution: ${VAR_NAME} within strings
      if (value.includes('${')) {
        return value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
          // First check plan input variables
          const inputValue = this.getVariable(varName);
          if (inputValue !== undefined) {
            return inputValue;
          }
          
          // Fallback to environment variables
          return process.env[varName] || match;
        });
      }
    }
    
    if (typeof value === 'object' && value !== null) {
      return this._resolveObject(value);
    }
    
    return value;
  }

  // Debugging Extensions

  // Session Management
  createSession() {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sessionState = {
      id: sessionId,
      createdAt: new Date(),
      isPaused: false,
      pausePoint: null,
      breakpoints: [],
      executionSnapshot: null,
      variableSnapshot: null
    };
    
    this.sessions.set(sessionId, sessionState);
    return sessionId;
  }

  hasSession(sessionId) {
    return this.sessions.has(sessionId);
  }

  getSessionState(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  destroySession(sessionId) {
    this.sessions.delete(sessionId);
  }

  getActiveSessions() {
    return Array.from(this.sessions.keys());
  }

  // Pause/Resume Functionality
  pauseExecution(sessionId, pausePoint = null) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isPaused = true;
      session.pausePoint = pausePoint || {
        timestamp: new Date(),
        reason: 'manual'
      };
    }
  }

  resumeExecution(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isPaused = false;
      session.pausePoint = null;
    }
  }

  isPaused(sessionId) {
    const session = this.sessions.get(sessionId);
    return session ? session.isPaused : false;
  }

  // Breakpoint Detection and Handling
  setBreakpoints(sessionId, breakpoints) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.breakpoints = [...breakpoints];
    }
  }

  isAtBreakpoint(sessionId, stepId) {
    const session = this.sessions.get(sessionId);
    return session ? session.breakpoints.includes(stepId) : false;
  }

  addBreakpoint(sessionId, stepId) {
    const session = this.sessions.get(sessionId);
    if (session && !session.breakpoints.includes(stepId)) {
      session.breakpoints.push(stepId);
    }
  }

  removeBreakpoint(sessionId, stepId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.breakpoints = session.breakpoints.filter(bp => bp !== stepId);
    }
  }

  // Variable State Capture and Inspection
  captureVariableSnapshot() {
    const snapshot = {
      global: Object.fromEntries(this.state.variables),
      stepScoped: this.executionStack.map(context => ({
        stepId: context.stepId,
        variables: Object.fromEntries(context.variables)
      }))
    };
    return snapshot;
  }

  captureExecutionSnapshot() {
    const snapshot = {
      executionStack: this.executionStack.map(context => ({
        stepId: context.stepId,
        step: context.step,
        startTime: context.startTime,
        variables: Object.fromEntries(context.variables)
      })),
      currentPath: [...this.currentPath],
      state: {
        status: this.state.status,
        completedSteps: [...this.state.completedSteps],
        failedSteps: [...this.state.failedSteps],
        skippedSteps: [...this.state.skippedSteps]
      }
    };
    return snapshot;
  }

  inspectSessionVariables(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    
    return this.captureVariableSnapshot();
  }

  // Session State Persistence
  persistSessionState(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.executionSnapshot = this.captureExecutionSnapshot();
      session.variableSnapshot = this.captureVariableSnapshot();
    }
  }

  restoreSessionState(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.executionSnapshot) return;

    const execSnapshot = session.executionSnapshot;
    const varSnapshot = session.variableSnapshot;

    // Restore execution stack
    this.executionStack = execSnapshot.executionStack.map(context => ({
      step: context.step,
      stepId: context.stepId,
      startTime: context.startTime,
      variables: new Map(Object.entries(context.variables))
    }));

    // Restore current path
    this.currentPath = [...execSnapshot.currentPath];

    // Restore state
    this.state.status = execSnapshot.state.status;
    this.state.completedSteps = [...execSnapshot.state.completedSteps];
    this.state.failedSteps = [...execSnapshot.state.failedSteps];
    this.state.skippedSteps = [...execSnapshot.state.skippedSteps];

    // Restore global variables
    this.state.variables = new Map(Object.entries(varSnapshot.global));
  }
}