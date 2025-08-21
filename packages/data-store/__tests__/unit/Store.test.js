/**
 * Unit tests for Store class
 * Tests edge storage and management per design §1
 */

import { Store } from '../../src/Store.js';
import { Edge } from '../../src/Edge.js';
import { RelationshipType } from '../../src/RelationshipType.js';

describe('Store', () => {
  let store;

  beforeEach(() => {
    store = new Store();
  });

  describe('construction', () => {
    it('should create empty store', () => {
      expect(store.getEdgeCount()).toBe(0);
      expect(store.getTypeCount()).toBe(0);
      expect(store.isEmpty()).toBe(true);
    });

    it('should initialize with empty collections', () => {
      expect(store.getAllEdges()).toHaveLength(0);
      expect(store.getTypeNames()).toHaveLength(0);
    });
  });

  describe('relationship type management', () => {
    it('should register relationship type', () => {
      store.defineRelationType('worksAt', 'workedBy');
      
      expect(store.hasRelationType('worksAt')).toBe(true);
      expect(store.getTypeCount()).toBe(1);
      expect(store.getTypeNames()).toContain('worksAt');
    });

    it('should prevent duplicate type registration', () => {
      store.defineRelationType('worksAt', 'workedBy');
      
      expect(() => store.defineRelationType('worksAt', 'different'))
        .toThrow('Relationship type \'worksAt\' is already registered');
    });

    it('should get relationship type', () => {
      store.defineRelationType('worksAt', 'workedBy');
      
      const type = store.getRelationType('worksAt');
      expect(type).toBeInstanceOf(RelationshipType);
      expect(type.forwardName).toBe('worksAt');
      expect(type.backwardName).toBe('workedBy');
    });

    it('should throw for unknown relationship type', () => {
      expect(() => store.getRelationType('unknown'))
        .toThrow('Relationship type \'unknown\' not found');
    });

    it('should support attribute resolution', () => {
      store.defineRelationType('worksAt', 'workedBy');
      
      expect(store.hasAttribute('worksAt')).toBe(true);
      expect(store.hasAttribute('workedBy')).toBe(true);
      expect(store.hasAttribute('unknown')).toBe(false);
      
      const forward = store.getAttributeByName('worksAt');
      const backward = store.getAttributeByName('workedBy');
      
      expect(forward.isForward).toBe(true);
      expect(backward.isBackward).toBe(true);
    });
  });

  describe('edge management', () => {
    beforeEach(() => {
      store.defineRelationType('worksAt', 'workedBy');
      store.defineRelationType('livesIn', 'livedIn');
    });

    it('should add edge', () => {
      const edge = new Edge('worksAt', 'alice', 'acme');
      store.addEdge(edge);
      
      expect(store.hasEdge(edge)).toBe(true);
      expect(store.getEdgeCount()).toBe(1);
      expect(store.isEmpty()).toBe(false);
    });

    it('should add edge with convenience method', () => {
      store.addEdgeByComponents('worksAt', 'alice', 'acme');
      
      expect(store.getEdgeCount()).toBe(1);
      const edges = store.getEdgesByType('worksAt');
      expect(edges).toHaveLength(1);
      expect(edges[0].src).toBe('alice');
      expect(edges[0].dst).toBe('acme');
    });

    it('should prevent duplicate edges (set semantics)', () => {
      const edge1 = new Edge('worksAt', 'alice', 'acme');
      const edge2 = new Edge('worksAt', 'alice', 'acme');
      
      store.addEdge(edge1);
      store.addEdge(edge2);
      
      expect(store.getEdgeCount()).toBe(1);
      expect(store.getEdgesByType('worksAt')).toHaveLength(1);
    });

    it('should validate edge type exists', () => {
      const edge = new Edge('unknown', 'alice', 'acme');
      
      expect(() => store.addEdge(edge))
        .toThrow('Relationship type \'unknown\' not found');
    });

    it('should remove edge', () => {
      const edge = new Edge('worksAt', 'alice', 'acme');
      store.addEdge(edge);
      
      expect(store.hasEdge(edge)).toBe(true);
      
      store.removeEdge(edge);
      
      expect(store.hasEdge(edge)).toBe(false);
      expect(store.getEdgeCount()).toBe(0);
    });

    it('should handle removing non-existent edge gracefully', () => {
      const edge = new Edge('worksAt', 'alice', 'acme');
      
      expect(() => store.removeEdge(edge)).not.toThrow();
      expect(store.getEdgeCount()).toBe(0);
    });

    it('should remove edge with convenience method', () => {
      store.addEdgeByComponents('worksAt', 'alice', 'acme');
      store.removeEdgeByComponents('worksAt', 'alice', 'acme');
      
      expect(store.getEdgeCount()).toBe(0);
    });
  });

  describe('edge queries', () => {
    beforeEach(() => {
      store.defineRelationType('worksAt', 'workedBy');
      store.defineRelationType('livesIn', 'livedIn');
      
      store.addEdgeByComponents('worksAt', 'alice', 'acme');
      store.addEdgeByComponents('worksAt', 'bob', 'acme');
      store.addEdgeByComponents('livesIn', 'alice', 'sf');
      store.addEdgeByComponents('livesIn', 'bob', 'nyc');
    });

    it('should get edges by type', () => {
      const worksAtEdges = store.getEdgesByType('worksAt');
      const livesInEdges = store.getEdgesByType('livesIn');
      
      expect(worksAtEdges).toHaveLength(2);
      expect(livesInEdges).toHaveLength(2);
      
      expect(worksAtEdges.every(e => e.type === 'worksAt')).toBe(true);
      expect(livesInEdges.every(e => e.type === 'livesIn')).toBe(true);
    });

    it('should get edges by source', () => {
      const aliceEdges = store.getEdgesBySource('alice');
      const bobEdges = store.getEdgesBySource('bob');
      
      expect(aliceEdges).toHaveLength(2);
      expect(bobEdges).toHaveLength(2);
      
      expect(aliceEdges.every(e => e.src === 'alice')).toBe(true);
      expect(bobEdges.every(e => e.src === 'bob')).toBe(true);
    });

    it('should get edges by destination', () => {
      const acmeEdges = store.getEdgesByDestination('acme');
      
      expect(acmeEdges).toHaveLength(2);
      expect(acmeEdges.every(e => e.dst === 'acme')).toBe(true);
    });

    it('should get edges by type and source', () => {
      const aliceWorksEdges = store.getEdgesByTypeAndSource('worksAt', 'alice');
      
      expect(aliceWorksEdges).toHaveLength(1);
      expect(aliceWorksEdges[0].type).toBe('worksAt');
      expect(aliceWorksEdges[0].src).toBe('alice');
      expect(aliceWorksEdges[0].dst).toBe('acme');
    });

    it('should get edges by type and destination', () => {
      const acmeWorksEdges = store.getEdgesByTypeAndDestination('worksAt', 'acme');
      
      expect(acmeWorksEdges).toHaveLength(2);
      expect(acmeWorksEdges.every(e => e.type === 'worksAt' && e.dst === 'acme')).toBe(true);
    });

    it('should return empty arrays for non-existent queries', () => {
      expect(store.getEdgesByType('unknown')).toHaveLength(0);
      expect(store.getEdgesBySource('unknown')).toHaveLength(0);
      expect(store.getEdgesByDestination('unknown')).toHaveLength(0);
    });
  });

  describe('bulk operations', () => {
    beforeEach(() => {
      store.defineRelationType('worksAt', 'workedBy');
    });

    it('should add multiple edges', () => {
      const edges = [
        new Edge('worksAt', 'alice', 'acme'),
        new Edge('worksAt', 'bob', 'acme'),
        new Edge('worksAt', 'carol', 'beta')
      ];
      
      store.addEdges(edges);
      
      expect(store.getEdgeCount()).toBe(3);
      expect(store.getEdgesByType('worksAt')).toHaveLength(3);
    });

    it('should remove multiple edges', () => {
      const edges = [
        new Edge('worksAt', 'alice', 'acme'),
        new Edge('worksAt', 'bob', 'acme'),
        new Edge('worksAt', 'carol', 'beta')
      ];
      
      store.addEdges(edges);
      expect(store.getEdgeCount()).toBe(3);
      
      store.removeEdges(edges.slice(0, 2));
      expect(store.getEdgeCount()).toBe(1);
      expect(store.hasEdge(edges[2])).toBe(true);
    });

    it('should handle empty bulk operations', () => {
      expect(() => store.addEdges([])).not.toThrow();
      expect(() => store.removeEdges([])).not.toThrow();
      expect(store.getEdgeCount()).toBe(0);
    });
  });

  describe('store operations', () => {
    beforeEach(() => {
      store.defineRelationType('worksAt', 'workedBy');
      store.addEdgeByComponents('worksAt', 'alice', 'acme');
      store.addEdgeByComponents('worksAt', 'bob', 'acme');
    });

    it('should clear all edges', () => {
      expect(store.getEdgeCount()).toBe(2);
      
      store.clearEdges();
      
      expect(store.getEdgeCount()).toBe(0);
      expect(store.isEmpty()).toBe(true);
      expect(store.hasRelationType('worksAt')).toBe(true); // Types remain
    });

    it('should clear edges by type', () => {
      store.defineRelationType('livesIn', 'livedIn');
      store.addEdgeByComponents('livesIn', 'alice', 'sf');
      
      expect(store.getEdgeCount()).toBe(3);
      
      store.clearEdgesByType('worksAt');
      
      expect(store.getEdgeCount()).toBe(1);
      expect(store.getEdgesByType('worksAt')).toHaveLength(0);
      expect(store.getEdgesByType('livesIn')).toHaveLength(1);
    });

    it('should reset store completely', () => {
      expect(store.getEdgeCount()).toBe(2);
      expect(store.getTypeCount()).toBe(1);
      
      store.reset();
      
      expect(store.getEdgeCount()).toBe(0);
      expect(store.getTypeCount()).toBe(0);
      expect(store.isEmpty()).toBe(true);
    });

    it('should provide store statistics', () => {
      const stats = store.getStatistics();
      
      expect(stats.edgeCount).toBe(2);
      expect(stats.typeCount).toBe(1);
      expect(stats.attributeCount).toBe(2);
      expect(stats.uniqueSourceCount).toBe(2);
      expect(stats.uniqueDestinationCount).toBe(1);
    });

    it('should provide detailed statistics by type', () => {
      const typeStats = store.getStatisticsByType();
      
      expect(typeStats).toHaveProperty('worksAt');
      expect(typeStats.worksAt.edgeCount).toBe(2);
      expect(typeStats.worksAt.uniqueSourceCount).toBe(2);
      expect(typeStats.worksAt.uniqueDestinationCount).toBe(1);
    });
  });

  describe('validation and error handling', () => {
    it('should validate edge parameter', () => {
      expect(() => store.addEdge(null)).toThrow('Edge is required');
      expect(() => store.addEdge('not an edge')).toThrow('Must be an Edge instance');
    });

    it('should validate edge arrays', () => {
      expect(() => store.addEdges(null)).toThrow('Edges array is required');
      expect(() => store.addEdges('not an array')).toThrow('Must be an array');
      expect(() => store.addEdges([null])).toThrow('All elements must be Edge instances');
    });

    it('should validate relationship type names', () => {
      expect(() => store.defineRelationType('', 'workedBy')).toThrow('Forward name cannot be empty');
      expect(() => store.defineRelationType('worksAt', '')).toThrow('Backward name cannot be empty');
      expect(() => store.defineRelationType(null, 'workedBy')).toThrow('Forward name is required');
    });

    it('should handle concurrent modifications safely', () => {
      store.defineRelationType('worksAt', 'workedBy');
      const edge = new Edge('worksAt', 'alice', 'acme');
      
      store.addEdge(edge);
      
      // Simulate concurrent access
      const edges1 = store.getAllEdges();
      const edges2 = store.getEdgesByType('worksAt');
      
      // Modifications to returned arrays should not affect store
      edges1.push(new Edge('worksAt', 'fake', 'fake'));
      edges2.splice(0, 1);
      
      expect(store.getEdgeCount()).toBe(1);
      expect(store.getAllEdges()).toHaveLength(1);
    });
  });
});