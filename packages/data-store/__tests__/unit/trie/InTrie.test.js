/**
 * Unit tests for InTrie class
 * Tests backward traversal per design §2.3
 */

import { InTrie } from '../../../src/trie/InTrie.js';
import { Edge } from '../../../src/Edge.js';

describe('InTrie', () => {
  let trie;

  beforeEach(() => {
    trie = new InTrie('workedBy');
  });

  describe('construction', () => {
    it('should create empty trie with relation name', () => {
      expect(trie.relationName).toBe('workedBy');
      expect(trie.size).toBe(0);
      expect(trie.isEmpty()).toBe(true);
    });

    it('should validate relation name', () => {
      expect(() => new InTrie()).toThrow('Relation name is required');
      expect(() => new InTrie(null)).toThrow('Relation name is required');
      expect(() => new InTrie(123)).toThrow('Relation name must be a string');
    });
  });

  describe('edge insertion', () => {
    it('should insert single edge', () => {
      const edge = new Edge('worksAt', 'alice', 'acme');
      trie.insert(edge);

      expect(trie.size).toBe(1);
      expect(trie.isEmpty()).toBe(false);
      expect(trie.contains(edge)).toBe(true);
    });

    it('should insert multiple edges', () => {
      const edges = [
        new Edge('worksAt', 'alice', 'acme'),
        new Edge('worksAt', 'bob', 'acme'),
        new Edge('worksAt', 'alice', 'beta')
      ];

      edges.forEach(edge => trie.insert(edge));

      expect(trie.size).toBe(3);
      edges.forEach(edge => {
        expect(trie.contains(edge)).toBe(true);
      });
    });

    it('should handle duplicate edges', () => {
      const edge1 = new Edge('worksAt', 'alice', 'acme');
      const edge2 = new Edge('worksAt', 'alice', 'acme'); // Different instance, same values

      trie.insert(edge1);
      trie.insert(edge2);

      expect(trie.size).toBe(1); // No duplicates counted
      expect(trie.contains(edge1)).toBe(true);
      expect(trie.contains(edge2)).toBe(true);
    });

    it('should validate edge parameters', () => {
      expect(() => trie.insert(null)).toThrow('Edge is required');
      expect(() => trie.insert({})).toThrow('Edge must have src and dst');
      expect(() => trie.insert({ src: 'alice' })).toThrow('Edge must have src and dst');
    });
  });

  describe('edge removal', () => {
    beforeEach(() => {
      const edges = [
        new Edge('worksAt', 'alice', 'acme'),
        new Edge('worksAt', 'bob', 'acme'),
        new Edge('worksAt', 'alice', 'beta')
      ];
      edges.forEach(edge => trie.insert(edge));
    });

    it('should remove existing edge', () => {
      const edge = new Edge('worksAt', 'alice', 'acme');
      
      expect(trie.contains(edge)).toBe(true);
      trie.remove(edge);
      
      expect(trie.contains(edge)).toBe(false);
      expect(trie.size).toBe(2);
    });

    it('should handle removing non-existent edge', () => {
      const edge = new Edge('worksAt', 'charlie', 'gamma');
      
      expect(() => trie.remove(edge)).not.toThrow();
      expect(trie.size).toBe(3); // Unchanged
    });

    it('should clean up empty nodes', () => {
      // Remove alice -> acme edge
      trie.remove(new Edge('worksAt', 'alice', 'acme'));
      
      // Acme should still exist (has bob edge)
      expect(trie.hasDestination('acme')).toBe(true);
      expect(trie.getSourcesForDestination('acme')).toEqual(['bob']);
      
      // Remove bob -> acme edge
      trie.remove(new Edge('worksAt', 'bob', 'acme'));
      
      // Acme should be cleaned up
      expect(trie.hasDestination('acme')).toBe(false);
      expect(trie.getAllDestinations()).toEqual(['beta']);
    });
  });

  describe('backward traversal queries', () => {
    beforeEach(() => {
      const edges = [
        new Edge('worksAt', 'alice', 'acme'),
        new Edge('worksAt', 'bob', 'acme'),
        new Edge('worksAt', 'alice', 'beta'),
        new Edge('worksAt', 'carol', 'gamma')
      ];
      edges.forEach(edge => trie.insert(edge));
    });

    it('should get sources for destination', () => {
      const acmeSources = trie.getSourcesForDestination('acme');
      expect(acmeSources.sort()).toEqual(['alice', 'bob']);
      
      const betaSources = trie.getSourcesForDestination('beta');
      expect(betaSources).toEqual(['alice']);
      
      const unknownSources = trie.getSourcesForDestination('unknown');
      expect(unknownSources).toEqual([]);
    });

    it('should get edges for destination', () => {
      const acmeEdges = trie.getEdgesForDestination('acme');
      expect(acmeEdges).toHaveLength(2);
      expect(acmeEdges.every(e => e.dst === 'acme')).toBe(true);
      
      const betaEdges = trie.getEdgesForDestination('beta');
      expect(betaEdges).toHaveLength(1);
      expect(betaEdges[0].src).toBe('alice');
      expect(betaEdges[0].dst).toBe('beta');
    });

    it('should get all destinations', () => {
      const destinations = trie.getAllDestinations();
      expect(destinations.sort()).toEqual(['acme', 'beta', 'gamma']);
    });

    it('should check destination existence', () => {
      expect(trie.hasDestination('acme')).toBe(true);
      expect(trie.hasDestination('unknown')).toBe(false);
    });

    it('should check path existence', () => {
      expect(trie.hasPath('acme', 'alice')).toBe(true);
      expect(trie.hasPath('gamma', 'alice')).toBe(false);
      expect(trie.hasPath('unknown', 'alice')).toBe(false);
    });
  });

  describe('leapfrog operations', () => {
    beforeEach(() => {
      // Setup sorted test data (note: InTrie indexes by dst first, then src)
      const edges = [
        new Edge('worksAt', 'a', 'acme'),
        new Edge('worksAt', 'c', 'acme'),
        new Edge('worksAt', 'e', 'acme'),
        new Edge('worksAt', 'b', 'beta'),
        new Edge('worksAt', 'd', 'beta')
      ];
      edges.forEach(edge => trie.insert(edge));
    });

    it('should seek to exact source', () => {
      const result = trie.seek('acme', 'c');
      expect(result).toBe('c');
    });

    it('should seek to next higher source', () => {
      const result = trie.seek('acme', 'd');
      expect(result).toBe('e'); // Next after 'd' is 'e'
    });

    it('should seek to first source when target is lower', () => {
      const result = trie.seek('acme', 'a');
      expect(result).toBe('a');
    });

    it('should return null when target is higher than all sources', () => {
      const result = trie.seek('acme', 'z');
      expect(result).toBeNull();
    });

    it('should get next source', () => {
      expect(trie.next('acme', 'a')).toBe('c');
      expect(trie.next('acme', 'c')).toBe('e');
      expect(trie.next('acme', 'e')).toBeNull();
    });

    it('should get min and max sources', () => {
      expect(trie.min('acme')).toBe('a');
      expect(trie.max('acme')).toBe('e');
      
      expect(trie.min('beta')).toBe('b');
      expect(trie.max('beta')).toBe('d');
    });

    it('should handle operations on non-existent destination', () => {
      expect(trie.seek('unknown', 'a')).toBeNull();
      expect(trie.next('unknown', 'a')).toBeNull();
      expect(trie.min('unknown')).toBeNull();
      expect(trie.max('unknown')).toBeNull();
    });
  });

  describe('witness counting', () => {
    it('should count witnesses for path', () => {
      const edge1 = new Edge('worksAt', 'alice', 'acme');
      const edge2 = new Edge('worksAt', 'alice', 'acme'); // Different instance

      trie.insert(edge1);
      expect(trie.getWitnessCount('acme', 'alice')).toBe(1);

      trie.insert(edge2);
      expect(trie.getWitnessCount('acme', 'alice')).toBe(1); // Same edge, single witness

      expect(trie.getWitnessCount('acme', 'unknown')).toBe(0);
      expect(trie.getWitnessCount('unknown', 'alice')).toBe(0);
    });
  });

  describe('trie operations', () => {
    beforeEach(() => {
      const edges = [
        new Edge('worksAt', 'alice', 'acme'),
        new Edge('worksAt', 'bob', 'beta')
      ];
      edges.forEach(edge => trie.insert(edge));
    });

    it('should clear all edges', () => {
      expect(trie.size).toBe(2);
      
      trie.clear();
      
      expect(trie.size).toBe(0);
      expect(trie.isEmpty()).toBe(true);
      expect(trie.getAllDestinations()).toEqual([]);
    });

    it('should get all edges', () => {
      const allEdges = trie.getAllEdges();
      expect(allEdges).toHaveLength(2);
      expect(allEdges.some(e => e.src === 'alice' && e.dst === 'acme')).toBe(true);
      expect(allEdges.some(e => e.src === 'bob' && e.dst === 'beta')).toBe(true);
    });
  });

  describe('statistics and validation', () => {
    beforeEach(() => {
      const edges = [
        new Edge('worksAt', 'alice', 'acme'),
        new Edge('worksAt', 'bob', 'acme'),
        new Edge('worksAt', 'alice', 'beta')
      ];
      edges.forEach(edge => trie.insert(edge));
    });

    it('should provide accurate statistics', () => {
      const stats = trie.getStatistics();
      
      expect(stats.relationName).toBe('workedBy');
      expect(stats.edgeCount).toBe(3);
      expect(stats.destinationCount).toBe(2); // acme, beta
      expect(stats.sourceCount).toBe(3); // alice (x2), bob (x1)
      expect(stats.totalPaths).toBe(3);
      expect(stats.nodeCount).toBeGreaterThan(0);
      expect(stats.maxDepth).toBe(2);
    });

    it('should validate structure', () => {
      const issues = trie.validateStructure();
      expect(issues).toEqual([]);
    });

    it('should provide string representation', () => {
      const str = trie.toString();
      expect(str).toContain('InTrie');
      expect(str).toContain('workedBy');
      expect(str).toContain('edges=3');
      expect(str).toContain('destinations=2');
    });
  });

  describe('edge cases', () => {
    it('should handle mixed data types', () => {
      const edges = [
        new Edge('worksAt', 'alice', 1),
        new Edge('worksAt', 2, 'beta'),
        new Edge('worksAt', true, null)
      ];

      edges.forEach(edge => trie.insert(edge));

      expect(trie.size).toBe(3);
      edges.forEach(edge => {
        expect(trie.contains(edge)).toBe(true);
      });
    });

    it('should handle large numbers of edges efficiently', () => {
      // Insert 1000 edges
      for (let i = 0; i < 1000; i++) {
        const edge = new Edge('worksAt', `src${i}`, `dst${i % 10}`);
        trie.insert(edge);
      }

      expect(trie.size).toBe(1000);
      
      // Test query performance
      const start = Date.now();
      const sources = trie.getSourcesForDestination('dst0');
      const end = Date.now();
      
      expect(sources.length).toBe(100); // 100 sources for dst0
      expect(end - start).toBeLessThan(100); // Should be fast
    });
  });

  describe('complementary functionality with OutTrie', () => {
    it('should provide inverse view of same data', () => {
      // This test would be more complete with actual OutTrie comparison
      // but demonstrates the inverse nature of InTrie
      const edges = [
        new Edge('worksAt', 'alice', 'acme'),
        new Edge('worksAt', 'bob', 'acme'),
        new Edge('worksAt', 'alice', 'beta')
      ];

      edges.forEach(edge => trie.insert(edge));

      // Forward: alice -> [acme, beta]
      // Backward: acme -> [alice, bob], beta -> [alice]
      expect(trie.getSourcesForDestination('acme').sort()).toEqual(['alice', 'bob']);
      expect(trie.getSourcesForDestination('beta')).toEqual(['alice']);
      
      // All destinations that have any sources
      expect(trie.getAllDestinations().sort()).toEqual(['acme', 'beta']);
    });
  });
});