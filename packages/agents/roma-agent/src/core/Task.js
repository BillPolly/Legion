/**
 * Task - Represents a task in the ROMA agent execution hierarchy
 * 
 * Each task maintains:
 * - Its own conversation history
 * - Parent-child relationships
 * - Artifact references
 * - Completion status managed by LLM
 */

import { v4 as uuidv4 } from 'uuid';
import PromptBuilder from '../utils/PromptBuilder.js';

export default class Task {
  constructor(description, parent = null, context = {}) {
    this.id = context.id || uuidv4();
    this.description = description;
    this.parent = parent;
    this.children = [];
    this.plannedSubtasks = []; // Subtasks from decomposition that haven't been created yet
    this.currentSubtaskIndex = -1; // Track which subtask we're executing
    this.conversation = [];
    this.artifacts = new Set(); // Set of artifact names relevant to this task
    this.status = 'pending'; // pending, in-progress, completed, failed
    this.result = null;
    this.metadata = {
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
      depth: parent ? parent.metadata.depth + 1 : 0,
      classification: null, // SIMPLE or COMPLEX
      isDecomposed: false, // Track if we've done decomposition
      ...context.metadata
    };
    
    // Store references to services this task needs
    this.llmClient = context.llmClient || null;
    this.taskClassifier = context.taskClassifier || null;
    this.toolDiscovery = context.toolDiscovery || null;
    this.artifactRegistry = context.artifactRegistry || null;
    this.sessionLogger = context.sessionLogger || null;
    this.simpleTaskValidator = context.simpleTaskValidator || null;
    this.decompositionValidator = context.decompositionValidator || null;
    this.fastToolDiscovery = context.fastToolDiscovery || false;
    this.agent = context.agent || null;  // Reference to agent for helper methods
    this.testMode = false;  // Will be set by agent when needed
    
    // Initialize prompt builder
    this.promptBuilder = new PromptBuilder();
    this.promptBuilderInitialized = false;
    
    // Initialize conversation with task description
    this.addConversationEntry('system', `Task: ${description}`);
    
    // Register this task as a child of parent
    if (parent) {
      parent.addChild(this);
    }
  }
  
  /**
   * Add a child task
   */
  addChild(childTask) {
    this.children.push(childTask);
    childTask.parent = this;
  }
  
  /**
   * Add an entry to the conversation history
   */
  addConversationEntry(role, content, metadata = {}) {
    const entry = {
      id: uuidv4(),
      timestamp: new Date(),
      role, // 'system', 'user', 'assistant', 'tool'
      content,
      metadata
    };
    
    this.conversation.push(entry);
    return entry;
  }
  
  /**
   * Add a prompt sent to LLM
   */
  addPrompt(prompt, promptType = 'general') {
    return this.addConversationEntry('user', prompt, { type: 'prompt', promptType });
  }
  
  /**
   * Add LLM response
   */
  addResponse(response, responseType = 'general') {
    return this.addConversationEntry('assistant', response, { type: 'response', responseType });
  }
  
  /**
   * Add tool execution result
   */
  addToolResult(toolName, inputs, result) {
    return this.addConversationEntry('tool', JSON.stringify(result), {
      type: 'tool_result',
      toolName,
      inputs,
      success: result.success
    });
  }
  
  /**
   * Mark task as started
   */
  start() {
    this.status = 'in-progress';
    this.metadata.startedAt = new Date();
    this.addConversationEntry('system', 'Task execution started');
  }
  
  /**
   * Mark task as completed (should be called after LLM determines completion)
   */
  complete(result) {
    this.status = 'completed';
    this.result = result;
    this.metadata.completedAt = new Date();
    this.addConversationEntry('system', `Task completed with result: ${JSON.stringify(result)}`);
    
    // Notify parent if exists
    if (this.parent) {
      this.parent.onChildCompleted(this);
    }
  }
  
  /**
   * Mark task as failed
   */
  fail(error) {
    this.status = 'failed';
    this.result = { error: error.message || error };
    this.metadata.completedAt = new Date();
    this.addConversationEntry('system', `Task failed: ${error.message || error}`);
    
    // Notify parent if exists
    if (this.parent) {
      this.parent.onChildFailed(this);
    }
  }
  
  /**
   * Called when a child task completes
   */
  onChildCompleted(childTask) {
    this.addConversationEntry('system', 
      `Subtask completed: ${childTask.description}\nResult: ${JSON.stringify(childTask.result)}`
    );
    
    // Check if all children are complete
    if (this.areAllChildrenComplete()) {
      this.addConversationEntry('system', 'All subtasks completed');
    }
  }
  
