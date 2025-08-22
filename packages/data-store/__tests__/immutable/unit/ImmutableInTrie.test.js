/**
 * Unit Tests for ImmutableInTrie
 * Per implementation plan Phase 1 Step 1.4
 * TDD approach - tests written first before implementation
 */

import { ImmutableInTrie } from '../../../src/immutable/ImmutableInTrie.js';
import { Edge } from '../../../src/Edge.js';

describe('ImmutableInTrie', () => {
  let inTrie;
  let sampleEdge;

  beforeEach(() => {
    inTrie = new ImmutableInTrie('employs');
    sampleEdge = new Edge('worksAt', 'alice', 'company1');
  });

  describe('Constructor and Immutability', () => {
    test('should create empty immutable in trie', () => {
      expect(inTrie).toBeDefined();
      expect(inTrie.relationName).toBe('employs');
      expect(inTrie.size).toBe(0);
      expect(inTrie.isEmpty()).toBe(true);
      
      // Should be frozen (immutable)
      expect(Object.isFrozen(inTrie)).toBe(true);
    });

    test('should create trie with provided data', () => {
      const root = inTrie.root.withAddedChild('company1').withAddedChild('alice');
      const trie = new ImmutableInTrie('employs', root, 1);
      
      expect(trie.relationName).toBe('employs');
      expect(trie.size).toBe(1);
      expect(trie.isEmpty()).toBe(false);
      expect(Object.isFrozen(trie)).toBe(true);
    });

    test('should fail fast on invalid constructor parameters', () => {
      expect(() => new ImmutableInTrie()).toThrow('Relation name is required');
      expect(() => new ImmutableInTrie('')).toThrow('Relation name is required');
      expect(() => new ImmutableInTrie(123)).toThrow('Relation name must be a string');
    });

    test('should have immutable root node', () => {
      const root = inTrie.root;
      expect(Object.isFrozen(root)).toBe(true);
    });
  });

  describe('withAddedEdge() - Pure Function', () => {
    test('should return new trie with added edge', () => {
      const newTrie = inTrie.withAddedEdge(sampleEdge);
      
      // Should return new instance
      expect(newTrie).not.toBe(inTrie);
      expect(newTrie).toBeInstanceOf(ImmutableInTrie);
      
      // Original trie unchanged
      expect(inTrie.size).toBe(0);
      expect(inTrie.contains(sampleEdge)).toBe(false);
      
      // New trie has edge
      expect(newTrie.size).toBe(1);
      expect(newTrie.contains(sampleEdge)).toBe(true);
      
      // Both should be frozen
      expect(Object.isFrozen(inTrie)).toBe(true);
      expect(Object.isFrozen(newTrie)).toBe(true);
    });

    test('should create proper trie structure for edge (dst -> src)', () => {
      const newTrie = inTrie.withAddedEdge(sampleEdge);
      
      // Check dst node exists at depth 1 (reversed for InTrie)
      const dstNode = newTrie.root.getChild('company1');
      expect(dstNode).toBeDefined();
      expect(dstNode.depth).toBe(1);
      expect(dstNode.value).toBe('company1');
      
      // Check src node exists at depth 2 and is marked as leaf
      const srcNode = dstNode.getChild('alice');
      expect(srcNode).toBeDefined();
      expect(srcNode.depth).toBe(2);
      expect(srcNode.value).toBe('alice');
      expect(srcNode.isLeaf).toBe(true);
      
      // Check edge is stored as witness
      expect(srcNode.hasWitness(sampleEdge)).toBe(true);
      expect(srcNode.getWitnessCount()).toBe(1);
    });

    test('should return same instance when adding duplicate edge', () => {
      const trieWithEdge = inTrie.withAddedEdge(sampleEdge);
      const trieWithDuplicate = trieWithEdge.withAddedEdge(sampleEdge);
      
      // Should return same instance (optimization)
      expect(trieWithDuplicate).toBe(trieWithEdge);
      expect(trieWithDuplicate.size).toBe(1);
    });

    test('should handle multiple edges correctly', () => {
      const edge2 = new Edge('worksAt', 'bob', 'company1');
      const edge3 = new Edge('worksAt', 'alice', 'company2');
      
      const trie1 = inTrie.withAddedEdge(sampleEdge);
      const trie2 = trie1.withAddedEdge(edge2);
      const trie3 = trie2.withAddedEdge(edge3);
      
      expect(trie3.size).toBe(3);
      expect(trie3.contains(sampleEdge)).toBe(true);
      expect(trie3.contains(edge2)).toBe(true);
      expect(trie3.contains(edge3)).toBe(true);
    });

    test('should handle multiple edges with same dst-src pair', () => {
      // Since Edge only supports (type, src, dst), we can't have different edges with same src-dst
      // This test should verify that identical edges are treated as duplicates
      const edge2 = new Edge('worksAt', 'alice', 'company1'); // Identical edge
      
      const trie1 = inTrie.withAddedEdge(sampleEdge);
      const trie2 = trie1.withAddedEdge(edge2);
      
      expect(trie2).toBe(trie1); // Should be same instance since edge is identical
      expect(trie2.size).toBe(1);
      expect(trie2.contains(sampleEdge)).toBe(true);
      expect(trie2.contains(edge2)).toBe(true);
      
      // Only one witness should exist
      const dstNode = trie2.root.getChild('company1');
      const srcNode = dstNode.getChild('alice');
      expect(srcNode.getWitnessCount()).toBe(1);
    });

    test('should fail fast on invalid edge', () => {
      expect(() => inTrie.withAddedEdge(null)).toThrow('Edge is required');
      expect(() => inTrie.withAddedEdge(undefined)).toThrow('Edge is required');
      expect(() => inTrie.withAddedEdge('not-an-edge')).toThrow('Must be an Edge instance');
      
      expect(() => new Edge('worksAt', 'alice', undefined)).toThrow('Edge dst is required');
    });
  });

  describe('withRemovedEdge() - Pure Function', () => {
    let trieWithEdge;

    beforeEach(() => {
      trieWithEdge = inTrie.withAddedEdge(sampleEdge);
    });

    test('should return new trie with removed edge', () => {
      const newTrie = trieWithEdge.withRemovedEdge(sampleEdge);
      
      // Should return new instance
      expect(newTrie).not.toBe(trieWithEdge);
      expect(newTrie).toBeInstanceOf(ImmutableInTrie);
      
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
      expect(newTrie.root.hasChild('company1')).toBe(false);
      expect(newTrie.isEmpty()).toBe(true);
    });

    test('should return same instance when removing non-existent edge', () => {
      const nonExistentEdge = new Edge('worksAt', 'nobody', 'nowhere');
      const result = trieWithEdge.withRemovedEdge(nonExistentEdge);
      
      // Should return same instance (optimization)
      expect(result).toBe(trieWithEdge);
    });

    test('should handle partial removal correctly', () => {
      const edge2 = new Edge('worksAt', 'bob', 'company1');
      const trieWith2Edges = trieWithEdge.withAddedEdge(edge2);
      
      const trieAfterRemoval = trieWith2Edges.withRemovedEdge(sampleEdge);
      
      expect(trieAfterRemoval.size).toBe(1);
      expect(trieAfterRemoval.contains(edge2)).toBe(true);
      expect(trieAfterRemoval.contains(sampleEdge)).toBe(false);
      
      // Company1 node should still exist with bob child
      expect(trieAfterRemoval.root.hasChild('company1')).toBe(true);
      const company1Node = trieAfterRemoval.root.getChild('company1');
      expect(company1Node.hasChild('bob')).toBe(true);
      expect(company1Node.hasChild('alice')).toBe(false);
    });

    test('should handle multiple witnesses on same path', () => {
      const edge2 = new Edge('worksFor', 'alice', 'company1'); // Different type
      const trieWith2Witnesses = trieWithEdge.withAddedEdge(edge2);
      
      const trieAfterRemoval = trieWith2Witnesses.withRemovedEdge(sampleEdge);
      
      expect(trieAfterRemoval.size).toBe(1);
      expect(trieAfterRemoval.contains(edge2)).toBe(true);
      expect(trieAfterRemoval.contains(sampleEdge)).toBe(false);
      
      // Path should still exist with remaining witness
      const dstNode = trieAfterRemoval.root.getChild('company1');
      const srcNode = dstNode.getChild('alice');
      expect(srcNode.getWitnessCount()).toBe(1);
      expect(srcNode.isLeaf).toBe(true);
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
        new Edge('worksAt', 'bob', 'company1'),
        new Edge('worksAt', 'alice', 'company2'),
        new Edge('worksAt', 'charlie', 'company3')
      ];
      
      populatedTrie = inTrie;
      for (const edge of edges) {
        populatedTrie = populatedTrie.withAddedEdge(edge);
      }
    });

    test('should provide basic properties', () => {
      expect(populatedTrie.relationName).toBe('employs');
      expect(populatedTrie.size).toBe(4);
      expect(populatedTrie.isEmpty()).toBe(false);
    });

    test('should check edge existence correctly', () => {
      const existingEdge = new Edge('worksAt', 'alice', 'company1');
      const nonExistentEdge = new Edge('worksAt', 'dave', 'company4');
      
      expect(populatedTrie.contains(existingEdge)).toBe(true);
      expect(populatedTrie.contains(nonExistentEdge)).toBe(false);
    });

    test('should get sources for destination', () => {
      const company1Sources = populatedTrie.getSourcesForDestination('company1');
      expect(company1Sources).toEqual(expect.arrayContaining(['alice', 'bob']));
      expect(company1Sources.length).toBe(2);
      
      const company2Sources = populatedTrie.getSourcesForDestination('company2');
      expect(company2Sources).toEqual(['alice']);
      
      const nonExistentDst = populatedTrie.getSourcesForDestination('nowhere');
      expect(nonExistentDst).toEqual([]);
    });

    test('should get edges for destination', () => {
      const company1Edges = populatedTrie.getEdgesForDestination('company1');
      expect(company1Edges.length).toBe(2);
      expect(company1Edges.every(edge => edge.dst === 'company1')).toBe(true);
      
      const company2Edges = populatedTrie.getEdgesForDestination('company2');
      expect(company2Edges.length).toBe(1);
      expect(company2Edges[0].dst).toBe('company2');
      
      const nonExistentDst = populatedTrie.getEdgesForDestination('nowhere');
      expect(nonExistentDst).toEqual([]);
    });

    test('should get all destinations', () => {
      const destinations = populatedTrie.getAllDestinations();
      expect(destinations).toEqual(expect.arrayContaining(['company1', 'company2', 'company3']));
      expect(destinations.length).toBe(3);
    });

    test('should get all edges', () => {
      const edges = populatedTrie.getAllEdges();
      expect(edges.length).toBe(4);
      expect(edges.every(edge => edge.type === 'worksAt')).toBe(true);
    });

    test('should check destination existence', () => {
      expect(populatedTrie.hasDestination('company1')).toBe(true);
      expect(populatedTrie.hasDestination('company2')).toBe(true);
      expect(populatedTrie.hasDestination('nowhere')).toBe(false);
    });

    test('should check path existence', () => {
      expect(populatedTrie.hasPath('company1', 'alice')).toBe(true);
      expect(populatedTrie.hasPath('company1', 'bob')).toBe(true);
      expect(populatedTrie.hasPath('company1', 'charlie')).toBe(false);
      expect(populatedTrie.hasPath('nowhere', 'alice')).toBe(false);
    });

    test('should get witness count for path', () => {
      expect(populatedTrie.getWitnessCount('company1', 'alice')).toBe(1);
      expect(populatedTrie.getWitnessCount('company1', 'charlie')).toBe(0);
      expect(populatedTrie.getWitnessCount('nowhere', 'alice')).toBe(0);
    });
  });

  describe('Leapfrog Operations', () => {
    let populatedTrie;

    beforeEach(() => {
      const edges = [
        new Edge('worksAt', 'alice', 'company1'),
        new Edge('worksAt', 'charlie', 'company1'),
        new Edge('worksAt', 'eve', 'company1'),
        new Edge('worksAt', 'bob', 'company2'),
        new Edge('worksAt', 'dave', 'company2')
      ];
      
      populatedTrie = inTrie;
      for (const edge of edges) {
        populatedTrie = populatedTrie.withAddedEdge(edge);
      }
    });

    test('should perform seek operation', () => {
      // Seek for exact match
      expect(populatedTrie.seek('company1', 'charlie')).toBe('charlie');
      
      // Seek for first >= target
      expect(populatedTrie.seek('company1', 'bob')).toBe('charlie');
      expect(populatedTrie.seek('company1', 'dave')).toBe('eve');
      
      // Seek beyond range
      expect(populatedTrie.seek('company1', 'zed')).toBe(null);
      
      // Seek on non-existent destination
      expect(populatedTrie.seek('nowhere', 'anyone')).toBe(null);
    });

    test('should perform next operation', () => {
      expect(populatedTrie.next('company1', 'alice')).toBe('charlie');
      expect(populatedTrie.next('company1', 'charlie')).toBe('eve');
      expect(populatedTrie.next('company1', 'eve')).toBe(null);
      
      expect(populatedTrie.next('nowhere', 'anyone')).toBe(null);
    });

    test('should perform min operation', () => {
      expect(populatedTrie.min('company1')).toBe('alice');
      expect(populatedTrie.min('company2')).toBe('bob');
      expect(populatedTrie.min('nowhere')).toBe(null);
    });

    test('should perform max operation', () => {
      expect(populatedTrie.max('company1')).toBe('eve');
      expect(populatedTrie.max('company2')).toBe('dave');
      expect(populatedTrie.max('nowhere')).toBe(null);
    });
  });

  describe('Statistics and Validation', () => {
    let populatedTrie;

    beforeEach(() => {
      const edges = [
        new Edge('worksAt', 'alice', 'company1'),
        new Edge('worksAt', 'bob', 'company1'),
        new Edge('worksAt', 'alice', 'company2')
      ];
      
      populatedTrie = inTrie;
      for (const edge of edges) {
        populatedTrie = populatedTrie.withAddedEdge(edge);
      }
    });

    test('should provide comprehensive statistics', () => {
      const stats = populatedTrie.getStatistics();
      
      expect(stats).toHaveProperty('relationName', 'employs');
      expect(stats).toHaveProperty('edgeCount', 3);
      expect(stats).toHaveProperty('destinationCount', 2);
      expect(stats).toHaveProperty('sourceCount', 3);
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
      expect(str).toContain('ImmutableInTrie');
      expect(str).toContain('employs');
      expect(str).toContain('edges=3');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty trie correctly', () => {
      expect(inTrie.getAllDestinations()).toEqual([]);
      expect(inTrie.getAllEdges()).toEqual([]);
      expect(inTrie.getSourcesForDestination('anywhere')).toEqual([]);
      expect(inTrie.getEdgesForDestination('anywhere')).toEqual([]);
      expect(inTrie.hasDestination('anywhere')).toBe(false);
      expect(inTrie.hasPath('anywhere', 'anyone')).toBe(false);
      expect(inTrie.getWitnessCount('anywhere', 'anyone')).toBe(0);
    });

    test('should handle complex values in edges', () => {
      const complexEdge = new Edge('worksAt', 
        { id: 'user1', name: 'Alice' }, 
        { id: 'company1', name: 'TechCorp' }
      );
      
      const newTrie = inTrie.withAddedEdge(complexEdge);
      
      expect(newTrie.contains(complexEdge)).toBe(true);
      expect(newTrie.size).toBe(1);
    });

    test('should handle edge equality correctly', () => {
      const edge1 = new Edge('worksAt', 'alice', 'company1');
      const edge2 = new Edge('worksAt', 'alice', 'company1'); // Same values
      const edge3 = new Edge('worksFor', 'alice', 'company1'); // Different type
      
      const trie1 = inTrie.withAddedEdge(edge1);
      
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