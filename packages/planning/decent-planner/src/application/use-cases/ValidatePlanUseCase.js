/**
 * ValidatePlanUseCase - Application use case for plan validation
 * Following Clean Architecture - orchestrates domain logic
 */

import { TaskHierarchyService } from '../../domain/services/TaskHierarchyService.js';

export class ValidatePlanUseCase {
  constructor({
    planRepository,
    behaviorTreeValidator,
    logger
  }) {
    this.planRepository = planRepository;
    this.behaviorTreeValidator = behaviorTreeValidator;
    this.logger = logger;
  }

  async execute({ plan }) {
    this.logger.info('Starting plan validation', {
      planId: plan.id.toString()
    });
    
    try {
      const validation = {
        structure: null,
        behaviorTrees: null,
        completeness: null,
        overall: false
      };
      
      // Validate hierarchy structure
      validation.structure = TaskHierarchyService.validateHierarchy(plan.rootTask);
      
      // Validate behavior trees if present
      if (plan.hasBehaviorTrees()) {
        validation.behaviorTrees = await this.validateBehaviorTrees(plan.behaviorTrees);
      }
      
      // Validate completeness
      validation.completeness = this.validateCompleteness(plan);
      
      // Determine overall validity
      validation.overall = 
        validation.structure.valid &&
        (!validation.behaviorTrees || validation.behaviorTrees.allValid) &&
        validation.completeness.valid;
      
      this.logger.info('Plan validation completed', {
        planId: plan.id.toString(),
        valid: validation.overall
      });
      
      return {
        success: true,
        data: validation
      };
      
    } catch (error) {
      this.logger.error('Plan validation failed', {
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  async validateBehaviorTrees(behaviorTrees) {
    const results = [];
    
    for (const bt of behaviorTrees) {
      try {
        const validation = await this.behaviorTreeValidator.validate(bt);
        results.push({
          id: bt.id,
          valid: validation.valid,
          errors: validation.errors || []
        });
      } catch (error) {
        results.push({
          id: bt.id,
          valid: false,
          errors: [error.message]
        });
      }
    }
    
    return {
      allValid: results.every(r => r.valid),
      results
    };
  }

  validateCompleteness(plan) {
    const issues = [];
    const stats = TaskHierarchyService.calculateStatistics(plan.rootTask);
    
    // Check if all SIMPLE tasks have been evaluated for feasibility
    const simpleTasks = TaskHierarchyService.getSimpleTasks(plan.rootTask);
    const unevaluatedTasks = simpleTasks.filter(t => t.feasible === null);
    
    if (unevaluatedTasks.length > 0) {
      issues.push(`${unevaluatedTasks.length} SIMPLE tasks not evaluated for feasibility`);
    }
    
    // Check if infeasible tasks exist
    const infeasibleTasks = simpleTasks.filter(t => t.feasible === false);
    if (infeasibleTasks.length > 0) {
      issues.push(`${infeasibleTasks.length} SIMPLE tasks are infeasible`);
    }
    
    // Check if behavior trees were generated for feasible tasks
    if (plan.hasBehaviorTrees()) {
      const feasibleTasks = simpleTasks.filter(t => t.feasible === true);
      if (plan.getBehaviorTreeCount() < feasibleTasks.length) {
        issues.push(
          `Only ${plan.getBehaviorTreeCount()} behavior trees generated ` +
          `for ${feasibleTasks.length} feasible tasks`
        );
      }
    }
    
    return {
      valid: issues.length === 0,
      issues,
      statistics: stats
    };
  }
}