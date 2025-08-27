/**
 * Unit tests for TaskStatus value object
 * Testing valid statuses and state transitions
 */

import { TaskStatus } from '../../../../src/domain/value-objects/TaskStatus.js';

describe('TaskStatus Value Object', () => {
  describe('static constants', () => {
    test('should have all expected status values', () => {
      expect(TaskStatus.PENDING).toBe('PENDING');
      expect(TaskStatus.IN_PROGRESS).toBe('IN_PROGRESS');
      expect(TaskStatus.COMPLETED).toBe('COMPLETED');
      expect(TaskStatus.FAILED).toBe('FAILED');
      expect(TaskStatus.CANCELLED).toBe('CANCELLED');
    });
  });

  describe('constructor and validation', () => {
    test('should create valid status instances', () => {
      const pending = new TaskStatus('PENDING');
      expect(pending.value).toBe('PENDING');
      expect(pending.toString()).toBe('PENDING');
    });

    test('should normalize case', () => {
      const status = new TaskStatus('pending');
      expect(status.value).toBe('PENDING');
    });

    test('should reject invalid statuses', () => {
      expect(() => new TaskStatus('INVALID')).toThrow('Invalid task status');
      expect(() => new TaskStatus('')).toThrow('Invalid task status');
    });

    test('should be immutable', () => {
      const status = new TaskStatus('PENDING');
      expect(Object.isFrozen(status)).toBe(true);
    });
  });

  describe('status checks', () => {
    test('should correctly identify pending status', () => {
      const pending = new TaskStatus('PENDING');
      expect(pending.isPending()).toBe(true);
      expect(pending.isInProgress()).toBe(false);
      expect(pending.isCompleted()).toBe(false);
      expect(pending.isFailed()).toBe(false);
      expect(pending.isCancelled()).toBe(false);
    });

    test('should correctly identify in progress status', () => {
      const inProgress = new TaskStatus('IN_PROGRESS');
      expect(inProgress.isPending()).toBe(false);
      expect(inProgress.isInProgress()).toBe(true);
      expect(inProgress.isCompleted()).toBe(false);
      expect(inProgress.isFailed()).toBe(false);
      expect(inProgress.isCancelled()).toBe(false);
    });

    test('should correctly identify completed status', () => {
      const completed = new TaskStatus('COMPLETED');
      expect(completed.isPending()).toBe(false);
      expect(completed.isInProgress()).toBe(false);
      expect(completed.isCompleted()).toBe(true);
      expect(completed.isFailed()).toBe(false);
      expect(completed.isCancelled()).toBe(false);
    });

    test('should correctly identify failed status', () => {
      const failed = new TaskStatus('FAILED');
      expect(failed.isPending()).toBe(false);
      expect(failed.isInProgress()).toBe(false);
      expect(failed.isCompleted()).toBe(false);
      expect(failed.isFailed()).toBe(true);
      expect(failed.isCancelled()).toBe(false);
    });

    test('should correctly identify cancelled status', () => {
      const cancelled = new TaskStatus('CANCELLED');
      expect(cancelled.isPending()).toBe(false);
      expect(cancelled.isInProgress()).toBe(false);
      expect(cancelled.isCompleted()).toBe(false);
      expect(cancelled.isFailed()).toBe(false);
      expect(cancelled.isCancelled()).toBe(true);
    });

    test('should correctly identify terminal statuses', () => {
      const completed = new TaskStatus('COMPLETED');
      const failed = new TaskStatus('FAILED');
      const cancelled = new TaskStatus('CANCELLED');
      const pending = new TaskStatus('PENDING');
      const inProgress = new TaskStatus('IN_PROGRESS');

      expect(completed.isTerminal()).toBe(true);
      expect(failed.isTerminal()).toBe(true);
      expect(cancelled.isTerminal()).toBe(true);
      expect(pending.isTerminal()).toBe(false);
      expect(inProgress.isTerminal()).toBe(false);
    });
  });

  describe('state transitions', () => {
    test('should allow valid transitions from PENDING', () => {
      const pending = new TaskStatus('PENDING');
      
      expect(pending.canTransitionTo(new TaskStatus('IN_PROGRESS'))).toBe(true);
      expect(pending.canTransitionTo(new TaskStatus('CANCELLED'))).toBe(true);
      expect(pending.canTransitionTo(new TaskStatus('COMPLETED'))).toBe(false);
      expect(pending.canTransitionTo(new TaskStatus('FAILED'))).toBe(false);
    });

    test('should allow valid transitions from IN_PROGRESS', () => {
      const inProgress = new TaskStatus('IN_PROGRESS');
      
      expect(inProgress.canTransitionTo(new TaskStatus('COMPLETED'))).toBe(true);
      expect(inProgress.canTransitionTo(new TaskStatus('FAILED'))).toBe(true);
      expect(inProgress.canTransitionTo(new TaskStatus('CANCELLED'))).toBe(true);
      expect(inProgress.canTransitionTo(new TaskStatus('PENDING'))).toBe(false);
    });

    test('should not allow transitions from terminal states', () => {
      const completed = new TaskStatus('COMPLETED');
      const failed = new TaskStatus('FAILED');
      const cancelled = new TaskStatus('CANCELLED');
      
      expect(completed.canTransitionTo(new TaskStatus('IN_PROGRESS'))).toBe(false);
      expect(failed.canTransitionTo(new TaskStatus('PENDING'))).toBe(false);
      expect(cancelled.canTransitionTo(new TaskStatus('COMPLETED'))).toBe(false);
    });

    test('should handle invalid transition targets', () => {
      const pending = new TaskStatus('PENDING');
      
      expect(pending.canTransitionTo('IN_PROGRESS')).toBe(false); // Not a TaskStatus instance
      expect(pending.canTransitionTo(null)).toBe(false);
      expect(pending.canTransitionTo(undefined)).toBe(false);
    });
  });

  describe('equality', () => {
    test('should correctly compare equal statuses', () => {
      const status1 = new TaskStatus('PENDING');
      const status2 = new TaskStatus('PENDING');
      
      expect(status1.equals(status2)).toBe(true);
    });

    test('should correctly compare different statuses', () => {
      const pending = new TaskStatus('PENDING');
      const inProgress = new TaskStatus('IN_PROGRESS');
      
      expect(pending.equals(inProgress)).toBe(false);
    });

    test('should handle non-TaskStatus comparisons', () => {
      const status = new TaskStatus('PENDING');
      
      expect(status.equals('PENDING')).toBe(false);
      expect(status.equals(null)).toBe(false);
      expect(status.equals(undefined)).toBe(false);
    });
  });

  describe('factory methods', () => {
    test('should create pending status', () => {
      const status = TaskStatus.pending();
      expect(status.value).toBe('PENDING');
      expect(status.isPending()).toBe(true);
    });

    test('should create in progress status', () => {
      const status = TaskStatus.inProgress();
      expect(status.value).toBe('IN_PROGRESS');
      expect(status.isInProgress()).toBe(true);
    });

    test('should create completed status', () => {
      const status = TaskStatus.completed();
      expect(status.value).toBe('COMPLETED');
      expect(status.isCompleted()).toBe(true);
    });

    test('should create failed status', () => {
      const status = TaskStatus.failed();
      expect(status.value).toBe('FAILED');
      expect(status.isFailed()).toBe(true);
    });

    test('should create cancelled status', () => {
      const status = TaskStatus.cancelled();
      expect(status.value).toBe('CANCELLED');
      expect(status.isCancelled()).toBe(true);
    });
  });
});