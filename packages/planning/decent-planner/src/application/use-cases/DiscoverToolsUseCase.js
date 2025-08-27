/**
 * DiscoverToolsUseCase - Application use case for tool discovery
 * Following Clean Architecture - orchestrates domain logic with ports
 */

import { TaskHierarchyService } from '../../domain/services/TaskHierarchyService.js';

export class DiscoverToolsUseCase {
  constructor({
    taskRepository,
    toolDiscoveryService,
    logger,
    confidenceThreshold = 0.7,
    maxToolsPerTask = 10
  }) {
    this.taskRepository = taskRepository;
    this.toolDiscoveryService = toolDiscoveryService;
    this.logger = logger;
    this.confidenceThreshold = confidenceThreshold;
    this.maxToolsPerTask = maxToolsPerTask;
  }

  async execute({ rootTask, progressCallback = null }) {
    this.logger.info('Starting tool discovery', { 
      rootTaskId: rootTask.id.toString() 
    });
    
    try {
      // Get all SIMPLE tasks
      const simpleTasks = TaskHierarchyService.getSimpleTasks(rootTask);
      
      this.logger.debug('Found SIMPLE tasks', { 
        count: simpleTasks.length 
      });
      
      const results = {
        totalTasks: simpleTasks.length,
        feasibleTasks: 0,
        infeasibleTasks: 0,
        totalTools: 0,
        uniqueToolsCount: 0,
        taskResults: []
      };
      
      // Track unique tool names
      const uniqueTools = new Set();
      
      // Process each SIMPLE task
      for (let i = 0; i < simpleTasks.length; i++) {
        const task = simpleTasks[i];
        
        if (progressCallback) {
          progressCallback(
            `Discovering tools for task ${i + 1}/${simpleTasks.length}: ${task.description}`
          );
        }
        
        try {
          // Discover tools for the task
          const discoveryResult = await this.discoverToolsForTask(task);
          
          // Update task with results
          task.setFeasibility(
            discoveryResult.feasible, 
            discoveryResult.reasoning
          );
          
          if (discoveryResult.feasible && discoveryResult.tools) {
            // Add tools to task (limited by maxToolsPerTask)
            const toolsToAdd = discoveryResult.tools.slice(0, this.maxToolsPerTask);
            for (const tool of toolsToAdd) {
              task.addTool(tool);
              // Track unique tools by name
              if (tool.name) {
                uniqueTools.add(tool.name);
              }
            }
            results.feasibleTasks++;
            results.totalTools += toolsToAdd.length;
          } else {
            results.infeasibleTasks++;
          }
          
          // Save updated task
          await this.taskRepository.save(task);
          
          results.taskResults.push({
            taskId: task.id.toString(),
            description: task.description,
            feasible: discoveryResult.feasible,
            toolCount: discoveryResult.tools ? discoveryResult.tools.length : 0,
            tools: discoveryResult.tools
          });
          
        } catch (error) {
          this.logger.error('Tool discovery failed for task', {
            taskId: task.id.toString(),
            error: error.message
          });
          
          task.setFeasibility(false, `Tool discovery failed: ${error.message}`);
          await this.taskRepository.save(task);
          
          results.infeasibleTasks++;
          results.taskResults.push({
            taskId: task.id.toString(),
            description: task.description,
            feasible: false,
            error: error.message
          });
        }
      }
      
      // Set the unique tools count
      results.uniqueToolsCount = uniqueTools.size;
      
      this.logger.info('Tool discovery completed', results);
      
      return {
        success: true,
        data: results
      };
      
    } catch (error) {
      this.logger.error('Tool discovery failed', { 
        error: error.message 
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  async discoverToolsForTask(task) {
    // Use the tool discovery service to find relevant tools
    const discoveredTools = await this.toolDiscoveryService.discoverTools(
      task.description
    );
    
    // Filter tools by confidence threshold
    const relevantTools = discoveredTools.filter(
      tool => tool.confidence >= this.confidenceThreshold
    );
    
    // Check feasibility based on tool availability
    const feasible = relevantTools.length > 0;
    
    return {
      feasible,
      tools: relevantTools,
      reasoning: feasible 
        ? `Found ${relevantTools.length} relevant tools with sufficient confidence`
        : `No tools found with confidence >= ${this.confidenceThreshold}`
    };
  }
}