/**
 * PlanRefiner - Intelligent plan refinement and improvement
 * 
 * Provides targeted fixes and improvements for plans based on validation results.
 * Applies error corrections and warning-based enhancements while preserving user intent.
 */

import { PlanStep } from '../models/PlanStep.js';

class PlanRefiner {
  constructor(config = {}) {
    this.config = {
      autoFix: true,
      preserveUserSteps: true,
      maxRefinements: 10,
      prioritizeErrors: true,
      ...config
    };

    // Valid step types for fixes
    this.validStepTypes = ['setup', 'implementation', 'integration', 'testing', 'validation', 'deployment'];
  }

  /**
   * Refine a plan based on validation results
   * 
   * @param {Plan} plan - The plan to refine
   * @param {Object} validationResult - Validation result with errors and warnings
   * @param {PlanContext} context - Planning context for context-aware refinements
   * @returns {Promise<Plan>} The refined plan
   */
  async refine(plan, validationResult, context = null) {
    // Handle invalid inputs
    if (!validationResult) {
      return plan;
    }

    // If no refinement needed and plan is valid, return as-is
    if (validationResult.isValid && (!validationResult.warnings || validationResult.warnings.length === 0)) {
      return plan;
    }

    // If autoFix is disabled, return original plan
    if (!this.config.autoFix) {
      return plan;
    }

    // Clone the plan to avoid modifying the original
    const refinedPlan = this._clonePlan(plan);

    // Initialize refinement tracking
    if (!refinedPlan.metadata.refinements) {
      refinedPlan.metadata.refinements = [];
    }

    const refinementSession = {
      timestamp: Date.now(),
      errors: validationResult.errors || [],
      warnings: validationResult.warnings || [],
      appliedFixes: []
    };

    try {
      // Apply error fixes first (higher priority)
      if (this.config.prioritizeErrors && validationResult.errors) {
        await this._applyErrorFixes(refinedPlan, validationResult.errors, context, refinementSession);
      }

      // Apply warning-based improvements
      if (validationResult.warnings) {
        await this._applyWarningImprovements(refinedPlan, validationResult.warnings, context, refinementSession);
      }

      // Update plan metadata
      refinedPlan.metadata.lastRefinement = Date.now();
      
      // Add individual refinements instead of the whole session
      for (const fix of refinementSession.appliedFixes) {
        refinedPlan.metadata.refinements.push({
          timestamp: refinementSession.timestamp,
          type: fix.type,
          description: fix.description,
          ...fix
        });
      }

      // Limit refinement history
      if (refinedPlan.metadata.refinements.length > this.config.maxRefinements) {
        refinedPlan.metadata.refinements = refinedPlan.metadata.refinements.slice(-this.config.maxRefinements);
      }

      return refinedPlan;

    } catch (error) {
      // If refinement fails, return original plan
      console.warn('Plan refinement failed:', error.message);
      return plan;
    }
  }

  /**
   * Apply fixes for validation errors
   * 
   * @private
   * @param {Plan} plan - Plan to modify
   * @param {Array<string>} errors - Validation errors
   * @param {PlanContext} context - Planning context
   * @param {Object} session - Refinement session for tracking
   */
  async _applyErrorFixes(plan, errors, context, session) {
    for (const error of errors) {
      if (error.includes('must contain at least one step')) {
        this._fixEmptyPlan(plan, context, session);
      } else if (error.includes('Duplicate step ID found')) {
        this._fixDuplicateStepIds(plan, error, session);
      } else if (error.includes('depends on non-existent step')) {
        this._fixMissingDependencies(plan, error, session);
      } else if (error.includes('Circular dependency detected')) {
        this._fixCircularDependencies(plan, error, session);
      } else if (error.includes('invalid type')) {
        this._fixInvalidStepTypes(plan, error, session);
      } else if (error.includes('missing required field')) {
        this._fixMissingFields(plan, error, session);
      }
    }
  }

  /**
   * Apply improvements based on validation warnings
   * 
   * @private
   * @param {Plan} plan - Plan to modify
   * @param {Array<string>} warnings - Validation warnings
   * @param {PlanContext} context - Planning context
   * @param {Object} session - Refinement session for tracking
   */
  async _applyWarningImprovements(plan, warnings, context, session) {
    for (const warning of warnings) {
      if (warning.includes('missing setup steps')) {
        this._addSetupSteps(plan, context, session);
      } else if (warning.includes('missing testing steps')) {
        this._addTestingSteps(plan, context, session);
      } else if (warning.includes('missing implementation steps')) {
        this._addImplementationSteps(plan, context, session);
      } else if (warning.includes('Frontend plan may be missing HTML')) {
        this._addFrontendHtmlSteps(plan, context, session);
      } else if (warning.includes('Frontend plan may be missing CSS')) {
        this._addFrontendCssSteps(plan, context, session);
      } else if (warning.includes('Frontend plan may be missing JavaScript')) {
        this._addFrontendJsSteps(plan, context, session);
      } else if (warning.includes('Backend plan may be missing server')) {
        this._addBackendServerSteps(plan, context, session);
      } else if (warning.includes('Backend plan may be missing database')) {
        this._addBackendDatabaseSteps(plan, context, session);
      }
    }
  }

