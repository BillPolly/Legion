/**
 * Task Entity - Core domain model for a planning task
 * Following Clean Architecture principles - no external dependencies
 */

// No more value object imports - using plain data

export class Task {
  constructor({
    id,
    description,
    complexity = null,
    status = 'PENDING',
    parentId = null,
    subtasks = [],
    inputs = [],
    outputs = [],
    tools = [],
    feasible = null,
    reasoning = null,
    depth = 0
  }) {
    this.id = id || this.generateId();
    this.description = this.validateDescription(description);
    this.complexity = complexity;
    this.status = status || 'PENDING';
    this.parentId = parentId;
    this.subtasks = subtasks;
    this.inputs = inputs;
    this.outputs = outputs;
    this.tools = tools;
    this.feasible = feasible;
    this.reasoning = reasoning;
    this.depth = depth;
  }

  generateId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `task-${timestamp}-${random}`;
  }

  validateDescription(description) {
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      throw new Error('Task description is required and must be a non-empty string');
    }
    return description.trim();
  }

  isSimple() {
    return this.complexity === 'SIMPLE';
  }

  isComplex() {
    return this.complexity === 'COMPLEX';
  }

  isPending() {
    return this.status === 'PENDING';
  }

  isInProgress() {
    return this.status === 'IN_PROGRESS';
  }

  isCompleted() {
    return this.status === 'COMPLETED';
  }

  isFailed() {
    return this.status === 'FAILED';
  }

  addSubtask(task) {
    if (!(task instanceof Task)) {
      throw new Error('Subtask must be a Task instance');
    }
    if (this.isSimple()) {
      throw new Error('Cannot add subtasks to a SIMPLE task');
    }
    this.subtasks.push(task);
  }

  addTool(tool) {
    if (!this.isSimple()) {
      throw new Error('Tools can only be added to SIMPLE tasks');
    }
    this.tools.push(tool);
  }

  setFeasibility(feasible, reasoning = null) {
    this.feasible = Boolean(feasible);
    if (reasoning) {
      this.reasoning = reasoning;
    }
  }

  updateStatus(newStatus) {
    this.status = newStatus;
  }

  hasSubtasks() {
    return this.subtasks.length > 0;
  }

  hasTools() {
    return this.tools.length > 0;
  }

  getSubtaskCount() {
    return this.subtasks.length;
  }

  getToolCount() {
    return this.tools.length;
  }

  toJSON() {
    return {
      id: this.id.toString(),
      description: this.description,
      complexity: this.complexity ? this.complexity.toString() : null,
      status: this.status.toString(),
      parentId: this.parentId ? this.parentId.toString() : null,
      subtasks: this.subtasks.map(t => t.toJSON()),
      inputs: this.inputs,
      outputs: this.outputs,
      tools: this.tools,
      feasible: this.feasible,
      reasoning: this.reasoning,
      depth: this.depth
    };
  }

  static fromJSON(json) {
    return new Task({
      ...json,
      subtasks: (json.subtasks || []).map(s => Task.fromJSON(s))
    });
  }
}