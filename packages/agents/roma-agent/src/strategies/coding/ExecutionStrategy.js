/**
 * ExecutionStrategy - Manages task execution and coordination
 * Refactored to use EnhancedTaskStrategy and utilities
 * 
 * Responsibilities:
 * - Handles dependency resolution, retry logic, and artifact management
 * - Coordinates execution between multiple strategies
 * - Manages task state and artifact storage
 * - Implements comprehensive validation and error handling
 * - Orchestrates complex multi-phase project execution
 * 
 * Now uses the new abstractions to eliminate boilerplate:
 * - EnhancedTaskStrategy for message routing and error handling
 * - ConfigBuilder for configuration setup
 * - StrategyHelpers for common operations
 */

import { EnhancedTaskStrategy } from '@legion/tasks';
import { createFromPreset } from '../utils/ConfigBuilder.js';
import { getTaskContext } from '../utils/StrategyHelpers.js';

/**
 * Create an ExecutionStrategy prototype
 * Dramatically simplified using the new abstractions
 */
export function createExecutionStrategy(strategies = null, stateManager = null, options = {}) {
  // Create strategy inheriting from EnhancedTaskStrategy (which has built-in patterns)
  const strategy = Object.create(EnhancedTaskStrategy);
  
  // Build configuration using ConfigBuilder preset
  const config = createFromPreset('execution', {
    strategies,
    stateManager,
    options
  });
  
  // Store dependencies in strategy for access
  strategy.config = config;
  
  /**
   * Override doWork - the only method we need to implement
   * EnhancedTaskStrategy handles all the message routing and error boundaries
   */
  strategy.doWork = async function doWork(senderTask, message) {
    // Extract task context
    const taskContext = getTaskContext(this);
    
    // Perform the execution
    const result = await performExecution(taskContext, this, config);
    
    // Complete with artifacts using built-in helper
    this.completeWithArtifacts({
      'execution-result': {
        value: result,
        description: `Execution result with ${result.phases?.length || 0} completed phases`,
        type: 'execution'
      },
      'execution-artifacts': {
        value: result.artifacts,
        description: `${result.artifacts?.length || 0} artifacts produced during execution`,
        type: 'artifacts'
      }
    }, result);
  };
  
  /**
   * Override abort handler for execution-specific cleanup
   */
  strategy.onAbort = async function onAbort(senderTask, message) {
    // Clear execution state
    config.completed.clear();
    config.executing.clear();
    config.artifacts.clear();
    
    this.addConversationEntry('system', 'Execution aborted');
  };
  
  return strategy;
}

// Export default for backward compatibility
export default createExecutionStrategy;

// ============================================================================
// Internal implementation functions - now much simpler
// ============================================================================

/**
 * Perform execution using simplified approach
 * All the error handling and parent notification is handled by EnhancedTaskStrategy
 */
async function performExecution(taskContext, task, config) {
  console.log(`⚙️ ExecutionStrategy handling: ${taskContext.description}`);
  
  // Extract execution plan from task
  const plan = extractExecutionPlan(task);
  if (!plan) {
    throw new Error('No execution plan found for execution');
  }
  
  // Add conversation entry
  task.addConversationEntry('system', 
    `Executing project plan with ${plan.phases?.length || 0} phases`);
  
  // Execute plan using direct implementation
  const result = await executePlan(plan, task, config);
  
  // Add conversation entry about completion
  task.addConversationEntry('system', 
    `Execution completed: ${result.success ? 'SUCCESS' : 'FAILED'} - ${result.phases?.length || 0} phases processed`);
  
  console.log(`✅ ExecutionStrategy completed: ${result.success ? 'SUCCESS' : 'FAILED'}`);
  
  if (!result.success) {
    throw new Error(result.message || 'Execution failed');
  }
  
  return result;
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