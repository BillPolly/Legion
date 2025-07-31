/**
 * StepExecutorTool - Manual progression execution tool for debugging
 */

import { Tool } from '@legion/module-loader';
import { z } from 'zod';

export class StepExecutorTool extends Tool {
  constructor(options = {}) {
    super({
      name: 'plan_execute_step',
      description: 'Execute plan step-by-step with manual progression control',
      inputSchema: z.object({
        plan: z.any().describe('The llm-planner Plan object to execute step-by-step'),
        sessionId: z.string().optional().describe('Session identifier for resuming existing executions'),
        action: z.enum(['start', 'next', 'pause', 'resume', 'abort']).describe('Action to take: start, next, pause, resume, or abort'),
        options: z.object({}).passthrough().optional().describe('Execution options (emitProgress, timeout, includeContext, etc.)')
      })
    });
    this.options = options;
    // Reference to global execution context registry (would be injected in real implementation)
    this._executionContextRegistry = options.executionContextRegistry || null;
  }
  
  async execute(params) {
    try {
      const { plan, sessionId, action, options = {} } = params;
      
      // Get the execution context
      const executionContext = this._getExecutionContext();
      if (!executionContext) {
        return {
          success: false,
          error: 'No execution context available'
        };
      }

      // Validate action
      const validActions = ['start', 'next', 'pause', 'resume', 'abort'];
      if (!validActions.includes(action)) {
        return {
          success: false,
          error: `Invalid action: ${action}. Must be one of: ${validActions.join(', ')}`
        };
      }

      // Validate plan structure
      if (!this._validatePlan(plan)) {
        return {
          success: false,
          error: 'Invalid plan structure: plan must have id and steps array'
        };
      }

      // Handle different actions
      switch (action) {
        case 'start':
          return await this._handleStart(executionContext, plan, sessionId, options);
        case 'next':
          return await this._handleNext(executionContext, plan, sessionId, options);
        case 'pause':
          return await this._handlePause(executionContext, plan, sessionId, options);
        case 'resume':
          return await this._handleResume(executionContext, plan, sessionId, options);
        case 'abort':
          return await this._handleAbort(executionContext, plan, sessionId, options);
        default:
          return {
            success: false,
            error: `Unhandled action: ${action}`
          };
      }

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async _handleStart(executionContext, plan, sessionId, options) {
    let actualSessionId = sessionId;
    let sessionCreated = false;

    // Create new session if not provided
    if (!actualSessionId) {
      actualSessionId = executionContext.createSession();
      sessionCreated = true;
    }

    // Verify session exists
    if (!executionContext.hasSession(actualSessionId)) {
      actualSessionId = executionContext.createSession();
      sessionCreated = true;
    }

    // Initialize execution context for the plan
    executionContext.plan = plan;
    
    // Execute first step
    const firstStep = this._getFirstStep(plan);
    if (!firstStep) {
      return {
        success: true,
        sessionId: actualSessionId,
        sessionCreated,
        completed: true,
        currentStep: null,
        stepExecuted: false,
        executionState: 'completed',
        options
      };
    }

    // Execute the first step
    try {
      const stepResult = await this._executeSingleStep(firstStep);
      executionContext.enterStep(firstStep);
      executionContext.setStepResult(firstStep.id, stepResult);
      executionContext.completeStep(firstStep.id);

      // Pause after execution for manual progression
      executionContext.pauseExecution(actualSessionId, {
        reason: 'step_completion',
        stepId: firstStep.id,
        timestamp: new Date()
      });

      return {
        success: true,
        sessionId: actualSessionId,
        sessionCreated,
        currentStep: firstStep,
        stepExecuted: true,
        stepResult,
        executionState: 'paused',
        sessionContext: this._getSessionContext(executionContext),
        progressInfo: this._getProgressInfo(executionContext, plan),
        options
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async _handleNext(executionContext, plan, sessionId, options) {
    if (!sessionId || !executionContext.hasSession(sessionId)) {
      return {
        success: false,
        error: `Session not found: ${sessionId}`
      };
    }

    // Get previous step result before getting next step
    const completedSteps = executionContext.state.completedSteps;
    const lastCompletedStep = completedSteps[completedSteps.length - 1];
    const previousStepResult = lastCompletedStep ? executionContext.getStepResult(lastCompletedStep) : null;

    // Get next step to execute
    const nextStep = this._getNextStep(executionContext, plan);
    
    if (!nextStep) {
      // All steps completed
      return {
        success: true,
        sessionId,
        sessionCreated: false,
        completed: true,
        currentStep: null,
        stepExecuted: false,
        executionState: 'completed',
        sessionContext: this._getSessionContext(executionContext),
        progressInfo: this._getProgressInfo(executionContext, plan),
        options
      };
    }

    // Check if this is hierarchical execution
    const hierarchicalExecution = nextStep.id.includes('.');

    try {
      // Execute the next step
      const stepResult = await this._executeSingleStep(nextStep);
      
      executionContext.enterStep(nextStep);
      executionContext.setStepResult(nextStep.id, stepResult);
      executionContext.completeStep(nextStep.id);

      // Pause after execution
      executionContext.pauseExecution(sessionId, {
        reason: 'step_completion',
        stepId: nextStep.id,
        timestamp: new Date()
      });

      return {
        success: true,
        sessionId,
        sessionCreated: false,
        currentStep: nextStep,
        stepExecuted: true,
        stepResult,
        previousStepResult,
        hierarchicalExecution,
        executionState: 'paused',
        sessionContext: this._getSessionContext(executionContext),
        progressInfo: this._getProgressInfo(executionContext, plan),
        options
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async _handlePause(executionContext, plan, sessionId, options) {
    if (!sessionId || !executionContext.hasSession(sessionId)) {
      return {
        success: false,
        error: `Session not found: ${sessionId}`
      };
    }

    executionContext.pauseExecution(sessionId, {
      reason: 'manual_pause',
      timestamp: new Date()
    });

    return {
      success: true,
      sessionId,
      paused: true,
      executionState: 'paused',
      sessionContext: this._getSessionContext(executionContext),
      progressInfo: this._getProgressInfo(executionContext, plan),
      options
    };
  }

  async _handleResume(executionContext, plan, sessionId, options) {
    if (!sessionId || !executionContext.hasSession(sessionId)) {
      return {
        success: false,
        error: `Session not found: ${sessionId}`
      };
    }

    executionContext.resumeExecution(sessionId);

    return {
      success: true,
      sessionId,
      sessionCreated: false,
      resumed: true,
      executionState: 'running',
      sessionContext: this._getSessionContext(executionContext),
      progressInfo: this._getProgressInfo(executionContext, plan),
      options
    };
  }

  async _handleAbort(executionContext, plan, sessionId, options) {
    if (!sessionId || !executionContext.hasSession(sessionId)) {
      return {
        success: false,
        error: `Session not found: ${sessionId}`
      };
    }

    // Clean up session
    executionContext.destroySession(sessionId);

    return {
      success: true,
      sessionId,
      aborted: true,
      executionState: 'aborted',
      options
    };
  }

  _validatePlan(plan) {
    return plan && 
           typeof plan === 'object' && 
           plan.id && 
           Array.isArray(plan.steps);
  }

  _getFirstStep(plan) {
    if (!plan.steps || plan.steps.length === 0) {
      return null;
    }
    return plan.steps[0];
  }

  _getNextStep(executionContext, plan) {
    const completedSteps = executionContext.state.completedSteps;
    
    // Handle hierarchical step progression
    const findNextExecutableStep = (steps) => {
      for (const step of steps) {
        if (!completedSteps.includes(step.id)) {
          // If step has substeps, find the first uncompleted substep
          if (step.steps && step.steps.length > 0) {
            const nextSubStep = findNextExecutableStep(step.steps);
            if (nextSubStep) {
              return nextSubStep;
            }
          }
          // If step has actions or no substeps, it's executable
          if (step.actions || !step.steps) {
            return step;
          }
        }
      }
      return null;
    };
    
    return findNextExecutableStep(plan.steps);
  }

  _getAllSteps(plan) {
    const allSteps = [];
    
    const collectSteps = (steps) => {
      for (const step of steps) {
        allSteps.push(step);
        if (step.steps) {
          collectSteps(step.steps);
        }
      }
    };
    
    collectSteps(plan.steps);
    return allSteps;
  }

  _getSessionContext(executionContext) {
    return {
      currentPath: executionContext.currentPath,
      executionStack: executionContext.executionStack.map(context => ({
        stepId: context.stepId,
        step: context.step,
        startTime: context.startTime
      })),
      variables: executionContext.captureVariableSnapshot()
    };
  }

  _getProgressInfo(executionContext, plan) {
    // Count only top-level steps for progress calculation
    const topLevelSteps = plan.steps || [];
    const completedSteps = executionContext.state.completedSteps;
    const currentStep = executionContext.getCurrentStep();
    
    return {
      totalSteps: topLevelSteps.length,
      completedSteps: [...completedSteps],
      completedCount: completedSteps.length,
      currentStepIndex: currentStep ? topLevelSteps.findIndex(s => s.id === currentStep.id) : -1,
      progress: topLevelSteps.length > 0 ? (completedSteps.length / topLevelSteps.length) * 100 : 100
    };
  }

  // Mock implementation for step execution - would be replaced with real execution logic
  async _executeSingleStep(step) {
    // This is a mock implementation
    // In real usage, this would execute the step's actions using the appropriate tools
    return {
      success: true,
      stepId: step.id,
      result: `Executed ${step.id}`
    };
  }

  // This method would be replaced by proper dependency injection in the real implementation
  _getExecutionContext() {
    return this._executionContextRegistry;
  }
}