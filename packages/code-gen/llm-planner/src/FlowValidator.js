/**
 * FlowValidator - Validates input/output flow in plans
 * 
 * Ensures that all required inputs are produced by previous actions
 * and that all required outputs are eventually produced.
 */

class FlowValidator {
  constructor(config = {}) {
    this.config = {
      strictMode: false, // Whether to treat warnings as errors
      ...config
    };
  }

  /**
   * Validate the input/output flow of a plan
   * @param {Plan} plan - The plan to validate
   * @returns {Object} Validation result
   */
  validate(plan) {
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      flowAnalysis: {}
    };

    try {
      // Basic structure validation
      this._validatePlanStructure(plan, result);
      
      if (result.errors.length > 0) {
        result.isValid = false;
        return result;
      }

      // Input/output flow validation
      this._validateInputOutputFlow(plan, result);
      
      // Dependency validation
      this._validateDependencies(plan, result);
      
      // Check for unused outputs
      this._checkUnusedOutputs(plan, result);
      
      // Final validity check
      result.isValid = result.errors.length === 0 && 
        (!this.config.strictMode || result.warnings.length === 0);

    } catch (error) {
      result.isValid = false;
      result.errors.push(`Validation error: ${error.message}`);
    }

    return result;
  }

  /**
   * Validate basic plan structure
   * @private
   */
  _validatePlanStructure(plan, result) {
    if (!plan) {
      result.errors.push('Plan is required');
      return;
    }

    if (!plan.steps || !Array.isArray(plan.steps)) {
      result.errors.push('Plan must have steps array');
      return;
    }

    if (plan.steps.length === 0) {
      result.warnings.push('Plan has no steps');
      return;
    }

    // Validate each step has required properties
    for (const step of plan.steps) {
      if (!step.id) {
        result.errors.push('All steps must have an id');
      }
      
      if (!step.name) {
        result.errors.push(`Step ${step.id} must have a name`);
      }
      
      if (!Array.isArray(step.actions)) {
        result.errors.push(`Step ${step.id} must have actions array`);
      }
    }
  }

  /**
   * Validate input/output flow
   * @private
   */
  _validateInputOutputFlow(plan, result) {
    const flowAnalysis = {
      availableOutputs: [...(plan.inputs || [])],
      stepAnalysis: [],
      missingInputs: [],
      unusedOutputs: []
    };

    // Get execution order
    const executionOrder = plan.executionOrder && plan.executionOrder.length > 0 
      ? plan.executionOrder 
      : plan.steps.map(s => s.id);

    // Validate each step in execution order
    for (const stepId of executionOrder) {
      const step = plan.getStep(stepId);
      if (!step) {
        result.errors.push(`Step ${stepId} not found in plan`);
        continue;
      }

      const stepAnalysis = {
        stepId: step.id,
        stepName: step.name,
        requiredInputs: step.getInputs(),
        producedOutputs: step.getOutputs(),
        missingInputs: [],
        satisfiedInputs: []
      };

      // Check if all required inputs are available
      for (const input of stepAnalysis.requiredInputs) {
        if (flowAnalysis.availableOutputs.includes(input)) {
          stepAnalysis.satisfiedInputs.push(input);
        } else {
          stepAnalysis.missingInputs.push(input);
          flowAnalysis.missingInputs.push({
            step: step.id,
            input: input
          });
        }
      }

      // Add errors for missing inputs
      if (stepAnalysis.missingInputs.length > 0) {
        result.errors.push(
          `Step '${step.name}' (${step.id}) missing required inputs: ${stepAnalysis.missingInputs.join(', ')}`
        );
      }

      // Add produced outputs to available outputs
      for (const output of stepAnalysis.producedOutputs) {
        if (!flowAnalysis.availableOutputs.includes(output)) {
          flowAnalysis.availableOutputs.push(output);
        }
      }

      flowAnalysis.stepAnalysis.push(stepAnalysis);
    }

    // Check if all required outputs are produced
    if (plan.requiredOutputs && plan.requiredOutputs.length > 0) {
      const missingOutputs = plan.requiredOutputs.filter(
        output => !flowAnalysis.availableOutputs.includes(output)
      );
      
      if (missingOutputs.length > 0) {
        result.errors.push(
          `Plan does not produce required outputs: ${missingOutputs.join(', ')}`
        );
      }
    }

    result.flowAnalysis = flowAnalysis;
  }

  /**
   * Validate step dependencies
   * @private
   */
  _validateDependencies(plan, result) {
    const stepIds = new Set(plan.steps.map(s => s.id));

    // Check all dependencies exist
    for (const step of plan.steps) {
      if (step.dependencies && step.dependencies.length > 0) {
        for (const depId of step.dependencies) {
          if (!stepIds.has(depId)) {
            result.errors.push(
              `Step '${step.name}' (${step.id}) depends on non-existent step: ${depId}`
            );
          }
        }
      }
    }

    // Check for circular dependencies
    if (this._hasCircularDependencies(plan)) {
      result.errors.push('Plan has circular dependencies');
    }
  }

  /**
   * Check for unused outputs
   * @private
   */
  _checkUnusedOutputs(plan, result) {
    const allProducedOutputs = plan.steps.flatMap(step => step.getOutputs());
    const allConsumedInputs = plan.steps.flatMap(step => step.getInputs());
    const requiredOutputs = plan.requiredOutputs || [];

    const unusedOutputs = allProducedOutputs.filter(output => 
      !allConsumedInputs.includes(output) && !requiredOutputs.includes(output)
    );

    if (unusedOutputs.length > 0) {
      result.warnings.push(`Unused outputs: ${unusedOutputs.join(', ')}`);
    }

    if (result.flowAnalysis) {
      result.flowAnalysis.unusedOutputs = unusedOutputs;
    }
  }

  /**
   * Check for circular dependencies using DFS
   * @private
   */
  _hasCircularDependencies(plan) {
    const visited = new Set();
    const recursionStack = new Set();

    const hasCycle = (stepId) => {
      visited.add(stepId);
      recursionStack.add(stepId);

      const step = plan.getStep(stepId);
      if (step && step.dependencies) {
        for (const depId of step.dependencies) {
          if (!visited.has(depId)) {
            if (hasCycle(depId)) {
              return true;
            }
          } else if (recursionStack.has(depId)) {
            return true;
          }
        }
      }

      recursionStack.delete(stepId);
      return false;
    };

    for (const step of plan.steps) {
      if (!visited.has(step.id)) {
        if (hasCycle(step.id)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Generate a detailed flow report
   * @param {Plan} plan - The plan to analyze
   * @returns {Object} Detailed flow report
   */
  generateFlowReport(plan) {
    const validation = this.validate(plan);
    
    return {
      isValid: validation.isValid,
      errors: validation.errors,
      warnings: validation.warnings,
      flowAnalysis: validation.flowAnalysis,
      summary: {
        totalSteps: plan.steps.length,
        totalInputs: (plan.inputs || []).length,
        totalRequiredOutputs: (plan.requiredOutputs || []).length,
        errorCount: validation.errors.length,
        warningCount: validation.warnings.length
      },
      recommendations: this._generateRecommendations(validation)
    };
  }

  /**
   * Generate recommendations based on validation results
   * @private
   */
  _generateRecommendations(validation) {
    const recommendations = [];

    if (validation.flowAnalysis && validation.flowAnalysis.missingInputs.length > 0) {
      recommendations.push('Add steps to produce missing inputs or include them in plan inputs');
    }

    if (validation.flowAnalysis && validation.flowAnalysis.unusedOutputs.length > 0) {
      recommendations.push('Consider removing steps that produce unused outputs or use those outputs');
    }

    if (validation.errors.some(e => e.includes('circular dependencies'))) {
      recommendations.push('Restructure step dependencies to eliminate circular references');
    }

    if (validation.warnings.length > 0) {
      recommendations.push('Review warnings to optimize plan efficiency');
    }

    return recommendations;
  }
}

export { FlowValidator };