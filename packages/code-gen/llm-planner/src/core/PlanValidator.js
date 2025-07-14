/**
 * PlanValidator - Comprehensive validation for plans
 * 
 * Provides structural validation, dependency validation, and completeness checks
 * for plans. Supports custom validation rules and different project types.
 */

class PlanValidator {
  constructor(config = {}) {
    this.config = {
      strictValidation: true,
      validateDependencies: true,
      validateCompleteness: true,
      maxSteps: 100,
      ...config
    };

    // Custom validation rules
    this.customRules = new Map();

    // Valid step types (should match PlanStep model)
    this.validStepTypes = ['setup', 'implementation', 'integration', 'testing', 'validation', 'deployment'];
  }

  /**
   * Validate a plan against context and rules
   * 
   * @param {Plan} plan - The plan to validate
   * @param {PlanContext} context - The planning context
   * @returns {Promise<Object>} Validation result
   */
  async validate(plan, context) {
    const startTime = Date.now();
    
    // Input validation
    if (!plan) {
      throw new Error('Plan must be provided');
    }
    if (!context) {
      throw new Error('Context must be provided');
    }

    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      metadata: {
        validatedAt: Date.now(),
        validator: 'PlanValidator',
        rulesApplied: [],
        validationDuration: 0
      }
    };

    try {
      // Basic plan validation
      this._validateBasicStructure(plan, result);

      // Step structure validation
      this._validateStepStructure(plan, result);

      // Dependency validation
      if (this.config.validateDependencies) {
        this._validateDependencies(plan, result);
        result.metadata.rulesApplied.push('dependency-validation');
      }

      // Completeness validation
      if (this.config.validateCompleteness) {
        this._validateCompleteness(plan, context, result);
        result.metadata.rulesApplied.push('completeness-validation');
      }

      // Custom rules validation
      await this._validateCustomRules(plan, context, result);

      // Final validity check
      result.isValid = result.errors.length === 0;

    } catch (error) {
      result.isValid = false;
      result.errors.push(`Validation error: ${error.message}`);
    }

