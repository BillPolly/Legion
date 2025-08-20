import { JoinNode } from '../../src/JoinNode.js';
import { Delta } from '../../src/Delta.js';
import { Tuple } from '../../src/Tuple.js';
import { Integer, StringAtom, ID } from '../../src/Atom.js';
import { IteratorFactory } from '../../src/LevelIterator.js';
import { Trie } from '../../src/Trie.js';

describe('JoinNode', () => {
  let iteratorFactory;
  
  beforeEach(() => {
    iteratorFactory = new IteratorFactory();
  });

  describe('constructor', () => {
    it('should create JoinNode with valid parameters', () => {
      const variableOrder = ['a', 'b', 'c'];
      const atomSpecs = [
        { relation: 'A', variables: ['a', 'b'] },
        { relation: 'B', variables: ['b', 'c'] }
      ];

      const join = new JoinNode('join1', variableOrder, atomSpecs, iteratorFactory);

      expect(join.id).toBe('join1');
      expect(join.variableOrder).toEqual(['a', 'b', 'c']);
      expect(join.atomSpecs).toEqual([
        { relation: 'A', variables: ['a', 'b'] },
        { relation: 'B', variables: ['b', 'c'] }
      ]);
    });

    it('should throw error for empty variable order', () => {
      expect(() => {
        new JoinNode('join1', [], [{ relation: 'A', variables: ['a'] }], iteratorFactory);
      }).toThrow('Variable order must be a non-empty array');
    });

    it('should throw error for empty atom specs', () => {
      expect(() => {
        new JoinNode('join1', ['a'], [], iteratorFactory);
      }).toThrow('Atom specs must be a non-empty array');
    });

    it('should throw error for missing iterator factory', () => {
      expect(() => {
        new JoinNode('join1', ['a'], [{ relation: 'A', variables: ['a'] }], null);
      }).toThrow('Iterator factory must be provided');
    });

    it('should throw error if VO variable not in any atom', () => {
      const variableOrder = ['a', 'b', 'c'];
      const atomSpecs = [
        { relation: 'A', variables: ['a', 'b'] }
        // 'c' missing from all atoms
      ];

      expect(() => {
        new JoinNode('join1', variableOrder, atomSpecs, iteratorFactory);
      }).toThrow("Variable 'c' in VO is not present in any atom");
    });
  });

  describe('level groups', () => {
    it('should build correct level groups', () => {
      const variableOrder = ['a', 'b', 'c'];
      const atomSpecs = [
        { relation: 'A', variables: ['a', 'b'] },    // atoms[0]
        { relation: 'B', variables: ['b', 'c'] },    // atoms[1]
        { relation: 'C', variables: ['a', 'c'] }     // atoms[2]
      ];

      const join = new JoinNode('join1', variableOrder, atomSpecs, iteratorFactory);
      const state = join.getState();

      // Level 0 (variable 'a'): appears in atoms 0, 2
      expect(state.levelGroups[0]).toEqual([0, 2]);
      
      // Level 1 (variable 'b'): appears in atoms 0, 1
      expect(state.levelGroups[1]).toEqual([0, 1]);
      
      // Level 2 (variable 'c'): appears in atoms 1, 2
      expect(state.levelGroups[2]).toEqual([1, 2]);
    });

    it('should handle single atom case', () => {
      const variableOrder = ['a', 'b'];
      const atomSpecs = [
        { relation: 'A', variables: ['a', 'b'] }
      ];

      const join = new JoinNode('join1', variableOrder, atomSpecs, iteratorFactory);
      const state = join.getState();

      expect(state.levelGroups[0]).toEqual([0]);
      expect(state.levelGroups[1]).toEqual([0]);
    });
  });

  describe('bound prefix extraction', () => {
    it('should extract correct bound prefix', () => {
      const variableOrder = ['a', 'b', 'c'];
      const atomSpecs = [
        { relation: 'A', variables: ['a', 'b'] },
        { relation: 'B', variables: ['b', 'c'] }
      ];

      const join = new JoinNode('join1', variableOrder, atomSpecs, iteratorFactory);
      
      // Test with atom A: variables [a, b] 
      const tupleA = new Tuple([new ID('id1'), new StringAtom('val1')]);
      const atomSpecA = atomSpecs[0];
      
      const boundPrefix = join._extractBoundPrefix(tupleA, atomSpecA);
      
      expect(boundPrefix.size).toBe(2);
      expect(boundPrefix.get('a')).toEqual(new ID('id1'));
      expect(boundPrefix.get('b')).toEqual(new StringAtom('val1'));
      expect(boundPrefix.has('c')).toBe(false);
    });

    it('should handle partial variable overlap', () => {
      const variableOrder = ['a', 'b', 'c'];
      const atomSpecs = [
        { relation: 'A', variables: ['a', 'c'] },  // missing 'b'
        { relation: 'B', variables: ['b'] }       // provides 'b'
      ];

      const join = new JoinNode('join1', variableOrder, atomSpecs, iteratorFactory);
      
      const tupleA = new Tuple([new ID('id1'), new StringAtom('val1')]);
      const atomSpecA = atomSpecs[0];
      
      const boundPrefix = join._extractBoundPrefix(tupleA, atomSpecA);
      
      expect(boundPrefix.size).toBe(2);
      expect(boundPrefix.get('a')).toEqual(new ID('id1'));
      expect(boundPrefix.has('b')).toBe(false);
      expect(boundPrefix.get('c')).toEqual(new StringAtom('val1'));
    });
  });

  describe('output tuple creation', () => {
    it('should create output tuple from variable binding', () => {
      const variableOrder = ['a', 'b', 'c'];
      const atomSpecs = [
        { relation: 'A', variables: ['a', 'b'] },
        { relation: 'C', variables: ['c'] }
      ];

      const join = new JoinNode('join1', variableOrder, atomSpecs, iteratorFactory);
      
      const binding = new Map([
        ['a', new ID('id1')],
        ['b', new StringAtom('val1')],
        ['c', new Integer(42)]
      ]);
      
      const outputTuple = join._createOutputTuple(binding);
      
      expect(outputTuple.arity).toBe(3);
      expect(outputTuple.atoms[0]).toEqual(new ID('id1'));
      expect(outputTuple.atoms[1]).toEqual(new StringAtom('val1'));
      expect(outputTuple.atoms[2]).toEqual(new Integer(42));
    });

    it('should throw error for missing variable in binding', () => {
      const variableOrder = ['a', 'b'];
      const atomSpecs = [
        { relation: 'A', variables: ['a', 'b'] }
      ];

      const join = new JoinNode('join1', variableOrder, atomSpecs, iteratorFactory);
      
      const incompleteBinding = new Map([
        ['a', new ID('id1')]
        // missing 'b'
      ]);
      
      expect(() => {
        join._createOutputTuple(incompleteBinding);
      }).toThrow("Variable 'b' not bound in output");
    });
  });

  describe('witness table', () => {
    it('should initialize with empty witness table', () => {
      const join = new JoinNode('join1', ['a'], [{ relation: 'A', variables: ['a'] }], iteratorFactory);
      
      const state = join.getState();
      expect(state.witnessTableSize).toBe(0);
    });

    it('should reset witness table', () => {
      const join = new JoinNode('join1', ['a'], [{ relation: 'A', variables: ['a'] }], iteratorFactory);
      
      // Manually add to witness table for testing
      const testTuple = new Tuple([new ID('test')]);
      const key = testTuple.toBytes().toString();
      join._witnessTable.set(key, 5);
      
      expect(join.getState().witnessTableSize).toBe(1);
      
      join.reset();
      expect(join.getState().witnessTableSize).toBe(0);
    });
  });

  describe('onDeltaReceived', () => {
    it('should have onDeltaReceived method for chain participation', () => {
      const join = new JoinNode('join1', ['a'], [{ relation: 'A', variables: ['a'] }], iteratorFactory);
      
      expect(typeof join.onDeltaReceived).toBe('function');
    });
  });

  describe('toString', () => {
    it('should produce readable string representation', () => {
      const variableOrder = ['a', 'b'];
      const atomSpecs = [
        { relation: 'Users', variables: ['a', 'b'] },
        { relation: 'Orders', variables: ['b'] }
      ];

      const join = new JoinNode('userOrders', variableOrder, atomSpecs, iteratorFactory);
      
      const str = join.toString();
      expect(str).toBe('Join(userOrders, VO:[a,b], Users(a,b) ⋈ Orders(b))');
    });
  });

  describe('error handling', () => {
    it('should handle iterator creation failures gracefully', () => {
      // Mock iterator factory that throws for certain relations
      const mockFactory = {
        makeIter: function(relation, level, prefix) {
          // Always throw for any relation to simulate no data available
          throw new Error('No data for relation: ' + relation);
        }
      };

      const join = new JoinNode('join1', ['a'], [
        { relation: 'EmptyRelation', variables: ['a'] }
      ], mockFactory);

      // Processing should not throw
      expect(() => {
        const result = join.processDelta(new Delta(new Set([
          new Tuple([new ID('test')])
        ])));
      }).not.toThrow();

      // For now, just verify it doesn't crash - we'll verify exact behavior in integration tests
    });
  });
});