  /**
   * Called when a child task fails
   */
  onChildFailed(childTask) {
    this.addConversationEntry('system', 
      `Subtask failed: ${childTask.description}\nError: ${JSON.stringify(childTask.result)}`
    );
  }
  
  /**
   * Check if all children are complete
   */
  areAllChildrenComplete() {
    return this.children.every(child => 
      child.status === 'completed' || child.status === 'failed'
    );
  }
  
  /**
   * Add artifact reference to this task
   */
  addArtifact(artifactName) {
    this.artifacts.add(artifactName);
    this.addConversationEntry('system', `Artifact added: @${artifactName}`);
  }
  
  /**
   * Remove artifact reference from this task
   */
  removeArtifact(artifactName) {
    this.artifacts.delete(artifactName);
  }
  
  /**
   * Get artifacts as array
   */
  getArtifacts() {
    return Array.from(this.artifacts);
  }
  
  /**
   * Inherit artifacts from parent (LLM will decide which ones)
   */
  inheritArtifacts(artifactNames) {
    for (const name of artifactNames) {
      this.addArtifact(name);
    }
    
    if (artifactNames.length > 0) {
      this.addConversationEntry('system', 
        `Inherited artifacts from parent: ${artifactNames.map(n => '@' + n).join(', ')}`
      );
    }
  }
  
  /**
   * Get conversation context for LLM
   * Can be filtered by entry count or time window
   */
  getConversationContext(options = {}) {
    const { lastN = null, sinceTimestamp = null } = options;
    
    let entries = [...this.conversation];
    
    if (sinceTimestamp) {
      entries = entries.filter(e => e.timestamp >= sinceTimestamp);
    }
    
    if (lastN && entries.length > lastN) {
      entries = entries.slice(-lastN);
    }
    
    return entries;
  }
  
  /**
   * Format conversation for prompt building
   */
  formatConversation(options = {}) {
    const entries = this.getConversationContext(options);
    
    return entries.map(entry => {
      const role = entry.role.toUpperCase();
      const timestamp = entry.timestamp.toISOString();
      
      if (entry.metadata.type === 'tool_result') {
        return `[${timestamp}] TOOL ${entry.metadata.toolName}: ${entry.content}`;
      } else {
        return `[${timestamp}] ${role}: ${entry.content}`;
      }
    }).join('\n');
  }
  
  /**
   * Get task hierarchy path (for debugging/logging)
   */
  getPath() {
    const path = [];
    let current = this;
    
    while (current) {
      path.unshift(current.description.substring(0, 50));
      current = current.parent;
    }
    
    return path.join(' > ');
  }
  
  /**
   * Convert to JSON for serialization
   */
  toJSON() {
    return {
      id: this.id,
      description: this.description,
      status: this.status,
      result: this.result,
      metadata: this.metadata,
      artifacts: Array.from(this.artifacts),
      conversation: this.conversation,
      children: this.children.map(c => c.toJSON())
    };
  }
  
  /**
   * Create summary for parent task
   */
  createSummary() {
    return {
      id: this.id,
      description: this.description,
      status: this.status,
      result: this.result,
      artifacts: this.getArtifacts(),
      childrenCount: this.children.length,
      conversationLength: this.conversation.length,
      duration: this.metadata.completedAt ? 
        (this.metadata.completedAt - this.metadata.startedAt) / 1000 : null
    };
  }
  
  /**
   * Set the task's decomposition plan
   */
  setDecomposition(subtaskDescriptions) {
    this.plannedSubtasks = subtaskDescriptions;
    this.metadata.isDecomposed = true;
    this.addConversationEntry('system', `Decomposed into ${subtaskDescriptions.length} subtasks`);
  }
  
