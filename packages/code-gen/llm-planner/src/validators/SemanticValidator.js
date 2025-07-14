/**
 * SemanticValidator - Validates the semantic correctness of plans
 * 
 * Ensures the plan makes logical sense, steps achieve stated goals,
 * and actions are appropriate for their context.
 */

class SemanticValidator {
  constructor(config = {}) {
    this.config = {
      validateLogicalFlow: true,
      checkResourceAvailability: true,
      validateNaming: true,
      ...config
    };

    // Define logical step sequences
    this.logicalSequences = {
      'setup': ['implementation', 'testing'],
      'implementation': ['testing', 'integration', 'validation'],
      'testing': ['validation', 'deployment'],
      'integration': ['testing', 'validation'],
      'validation': ['deployment'],
      'deployment': []
    };

    // Define conflicting action pairs
    this.conflictingActions = [
      ['create-file', 'delete-file'],
      ['create-directory', 'delete-directory'],
      ['install-dependency', 'uninstall-dependency']
    ];
  }

  /**
   * Validate semantic correctness of the plan
   * 
   * @param {Plan} plan - Plan to validate
   * @returns {Object} Validation result with errors and warnings
   */
  async validate(plan) {
    const result = {
      errors: [],
      warnings: [],
      suggestions: []
    };

    if (!plan.steps || plan.steps.length === 0) {
      return result;
    }

    // Validate logical flow
    if (this.config.validateLogicalFlow) {
      this._validateLogicalSequence(plan, result);
    }

    // Check for conflicting actions
    this._detectActionConflicts(plan, result);

    // Validate resource requirements
    if (this.config.checkResourceAvailability) {
      this._validateResourceRequirements(plan, result);
    }

    // Validate naming conventions
    if (this.config.validateNaming) {
      this._validateNamingConventions(plan, result);
    }

    // Check plan completeness
    this._validateCompleteness(plan, result);

    // Validate action appropriateness
    this._validateActionAppropriateness(plan, result);

    return result;
  }

  /**
   * Validate logical sequence of steps
   * @private
   */
  _validateLogicalSequence(plan, result) {
    const stepsByType = new Map();
    
    // Group steps by type
    for (const step of plan.steps) {
      if (!stepsByType.has(step.type)) {
        stepsByType.set(step.type, []);
      }
      stepsByType.get(step.type).push(step);
    }

    // Check if setup steps come first
    const setupSteps = stepsByType.get('setup') || [];
    const nonSetupSteps = plan.steps.filter(s => s.type !== 'setup');
    
    if (setupSteps.length > 0 && nonSetupSteps.length > 0) {
      for (const setupStep of setupSteps) {
        for (const otherStep of nonSetupSteps) {
          if (otherStep.dependencies && !otherStep.dependencies.includes(setupStep.id)) {
            result.warnings.push({
              type: 'illogical_sequence',
              setupStepId: setupStep.id,
              otherStepId: otherStep.id,
              message: `${otherStep.type} step '${otherStep.id}' should depend on setup step '${setupStep.id}'`
            });
          }
        }
      }
    }

    // Check type sequence logic
    for (const step of plan.steps) {
      const allowedNext = this.logicalSequences[step.type] || [];
      
      // Find steps that depend on this one
      const dependentSteps = plan.steps.filter(s => 
        s.dependencies && s.dependencies.includes(step.id)
      );

      for (const dependent of dependentSteps) {
        if (allowedNext.length > 0 && !allowedNext.includes(dependent.type)) {
          result.warnings.push({
            type: 'unusual_sequence',
            fromStep: step.id,
            fromType: step.type,
            toStep: dependent.id,
            toType: dependent.type,
            message: `Unusual sequence: ${step.type} -> ${dependent.type}. Expected: ${step.type} -> ${allowedNext.join(' or ')}`
          });
        }
      }
    }

    // Check for missing essential step types
    const essentialTypes = ['setup', 'implementation'];
    for (const essential of essentialTypes) {
      if (!stepsByType.has(essential)) {
        result.warnings.push({
          type: 'missing_essential_step',
          stepType: essential,
          message: `Plan is missing ${essential} steps`
        });
      }
    }
  }

