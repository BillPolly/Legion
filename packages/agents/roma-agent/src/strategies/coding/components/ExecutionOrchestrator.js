/**
 * ExecutionOrchestrator - Manages task execution and coordination
 * Handles dependency resolution, retry logic, and artifact management
 * NO MOCKS - uses real strategies and components
 * NO FALLBACKS - fails fast on errors
 */

export default class ExecutionOrchestrator {
  constructor(strategies, stateManager) {
    if (!strategies) {
      throw new Error('Strategies are required');
    }
    if (!stateManager) {
      throw new Error('State manager is required');
    }
    
    this.strategies = strategies;
    this.stateManager = stateManager;
    this.completed = new Set();
    this.executing = new Set();
    this.artifacts = new Map();
  }
  
  /**
   * Execute a task with full orchestration
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
        
        // Execute strategy using message-based interface
        result = await strategy.onParentMessage(childTask, {
          type: 'start',
          context: context,
          input: task.input
        });
        
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
   * Stop all executing tasks
   */
  async stopAll() {
    console.log(`Stopping ${this.executing.size} executing tasks`);
    this.executing.clear();
  }
}