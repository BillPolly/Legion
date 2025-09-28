/**
 * Task - Framework-agnostic task representation for Legion agents
 * 
 * Each task maintains:
 * - Its own conversation history
 * - Parent-child relationships
 * - Artifact references
 * - Execution context (dependency injection)
 * 
 * This version uses ExecutionContext for dependency injection,
 * making it framework-agnostic and reusable across different agents.
 */

import { defer } from '../utils/async.js';
import { generateId } from '../utils/id.js';
import { joinPath } from '../utils/path.js';
import ExecutionContext from './ExecutionContext.js';

export default class Task {
  constructor(description, parent = null, context = {}) {
    this.id = context.id || generateId();
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
    
    // STRATEGY - This is what makes the task behavior pluggable
    this.strategy = context.strategy || null; // No default strategy in framework
    
    // Execution context provides dependency injection
    if (context instanceof ExecutionContext) {
      this.context = context;
    } else {
      // Create ExecutionContext from legacy context object for backward compatibility
      this.context = new ExecutionContext(context);
    }
    
    // Initialize ArtifactRegistry if provided (check both direct context and ExecutionContext services)
    let ArtifactRegistryClass = null;
    if (context instanceof ExecutionContext) {
      // Check ExecutionContext services (additionalServices or direct properties)
      ArtifactRegistryClass = context.getService('ArtifactRegistryClass') || context.additionalServices?.ArtifactRegistryClass;
    } else {
      // Check direct context property
      ArtifactRegistryClass = context.ArtifactRegistryClass;
    }
    
    if (ArtifactRegistryClass) {
      this.artifactRegistry = new ArtifactRegistryClass();
      // Store the class for child tasks
      this._artifactRegistryClass = ArtifactRegistryClass;
    }
    
    // Artifacts are stored directly in context
    // No separate ArtifactRegistry needed - context handles everything
    
    // Track goal inputs/outputs from decomposition
    this.goalInputs = [];   // What artifacts this task expects to receive
    this.goalOutputs = [];  // What artifacts this task promises to deliver
    
    // Set initial goals if provided in context
    // Check both direct context properties and ExecutionContext services
    const goalInputs = context.goalInputs || this.context.getService('goalInputs');
    const goalOutputs = context.goalOutputs || this.context.getService('goalOutputs');
    
    if (goalInputs) {
      this.setGoalInputs(goalInputs);
    }
    if (goalOutputs) {
      this.setGoalOutputs(goalOutputs);
    }
    
    // NO backward compatibility - fail fast if code tries to access old properties
    
    // Current tools (for simple task execution)
    this.currentTools = null;
    
    // Initialize conversation with task description
    this.addConversationEntry('system', `Task: ${description}`);
    
    // Register this task as a child of parent
    if (parent) {
      parent.addChild(this);
    }
  }

  /**
   * Lookup services via hierarchical context chain
   * @param {string} serviceName - Name of the service to lookup
   * @returns {any} The service or null if not found
   */
  lookup(serviceName) {
    return this.context.lookup ? this.context.lookup(serviceName) : null;
  }

  /**
   * Set the task strategy
   * @param {TaskStrategy} strategy - The strategy to use
   */
  setStrategy(strategy) {
    this.strategy = strategy;
  }

  /**
   * Get the current strategy
   * @returns {TaskStrategy} The current strategy
   */
  getStrategy() {
    return this.strategy;
  }
  
  /**
   * Get the execution context
   * @returns {ExecutionContext} The execution context
   */
  getContext() {
    return this.context;
  }
  
  /**
   * Update the execution context
   * @param {ExecutionContext|Object} newContext - New context or services to merge
   */
  updateContext(newContext) {
    if (newContext instanceof ExecutionContext) {
      this.context = newContext;
    } else {
      // Create new context with merged services
      const currentServices = this.context.getServiceSummary();
      const mergedServices = { ...currentServices, ...newContext };
      this.context = new ExecutionContext(mergedServices);
    }
  }
  
