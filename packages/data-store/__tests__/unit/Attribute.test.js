/**
 * Unit tests for Attribute classes
 * Tests forward/backward attribute views per design §1.1
 */

import { Attribute, ForwardAttribute, BackwardAttribute } from '../../src/Attribute.js';

describe('Attribute', () => {
  describe('base class', () => {
    it('should not be instantiable directly', () => {
      expect(() => new Attribute('worksAt', 'workedBy')).toThrow('Cannot instantiate abstract Attribute class');
    });

    it('should provide static factory methods', () => {
      const forward = Attribute.forward('worksAt', 'workedBy');
      const backward = Attribute.backward('worksAt', 'workedBy');
      
      expect(forward).toBeInstanceOf(ForwardAttribute);
      expect(backward).toBeInstanceOf(BackwardAttribute);
    });

    it('should create both views from type', () => {
      const views = Attribute.both('worksAt', 'workedBy');
      
      expect(views).toHaveLength(2);
      expect(views[0]).toBeInstanceOf(ForwardAttribute);
      expect(views[1]).toBeInstanceOf(BackwardAttribute);
      expect(views[0].name).toBe('worksAt');
      expect(views[1].name).toBe('workedBy');
    });
  });

  describe('ForwardAttribute', () => {
    let attr;

    beforeEach(() => {
      attr = new ForwardAttribute('worksAt', 'workedBy');
    });

    it('should create forward attribute with names', () => {
      expect(attr.name).toBe('worksAt');
      expect(attr.forwardName).toBe('worksAt');
      expect(attr.backwardName).toBe('workedBy');
      expect(attr.isForward).toBe(true);
      expect(attr.isBackward).toBe(false);
    });

    it('should validate required parameters', () => {
      expect(() => new ForwardAttribute()).toThrow('Forward name is required');
      expect(() => new ForwardAttribute('worksAt')).toThrow('Backward name is required');
    });

    it('should validate names are strings', () => {
      expect(() => new ForwardAttribute(123, 'workedBy')).toThrow('Forward name must be a string');
      expect(() => new ForwardAttribute('worksAt', 123)).toThrow('Backward name must be a string');
      expect(() => new ForwardAttribute('', 'workedBy')).toThrow('Forward name cannot be empty');
      expect(() => new ForwardAttribute('worksAt', '')).toThrow('Backward name cannot be empty');
    });

    it('should create kernel relation name for forward', () => {
      expect(attr.kernelRelationName).toBe('worksAt');
    });

    it('should get inverse attribute', () => {
      const inverse = attr.getInverse();
      
      expect(inverse).toBeInstanceOf(BackwardAttribute);
      expect(inverse.name).toBe('workedBy');
      expect(inverse.forwardName).toBe('worksAt');
      expect(inverse.backwardName).toBe('workedBy');
    });

    it('should handle edge direction correctly', () => {
      const edge = { src: 'alice', dst: 'acme' };
      
      expect(attr.getSourceAtom(edge)).toBe('alice');
      expect(attr.getTargetAtom(edge)).toBe('acme');
    });

    it('should be immutable', () => {
      expect(() => { attr.name = 'changed'; }).toThrow();
      expect(() => { attr.forwardName = 'changed'; }).toThrow();
      expect(() => { attr.backwardName = 'changed'; }).toThrow();
    });

    it('should produce readable string representation', () => {
      const str = attr.toString();
      expect(str).toContain('ForwardAttribute');
      expect(str).toContain('worksAt');
      expect(str).toContain('workedBy');
    });

    it('should support equality comparison', () => {
      const attr1 = new ForwardAttribute('worksAt', 'workedBy');
      const attr2 = new ForwardAttribute('worksAt', 'workedBy');
      const attr3 = new ForwardAttribute('livesIn', 'livedBy');
      
      expect(attr1.equals(attr2)).toBe(true);
      expect(attr1.equals(attr3)).toBe(false);
      expect(attr1.equals(null)).toBe(false);
      expect(attr1.equals('not an attribute')).toBe(false);
    });
  });

  describe('BackwardAttribute', () => {
    let attr;

    beforeEach(() => {
      attr = new BackwardAttribute('worksAt', 'workedBy');
    });

    it('should create backward attribute with names', () => {
      expect(attr.name).toBe('workedBy');
      expect(attr.forwardName).toBe('worksAt');
      expect(attr.backwardName).toBe('workedBy');
      expect(attr.isForward).toBe(false);
      expect(attr.isBackward).toBe(true);
    });

    it('should validate required parameters', () => {
      expect(() => new BackwardAttribute()).toThrow('Forward name is required');
      expect(() => new BackwardAttribute('worksAt')).toThrow('Backward name is required');
    });

    it('should create kernel relation name for backward', () => {
      // Backward uses _inv suffix per design §1.2
      expect(attr.kernelRelationName).toBe('worksAt_inv');
    });

    it('should get inverse attribute', () => {
      const inverse = attr.getInverse();
      
      expect(inverse).toBeInstanceOf(ForwardAttribute);
      expect(inverse.name).toBe('worksAt');
      expect(inverse.forwardName).toBe('worksAt');
      expect(inverse.backwardName).toBe('workedBy');
    });

    it('should handle edge direction correctly (reversed)', () => {
      const edge = { src: 'alice', dst: 'acme' };
      
      // Backward attribute reverses src/dst
      expect(attr.getSourceAtom(edge)).toBe('acme');
      expect(attr.getTargetAtom(edge)).toBe('alice');
    });

    it('should produce readable string representation', () => {
      const str = attr.toString();
      expect(str).toContain('BackwardAttribute');
      expect(str).toContain('worksAt');
      expect(str).toContain('workedBy');
    });

    it('should support equality comparison', () => {
      const attr1 = new BackwardAttribute('worksAt', 'workedBy');
      const attr2 = new BackwardAttribute('worksAt', 'workedBy');
      const attr3 = new BackwardAttribute('livesIn', 'livedBy');
      
      expect(attr1.equals(attr2)).toBe(true);
      expect(attr1.equals(attr3)).toBe(false);
    });
  });

  describe('attribute pairing', () => {
    it('should create complementary forward/backward pair', () => {
      const forward = new ForwardAttribute('worksAt', 'workedBy');
      const backward = new BackwardAttribute('worksAt', 'workedBy');
      
      expect(forward.getInverse().equals(backward)).toBe(true);
      expect(backward.getInverse().equals(forward)).toBe(true);
    });

    it('should maintain consistent kernel relation naming', () => {
      const forward = new ForwardAttribute('worksAt', 'workedBy');
      const backward = new BackwardAttribute('worksAt', 'workedBy');
      
      expect(forward.kernelRelationName).toBe('worksAt');
      expect(backward.kernelRelationName).toBe('worksAt_inv');
    });

    it('should handle edge atoms consistently', () => {
      const edge = { src: 'alice', dst: 'acme' };
      const forward = new ForwardAttribute('worksAt', 'workedBy');
      const backward = new BackwardAttribute('worksAt', 'workedBy');
      
      // Forward: alice → acme
      expect(forward.getSourceAtom(edge)).toBe('alice');
      expect(forward.getTargetAtom(edge)).toBe('acme');
      
      // Backward: acme → alice  
      expect(backward.getSourceAtom(edge)).toBe('acme');
      expect(backward.getTargetAtom(edge)).toBe('alice');
    });
  });

  describe('edge cases', () => {
    it('should handle identical forward and backward names', () => {
      // Some relationships might be symmetric
      const attr = new ForwardAttribute('friend', 'friend');
      expect(attr.forwardName).toBe('friend');
      expect(attr.backwardName).toBe('friend');
      expect(attr.kernelRelationName).toBe('friend');
    });

    it('should handle special characters in names', () => {
      const attr = new ForwardAttribute('has-property', 'property-of');
      expect(attr.name).toBe('has-property');
      expect(attr.kernelRelationName).toBe('has-property');
    });

    it('should handle unicode in names', () => {
      const attr = new ForwardAttribute('työskenteleeTyössä', 'työskenteléeTyönantajalla');
      expect(attr.name).toBe('työskenteleeTyössä');
      expect(attr.kernelRelationName).toBe('työskenteleeTyössä');
    });
  });
});