/**
 * Unit tests for OutTrie class
 * Tests forward traversal per design §2.2
 */

import { OutTrie } from '../../../src/trie/OutTrie.js';
import { Edge } from '../../../src/Edge.js';

describe('OutTrie', () => {
  let trie;

  beforeEach(() => {
    trie = new OutTrie('worksAt');
  });

  describe('construction', () => {
    it('should create empty trie with relation name', () => {
      expect(trie.relationName).toBe('worksAt');
      expect(trie.size).toBe(0);
      expect(trie.isEmpty()).toBe(true);
    });

    it('should validate relation name', () => {
      expect(() => new OutTrie()).toThrow('Relation name is required');
      expect(() => new OutTrie(null)).toThrow('Relation name is required');
      expect(() => new OutTrie(123)).toThrow('Relation name must be a string');
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
      
      // Alice should still exist (has beta edge)
      expect(trie.hasSource('alice')).toBe(true);
      expect(trie.getDestinationsForSource('alice')).toEqual(['beta']);
      
      // Remove alice's last edge
      trie.remove(new Edge('worksAt', 'alice', 'beta'));
      
      // Alice should be cleaned up
      expect(trie.hasSource('alice')).toBe(false);
      expect(trie.getAllSources()).toEqual(['bob']);
    });
  });

  describe('forward traversal queries', () => {
    beforeEach(() => {
      const edges = [
        new Edge('worksAt', 'alice', 'acme'),
        new Edge('worksAt', 'alice', 'beta'),
        new Edge('worksAt', 'bob', 'acme'),
        new Edge('worksAt', 'carol', 'gamma')
      ];
      edges.forEach(edge => trie.insert(edge));
    });

    it('should get destinations for source', () => {
      const aliceDests = trie.getDestinationsForSource('alice');
      expect(aliceDests.sort()).toEqual(['acme', 'beta']);
      
      const bobDests = trie.getDestinationsForSource('bob');
      expect(bobDests).toEqual(['acme']);
      
      const unknownDests = trie.getDestinationsForSource('unknown');
      expect(unknownDests).toEqual([]);
    });

    it('should get edges for source', () => {
      const aliceEdges = trie.getEdgesForSource('alice');
      expect(aliceEdges).toHaveLength(2);
      expect(aliceEdges.every(e => e.src === 'alice')).toBe(true);
      
      const bobEdges = trie.getEdgesForSource('bob');
      expect(bobEdges).toHaveLength(1);
      expect(bobEdges[0].src).toBe('bob');
      expect(bobEdges[0].dst).toBe('acme');
    });

    it('should get all sources', () => {
      const sources = trie.getAllSources();
      expect(sources.sort()).toEqual(['alice', 'bob', 'carol']);
    });

    it('should check source existence', () => {
      expect(trie.hasSource('alice')).toBe(true);
      expect(trie.hasSource('unknown')).toBe(false);
    });

    it('should check path existence', () => {
      expect(trie.hasPath('alice', 'acme')).toBe(true);
      expect(trie.hasPath('alice', 'gamma')).toBe(false);
      expect(trie.hasPath('unknown', 'acme')).toBe(false);
    });
  });

  describe('leapfrog operations', () => {
    beforeEach(() => {
      // Setup sorted test data
      const edges = [
        new Edge('worksAt', 'alice', 'a'),
        new Edge('worksAt', 'alice', 'c'),
        new Edge('worksAt', 'alice', 'e'),
        new Edge('worksAt', 'bob', 'b'),
        new Edge('worksAt', 'bob', 'd')
      ];
      edges.forEach(edge => trie.insert(edge));
    });

    it('should seek to exact destination', () => {
      const result = trie.seek('alice', 'c');
      expect(result).toBe('c');
    });

    it('should seek to next higher destination', () => {
      const result = trie.seek('alice', 'd');
      expect(result).toBe('e'); // Next after 'd' is 'e'
    });

    it('should seek to first destination when target is lower', () => {
      const result = trie.seek('alice', 'a');
      expect(result).toBe('a');
    });

    it('should return null when target is higher than all destinations', () => {
      const result = trie.seek('alice', 'z');
      expect(result).toBeNull();
    });

    it('should get next destination', () => {
      expect(trie.next('alice', 'a')).toBe('c');
      expect(trie.next('alice', 'c')).toBe('e');
      expect(trie.next('alice', 'e')).toBeNull();
    });

    it('should get min and max destinations', () => {
      expect(trie.min('alice')).toBe('a');
      expect(trie.max('alice')).toBe('e');
      
      expect(trie.min('bob')).toBe('b');
      expect(trie.max('bob')).toBe('d');
    });

    it('should handle operations on non-existent source', () => {
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
      expect(trie.getWitnessCount('alice', 'acme')).toBe(1);

      trie.insert(edge2);
      expect(trie.getWitnessCount('alice', 'acme')).toBe(1); // Same edge, single witness

      expect(trie.getWitnessCount('alice', 'unknown')).toBe(0);
      expect(trie.getWitnessCount('unknown', 'acme')).toBe(0);
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
      expect(trie.getAllSources()).toEqual([]);
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
        new Edge('worksAt', 'alice', 'beta'),
        new Edge('worksAt', 'bob', 'acme')
      ];
      edges.forEach(edge => trie.insert(edge));
    });

    it('should provide accurate statistics', () => {
      const stats = trie.getStatistics();
      
      expect(stats.relationName).toBe('worksAt');
      expect(stats.edgeCount).toBe(3);
      expect(stats.sourceCount).toBe(2); // alice, bob
      expect(stats.destinationCount).toBe(3); // acme (x2), beta (x1)
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
      expect(str).toContain('OutTrie');
      expect(str).toContain('worksAt');
      expect(str).toContain('edges=3');
      expect(str).toContain('sources=2');
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
        const edge = new Edge('worksAt', `src${i % 10}`, `dst${i}`);
        trie.insert(edge);
      }

      expect(trie.size).toBe(1000);
      
      // Test query performance
      const start = Date.now();
      const dests = trie.getDestinationsForSource('src0');
      const end = Date.now();
      
      expect(dests.length).toBe(100); // 100 destinations for src0
      expect(end - start).toBeLessThan(100); // Should be fast
    });
  });
});