/**
 * Integration tests for edge storage
 * Tests complete edge storage workflows per design §1
 */

import { Store } from '../../src/Store.js';
import { Edge } from '../../src/Edge.js';
import { RelationshipType } from '../../src/RelationshipType.js';

describe('Edge Storage Integration', () => {
  let store;

  beforeEach(() => {
    store = new Store();
  });

  describe('complete workflow scenarios', () => {
    it('should handle complete relationship lifecycle', () => {
      // Define relationship types
      const worksAt = store.defineRelationType('worksAt', 'workedBy');
      const livesIn = store.defineRelationType('livesIn', 'livedIn');
      
      expect(store.getTypeCount()).toBe(2);
      
      // Add edges for multiple relationships
      store.addEdgeByComponents('worksAt', 'alice', 'acme');
      store.addEdgeByComponents('worksAt', 'bob', 'acme');
      store.addEdgeByComponents('worksAt', 'carol', 'beta');
      store.addEdgeByComponents('livesIn', 'alice', 'sf');
      store.addEdgeByComponents('livesIn', 'bob', 'nyc');
      store.addEdgeByComponents('livesIn', 'carol', 'sf');
      
      expect(store.getEdgeCount()).toBe(6);
      
      // Query by multiple dimensions
      const acmeEmployees = store.getEdgesByDestination('acme');
      expect(acmeEmployees).toHaveLength(2);
      expect(acmeEmployees.every(e => e.type === 'worksAt')).toBe(true);
      
      const sfResidents = store.getEdgesByDestination('sf');
      expect(sfResidents).toHaveLength(2);
      expect(sfResidents.every(e => e.type === 'livesIn')).toBe(true);
      
      const aliceRelations = store.getEdgesBySource('alice');
      expect(aliceRelations).toHaveLength(2);
      expect(aliceRelations.map(e => e.type).sort()).toEqual(['livesIn', 'worksAt']);
      
      // Modify relationships
      store.removeEdgeByComponents('worksAt', 'alice', 'acme');
      store.addEdgeByComponents('worksAt', 'alice', 'gamma');
      
      expect(store.getEdgeCount()).toBe(6); // Same count, but alice moved companies
      
      const newAcmeEmployees = store.getEdgesByDestination('acme');
      expect(newAcmeEmployees).toHaveLength(1);
      expect(newAcmeEmployees[0].src).toBe('bob');
      
      const gammaEmployees = store.getEdgesByDestination('gamma');
      expect(gammaEmployees).toHaveLength(1);
      expect(gammaEmployees[0].src).toBe('alice');
    });

    it('should maintain referential integrity during bulk operations', () => {
      store.defineRelationType('manages', 'managedBy');
      
      // Create organization hierarchy
      const hierarchy = [
        new Edge('manages', 'ceo', 'vp-eng'),
        new Edge('manages', 'ceo', 'vp-sales'),
        new Edge('manages', 'vp-eng', 'eng-lead1'),
        new Edge('manages', 'vp-eng', 'eng-lead2'),
        new Edge('manages', 'vp-sales', 'sales-lead1'),
        new Edge('manages', 'eng-lead1', 'dev1'),
        new Edge('manages', 'eng-lead1', 'dev2'),
        new Edge('manages', 'eng-lead2', 'dev3')
      ];
      
      store.addEdges(hierarchy);
      expect(store.getEdgeCount()).toBe(8);
      
      // Verify hierarchy integrity
      const ceoDirects = store.getEdgesBySource('ceo');
      expect(ceoDirects).toHaveLength(2);
      expect(ceoDirects.map(e => e.dst).sort()).toEqual(['vp-eng', 'vp-sales']);
      
      const vpEngTeam = store.getEdgesBySource('vp-eng');
      expect(vpEngTeam).toHaveLength(2);
      expect(vpEngTeam.every(e => e.dst.startsWith('eng-lead'))).toBe(true);
      
      // Reorganization: remove VP level, flatten structure
      const vpLevel = store.getEdgesBySource('vp-eng');
      store.removeEdges(vpLevel);
      
      // Add direct CEO -> eng-lead relationships
      store.addEdgeByComponents('manages', 'ceo', 'eng-lead1');
      store.addEdgeByComponents('manages', 'ceo', 'eng-lead2');
      
      expect(store.getEdgeCount()).toBe(8); // 8 - 2 + 2 = 8 (same total, restructured)
      
      const newCeoDirects = store.getEdgesBySource('ceo');
      expect(newCeoDirects).toHaveLength(4); // vp-sales + 2 eng-leads
    });

    it('should handle complex attribute resolution scenarios', () => {
      // Multi-relationship scenario
      store.defineRelationType('authorOf', 'authoredBy');
      store.defineRelationType('citedBy', 'cites');
      store.defineRelationType('collaboratesWith', 'collaboratesWith');
      
      // Academic collaboration network
      store.addEdgeByComponents('authorOf', 'alice', 'paper1');
      store.addEdgeByComponents('authorOf', 'bob', 'paper1');
      store.addEdgeByComponents('authorOf', 'alice', 'paper2');
      store.addEdgeByComponents('authorOf', 'carol', 'paper3');
      store.addEdgeByComponents('citedBy', 'paper2', 'paper1');
      store.addEdgeByComponents('citedBy', 'paper3', 'paper1');
      store.addEdgeByComponents('collaboratesWith', 'alice', 'bob');
      
      // Verify all attributes are resolvable
      expect(store.hasAttribute('authorOf')).toBe(true);
      expect(store.hasAttribute('authoredBy')).toBe(true);
      expect(store.hasAttribute('citedBy')).toBe(true);
      expect(store.hasAttribute('cites')).toBe(true);
      expect(store.hasAttribute('collaboratesWith')).toBe(true);
      
      // Get attributes and verify their properties
      const authorOfAttr = store.getAttributeByName('authorOf');
      const authoredByAttr = store.getAttributeByName('authoredBy');
      
      expect(authorOfAttr.isForward).toBe(true);
      expect(authoredByAttr.isBackward).toBe(true);
      expect(authorOfAttr.kernelRelationName).toBe('authorOf');
      expect(authoredByAttr.kernelRelationName).toBe('authorOf_inv');
      
      // Verify complex queries work
      const aliceWorks = store.getEdgesByTypeAndSource('authorOf', 'alice');
      expect(aliceWorks).toHaveLength(2);
      expect(aliceWorks.map(e => e.dst).sort()).toEqual(['paper1', 'paper2']);
      
      const paper1Authors = store.getEdgesByTypeAndDestination('authorOf', 'paper1');
      expect(paper1Authors).toHaveLength(2);
      expect(paper1Authors.map(e => e.src).sort()).toEqual(['alice', 'bob']);
      
      const paper1Citations = store.getEdgesByTypeAndDestination('citedBy', 'paper1');
      expect(paper1Citations).toHaveLength(2);
      expect(paper1Citations.map(e => e.src).sort()).toEqual(['paper2', 'paper3']);
    });
  });

  describe('edge equality and set semantics', () => {
    beforeEach(() => {
      store.defineRelationType('related', 'relatedBy');
    });

    it('should prevent duplicate edges across multiple add operations', () => {
      const edge1 = new Edge('related', 'a', 'b');
      const edge2 = new Edge('related', 'a', 'b'); // Same values, different instance
      const edge3 = new Edge('related', 'a', 'c'); // Different dst
      
      store.addEdge(edge1);
      store.addEdge(edge2); // Should be ignored (duplicate)
      store.addEdge(edge3);
      
      expect(store.getEdgeCount()).toBe(2);
      expect(store.hasEdge(edge1)).toBe(true);
      expect(store.hasEdge(edge2)).toBe(true); // Same logical edge
      expect(store.hasEdge(edge3)).toBe(true);
    });

    it('should handle edge removal with different but equal instances', () => {
      const addEdge = new Edge('related', 'x', 'y');
      const removeEdge = new Edge('related', 'x', 'y'); // Different instance, same values
      
      store.addEdge(addEdge);
      expect(store.hasEdge(addEdge)).toBe(true);
      expect(store.hasEdge(removeEdge)).toBe(true); // Should be considered equal
      
      store.removeEdge(removeEdge);
      expect(store.hasEdge(addEdge)).toBe(false);
      expect(store.hasEdge(removeEdge)).toBe(false);
      expect(store.getEdgeCount()).toBe(0);
    });

    it('should maintain set semantics with mixed atom types', () => {
      const edge1 = new Edge('related', 'alice', 30);
      const edge2 = new Edge('related', 'alice', 30); // Same values
      const edge3 = new Edge('related', 'alice', '30'); // String vs number
      const edge4 = new Edge('related', 'alice', true);
      
      store.addEdge(edge1);
      store.addEdge(edge2); // Duplicate, should be ignored
      store.addEdge(edge3); // Different type, should be added
      store.addEdge(edge4);
      
      expect(store.getEdgeCount()).toBe(3);
      expect(store.hasEdge(edge1)).toBe(true);
      expect(store.hasEdge(edge2)).toBe(true); // Equal to edge1
      expect(store.hasEdge(edge3)).toBe(true); // Different dst type
      expect(store.hasEdge(edge4)).toBe(true);
    });
  });

  describe('store statistics and analytics', () => {
    beforeEach(() => {
      store.defineRelationType('follows', 'followedBy');
      store.defineRelationType('likes', 'likedBy');
    });

    it('should provide accurate statistics for social network scenario', () => {
      // Social network relationships
      store.addEdgeByComponents('follows', 'alice', 'bob');
      store.addEdgeByComponents('follows', 'alice', 'carol');
      store.addEdgeByComponents('follows', 'bob', 'carol');
      store.addEdgeByComponents('follows', 'carol', 'alice');
      
      store.addEdgeByComponents('likes', 'alice', 'post1');
      store.addEdgeByComponents('likes', 'bob', 'post1');
      store.addEdgeByComponents('likes', 'carol', 'post1');
      store.addEdgeByComponents('likes', 'alice', 'post2');
      store.addEdgeByComponents('likes', 'bob', 'post2');
      
      const stats = store.getStatistics();
      expect(stats.edgeCount).toBe(9);
      expect(stats.typeCount).toBe(2);
      expect(stats.attributeCount).toBe(4); // follows, followedBy, likes, likedBy
      expect(stats.uniqueSourceCount).toBe(3); // alice, bob, carol
      expect(stats.uniqueDestinationCount).toBe(5); // alice, bob, carol, post1, post2
      
      const typeStats = store.getStatisticsByType();
      expect(typeStats.follows.edgeCount).toBe(4);
      expect(typeStats.follows.uniqueSourceCount).toBe(3);
      expect(typeStats.follows.uniqueDestinationCount).toBe(3);
      
      expect(typeStats.likes.edgeCount).toBe(5);
      expect(typeStats.likes.uniqueSourceCount).toBe(3);
      expect(typeStats.likes.uniqueDestinationCount).toBe(2);
    });

    it('should handle statistics after edge removal', () => {
      // Initial setup
      store.addEdgeByComponents('follows', 'a', 'b');
      store.addEdgeByComponents('follows', 'b', 'c');
      store.addEdgeByComponents('follows', 'c', 'a');
      
      let stats = store.getStatistics();
      expect(stats.edgeCount).toBe(3);
      expect(stats.uniqueSourceCount).toBe(3);
      expect(stats.uniqueDestinationCount).toBe(3);
      
      // Remove one edge
      store.removeEdgeByComponents('follows', 'b', 'c');
      
      stats = store.getStatistics();
      expect(stats.edgeCount).toBe(2);
      expect(stats.uniqueSourceCount).toBe(2); // a, c (b no longer a source)
      expect(stats.uniqueDestinationCount).toBe(2); // a, b (c no longer a destination)
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle empty store operations gracefully', () => {
      expect(store.getAllEdges()).toHaveLength(0);
      expect(store.getEdgesByType('nonexistent')).toHaveLength(0);
      expect(store.getEdgesBySource('nonexistent')).toHaveLength(0);
      expect(store.getEdgesByDestination('nonexistent')).toHaveLength(0);
      
      const stats = store.getStatistics();
      expect(stats.edgeCount).toBe(0);
      expect(stats.uniqueSourceCount).toBe(0);
      expect(stats.uniqueDestinationCount).toBe(0);
    });

    it('should maintain consistency after clearing operations', () => {
      store.defineRelationType('test', 'testBy');
      store.addEdgeByComponents('test', 'a', 'b');
      store.addEdgeByComponents('test', 'b', 'c');
      
      expect(store.getEdgeCount()).toBe(2);
      
      store.clearEdges();
      
      expect(store.getEdgeCount()).toBe(0);
      expect(store.isEmpty()).toBe(true);
      expect(store.getAllEdges()).toHaveLength(0);
      expect(store.getEdgesByType('test')).toHaveLength(0);
      expect(store.hasRelationType('test')).toBe(true); // Types preserved
      
      // Should be able to add edges again
      store.addEdgeByComponents('test', 'x', 'y');
      expect(store.getEdgeCount()).toBe(1);
    });

    it('should handle type-specific clearing', () => {
      store.defineRelationType('type1', 'type1By');
      store.defineRelationType('type2', 'type2By');
      
      store.addEdgeByComponents('type1', 'a', 'b');
      store.addEdgeByComponents('type1', 'b', 'c');
      store.addEdgeByComponents('type2', 'x', 'y');
      store.addEdgeByComponents('type2', 'y', 'z');
      
      expect(store.getEdgeCount()).toBe(4);
      
      store.clearEdgesByType('type1');
      
      expect(store.getEdgeCount()).toBe(2);
      expect(store.getEdgesByType('type1')).toHaveLength(0);
      expect(store.getEdgesByType('type2')).toHaveLength(2);
      expect(store.hasRelationType('type1')).toBe(true); // Type definition preserved
      expect(store.hasRelationType('type2')).toBe(true);
    });
  });
});