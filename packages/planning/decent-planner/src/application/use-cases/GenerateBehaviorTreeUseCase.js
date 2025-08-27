/**
 * GenerateBehaviorTreeUseCase - Application use case for behavior tree generation
 * Following Clean Architecture - orchestrates domain logic with ports
 */

import { TaskHierarchyService } from '../../domain/services/TaskHierarchyService.js';

export class GenerateBehaviorTreeUseCase {
  constructor({
    taskRepository,
    behaviorTreePlanner,
    logger
  }) {
    this.taskRepository = taskRepository;
    this.behaviorTreePlanner = behaviorTreePlanner;
    this.logger = logger;
  }

  async execute({ rootTask }) {
    this.logger.info('Starting behavior tree generation', {
      rootTaskId: rootTask.id.toString()
    });
    
    try {
      const behaviorTrees = [];
      
      // Get all SIMPLE tasks that are feasible and have tools
      const simpleTasks = TaskHierarchyService.getSimpleTasks(rootTask)
        .filter(task => task.feasible && task.hasTools());
      
      this.logger.debug('Generating behavior trees for tasks', {
        count: simpleTasks.length
      });
      
      // Generate behavior tree for each simple task
      for (const task of simpleTasks) {
        try {
          const behaviorTree = await this.generateForTask(task);
          if (behaviorTree) {
            behaviorTrees.push(behaviorTree);
          }
        } catch (error) {
          this.logger.error('Failed to generate behavior tree for task', {
            taskId: task.id.toString(),
            error: error.message
          });
        }
      }
      
      this.logger.info('Behavior tree generation completed', {
        generated: behaviorTrees.length,
        total: simpleTasks.length
      });
      
      return {
        success: true,
        data: {
          behaviorTrees,
          statistics: {
            totalTasks: simpleTasks.length,
            generatedTrees: behaviorTrees.length,
            failedTrees: simpleTasks.length - behaviorTrees.length
          }
        }
      };
      
    } catch (error) {
      this.logger.error('Behavior tree generation failed', {
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  async generateForTask(task) {
    this.logger.debug('Generating behavior tree for task', {
      taskId: task.id.toString(),
      description: task.description,
      toolCount: task.getToolCount()
    });
    
    // Prepare tools for the planner
    const toolsForPlanner = task.tools.map(tool => ({
      name: tool.name,
      description: tool.description || '',
      inputSchema: tool.inputSchema || {},
      outputSchema: tool.outputSchema || {},
      confidence: tool.confidence || 1.0
    }));
    
    // Use the behavior tree planner to create a plan
    const planResult = await this.behaviorTreePlanner.makePlan(
      task.description,
      toolsForPlanner
    );
    
    if (planResult && planResult.success && planResult.data && planResult.data.plan) {
      return {
        id: task.id.toString(),
        taskDescription: task.description,
        ...planResult.data.plan
      };
    }
    
    return null;
  }
}