  /**
   * Store artifact in context
   */
  storeArtifact(name, value, description = null, type = null) {
    // Store artifacts directly in context - no separate registry needed
    const artifacts = this.context.getService('artifacts') || {};
    artifacts[name] = {
      name,
      value,
      description: description || `${name} artifact`,
      type: type || 'unknown',
      createdAt: new Date()
    };
    this.context.setService('artifacts', artifacts);
    this.addArtifact(name);
  }

  /**
   * Get artifact from context
   */
  getArtifact(name) {
    const artifacts = this.context.getService('artifacts') || {};
    return artifacts[name] || null;
  }

  /**
   * Get all artifacts from context
   */
  getAllArtifacts() {
    return this.context.getService('artifacts') || {};
  }
  
  /**
   * Set the artifacts this task expects to receive (goal inputs)
   * @param {Array} inputs - Array of {name: string, type?: string, description?: string}
   */
  setGoalInputs(inputs) {
    this.goalInputs = inputs || [];
    if (inputs && inputs.length > 0) {
      this.addConversationEntry('system', 
        `Task expects inputs: ${inputs.map(i => `@${i.name}${i.type ? ` (${i.type})` : ''}`).join(', ')}`
      );
    }
  }
  
  /**
   * Set the artifacts this task promises to deliver (goal outputs)
   * @param {Array} outputs - Array of {name: string, type?: string, description?: string}
   */
  setGoalOutputs(outputs) {
    this.goalOutputs = outputs || [];
    if (outputs && outputs.length > 0) {
      this.addConversationEntry('system',
        `Task will produce outputs: ${outputs.map(o => `@${o.name}${o.type ? ` (${o.type})` : ''}`).join(', ')}`
      );
    }
  }
  
  /**
   * Receive artifacts from parent task at task start
   * @param {Task|ArtifactRegistry} parentTask - Parent task or artifact registry to receive artifacts from
   * @param {Array} artifactNames - Specific artifact names to receive (optional)
   */
  async receiveArtifacts(parentTask, artifactNames = null) {
    if (!parentTask) return;
    
    // Determine which artifacts to receive
    const toReceive = artifactNames || this.goalInputs.map(g => g.name);
    
    // Handle both Task objects and ArtifactRegistry objects
    let sourceRegistry;
    if (parentTask.artifactRegistry) {
      sourceRegistry = parentTask.artifactRegistry;
    } else if (parentTask.getAllArtifacts) {
      // Legacy Task object - get artifacts via method
      const parentArtifacts = parentTask.getAllArtifacts();
      for (const name of toReceive) {
        const artifact = parentArtifacts[name];
        if (artifact) {
          this.storeArtifact(name, artifact.value, artifact.description, artifact.type);
          console.log(`📥 Task received artifact @${name} from parent`);
        }
      }
      if (toReceive.length > 0) {
        this.addConversationEntry('system',
          `Received artifacts from parent: ${toReceive.map(n => '@' + n).join(', ')}`
        );
      }
      return;
    } else {
      // Assume it's already an ArtifactRegistry
      sourceRegistry = parentTask;
    }
    
    // Use ArtifactRegistry interface
    for (const name of toReceive) {
      if (sourceRegistry.has(name)) {
        const artifact = sourceRegistry.get(name);
        if (this.artifactRegistry) {
          this.artifactRegistry.store(name, artifact.value, artifact.description, artifact.type);
        } else {
          this.storeArtifact(name, artifact.value, artifact.description, artifact.type);
        }
        console.log(`📥 Task received artifact @${name} from parent`);
      }
    }
    
    if (toReceive.length > 0) {
      this.addConversationEntry('system',
        `Received artifacts from parent: ${toReceive.map(n => '@' + n).join(', ')}`
      );
    }
  }
  
