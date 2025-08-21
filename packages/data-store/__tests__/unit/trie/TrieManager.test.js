/**
 * Unit tests for TrieManager class
 * Tests trie coordination per design §2.4
 */

import { TrieManager } from '../../../src/trie/TrieManager.js';
import { Edge } from '../../../src/Edge.js';

describe('TrieManager', () => {
  let manager;

  beforeEach(() => {
    manager = new TrieManager();
  });

  describe('construction', () => {
    it('should create empty manager', () => {
      expect(manager.getRelationCount()).toBe(0);
      expect(manager.getRelationNames()).toEqual([]);
    });
  });

  describe('relation type registration', () => {
    it('should register relation type with default backward name', () => {
      const { outTrie, inTrie } = manager.registerRelationType('worksAt');
      
      expect(manager.hasRelationType('worksAt')).toBe(true);
      expect(manager.getRelationCount()).toBe(1);
      expect(manager.getRelationNames()).toEqual(['worksAt']);
      
      expect(outTrie.relationName).toBe('worksAt');
      expect(inTrie.relationName).toBe('worksAt_inv');
    });

    it('should register relation type with custom backward name', () => {
      const { outTrie, inTrie } = manager.registerRelationType('worksAt', 'workedBy');
      
      expect(outTrie.relationName).toBe('worksAt');
      expect(inTrie.relationName).toBe('workedBy');
    });

    it('should prevent duplicate registration', () => {
      manager.registerRelationType('worksAt');
      
      expect(() => manager.registerRelationType('worksAt'))
        .toThrow('Relation type \'worksAt\' is already registered');
    });

    it('should validate relation name', () => {
      expect(() => manager.registerRelationType()).toThrow('Relation name is required');
      expect(() => manager.registerRelationType(null)).toThrow('Relation name is required');
      expect(() => manager.registerRelationType(123)).toThrow('Relation name must be a string');
    });
  });

  describe('trie access', () => {
    beforeEach(() => {
      manager.registerRelationType('worksAt', 'workedBy');
      manager.registerRelationType('livesIn', 'livedIn');
    });

    it('should get OutTrie for relation', () => {
      const outTrie = manager.getOutTrie('worksAt');
      expect(outTrie.relationName).toBe('worksAt');
    });

    it('should get InTrie for relation', () => {
      const inTrie = manager.getInTrie('worksAt');
      expect(inTrie.relationName).toBe('workedBy');
    });

    it('should get trie pair', () => {
      const { outTrie, inTrie } = manager.getTriePair('worksAt');
      expect(outTrie.relationName).toBe('worksAt');
      expect(inTrie.relationName).toBe('workedBy');
    });

    it('should throw for unknown relation types', () => {
      expect(() => manager.getOutTrie('unknown')).toThrow('Relation type \'unknown\' not found');
      expect(() => manager.getInTrie('unknown')).toThrow('Relation type \'unknown\' not found');
    });
  });

  describe('edge management', () => {
    beforeEach(() => {
      manager.registerRelationType('worksAt', 'workedBy');
      manager.registerRelationType('livesIn', 'livedIn');
    });

    it('should insert edge into both tries', () => {
      const edge = new Edge('worksAt', 'alice', 'acme');
      manager.insertEdge('worksAt', edge);

      expect(manager.getEdgeCount('worksAt')).toBe(1);
      expect(manager.containsEdge('worksAt', edge)).toBe(true);
      
      // Check both tries contain the edge
      const outTrie = manager.getOutTrie('worksAt');
      const inTrie = manager.getInTrie('worksAt');
      expect(outTrie.contains(edge)).toBe(true);
      expect(inTrie.contains(edge)).toBe(true);
    });

    it('should remove edge from both tries', () => {
      const edge = new Edge('worksAt', 'alice', 'acme');
      manager.insertEdge('worksAt', edge);
      
      expect(manager.containsEdge('worksAt', edge)).toBe(true);
      
      manager.removeEdge('worksAt', edge);
      
      expect(manager.containsEdge('worksAt', edge)).toBe(false);
      expect(manager.getEdgeCount('worksAt')).toBe(0);
    });

    it('should validate edge type matches relation name', () => {
      const edge = new Edge('worksAt', 'alice', 'acme');
      
      expect(() => manager.insertEdge('livesIn', edge))
        .toThrow('Edge type \'worksAt\' does not match relation name \'livesIn\'');
    });

    it('should validate edge parameters', () => {
      expect(() => manager.insertEdge('worksAt', null)).toThrow('Edge is required');
      expect(() => manager.removeEdge('worksAt', null)).toThrow('Edge is required');
    });
  });

  describe('traversal operations', () => {
    beforeEach(() => {
      manager.registerRelationType('worksAt', 'workedBy');
      
      // Insert test data
      const edges = [
        new Edge('worksAt', 'alice', 'acme'),
        new Edge('worksAt', 'alice', 'beta'),
        new Edge('worksAt', 'bob', 'acme'),
        new Edge('worksAt', 'carol', 'gamma')
      ];
      edges.forEach(edge => manager.insertEdge('worksAt', edge));
    });

    it('should get destinations for source (forward)', () => {
      const aliceDests = manager.getDestinationsForSource('worksAt', 'alice');
      expect(aliceDests.sort()).toEqual(['acme', 'beta']);
      
      const bobDests = manager.getDestinationsForSource('worksAt', 'bob');
      expect(bobDests).toEqual(['acme']);
    });

    it('should get sources for destination (backward)', () => {
      const acmeSources = manager.getSourcesForDestination('worksAt', 'acme');
      expect(acmeSources.sort()).toEqual(['alice', 'bob']);
      
      const betaSources = manager.getSourcesForDestination('worksAt', 'beta');
      expect(betaSources).toEqual(['alice']);
    });

    it('should get edges for source', () => {
      const aliceEdges = manager.getEdgesForSource('worksAt', 'alice');
      expect(aliceEdges).toHaveLength(2);
      expect(aliceEdges.every(e => e.src === 'alice')).toBe(true);
    });

    it('should get edges for destination', () => {
      const acmeEdges = manager.getEdgesForDestination('worksAt', 'acme');
      expect(acmeEdges).toHaveLength(2);
      expect(acmeEdges.every(e => e.dst === 'acme')).toBe(true);
    });

    it('should get all sources and destinations', () => {
      const sources = manager.getAllSources('worksAt');
      expect(sources.sort()).toEqual(['alice', 'bob', 'carol']);
      
      const destinations = manager.getAllDestinations('worksAt');
      expect(destinations.sort()).toEqual(['acme', 'beta', 'gamma']);
    });

    it('should get all edges', () => {
      const edges = manager.getAllEdges('worksAt');
      expect(edges).toHaveLength(4);
      expect(edges.every(e => e.type === 'worksAt')).toBe(true);
    });
  });

  describe('leapfrog operations', () => {
    beforeEach(() => {
      manager.registerRelationType('test', 'testInv');
      
      // Setup sorted test data
      const edges = [
        new Edge('test', 'src1', 'a'),
        new Edge('test', 'src1', 'c'),
        new Edge('test', 'src1', 'e'),
        new Edge('test', 'b', 'dst1'),  // Fixed: 'b' -> 'dst1'
        new Edge('test', 'd', 'dst1')   // Fixed: 'd' -> 'dst1'
      ];
      edges.forEach(edge => manager.insertEdge('test', edge));
    });

    it('should perform forward leapfrog operations', () => {
      expect(manager.seekForward('test', 'src1', 'c')).toBe('c');
      expect(manager.seekForward('test', 'src1', 'd')).toBe('e');
      expect(manager.nextForward('test', 'src1', 'a')).toBe('c');
      expect(manager.minForward('test', 'src1')).toBe('a');
      expect(manager.maxForward('test', 'src1')).toBe('e');
    });

    it('should perform backward leapfrog operations', () => {
      expect(manager.seekBackward('test', 'dst1', 'b')).toBe('b');
      expect(manager.seekBackward('test', 'dst1', 'c')).toBe('d');
      expect(manager.nextBackward('test', 'dst1', 'b')).toBe('d');
      expect(manager.minBackward('test', 'dst1')).toBe('b');
      expect(manager.maxBackward('test', 'dst1')).toBe('d');
    });
  });

  describe('relation type management', () => {
    beforeEach(() => {
      manager.registerRelationType('worksAt', 'workedBy');
      manager.registerRelationType('livesIn', 'livedIn');
      
      manager.insertEdge('worksAt', new Edge('worksAt', 'alice', 'acme'));
      manager.insertEdge('livesIn', new Edge('livesIn', 'alice', 'sf'));
    });

    it('should check if relation is empty', () => {
      manager.registerRelationType('empty', 'emptyInv');
      
      expect(manager.isEmpty('empty')).toBe(true);
      expect(manager.isEmpty('worksAt')).toBe(false);
    });

    it('should clear relation type', () => {
      expect(manager.getEdgeCount('worksAt')).toBe(1);
      
      manager.clearRelationType('worksAt');
      
      expect(manager.getEdgeCount('worksAt')).toBe(0);
      expect(manager.isEmpty('worksAt')).toBe(true);
      expect(manager.hasRelationType('worksAt')).toBe(true); // Type still exists
    });

    it('should remove relation type completely', () => {
      expect(manager.hasRelationType('worksAt')).toBe(true);
      
      manager.removeRelationType('worksAt');
      
      expect(manager.hasRelationType('worksAt')).toBe(false);
      expect(manager.getRelationCount()).toBe(1);
      expect(manager.getRelationNames()).toEqual(['livesIn']);
    });

    it('should handle removing non-existent relation type', () => {
      expect(() => manager.removeRelationType('unknown')).not.toThrow();
    });

    it('should clear all relation types', () => {
      expect(manager.getRelationCount()).toBe(2);
      
      manager.clear();
      
      expect(manager.getRelationCount()).toBe(0);
      expect(manager.getRelationNames()).toEqual([]);
    });
  });

  describe('consistency validation', () => {
    beforeEach(() => {
      manager.registerRelationType('worksAt', 'workedBy');
    });

    it('should validate consistent tries', () => {
      const edge = new Edge('worksAt', 'alice', 'acme');
      manager.insertEdge('worksAt', edge);
      
      const issues = manager.validateConsistency('worksAt');
      expect(issues).toEqual([]);
    });

    it('should detect size inconsistencies', () => {
      const edge = new Edge('worksAt', 'alice', 'acme');
      manager.insertEdge('worksAt', edge);
      
      // Manually corrupt one trie to test consistency checking
      const inTrie = manager.getInTrie('worksAt');
      inTrie._size = 999; // Artificially corrupt size
      
      const issues = manager.validateConsistency('worksAt');
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0]).toContain('Size mismatch');
    });

    it('should validate all relations when no specific relation provided', () => {
      manager.registerRelationType('livesIn', 'livedIn');
      
      manager.insertEdge('worksAt', new Edge('worksAt', 'alice', 'acme'));
      manager.insertEdge('livesIn', new Edge('livesIn', 'alice', 'sf'));
      
      const issues = manager.validateConsistency();
      expect(issues).toEqual([]);
    });

    it('should detect trie consistency errors in containsEdge', () => {
      const edge = new Edge('worksAt', 'alice', 'acme');
      manager.insertEdge('worksAt', edge);
      
      // Manually corrupt one trie
      const inTrie = manager.getInTrie('worksAt');
      inTrie.clear(); // Clear only InTrie to create inconsistency
      
      expect(() => manager.containsEdge('worksAt', edge))
        .toThrow('Trie consistency error');
    });

    it('should detect size inconsistencies in getEdgeCount', () => {
      const edge = new Edge('worksAt', 'alice', 'acme');
      manager.insertEdge('worksAt', edge);
      
      // Manually corrupt one trie
      const inTrie = manager.getInTrie('worksAt');
      inTrie._size = 999;
      
      expect(() => manager.getEdgeCount('worksAt'))
        .toThrow('Trie size inconsistency');
    });
  });

  describe('statistics and debugging', () => {
    beforeEach(() => {
      manager.registerRelationType('worksAt', 'workedBy');
      manager.registerRelationType('livesIn', 'livedIn');
      
      manager.insertEdge('worksAt', new Edge('worksAt', 'alice', 'acme'));
      manager.insertEdge('worksAt', new Edge('worksAt', 'bob', 'acme'));
      manager.insertEdge('livesIn', new Edge('livesIn', 'alice', 'sf'));
    });

    it('should provide comprehensive statistics', () => {
      const stats = manager.getStatistics();
      
      expect(stats.relationCount).toBe(2);
      expect(stats.totalEdgeCount).toBe(3);
      expect(stats.totalUniqueSourceCount).toBe(2); // alice, bob
      expect(stats.totalUniqueDestinationCount).toBe(2); // acme, sf
      
      expect(stats.relationStats).toHaveProperty('worksAt');
      expect(stats.relationStats).toHaveProperty('livesIn');
      
      expect(stats.relationStats.worksAt.edgeCount).toBe(2);
      expect(stats.relationStats.livesIn.edgeCount).toBe(1);
    });

    it('should provide string representation', () => {
      const str = manager.toString();
      expect(str).toContain('TrieManager');
      expect(str).toContain('relations=2');
      expect(str).toContain('totalEdges=3');
    });

    it('should provide detailed string representation', () => {
      const detailed = manager.toDetailedString();
      expect(detailed).toContain('TrieManager');
      expect(detailed).toContain('worksAt:');
      expect(detailed).toContain('livesIn:');
      expect(detailed).toContain('OutTrie');
      expect(detailed).toContain('InTrie');
    });
  });

  describe('edge cases', () => {
    it('should handle mixed data types', () => {
      manager.registerRelationType('mixed', 'mixedInv');
      
      const edges = [
        new Edge('mixed', 'alice', 1),
        new Edge('mixed', 2, 'beta'),
        new Edge('mixed', true, null)
      ];

      edges.forEach(edge => manager.insertEdge('mixed', edge));

      expect(manager.getEdgeCount('mixed')).toBe(3);
      edges.forEach(edge => {
        expect(manager.containsEdge('mixed', edge)).toBe(true);
      });
    });

    it('should handle multiple relation types efficiently', () => {
      // Register multiple relation types
      for (let i = 0; i < 10; i++) {
        manager.registerRelationType(`rel${i}`, `rel${i}Inv`);
      }

      expect(manager.getRelationCount()).toBe(10);
      expect(manager.getRelationNames()).toHaveLength(10);

      // Insert edges into different relations
      for (let i = 0; i < 10; i++) {
        const edge = new Edge(`rel${i}`, `src${i}`, `dst${i}`);
        manager.insertEdge(`rel${i}`, edge);
      }

      const stats = manager.getStatistics();
      expect(stats.totalEdgeCount).toBe(10);
      expect(stats.relationCount).toBe(10);
    });

    it('should maintain sorted relation names', () => {
      const names = ['zebra', 'alpha', 'beta', 'gamma'];
      names.forEach(name => manager.registerRelationType(name));
      
      const sortedNames = manager.getRelationNames();
      expect(sortedNames).toEqual(['alpha', 'beta', 'gamma', 'zebra']);
    });
  });
});