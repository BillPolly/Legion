/**
 * Unit tests for Edge class
 * Tests binary relationship instances per design §1.1
 */

import { Edge } from '../../src/Edge.js';

describe('Edge', () => {
  describe('construction', () => {
    it('should create edge with type, src, and dst', () => {
      const edge = new Edge('worksAt', 'alice', 'acme');
      
      expect(edge.type).toBe('worksAt');
      expect(edge.src).toBe('alice');
      expect(edge.dst).toBe('acme');
    });

    it('should validate required parameters', () => {
      expect(() => new Edge()).toThrow('Edge type is required');
      expect(() => new Edge('worksAt')).toThrow('Edge src is required');
      expect(() => new Edge('worksAt', 'alice')).toThrow('Edge dst is required');
    });

    it('should validate type is string', () => {
      expect(() => new Edge(123, 'alice', 'acme')).toThrow('Edge type must be a string');
      expect(() => new Edge(null, 'alice', 'acme')).toThrow('Edge type is required');
      expect(() => new Edge('', 'alice', 'acme')).toThrow('Edge type cannot be empty');
    });

    it('should allow any type for src and dst atoms', () => {
      // String atoms
      const edge1 = new Edge('worksAt', 'alice', 'acme');
      expect(edge1.src).toBe('alice');
      expect(edge1.dst).toBe('acme');

      // Mixed atom types
      const edge2 = new Edge('hasAge', 'alice', 30);
      expect(edge2.src).toBe('alice');
      expect(edge2.dst).toBe(30);

      // Boolean atoms
      const edge3 = new Edge('isActive', 'alice', true);
      expect(edge3.src).toBe('alice');
      expect(edge3.dst).toBe(true);
    });
  });

  describe('equality', () => {
    it('should consider edges equal if all components match', () => {
      const edge1 = new Edge('worksAt', 'alice', 'acme');
      const edge2 = new Edge('worksAt', 'alice', 'acme');
      
      expect(edge1.equals(edge2)).toBe(true);
      expect(edge2.equals(edge1)).toBe(true);
    });

    it('should consider edges unequal if any component differs', () => {
      const base = new Edge('worksAt', 'alice', 'acme');
      
      const diffType = new Edge('livesIn', 'alice', 'acme');
      const diffSrc = new Edge('worksAt', 'bob', 'acme');
      const diffDst = new Edge('worksAt', 'alice', 'beta');
      
      expect(base.equals(diffType)).toBe(false);
      expect(base.equals(diffSrc)).toBe(false);
      expect(base.equals(diffDst)).toBe(false);
    });

    it('should handle null and non-Edge objects', () => {
      const edge = new Edge('worksAt', 'alice', 'acme');
      
      expect(edge.equals(null)).toBe(false);
      expect(edge.equals(undefined)).toBe(false);
      expect(edge.equals({})).toBe(false);
      expect(edge.equals('not an edge')).toBe(false);
    });

    it('should work with different atom types', () => {
      const edge1 = new Edge('hasAge', 'alice', 30);
      const edge2 = new Edge('hasAge', 'alice', 30);
      const edge3 = new Edge('hasAge', 'alice', '30'); // String vs number
      
      expect(edge1.equals(edge2)).toBe(true);
      expect(edge1.equals(edge3)).toBe(false);
    });
  });

  describe('hash code', () => {
    it('should produce consistent hash codes', () => {
      const edge = new Edge('worksAt', 'alice', 'acme');
      
      const hash1 = edge.hashCode();
      const hash2 = edge.hashCode();
      
      expect(hash1).toBe(hash2);
    });

    it('should produce same hash for equal edges', () => {
      const edge1 = new Edge('worksAt', 'alice', 'acme');
      const edge2 = new Edge('worksAt', 'alice', 'acme');
      
      expect(edge1.hashCode()).toBe(edge2.hashCode());
    });

    it('should generally produce different hashes for different edges', () => {
      const edge1 = new Edge('worksAt', 'alice', 'acme');
      const edge2 = new Edge('worksAt', 'alice', 'beta');
      const edge3 = new Edge('livesIn', 'alice', 'acme');
      
      const hash1 = edge1.hashCode();
      const hash2 = edge2.hashCode();
      const hash3 = edge3.hashCode();
      
      // Not guaranteed, but highly likely for good hash function
      expect(hash1).not.toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash2).not.toBe(hash3);
    });
  });

  describe('string representation', () => {
    it('should produce readable string representation', () => {
      const edge = new Edge('worksAt', 'alice', 'acme');
      const str = edge.toString();
      
      expect(str).toContain('worksAt');
      expect(str).toContain('alice');
      expect(str).toContain('acme');
    });

    it('should handle different atom types in string representation', () => {
      const edge = new Edge('hasAge', 'alice', 30);
      const str = edge.toString();
      
      expect(str).toContain('hasAge');
      expect(str).toContain('alice');
      expect(str).toContain('30');
    });
  });

  describe('immutability', () => {
    it('should be immutable after construction', () => {
      const edge = new Edge('worksAt', 'alice', 'acme');
      
      // Attempt to modify properties
      expect(() => { edge.type = 'livesIn'; }).toThrow();
      expect(() => { edge.src = 'bob'; }).toThrow();
      expect(() => { edge.dst = 'beta'; }).toThrow();
      
      // Properties should remain unchanged
      expect(edge.type).toBe('worksAt');
      expect(edge.src).toBe('alice');
      expect(edge.dst).toBe('acme');
    });
  });

  describe('static factory methods', () => {
    it('should create edge from components', () => {
      const edge = Edge.of('worksAt', 'alice', 'acme');
      
      expect(edge).toBeInstanceOf(Edge);
      expect(edge.type).toBe('worksAt');
      expect(edge.src).toBe('alice');
      expect(edge.dst).toBe('acme');
    });

    it('should create edge from triple array', () => {
      const edge = Edge.fromTriple(['worksAt', 'alice', 'acme']);
      
      expect(edge).toBeInstanceOf(Edge);
      expect(edge.type).toBe('worksAt');
      expect(edge.src).toBe('alice');
      expect(edge.dst).toBe('acme');
    });

    it('should validate triple array', () => {
      expect(() => Edge.fromTriple([])).toThrow('Triple must have exactly 3 elements');
      expect(() => Edge.fromTriple(['worksAt', 'alice'])).toThrow('Triple must have exactly 3 elements');
      expect(() => Edge.fromTriple(['worksAt', 'alice', 'acme', 'extra'])).toThrow('Triple must have exactly 3 elements');
    });
  });

  describe('conversion methods', () => {
    it('should convert to triple array', () => {
      const edge = new Edge('worksAt', 'alice', 'acme');
      const triple = edge.toTriple();
      
      expect(triple).toEqual(['worksAt', 'alice', 'acme']);
    });

    it('should convert to object', () => {
      const edge = new Edge('worksAt', 'alice', 'acme');
      const obj = edge.toObject();
      
      expect(obj).toEqual({
        type: 'worksAt',
        src: 'alice',
        dst: 'acme'
      });
    });
  });
});