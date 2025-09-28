/**
 * TaskManager - Manages task hierarchy and execution flow for Legion agents
 * 
 * Responsibilities:
 * - Maintain task hierarchy
 * - Track current active task
 * - Coordinate task transitions
 * - Manage artifact inheritance
 */

import Task from './Task.js';

export default class TaskManager {
  constructor(llmClient = null) {
    this.llmClient = llmClient;
    this.rootTask = null;
    this.currentTask = null;
    this.taskMap = new Map(); // id -> task mapping for quick lookup
    this.completedTasks = [];
  }
  
  /**
   * Create and start a root task
   */
  createRootTask(description, context = {}) {
    this.rootTask = new Task(description, null, context);
    this.currentTask = this.rootTask;
    this.taskMap.set(this.rootTask.id, this.rootTask);
    this.rootTask.start();
    return this.rootTask;
  }
  
  /**
   * Create a subtask of the current task
   */
  createSubtask(description, inheritedArtifacts = [], context = {}) {
    if (!this.currentTask) {
      throw new Error('No current task to create subtask for');
    }
    
    const subtask = new Task(description, this.currentTask, context);
    this.taskMap.set(subtask.id, subtask);
    
    // Inherit artifacts if specified
    if (inheritedArtifacts.length > 0) {
      subtask.inheritArtifacts(inheritedArtifacts);
    }
    
    return subtask;
  }
  
  /**
   * Switch to a different task (for execution)
   */
  switchToTask(task) {
    if (!this.taskMap.has(task.id)) {
      throw new Error(`Task ${task.id} not found in task manager`);
    }
    
    this.currentTask = task;
    
    if (task.status === 'pending') {
      task.start();
    }
  }
  
  /**
   * Get current task
   */
  getCurrentTask() {
    return this.currentTask;
  }
  
  /**
   * Get root task
   */
  getRootTask() {
    return this.rootTask;
  }
  
  /**
   * Get task by ID
   */
  getTask(taskId) {
    return this.taskMap.get(taskId);
  }
  
  /**
   * Check if current task should be marked as complete (via LLM)
   */
  async checkTaskCompletion(task = null) {
    const targetTask = task || this.currentTask;
    
    if (!targetTask) {
      throw new Error('No task to check completion for');
    }
    
    // If task has incomplete children, it cannot be complete
    if (targetTask.children.length > 0 && !targetTask.areAllChildrenComplete()) {
      return { complete: false, reason: 'Has incomplete subtasks' };
    }
    
    // If no LLM client, use simple heuristic
    if (!this.llmClient) {
      return { 
        complete: targetTask.children.length > 0 ? 
          targetTask.areAllChildrenComplete() : 
          targetTask.conversation.length > 2,
        reason: 'No LLM available for completion check'
      };
    }
    
    // Build prompt for LLM to check task completion
    const prompt = this._buildCompletionCheckPrompt(targetTask);
    
    try {
      const response = await this.llmClient.complete(prompt);
      const parsed = JSON.parse(response);
      
      // Add the check to conversation history
      targetTask.addPrompt(prompt, 'completion-check');
      targetTask.addResponse(response, 'completion-check');
      
      return {
        complete: parsed.complete === true,
        reason: parsed.reason || 'LLM decision',
        result: parsed.result || null
      };
    } catch (error) {
      console.error('Failed to check task completion:', error);
      return { complete: false, reason: `Error: ${error.message}` };
    }
  }
  
  /**
   * Mark current task as complete and return to parent
   */
  async completeCurrentTask(result = null) {
    if (!this.currentTask) {
      throw new Error('No current task to complete');
    }
    
    // Get the actual result if not provided
    const actualResult = result || await this._extractTaskResult(this.currentTask);
    
    // Complete the task
    this.currentTask.complete(actualResult);
    this.completedTasks.push(this.currentTask);
    
    // Return to parent task
    if (this.currentTask.parent) {
      const parent = this.currentTask.parent;
      
      // Determine which artifacts to pass back to parent (via LLM if available)
      const artifactsToReturn = await this._selectArtifactsForParent(
        this.currentTask, 
        parent
      );
      
      // Add returned artifacts to parent
      for (const artifact of artifactsToReturn) {
        parent.addArtifact(artifact);
      }
      
      // Switch back to parent
      this.currentTask = parent;
      
      return { 
        returnedToParent: true, 
        parentTask: parent,
        artifactsReturned: artifactsToReturn
      };
    } else {
      // Root task completed
      this.currentTask = null;
      return { 
        returnedToParent: false, 
        rootCompleted: true 
      };
    }
  }
  
