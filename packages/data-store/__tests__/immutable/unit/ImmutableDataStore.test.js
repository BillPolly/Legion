/**
 * Unit Tests for ImmutableDataStore
 * Per implementation plan Phase 3 Step 3.1
 * TDD approach - tests written first before implementation
 */

import { ImmutableDataStore } from '../../../src/immutable/ImmutableDataStore.js';
import { ImmutableStoreRoot } from '../../../src/immutable/ImmutableStoreRoot.js';
import { ConstraintRegistry } from '../../../src/immutable/constraints/ConstraintRegistry.js';
import { ConstraintValidator } from '../../../src/immutable/constraints/ConstraintValidator.js';
import { CardinalityConstraint } from '../../../src/immutable/constraints/CardinalityConstraint.js';
import { EntityTypeConstraint } from '../../../src/immutable/constraints/EntityTypeConstraint.js';
import { CustomConstraint } from '../../../src/immutable/constraints/CustomConstraint.js';
import { ConstraintResult } from '../../../src/immutable/constraints/ConstraintResult.js';
import { ConstraintViolation } from '../../../src/immutable/constraints/ConstraintViolation.js';
import { Edge } from '../../../src/Edge.js';
import { RelationshipType } from '../../../src/RelationshipType.js';

describe('ImmutableDataStore', () => {
  let store;

  beforeEach(() => {
    store = new ImmutableDataStore();
  });

  describe('Constructor and Initialization', () => {
    test('should create empty immutable store', () => {
      expect(store).toBeInstanceOf(ImmutableDataStore);
      expect(store.getEdgeCount()).toBe(0);
      expect(store.getRelationshipTypes().size).toBe(0);
      expect(store.getConstraintCount()).toBe(0);
      expect(Object.isFrozen(store)).toBe(true);
    });

    test('should create store with initial configuration', () => {
      const config = {
        constraints: [
          new CardinalityConstraint('c1', 'worksAt', 'source', 0, 5)
        ],
        relationshipTypes: [
          new RelationshipType('worksAt', 'employs')
        ]
      };
      
      const configuredStore = new ImmutableDataStore(config);
      
      expect(configuredStore.getConstraintCount()).toBe(1);
      expect(configuredStore.getRelationshipTypes().size).toBe(1);
      expect(configuredStore.hasRelationType('worksAt')).toBe(true);
    });

    test('should fail fast on invalid configuration', () => {
      expect(() => new ImmutableDataStore({ constraints: 'not-array' }))
        .toThrow('Constraints must be an array');
      
      expect(() => new ImmutableDataStore({ relationshipTypes: 'not-array' }))
        .toThrow('Relationship types must be an array');
      
      expect(() => new ImmutableDataStore({ constraints: ['not-constraint'] }))
        .toThrow('All constraints must be Constraint instances');
    });
  });

  describe('addEdge() with Constraint Validation', () => {
    test('should add edge when no constraints exist', () => {
      const edge = new Edge('worksAt', 'alice', 'company1');
      const newStore = store.addEdge(edge);
      
      expect(newStore).not.toBe(store); // New instance
      expect(newStore.hasEdge(edge)).toBe(true);
      expect(newStore.getEdgeCount()).toBe(1);
      expect(store.getEdgeCount()).toBe(0); // Original unchanged
    });

    test('should add edge when constraints pass', () => {
      // Create store with constraint
      const constraint = new CardinalityConstraint('c1', 'worksAt', 'source', 0, 2);
      const storeWithConstraint = store.addConstraint(constraint);
      
      // Add first edge - should pass
      const edge1 = new Edge('worksAt', 'alice', 'company1');
      const store1 = storeWithConstraint.addEdge(edge1);
      
      expect(store1.hasEdge(edge1)).toBe(true);
      expect(store1.getEdgeCount()).toBe(1);
      
      // Add second edge - should pass (under limit)
      const edge2 = new Edge('worksAt', 'alice', 'company2');
      const store2 = store1.addEdge(edge2);
      
      expect(store2.hasEdge(edge2)).toBe(true);
      expect(store2.getEdgeCount()).toBe(2);
    });

    test('should throw when constraints fail', () => {
      // Create store with constraint (max 1)
      const constraint = new CardinalityConstraint('c1', 'worksAt', 'source', 0, 1);
      const storeWithConstraint = store.addConstraint(constraint);
      
      // Add first edge - should pass
      const edge1 = new Edge('worksAt', 'alice', 'company1');
      const store1 = storeWithConstraint.addEdge(edge1);
      
      // Try to add second edge - should fail
      const edge2 = new Edge('worksAt', 'alice', 'company2');
      
      expect(() => store1.addEdge(edge2))
        .toThrow('Constraint validation failed');
    });

    test('should validate against multiple constraints', () => {
      // Add multiple constraints
      const cardConstraint = new CardinalityConstraint('c1', 'worksAt', 'source', 0, 5);
      const typeConstraint = new EntityTypeConstraint('c2', 'worksAt', { source: 'Person' });
      
      const storeWithConstraints = store
        .addConstraint(cardConstraint)
        .addConstraint(typeConstraint)
        .withEntityType('alice', 'Person')
        .withEntityType('company1', 'Company');
      
      // Valid edge - passes both constraints
      const validEdge = new Edge('worksAt', 'alice', 'company1');
      const newStore = storeWithConstraints.addEdge(validEdge);
      
      expect(newStore.hasEdge(validEdge)).toBe(true);
      
      // Invalid edge - wrong entity type
      const invalidEdge = new Edge('worksAt', 'company1', 'alice');
      
      expect(() => storeWithConstraints.addEdge(invalidEdge))
        .toThrow('Constraint validation failed');
    });

    test('should maintain immutability on constraint failure', () => {
      const constraint = new CardinalityConstraint('c1', 'worksAt', 'source', 0, 0);
      const storeWithConstraint = store.addConstraint(constraint);
      
      const edge = new Edge('worksAt', 'alice', 'company1');
      
      try {
        storeWithConstraint.addEdge(edge);
      } catch (e) {
        // Expected to fail
      }
      
      // Store should remain unchanged
      expect(storeWithConstraint.getEdgeCount()).toBe(0);
      expect(storeWithConstraint.hasEdge(edge)).toBe(false);
    });

    test('should fail fast on invalid edge', () => {
      expect(() => store.addEdge(null))
        .toThrow('Edge is required');
      
      expect(() => store.addEdge('not-edge'))
        .toThrow('Edge must be an Edge instance');
    });
  });

  describe('removeEdge() with Constraint Validation', () => {
    let storeWithEdges;

    beforeEach(() => {
      const edge1 = new Edge('worksAt', 'alice', 'company1');
      const edge2 = new Edge('worksAt', 'alice', 'company2');
      const edge3 = new Edge('worksAt', 'bob', 'company1');
      
      storeWithEdges = store
        .addEdge(edge1)
        .addEdge(edge2)
        .addEdge(edge3);
    });

    test('should remove edge when no constraints exist', () => {
      const edge = new Edge('worksAt', 'alice', 'company1');
      const newStore = storeWithEdges.removeEdge(edge);
      
      expect(newStore).not.toBe(storeWithEdges);
      expect(newStore.hasEdge(edge)).toBe(false);
      expect(newStore.getEdgeCount()).toBe(2);
      expect(storeWithEdges.getEdgeCount()).toBe(3); // Original unchanged
    });

    test('should remove edge when constraints pass', () => {
      // Add min cardinality constraint (min 1)
      const constraint = new CardinalityConstraint('c1', 'worksAt', 'source', 1, null);
      const storeWithConstraint = storeWithEdges.addConstraint(constraint);
      
      // Alice has 2 edges, removing 1 leaves 1 (meets min)
      const edge = new Edge('worksAt', 'alice', 'company2');
      const newStore = storeWithConstraint.removeEdge(edge);
      
      expect(newStore.hasEdge(edge)).toBe(false);
      expect(newStore.getEdgeCount()).toBe(2);
    });

    test('should throw when removal violates min cardinality', () => {
      // Add min cardinality constraint (min 2)
      const constraint = new CardinalityConstraint('c1', 'worksAt', 'source', 2, null);
      const storeWithConstraint = storeWithEdges.addConstraint(constraint);
      
      // Alice has 2 edges, removing 1 would leave 1 (violates min 2)
      const edge = new Edge('worksAt', 'alice', 'company1');
      
      expect(() => storeWithConstraint.removeEdge(edge))
        .toThrow('Constraint validation failed');
    });

    test('should return same instance when edge does not exist', () => {
      const nonExistentEdge = new Edge('worksAt', 'charlie', 'company3');
      const newStore = storeWithEdges.removeEdge(nonExistentEdge);
      
      expect(newStore).toBe(storeWithEdges); // Same instance
    });

    test('should fail fast on invalid edge', () => {
      expect(() => storeWithEdges.removeEdge(null))
        .toThrow('Edge is required');
      
      expect(() => storeWithEdges.removeEdge('not-edge'))
        .toThrow('Edge must be an Edge instance');
    });
  });

  describe('defineRelationType() with Constraints', () => {
    test('should add relationship type to store', () => {
      const relType = new RelationshipType('worksAt', 'employs');
      const newStore = store.defineRelationType(relType);
      
      expect(newStore).not.toBe(store);
      expect(newStore.hasRelationType('worksAt')).toBe(true);
      expect(newStore.getRelationshipTypes().size).toBe(1);
    });

    test('should add relationship type with associated constraints', () => {
      const relType = new RelationshipType('worksAt', 'employs');
      const constraints = [
        new CardinalityConstraint('c1', 'worksAt', 'source', 0, 5),
        new EntityTypeConstraint('c2', 'worksAt', { source: 'Person', target: 'Company' })
      ];
      
      const newStore = store.defineRelationType(relType, constraints);
      
      expect(newStore.hasRelationType('worksAt')).toBe(true);
      expect(newStore.getConstraintCount()).toBe(2);
      expect(newStore.getConstraintsForRelation('worksAt')).toHaveLength(2);
    });

    test('should return same instance when type already exists', () => {
      const relType = new RelationshipType('worksAt', 'employs');
      const store1 = store.defineRelationType(relType);
      const store2 = store1.defineRelationType(relType);
      
      expect(store2).toBe(store1); // Same instance
    });

    test('should fail fast on invalid parameters', () => {
      expect(() => store.defineRelationType(null))
        .toThrow('RelationshipType is required');
      
      expect(() => store.defineRelationType('not-reltype'))
        .toThrow('RelationshipType must be a RelationshipType instance');
      
      const relType = new RelationshipType('worksAt', 'employs');
      expect(() => store.defineRelationType(relType, 'not-array'))
        .toThrow('Constraints must be an array');
    });
  });

  describe('addConstraint() Method', () => {
    test('should add constraint to store', () => {
      const constraint = new CardinalityConstraint('c1', 'worksAt', 'source', 0, 5);
      const newStore = store.addConstraint(constraint);
      
      expect(newStore).not.toBe(store);
      expect(newStore.getConstraintCount()).toBe(1);
      expect(newStore.getConstraint('c1')).toBe(constraint);
    });

    test('should replace constraint with same ID', () => {
      const constraint1 = new CardinalityConstraint('c1', 'worksAt', 'source', 0, 5);
      const constraint2 = new CardinalityConstraint('c1', 'worksAt', 'source', 0, 10);
      
      const store1 = store.addConstraint(constraint1);
      const store2 = store1.addConstraint(constraint2);
      
      expect(store2.getConstraintCount()).toBe(1);
      expect(store2.getConstraint('c1')).toBe(constraint2);
    });

    test('should fail fast on invalid constraint', () => {
      expect(() => store.addConstraint(null))
        .toThrow('Constraint is required');
      
      expect(() => store.addConstraint('not-constraint'))
        .toThrow('Constraint must be a Constraint instance');
    });
  });

  describe('Read-only Accessors', () => {
    let populatedStore;

    beforeEach(() => {
      const relType = new RelationshipType('worksAt', 'employs');
      const constraint = new CardinalityConstraint('c1', 'worksAt', 'source', 0, 5);
      const edge1 = new Edge('worksAt', 'alice', 'company1');
      const edge2 = new Edge('worksAt', 'bob', 'company1');
      
      populatedStore = store
        .defineRelationType(relType)
        .addConstraint(constraint)
        .addEdge(edge1)
        .addEdge(edge2);
    });

    test('should provide edge access methods', () => {
      expect(populatedStore.getEdgeCount()).toBe(2);
      expect(populatedStore.hasEdge(new Edge('worksAt', 'alice', 'company1'))).toBe(true);
      expect(populatedStore.hasEdge(new Edge('worksAt', 'charlie', 'company1'))).toBe(false);
      
      const edges = populatedStore.getEdges();
      expect(edges.size).toBe(2);
    });

    test('should provide relationship type access methods', () => {
      expect(populatedStore.hasRelationType('worksAt')).toBe(true);
      expect(populatedStore.hasRelationType('manages')).toBe(false);
      
      const types = populatedStore.getRelationshipTypes();
      expect(types.size).toBe(1);
    });

    test('should provide constraint access methods', () => {
      expect(populatedStore.getConstraintCount()).toBe(1);
      expect(populatedStore.getConstraint('c1')).toBeDefined();
      expect(populatedStore.getConstraint('c2')).toBeUndefined();
      
      const constraints = populatedStore.getConstraintsForRelation('worksAt');
      expect(constraints).toHaveLength(1);
    });

    test('should provide edge query methods', () => {
      const edgesBySource = populatedStore.getEdgesBySource('alice');
      expect(Array.from(edgesBySource)).toHaveLength(1);
      
      const edgesByDest = populatedStore.getEdgesByDestination('company1');
      expect(Array.from(edgesByDest)).toHaveLength(2);
      
      const edgesByType = populatedStore.getEdgesByType('worksAt');
      expect(Array.from(edgesByType)).toHaveLength(2);
    });

    test('should return immutable collections', () => {
      const edges = populatedStore.getEdges();
      expect(() => edges.set('key', 'value'))
        .toThrow('Cannot set on immutable Map');
      
      const edgesBySource = populatedStore.getEdgesBySource('alice');
      expect(() => edgesBySource.push('something'))
        .toThrow();
    });
  });

  describe('Entity Type Support', () => {
    test('should add entity type metadata', () => {
      const newStore = store
        .withEntityType('alice', 'Person')
        .withEntityType('company1', 'Company');
      
      const metadata = newStore.getEntityMetadata('alice');
      expect(metadata?.type).toBe('Person');
      
      const metadata2 = newStore.getEntityMetadata('company1');
      expect(metadata2?.type).toBe('Company');
    });

    test('should preserve entity types across operations', () => {
      const storeWithTypes = store
        .withEntityType('alice', 'Person')
        .withEntityType('company1', 'Company');
      
      // Add edge
      const edge = new Edge('worksAt', 'alice', 'company1');
      const newStore = storeWithTypes.addEdge(edge);
      
      // Entity types should be preserved
      expect(newStore.getEntityMetadata('alice')?.type).toBe('Person');
      expect(newStore.getEntityMetadata('company1')?.type).toBe('Company');
      
      // Remove edge
      const afterRemove = newStore.removeEdge(edge);
      
      // Entity types should still be preserved
      expect(afterRemove.getEntityMetadata('alice')?.type).toBe('Person');
      expect(afterRemove.getEntityMetadata('company1')?.type).toBe('Company');
    });
  });

  describe('String Representation and Debugging', () => {
    test('should provide meaningful string representation', () => {
      const relType = new RelationshipType('worksAt', 'employs');
      const constraint = new CardinalityConstraint('c1', 'worksAt', 'source', 0, 5);
      const edge = new Edge('worksAt', 'alice', 'company1');
      
      const populatedStore = store
        .defineRelationType(relType)
        .addConstraint(constraint)
        .addEdge(edge);
      
      const str = populatedStore.toString();
      
      expect(str).toContain('ImmutableDataStore');
      expect(str).toContain('edges: 1');
      expect(str).toContain('relationshipTypes: 1');
      expect(str).toContain('constraints: 1');
    });

    test('should provide store statistics', () => {
      const stats = store.getStatistics();
      
      expect(stats).toHaveProperty('edgeCount');
      expect(stats).toHaveProperty('relationshipTypeCount');
      expect(stats).toHaveProperty('constraintCount');
      expect(stats).toHaveProperty('version');
      expect(stats.edgeCount).toBe(0);
    });
  });
});