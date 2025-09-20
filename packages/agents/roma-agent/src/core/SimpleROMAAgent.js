/**
 * SimpleROMAAgent - A simple recursive task decomposition agent
 * 
 * Core concept: 
 * 1. Classify tasks as SIMPLE or COMPLEX
 * 2. SIMPLE tasks: Discover tools and execute with tool calls
 * 3. COMPLEX tasks: Decompose into subtasks recursively
 */

import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry';
import { Task, TaskManager, ArtifactRegistry, ExecutionContext } from '@legion/tasks';
import ToolDiscovery from '../utils/ToolDiscovery.js';
import TaskClassifier from '../utils/TaskClassifier.js';
import SessionLogger from '../utils/SessionLogger.js';
import RecursiveDecompositionStrategy from './strategies/RecursiveDecompositionStrategy.js';

export default class SimpleROMAAgent {
  constructor(options = {}) {
    this.resourceManager = null;
    this.llmClient = null;
    this.toolRegistry = null;
    this.toolDiscovery = null;
    this.taskClassifier = null;
    this.currentTools = []; // Current discovered tools for the task
    this.sessionLogger = null; // Session logger for debugging
    this.taskManager = null; // Task hierarchy manager
    
    // Task execution strategy (pluggable)
    this.taskStrategy = options.taskStrategy || RecursiveDecompositionStrategy.getInstance();
    
    // Configuration
    this.maxDepth = options.maxDepth || 5;
    this.maxSubtasks = options.maxSubtasks || 10;
    this.executionTimeout = options.executionTimeout || 60000; // 60 seconds default
    this.outputDir = options.outputDir || null;
    
    // Development/testing configuration
    this.fastToolDiscovery = options.fastToolDiscovery || false;
  }

  async initialize() {
    this.resourceManager = await ResourceManager.getInstance();
    this.llmClient = await this.resourceManager.get('llmClient');
    this.toolRegistry = await ToolRegistry.getInstance();
    this.toolDiscovery = new ToolDiscovery(this.llmClient, this.toolRegistry);
    this.taskClassifier = new TaskClassifier(this.llmClient);
    await this.taskClassifier.initialize();
    
    // ResponseValidators removed - TemplatedPrompt handles validation internally
    
    // Initialize session logger
    this.sessionLogger = new SessionLogger({ outputDir: this.outputDir });
    await this.sessionLogger.initialize();
    
    // Initialize task manager
    this.taskManager = new TaskManager(this.llmClient);
  }


  /**
   * Execute a task with recursive decomposition and artifact management
   */
  async execute(task) {
    // Validate task input
    if (!task || typeof task !== 'object') {
      return {
        success: false,
        result: 'Invalid task: task must be an object',
        artifacts: []
      };
    }
    
    // Check if task has meaningful content
    const taskDescription = task.description || JSON.stringify(task);
    if (!taskDescription || taskDescription.trim() === '' || taskDescription === '{}' || taskDescription === 'null') {
      return {
        success: false,
        result: 'Invalid task: task must have a description or meaningful content',
        artifacts: []
      };
    }
    
    // Reset task manager for new execution
    this.taskManager.reset();
    
    // Create execution context with all services
    const executionContext = new ExecutionContext({
      // Services
      llmClient: this.llmClient,
      taskClassifier: this.taskClassifier,
      toolDiscovery: this.toolDiscovery,
      sessionLogger: this.sessionLogger,
      
      // Configuration
      fastToolDiscovery: this.fastToolDiscovery,
      workspaceDir: process.cwd(),
      maxDepth: this.maxDepth,
      maxSubtasks: this.maxSubtasks,
      executionTimeout: this.executionTimeout,
      agent: this,  // Pass reference to agent for helper methods
      taskManager: this.taskManager
    });
    
    // Create root task with strategy and execution context
    const rootTask = new Task(taskDescription, null, {
      metadata: { originalTask: task },
      strategy: this.taskStrategy,
      ArtifactRegistryClass: ArtifactRegistry
    });
    
    // Update the task's context to the execution context
    rootTask.updateContext(executionContext);
    
    // Track root task in manager (TaskManager tracks tasks via constructor)
    this.taskManager.taskMap.set(rootTask.id, rootTask);
    this.taskManager.rootTaskId = rootTask.id;
    
    // Execute the root task (it will manage its own flow)
    const result = await this._runTask(rootTask);
    
    // Write session summary
    if (this.sessionLogger) {
      const artifactCount = rootTask.artifactRegistry?.size() || 0;
      const taskTree = this.taskManager.getTaskTree();
      await this.sessionLogger.logSummary({
        'Task Depth': taskTree?.depth || 0,
        'Total Tasks': this.taskManager.taskMap.size,
        'Artifacts Created': artifactCount,
        'Final Success': result.success
      });
    }
    
    return result;
  }

  /**
   * Set the task execution strategy
   * @param {TaskStrategy} strategy - The strategy to use
   */
  setTaskStrategy(strategy) {
    this.taskStrategy = strategy;
  }

  /**
   * Run a task - delegates to the task's own execute method
   */
  async _runTask(task) {
    // Check depth limit using configurable maxDepth
    if (task.metadata.depth > this.maxDepth) {
      console.log(`⚠️ Maximum depth exceeded (${task.metadata.depth}), stopping execution`);
      task.fail(new Error(`Maximum recursion depth exceeded (${this.maxDepth})`));
      return {
        success: false,
        result: `Maximum recursion depth exceeded (${this.maxDepth})`,
        artifacts: task.artifactRegistry?.toJSON() || []
      };
    }
    
    // Switch to this task in the TaskManager
    this.taskManager.switchToTask(task);
    
    // Delegate execution to the Task object itself
    return await task.execute();
  }
}