/**
 * CompletenessValidator - Validates that plans are complete and ready for execution
 * 
 * Ensures all necessary information is present, goals are achievable,
 * and the plan covers all required aspects.
 */

class CompletenessValidator {
  constructor(config = {}) {
    this.config = {
      requireSuccessCriteria: true,
      requireEstimates: true,
      requireRollback: false,
      minStepDetail: 'medium', // 'low', 'medium', 'high'
      ...config
    };
  }

  /**
   * Validate plan completeness
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

    // Check plan-level completeness
    this._validatePlanCompleteness(plan, result);

    // Check step completeness
    this._validateStepCompleteness(plan, result);

    // Validate coverage of requirements
    this._validateRequirementsCoverage(plan, result);

    // Check for success criteria
    if (this.config.requireSuccessCriteria) {
      this._validateSuccessCriteria(plan, result);
    }

    // Validate estimates if required
    if (this.config.requireEstimates) {
      this._validateEstimates(plan, result);
    }

    // Check rollback provisions if required
    if (this.config.requireRollback) {
      this._validateRollbackProvisions(plan, result);
    }

    // Calculate completeness score
    const score = this._calculateCompletenessScore(plan, result);
    result.completenessScore = score;

    if (score < 70) {
      result.warnings.push({
        type: 'low_completeness_score',
        score,
        message: `Plan completeness score is low (${score}%). Consider adding more detail.`
      });
    }

    return result;
  }

  /**
   * Validate plan-level completeness
   * @private
   */
  _validatePlanCompleteness(plan, result) {
    // Handle null/undefined plan
    if (!plan) {
      result.errors.push({
        type: 'missing_context',
        message: 'Plan must include context information'
      });
      return;
    }

    // Check for description
    if (!plan.description || plan.description.length < 10) {
      result.warnings.push({
        type: 'missing_description',
        field: 'plan.description',
        message: 'Plan should have a detailed description'
      });
    }

    // Check for context - handle both null and empty objects
    // Be more lenient when all requirements are disabled
    const isLenientMode = !this.config.requireSuccessCriteria && 
                         !this.config.requireEstimates && 
                         !this.config.requireRollback &&
                         this.config.minStepDetail === 'low';
    
    if (!plan.context || plan.context === null || 
        (typeof plan.context === 'object' && Object.keys(plan.context).length === 0)) {
      if (!isLenientMode) {
        result.errors.push({
          type: 'missing_context',
          message: 'Plan must include context information'
        });
      } else {
        result.warnings.push({
          type: 'missing_context',
          message: 'Plan should include context information'
        });
      }
    } else {
      // Validate context completeness
      if (!plan.context.projectType || plan.context.projectType === 'unknown') {
        result.warnings.push({
          type: 'incomplete_context',
          field: 'context.projectType',
          message: 'Context should specify project type'
        });
      }

      if (!plan.context.technologies || 
          (typeof plan.context.technologies === 'object' && Object.keys(plan.context.technologies).length === 0) ||
          (Array.isArray(plan.context.technologies) && plan.context.technologies.length === 0)) {
        result.warnings.push({
          type: 'incomplete_context',
          field: 'context.technologies',
          message: 'Context should list technologies being used'
        });
      }

      // Check if requirements are meaningful
      let hasRequirements = false;
      if (plan.context.requirements) {
        if (typeof plan.context.requirements === 'string' && plan.context.requirements.trim().length > 0) {
          hasRequirements = true;
        } else if (Array.isArray(plan.context.requirements) && plan.context.requirements.length > 0) {
          hasRequirements = true;
        } else if (typeof plan.context.requirements === 'object') {
          // Check if it has meaningful content beyond just empty functional/nonFunctional arrays
          const keys = Object.keys(plan.context.requirements);
          if (keys.length > 2 || // Has more than just functional/nonFunctional
              (plan.context.requirements.functional && plan.context.requirements.functional.length > 0) ||
              (plan.context.requirements.nonFunctional && plan.context.requirements.nonFunctional.length > 0)) {
            hasRequirements = true;
          }
          // Check for other properties that might contain requirements
          for (const key of keys) {
            if (key !== 'functional' && key !== 'nonFunctional' && plan.context.requirements[key]) {
              hasRequirements = true;
              break;
            }
          }
        }
      }
      
      if (!hasRequirements) {
        result.warnings.push({
          type: 'incomplete_context',
          field: 'context.requirements',
          message: 'Context should include original requirements'
        });
      }
    }

    // Check for metadata
    if (!plan.metadata) {
      result.warnings.push({
        type: 'missing_metadata',
        message: 'Plan should include metadata (creator, timestamps, etc.)'
      });
    }
  }

