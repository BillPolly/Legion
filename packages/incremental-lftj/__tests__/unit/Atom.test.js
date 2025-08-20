import { Atom, ID, Integer, Float, String as StringAtom, Boolean as BooleanAtom, Symbol as SymbolAtom } from '../../src/Atom.js';

describe('Atom Types', () => {
  describe('Creation and Immutability', () => {
    it('should create ID atoms', () => {
      const id = new ID('user123');
      expect(id.value).toBe('user123');
      expect(id.type).toBe('ID');
    });

    it('should create Integer atoms', () => {
      const int = new Integer(42);
      expect(int.value).toBe(42);
      expect(int.type).toBe('Integer');
    });

    it('should create Float atoms', () => {
      const float = new Float(3.14);
      expect(float.value).toBe(3.14);
      expect(float.type).toBe('Float');
    });

    it('should create String atoms', () => {
      const str = new StringAtom('hello');
      expect(str.value).toBe('hello');
      expect(str.type).toBe('String');
    });

    it('should create Boolean atoms', () => {
      const bool = new BooleanAtom(true);
      expect(bool.value).toBe(true);
      expect(bool.type).toBe('Boolean');
    });

    it('should create Symbol atoms', () => {
      const sym = new SymbolAtom(':keyword');
      expect(sym.value).toBe(':keyword');
      expect(sym.type).toBe('Symbol');
    });

    it('should be immutable', () => {
      const int = new Integer(42);
      expect(() => { int.value = 43; }).toThrow();
    });
  });

  describe('Equality', () => {
    it('should consider atoms equal if type and value match', () => {
      const int1 = new Integer(42);
      const int2 = new Integer(42);
      expect(int1.equals(int2)).toBe(true);
    });

    it('should not consider atoms equal if types differ', () => {
      const int = new Integer(1);
      const str = new StringAtom('1');
      expect(int.equals(str)).toBe(false);
    });

    it('should not consider atoms equal if values differ', () => {
      const int1 = new Integer(1);
      const int2 = new Integer(2);
      expect(int1.equals(int2)).toBe(false);
    });
  });

  describe('Total Ordering', () => {
    describe('Type Precedence', () => {
      it('should order Boolean < Integer', () => {
        const bool = new BooleanAtom(true);
        const int = new Integer(0);
        expect(bool.compareTo(int)).toBeLessThan(0);
        expect(int.compareTo(bool)).toBeGreaterThan(0);
      });

      it('should order Integer < Float', () => {
        const int = new Integer(100);
        const float = new Float(0.1);
        expect(int.compareTo(float)).toBeLessThan(0);
        expect(float.compareTo(int)).toBeGreaterThan(0);
      });

      it('should order Float < String', () => {
        const float = new Float(999.9);
        const str = new StringAtom('a');
        expect(float.compareTo(str)).toBeLessThan(0);
        expect(str.compareTo(float)).toBeGreaterThan(0);
      });

      it('should order String < Symbol', () => {
        const str = new StringAtom('zzz');
        const sym = new SymbolAtom(':aaa');
        expect(str.compareTo(sym)).toBeLessThan(0);
        expect(sym.compareTo(str)).toBeGreaterThan(0);
      });

      it('should order Symbol < ID', () => {
        const sym = new SymbolAtom(':zzz');
        const id = new ID('aaa');
        expect(sym.compareTo(id)).toBeLessThan(0);
        expect(id.compareTo(sym)).toBeGreaterThan(0);
      });
    });

    describe('Within-Type Ordering', () => {
      it('should order booleans: false < true', () => {
        const f = new BooleanAtom(false);
        const t = new BooleanAtom(true);
        expect(f.compareTo(t)).toBeLessThan(0);
        expect(t.compareTo(f)).toBeGreaterThan(0);
        expect(f.compareTo(f)).toBe(0);
      });

      it('should order integers numerically', () => {
        const int1 = new Integer(-10);
        const int2 = new Integer(0);
        const int3 = new Integer(100);
        expect(int1.compareTo(int2)).toBeLessThan(0);
        expect(int2.compareTo(int3)).toBeLessThan(0);
        expect(int3.compareTo(int1)).toBeGreaterThan(0);
        expect(int2.compareTo(int2)).toBe(0);
      });

      it('should order floats numerically', () => {
        const f1 = new Float(-3.14);
        const f2 = new Float(0.0);
        const f3 = new Float(2.71);
        expect(f1.compareTo(f2)).toBeLessThan(0);
        expect(f2.compareTo(f3)).toBeLessThan(0);
        expect(f3.compareTo(f1)).toBeGreaterThan(0);
        expect(f2.compareTo(f2)).toBe(0);
      });

      it('should order strings lexicographically', () => {
        const s1 = new StringAtom('apple');
        const s2 = new StringAtom('banana');
        const s3 = new StringAtom('cherry');
        expect(s1.compareTo(s2)).toBeLessThan(0);
        expect(s2.compareTo(s3)).toBeLessThan(0);
        expect(s3.compareTo(s1)).toBeGreaterThan(0);
        expect(s2.compareTo(s2)).toBe(0);
      });

      it('should order symbols lexicographically', () => {
        const sym1 = new SymbolAtom(':alpha');
        const sym2 = new SymbolAtom(':beta');
        const sym3 = new SymbolAtom(':gamma');
        expect(sym1.compareTo(sym2)).toBeLessThan(0);
        expect(sym2.compareTo(sym3)).toBeLessThan(0);
        expect(sym3.compareTo(sym1)).toBeGreaterThan(0);
        expect(sym2.compareTo(sym2)).toBe(0);
      });

      it('should order IDs lexicographically', () => {
        const id1 = new ID('id001');
        const id2 = new ID('id002');
        const id3 = new ID('id010');
        expect(id1.compareTo(id2)).toBeLessThan(0);
        expect(id2.compareTo(id3)).toBeLessThan(0);
        expect(id3.compareTo(id1)).toBeGreaterThan(0);
        expect(id2.compareTo(id2)).toBe(0);
      });
    });
  });

  describe('Canonical Encoding', () => {
    it('should encode Boolean atoms', () => {
      const t = new BooleanAtom(true);
      const f = new BooleanAtom(false);
      const tBytes = t.toBytes();
      const fBytes = f.toBytes();
      expect(tBytes).toBeInstanceOf(Uint8Array);
      expect(fBytes).toBeInstanceOf(Uint8Array);
      expect(Buffer.from(tBytes).equals(Buffer.from(fBytes))).toBe(false);
    });

    it('should encode Integer atoms', () => {
      const int1 = new Integer(42);
      const int2 = new Integer(42);
      const int3 = new Integer(43);
      const bytes1 = int1.toBytes();
      const bytes2 = int2.toBytes();
      const bytes3 = int3.toBytes();
      expect(Buffer.from(bytes1).equals(Buffer.from(bytes2))).toBe(true);
      expect(Buffer.from(bytes1).equals(Buffer.from(bytes3))).toBe(false);
    });

    it('should encode Float atoms', () => {
      const f1 = new Float(3.14);
      const f2 = new Float(3.14);
      const f3 = new Float(2.71);
      const bytes1 = f1.toBytes();
      const bytes2 = f2.toBytes();
      const bytes3 = f3.toBytes();
      expect(Buffer.from(bytes1).equals(Buffer.from(bytes2))).toBe(true);
      expect(Buffer.from(bytes1).equals(Buffer.from(bytes3))).toBe(false);
    });

    it('should encode String atoms', () => {
      const s1 = new StringAtom('hello');
      const s2 = new StringAtom('hello');
      const s3 = new StringAtom('world');
      const bytes1 = s1.toBytes();
      const bytes2 = s2.toBytes();
      const bytes3 = s3.toBytes();
      expect(Buffer.from(bytes1).equals(Buffer.from(bytes2))).toBe(true);
      expect(Buffer.from(bytes1).equals(Buffer.from(bytes3))).toBe(false);
    });

    it('should encode Symbol atoms', () => {
      const sym1 = new SymbolAtom(':key');
      const sym2 = new SymbolAtom(':key');
      const sym3 = new SymbolAtom(':val');
      const bytes1 = sym1.toBytes();
      const bytes2 = sym2.toBytes();
      const bytes3 = sym3.toBytes();
      expect(Buffer.from(bytes1).equals(Buffer.from(bytes2))).toBe(true);
      expect(Buffer.from(bytes1).equals(Buffer.from(bytes3))).toBe(false);
    });

    it('should encode ID atoms', () => {
      const id1 = new ID('user123');
      const id2 = new ID('user123');
      const id3 = new ID('user456');
      const bytes1 = id1.toBytes();
      const bytes2 = id2.toBytes();
      const bytes3 = id3.toBytes();
      expect(Buffer.from(bytes1).equals(Buffer.from(bytes2))).toBe(true);
      expect(Buffer.from(bytes1).equals(Buffer.from(bytes3))).toBe(false);
    });
  });
});