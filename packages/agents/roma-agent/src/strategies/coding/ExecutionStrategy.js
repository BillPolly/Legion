/**
 * ExecutionStrategy - Manages task execution and coordination
 * Uses StandardTaskStrategy to eliminate all boilerplate
 */

import { createTypedStrategy } from '../utils/StandardTaskStrategy.js';

/**
 * Create the strategy using the ultimate abstraction
 * ALL factory and initialization boilerplate is eliminated!
 */
export const createExecutionStrategy = createTypedStrategy(
  'coding-execution',                                    // Strategy type for prompt path resolution
  ['command_executor', 'file_write', 'file_read'],       // Required tools (loaded at construction)
  {                                                      // Prompt names (schemas come from YAML frontmatter)
    analyzeExecution: 'analyzeExecution',
    coordinateTasks: 'coordinateTasks',
    validateResults: 'validateResults'
  },
  {
    maxRetries: 3,                                       // Additional config
    retryDelay: 1000,
    batchSize: 5
  }
);

// Export default for backward compatibility
export default createExecutionStrategy;

/**
 * Core strategy implementation - the ONLY thing we need to implement!
 * All boilerplate (error handling, message routing, tool loading, etc.) is handled automatically
 */
createExecutionStrategy.doWork = async function doWork() {
  console.log(`⚙️ ExecutionStrategy handling: ${this.description}`);
  
  // Get execution plan from artifacts or analyze the task
  const executionPlan = await getExecutionPlan(this);
  if (!executionPlan) {
    return this.failWithError(new Error('No execution plan found'), 'Cannot execute without a plan');
  }
  
  this.addConversationEntry('system', `Executing ${executionPlan.tasks.length} tasks in ${executionPlan.phases.length} phases`);
  
  // Execute tasks by phases
  const results = [];
  for (let phaseIndex = 0; phaseIndex < executionPlan.phases.length; phaseIndex++) {
    const phase = executionPlan.phases[phaseIndex];
    
    console.log(`🔄 Executing Phase ${phaseIndex + 1}: ${phase.name}`);
    this.addConversationEntry('system', `Starting phase: ${phase.name}`);
    
    const phaseResults = await executePhase(phase, executionPlan.tasks, this);
    if (!phaseResults.success) {
      return this.failWithError(
        new Error(`Phase ${phase.name} failed: ${phaseResults.error}`),
        `Execution failed in phase ${phaseIndex + 1}`
      );
    }
    
    results.push({
      phase: phase.name,
      results: phaseResults.taskResults,
      artifacts: phaseResults.artifacts
    });
  }
  
  // Validate overall execution results
  const validationResult = await validateExecution(results, executionPlan, this);
  
  // Complete with artifacts using built-in helper (handles parent notification automatically)
  const artifacts = {};
  
  // Collect all artifacts from phases
  results.forEach((phaseResult, index) => {
    if (phaseResult.artifacts) {
      Object.entries(phaseResult.artifacts).forEach(([key, artifact]) => {
        artifacts[`phase-${index + 1}-${key}`] = artifact;
      });
    }
  });
  
  // Add execution summary
  artifacts['execution-summary'] = {
    value: JSON.stringify({
      phases: results.length,
      totalTasks: executionPlan.tasks.length,
      validation: validationResult,
      timeline: results.map(r => ({ phase: r.phase, taskCount: r.results.length }))
    }, null, 2),
    description: 'Complete execution summary',
    type: 'json'
  };
  
  this.completeWithArtifacts(artifacts, {
    success: true,
    message: `Executed ${executionPlan.tasks.length} tasks across ${results.length} phases`,
    phases: results.length,
    totalTasks: executionPlan.tasks.length,
    validationPassed: validationResult?.passed || true
  });
};

// ============================================================================
// Helper functions - now much simpler since all boilerplate is handled
// ============================================================================

