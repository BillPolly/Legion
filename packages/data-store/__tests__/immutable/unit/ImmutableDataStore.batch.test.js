/**
 * Unit Tests for ImmutableDataStore Batch Operations
 * Per implementation plan Phase 3 Step 3.2
 * TDD approach - tests written first before implementation
 */

import { ImmutableDataStore } from '../../../src/immutable/ImmutableDataStore.js';
import { CardinalityConstraint } from '../../../src/immutable/constraints/CardinalityConstraint.js';
import { EntityTypeConstraint } from '../../../src/immutable/constraints/EntityTypeConstraint.js';
import { Edge } from '../../../src/Edge.js';
import { RelationshipType } from '../../../src/RelationshipType.js';

describe('ImmutableDataStore Batch Operations', () => {
  let store;

  beforeEach(() => {
    store = new ImmutableDataStore();
  });

  describe('batch() Method - Basic Operations', () => {
    test('should execute multiple operations atomically', () => {
      const result = store.batch(batch => {
        batch.addEdge(new Edge('worksAt', 'alice', 'company1'));
        batch.addEdge(new Edge('worksAt', 'bob', 'company1'));
        batch.addEdge(new Edge('manages', 'alice', 'bob'));
      });
      
      expect(result).not.toBe(store); // New instance
      expect(result.getEdgeCount()).toBe(3);
      expect(result.hasEdge(new Edge('worksAt', 'alice', 'company1'))).toBe(true);
      expect(result.hasEdge(new Edge('worksAt', 'bob', 'company1'))).toBe(true);
      expect(result.hasEdge(new Edge('manages', 'alice', 'bob'))).toBe(true);
      
      // Original store unchanged
      expect(store.getEdgeCount()).toBe(0);
    });

    test('should support mixed operations in batch', () => {
      // Add initial data
      const initialStore = store
        .addEdge(new Edge('worksAt', 'alice', 'company1'))
        .addEdge(new Edge('worksAt', 'bob', 'company1'))
        .addEdge(new Edge('worksAt', 'charlie', 'company2'));
      
      const result = initialStore.batch(batch => {
        // Remove edge
        batch.removeEdge(new Edge('worksAt', 'charlie', 'company2'));
        // Add new edge
        batch.addEdge(new Edge('manages', 'alice', 'bob'));
        // Add constraint
        batch.addConstraint(new CardinalityConstraint('c1', 'manages', 'source', 0, 5));
        // Define relationship type
        batch.defineRelationType(new RelationshipType('reports', 'reportsTo'));
      });
      
      expect(result.getEdgeCount()).toBe(3); // 2 original - 1 removed + 1 added
      expect(result.hasEdge(new Edge('worksAt', 'charlie', 'company2'))).toBe(false);
      expect(result.hasEdge(new Edge('manages', 'alice', 'bob'))).toBe(true);
      expect(result.getConstraintCount()).toBe(1);
      expect(result.hasRelationType('reports')).toBe(true);
    });

    test('should return original store if batch is empty', () => {
      const result = store.batch(batch => {
        // No operations
      });
      
      expect(result).toBe(store); // Same instance
    });

    test('should maintain order of operations', () => {
      const result = store.batch(batch => {
        // Order matters: define type before adding edges
        batch.defineRelationType(new RelationshipType('worksAt', 'employs'));
        batch.addEdge(new Edge('worksAt', 'alice', 'company1'));
        batch.addEdge(new Edge('worksAt', 'bob', 'company1'));
      });
      
      expect(result.getEdgeCount()).toBe(2);
      expect(result.hasRelationType('worksAt')).toBe(true);
    });
  });

  describe('batch() Method - Constraint Validation', () => {
    test('should validate all operations before applying any', () => {
      // Add constraint that limits to 1 edge per source
      const constrainedStore = store.addConstraint(
        new CardinalityConstraint('c1', 'worksAt', 'source', 0, 1)
      );
      
      // Try batch that would violate constraint
      expect(() => {
        constrainedStore.batch(batch => {
          batch.addEdge(new Edge('worksAt', 'alice', 'company1'));
          batch.addEdge(new Edge('worksAt', 'alice', 'company2')); // Violates constraint
          batch.addEdge(new Edge('worksAt', 'bob', 'company1'));
        });
      }).toThrow('Constraint validation failed');
      
      // Store should remain unchanged (atomic rollback)
      expect(constrainedStore.getEdgeCount()).toBe(0);
    });

    test('should validate constraints across batch operations', () => {
      // Add entity type constraint
      const constrainedStore = store
        .addConstraint(new EntityTypeConstraint('c1', 'worksAt', { source: 'Person', target: 'Company' }))
        .withEntityType('alice', 'Person')
        .withEntityType('bob', 'Person')
        .withEntityType('company1', 'Company')
        .withEntityType('product1', 'Product');
      
      // Batch with one invalid operation
      expect(() => {
        constrainedStore.batch(batch => {
          batch.addEdge(new Edge('worksAt', 'alice', 'company1')); // Valid
          batch.addEdge(new Edge('worksAt', 'bob', 'product1')); // Invalid - Product not Company
        });
      }).toThrow('Constraint validation failed');
      
      // No edges should be added (atomic)
      expect(constrainedStore.getEdgeCount()).toBe(0);
    });

    test('should validate removal constraints in batch', () => {
      // Setup: min cardinality of 2
      const constraint = new CardinalityConstraint('c1', 'worksAt', 'source', 2, null);
      const setupStore = store
        .addConstraint(constraint)
        .addEdge(new Edge('worksAt', 'alice', 'company1'))
        .addEdge(new Edge('worksAt', 'alice', 'company2'));
      
      // Try to remove one edge (would violate min of 2)
      expect(() => {
        setupStore.batch(batch => {
          batch.removeEdge(new Edge('worksAt', 'alice', 'company1'));
        });
      }).toThrow('Constraint validation failed');
      
      // Both edges should still exist
      expect(setupStore.getEdgeCount()).toBe(2);
    });

    test('should handle constraint addition within batch', () => {
      const result = store.batch(batch => {
        // Add edges first
        batch.addEdge(new Edge('worksAt', 'alice', 'company1'));
        batch.addEdge(new Edge('worksAt', 'bob', 'company1'));
        
        // Then add constraint (doesn't affect already added edges in this batch)
        batch.addConstraint(new CardinalityConstraint('c1', 'worksAt', 'source', 0, 1));
      });
      
      // Should succeed since constraint is added after edges
      expect(result.getEdgeCount()).toBe(2);
      expect(result.getConstraintCount()).toBe(1);
      
      // But future additions should be constrained
      expect(() => {
        result.addEdge(new Edge('worksAt', 'alice', 'company2'));
      }).toThrow('Constraint validation failed');
    });
  });

  describe('batch() Method - Transaction Semantics', () => {
    test('should provide isolated batch context', () => {
      let batchStore = null;
      
      const result = store.batch(batch => {
        batch.addEdge(new Edge('worksAt', 'alice', 'company1'));
        
        // Capture batch state
        batchStore = batch.getCurrentState();
        
        batch.addEdge(new Edge('worksAt', 'bob', 'company1'));
      });
      
      // Batch state should show intermediate state
      expect(batchStore).toBeDefined();
      expect(batchStore.getEdgeCount()).toBe(1); // Only first edge at that point
      
      // Final result has both
      expect(result.getEdgeCount()).toBe(2);
    });

    test('should support nested batches', () => {
      const result = store.batch(outerBatch => {
        outerBatch.addEdge(new Edge('worksAt', 'alice', 'company1'));
        
        // Nested batch
        outerBatch.batch(innerBatch => {
          innerBatch.addEdge(new Edge('worksAt', 'bob', 'company1'));
          innerBatch.addEdge(new Edge('manages', 'alice', 'bob'));
        });
        
        outerBatch.addEdge(new Edge('worksAt', 'charlie', 'company2'));
      });
      
      expect(result.getEdgeCount()).toBe(4);
    });

    test('should handle errors gracefully', () => {
      // Add constraint
      const constrainedStore = store.addConstraint(
        new CardinalityConstraint('c1', 'worksAt', 'source', 0, 1)
      );
      
      let error = null;
      try {
        constrainedStore.batch(batch => {
          batch.addEdge(new Edge('worksAt', 'alice', 'company1'));
          batch.addEdge(new Edge('worksAt', 'alice', 'company2')); // Will fail
        });
      } catch (e) {
        error = e;
      }
      
      expect(error).not.toBeNull();
      expect(error.message).toBe('Constraint validation failed');
      expect(error.violations).toBeDefined();
      expect(error.batchOperations).toBeDefined(); // Should include attempted operations
    });

    test('should provide dry-run capability', () => {
      const constrainedStore = store.addConstraint(
        new CardinalityConstraint('c1', 'worksAt', 'source', 0, 1)
      );
      
      // Dry run - validate without applying
      const validation = constrainedStore.validateBatch(batch => {
        batch.addEdge(new Edge('worksAt', 'alice', 'company1'));
        batch.addEdge(new Edge('worksAt', 'alice', 'company2')); // Would violate
      });
      
      expect(validation.isValid).toBe(false);
      expect(validation.violations).toHaveLength(1);
      expect(validation.wouldSucceed).toEqual([0]); // First operation would succeed
      expect(validation.wouldFail).toEqual([1]); // Second would fail
      
      // Store unchanged
      expect(constrainedStore.getEdgeCount()).toBe(0);
    });
  });

  describe('batch() Method - Entity Type Support', () => {
    test('should preserve entity types through batch operations', () => {
      const typedStore = store
        .withEntityType('alice', 'Person')
        .withEntityType('company1', 'Company');
      
      const result = typedStore.batch(batch => {
        batch.addEdge(new Edge('worksAt', 'alice', 'company1'));
        batch.withEntityType('bob', 'Person');
        batch.addEdge(new Edge('worksAt', 'bob', 'company1'));
      });
      
      expect(result.getEntityMetadata('alice')?.type).toBe('Person');
      expect(result.getEntityMetadata('bob')?.type).toBe('Person');
      expect(result.getEntityMetadata('company1')?.type).toBe('Company');
    });
  });

  describe('batch() Method - Error Cases', () => {
    test('should fail fast on invalid batch function', () => {
      expect(() => store.batch(null))
        .toThrow('Batch function is required');
      
      expect(() => store.batch('not-function'))
        .toThrow('Batch function must be a function');
    });

    test('should handle exceptions in batch function', () => {
      expect(() => {
        store.batch(batch => {
          batch.addEdge(new Edge('worksAt', 'alice', 'company1'));
          throw new Error('User error in batch');
        });
      }).toThrow('User error in batch');
      
      // Store should remain unchanged
      expect(store.getEdgeCount()).toBe(0);
    });

    test('should prevent operations outside batch context', () => {
      let capturedBatch = null;
      
      store.batch(batch => {
        capturedBatch = batch;
        batch.addEdge(new Edge('worksAt', 'alice', 'company1'));
      });
      
      // Try to use batch outside its context
      expect(() => {
        capturedBatch.addEdge(new Edge('worksAt', 'bob', 'company1'));
      }).toThrow('Batch context has been closed');
    });
  });

  describe('batch() Method - Performance', () => {
    test('should efficiently handle large batches', () => {
      const edges = [];
      for (let i = 0; i < 100; i++) {
        edges.push(new Edge('worksAt', `person${i}`, `company${i % 10}`));
      }
      
      const result = store.batch(batch => {
        for (const edge of edges) {
          batch.addEdge(edge);
        }
      });
      
      expect(result.getEdgeCount()).toBe(100);
      
      // Verify some samples
      expect(result.hasEdge(new Edge('worksAt', 'person0', 'company0'))).toBe(true);
      expect(result.hasEdge(new Edge('worksAt', 'person99', 'company9'))).toBe(true);
    });

    test('should optimize identical sequential operations', () => {
      const edge = new Edge('worksAt', 'alice', 'company1');
      
      const result = store.batch(batch => {
        batch.addEdge(edge);
        batch.addEdge(edge); // Duplicate - should be ignored
        batch.addEdge(edge); // Another duplicate
      });
      
      expect(result.getEdgeCount()).toBe(1); // Only one edge actually added
    });
  });
});