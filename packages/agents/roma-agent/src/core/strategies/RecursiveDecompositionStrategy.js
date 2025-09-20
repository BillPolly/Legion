/**
 * RecursiveDecompositionStrategy - Current ROMA recursive decomposition behavior
 * 
 * Implements the existing recursive task decomposition pattern with minimal public interface:
 * - execute(): Main entry point that internally classifies and routes to simple/complex execution
 * - onChildMessage(): Handles messages from child tasks
 * - onParentMessage(): Handles messages from parent tasks
 * 
 * All the existing behavior (classification, decomposition, execution) is preserved as internal methods.
 */

import { TaskStrategy } from '@legion/tasks';
import { TemplatedPrompt } from '@legion/prompting-manager';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let instance = null;

export default class RecursiveDecompositionStrategy extends TaskStrategy {
  constructor() {
    super();
    if (instance) {
      return instance;
    }
    instance = this;
    
    // Prompt templates will be initialized on first use
    this.decompositionPrompt = null;
    this.executionPrompt = null;
    this.parentEvaluationPrompt = null;
    this.completionEvaluationPrompt = null;
  }
  
  /**
   * Initialize prompt templates
   */
  async _initializePrompts(context) {
    if (!this.decompositionPrompt && context.llmClient) {
      const promptsDir = path.join(__dirname, '..', '..', 'prompts');
      
      // Load decomposition prompt
      const decompositionTemplate = await fs.readFile(
        path.join(promptsDir, 'task-decomposition.md'), 
        'utf-8'
      );
      this.decompositionPrompt = new TemplatedPrompt({
        prompt: decompositionTemplate,
        responseSchema: this._getDecompositionSchema(),
        llmClient: context.llmClient,
        maxRetries: 3
      });
      
      // Load execution prompt
      const executionTemplate = await fs.readFile(
        path.join(promptsDir, 'task-execution.md'),
        'utf-8'
      );
      this.executionPrompt = new TemplatedPrompt({
        prompt: executionTemplate,
        responseSchema: this._getSimpleTaskSchema(),
        llmClient: context.llmClient,
        maxRetries: 3
      });
      
      // Load parent evaluation prompt
      const parentEvalTemplate = await fs.readFile(
        path.join(promptsDir, 'parent-evaluation.md'),
        'utf-8'
      );
      this.parentEvaluationPrompt = new TemplatedPrompt({
        prompt: parentEvalTemplate,
        responseSchema: this._getParentEvaluationSchema(),
        llmClient: context.llmClient,
        maxRetries: 3
      });
      
      // Load completion evaluation prompt
      const completionEvalTemplate = await fs.readFile(
        path.join(promptsDir, 'completion-evaluation.md'),
        'utf-8'
      );
      this.completionEvaluationPrompt = new TemplatedPrompt({
        prompt: completionEvalTemplate,
        responseSchema: this._getCompletionEvaluationSchema(),
        llmClient: context.llmClient,
        maxRetries: 3
      });
    }
  }
  