  /**
   * Fix empty plan by adding basic steps
   * 
   * @private
   */
  _fixEmptyPlan(plan, context, session) {
    const projectType = context?.projectType || 'frontend';
    
    if (projectType === 'frontend') {
      plan.addStep(new PlanStep({
        id: this._generateStepId('setup'),
        name: 'Setup Project Structure',
        type: 'setup',
        description: 'Create basic project structure and files'
      }));
      
      plan.addStep(new PlanStep({
        id: this._generateStepId('impl'),
        name: 'Implement Core Features',
        type: 'implementation',
        description: 'Implement the main functionality',
        dependencies: [plan.steps[0].id]
      }));
    } else if (projectType === 'backend') {
      plan.addStep(new PlanStep({
        id: this._generateStepId('setup'),
        name: 'Setup Server Environment',
        type: 'setup',
        description: 'Initialize server and dependencies'
      }));
      
      plan.addStep(new PlanStep({
        id: this._generateStepId('impl'),
        name: 'Implement API Endpoints',
        type: 'implementation',
        description: 'Create API routes and handlers',
        dependencies: [plan.steps[0].id]
      }));
    } else {
      // Fullstack or generic
      plan.addStep(new PlanStep({
        id: this._generateStepId('setup'),
        name: 'Setup Project',
        type: 'setup',
        description: 'Initialize project structure and dependencies'
      }));
    }

    session.appliedFixes.push({
      type: 'error-fix',
      description: 'Added basic steps to empty plan',
      stepsAdded: plan.steps.length
    });
  }

  /**
   * Fix duplicate step IDs
   * 
   * @private
   */
  _fixDuplicateStepIds(plan, error, session) {
    const stepIds = new Set();
    let duplicatesFixed = 0;

    for (const step of plan.steps) {
      if (stepIds.has(step.id)) {
        // Generate new unique ID
        step.id = this._generateStepId(step.type);
        duplicatesFixed++;
      } else {
        stepIds.add(step.id);
      }
    }

    session.appliedFixes.push({
      type: 'error-fix',
      description: `Fixed ${duplicatesFixed} duplicate step IDs`,
      duplicatesFixed
    });
  }

  /**
   * Fix missing dependencies
   * 
   * @private
   */
  _fixMissingDependencies(plan, error, session) {
    const match = error.match(/Step (\w+) depends on non-existent step: (\w+)/);
    if (!match) return;

    const [, stepId, missingDepId] = match;
    const step = plan.getStepById(stepId);
    
    if (step) {
      // Option 1: Remove the missing dependency
      step.dependencies = step.dependencies.filter(dep => dep !== missingDepId);
      
      session.appliedFixes.push({
        type: 'error-fix',
        description: `Removed missing dependency ${missingDepId} from step ${stepId}`,
        stepModified: stepId
      });
    }
  }

  /**
   * Fix circular dependencies
   * 
   * @private
   */
  _fixCircularDependencies(plan, error, session) {
    // Simple approach: remove all dependencies from the last step in the cycle
    const steps = plan.steps;
    const graph = this._buildDependencyGraph(steps);
    
    // Find and break cycles by removing dependencies from problematic steps
    for (const step of steps) {
      if (this._hasCircularDependency(step.id, graph, new Set())) {
        step.dependencies = [];
        break; // Break one cycle at a time
      }
    }

    session.appliedFixes.push({
      type: 'error-fix',
      description: 'Resolved circular dependencies',
      action: 'removed-problematic-dependencies'
    });
  }

  /**
   * Fix invalid step types
   * 
   * @private
   */
  _fixInvalidStepTypes(plan, error, session) {
    const match = error.match(/Step (\w+): invalid type "([^"]+)"/);
    if (!match) return;

    const [, stepId, invalidType] = match;
    const step = plan.steps.find(s => s.id === stepId);
    