  /**
   * Create and return the next subtask to execute
   */
  createNextSubtask(taskManager) {
    this.currentSubtaskIndex++;
    
    if (this.currentSubtaskIndex >= this.plannedSubtasks.length) {
      // No more planned subtasks
      return null;
    }
    
    const subtaskDef = this.plannedSubtasks[this.currentSubtaskIndex];
    
    // Create the actual Task object for this subtask
    const subtask = new Task(subtaskDef.description, this, {
      metadata: { 
        outputs: subtaskDef.outputs,
        plannedIndex: this.currentSubtaskIndex
      },
      // Pass services to subtask
      llmClient: this.llmClient,
      taskClassifier: this.taskClassifier,
      toolDiscovery: this.toolDiscovery,
      artifactRegistry: this.artifactRegistry,
      sessionLogger: this.sessionLogger,
      simpleTaskValidator: this.simpleTaskValidator,
      decompositionValidator: this.decompositionValidator,
      fastToolDiscovery: this.fastToolDiscovery,
      agent: this.agent
    });
    
    // Decide which artifacts to give to this subtask
    const relevantArtifacts = this._selectArtifactsForSubtask(subtaskDef);
    if (relevantArtifacts.length > 0) {
      subtask.inheritArtifacts(relevantArtifacts);
    }
    
    // Register with task manager if provided
    if (taskManager) {
      taskManager.taskMap.set(subtask.id, subtask);
    }
    
    this.addConversationEntry('system', 
      `Created subtask ${this.currentSubtaskIndex + 1}/${this.plannedSubtasks.length}: ${subtaskDef.description}`
    );
    
    return subtask;
  }
  
  /**
   * Decide which artifacts are relevant for a subtask
   */
  _selectArtifactsForSubtask(subtaskDef) {
    // If no LLM available or no artifacts, return empty
    if (!this.llmClient || this.artifacts.size === 0) {
      return [];
    }
    
    // For now, use a simple heuristic - pass artifacts mentioned in description
    // In future, this could use LLM to decide
    const relevantArtifacts = [];
    const description = subtaskDef.description.toLowerCase();
    
    for (const artifact of this.artifacts) {
      if (description.includes(artifact.toLowerCase()) || 
          description.includes('@' + artifact.toLowerCase())) {
        relevantArtifacts.push(artifact);
      }
    }
    
    // If subtask explicitly requests artifacts
    if (subtaskDef.requiredArtifacts) {
      for (const required of subtaskDef.requiredArtifacts) {
        if (this.artifacts.has(required) && !relevantArtifacts.includes(required)) {
          relevantArtifacts.push(required);
        }
      }
    }
    
    return relevantArtifacts;
  }
  
  /**
   * Handle completion of a child task and decide next action
   */
  async onChildCompleted(childTask) {
    // Add to conversation
    this.addConversationEntry('system', 
      `Subtask completed: ${childTask.description}\nResult: ${JSON.stringify(childTask.result)}`
    );
    
    // Note: Artifact inheritance is now handled by TaskManager to allow LLM-based selection
    // The TaskManager will decide which artifacts to inherit based on context
    
    // Check if all children are complete
    if (this.areAllChildrenComplete()) {
      this.addConversationEntry('system', 'All subtasks completed');
    }
    
    // The parent will decide what to do next (handled by agent)
    return {
      allChildrenComplete: this.areAllChildrenComplete(),
      childResult: childTask.result,
      childArtifacts: childTask.getArtifacts()
    };
  }
  
  /**
   * Check if there are more planned subtasks
   */
  hasMoreSubtasks() {
    return this.currentSubtaskIndex < this.plannedSubtasks.length - 1;
  }
  
  /**
   * Get the planned subtask descriptions
   */
  getPlannedSubtasks() {
    return this.plannedSubtasks;
  }
  
  /**
   * Execute this task based on its classification
   * This is the main entry point for task execution
   */
  async execute() {
    // Start the task
    this.start();
    
    // Check depth limit to prevent infinite recursion
    const maxDepth = this.agent?.maxDepth || 5;
    if (this.metadata.depth >= maxDepth) {
      console.log(`⚠️ Maximum recursion depth (${maxDepth}) reached for task: ${this.description}`);
      this.fail(new Error(`Maximum recursion depth exceeded (${maxDepth})`));
      return {
        success: false,
        result: `Maximum recursion depth exceeded (${maxDepth})`
      };
    }
    
    // Resolve any artifact references in the task description
    const resolvedDescription = this.artifactRegistry 
      ? this.artifactRegistry.resolveReferences(this.description)
      : this.description;
    
    // Step 1: Classify the task (unless already classified)
    if (!this.metadata.classification) {
      const classification = await this.taskClassifier.classify(
        { description: resolvedDescription }, 
        this.sessionLogger
      );
      
      console.log(`📋 Task "${this.description}" classified as ${classification.complexity}: ${classification.reasoning}`);
      
      this.metadata.classification = classification.complexity;
      this.addConversationEntry('system', `Task classified as ${classification.complexity}: ${classification.reasoning}`);
    }
    
    // Step 2: Execute based on classification
    if (this.metadata.classification === 'SIMPLE') {
      // SIMPLE task: discover tools and execute
      return await this.executeSimple();
    } else {
      // COMPLEX task: decompose and execute subtasks
      return await this.executeComplex();
    }
  }
  
