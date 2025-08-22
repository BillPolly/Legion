/**
 * End-to-End Tests for Edge Cases and Error Handling
 * Per implementation plan Phase 5 Step 5.3
 * Tests boundary conditions, invalid operations, and error scenarios
 */

import { ImmutableDataStore } from '../../../src/immutable/ImmutableDataStore.js';
import { EntityType } from '../../../src/immutable/schema/EntityType.js';
import { EntityTypeRegistry } from '../../../src/immutable/schema/EntityTypeRegistry.js';
import { CardinalityConstraint } from '../../../src/immutable/constraints/CardinalityConstraint.js';
import { EntityTypeConstraint } from '../../../src/immutable/constraints/EntityTypeConstraint.js';
import { CustomConstraint } from '../../../src/immutable/constraints/CustomConstraint.js';
import { ConstraintResult } from '../../../src/immutable/constraints/ConstraintResult.js';
import { ConstraintViolation } from '../../../src/immutable/constraints/ConstraintViolation.js';
import { ConstraintViolationError } from '../../../src/immutable/ConstraintViolationError.js';
import { Edge } from '../../../src/Edge.js';
import { RelationshipType } from '../../../src/RelationshipType.js';

describe('Edge Cases and Error Handling', () => {
  describe('Boundary Conditions', () => {
    test('should handle empty store operations', () => {
      const store = new ImmutableDataStore();
      
      // Empty store should have no edges
      expect(store.getEdgeCount()).toBe(0);
      expect(store.getEdges().size).toBe(0);
      
      // Query methods should return empty collections
      expect(store.getEdgesByType('nonexistent')).toHaveLength(0);
      expect(store.getEdgesBySource('nonexistent')).toHaveLength(0);
      expect(store.getEdgesByDestination('nonexistent')).toHaveLength(0);
      
      // Removing non-existent edge should return same instance
      const result = store.removeEdge(new Edge('test', 'a', 'b'));
      expect(result).toBe(store); // Same instance
      
      // Empty batch should return same instance
      const batchResult = store.batch(batch => {
        // No operations
      });
      expect(batchResult).toBe(store);
    });

    test('should handle maximum constraint values', () => {
      const store = new ImmutableDataStore({
        constraints: [
          new CardinalityConstraint('max-int', 'rel', 'source', 0, Number.MAX_SAFE_INTEGER)
        ]
      });
      
      // Should allow adding many edges
      let currentStore = store
        .withEntityType('source', 'Entity')
        .withEntityType('target', 'Entity');
      
      // Add 1000 edges (well below MAX_SAFE_INTEGER)
      for (let i = 0; i < 1000; i++) {
        currentStore = currentStore
          .withEntityType(`t${i}`, 'Entity')
          .addEdge(new Edge('rel', 'source', `t${i}`));
      }
      
      expect(currentStore.getEdgesBySource('source').length).toBe(1000);
    });

    test('should handle null and undefined appropriately', () => {
      const store = new ImmutableDataStore();
      
      // Edge with null/undefined should throw
      expect(() => {
        store.addEdge(new Edge(null, 'a', 'b'));
      }).toThrow('Edge type is required');
      
      expect(() => {
        store.addEdge(new Edge('type', undefined, 'b'));
      }).toThrow('Edge src is required');
      
      expect(() => {
        store.addEdge(new Edge('type', 'a', undefined));
      }).toThrow('Edge dst is required');
      
      // Entity types with null should be handled
      const store2 = store.withEntityType('entity1', null);
      // getEntityMetadata returns undefined if no metadata exists
      // We need to check if the entity type was stored
      const metadata = store2.getEntityMetadata('entity1');
      expect(metadata).toBeUndefined(); // No metadata stored for null type
    });

    test('should handle circular references in entities', () => {
      const store = new ImmutableDataStore();
      
      // Self-referential edge
      const selfStore = store
        .withEntityType('node', 'Node')
        .addEdge(new Edge('self', 'node', 'node'));
      
      expect(selfStore.getEdgeCount()).toBe(1);
      expect(selfStore.hasEdge(new Edge('self', 'node', 'node'))).toBe(true);
      
      // Circular chain
      const circularStore = store
        .withEntityType('a', 'Node')
        .withEntityType('b', 'Node')
        .withEntityType('c', 'Node')
        .addEdge(new Edge('next', 'a', 'b'))
        .addEdge(new Edge('next', 'b', 'c'))
        .addEdge(new Edge('next', 'c', 'a'));
      
      expect(circularStore.getEdgeCount()).toBe(3);
    });

    test('should handle very long strings in entity IDs and types', () => {
      const store = new ImmutableDataStore();
      
      const longId = 'x'.repeat(10000);
      const longType = 'Type' + 'X'.repeat(1000);
      
      const store2 = store
        .withEntityType(longId, longType)
        .addEdge(new Edge('rel', longId, longId));
      
      expect(store2.getEntityMetadata(longId).type).toBe(longType);
      expect(store2.hasEdge(new Edge('rel', longId, longId))).toBe(true);
    });
  });

  describe('Invalid Operations', () => {
    test('should reject invalid constraint configurations', () => {
      // Min greater than max
      expect(() => {
        new CardinalityConstraint('invalid', 'rel', 'source', 5, 3);
      }).toThrow('Max cardinality must be greater than or equal to min');
      
      // Negative cardinality
      expect(() => {
        new CardinalityConstraint('invalid', 'rel', 'source', -1, 5);
      }).toThrow('Min cardinality must be non-negative');
      
      // Invalid direction
      expect(() => {
        new CardinalityConstraint('invalid', 'rel', 'invalid', 0, 5);
      }).toThrow('Direction must be "source" or "target"');
      
      // Missing required parameters
      expect(() => {
        new EntityTypeConstraint('invalid', null, { source: 'Type' });
      }).toThrow('Relation name is required');
    });

    test('should handle constraint validation failures gracefully', () => {
      const store = new ImmutableDataStore({
        constraints: [
          new CustomConstraint('always-fail', '*', 'Always fails', (store, edge) => {
            return ConstraintResult.failure('always-fail', [
              new ConstraintViolation('always-fail', 'This always fails', edge)
            ]);
          })
        ]
      });
      
      // Any edge addition should fail
      expect(() => {
        store.addEdge(new Edge('any', 'a', 'b'));
      }).toThrow(ConstraintViolationError);
      
      // Error should have proper structure
      try {
        store.addEdge(new Edge('test', 'x', 'y'));
      } catch (error) {
        expect(error).toBeInstanceOf(ConstraintViolationError);
        expect(error.violations).toHaveLength(1);
        expect(error.violations[0].constraintId).toBe('always-fail');
        expect(error.operation).toBe('addEdge');
      }
    });

    test('should reject operations that would create invalid state', () => {
      const store = new ImmutableDataStore({
        constraints: [
          new CardinalityConstraint('exactly-two', 'rel', 'source', 2, 2)
        ]
      });
      
      const store2 = store
        .withEntityType('a', 'Entity')
        .withEntityType('b', 'Entity')
        .withEntityType('c', 'Entity');
      
      // Can't validate current state with exactly-two constraint when a has 0 edges
      // This is OK - min constraints are only checked when removing
      const validationResult = store2.validateCurrentState();
      expect(validationResult.isValid).toBe(true);
      
      // Add one edge - still valid (min only checked on removal)
      const store3 = store2.addEdge(new Edge('rel', 'a', 'b'));
      expect(store3.getEdgeCount()).toBe(1);
      
      // Add second edge - now at exactly 2
      const store4 = store3.addEdge(new Edge('rel', 'a', 'c'));
      expect(store4.getEdgeCount()).toBe(2);
      
      // Try to add third - should violate max
      expect(() => {
        store4.addEdge(new Edge('rel', 'a', 'b'));
      }).toThrow(ConstraintViolationError);
    });

    test('should handle malformed entity schemas', () => {
      // Invalid field type - EntityType doesn't validate type strings
      // It just stores them, so this won't throw
      const badType = new EntityType('Bad', {
        required: ['field'],
        types: { field: 'invalidtype' }
      });
      
      // The validation happens when we try to validate an entity
      const result = badType.validate({ field: 'value' });
      expect(result.isValid).toBe(false); // Invalid because 'invalidtype' is not a recognized type
      
      // Circular inheritance (can't actually create in our system)
      const parent = new EntityType('Parent');
      const child = parent.extend('Child');
      // Can't make parent extend child - no API for it
      
      // Missing required fields when validating
      const personType = new EntityType('Person', {
        required: ['name', 'email'],
        types: { name: 'string', email: 'string' }
      });
      
      const registry = new EntityTypeRegistry([personType]);
      const store = new ImmutableDataStore({
        entityTypeRegistry: registry,
        enableSchemaValidation: true
      });
      
      // Should throw when entity doesn't match schema
      expect(() => {
        store.withEntityType('p1', 'Person', { name: 'Alice' }); // Missing email
      }).toThrow('Entity attributes do not match schema');
    });
  });

  describe('Error Propagation and Recovery', () => {
    test('should maintain consistency after failed operations', () => {
      const store = new ImmutableDataStore({
        constraints: [
          new CardinalityConstraint('max-one', 'rel', 'source', 0, 1)
        ]
      });
      
      const store2 = store
        .withEntityType('a', 'Entity')
        .withEntityType('b', 'Entity')
        .withEntityType('c', 'Entity')
        .addEdge(new Edge('rel', 'a', 'b'));
      
      const edgeCountBefore = store2.getEdgeCount();
      
      // This should fail
      try {
        store2.addEdge(new Edge('rel', 'a', 'c'));
      } catch (error) {
        // Expected
      }
      
      // Store should be unchanged
      expect(store2.getEdgeCount()).toBe(edgeCountBefore);
      expect(store2.hasEdge(new Edge('rel', 'a', 'b'))).toBe(true);
      expect(store2.hasEdge(new Edge('rel', 'a', 'c'))).toBe(false);
    });

    test('should provide meaningful error messages', () => {
      const store = new ImmutableDataStore({
        constraints: [
          new CardinalityConstraint('team-size', 'memberOf', 'target', 2, 5)
        ]
      });
      
      const store2 = store
        .withEntityType('p1', 'Person')
        .withEntityType('team', 'Team')
        .addEdge(new Edge('memberOf', 'p1', 'team'));
      
      // Try to remove when it would violate min
      try {
        store2.removeEdge(new Edge('memberOf', 'p1', 'team'));
      } catch (error) {
        expect(error.message).toContain('Constraint validation failed');
        expect(error.violations[0].message).toContain('minimum cardinality of 2');
      }
    });

    test('should handle concurrent-like modifications correctly', () => {
      const store = new ImmutableDataStore();
      
      const store1 = store.withEntityType('a', 'Entity');
      const store2 = store.withEntityType('b', 'Entity');
      
      // Both "branches" from original store
      const store1a = store1.addEdge(new Edge('rel', 'a', 'a'));
      const store2a = store2.addEdge(new Edge('rel', 'b', 'b'));
      
      // They should be independent
      expect(store1a.hasEdge(new Edge('rel', 'a', 'a'))).toBe(true);
      expect(store1a.hasEdge(new Edge('rel', 'b', 'b'))).toBe(false);
      
      expect(store2a.hasEdge(new Edge('rel', 'a', 'a'))).toBe(false);
      expect(store2a.hasEdge(new Edge('rel', 'b', 'b'))).toBe(true);
      
      // Original should be unchanged
      expect(store.getEdgeCount()).toBe(0);
    });

    test('should handle constraint conflicts properly', () => {
      // Conflicting constraints
      const store = new ImmutableDataStore({
        constraints: [
          new CardinalityConstraint('min-three', 'rel', 'source', 3, null),
          new CardinalityConstraint('max-two', 'rel', 'source', 0, 2)
        ]
      });
      
      const store2 = store
        .withEntityType('a', 'Entity')
        .withEntityType('b', 'Entity')
        .withEntityType('c', 'Entity')
        .withEntityType('d', 'Entity');
      
      // Can add up to 2 (respects max-two)
      const store3 = store2
        .addEdge(new Edge('rel', 'a', 'b'))
        .addEdge(new Edge('rel', 'a', 'c'));
      
      // Can't add third (violates max-two)
      expect(() => {
        store3.addEdge(new Edge('rel', 'a', 'd'));
      }).toThrow(ConstraintViolationError);
      
      // Can't remove (would violate min-three once it takes effect)
      // But our min constraints only apply on removal, and here we have 2 < 3
      // So removal should fail
      expect(() => {
        store3.removeEdge(new Edge('rel', 'a', 'b'));
      }).toThrow(ConstraintViolationError);
    });
  });

  describe('Performance and Scale Edge Cases', () => {
    test('should handle deeply nested batch operations', () => {
      const store = new ImmutableDataStore();
      
      // Nested batches
      const result = store.batch(batch1 => {
        batch1.withEntityType('a', 'Entity');
        batch1.batch(batch2 => {
          batch2.withEntityType('b', 'Entity');
          batch2.batch(batch3 => {
            batch3.withEntityType('c', 'Entity');
            batch3.addEdge(new Edge('rel', 'a', 'b'));
            batch3.addEdge(new Edge('rel', 'b', 'c'));
          });
        });
      });
      
      expect(result.getEdgeCount()).toBe(2);
      expect(result.getEntityMetadata('a')).toBeDefined();
      expect(result.getEntityMetadata('b')).toBeDefined();
      expect(result.getEntityMetadata('c')).toBeDefined();
    });

    test('should handle operations near memory limits gracefully', () => {
      const store = new ImmutableDataStore();
      
      // Create a reasonably large graph (not too large to avoid memory issues in test)
      let currentStore = store;
      const nodeCount = 100;
      const edgesPerNode = 10;
      
      // Add nodes
      for (let i = 0; i < nodeCount; i++) {
        currentStore = currentStore.withEntityType(`n${i}`, 'Node');
      }
      
      // Add edges
      for (let i = 0; i < nodeCount; i++) {
        for (let j = 0; j < edgesPerNode; j++) {
          const target = (i + j + 1) % nodeCount;
          currentStore = currentStore.addEdge(new Edge('link', `n${i}`, `n${target}`));
        }
      }
      
      expect(currentStore.getEdgeCount()).toBe(nodeCount * edgesPerNode);
      
      // Should still be responsive to queries
      const sourceEdges = currentStore.getEdgesBySource('n0');
      expect(sourceEdges.length).toBe(edgesPerNode);
    });

    test('should maintain immutability even with shared references', () => {
      const store = new ImmutableDataStore();
      
      // Create an edge
      const edge = new Edge('rel', 'a', 'b');
      
      // Use same edge instance multiple times
      const store1 = store.addEdge(edge);
      const store2 = store1.removeEdge(edge);
      const store3 = store2.addEdge(edge);
      
      // Each should be independent
      expect(store.hasEdge(edge)).toBe(false);
      expect(store1.hasEdge(edge)).toBe(true);
      expect(store2.hasEdge(edge)).toBe(false);
      expect(store3.hasEdge(edge)).toBe(true);
      
      // Edge itself should be immutable
      expect(Object.isFrozen(edge)).toBe(true);
    });
  });

  describe('Special Character and Encoding Edge Cases', () => {
    test('should handle special characters in entity IDs', () => {
      const store = new ImmutableDataStore();
      
      const specialIds = [
        'entity with spaces',
        'entity-with-dashes',
        'entity_with_underscores',
        'entity.with.dots',
        'entity:with:colons',
        'entity/with/slashes',
        'entity\\with\\backslashes',
        'entity"with"quotes',
        "entity'with'apostrophes",
        'entity[with]brackets',
        'entity{with}braces',
        'entity|with|pipes',
        'entity@with@at',
        'entity#with#hash',
        'entity$with$dollar',
        'entity%with%percent',
        'entity^with^caret',
        'entity&with&ampersand',
        'entity*with*asterisk',
        'entity+with+plus',
        'entity=with=equals',
        'entity~with~tilde',
        'entity`with`backticks'
      ];
      
      let currentStore = store;
      
      // Add entities with special character IDs
      for (const id of specialIds) {
        currentStore = currentStore.withEntityType(id, 'SpecialEntity');
      }
      
      // Add edges between them
      for (let i = 0; i < specialIds.length - 1; i++) {
        currentStore = currentStore.addEdge(
          new Edge('link', specialIds[i], specialIds[i + 1])
        );
      }
      
      expect(currentStore.getEdgeCount()).toBe(specialIds.length - 1);
      
      // Verify we can query them
      for (const id of specialIds) {
        expect(currentStore.getEntityMetadata(id)).toBeDefined();
      }
    });

    test('should handle Unicode characters', () => {
      const store = new ImmutableDataStore();
      
      const unicodeIds = [
        '实体', // Chinese
        'エンティティ', // Japanese
        '엔티티', // Korean
        'сущность', // Russian
        'كيان', // Arabic
        'יישות', // Hebrew
        '实体🎉', // With emoji
        '→↓←↑', // Arrows
        '①②③', // Circled numbers
        '™®©', // Symbols
      ];
      
      let currentStore = store;
      
      for (const id of unicodeIds) {
        currentStore = currentStore
          .withEntityType(id, 'UnicodeEntity')
          .addEdge(new Edge('self', id, id));
      }
      
      expect(currentStore.getEdgeCount()).toBe(unicodeIds.length);
      
      // Verify all are stored correctly
      for (const id of unicodeIds) {
        expect(currentStore.hasEdge(new Edge('self', id, id))).toBe(true);
      }
    });
  });
});