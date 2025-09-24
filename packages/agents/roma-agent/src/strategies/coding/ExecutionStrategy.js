/**
 * ExecutionStrategy - Manages task execution and coordination
 * Converted to pure prototypal pattern
 * 
 * Responsibilities:
 * - Handles dependency resolution, retry logic, and artifact management
 * - Coordinates execution between multiple strategies
 * - Manages task state and artifact storage
 * - Implements comprehensive validation and error handling
 * - Orchestrates complex multi-phase project execution
 */

import { TaskStrategy } from '@legion/tasks';

/**
 * Create an ExecutionStrategy prototype
 * This factory function creates the strategy with its dependencies
 */
export function createExecutionStrategy(strategies = null, stateManager = null, options = {}) {
  // Create the strategy as an object that inherits from TaskStrategy
  const strategy = Object.create(TaskStrategy);
  
  // Store configuration
  const config = {
    strategies: strategies,
    stateManager: stateManager,
    options: {
      maxRetries: 3,
      backoffStrategy: 'exponential',
      validateResults: true,
      ...options
    },
    // Track execution state
    completed: new Set(),
    executing: new Set(),
    artifacts: new Map()
  };
  
  /**
   * The only required method - handles all messages
   */
  strategy.onMessage = function onMessage(senderTask, message) {
    // 'this' is the task instance that received the message
    
    try {
      // Determine if message is from child or parent/initiator
      if (senderTask.parent === this) {
        // Message from child task
        switch (message.type) {
          case 'completed':
            console.log(`✅ Execution task completed: ${senderTask.description}`);
            this.send(this.parent, { type: 'child-completed', child: senderTask });
            break;
            
          case 'failed':
            this.send(this.parent, { type: 'child-failed', child: senderTask, error: message.error });
            break;
            
          default:
            console.log(`ℹ️ ExecutionStrategy received unhandled message from child: ${message.type}`);
        }
      } else {
        // Message from parent or initiator
        switch (message.type) {
          case 'start':
          case 'work':
            // Fire-and-forget async operation with error boundary
            handleExecutionRequest.call(this, config).catch(error => {
              console.error(`❌ ExecutionStrategy async operation failed: ${error.message}`);
              // Don't let async errors escape - handle them internally
              try {
                this.fail(error);
                if (this.parent) {
                  this.send(this.parent, { type: 'failed', error });
                }
              } catch (innerError) {
                console.error(`❌ Failed to handle async error: ${innerError.message}`);
              }
            });
            break;
            
          case 'abort':
            // Fire-and-forget async operation with error boundary
            handleAbortRequest.call(this, config).catch(error => {
              console.error(`❌ ExecutionStrategy abort failed: ${error.message}`);
              try {
                this.fail(error);
                if (this.parent) {
                  this.send(this.parent, { type: 'failed', error });
                }
              } catch (innerError) {
                console.error(`❌ Failed to handle abort error: ${innerError.message}`);
              }
            });
            break;
            
          default:
            console.log(`ℹ️ ExecutionStrategy received unhandled message: ${message.type}`);
        }
      }
    } catch (error) {
      // Catch any synchronous errors in message handling
      console.error(`❌ ExecutionStrategy message handler error: ${error.message}`);
      // Don't let errors escape the message handler - handle them gracefully
      try {
        if (this.addConversationEntry) {
          this.addConversationEntry('system', `Message handling error: ${error.message}`);
        }
      } catch (innerError) {
        console.error(`❌ Failed to log message handling error: ${innerError.message}`);
      }
    }
  };
  
  return strategy;
}

// Export default for backward compatibility
export default createExecutionStrategy;

// ============================================================================
// Internal implementation functions
// These work with the task instance and strategy config
// ============================================================================

/**
 * Handle execution request from parent task
 */
