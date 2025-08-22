/**
 * Unit Tests for ImmutableDataStore Constraint Management API
 * Per implementation plan Phase 3 Step 3.3
 * TDD approach - tests written first before implementation
 */

import { ImmutableDataStore } from '../../../src/immutable/ImmutableDataStore.js';
import { CardinalityConstraint } from '../../../src/immutable/constraints/CardinalityConstraint.js';
import { EntityTypeConstraint } from '../../../src/immutable/constraints/EntityTypeConstraint.js';
import { CustomConstraint } from '../../../src/immutable/constraints/CustomConstraint.js';
import { ConstraintResult } from '../../../src/immutable/constraints/ConstraintResult.js';
import { ConstraintViolation } from '../../../src/immutable/constraints/ConstraintViolation.js';
import { Edge } from '../../../src/Edge.js';
import { RelationshipType } from '../../../src/RelationshipType.js';

describe('ImmutableDataStore Constraint Management API', () => {
  let store;

  beforeEach(() => {
    store = new ImmutableDataStore();
  });

  describe('validateCurrentState() Method', () => {
    test('should validate empty store as valid', () => {
      const result = store.validateCurrentState();
      
      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.summary).toBeDefined();
      expect(result.summary.edgesValidated).toBe(0);
      expect(result.summary.constraintsChecked).toBe(0);
    });

    test('should validate store with edges and no constraints', () => {
      const storeWithEdges = store
        .addEdge(new Edge('worksAt', 'alice', 'company1'))
        .addEdge(new Edge('worksAt', 'bob', 'company1'))
        .addEdge(new Edge('manages', 'alice', 'bob'));
      
      const result = storeWithEdges.validateCurrentState();
      
      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.summary.edgesValidated).toBe(3);
      expect(result.summary.constraintsChecked).toBe(0);
    });

    test('should detect violations in current state', () => {
      // Create store with edges
      const storeWithEdges = store
        .addEdge(new Edge('worksAt', 'alice', 'company1'))
        .addEdge(new Edge('worksAt', 'alice', 'company2'))
        .addEdge(new Edge('worksAt', 'alice', 'company3'));
      
      // Now add constraint that limits to 2 (current state has 3)
      const constrainedStore = storeWithEdges.addConstraint(
        new CardinalityConstraint('c1', 'worksAt', 'source', 0, 2)
      );
      
      const result = constrainedStore.validateCurrentState();
      
      expect(result.isValid).toBe(false);
      expect(result.violations).toHaveLength(3); // One violation per edge
      expect(result.violations[0].edge).toBeDefined();
      expect(result.violations[0].constraintId).toBe('c1');
      expect(result.summary.edgesValidated).toBe(3);
      expect(result.summary.constraintsChecked).toBeGreaterThan(0);
    });

    test('should validate with entity type constraints', () => {
      const typedStore = store
        .withEntityType('alice', 'Person')
        .withEntityType('bob', 'Manager')
        .withEntityType('company1', 'Company')
        .addConstraint(new EntityTypeConstraint('c1', 'worksAt', { source: 'Person', target: 'Company' }))
        .addConstraint(new EntityTypeConstraint('c2', 'manages', { source: 'Manager' }));
      
      const storeWithEdges = typedStore
        .addEdge(new Edge('worksAt', 'alice', 'company1')) // Valid
        .addEdge(new Edge('manages', 'bob', 'alice')); // Valid (Manager -> any)
      
      const result = storeWithEdges.validateCurrentState();
      
      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test('should provide detailed validation summary', () => {
      const complexStore = store
        .addConstraint(new CardinalityConstraint('c1', 'worksAt', 'source', 0, 5))
        .addConstraint(new CardinalityConstraint('c2', 'manages', 'source', 0, 10))
        .addEdge(new Edge('worksAt', 'alice', 'company1'))
        .addEdge(new Edge('worksAt', 'bob', 'company1'))
        .addEdge(new Edge('manages', 'alice', 'bob'));
      
      const result = complexStore.validateCurrentState();
      
      expect(result.summary).toEqual({
        edgesValidated: 3,
        constraintsChecked: expect.any(Number),
        violationsFound: 0,
        validationTime: expect.any(Number)
      });
    });
  });

  describe('testOperation() Method', () => {
    test('should test edge addition without applying', () => {
      const edge = new Edge('worksAt', 'alice', 'company1');
      const result = store.testOperation('addEdge', edge);
      
      expect(result.wouldSucceed).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.simulatedState).toBeDefined();
      
      // Original store unchanged
      expect(store.hasEdge(edge)).toBe(false);
    });

    test('should test edge removal without applying', () => {
      const edge = new Edge('worksAt', 'alice', 'company1');
      const storeWithEdge = store.addEdge(edge);
      
      const result = storeWithEdge.testOperation('removeEdge', edge);
      
      expect(result.wouldSucceed).toBe(true);
      expect(result.violations).toHaveLength(0);
      
      // Original store unchanged
      expect(storeWithEdge.hasEdge(edge)).toBe(true);
    });

    test('should detect constraint violations in test', () => {
      const constrainedStore = store.addConstraint(
        new CardinalityConstraint('c1', 'worksAt', 'source', 0, 1)
      );
      
      const edge1 = new Edge('worksAt', 'alice', 'company1');
      const edge2 = new Edge('worksAt', 'alice', 'company2');
      
      // First edge should succeed
      const result1 = constrainedStore.testOperation('addEdge', edge1);
      expect(result1.wouldSucceed).toBe(true);
      
      // Add first edge for real
      const storeWithEdge = constrainedStore.addEdge(edge1);
      
      // Test second edge - should fail
      const result2 = storeWithEdge.testOperation('addEdge', edge2);
      
      expect(result2.wouldSucceed).toBe(false);
      expect(result2.violations).toHaveLength(1);
      expect(result2.violations[0].constraintId).toBe('c1');
      
      // Store remains unchanged
      expect(storeWithEdge.hasEdge(edge2)).toBe(false);
    });

    test('should test constraint addition', () => {
      const storeWithEdges = store
        .addEdge(new Edge('worksAt', 'alice', 'company1'))
        .addEdge(new Edge('worksAt', 'alice', 'company2'))
        .addEdge(new Edge('worksAt', 'alice', 'company3'));
      
      // Test adding constraint that would make current state invalid
      const constraint = new CardinalityConstraint('c1', 'worksAt', 'source', 0, 2);
      const result = storeWithEdges.testOperation('addConstraint', constraint);
      
      expect(result.wouldSucceed).toBe(true); // Adding constraint succeeds
      expect(result.currentStateValidation).toBeDefined();
      expect(result.currentStateValidation.isValid).toBe(false); // But state would be invalid
      expect(result.currentStateValidation.violations).toHaveLength(3);
      
      // Constraint not actually added
      expect(storeWithEdges.getConstraintCount()).toBe(0);
    });

    test('should test relationship type definition', () => {
      const relType = new RelationshipType('worksAt', 'employs');
      const constraints = [
        new CardinalityConstraint('c1', 'worksAt', 'source', 0, 5)
      ];
      
      const result = store.testOperation('defineRelationType', { relType, constraints });
      
      expect(result.wouldSucceed).toBe(true);
      expect(result.simulatedState.hasRelationType('worksAt')).toBe(true);
      expect(result.simulatedState.getConstraintCount()).toBe(1);
      
      // Original unchanged
      expect(store.hasRelationType('worksAt')).toBe(false);
    });

    test('should handle invalid operation types', () => {
      const result = store.testOperation('invalidOp', {});
      
      expect(result.wouldSucceed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].message).toContain('Unknown operation type: invalidOp');
    });

    test('should test removal with min cardinality constraints', () => {
      const constraint = new CardinalityConstraint('c1', 'worksAt', 'source', 2, null);
      const edge1 = new Edge('worksAt', 'alice', 'company1');
      const edge2 = new Edge('worksAt', 'alice', 'company2');
      
      const storeWithConstraintAndEdges = store
        .addConstraint(constraint)
        .addEdge(edge1)
        .addEdge(edge2);
      
      // Test removing one edge - should fail (would violate min of 2)
      const result = storeWithConstraintAndEdges.testOperation('removeEdge', edge1);
      
      expect(result.wouldSucceed).toBe(false);
      expect(result.violations[0].message).toContain('minimum cardinality');
    });
  });

  describe('removeConstraint() Method', () => {
    test('should remove constraint from store', () => {
      const constraint = new CardinalityConstraint('c1', 'worksAt', 'source', 0, 5);
      const storeWithConstraint = store.addConstraint(constraint);
      
      expect(storeWithConstraint.getConstraintCount()).toBe(1);
      
      const newStore = storeWithConstraint.removeConstraint('c1');
      
      expect(newStore).not.toBe(storeWithConstraint);
      expect(newStore.getConstraintCount()).toBe(0);
      expect(newStore.getConstraint('c1')).toBeUndefined();
    });

    test('should return same instance if constraint does not exist', () => {
      const newStore = store.removeConstraint('nonexistent');
      
      expect(newStore).toBe(store); // Same instance
    });

    test('should allow operations that were previously blocked', () => {
      const constraint = new CardinalityConstraint('c1', 'worksAt', 'source', 0, 1);
      const edge1 = new Edge('worksAt', 'alice', 'company1');
      const edge2 = new Edge('worksAt', 'alice', 'company2');
      
      const constrainedStore = store
        .addConstraint(constraint)
        .addEdge(edge1);
      
      // Second edge should fail with constraint
      expect(() => constrainedStore.addEdge(edge2))
        .toThrow('Constraint validation failed');
      
      // Remove constraint
      const unconstrainedStore = constrainedStore.removeConstraint('c1');
      
      // Now second edge should succeed
      const finalStore = unconstrainedStore.addEdge(edge2);
      expect(finalStore.hasEdge(edge2)).toBe(true);
      expect(finalStore.getEdgeCount()).toBe(2);
    });

    test('should fail fast on invalid constraint ID', () => {
      expect(() => store.removeConstraint(null))
        .toThrow('Constraint ID is required');
      
      expect(() => store.removeConstraint(123))
        .toThrow('Constraint ID must be a string');
    });
  });

  describe('getConstraints() Method', () => {
    test('should return all constraints', () => {
      const c1 = new CardinalityConstraint('c1', 'worksAt', 'source', 0, 5);
      const c2 = new EntityTypeConstraint('c2', 'worksAt', { source: 'Person' });
      const c3 = new CustomConstraint('c3', 'manages', 'Custom', () => 
        ConstraintResult.success('c3'));
      
      const storeWithConstraints = store
        .addConstraint(c1)
        .addConstraint(c2)
        .addConstraint(c3);
      
      const constraints = storeWithConstraints.getConstraints();
      
      expect(constraints).toHaveLength(3);
      expect(constraints).toContain(c1);
      expect(constraints).toContain(c2);
      expect(constraints).toContain(c3);
    });

    test('should return empty array for store with no constraints', () => {
      const constraints = store.getConstraints();
      
      expect(constraints).toEqual([]);
    });

    test('should return immutable collection', () => {
      const c1 = new CardinalityConstraint('c1', 'worksAt', 'source', 0, 5);
      const storeWithConstraint = store.addConstraint(c1);
      
      const constraints = storeWithConstraint.getConstraints();
      
      expect(() => {
        constraints.push('something');
      }).toThrow();
    });
  });

  describe('Constraint Management Integration', () => {
    test('should work with batch operations', () => {
      const result = store.batch(batch => {
        batch.addConstraint(new CardinalityConstraint('c1', 'worksAt', 'source', 0, 2));
        batch.addEdge(new Edge('worksAt', 'alice', 'company1'));
        batch.addEdge(new Edge('worksAt', 'alice', 'company2'));
      });
      
      expect(result.getConstraintCount()).toBe(1);
      expect(result.getEdgeCount()).toBe(2);
      
      // Test that constraint is enforced
      expect(() => result.addEdge(new Edge('worksAt', 'alice', 'company3')))
        .toThrow('Constraint validation failed');
    });

    test('should validate complex scenarios', () => {
      const complexStore = store
        .withEntityType('alice', 'Person')
        .withEntityType('bob', 'Person')
        .withEntityType('charlie', 'Manager')
        .withEntityType('company1', 'Company')
        .withEntityType('company2', 'Company')
        .addConstraint(new CardinalityConstraint('c1', 'worksAt', 'source', 0, 2))
        .addConstraint(new EntityTypeConstraint('c2', 'worksAt', { source: 'Person', target: 'Company' }))
        .addConstraint(new CustomConstraint('c3', 'manages', 'Managers only', (store, edge) => {
          const sourceType = store.getEntityMetadata?.(edge.src)?.type;
          if (sourceType !== 'Manager') {
            return ConstraintResult.failure('c3', [
              new ConstraintViolation('c3', 'Only managers can manage', edge)
            ]);
          }
          return ConstraintResult.success('c3');
        }));
      
      // Valid operations
      const validStore = complexStore
        .addEdge(new Edge('worksAt', 'alice', 'company1'))
        .addEdge(new Edge('worksAt', 'bob', 'company2'))
        .addEdge(new Edge('manages', 'charlie', 'alice'));
      
      expect(validStore.getEdgeCount()).toBe(3);
      
      // Test invalid operations
      // Alice already has one worksAt edge, add two more to exceed limit of 2
      const storeWithSecondEdge = validStore.addEdge(new Edge('worksAt', 'alice', 'company2'));
      
      const testResult1 = storeWithSecondEdge.testOperation('addEdge', 
        new Edge('worksAt', 'alice', 'company3')); // Would exceed cardinality (third edge)
      expect(testResult1.wouldSucceed).toBe(false);
      
      const testResult2 = validStore.testOperation('addEdge',
        new Edge('manages', 'alice', 'bob')); // Alice is not a Manager
      expect(testResult2.wouldSucceed).toBe(false);
      
      // Validate current state
      const validation = validStore.validateCurrentState();
      expect(validation.isValid).toBe(true);
    });
  });
});