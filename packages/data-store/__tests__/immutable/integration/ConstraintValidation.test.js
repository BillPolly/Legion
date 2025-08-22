/**
 * Integration Tests for Constraint Validation System
 * Per implementation plan Phase 2 Step 2.5
 * 
 * Tests the complete constraint system working together:
 * - Registry + Validator + Constraints + Store
 * - No mocks - uses real implementations only
 */

import { ImmutableStoreRoot } from '../../../src/immutable/ImmutableStoreRoot.js';
import { ImmutableTrieManager } from '../../../src/immutable/ImmutableTrieManager.js';
import { ConstraintRegistry } from '../../../src/immutable/constraints/ConstraintRegistry.js';
import { ConstraintValidator } from '../../../src/immutable/constraints/ConstraintValidator.js';
import { CardinalityConstraint } from '../../../src/immutable/constraints/CardinalityConstraint.js';
import { EntityTypeConstraint } from '../../../src/immutable/constraints/EntityTypeConstraint.js';
import { CustomConstraint } from '../../../src/immutable/constraints/CustomConstraint.js';
import { ConstraintResult } from '../../../src/immutable/constraints/ConstraintResult.js';
import { ConstraintViolation } from '../../../src/immutable/constraints/ConstraintViolation.js';
import { Edge } from '../../../src/Edge.js';
import { RelationshipType } from '../../../src/RelationshipType.js';