  /**
   * Validate step completeness
   * @private
   */
  _validateStepCompleteness(plan, result) {
    if (!plan.steps || plan.steps.length === 0) {
      result.errors.push({
        type: 'no_steps',
        message: 'Plan must contain at least one step'
      });
      return;
    }

    for (const step of plan.steps) {
      // Check step description
      if (!step.description || step.description.length < 10) {
        result.warnings.push({
          type: 'missing_step_description',
          stepId: step.id,
          message: `Step '${step.id}' should have a detailed description`
        });
      }

      // Check for rationale
      if (this.config.minStepDetail !== 'low' && !step.rationale) {
        result.suggestions.push({
          type: 'missing_rationale',
          stepId: step.id,
          message: `Consider adding rationale for step '${step.id}'`
        });
      }

      // Check for inputs/outputs specification
      if (this.config.minStepDetail === 'high') {
        if (!step.inputs || (typeof step.inputs === 'object' && Object.keys(step.inputs).length === 0)) {
          result.warnings.push({
            type: 'missing_inputs',
            stepId: step.id,
            message: `Step '${step.id}' should specify its inputs`
          });
        }

        if (!step.outputs || (typeof step.outputs === 'object' && Object.keys(step.outputs).length === 0)) {
          result.warnings.push({
            type: 'missing_outputs',
            stepId: step.id,
            message: `Step '${step.id}' should specify its outputs`
          });
        }
      }

      // Validate actions completeness
      if (!step.actions || step.actions.length === 0) {
        result.errors.push({
          type: 'no_actions',
          stepId: step.id,
          message: `Step '${step.id}' must contain at least one action`
        });
      } else {
        this._validateActionsCompleteness(step, result);
      }

      // Check for validation criteria
      if (step.type === 'implementation' || step.type === 'setup') {
        if (!step.validation || !step.validation.criteria || 
            (Array.isArray(step.validation.criteria) && step.validation.criteria.length === 0)) {
          result.suggestions.push({
            type: 'missing_validation_criteria',
            stepId: step.id,
            message: `Step '${step.id}' should include validation criteria`
          });
        }
      }
    }
  }

  /**
   * Validate action completeness
   * @private
   */
  _validateActionsCompleteness(step, result) {
    for (const action of step.actions) {
      // Check for action description
      if (!action.description) {
        result.warnings.push({
          type: 'missing_action_description',
          stepId: step.id,
          actionType: action.type,
          message: `Action '${action.type}' in step '${step.id}' should have a description`
        });
      }

      // Check action-specific completeness
      switch (action.type) {
        case 'create-file':
          if (!action.content && !action.template) {
            result.errors.push({
              type: 'incomplete_action',
              stepId: step.id,
              actionType: action.type,
              message: `create-file action must specify content or template`
            });
          }
          break;

        case 'run-command':
          if (!action.workingDirectory && this.config.minStepDetail === 'high') {
            result.warnings.push({
              type: 'missing_working_directory',
              stepId: step.id,
              message: `run-command action should specify working directory`
            });
          }
          if (!action.expectedOutput && this.config.minStepDetail !== 'low') {
            result.suggestions.push({
              type: 'missing_expected_output',
              stepId: step.id,
              message: `Consider specifying expected output for command`
            });
          }
          break;

        case 'update-file':
          if (!action.updates && !action.patch) {
            result.errors.push({
              type: 'incomplete_action',
              stepId: step.id,
              actionType: action.type,
              message: `update-file action must specify updates or patch`
            });
          }
          break;
      }
    }
  }

