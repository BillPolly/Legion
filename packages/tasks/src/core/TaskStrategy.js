/**
 * TaskStrategy - Base prototype for all tasks in the pure prototypal system
 * 
 * This object contains all the methods that were previously in the Task class.
 * Tasks are created using Object.create(SomeStrategy) where SomeStrategy inherits from this.
 * 
 * Each strategy only needs to implement onMessage() to define its behavior.
 * The rest of the functionality (state management, artifacts, etc.) is inherited.
 */

import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const TaskStrategy = {
  /**
   * Initialize a task instance with state
   * Called by createTask factory after Object.create()
   */
  initializeTask(description, parent = null, context = {}) {
    // Initialize state properties
    this.id = context.id || uuidv4();
    this.description = description;
    this.parent = parent;
    this.children = [];
    this.plannedSubtasks = [];
    this.currentSubtaskIndex = -1;
    this.conversation = [];
    this.artifacts = new Set();
    this.status = 'pending';
    this.result = null;
    this.metadata = {
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
      depth: parent ? parent.metadata.depth + 1 : 0,
      classification: null,
      isDecomposed: false,
      ...context.metadata
    };
    
    // Set context
    this.context = context;
    
    // Goal inputs/outputs
    this.goalInputs = context.goalInputs || [];
    this.goalOutputs = context.goalOutputs || [];
    
    // Current tools (for simple task execution)
    this.currentTools = null;
    
    // Initialize conversation with task description
    this.addConversationEntry('system', `Task: ${description}`);
    
    // Register as child of parent
    if (parent) {
      parent.addChild(this);
    }
    
    return this;
  },

  /**
   * Core message passing - fire-and-forget pattern
   */
  send(targetTask, message) {
    setImmediate(() => {
      targetTask.onMessage(this, message);
    });
  },

  /**
   * Message handler - strategies must implement this
   */
  onMessage(senderTask, message) {
    throw new Error('Strategy must implement onMessage');
  },

  /**
   * Add a child task
   */
  addChild(childTask) {
    this.children.push(childTask);
    childTask.parent = this;
  },

  /**
   * Add conversation entry
   */
  addConversationEntry(role, content, metadata = {}) {
    const entry = {
      id: uuidv4(),
      timestamp: new Date(),
      role,
      content,
      metadata
    };
    this.conversation.push(entry);
    return entry;
  },

  /**
   * Add a prompt sent to LLM
   */
  addPrompt(prompt, promptType = 'general') {
    return this.addConversationEntry('user', prompt, { type: 'prompt', promptType });
  },

  /**
   * Add LLM response
   */
  addResponse(response, responseType = 'general') {
    return this.addConversationEntry('assistant', response, { type: 'response', responseType });
  },

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
  },

  /**
   * Store artifact
   */
  storeArtifact(name, value, description = null, type = null) {
    const artifacts = this.context.artifacts || {};
    artifacts[name] = {
      name,
      value,
      description: description || `${name} artifact`,
      type: type || 'unknown',
      createdAt: new Date()
    };
    this.context.artifacts = artifacts;
    this.artifacts.add(name);
    this.addConversationEntry('system', `Artifact added: @${name}`);
  },

  /**
   * Get artifact
   */
  getArtifact(name) {
    const artifacts = this.context.artifacts || {};
    return artifacts[name] || null;
  },

  /**
   * Get all artifacts
   */
  getAllArtifacts() {
    return this.context.artifacts || {};
  },

  /**
   * Get artifacts as array
   */
  getArtifacts() {
    return Array.from(this.artifacts);
  },

  /**
   * Add artifact reference
   */
  addArtifact(artifactName) {
    this.artifacts.add(artifactName);
    this.addConversationEntry('system', `Artifact added: @${artifactName}`);
  },

  /**
   * Start task execution
   */
  start() {
    this.status = 'in-progress';
    this.metadata.startedAt = new Date();
    this.addConversationEntry('system', 'Task execution started');
  },

  /**
   * Complete task
   */
  complete(result) {
    this.status = 'completed';
    this.result = result;
    this.metadata.completedAt = new Date();
    this.addConversationEntry('system', `Task completed with result: ${JSON.stringify(result)}`);
    
    if (this.parent) {
      this.parent.onChildCompleted(this);
    }
  },

  /**
   * Fail task
   */
  fail(error) {
    this.status = 'failed';
    this.result = { error: error.message || error };
    this.metadata.completedAt = new Date();
    this.addConversationEntry('system', `Task failed: ${error.message || error}`);
    
    if (this.parent) {
      this.parent.onChildFailed(this);
    }
  },

  /**
   * Called when child completes
   */
  onChildCompleted(childTask) {
    this.addConversationEntry('system', 
      `Subtask completed: ${childTask.description}\nResult: ${JSON.stringify(childTask.result)}`
    );
    
    if (this.areAllChildrenComplete()) {
      this.addConversationEntry('system', 'All subtasks completed');
    }
  },

  /**
   * Called when child fails
   */
  onChildFailed(childTask) {
    this.addConversationEntry('system', 
      `Subtask failed: ${childTask.description}\nError: ${JSON.stringify(childTask.result)}`
    );
  },

  /**
   * Check if all children are complete
   */
  areAllChildrenComplete() {
    return this.children.every(child => 
      child.status === 'completed' || child.status === 'failed'
    );
  },

  /**
   * Set goal inputs
   */
  setGoalInputs(inputs) {
    this.goalInputs = inputs || [];
    if (inputs && inputs.length > 0) {
      this.addConversationEntry('system', 
        `Task expects inputs: ${inputs.map(i => `@${i.name}${i.type ? ` (${i.type})` : ''}`).join(', ')}`
      );
    }
  },

  /**
   * Set goal outputs
   */
  setGoalOutputs(outputs) {
    this.goalOutputs = outputs || [];
    if (outputs && outputs.length > 0) {
      this.addConversationEntry('system',
        `Task will produce outputs: ${outputs.map(o => `@${o.name}${o.type ? ` (${o.type})` : ''}`).join(', ')}`
      );
    }
  },

  /**
   * Receive artifacts from parent
   */
  receiveArtifacts(parentTask, artifactNames = null) {
    if (!parentTask) return;
    
    const toReceive = artifactNames || this.goalInputs.map(g => g.name);
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
  },

  /**
   * Deliver goal outputs to parent
   */
  deliverGoalOutputs(parentTask) {
    if (!parentTask) return [];
    
    const delivered = [];
    const myArtifacts = this.getAllArtifacts();
    
    for (const goal of this.goalOutputs) {
      const artifact = myArtifacts[goal.name];
      if (artifact) {
        parentTask.storeArtifact(goal.name, artifact.value, 
          artifact.description || goal.description,
          artifact.type || goal.type);
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
  },

  /**
   * Set decomposition plan
   */
  setDecomposition(subtaskDescriptions) {
    this.plannedSubtasks = subtaskDescriptions;
    this.metadata.isDecomposed = true;
    this.addConversationEntry('system', `Decomposed into ${subtaskDescriptions.length} subtasks`);
  },

  /**
   * Create next subtask - uses createTask factory
   */
  async createNextSubtask(taskManager) {
    this.currentSubtaskIndex++;
    
    if (this.currentSubtaskIndex >= this.plannedSubtasks.length) {
      return null;
    }
    
    const subtaskDef = this.plannedSubtasks[this.currentSubtaskIndex];
    
    // Parse inputs/outputs
    const goalInputs = subtaskDef.inputs ? this._parseArtifactSpecs(subtaskDef.inputs) : [];
    const goalOutputs = subtaskDef.outputs ? this._parseArtifactSpecs(subtaskDef.outputs) : [];
    
    // Create child context
    const childContext = {
      ...this.context,
      goalInputs,
      goalOutputs,
      metadata: { 
        outputs: subtaskDef.outputs,
        plannedIndex: this.currentSubtaskIndex
      }
    };
    
    // Use createTask factory - import at top of file for ES6 modules
    // For now, use dynamic import since we're in an object literal
    const { createTask } = await import('./createTask.js');
    const subtask = createTask(subtaskDef.description, this, Object.getPrototypeOf(this), childContext);
    
    // Transfer artifacts
    if (goalInputs.length > 0) {
      subtask.receiveArtifacts(this, goalInputs.map(g => g.name));
    }
    
    // Register with task manager
    if (taskManager) {
      taskManager.taskMap.set(subtask.id, subtask);
    }
    
    this.addConversationEntry('system', 
      `Created subtask ${this.currentSubtaskIndex + 1}/${this.plannedSubtasks.length}: ${subtaskDef.description}`
    );
    
    return subtask;
  },

  /**
   * Parse artifact specifications
   */
  _parseArtifactSpecs(specs) {
    if (!specs) return [];
    
    if (Array.isArray(specs)) {
      return specs.map(spec => {
        if (typeof spec === 'object') return spec;
        return this._parseSingleArtifactSpec(spec);
      });
    }
    
    if (typeof specs === 'string') {
      const parts = specs.split(',').map(s => s.trim()).filter(s => s);
      return parts.map(part => this._parseSingleArtifactSpec(part));
    }
    
    return [];
  },

  /**
   * Parse single artifact spec
   */
  _parseSingleArtifactSpec(spec) {
    let cleaned = spec.startsWith('@') ? spec.substring(1) : spec;
    
    if (cleaned.includes(':')) {
      const [name, type] = cleaned.split(':').map(s => s.trim());
      return { name, type, description: `${name} artifact` };
    }
    
    const parenMatch = cleaned.match(/^(.+?)\s*\((.+?)\)$/);
    if (parenMatch) {
      return { 
        name: parenMatch[1].trim(), 
        type: parenMatch[2].trim(),
        description: `${parenMatch[1].trim()} artifact`
      };
    }
    
    return { name: cleaned, type: null, description: `${cleaned} artifact` };
  },

  /**
   * Get conversation context
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
  },

  /**
   * Format conversation for prompts
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
  },

  /**
   * Get task path for debugging
   */
  getPath() {
    const pathArray = [];
    let current = this;
    
    while (current) {
      pathArray.unshift(current.description.substring(0, 50));
      current = current.parent;
    }
    
    return pathArray.join(' > ');
  },

  /**
   * Check if has more subtasks
   */
  hasMoreSubtasks() {
    return this.currentSubtaskIndex < this.plannedSubtasks.length - 1;
  },

  /**
   * Get planned subtasks
   */
  getPlannedSubtasks() {
    return this.plannedSubtasks;
  },

  /**
   * Get completed subtasks
   */
  getCompletedSubtasks() {
    return this.children.filter(child => child.status === 'completed');
  },

  /**
   * Get remaining subtasks
   */
  getRemainingSubtasks() {
    if (!this.plannedSubtasks) return [];
    return this.plannedSubtasks.slice(this.currentSubtaskIndex + 1);
  },

  /**
   * Get result
   */
  getResult() {
    return this.result;
  },

  /**
   * Convert to JSON
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
  },

  /**
   * Create summary
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
  },

  /**
   * Get artifacts context string
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
  },

  /**
   * Inherit artifacts
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
  },

  /**
   * Check if has required inputs
   */
  hasRequiredInputs() {
    if (this.goalInputs.length === 0) {
      return true;
    }
    
    const artifacts = this.getAllArtifacts();
    for (const input of this.goalInputs) {
      if (!artifacts[input.name]) {
        return false;
      }
    }
    return true;
  },

  /**
   * Check if achieved goals
   */
  hasAchievedGoals() {
    if (this.goalOutputs.length === 0) {
      return true;
    }
    
    const artifacts = this.getAllArtifacts();
    for (const output of this.goalOutputs) {
      if (!artifacts[output.name]) {
        return false;
      }
    }
    return true;
  },

  /**
   * Resolve workspace paths
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
        if (!resolved[field].startsWith('/')) {
          resolved[field] = path.join(workspaceDir, resolved[field]);
        }
      }
    }

    return resolved;
  },

  /**
   * Lookup service from context
   */
  lookup(serviceName) {
    if (this.context && this.context.lookup) {
      return this.context.lookup(serviceName);
    }
    return this.context ? this.context[serviceName] : null;
  },

  /**
   * Get service from context
   */
  getService(serviceName) {
    return this.lookup(serviceName);
  },

  /**
   * Update context
   */
  updateContext(newContext) {
    this.context = { ...this.context, ...newContext };
  },

  /**
   * Remove artifact
   */
  removeArtifact(artifactName) {
    this.artifacts.delete(artifactName);
  }
};

export default TaskStrategy;