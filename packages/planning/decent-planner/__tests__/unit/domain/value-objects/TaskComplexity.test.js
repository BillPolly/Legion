/**
 * Unit tests for TaskComplexity value object
 * Pure domain logic tests with no external dependencies
 * Following Clean Architecture and TDD principles
 */

// Test functions are provided by the test runner as globals
import { TaskComplexity } from '../../../../src/domain/value-objects/TaskComplexity.js';

describe('TaskComplexity Value Object', () => {
  describe('creation', () => {
    it('should create SIMPLE complexity', () => {
      const complexity = new TaskComplexity('SIMPLE');
      expect(complexity.value).toBe('SIMPLE');
      expect(complexity.isSimple()).toBe(true);
      expect(complexity.isComplex()).toBe(false);
    });
    
    it('should create COMPLEX complexity', () => {
      const complexity = new TaskComplexity('COMPLEX');
      expect(complexity.value).toBe('COMPLEX');
      expect(complexity.isComplex()).toBe(true);
      expect(complexity.isSimple()).toBe(false);
    });
    
    it('should accept lowercase values', () => {
      const simple = new TaskComplexity('simple');
      expect(simple.value).toBe('SIMPLE');
      
      const complex = new TaskComplexity('complex');
      expect(complex.value).toBe('COMPLEX');
    });
    
    it('should throw error for invalid values', () => {
      expect(() => new TaskComplexity('INVALID')).toThrow('Invalid task complexity: INVALID');
      expect(() => new TaskComplexity('')).toThrow('Invalid task complexity');
      expect(() => new TaskComplexity(null)).toThrow('Invalid task complexity');
    });
  });
  
  describe('immutability', () => {
    it('should be immutable', () => {
      const complexity = new TaskComplexity('SIMPLE');
      
      expect(() => {
        complexity.value = 'COMPLEX';
      }).toThrow();
      
      expect(complexity.value).toBe('SIMPLE');
    });
  });
  
  describe('factory methods', () => {
    it('should create simple complexity via factory', () => {
      const simple = TaskComplexity.simple();
      expect(simple.isSimple()).toBe(true);
      expect(simple.value).toBe('SIMPLE');
    });
    
    it('should create complex complexity via factory', () => {
      const complex = TaskComplexity.complex();
      expect(complex.isComplex()).toBe(true);
      expect(complex.value).toBe('COMPLEX');
    });
  });
  
  describe('equality', () => {
    it('should correctly compare equal complexities', () => {
      const complexity1 = new TaskComplexity('SIMPLE');
      const complexity2 = new TaskComplexity('SIMPLE');
      
      expect(complexity1.equals(complexity2)).toBe(true);
    });
    
    it('should correctly compare different complexities', () => {
      const simple = new TaskComplexity('SIMPLE');
      const complex = new TaskComplexity('COMPLEX');
      
      expect(simple.equals(complex)).toBe(false);
    });
    
    it('should return false when comparing with non-TaskComplexity', () => {
      const complexity = new TaskComplexity('SIMPLE');
      
      expect(complexity.equals('SIMPLE')).toBe(false);
      expect(complexity.equals(null)).toBe(false);
      expect(complexity.equals(undefined)).toBe(false);
      expect(complexity.equals({})).toBe(false);
    });
  });
  
  describe('string representation', () => {
    it('should convert to string', () => {
      const simple = new TaskComplexity('SIMPLE');
      expect(simple.toString()).toBe('SIMPLE');
      expect(String(simple)).toBe('SIMPLE');
      
      const complex = new TaskComplexity('COMPLEX');
      expect(complex.toString()).toBe('COMPLEX');
    });
  });
  
  describe('constants', () => {
    it('should expose static constants', () => {
      expect(TaskComplexity.SIMPLE).toBe('SIMPLE');
      expect(TaskComplexity.COMPLEX).toBe('COMPLEX');
    });
  });
});