describe('Constraint Validation System Integration', () => {
  let storeRoot;
  let registry;
  let validator;
  let worksAtType;
  let managesType;
  let partnerType;

  beforeEach(() => {
    // Create real store with proper initialization
    const trieManager = new ImmutableTrieManager();
    storeRoot = new ImmutableStoreRoot(
      new Map(),           // edges
      new Map(),           // edgesByType
      new Map(),           // edgesBySource
      new Map(),           // edgesByDestination
      new Map(),           // relationshipTypes
      trieManager          // trieManager
    );
    
    // Create real relationship types
    worksAtType = new RelationshipType('worksAt', 'employs');
    managesType = new RelationshipType('manages', 'managedBy');
    partnerType = new RelationshipType('partner', 'partner');
    
    // Add relationship types to store
    storeRoot = storeRoot
      .withAddedRelationType(worksAtType)
      .withAddedRelationType(managesType)
      .withAddedRelationType(partnerType);
    
    // Create empty registry and validator
    registry = new ConstraintRegistry();
    validator = new ConstraintValidator(registry);
  });

  describe('Single Constraint Type Validation', () => {
    test('should enforce cardinality constraints through full pipeline', () => {
      // Add cardinality constraint: max 2 companies per person
      const cardConstraint = new CardinalityConstraint(
        'maxCompanies',
        'worksAt',
        'source',
        0,
        2
      );
      
      registry = registry.withAddedConstraint(cardConstraint);
      validator = validator.withRegistry(registry);
      
      // Add edges up to limit
      const edge1 = new Edge('worksAt', 'alice', 'company1');
      const edge2 = new Edge('worksAt', 'alice', 'company2');
      
      storeRoot = storeRoot
        .withAddedEdge(edge1)
        .withAddedEdge(edge2);
      
      // Validate adding third edge - should fail
      const edge3 = new Edge('worksAt', 'alice', 'company3');
      const result = validator.validateEdge(storeRoot, edge3);
      
      expect(result.isValid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].constraintId).toBe('maxCompanies');
      expect(result.violations[0].message).toContain('exceed maximum cardinality of 2');
    });

    test('should enforce entity type constraints through full pipeline', () => {
      // Add entity types to store (mock implementation)
      storeRoot = storeRoot
        .withEntityType('alice', 'Person')
        .withEntityType('bob', 'Person')
        .withEntityType('company1', 'Company')
        .withEntityType('product1', 'Product');
      
      // Add entity type constraint
      const typeConstraint = new EntityTypeConstraint(
        'worksAtTypes',
        'worksAt',
        { source: 'Person', target: 'Company' }
      );
      
      registry = registry.withAddedConstraint(typeConstraint);
      validator = validator.withRegistry(registry);
      
      // Valid edge
      const validEdge = new Edge('worksAt', 'alice', 'company1');
      const validResult = validator.validateEdge(storeRoot, validEdge);
      
      expect(validResult.isValid).toBe(true);
      expect(validResult.violations).toHaveLength(0);
      
      // Invalid edge - wrong target type
      const invalidEdge = new Edge('worksAt', 'alice', 'product1');
      const invalidResult = validator.validateEdge(storeRoot, invalidEdge);
      
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.violations).toHaveLength(1);
      expect(invalidResult.violations[0].message).toContain('Expected target type Company but got Product');
    });

    test('should enforce custom constraints through full pipeline', () => {
      // Custom constraint: no self-partnerships
      const noSelfPartnerConstraint = new CustomConstraint(
        'noSelfPartner',
        'partner',
        'Cannot be partner with yourself',
        (storeRoot, edge) => {
          if (edge.src === edge.dst) {
            const violation = new ConstraintViolation(
              'noSelfPartner',
              'Cannot create partnership with yourself',
              edge
            );
            return ConstraintResult.failure('noSelfPartner', [violation]);
          }
          return ConstraintResult.success('noSelfPartner');
        }
      );
      
      registry = registry.withAddedConstraint(noSelfPartnerConstraint);
      validator = validator.withRegistry(registry);
      
      // Valid partnership
      const validEdge = new Edge('partner', 'alice', 'bob');
      const validResult = validator.validateEdge(storeRoot, validEdge);
      
      expect(validResult.isValid).toBe(true);
      
      // Invalid self-partnership
      const invalidEdge = new Edge('partner', 'alice', 'alice');
      const invalidResult = validator.validateEdge(storeRoot, invalidEdge);
      
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.violations[0].message).toBe('Cannot create partnership with yourself');
    });
  });

  describe('Multiple Constraint Validation', () => {
    test('should validate edge against multiple constraints simultaneously', () => {
      // Set up entity types
      storeRoot = storeRoot
        .withEntityType('alice', 'Person')
        .withEntityType('bob', 'Person')
        .withEntityType('charlie', 'Person')
        .withEntityType('company1', 'Company')
        .withEntityType('company2', 'Company');
      
      // Add multiple constraints
      const cardConstraint = new CardinalityConstraint('maxCompanies', 'worksAt', 'source', 0, 2);
      const typeConstraint = new EntityTypeConstraint('worksAtTypes', 'worksAt', 
        { source: 'Person', target: 'Company' });
      const customConstraint = new CustomConstraint('noWeekendWork', 'worksAt',
        'No weekend companies',
        (storeRoot, edge) => {
          // Simulate weekend company check
          if (edge.dst === 'weekendCo') {
            return ConstraintResult.failure('noWeekendWork', [
              new ConstraintViolation('noWeekendWork', 'Cannot work at weekend companies', edge)
            ]);
          }
          return ConstraintResult.success('noWeekendWork');
        }
      );
      
      registry = registry
        .withAddedConstraint(cardConstraint)
        .withAddedConstraint(typeConstraint)
        .withAddedConstraint(customConstraint);
      validator = validator.withRegistry(registry);
      
      // Test edge that passes all constraints
      const validEdge = new Edge('worksAt', 'alice', 'company1');
      const validResult = validator.validateEdge(storeRoot, validEdge);
      
      expect(validResult.isValid).toBe(true);
      expect(validResult.getValidationStatistics()).toEqual({
        constraintsEvaluated: 3,
        constraintsPassed: 3,
        constraintsFailed: 0,
        totalViolations: 0
      });
      
      // Test edge that fails multiple constraints
      storeRoot = storeRoot.withEntityType('weekendCo', 'NotCompany');
      const invalidEdge = new Edge('worksAt', 'alice', 'weekendCo');
      const invalidResult = validator.validateEdge(storeRoot, invalidEdge);
      
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.violations).toHaveLength(2); // Type and custom constraints fail
      
      const violationIds = invalidResult.violations.map(v => v.constraintId);
      expect(violationIds).toContain('worksAtTypes');
      expect(violationIds).toContain('noWeekendWork');
    });

    test('should handle global constraints applying to all relations', () => {
      // Global constraint: no edges with 'test' prefix
      const globalConstraint = new CustomConstraint('noTestEntities', '*',
        'No test entities allowed',
        (storeRoot, edge) => {
          if (edge.src.startsWith('test_') || edge.dst.startsWith('test_')) {
            return ConstraintResult.failure('noTestEntities', [
              new ConstraintViolation('noTestEntities', 'Test entities not allowed', edge)
            ]);
          }
          return ConstraintResult.success('noTestEntities');
        }
      );
      
      // Relation-specific constraint
      const worksAtConstraint = new CardinalityConstraint('worksAtCard', 'worksAt', 'source', 0, 5);
      
      registry = registry
        .withAddedConstraint(globalConstraint)
        .withAddedConstraint(worksAtConstraint);
      validator = validator.withRegistry(registry);
      
      // Test worksAt edge - both constraints apply
      const worksAtEdge = new Edge('worksAt', 'test_alice', 'company1');
      const worksAtResult = validator.validateEdge(storeRoot, worksAtEdge);
      
      expect(worksAtResult.isValid).toBe(false);
      expect(worksAtResult.violations[0].constraintId).toBe('noTestEntities');
      
      // Test manages edge - only global constraint applies
      const managesEdge = new Edge('manages', 'test_bob', 'charlie');
      const managesResult = validator.validateEdge(storeRoot, managesEdge);
      
      expect(managesResult.isValid).toBe(false);
      expect(managesResult.violations[0].constraintId).toBe('noTestEntities');
      
      // Valid edge for non-worksAt relation
      const validManagesEdge = new Edge('manages', 'alice', 'bob');
      const validResult = validator.validateEdge(storeRoot, validManagesEdge);
      
      expect(validResult.isValid).toBe(true);
    });
  });

  describe('Batch Validation', () => {
    test('should validate multiple edges in batch', () => {
      // Set up constraints
      const cardConstraint = new CardinalityConstraint('maxManages', 'manages', 'source', 0, 3);
      registry = registry.withAddedConstraint(cardConstraint);
      validator = validator.withRegistry(registry);
      
      // Create batch of edges
      const edges = [
        new Edge('manages', 'alice', 'bob'),
        new Edge('manages', 'alice', 'charlie'),
        new Edge('manages', 'alice', 'david'),
        new Edge('manages', 'alice', 'eve'), // This would exceed limit
      ];
      
      // Add first 3 edges to store
      storeRoot = storeRoot
        .withAddedEdge(edges[0])
        .withAddedEdge(edges[1])
        .withAddedEdge(edges[2]);
      
      // Validate the 4th edge
      const batchResult = validator.validateEdges(storeRoot, [edges[3]]);
      
      expect(batchResult.isValid).toBe(false);
      expect(batchResult.violations).toHaveLength(1);
      
      // Validate multiple new edges
      const newEdges = [
        new Edge('manages', 'bob', 'frank'), // Valid
        new Edge('manages', 'alice', 'gary'), // Invalid - exceeds Alice's limit
      ];
      
      const multiResult = validator.validateEdges(storeRoot, newEdges);
      
      expect(multiResult.isValid).toBe(false);
      expect(multiResult.violations).toHaveLength(1);
      expect(multiResult.violations[0].edge).toBe(newEdges[1]);
    });
  });

  describe('Constraint Registry Management', () => {
    test('should dynamically add and remove constraints', () => {
      const constraint1 = new CardinalityConstraint('c1', 'worksAt', 'source', 0, 1);
      const constraint2 = new CardinalityConstraint('c2', 'worksAt', 'target', 0, 10);
      
      // Start with one constraint
      registry = registry.withAddedConstraint(constraint1);
      validator = validator.withRegistry(registry);
      
      expect(registry.getConstraintCount()).toBe(1);
      
      // Add second constraint
      registry = registry.withAddedConstraint(constraint2);
      validator = validator.withRegistry(registry);
      
      expect(registry.getConstraintCount()).toBe(2);
      
      // Both constraints should be applied
      const edge = new Edge('worksAt', 'alice', 'company1');
      storeRoot = storeRoot.withAddedEdge(edge);
      
      const edge2 = new Edge('worksAt', 'alice', 'company2');
      const result = validator.validateEdge(storeRoot, edge2);
      
      expect(result.isValid).toBe(false); // Violates c1 (max 1 per source)
      
      // Remove first constraint
      registry = registry.withRemovedConstraint('c1');
      validator = validator.withRegistry(registry);
      
      expect(registry.getConstraintCount()).toBe(1);
      
      // Now same edge should pass
      const result2 = validator.validateEdge(storeRoot, edge2);
      expect(result2.isValid).toBe(true);
    });

    test('should handle constraint replacement', () => {
      // Original constraint: max 1
      const original = new CardinalityConstraint('limit', 'worksAt', 'source', 0, 1);
      registry = registry.withAddedConstraint(original);
      validator = validator.withRegistry(registry);
      
      // Add an edge
      const edge1 = new Edge('worksAt', 'alice', 'company1');
      storeRoot = storeRoot.withAddedEdge(edge1);
      
      // Second edge should fail
      const edge2 = new Edge('worksAt', 'alice', 'company2');
      const result1 = validator.validateEdge(storeRoot, edge2);
      expect(result1.isValid).toBe(false);
      
      // Replace with more permissive constraint (max 3)
      const replacement = new CardinalityConstraint('limit', 'worksAt', 'source', 0, 3);
      registry = registry.withAddedConstraint(replacement); // Same ID replaces
      validator = validator.withRegistry(registry);
      
      // Now second edge should pass
      const result2 = validator.validateEdge(storeRoot, edge2);
      expect(result2.isValid).toBe(true);
    });
  });

  describe('Complex Validation Scenarios', () => {
    test('should handle circular relationship constraints', () => {
      // Custom constraint: no circular management
      const noCircularManagement = new CustomConstraint('noCircular', 'manages',
        'No circular management chains',
        (storeRoot, edge) => {
          // Check if adding this edge would create a cycle
          const wouldCreateCycle = checkForCycle(storeRoot, edge);
          
          if (wouldCreateCycle) {
            return ConstraintResult.failure('noCircular', [
              new ConstraintViolation('noCircular', 
                `Adding edge would create circular management: ${edge.src} -> ${edge.dst}`, 
                edge)
            ]);
          }
          return ConstraintResult.success('noCircular');
        }
      );
      
      registry = registry.withAddedConstraint(noCircularManagement);
      validator = validator.withRegistry(registry);
      
      // Build management chain: alice -> bob -> charlie
      storeRoot = storeRoot
        .withAddedEdge(new Edge('manages', 'alice', 'bob'))
        .withAddedEdge(new Edge('manages', 'bob', 'charlie'));
      
      // Try to add charlie -> alice (would create cycle)
      const cyclicEdge = new Edge('manages', 'charlie', 'alice');
      const result = validator.validateEdge(storeRoot, cyclicEdge);
      
      expect(result.isValid).toBe(false);
      expect(result.violations[0].message).toContain('circular management');
      
      // Non-cyclic edge should be fine
      const validEdge = new Edge('manages', 'charlie', 'david');
      const validResult = validator.validateEdge(storeRoot, validEdge);
      
      expect(validResult.isValid).toBe(true);
    });

    test('should validate constraints with dependent conditions', () => {
      // Add entity types and existing edges
      storeRoot = storeRoot
        .withEntityType('alice', 'Manager')
        .withEntityType('bob', 'Employee')
        .withEntityType('charlie', 'Employee')
        .withEntityType('company1', 'Company')
        .withAddedEdge(new Edge('manages', 'alice', 'bob'))
        .withAddedEdge(new Edge('manages', 'alice', 'charlie'));
      
      // Constraint: Managers can work at max 1 company, Employees at max 3
      const roleBasedConstraint = new CustomConstraint('roleBasedCard', 'worksAt',
        'Role-based cardinality',
        (storeRoot, edge) => {
          const entityType = storeRoot.getEntityMetadata?.(edge.src)?.type;
          
          // Count existing edges for this entity
          const edges = storeRoot.getEdgesBySource(edge.src);
          let currentCount = 0;
          for (const e of edges) {
            if (e.type === 'worksAt') {
              currentCount++;
            }
          }
          
          if (entityType === 'Manager' && currentCount >= 1) {
            return ConstraintResult.failure('roleBasedCard', [
              new ConstraintViolation('roleBasedCard', 
                'Managers can only work at one company', edge)
            ]);
          }
          
          if (entityType === 'Employee' && currentCount >= 3) {
            return ConstraintResult.failure('roleBasedCard', [
              new ConstraintViolation('roleBasedCard',
                'Employees can work at maximum 3 companies', edge)
            ]);
          }
          
          return ConstraintResult.success('roleBasedCard');
        }
      );
      
      registry = registry.withAddedConstraint(roleBasedConstraint);
      validator = validator.withRegistry(registry);
      
      // Manager tries to work at first company - OK
      const managerEdge1 = new Edge('worksAt', 'alice', 'company1');
      const firstResult = validator.validateEdge(storeRoot, managerEdge1);
      expect(firstResult.isValid).toBe(true);
      
      // Add the first edge to the store
      storeRoot = storeRoot.withAddedEdge(managerEdge1);
      
      // Manager tries to work at second company - FAIL
      const managerEdge2 = new Edge('worksAt', 'alice', 'company2');
      
      // Debug: Check current edge count and entity type
      const currentEdges = storeRoot.getEdgesBySource('alice');
      const worksAtCount = Array.from(currentEdges).filter(e => e.type === 'worksAt').length;
      expect(worksAtCount).toBe(1); // Should have 1 edge already
      
      const aliceType = storeRoot.getEntityMetadata?.('alice')?.type;
      expect(aliceType).toBe('Manager'); // Should be Manager
      
      const managerResult = validator.validateEdge(storeRoot, managerEdge2);
      
      if (managerResult.isValid) {
        console.log('Unexpected pass. Violations:', managerResult.violations);
        console.log('Alice type:', aliceType);
        console.log('Current edges:', Array.from(currentEdges));
      }
      
      expect(managerResult.isValid).toBe(false);
      expect(managerResult.violations[0].message).toBe('Managers can only work at one company');
      
      // Employee can work at multiple companies
      const employeeEdge1 = new Edge('worksAt', 'bob', 'company1');
      const employeeResult1 = validator.validateEdge(storeRoot, employeeEdge1);
      
      expect(employeeResult1.isValid).toBe(true);
    });
  });

  describe('Performance and Statistics', () => {
    test('should track validation statistics correctly', () => {
      // Add multiple constraints
      const constraints = [
        new CardinalityConstraint('c1', 'worksAt', 'source', 0, 5),
        new CardinalityConstraint('c2', 'worksAt', 'target', 0, 10),
        new EntityTypeConstraint('c3', 'worksAt', { source: 'Person' }),
        new CustomConstraint('c4', 'worksAt', 'Always passes', 
          () => ConstraintResult.success('c4'))
      ];
      
      constraints.forEach(c => {
        registry = registry.withAddedConstraint(c);
      });
      validator = validator.withRegistry(registry);
      
      // Set up entity type for partial pass
      storeRoot = storeRoot.withEntityType('alice', 'Person');
      
      const edge = new Edge('worksAt', 'alice', 'company1');
      const result = validator.validateEdge(storeRoot, edge);
      
      const stats = result.getValidationStatistics();
      expect(stats.constraintsEvaluated).toBe(4);
      expect(stats.constraintsPassed).toBe(4);
      expect(stats.constraintsFailed).toBe(0);
      
      // Check execution order
      const executionOrder = result.getExecutionOrder();
      expect(executionOrder).toHaveLength(4);
      expect(executionOrder).toContain('c1');
      expect(executionOrder).toContain('c2');
      expect(executionOrder).toContain('c3');
      expect(executionOrder).toContain('c4');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle empty registry gracefully', () => {
      // Empty registry should allow all edges
      const edge = new Edge('worksAt', 'alice', 'company1');
      const result = validator.validateEdge(storeRoot, edge);
      
      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test('should handle constraints for non-existent relation types', () => {
      const constraint = new CardinalityConstraint('c1', 'nonExistentRelation', 'source', 0, 1);
      registry = registry.withAddedConstraint(constraint);
      validator = validator.withRegistry(registry);
      
      // Edge for this relation type
      const edge = new Edge('nonExistentRelation', 'alice', 'bob');
      const result = validator.validateEdge(storeRoot, edge);
      
      // Should still validate (and pass since no edges exist)
      expect(result.isValid).toBe(true);
    });

    test('should handle malformed custom constraints gracefully', () => {
      // Constraint that throws error
      const errorConstraint = new CustomConstraint('error', 'worksAt',
        'Throws error',
        () => {
          throw new Error('Intentional test error');
        }
      );
      
      registry = registry.withAddedConstraint(errorConstraint);
      validator = validator.withRegistry(registry);
      
      const edge = new Edge('worksAt', 'alice', 'company1');
      
      // Should throw wrapped error
      expect(() => validator.validateEdge(storeRoot, edge))
        .toThrow('Custom validation failed: Intentional test error');
    });
  });
});