  /**
   * Detect conflicting actions within the plan
   * @private
   */
  _detectActionConflicts(plan, result) {
    const actionsByTarget = new Map();

    // Group actions by their target (file path, directory, etc.)
    for (const step of plan.steps) {
      if (!step.actions) continue;

      for (const action of step.actions) {
        const target = this._getActionTarget(action);
        if (target) {
          if (!actionsByTarget.has(target)) {
            actionsByTarget.set(target, []);
          }
          actionsByTarget.get(target).push({
            stepId: step.id,
            action: action
          });
        }
      }
    }

    // Check for conflicts
    for (const [target, actions] of actionsByTarget) {
      // Check for direct conflicts (create then delete same file)
      for (let i = 0; i < actions.length - 1; i++) {
        for (let j = i + 1; j < actions.length; j++) {
          const action1 = actions[i].action;
          const action2 = actions[j].action;

          if (this._areActionsConflicting(action1, action2)) {
            result.errors.push({
              type: 'conflicting_actions',
              target,
              action1: { type: action1.type, stepId: actions[i].stepId },
              action2: { type: action2.type, stepId: actions[j].stepId },
              message: `Conflicting actions on ${target}: ${action1.type} (${actions[i].stepId}) and ${action2.type} (${actions[j].stepId})`
            });
          }
        }
      }

      // Check for redundant actions
      const createActions = actions.filter(a => a.action.type === 'create-file');
      if (createActions.length > 1) {
        result.warnings.push({
          type: 'redundant_actions',
          target,
          actions: createActions.map(a => a.stepId),
          message: `Multiple create-file actions for ${target} in steps: ${createActions.map(a => a.stepId).join(', ')}`
        });
      }
    }
  }

  /**
   * Validate resource requirements
   * @private
   */
  _validateResourceRequirements(plan, result) {
    const requiredResources = new Set();
    const availableResources = new Set();

    // First pass: identify what resources are created
    for (const step of plan.steps) {
      if (!step.actions) continue;

      for (const action of step.actions) {
        if (action.type === 'create-file' || action.type === 'create-directory') {
          availableResources.add(action.path);
        }
        if (action.type === 'install-dependency' && action.package) {
          availableResources.add(`package:${action.package}`);
        }
      }
    }

    // Second pass: check resource requirements
    for (const step of plan.steps) {
      // Check step inputs
      if (step.inputs) {
        for (const [key, value] of Object.entries(step.inputs)) {
          if (key.includes('file') || key.includes('path')) {
            requiredResources.add(value);
          }
        }
      }

      // Check action requirements
      if (step.actions) {
        for (const action of step.actions) {
          if (action.type === 'update-file' && action.path) {
            if (!availableResources.has(action.path)) {
              result.errors.push({
                type: 'missing_resource',
                stepId: step.id,
                resource: action.path,
                message: `Step '${step.id}' tries to update non-existent file: ${action.path}`
              });
            }
          }

          if (action.type === 'run-command' && action.command) {
            // Check for commands that require specific packages
            const packageCommands = {
              'npm': 'package:npm',
              'jest': 'package:jest',
              'eslint': 'package:eslint',
              'tsc': 'package:typescript'
            };

            for (const [cmd, pkg] of Object.entries(packageCommands)) {
              if (action.command.includes(cmd) && !availableResources.has(pkg)) {
                result.warnings.push({
                  type: 'possibly_missing_dependency',
                  stepId: step.id,
                  command: cmd,
                  package: pkg,
                  message: `Command '${cmd}' used but ${pkg} may not be installed`
                });
              }
            }
          }
        }
      }
    }
  }

  /**
   * Validate naming conventions
   * @private
   */
  _validateNamingConventions(plan, result) {
    // Check plan name
    if (plan.name && !this._isValidPlanName(plan.name)) {
      result.suggestions.push({
        type: 'naming_convention',
        field: 'plan.name',
        current: plan.name,
        message: 'Plan name should be descriptive and use proper capitalization'
      });
    }

    // Check step names
    for (const step of plan.steps) {
      if (step.name && !this._isValidStepName(step.name)) {
        result.suggestions.push({
          type: 'naming_convention',
          field: 'step.name',
          stepId: step.id,
          current: step.name,
          message: 'Step names should start with a verb and be descriptive'
        });
      }

      // Check file naming in actions
      if (step.actions) {
        for (const action of step.actions) {
          if ((action.type === 'create-file' || action.type === 'update-file') && action.path) {
            const fileName = action.path.split('/').pop();
            if (!this._isValidFileName(fileName)) {
              result.warnings.push({
                type: 'file_naming_convention',
                stepId: step.id,
                fileName,
                message: `File name '${fileName}' may not follow conventions`
              });
            }
          }
        }
      }
    }
  }