  /**
   * Transfer achieved goal outputs back to parent upon completion
   * @param {Task|ArtifactRegistry} parentTask - Parent task or artifact registry to transfer artifacts to
   * @returns {Array} Names of artifacts transferred
   */
  async deliverGoalOutputs(parentTask) {
    if (!parentTask) return [];
    
    const delivered = [];
    
    // Transfer each goal output that was achieved
    for (const goal of this.goalOutputs) {
      let artifact = null;
      
      // Get artifact from this task's registry or context
      if (this.artifactRegistry && this.artifactRegistry.has(goal.name)) {
        artifact = this.artifactRegistry.get(goal.name);
      } else {
        const myArtifacts = this.getAllArtifacts();
        artifact = myArtifacts[goal.name];
      }
      
      if (artifact) {
        // Transfer to parent's registry or context
        if (parentTask.artifactRegistry) {
          parentTask.artifactRegistry.store(goal.name, artifact.value, 
            artifact.description || goal.description,
            artifact.type || goal.type);
        } else if (parentTask.storeArtifact) {
          parentTask.storeArtifact(goal.name, artifact.value, 
            artifact.description || goal.description,
            artifact.type || goal.type);
        } else {
          // Assume parentTask is an ArtifactRegistry
          parentTask.store(goal.name, artifact.value, 
            artifact.description || goal.description,
            artifact.type || goal.type);
        }
        delivered.push(goal.name);
        console.log(`📤 Delivered artifact @${goal.name} to parent`);
      } else {
        console.log(`⚠️ Goal output @${goal.name} was not produced`);
      }
    }
    
    if (delivered.length > 0) {
      this.addConversationEntry('system',
        `Delivered outputs to parent: ${delivered.map(n => '@' + n).join(', ')}`
      );
    }
    
    return delivered;
  }
  
  /**
   * Check if task has received all required inputs
   * @returns {boolean} True if all goal inputs are available
   */
  hasRequiredInputs() {
    if (this.goalInputs.length === 0) {
      return true; // No inputs required
    }
    
    if (this.artifactRegistry) {
      for (const input of this.goalInputs) {
        if (!this.artifactRegistry.has(input.name)) {
          return false;
        }
      }
      return true;
    } else {
      const artifacts = this.getAllArtifacts();
      for (const input of this.goalInputs) {
        if (!artifacts[input.name]) {
          return false;
        }
      }
      return true;
    }
  }
  
