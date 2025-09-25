/**
 * Project Plan Entity
 * 
 * Represents a structured execution plan with phases and tasks.
 * Used by project planning strategies and task decomposition.
 */

import { BaseEntity } from './BaseEntity.js';

export class ProjectPlanEntity extends BaseEntity {
  constructor(data = {}) {
    super(data);
  }

  static getEntityType() {
    return 'plan';
  }

  static getSchema() {
    return {
      ':plan/id': { type: 'string', cardinality: 'one', unique: 'identity' },
      ':plan/project': { type: 'ref', cardinality: 'one' },
      ':plan/created': { type: 'instant', cardinality: 'one' },
      ':plan/status': { type: 'string', cardinality: 'one' }, // draft, active, completed, abandoned
    };
  }

  static getRequiredFields() {
    return [':plan/id', ':plan/project', ':plan/status'];
  }

  // Getters and setters
  get planId() {
    return this.getField('id');
  }

  set planId(value) {
    this.setField('id', value);
  }

  get projectId() {
    return this.getField('project');
  }

  set projectId(value) {
    this.setField('project', value);
  }

  get status() {
    return this.getField('status');
  }

  set status(value) {
    if (!['draft', 'active', 'completed', 'abandoned'].includes(value)) {
      throw new Error(`Invalid plan status: ${value}`);
    }
    this.setField('status', value);
  }

  // Helper methods
  isActive() {
    return this.status === 'active';
  }

  isCompleted() {
    return this.status === 'completed';
  }

  isAbandoned() {
    return this.status === 'abandoned';
  }

  // Factory method
  static create(planId, projectId) {
    return new ProjectPlanEntity({
      ':plan/id': planId,
      ':plan/project': projectId,
      ':plan/status': 'draft',
      ':plan/created': new Date()
    });
  }
}

/**
 * Plan Phase Entity
 * 
 * Represents a phase within a project plan containing related tasks.
 */
export class PlanPhaseEntity extends BaseEntity {
  constructor(data = {}) {
    super(data);
  }

  static getEntityType() {
    return 'phase';
  }

  static getSchema() {
    return {
      ':phase/name': { type: 'string', cardinality: 'one' },
      ':phase/priority': { type: 'long', cardinality: 'one' },
      ':phase/plan': { type: 'ref', cardinality: 'one' },
      ':phase/status': { type: 'string', cardinality: 'one' }, // pending, in_progress, completed, failed
    };
  }

  static getRequiredFields() {
    return [':phase/name', ':phase/priority', ':phase/plan', ':phase/status'];
  }

  // Getters and setters
  get name() {
    return this.getField('name');
  }

  set name(value) {
    this.setField('name', value);
  }

  get priority() {
    return this.getField('priority');
  }

  set priority(value) {
    this.setField('priority', parseInt(value));
  }

  get planId() {
    return this.getField('plan');
  }

  set planId(value) {
    this.setField('plan', value);
  }

  get status() {
    return this.getField('status');
  }

  set status(value) {
    if (!['pending', 'in_progress', 'completed', 'failed'].includes(value)) {
      throw new Error(`Invalid phase status: ${value}`);
    }
    this.setField('status', value);
  }

  // Helper methods
  isPending() {
    return this.status === 'pending';
  }

  isInProgress() {
    return this.status === 'in_progress';
  }

  isCompleted() {
    return this.status === 'completed';
  }

  isFailed() {
    return this.status === 'failed';
  }

  // Factory method
  static create(name, priority, planId) {
    return new PlanPhaseEntity({
      ':phase/name': name,
      ':phase/priority': priority,
      ':phase/plan': planId,
      ':phase/status': 'pending'
    });
  }
}

/**
 * Composite Project Plan class that manages both plan and phases
 */
export class CompositeProjectPlan {
  constructor(plan, phases = []) {
    this.plan = plan;
    this.phases = phases;
  }

  // Add phase to plan
  addPhase(name, priority) {
    const phase = PlanPhaseEntity.create(name, priority, this.plan.planId);
    this.phases.push(phase);
    return phase;
  }

  // Get phases sorted by priority
  getPhasesByPriority() {
    return [...this.phases].sort((a, b) => a.priority - b.priority);
  }

  // Get phases by status
  getPhasesByStatus(status) {
    return this.phases.filter(phase => phase.status === status);
  }

  // Get next pending phase
  getNextPhase() {
    const pendingPhases = this.getPhasesByStatus('pending');
    return pendingPhases.sort((a, b) => a.priority - b.priority)[0] || null;
  }

  // Mark phase as in progress
  startPhase(phaseName) {
    const phase = this.phases.find(p => p.name === phaseName);
    if (phase) {
      phase.status = 'in_progress';
    }
    return phase;
  }

  // Mark phase as completed
  completePhase(phaseName) {
    const phase = this.phases.find(p => p.name === phaseName);
    if (phase) {
      phase.status = 'completed';
      
      // Check if all phases are completed
      const allCompleted = this.phases.every(p => p.status === 'completed');
      if (allCompleted) {
        this.plan.status = 'completed';
      }
    }
    return phase;
  }

  // Get overall progress percentage
  getProgress() {
    if (this.phases.length === 0) return 0;
    const completed = this.phases.filter(p => p.status === 'completed').length;
    return Math.round((completed / this.phases.length) * 100);
  }

  // Convert to JSON format expected by prompts
  toPromptFormat() {
    return {
      planId: this.plan.planId,
      phases: this.getPhasesByPriority().map(phase => ({
        phase: phase.name,
        priority: phase.priority,
        status: phase.status,
        // Tasks would be added here by TaskEntity relations
        tasks: []
      }))
    };
  }

  // Create from prompt response format
  static fromPromptResponse(response, projectId) {
    const plan = ProjectPlanEntity.create(response.planId, projectId);
    const phases = response.phases.map(phaseData => {
      const phase = PlanPhaseEntity.create(
        phaseData.phase, 
        phaseData.priority, 
        response.planId
      );
      if (phaseData.status) {
        phase.status = phaseData.status;
      }
      return phase;
    });

    return new CompositeProjectPlan(plan, phases);
  }

  // Validate the complete plan
  validate() {
    const planValid = this.plan.validate();
    const phasesValid = this.phases.every(phase => phase.validate());
    
    // Business rule validations
    const errors = [];
    
    if (this.phases.length === 0) {
      errors.push('Plan must have at least one phase');
    }
    
    const priorities = this.phases.map(p => p.priority);
    const uniquePriorities = new Set(priorities);
    if (priorities.length !== uniquePriorities.size) {
      errors.push('Each phase must have a unique priority');
    }
    
    return planValid && phasesValid && errors.length === 0;
  }
}