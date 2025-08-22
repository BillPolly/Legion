/**
 * Unit Tests for ImmutableStoreRoot
 * Per implementation plan Phase 1 Step 1.1
 * TDD approach - tests written first before implementation
 */

import { Edge } from '../../../src/Edge.js';
import { RelationshipType } from '../../../src/RelationshipType.js';
import { ImmutableStoreRoot } from '../../../src/immutable/ImmutableStoreRoot.js';
import { ImmutableTrieManager } from '../../../src/immutable/ImmutableTrieManager.js';

describe('ImmutableStoreRoot', () => {
  let storeRoot;
  let sampleEdge;
  let sampleRelationshipType;

  beforeEach(() => {
    sampleRelationshipType = new RelationshipType('worksAt', 'employs');
    storeRoot = new ImmutableStoreRoot()
      .withAddedRelationType(sampleRelationshipType);
    sampleEdge = new Edge('worksAt', 'alice', 'company1');
  });

  describe('Constructor and Immutability', () => {
    test('should create empty immutable store root', () => {
      const emptyRoot = new ImmutableStoreRoot();
      expect(emptyRoot).toBeDefined();
      expect(emptyRoot.getEdgeCount()).toBe(0);
      expect(emptyRoot.getRelationshipTypes().size).toBe(0);
      
      // Should be frozen (immutable)
      expect(Object.isFrozen(emptyRoot)).toBe(true);
    });

    test('should create store root with provided data', () => {
      const edges = new Map([['worksAt:alice:company1', sampleEdge]]);
      const edgesByType = new Map([['worksAt', new Set([sampleEdge])]]);
      const relationshipTypes = new Map([['worksAt', sampleRelationshipType]]);

      const root = new ImmutableStoreRoot(
        edges,
        edgesByType,
        new Map(),
        new Map(),
        relationshipTypes
      );

      expect(root.getEdgeCount()).toBe(1);
      expect(root.getRelationshipTypes().size).toBe(1);
      expect(Object.isFrozen(root)).toBe(true);
    });

    test('should have metadata with version and edge count', () => {
      const metadata = storeRoot.getMetadata();
      
      expect(metadata).toHaveProperty('version');
      expect(metadata).toHaveProperty('edgeCount');
      expect(typeof metadata.version).toBe('number');
      expect(metadata.edgeCount).toBe(0);
    });

    test('should not allow mutation of returned collections', () => {
      const edges = storeRoot.getEdges();
      const relationshipTypes = storeRoot.getRelationshipTypes();
      
      expect(Object.isFrozen(edges)).toBe(true);
      expect(Object.isFrozen(relationshipTypes)).toBe(true);
    });
  });

  describe('withAddedEdge() - Pure Function', () => {
    test('should return new root with added edge', () => {
      // First add relation type
      const rootWithType = storeRoot.withAddedRelationType(sampleRelationshipType);
      const newRoot = rootWithType.withAddedEdge(sampleEdge);
      
      // Should return new instance
      expect(newRoot).not.toBe(rootWithType);
      expect(newRoot).toBeInstanceOf(ImmutableStoreRoot);
      
      // Original root unchanged
      expect(storeRoot.getEdgeCount()).toBe(0);
      expect(storeRoot.hasEdge(sampleEdge)).toBe(false);
      expect(rootWithType.getEdgeCount()).toBe(0);
      expect(rootWithType.hasEdge(sampleEdge)).toBe(false);
      
      // New root has edge
      expect(newRoot.getEdgeCount()).toBe(1);
      expect(newRoot.hasEdge(sampleEdge)).toBe(true);
      
      // Both should be frozen
      expect(Object.isFrozen(storeRoot)).toBe(true);
      expect(Object.isFrozen(newRoot)).toBe(true);
    });

    test('should add edge to all indexes', () => {
      const rootWithType = storeRoot.withAddedRelationType(sampleRelationshipType);
      const newRoot = rootWithType.withAddedEdge(sampleEdge);
      
      // Check global edges map
      expect(newRoot.getEdges().has('worksAt:"alice":"company1"')).toBe(true);
      
      // Check type index
      const typeEdges = newRoot.getEdgesByType('worksAt');
      expect(typeEdges.has(sampleEdge)).toBe(true);
      
      // Check source index
      const sourceEdges = newRoot.getEdgesBySource('alice');
      expect(sourceEdges.has(sampleEdge)).toBe(true);
      
      // Check destination index
      const destEdges = newRoot.getEdgesByDestination('company1');
      expect(destEdges.has(sampleEdge)).toBe(true);
    });

    test('should return same instance when adding duplicate edge', () => {
      const rootWithType = storeRoot.withAddedRelationType(sampleRelationshipType);
      const rootWithEdge = rootWithType.withAddedEdge(sampleEdge);
      const rootWithDuplicate = rootWithEdge.withAddedEdge(sampleEdge);
      
      // Should return same instance (optimization)
      expect(rootWithDuplicate).toBe(rootWithEdge);
      expect(rootWithDuplicate.getEdgeCount()).toBe(1);
    });

    test('should handle multiple different edges', () => {
      const edge2 = new Edge('worksAt', 'bob', 'company2');
      const edge3 = new Edge('locatedIn', 'company1', 'uk');
      
      // Add locatedIn relation type first
      const rootWithRelTypes = storeRoot
        .withAddedRelationType(new RelationshipType('locatedIn', 'locates'));
      
      const root1 = rootWithRelTypes.withAddedEdge(sampleEdge);
      const root2 = root1.withAddedEdge(edge2);
      const root3 = root2.withAddedEdge(edge3);
      
      expect(root3.getEdgeCount()).toBe(3);
      expect(root3.hasEdge(sampleEdge)).toBe(true);
      expect(root3.hasEdge(edge2)).toBe(true);
      expect(root3.hasEdge(edge3)).toBe(true);
      
      // Check type indexing
      expect(root3.getEdgesByType('worksAt').size).toBe(2);
      expect(root3.getEdgesByType('locatedIn').size).toBe(1);
    });

    test('should update metadata correctly', () => {
      const originalVersion = storeRoot.getMetadata().version;
      const newRoot = storeRoot.withAddedEdge(sampleEdge);
      const metadata = newRoot.getMetadata();
      
      expect(metadata.edgeCount).toBe(1);
      expect(metadata.version).toBeGreaterThanOrEqual(originalVersion);
      expect(metadata.operation).toBe('addEdge');
      expect(metadata.edge).toBe(sampleEdge.toString());
    });

    test('should fail fast on invalid edge', () => {
      expect(() => storeRoot.withAddedEdge(null)).toThrow('Edge is required');
      expect(() => storeRoot.withAddedEdge(undefined)).toThrow('Edge is required');
      expect(() => storeRoot.withAddedEdge('not-an-edge')).toThrow('Must be an Edge instance');
    });
  });

  describe('withRemovedEdge() - Pure Function', () => {
    let rootWithEdge;

    beforeEach(() => {
      rootWithEdge = storeRoot.withAddedEdge(sampleEdge);
    });

    test('should return new root with removed edge', () => {
      const newRoot = rootWithEdge.withRemovedEdge(sampleEdge);
      
      // Should return new instance
      expect(newRoot).not.toBe(rootWithEdge);
      expect(newRoot).toBeInstanceOf(ImmutableStoreRoot);
      
      // Original root unchanged
      expect(rootWithEdge.getEdgeCount()).toBe(1);
      expect(rootWithEdge.hasEdge(sampleEdge)).toBe(true);
      
      // New root has edge removed
      expect(newRoot.getEdgeCount()).toBe(0);
      expect(newRoot.hasEdge(sampleEdge)).toBe(false);
      
      // Both should be frozen
      expect(Object.isFrozen(rootWithEdge)).toBe(true);
      expect(Object.isFrozen(newRoot)).toBe(true);
    });

    test('should remove edge from all indexes', () => {
      const newRoot = rootWithEdge.withRemovedEdge(sampleEdge);
      
      // Check global edges map
      expect(newRoot.getEdges().has('worksAt:"alice":"company1"')).toBe(false);
      
      // Check type index
      const typeEdges = newRoot.getEdgesByType('worksAt');
      expect(typeEdges.has(sampleEdge)).toBe(false);
      expect(typeEdges.size).toBe(0);
      
      // Check source index
      const sourceEdges = newRoot.getEdgesBySource('alice');
      expect(sourceEdges.has(sampleEdge)).toBe(false);
      expect(sourceEdges.size).toBe(0);
      
      // Check destination index
      const destEdges = newRoot.getEdgesByDestination('company1');
      expect(destEdges.has(sampleEdge)).toBe(false);
      expect(destEdges.size).toBe(0);
    });

    test('should return same instance when removing non-existent edge', () => {
      const nonExistentEdge = new Edge('worksAt', 'charlie', 'company3');
      const result = rootWithEdge.withRemovedEdge(nonExistentEdge);
      
      // Should return same instance (optimization)
      expect(result).toBe(rootWithEdge);
    });

    test('should handle partial removal correctly', () => {
      const edge2 = new Edge('worksAt', 'bob', 'company1');
      const rootWithTwoEdges = rootWithEdge.withAddedEdge(edge2);
      
      const rootAfterRemoval = rootWithTwoEdges.withRemovedEdge(sampleEdge);
      
      expect(rootAfterRemoval.getEdgeCount()).toBe(1);
      expect(rootAfterRemoval.hasEdge(edge2)).toBe(true);
      expect(rootAfterRemoval.hasEdge(sampleEdge)).toBe(false);
      
      // Type index should still exist with remaining edge
      expect(rootAfterRemoval.getEdgesByType('worksAt').size).toBe(1);
      expect(rootAfterRemoval.getEdgesByType('worksAt').has(edge2)).toBe(true);
    });

    test('should clean up empty indexes', () => {
      const newRoot = rootWithEdge.withRemovedEdge(sampleEdge);
      
      // Empty sets should be cleaned up
      expect(newRoot.getEdgesByType('worksAt').size).toBe(0);
      expect(newRoot.getEdgesBySource('alice').size).toBe(0);
      expect(newRoot.getEdgesByDestination('company1').size).toBe(0);
    });

    test('should update metadata correctly', () => {
      const newRoot = rootWithEdge.withRemovedEdge(sampleEdge);
      const metadata = newRoot.getMetadata();
      
      expect(metadata.edgeCount).toBe(0);
      expect(metadata.version).toBeDefined();
      expect(typeof metadata.version).toBe('number');
      expect(metadata.operation).toBe('removeEdge');
      expect(metadata.edge).toBe(sampleEdge.toString());
    });

    test('should fail fast on invalid edge', () => {
      expect(() => rootWithEdge.withRemovedEdge(null)).toThrow('Edge is required');
      expect(() => rootWithEdge.withRemovedEdge(undefined)).toThrow('Edge is required');
      expect(() => rootWithEdge.withRemovedEdge('not-an-edge')).toThrow('Must be an Edge instance');
    });
  });

  describe('withAddedRelationType() - Pure Function', () => {
    test('should return new root with added relationship type', () => {
      const emptyRoot = new ImmutableStoreRoot();
      const newRelType = new RelationshipType('manages', 'managedBy');
      const newRoot = emptyRoot.withAddedRelationType(newRelType);
      
      // Should return new instance
      expect(newRoot).not.toBe(emptyRoot);
      expect(newRoot).toBeInstanceOf(ImmutableStoreRoot);
      
      // Original root unchanged
      expect(emptyRoot.hasRelationType('manages')).toBe(false);
      
      // New root has relationship type
      expect(newRoot.hasRelationType('manages')).toBe(true);
      expect(newRoot.getRelationshipTypes().get('manages')).toBe(newRelType);
      
      // Both should be frozen
      expect(Object.isFrozen(emptyRoot)).toBe(true);
      expect(Object.isFrozen(newRoot)).toBe(true);
    });

    test('should return same instance when adding duplicate relationship type', () => {
      const rootWithType = storeRoot.withAddedRelationType(sampleRelationshipType);
      const rootWithDuplicate = rootWithType.withAddedRelationType(sampleRelationshipType);
      
      // Should return same instance (optimization)
      expect(rootWithDuplicate).toBe(rootWithType);
    });

    test('should update metadata correctly', () => {
      const emptyRoot = new ImmutableStoreRoot();
      const newRelType = new RelationshipType('manages', 'managedBy');
      const newRoot = emptyRoot.withAddedRelationType(newRelType);
      const metadata = newRoot.getMetadata();
      
      expect(metadata.version).toBeDefined();
      expect(typeof metadata.version).toBe('number');
      expect(metadata.operation).toBe('addRelationType');
      expect(metadata.type).toBe('manages');
    });

    test('should fail fast on invalid relationship type', () => {
      expect(() => storeRoot.withAddedRelationType(null)).toThrow('RelationshipType is required');
      expect(() => storeRoot.withAddedRelationType(undefined)).toThrow('RelationshipType is required');
      expect(() => storeRoot.withAddedRelationType('not-a-type')).toThrow('Must be a RelationshipType instance');
    });
  });

  describe('Read-only Accessors', () => {
    let populatedRoot;

    beforeEach(() => {
      populatedRoot = storeRoot
        .withAddedRelationType(sampleRelationshipType)
        .withAddedEdge(sampleEdge)
        .withAddedEdge(new Edge('worksAt', 'bob', 'company2'));
    });

    test('getEdges() should return immutable edges map', () => {
      const edges = populatedRoot.getEdges();
      
      expect(edges).toBeInstanceOf(Map);
      expect(edges.size).toBe(2);
      expect(Object.isFrozen(edges)).toBe(true);
      
      // Should not allow mutations
      expect(() => edges.set('test', 'value')).toThrow();
    });

    test('getEdgesByType() should return immutable set', () => {
      const typeEdges = populatedRoot.getEdgesByType('worksAt');
      
      expect(typeEdges).toBeInstanceOf(Set);
      expect(typeEdges.size).toBe(2);
      expect(Object.isFrozen(typeEdges)).toBe(true);
      
      // Should return empty set for non-existent type
      const emptySet = populatedRoot.getEdgesByType('nonExistent');
      expect(emptySet.size).toBe(0);
    });

    test('getEdgesBySource() should return immutable set', () => {
      const sourceEdges = populatedRoot.getEdgesBySource('alice');
      
      expect(sourceEdges).toBeInstanceOf(Set);
      expect(sourceEdges.size).toBe(1);
      expect(Object.isFrozen(sourceEdges)).toBe(true);
      
      // Should return empty set for non-existent source
      const emptySet = populatedRoot.getEdgesBySource('nonExistent');
      expect(emptySet.size).toBe(0);
    });

    test('getEdgesByDestination() should return immutable set', () => {
      const destEdges = populatedRoot.getEdgesByDestination('company1');
      
      expect(destEdges).toBeInstanceOf(Set);
      expect(destEdges.size).toBe(1);
      expect(Object.isFrozen(destEdges)).toBe(true);
      
      // Should return empty set for non-existent destination
      const emptySet = populatedRoot.getEdgesByDestination('nonExistent');
      expect(emptySet.size).toBe(0);
    });

    test('getRelationshipTypes() should return immutable map', () => {
      const types = populatedRoot.getRelationshipTypes();
      
      expect(types).toBeInstanceOf(Map);
      expect(types.size).toBe(1);
      expect(Object.isFrozen(types)).toBe(true);
      expect(types.get('worksAt')).toBe(sampleRelationshipType);
    });

    test('hasEdge() should correctly identify edge existence', () => {
      expect(populatedRoot.hasEdge(sampleEdge)).toBe(true);
      
      const nonExistentEdge = new Edge('worksAt', 'charlie', 'company3');
      expect(populatedRoot.hasEdge(nonExistentEdge)).toBe(false);
    });

    test('hasRelationType() should correctly identify relationship type existence', () => {
      expect(populatedRoot.hasRelationType('worksAt')).toBe(true);
      expect(populatedRoot.hasRelationType('nonExistent')).toBe(false);
    });

    test('getEdgeCount() should return correct count', () => {
      expect(populatedRoot.getEdgeCount()).toBe(2);
      const emptyRoot = new ImmutableStoreRoot();
      expect(emptyRoot.getEdgeCount()).toBe(0);
    });
  });

  describe('Edge Key Generation', () => {
    test('should generate consistent edge keys', () => {
      const edge1 = new Edge('worksAt', 'alice', 'company1');
      const edge2 = new Edge('worksAt', 'alice', 'company1');
      
      // Same edges should generate same keys
      const root1 = storeRoot.withAddedEdge(edge1);
      const root2 = root1.withAddedEdge(edge2);
      
      // Should be treated as duplicate
      expect(root2).toBe(root1);
      expect(root2.getEdgeCount()).toBe(1);
    });

    test('should handle complex values in edge keys', () => {
      const complexEdge = new Edge('hasProperty', { id: 'obj1', type: 'complex' }, ['val1', 'val2']);
      
      // Add hasProperty relation type first
      const rootWithRelType = storeRoot.withAddedRelationType(new RelationshipType('hasProperty', 'propertyOf'));
      const newRoot = rootWithRelType.withAddedEdge(complexEdge);
      expect(newRoot.hasEdge(complexEdge)).toBe(true);
      expect(newRoot.getEdgeCount()).toBe(1);
    });
  });

  describe('Error Handling - Fail Fast', () => {
    test('should fail fast on invalid constructor parameters', () => {
      expect(() => new ImmutableStoreRoot('invalid')).toThrow();
      expect(() => new ImmutableStoreRoot(new Map(), 'invalid')).toThrow();
    });

    test('should fail fast on invalid edge operations', () => {
      expect(() => storeRoot.withAddedEdge()).toThrow();
      expect(() => storeRoot.withRemovedEdge()).toThrow();
      expect(() => storeRoot.hasEdge()).toThrow();
    });

    test('should fail fast on invalid relationship type operations', () => {
      expect(() => storeRoot.withAddedRelationType()).toThrow();
      expect(() => storeRoot.hasRelationType()).toThrow();
    });

    test('should provide clear error messages', () => {
      try {
        storeRoot.withAddedEdge(null);
      } catch (error) {
        expect(error.message).toContain('Edge is required');
        expect(error.message).not.toContain('undefined');
      }
    });
  });
});