  /**
   * Execute a SIMPLE task - discover tools and execute them
   */
  async executeSimple() {
    // Discover tools for this SIMPLE task
    console.log(`🔧 Discovering tools for SIMPLE task...`);
    
    let discoveredTools;
    if (this.fastToolDiscovery && this.agent && this.agent._getFastMockTools) {
      // Fast mock tool discovery for integration tests
      discoveredTools = this.agent._getFastMockTools(this.description);
      console.log(`🔧 Using fast mock tools for testing (${discoveredTools.length} tools)`);
    } else {
      // Normal semantic tool discovery
      discoveredTools = await this.toolDiscovery.discoverTools(this.description);
    }
    
    this.addConversationEntry('system', `Discovered ${discoveredTools.length} tools`);
    
    if (discoveredTools.length === 0) {
      console.log(`⚠️ No tools found for SIMPLE task`);
      this.fail(new Error('No tools found for this task'));
      return {
        success: false,
        result: `Unable to find suitable tools for this task`,
        artifacts: this.artifactRegistry?.toJSON() || []
      };
    }
    
    // Save discovered tools for this task (used by tool execution)
    if (this.agent) {
      this.agent.currentTools = discoveredTools;
    }
    this.currentTools = discoveredTools;  // Also save locally
    
    // Get the execution plan (sequence of tool calls) from LLM
    const executionPlan = await this._getSimpleTaskExecution(discoveredTools);
    
    if (executionPlan.toolCalls && executionPlan.toolCalls.length > 0) {
      // Execute the tool calls
      const toolResult = await this._executeWithTools(executionPlan.toolCalls);
      
      // Add tool results to task conversation
      for (const result of toolResult.results) {
        if (result.tool) {
          this.addToolResult(result.tool, result.inputs || {}, result);
        }
      }
      
      // SIMPLE task completes immediately after tools execute
      this.complete(toolResult);
      
      // If this task has a parent, let parent evaluate what to do next
      if (this.parent) {
        return await this.parent.evaluateChild(this);
      }
      
      return toolResult;
    } else {
      // Direct LLM response (for analysis, explanation, etc.)
      const result = {
        success: true,
        result: executionPlan.response || 'Task completed',
        artifacts: this.artifactRegistry?.toJSON() || []
      };
      
      this.complete(result);
      
      // If this task has a parent, let parent evaluate what to do next
      if (this.parent) {
        return await this.parent.evaluateChild(this);
      }
      
      return result;
    }
  }
  
  /**
   * Execute a COMPLEX task - decompose into subtasks
   */
  async executeComplex() {
    // Step 1: Task decomposes itself (unless already done)
    if (!this.metadata.isDecomposed) {
      const decomposition = await this._getTaskDecomposition();
      
      if (!decomposition.subtasks || decomposition.subtasks.length === 0) {
        console.log(`⚠️ Could not decompose COMPLEX task`);
        this.fail(new Error('Unable to decompose complex task'));
        return {
          success: false,
          result: `Unable to decompose this complex task`,
          artifacts: this.artifactRegistry?.toJSON() || []
        };
      }
      
      // Task stores its own decomposition plan
      this.setDecomposition(decomposition.subtasks);
      console.log(`📋 Task decomposed into ${decomposition.subtasks.length} subtasks`);
    }
    
    // Step 2: Create and execute the first subtask
    // Note: We need taskManager from somewhere - this is a design issue
    // For now, we'll pass it through context or use a singleton pattern
    const subtask = this.createNextSubtask(this.metadata.taskManager);
    
    if (!subtask) {
      // No subtasks to execute - evaluate completion
      return await this.evaluateCompletion();
    }
    
    console.log(`📍 Executing subtask ${this.currentSubtaskIndex + 1}/${this.plannedSubtasks.length}: ${subtask.description}`);
    
    // Step 3: Execute the subtask recursively
    const subtaskResult = await subtask.execute();
    
    // Check if subtask failed due to depth limit
    if (!subtaskResult.success && subtaskResult.result && 
        typeof subtaskResult.result === 'string' && 
        subtaskResult.result.includes('Maximum recursion depth exceeded')) {
      // Propagate depth limit failure immediately
      this.fail(new Error(subtaskResult.result));
      return subtaskResult;
    }
    
    // Step 4: Task evaluates what to do after subtask completes
    return await this.evaluateChild(subtask);
  }
  