// Helper functions for complex constraints
function checkForCycle(storeRoot, newEdge) {
  // Simple cycle detection: check if dst can reach src
  const visited = new Set();
  const queue = [newEdge.dst];
  
  while (queue.length > 0) {
    const current = queue.shift();
    
    if (current === newEdge.src) {
      return true; // Found cycle
    }
    
    if (visited.has(current)) {
      continue;
    }
    
    visited.add(current);
    
    // Get all edges where current is source
    const edges = storeRoot.getEdgesBySource(current);
    for (const edge of edges) {
      if (edge.type === 'manages') {
        queue.push(edge.dst);
      }
    }
  }
  
  return false;
}


// Mock extension for ImmutableStoreRoot to support entity types
// Uses WeakMap to store entity types externally since stores are frozen
const storeEntityTypes = new WeakMap();
const originalWithAddedEdge = ImmutableStoreRoot.prototype.withAddedEdge;
const originalWithRemovedEdge = ImmutableStoreRoot.prototype.withRemovedEdge;
const originalWithAddedRelationType = ImmutableStoreRoot.prototype.withAddedRelationType;

// Add getEntityMetadata method to prototype (once)
ImmutableStoreRoot.prototype.getEntityMetadata = function(entityId) {
  const types = storeEntityTypes.get(this);
  return types?.[entityId] ? { type: types[entityId] } : undefined;
};