  /**
   * Determine which artifacts to pass to a subtask (via LLM)
   */
  async selectArtifactsForSubtask(subtaskDescription, availableArtifacts) {
    if (!this.llmClient || availableArtifacts.length === 0) {
      return []; // No LLM or no artifacts, return empty
    }
    
    const prompt = this._buildArtifactSelectionPrompt(
      subtaskDescription, 
      availableArtifacts
    );
    
    try {
      const response = await this.llmClient.complete(prompt);
      const parsed = JSON.parse(response);
      
      // Validate that selected artifacts exist
      const selected = (parsed.selectedArtifacts || [])
        .filter(name => availableArtifacts.includes(name));
      
      return selected;
    } catch (error) {
      console.error('Failed to select artifacts for subtask:', error);
      return []; // On error, don't pass any artifacts
    }
  }
  
  /**
   * Build prompt to check task completion
   */
  _buildCompletionCheckPrompt(task) {
    const recentConversation = task.formatConversation({ lastN: 10 });
    const hasChildren = task.children.length > 0;
    const childrenStatus = hasChildren ? 
      task.children.map(c => `- ${c.description}: ${c.status}`).join('\n') : 
      'No subtasks';
    
    return `Analyze whether this task is complete:

Task: "${task.description}"

Recent Conversation:
${recentConversation}

Subtasks:
${childrenStatus}

Available Artifacts: ${task.getArtifacts().map(a => '@' + a).join(', ') || 'None'}

Determine if this task has been successfully completed based on:
1. The original task description
2. The conversation history showing what was done
3. The status of any subtasks
4. The artifacts created

Respond with JSON:
{
  "complete": true/false,
  "reason": "Brief explanation",
  "result": "Summary of what was accomplished (if complete)" or null
}`;
  }
  
  /**
   * Build prompt to select artifacts for subtask
   */
  _buildArtifactSelectionPrompt(subtaskDescription, availableArtifacts) {
    return `Select which artifacts are relevant for this subtask:

Subtask: "${subtaskDescription}"

Available Artifacts:
${availableArtifacts.map(a => `- @${a}`).join('\n')}

Select only the artifacts that are directly relevant and necessary for completing the subtask.

Respond with JSON:
{
  "selectedArtifacts": ["artifact1", "artifact2", ...],
  "reason": "Brief explanation of selection"
}`;
  }
  
  /**
   * Extract result from completed task
   */
  async _extractTaskResult(task) {
    // Try to extract meaningful result from task conversation
    const lastEntries = task.getConversationContext({ lastN: 5 });
    
    // Look for tool results or assistant responses
    for (let i = lastEntries.length - 1; i >= 0; i--) {
      const entry = lastEntries[i];
      if (entry.metadata.type === 'tool_result' && entry.metadata.success) {
        return JSON.parse(entry.content);
      }
      if (entry.role === 'assistant' && entry.metadata.type === 'response') {
        return { response: entry.content };
      }
    }
    
    // Default result
    return { 
      completed: true,
      artifacts: task.getArtifacts(),
      childrenCompleted: task.children.filter(c => c.status === 'completed').length
    };
  }
  
  /**
   * Select artifacts to return to parent
   */
  async _selectArtifactsForParent(childTask, parentTask) {
    const childArtifacts = childTask.getArtifacts();
    
    if (!this.llmClient || childArtifacts.length === 0) {
      return childArtifacts; // Return all if no LLM
    }
    
    const prompt = `Select which artifacts from a completed subtask should be passed to its parent task:

Parent Task: "${parentTask.description}"
Completed Subtask: "${childTask.description}"

Subtask Result: ${JSON.stringify(childTask.result)}

Available Artifacts from Subtask:
${childArtifacts.map(a => `- @${a}`).join('\n')}

Select artifacts that are relevant to the parent task's goals.

Respond with JSON:
{
  "selectedArtifacts": ["artifact1", "artifact2", ...],
  "reason": "Brief explanation"
}`;
    
    try {
      const response = await this.llmClient.complete(prompt);
      const parsed = JSON.parse(response);
      
      const selected = (parsed.selectedArtifacts || [])
        .filter(name => childArtifacts.includes(name));
      
      return selected;
    } catch (error) {
      console.error('Failed to select artifacts for parent:', error);
      return childArtifacts; // Return all on error
    }
  }
  
  /**
   * Get task hierarchy as tree structure (for debugging)
   */
  getTaskTree() {
    if (!this.rootTask) return null;
    
    const buildTree = (task) => {
      return {
        id: task.id,
        description: task.description,
        status: task.status,
        depth: task.metadata.depth,
        artifacts: task.getArtifacts(),
        isCurrent: task === this.currentTask,
        children: task.children.map(buildTree)
      };
    };
    
    return buildTree(this.rootTask);
  }
  
  /**
   * Get execution path (current task and ancestors)
   */
  getExecutionPath() {
    if (!this.currentTask) return [];
    
    const path = [];
    let task = this.currentTask;
    
    while (task) {
      path.unshift({
        id: task.id,
        description: task.description,
        status: task.status,
        depth: task.metadata.depth
      });
      task = task.parent;
    }
    
    return path;
  }
  
  /**
   * Reset the task manager
   */
  reset() {
    this.rootTask = null;
    this.currentTask = null;
    this.taskMap.clear();
    this.completedTasks = [];
  }
}