  /**
   * Parent task evaluates after child completes and decides what to do
   */
  async evaluateChild(childTask) {
    // Check if child task failed
    if (childTask.status === 'failed') {
      // Propagate child failure up to parent
      const failureReason = childTask.result || childTask.error || 'Subtask failed';
      
      // Check specifically for depth limit failure
      if (typeof failureReason === 'string' && failureReason.includes('Maximum recursion depth exceeded')) {
        this.fail(new Error(failureReason));
        return {
          success: false,
          result: failureReason
        };
      }
      
      // For other failures, let the parent decide how to handle
    }
    
    // Build evaluation prompt using parent's conversation history
    const prompt = await this._buildParentEvaluationPrompt(childTask);
    
    const response = await this.llmClient.complete(prompt);
    
    if (this.sessionLogger) {
      await this.sessionLogger.logInteraction(
        { description: `Parent evaluates: ${this.description}` },
        'parent-evaluation',
        prompt,
        response,
        { childTask: childTask.description }
      );
    }
    
    // Parse response to get parent's decision
    try {
      const decision = JSON.parse(response);
      
      // Add decision to parent's conversation
      this.addConversationEntry('assistant', 
        `Evaluated subtask "${childTask.description}". Decision: ${decision.action}`
      );
      
      // Filter and inherit relevant artifacts from child
      if (decision.relevantArtifacts && Array.isArray(decision.relevantArtifacts)) {
        const childArtifacts = childTask.getArtifacts();
        for (const artifactName of decision.relevantArtifacts) {
          if (childArtifacts.includes(artifactName)) {
            this.addArtifact(artifactName);
          }
        }
      }
      
      // Handle parent's decision
      switch (decision.action) {
        case 'continue':
          // Check if there are more planned subtasks
          if (this.hasMoreSubtasks()) {
            // Create and execute the next planned subtask
            const nextSubtask = this.createNextSubtask(this.metadata.taskManager);
            console.log(`📍 Executing next subtask ${this.currentSubtaskIndex + 1}/${this.plannedSubtasks.length}: ${nextSubtask.description}`);
            
            const subtaskResult = await nextSubtask.execute();
            
            // Evaluate again after next subtask
            return await this.evaluateChild(nextSubtask);
          } else {
            // No more planned subtasks - evaluate completion
            return await this.evaluateCompletion();
          }
          
        case 'complete':
          // Parent task is complete
          this.complete(decision.result || { success: true });
          
          // If parent has a parent, recurse up
          if (this.parent) {
            return await this.parent.evaluateChild(this);
          }
          
          return {
            success: true,
            result: decision.result || this.result,
            artifacts: this.artifactRegistry?.toJSON() || []
          };
          
        case 'fail':
          // Parent task failed
          this.fail(new Error(decision.reason || 'Task failed'));
          
          // If parent has a parent, recurse up
          if (this.parent) {
            return await this.parent.evaluateChild(this);
          }
          
          return {
            success: false,
            result: decision.reason || 'Task failed',
            artifacts: this.artifactRegistry?.toJSON() || []
          };
          
        case 'create-subtask':
          // Create a new subtask (not from planned list)
          if (decision.newSubtask) {
            // Add to planned subtasks and execute it
            this.plannedSubtasks.push(decision.newSubtask);
            
            // Create and execute it
            const newSubtask = this.createNextSubtask(this.metadata.taskManager);
            console.log(`📍 Executing new subtask: ${newSubtask.description}`);
            
            const subtaskResult = await newSubtask.execute();
            return await this.evaluateChild(newSubtask);
          }
          break;
      }
      
      // Default: continue with next planned subtask if any
      if (this.hasMoreSubtasks()) {
        const nextSubtask = this.createNextSubtask(this.metadata.taskManager);
        const subtaskResult = await nextSubtask.execute();
        return await this.evaluateChild(nextSubtask);
      } else {
        return await this.evaluateCompletion();
      }
      
    } catch (error) {
      console.error('Failed to parse parent evaluation:', error);
      // Default to continuing with next subtask if available
      if (this.hasMoreSubtasks()) {
        const nextSubtask = this.createNextSubtask(this.metadata.taskManager);
        const subtaskResult = await nextSubtask.execute();
        return await this.evaluateChild(nextSubtask);
      } else {
        // No more subtasks - evaluate completion
        return await this.evaluateCompletion();
      }
    }
  }
  
