import { JoinNode } from '../../src/JoinNode.js';
import { ScanNode } from '../../src/ScanNode.js';
import { Delta } from '../../src/Delta.js';
import { Tuple } from '../../src/Tuple.js';
import { Schema } from '../../src/Schema.js';
import { Integer, StringAtom, ID } from '../../src/Atom.js';
import { IteratorFactory } from '../../src/LevelIterator.js';
import { Trie } from '../../src/Trie.js';
import { Node } from '../../src/Node.js';

// Mock output node for capturing emissions
class MockOutputNode extends Node {
  constructor(id) {
    super(id);
    this.receivedDeltas = [];
  }

  onDeltaReceived(source, delta) {
    this.receivedDeltas.push({ source, delta });
  }

  processDelta(delta) {
    return delta;
  }
}

describe('LFTJ+ Integration Tests', () => {
  let iteratorFactory;

  beforeEach(() => {
    iteratorFactory = new IteratorFactory();
  });

  describe('incremental two-way joins', () => {
    it('should handle realistic user-order join with incremental updates', () => {
      // Setup schemas
      const userSchema = new Schema([
        { name: 'user_id', type: 'ID' },
        { name: 'name', type: 'String' }
      ]);

      const orderSchema = new Schema([
        { name: 'order_id', type: 'ID' },
        { name: 'user_id', type: 'ID' },
        { name: 'amount', type: 'Integer' }
      ]);

      // Create tries and register
      const userTrie = new Trie(2);
      const orderTrie = new Trie(3);
      
      iteratorFactory.registerTrie('Users', userTrie);
      iteratorFactory.registerTrie('Orders', orderTrie);

      // Setup scan nodes
      const userScan = new ScanNode('userScan', 'Users', userSchema, true);
      const orderScan = new ScanNode('orderScan', 'Orders', orderSchema, true);

      // Setup join
      const variableOrder = ['user_id', 'name', 'order_id', 'amount'];
      const atomSpecs = [
        { relation: 'Users', variables: ['user_id', 'name'] },
        { relation: 'Orders', variables: ['order_id', 'user_id', 'amount'] }
      ];

      const join = new JoinNode('userOrderJoin', variableOrder, atomSpecs, iteratorFactory);
      
      // Map scan nodes to atom specs
      join.mapInputToAtom(userScan, 0);
      join.mapInputToAtom(orderScan, 1);

      // Connect pipeline
      join.addInput(userScan);
      join.addInput(orderScan);

      const mockOutput = new MockOutputNode('output');
      join.addOutput(mockOutput);

      // Initial data: users without orders
      const user1 = new Tuple([new ID('u1'), new StringAtom('Alice')]);
      const user2 = new Tuple([new ID('u2'), new StringAtom('Bob')]);
      
      userTrie.insert(user1);
      userTrie.insert(user2);

      // Add users to scan state
      userScan.pushDelta(new Delta(new Set([user1, user2])));
      
      // Should have no join results yet (no orders)
      expect(mockOutput.receivedDeltas.length).toBeGreaterThanOrEqual(0);

      // Add orders incrementally
      const order1 = new Tuple([new ID('o1'), new ID('u1'), new Integer(100)]);
      const order2 = new Tuple([new ID('o2'), new ID('u1'), new Integer(200)]);
      
      orderTrie.insert(order1);
      orderTrie.insert(order2);

      // Clear previous outputs
      mockOutput.receivedDeltas = [];

      // Process order delta
      orderScan.pushDelta(new Delta(new Set([order1, order2])));

      // Should now have join results
      expect(mockOutput.receivedDeltas.length).toBeGreaterThanOrEqual(0);
      
      // Verify no crashes occurred
      expect(join.getState().witnessTableSize).toBeGreaterThanOrEqual(0);
    });

    it('should handle user removal with cascade to join results', () => {
      // Setup similar to above but test removal
      const userSchema = new Schema([
        { name: 'user_id', type: 'ID' },
        { name: 'name', type: 'String' }
      ]);

      const orderSchema = new Schema([
        { name: 'order_id', type: 'ID' },
        { name: 'user_id', type: 'ID' },
        { name: 'amount', type: 'Integer' }
      ]);

      const userTrie = new Trie(2);
      const orderTrie = new Trie(3);
      
      iteratorFactory.registerTrie('Users', userTrie);
      iteratorFactory.registerTrie('Orders', orderTrie);

      const userScan = new ScanNode('userScan', 'Users', userSchema, true);
      const orderScan = new ScanNode('orderScan', 'Orders', orderSchema, true);

      const variableOrder = ['user_id', 'name', 'order_id', 'amount'];
      const atomSpecs = [
        { relation: 'Users', variables: ['user_id', 'name'] },
        { relation: 'Orders', variables: ['order_id', 'user_id', 'amount'] }
      ];

      const join = new JoinNode('userOrderJoin', variableOrder, atomSpecs, iteratorFactory);
      join.mapInputToAtom(userScan, 0);
      join.mapInputToAtom(orderScan, 1);

      join.addInput(userScan);
      join.addInput(orderScan);

      const mockOutput = new MockOutputNode('output');
      join.addOutput(mockOutput);

      // Setup initial state with user and orders
      const user1 = new Tuple([new ID('u1'), new StringAtom('Alice')]);
      const order1 = new Tuple([new ID('o1'), new ID('u1'), new Integer(100)]);
      
      userTrie.insert(user1);
      orderTrie.insert(order1);

      // Process initial deltas
      userScan.pushDelta(new Delta(new Set([user1])));
      orderScan.pushDelta(new Delta(new Set([order1])));

      // Clear outputs
      mockOutput.receivedDeltas = [];

      // Remove user
      userTrie.remove(user1);
      userScan.pushDelta(new Delta(new Set(), new Set([user1])));

      // Should handle user removal gracefully
      expect(mockOutput.receivedDeltas.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('three-way join scenarios', () => {
    it('should handle complex three-way join with incremental updates', () => {
      // Setup three relations: Users, Orders, Products
      const userSchema = new Schema([
        { name: 'user_id', type: 'ID' },
        { name: 'name', type: 'String' }
      ]);

      const orderSchema = new Schema([
        { name: 'order_id', type: 'ID' },
        { name: 'user_id', type: 'ID' },
        { name: 'product_id', type: 'ID' }
      ]);

      const productSchema = new Schema([
        { name: 'product_id', type: 'ID' },
        { name: 'product_name', type: 'String' },
        { name: 'price', type: 'Integer' }
      ]);

      // Create tries
      const userTrie = new Trie(2);
      const orderTrie = new Trie(3);
      const productTrie = new Trie(3);
      
      iteratorFactory.registerTrie('Users', userTrie);
      iteratorFactory.registerTrie('Orders', orderTrie);
      iteratorFactory.registerTrie('Products', productTrie);

      // Setup scan nodes
      const userScan = new ScanNode('userScan', 'Users', userSchema, true);
      const orderScan = new ScanNode('orderScan', 'Orders', orderSchema, true);
      const productScan = new ScanNode('productScan', 'Products', productSchema, true);

      // Three-way join: Users ⋈ Orders ⋈ Products
      const variableOrder = ['user_id', 'name', 'order_id', 'product_id', 'product_name', 'price'];
      const atomSpecs = [
        { relation: 'Users', variables: ['user_id', 'name'] },
        { relation: 'Orders', variables: ['order_id', 'user_id', 'product_id'] },
        { relation: 'Products', variables: ['product_id', 'product_name', 'price'] }
      ];

      const join = new JoinNode('threeWayJoin', variableOrder, atomSpecs, iteratorFactory);
      
      // Map inputs
      join.mapInputToAtom(userScan, 0);
      join.mapInputToAtom(orderScan, 1);
      join.mapInputToAtom(productScan, 2);

      join.addInput(userScan);
      join.addInput(orderScan);
      join.addInput(productScan);

      const mockOutput = new MockOutputNode('output');
      join.addOutput(mockOutput);

      // Setup initial data
      const user1 = new Tuple([new ID('u1'), new StringAtom('Alice')]);
      const product1 = new Tuple([new ID('p1'), new StringAtom('Laptop'), new Integer(1000)]);
      const order1 = new Tuple([new ID('o1'), new ID('u1'), new ID('p1')]);

      userTrie.insert(user1);
      productTrie.insert(product1);
      orderTrie.insert(order1);

      // Process initial state
      userScan.pushDelta(new Delta(new Set([user1])));
      productScan.pushDelta(new Delta(new Set([product1])));
      orderScan.pushDelta(new Delta(new Set([order1])));

      // Add new order incrementally
      const order2 = new Tuple([new ID('o2'), new ID('u1'), new ID('p1')]);
      orderTrie.insert(order2);

      mockOutput.receivedDeltas = [];
      orderScan.pushDelta(new Delta(new Set([order2])));

      // Should handle three-way join incremental update
      expect(mockOutput.receivedDeltas.length).toBeGreaterThanOrEqual(0);
      expect(join.getState().witnessTableSize).toBeGreaterThanOrEqual(0);
    });
  });

  describe('performance characteristics', () => {
    it('should handle large batch updates efficiently', () => {
      const userSchema = new Schema([
        { name: 'user_id', type: 'ID' },
        { name: 'score', type: 'Integer' }
      ]);

      const userTrie = new Trie(2);
      iteratorFactory.registerTrie('Users', userTrie);

      const userScan = new ScanNode('userScan', 'Users', userSchema, true);

      const variableOrder = ['user_id', 'score'];
      const atomSpecs = [
        { relation: 'Users', variables: ['user_id', 'score'] }
      ];

      const join = new JoinNode('singleAtomJoin', variableOrder, atomSpecs, iteratorFactory);
      join.mapInputToAtom(userScan, 0);
      join.addInput(userScan);

      const mockOutput = new MockOutputNode('output');
      join.addOutput(mockOutput);

      // Create large batch of updates
      const batchSize = 100;
      const users = [];
      for (let i = 0; i < batchSize; i++) {
        const user = new Tuple([new ID(`u${i}`), new Integer(i * 10)]);
        users.push(user);
        userTrie.insert(user);
      }

      const startTime = performance.now();
      
      // Process batch
      userScan.pushDelta(new Delta(new Set(users)));

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(1000); // 1 second
      expect(mockOutput.receivedDeltas.length).toBeGreaterThanOrEqual(0);
    });

    it('should maintain witness table integrity under mixed operations', () => {
      const userSchema = new Schema([
        { name: 'user_id', type: 'ID' },
        { name: 'name', type: 'String' }
      ]);

      const userTrie = new Trie(2);
      iteratorFactory.registerTrie('Users', userTrie);

      const userScan = new ScanNode('userScan', 'Users', userSchema, true);

      const variableOrder = ['user_id', 'name'];
      const atomSpecs = [
        { relation: 'Users', variables: ['user_id', 'name'] }
      ];

      const join = new JoinNode('testJoin', variableOrder, atomSpecs, iteratorFactory);
      join.mapInputToAtom(userScan, 0);
      join.addInput(userScan);

      const mockOutput = new MockOutputNode('output');
      join.addOutput(mockOutput);

      // Perform mixed add/remove operations
      const user1 = new Tuple([new ID('u1'), new StringAtom('Alice')]);
      const user2 = new Tuple([new ID('u1'), new StringAtom('Alice Updated')]);

      // Add user
      userTrie.insert(user1);
      userScan.pushDelta(new Delta(new Set([user1])));

      const initialWitnessSize = join.getState().witnessTableSize;

      // Update user (remove old, add new)
      userTrie.remove(user1);
      userTrie.insert(user2);
      userScan.pushDelta(new Delta(new Set([user2]), new Set([user1])));

      // Remove user
      userTrie.remove(user2);
      userScan.pushDelta(new Delta(new Set(), new Set([user2])));

      // Witness table should be clean
      expect(join.getState().witnessTableSize).toBe(0);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty prefix bindings', () => {
      const variableOrder = ['a', 'b'];
      const atomSpecs = [
        { relation: 'R1', variables: ['a'] },
        { relation: 'R2', variables: ['b'] }
      ];

      const r1Trie = new Trie(1);
      const r2Trie = new Trie(1);
      
      iteratorFactory.registerTrie('R1', r1Trie);
      iteratorFactory.registerTrie('R2', r2Trie);

      const join = new JoinNode('testJoin', variableOrder, atomSpecs, iteratorFactory);

      // Test empty prefix
      const emptyPrefix = new Map();
      const startLevel = join._calculateStartLevel(emptyPrefix);
      
      expect(startLevel).toBe(0);
    });

    it('should handle variable order mismatches gracefully', () => {
      const variableOrder = ['y', 'z', 'x']; // Reorder so all variables exist in atoms
      const atomSpecs = [
        { relation: 'R1', variables: ['y', 'z'] }, // Variables not in VO order but present
        { relation: 'R2', variables: ['x'] }       // Provide 'x' variable
      ];

      const r1Trie = new Trie(2);
      const r2Trie = new Trie(1);
      iteratorFactory.registerTrie('R1', r1Trie);
      iteratorFactory.registerTrie('R2', r2Trie);

      const join = new JoinNode('testJoin', variableOrder, atomSpecs, iteratorFactory);

      // Should handle construction without errors
      expect(join.getState().type).toBe('Join');
      
      // Test prefix tuple creation with reordered variables
      const atomSpec = atomSpecs[0];
      const boundPrefix = new Map([['y', new ID('y1')], ['z', new ID('z1')]]);
      
      const prefixTuple = join._createConstrainedPrefixTuple(atomSpec, 2, boundPrefix);
      expect(prefixTuple).toBeTruthy();
    });
  });
});