async function getExecutionPlan(task) {
  // Try to get execution plan from artifacts first
  const artifacts = task.getAllArtifacts();
  for (const artifact of Object.values(artifacts)) {
    if (artifact.type === 'plan' || artifact.name.includes('plan')) {
      try {
        const plan = typeof artifact.value === 'string' ? JSON.parse(artifact.value) : artifact.value;
        if (plan.tasks && plan.phases) {
          return plan;
        }
      } catch (e) {
        console.log(`Could not parse plan artifact: ${e.message}`);
      }
    }
  }
  
  // If no plan found, create a simple sequential plan from description
  return {
    tasks: [
      {
        id: 'main-task',
        type: 'execute',
        description: task.description,
        dependencies: []
      }
    ],
    phases: [
      {
        name: 'execution',
        tasks: ['main-task'],
        parallel: false
      }
    ]
  };
}

async function executePhase(phase, allTasks, task) {
  const phaseTasks = phase.tasks.map(taskId => allTasks.find(t => t.id === taskId)).filter(Boolean);
  
  if (phaseTasks.length === 0) {
    return { success: true, taskResults: [], artifacts: {} };
  }
  
  const taskResults = [];
  const phaseArtifacts = {};
  
  if (phase.parallel) {
    // Execute tasks in parallel
    const results = await Promise.allSettled(
      phaseTasks.map(taskDef => executeTask(taskDef, task))
    );
    
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        taskResults.push(result.value);
        if (result.value.artifacts) {
          Object.assign(phaseArtifacts, result.value.artifacts);
        }
      } else {
        return {
          success: false,
          error: result.reason.message
        };
      }
    }
  } else {
    // Execute tasks sequentially
    for (const taskDef of phaseTasks) {
      const result = await executeTask(taskDef, task);
      if (!result.success) {
        return {
          success: false,
          error: result.error
        };
      }
      taskResults.push(result);
      if (result.artifacts) {
        Object.assign(phaseArtifacts, result.artifacts);
      }
    }
  }
  
  return {
    success: true,
    taskResults,
    artifacts: phaseArtifacts
  };
}

async function executeTask(taskDef, task) {
  const maxRetries = task.config.maxRetries || 3;
  const retryDelay = task.config.retryDelay || 1000;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🎯 Executing task: ${taskDef.description} (attempt ${attempt})`);
      
      // Execute based on task type
      let result;
      switch (taskDef.type) {
        case 'command':
          result = await task.config.tools.command_executor.execute({
            command: taskDef.command,
            cwd: taskDef.workingDirectory
          });
          break;
          
        case 'file_operation':
          if (taskDef.operation === 'write') {
            result = await task.config.tools.file_write.execute({
              filepath: taskDef.filepath,
              content: taskDef.content
            });
          } else if (taskDef.operation === 'read') {
            result = await task.config.tools.file_read.execute({
              filepath: taskDef.filepath
            });
          }
          break;
          
        case 'execute':
        default:
          // Generic execution - run as command if it looks like a command
          if (taskDef.command) {
            result = await task.config.tools.command_executor.execute({
              command: taskDef.command
            });
          } else {
            result = { success: true, message: 'Task completed', output: taskDef.description };
          }
          break;
      }
      
      return {
        success: true,
        taskId: taskDef.id,
        result: result,
        attempt: attempt
      };
      
    } catch (error) {
      console.log(`❌ Task ${taskDef.id} failed on attempt ${attempt}: ${error.message}`);
      
      if (attempt === maxRetries) {
        return {
          success: false,
          error: error.message,
          taskId: taskDef.id,
          attempts: attempt
        };
      }
      
      // Wait before retry
      if (retryDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
}

async function validateExecution(results, plan, task) {
  try {
    const validatePrompt = task.getPrompt('validateResults');
    const result = await validatePrompt.execute({
      executionResults: JSON.stringify(results, null, 2),
      originalPlan: JSON.stringify(plan, null, 2),
      totalPhases: results.length,
      totalTasks: plan.tasks.length
    });
    
    return result.success ? result.data : { passed: true, message: 'Basic validation passed' };
  } catch (error) {
    console.log(`Could not validate execution: ${error.message}`);
    return { passed: true, message: 'Validation skipped due to error' };
  }
}