  /**
   * Parent evaluates if it's complete after all subtasks
   */
  async evaluateCompletion() {
    // Build completion evaluation prompt
    const prompt = await this._buildCompletionEvaluationPrompt();
    
    const response = await this.llmClient.complete(prompt);
    
    if (this.sessionLogger) {
      await this.sessionLogger.logInteraction(
        { description: `Completion evaluation: ${this.description}` },
        'completion-evaluation', 
        prompt,
        response,
        {}
      );
    }
    
    try {
      const evaluation = JSON.parse(response);
      
      if (evaluation.complete) {
        // Task is complete
        this.complete(evaluation.result || { success: true });
        
        // If this has a parent, let parent evaluate
        if (this.parent) {
          return await this.parent.evaluateChild(this);
        }
        
        return {
          success: true,
          result: evaluation.result || this.result,
          artifacts: this.artifactRegistry?.toJSON() || []
        };
      } else if (evaluation.needsMoreWork && evaluation.additionalSubtask) {
        // Need to do more work
        this.plannedSubtasks.push(evaluation.additionalSubtask);
        
        // Create and execute it
        const newSubtask = this.createNextSubtask(this.metadata.taskManager);
        console.log(`📍 Executing additional subtask: ${newSubtask.description}`);
        
        const subtaskResult = await newSubtask.execute();
        return await this.evaluateChild(newSubtask);
      } else {
        // Default to completing with current state
        this.complete({ success: true, message: 'Task completed' });
        
        if (this.parent) {
          return await this.parent.evaluateChild(this);
        }
        
        return {
          success: true,
          result: { success: true, message: 'Task completed' },
          artifacts: this.artifactRegistry?.toJSON() || []
        };
      }
    } catch (error) {
      console.error('Failed to parse completion evaluation:', error);
      this.fail(error);
      return {
        success: false,
        result: `Completion evaluation failed: ${error.message}`,
        artifacts: this.artifactRegistry?.toJSON() || []
      };
    }
  }
  
