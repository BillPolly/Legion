/**
 * Unit tests for PlanStatus value object
 * Testing valid status transitions and immutability
 */

import { PlanStatus } from '../../../../src/domain/value-objects/PlanStatus.js';

describe('PlanStatus Value Object', () => {
  describe('static constants', () => {
    test('should have all expected status values', () => {
      expect(PlanStatus.DRAFT).toBe('DRAFT');
      expect(PlanStatus.VALIDATED).toBe('VALIDATED');
      expect(PlanStatus.READY).toBe('READY');
      expect(PlanStatus.EXECUTING).toBe('EXECUTING');
      expect(PlanStatus.COMPLETED).toBe('COMPLETED');
      expect(PlanStatus.FAILED).toBe('FAILED');
    });
  });

  describe('constructor and validation', () => {
    test('should create valid status instances', () => {
      const draft = new PlanStatus('DRAFT');
      expect(draft.value).toBe('DRAFT');
      expect(draft.toString()).toBe('DRAFT');
    });

    test('should normalize case', () => {
      const status = new PlanStatus('draft');
      expect(status.value).toBe('DRAFT');
    });

    test('should reject invalid statuses', () => {
      expect(() => new PlanStatus('INVALID')).toThrow('Invalid plan status');
      expect(() => new PlanStatus('')).toThrow('Invalid plan status');
    });

    test('should be immutable', () => {
      const status = new PlanStatus('DRAFT');
      expect(Object.isFrozen(status)).toBe(true);
    });
  });

  describe('status checks', () => {
    test('should correctly identify draft status', () => {
      const draft = new PlanStatus('DRAFT');
      expect(draft.isDraft()).toBe(true);
      expect(draft.isValidated()).toBe(false);
      expect(draft.isReady()).toBe(false);
      expect(draft.isExecuting()).toBe(false);
      expect(draft.isCompleted()).toBe(false);
      expect(draft.isFailed()).toBe(false);
    });

    test('should correctly identify validated status', () => {
      const validated = new PlanStatus('VALIDATED');
      expect(validated.isDraft()).toBe(false);
      expect(validated.isValidated()).toBe(true);
      expect(validated.isReady()).toBe(false);
      expect(validated.isExecuting()).toBe(false);
      expect(validated.isCompleted()).toBe(false);
      expect(validated.isFailed()).toBe(false);
    });

    test('should correctly identify ready status', () => {
      const ready = new PlanStatus('READY');
      expect(ready.isDraft()).toBe(false);
      expect(ready.isValidated()).toBe(false);
      expect(ready.isReady()).toBe(true);
      expect(ready.isExecuting()).toBe(false);
      expect(ready.isCompleted()).toBe(false);
      expect(ready.isFailed()).toBe(false);
    });

    test('should correctly identify executing status', () => {
      const executing = new PlanStatus('EXECUTING');
      expect(executing.isDraft()).toBe(false);
      expect(executing.isValidated()).toBe(false);
      expect(executing.isReady()).toBe(false);
      expect(executing.isExecuting()).toBe(true);
      expect(executing.isCompleted()).toBe(false);
      expect(executing.isFailed()).toBe(false);
    });

    test('should correctly identify completed status', () => {
      const completed = new PlanStatus('COMPLETED');
      expect(completed.isDraft()).toBe(false);
      expect(completed.isValidated()).toBe(false);
      expect(completed.isReady()).toBe(false);
      expect(completed.isExecuting()).toBe(false);
      expect(completed.isCompleted()).toBe(true);
      expect(completed.isFailed()).toBe(false);
    });

    test('should correctly identify failed status', () => {
      const failed = new PlanStatus('FAILED');
      expect(failed.isDraft()).toBe(false);
      expect(failed.isValidated()).toBe(false);
      expect(failed.isReady()).toBe(false);
      expect(failed.isExecuting()).toBe(false);
      expect(failed.isCompleted()).toBe(false);
      expect(failed.isFailed()).toBe(true);
    });

    test('should correctly identify terminal statuses', () => {
      const completed = new PlanStatus('COMPLETED');
      const failed = new PlanStatus('FAILED');
      const draft = new PlanStatus('DRAFT');
      const executing = new PlanStatus('EXECUTING');

      expect(completed.isTerminal()).toBe(true);
      expect(failed.isTerminal()).toBe(true);
      expect(draft.isTerminal()).toBe(false);
      expect(executing.isTerminal()).toBe(false);
    });
  });

  describe('state transitions', () => {
    test('should allow valid transitions from DRAFT', () => {
      const draft = new PlanStatus('DRAFT');
      
      expect(draft.canTransitionTo(new PlanStatus('VALIDATED'))).toBe(true);
      expect(draft.canTransitionTo(new PlanStatus('FAILED'))).toBe(true);
      expect(draft.canTransitionTo(new PlanStatus('COMPLETED'))).toBe(false);
      expect(draft.canTransitionTo(new PlanStatus('EXECUTING'))).toBe(false);
    });

    test('should allow valid transitions from VALIDATED', () => {
      const validated = new PlanStatus('VALIDATED');
      
      expect(validated.canTransitionTo(new PlanStatus('READY'))).toBe(true);
      expect(validated.canTransitionTo(new PlanStatus('FAILED'))).toBe(true);
      expect(validated.canTransitionTo(new PlanStatus('DRAFT'))).toBe(false);
      expect(validated.canTransitionTo(new PlanStatus('COMPLETED'))).toBe(false);
    });

    test('should allow valid transitions from READY', () => {
      const ready = new PlanStatus('READY');
      
      expect(ready.canTransitionTo(new PlanStatus('EXECUTING'))).toBe(true);
      expect(ready.canTransitionTo(new PlanStatus('FAILED'))).toBe(true);
      expect(ready.canTransitionTo(new PlanStatus('DRAFT'))).toBe(false);
      expect(ready.canTransitionTo(new PlanStatus('VALIDATED'))).toBe(false);
    });

    test('should allow valid transitions from EXECUTING', () => {
      const executing = new PlanStatus('EXECUTING');
      
      expect(executing.canTransitionTo(new PlanStatus('COMPLETED'))).toBe(true);
      expect(executing.canTransitionTo(new PlanStatus('FAILED'))).toBe(true);
      expect(executing.canTransitionTo(new PlanStatus('DRAFT'))).toBe(false);
      expect(executing.canTransitionTo(new PlanStatus('READY'))).toBe(false);
    });

    test('should not allow transitions from terminal states', () => {
      const completed = new PlanStatus('COMPLETED');
      const failed = new PlanStatus('FAILED');
      
      expect(completed.canTransitionTo(new PlanStatus('DRAFT'))).toBe(false);
      expect(completed.canTransitionTo(new PlanStatus('EXECUTING'))).toBe(false);
      expect(failed.canTransitionTo(new PlanStatus('DRAFT'))).toBe(false);
      expect(failed.canTransitionTo(new PlanStatus('READY'))).toBe(false);
    });

    test('should handle invalid transition targets', () => {
      const draft = new PlanStatus('DRAFT');
      
      expect(draft.canTransitionTo('VALIDATED')).toBe(false); // Not a PlanStatus instance
      expect(draft.canTransitionTo(null)).toBe(false);
      expect(draft.canTransitionTo(undefined)).toBe(false);
    });
  });

  describe('equality', () => {
    test('should correctly compare equal statuses', () => {
      const status1 = new PlanStatus('DRAFT');
      const status2 = new PlanStatus('DRAFT');
      
      expect(status1.equals(status2)).toBe(true);
    });

    test('should correctly compare different statuses', () => {
      const draft = new PlanStatus('DRAFT');
      const validated = new PlanStatus('VALIDATED');
      
      expect(draft.equals(validated)).toBe(false);
    });

    test('should handle non-PlanStatus comparisons', () => {
      const status = new PlanStatus('DRAFT');
      
      expect(status.equals('DRAFT')).toBe(false);
      expect(status.equals(null)).toBe(false);
      expect(status.equals(undefined)).toBe(false);
    });
  });

  describe('factory methods', () => {
    test('should create draft status', () => {
      const status = PlanStatus.draft();
      expect(status.value).toBe('DRAFT');
      expect(status.isDraft()).toBe(true);
    });

    test('should create validated status', () => {
      const status = PlanStatus.validated();
      expect(status.value).toBe('VALIDATED');
      expect(status.isValidated()).toBe(true);
    });

    test('should create ready status', () => {
      const status = PlanStatus.ready();
      expect(status.value).toBe('READY');
      expect(status.isReady()).toBe(true);
    });

    test('should create executing status', () => {
      const status = PlanStatus.executing();
      expect(status.value).toBe('EXECUTING');
      expect(status.isExecuting()).toBe(true);
    });

    test('should create completed status', () => {
      const status = PlanStatus.completed();
      expect(status.value).toBe('COMPLETED');
      expect(status.isCompleted()).toBe(true);
    });

    test('should create failed status', () => {
      const status = PlanStatus.failed();
      expect(status.value).toBe('FAILED');
      expect(status.isFailed()).toBe(true);
    });
  });
});