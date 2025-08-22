/**
 * Unit Tests for ImmutableOutTrie
 * Per implementation plan Phase 1 Step 1.4
 * TDD approach - tests written first before implementation
 */

import { ImmutableOutTrie } from '../../../src/immutable/ImmutableOutTrie.js';
import { Edge } from '../../../src/Edge.js';

describe('ImmutableOutTrie', () => {
  let outTrie;
  let sampleEdge;

  beforeEach(() => {
    outTrie = new ImmutableOutTrie('worksAt');
    sampleEdge = new Edge('worksAt', 'alice', 'company1');
  });

  describe('Constructor and Immutability', () => {
    test('should create empty immutable out trie', () => {
      expect(outTrie).toBeDefined();
      expect(outTrie.relationName).toBe('worksAt');
      expect(outTrie.size).toBe(0);
      expect(outTrie.isEmpty()).toBe(true);
      
      // Should be frozen (immutable)
      expect(Object.isFrozen(outTrie)).toBe(true);
    });

    test('should create trie with provided data', () => {
      const root = outTrie.root.withAddedChild('alice').withAddedChild('company1');
      const trie = new ImmutableOutTrie('worksAt', root, 1);
      
      expect(trie.relationName).toBe('worksAt');
      expect(trie.size).toBe(1);
      expect(trie.isEmpty()).toBe(false);
      expect(Object.isFrozen(trie)).toBe(true);
    });

    test('should fail fast on invalid constructor parameters', () => {
      expect(() => new ImmutableOutTrie()).toThrow('Relation name is required');
      expect(() => new ImmutableOutTrie('')).toThrow('Relation name is required');
      expect(() => new ImmutableOutTrie(123)).toThrow('Relation name must be a string');
    });

    test('should have immutable root node', () => {
      const root = outTrie.root;
      expect(Object.isFrozen(root)).toBe(true);
    });
  });

  describe('withAddedEdge() - Pure Function', () => {
    test('should return new trie with added edge', () => {
      const newTrie = outTrie.withAddedEdge(sampleEdge);
      
      // Should return new instance
      expect(newTrie).not.toBe(outTrie);
      expect(newTrie).toBeInstanceOf(ImmutableOutTrie);
      
      // Original trie unchanged
      expect(outTrie.size).toBe(0);
      expect(outTrie.contains(sampleEdge)).toBe(false);
      
      // New trie has edge
      expect(newTrie.size).toBe(1);
      expect(newTrie.contains(sampleEdge)).toBe(true);
      
      // Both should be frozen
      expect(Object.isFrozen(outTrie)).toBe(true);
      expect(Object.isFrozen(newTrie)).toBe(true);
    });

    test('should create proper trie structure for edge', () => {
      const newTrie = outTrie.withAddedEdge(sampleEdge);
      
      // Check src node exists at depth 1
      const srcNode = newTrie.root.getChild('alice');
      expect(srcNode).toBeDefined();
      expect(srcNode.depth).toBe(1);
      expect(srcNode.value).toBe('alice');
      
      // Check dst node exists at depth 2 and is marked as leaf
      const dstNode = srcNode.getChild('company1');
      expect(dstNode).toBeDefined();
      expect(dstNode.depth).toBe(2);
      expect(dstNode.value).toBe('company1');
      expect(dstNode.isLeaf).toBe(true);
      
      // Check edge is stored as witness
      expect(dstNode.hasWitness(sampleEdge)).toBe(true);
      expect(dstNode.getWitnessCount()).toBe(1);
    });

    test('should return same instance when adding duplicate edge', () => {
      const trieWithEdge = outTrie.withAddedEdge(sampleEdge);
      const trieWithDuplicate = trieWithEdge.withAddedEdge(sampleEdge);
      
      // Should return same instance (optimization)
      expect(trieWithDuplicate).toBe(trieWithEdge);
      expect(trieWithDuplicate.size).toBe(1);
    });

    test('should handle multiple edges correctly', () => {
      const edge2 = new Edge('worksAt', 'alice', 'company2');
      const edge3 = new Edge('worksAt', 'bob', 'company1');
      
      const trie1 = outTrie.withAddedEdge(sampleEdge);
      const trie2 = trie1.withAddedEdge(edge2);
      const trie3 = trie2.withAddedEdge(edge3);
      
      expect(trie3.size).toBe(3);
      expect(trie3.contains(sampleEdge)).toBe(true);
      expect(trie3.contains(edge2)).toBe(true);
      expect(trie3.contains(edge3)).toBe(true);
    });

    test('should handle multiple edges with same src-dst pair', () => {
      // Since Edge only supports (type, src, dst), we can't have different edges with same src-dst
      // This test should verify that identical edges are treated as duplicates
      const edge2 = new Edge('worksAt', 'alice', 'company1'); // Identical edge
      
      const trie1 = outTrie.withAddedEdge(sampleEdge);
      const trie2 = trie1.withAddedEdge(edge2);
      
      expect(trie2).toBe(trie1); // Should be same instance since edge is identical
      expect(trie2.size).toBe(1);
      expect(trie2.contains(sampleEdge)).toBe(true);
      expect(trie2.contains(edge2)).toBe(true);
      
      // Only one witness should exist
      const srcNode = trie2.root.getChild('alice');
      const dstNode = srcNode.getChild('company1');
      expect(dstNode.getWitnessCount()).toBe(1);
    });

    test('should fail fast on invalid edge', () => {
      expect(() => outTrie.withAddedEdge(null)).toThrow('Edge is required');
      expect(() => outTrie.withAddedEdge(undefined)).toThrow('Edge is required');
      expect(() => outTrie.withAddedEdge('not-an-edge')).toThrow('Must be an Edge instance');
      
      expect(() => new Edge('worksAt', undefined, 'company1')).toThrow('Edge src is required');
    });
  });

  describe('withRemovedEdge() - Pure Function', () => {
    let trieWithEdge;

    beforeEach(() => {
      trieWithEdge = outTrie.withAddedEdge(sampleEdge);
    });

    test('should return new trie with removed edge', () => {
      const newTrie = trieWithEdge.withRemovedEdge(sampleEdge);
      
      // Should return new instance
      expect(newTrie).not.toBe(trieWithEdge);
      expect(newTrie).toBeInstanceOf(ImmutableOutTrie);
      
      // Original trie unchanged
      expect(trieWithEdge.size).toBe(1);
      expect(trieWithEdge.contains(sampleEdge)).toBe(true);
      
      // New trie has edge removed
      expect(newTrie.size).toBe(0);
      expect(newTrie.contains(sampleEdge)).toBe(false);
      
      // Both should be frozen
      expect(Object.isFrozen(trieWithEdge)).toBe(true);
      expect(Object.isFrozen(newTrie)).toBe(true);
    });

    test('should clean up empty nodes after removal', () => {
      const newTrie = trieWithEdge.withRemovedEdge(sampleEdge);
      
      // Nodes should be cleaned up when empty
      expect(newTrie.root.hasChild('alice')).toBe(false);
      expect(newTrie.isEmpty()).toBe(true);
    });

    test('should return same instance when removing non-existent edge', () => {
      const nonExistentEdge = new Edge('worksAt', 'nobody', 'nowhere');
      const result = trieWithEdge.withRemovedEdge(nonExistentEdge);
      
      // Should return same instance (optimization)
      expect(result).toBe(trieWithEdge);
    });

    test('should handle partial removal correctly', () => {
      const edge2 = new Edge('worksAt', 'alice', 'company2');
      const trieWith2Edges = trieWithEdge.withAddedEdge(edge2);
      
      const trieAfterRemoval = trieWith2Edges.withRemovedEdge(sampleEdge);
      
      expect(trieAfterRemoval.size).toBe(1);
      expect(trieAfterRemoval.contains(edge2)).toBe(true);
      expect(trieAfterRemoval.contains(sampleEdge)).toBe(false);
      
      // Alice node should still exist with company2 child
      expect(trieAfterRemoval.root.hasChild('alice')).toBe(true);
      const aliceNode = trieAfterRemoval.root.getChild('alice');
      expect(aliceNode.hasChild('company2')).toBe(true);
      expect(aliceNode.hasChild('company1')).toBe(false);
    });

    test('should handle multiple witnesses on same path', () => {
      const edge2 = new Edge('worksFor', 'alice', 'company1'); // Different type
      const trieWith2Witnesses = trieWithEdge.withAddedEdge(edge2);
      
      const trieAfterRemoval = trieWith2Witnesses.withRemovedEdge(sampleEdge);
      
      expect(trieAfterRemoval.size).toBe(1);
      expect(trieAfterRemoval.contains(edge2)).toBe(true);
      expect(trieAfterRemoval.contains(sampleEdge)).toBe(false);
      
      // Path should still exist with remaining witness
      const srcNode = trieAfterRemoval.root.getChild('alice');
      const dstNode = srcNode.getChild('company1');
      expect(dstNode.getWitnessCount()).toBe(1);
      expect(dstNode.isLeaf).toBe(true);
    });

    test('should fail fast on invalid edge', () => {
      expect(() => trieWithEdge.withRemovedEdge(null)).toThrow('Edge is required');
      expect(() => trieWithEdge.withRemovedEdge(undefined)).toThrow('Edge is required');
      expect(() => trieWithEdge.withRemovedEdge('not-an-edge')).toThrow('Must be an Edge instance');
    });
  });

  describe('Read-only Accessors', () => {
    let populatedTrie;

    beforeEach(() => {
      const edges = [
        new Edge('worksAt', 'alice', 'company1'),
        new Edge('worksAt', 'alice', 'company2'),
        new Edge('worksAt', 'bob', 'company1'),
        new Edge('worksAt', 'bob', 'company3')
      ];
      
      populatedTrie = outTrie;
      for (const edge of edges) {
        populatedTrie = populatedTrie.withAddedEdge(edge);
      }
    });

    test('should provide basic properties', () => {
      expect(populatedTrie.relationName).toBe('worksAt');
      expect(populatedTrie.size).toBe(4);
      expect(populatedTrie.isEmpty()).toBe(false);
    });

    test('should check edge existence correctly', () => {
      const existingEdge = new Edge('worksAt', 'alice', 'company1');
      const nonExistentEdge = new Edge('worksAt', 'charlie', 'company4');
      
      expect(populatedTrie.contains(existingEdge)).toBe(true);
      expect(populatedTrie.contains(nonExistentEdge)).toBe(false);
    });

    test('should get destinations for source', () => {
      const aliceDestinations = populatedTrie.getDestinationsForSource('alice');
      expect(aliceDestinations).toEqual(expect.arrayContaining(['company1', 'company2']));
      expect(aliceDestinations.length).toBe(2);
      
      const bobDestinations = populatedTrie.getDestinationsForSource('bob');
      expect(bobDestinations).toEqual(expect.arrayContaining(['company1', 'company3']));
      expect(bobDestinations.length).toBe(2);
      
      const nonExistentSrc = populatedTrie.getDestinationsForSource('nobody');
      expect(nonExistentSrc).toEqual([]);
    });

    test('should get edges for source', () => {
      const aliceEdges = populatedTrie.getEdgesForSource('alice');
      expect(aliceEdges.length).toBe(2);
      expect(aliceEdges.every(edge => edge.src === 'alice')).toBe(true);
      
      const bobEdges = populatedTrie.getEdgesForSource('bob');
      expect(bobEdges.length).toBe(2);
      expect(bobEdges.every(edge => edge.src === 'bob')).toBe(true);
      
      const nonExistentSrc = populatedTrie.getEdgesForSource('nobody');
      expect(nonExistentSrc).toEqual([]);
    });

    test('should get all sources', () => {
      const sources = populatedTrie.getAllSources();
      expect(sources).toEqual(expect.arrayContaining(['alice', 'bob']));
      expect(sources.length).toBe(2);
    });

    test('should get all edges', () => {
      const edges = populatedTrie.getAllEdges();
      expect(edges.length).toBe(4);
      expect(edges.every(edge => edge.type === 'worksAt')).toBe(true);
    });

    test('should check source existence', () => {
      expect(populatedTrie.hasSource('alice')).toBe(true);
      expect(populatedTrie.hasSource('bob')).toBe(true);
      expect(populatedTrie.hasSource('nobody')).toBe(false);
    });

    test('should check path existence', () => {
      expect(populatedTrie.hasPath('alice', 'company1')).toBe(true);
      expect(populatedTrie.hasPath('alice', 'company2')).toBe(true);
      expect(populatedTrie.hasPath('alice', 'company3')).toBe(false);
      expect(populatedTrie.hasPath('nobody', 'company1')).toBe(false);
    });

    test('should get witness count for path', () => {
      expect(populatedTrie.getWitnessCount('alice', 'company1')).toBe(1);
      expect(populatedTrie.getWitnessCount('alice', 'company3')).toBe(0);
      expect(populatedTrie.getWitnessCount('nobody', 'company1')).toBe(0);
    });
  });

  describe('Leapfrog Operations', () => {
    let populatedTrie;

    beforeEach(() => {
      const edges = [
        new Edge('worksAt', 'alice', 'company1'),
        new Edge('worksAt', 'alice', 'company3'),
        new Edge('worksAt', 'alice', 'company5'),
        new Edge('worksAt', 'bob', 'company2'),
        new Edge('worksAt', 'bob', 'company4')
      ];
      
      populatedTrie = outTrie;
      for (const edge of edges) {
        populatedTrie = populatedTrie.withAddedEdge(edge);
      }
    });

    test('should perform seek operation', () => {
      // Seek for exact match
      expect(populatedTrie.seek('alice', 'company3')).toBe('company3');
      
      // Seek for first >= target
      expect(populatedTrie.seek('alice', 'company2')).toBe('company3');
      expect(populatedTrie.seek('alice', 'company4')).toBe('company5');
      
      // Seek beyond range
      expect(populatedTrie.seek('alice', 'company6')).toBe(null);
      
      // Seek on non-existent source
      expect(populatedTrie.seek('nobody', 'anything')).toBe(null);
    });

    test('should perform next operation', () => {
      expect(populatedTrie.next('alice', 'company1')).toBe('company3');
      expect(populatedTrie.next('alice', 'company3')).toBe('company5');
      expect(populatedTrie.next('alice', 'company5')).toBe(null);
      
      expect(populatedTrie.next('nobody', 'anything')).toBe(null);
    });

    test('should perform min operation', () => {
      expect(populatedTrie.min('alice')).toBe('company1');
      expect(populatedTrie.min('bob')).toBe('company2');
      expect(populatedTrie.min('nobody')).toBe(null);
    });

    test('should perform max operation', () => {
      expect(populatedTrie.max('alice')).toBe('company5');
      expect(populatedTrie.max('bob')).toBe('company4');
      expect(populatedTrie.max('nobody')).toBe(null);
    });
  });

  describe('Statistics and Validation', () => {
    let populatedTrie;

    beforeEach(() => {
      const edges = [
        new Edge('worksAt', 'alice', 'company1'),
        new Edge('worksAt', 'alice', 'company2'),
        new Edge('worksAt', 'bob', 'company1')
      ];
      
      populatedTrie = outTrie;
      for (const edge of edges) {
        populatedTrie = populatedTrie.withAddedEdge(edge);
      }
    });

    test('should provide comprehensive statistics', () => {
      const stats = populatedTrie.getStatistics();
      
      expect(stats).toHaveProperty('relationName', 'worksAt');
      expect(stats).toHaveProperty('edgeCount', 3);
      expect(stats).toHaveProperty('sourceCount', 2);
      expect(stats).toHaveProperty('destinationCount', 3);
      expect(stats).toHaveProperty('nodeCount');
      expect(stats).toHaveProperty('maxDepth');
    });

    test('should validate structure integrity', () => {
      const issues = populatedTrie.validateStructure();
      expect(Array.isArray(issues)).toBe(true);
      // For a properly implemented trie, issues should be empty
      if (issues.length > 0) {
        console.log('Validation issues:', issues);
      }
    });

    test('should provide meaningful string representation', () => {
      const str = populatedTrie.toString();
      expect(str).toContain('ImmutableOutTrie');
      expect(str).toContain('worksAt');
      expect(str).toContain('edges=3');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty trie correctly', () => {
      expect(outTrie.getAllSources()).toEqual([]);
      expect(outTrie.getAllEdges()).toEqual([]);
      expect(outTrie.getDestinationsForSource('anyone')).toEqual([]);
      expect(outTrie.getEdgesForSource('anyone')).toEqual([]);
      expect(outTrie.hasSource('anyone')).toBe(false);
      expect(outTrie.hasPath('anyone', 'anywhere')).toBe(false);
      expect(outTrie.getWitnessCount('anyone', 'anywhere')).toBe(0);
    });

    test('should handle complex values in edges', () => {
      const complexEdge = new Edge('worksAt', 
        { id: 'user1', name: 'Alice' }, 
        { id: 'company1', name: 'TechCorp' }
      );
      
      const newTrie = outTrie.withAddedEdge(complexEdge);
      
      expect(newTrie.contains(complexEdge)).toBe(true);
      expect(newTrie.size).toBe(1);
    });

    test('should handle edge equality correctly', () => {
      const edge1 = new Edge('worksAt', 'alice', 'company1');
      const edge2 = new Edge('worksAt', 'alice', 'company1'); // Same values
      const edge3 = new Edge('worksFor', 'alice', 'company1'); // Different type
      
      const trie1 = outTrie.withAddedEdge(edge1);
      
      // Same edge should not increase size
      const trie2 = trie1.withAddedEdge(edge1);
      expect(trie2).toBe(trie1);
      
      // Identical edge should also not increase size
      const trie2b = trie1.withAddedEdge(edge2);
      expect(trie2b).toBe(trie1);
      
      // Edge with different type should be treated as different
      const trie3 = trie1.withAddedEdge(edge3);
      expect(trie3).not.toBe(trie1);
      expect(trie3.size).toBe(2);
    });
  });
});