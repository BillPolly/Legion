/**
 * DecomposeTaskUseCase - Application use case for task decomposition
 * Following Clean Architecture - orchestrates domain logic with ports
 */

import { Task } from '../../domain/entities/Task.js';
import { TaskHierarchyService } from '../../domain/services/TaskHierarchyService.js';

export class DecomposeTaskUseCase {
  constructor({
    taskRepository,
    complexityClassifier,
    taskDecomposer,
    logger,
    maxDepth = 5,
    minSubtasks = 2,
    maxSubtasks = 10
  }) {
    this.taskRepository = taskRepository;
    this.complexityClassifier = complexityClassifier;
    this.taskDecomposer = taskDecomposer;
    this.logger = logger;
    this.maxDepth = maxDepth;
    this.minSubtasks = minSubtasks;
    this.maxSubtasks = maxSubtasks;
  }

  async execute({ task, context = {}, progressCallback = null }) {
    this.logger.info('Starting task decomposition', { 
      taskId: task.id,
      description: task.description 
    });
    
    try {
      // Decompose recursively
      const decomposedTask = await this.decomposeRecursively(
        task, 
        context, 
        progressCallback
      );
      
      // Validate the hierarchy
      const validation = TaskHierarchyService.validateHierarchy(decomposedTask);
      if (!validation.valid) {
        throw new Error(`Invalid hierarchy: ${validation.errors.join(', ')}`);
      }
      
      // Calculate statistics
      const statistics = TaskHierarchyService.calculateStatistics(decomposedTask);
      
      // Save the decomposed hierarchy
      await this.saveHierarchy(decomposedTask);
      
      this.logger.info('Task decomposition completed', { 
        taskId: task.id,
        statistics 
      });
      
      return {
        success: true,
        data: {
          task: decomposedTask,
          validation,
          statistics
        }
      };
      
    } catch (error) {
      this.logger.error('Task decomposition failed', { 
        error: error.message,
        taskId: task.id.toString() 
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  async decomposeRecursively(task, context, progressCallback, depth = 0) {
    // Check depth limit
    if (depth >= this.maxDepth) {
      this.logger.warn('Maximum depth reached, marking as SIMPLE', {
        taskId: task.id,
        depth
      });
      task.complexity = 'SIMPLE';
      return task;
    }
    
    // Report progress
    if (progressCallback) {
      progressCallback(`Analyzing task: ${task.description}`);
    }
    
    // Classify the task complexity
    const classification = await this.complexityClassifier.classify(
      task.description,
      context
    );
    
    task.complexity = classification.complexity;
    task.reasoning = classification.reasoning;
    
    // If SIMPLE, no need to decompose further
    if (task.complexity === 'SIMPLE') {
      this.logger.debug('Task classified as SIMPLE', { 
        taskId: task.id.toString() 
      });
      return task;
    }
    
    // If COMPLEX, decompose into subtasks
    this.logger.debug('Task classified as COMPLEX, decomposing', { 
      taskId: task.id.toString() 
    });
    
    if (progressCallback) {
      progressCallback(`Decomposing complex task: ${task.description}`);
    }
    
    // Get subtasks from decomposer
    const decomposition = await this.taskDecomposer.decompose(
      task.description,
      context
    );
    
    // Validate subtask count
    if (decomposition.subtasks.length < this.minSubtasks) {
      throw new Error(
        `Task decomposed into ${decomposition.subtasks.length} subtasks, ` +
        `minimum is ${this.minSubtasks}`
      );
    }
    
    if (decomposition.subtasks.length > this.maxSubtasks) {
      this.logger.warn('Too many subtasks, limiting to maximum', {
        taskId: task.id,
        count: decomposition.subtasks.length,
        max: this.maxSubtasks
      });
      decomposition.subtasks = decomposition.subtasks.slice(0, this.maxSubtasks);
    }
    
    // Create subtask entities and decompose recursively
    for (const subtaskData of decomposition.subtasks) {
      const subtask = new Task({
        description: subtaskData.description,
        parentId: task.id,
        inputs: subtaskData.inputs || [],
        outputs: subtaskData.outputs || [],
        depth: depth + 1
      });
      
      // Recursively decompose the subtask
      const decomposedSubtask = await this.decomposeRecursively(
        subtask,
        { ...context, parentTask: task.description },
        progressCallback,
        depth + 1
      );
      
      task.addSubtask(decomposedSubtask);
    }
    
    return task;
  }

  async saveHierarchy(rootTask) {
    // Save all tasks in the hierarchy
    await TaskHierarchyService.traverseAsync(rootTask, async (task) => {
      await this.taskRepository.save(task);
    });
  }
}