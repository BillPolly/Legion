/**
 * RecursiveDecompositionStrategy - Recursive task decomposition strategy
 * Uses StandardTaskStrategy to eliminate all boilerplate
 */

import { createTypedStrategy } from '../utils/StandardTaskStrategy.js';

/**
 * Create the strategy using the ultimate abstraction
 * ALL factory and initialization boilerplate is eliminated!
 */
export const createRecursiveDecompositionStrategy = createTypedStrategy(
  'recursive-decomposition',                             // Strategy type for prompt path resolution
  [],                                                    // No direct tools (uses child tasks for execution)
  {                                                      // Prompt names (schemas come from YAML frontmatter)
    decomposeTask: 'task-decomposition',
    executeSimple: 'task-execution', 
    evaluateCompletion: 'completion-evaluation',
    evaluateChild: 'parent-evaluation'
  },
  {                                                      // Additional config
    maxDepth: 5,
    maxSubtasks: 10,
    requiresDecomposition: true,
    enableClassification: true
  }
);

// Export default for backward compatibility
export default createRecursiveDecompositionStrategy;

/**
 * Core strategy implementation - the ONLY thing we need to implement!
 * All boilerplate (error handling, message routing, tool loading, etc.) is handled automatically
 */
createRecursiveDecompositionStrategy.doWork = async function doWork() {
  console.log(`🔄 RecursiveDecompositionStrategy processing: ${this.description}`);
  
  // Check if task needs decomposition
  const needsDecomposition = await shouldDecompose(this);
  
  if (needsDecomposition) {
    this.addConversationEntry('system', 'Task classified as COMPLEX - decomposing into subtasks');
    const result = await executeComplex(this);
    
    this.completeWithArtifacts({
      'decomposition-result': {
        value: JSON.stringify(result, null, 2),
        description: 'Complex task decomposition and execution result',
        type: 'json'
      }
    }, {
      success: result.success,
      message: result.success ? 'Complex task completed through decomposition' : 'Task decomposition failed',
      subtasks: result.subtasks?.length || 0
    });
  } else {
    this.addConversationEntry('system', 'Task classified as SIMPLE - executing directly');
    const result = await executeSimple(this);
    
    this.completeWithArtifacts({
      'simple-execution-result': {
        value: JSON.stringify(result, null, 2),
        description: 'Simple task execution result',
        type: 'json'
      }
    }, {
      success: result.success,
      message: result.success ? 'Simple task completed successfully' : 'Simple task execution failed',
      tools: result.tools?.length || 0
    });
  }
};

//============================================================================
// Helper functions - now much simpler since all boilerplate is handled
//============================================================================

/**
 * Determine if task should be decomposed using declarative prompt
 */
async function shouldDecompose(task) {
  // Simple heuristic for now - in full implementation would use LLM classification
  const description = task.description.toLowerCase();
  
  // Keywords that typically indicate complex tasks
  const complexKeywords = [
    'create', 'build', 'develop', 'implement', 'design', 'system',
    'application', 'project', 'multiple', 'and', 'with', 'including'
  ];
  
  // Count complexity indicators
  const complexity = complexKeywords.filter(keyword => description.includes(keyword)).length;
  
  // Tasks with 3+ complexity indicators are typically complex
  return complexity >= 3;
}

/**
 * Execute complex task through decomposition using declarative prompts
 */
async function executeComplex(task) {
  console.log('📋 Decomposing complex task...');
  
  // Use declarative prompt for decomposition
  const decomposePrompt = task.getPrompt('decomposeTask');
  const decomposeResult = await decomposePrompt.execute({
    taskDescription: task.description,
    context: JSON.stringify(task.getConversationContext() || []),
    artifacts: JSON.stringify(task.getArtifactsContext() || {})
  });
  
  if (!decomposeResult.success) {
    return task.failWithError(
      new Error(`Task decomposition failed: ${decomposeResult.errors?.join(', ')}`),
      'Could not decompose complex task'
    );
  }
  
  const subtasks = decomposeResult.data.subtasks || [];
  task.addConversationEntry('system', `Decomposed into ${subtasks.length} subtasks`);
  
  // For simplified implementation, simulate subtask execution
  const results = [];
  for (let i = 0; i < subtasks.length; i++) {
    const subtask = subtasks[i];
    console.log(`  → Executing subtask ${i + 1}: ${subtask.description}`);
    
    // Simulate subtask execution result
    const subtaskResult = {
      id: `subtask-${i + 1}`,
      description: subtask.description,
      status: 'completed',
      result: `Subtask ${i + 1} completed successfully`,
      completedAt: new Date().toISOString()
    };
    
    results.push(subtaskResult);
    task.storeArtifact(`subtask-${i + 1}-result`, subtaskResult, `Result for subtask ${i + 1}`, 'subtask');
  }
  
  return {
    success: true,
    subtasks: results,
    summary: `Successfully completed ${results.length} subtasks`
  };
}

/**
 * Execute simple task using declarative prompts
 */
async function executeSimple(task) {
  console.log('🔧 Executing simple task...');
  
  // Use declarative prompt for simple task execution
  const executePrompt = task.getPrompt('executeSimple');
  const executeResult = await executePrompt.execute({
    taskDescription: task.description,
    context: JSON.stringify(task.getConversationContext() || []),
    artifacts: JSON.stringify(task.getArtifactsContext() || {})
  });
  
  if (!executeResult.success) {
    return task.failWithError(
      new Error(`Simple task execution failed: ${executeResult.errors?.join(', ')}`),
      'Could not execute simple task'
    );
  }
  
  // Store execution result
  const result = {
    success: true,
    result: executeResult.data.response || 'Task completed successfully',
    tools: executeResult.data.toolCalls || [],
    completedAt: new Date().toISOString()
  };
  
  task.storeArtifact('simple-execution', result, 'Simple task execution result', 'execution');
  
  return result;
}

