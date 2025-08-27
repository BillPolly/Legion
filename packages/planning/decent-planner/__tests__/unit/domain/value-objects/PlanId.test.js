/**
 * Unit tests for PlanId value object
 * Testing immutability and uniqueness
 */

import { PlanId } from '../../../../src/domain/value-objects/PlanId.js';

describe('PlanId Value Object', () => {
  describe('creation', () => {
    test('should create unique IDs', () => {
      const id1 = new PlanId();
      const id2 = new PlanId();
      
      expect(id1.toString()).not.toBe(id2.toString());
    });
    
    test('should create from existing string', () => {
      const idString = 'plan-123456-abc';
      const id = new PlanId(idString);
      
      expect(id.toString()).toBe(idString);
    });
    
    test('should be immutable', () => {
      const id = new PlanId();
      
      expect(() => {
        id.value = 'new-value';
      }).toThrow();
      
      expect(Object.isFrozen(id)).toBe(true);
    });
  });
  
  describe('equality', () => {
    test('should be equal when IDs are the same', () => {
      const idString = 'plan-123456-abc';
      const id1 = new PlanId(idString);
      const id2 = new PlanId(idString);
      
      expect(id1.equals(id2)).toBe(true);
    });
    
    test('should not be equal when IDs are different', () => {
      const id1 = new PlanId();
      const id2 = new PlanId();
      
      expect(id1.equals(id2)).toBe(false);
    });
    
    test('should not be equal to non-PlanId objects', () => {
      const id = new PlanId();
      
      expect(id.equals('string')).toBe(false);
      expect(id.equals(123)).toBe(false);
      expect(id.equals({})).toBe(false);
      expect(id.equals(null)).toBe(false);
    });
  });
  
  describe('string representation', () => {
    test('should have plan prefix when auto-generated', () => {
      const id = new PlanId();
      
      expect(id.toString()).toMatch(/^plan-\d+-[a-z0-9]+$/);
    });
    
    test('should preserve custom format when provided', () => {
      const customId = 'custom-plan-id';
      const id = new PlanId(customId);
      
      expect(id.toString()).toBe(customId);
    });
  });
  
  describe('from static method', () => {
    test('should create PlanId from valid string', () => {
      const idString = 'plan-123456-abc';
      const id = PlanId.from(idString);
      
      expect(id).toBeInstanceOf(PlanId);
      expect(id.toString()).toBe(idString);
    });
    
    test('should handle invalid input', () => {
      // The from method doesn't throw for null/undefined - it generates new IDs
      const id1 = PlanId.from(null);
      expect(id1).toBeInstanceOf(PlanId);
      expect(id1.toString()).toMatch(/^plan-\d+-[a-z0-9]+$/);
      
      const id2 = PlanId.from(undefined);
      expect(id2).toBeInstanceOf(PlanId);
      expect(id2.toString()).toMatch(/^plan-\d+-[a-z0-9]+$/);
      
      // Numbers get converted to strings
      const id3 = PlanId.from(123);
      expect(id3.toString()).toBe('123');
      
      // Only empty string throws
      expect(() => PlanId.from('')).toThrow('PlanId cannot be empty');
    });
  });
});