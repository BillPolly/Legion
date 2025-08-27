/**
 * Task Entity - Core domain model for a planning task
 * Following Clean Architecture principles - no external dependencies
 */

import { TaskComplexity } from '../value-objects/TaskComplexity.js';
import { TaskStatus } from '../value-objects/TaskStatus.js';
import { TaskId } from '../value-objects/TaskId.js';

export class Task {
  constructor({
    id,
    description,
    complexity = null,
    status = TaskStatus.PENDING,
    parentId = null,
    subtasks = [],
    inputs = [],
    outputs = [],
    tools = [],
    feasible = null,
    reasoning = null,
    depth = 0
  }) {
    this.id = id instanceof TaskId ? id : new TaskId(id);
    this.description = this.validateDescription(description);
    this.complexity = complexity ? (complexity instanceof TaskComplexity ? complexity : new TaskComplexity(complexity)) : null;
    this.status = status instanceof TaskStatus ? status : new TaskStatus(status);
    this.parentId = parentId ? (parentId instanceof TaskId ? parentId : new TaskId(parentId)) : null;
    this.subtasks = subtasks;
    this.inputs = inputs;
    this.outputs = outputs;
    this.tools = tools;
    this.feasible = feasible;
    this.reasoning = reasoning;
    this.depth = depth;
  }

  validateDescription(description) {
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      throw new Error('Task description is required and must be a non-empty string');
    }
    return description.trim();
  }

  isSimple() {
    // If complexity is not yet determined, return false
    return this.complexity ? this.complexity.isSimple() : false;
  }

  isComplex() {
    // If complexity is not yet determined, return false
    return this.complexity ? this.complexity.isComplex() : false;
  }

  isPending() {
    return this.status.isPending();
  }

  isInProgress() {
    return this.status.isInProgress();
  }

  isCompleted() {
    return this.status.isCompleted();
  }

  isFailed() {
    return this.status.isFailed();
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
    this.status = newStatus instanceof TaskStatus ? newStatus : new TaskStatus(newStatus);
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