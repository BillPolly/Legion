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
      sessionLogger: this.sessionLogger
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
}