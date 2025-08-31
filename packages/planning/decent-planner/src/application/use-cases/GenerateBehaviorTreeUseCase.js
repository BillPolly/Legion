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
      const behaviorTree = {
        id: task.id.toString(),
        taskDescription: task.description,
        ...planResult.data.plan
      };
      
      // CRITICAL: Replace tool name strings with actual tool objects
      this.attachToolObjectsToBehaviorTree(behaviorTree, task.tools);
      
      return behaviorTree;
    }
    
    return null;
  }

  /**
   * Replace tool name strings with actual tool objects in behavior tree
   */
  attachToolObjectsToBehaviorTree(behaviorTree, taskTools) {
    this.logger.debug('Attaching actual tool objects to behavior tree', {
      taskToolsCount: taskTools.length,
      taskToolNames: taskTools.map(t => t.name)
    });

    // Create tool name -> tool object mapping
    const toolMap = new Map();
    taskTools.forEach(tool => {
      if (tool.name) {
        toolMap.set(tool.name, tool);
      }
    });

    // Recursively walk the behavior tree and replace tool strings
    this.replaceToolStringsWithObjects(behaviorTree, toolMap);
  }

  /**
   * Recursively walk nodes and replace tool strings with objects
   */
  replaceToolStringsWithObjects(node, toolMap) {
    if (!node) return;

    // If this is an action node with a tool string, replace it
    if (node.type === 'action' && node.tool && typeof node.tool === 'string') {
      const toolObject = toolMap.get(node.tool);
      if (toolObject) {
        this.logger.debug('Replacing tool string with object', {
          nodeId: node.id,
          toolName: node.tool,
          hasExecute: !!toolObject.execute
        });
        node.tool = toolObject;
      } else {
        this.logger.error('Tool object not found for action node', {
          nodeId: node.id,
          toolName: node.tool,
          availableTools: Array.from(toolMap.keys())
        });
      }
    }

    // Recursively process children
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(child => this.replaceToolStringsWithObjects(child, toolMap));
    }
  }
}