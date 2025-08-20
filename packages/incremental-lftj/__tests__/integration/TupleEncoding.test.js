import { Tuple } from '../../src/Tuple.js';
import { Integer, StringAtom, BooleanAtom, Float, ID, SymbolAtom } from '../../src/Atom.js';

describe('Tuple Encoding Integration', () => {
  it('should encode and use tuples as Map keys', () => {
    const map = new Map();
    
    const tuple1 = new Tuple([new Integer(1), new StringAtom('test')]);
    const tuple2 = new Tuple([new Integer(1), new StringAtom('test')]);
    const tuple3 = new Tuple([new Integer(2), new StringAtom('test')]);
    
    map.set(tuple1.toBytes().toString(), 'value1');
    map.set(tuple3.toBytes().toString(), 'value3');
    
    // Should find tuple1 value using tuple2 (equal tuples)
    expect(map.get(tuple2.toBytes().toString())).toBe('value1');
    expect(map.get(tuple3.toBytes().toString())).toBe('value3');
    expect(map.size).toBe(2);
  });

  it('should handle complex tuples as witness table keys', () => {
    // Simulate witness table: tuple -> count
    const witnessTable = new Map();
    
    const complexTuple = new Tuple([
      new BooleanAtom(true),
      new Integer(42),
      new Float(3.14),
      new StringAtom('hello world'),
      new SymbolAtom(':keyword'),
      new ID('user_123')
    ]);
    
    const key = complexTuple.toBytes().toString();
    witnessTable.set(key, 1);
    
    // Create identical tuple
    const identicalTuple = new Tuple([
      new BooleanAtom(true),
      new Integer(42),
      new Float(3.14),
      new StringAtom('hello world'),
      new SymbolAtom(':keyword'),
      new ID('user_123')
    ]);
    
    const identicalKey = identicalTuple.toBytes().toString();
    expect(witnessTable.has(identicalKey)).toBe(true);
    expect(witnessTable.get(identicalKey)).toBe(1);
    
    // Increment count
    witnessTable.set(identicalKey, witnessTable.get(identicalKey) + 1);
    expect(witnessTable.get(key)).toBe(2);
  });

  it('should handle tuple ordering for sorted collections', () => {
    const tuples = [
      new Tuple([new BooleanAtom(true), new Integer(2)]),
      new Tuple([new BooleanAtom(false), new Integer(1)]),
      new Tuple([new Integer(1), new StringAtom('b')]),
      new Tuple([new Integer(1), new StringAtom('a')]),
      new Tuple([new BooleanAtom(true), new Integer(1)])
    ];
    
    // Sort by encoded bytes (lexicographic)
    tuples.sort((a, b) => {
      const bytesA = a.toBytes();
      const bytesB = b.toBytes();
      for (let i = 0; i < Math.min(bytesA.length, bytesB.length); i++) {
        if (bytesA[i] !== bytesB[i]) {
          return bytesA[i] - bytesB[i];
        }
      }
      return bytesA.length - bytesB.length;
    });
    
    // Verify Boolean types come first (type precedence)
    expect(tuples[0].get(0).type).toBe('Boolean');
    expect(tuples[1].get(0).type).toBe('Boolean');
    expect(tuples[2].get(0).type).toBe('Boolean');
    
    // Then Integer types
    expect(tuples[3].get(0).type).toBe('Integer');
    expect(tuples[4].get(0).type).toBe('Integer');
  });

  it('should handle projection for join operations', () => {
    // Simulate join result tuple that needs projection
    const joinResult = new Tuple([
      new StringAtom('alice'),  // var 'a'
      new Integer(25),          // var 'b' 
      new StringAtom('engineer') // var 'c'
    ]);
    
    // Project to (a,c) for output
    const projected = joinResult.project([0, 2]);
    expect(projected.arity).toBe(2);
    expect(projected.get(0).equals(new StringAtom('alice'))).toBe(true);
    expect(projected.get(1).equals(new StringAtom('engineer'))).toBe(true);
    
    // Use projected tuple as map key
    const projectionMap = new Map();
    const projKey = projected.toBytes().toString();
    projectionMap.set(projKey, 1);
    
    // Create another tuple that projects to same result
    const anotherJoinResult = new Tuple([
      new StringAtom('alice'),   // var 'a'
      new Integer(30),           // different 'b'
      new StringAtom('engineer') // same 'c'
    ]);
    
    const anotherProjected = anotherJoinResult.project([0, 2]);
    const anotherKey = anotherProjected.toBytes().toString();
    
    expect(projectionMap.has(anotherKey)).toBe(true);
    projectionMap.set(anotherKey, projectionMap.get(anotherKey) + 1);
    expect(projectionMap.get(projKey)).toBe(2);
  });

  it('should maintain encoding consistency across sessions', () => {
    // Test that encoding is deterministic and stable
    const testCases = [
      new Tuple([]),
      new Tuple([new BooleanAtom(false)]),
      new Tuple([new BooleanAtom(true)]),
      new Tuple([new Integer(-100)]),
      new Tuple([new Integer(0)]),
      new Tuple([new Integer(100)]),
      new Tuple([new Float(-3.14)]),
      new Tuple([new Float(2.71)]),
      new Tuple([new StringAtom('')]),
      new Tuple([new StringAtom('hello')]),
      new Tuple([new SymbolAtom(':test')]),
      new Tuple([new ID('id123')])
    ];
    
    // Encode multiple times and ensure consistency
    for (const tuple of testCases) {
      const encoding1 = tuple.toBytes();
      const encoding2 = tuple.toBytes();
      const encoding3 = tuple.toBytes();
      
      expect(Buffer.from(encoding1).equals(Buffer.from(encoding2))).toBe(true);
      expect(Buffer.from(encoding2).equals(Buffer.from(encoding3))).toBe(true);
    }
  });
});