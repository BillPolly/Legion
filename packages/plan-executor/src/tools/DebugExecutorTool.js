/**
 * DebugExecutorTool - Interactive debugging tool with breakpoint and inspection capabilities
 */

export class DebugExecutorTool {
  constructor(options = {}) {
    this.options = options;
    // Reference to global execution context registry (would be injected in real implementation)
    this._executionContextRegistry = options.executionContextRegistry || null;
  }

  get name() {
    return 'plan_debug';
  }
  
  get description() {
    return 'Interactive debugging tool with breakpoint and inspection capabilities';
  }
  
  get inputSchema() {
    return {
      type: 'object',
      properties: {
        plan: {
          description: 'The llm-planner Plan object to debug'
        },
        sessionId: {
          type: 'string',
          description: 'Session identifier for continuing debugging session'
        },
        action: {
          type: 'string',
          enum: ['continue', 'step', 'inspect', 'abort'],
          description: 'Debugging action to take'
        },
        breakpoints: {
          type: 'array',
          items: { type: 'string' },
          default: [],
          description: 'Array of step IDs where execution should pause'
        },
        conditionalBreakpoints: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              stepId: { type: 'string' },
              condition: { type: 'string' }
            }
          },
          default: [],
          description: 'Array of conditional breakpoints'
        },
        inspectVariables: {
          type: 'boolean',
          default: false,
          description: 'Whether to include variable state in responses'
        },
        traceExecution: {
          type: 'boolean',
          default: false,
          description: 'Whether to include detailed execution traces'
        }
      },
      required: ['plan']
    };
  }
  
  async execute(params) {
    try {
      const { 
        plan, 
        sessionId, 
        action,
        breakpoints = [], 
        conditionalBreakpoints = [],
        inspectVariables = false, 
        traceExecution = false 
      } = params;
      
      // Get the execution context
      const executionContext = this._getExecutionContext();
      if (!executionContext) {
        return {
          success: false,
          error: 'No execution context available'
        };
      }

      // Validate plan structure
      if (!this._validatePlan(plan)) {
        return {
          success: false,
          error: 'Invalid plan structure: plan must have id and steps array'
        };
      }

      // Handle debugging actions for existing sessions
      if (sessionId && action) {
        return await this._handleDebuggingAction(executionContext, plan, sessionId, action, params);
      }

      // Start new debugging session
      return await this._startDebuggingSession(executionContext, plan, {
        breakpoints,
        conditionalBreakpoints,
        inspectVariables,
        traceExecution
      });

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async _startDebuggingSession(executionContext, plan, options) {
    const { breakpoints, conditionalBreakpoints, inspectVariables, traceExecution } = options;
    
    // Create new debugging session
    const sessionId = executionContext.createSession();
    
    // Set up breakpoints
    executionContext.setBreakpoints(sessionId, breakpoints);
    
    // Store breakpoints and other options in session state for later retrieval
    const sessionState = executionContext.getSessionState(sessionId);
    if (sessionState) {
      sessionState.breakpoints = breakpoints;
      sessionState.conditionalBreakpoints = conditionalBreakpoints;
      sessionState.inspectVariables = inspectVariables;
      sessionState.traceExecution = traceExecution;
    }
    
    // Validate breakpoints exist in the plan
    const warnings = [];
    const allStepIds = this._getAllStepIds(plan);
    for (const bp of breakpoints) {
      if (!allStepIds.includes(bp)) {
        warnings.push(`Breakpoint ${bp} not found in plan`);
      }
    }

    // Initialize execution trace
    const executionTrace = {
      sessionId,
      startTime: new Date(),
      stepsExecuted: [],
      executionPath: [],
      hierarchicalPath: [],
      stackDepth: 0,
      timing: {}
    };

    // If no breakpoints, execute entire plan
    if (breakpoints.length === 0 && conditionalBreakpoints.length === 0) {
      const result = await this._executeCompleteplan(executionContext, plan, sessionId, {
        inspectVariables,
        traceExecution,
        executionTrace
      });
      
      // Clean up session
      executionContext.destroySession(sessionId);
      
      return {
        success: true,
        completed: true,
        pausedAtBreakpoint: false,
        sessionCleanedUp: true,
        executionTrace: result.executionTrace,
        warnings
      };
    }

    // Execute until first breakpoint
    const result = await this._executeUntilBreakpoint(executionContext, plan, sessionId, {
      breakpoints,
      conditionalBreakpoints,
      inspectVariables,
      traceExecution,
      executionTrace
    });

    return {
      success: true,
      sessionId,
      breakpoints,
      conditionalBreakpoints,
      ...result,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  async _handleDebuggingAction(executionContext, plan, sessionId, action, params) {
    if (!executionContext.hasSession(sessionId)) {
      return {
        success: false,
        error: `Session not found: ${sessionId}`
      };
    }

    const { inspectVariables = false, traceExecution = false } = params;

    switch (action) {
      case 'continue':
        return await this._handleContinue(executionContext, plan, sessionId, { inspectVariables, traceExecution });
      case 'step':
        return await this._handleStep(executionContext, plan, sessionId, { inspectVariables, traceExecution });
      case 'inspect':
        return await this._handleInspect(executionContext, plan, sessionId);
      case 'abort':
        return await this._handleAbort(executionContext, plan, sessionId);
      default:
        return {
          success: false,
          error: `Unknown debugging action: ${action}`
        };
    }
  }

  async _handleContinue(executionContext, plan, sessionId, options) {
    try {
      const session = executionContext.getSessionState(sessionId);
      if (!session) {
        return {
          success: false,
          error: `Session ${sessionId} not found`
        };
      }

      executionContext.resumeExecution(sessionId);

      // Continue execution until next breakpoint
      const result = await this._executeUntilBreakpoint(executionContext, plan, sessionId, {
        breakpoints: session.breakpoints,
        conditionalBreakpoints: session.conditionalBreakpoints || [],
        ...options,
        executionTrace: {
          stepsExecuted: [],
          executionPath: [],
          hierarchicalPath: [],
          timing: {},
          stackDepth: 0,
          ...(session.executionTrace || {})
        }
      });

      const finalResult = {
        success: true,
        sessionId,
        action: 'continue',
        resumed: true,
        ...result
      };

      // Add session state information
      if (result.pausedAtBreakpoint || result.completed) {
        finalResult.sessionState = {
          persistedVariables: executionContext.captureVariableSnapshot(),
          executionStack: executionContext.executionStack,
          currentPath: executionContext.currentPath
        };
      }

      return finalResult;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async _handleStep(executionContext, plan, sessionId, options) {
    // Execute single step
    const nextStep = this._getNextStep(executionContext, plan);
    
    if (!nextStep) {
      return {
        success: true,
        sessionId,
        action: 'step',
        completed: true,
        stepExecuted: false
      };
    }

    try {
      const stepResult = await this._executeSingleStep(nextStep);
      executionContext.enterStep(nextStep);
      executionContext.setStepResult(nextStep.id, stepResult);
      executionContext.completeStep(nextStep.id);

      // Pause after single step
      executionContext.pauseExecution(sessionId, {
        reason: 'single_step',
        stepId: nextStep.id,
        timestamp: new Date()
      });

      const result = {
        success: true,
        sessionId,
        action: 'step',
        stepExecuted: true,
        executedStep: nextStep,
        stepResult,
        nextPausePoint: {
          stepId: nextStep.id,
          reason: 'single_step'
        }
      };

      if (options.inspectVariables) {
        result.variableInspection = this._captureVariableInspection(executionContext);
      }

      return result;

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async _handleInspect(executionContext, plan, sessionId) {
    return {
      success: true,
      sessionId,
      action: 'inspect',
      variableInspection: this._captureVariableInspection(executionContext),
      executionContext: {
        currentPath: executionContext.currentPath,
        executionStack: executionContext.executionStack.map(ctx => ({
          stepId: ctx.stepId,
          step: ctx.step,
          startTime: ctx.startTime
        }))
      }
    };
  }

  async _handleAbort(executionContext, plan, sessionId) {
    executionContext.destroySession(sessionId);
    
    return {
      success: true,
      sessionId,
      action: 'abort',
      aborted: true
    };
  }

  async _executeUntilBreakpoint(executionContext, plan, sessionId, options) {
    const { breakpoints, conditionalBreakpoints, inspectVariables, traceExecution, executionTrace } = options;
    
    let currentStep = this._getNextStep(executionContext, plan);
    let previousVariableSnapshot = executionContext.captureVariableSnapshot();
    
    while (currentStep) {
      const stepStartTime = Date.now();
      
      // Execute the step
      try {
        const stepResult = await this._executeSingleStep(currentStep);
        executionContext.enterStep(currentStep);
        executionContext.setStepResult(currentStep.id, stepResult);
        
        // Set variables from step result if available
        if (stepResult.variables) {
          for (const [varName, varValue] of Object.entries(stepResult.variables)) {
            executionContext.setVariable(varName, varValue);
          }
        }
        
        executionContext.completeStep(currentStep.id);

        // Update execution trace for all executed steps
        this._updateExecutionTrace(executionTrace, currentStep, stepStartTime, traceExecution);

        // Check for regular breakpoints AFTER executing (so variables are available)
        if (breakpoints.includes(currentStep.id)) {
          executionContext.pauseExecution(sessionId, {
            reason: 'breakpoint',
            stepId: currentStep.id,
            timestamp: new Date()
          });

          const result = {
            pausedAtBreakpoint: true,
            currentBreakpoint: currentStep.id,
            breakpointReason: 'regular',
            executionTrace
          };

          if (inspectVariables) {
            const currentSnapshot = executionContext.captureVariableSnapshot();
            result.variableInspection = this._captureVariableInspection(executionContext);
            result.variableChanges = this._calculateVariableChanges(previousVariableSnapshot, currentSnapshot);
            result.executionContext = {
              currentPath: executionContext.currentPath,
              executionStack: executionContext.executionStack.map(ctx => ({
                stepId: ctx.stepId,
                step: ctx.step,
                startTime: ctx.startTime
              }))
            };
          }

          return result;
        }

        // Check for conditional breakpoints after execution
        for (const conditionalBp of conditionalBreakpoints) {
          if (conditionalBp.stepId === currentStep.id) {
            const conditionResult = this._evaluateCondition(conditionalBp.condition, {
              result: stepResult,
              variables: executionContext.captureVariableSnapshot()
            });

            if (conditionResult) {
              executionContext.pauseExecution(sessionId, {
                reason: 'conditional_breakpoint',
                stepId: currentStep.id,
                condition: conditionalBp.condition,
                timestamp: new Date()
              });

              const result = {
                pausedAtBreakpoint: true,
                currentBreakpoint: currentStep.id,
                breakpointReason: 'conditional',
                conditionResult: true,
                executionTrace
              };

              if (inspectVariables) {
                const currentSnapshot = executionContext.captureVariableSnapshot();
                result.variableInspection = this._captureVariableInspection(executionContext);
                result.variableChanges = this._calculateVariableChanges(previousVariableSnapshot, currentSnapshot);
                result.executionContext = {
                  currentPath: executionContext.currentPath,
                  executionStack: executionContext.executionStack.map(ctx => ({
                    stepId: ctx.stepId,
                    step: ctx.step,
                    startTime: ctx.startTime
                  }))
                };
              }

              return result;
            }
          }
        }

        // Update hierarchical path for tracing
        if (traceExecution) {
          this._updateHierarchicalPath(executionTrace, currentStep, executionContext);
        }

        // Move to next step
        currentStep = this._getNextStep(executionContext, plan);
        
      } catch (error) {
        throw error;
      }
    }

    // No more steps - execution completed
    return {
      completed: true,
      pausedAtBreakpoint: false,
      executionTrace
    };
  }

  async _executeCompleteplan(executionContext, plan, sessionId, options) {
    const { executionTrace, traceExecution } = options;
    
    let currentStep = this._getNextStep(executionContext, plan);
    
    while (currentStep) {
      const stepStartTime = Date.now();
      
      try {
        const stepResult = await this._executeSingleStep(currentStep);
        executionContext.enterStep(currentStep);
        executionContext.setStepResult(currentStep.id, stepResult);
        
        // Set variables from step result if available
        if (stepResult.variables) {
          for (const [varName, varValue] of Object.entries(stepResult.variables)) {
            executionContext.setVariable(varName, varValue);
          }
        }
        
        executionContext.completeStep(currentStep.id);

        // Update execution trace
        this._updateExecutionTrace(executionTrace, currentStep, stepStartTime, traceExecution);
        
        currentStep = this._getNextStep(executionContext, plan);
        
      } catch (error) {
        throw error;
      }
    }

    executionTrace.endTime = new Date();
    return { executionTrace };
  }

  _getNextStep(executionContext, plan) {
    const completedSteps = executionContext.state.completedSteps;
    
    // Recursively find the next executable step (one with actions)
    const findNextExecutableStep = (steps) => {
      for (const step of steps) {
        if (!completedSteps.includes(step.id)) {
          // If step has substeps, recurse into them first
          if (step.steps && step.steps.length > 0) {
            const nextSubStep = findNextExecutableStep(step.steps);
            if (nextSubStep) {
              return nextSubStep;
            }
            // If no executable substeps found and step has no actions, mark as complete
            if (!step.actions || step.actions.length === 0) {
              executionContext.completeStep(step.id);
              continue; // Continue to next sibling
            }
          }
          
          // Return step only if it has actions (is executable)
          if (step.actions && step.actions.length > 0) {
            return step;
          }
        }
      }
      return null;
    };
    
    return findNextExecutableStep(plan.steps);
  }

  _getAllStepIds(plan) {
    const stepIds = [];
    
    const collectIds = (steps) => {
      for (const step of steps) {
        stepIds.push(step.id);
        if (step.steps) {
          collectIds(step.steps);
        }
      }
    };
    
    collectIds(plan.steps);
    return stepIds;
  }

  _captureVariableInspection(executionContext) {
    const snapshot = executionContext.captureVariableSnapshot();
    
    // Flatten for easier access
    const flattened = { ...snapshot.global };
    
    // Add step-scoped variables
    for (const stepScope of snapshot.stepScoped) {
      Object.assign(flattened, stepScope.variables);
    }
    
    return {
      global: snapshot.global,
      stepScoped: snapshot.stepScoped,
      ...flattened
    };
  }

  _calculateVariableChanges(previous, current) {
    const changes = {
      added: [],
      modified: [],
      removed: []
    };

    // Flatten both snapshots for comparison
    const flattenSnapshot = (snapshot) => {
      const flat = { ...snapshot.global };
      for (const stepScope of snapshot.stepScoped) {
        Object.assign(flat, stepScope.variables);
      }
      return flat;
    };

    const prevFlat = flattenSnapshot(previous);
    const currFlat = flattenSnapshot(current);

    // Find added and modified variables
    for (const [key, value] of Object.entries(currFlat)) {
      if (!(key in prevFlat)) {
        changes.added.push(key);
      } else if (prevFlat[key] !== value) {
        changes.modified.push(key);
      }
    }

    // Find removed variables
    for (const key of Object.keys(prevFlat)) {
      if (!(key in currFlat)) {
        changes.removed.push(key);
      }
    }

    return changes;
  }

  _updateExecutionTrace(trace, step, startTime, includeDetailed = false) {
    const duration = Math.max(1, Date.now() - startTime); // Ensure minimum 1ms duration
    
    // Ensure trace has required arrays
    trace.stepsExecuted = trace.stepsExecuted || [];
    trace.executionPath = trace.executionPath || [];
    trace.timing = trace.timing || {};
    
    trace.stepsExecuted.push(step.id);
    trace.executionPath.push({
      stepId: step.id,
      timestamp: new Date(),
      duration
    });
    
    trace.timing[step.id] = {
      startTime: new Date(startTime),
      duration
    };

    if (includeDetailed) {
      trace.detailed = trace.detailed || [];
      trace.detailed.push({
        step,
        executionTime: duration,
        timestamp: new Date()
      });
    }

    return trace;
  }

  _updateHierarchicalPath(trace, step, executionContext) {
    // Track the hierarchical path to this step
    const pathParts = step.id.split('.');
    trace.hierarchicalPath = trace.hierarchicalPath || [];
    
    // Add parent steps to hierarchical path if they're not already there
    let currentPath = '';
    for (let i = 0; i < pathParts.length; i++) {
      if (i === 0) {
        currentPath = pathParts[i];
      } else {
        currentPath += '.' + pathParts[i];
      }
      
      if (!trace.hierarchicalPath.includes(currentPath)) {
        trace.hierarchicalPath.push(currentPath);
      }
    }
    
    trace.stackDepth = Math.max(trace.stackDepth || 0, executionContext.executionStack.length);
  }

  _evaluateCondition(condition, context) {
    try {
      // Simple condition evaluation - in production this would be more sophisticated
      const { result, variables } = context;
      
      // Replace variables.X with actual variable values
      let evaluatedCondition = condition;
      const variableMatches = condition.match(/variables\.(\w+)/g);
      if (variableMatches) {
        for (const match of variableMatches) {
          const varName = match.replace('variables.', '');
          const flatVars = { ...variables.global };
          for (const stepScope of variables.stepScoped) {
            Object.assign(flatVars, stepScope.variables);
          }
          const varValue = flatVars[varName];
          evaluatedCondition = evaluatedCondition.replace(match, JSON.stringify(varValue));
        }
      }

      // Replace result.X with actual result values
      const resultMatches = condition.match(/result\.(\w+)/g);
      if (resultMatches) {
        for (const match of resultMatches) {
          const propName = match.replace('result.', '');
          const propValue = result && result[propName];
          evaluatedCondition = evaluatedCondition.replace(match, JSON.stringify(propValue));
        }
      }

      // Simple evaluation - would use a proper expression evaluator in production
      return eval(evaluatedCondition);
    } catch (error) {
      return false;
    }
  }

  _validatePlan(plan) {
    return plan && 
           typeof plan === 'object' && 
           plan.id && 
           Array.isArray(plan.steps);
  }

  // Mock implementation for step execution - would be replaced with real execution logic
  async _executeSingleStep(step) {
    // This is a mock implementation
    // In real usage, this would execute the step's actions using the appropriate tools
    return {
      success: true,
      stepId: step.id,
      result: `Executed ${step.id}`,
      variables: { [`${step.id}_result`]: `result_${step.id}` }
    };
  }

  // This method would be replaced by proper dependency injection in the real implementation
  _getExecutionContext() {
    return this._executionContextRegistry;
  }
}