ImmutableStoreRoot.prototype.withEntityType = function(entityId, type) {
  // Get or create entity types map for this store
  let entityTypes = storeEntityTypes.get(this) || {};
  entityTypes = { ...entityTypes, [entityId]: type };
  storeEntityTypes.set(this, entityTypes);
  
  return this;
};

// Override withAddedEdge to preserve entity types
ImmutableStoreRoot.prototype.withAddedEdge = function(edge) {
  const entityTypes = storeEntityTypes.get(this);
  const newStore = originalWithAddedEdge.call(this, edge);
  
  // Preserve entity types
  if (entityTypes) {
    storeEntityTypes.set(newStore, entityTypes);
  }
  
  return newStore;
};

// Override withRemovedEdge to preserve entity types
ImmutableStoreRoot.prototype.withRemovedEdge = function(edge) {
  const entityTypes = storeEntityTypes.get(this);
  const newStore = originalWithRemovedEdge.call(this, edge);
  
  // Preserve entity types
  if (entityTypes) {
    storeEntityTypes.set(newStore, entityTypes);
  }
  
  return newStore;
};

// Override withAddedRelationType to preserve entity types
ImmutableStoreRoot.prototype.withAddedRelationType = function(relationType) {
  const entityTypes = storeEntityTypes.get(this);
  const newStore = originalWithAddedRelationType.call(this, relationType);
  
  // Preserve entity types
  if (entityTypes) {
    storeEntityTypes.set(newStore, entityTypes);
  }
  
  return newStore;
};