/**
 * RecursiveDecompositionStrategy - Current ROMA recursive decomposition behavior
 * 
 * Implements the existing recursive task decomposition pattern:
 * - SIMPLE tasks: Execute with tools directly
 * - COMPLEX tasks: Decompose and execute subtasks one by one
 * - Parent evaluates each child completion and decides next steps
 */

import TaskStrategy from './TaskStrategy.js';

let instance = null;

export default class RecursiveDecompositionStrategy extends TaskStrategy {
  constructor() {
    super();
    if (instance) {
      return instance;
    }
    instance = this;
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
   * Classify task using LLM
   */
  async classify(task, context) {
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
   * Decompose complex task into subtasks
   */
  async decompose(task, context) {
    const { llmClient, decompositionValidator, sessionLogger } = context;
    
    if (!llmClient) {
      throw new Error('LLM client is required for decomposition');
    }

    // Build decomposition prompt
    const prompt = task.promptBuilder.buildDecompositionPrompt(
      task.description,
      task.getConversationContext(),
      task.getArtifactsContext()
    );
    
    // Get decomposition from LLM
    const response = await llmClient.complete(prompt);
    
    if (sessionLogger) {
      await sessionLogger.logInteraction(task, 'decomposition', prompt, response);
    }

    // Validate and parse response
    if (decompositionValidator) {
      const validation = decompositionValidator.process(response);
      if (!validation.success) {
        const errorMessages = validation.errors ? validation.errors.map(e => e.message).join(', ') : 'Invalid response';
        throw new Error(`Invalid decomposition response: ${errorMessages}`);
      }
      return validation.data;
    }

    // Fallback parsing if no validator
    const parsed = this._parseDecompositionResponse(response);
    return parsed;
  }

  /**
   * Execute a simple task with tools
   */
  async executeSimple(task, context) {
    const { toolDiscovery, llmClient, simpleTaskValidator, sessionLogger } = context;
    
    // Discover tools
    console.log(`🔧 Discovering tools for SIMPLE task...`);
    
    let discoveredTools;
    if (context.fastToolDiscovery && context.agent && context.agent._getFastMockTools) {
      // Fast mock tool discovery for integration tests
      discoveredTools = context.agent._getFastMockTools(task.description);
      console.log(`🔧 Using fast mock tools for testing (${discoveredTools.length} tools)`);
    } else {
      // Normal semantic tool discovery
      discoveredTools = await toolDiscovery.discoverTools(task.description);
    }
    
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
   * Execute a complex task through decomposition
   */
  async executeComplex(task, context) {
    // Decompose if not already done
    if (!task.metadata.isDecomposed) {
      const decomposition = await this.decompose(task, context);
      
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
      return await this.evaluateCompletion(task, context);
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
    
    // Handle child completion or failure
    if (subtaskResult.success) {
      return await this.onChildComplete(task, subtask, subtaskResult, context);
    } else {
      return await this.onChildFailure(task, subtask, new Error(subtaskResult.result), context);
    }
  }

  /**
   * Handle child task completion
   */
  async onChildComplete(task, childTask, result, context) {
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
          return await this.evaluateCompletion(task, context);
        }
        
        console.log(`📍 Executing next subtask ${task.currentSubtaskIndex + 1}/${task.plannedSubtasks.length}: ${nextSubtask.description}`);
        const nextResult = await nextSubtask.execute();
        
        // Recursively handle the next subtask result
        if (nextResult.success) {
          return await this.onChildComplete(task, nextSubtask, nextResult, context);
        } else {
          return await this.onChildFailure(task, nextSubtask, new Error(nextResult.result), context);
        }
        
      case 'COMPLETE':
        // Task is complete
        return await this.evaluateCompletion(task, context);
        
      case 'RETRY':
        // Retry the same subtask
        console.log(`🔄 Retrying subtask: ${childTask.description}`);
        const retryResult = await childTask.execute();
        
        // Recursively handle retry result
        if (retryResult.success) {
          return await this.onChildComplete(task, childTask, retryResult, context);
        } else {
          return await this.onChildFailure(task, childTask, new Error(retryResult.result), context);
        }
        
      case 'REPLAN':
        // Clear current plan and re-decompose
        console.log(`🔄 Replanning task...`);
        task.metadata.isDecomposed = false;
        task.plannedSubtasks = [];
        task.currentSubtaskIndex = -1;
        
        // Execute complex task again with new decomposition
        return await this.executeComplex(task, context);
        
      default:
        console.log(`⚠️ Unknown evaluation decision: ${evaluation.decision}`);
        return await this.evaluateCompletion(task, context);
    }
  }

  /**
   * Handle child task failure  
   */
  async onChildFailure(task, childTask, error, context) {
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
   * Evaluate if task is complete
   */
  async evaluateCompletion(task, context) {
    const { llmClient, completionEvaluationValidator, sessionLogger } = context;
    
    console.log(`🎯 Evaluating if task "${task.description}" is complete...`);
    
    // Build completion evaluation prompt
    const prompt = task.promptBuilder.buildCompletionEvaluationPrompt(
      task.description,
      task.getConversationContext(),
      task.getArtifactsContext(),
      task.getCompletedSubtasks()
    );
    
    // Get LLM evaluation
    const response = await llmClient.complete(prompt);
    
    if (sessionLogger) {
      await sessionLogger.logInteraction(task, 'completion_evaluation', prompt, response);
    }

    // Validate and parse response
    let evaluation;
    if (completionEvaluationValidator) {
      const validation = completionEvaluationValidator.process(response);
      if (!validation.success) {
        const errorMessages = validation.errors ? validation.errors.map(e => e.message).join(', ') : 'Invalid response';
        console.log(`⚠️ Invalid completion evaluation response: ${errorMessages}`);
        // Default to incomplete if validation fails
        evaluation = { isComplete: false, reasoning: 'Invalid evaluation response' };
      } else {
        // Map 'complete' field to 'isComplete' field for compatibility
        const data = validation.data;
        evaluation = {
          isComplete: data.complete !== undefined ? data.complete : data.isComplete,
          reasoning: data.reason || data.reasoning || 'No reason provided',
          summary: data.result || data.summary
        };
      }
    } else {
      evaluation = this._parseCompletionEvaluation(response);
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
      
      // If task has a parent, let parent evaluate
      if (task.parent) {
        return await task.parent.strategy.onChildComplete(task.parent, task, result, context);
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
            return await this.onChildComplete(task, nextSubtask, nextResult, context);
          } else {
            return await this.onChildFailure(task, nextSubtask, new Error(nextResult.result), context);
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
    
    // Build execution prompt
    const prompt = task.promptBuilder.buildExecutionPrompt(
      task.description,
      discoveredTools,
      task.getConversationContext(),
      task.getArtifactsContext()
    );
    // Get execution plan from LLM
    const response = await llmClient.complete(prompt);
    
    if (sessionLogger) {
      await sessionLogger.logInteraction(task, 'simple_execution', prompt, response);
    }

    // Validate and parse response
    if (simpleTaskValidator) {
      const validation = simpleTaskValidator.process(response);
      if (!validation.success) {
        const errorMessages = validation.errors ? validation.errors.map(e => e.message).join(', ') : 'Invalid response';
        throw new Error(`Invalid execution response: ${errorMessages}`);
      }
      return validation.data;
    }

    // Fallback parsing
    return this._parseExecutionResponse(response);
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
      success: results.every(r => r.success),
      result: results.every(r => r.success) ? 
        'All tools executed successfully' : 
        'Some tools failed to execute',
      results,
      artifacts: task.artifactRegistry?.toJSON() || []
    };
  }

  /**
   * Get parent's evaluation of child completion
   * @private
   */
  async _getParentEvaluation(task, childTask, context) {
    const { llmClient, parentEvaluationValidator, sessionLogger } = context;
    
    // Build parent evaluation prompt
    const prompt = task.promptBuilder.buildParentEvaluationPrompt(
      task.description,
      childTask.description,
      childTask.getResult(),
      task.getConversationContext(),
      task.getArtifactsContext(),
      task.getCompletedSubtasks(),
      task.getRemainingSubtasks()
    );
    
    // Get evaluation from LLM
    const response = await llmClient.complete(prompt);
    
    if (sessionLogger) {
      await sessionLogger.logInteraction(task, 'parent_evaluation', prompt, response);
    }

    // Validate and parse response
    if (parentEvaluationValidator) {
      const validation = parentEvaluationValidator.process(response);
      if (!validation.success) {
        const errorMessages = validation.errors ? validation.errors.map(e => e.message).join(', ') : 'Invalid response';
        console.log(`⚠️ Invalid parent evaluation response: ${errorMessages}`);
        // Default to continue
        return { decision: 'CONTINUE', reasoning: 'Invalid evaluation response' };
      }
      // Map 'action' field to 'decision' field for compatibility
      const data = validation.data;
      return {
        decision: data.action ? data.action.toUpperCase() : 'CONTINUE',
        reasoning: data.reason || data.reasoning || 'No reason provided',
        result: data.result,
        relevantArtifacts: data.relevantArtifacts
      };
    }

    // Fallback parsing
    return this._parseParentEvaluation(response);
  }

  /**
   * Parse decomposition response (fallback)
   * @private
   */
  _parseDecompositionResponse(response) {
    try {
      const parsed = JSON.parse(response);
      return parsed;
    } catch {
      // Try to extract subtasks from text
      const subtasks = [];
      const lines = response.split('\n');
      for (const line of lines) {
        if (line.match(/^\d+[\.\)]/)) {
          subtasks.push(line.replace(/^\d+[\.\)]/, '').trim());
        }
      }
      return { subtasks };
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
    } catch {
      return { response };
    }
  }

  /**
   * Parse completion evaluation (fallback)
   * @private
   */
  _parseCompletionEvaluation(response) {
    const lower = response.toLowerCase();
    const isComplete = lower.includes('complete') && !lower.includes('not complete') && !lower.includes('incomplete');
    return {
      isComplete,
      reasoning: response
    };
  }

  /**
   * Parse parent evaluation (fallback)
   * @private
   */
  _parseParentEvaluation(response) {
    const lower = response.toLowerCase();
    let decision = 'CONTINUE';
    
    if (lower.includes('complete')) {
      decision = 'COMPLETE';
    } else if (lower.includes('retry')) {
      decision = 'RETRY';
    } else if (lower.includes('replan')) {
      decision = 'REPLAN';
    }
    
    return {
      decision,
      reasoning: response
    };
  }
}