  /**
   * Get schema for decomposition responses
   */
  _getDecompositionSchema() {
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
  
  /**
   * Get schema for simple task execution responses
   */
  _getSimpleTaskSchema() {
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
  
  /**
   * Get schema for parent evaluation responses
   */
  _getParentEvaluationSchema() {
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
  
  /**
   * Get schema for completion evaluation responses
   */
  _getCompletionEvaluationSchema() {
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

  /**
   * Get singleton instance
   */
  static getInstance() {
    if (!instance) {
      instance = new RecursiveDecompositionStrategy();
    }
    return instance;
  }

  getName() {
    return 'RecursiveDecomposition';
  }

  /**
   * Main execution entry point
   * Internally classifies the task and routes to appropriate execution path
   */
  async execute(task) {
    // Get context from the task (it has everything we need)
    const context = this._getContextFromTask(task);
    
    // Classify the task (unless already classified)
    if (!task.metadata.classification) {
      const classification = await this._classify(task, context);
      task.metadata.classification = classification.complexity;
      task.addConversationEntry('system', `Task classified as ${classification.complexity}: ${classification.reasoning}`);
    }
    
    // Execute based on classification - same behavior as before
    if (task.metadata.classification === 'SIMPLE') {
      return await this._executeSimple(task, context);
    } else {
      return await this._executeComplex(task, context);
    }
  }

  /**
   * Handle messages from child tasks
   */
  async onChildMessage(childTask, message) {
    // Get parent task and context
    const task = childTask.parent;
    if (!task) {
      throw new Error('Child task has no parent');
    }
    
    const context = this._getContextFromTask(task);
    
    // Route based on message type
    switch (message.type) {
      case 'completed':
        return await this._onChildComplete(task, childTask, message.result, context);
      
      case 'failed':
        return await this._onChildFailure(task, childTask, message.error, context);
      
      case 'progress':
        // Could handle progress updates in future
        console.log(`📊 Progress from ${childTask.description}: ${message.status}`);
        return { acknowledged: true };
      
      default:
        console.log(`⚠️ Unknown message type from child: ${message.type}`);
        return { acknowledged: false, error: 'Unknown message type' };
    }
  }

  /**
   * Handle messages from parent task
   */
  async onParentMessage(parentTask, message) {
    // For now, just acknowledge parent messages
    // Could handle directives like 'abort', 'update_priority', etc.
    switch (message.type) {
      case 'abort':
        console.log(`🛑 Received abort from parent`);
        // Could implement abort logic here
        return { acknowledged: true, aborted: true };
      
      case 'update_context':
        console.log(`🔄 Received context update from parent`);
        // Could update task context here
        return { acknowledged: true };
      
      default:
        return { acknowledged: true };
    }
  }

  /**
   * Extract context from task (internal utility)
   * @private
   */
  _getContextFromTask(task) {
    return {
      llmClient: task.llmClient,
      taskClassifier: task.taskClassifier,
      toolDiscovery: task.toolDiscovery,
      sessionLogger: task.sessionLogger,
      simpleTaskValidator: task.simpleTaskValidator,
      decompositionValidator: task.decompositionValidator,
      parentEvaluationValidator: task.parentEvaluationValidator,
      completionEvaluationValidator: task.completionEvaluationValidator,
      fastToolDiscovery: task.fastToolDiscovery,
      workspaceDir: task.workspaceDir,
      agent: task.agent,
      testMode: task.testMode,
      taskManager: task.taskManager
    };
  }

  /**
   * Classify task using LLM (internal utility, was public classify())
   * @private
   */
  async _classify(task, context) {
    const { taskClassifier, sessionLogger } = context;
    
    if (!taskClassifier) {
      throw new Error('TaskClassifier is required for classification');
    }

    // Resolve any artifact references in the task description
    const resolvedDescription = task.artifactRegistry 
      ? task.artifactRegistry.resolveReferences(task.description)
      : task.description;

    const classification = await taskClassifier.classify(
      { description: resolvedDescription }, 
      sessionLogger
    );
    
    console.log(`📋 Task "${task.description}" classified as ${classification.complexity}: ${classification.reasoning}`);
    
    return {
      complexity: classification.complexity,
      reasoning: classification.reasoning
    };
  }

  /**
   * Decompose complex task into subtasks (internal utility, was public decompose())
   * @private
   */
  async _decompose(task, context) {
    const { llmClient, decompositionValidator, sessionLogger } = context;
    
    if (!llmClient) {
      throw new Error('LLM client is required for decomposition');
    }

    // Initialize prompts if needed
    await this._initializePrompts(context);

    // Execute decomposition prompt with placeholders
    const result = await this.decompositionPrompt.execute({
      taskDescription: task.description,
      conversation: JSON.stringify(task.getConversationContext() || []),
      artifacts: JSON.stringify(task.getArtifactsContext() || {})
    });
    
    if (!result.success) {
      // Ensure errors are properly converted to strings
      const errorMessages = result.errors?.map(e => 
        typeof e === 'string' ? e : (e.message || String(e))
      ) || ['Unknown error'];
      throw new Error(`Invalid decomposition response: ${errorMessages.join(', ')}`);
    }
    
    if (sessionLogger) {
      // Log the interaction (prompt template and response)
      await sessionLogger.logInteraction(task, 'decomposition', 
        `Task: ${task.description}`, 
        JSON.stringify(result.data)
      );
    }

    return result.data;
  }

  /**
   * Execute a simple task with tools (internal utility, was public executeSimple())
   * @private
   */
  async _executeSimple(task, context) {
    const { toolDiscovery, llmClient, simpleTaskValidator, sessionLogger } = context;
    
    // Discover tools
    console.log(`🔧 Discovering tools for SIMPLE task...`);
    
    // Normal semantic tool discovery
    const discoveredTools = await toolDiscovery.discoverTools(task.description);
    
    task.addConversationEntry('system', `Discovered ${discoveredTools.length} tools`);
    
    if (discoveredTools.length === 0) {
      console.log(`⚠️ No tools found for SIMPLE task`);
      return {
        success: false,
        result: `Unable to find suitable tools for this task`,
        artifacts: task.artifactRegistry?.toJSON() || []
      };
    }
    
    // Save discovered tools for this task
    task.currentTools = discoveredTools;
    
    // Also save on agent for test compatibility
    if (context.agent) {
      context.agent.currentTools = discoveredTools;
    }
    
    // Get execution plan from LLM
    const executionPlan = await this._getSimpleTaskExecution(task, discoveredTools, context);
    
    if (executionPlan.toolCalls && executionPlan.toolCalls.length > 0) {
      // Execute the tool calls
      const toolResult = await this._executeWithTools(task, executionPlan.toolCalls, context);
      
      // Add tool results to task conversation
      for (const result of toolResult.results) {
        if (result.tool) {
          task.addToolResult(result.tool, result.inputs || {}, result);
        }
      }
      
      return toolResult;
    } else {
      // Direct LLM response (for analysis, explanation, etc.)
      return {
        success: true,
        result: executionPlan.response || 'Task completed',
        artifacts: task.artifactRegistry?.toJSON() || []
      };
    }
  }

  /**
   * Execute a complex task through decomposition (internal utility, was public executeComplex())
   * @private
   */
  async _executeComplex(task, context) {
    // Decompose if not already done
    if (!task.metadata.isDecomposed) {
      const decomposition = await this._decompose(task, context);
      
      if (!decomposition.subtasks || decomposition.subtasks.length === 0) {
        console.log(`⚠️ Could not decompose COMPLEX task`);
        return {
          success: false,
          result: `Unable to decompose this complex task`,
          artifacts: task.artifactRegistry?.toJSON() || []
        };
      }
      
      // Store decomposition in task
      task.setDecomposition(decomposition.subtasks);
      console.log(`📋 Task decomposed into ${decomposition.subtasks.length} subtasks`);
    }
    
    // Create and execute the next subtask
    const subtask = await task.createNextSubtask(context.taskManager);
    
    if (!subtask) {
      // No subtasks to execute - evaluate completion
      return await this._evaluateCompletion(task, context);
    }
    
    console.log(`📍 Executing subtask ${task.currentSubtaskIndex + 1}/${task.plannedSubtasks.length}: ${subtask.description}`);
    
    // Execute the subtask recursively
    const subtaskResult = await subtask.execute();
    
    // Check if subtask failed due to depth limit
    if (!subtaskResult.success && subtaskResult.result && 
        typeof subtaskResult.result === 'string' && 
        subtaskResult.result.includes('Maximum recursion depth exceeded')) {
      // Propagate depth limit failure immediately
      task.fail(new Error(subtaskResult.result));
      return subtaskResult;
    }
    
    // Handle child completion or failure through messages
    if (subtaskResult.success) {
      return await this.onChildMessage(subtask, { type: 'completed', result: subtaskResult });
    } else {
      return await this.onChildMessage(subtask, { type: 'failed', error: new Error(subtaskResult.result) });
    }
  }

  /**
   * Handle child task completion (internal utility, was public onChildComplete())
   * @private
   */
  async _onChildComplete(task, childTask, result, context) {
    // Receive goal outputs from the child
    if (childTask.artifactRegistry && task.artifactRegistry) {
      const delivered = await childTask.deliverGoalOutputs(task.artifactRegistry);
      if (delivered.length > 0) {
        console.log(`📦 Parent received ${delivered.length} artifacts from child: ${delivered.join(', ')}`);
        // Add delivered artifacts to parent's artifact set
        for (const name of delivered) {
          task.addArtifact(name);
        }
      }
    }
    
    // Get parent's evaluation of what to do next
    const evaluation = await this._getParentEvaluation(task, childTask, context);
    
    console.log(`🤔 Parent evaluation: ${evaluation.decision} - ${evaluation.reasoning}`);
    task.addConversationEntry('system', 
      `Evaluated subtask completion. Decision: ${evaluation.decision}. Reasoning: ${evaluation.reasoning}`);
    
    // Act on the decision
    switch (evaluation.decision) {
      case 'CONTINUE':
        // Continue with next subtask
        const nextSubtask = await task.createNextSubtask(context.taskManager);
        
        if (!nextSubtask) {
          // No more subtasks - evaluate completion
          return await this._evaluateCompletion(task, context);
        }
        
        console.log(`📍 Executing next subtask ${task.currentSubtaskIndex + 1}/${task.plannedSubtasks.length}: ${nextSubtask.description}`);
        const nextResult = await nextSubtask.execute();
        
        // Recursively handle the next subtask result through messages
        if (nextResult.success) {
          return await this.onChildMessage(nextSubtask, { type: 'completed', result: nextResult });
        } else {
          return await this.onChildMessage(nextSubtask, { type: 'failed', error: new Error(nextResult.result) });
        }
        
      case 'COMPLETE':
        // Task is complete
        return await this._evaluateCompletion(task, context);
        
      case 'RETRY':
        // Retry the same subtask
        console.log(`🔄 Retrying subtask: ${childTask.description}`);
        const retryResult = await childTask.execute();
        
        // Recursively handle retry result through messages
        if (retryResult.success) {
          return await this.onChildMessage(childTask, { type: 'completed', result: retryResult });
        } else {
          return await this.onChildMessage(childTask, { type: 'failed', error: new Error(retryResult.result) });
        }
        
      case 'REPLAN':
        // Clear current plan and re-decompose
        console.log(`🔄 Replanning task...`);
        task.metadata.isDecomposed = false;
        task.plannedSubtasks = [];
        task.currentSubtaskIndex = -1;
        
        // Execute complex task again with new decomposition
        return await this._executeComplex(task, context);
        
      default:
        console.log(`⚠️ Unknown evaluation decision: ${evaluation.decision}`);
        return await this._evaluateCompletion(task, context);
    }
  }

  /**
   * Handle child task failure (internal utility, was public onChildFailure())
   * @private
   */
  async _onChildFailure(task, childTask, error, context) {
    console.log(`❌ Subtask failed: ${childTask.description}`);
    console.log(`   Error: ${error.message}`);
    
    task.addConversationEntry('system', 
      `Subtask "${childTask.description}" failed: ${error.message}`);
    
    // For now, fail the parent task too
    // In future, could add retry logic or alternative strategies
    task.fail(error);
    
    return {
      success: false,
      result: `Subtask failed: ${error.message}`,
      artifacts: task.artifactRegistry?.toJSON() || []
    };
  }

  /**
   * Evaluate if task is complete (internal utility, was public evaluateCompletion())
   * @private
   */
  async _evaluateCompletion(task, context) {
    const { llmClient, completionEvaluationValidator, sessionLogger } = context;
    
    console.log(`🎯 Evaluating if task "${task.description}" is complete...`);
    
    // Initialize prompts if needed
    await this._initializePrompts(context);
    
    // Execute completion evaluation prompt with placeholders
    const result = await this.completionEvaluationPrompt.execute({
      taskDescription: task.description,
      conversation: JSON.stringify(task.getConversationContext() || []),
      artifacts: JSON.stringify(task.getArtifactsContext() || {}),
      completedSubtasks: JSON.stringify(task.getCompletedSubtasks() || [])
    });
    
    if (sessionLogger) {
      await sessionLogger.logInteraction(task, 'completion_evaluation', 
        `Task: ${task.description}`, 
        JSON.stringify(result.data || result)
      );
    }

    // Handle the response
    let evaluation;
    if (!result.success) {
      console.log(`⚠️ Invalid completion evaluation response: ${result.errors?.join(', ') || 'Unknown error'}`);
      // Default to incomplete if validation fails
      evaluation = { isComplete: false, reasoning: 'Invalid evaluation response' };
    } else {
      // Map 'complete' field to 'isComplete' field for compatibility
      const data = result.data;
      evaluation = {
        isComplete: data.complete !== undefined ? data.complete : data.isComplete,
        reasoning: data.reason || data.reasoning || 'No reason provided',
        summary: data.result || data.summary
      };
    }
    
    console.log(`🎯 Task completion evaluation: ${evaluation.isComplete ? 'COMPLETE' : 'INCOMPLETE'} - ${evaluation.reasoning}`);
    
    if (evaluation.isComplete) {
      // Task is complete
      const result = {
        success: true,
        result: {
          success: true,
          message: 'Task completed',
          summary: evaluation.summary || `Task "${task.description}" completed successfully`
        },
        artifacts: task.artifactRegistry?.toJSON() || []
      };
      
      task.complete(result);
      
      // If task has a parent, let parent evaluate through message
      if (task.parent) {
        return await this.onChildMessage(task, { type: 'completed', result });
      }
      
      return result;
    } else {
      // Task is not complete - need to continue or fail
      if (task.plannedSubtasks.length > 0 && task.currentSubtaskIndex < task.plannedSubtasks.length - 1) {
        // Still have subtasks to execute
        const nextSubtask = await task.createNextSubtask(context.taskManager);
        if (nextSubtask) {
          console.log(`📍 Continuing with next subtask: ${nextSubtask.description}`);
          const nextResult = await nextSubtask.execute();
          
          if (nextResult.success) {
            return await this.onChildMessage(nextSubtask, { type: 'completed', result: nextResult });
          } else {
            return await this.onChildMessage(nextSubtask, { type: 'failed', error: new Error(nextResult.result) });
          }
        }
      }
      
      // No more subtasks but task is incomplete
      console.log(`⚠️ Task incomplete but no more subtasks to execute`);
      task.fail(new Error('Task incomplete but no more subtasks to execute'));
      
      return {
        success: false,
        result: evaluation.reasoning || 'Task could not be completed',
        artifacts: task.artifactRegistry?.toJSON() || []
      };
    }
  }

  /**
   * Get simple task execution plan from LLM
   * @private
   */
  async _getSimpleTaskExecution(task, discoveredTools, context) {
    const { llmClient, simpleTaskValidator, sessionLogger } = context;
    
    // Initialize prompts if needed
    await this._initializePrompts(context);
    
    // Format tools for prompt
    const toolDescriptions = discoveredTools.map(tool => ({
      name: tool.name,
      description: tool.description || '',
      parameters: tool.inputSchema || {}
    }));
    
    // Execute execution prompt with placeholders
    const result = await this.executionPrompt.execute({
      taskDescription: task.description,
      tools: JSON.stringify(toolDescriptions),
      conversation: JSON.stringify(task.getConversationContext() || []),
      artifacts: JSON.stringify(task.getArtifactsContext() || {})
    });
    
    if (sessionLogger) {
      await sessionLogger.logInteraction(task, 'simple_execution',
        `Task: ${task.description}, Tools: ${discoveredTools.map(t => t.name).join(', ')}`,
        JSON.stringify(result.data || result)
      );
    }

    if (!result.success) {
      throw new Error(`Invalid execution response: ${result.errors?.join(', ') || 'Unknown error'}`);
    }

    return result.data;
  }

  /**
   * Execute tool calls
   * @private
   */
  async _executeWithTools(task, toolCalls, context) {
    const results = [];
    
    for (const toolCall of toolCalls) {
      // Case-insensitive tool matching
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
        
        // Handle file artifacts
        if (tool.name === 'file_write' && toolCall.inputs.filepath) {
          await task.ensureArtifactRegistry();
          task.artifactRegistry.store(
            toolCall.inputs.filepath,
            toolCall.inputs.content,
            `File created at ${toolCall.inputs.filepath}`,
            'file'
          );
          task.addArtifact(toolCall.inputs.filepath);
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
      artifacts: task.artifactRegistry?.toJSON() || []
    };
  }

  /**
   * Get parent's evaluation of child completion
   * @private
   */
  async _getParentEvaluation(task, childTask, context) {
    const { llmClient, parentEvaluationValidator, sessionLogger } = context;
    
    // Initialize prompts if needed
    await this._initializePrompts(context);
    
    // Execute parent evaluation prompt with placeholders
    const result = await this.parentEvaluationPrompt.execute({
      parentTaskDescription: task.description,
      childTaskDescription: childTask.description,
      conversation: JSON.stringify(task.getConversationContext() || []),
      artifacts: JSON.stringify(task.getArtifactsContext() || {}),
      completedSubtasks: JSON.stringify(task.getCompletedSubtasks() || [])
    });
    
    if (sessionLogger) {
      await sessionLogger.logInteraction(task, 'parent_evaluation',
        `Parent: ${task.description}, Child: ${childTask.description}`,
        JSON.stringify(result.data || result)
      );
    }

    // Handle the response
    if (!result.success) {
      console.log(`⚠️ Invalid parent evaluation response: ${result.errors?.join(', ') || 'Unknown error'}`);
      // Default to continuing if validation fails
      return { decision: 'CONTINUE', reasoning: 'Invalid evaluation response' };
    }

    return result.data;
  }

  /**
   * Parse decomposition response (fallback)
   * @private
   */
  _parseDecompositionResponse(response) {
    try {
      const parsed = JSON.parse(response);
      return parsed;
    } catch (e) {
      // Try to extract subtasks from response
      const subtaskMatches = response.match(/\d+\.\s+(.+)/g);
      if (subtaskMatches) {
        return {
          subtasks: subtaskMatches.map(match => ({
            description: match.replace(/^\d+\.\s+/, '')
          }))
        };
      }
      return { subtasks: [] };
    }
  }

  /**
   * Parse execution response (fallback)
   * @private
   */
  _parseExecutionResponse(response) {
    try {
      const parsed = JSON.parse(response);
      return parsed;
    } catch (e) {
      // Try to extract tool calls from response
      return { response: response };
    }
  }

  /**
   * Parse parent evaluation response (fallback)
   * @private
   */
  _parseParentEvaluation(response) {
    try {
      const parsed = JSON.parse(response);
      return parsed;
    } catch (e) {
      // Default to continuing
      return {
        decision: 'CONTINUE',
        reasoning: 'Could not parse evaluation response'
      };
    }
  }

  /**
   * Parse completion evaluation response (fallback)
   * @private
   */
  _parseCompletionEvaluation(response) {
    try {
      const parsed = JSON.parse(response);
      return {
        isComplete: parsed.isComplete || parsed.complete || false,
        reasoning: parsed.reasoning || parsed.reason || 'No reason provided',
        summary: parsed.summary || parsed.result
      };
    } catch (e) {
      // Default to incomplete
      return {
        isComplete: false,
        reasoning: 'Could not parse evaluation response'
      };
    }
  }
}