  /**
   * Validate requirements coverage
   * @private
   */
  _validateRequirementsCoverage(plan, result) {
    if (!plan.context || !plan.context.requirements) {
      return; // Can't validate without requirements
    }

    let requirements = plan.context.requirements;
    
    // Handle the case where requirements is a malformed object due to string spreading
    if (typeof requirements === 'object' && !Array.isArray(requirements)) {
      // Check if it looks like a spread string (has numeric keys)
      const keys = Object.keys(requirements);
      const hasNumericKeys = keys.some(key => !isNaN(parseInt(key)));
      
      if (hasNumericKeys) {
        // Reconstruct the original string
        const chars = [];
        for (let i = 0; i < keys.length; i++) {
          if (requirements[i] !== undefined) {
            chars.push(requirements[i]);
          }
        }
        requirements = chars.join('');
      }
    }

    const features = this._extractFeaturesFromRequirements(requirements);
    const implementedFeatures = this._extractImplementedFeatures(plan);

    // Check each required feature
    for (const feature of features) {
      if (!implementedFeatures.has(feature.toLowerCase())) {
        result.warnings.push({
          type: 'uncovered_requirement',
          feature,
          message: `Required feature '${feature}' may not be fully implemented`
        });
      }
    }

    // Calculate coverage percentage
    const coveredCount = features.filter(f => implementedFeatures.has(f.toLowerCase())).length;
    const coverage = features.length > 0 
      ? (coveredCount / features.length) * 100 
      : 100;

    if (coverage < 80 && features.length > 0) {
      result.warnings.push({
        type: 'low_requirement_coverage',
        coverage: Math.round(coverage),
        message: `Only ${Math.round(coverage)}% of requirements appear to be covered`
      });
    }
  }

  /**
   * Validate success criteria
   * @private
   */
  _validateSuccessCriteria(plan, result) {
    if (!plan.successCriteria || plan.successCriteria.length === 0) {
      result.errors.push({
        type: 'missing_success_criteria',
        message: 'Plan must define success criteria'
      });
      return;
    }

    // Check criteria quality
    for (const criterion of plan.successCriteria) {
      if (typeof criterion === 'string') {
        if (criterion.length < 10) {
          result.warnings.push({
            type: 'vague_success_criterion',
            criterion,
            message: `Success criterion '${criterion}' is too vague`
          });
        }

        // Check for measurable criteria
        const measurableKeywords = ['pass', 'fail', 'error', 'complete', 'successful', 'working'];
        const hasMeasurable = measurableKeywords.some(keyword => 
          criterion.toLowerCase().includes(keyword)
        );

        if (!hasMeasurable) {
          result.suggestions.push({
            type: 'unmeasurable_criterion',
            criterion,
            message: `Success criterion '${criterion}' should be measurable`
          });
        }
      }
    }

    // Check if criteria align with plan type
    const hasTestingCriteria = plan.successCriteria.some(c => 
      c.toLowerCase().includes('test') || c.toLowerCase().includes('pass')
    );

    const hasTestingSteps = plan.steps.some(s => s.type === 'testing');

    if (hasTestingSteps && !hasTestingCriteria) {
      result.warnings.push({
        type: 'missing_test_criteria',
        message: 'Plan includes testing steps but no test-related success criteria'
      });
    }
  }

  /**
   * Validate estimates
   * @private
   */
  _validateEstimates(plan, result) {
    // Check plan-level estimate
    if (!plan.metadata || !plan.metadata.estimatedDuration) {
      result.warnings.push({
        type: 'missing_duration_estimate',
        message: 'Plan should include an estimated duration'
      });
    }

    // Check step-level estimates if high detail required
    if (this.config.minStepDetail === 'high') {
      for (const step of plan.steps || []) {
        if (!step.estimatedDuration) {
          result.suggestions.push({
            type: 'missing_step_estimate',
            stepId: step.id,
            message: `Step '${step.id}' should include duration estimate`
          });
        }
      }
    }

    // Check complexity rating
    if (!plan.metadata || !plan.metadata.complexity) {
      result.suggestions.push({
        type: 'missing_complexity_rating',
        message: 'Plan should include a complexity rating'
      });
    }
  }

  /**
   * Validate rollback provisions
   * @private
   */
  _validateRollbackProvisions(plan, result) {
    let hasRollback = false;

    for (const step of plan.steps || []) {
      if (step.rollback && step.rollback.actions && step.rollback.actions.length > 0) {
        hasRollback = true;

        // Validate rollback completeness
        if (step.type === 'setup' || step.type === 'implementation') {
          // These steps should have comprehensive rollback
          const createsResources = step.actions.some(a => 
            ['create-file', 'create-directory', 'install-dependency'].includes(a.type)
          );

          if (createsResources) {
            const hasCleanup = step.rollback.actions.some(a =>
              ['delete-file', 'delete-directory', 'uninstall-dependency'].includes(a.type)
            );

            if (!hasCleanup) {
              result.warnings.push({
                type: 'incomplete_rollback',
                stepId: step.id,
                message: `Step '${step.id}' creates resources but rollback doesn't clean them up`
              });
            }
          }
        }
      } else if (step.type === 'setup' || step.type === 'deployment') {
        // These steps should have rollback
        result.warnings.push({
          type: 'missing_rollback',
          stepId: step.id,
          message: `${step.type} step '${step.id}' should include rollback provisions`
        });
      }
    }

    if (!hasRollback) {
      result.errors.push({
        type: 'no_rollback_provisions',
        message: 'Plan must include rollback provisions for critical steps'
      });
    }
  }

