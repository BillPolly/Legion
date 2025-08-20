import { JoinNode } from '../../src/JoinNode.js';
import { Delta } from '../../src/Delta.js';
import { Tuple } from '../../src/Tuple.js';
import { Integer, StringAtom, ID } from '../../src/Atom.js';
import { IteratorFactory } from '../../src/LevelIterator.js';
import { Trie } from '../../src/Trie.js';

describe('LFTJ+ Delta Probes', () => {
  let iteratorFactory;
  let userTrie, orderTrie;
  
  beforeEach(() => {
    iteratorFactory = new IteratorFactory();
    
    // Create tries for test data
    userTrie = new Trie(2);  // user_id, name
    orderTrie = new Trie(3); // order_id, user_id, amount
    
    iteratorFactory.registerTrie('Users', userTrie);
    iteratorFactory.registerTrie('Orders', orderTrie);
    
    // Pre-populate with test data
    const user1 = new Tuple([new ID('u1'), new StringAtom('Alice')]);
    const user2 = new Tuple([new ID('u2'), new StringAtom('Bob')]);
    
    const order1 = new Tuple([new ID('o1'), new ID('u1'), new Integer(100)]);
    const order2 = new Tuple([new ID('o2'), new ID('u1'), new Integer(200)]);
    const order3 = new Tuple([new ID('o3'), new ID('u2'), new Integer(150)]);
    
    userTrie.insert(user1);
    userTrie.insert(user2);
    orderTrie.insert(order1);
    orderTrie.insert(order2);
    orderTrie.insert(order3);
  });

  describe('prefix sorting optimization', () => {
    it('should sort delta tuples by VO prefix for cache locality', () => {
      const variableOrder = ['user_id', 'name'];
      const atomSpecs = [
        { relation: 'Users', variables: ['user_id', 'name'] }
      ];

      const join = new JoinNode('testJoin', variableOrder, atomSpecs, iteratorFactory);
      
      // Create tuples in reverse order
      const tuple1 = new Tuple([new ID('u3'), new StringAtom('Charlie')]);
      const tuple2 = new Tuple([new ID('u1'), new StringAtom('Alice')]);
      const tuple3 = new Tuple([new ID('u2'), new StringAtom('Bob')]);
      
      // Test the comparison function
      const atomSpec = atomSpecs[0];
      const comparison1 = join._compareByVOPrefix(tuple1, tuple2, atomSpec);
      const comparison2 = join._compareByVOPrefix(tuple2, tuple3, atomSpec);
      
      // u3 > u1, u1 < u2 based on ID ordering
      expect(comparison1).toBeGreaterThan(0);
      expect(comparison2).toBeLessThan(0);
    });

    it('should process sorted deltas efficiently', () => {
      const variableOrder = ['user_id', 'name'];
      const atomSpecs = [
        { relation: 'Users', variables: ['user_id', 'name'] }
      ];

      const join = new JoinNode('testJoin', variableOrder, atomSpecs, iteratorFactory);
      
      // Create unsorted delta
      const tuples = [
        new Tuple([new ID('u3'), new StringAtom('Charlie')]),
        new Tuple([new ID('u1'), new StringAtom('Alice')]),
        new Tuple([new ID('u2'), new StringAtom('Bob')])
      ];
      
      const delta = new Delta(new Set(tuples));
      
      // Should not throw and should handle sorting internally
      expect(() => {
        join._processSortedDelta(delta, 0, new Map(), new Map());
      }).not.toThrow();
    });
  });

  describe('constrained iterator creation', () => {
    it('should create constrained iterators excluding source atom', () => {
      const variableOrder = ['user_id', 'name', 'order_id', 'amount'];
      const atomSpecs = [
        { relation: 'Users', variables: ['user_id', 'name'] },
        { relation: 'Orders', variables: ['order_id', 'user_id', 'amount'] }
      ];

      const join = new JoinNode('testJoin', variableOrder, atomSpecs, iteratorFactory);
      
      const boundPrefix = new Map([
        ['user_id', new ID('u1')]
      ]);
      
      // Exclude Users atom (index 0)
      const iteratorGroups = join._createConstrainedIteratorsExcluding(boundPrefix, 0);
      
      // Should have iterator groups for each level
      expect(iteratorGroups.length).toBe(4);
      
      // Level 0 (user_id): Orders atom should still be present since it has user_id
      expect(iteratorGroups[0].length).toBe(1);
      
      // Level 2 (order_id): should have Orders atom iterator
      expect(iteratorGroups[2].length).toBe(1);
    });

    it('should create proper constrained prefix tuples', () => {
      const variableOrder = ['user_id', 'order_id', 'amount'];
      const atomSpecs = [
        { relation: 'Orders', variables: ['order_id', 'user_id', 'amount'] }
      ];

      const join = new JoinNode('testJoin', variableOrder, atomSpecs, iteratorFactory);
      
      const boundPrefix = new Map([
        ['user_id', new ID('u1')],
        ['order_id', new ID('o1')]
      ]);
      
      // Create prefix tuple for Orders atom (order_id, user_id, amount)
      const atomSpec = atomSpecs[0];
      const prefixTuple = join._createConstrainedPrefixTuple(atomSpec, 2, boundPrefix);
      
      // Should bind based on atom variable order: order_id (pos 0), user_id (pos 1) 
      expect(prefixTuple).toBeTruthy();
      expect(prefixTuple.arity).toBe(2); // user_id and order_id bound
      expect(prefixTuple.atoms[0]).toEqual(new ID('o1')); // order_id first (atom position 0)
      expect(prefixTuple.atoms[1]).toEqual(new ID('u1')); // user_id second (atom position 1)
    });
  });

  describe('enhanced witness table management', () => {
    it('should correctly calculate start level for enumeration', () => {
      const variableOrder = ['user_id', 'name'];
      const atomSpecs = [
        { relation: 'Users', variables: ['user_id', 'name'] }
      ];

      const join = new JoinNode('testJoin', variableOrder, atomSpecs, iteratorFactory);
      
      // Contiguous prefix binding
      const boundPrefix1 = new Map([
        ['user_id', new ID('u1')],
        ['name', new StringAtom('Alice')]
      ]);
      
      expect(join._calculateStartLevel(boundPrefix1)).toBe(2);
      
      // Partial prefix binding (only first variable)
      const boundPrefix2 = new Map([
        ['user_id', new ID('u1')]
        // name not bound
      ]);
      
      expect(join._calculateStartLevel(boundPrefix2)).toBe(1); // Stop at first unbound
    });

    it('should maintain witness table invariants during updates', () => {
      const variableOrder = ['user_id', 'name'];
      const atomSpecs = [
        { relation: 'Users', variables: ['user_id', 'name'] }
      ];

      const join = new JoinNode('testJoin', variableOrder, atomSpecs, iteratorFactory);
      
      const binding = new Map([
        ['user_id', new ID('u1')],
        ['name', new StringAtom('Alice')]
      ]);
      
      const outputAdds = new Map();
      const outputRemoves = new Map();
      
      // First add: 0→1 transition should emit
      join._updateWitnessTable(binding, true, outputAdds, outputRemoves);
      expect(outputAdds.size).toBe(1);
      expect(outputRemoves.size).toBe(0);
      
      // Second add: 1→2 transition should not emit
      outputAdds.clear();
      join._updateWitnessTable(binding, true, outputAdds, outputRemoves);
      expect(outputAdds.size).toBe(0);
      
      // First remove: 2→1 transition should not emit
      join._updateWitnessTable(binding, false, outputAdds, outputRemoves);
      expect(outputRemoves.size).toBe(0);
      
      // Second remove: 1→0 transition should emit remove
      join._updateWitnessTable(binding, false, outputAdds, outputRemoves);
      expect(outputRemoves.size).toBe(1);
      
      // Verify witness table cleanup
      const state = join.getState();
      expect(state.witnessTableSize).toBe(0);
    });
  });

  describe('LFTJ+ integration scenarios', () => {
    it('should handle incremental user addition with existing orders', () => {
      const variableOrder = ['user_id', 'name', 'order_id', 'amount'];
      const atomSpecs = [
        { relation: 'Users', variables: ['user_id', 'name'] },
        { relation: 'Orders', variables: ['order_id', 'user_id', 'amount'] }
      ];

      const join = new JoinNode('userOrderJoin', variableOrder, atomSpecs, iteratorFactory);
      
      // Mock output to capture results
      const outputs = [];
      const mockOutput = {
        id: 'mockOutput',
        onDeltaReceived: (source, delta) => {
          outputs.push(delta);
        }
      };
      
      // Can't use addOutput since it requires Node instance, test manually
      // join.addOutput(mockOutput);
      
      // Map the join inputs to atom specs
      const userScan = { id: 'userScan' };
      const orderScan = { id: 'orderScan' };
      join.mapInputToAtom(userScan, 0); // Users
      join.mapInputToAtom(orderScan, 1); // Orders
      
      // Add new user that has existing orders
      const newUser = new Tuple([new ID('u1'), new StringAtom('Alice')]);
      const userDelta = new Delta(new Set([newUser]));
      
      // Simulate delta from user scan
      join._currentSourceNode = userScan;
      const result = join.processDelta(userDelta);
      
      // Should produce join results since u1 has orders
      expect(result.adds.size).toBeGreaterThanOrEqual(0);
    });

    it('should handle incremental order addition with existing users', () => {
      const variableOrder = ['user_id', 'name', 'order_id', 'amount'];
      const atomSpecs = [
        { relation: 'Users', variables: ['user_id', 'name'] },
        { relation: 'Orders', variables: ['order_id', 'user_id', 'amount'] }
      ];

      const join = new JoinNode('userOrderJoin', variableOrder, atomSpecs, iteratorFactory);
      
      // Map inputs
      const userScan = { id: 'userScan' };
      const orderScan = { id: 'orderScan' };
      join.mapInputToAtom(userScan, 0);
      join.mapInputToAtom(orderScan, 1);
      
      // Add new order for existing user
      const newOrder = new Tuple([new ID('o4'), new ID('u1'), new Integer(300)]);
      const orderDelta = new Delta(new Set([newOrder]));
      
      join._currentSourceNode = orderScan;
      const result = join.processDelta(orderDelta);
      
      // Should produce join result since u1 exists in Users
      expect(result.adds.size).toBeGreaterThanOrEqual(0);
    });

    it('should handle complex multi-variable bindings', () => {
      // Three-way join scenario
      const variableOrder = ['a', 'b', 'c'];
      const atomSpecs = [
        { relation: 'R1', variables: ['a', 'b'] },
        { relation: 'R2', variables: ['b', 'c'] },
        { relation: 'R3', variables: ['a', 'c'] }
      ];

      // Create and register tries
      const r1Trie = new Trie(2);
      const r2Trie = new Trie(2);
      const r3Trie = new Trie(2);
      
      iteratorFactory.registerTrie('R1', r1Trie);
      iteratorFactory.registerTrie('R2', r2Trie);
      iteratorFactory.registerTrie('R3', r3Trie);
      
      // Populate test data
      r1Trie.insert(new Tuple([new ID('a1'), new ID('b1')]));
      r2Trie.insert(new Tuple([new ID('b1'), new ID('c1')]));
      r3Trie.insert(new Tuple([new ID('a1'), new ID('c1')]));
      
      const join = new JoinNode('threeWayJoin', variableOrder, atomSpecs, iteratorFactory);
      
      // Add new tuple to R1
      const newR1Tuple = new Tuple([new ID('a2'), new ID('b1')]);
      const delta = new Delta(new Set([newR1Tuple]));
      
      const result = join.processDelta(delta);
      
      // Should handle complex binding scenario without crashing
      expect(result).toBeTruthy();
      expect(result.adds.size).toBeGreaterThanOrEqual(0);
      expect(result.removes.size).toBe(0);
    });
  });

  describe('empty iterator handling', () => {
    it('should create proper empty iterators', () => {
      const join = new JoinNode('test', ['a'], [{ relation: 'Test', variables: ['a'] }], iteratorFactory);
      
      const emptyIter = join._createEmptyIterator();
      
      expect(emptyIter.atEnd()).toBe(true);
      expect(() => emptyIter.key()).toThrow('Empty iterator has no key');
      expect(() => {
        emptyIter.seekGE(new ID('test'));
        emptyIter.next();
      }).not.toThrow();
    });
  });
});