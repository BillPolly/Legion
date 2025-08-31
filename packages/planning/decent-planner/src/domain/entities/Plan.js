/**
 * Plan Entity - Core domain model for a planning result
 * Following Clean Architecture principles - no external dependencies
 */

import { Task } from './Task.js';

export class Plan {
  constructor({
    id,
    goal,
    rootTask,
    behaviorTrees = [],
    status = 'DRAFT',
    createdAt = new Date(),
    completedAt = null,
    context = {},
    validation = null,
    statistics = {}
  }) {
    this.id = id || this.generateId();
    this.goal = this.validateGoal(goal);
    this.rootTask = rootTask;
    this.behaviorTrees = behaviorTrees;
    this.status = status || 'DRAFT';
    this.createdAt = createdAt instanceof Date ? createdAt : new Date(createdAt);
    this.completedAt = completedAt ? (completedAt instanceof Date ? completedAt : new Date(completedAt)) : null;
    this.context = context;
    this.validation = validation;
    this.statistics = statistics;
  }

  generateId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `plan-${timestamp}-${random}`;
  }

  validateGoal(goal) {
    if (!goal || typeof goal !== 'string' || goal.trim().length === 0) {
      throw new Error('Plan goal is required and must be a non-empty string');
    }
    return goal.trim();
  }

  addBehaviorTree(behaviorTree) {
    this.behaviorTrees.push(behaviorTree);
  }

  updateStatus(newStatus) {
    // Simple status update with plain strings
    this.status = newStatus;
    
    if (this.status === 'COMPLETED' || this.status === 'FAILED') {
      this.completedAt = new Date();
    }
  }

  setValidation(validation) {
    this.validation = validation;
  }

  updateStatistics(statistics) {
    this.statistics = { ...this.statistics, ...statistics };
  }

  isDraft() {
    return this.status.isDraft();
  }

  isValidated() {
    return this.status.isValidated();
  }

  isReady() {
    return this.status.isReady();
  }

  isExecuting() {
    return this.status.isExecuting();
  }

  isCompleted() {
    return this.status.isCompleted();
  }

  isFailed() {
    return this.status.isFailed();
  }

  hasBehaviorTrees() {
    return this.behaviorTrees.length > 0;
  }

  getBehaviorTreeCount() {
    return this.behaviorTrees.length;
  }

  getDuration() {
    if (!this.completedAt) {
      return null;
    }
    return this.completedAt - this.createdAt;
  }

  toJSON() {
    return {
      id: this.id.toString(),
      goal: this.goal,
      rootTask: this.rootTask ? this.rootTask.toJSON() : null,
      behaviorTrees: this.behaviorTrees,
      status: this.status.toString(),
      createdAt: this.createdAt.toISOString(),
      completedAt: this.completedAt ? this.completedAt.toISOString() : null,
      context: this.context,
      validation: this.validation,
      statistics: this.statistics
    };
  }

  static fromJSON(json) {
    return new Plan({
      ...json,
      rootTask: json.rootTask ? Task.fromJSON(json.rootTask) : null,
      createdAt: new Date(json.createdAt),
      completedAt: json.completedAt ? new Date(json.completedAt) : null
    });
  }
}