  /**
   * Get execution plan for a SIMPLE task (sequence of tool calls)
   */
  async _getSimpleTaskExecution(discoveredTools) {
    // Build prompt using task's conversation history
    const promptContext = {
      taskConversation: this.formatConversation(),
      discoveredTools: discoveredTools,
      artifacts: this.artifactRegistry ? this.artifactRegistry.list() : [],
      isSimpleTask: true
    };
    
    // Use task description and context to build prompt
    const taskInfo = {
      description: this.description,
      conversation: this.formatConversation()
    };
    
    // Ensure prompt builder is initialized
    await this._ensurePromptBuilder();
    
    const prompt = await this.promptBuilder.buildExecutionPrompt(taskInfo, promptContext);
    
    // Add format instructions from ResponseValidator
    const formatInstructions = this.simpleTaskValidator.generateInstructions(null, {
      format: 'json',
      verbosity: 'concise'
    });

    const basePrompt = prompt + '\n\n' + formatInstructions;
    
    // Use retry logic with error feedback
    const maxAttempts = 3;
    let currentPrompt = basePrompt;
    let lastErrors = null;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await this.llmClient.complete(currentPrompt);
        
        if (this.sessionLogger) {
          await this.sessionLogger.logInteraction(
            this,
            'simple-task-execution',
            currentPrompt,
            response,
            { toolCount: discoveredTools.length, attempt }
          );
        }

        // Use ResponseValidator to process the response
        const result = this.simpleTaskValidator.process(response);
        
        if (result.success) {
          // Success - return the parsed data
          return result.data;
        } else {
          // Validation failed - prepare for retry with error feedback
          lastErrors = result.errors;
          
          if (attempt < maxAttempts) {
            // Build error feedback for next attempt
            const errorList = result.errors.map((error, index) => {
              let errorText = `${index + 1}. ${error.message}`;
              if (error.suggestion) {
                errorText += `\n   Suggestion: ${error.suggestion}`;
              }
              return errorText;
            }).join('\n\n');

            currentPrompt = `PREVIOUS RESPONSE HAD VALIDATION ERRORS:

${errorList}

ORIGINAL REQUEST:
${basePrompt}

PLEASE PROVIDE CORRECTED RESPONSE:`;
            
            console.log(`⚠️ Attempt ${attempt} failed validation, retrying...`);
          }
        }
        
      } catch (error) {
        console.error(`Attempt ${attempt} failed with error:`, error.message);
        if (attempt >= maxAttempts) {
          throw error;
        }
      }
    }
    
    // All attempts failed - return the last validation errors
    console.error('Failed to get valid response after', maxAttempts, 'attempts. Last errors:', lastErrors);
    
    // Provide meaningful fallback based on the task type
    if (this.description.toLowerCase().includes('what') || 
        this.description.toLowerCase().includes('explain') ||
        this.description.toLowerCase().includes('?')) {
      // Question-type task - provide direct response
      return { 
        response: `I apologize, but I had difficulty formatting my response correctly after ${maxAttempts} attempts. The validation errors were: ${lastErrors?.map(e => e.message).join(', ')}.` 
      };
    } else {
      // Task-type - suggest tool execution failed
      return { 
        response: `Unable to execute task due to response formatting issues after ${maxAttempts} attempts. Errors: ${lastErrors?.map(e => e.message).join(', ')}.` 
      };
    }
  }

  /**
   * Get decomposition for a COMPLEX task
   */
  async _getTaskDecomposition() {
    const promptContext = {
      taskConversation: this.formatConversation(),
      artifacts: this.artifactRegistry ? this.artifactRegistry.list() : [],
      isComplexTask: true,
      classification: this.metadata.classification
    };
    
    const taskInfo = {
      description: this.description,
      conversation: this.formatConversation()
    };
    
    // Ensure prompt builder is initialized
    await this._ensurePromptBuilder();
    
    const prompt = this.promptBuilder.buildDecompositionPrompt(taskInfo, promptContext);
    
    // Add format instructions from ResponseValidator
    const formatInstructions = this.decompositionValidator.generateInstructions(null, {
      format: 'json',
      verbosity: 'concise'
    });

    const basePrompt = prompt + '\n\n' + formatInstructions;
    
    // Use retry logic with error feedback
    const maxAttempts = 3;
    let currentPrompt = basePrompt;
    let lastErrors = null;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await this.llmClient.complete(currentPrompt);
        
        if (this.sessionLogger) {
          await this.sessionLogger.logInteraction(
            this,
            'task-decomposition',
            currentPrompt,
            response,
            { classification: this.metadata.classification, attempt }
          );
        }

        // Use ResponseValidator to process the response
        const result = this.decompositionValidator.process(response);
        
        if (result.success) {
          return result.data;
        } else {
          // Validation failed - prepare for retry
          lastErrors = result.errors;
          
          if (attempt < maxAttempts) {
            // Build error feedback for next attempt
            const errorList = result.errors.map((error, index) => {
              let errorText = `${index + 1}. ${error.message}`;
              if (error.suggestion) {
                errorText += `\n   Suggestion: ${error.suggestion}`;
              }
              return errorText;
            }).join('\n\n');

            currentPrompt = `PREVIOUS RESPONSE HAD VALIDATION ERRORS:

${errorList}

ORIGINAL REQUEST:
${basePrompt}

PLEASE PROVIDE CORRECTED RESPONSE:`;
            
            console.log(`⚠️ Decomposition attempt ${attempt} failed validation, retrying...`);
          }
        }
        
      } catch (error) {
        console.error(`Decomposition attempt ${attempt} failed with error:`, error.message);
        if (attempt >= maxAttempts) {
          // Return empty decomposition if all attempts fail with errors
          return { decompose: false, subtasks: [] };
        }
      }
    }
    
    // All validation attempts failed
    console.error('Failed to get valid decomposition after', maxAttempts, 'attempts. Last errors:', lastErrors);
    return { decompose: false, subtasks: [] };
  }

  /**
   * Execute task with tools
   */
  async _executeWithTools(toolCalls) {
    const results = [];

    for (const call of toolCalls) {
      try {
        // Extract tool name and inputs from the tool call format
        const toolName = call.tool;
        const toolInputs = call.inputs || {};
        
        // Try to find the tool in several places
        let tool = null;
        
        // First check our local current tools
        if (this.currentTools && this.currentTools.length > 0) {
          tool = this.currentTools.find(t => t.name === toolName);
        }
        
        // If not found, try the agent's current tools
        if (!tool && this.agent && this.agent.currentTools) {
          tool = this.agent.currentTools.find(t => t.name === toolName);
        }
        
        // If not found, try the tool discovery cache if available
        if (!tool && this.toolDiscovery && this.toolDiscovery.getCachedTool) {
          tool = this.toolDiscovery.getCachedTool(toolName);
        }
        
        // If still not found, check if it's a similar name (case-insensitive)
        if (!tool && this.currentTools && this.currentTools.length > 0) {
          tool = this.currentTools.find(t => 
            t.name.toLowerCase() === toolName.toLowerCase()
          );
          
          if (tool) {
            console.log(`Using tool: ${tool.name} (matched from ${toolName})`);
          }
        }
        
        // Also try case-insensitive on agent's tools
        if (!tool && this.agent && this.agent.currentTools) {
          tool = this.agent.currentTools.find(t => 
            t.name.toLowerCase() === toolName.toLowerCase()
          );
        }
        
        if (!tool) {
          const availableTools = (this.currentTools || this.agent?.currentTools || []).map(t => t.name).join(', ');
          throw new Error(`Tool not found: ${toolName}. Available tools: ${availableTools}`);
        }

        // Resolve any artifact references in inputs
        const resolvedInputs = this.artifactRegistry ? 
          this.artifactRegistry.resolveReferences(toolInputs) : 
          toolInputs;

        // Execute the tool 
        const result = await tool.execute(resolvedInputs);
        // Ensure result has consistent structure
        const normalizedResult = {
          success: result.success !== false, // Default to true unless explicitly false
          ...result
        };
        results.push(normalizedResult);

        // Save outputs as artifacts if requested
        if (call.outputs && typeof call.outputs === 'object' && this.artifactRegistry) {
          // Map specific tool output fields to artifact names
          for (const [outputField, artifactName] of Object.entries(call.outputs)) {
            // Strip @ if present (be flexible with what LLM provides)
            const cleanArtifactName = artifactName.startsWith('@') 
              ? artifactName.substring(1) 
              : artifactName;
            
            // Check both normalizedResult.data and normalizedResult directly for the field
            const value = (normalizedResult.data && normalizedResult.data[outputField] !== undefined) 
              ? normalizedResult.data[outputField] 
              : normalizedResult[outputField];
              
            if (value !== undefined) {
              // Get tool metadata for type inference
              const toolMetadata = {
                name: toolName,
                description: `${outputField} from ${toolName} tool`,
                outputSchema: tool.schema?.output || tool.outputSchema
              };
              
              this.artifactRegistry.storeToolResult(cleanArtifactName, value, toolMetadata);
              const artifact = this.artifactRegistry.get(cleanArtifactName);
              console.log(`Saved ${outputField} as @${cleanArtifactName} (${artifact.type})`);
            }
          }
        }

      } catch (error) {
        results.push({ 
          success: false, 
          error: error.message,
          tool: call.tool || 'unknown'
        });
      }
    }

    return {
      success: results.every(r => r.success !== false),
      results,
      artifacts: this.artifactRegistry ? this.artifactRegistry.toJSON() : []
    };
  }
  
  /**
   * Ensure prompt builder is initialized
   */
  async _ensurePromptBuilder() {
    if (!this.promptBuilderInitialized) {
      await this.promptBuilder.initialize();
      this.promptBuilderInitialized = true;
    }
  }

  /**
   * Build prompt for parent to evaluate child completion
   */
  async _buildParentEvaluationPrompt(childTask) {
    await this._ensurePromptBuilder();
    
    const parentConversation = this.formatConversation({ lastN: 10 });
    const availableArtifacts = this.artifactRegistry ? 
      this.artifactRegistry.list().map(a => `@${a.name}: ${a.description} (${a.type})`).join('\n') :
      'None';
    
    return this.promptBuilder.buildPrompt('parent-evaluation', {
      parentDescription: this.description,
      childDescription: childTask.description,
      childStatus: childTask.status,
      childResult: JSON.stringify(childTask.result),
      childArtifacts: childTask.getArtifacts().join(', ') || 'None',
      parentConversation,
      availableArtifacts
    });
  }
  
  /**
   * Build prompt for parent to evaluate if it should complete
   */
  async _buildCompletionEvaluationPrompt() {
    await this._ensurePromptBuilder();
    
    const conversation = this.formatConversation({ lastN: 15 });
    const children = this.children.map(c => 
      `- ${c.description} (${c.status})${c.result ? ': ' + c.result : ''}`
    ).join('\n');
    
    const availableArtifacts = this.artifactRegistry ? 
      this.artifactRegistry.list().map(a => `@${a.name}: ${a.description} (${a.type})`).join('\n') :
      'None';
    
    return this.promptBuilder.buildPrompt('completion-evaluation', {
      taskDescription: this.description,
      subtasksCompleted: children || 'None',
      conversationHistory: conversation,
      availableArtifacts
    });
  }
}