/**
 * Unit Tests for Built-in Constraint Types
 * Per implementation plan Phase 2 Step 2.4
 * TDD approach - tests written first before implementation
 */

import { CardinalityConstraint } from '../../../../src/immutable/constraints/CardinalityConstraint.js';
import { EntityTypeConstraint } from '../../../../src/immutable/constraints/EntityTypeConstraint.js';
import { CustomConstraint } from '../../../../src/immutable/constraints/CustomConstraint.js';
import { Constraint } from '../../../../src/immutable/constraints/Constraint.js';
import { ConstraintResult } from '../../../../src/immutable/constraints/ConstraintResult.js';
import { ConstraintViolation } from '../../../../src/immutable/constraints/ConstraintViolation.js';
import { Edge } from '../../../../src/Edge.js';
import { ImmutableStoreRoot } from '../../../../src/immutable/ImmutableStoreRoot.js';
import { RelationshipType } from '../../../../src/RelationshipType.js';

describe('Built-in Constraint Types', () => {
  let storeRoot;
  let sampleEdge;

  beforeEach(() => {
    storeRoot = new ImmutableStoreRoot();
    sampleEdge = new Edge('worksAt', 'alice', 'company1');
  });

  describe('CardinalityConstraint', () => {
    describe('Constructor and Basic Properties', () => {
      test('should create cardinality constraint with min and max', () => {
        const constraint = new CardinalityConstraint('card1', 'worksAt', 'source', 1, 5);
        
        expect(constraint).toBeInstanceOf(Constraint);
        expect(constraint.id).toBe('card1');
        expect(constraint.relationName).toBe('worksAt');
        expect(constraint.getCardinality()).toEqual({ min: 1, max: 5 });
        expect(constraint.getDirection()).toBe('source');
        expect(Object.isFrozen(constraint)).toBe(true);
      });

      test('should create constraint with only min cardinality', () => {
        const constraint = new CardinalityConstraint('card2', 'worksAt', 'source', 1, null);
        
        expect(constraint.getCardinality()).toEqual({ min: 1, max: null });
      });

      test('should create constraint with only max cardinality', () => {
        const constraint = new CardinalityConstraint('card3', 'worksAt', 'source', null, 3);
        
        expect(constraint.getCardinality()).toEqual({ min: null, max: 3 });
      });

      test('should create constraint for target direction', () => {
        const constraint = new CardinalityConstraint('card4', 'worksAt', 'target', 0, 1);
        
        expect(constraint.getDirection()).toBe('target');
      });

      test('should fail fast on invalid parameters', () => {
        expect(() => new CardinalityConstraint('c1', 'worksAt', 'invalid', 1, 5))
          .toThrow('Direction must be "source" or "target"');
        
        expect(() => new CardinalityConstraint('c2', 'worksAt', 'source', -1, 5))
          .toThrow('Min cardinality must be non-negative');
        
        expect(() => new CardinalityConstraint('c3', 'worksAt', 'source', 5, 1))
          .toThrow('Max cardinality must be greater than or equal to min');
        
        expect(() => new CardinalityConstraint('c4', 'worksAt', 'source', 'not-number', 5))
          .toThrow('Min cardinality must be a number or null');
        
        expect(() => new CardinalityConstraint('c5', 'worksAt', 'source', null, null))
          .toThrow('At least one of min or max cardinality must be specified');
      });

      test('should provide meaningful string representation', () => {
        const constraint = new CardinalityConstraint('card5', 'worksAt', 'source', 1, 5);
        const str = constraint.toString();
        
        expect(str).toContain('CardinalityConstraint');
        expect(str).toContain('worksAt');
        expect(str).toContain('source');
        expect(str).toContain('1-5');
      });
    });

    describe('Source Cardinality Validation', () => {
      let populatedStore;

      beforeEach(() => {
        // Create store with edges for testing
        const worksAtType = new RelationshipType('worksAt', 'employs');
        populatedStore = storeRoot
          .withAddedRelationType(worksAtType)
          .withAddedEdge(new Edge('worksAt', 'alice', 'company1'))
          .withAddedEdge(new Edge('worksAt', 'alice', 'company2'))
          .withAddedEdge(new Edge('worksAt', 'bob', 'company1'));
      });

      test('should pass when within cardinality limits', () => {
        const constraint = new CardinalityConstraint('card6', 'worksAt', 'source', 1, 3);
        const newEdge = new Edge('worksAt', 'bob', 'company2');
        
        const result = constraint.validate(populatedStore, newEdge);
        
        expect(result.isValid).toBe(true);
        expect(result.violations).toHaveLength(0);
      });

      test('should fail when exceeding max cardinality', () => {
        const constraint = new CardinalityConstraint('card7', 'worksAt', 'source', 0, 2);
        const newEdge = new Edge('worksAt', 'alice', 'company3'); // Alice already has 2
        
        const result = constraint.validate(populatedStore, newEdge);
        
        expect(result.isValid).toBe(false);
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0].message).toContain('exceed maximum cardinality of 2');
      });

      test('should handle min cardinality on removal', () => {
        const constraint = new CardinalityConstraint('card8', 'worksAt', 'source', 2, null);
        // Simulate removal by passing a removal flag
        const removalEdge = new Edge('worksAt', 'alice', 'company1');
        
        // For removal validation, we need to check if removing would violate min
        const result = constraint.validateRemoval(populatedStore, removalEdge);
        
        expect(result.isValid).toBe(false); // Alice has 2, removing 1 leaves 1, which violates min of 2
      });

      test('should handle unlimited max cardinality', () => {
        const constraint = new CardinalityConstraint('card9', 'worksAt', 'source', 0, null);
        const newEdge = new Edge('worksAt', 'alice', 'company10');
        
        const result = constraint.validate(populatedStore, newEdge);
        
        expect(result.isValid).toBe(true);
      });
    });

    describe('Target Cardinality Validation', () => {
      let populatedStore;

      beforeEach(() => {
        const worksAtType = new RelationshipType('worksAt', 'employs');
        populatedStore = storeRoot
          .withAddedRelationType(worksAtType)
          .withAddedEdge(new Edge('worksAt', 'alice', 'company1'))
          .withAddedEdge(new Edge('worksAt', 'bob', 'company1'))
          .withAddedEdge(new Edge('worksAt', 'charlie', 'company1'));
      });

      test('should validate target cardinality correctly', () => {
        const constraint = new CardinalityConstraint('card10', 'worksAt', 'target', 0, 3);
        const newEdge = new Edge('worksAt', 'david', 'company1'); // Company1 already has 3
        
        const result = constraint.validate(populatedStore, newEdge);
        
        expect(result.isValid).toBe(false);
        expect(result.violations[0].message).toContain('exceed maximum cardinality of 3');
      });

      test('should pass when target within limits', () => {
        const constraint = new CardinalityConstraint('card11', 'worksAt', 'target', 0, 10);
        const newEdge = new Edge('worksAt', 'david', 'company1');
        
        const result = constraint.validate(populatedStore, newEdge);
        
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('EntityTypeConstraint', () => {
    describe('Constructor and Basic Properties', () => {
      test('should create entity type constraint', () => {
        const constraint = new EntityTypeConstraint(
          'entity1',
          'worksAt',
          { source: 'Person', target: 'Company' }
        );
        
        expect(constraint).toBeInstanceOf(Constraint);
        expect(constraint.id).toBe('entity1');
        expect(constraint.relationName).toBe('worksAt');
        expect(constraint.getEntityTypes()).toEqual({ source: 'Person', target: 'Company' });
        expect(Object.isFrozen(constraint)).toBe(true);
      });

      test('should create constraint with only source type', () => {
        const constraint = new EntityTypeConstraint(
          'entity2',
          'worksAt',
          { source: 'Person' }
        );
        
        expect(constraint.getEntityTypes()).toEqual({ source: 'Person', target: null });
      });

      test('should create constraint with only target type', () => {
        const constraint = new EntityTypeConstraint(
          'entity3',
          'worksAt',
          { target: 'Company' }
        );
        
        expect(constraint.getEntityTypes()).toEqual({ source: null, target: 'Company' });
      });

      test('should fail fast on invalid parameters', () => {
        expect(() => new EntityTypeConstraint('e1', 'worksAt', null))
          .toThrow('Entity types configuration is required');
        
        expect(() => new EntityTypeConstraint('e2', 'worksAt', {}))
          .toThrow('At least one entity type must be specified');
        
        expect(() => new EntityTypeConstraint('e3', 'worksAt', { source: 123 }))
          .toThrow('Entity type must be a string');
      });

      test('should provide meaningful string representation', () => {
        const constraint = new EntityTypeConstraint(
          'entity4',
          'worksAt',
          { source: 'Person', target: 'Company' }
        );
        const str = constraint.toString();
        
        expect(str).toContain('EntityTypeConstraint');
        expect(str).toContain('Person');
        expect(str).toContain('Company');
      });
    });

    describe('Entity Type Validation', () => {
      let typedStore;

      beforeEach(() => {
        // Create store with entity type metadata
        const worksAtType = new RelationshipType('worksAt', 'employs');
        typedStore = storeRoot
          .withAddedRelationType(worksAtType)
          .withEntityType('alice', 'Person')
          .withEntityType('bob', 'Person')
          .withEntityType('company1', 'Company')
          .withEntityType('company2', 'Company')
          .withEntityType('product1', 'Product');
      });

      test('should pass when entity types match', () => {
        const constraint = new EntityTypeConstraint(
          'entity5',
          'worksAt',
          { source: 'Person', target: 'Company' }
        );
        const edge = new Edge('worksAt', 'alice', 'company1');
        
        const result = constraint.validate(typedStore, edge);
        
        expect(result.isValid).toBe(true);
        expect(result.violations).toHaveLength(0);
      });

      test('should fail when source type mismatches', () => {
        const constraint = new EntityTypeConstraint(
          'entity6',
          'worksAt',
          { source: 'Person', target: 'Company' }
        );
        const edge = new Edge('worksAt', 'product1', 'company1'); // product1 is Product, not Person
        
        const result = constraint.validate(typedStore, edge);
        
        expect(result.isValid).toBe(false);
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0].message).toContain('Expected source type Person but got Product');
      });

      test('should fail when target type mismatches', () => {
        const constraint = new EntityTypeConstraint(
          'entity7',
          'worksAt',
          { source: 'Person', target: 'Company' }
        );
        const edge = new Edge('worksAt', 'alice', 'product1'); // product1 is Product, not Company
        
        const result = constraint.validate(typedStore, edge);
        
        expect(result.isValid).toBe(false);
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0].message).toContain('Expected target type Company but got Product');
      });

      test('should handle unknown entity types', () => {
        const constraint = new EntityTypeConstraint(
          'entity8',
          'worksAt',
          { source: 'Person' }
        );
        const edge = new Edge('worksAt', 'unknown', 'company1');
        
        const result = constraint.validate(typedStore, edge);
        
        expect(result.isValid).toBe(false);
        expect(result.violations[0].message).toContain('Unknown entity type for source');
      });

      test('should validate only specified types', () => {
        const constraint = new EntityTypeConstraint(
          'entity9',
          'worksAt',
          { target: 'Company' } // Only checking target
        );
        const edge = new Edge('worksAt', 'product1', 'company1'); // source is wrong but not checked
        
        const result = constraint.validate(typedStore, edge);
        
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('CustomConstraint', () => {
    describe('Constructor and Basic Properties', () => {
      test('should create custom constraint with validation function', () => {
        const validationFn = (storeRoot, edge) => {
          return edge.src === 'alice' 
            ? ConstraintResult.success('custom1')
            : ConstraintResult.failure('custom1', [
                new ConstraintViolation('custom1', 'Only alice allowed', edge)
              ]);
        };
        
        const constraint = new CustomConstraint('custom1', 'worksAt', 'Only alice can work', validationFn);
        
        expect(constraint).toBeInstanceOf(Constraint);
        expect(constraint.id).toBe('custom1');
        expect(constraint.relationName).toBe('worksAt');
        expect(constraint.description).toBe('Only alice can work');
        expect(Object.isFrozen(constraint)).toBe(true);
      });

      test('should fail fast on invalid validation function', () => {
        expect(() => new CustomConstraint('c1', 'worksAt', 'desc', null))
          .toThrow('Validation function is required');
        
        expect(() => new CustomConstraint('c2', 'worksAt', 'desc', 'not-function'))
          .toThrow('Validation function must be a function');
      });

      test('should provide meaningful string representation', () => {
        const validationFn = () => ConstraintResult.success('custom2');
        const constraint = new CustomConstraint('custom2', 'worksAt', 'Custom rule', validationFn);
        const str = constraint.toString();
        
        expect(str).toContain('CustomConstraint');
        expect(str).toContain('Custom rule');
      });
    });

    describe('Custom Validation Logic', () => {
      test('should execute custom validation function', () => {
        let callCount = 0;
        const validationFn = (storeRoot, edge) => {
          callCount++;
          if (edge.src.startsWith('temp_')) {
            return ConstraintResult.failure('custom3', [
              new ConstraintViolation('custom3', 'Temporary users not allowed', edge)
            ]);
          }
          return ConstraintResult.success('custom3');
        };
        
        const constraint = new CustomConstraint('custom3', 'worksAt', 'No temp users', validationFn);
        
        // Test with valid edge
        const validEdge = new Edge('worksAt', 'alice', 'company1');
        const validResult = constraint.validate(storeRoot, validEdge);
        
        expect(validResult.isValid).toBe(true);
        expect(callCount).toBe(1);
        
        // Test with invalid edge
        const invalidEdge = new Edge('worksAt', 'temp_bob', 'company1');
        const invalidResult = constraint.validate(storeRoot, invalidEdge);
        
        expect(invalidResult.isValid).toBe(false);
        expect(invalidResult.violations[0].message).toBe('Temporary users not allowed');
      });

      test('should handle complex custom logic', () => {
        // Custom constraint: A person can only work at companies in the same city
        const validationFn = (storeRoot, edge) => {
          // Simulate getting city information
          const personCity = storeRoot.getEntityMetadata?.(edge.src)?.city || 'unknown';
          const companyCity = storeRoot.getEntityMetadata?.(edge.dst)?.city || 'unknown';
          
          if (personCity !== companyCity && personCity !== 'unknown' && companyCity !== 'unknown') {
            return ConstraintResult.failure('custom4', [
              new ConstraintViolation(
                'custom4',
                `Person in ${personCity} cannot work at company in ${companyCity}`,
                edge,
                { personCity, companyCity }
              )
            ]);
          }
          
          return ConstraintResult.success('custom4');
        };
        
        const constraint = new CustomConstraint('custom4', 'worksAt', 'Same city requirement', validationFn);
        
        // Create store with city metadata
        const storeWithCities = {
          ...storeRoot,
          getEntityMetadata: (entityId) => {
            const metadata = {
              'alice': { city: 'NYC' },
              'company1': { city: 'NYC' },
              'company2': { city: 'SF' }
            };
            return metadata[entityId];
          }
        };
        
        // Valid: same city
        const validEdge = new Edge('worksAt', 'alice', 'company1');
        const validResult = constraint.validate(storeWithCities, validEdge);
        expect(validResult.isValid).toBe(true);
        
        // Invalid: different cities
        const invalidEdge = new Edge('worksAt', 'alice', 'company2');
        const invalidResult = constraint.validate(storeWithCities, invalidEdge);
        expect(invalidResult.isValid).toBe(false);
        expect(invalidResult.violations[0].metadata).toEqual({
          personCity: 'NYC',
          companyCity: 'SF'
        });
      });

      test('should handle validation function errors gracefully', () => {
        const errorFn = () => {
          throw new Error('Validation function error');
        };
        
        const constraint = new CustomConstraint('custom5', 'worksAt', 'Error test', errorFn);
        
        expect(() => constraint.validate(storeRoot, sampleEdge))
          .toThrow('Custom validation failed: Validation function error');
      });

      test('should validate function return type', () => {
        const invalidReturnFn = () => {
          return 'not-a-result'; // Invalid return type
        };
        
        const constraint = new CustomConstraint('custom6', 'worksAt', 'Invalid return', invalidReturnFn);
        
        expect(() => constraint.validate(storeRoot, sampleEdge))
          .toThrow('Validation function must return a ConstraintResult');
      });
    });

    describe('Custom Constraint with State', () => {
      test('should support stateful custom constraints via closure', () => {
        // Track validation count in closure
        let validationCount = 0;
        
        const validationFn = (storeRoot, edge) => {
          validationCount++;
          
          // Fail every 3rd validation
          if (validationCount % 3 === 0) {
            return ConstraintResult.failure('custom7', [
              new ConstraintViolation('custom7', `Failed on validation #${validationCount}`, edge)
            ]);
          }
          
          return ConstraintResult.success('custom7');
        };
        
        const constraint = new CustomConstraint('custom7', 'worksAt', 'Stateful constraint', validationFn);
        
        // First two should pass
        expect(constraint.validate(storeRoot, sampleEdge).isValid).toBe(true);
        expect(constraint.validate(storeRoot, sampleEdge).isValid).toBe(true);
        
        // Third should fail
        const result = constraint.validate(storeRoot, sampleEdge);
        expect(result.isValid).toBe(false);
        expect(result.violations[0].message).toBe('Failed on validation #3');
        
        // Fourth should pass again
        expect(constraint.validate(storeRoot, sampleEdge).isValid).toBe(true);
      });
    });
  });

  describe('Integration Between Constraint Types', () => {
    test('should be able to combine different constraint types', () => {
      const cardinalityConstraint = new CardinalityConstraint('card', 'worksAt', 'source', 1, 5);
      const entityConstraint = new EntityTypeConstraint('entity', 'worksAt', { source: 'Person' });
      const customConstraint = new CustomConstraint('custom', 'worksAt', 'Custom', 
        () => ConstraintResult.success('custom'));
      
      // All should be Constraint instances
      expect(cardinalityConstraint).toBeInstanceOf(Constraint);
      expect(entityConstraint).toBeInstanceOf(Constraint);
      expect(customConstraint).toBeInstanceOf(Constraint);
      
      // All should have consistent interface
      expect(typeof cardinalityConstraint.validate).toBe('function');
      expect(typeof entityConstraint.validate).toBe('function');
      expect(typeof customConstraint.validate).toBe('function');
    });
  });
});

// Mock extension for ImmutableStoreRoot to support entity types
// This would normally be implemented in the actual StoreRoot
ImmutableStoreRoot.prototype.withEntityType = function(entityId, type) {
  // Mock implementation
  const newStore = Object.create(this);
  newStore._entityTypes = { ...(this._entityTypes || {}), [entityId]: type };
  newStore.getEntityMetadata = function(entityId) {
    return { type: this._entityTypes[entityId] };
  };
  return newStore;
};

ImmutableStoreRoot.prototype.validateRemoval = function(edge) {
  // Mock implementation for removal validation
  return ConstraintResult.success('removal');
};