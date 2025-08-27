/**
 * Unit tests for TaskId value object
 * Testing immutability and uniqueness
 */

import { TaskId } from '../../../../src/domain/value-objects/TaskId.js';

describe('TaskId Value Object', () => {
  describe('creation', () => {
    test('should create unique IDs', () => {
      const id1 = new TaskId();
      const id2 = new TaskId();
      
      expect(id1.toString()).not.toBe(id2.toString());
    });
    
    test('should create from existing string', () => {
      const idString = 'task-123456-xyz';
      const id = new TaskId(idString);
      
      expect(id.toString()).toBe(idString);
    });
    
    test('should be immutable', () => {
      const id = new TaskId();
      
      expect(() => {
        id.value = 'new-value';
      }).toThrow();
      
      expect(Object.isFrozen(id)).toBe(true);
    });
  });
  
  describe('equality', () => {
    test('should be equal when IDs are the same', () => {
      const idString = 'task-123456-xyz';
      const id1 = new TaskId(idString);
      const id2 = new TaskId(idString);
      
      expect(id1.equals(id2)).toBe(true);
    });
    
    test('should not be equal when IDs are different', () => {
      const id1 = new TaskId();
      const id2 = new TaskId();
      
      expect(id1.equals(id2)).toBe(false);
    });
    
    test('should not be equal to non-TaskId objects', () => {
      const id = new TaskId();
      
      expect(id.equals('string')).toBe(false);
      expect(id.equals(123)).toBe(false);
      expect(id.equals({})).toBe(false);
      expect(id.equals(null)).toBe(false);
    });
  });
  
  describe('string representation', () => {
    test('should have task prefix when auto-generated', () => {
      const id = new TaskId();
      
      expect(id.toString()).toMatch(/^task-\d+-[a-z0-9]+$/);
    });
    
    test('should preserve custom format when provided', () => {
      const customId = 'custom-task-id';
      const id = new TaskId(customId);
      
      expect(id.toString()).toBe(customId);
    });
  });
  
  describe('from static method', () => {
    test('should create TaskId from valid string', () => {
      const idString = 'task-123456-xyz';
      const id = TaskId.from(idString);
      
      expect(id).toBeInstanceOf(TaskId);
      expect(id.toString()).toBe(idString);
    });
    
    test('should handle invalid input', () => {
      // The from method doesn't throw for null/undefined - it generates new IDs
      const id1 = TaskId.from(null);
      expect(id1).toBeInstanceOf(TaskId);
      expect(id1.toString()).toMatch(/^task-\d+-[a-z0-9]+$/);
      
      const id2 = TaskId.from(undefined);
      expect(id2).toBeInstanceOf(TaskId);
      expect(id2.toString()).toMatch(/^task-\d+-[a-z0-9]+$/);
      
      // Numbers get converted to strings
      const id3 = TaskId.from(123);
      expect(id3.toString()).toBe('123');
      
      // Only empty string throws
      expect(() => TaskId.from('')).toThrow('TaskId cannot be empty');
    });
  });
  
  // Note: TaskId doesn't have an isValid method in the implementation
  // These tests would need to be removed or the method added
});