  /**
   * Calculate completeness score
   * @private
   */
  _calculateCompletenessScore(plan, result) {
    let score = 0;
    
    // Base score components - much more strict
    let baseScore = 0;
    
    // Plan structure (20 points) - balanced
    if (plan.name && plan.name.length > 10) baseScore += 4;
    if (plan.description && plan.description.length > 50) baseScore += 10;
    else if (plan.description && plan.description.length > 20) baseScore += 6;
    else if (plan.description && plan.description.length > 10) baseScore += 3;
    if (plan.context && plan.context !== null && Object.keys(plan.context).length > 0) baseScore += 5;
    if (plan.steps && plan.steps.length > 0) baseScore += 4;
    
    // Context completeness (25 points) - balanced requirements
    if (plan.context && Object.keys(plan.context).length > 0) {
      if (plan.context.projectType && plan.context.projectType !== 'unknown') baseScore += 8;
      
      // Check technologies more strictly
      const hasTechnologies = plan.context.technologies && 
        ((typeof plan.context.technologies === 'object' && Object.keys(plan.context.technologies).length > 0) ||
         (Array.isArray(plan.context.technologies) && plan.context.technologies.length > 0));
      if (hasTechnologies) baseScore += 9;
      
      if (plan.context.requirements) baseScore += 9;
    } else {
      // Give some base points for minimal plans in lenient mode
      const isLenientMode = !this.config.requireSuccessCriteria && 
                           !this.config.requireEstimates && 
                           !this.config.requireRollback &&
                           this.config.minStepDetail === 'low';
      if (isLenientMode) {
        baseScore += 22; // Give some context points for minimal plans
      }
    }
    
    // Step quality (25 points) - balanced
    const avgStepDetail = this._calculateAverageStepDetail(plan);
    baseScore += Math.round(avgStepDetail * 25);
    
    // Success criteria (20 points) - balanced
    if (plan.successCriteria && plan.successCriteria.length > 0) {
      baseScore += 6;
      if (plan.successCriteria.length > 2) baseScore += 6;
      // Bonus for detailed criteria
      const hasDetailedCriteria = plan.successCriteria.some(c => 
        typeof c === 'string' && c.length > 20
      );
      if (hasDetailedCriteria) baseScore += 8;
      
      // Extra bonus for comprehensive criteria (5+ detailed criteria)
      if (plan.successCriteria.length >= 5 && hasDetailedCriteria) {
        baseScore += 8;
      }
    }
    
    // Metadata (10 points) - balanced
    if (plan.metadata) {
      baseScore += 2;
      if (plan.metadata.estimatedDuration) baseScore += 4;
      if (plan.metadata.complexity) baseScore += 4;
    }
    
    score = baseScore;
    
    // Deduct points for issues - balanced penalties
    const weights = {
      error: 15,
      warning: 3,
      suggestion: 1
    };
    
    score -= result.errors.length * weights.error;
    score -= result.warnings.length * weights.warning;
    score -= result.suggestions.length * weights.suggestion;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate average step detail level
   * @private
   */
  _calculateAverageStepDetail(plan) {
    if (!plan.steps || plan.steps.length === 0) return 0;

    let totalDetail = 0;
    for (const step of plan.steps) {
      let stepDetail = 0;
      if (step.description) stepDetail += 0.2;
      if (step.rationale) stepDetail += 0.2;
      if (step.inputs) stepDetail += 0.15;
      if (step.outputs) stepDetail += 0.15;
      if (step.validation) stepDetail += 0.15;
      if (step.estimatedDuration) stepDetail += 0.15;
      
      totalDetail += stepDetail;
    }

    return totalDetail / plan.steps.length;
  }

  /**
   * Extract features from requirements text
   * @private
   */
  _extractFeaturesFromRequirements(requirements) {
    if (typeof requirements === 'string') {
      // Enhanced keyword extraction with synonyms
      const keywords = [
        'authentication', 'auth', 'login', 'register',
        'api', 'rest', 'endpoint',
        'database', 'db', 'storage', 'data',
        'frontend', 'ui', 'interface', 'client',
        'backend', 'server', 'service',
        'testing', 'test', 'spec', 'unit test',
        'deployment', 'deploy', 'production',
        'crud', 'create', 'read', 'update', 'delete',
        'search', 'filter', 'query',
        'user', 'admin', 'role',
        'dashboard', 'panel', 'console',
        'form', 'input', 'validation',
        'sync', 'synchronization', 'real-time',
        'offline', 'cache', 'local',
        'notification', 'alert', 'push',
        'analytics', 'tracking', 'metrics',
        'reporting', 'report', 'export'
      ];
      
      const found = [];
      const lowerReq = requirements.toLowerCase();
      
      // Extract individual words and phrases
      const words = lowerReq.split(/[\s,.-]+/);
      
      for (const keyword of keywords) {
        if (lowerReq.includes(keyword)) {
          // Normalize similar keywords
          if (['auth', 'login', 'register'].includes(keyword)) {
            if (!found.includes('authentication')) found.push('authentication');
          } else if (['rest', 'endpoint'].includes(keyword)) {
            if (!found.includes('api')) found.push('api');
          } else if (['db', 'storage', 'data'].includes(keyword)) {
            if (!found.includes('database')) found.push('database');
          } else if (['ui', 'interface', 'client'].includes(keyword)) {
            if (!found.includes('frontend')) found.push('frontend');
          } else if (['server', 'service'].includes(keyword)) {
            if (!found.includes('backend')) found.push('backend');
          } else if (['test', 'spec', 'unit test'].includes(keyword)) {
            if (!found.includes('testing')) found.push('testing');
          } else if (['deploy', 'production'].includes(keyword)) {
            if (!found.includes('deployment')) found.push('deployment');
          } else if (['create', 'read', 'update', 'delete'].includes(keyword)) {
            if (!found.includes('crud')) found.push('crud');
          } else if (['synchronization', 'real-time'].includes(keyword)) {
            if (!found.includes('sync')) found.push('sync');
          } else if (['cache', 'local'].includes(keyword)) {
            if (!found.includes('offline')) found.push('offline');
          } else if (['alert', 'push'].includes(keyword)) {
            if (!found.includes('notification')) found.push('notification');
          } else if (['tracking', 'metrics'].includes(keyword)) {
            if (!found.includes('analytics')) found.push('analytics');
          } else if (['report', 'export'].includes(keyword)) {
            if (!found.includes('reporting')) found.push('reporting');
          } else if (!found.includes(keyword)) {
            found.push(keyword);
          }
        }
      }
      
      return found;
    } else if (Array.isArray(requirements)) {
      return requirements;
    } else if (typeof requirements === 'object' && requirements.features) {
      return requirements.features;
    }
    
    return [];
  }

  /**
   * Extract implemented features from plan
   * @private
   */
  _extractImplementedFeatures(plan) {
    const implemented = new Set();

    // Check step names and descriptions
    for (const step of plan.steps || []) {
      const text = `${step.name} ${step.description || ''}`.toLowerCase();
      
      // Add features based on step content
      if (text.includes('auth')) implemented.add('authentication');
      if (text.includes('api')) implemented.add('api');
      if (text.includes('database') || text.includes('db')) implemented.add('database');
      if (text.includes('frontend') || text.includes('ui')) implemented.add('frontend');
      if (text.includes('backend') || text.includes('server')) implemented.add('backend');
      if (text.includes('test')) implemented.add('testing');
      if (text.includes('deploy')) implemented.add('deployment');
      if (text.includes('crud')) implemented.add('crud');
      if (text.includes('form')) implemented.add('form');
      if (text.includes('validat')) implemented.add('validation');

      // Check actions for more specific features
      for (const action of step.actions || []) {
        if (action.path) {
          const path = action.path.toLowerCase();
          if (path.includes('auth')) implemented.add('authentication');
          if (path.includes('api')) implemented.add('api');
          if (path.includes('test')) implemented.add('testing');
          if (path.includes('component')) implemented.add('frontend');
        }
      }
    }

    return implemented;
  }
}

export { CompletenessValidator };
