/**
 * RecursiveDecompositionStrategy - Pure prototypal recursive decomposition behavior
 * 
 * This is now a prototype object that inherits from TaskStrategy.
 * Only implements onMessage() to handle task messages.
 * All decomposition logic is preserved as internal functions.
 */

import { TaskStrategy } from '@legion/tasks';
import { TemplatedPrompt, PromptRegistry } from '@legion/prompting-manager';
import TaskClassifier from '../utils/TaskClassifier.js';
import ToolDiscovery from '../utils/ToolDiscovery.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create a RecursiveDecompositionStrategy prototype
 * This factory function creates the strategy with its dependencies
 */
export function createRecursiveDecompositionStrategy(llmClient = null, toolRegistry = null) {
  // Create the strategy as an object that inherits from TaskStrategy
  const strategy = Object.create(TaskStrategy);
  
  // Store configuration on the strategy
  const config = {
    taskClassifier: null,
    toolDiscovery: null,
    llmClient: llmClient,
    toolRegistry: toolRegistry,
    decompositionPrompt: null,
    executionPrompt: null,
    parentEvaluationPrompt: null,
    completionEvaluationPrompt: null
  };
  
  /**
   * The only required method - handles all messages
   */
  strategy.onMessage = function onMessage(senderTask, message) {
    // 'this' is the task instance that received the message
    
    try {
      // Determine if message is from child or parent
      if (senderTask.parent === this) {
        // Message from child task
        switch (message.type) {
          case 'completed':
            // Fire-and-forget async operation with error boundary
            handleChildComplete.call(this, senderTask, message.result, config).catch(error => {
              console.error(`❌ RecursiveDecompositionStrategy child completion handling failed: ${error.message}`);
              try {
                this.fail(error);
                if (this.parent) {
                  this.send(this.parent, { type: 'failed', error });
                }
              } catch (innerError) {
                console.error(`❌ Failed to handle child completion error: ${innerError.message}`);
              }
            });
            break;
          case 'failed':
            // Fire-and-forget async operation with error boundary
            handleChildFailure.call(this, senderTask, message.error, config).catch(error => {
              console.error(`❌ RecursiveDecompositionStrategy child failure handling failed: ${error.message}`);
              try {
                this.fail(error);
                if (this.parent) {
                  this.send(this.parent, { type: 'failed', error });
                }
              } catch (innerError) {
                console.error(`❌ Failed to handle child failure error: ${innerError.message}`);
              }
            });
            break;
          default:
            console.log(`⚠️ Unknown message type from child: ${message.type}`);
        }
      } else {
        // Message from parent or initiator
        switch (message.type) {
          case 'start':
          case 'work':
            // Fire-and-forget async operation with error boundary
            handleWorkMessage.call(this, config).catch(error => {
              console.error(`❌ RecursiveDecompositionStrategy work handling failed: ${error.message}`);
              try {
                this.fail(error);
                if (this.parent) {
                  this.send(this.parent, { type: 'failed', error });
                }
              } catch (innerError) {
                console.error(`❌ Failed to handle work error: ${innerError.message}`);
              }
            });
            break;
          default:
            console.log(`ℹ️ RecursiveDecompositionStrategy received unhandled message: ${message.type}`);
        }
      }
    } catch (error) {
      // Catch any synchronous errors in message handling
      console.error(`❌ RecursiveDecompositionStrategy message handler error: ${error.message}`);
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
export default createRecursiveDecompositionStrategy;

// ============================================================================
// Internal implementation functions
// These work with the task instance and strategy config
// ============================================================================

/**
 * Initialize strategy components
 */
async function initializeComponents(config, context) {
  const llmClient = config.llmClient || (context.lookup ? context.lookup('llmClient') : context.llmClient);
  const toolRegistry = config.toolRegistry || (context.lookup ? context.lookup('toolRegistry') : context.toolRegistry);
  
  if (!llmClient) {
    throw new Error('LLM client is required for RecursiveDecompositionStrategy');
  }
  
  if (!config.taskClassifier) {
    config.taskClassifier = new TaskClassifier(llmClient);
    await config.taskClassifier.initialize();
  }
  
  if (!config.toolDiscovery && toolRegistry) {
    config.toolDiscovery = new ToolDiscovery(llmClient, toolRegistry);
  } else if (!config.toolDiscovery) {
    throw new Error('ToolRegistry is required for RecursiveDecompositionStrategy');
  }
}

/**
 * Initialize prompt templates
 */
async function initializePrompts(config, context) {
  const llmClient = config.llmClient || (context.lookup ? context.lookup('llmClient') : context.llmClient);
  
  if (!config.decompositionPrompt && llmClient) {
    const promptRegistry = new PromptRegistry(path.join(__dirname, 'prompts'));
    
    const decompositionTemplate = await promptRegistry.load('task-decomposition');
    config.decompositionPrompt = new TemplatedPrompt({
      prompt: decompositionTemplate,
      responseSchema: getDecompositionSchema(),
      llmClient: llmClient,
      maxRetries: 3
    });
    
    const executionTemplate = await promptRegistry.load('task-execution');
    config.executionPrompt = new TemplatedPrompt({
      prompt: executionTemplate,
      responseSchema: getSimpleTaskSchema(),
      llmClient: llmClient,
      maxRetries: 3
    });
    
    const parentEvalTemplate = await promptRegistry.load('parent-evaluation');
    config.parentEvaluationPrompt = new TemplatedPrompt({
      prompt: parentEvalTemplate,
      responseSchema: getParentEvaluationSchema(),
      llmClient: llmClient,
      maxRetries: 3
    });
    
    const completionEvalTemplate = await promptRegistry.load('completion-evaluation');
    config.completionEvaluationPrompt = new TemplatedPrompt({
      prompt: completionEvalTemplate,
      responseSchema: getCompletionEvaluationSchema(),
      llmClient: llmClient,
      maxRetries: 3
    });
  }
}

/**
 * Handle work/start messages - main task execution
 */
async function handleWorkMessage(config) {
  const context = getContextFromTask(this);
  
  await initializeComponents(config, context);
  
  // Classify the task
  if (!this.metadata.classification) {
    const classification = await classifyTask(this, config);
    this.metadata.classification = classification.complexity;
    this.addConversationEntry('system', `Task classified as ${classification.complexity}: ${classification.reasoning}`);
  }
  
  // Execute based on classification (fire-and-forget)
  if (this.metadata.classification === 'SIMPLE') {
    await executeSimple(this, config, context);
  } else {
    await executeComplex(this, config, context);
  }
  // Fire-and-forget - no return value
}

/**
 * Handle child task completion
 */
async function handleChildComplete(childTask, result, config) {
  const context = getContextFromTask(this);
  
  // Receive goal outputs from child
  const delivered = childTask.deliverGoalOutputs(this);
  if (delivered.length > 0) {
    console.log(`📦 Parent received ${delivered.length} artifacts from child: ${delivered.join(', ')}`);
    for (const name of delivered) {
      this.addArtifact(name);
    }
  }
  
  // Get parent's evaluation
  const evaluation = await getParentEvaluation(this, childTask, config, context);
  
  console.log(`🤔 Parent evaluation: ${evaluation.decision} - ${evaluation.reasoning}`);
  this.addConversationEntry('system', 
    `Evaluated subtask completion. Decision: ${evaluation.decision}. Reasoning: ${evaluation.reasoning}`);
  
  // Act on the decision (all fire-and-forget)
  switch (evaluation.decision) {
    case 'CONTINUE':
      const nextSubtask = await this.createNextSubtask(context.taskManager);
      if (!nextSubtask) {
        await evaluateCompletion(this, config, context);
      } else {
        console.log(`📍 Executing next subtask ${this.currentSubtaskIndex + 1}/${this.plannedSubtasks.length}: ${nextSubtask.description}`);
        nextSubtask.send(nextSubtask, { type: 'start' });
      }
      break;
      
    case 'COMPLETE':
      await evaluateCompletion(this, config, context);
      break;
      
    case 'RETRY':
      console.log(`🔄 Retrying subtask: ${childTask.description}`);
      childTask.send(childTask, { type: 'start' });
      break;
      
    case 'REPLAN':
      console.log(`🔄 Replanning task...`);
      this.metadata.isDecomposed = false;
      this.plannedSubtasks = [];
      this.currentSubtaskIndex = -1;
      await executeComplex(this, config, context);
      break;
      
    default:
      console.log(`⚠️ Unknown evaluation decision: ${evaluation.decision}`);
      await evaluateCompletion(this, config, context);
  }
  // Fire-and-forget - no return value
}

/**
 * Handle child task failure
 */
async function handleChildFailure(childTask, error, config) {
  console.log(`❌ Subtask failed: ${childTask.description}`);
  console.log(`   Error: ${error.message}`);
  
  this.addConversationEntry('system', 
    `Subtask "${childTask.description}" failed: ${error.message}`);
  
  this.fail(error);
  
  // Notify parent of failure (fire-and-forget)
  if (this.parent) {
    this.send(this.parent, { 
      type: 'failed', 
      error: new Error(`Subtask failed: ${error.message}`),
      artifacts: Object.values(this.getAllArtifacts())
    });
  }
  // Fire-and-forget - no return value
}

/**
 * Extract context from task
 */
function getContextFromTask(task) {
  return {
    llmClient: task.lookup ? task.lookup('llmClient') : task.llmClient,
    fastToolDiscovery: task.lookup ? task.lookup('fastToolDiscovery') : task.fastToolDiscovery,
    workspaceDir: task.lookup ? task.lookup('workspaceDir') : task.workspaceDir,
    agent: task.lookup ? task.lookup('agent') : task.agent,
    maxDepth: task.lookup ? task.lookup('maxDepth') : task.maxDepth,
    maxSubtasks: task.lookup ? task.lookup('maxSubtasks') : task.maxSubtasks,
    executionTimeout: task.lookup ? task.lookup('executionTimeout') : task.executionTimeout,
    taskManager: task.lookup ? task.lookup('taskManager') : task.taskManager,
    lookup: task.lookup ? task.lookup.bind(task) : null
  };
}

/**
 * Classify task using LLM
 */
async function classifyTask(task, config) {
  if (!config.taskClassifier) {
    throw new Error('TaskClassifier is not initialized');
  }

  const classification = await config.taskClassifier.classify(
    { description: task.description }
  );
  
  console.log(`📋 Task "${task.description}" classified as ${classification.complexity}: ${classification.reasoning}`);
  
  return {
    complexity: classification.complexity,
    reasoning: classification.reasoning
  };
}

/**
 * Decompose complex task into subtasks
 */
async function decompose(task, config, context) {
  const llmClient = config.llmClient || (context.lookup ? context.lookup('llmClient') : context.llmClient);
  
  if (!llmClient) {
    throw new Error('LLM client is required for decomposition');
  }

  await initializeComponents(config, context);
  await initializePrompts(config, context);

  const result = await config.decompositionPrompt.execute({
    taskDescription: task.description,
    conversation: JSON.stringify(task.getConversationContext() || []),
    artifacts: JSON.stringify(task.getArtifactsContext() || {})
  });
  
  if (!result.success) {
    const errorMessages = result.errors?.map(e => 
      typeof e === 'string' ? e : (e.message || String(e))
    ) || ['Unknown error'];
    throw new Error(`Invalid decomposition response: ${errorMessages.join(', ')}`);
  }
  
  return result.data;
}

/**
 * Execute a simple task with tools
 */
async function executeSimple(task, config, context) {
  if (!config.toolDiscovery) {
    throw new Error('ToolDiscovery is not initialized');
  }
  
  console.log(`🔧 Discovering tools for SIMPLE task...`);
  
  const discoveredTools = await config.toolDiscovery.discoverTools(task.description);
  
  task.addConversationEntry('system', `Discovered ${discoveredTools.length} tools`);
  
  if (discoveredTools.length === 0) {
    console.log(`⚠️ No tools found for SIMPLE task`);
    task.fail(new Error('Unable to find suitable tools for this task'));
    
    // Notify parent of failure (fire-and-forget)
    if (task.parent) {
      task.send(task.parent, {
        type: 'failed',
        error: new Error('Unable to find suitable tools for this task'),
        artifacts: Object.values(task.getAllArtifacts())
      });
    }
    return; // Fire-and-forget - no return value
  }
  
  task.currentTools = discoveredTools;
  
  const executionPlan = await getSimpleTaskExecution(task, discoveredTools, config, context);
  
  if (executionPlan.toolCalls && executionPlan.toolCalls.length > 0) {
    const toolResult = await executeWithTools(task, executionPlan.toolCalls, context);
    
    for (const result of toolResult.results) {
      if (result.tool) {
        task.addToolResult(result.tool, result.inputs || {}, result);
      }
    }
    
    // Complete task with result
    task.complete(toolResult);
    
    // Notify parent (fire-and-forget)
    if (task.parent) {
      task.send(task.parent, { type: 'completed', result: toolResult });
    }
  } else {
    const result = {
      success: true,
      result: executionPlan.response || 'Task completed',
      artifacts: Object.values(task.getAllArtifacts())
    };
    
    // Complete task
    task.complete(result);
    
    // Notify parent (fire-and-forget)
    if (task.parent) {
      task.send(task.parent, { type: 'completed', result });
    }
  }
  // Fire-and-forget - no return value
}

/**
 * Execute a complex task through decomposition
 */
async function executeComplex(task, config, context) {
  if (!task.metadata.isDecomposed) {
    const decomposition = await decompose(task, config, context);
    
    if (!decomposition.subtasks || decomposition.subtasks.length === 0) {
      console.log(`⚠️ Could not decompose COMPLEX task`);
      task.fail(new Error('Unable to decompose this complex task'));
      
      // Notify parent of failure (fire-and-forget)
      if (task.parent) {
        task.send(task.parent, {
          type: 'failed',
          error: new Error('Unable to decompose this complex task'),
          artifacts: Object.values(task.getAllArtifacts())
        });
      }
      return; // Fire-and-forget - no return value
    }
    
    task.setDecomposition(decomposition.subtasks);
    console.log(`📋 Task decomposed into ${decomposition.subtasks.length} subtasks`);
  }
  
  const subtask = await task.createNextSubtask(context.taskManager);
  
  if (!subtask) {
    await evaluateCompletion(task, config, context);
    return; // Fire-and-forget - no return value
  }
  
  console.log(`📍 Executing subtask ${task.currentSubtaskIndex + 1}/${task.plannedSubtasks.length}: ${subtask.description}`);
  
  // Send start message to subtask (fire-and-forget)
  subtask.send(subtask, { type: 'start' });
  
  // Fire-and-forget - no return value
}

/**
 * Evaluate if task is complete
 */
async function evaluateCompletion(task, config, context) {
  console.log(`🎯 Evaluating if task "${task.description}" is complete...`);
  
  await initializeComponents(config, context);
  await initializePrompts(config, context);
  
  const result = await config.completionEvaluationPrompt.execute({
    taskDescription: task.description,
    conversation: JSON.stringify(task.getConversationContext() || []),
    artifacts: JSON.stringify(task.getArtifactsContext() || {}),
    completedSubtasks: JSON.stringify(task.getCompletedSubtasks() || [])
  });
  
  let evaluation;
  if (!result.success) {
    console.log(`⚠️ Invalid completion evaluation response: ${result.errors?.join(', ') || 'Unknown error'}`);
    evaluation = { isComplete: false, reasoning: 'Invalid evaluation response' };
  } else {
    const data = result.data;
    evaluation = {
      isComplete: data.complete !== undefined ? data.complete : data.isComplete,
      reasoning: data.reason || data.reasoning || 'No reason provided',
      summary: data.result || data.summary
    };
  }
  
  console.log(`🎯 Task completion evaluation: ${evaluation.isComplete ? 'COMPLETE' : 'INCOMPLETE'} - ${evaluation.reasoning}`);
  
  if (evaluation.isComplete) {
    const result = {
      success: true,
      result: {
        success: true,
        message: 'Task completed',
        summary: evaluation.summary || `Task "${task.description}" completed successfully`
      },
      artifacts: Object.values(task.getAllArtifacts())
    };
    
    task.complete(result);
    
    if (task.parent) {
      task.parent.send(task.parent, { type: 'completed', result });
    }
    
    return result;
  } else {
    if (task.plannedSubtasks.length > 0 && task.currentSubtaskIndex < task.plannedSubtasks.length - 1) {
      const nextSubtask = await task.createNextSubtask(context.taskManager);
      if (nextSubtask) {
        console.log(`📍 Continuing with next subtask: ${nextSubtask.description}`);
        nextSubtask.send(nextSubtask, { type: 'start' });
        return { status: 'continuing' };
      }
    }
    
    console.log(`⚠️ Task incomplete but no more subtasks to execute`);
    task.fail(new Error('Task incomplete but no more subtasks to execute'));
    
    return {
      success: false,
      result: evaluation.reasoning || 'Task could not be completed',
      artifacts: Object.values(task.getAllArtifacts())
    };
  }
}

/**
 * Get simple task execution plan from LLM
 */
async function getSimpleTaskExecution(task, discoveredTools, config, context) {
  await initializeComponents(config, context);
  await initializePrompts(config, context);
  
  const toolDescriptions = discoveredTools.map(tool => ({
    name: tool.name,
    description: tool.description || '',
    parameters: tool.inputSchema || {}
  }));
  
  const result = await config.executionPrompt.execute({
    taskDescription: task.description,
    tools: JSON.stringify(toolDescriptions),
    conversation: JSON.stringify(task.getConversationContext() || []),
    artifacts: JSON.stringify(task.getArtifactsContext() || {})
  });
  
  if (!result.success) {
    throw new Error(`Invalid execution response: ${result.errors?.join(', ') || 'Unknown error'}`);
  }

  return result.data;
}

/**
 * Execute tool calls
 */
async function executeWithTools(task, toolCalls, context) {
  const results = [];
  
  for (const toolCall of toolCalls) {
    const tool = task.currentTools.find(t => 
      t.name.toLowerCase() === toolCall.tool.toLowerCase()
    );
    
    if (!tool) {
      console.log(`⚠️ Tool not found: ${toolCall.tool}`);
      results.push({
        tool: toolCall.tool,
        inputs: toolCall.inputs,
        success: false,
        error: `Tool not found: ${toolCall.tool}`
      });
      continue;
    }
    
    try {
      console.log(`🔧 Executing tool: ${tool.name}`);
      const result = await tool.execute(toolCall.inputs);
      
      results.push({
        tool: tool.name,
        inputs: toolCall.inputs,
        success: true,
        output: result
      });
      
      if (tool.name === 'file_write' && toolCall.inputs.filepath) {
        task.storeArtifact(
          toolCall.inputs.filepath,
          toolCall.inputs.content,
          `File created at ${toolCall.inputs.filepath}`,
          'file'
        );
      }
    } catch (error) {
      console.log(`❌ Tool execution failed: ${error.message}`);
      results.push({
        tool: tool.name,
        inputs: toolCall.inputs,
        success: false,
        error: error.message
      });
    }
  }
  
  return {
    success: results.some(r => r.success),
    results: results,
    artifacts: Object.values(task.getAllArtifacts())
  };
}

/**
 * Get parent's evaluation of child completion
 */
async function getParentEvaluation(task, childTask, config, context) {
  await initializeComponents(config, context);
  await initializePrompts(config, context);
  
  const result = await config.parentEvaluationPrompt.execute({
    parentTaskDescription: task.description,
    childTaskDescription: childTask.description,
    conversation: JSON.stringify(task.getConversationContext() || []),
    artifacts: JSON.stringify(task.getArtifactsContext() || {}),
    completedSubtasks: JSON.stringify(task.getCompletedSubtasks() || [])
  });
  
  if (!result.success) {
    console.log(`⚠️ Invalid parent evaluation response: ${result.errors?.join(', ') || 'Unknown error'}`);
    return { decision: 'CONTINUE', reasoning: 'Invalid evaluation response' };
  }

  return result.data;
}

// Schema functions
function getDecompositionSchema() {
  return {
    type: 'object',
    properties: {
      decompose: { type: 'boolean' },
      subtasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            inputs: { type: 'string' },
            outputs: { type: 'string' }
          },
          required: ['description']
        }
      }
    },
    required: ['decompose', 'subtasks'],
    format: 'json'
  };
}

function getSimpleTaskSchema() {
  return {
    type: 'object',
    anyOf: [
      {
        type: 'object',
        properties: {
          useTools: { type: 'boolean', const: true },
          toolCalls: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                tool: { type: 'string' },
                inputs: { type: 'object' },
                outputs: { type: 'object' }
              },
              required: ['tool', 'inputs']
            }
          }
        },
        required: ['useTools', 'toolCalls']
      },
      {
        type: 'object',
        properties: {
          response: { type: 'string' }
        },
        required: ['response']
      }
    ],
    format: 'json'
  };
}

function getParentEvaluationSchema() {
  return {
    type: 'object',
    properties: {
      decision: {
        type: 'string',
        enum: ['CONTINUE', 'COMPLETE', 'RETRY', 'REPLAN']
      },
      reasoning: { type: 'string' }
    },
    required: ['decision', 'reasoning'],
    format: 'json'
  };
}

function getCompletionEvaluationSchema() {
  return {
    type: 'object',
    properties: {
      complete: { type: 'boolean' },
      isComplete: { type: 'boolean' },
      reason: { type: 'string' },
      reasoning: { type: 'string' },
      result: { type: 'string' },
      summary: { type: 'string' }
    },
    required: [],
    format: 'json'
  };
}