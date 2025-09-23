/**
 * ExecutionStrategy - Manages task execution and coordination
 * Converted from ExecutionOrchestrator component to follow TaskStrategy pattern
 * 
 * Responsibilities:
 * - Handles dependency resolution, retry logic, and artifact management
 * - Coordinates execution between multiple strategies
 * - Manages task state and artifact storage
 * - Implements comprehensive validation and error handling
 * - Orchestrates complex multi-phase project execution
 */

import { TaskStrategy } from '@legion/tasks';

export default class ExecutionStrategy extends TaskStrategy {
  constructor(strategies, stateManager, options = {}) {
    super();
    
    if (!strategies) {
      throw new Error('Strategies are required');
    }
    if (!stateManager) {
      throw new Error('State manager is required');
    }
    
    this.strategies = strategies;
    this.stateManager = stateManager;
    this.options = {
      maxRetries: 3,
      backoffStrategy: 'exponential',
      validateResults: true,
      ...options
    };
    
    // Track execution state
    this.completed = new Set();
    this.executing = new Set();
    this.artifacts = new Map();
  }
  
  getName() {
    return 'Execution';
  }
  
  /**
   * Handle message from a task (strategy context, source task, message)
   * @param {Task} myTask - The task this strategy belongs to (context)
   * @param {Task} sourceTask - The task that sent the message
   * @param {Object} message - The message received
   */
  handleMessage(myTask, sourceTask, message) {
    switch (message.type) {
      case 'start':
      case 'work':
        this._handleExecutionRequest(myTask).catch(error => {
          console.error('Execution request failed:', error);
          myTask.fail(error);
        });
        break;
        
      case 'abort':
        this._handleAbortRequest().catch(error => {
          console.error('Abort request failed:', error);
        });
        break;
        
      case 'completed':
        console.log(`✅ Execution task completed: ${sourceTask.description}`);
        myTask.send(myTask.parent, { type: 'child-completed', child: sourceTask });
        break;
        
      case 'failed':
        myTask.send(myTask.parent, { type: 'child-failed', child: sourceTask, error: message.error });
        break;
        
      default:
        console.log(`ℹ️ ExecutionStrategy received unhandled message type: ${message.type}`);
        break;
    }
  }

  
  /**
   * Handle execution request from parent task
   * @private
   */
  async _handleExecutionRequest(task) {
    try {
      console.log(`⚙️ ExecutionStrategy handling: ${task.description}`);
      
      // Extract execution plan from task
      const plan = this._extractExecutionPlan(task);
      if (!plan) {
        return {
          success: false,
          result: 'No execution plan found for execution'
        };
      }
      
      // Add conversation entry
      task.addConversationEntry('system', 
        `Executing project plan with ${plan.phases?.length || 0} phases`);
      
      // Execute plan using direct implementation
      const result = await this._executePlan(plan, task);
      
      // Store execution artifacts
      task.storeArtifact(
        'execution-result',
        result,
        `Execution result with ${result.phases?.length || 0} completed phases`,
        'execution'
      );
      
      if (result.artifacts && result.artifacts.length > 0) {
        task.storeArtifact(
          'execution-artifacts',
          result.artifacts,
          `${result.artifacts.length} artifacts produced during execution`,
          'artifacts'
        );
      }
      
      // Add conversation entry about completion
      task.addConversationEntry('system', 
        `Execution completed: ${result.success ? 'SUCCESS' : 'FAILED'} - ${result.phases?.length || 0} phases processed`);
      
      console.log(`✅ ExecutionStrategy completed: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      
      return {
        success: result.success,
        result: {
          execution: result,
          projectId: result.projectId,
          phasesCompleted: result.phases?.length || 0,
          artifactsCreated: result.artifacts?.length || 0
        },
        artifacts: ['execution-result', 'execution-artifacts']
      };
      
    } catch (error) {
      console.error(`❌ ExecutionStrategy failed: ${error.message}`);
      
      task.addConversationEntry('system', 
        `Execution failed: ${error.message}`);
      
      return {
        success: false,
        result: error.message
      };
    }
  }
  
  /**
   * Handle abort request
   * @private
   */
  async _handleAbortRequest() {
    try {
      await this.stopAll();
      return { acknowledged: true, aborted: true };
    } catch (error) {
      console.error(`Error during abort: ${error.message}`);
      return { acknowledged: true, aborted: false, error: error.message };
    }
  }
  
  /**
   * Execute a project plan by processing all phases and tasks
   */
  async _executePlan(plan, task) {
    const results = {
      success: true,
      projectId: plan.projectId,
      structure: plan.structure,
      phases: [],
      artifacts: []
    };
    
    try {
      // Process phases in order
      for (const phase of plan.phases) {
        console.log(`🔄 Executing phase: ${phase.phase} (${phase.tasks.length} tasks)`);
        
        const phaseResults = {
          phase: phase.phase,
          priority: phase.priority,
          tasks: [],
          success: true
        };
        
        // Execute tasks in this phase
        for (const planTask of phase.tasks) {
          try {
            console.log(`📍 Executing task: ${planTask.description || planTask.action}`);
            
            // Ensure task has retry configuration
            const taskWithDefaults = {
              ...planTask,
              retry: planTask.retry || { maxAttempts: 1, strategy: 'exponential' },
              validation: planTask.validation || { required: false }
            };
            
            // Execute task using direct implementation
            const taskResult = await this.execute(taskWithDefaults);
            
            phaseResults.tasks.push({
              id: planTask.id,
              success: taskResult.success,
              artifacts: taskResult.artifacts || []
            });
            
            // Store artifacts
            if (taskResult.artifacts) {
              results.artifacts.push(...taskResult.artifacts);
              for (const artifact of taskResult.artifacts) {
                task.storeArtifact(artifact.name, artifact.content, artifact.description, artifact.type);
              }
            }
            
          } catch (error) {
            console.error(`Task ${planTask.id} failed:`, error.message);
            phaseResults.tasks.push({
              id: planTask.id,
              success: false,
              error: error.message
            });
            phaseResults.success = false;
          }
        }
        
        results.phases.push(phaseResults);
        
        // If this phase failed and it's critical, stop execution
        // Phases without priority are considered critical (priority 1)
        const priority = phase.priority !== undefined ? phase.priority : 1;
        if (!phaseResults.success && priority <= 3) {
          results.success = false;
          break;
        }
      }
      
      return results;
      
    } catch (error) {
      console.error('Plan execution failed:', error);
      results.success = false;
      results.error = error.message;
      return results;
    }
  }
  
  /**
   * Extract execution plan from task artifacts or context
   */
  _extractExecutionPlan(task) {
    // First try to get plan from artifacts
    const artifacts = task.getAllArtifacts ? task.getAllArtifacts() : {};
    
    // Look for project plan artifact
    if (artifacts['project-plan']) {
      return artifacts['project-plan'].content;
    }
    
    // Look for execution plan
    if (artifacts['execution-plan']) {
      return artifacts['execution-plan'].content;
    }
    
    // Look for plan artifact
    if (artifacts['plan']) {
      return artifacts['plan'].content;
    }
    
    // Look in task context or input
    if (task.input && task.input.plan) {
      return task.input.plan;
    }
    
    // Fallback to task description if it contains plan structure
    if (task.description && task.description.trim()) {
      try {
        const parsedDescription = JSON.parse(task.description);
        if (parsedDescription.phases) {
          return parsedDescription;
        }
      } catch {
        // Not JSON, ignore
      }
    }
    
    return null;
  }
  
  /**
   * Execute a task with full orchestration (from ExecutionOrchestrator)
   */
  async execute(task) {
    // 1. Resolve dependencies
    await this.waitForDependencies(task.dependencies || []);
    
    // 2. Prepare context
    const context = await this.prepareTaskContext(task);
    
    // 3. Select strategy
    const strategy = this.selectStrategy(task.strategy);
    
    // 4. Execute with retry logic
    let result = null;
    let attempts = 0;
    let lastError = null;
    
    while (attempts < task.retry.maxAttempts) {
      try {
        attempts++;
        
        // Create child task for strategy
        const childTask = await this.createChildTask(task, strategy);
        
        // Fire-and-forget message to strategy (can't expect synchronous return)
        if (strategy.handleMessage) {
          strategy.handleMessage(childTask, this, {
            type: 'start',
            context: context,
            input: task.input
          });
        }
        
        // Since we can't get synchronous result from fire-and-forget messaging,
        // we need to wait for the child task to complete/fail via status polling
        result = await this.waitForChildTaskCompletion(childTask);
        
        // Validate result
        if (await this.validateResult(result, task.validation)) {
          break;
        } else {
          lastError = new Error('Validation failed');
        }
      } catch (error) {
        lastError = error;
        await this.handleExecutionError(error, task, attempts);
        
        if (attempts < task.retry.maxAttempts) {
          await this.delay(this.calculateBackoff(attempts, task.retry));
        }
      }
    }
    
    // Check if we succeeded
    if (!result || !result.success) {
      throw new Error(`Task failed after ${attempts} attempts: ${lastError?.message}`);
    }
    
    // 5. Store artifacts
    await this.storeArtifacts(result.artifacts || [], task);
    
    // 6. Update state
    await this.updateTaskState(task, result);
    
    // 7. Mark as completed
    this.completed.add(task.id);
    
    return result;
  }
  
  /**
   * Wait for task dependencies to complete
   */
  async waitForDependencies(dependencies) {
    if (!dependencies || dependencies.length === 0) {
      return;
    }
    
    const unmet = dependencies.filter(dep => !this.completed.has(dep));
    
    if (unmet.length > 0) {
      throw new Error(`Dependencies not met: ${unmet.join(', ')}`);
    }
  }
  
  /**
   * Prepare execution context for task
   */
  async prepareTaskContext(task) {
    const context = {
      input: task.input || {},
      artifacts: []
    };
    
    // Collect artifacts from dependencies
    if (task.dependencies) {
      for (const dep of task.dependencies) {
        const depArtifacts = this.artifacts.get(dep) || [];
        context.artifacts.push(...depArtifacts);
      }
    }
    
    return context;
  }
  
  /**
   * Select strategy by name
   */
  selectStrategy(strategyName) {
    const strategy = this.strategies[strategyName];
    
    if (!strategy) {
      throw new Error(`Strategy not found: ${strategyName}`);
    }
    
    return strategy;
  }
  
  /**
   * Create child task for strategy execution
   */
  async createChildTask(task, strategy) {
    const childTask = {
      parentId: task.id,
      strategyName: strategy.getName(),
      action: task.action,
      description: task.description,
      input: task.input || {},
      artifacts: new Map(),
      conversations: []
    };
    
    // Add necessary methods that strategies expect
    childTask.addConversationEntry = (role, content) => {
      childTask.conversations.push({ role, content, timestamp: new Date().toISOString() });
    };
    
    childTask.storeArtifact = (name, content, description, type) => {
      const artifact = { name, content, description, type, timestamp: new Date().toISOString() };
      childTask.artifacts.set(name, artifact);
      // Store in parent task if available
      if (task.storeArtifact) {
        task.storeArtifact(name, content, description, type);
      }
    };
    
    childTask.getAllArtifacts = () => {
      return Object.fromEntries(childTask.artifacts);
    };
    
    childTask.complete = (result) => {
      childTask.result = result;
      childTask.status = 'completed';
    };
    
    childTask.fail = (error) => {
      childTask.error = error;
      childTask.status = 'failed';
    };
    
    return childTask;
  }
  
  /**
   * Validate task execution result
   */
  async validateResult(result, validation) {
    if (!validation) {
      return true;
    }
    
    if (validation.required && !result.success) {
      return false;
    }
    
    // Additional validation criteria could be checked here
    // For now, basic success check is sufficient
    
    return true;
  }
  
  /**
   * Handle execution error
   */
  async handleExecutionError(error, task, attempts) {
    // Log error (in real implementation, would emit events)
    console.error(`Task ${task.id} attempt ${attempts} failed:`, error.message);
    
    // Update state with error
    await this.stateManager.updateTask({
      id: task.id,
      status: 'retrying',
      lastError: error.message,
      attempts
    });
  }
  
  /**
   * Store task artifacts
   */
  async storeArtifacts(artifacts, task) {
    this.artifacts.set(task.id, artifacts);
    
    // Store each artifact in state
    for (const artifact of artifacts) {
      await this.stateManager.addArtifact({
        ...artifact,
        taskId: task.id
      });
    }
  }
  
  /**
   * Update task state after execution
   */
  async updateTaskState(task, result) {
    await this.stateManager.updateTask({
      id: task.id,
      status: 'completed',
      result: {
        success: result.success,
        artifactCount: (result.artifacts || []).length
      }
    });
  }
  
  /**
   * Calculate backoff delay
   */
  calculateBackoff(attempt, retry) {
    const base = retry.backoffMs || 1000;
    
    switch (retry.strategy) {
      case 'exponential':
        return base * Math.pow(2, attempt - 1);
      case 'linear':
        return base * attempt;
      default:
        return base;
    }
  }
  
  /**
   * Delay execution
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Wait for child task to complete (polling-based for fire-and-forget pattern)
   */
  async waitForChildTaskCompletion(childTask) {
    const maxWait = 30000; // 30 seconds max
    const pollInterval = 100; // Check every 100ms
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      if (childTask.status === 'completed') {
        return childTask.result || { success: true };
      }
      if (childTask.status === 'failed') {
        throw new Error(childTask.error || 'Child task failed');
      }
      await this.delay(pollInterval);
    }
    
    throw new Error('Child task execution timeout');
  }

  /**
   * Stop all executing tasks
   */
  async stopAll() {
    console.log(`Stopping ${this.executing.size} executing tasks`);
    this.executing.clear();
  }

  /**
   * Get context information from task for execution
   */
  _getContextFromTask(task) {
    const context = {
      taskId: task.id,
      description: task.description,
      workspaceDir: task.workspaceDir
    };
    
    // Add any existing artifacts as context
    if (task.getAllArtifacts) {
      const artifacts = task.getAllArtifacts();
      context.existingArtifacts = Object.keys(artifacts);
    }
    
    // Add conversation history for context
    if (task.getConversationContext) {
      context.conversationHistory = task.getConversationContext();
    }
    
    return context;
  }
}