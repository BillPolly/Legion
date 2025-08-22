/**
 * Unit Tests for Constraint Registry System
 * Per implementation plan Phase 2 Step 2.2
 * TDD approach - tests written first before implementation
 */

import { ConstraintRegistry } from '../../../../src/immutable/constraints/ConstraintRegistry.js';
import { Constraint } from '../../../../src/immutable/constraints/Constraint.js';
import { ConstraintResult } from '../../../../src/immutable/constraints/ConstraintResult.js';
import { ConstraintViolation } from '../../../../src/immutable/constraints/ConstraintViolation.js';
import { Edge } from '../../../../src/Edge.js';

describe('Constraint Registry System', () => {
  let registry;
  let testConstraint1;
  let testConstraint2;
  let globalConstraint;
  let sampleEdge;

  beforeEach(() => {
    registry = new ConstraintRegistry();
    sampleEdge = new Edge('worksAt', 'alice', 'company1');

    // Create test constraints
    testConstraint1 = new TestConstraint('test1', 'worksAt', 'Test constraint 1');
    testConstraint2 = new TestConstraint('test2', 'worksAt', 'Test constraint 2');
    globalConstraint = new TestConstraint('global', '*', 'Global constraint');
  });

  describe('Constructor and Immutability', () => {
    test('should create empty immutable registry', () => {
      expect(registry).toBeDefined();
      expect(registry.getAllConstraints()).toEqual([]);
      expect(registry.getRelationNames()).toEqual([]);
      expect(registry.getConstraintCount()).toBe(0);
      
      // Should be frozen (immutable)
      expect(Object.isFrozen(registry)).toBe(true);
    });

    test('should create registry with provided constraints', () => {
      const constraints = [testConstraint1, testConstraint2];
      const constraintsByRelation = new Map([
        ['worksAt', new Set([testConstraint1, testConstraint2])]
      ]);
      
      const populatedRegistry = new ConstraintRegistry(constraints, constraintsByRelation);
      
      expect(populatedRegistry.getConstraintCount()).toBe(2);
      expect(populatedRegistry.hasConstraint('test1')).toBe(true);
      expect(populatedRegistry.hasConstraint('test2')).toBe(true);
      expect(Object.isFrozen(populatedRegistry)).toBe(true);
    });

    test('should have immutable internal collections', () => {
      const allConstraints = registry.getAllConstraints();
      const relationNames = registry.getRelationNames();
      
      expect(Object.isFrozen(allConstraints)).toBe(true);
      expect(Object.isFrozen(relationNames)).toBe(true);
    });
  });

  describe('withAddedConstraint() - Pure Function', () => {
    test('should return new registry with added constraint', () => {
      const newRegistry = registry.withAddedConstraint(testConstraint1);
      
      // Should return new instance
      expect(newRegistry).not.toBe(registry);
      expect(newRegistry).toBeInstanceOf(ConstraintRegistry);
      
      // Original registry unchanged
      expect(registry.getConstraintCount()).toBe(0);
      expect(registry.hasConstraint('test1')).toBe(false);
      
      // New registry has constraint
      expect(newRegistry.getConstraintCount()).toBe(1);
      expect(newRegistry.hasConstraint('test1')).toBe(true);
      
      // Both should be frozen
      expect(Object.isFrozen(registry)).toBe(true);
      expect(Object.isFrozen(newRegistry)).toBe(true);
    });

    test('should return same instance when adding duplicate constraint', () => {
      const registryWithConstraint = registry.withAddedConstraint(testConstraint1);
      const registryWithDuplicate = registryWithConstraint.withAddedConstraint(testConstraint1);
      
      // Should return same instance (optimization)
      expect(registryWithDuplicate).toBe(registryWithConstraint);
      expect(registryWithDuplicate.getConstraintCount()).toBe(1);
    });

    test('should handle multiple constraints correctly', () => {
      let currentRegistry = registry;
      currentRegistry = currentRegistry.withAddedConstraint(testConstraint1);
      currentRegistry = currentRegistry.withAddedConstraint(testConstraint2);
      currentRegistry = currentRegistry.withAddedConstraint(globalConstraint);
      
      expect(currentRegistry.getConstraintCount()).toBe(3);
      expect(currentRegistry.hasConstraint('test1')).toBe(true);
      expect(currentRegistry.hasConstraint('test2')).toBe(true);
      expect(currentRegistry.hasConstraint('global')).toBe(true);
    });

    test('should index constraints by relation name', () => {
      let currentRegistry = registry;
      currentRegistry = currentRegistry.withAddedConstraint(testConstraint1);
      currentRegistry = currentRegistry.withAddedConstraint(globalConstraint);
      
      // Should be able to get constraints for specific relation
      const worksAtConstraints = currentRegistry.getConstraintsForRelation('worksAt');
      expect(worksAtConstraints).toHaveLength(2); // test1 + global
      expect(worksAtConstraints).toContain(testConstraint1);
      expect(worksAtConstraints).toContain(globalConstraint);
      
      // Should get global constraints for any relation
      const unknownRelationConstraints = currentRegistry.getConstraintsForRelation('unknown');
      expect(unknownRelationConstraints).toHaveLength(1); // global only
      expect(unknownRelationConstraints).toContain(globalConstraint);
    });

    test('should fail fast on invalid constraint', () => {
      expect(() => registry.withAddedConstraint(null)).toThrow('Constraint is required');
      expect(() => registry.withAddedConstraint('not-a-constraint')).toThrow('Must be a Constraint instance');
    });
  });

  describe('withRemovedConstraint() - Pure Function', () => {
    let registryWithConstraints;

    beforeEach(() => {
      registryWithConstraints = registry
        .withAddedConstraint(testConstraint1)
        .withAddedConstraint(testConstraint2)
        .withAddedConstraint(globalConstraint);
    });

    test('should return new registry with removed constraint', () => {
      const newRegistry = registryWithConstraints.withRemovedConstraint('test1');
      
      // Should return new instance
      expect(newRegistry).not.toBe(registryWithConstraints);
      expect(newRegistry).toBeInstanceOf(ConstraintRegistry);
      
      // Original registry unchanged
      expect(registryWithConstraints.getConstraintCount()).toBe(3);
      expect(registryWithConstraints.hasConstraint('test1')).toBe(true);
      
      // New registry has constraint removed
      expect(newRegistry.getConstraintCount()).toBe(2);
      expect(newRegistry.hasConstraint('test1')).toBe(false);
      expect(newRegistry.hasConstraint('test2')).toBe(true);
      expect(newRegistry.hasConstraint('global')).toBe(true);
      
      // Both should be frozen
      expect(Object.isFrozen(registryWithConstraints)).toBe(true);
      expect(Object.isFrozen(newRegistry)).toBe(true);
    });

    test('should return same instance when removing non-existent constraint', () => {
      const result = registryWithConstraints.withRemovedConstraint('nonExistent');
      
      // Should return same instance (optimization)
      expect(result).toBe(registryWithConstraints);
    });

    test('should update relation indexing after removal', () => {
      const newRegistry = registryWithConstraints.withRemovedConstraint('test1');
      
      // worksAt relation should now only have test2 + global
      const worksAtConstraints = newRegistry.getConstraintsForRelation('worksAt');
      expect(worksAtConstraints).toHaveLength(2);
      expect(worksAtConstraints).toContain(testConstraint2);
      expect(worksAtConstraints).toContain(globalConstraint);
      expect(worksAtConstraints).not.toContain(testConstraint1);
    });

    test('should clean up empty relation sets', () => {
      // Remove all constraints for a specific relation
      let cleanRegistry = registryWithConstraints;
      cleanRegistry = cleanRegistry.withRemovedConstraint('test1');
      cleanRegistry = cleanRegistry.withRemovedConstraint('test2');
      
      // worksAt should now only have global constraint
      const worksAtConstraints = cleanRegistry.getConstraintsForRelation('worksAt');
      expect(worksAtConstraints).toHaveLength(1);
      expect(worksAtConstraints).toContain(globalConstraint);
    });

    test('should fail fast on invalid constraint id', () => {
      expect(() => registryWithConstraints.withRemovedConstraint(null)).toThrow('Constraint id is required');
      expect(() => registryWithConstraints.withRemovedConstraint('')).toThrow('Constraint id is required');
    });
  });

  describe('Read-only Accessors', () => {
    let populatedRegistry;

    beforeEach(() => {
      populatedRegistry = registry
        .withAddedConstraint(testConstraint1)
        .withAddedConstraint(testConstraint2)
        .withAddedConstraint(globalConstraint);
    });

    test('should provide constraint access methods', () => {
      expect(populatedRegistry.getConstraintCount()).toBe(3);
      expect(populatedRegistry.hasConstraint('test1')).toBe(true);
      expect(populatedRegistry.hasConstraint('nonExistent')).toBe(false);
      
      const constraint = populatedRegistry.getConstraint('test1');
      expect(constraint).toBe(testConstraint1);
      expect(populatedRegistry.getConstraint('nonExistent')).toBe(null);
    });

    test('should provide relation-specific constraint access', () => {
      const worksAtConstraints = populatedRegistry.getConstraintsForRelation('worksAt');
      expect(worksAtConstraints).toHaveLength(3); // test1, test2, global
      
      const unknownConstraints = populatedRegistry.getConstraintsForRelation('unknown');
      expect(unknownConstraints).toHaveLength(1); // global only
      
      const emptyConstraints = populatedRegistry.getConstraintsForRelation('');
      expect(emptyConstraints).toHaveLength(1); // global only
    });

    test('should provide collection methods', () => {
      const allConstraints = populatedRegistry.getAllConstraints();
      expect(allConstraints).toHaveLength(3);
      expect(allConstraints).toContain(testConstraint1);
      expect(allConstraints).toContain(testConstraint2);
      expect(allConstraints).toContain(globalConstraint);
      
      const relationNames = populatedRegistry.getRelationNames();
      expect(relationNames).toEqual(expect.arrayContaining(['worksAt', '*']));
    });

    test('should handle global constraints correctly', () => {
      // Global constraints should apply to all relations
      expect(populatedRegistry.hasGlobalConstraints()).toBe(true);
      
      const globalConstraints = populatedRegistry.getGlobalConstraints();
      expect(globalConstraints).toHaveLength(1);
      expect(globalConstraints).toContain(globalConstraint);
      
      // Test with registry without global constraints
      const specificRegistry = registry.withAddedConstraint(testConstraint1);
      expect(specificRegistry.hasGlobalConstraints()).toBe(false);
      expect(specificRegistry.getGlobalConstraints()).toHaveLength(0);
    });
  });

  describe('Constraint Validation Integration', () => {
    let populatedRegistry;

    beforeEach(() => {
      populatedRegistry = registry
        .withAddedConstraint(testConstraint1)
        .withAddedConstraint(testConstraint2)
        .withAddedConstraint(globalConstraint);
    });

    test('should validate edge against all applicable constraints', () => {
      const results = populatedRegistry.validateEdge(null, sampleEdge);
      
      expect(results).toHaveLength(3); // All constraints should apply to worksAt
      expect(results.every(result => result instanceof ConstraintResult)).toBe(true);
      expect(results.every(result => result.isValid)).toBe(true);
    });

    test('should include global constraints in validation', () => {
      const edge = new Edge('otherRelation', 'alice', 'company1');
      const results = populatedRegistry.validateEdge(null, edge);
      
      expect(results).toHaveLength(1); // Only global constraint should apply
      expect(results[0].constraintId).toBe('global');
    });

    test('should handle validation failures correctly', () => {
      // Create a failing constraint
      class FailingConstraint extends Constraint {
        constructor() {
          super('failing', 'worksAt', 'Always fails');
        }
        
        validate(storeRoot, edge) {
          const violation = new ConstraintViolation(this.id, 'Always fails', edge);
          return ConstraintResult.failure(this.id, [violation]);
        }
      }
      
      const failingConstraint = new FailingConstraint();
      const registryWithFailure = populatedRegistry.withAddedConstraint(failingConstraint);
      
      const results = registryWithFailure.validateEdge(null, sampleEdge);
      
      expect(results).toHaveLength(4); // 3 passing + 1 failing
      const failingResult = results.find(r => r.constraintId === 'failing');
      expect(failingResult.isValid).toBe(false);
      expect(failingResult.violations).toHaveLength(1);
    });

    test('should return empty array for relations with no constraints', () => {
      const emptyRegistry = new ConstraintRegistry();
      const results = emptyRegistry.validateEdge(null, sampleEdge);
      
      expect(results).toEqual([]);
    });
  });

  describe('Statistics and Introspection', () => {
    let populatedRegistry;

    beforeEach(() => {
      populatedRegistry = registry
        .withAddedConstraint(testConstraint1)
        .withAddedConstraint(testConstraint2)
        .withAddedConstraint(globalConstraint);
    });

    test('should provide comprehensive statistics', () => {
      const stats = populatedRegistry.getStatistics();
      
      expect(stats).toHaveProperty('totalConstraints', 3);
      expect(stats).toHaveProperty('globalConstraints', 1);
      expect(stats).toHaveProperty('relationCount', 2); // worksAt + *
      expect(stats).toHaveProperty('constraintsByRelation');
      expect(stats.constraintsByRelation).toHaveProperty('worksAt', 2); // test1, test2
      expect(stats.constraintsByRelation).toHaveProperty('*', 1); // global
    });

    test('should validate registry structure', () => {
      const issues = populatedRegistry.validateStructure();
      expect(Array.isArray(issues)).toBe(true);
      
      // For a properly constructed registry, issues should be empty
      if (issues.length > 0) {
        console.log('Validation issues:', issues);
      }
    });

    test('should provide meaningful string representation', () => {
      const str = populatedRegistry.toString();
      expect(str).toContain('ConstraintRegistry');
      expect(str).toContain('3 constraints');
    });
  });

  describe('Error Handling - Fail Fast', () => {
    test('should fail fast on invalid constructor parameters', () => {
      expect(() => new ConstraintRegistry('not-array')).toThrow('Constraints must be an array');
      expect(() => new ConstraintRegistry(['not-constraint'])).toThrow('All constraints must be Constraint instances');
      expect(() => new ConstraintRegistry([], 'not-map')).toThrow('Constraints by relation must be a Map');
    });

    test('should fail fast on invalid operations', () => {
      expect(() => registry.withAddedConstraint(null)).toThrow('Constraint is required');
      expect(() => registry.withRemovedConstraint(null)).toThrow('Constraint id is required');
      expect(() => registry.getConstraint(null)).toThrow('Constraint id is required');
      expect(() => registry.getConstraintsForRelation(null)).toThrow('Relation name is required');
    });

    test('should provide clear error messages', () => {
      try {
        registry.withAddedConstraint('not-constraint');
      } catch (error) {
        expect(error.message).toContain('Must be a Constraint instance');
      }
      
      try {
        registry.getConstraintsForRelation(null);
      } catch (error) {
        expect(error.message).toContain('Relation name is required');
      }
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty registry correctly', () => {
      expect(registry.getAllConstraints()).toEqual([]);
      expect(registry.getRelationNames()).toEqual([]);
      expect(registry.getConstraintCount()).toBe(0);
      expect(registry.hasGlobalConstraints()).toBe(false);
      expect(registry.getGlobalConstraints()).toEqual([]);
    });

    test('should handle constraint ID conflicts', () => {
      const constraint1 = new TestConstraint('duplicate', 'worksAt', 'First constraint');
      const constraint2 = new TestConstraint('duplicate', 'worksAt', 'Second constraint');
      
      const registryWithFirst = registry.withAddedConstraint(constraint1);
      const registryWithSecond = registryWithFirst.withAddedConstraint(constraint2);
      
      // Second constraint should replace first (same ID) - new instance returned
      expect(registryWithSecond).not.toBe(registryWithFirst);
      expect(registryWithSecond.getConstraintCount()).toBe(1);
      
      // Should contain the second constraint, not the first
      const storedConstraint = registryWithSecond.getConstraint('duplicate');
      expect(storedConstraint.description).toBe('Second constraint');
    });

    test('should handle complex relation names', () => {
      const complexConstraint = new TestConstraint('complex', 'has:property:with:colons', 'Complex relation');
      const registryWithComplex = registry.withAddedConstraint(complexConstraint);
      
      expect(registryWithComplex.hasConstraint('complex')).toBe(true);
      const constraints = registryWithComplex.getConstraintsForRelation('has:property:with:colons');
      expect(constraints).toContain(complexConstraint);
    });
  });
});

// Helper class for testing
class TestConstraint extends Constraint {
  constructor(id, relationName, description) {
    super(id, relationName, description);
  }
  
  validate(storeRoot, edge) {
    return ConstraintResult.success(this.id);
  }
}