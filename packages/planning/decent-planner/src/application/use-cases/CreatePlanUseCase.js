/**
 * CreatePlanUseCase - Application use case for creating a new plan
 * Following Clean Architecture - orchestrates domain logic
 */

import { Plan } from '../../domain/entities/Plan.js';
import { Task } from '../../domain/entities/Task.js';
import { PlanStatus } from '../../domain/value-objects/PlanStatus.js';

export class CreatePlanUseCase {
  constructor({
    planRepository,
    taskRepository,
    logger
  }) {
    this.planRepository = planRepository;
    this.taskRepository = taskRepository;
    this.logger = logger;
  }

  async execute({ goal, context = {} }) {
    this.logger.info('Creating new plan', { goal });
    
    try {
      // Validate input
      if (!goal || typeof goal !== 'string' || goal.trim().length === 0) {
        throw new Error('Goal is required and must be a non-empty string');
      }
      
      // Create root task
      const rootTask = new Task({
        description: goal,
        complexity: null, // Will be determined by classification
        inputs: context.inputs || [],
        outputs: context.outputs || [],
        depth: 0
      });
      
      // Save task
      await this.taskRepository.save(rootTask);
      
      // Create plan
      const plan = new Plan({
        goal: goal.trim(),
        rootTask,
        status: PlanStatus.draft(),
        context
      });
      
      // Save plan
      const savedPlan = await this.planRepository.save(plan);
      
      this.logger.info('Plan created successfully', { 
        planId: savedPlan.id.toString() 
      });
      
      return {
        success: true,
        data: savedPlan
      };
      
    } catch (error) {
      this.logger.error('Failed to create plan', { 
        error: error.message,
        goal 
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }
}