/**
 * SimpleROMAAgent - A simple recursive task decomposition agent
 * 
 * Core concept: 
 * 1. Classify tasks as SIMPLE or COMPLEX
 * 2. SIMPLE tasks: Discover tools and execute with tool calls
 * 3. COMPLEX tasks: Decompose into subtasks recursively
 */

import { Task, TaskManager, GlobalContext } from '@legion/tasks';
import SessionLogger from './utils/SessionLogger.js';
import RecursiveDecompositionStrategy from './strategies/recursive/RecursiveDecompositionStrategy.js';

export default class SimpleROMAAgent {
  constructor(options = {}) {
    // Global context for hierarchical service lookup
    this.globalContext = null;
    
    // Agent-level services (these remain on the agent)
    this.sessionLogger = null; // Session logger for debugging
    this.taskManager = null; // Task hierarchy manager
    
    // Task execution strategy (pluggable)
    this.taskStrategy = options.taskStrategy || new RecursiveDecompositionStrategy();
    
    // Configuration
    this.maxDepth = options.maxDepth || 5;
    this.maxSubtasks = options.maxSubtasks || 10;
    this.executionTimeout = options.executionTimeout || 60000; // 60 seconds default
    this.outputDir = options.outputDir || null;
    
    // Development/testing configuration
    this.fastToolDiscovery = options.fastToolDiscovery || false;
  }

  async initialize() {
    // Initialize global context with all shared resources
    this.globalContext = new GlobalContext();
    await this.globalContext.initialize();
    
    // Initialize agent-level services that are not global
    // (SessionLogger is agent-specific, TaskManager is agent-specific)
    this.sessionLogger = new SessionLogger({ outputDir: this.outputDir });
    await this.sessionLogger.initialize();
    
    // Initialize task manager
    const llmClient = this.globalContext.getService('llmClient');
    this.taskManager = new TaskManager(llmClient);
    
    // Update strategy with services (strategy can get what it needs directly)
    const toolRegistry = this.globalContext.getService('toolRegistry');
    if (!this.taskStrategy.llmClient) {
      this.taskStrategy.llmClient = llmClient;
    }
    if (!this.taskStrategy.toolRegistry) {
      this.taskStrategy.toolRegistry = toolRegistry;
    }
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
    
    // Create execution context with global context as parent
    const executionContext = await this.globalContext.createExecutionContext({
      // Agent-specific services (not in global context)
      sessionLogger: this.sessionLogger,
      
      // Task-specific configuration
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
      strategy: this.taskStrategy
    });
    
    // Update the task's context to the execution context
    rootTask.updateContext(executionContext);
    
    // Track root task in manager (TaskManager tracks tasks via constructor)
    this.taskManager.taskMap.set(rootTask.id, rootTask);
    this.taskManager.rootTask = rootTask;
    
    // Execute the root task (it will manage its own flow)
    const result = await this._runTask(rootTask);
    
    // Write session summary
    if (this.sessionLogger) {
      const taskTree = this.taskManager.getTaskTree();
      await this.sessionLogger.logSummary({
        'Task Depth': taskTree?.depth || 0,
        'Total Tasks': this.taskManager.taskMap.size,
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
        artifacts: Object.values(task.getAllArtifacts())
      };
    }
    
    // Switch to this task in the TaskManager
    this.taskManager.switchToTask(task);
    
    // Send start message to task (pure message-passing)
    return await task.receiveMessage({type: 'start'});
  }
}