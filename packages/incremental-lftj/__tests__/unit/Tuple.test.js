import { Tuple } from '../../src/Tuple.js';
import { Integer, StringAtom, BooleanAtom, Float, ID } from '../../src/Atom.js';

describe('Tuple', () => {
  describe('Creation', () => {
    it('should create empty tuple', () => {
      const tuple = new Tuple([]);
      expect(tuple.arity).toBe(0);
      expect(tuple.atoms).toEqual([]);
    });

    it('should create tuple with atoms', () => {
      const atoms = [new Integer(1), new StringAtom('hello'), new BooleanAtom(true)];
      const tuple = new Tuple(atoms);
      expect(tuple.arity).toBe(3);
      expect(tuple.atoms).toEqual(atoms);
    });

    it('should be immutable', () => {
      const atoms = [new Integer(1), new StringAtom('hello')];
      const tuple = new Tuple(atoms);
      expect(() => { tuple.atoms.push(new Integer(2)); }).toThrow();
    });

    it('should validate atoms are Atom instances', () => {
      expect(() => new Tuple([1, 2, 3])).toThrow('All elements must be Atom instances');
      expect(() => new Tuple(['string'])).toThrow('All elements must be Atom instances');
      expect(() => new Tuple([null])).toThrow('All elements must be Atom instances');
    });
  });

  describe('Equality', () => {
    it('should consider tuples equal if all atoms are equal', () => {
      const tuple1 = new Tuple([new Integer(1), new StringAtom('test')]);
      const tuple2 = new Tuple([new Integer(1), new StringAtom('test')]);
      expect(tuple1.equals(tuple2)).toBe(true);
    });

    it('should not consider tuples equal if arities differ', () => {
      const tuple1 = new Tuple([new Integer(1)]);
      const tuple2 = new Tuple([new Integer(1), new StringAtom('test')]);
      expect(tuple1.equals(tuple2)).toBe(false);
    });

    it('should not consider tuples equal if atoms differ', () => {
      const tuple1 = new Tuple([new Integer(1), new StringAtom('test')]);
      const tuple2 = new Tuple([new Integer(1), new StringAtom('other')]);
      expect(tuple1.equals(tuple2)).toBe(false);
    });

    it('should handle empty tuples', () => {
      const tuple1 = new Tuple([]);
      const tuple2 = new Tuple([]);
      expect(tuple1.equals(tuple2)).toBe(true);
    });
  });

  describe('Canonical Encoding', () => {
    it('should encode empty tuple', () => {
      const tuple = new Tuple([]);
      const bytes = tuple.toBytes();
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes[0]).toBe(0); // Arity = 0
    });

    it('should encode single atom tuple', () => {
      const tuple = new Tuple([new Integer(42)]);
      const bytes = tuple.toBytes();
      expect(bytes[0]).toBe(1); // Arity = 1
      // Should contain encoded integer
      expect(bytes.length).toBeGreaterThan(1);
    });

    it('should encode multi-atom tuple', () => {
      const tuple = new Tuple([
        new BooleanAtom(true),
        new Integer(42),
        new StringAtom('hello')
      ]);
      const bytes = tuple.toBytes();
      expect(bytes[0]).toBe(3); // Arity = 3
      expect(bytes.length).toBeGreaterThan(3);
    });

    it('should produce identical bytes for equal tuples', () => {
      const tuple1 = new Tuple([new Integer(1), new StringAtom('test')]);
      const tuple2 = new Tuple([new Integer(1), new StringAtom('test')]);
      const bytes1 = tuple1.toBytes();
      const bytes2 = tuple2.toBytes();
      expect(Buffer.from(bytes1).equals(Buffer.from(bytes2))).toBe(true);
    });

    it('should produce different bytes for different tuples', () => {
      const tuple1 = new Tuple([new Integer(1), new StringAtom('test')]);
      const tuple2 = new Tuple([new Integer(2), new StringAtom('test')]);
      const bytes1 = tuple1.toBytes();
      const bytes2 = tuple2.toBytes();
      expect(Buffer.from(bytes1).equals(Buffer.from(bytes2))).toBe(false);
    });
  });

  describe('Hash Code', () => {
    it('should produce consistent hash codes', () => {
      const tuple = new Tuple([new Integer(1), new StringAtom('test')]);
      const hash1 = tuple.hashCode();
      const hash2 = tuple.hashCode();
      expect(hash1).toBe(hash2);
    });

    it('should produce same hash for equal tuples', () => {
      const tuple1 = new Tuple([new Integer(1), new StringAtom('test')]);
      const tuple2 = new Tuple([new Integer(1), new StringAtom('test')]);
      expect(tuple1.hashCode()).toBe(tuple2.hashCode());
    });

    it('should generally produce different hashes for different tuples', () => {
      const tuple1 = new Tuple([new Integer(1), new StringAtom('test')]);
      const tuple2 = new Tuple([new Integer(2), new StringAtom('test')]);
      // Note: hash collisions are possible but should be rare
      expect(tuple1.hashCode()).not.toBe(tuple2.hashCode());
    });
  });

  describe('Projection', () => {
    it('should project to subset of indices', () => {
      const tuple = new Tuple([
        new Integer(1),
        new StringAtom('hello'),
        new BooleanAtom(true),
        new Float(3.14)
      ]);
      
      const projected = tuple.project([0, 2]);
      expect(projected.arity).toBe(2);
      expect(projected.atoms[0].equals(new Integer(1))).toBe(true);
      expect(projected.atoms[1].equals(new BooleanAtom(true))).toBe(true);
    });

    it('should handle empty projection', () => {
      const tuple = new Tuple([new Integer(1), new StringAtom('hello')]);
      const projected = tuple.project([]);
      expect(projected.arity).toBe(0);
      expect(projected.atoms).toEqual([]);
    });

    it('should handle single element projection', () => {
      const tuple = new Tuple([new Integer(1), new StringAtom('hello')]);
      const projected = tuple.project([1]);
      expect(projected.arity).toBe(1);
      expect(projected.atoms[0].equals(new StringAtom('hello'))).toBe(true);
    });

    it('should validate projection indices', () => {
      const tuple = new Tuple([new Integer(1), new StringAtom('hello')]);
      expect(() => tuple.project([0, 5])).toThrow('Index 5 out of bounds');
      expect(() => tuple.project([-1])).toThrow('Index -1 out of bounds');
    });
  });

  describe('Access', () => {
    it('should access atoms by index', () => {
      const tuple = new Tuple([new Integer(1), new StringAtom('hello')]);
      expect(tuple.get(0).equals(new Integer(1))).toBe(true);
      expect(tuple.get(1).equals(new StringAtom('hello'))).toBe(true);
    });

    it('should validate access indices', () => {
      const tuple = new Tuple([new Integer(1)]);
      expect(() => tuple.get(1)).toThrow('Index 1 out of bounds');
      expect(() => tuple.get(-1)).toThrow('Index -1 out of bounds');
    });
  });
});