    if (step) {
      // Map to closest valid type
      step.type = this._mapToValidStepType(invalidType);
      
      session.appliedFixes.push({
        type: 'error-fix',
        description: `Fixed invalid step type ${invalidType} -> ${step.type}`,
        stepModified: stepId
      });
    }
  }

  /**
   * Fix missing required fields
   * 
   * @private
   */
  _fixMissingFields(plan, error, session) {
    const match = error.match(/Step ([^:]+): missing required field "([^"]+)"/);
    if (!match) return;

    const [, stepId, fieldName] = match;
    const step = plan.steps.find(s => s.id === stepId);
    
    if (step) {
      if (fieldName === 'name' && (!step.name || step.name.trim() === '')) {
        step.name = `${step.type} Step`;
      }
      if (fieldName === 'id' && (!step.id || step.id.trim() === '')) {
        step.id = this._generateStepId(step.type || 'step');
      }
      
      session.appliedFixes.push({
        type: 'error-fix',
        description: `Added missing ${fieldName} field to step ${stepId}`,
        stepModified: stepId
      });
    }
  }

  /**
   * Add setup steps
   * 
   * @private
   */
  _addSetupSteps(plan, context, session) {
    if (plan.steps.some(step => step.type === 'setup')) {
      return; // Already has setup steps
    }

    const setupStep = new PlanStep({
      id: this._generateStepId('setup'),
      name: 'Project Setup',
      type: 'setup',
      description: 'Initialize project structure and dependencies'
    });

    plan.steps.unshift(setupStep); // Add at beginning
    this._updateDependencies(plan, setupStep.id);

    session.appliedFixes.push({
      type: 'warning-improvement',
      description: 'Added missing setup step',
      stepAdded: setupStep.id
    });
  }

  /**
   * Add testing steps
   * 
   * @private
   */
  _addTestingSteps(plan, context, session) {
    if (plan.steps.some(step => step.type === 'testing')) {
      return; // Already has testing steps
    }

    const testStep = new PlanStep({
      id: this._generateStepId('test'),
      name: 'Test Implementation',
      type: 'testing',
      description: 'Test the implemented functionality',
      dependencies: plan.steps.filter(s => s.type === 'implementation').map(s => s.id)
    });

    plan.addStep(testStep);

    session.appliedFixes.push({
      type: 'warning-improvement',
      description: 'Added missing testing step',
      stepAdded: testStep.id
    });
  }

  /**
   * Add implementation steps
   * 
   * @private
   */
  _addImplementationSteps(plan, context, session) {
    if (plan.steps.some(step => step.type === 'implementation')) {
      return; // Already has implementation steps
    }

    const setupSteps = plan.steps.filter(s => s.type === 'setup');
    const implStep = new PlanStep({
      id: this._generateStepId('impl'),
      name: 'Core Implementation',
      type: 'implementation',
      description: 'Implement core functionality',
      dependencies: setupSteps.map(s => s.id)
    });

    plan.addStep(implStep);

    session.appliedFixes.push({
      type: 'warning-improvement',
      description: 'Added missing implementation step',
      stepAdded: implStep.id
    });
  }

  /**
   * Add frontend HTML steps
   * 
   * @private
   */
  _addFrontendHtmlSteps(plan, context, session) {
    const hasHtmlStep = plan.steps.some(step => 
      step.name.toLowerCase().includes('html') || 
      step.name.toLowerCase().includes('markup')
    );

    if (hasHtmlStep) return;

    const htmlStep = new PlanStep({
      id: this._generateStepId('html'),
      name: 'Create HTML Structure',
      type: 'implementation',
      description: 'Create the HTML markup and structure'
    });

    plan.addStep(htmlStep);

    session.appliedFixes.push({
      type: 'warning-improvement',
      description: 'Added frontend HTML step',
      stepAdded: htmlStep.id
    });
  }

  /**
   * Add frontend CSS steps
   * 
   * @private
   */
  _addFrontendCssSteps(plan, context, session) {
    const hasCssStep = plan.steps.some(step => 
      step.name.toLowerCase().includes('css') || 
      step.name.toLowerCase().includes('style')
    );

    if (hasCssStep) return;

    const cssStep = new PlanStep({
      id: this._generateStepId('css'),
      name: 'Style with CSS',
      type: 'implementation',
      description: 'Apply styling and layout with CSS'
    });

    plan.addStep(cssStep);

    session.appliedFixes.push({
      type: 'warning-improvement',
      description: 'Added frontend CSS step',
      stepAdded: cssStep.id
    });
  }

  /**
   * Add frontend JavaScript steps
   * 
   * @private
   */
  _addFrontendJsSteps(plan, context, session) {
    const hasJsStep = plan.steps.some(step => 
      step.name.toLowerCase().includes('javascript') || 
      step.name.toLowerCase().includes('script')
    );

    if (hasJsStep) return;

    const jsStep = new PlanStep({
      id: this._generateStepId('js'),
      name: 'Add JavaScript Functionality',
      type: 'implementation',
      description: 'Implement interactive features with JavaScript'
    });

    plan.addStep(jsStep);

    session.appliedFixes.push({
      type: 'warning-improvement',
      description: 'Added frontend JavaScript step',
      stepAdded: jsStep.id
    });
  }

  /**
   * Add backend server steps
   * 
   * @private
   */
  _addBackendServerSteps(plan, context, session) {
    const hasServerStep = plan.steps.some(step => 
      step.name.toLowerCase().includes('server') || 
      step.name.toLowerCase().includes('api')
    );

    if (hasServerStep) return;

    const serverStep = new PlanStep({
      id: this._generateStepId('server'),
      name: 'Setup Server and API',
      type: 'implementation',
      description: 'Create server endpoints and API routes'
    });

    plan.addStep(serverStep);

    session.appliedFixes.push({
      type: 'warning-improvement',
      description: 'Added backend server step',
      stepAdded: serverStep.id
    });
  }

  /**
   * Add backend database steps
   * 
   * @private
   */
  _addBackendDatabaseSteps(plan, context, session) {
    const hasDbStep = plan.steps.some(step => 
      step.name.toLowerCase().includes('database') || 
      step.name.toLowerCase().includes('data')
    );

    if (hasDbStep) return;

    const dbStep = new PlanStep({
      id: this._generateStepId('db'),
      name: 'Setup Database',
      type: 'setup',
      description: 'Configure database and data models'
    });

    plan.addStep(dbStep);

    session.appliedFixes.push({
      type: 'warning-improvement',
      description: 'Added backend database step',
      stepAdded: dbStep.id
    });
  }

  /**
   * Helper methods
   */

  _clonePlan(plan) {
    // Deep clone the plan object
    const cloned = Object.create(Object.getPrototypeOf(plan));
    
    // Copy basic properties
    cloned.id = plan.id;
    cloned.name = plan.name;
    cloned.description = plan.description;
    cloned.version = plan.version;
    cloned.context = JSON.parse(JSON.stringify(plan.context));
    cloned.metadata = JSON.parse(JSON.stringify(plan.metadata || {}));
    cloned.executionOrder = [...(plan.executionOrder || [])];
    cloned.successCriteria = [...(plan.successCriteria || [])];

    // Deep clone steps
    cloned.steps = plan.steps.map(step => {
      const clonedStep = Object.create(Object.getPrototypeOf(step));
      Object.assign(clonedStep, JSON.parse(JSON.stringify(step)));
      return clonedStep;
    });

    // Copy methods
    cloned.addStep = plan.addStep.bind(cloned);
    cloned.removeStep = plan.removeStep?.bind(cloned);
    cloned.getStepById = plan.getStepById?.bind(cloned);
    cloned.updateExecutionOrder = plan.updateExecutionOrder?.bind(cloned);

    return cloned;
  }

  _generateStepId(prefix = 'step') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `${prefix}-${timestamp}-${random}`;
  }

  _mapToValidStepType(invalidType) {
    const mapping = {
      'create': 'implementation',
      'build': 'implementation',
      'develop': 'implementation',
      'init': 'setup',
      'install': 'setup',
      'configure': 'setup',
      'test': 'testing',
      'verify': 'validation',
      'check': 'validation',
      'deploy': 'deployment',
      'publish': 'deployment'
    };

    return mapping[invalidType.toLowerCase()] || 'implementation';
  }

  _buildDependencyGraph(steps) {
    const graph = new Map();
    for (const step of steps) {
      graph.set(step.id, step.dependencies || []);
    }
    return graph;
  }

  _hasCircularDependency(stepId, graph, visiting) {
    if (visiting.has(stepId)) {
      return true;
    }
    
    visiting.add(stepId);
    const dependencies = graph.get(stepId) || [];
    
    for (const depId of dependencies) {
      if (this._hasCircularDependency(depId, graph, visiting)) {
        return true;
      }
    }
    
    visiting.delete(stepId);
    return false;
  }

  _updateDependencies(plan, newStepId) {
    // Add the new step as a dependency for implementation steps that don't have setup dependencies
    for (const step of plan.steps) {
      if (step.type === 'implementation' && step.dependencies.length === 0) {
        step.dependencies.push(newStepId);
      }
    }
  }
}

export { PlanRefiner };