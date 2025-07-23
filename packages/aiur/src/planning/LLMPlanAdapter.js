/**
 * LLMPlanAdapter - Adapts llm-planner Plans to work with Aiur's execution system
 * 
 * This adapter wraps llm-planner's hierarchical Plan structure and provides
 * compatibility with Aiur's existing PlanExecutor and handle management
 */

import { AiurPlan } from './AiurPlan.js';
import { Plan as LLMPlan } from '@legion/llm-planner';

export class LLMPlanAdapter extends AiurPlan {
  constructor(llmPlan, handleRegistry, options = {}) {
    // Convert llm-planner format to AiurPlan format
    const aiurPlanData = {
      id: llmPlan.id,
      title: llmPlan.name,
      description: llmPlan.description,
      steps: [], // Will be filled by flattening
      metadata: {
        ...llmPlan.metadata,
        llmGenerated: true,
        originalStructure: 'hierarchical',
        inputs: llmPlan.inputs,
        requiredOutputs: llmPlan.requiredOutputs
      }
    };
    
    // Initialize parent with converted data
    super(aiurPlanData, handleRegistry, options);
    
    // Store original llm plan for reference
    this.llmPlan = llmPlan;
    
    // Flatten hierarchical steps into executable actions
    this.steps = this._flattenHierarchicalSteps(llmPlan.steps);
    
    // Re-initialize step states for flattened steps
    this.state.stepStates = {};
    for (const step of this.steps) {
      this.state.stepStates[step.id] = {
        status: 'pending',
        startedAt: null,
        completedAt: null,
        failedAt: null,
        output: null,
        error: null
      };
    }
    
    // Generate execution order from llm plan
    this.executionOrder = llmPlan.generateExecutionOrder();
  }
  
  /**
   * Flatten hierarchical steps into a flat list of executable actions
   * @private
   */
  _flattenHierarchicalSteps(steps, parentContext = {}) {
    const flatSteps = [];
    
    for (const step of steps) {
      // If step has actions (leaf node), convert to Aiur steps
      if (step.actions && step.actions.length > 0) {
        for (let i = 0; i < step.actions.length; i++) {
          const action = step.actions[i];
          const actionStepId = `${step.id}-action-${i}`;
          
          const aiurStep = {
            id: actionStepId,
            title: `${step.name}${step.actions.length > 1 ? ` (${i + 1}/${step.actions.length})` : ''}`,
            description: step.description || '',
            action: action.type,
            parameters: action.parameters || {},
            dependsOn: this._resolveDependencies(step, i, parentContext),
            expectedOutputs: action.outputs || [],
            // Store original step reference
            _originalStepId: step.id,
            _actionIndex: i
          };
          
          flatSteps.push(aiurStep);
        }
      }
      
      // If step has sub-steps (branch node), recurse
      if (step.steps && step.steps.length > 0) {
        const subContext = {
          parentStepId: step.id,
          parentDependencies: step.dependencies || []
        };
        const subSteps = this._flattenHierarchicalSteps(step.steps, subContext);
        flatSteps.push(...subSteps);
      }
    }
    
    return flatSteps;
  }
  
  /**
   * Resolve dependencies for a flattened action
   * @private
   */
  _resolveDependencies(step, actionIndex, parentContext) {
    const dependencies = [];
    
    // Add parent dependencies
    if (parentContext.parentDependencies) {
      // Convert parent step IDs to their last action
      for (const depStepId of parentContext.parentDependencies) {
        const depStep = this.llmPlan.getStep(depStepId);
        if (depStep && depStep.actions && depStep.actions.length > 0) {
          // Depend on the last action of the dependency step
          dependencies.push(`${depStepId}-action-${depStep.actions.length - 1}`);
        }
      }
    }
    
    // Add step's own dependencies
    if (step.dependencies) {
      for (const depStepId of step.dependencies) {
        const depStep = this.llmPlan.getStep(depStepId);
        if (depStep && depStep.actions && depStep.actions.length > 0) {
          // Depend on the last action of the dependency step
          dependencies.push(`${depStepId}-action-${depStep.actions.length - 1}`);
        }
      }
    }
    
    // If this is not the first action in the step, depend on the previous action
    if (actionIndex > 0) {
      dependencies.push(`${step.id}-action-${actionIndex - 1}`);
    }
    
    return [...new Set(dependencies)]; // Remove duplicates
  }
  
  /**
   * Override validate to use llm-planner's validation
   */
  validate() {
    // First do llm-planner validation
    const llmValidation = this.llmPlan.validate();
    if (!llmValidation.isValid) {
      return {
        valid: false,
        errors: llmValidation.errors
      };
    }
    
    // Then do Aiur validation on flattened structure
    return super.validate();
  }
  
  /**
   * Get the original hierarchical structure
   */
  getHierarchicalStructure() {
    return this.llmPlan.toJSON();
  }
  
  /**
   * Get step by original step ID (from llm-planner)
   */
  getOriginalStep(stepId) {
    return this.llmPlan.getStep(stepId);
  }
  
  /**
   * Get all flattened steps for an original step
   */
  getFlattenedStepsForOriginal(originalStepId) {
    return this.steps.filter(step => step._originalStepId === originalStepId);
  }
  
  /**
   * Override to provide better progress tracking for hierarchical plans
   */
  getProgress() {
    const baseProgress = super.getProgress();
    
    // Add hierarchical progress information
    const hierarchicalProgress = {
      ...baseProgress,
      hierarchical: {
        totalSteps: this.llmPlan.steps.length,
        completedSteps: 0,
        inProgressSteps: 0,
        pendingSteps: 0
      }
    };
    
    // Calculate hierarchical progress
    for (const step of this.llmPlan.steps) {
      const flattenedSteps = this.getFlattenedStepsForOriginal(step.id);
      const statuses = flattenedSteps.map(s => this.state.stepStates[s.id]?.status || 'pending');
      
      if (statuses.every(s => s === 'completed')) {
        hierarchicalProgress.hierarchical.completedSteps++;
      } else if (statuses.some(s => s === 'running' || s === 'completed')) {
        hierarchicalProgress.hierarchical.inProgressSteps++;
      } else {
        hierarchicalProgress.hierarchical.pendingSteps++;
      }
    }
    
    return hierarchicalProgress;
  }
  
  /**
   * Export both flattened and hierarchical representations
   */
  exportState() {
    const baseExport = super.exportState();
    return {
      ...baseExport,
      hierarchicalPlan: this.llmPlan.toJSON()
    };
  }
  
  /**
   * Check if plan can handle parallel execution groups
   */
  getParallelExecutionGroups() {
    // Use llm-planner's parallel execution group calculation
    return this.llmPlan.getParallelExecutionGroups();
  }
}