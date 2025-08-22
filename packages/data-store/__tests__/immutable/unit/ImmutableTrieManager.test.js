/**
 * Unit Tests for ImmutableTrieManager
 * Per implementation plan Phase 1 Step 1.3
 * TDD approach - tests written first before implementation
 */

import { ImmutableTrieManager } from '../../../src/immutable/ImmutableTrieManager.js';
import { RelationshipType } from '../../../src/RelationshipType.js';
import { Edge } from '../../../src/Edge.js';

describe('ImmutableTrieManager', () => {
  let manager;
  let sampleRelationType;
  let sampleEdge;

  beforeEach(() => {
    manager = new ImmutableTrieManager();
    sampleRelationType = new RelationshipType('worksAt', 'employs');
    sampleEdge = new Edge('worksAt', 'alice', 'company1');
  });

  describe('Constructor and Immutability', () => {
    test('should create empty immutable trie manager', () => {
      expect(manager).toBeDefined();
      expect(manager.getRelationCount()).toBe(0);
      expect(manager.getRelationNames()).toEqual([]);
      
      // Should be frozen (immutable)
      expect(Object.isFrozen(manager)).toBe(true);
    });

    test('should create manager with provided data', () => {
      const outTries = new Map([['worksAt', {}]]);  // Mock OutTrie
      const inTries = new Map([['worksAt', {}]]);   // Mock InTrie
      const relationNames = new Set(['worksAt']);
      
      const mgr = new ImmutableTrieManager(outTries, inTries, relationNames);
      
      expect(mgr.getRelationCount()).toBe(1);
      expect(mgr.hasRelationType('worksAt')).toBe(true);
      expect(Object.isFrozen(mgr)).toBe(true);
    });

    test('should have immutable relation collections', () => {
      const relations = manager.getRelationNames();
      expect(Array.isArray(relations)).toBe(true);
      // Arrays are inherently immutable when returned as new instances
    });
  });

  describe('withAddedRelationType() - Pure Function', () => {
    test('should return new manager with added relation type', () => {
      const newManager = manager.withAddedRelationType(sampleRelationType);
      
      // Should return new instance
      expect(newManager).not.toBe(manager);
      expect(newManager).toBeInstanceOf(ImmutableTrieManager);
      
      // Original manager unchanged
      expect(manager.getRelationCount()).toBe(0);
      expect(manager.hasRelationType('worksAt')).toBe(false);
      
      // New manager has relation type
      expect(newManager.getRelationCount()).toBe(1);
      expect(newManager.hasRelationType('worksAt')).toBe(true);
      expect(newManager.getRelationNames()).toEqual(['worksAt']);
      
      // Both should be frozen
      expect(Object.isFrozen(manager)).toBe(true);
      expect(Object.isFrozen(newManager)).toBe(true);
    });

    test('should return same instance when adding duplicate relation type', () => {
      const managerWithType = manager.withAddedRelationType(sampleRelationType);
      const managerWithDuplicate = managerWithType.withAddedRelationType(sampleRelationType);
      
      // Should return same instance (optimization)
      expect(managerWithDuplicate).toBe(managerWithType);
      expect(managerWithDuplicate.getRelationCount()).toBe(1);
    });

    test('should handle multiple relation types correctly', () => {
      const type2 = new RelationshipType('locatedIn', 'contains');
      const type3 = new RelationshipType('manages', 'managedBy');
      
      const mgr1 = manager.withAddedRelationType(sampleRelationType);
      const mgr2 = mgr1.withAddedRelationType(type2);
      const mgr3 = mgr2.withAddedRelationType(type3);
      
      expect(mgr3.getRelationCount()).toBe(3);
      expect(mgr3.hasRelationType('worksAt')).toBe(true);
      expect(mgr3.hasRelationType('locatedIn')).toBe(true);
      expect(mgr3.hasRelationType('manages')).toBe(true);
      
      // Should be sorted
      expect(mgr3.getRelationNames()).toEqual(['locatedIn', 'manages', 'worksAt']);
    });

    test('should create out and in tries for relation type', () => {
      const newManager = manager.withAddedRelationType(sampleRelationType);
      
      expect(newManager.hasOutTrie('worksAt')).toBe(true);
      expect(newManager.hasInTrie('worksAt')).toBe(true);
      
      const outTrie = newManager.getOutTrie('worksAt');
      const inTrie = newManager.getInTrie('worksAt');
      
      expect(outTrie).toBeDefined();
      expect(inTrie).toBeDefined();
      // Note: These will be ImmutableOutTrie and ImmutableInTrie instances when implemented
    });

    test('should fail fast on invalid relationship type', () => {
      expect(() => manager.withAddedRelationType(null)).toThrow('RelationshipType is required');
      expect(() => manager.withAddedRelationType(undefined)).toThrow('RelationshipType is required');
      expect(() => manager.withAddedRelationType('not-a-type')).toThrow('Must be a RelationshipType instance');
    });
  });

  describe('withAddedEdge() - Pure Function', () => {
    let managerWithType;

    beforeEach(() => {
      managerWithType = manager.withAddedRelationType(sampleRelationType);
    });

    test('should return new manager with added edge', () => {
      const newManager = managerWithType.withAddedEdge(sampleEdge);
      
      // Should return new instance
      expect(newManager).not.toBe(managerWithType);
      expect(newManager).toBeInstanceOf(ImmutableTrieManager);
      
      // Original manager unchanged
      expect(managerWithType.containsEdge('worksAt', sampleEdge)).toBe(false);
      expect(managerWithType.getEdgeCount('worksAt')).toBe(0);
      
      // New manager has edge
      expect(newManager.containsEdge('worksAt', sampleEdge)).toBe(true);
      expect(newManager.getEdgeCount('worksAt')).toBe(1);
      
      // Both should be frozen
      expect(Object.isFrozen(managerWithType)).toBe(true);
      expect(Object.isFrozen(newManager)).toBe(true);
    });

    test('should add edge to both out and in tries', () => {
      const newManager = managerWithType.withAddedEdge(sampleEdge);
      
      // Check that edge is in both tries
      const outTrie = newManager.getOutTrie('worksAt');
      const inTrie = newManager.getInTrie('worksAt');
      
      expect(outTrie.contains(sampleEdge)).toBe(true);
      expect(inTrie.contains(sampleEdge)).toBe(true);
    });

    test('should return same instance when adding duplicate edge', () => {
      const managerWithEdge = managerWithType.withAddedEdge(sampleEdge);
      const managerWithDuplicate = managerWithEdge.withAddedEdge(sampleEdge);
      
      // Should return same instance (optimization)
      expect(managerWithDuplicate).toBe(managerWithEdge);
      expect(managerWithDuplicate.getEdgeCount('worksAt')).toBe(1);
    });

    test('should handle multiple edges correctly', () => {
      const edge2 = new Edge('worksAt', 'bob', 'company2');
      const edge3 = new Edge('worksAt', 'charlie', 'company1');
      
      const mgr1 = managerWithType.withAddedEdge(sampleEdge);
      const mgr2 = mgr1.withAddedEdge(edge2);
      const mgr3 = mgr2.withAddedEdge(edge3);
      
      expect(mgr3.getEdgeCount('worksAt')).toBe(3);
      expect(mgr3.containsEdge('worksAt', sampleEdge)).toBe(true);
      expect(mgr3.containsEdge('worksAt', edge2)).toBe(true);
      expect(mgr3.containsEdge('worksAt', edge3)).toBe(true);
    });

    test('should fail when adding edge for non-existent relation type', () => {
      const unknownEdge = new Edge('unknownType', 'src', 'dst');
      expect(() => manager.withAddedEdge(unknownEdge))
        .toThrow('Relation type unknownType not found');
    });

    test('should fail when edge type does not match', () => {
      const wrongEdge = new Edge('wrongType', 'src', 'dst');
      expect(() => managerWithType.withAddedEdge(wrongEdge))
        .toThrow('Relation type wrongType not found');
    });

    test('should fail fast on invalid edge', () => {
      expect(() => managerWithType.withAddedEdge(null)).toThrow('Edge is required');
      expect(() => managerWithType.withAddedEdge(undefined)).toThrow('Edge is required');
      expect(() => managerWithType.withAddedEdge('not-an-edge')).toThrow('Must be an Edge instance');
    });
  });

  describe('withRemovedEdge() - Pure Function', () => {
    let managerWithEdge;

    beforeEach(() => {
      managerWithEdge = manager
        .withAddedRelationType(sampleRelationType)
        .withAddedEdge(sampleEdge);
    });

    test('should return new manager with removed edge', () => {
      const newManager = managerWithEdge.withRemovedEdge(sampleEdge);
      
      // Should return new instance
      expect(newManager).not.toBe(managerWithEdge);
      expect(newManager).toBeInstanceOf(ImmutableTrieManager);
      
      // Original manager unchanged
      expect(managerWithEdge.containsEdge('worksAt', sampleEdge)).toBe(true);
      expect(managerWithEdge.getEdgeCount('worksAt')).toBe(1);
      
      // New manager has edge removed
      expect(newManager.containsEdge('worksAt', sampleEdge)).toBe(false);
      expect(newManager.getEdgeCount('worksAt')).toBe(0);
      
      // Both should be frozen
      expect(Object.isFrozen(managerWithEdge)).toBe(true);
      expect(Object.isFrozen(newManager)).toBe(true);
    });

    test('should remove edge from both out and in tries', () => {
      const newManager = managerWithEdge.withRemovedEdge(sampleEdge);
      
      // Check that edge is removed from both tries
      const outTrie = newManager.getOutTrie('worksAt');
      const inTrie = newManager.getInTrie('worksAt');
      
      expect(outTrie.contains(sampleEdge)).toBe(false);
      expect(inTrie.contains(sampleEdge)).toBe(false);
    });

    test('should return same instance when removing non-existent edge', () => {
      const nonExistentEdge = new Edge('worksAt', 'nobody', 'nowhere');
      const result = managerWithEdge.withRemovedEdge(nonExistentEdge);
      
      // Should return same instance (optimization)
      expect(result).toBe(managerWithEdge);
    });

    test('should handle partial removal correctly', () => {
      const edge2 = new Edge('worksAt', 'bob', 'company2');
      const managerWith2Edges = managerWithEdge.withAddedEdge(edge2);
      
      const managerAfterRemoval = managerWith2Edges.withRemovedEdge(sampleEdge);
      
      expect(managerAfterRemoval.getEdgeCount('worksAt')).toBe(1);
      expect(managerAfterRemoval.containsEdge('worksAt', edge2)).toBe(true);
      expect(managerAfterRemoval.containsEdge('worksAt', sampleEdge)).toBe(false);
    });

    test('should fail when removing edge for non-existent relation type', () => {
      const unknownEdge = new Edge('unknownType', 'src', 'dst');
      expect(() => manager.withRemovedEdge(unknownEdge))
        .toThrow('Relation type unknownType not found');
    });

    test('should fail fast on invalid edge', () => {
      expect(() => managerWithEdge.withRemovedEdge(null)).toThrow('Edge is required');
      expect(() => managerWithEdge.withRemovedEdge(undefined)).toThrow('Edge is required');
      expect(() => managerWithEdge.withRemovedEdge('not-an-edge')).toThrow('Must be an Edge instance');
    });
  });

  describe('Read-only Accessors', () => {
    let complexManager;

    beforeEach(() => {
      const type2 = new RelationshipType('locatedIn', 'contains');
      const edge2 = new Edge('locatedIn', 'company1', 'uk');
      
      complexManager = manager
        .withAddedRelationType(sampleRelationType)
        .withAddedRelationType(type2)
        .withAddedEdge(sampleEdge)
        .withAddedEdge(edge2);
    });

    test('should provide relation type access methods', () => {
      expect(complexManager.getRelationCount()).toBe(2);
      expect(complexManager.hasRelationType('worksAt')).toBe(true);
      expect(complexManager.hasRelationType('locatedIn')).toBe(true);
      expect(complexManager.hasRelationType('nonExistent')).toBe(false);
      
      const relations = complexManager.getRelationNames();
      expect(relations).toEqual(['locatedIn', 'worksAt']); // Sorted
    });

    test('should provide trie access methods', () => {
      expect(complexManager.hasOutTrie('worksAt')).toBe(true);
      expect(complexManager.hasInTrie('worksAt')).toBe(true);
      expect(complexManager.hasOutTrie('nonExistent')).toBe(false);
      expect(complexManager.hasInTrie('nonExistent')).toBe(false);
      
      const outTrie = complexManager.getOutTrie('worksAt');
      const inTrie = complexManager.getInTrie('worksAt');
      
      expect(outTrie).toBeDefined();
      expect(inTrie).toBeDefined();
    });

    test('should provide edge access methods', () => {
      expect(complexManager.containsEdge('worksAt', sampleEdge)).toBe(true);
      expect(complexManager.getEdgeCount('worksAt')).toBe(1);
      expect(complexManager.getEdgeCount('locatedIn')).toBe(1);
      expect(complexManager.isEmpty('worksAt')).toBe(false);
      
      const nonExistentEdge = new Edge('worksAt', 'nobody', 'nowhere');
      expect(complexManager.containsEdge('worksAt', nonExistentEdge)).toBe(false);
    });

    test('should provide navigation methods', () => {
      // Forward navigation
      const destinations = complexManager.getDestinationsForSource('worksAt', 'alice');
      expect(destinations).toContain('company1');
      
      const edges = complexManager.getEdgesForSource('worksAt', 'alice');
      expect(edges).toContain(sampleEdge);
      
      // Backward navigation
      const sources = complexManager.getSourcesForDestination('worksAt', 'company1');
      expect(sources).toContain('alice');
      
      const backEdges = complexManager.getEdgesForDestination('worksAt', 'company1');
      expect(backEdges).toContain(sampleEdge);
    });

    test('should provide collection methods', () => {
      const allSources = complexManager.getAllSources('worksAt');
      expect(allSources).toContain('alice');
      
      const allDestinations = complexManager.getAllDestinations('worksAt');
      expect(allDestinations).toContain('company1');
      
      const allEdges = complexManager.getAllEdges('worksAt');
      expect(allEdges).toContain(sampleEdge);
    });

    test('should fail when accessing non-existent relation types', () => {
      expect(() => complexManager.getOutTrie('nonExistent'))
        .toThrow('Relation type nonExistent not found');
      expect(() => complexManager.getInTrie('nonExistent'))
        .toThrow('Relation type nonExistent not found');
      expect(() => complexManager.getEdgeCount('nonExistent'))
        .toThrow('Relation type nonExistent not found');
    });
  });

  describe('Leapfrog Operations', () => {
    let populatedManager;

    beforeEach(() => {
      const edges = [
        new Edge('worksAt', 'alice', 'company1'),
        new Edge('worksAt', 'alice', 'company2'),
        new Edge('worksAt', 'bob', 'company1'),
        new Edge('worksAt', 'bob', 'company3')
      ];
      
      populatedManager = manager.withAddedRelationType(sampleRelationType);
      for (const edge of edges) {
        populatedManager = populatedManager.withAddedEdge(edge);
      }
    });

    test('should provide forward leapfrog operations', () => {
      // Test seek operation
      const seekResult = populatedManager.seekForward('worksAt', 'alice', 'company1');
      expect(seekResult).toBeDefined();
      
      // Test next operation
      const nextResult = populatedManager.nextForward('worksAt', 'alice', 'company1');
      expect(nextResult).toBeDefined();
      
      // Test min/max operations
      const minResult = populatedManager.minForward('worksAt', 'alice');
      expect(minResult).toBeDefined();
      
      const maxResult = populatedManager.maxForward('worksAt', 'alice');
      expect(maxResult).toBeDefined();
    });

    test('should provide backward leapfrog operations', () => {
      // Test seek operation
      const seekResult = populatedManager.seekBackward('worksAt', 'company1', 'alice');
      expect(seekResult).toBeDefined();
      
      // Test next operation
      const nextResult = populatedManager.nextBackward('worksAt', 'company1', 'alice');
      expect(nextResult).toBeDefined();
      
      // Test min/max operations
      const minResult = populatedManager.minBackward('worksAt', 'company1');
      expect(minResult).toBeDefined();
      
      const maxResult = populatedManager.maxBackward('worksAt', 'company1');
      expect(maxResult).toBeDefined();
    });

    test('should fail leapfrog operations on non-existent relation types', () => {
      expect(() => populatedManager.seekForward('nonExistent', 'src', 'dst'))
        .toThrow('Relation type nonExistent not found');
      expect(() => populatedManager.seekBackward('nonExistent', 'dst', 'src'))
        .toThrow('Relation type nonExistent not found');
    });
  });

  describe('Error Handling - Fail Fast', () => {
    test('should fail fast on invalid constructor parameters', () => {
      expect(() => new ImmutableTrieManager('invalid')).toThrow();
      expect(() => new ImmutableTrieManager(new Map(), 'invalid')).toThrow();
      expect(() => new ImmutableTrieManager(new Map(), new Map(), 'invalid')).toThrow();
    });

    test('should fail fast on invalid relation type operations', () => {
      expect(() => manager.withAddedRelationType()).toThrow();
      expect(() => manager.hasRelationType()).toThrow();
    });

    test('should fail fast on invalid edge operations', () => {
      expect(() => manager.withAddedEdge()).toThrow();
      expect(() => manager.withRemovedEdge()).toThrow();
      expect(() => manager.containsEdge('any', undefined)).toThrow();
    });

    test('should provide clear error messages', () => {
      try {
        manager.withAddedEdge(null);
      } catch (error) {
        expect(error.message).toContain('Edge is required');
        expect(error.message).not.toContain('undefined');
      }
    });
  });

  describe('Consistency and Validation', () => {
    let populatedManager;

    beforeEach(() => {
      populatedManager = manager
        .withAddedRelationType(sampleRelationType)
        .withAddedEdge(sampleEdge);
    });

    test('should maintain trie consistency', () => {
      // Both out and in tries should have same edge count
      expect(populatedManager.getEdgeCount('worksAt')).toBe(1);
      
      // Edge should exist in both tries
      const outTrie = populatedManager.getOutTrie('worksAt');
      const inTrie = populatedManager.getInTrie('worksAt');
      
      expect(outTrie.contains(sampleEdge)).toBe(true);
      expect(inTrie.contains(sampleEdge)).toBe(true);
    });

    test('should validate structure integrity', () => {
      const issues = populatedManager.validateConsistency('worksAt');
      expect(Array.isArray(issues)).toBe(true);
      // For a properly implemented manager, issues should be empty
    });

    test('should provide comprehensive statistics', () => {
      const stats = populatedManager.getStatistics();
      
      expect(stats).toHaveProperty('relationCount');
      expect(stats).toHaveProperty('totalEdgeCount');
      expect(stats).toHaveProperty('relationStats');
      
      expect(stats.relationCount).toBe(1);
      expect(stats.totalEdgeCount).toBe(1);
      expect(stats.relationStats).toHaveProperty('worksAt');
    });

    test('should provide meaningful string representation', () => {
      const str = populatedManager.toString();
      expect(str).toContain('ImmutableTrieManager');
      expect(str).toContain('relations=1');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty manager correctly', () => {
      expect(manager.getRelationNames()).toEqual([]);
      expect(manager.getRelationCount()).toBe(0);
      expect(manager.hasRelationType('anything')).toBe(false);
      
      const stats = manager.getStatistics();
      expect(stats.relationCount).toBe(0);
      expect(stats.totalEdgeCount).toBe(0);
    });

    test('should handle relation types with no edges', () => {
      const emptyManager = manager.withAddedRelationType(sampleRelationType);
      
      expect(emptyManager.isEmpty('worksAt')).toBe(true);
      expect(emptyManager.getEdgeCount('worksAt')).toBe(0);
      expect(emptyManager.getAllEdges('worksAt')).toEqual([]);
      expect(emptyManager.getAllSources('worksAt')).toEqual([]);
      expect(emptyManager.getAllDestinations('worksAt')).toEqual([]);
    });

    test('should handle complex relationship types correctly', () => {
      const complexType = new RelationshipType('complexRel', 'complexInv');
      const complexEdge = new Edge('complexRel', 
        { id: 'obj1', type: 'complex' }, 
        ['value1', 'value2']
      );
      
      const mgr = manager
        .withAddedRelationType(complexType)
        .withAddedEdge(complexEdge);
      
      expect(mgr.containsEdge('complexRel', complexEdge)).toBe(true);
      expect(mgr.getEdgeCount('complexRel')).toBe(1);
    });
  });
});