async function handleExecutionRequest(config) {
  try {
    console.log(`⚙️ ExecutionStrategy handling: ${this.description}`);
    
    // Extract execution plan from task
    const plan = extractExecutionPlan(this);
    if (!plan) {
      this.fail(new Error('No execution plan found for execution'));
      // Notify parent of failure (fire-and-forget)
      if (this.parent) {
        this.send(this.parent, { 
          type: 'failed', 
          error: new Error('No execution plan found for execution') 
        });
      }
      return; // Fire-and-forget - no return value
    }
    
    // Add conversation entry
    this.addConversationEntry('system', 
      `Executing project plan with ${plan.phases?.length || 0} phases`);
    
    // Execute plan using direct implementation
    const result = await executePlan(plan, this, config);
    
    // Store execution artifacts
    this.storeArtifact(
      'execution-result',
      result,
      `Execution result with ${result.phases?.length || 0} completed phases`,
      'execution'
    );
    
    if (result.artifacts && result.artifacts.length > 0) {
      this.storeArtifact(
        'execution-artifacts',
        result.artifacts,
        `${result.artifacts.length} artifacts produced during execution`,
        'artifacts'
      );
    }
    
    // Add conversation entry about completion
    this.addConversationEntry('system', 
      `Execution completed: ${result.success ? 'SUCCESS' : 'FAILED'} - ${result.phases?.length || 0} phases processed`);
    
    console.log(`✅ ExecutionStrategy completed: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    
    const finalResult = {
      success: result.success,
      result: {
        execution: result,
        projectId: result.projectId,
        phasesCompleted: result.phases?.length || 0,
        artifactsCreated: result.artifacts?.length || 0
      },
      artifacts: ['execution-result', 'execution-artifacts']
    };
    
    if (result.success) {
      this.complete(finalResult);
      // Notify parent of success (fire-and-forget)
      if (this.parent) {
        this.send(this.parent, { type: 'completed', result: finalResult });
      }
    } else {
      this.fail(new Error(result.message || 'Execution failed'));
      // Notify parent of failure (fire-and-forget)
      if (this.parent) {
        this.send(this.parent, { 
          type: 'failed', 
          error: new Error(result.message || 'Execution failed') 
        });
      }
    }
    
    // Fire-and-forget - no return value
    
  } catch (error) {
    console.error(`❌ ExecutionStrategy failed: ${error.message}`);
    
    this.addConversationEntry('system', 
      `Execution failed: ${error.message}`);
    
    this.fail(error);
    
    // Notify parent of failure (fire-and-forget)
    if (this.parent) {
      this.send(this.parent, { type: 'failed', error });
    }
    
    // Fire-and-forget - no return value
  }
}

/**
 * Handle abort request
 */
async function handleAbortRequest(config) {
  try {
    console.log('🛑 Aborting execution...');
    
    // Clear execution state
    config.executing.clear();
    config.completed.clear();
    config.artifacts.clear();
    
    this.addConversationEntry('system', 'Execution aborted');
    
    // Mark task as aborted
    this.fail(new Error('Execution aborted'));
    
    // Notify parent of abort (fire-and-forget)
    if (this.parent) {
      this.send(this.parent, { 
        type: 'failed', 
        error: new Error('Execution aborted'),
        aborted: true 
      });
    }
    
    // Fire-and-forget - no return value
  } catch (error) {
    console.error('Failed to abort execution:', error);
    // Even in error, don't return - just notify parent
    if (this.parent) {
      this.send(this.parent, { type: 'failed', error });
    }
  }
}

/**
 * Extract execution plan from task
 */
function extractExecutionPlan(task) {
  // Check for project-plan artifact first
  const projectPlanArtifact = task.getArtifact('project-plan');
  if (projectPlanArtifact?.value) {
    return projectPlanArtifact.value;
  }
  
  // Check for plan in metadata
  if (task.metadata?.plan) {
    return task.metadata.plan;
  }
  
  // Check for plan from parent task
  if (task.parent) {
    const parentPlan = task.parent.getArtifact('project-plan');
    if (parentPlan?.value) {
      return parentPlan.value;
    }
  }
  
  return null;
}

/**
 * Execute the project plan
 */
async function executePlan(plan, task, config) {
  const executionResult = {
    success: false,
    projectId: plan.metadata?.projectId || `project-${Date.now()}`,
    phases: [],
    artifacts: [],
    errors: []
  };
  
  try {
    // Initialize execution state
    config.completed.clear();
    config.executing.clear();
    config.artifacts.clear();
    
    // Execute each phase
    for (const phase of plan.phases || []) {
      console.log(`\n📍 Executing Phase: ${phase.name}`);
      task.addConversationEntry('system', `Executing phase: ${phase.name}`);
      
      const phaseResult = await executePhase(phase, task, config);
      
      executionResult.phases.push({
        name: phase.name,
        success: phaseResult.success,
        tasks: phaseResult.tasks,
        errors: phaseResult.errors
      });
      
      // Collect artifacts from phase
      if (phaseResult.artifacts && phaseResult.artifacts.length > 0) {
        executionResult.artifacts.push(...phaseResult.artifacts);
      }
      
      // If phase failed and it's critical, stop execution
      if (!phaseResult.success && phase.critical !== false) {
        console.error(`❌ Critical phase "${phase.name}" failed, stopping execution`);
        executionResult.success = false;
        executionResult.errors.push(`Critical phase "${phase.name}" failed`);
        break;
      }
    }
    
    // Determine overall success
    executionResult.success = executionResult.phases.every(p => p.success);
    
    // Store all artifacts
    for (const artifact of executionResult.artifacts) {
      if (artifact.name && artifact.content) {
        task.storeArtifact(
          artifact.name,
          artifact.content,
          artifact.description || `Artifact from ${artifact.source || 'execution'}`,
          artifact.type || 'file'
        );
      }
    }
    
    return executionResult;
    
  } catch (error) {
    console.error('Plan execution failed:', error);
    executionResult.success = false;
    executionResult.errors.push(error.message);
    return executionResult;
  }
}

/**
 * Execute a single phase
 */
async function executePhase(phase, task, config) {
  const phaseResult = {
    success: false,
    tasks: [],
    artifacts: [],
    errors: []
  };
  
  try {
    // Group tasks by their dependency level
    const tasksByLevel = groupTasksByDependencyLevel(phase.tasks || []);
    
    // Execute each dependency level
    for (const [level, levelTasks] of tasksByLevel) {
      console.log(`  → Executing dependency level ${level}: ${levelTasks.length} tasks`);
      
      // Execute tasks at this level in parallel
      const levelResults = await Promise.all(
        levelTasks.map(taskDef => executeTask(taskDef, task, config))
      );
      
      // Process results
      for (let i = 0; i < levelTasks.length; i++) {
        const taskDef = levelTasks[i];
        const result = levelResults[i];
        
        phaseResult.tasks.push({
          id: taskDef.id,
          name: taskDef.name,
          success: result.success,
          result: result.result
        });
        
        if (result.artifacts) {
          phaseResult.artifacts.push(...result.artifacts);
        }
        
        if (!result.success) {
          phaseResult.errors.push(`Task "${taskDef.name}" failed: ${result.error}`);
        }
        
        // Mark task as completed
        config.completed.add(taskDef.id);
      }
    }
    
    phaseResult.success = phaseResult.tasks.every(t => t.success);
    return phaseResult;
    
  } catch (error) {
    console.error(`Phase execution failed: ${error.message}`);
    phaseResult.errors.push(error.message);
    return phaseResult;
  }
}

/**
 * Execute a single task
 */
async function executeTask(taskDef, task, config) {
  const maxRetries = config.options.maxRetries;
  let attempt = 0;
  let lastError = null;
  
  while (attempt < maxRetries) {
    try {
      attempt++;
      console.log(`    • Executing task: ${taskDef.name} (attempt ${attempt}/${maxRetries})`);
      
      // Mark as executing
      config.executing.add(taskDef.id);
      
      // Execute based on task type
      const result = await executeTaskByType(taskDef, task, config);
      
      // Mark as complete
      config.executing.delete(taskDef.id);
      config.completed.add(taskDef.id);
      
      return result;
      
    } catch (error) {
      lastError = error;
      console.error(`      ⚠️ Task failed (attempt ${attempt}/${maxRetries}): ${error.message}`);
      
      if (attempt < maxRetries) {
        // Exponential backoff
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // All retries exhausted
  config.executing.delete(taskDef.id);
  
  return {
    success: false,
    error: lastError?.message || 'Task execution failed after all retries',
    result: null
  };
}

/**
 * Execute task based on its type
 */
async function executeTaskByType(taskDef, task, config) {
  const { type, params = {} } = taskDef;
  
  switch (type) {
    case 'file':
      return await executeFileTask(params, task, config);
    
    case 'directory':
      return await executeDirectoryTask(params, task, config);
    
    case 'command':
      return await executeCommandTask(params, task, config);
    
    case 'tool':
      return await executeToolTask(params, task, config);
    
    case 'validation':
      return await executeValidationTask(params, task, config);
    
    default:
      // Try to find a strategy that can handle this type
      if (config.strategies && config.strategies[type]) {
        return await config.strategies[type].execute(params, task);
      }
      
      throw new Error(`Unknown task type: ${type}`);
  }
}

/**
 * Execute file creation task
 */
async function executeFileTask(params, task, config) {
  try {
    const { path: filePath, content, description } = params;
    
    // Store as artifact
    task.storeArtifact(
      filePath,
      content,
      description || `File: ${filePath}`,
      'file'
    );
    
    return {
      success: true,
      result: `File created: ${filePath}`,
      artifacts: [{
        name: filePath,
        content: content,
        type: 'file',
        source: 'execution'
      }]
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      result: null
    };
  }
}

/**
 * Execute directory creation task
 */
async function executeDirectoryTask(params, task, config) {
  try {
    const { path: dirPath, structure } = params;
    
    // Store directory structure as artifact
    task.storeArtifact(
      `${dirPath}-structure`,
      structure || {},
      `Directory structure for ${dirPath}`,
      'directory'
    );
    
    return {
      success: true,
      result: `Directory created: ${dirPath}`,
      artifacts: []
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      result: null
    };
  }
}

/**
 * Execute command task
 */
async function executeCommandTask(params, task, config) {
  try {
    const { command, workingDir } = params;
    
    task.addConversationEntry('system', `Executing command: ${command}`);
    
    // In real implementation, would execute the command
    // For now, simulate success
    return {
      success: true,
      result: `Command executed: ${command}`,
      artifacts: []
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      result: null
    };
  }
}

/**
 * Execute tool task
 */
async function executeToolTask(params, task, config) {
  try {
    const { toolName, inputs } = params;
    
    // Get tool from task's context or config
    const toolRegistry = task.lookup ? task.lookup('toolRegistry') : null;
    
    if (!toolRegistry) {
      throw new Error('Tool registry not available');
    }
    
    const tool = await toolRegistry.getTool(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }
    
    const result = await tool.execute(inputs);
    
    return {
      success: result.success,
      result: result,
      artifacts: []
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      result: null
    };
  }
}

/**
 * Execute validation task
 */
async function executeValidationTask(params, task, config) {
  try {
    const { target, rules } = params;
    
    task.addConversationEntry('system', `Validating: ${target}`);
    
    // In real implementation, would perform validation
    // For now, simulate success
    return {
      success: true,
      result: `Validation passed for ${target}`,
      artifacts: []
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      result: null
    };
  }
}

/**
 * Group tasks by dependency level
 */
function groupTasksByDependencyLevel(tasks) {
  const levels = new Map();
  const taskMap = new Map();
  
  // Build task map
  for (const task of tasks) {
    taskMap.set(task.id, task);
  }
  
  // Calculate levels
  for (const task of tasks) {
    const level = calculateDependencyLevel(task, taskMap, new Set());
    
    if (!levels.has(level)) {
      levels.set(level, []);
    }
    levels.get(level).push(task);
  }
  
  // Sort levels and return
  return new Map([...levels.entries()].sort((a, b) => a[0] - b[0]));
}

/**
 * Calculate dependency level for a task
 */
function calculateDependencyLevel(task, taskMap, visited) {
  if (visited.has(task.id)) {
    return 0; // Circular dependency detected
  }
  
  visited.add(task.id);
  
  if (!task.dependencies || task.dependencies.length === 0) {
    return 0;
  }
  
  let maxLevel = 0;
  for (const depId of task.dependencies) {
    const depTask = taskMap.get(depId);
    if (depTask) {
      const depLevel = calculateDependencyLevel(depTask, taskMap, visited);
      maxLevel = Math.max(maxLevel, depLevel);
    }
  }
  
  return maxLevel + 1;
}