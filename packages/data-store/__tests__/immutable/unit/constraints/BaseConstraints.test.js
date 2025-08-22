/**
 * Unit Tests for Base Constraint Framework
 * Per implementation plan Phase 2 Step 2.1
 * TDD approach - tests written first before implementation
 */

import { Constraint } from '../../../../src/immutable/constraints/Constraint.js';
import { ConstraintResult } from '../../../../src/immutable/constraints/ConstraintResult.js';
import { ConstraintViolation } from '../../../../src/immutable/constraints/ConstraintViolation.js';
import { Edge } from '../../../../src/Edge.js';
import { ImmutableStoreRoot } from '../../../../src/immutable/ImmutableStoreRoot.js';

describe('Base Constraint Framework', () => {
  let sampleEdge;
  let sampleStoreRoot;

  beforeEach(() => {
    sampleEdge = new Edge('worksAt', 'alice', 'company1');
    sampleStoreRoot = new ImmutableStoreRoot();
  });

  describe('Constraint Base Class', () => {
    test('should define abstract constraint interface', () => {
      // Abstract constraint should be constructable with basic properties
      expect(() => new Constraint('testConstraint', 'worksAt', 'Test constraint')).not.toThrow();
    });

    test('should have immutable properties', () => {
      const constraint = new Constraint('testConstraint', 'worksAt', 'Test constraint description');
      
      expect(constraint.id).toBe('testConstraint');
      expect(constraint.relationName).toBe('worksAt');
      expect(constraint.description).toBe('Test constraint description');
      expect(Object.isFrozen(constraint)).toBe(true);
    });

    test('should fail fast on invalid constructor parameters', () => {
      expect(() => new Constraint()).toThrow('Constraint id is required');
      expect(() => new Constraint('')).toThrow('Constraint id is required');
      expect(() => new Constraint('id', null)).toThrow('Relation name is required');
      expect(() => new Constraint('id', '')).toThrow('Relation name is required');
      expect(() => new Constraint('id', 'rel', null)).toThrow('Description is required');
      expect(() => new Constraint('id', 'rel', '')).toThrow('Description is required');
    });

    test('should require validate method to be implemented by subclasses', () => {
      const constraint = new Constraint('test', 'worksAt', 'Test constraint');
      
      // Base class validate should throw not implemented error
      expect(() => {
        constraint.validate(sampleStoreRoot, sampleEdge);
      }).toThrow('validate() method must be implemented by subclass');
    });

    test('should have string representation', () => {
      const constraint = new Constraint('testConstraint', 'worksAt', 'Test description');
      const str = constraint.toString();
      
      expect(str).toContain('Constraint');
      expect(str).toContain('testConstraint');
      expect(str).toContain('worksAt');
    });

    test('should support equality comparison', () => {
      const constraint1 = new Constraint('test', 'worksAt', 'Test constraint');
      const constraint2 = new Constraint('test', 'worksAt', 'Test constraint');
      const constraint3 = new Constraint('different', 'worksAt', 'Test constraint');
      
      expect(constraint1.equals(constraint2)).toBe(true);
      expect(constraint1.equals(constraint3)).toBe(false);
      expect(constraint1.equals(null)).toBe(false);
      expect(constraint1.equals({})).toBe(false);
    });
  });

  describe('ConstraintResult', () => {
    test('should create successful result', () => {
      const result = ConstraintResult.success('testConstraint');
      
      expect(result.constraintId).toBe('testConstraint');
      expect(result.isValid).toBe(true);
      expect(result.violations).toEqual([]);
      expect(Object.isFrozen(result)).toBe(true);
    });

    test('should create failure result with violations', () => {
      const violation = new ConstraintViolation('testConstraint', 'Test violation', sampleEdge);
      const result = ConstraintResult.failure('testConstraint', [violation]);
      
      expect(result.constraintId).toBe('testConstraint');
      expect(result.isValid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]).toBe(violation);
      expect(Object.isFrozen(result)).toBe(true);
    });

    test('should fail fast on invalid constructor parameters', () => {
      expect(() => new ConstraintResult()).toThrow('Constraint id is required');
      expect(() => new ConstraintResult('')).toThrow('Constraint id is required');
      expect(() => new ConstraintResult('id', true, null)).toThrow('Violations must be an array');
      expect(() => new ConstraintResult('id', true, 'not-array')).toThrow('Violations must be an array');
    });

    test('should validate violations are ConstraintViolation instances', () => {
      const validViolation = new ConstraintViolation('test', 'message', sampleEdge);
      const invalidViolation = { message: 'invalid' };
      
      // Valid violations should work
      expect(() => {
        new ConstraintResult('test', false, [validViolation]);
      }).not.toThrow();
      
      // Invalid violations should fail
      expect(() => {
        new ConstraintResult('test', false, [invalidViolation]);
      }).toThrow('All violations must be ConstraintViolation instances');
    });

    test('should have meaningful string representation', () => {
      const successResult = ConstraintResult.success('test');
      const violation = new ConstraintViolation('test', 'Test violation', sampleEdge);
      const failureResult = ConstraintResult.failure('test', [violation]);
      
      expect(successResult.toString()).toContain('ConstraintResult');
      expect(successResult.toString()).toContain('valid');
      expect(failureResult.toString()).toContain('ConstraintResult');
      expect(failureResult.toString()).toContain('invalid');
      expect(failureResult.toString()).toContain('1 violation');
    });

    test('should support combining results', () => {
      const result1 = ConstraintResult.success('test1');
      const violation = new ConstraintViolation('test2', 'Test violation', sampleEdge);
      const result2 = ConstraintResult.failure('test2', [violation]);
      
      const combined = ConstraintResult.combine([result1, result2]);
      
      expect(combined.constraintId).toBe('combined');
      expect(combined.isValid).toBe(false);
      expect(combined.violations).toHaveLength(1);
      expect(combined.violations[0]).toBe(violation);
    });
  });

  describe('ConstraintViolation', () => {
    test('should create violation with all properties', () => {
      const violation = new ConstraintViolation(
        'testConstraint',
        'Test violation message',
        sampleEdge,
        { severity: 'error', code: 'TEST_001' }
      );
      
      expect(violation.constraintId).toBe('testConstraint');
      expect(violation.message).toBe('Test violation message');
      expect(violation.edge).toBe(sampleEdge);
      expect(violation.metadata.severity).toBe('error');
      expect(violation.metadata.code).toBe('TEST_001');
      expect(Object.isFrozen(violation)).toBe(true);
    });

    test('should create violation with minimal properties', () => {
      const violation = new ConstraintViolation('test', 'message', sampleEdge);
      
      expect(violation.constraintId).toBe('test');
      expect(violation.message).toBe('message');
      expect(violation.edge).toBe(sampleEdge);
      expect(violation.metadata).toEqual({});
    });

    test('should fail fast on invalid constructor parameters', () => {
      expect(() => new ConstraintViolation()).toThrow('Constraint id is required');
      expect(() => new ConstraintViolation('')).toThrow('Constraint id is required');
      expect(() => new ConstraintViolation('id', null)).toThrow('Message is required');
      expect(() => new ConstraintViolation('id', '')).toThrow('Message is required');
      expect(() => new ConstraintViolation('id', 'msg', null)).toThrow('Edge is required');
    });

    test('should validate edge parameter', () => {
      expect(() => {
        new ConstraintViolation('test', 'message', 'not-an-edge');
      }).toThrow('Edge must be an Edge instance');
    });

    test('should have immutable metadata', () => {
      const metadata = { severity: 'warning' };
      const violation = new ConstraintViolation('test', 'message', sampleEdge, metadata);
      
      expect(Object.isFrozen(violation.metadata)).toBe(true);
      
      // Modifying original metadata should not affect violation
      metadata.severity = 'error';
      expect(violation.metadata.severity).toBe('warning');
    });

    test('should have meaningful string representation', () => {
      const violation = new ConstraintViolation('testConstraint', 'Test violation', sampleEdge);
      const str = violation.toString();
      
      expect(str).toContain('ConstraintViolation');
      expect(str).toContain('testConstraint');
      expect(str).toContain('Test violation');
    });

    test('should support equality comparison', () => {
      const violation1 = new ConstraintViolation('test', 'message', sampleEdge);
      const violation2 = new ConstraintViolation('test', 'message', sampleEdge);
      const violation3 = new ConstraintViolation('different', 'message', sampleEdge);
      
      expect(violation1.equals(violation2)).toBe(true);
      expect(violation1.equals(violation3)).toBe(false);
      expect(violation1.equals(null)).toBe(false);
    });

    test('should provide severity levels', () => {
      const errorViolation = new ConstraintViolation('test', 'error', sampleEdge, { severity: 'error' });
      const warningViolation = new ConstraintViolation('test', 'warning', sampleEdge, { severity: 'warning' });
      const infoViolation = new ConstraintViolation('test', 'info', sampleEdge, { severity: 'info' });
      
      expect(errorViolation.getSeverity()).toBe('error');
      expect(warningViolation.getSeverity()).toBe('warning');
      expect(infoViolation.getSeverity()).toBe('info');
      
      // Default severity when not specified
      const defaultViolation = new ConstraintViolation('test', 'message', sampleEdge);
      expect(defaultViolation.getSeverity()).toBe('error');
    });
  });

  describe('Constraint Framework Integration', () => {
    test('should work together in validation workflow', () => {
      // Create a concrete constraint for testing
      class TestConstraint extends Constraint {
        constructor() {
          super('testConstraint', 'worksAt', 'Test constraint for validation');
        }
        
        validate(storeRoot, edge) {
          if (edge.src === 'invalid') {
            const violation = new ConstraintViolation(
              this.id,
              'Invalid source detected',
              edge
            );
            return ConstraintResult.failure(this.id, [violation]);
          }
          return ConstraintResult.success(this.id);
        }
      }
      
      const constraint = new TestConstraint();
      const validEdge = new Edge('worksAt', 'alice', 'company1');
      const invalidEdge = new Edge('worksAt', 'invalid', 'company1');
      
      // Valid edge should pass
      const validResult = constraint.validate(sampleStoreRoot, validEdge);
      expect(validResult.isValid).toBe(true);
      expect(validResult.violations).toHaveLength(0);
      
      // Invalid edge should fail
      const invalidResult = constraint.validate(sampleStoreRoot, invalidEdge);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.violations).toHaveLength(1);
      expect(invalidResult.violations[0].message).toBe('Invalid source detected');
    });

    test('should maintain immutability throughout workflow', () => {
      class ImmutableTestConstraint extends Constraint {
        constructor() {
          super('immutableTest', 'worksAt', 'Immutability test constraint');
        }
        
        validate(storeRoot, edge) {
          return ConstraintResult.success(this.id);
        }
      }
      
      const constraint = new ImmutableTestConstraint();
      const result = constraint.validate(sampleStoreRoot, sampleEdge);
      
      // All objects should be frozen
      expect(Object.isFrozen(constraint)).toBe(true);
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.violations)).toBe(true);
    });

    test('should handle multiple violations correctly', () => {
      class MultiViolationConstraint extends Constraint {
        constructor() {
          super('multiViolation', 'worksAt', 'Multi-violation test constraint');
        }
        
        validate(storeRoot, edge) {
          const violations = [];
          
          if (edge.src.length < 3) {
            violations.push(new ConstraintViolation(
              this.id,
              'Source name too short',
              edge,
              { severity: 'warning' }
            ));
          }
          
          if (edge.dst.length < 5) {
            violations.push(new ConstraintViolation(
              this.id,
              'Destination name too short',
              edge,
              { severity: 'error' }
            ));
          }
          
          if (violations.length > 0) {
            return ConstraintResult.failure(this.id, violations);
          }
          
          return ConstraintResult.success(this.id);
        }
      }
      
      const constraint = new MultiViolationConstraint();
      const shortNamesEdge = new Edge('worksAt', 'al', 'co');
      
      const result = constraint.validate(sampleStoreRoot, shortNamesEdge);
      
      expect(result.isValid).toBe(false);
      expect(result.violations).toHaveLength(2);
      expect(result.violations[0].getSeverity()).toBe('warning');
      expect(result.violations[1].getSeverity()).toBe('error');
    });
  });

  describe('Error Handling - Fail Fast', () => {
    test('should fail fast on all invalid inputs', () => {
      // Constraint
      expect(() => new Constraint(null, 'rel', 'desc')).toThrow();
      expect(() => new Constraint('id', null, 'desc')).toThrow();
      expect(() => new Constraint('id', 'rel', null)).toThrow();
      
      // ConstraintResult
      expect(() => new ConstraintResult(null, true, [])).toThrow();
      expect(() => new ConstraintResult('id', true, null)).toThrow();
      
      // ConstraintViolation
      expect(() => new ConstraintViolation(null, 'msg', sampleEdge)).toThrow();
      expect(() => new ConstraintViolation('id', null, sampleEdge)).toThrow();
      expect(() => new ConstraintViolation('id', 'msg', null)).toThrow();
    });

    test('should provide clear error messages', () => {
      try {
        new Constraint('', 'rel', 'desc');
      } catch (error) {
        expect(error.message).toContain('Constraint id is required');
      }
      
      try {
        new ConstraintViolation('id', 'msg', 'not-edge');
      } catch (error) {
        expect(error.message).toContain('Edge must be an Edge instance');
      }
    });
  });
});