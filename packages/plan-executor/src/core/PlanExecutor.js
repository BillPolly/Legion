/**
 * PlanExecutor - Core execution engine for hierarchical plans
 */

import { EventEmitter } from 'events';
import { ModuleLoader } from './ModuleLoader.js';
import { ExecutionContext } from './ExecutionContext.js';

export class PlanExecutor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.moduleFactory = options.moduleFactory;
    this.resourceManager = options.resourceManager;
    
    if (!this.moduleFactory) {
      throw new Error('ModuleFactory is required');
    }
    
    // Initialize module loader
    this.moduleLoader = new ModuleLoader(this.moduleFactory);
  }
  
  async executePlan(plan, options = {}) {
    const startTime = new Date();
    
    // Validate plan
    if (!plan || !plan.steps) {
      throw new Error('Invalid plan: must have steps array');
    }
    
    // Set default options
    const executionOptions = {
      emitProgress: true,
      stopOnError: true,
      timeout: 300000,
      retries: 3,
      ...options
    };
    
    // Create execution context
    const context = new ExecutionContext(plan, executionOptions);
    
    // Emit plan start event
    if (executionOptions.emitProgress) {
      this.emit('plan:start', {
        planId: plan.id,
        planName: plan.name,
        totalSteps: this._countTotalSteps(plan),
        timestamp: startTime
      });
    }
    
    try {
      // Load required modules
      await this.moduleLoader.loadModulesForPlan(plan);
      
      // Execute plan steps
      await this._executeSteps(plan.steps, context);
      
      // Build result
      const result = {
        success: context.state.failedSteps.length === 0,
        completedSteps: context.state.completedSteps,
        failedSteps: context.state.failedSteps,
        skippedSteps: context.state.skippedSteps,
        stepResults: Object.fromEntries(context.state.stepResults),
        statistics: {
          totalSteps: context.state.completedSteps.length + context.state.failedSteps.length + context.state.skippedSteps.length,
          executionTime: Date.now() - startTime.getTime()
        }
      };
      
      // Emit plan complete event
      if (executionOptions.emitProgress) {
        this.emit('plan:complete', {
          planId: plan.id,
          success: result.success,
          completedSteps: result.completedSteps.length,
          failedSteps: result.failedSteps.length,
          executionTime: result.statistics.executionTime,
          timestamp: new Date()
        });
      }
      
      return result;
      
    } catch (error) {
      // Build error result
      const result = {
        success: false,
        completedSteps: context.state.completedSteps,
        failedSteps: context.state.failedSteps,
        skippedSteps: context.state.skippedSteps,
        stepResults: Object.fromEntries(context.state.stepResults),
        statistics: {
          totalSteps: context.state.completedSteps.length + context.state.failedSteps.length + context.state.skippedSteps.length,
          executionTime: Date.now() - startTime.getTime()
        },
        error: error.message
      };

      // Only emit plan:error for plan-level errors (not step failures)
      // Step failures are handled by step:error events
      if (executionOptions.emitProgress && executionOptions.stopOnError) {
        this.emit('plan:error', {
          planId: plan.id,
          error: error.message,
          timestamp: new Date()
        });
      }
      
      return result;
    }
  }
  
  async _executeSteps(steps, context) {
    for (const step of steps) {
      // Check if we should stop due to previous errors
      if (context.options.stopOnError && context.state.failedSteps.length > 0) {
        // Mark remaining steps as skipped
        this._markRemainingStepsAsSkipped(steps, step, context);
        break;
      }
      
      try {
        await this._executeStep(step, context);
      } catch (error) {
        // If stopOnError is true, this error should propagate up
        if (context.options.stopOnError) {
          // Mark remaining steps as skipped
          this._markRemainingStepsAsSkipped(steps, step, context);
          throw error;
        }
        // If stopOnError is false, continue with next step
        // (error is already handled in _executeStep)
      }
    }
  }
  
  async _executeStep(step, context) {
    // Update current position in context
    context.enterStep(step);
    
    try {
      // Check if step has dependencies
      if (step.dependencies && step.dependencies.length > 0) {
        const unsatisfiedDeps = step.dependencies.filter(dep => 
          !context.state.completedSteps.includes(dep)
        );
        
        if (unsatisfiedDeps.length > 0) {
          throw new Error(`Unsatisfied dependencies: ${unsatisfiedDeps.join(', ')}`);
        }
      }
      
      // Emit step start event
      if (context.options.emitProgress) {
        this.emit('step:start', {
          planId: context.plan.id,
          stepId: step.id,
          stepName: step.name,
          stepPath: context.getCurrentPath(),
          timestamp: new Date()
        });
      }
      
      // Execute step based on its type
      if (step.steps && step.steps.length > 0) {
        // Step has sub-steps - recurse
        await this._executeSteps(step.steps, context);
      } else if (step.actions && step.actions.length > 0) {
        // Step has actions - execute them
        await this._executeActions(step.actions, step, context);
      }
      
      // Mark step as completed
      context.completeStep(step.id);
      
      // Emit step complete event
      if (context.options.emitProgress) {
        this.emit('step:complete', {
          planId: context.plan.id,
          stepId: step.id,
          stepName: step.name,
          stepPath: context.getCurrentPath(),
          timestamp: new Date()
        });
      }
      
    } catch (error) {
      // Mark step as failed
      context.failStep(step.id, error);
      
      // Emit step error event
      if (context.options.emitProgress) {
        this.emit('step:error', {
          planId: context.plan.id,
          stepId: step.id,
          stepName: step.name,
          stepPath: context.getCurrentPath(),
          error: error.message,
          timestamp: new Date()
        });
      }
      
      // Re-throw if stop on error
      if (context.options.stopOnError) {
        throw error;
      }
      // If stopOnError is false, don't re-throw, just continue
    } finally {
      // Exit step context
      context.exitStep();
    }
  }
  
  async _executeActions(actions, step, context) {
    for (const action of actions) {
      await this._executeAction(action, step, context);
    }
  }
  
  async _executeAction(action, step, context) {
    const maxRetries = context.options.retries;
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Get tool for this action
        const tool = this.moduleLoader.getTool(action.type);
        if (!tool) {
          throw new Error(`Tool not found: ${action.type}`);
        }
        
        // Resolve parameters
        const resolvedParams = context.resolveParameters(action.parameters || {});
        
        // Execute tool with timeout
        const result = await this._executeWithTimeout(
          () => tool.execute(resolvedParams),
          context.options.timeout
        );
        
        // Store result
        context.setActionResult(step.id, action.type, result);
        
        return result;
        
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries) {
          // Wait before retry with exponential backoff
          await this._sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }
    
    throw lastError;
  }
  
  async _executeWithTimeout(fn, timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Execution timeout after ${timeout}ms`));
      }, timeout);
      
      Promise.resolve(fn())
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
  
  async _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  _countTotalSteps(plan) {
    let count = 0;
    
    const countSteps = (steps) => {
      for (const step of steps) {
        count++;
        if (step.steps && step.steps.length > 0) {
          countSteps(step.steps);
        }
      }
    };
    
    countSteps(plan.steps);
    return count;
  }
  
  _markRemainingStepsAsSkipped(steps, currentStep, context) {
    let skipMode = false;
    
    const markSkipped = (stepList) => {
      for (const step of stepList) {
        if (step === currentStep) {
          skipMode = true;
          continue;
        }
        
        if (skipMode) {
          context.skipStep(step.id);
        }
        
        if (step.steps && step.steps.length > 0) {
          markSkipped(step.steps);
        }
      }
    };
    
    markSkipped(steps);
  }
}