  /**
   * Validate plan completeness
   * @private
   */
  _validateCompleteness(plan, result) {
    // Check if plan achieves its stated goals
    if (plan.context && plan.context.goals) {
      const achievedGoals = this._analyzeAchievedGoals(plan);
      
      for (const goal of plan.context.goals) {
        if (!achievedGoals.has(goal)) {
          result.warnings.push({
            type: 'unachieved_goal',
            goal,
            message: `Goal '${goal}' may not be fully achieved by this plan`
          });
        }
      }
    }

    // Check for test coverage
    const hasImplementation = plan.steps.some(s => s.type === 'implementation');
    const hasTesting = plan.steps.some(s => s.type === 'testing');
    
    if (hasImplementation && !hasTesting) {
      result.warnings.push({
        type: 'missing_tests',
        message: 'Plan includes implementation but no testing steps'
      });
    }

    // Check for documentation
    const createsCode = plan.steps.some(s => 
      s.actions && s.actions.some(a => 
        a.type === 'create-file' && 
        (a.path?.endsWith('.js') || a.path?.endsWith('.ts'))
      )
    );

    const hasDocumentation = plan.steps.some(s =>
      s.actions && s.actions.some(a =>
        a.type === 'create-file' && 
        (a.path?.endsWith('.md') || a.content?.includes('/**'))
      )
    );

    if (createsCode && !hasDocumentation) {
      result.suggestions.push({
        type: 'missing_documentation',
        message: 'Consider adding documentation for the code being created'
      });
    }
  }

  /**
   * Validate action appropriateness for step types
   * @private
   */
  _validateActionAppropriateness(plan, result) {
    const appropriateActions = {
      'setup': ['create-directory', 'create-file', 'install-dependency'],
      'implementation': ['create-file', 'update-file'],
      'testing': ['create-file', 'run-command'],
      'integration': ['update-file', 'run-command'],
      'validation': ['run-command'],
      'deployment': ['run-command', 'update-file']
    };

    for (const step of plan.steps) {
      const allowedActions = appropriateActions[step.type] || [];
      
      if (step.actions && allowedActions.length > 0) {
        for (const action of step.actions) {
          if (!allowedActions.includes(action.type)) {
            result.warnings.push({
              type: 'inappropriate_action',
              stepId: step.id,
              stepType: step.type,
              actionType: action.type,
              message: `Action type '${action.type}' is unusual for ${step.type} step`
            });
          }
        }
      }
    }
  }

  // Helper methods

  /**
   * Get the target of an action (file path, directory, etc.)
   * @private
   */
  _getActionTarget(action) {
    if (action.path) return action.path;
    if (action.directory) return action.directory;
    if (action.package) return `package:${action.package}`;
    return null;
  }

  /**
   * Check if two actions are conflicting
   * @private
   */
  _areActionsConflicting(action1, action2) {
    for (const [type1, type2] of this.conflictingActions) {
      if ((action1.type === type1 && action2.type === type2) ||
          (action1.type === type2 && action2.type === type1)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Analyze which goals are achieved by the plan
   * @private
   */
  _analyzeAchievedGoals(plan) {
    const achieved = new Set();
    
    // Simple heuristic - check if plan creates expected artifacts
    for (const step of plan.steps) {
      if (step.outputs) {
        for (const output of Object.values(step.outputs)) {
          if (Array.isArray(output)) {
            output.forEach(item => achieved.add(item));
          } else {
            achieved.add(output);
          }
        }
      }
    }

    return achieved;
  }

  /**
   * Validate plan name format
   * @private
   */
  _isValidPlanName(name) {
    return name.length > 3 && /^[A-Z]/.test(name);
  }

  /**
   * Validate step name format
   * @private
   */
  _isValidStepName(name) {
    const startsWithVerb = /^(create|build|set|initialize|implement|test|validate|deploy|configure|install)/i.test(name);
    return startsWithVerb && name.length > 5;
  }

  /**
   * Validate file name format
   * @private
   */
  _isValidFileName(fileName) {
    // Check for common naming patterns
    const validPatterns = [
      /^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)*\.[a-z]+$/, // camelCase
      /^[a-z]+(?:-[a-z]+)*\.[a-z]+$/, // kebab-case
      /^[a-z]+(?:_[a-z]+)*\.[a-z]+$/, // snake_case
      /^[A-Z][a-z]*(?:[A-Z][a-z]*)*\.[a-z]+$/, // PascalCase
      /^\.?[a-z]+rc(?:\.[a-z]+)?$/, // .eslintrc, .babelrc
      /^[A-Z]+(?:\.md)?$/, // README, LICENSE
      /^package\.json$/, // package.json
      /^tsconfig\.json$/ // tsconfig.json
    ];

    return validPatterns.some(pattern => pattern.test(fileName));
  }
}

export { SemanticValidator };