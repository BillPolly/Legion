/**
 * Unit tests for Plan entity
 * Pure domain logic tests with no external dependencies
 * Following Clean Architecture and TDD principles
 */

// Test functions are provided by the test runner as globals
import { Plan } from '../../../../src/domain/entities/Plan.js';
import { Task } from '../../../../src/domain/entities/Task.js';
import { PlanId } from '../../../../src/domain/value-objects/PlanId.js';
import { PlanStatus } from '../../../../src/domain/value-objects/PlanStatus.js';

describe('Plan Entity', () => {
  describe('creation', () => {
    it('should create a plan with required goal', () => {
      const plan = new Plan({
        goal: 'Build a web application'
      });
      
      expect(plan.goal).toBe('Build a web application');
      expect(plan.id).toBeDefined();
      expect(plan.status.isDraft()).toBe(true);
      expect(plan.createdAt).toBeInstanceOf(Date);
    });
    
    it('should throw error for empty goal', () => {
      expect(() => new Plan({ goal: '' })).toThrow('Plan goal is required');
      expect(() => new Plan({ goal: '   ' })).toThrow('Plan goal is required');
      expect(() => new Plan({ goal: null })).toThrow('Plan goal is required');
    });
    
    it('should accept all valid properties', () => {
      const rootTask = new Task({ description: 'Root task' });
      const createdAt = new Date('2024-01-01');
      
      const plan = new Plan({
        id: 'plan-123',
        goal: 'Test goal',
        rootTask,
        status: PlanStatus.VALIDATED,
        createdAt,
        context: { domain: 'web' },
        statistics: { totalTasks: 5 }
      });
      
      expect(plan.id.toString()).toBe('plan-123');
      expect(plan.rootTask).toBe(rootTask);
      expect(plan.status.isValidated()).toBe(true);
      expect(plan.createdAt).toEqual(createdAt);
      expect(plan.context.domain).toBe('web');
      expect(plan.statistics.totalTasks).toBe(5);
    });
  });
  
  describe('behavior tree management', () => {
    it('should add behavior trees', () => {
      const plan = new Plan({ goal: 'Test goal' });
      
      expect(plan.hasBehaviorTrees()).toBe(false);
      expect(plan.getBehaviorTreeCount()).toBe(0);
      
      plan.addBehaviorTree({ id: 'bt-1', type: 'sequence' });
      plan.addBehaviorTree({ id: 'bt-2', type: 'selector' });
      
      expect(plan.hasBehaviorTrees()).toBe(true);
      expect(plan.getBehaviorTreeCount()).toBe(2);
    });
  });
  
  describe('status transitions', () => {
    it('should allow valid status transitions', () => {
      const plan = new Plan({ goal: 'Test goal' });
      
      // DRAFT -> VALIDATED
      plan.updateStatus(PlanStatus.VALIDATED);
      expect(plan.isValidated()).toBe(true);
      
      // VALIDATED -> READY
      plan.updateStatus(PlanStatus.READY);
      expect(plan.isReady()).toBe(true);
      
      // READY -> EXECUTING
      plan.updateStatus(PlanStatus.EXECUTING);
      expect(plan.isExecuting()).toBe(true);
      
      // EXECUTING -> COMPLETED
      plan.updateStatus(PlanStatus.COMPLETED);
      expect(plan.isCompleted()).toBe(true);
      expect(plan.completedAt).toBeInstanceOf(Date);
    });
    
    it('should throw error for invalid status transitions', () => {
      const plan = new Plan({ goal: 'Test goal' });
      
      // DRAFT cannot go directly to EXECUTING
      expect(() => plan.updateStatus(PlanStatus.EXECUTING))
        .toThrow('Cannot transition from DRAFT to EXECUTING');
    });
    
    it('should set completedAt when plan completes', () => {
      const plan = new Plan({ goal: 'Test goal' });
      
      expect(plan.completedAt).toBeNull();
      
      plan.updateStatus(PlanStatus.VALIDATED);
      plan.updateStatus(PlanStatus.READY);
      plan.updateStatus(PlanStatus.EXECUTING);
      plan.updateStatus(PlanStatus.COMPLETED);
      
      expect(plan.completedAt).toBeInstanceOf(Date);
    });
    
    it('should set completedAt when plan fails', () => {
      const plan = new Plan({ goal: 'Test goal' });
      
      plan.updateStatus(PlanStatus.FAILED);
      
      expect(plan.completedAt).toBeInstanceOf(Date);
      expect(plan.isFailed()).toBe(true);
    });
  });
  
  describe('validation management', () => {
    it('should set validation results', () => {
      const plan = new Plan({ goal: 'Test goal' });
      
      const validation = {
        valid: true,
        errors: [],
        warnings: ['Minor issue']
      };
      
      plan.setValidation(validation);
      
      expect(plan.validation).toEqual(validation);
    });
  });
  
  describe('statistics management', () => {
    it('should update statistics incrementally', () => {
      const plan = new Plan({ 
        goal: 'Test goal',
        statistics: { totalTasks: 5 }
      });
      
      plan.updateStatistics({ 
        simpleTasks: 3,
        complexTasks: 2 
      });
      
      expect(plan.statistics).toEqual({
        totalTasks: 5,
        simpleTasks: 3,
        complexTasks: 2
      });
      
      // Should merge, not replace
      plan.updateStatistics({ feasibleTasks: 3 });
      
      expect(plan.statistics.totalTasks).toBe(5);
      expect(plan.statistics.feasibleTasks).toBe(3);
    });
  });
  
  describe('duration calculation', () => {
    it('should return null if not completed', () => {
      const plan = new Plan({ goal: 'Test goal' });
      
      expect(plan.getDuration()).toBeNull();
    });
    
    it('should calculate duration when completed', () => {
      const createdAt = new Date('2024-01-01T10:00:00');
      const completedAt = new Date('2024-01-01T10:30:00');
      
      const plan = new Plan({ 
        goal: 'Test goal',
        createdAt
      });
      
      plan.completedAt = completedAt;
      
      const duration = plan.getDuration();
      expect(duration).toBe(30 * 60 * 1000); // 30 minutes in milliseconds
    });
  });
  
  describe('helper methods', () => {
    it('should correctly identify draft plans', () => {
      const plan = new Plan({ 
        goal: 'Test',
        status: PlanStatus.DRAFT
      });
      
      expect(plan.isDraft()).toBe(true);
      expect(plan.isValidated()).toBe(false);
      expect(plan.isReady()).toBe(false);
    });
    
    it('should correctly identify executing plans', () => {
      const plan = new Plan({ 
        goal: 'Test',
        status: PlanStatus.EXECUTING
      });
      
      expect(plan.isExecuting()).toBe(true);
      expect(plan.isCompleted()).toBe(false);
    });
    
    it('should correctly identify completed plans', () => {
      const plan = new Plan({ 
        goal: 'Test',
        status: PlanStatus.COMPLETED
      });
      
      expect(plan.isCompleted()).toBe(true);
      expect(plan.isExecuting()).toBe(false);
    });
  });
  
  describe('serialization', () => {
    it('should convert to JSON', () => {
      const rootTask = new Task({ description: 'Root' });
      const plan = new Plan({
        id: 'plan-456',
        goal: 'Test goal',
        rootTask,
        status: PlanStatus.VALIDATED,
        createdAt: new Date('2024-01-01'),
        context: { test: true }
      });
      
      const json = plan.toJSON();
      
      expect(json.id).toBe('plan-456');
      expect(json.goal).toBe('Test goal');
      expect(json.status).toBe('VALIDATED');
      expect(json.createdAt).toBe('2024-01-01T00:00:00.000Z');
      expect(json.rootTask).toBeDefined();
      expect(json.context.test).toBe(true);
    });
    
    it('should restore from JSON', () => {
      const json = {
        id: 'plan-789',
        goal: 'Restored goal',
        status: 'READY',
        createdAt: '2024-01-01T12:00:00.000Z',
        completedAt: '2024-01-01T13:00:00.000Z',
        behaviorTrees: [{ id: 'bt-1' }],
        statistics: { totalTasks: 10 }
      };
      
      const plan = Plan.fromJSON(json);
      
      expect(plan.id.toString()).toBe('plan-789');
      expect(plan.goal).toBe('Restored goal');
      expect(plan.isReady()).toBe(true);
      expect(plan.createdAt).toEqual(new Date('2024-01-01T12:00:00.000Z'));
      expect(plan.completedAt).toEqual(new Date('2024-01-01T13:00:00.000Z'));
      expect(plan.getBehaviorTreeCount()).toBe(1);
      expect(plan.statistics.totalTasks).toBe(10);
    });
  });
});