    result.metadata.validationDuration = Date.now() - startTime;
    return result;
  }

  /**
   * Add a custom validation rule
   * 
   * @param {string} name - Rule name
   * @param {Function} ruleFunction - Rule function that returns {valid, message?, warning?}
   */
  addRule(name, ruleFunction) {
    this.customRules.set(name, ruleFunction);
  }

  /**
   * Remove a custom validation rule
   * 
   * @param {string} name - Rule name to remove
   */
  removeRule(name) {
    this.customRules.delete(name);
  }

  /**
   * Get all custom rule names
   * 
   * @returns {Array<string>} Rule names
   */
  getRuleNames() {
    return Array.from(this.customRules.keys());
  }

  /**
   * Validate basic plan structure
   * 
   * @private
   * @param {Plan} plan - Plan to validate
   * @param {Object} result - Validation result to update
   */
  _validateBasicStructure(plan, result) {
    // Check required fields
    if (!plan.name || plan.name.trim() === '') {
      result.errors.push('Plan must have a name');
    }

    if (!plan.description || plan.description.trim() === '') {
      result.errors.push('Plan must have a description');
    }

    // Check steps exist
    if (!plan.steps || !Array.isArray(plan.steps) || plan.steps.length === 0) {
      result.errors.push('Plan must contain at least one step');
      return; // No point in validating steps if there are none
    }

    // Check steps limit
    if (plan.steps.length > this.config.maxSteps) {
      result.errors.push(`Plan exceeds maximum number of steps (${this.config.maxSteps})`);
    }

    result.metadata.rulesApplied.push('basic-structure');
  }

  /**
   * Validate step structure and uniqueness
   * 
   * @private
   * @param {Plan} plan - Plan to validate
   * @param {Object} result - Validation result to update
   */
  _validateStepStructure(plan, result) {
    if (!plan.steps || plan.steps.length === 0) {
      return; // Already handled in basic validation
    }

    const stepIds = new Set();
    const requiredFields = ['id', 'name', 'type'];

    for (const step of plan.steps) {
      // Check for duplicate IDs
      if (stepIds.has(step.id)) {
        result.errors.push(`Duplicate step ID found: ${step.id}`);
      } else {
        stepIds.add(step.id);
      }

      // Check required fields
      for (const field of requiredFields) {
        if (!step[field] || (typeof step[field] === 'string' && step[field].trim() === '')) {
          result.errors.push(`Step ${step.id || 'unknown'}: missing required field "${field}"`);
        }
      }

      // Check step type validity
      if (step.type && !this.validStepTypes.includes(step.type)) {
        result.errors.push(`Step ${step.id || 'unknown'}: invalid type "${step.type}"`);
      }
    }

    result.metadata.rulesApplied.push('step-structure');
  }

  /**
   * Validate step dependencies
   * 
   * @private
   * @param {Plan} plan - Plan to validate
   * @param {Object} result - Validation result to update
   */
  _validateDependencies(plan, result) {
    if (!plan.steps || plan.steps.length === 0) {
      return;
    }

    const stepIds = new Set(plan.steps.map(step => step.id));

    // Check for missing dependencies
    for (const step of plan.steps) {
      if (step.dependencies && Array.isArray(step.dependencies)) {
        for (const depId of step.dependencies) {
          if (!stepIds.has(depId)) {
            result.errors.push(`Step ${step.id} depends on non-existent step: ${depId}`);
          }
        }
      }
    }

    // Check for circular dependencies
    const circularDep = this._detectCircularDependencies(plan.steps);
    if (circularDep) {
      result.errors.push(`Circular dependency detected: ${circularDep.join(' -> ')}`);
    }
  }

  /**
   * Validate plan completeness based on project type
   * 
   * @private
   * @param {Plan} plan - Plan to validate
   * @param {PlanContext} context - Planning context
   * @param {Object} result - Validation result to update
   */
  _validateCompleteness(plan, context, result) {
    if (!plan.steps || plan.steps.length === 0) {
      return;
    }

    const stepTypes = plan.steps.map(step => step.type);
    const hasSetup = stepTypes.includes('setup');
    const hasImplementation = stepTypes.includes('implementation');
    const hasTesting = stepTypes.includes('testing');
    const hasValidation = stepTypes.includes('validation');

    // Basic completeness checks
    if (!hasSetup) {
      result.warnings.push('Plan is missing setup steps');
    }

    if (!hasImplementation) {
      result.warnings.push('Plan is missing implementation steps');
    }

    if (!hasTesting && !hasValidation) {
      result.warnings.push('Plan is missing testing steps');
    }

    // Project-type specific checks
    if (context.projectType === 'frontend') {
      this._validateFrontendCompleteness(plan, context, result);
    } else if (context.projectType === 'backend') {
      this._validateBackendCompleteness(plan, context, result);
    } else if (context.projectType === 'fullstack') {
      this._validateFullstackCompleteness(plan, context, result);
    }
  }

  /**
   * Validate frontend project completeness
   * 
   * @private
   * @param {Plan} plan - Plan to validate
   * @param {PlanContext} context - Planning context
   * @param {Object} result - Validation result to update
   */
  _validateFrontendCompleteness(plan, context, result) {
    // Frontend-specific validation logic
    const stepNames = plan.steps.map(step => step.name.toLowerCase());
    
    // Check for essential frontend steps
    const hasHTML = stepNames.some(name => name.includes('html') || name.includes('markup'));
    const hasCSS = stepNames.some(name => name.includes('css') || name.includes('style'));
    const hasJS = stepNames.some(name => name.includes('javascript') || name.includes('script'));

    if (!hasHTML) {
      result.warnings.push('Frontend plan may be missing HTML/markup steps');
    }
    if (!hasCSS) {
      result.warnings.push('Frontend plan may be missing CSS/styling steps');
    }
    if (!hasJS) {
      result.warnings.push('Frontend plan may be missing JavaScript steps');
    }
  }

  /**
   * Validate backend project completeness
   * 
   * @private
   * @param {Plan} plan - Plan to validate
   * @param {PlanContext} context - Planning context
   * @param {Object} result - Validation result to update
   */
  _validateBackendCompleteness(plan, context, result) {
    // Backend-specific validation logic
    const stepNames = plan.steps.map(step => step.name.toLowerCase());
    
    const hasServer = stepNames.some(name => name.includes('server') || name.includes('api'));
    const hasDatabase = stepNames.some(name => name.includes('database') || name.includes('data'));

    if (!hasServer) {
      result.warnings.push('Backend plan may be missing server/API steps');
    }
    const contextStr = JSON.stringify(context).toLowerCase();
    if (!hasDatabase && contextStr.includes('database')) {
      result.warnings.push('Backend plan may be missing database steps');
    }
  }

  /**
   * Validate fullstack project completeness
   * 
   * @private
   * @param {Plan} plan - Plan to validate
   * @param {PlanContext} context - Planning context
   * @param {Object} result - Validation result to update
   */
  _validateFullstackCompleteness(plan, context, result) {
    // Combine frontend and backend validation
    this._validateFrontendCompleteness(plan, context, result);
    this._validateBackendCompleteness(plan, context, result);

    // Additional fullstack-specific checks
    const stepNames = plan.steps.map(step => step.name.toLowerCase());
    const hasIntegration = stepNames.some(name => 
      name.includes('integration') || name.includes('connect') || name.includes('api')
    );

    if (!hasIntegration) {
      result.warnings.push('Fullstack plan may be missing frontend-backend integration steps');
    }
  }

  /**
   * Apply custom validation rules
   * 
   * @private
   * @param {Plan} plan - Plan to validate
   * @param {PlanContext} context - Planning context
   * @param {Object} result - Validation result to update
   */
  async _validateCustomRules(plan, context, result) {
    for (const [ruleName, ruleFunction] of this.customRules) {
      try {
        const ruleResult = await ruleFunction(plan, context);
        
        if (ruleResult && typeof ruleResult === 'object') {
          if (ruleResult.valid === false && ruleResult.message) {
            result.errors.push(ruleResult.message);
          }
          if (ruleResult.warning) {
            result.warnings.push(ruleResult.warning);
          }
        }

        result.metadata.rulesApplied.push(`custom:${ruleName}`);
      } catch (error) {
        result.warnings.push(`Custom rule '${ruleName}' failed: ${error.message}`);
      }
    }
  }

  /**
   * Detect circular dependencies in step list
   * 
   * @private
   * @param {Array} steps - Array of steps
   * @returns {Array|null} Circular dependency path or null
   */
  _detectCircularDependencies(steps) {
    const stepMap = new Map();
    const visiting = new Set();
    const visited = new Set();

    // Build step map
    for (const step of steps) {
      stepMap.set(step.id, step.dependencies || []);
    }

    // DFS to detect cycles
    const dfs = (stepId, path) => {
      if (visiting.has(stepId)) {
        // Found a cycle
        const cycleStart = path.indexOf(stepId);
        return path.slice(cycleStart).concat([stepId]);
      }

      if (visited.has(stepId)) {
        return null;
      }

      visiting.add(stepId);
      const dependencies = stepMap.get(stepId) || [];

      for (const depId of dependencies) {
        const cycle = dfs(depId, path.concat([stepId]));
        if (cycle) {
          return cycle;
        }
      }

      visiting.delete(stepId);
      visited.add(stepId);
      return null;
    };

    // Check each step for cycles
    for (const stepId of stepMap.keys()) {
      if (!visited.has(stepId)) {
        const cycle = dfs(stepId, []);
        if (cycle) {
          return cycle;
        }
      }
    }

    return null;
  }
}

export { PlanValidator };