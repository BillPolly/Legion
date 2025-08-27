/**
 * Plan Entity - Core domain model for a planning result
 * Following Clean Architecture principles - no external dependencies
 */

import { PlanId } from '../value-objects/PlanId.js';
import { PlanStatus } from '../value-objects/PlanStatus.js';
import { Task } from './Task.js';

export class Plan {
  constructor({
    id,
    goal,
    rootTask,
    behaviorTrees = [],
    status = PlanStatus.DRAFT,
    createdAt = new Date(),
    completedAt = null,
    context = {},
    validation = null,
    statistics = {}
  }) {
    this.id = id instanceof PlanId ? id : new PlanId(id);
    this.goal = this.validateGoal(goal);
    this.rootTask = rootTask;
    this.behaviorTrees = behaviorTrees;
    this.status = status instanceof PlanStatus ? status : new PlanStatus(status);
    this.createdAt = createdAt instanceof Date ? createdAt : new Date(createdAt);
    this.completedAt = completedAt ? (completedAt instanceof Date ? completedAt : new Date(completedAt)) : null;
    this.context = context;
    this.validation = validation;
    this.statistics = statistics;
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
    const statusObj = newStatus instanceof PlanStatus ? newStatus : new PlanStatus(newStatus);
    
    if (!this.status.canTransitionTo(statusObj)) {
      throw new Error(`Cannot transition from ${this.status} to ${statusObj}`);
    }
    
    this.status = statusObj;
    
    if (this.status.isCompleted() || this.status.isFailed()) {
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