  /**
   * Check if task has achieved its goal outputs
   * @returns {boolean} True if all goal outputs are available
   */
  hasAchievedGoals() {
    if (this.goalOutputs.length === 0) {
      return true; // No outputs required
    }
    
    if (this.artifactRegistry) {
      for (const output of this.goalOutputs) {
        if (!this.artifactRegistry.has(output.name)) {
          return false;
        }
      }
      return true;
    } else {
      const artifacts = this.getAllArtifacts();
      for (const output of this.goalOutputs) {
        if (!artifacts[output.name]) {
          return false;
        }
      }
      return true;
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
      id: generateId(),
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
   * Get artifacts context as formatted string
   * @returns {string} Formatted artifacts list
   */
  getArtifactsContext() {
    const artifacts = this.getAllArtifacts();
    const artifactList = Object.values(artifacts);
    
    if (artifactList.length === 0) {
      return 'No artifacts';
    }
    
    return artifactList
      .map(a => `- ${a.name} (${a.type || 'unknown'})`)
      .join('\n');
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
    
    return joinPath(' > ');
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
  async createNextSubtask(taskManager) {
    this.currentSubtaskIndex++;
    
    if (this.currentSubtaskIndex >= this.plannedSubtasks.length) {
      // No more planned subtasks
      return null;
    }
    
    const subtaskDef = this.plannedSubtasks[this.currentSubtaskIndex];
    
    // Parse inputs/outputs from subtask definition
    const goalInputs = subtaskDef.inputs ? this._parseArtifactSpecs(subtaskDef.inputs) : [];
    const goalOutputs = subtaskDef.outputs ? this._parseArtifactSpecs(subtaskDef.outputs) : [];
    
    // Create child context from parent context with ArtifactRegistryClass if available
    const childContextData = {
      goalInputs: goalInputs,
      goalOutputs: goalOutputs,
      metadata: { 
        outputs: subtaskDef.outputs,
        plannedIndex: this.currentSubtaskIndex
      }
    };
    
    // Pass ArtifactRegistryClass to child if parent has one
    if (this._artifactRegistryClass) {
      childContextData.ArtifactRegistryClass = this._artifactRegistryClass;
    }
    
    const childContext = this.context.createChildContext ? 
      this.context.createChildContext(childContextData) : 
      childContextData;
    
    // Create the actual Task object for this subtask
    const subtask = new Task(subtaskDef.description, this, childContext);
    
    // Inherit strategy from parent
    if (this.strategy) {
      subtask.setStrategy(this.strategy);
    }
    
    // Transfer specified artifacts from parent to child
    if (goalInputs.length > 0) {
      await subtask.receiveArtifacts(this, goalInputs.map(g => g.name));
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
   * Parse artifact specifications from decomposition output
   * Handles formats like "@artifact_name", "@artifact_name:type", or "artifact_name (type)"
   * @param {string|Array} specs - Artifact specifications from decomposition
   * @returns {Array} Parsed artifact specifications
   */
  _parseArtifactSpecs(specs) {
    if (!specs) return [];
    
    // Handle array format
    if (Array.isArray(specs)) {
      return specs.map(spec => {
        if (typeof spec === 'object') return spec;
        return this._parseSingleArtifactSpec(spec);
      });
    }
    
    // Handle comma-separated string format
    if (typeof specs === 'string') {
      const parts = specs.split(',').map(s => s.trim()).filter(s => s);
      return parts.map(part => this._parseSingleArtifactSpec(part));
    }
    
    return [];
  }
  
  /**
   * Parse a single artifact specification
   * @param {string} spec - Single artifact specification
   * @returns {Object} Parsed artifact {name, type, description}
   */
  _parseSingleArtifactSpec(spec) {
    // Remove @ prefix if present
    let cleaned = spec.startsWith('@') ? spec.substring(1) : spec;
    
    // Check for type annotation formats
    // Format 1: "name:type"
    if (cleaned.includes(':')) {
      const [name, type] = cleaned.split(':').map(s => s.trim());
      return { name, type, description: `${name} artifact` };
    }
    
    // Format 2: "name (type)"
    const parenMatch = cleaned.match(/^(.+?)\s*\((.+?)\)$/);
    if (parenMatch) {
      return { 
        name: parenMatch[1].trim(), 
        type: parenMatch[2].trim(),
        description: `${parenMatch[1].trim()} artifact`
      };
    }
    
    // Format 3: "name_type" - try to infer type from suffix
    const typeHints = ['json', 'code', 'text', 'config', 'schema', 'data', 'file', 'url', 'result'];
    for (const hint of typeHints) {
      if (cleaned.toLowerCase().endsWith('_' + hint)) {
        return {
          name: cleaned,
          type: hint,
          description: `${cleaned} artifact`
        };
      }
    }
    
    // Default: just name, no type
    return { name: cleaned, type: null, description: `${cleaned} artifact` };
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
   * Get completed subtasks
   * @returns {Array} Completed child tasks
   */
  getCompletedSubtasks() {
    return this.children.filter(child => child.status === 'completed');
  }
  
  /**
   * Get remaining planned subtasks
   * @returns {Array} Remaining subtask descriptions
   */
  getRemainingSubtasks() {
    if (!this.plannedSubtasks) return [];
    return this.plannedSubtasks.slice(this.currentSubtaskIndex + 1);
  }
  
  /**
   * Get the task result
   * @returns {Object} Task result
   */
  getResult() {
    return this.result;
  }
  
  /**
   * Send a message to this task
   * Messages drive all task behavior in the actor model
   */
  async receiveMessage(message, fromTask = null) {
    // Check depth limit for any work-type messages
    if (message.type === 'start' || message.type === 'work') {
      const maxDepth = this.context.getService('maxDepth') || this.agent?.maxDepth || 5;
      if (this.metadata.depth >= maxDepth) {
        console.log(`⚠️ Maximum recursion depth (${maxDepth}) reached for task: ${this.description}`);
        this.fail(new Error(`Maximum recursion depth exceeded (${maxDepth})`));
        return {
          success: false,
          result: `Maximum recursion depth exceeded (${maxDepth})`
        };
      }
    }
    
    // Ensure we have a strategy for work messages
    if ((message.type === 'start' || message.type === 'work') && !this.strategy) {
      const error = new Error('No strategy set for task work');
      this.fail(error);
      return {
        success: false,
        result: error.message
      };
    }
    
    // Route message based on sender
    try {
      if (fromTask === this.parent) {
        // Message from parent - pass THIS task as the task to work on
        if (typeof this.strategy.send === 'function') {
          // Use new fire-and-forget message pattern
          console.log('Task.receiveMessage using send() for fire-and-forget messaging');
          this.strategy.send(this, message);
          return { acknowledged: true, messagePattern: 'fire-and-forget' };
        } else {
          throw new Error('Strategy must implement send() method');
        }
      } else if (this.children.includes(fromTask)) {
        // Message from child - pass the child task
        if (typeof this.strategy.send === 'function') {
          // Use new fire-and-forget message pattern
          console.log('Task.receiveMessage using send() for child message');
          this.strategy.send(fromTask, message);
          return { acknowledged: true, messagePattern: 'fire-and-forget' };
        } else {
          throw new Error('Strategy must implement send() method');
        }
      } else if (!fromTask) {
        // Initial message or external message
        if (message.type === 'start' || message.type === 'work') {
          // Start the task if not already started
          if (this.status === 'pending') {
            this.start();
          }
        }
        // All external messages go to strategy as parent messages
        // Pass this task as the parentTask so strategy knows which task to work on
        if (!this.strategy) {
          throw new Error('Task has no strategy');
        }
        
        if (typeof this.strategy.send === 'function') {
          // Use new fire-and-forget message pattern
          console.log('Task.receiveMessage using send() for external message to task:', this.description, 'strategy:', this.strategy.getName ? this.strategy.getName() : 'unknown');
          this.strategy.send(this, message);
          return { acknowledged: true, messagePattern: 'fire-and-forget' };
        } else {
          throw new Error('Strategy must implement send() method');
        }
      } else {
        // Unknown sender
        return {
          success: false,
          result: 'Unknown message sender'
        };
      }
    } catch (error) {
      console.log(`❌ Message handling failed: ${error.message}`);
      this.fail(error);
      return {
        success: false,
        result: error.message || 'Message handling failed'
      };
    }
  }

  /**
   * Private synchronous message handler - delegates to strategy
   * @param {Task} sourceTask - The task that sent the message
   * @param {Object} message - The message received
   */
  _onMessage(sourceTask, message) {
    // Pass THIS task as first param (context), source task as second
    this.strategy.handleMessage(this, sourceTask, message);
  }

  /**
   * Send a message to another task (fire-and-forget, queued via setImmediate)
   * @param {Task} targetTask - The task to send the message to
   * @param {Object} message - The message to send
   */
  send(targetTask, message) {
    // Queue the message delivery on the next tick of the event loop
    defer(() => {
      targetTask._onMessage(this, message);
    });
  }

  /**
   * Send a message to another task (DEPRECATED - use send() instead)
   */
  async sendMessage(targetTask, message) {
    return await targetTask.receiveMessage(message, this);
  }

  /**
   * Resolve file paths relative to workspace directory
   * @param {Object} inputs - Tool inputs that may contain file paths
   * @returns {Object} - Inputs with resolved file paths
   */
  _resolveWorkspacePaths(inputs) {
    const workspaceDir = this.context.workspaceDir;
    if (!workspaceDir || !inputs) {
      return inputs;
    }

    const resolved = { ...inputs };
    const filePathFields = ['filepath', 'path', 'filename', 'outputFile', 'inputFile'];
    
    for (const field of filePathFields) {
      if (resolved[field] && typeof resolved[field] === 'string') {
        // Only resolve if it's a relative path (doesn't start with /)
        if (!resolved[field].startsWith('/')) {
          resolved[field] = joinPath(workspaceDir, resolved[field]);
        }
      }
    }

    return resolved;
  }
}