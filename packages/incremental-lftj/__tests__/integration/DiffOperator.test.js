import { DiffNode } from '../../src/DiffNode.js';
import { ScanNode } from '../../src/ScanNode.js';
import { Delta } from '../../src/Delta.js';
import { Tuple } from '../../src/Tuple.js';
import { Schema } from '../../src/Schema.js';
import { Integer, StringAtom, ID, BooleanAtom } from '../../src/Atom.js';
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

describe('Diff Operator Integration', () => {
  describe('anti-join scenarios', () => {
    it('should implement Users NOT IN Orders anti-join', () => {
      // Setup schemas
      const userSchema = new Schema([
        { name: 'user_id', type: 'ID' },
        { name: 'name', type: 'String' },
        { name: 'active', type: 'Boolean' }
      ]);

      const orderSchema = new Schema([
        { name: 'order_id', type: 'ID' },
        { name: 'user_id', type: 'ID' },
        { name: 'amount', type: 'Integer' }
      ]);

      // Create scan nodes
      const userScan = new ScanNode('userScan', 'Users', userSchema, true);
      const orderScan = new ScanNode('orderScan', 'Orders', orderSchema, true);

      // Create diff node: Users ▷ Orders on user_id
      const diff = new DiffNode('usersWithoutOrders', [0], {
        leftKeyAttributes: [0],  // user_id at position 0 in Users
        rightKeyAttributes: [1]  // user_id at position 1 in Orders
      });
      
      // Connect inputs (set the mapping first, then connect the pipeline)
      diff.setLeftInput(userScan);
      diff.setRightInput(orderScan);
      
      // Connect the pipeline: scan nodes → diff node
      userScan.addOutput(diff);
      orderScan.addOutput(diff);

      const mockOutput = new MockOutputNode('output');
      diff.addOutput(mockOutput);

      // Initial users (should all be emitted initially)
      const user1 = new Tuple([new ID('u1'), new StringAtom('Alice'), new BooleanAtom(true)]);
      const user2 = new Tuple([new ID('u2'), new StringAtom('Bob'), new BooleanAtom(true)]);
      const user3 = new Tuple([new ID('u3'), new StringAtom('Charlie'), new BooleanAtom(false)]);

      userScan.pushDelta(new Delta(new Set([user1, user2, user3])));

      // All users should be emitted (no orders yet)
      expect(mockOutput.receivedDeltas.length).toBe(1);
      expect(mockOutput.receivedDeltas[0].delta.adds.size).toBe(3);
      expect(mockOutput.receivedDeltas[0].delta.removes.size).toBe(0);

      // Clear previous outputs
      mockOutput.receivedDeltas = [];

      // Add orders for user1 and user2
      const order1 = new Tuple([new ID('o1'), new ID('u1'), new Integer(100)]);
      const order2 = new Tuple([new ID('o2'), new ID('u2'), new Integer(200)]);

      orderScan.pushDelta(new Delta(new Set([order1, order2])));

      // Should remove user1 and user2 from output (they now have orders)
      expect(mockOutput.receivedDeltas.length).toBe(1);
      expect(mockOutput.receivedDeltas[0].delta.adds.size).toBe(0);
      expect(mockOutput.receivedDeltas[0].delta.removes.size).toBe(2);

      // Verify user3 is still in the diff (no orders)
      const remainingUsers = new Set();
      userScan.getCurrentSet().forEach(user => {
        const userId = user.atoms[0];
        const hasOrder = Array.from(orderScan.getCurrentSet()).some(order => 
          order.atoms[1].equals(userId)
        );
        if (!hasOrder) {
          remainingUsers.add(user);
        }
      });
      expect(remainingUsers.size).toBe(1);
      expect(Array.from(remainingUsers)[0]).toEqual(user3);
    });

    it('should handle incremental order removal restoring users', () => {
      const userSchema = new Schema([
        { name: 'user_id', type: 'ID' },
        { name: 'name', type: 'String' }
      ]);

      const orderSchema = new Schema([
        { name: 'order_id', type: 'ID' },
        { name: 'user_id', type: 'ID' },
        { name: 'amount', type: 'Integer' }
      ]);

      const userScan = new ScanNode('userScan', 'Users', userSchema, true);
      const orderScan = new ScanNode('orderScan', 'Orders', orderSchema, true);

      const diff = new DiffNode('usersWithoutOrders', [0], {
        leftKeyAttributes: [0],  // user_id at position 0 in Users
        rightKeyAttributes: [1]  // user_id at position 1 in Orders
      });
      diff.setLeftInput(userScan);
      diff.setRightInput(orderScan);
      
      userScan.addOutput(diff);
      orderScan.addOutput(diff);

      const mockOutput = new MockOutputNode('output');
      diff.addOutput(mockOutput);

      // Setup initial state: user with order
      const user1 = new Tuple([new ID('u1'), new StringAtom('Alice')]);
      const order1 = new Tuple([new ID('o1'), new ID('u1'), new Integer(100)]);

      userScan.pushDelta(new Delta(new Set([user1])));
      orderScan.pushDelta(new Delta(new Set([order1])));

      // Clear outputs from initial setup
      mockOutput.receivedDeltas = [];

      // Remove the order - user should reappear in diff
      orderScan.pushDelta(new Delta(new Set(), new Set([order1])));

      expect(mockOutput.receivedDeltas.length).toBe(1);
      expect(mockOutput.receivedDeltas[0].delta.adds.size).toBe(1);
      expect(mockOutput.receivedDeltas[0].delta.removes.size).toBe(0);
      expect(Array.from(mockOutput.receivedDeltas[0].delta.adds)[0]).toEqual(user1);
    });

    it('should handle multiple orders per user correctly', () => {
      const userSchema = new Schema([
        { name: 'user_id', type: 'ID' },
        { name: 'name', type: 'String' }
      ]);

      const orderSchema = new Schema([
        { name: 'order_id', type: 'ID' },
        { name: 'user_id', type: 'ID' },
        { name: 'amount', type: 'Integer' }
      ]);

      const userScan = new ScanNode('userScan', 'Users', userSchema, true);
      const orderScan = new ScanNode('orderScan', 'Orders', orderSchema, true);

      const diff = new DiffNode('usersWithoutOrders', [0], {
        leftKeyAttributes: [0],  // user_id at position 0 in Users
        rightKeyAttributes: [1]  // user_id at position 1 in Orders
      });
      diff.setLeftInput(userScan);
      diff.setRightInput(orderScan);
      
      // Connect the pipeline: scan nodes → diff node
      userScan.addOutput(diff);
      orderScan.addOutput(diff);

      const mockOutput = new MockOutputNode('output');
      diff.addOutput(mockOutput);

      // Add user
      const user1 = new Tuple([new ID('u1'), new StringAtom('Alice')]);
      userScan.pushDelta(new Delta(new Set([user1])));

      // Clear outputs
      mockOutput.receivedDeltas = [];

      // Add first order - should remove user from diff
      const order1 = new Tuple([new ID('o1'), new ID('u1'), new Integer(100)]);
      orderScan.pushDelta(new Delta(new Set([order1])));

      expect(mockOutput.receivedDeltas.length).toBe(1);
      expect(mockOutput.receivedDeltas[0].delta.removes.size).toBe(1);

      // Clear outputs
      mockOutput.receivedDeltas = [];

      // Add second order - should not change diff (user already not in result)
      const order2 = new Tuple([new ID('o2'), new ID('u1'), new Integer(200)]);
      orderScan.pushDelta(new Delta(new Set([order2])));

      expect(mockOutput.receivedDeltas.length).toBe(0); // No delta emitted (empty delta not sent)

      // Clear outputs
      mockOutput.receivedDeltas = [];

      // Remove first order - should not restore user (still has second order)
      orderScan.pushDelta(new Delta(new Set(), new Set([order1])));

      expect(mockOutput.receivedDeltas.length).toBe(0); // No delta emitted (user still blocked)

      // Remove second order - NOW user should be restored
      orderScan.pushDelta(new Delta(new Set(), new Set([order2])));

      expect(mockOutput.receivedDeltas.length).toBe(1); // Now user is restored
      expect(mockOutput.receivedDeltas[0].delta.adds.size).toBe(1);
      expect(Array.from(mockOutput.receivedDeltas[0].delta.adds)[0]).toEqual(user1);
    });
  });

  describe('negation-as-failure semantics', () => {
    it('should implement NOT EXISTS subquery pattern', () => {
      // Pattern: SELECT * FROM Users u WHERE NOT EXISTS (SELECT 1 FROM Orders o WHERE o.user_id = u.user_id AND o.amount > 1000)

      const userSchema = new Schema([
        { name: 'user_id', type: 'ID' },
        { name: 'name', type: 'String' }
      ]);

      // Represents filtered orders (amount > 1000)
      const highValueOrderSchema = new Schema([
        { name: 'user_id', type: 'ID' },
        { name: 'order_count', type: 'Integer' }
      ]);

      const userScan = new ScanNode('userScan', 'Users', userSchema, true);
      const highValueOrderScan = new ScanNode('highValueOrderScan', 'HighValueOrders', highValueOrderSchema, true);

      const diff = new DiffNode('usersWithoutHighValueOrders', [0], {
        leftKeyAttributes: [0],  // user_id at position 0 in Users
        rightKeyAttributes: [0]  // user_id at position 0 in HighValueOrders
      }); // Key on user_id
      diff.setLeftInput(userScan);
      diff.setRightInput(highValueOrderScan);
      
      // Connect the pipeline: scan nodes → diff node
      userScan.addOutput(diff);
      highValueOrderScan.addOutput(diff);

      const mockOutput = new MockOutputNode('output');
      diff.addOutput(mockOutput);

      // Add users
      const user1 = new Tuple([new ID('u1'), new StringAtom('Alice')]);
      const user2 = new Tuple([new ID('u2'), new StringAtom('Bob')]);
      const user3 = new Tuple([new ID('u3'), new StringAtom('Charlie')]);

      userScan.pushDelta(new Delta(new Set([user1, user2, user3])));

      // All users should be in result initially
      expect(mockOutput.receivedDeltas[0].delta.adds.size).toBe(3);

      // Clear outputs
      mockOutput.receivedDeltas = [];

      // Add high-value order indicator for user2
      const highValueOrder = new Tuple([new ID('u2'), new Integer(1)]);
      highValueOrderScan.pushDelta(new Delta(new Set([highValueOrder])));

      // User2 should be removed from result
      expect(mockOutput.receivedDeltas.length).toBe(1);
      expect(mockOutput.receivedDeltas[0].delta.removes.size).toBe(1);

      const removedUser = Array.from(mockOutput.receivedDeltas[0].delta.removes)[0];
      expect(removedUser).toEqual(user2);
    });

    it('should handle complex multi-attribute key scenarios', () => {
      // Pattern: Find products that are not ordered by users from specific regions

      const productSchema = new Schema([
        { name: 'product_id', type: 'ID' },
        { name: 'category', type: 'String' },
        { name: 'name', type: 'String' }
      ]);

      const regionalOrderSchema = new Schema([
        { name: 'product_id', type: 'ID' },
        { name: 'category', type: 'String' },
        { name: 'region', type: 'String' }
      ]);

      const productScan = new ScanNode('productScan', 'Products', productSchema, true);
      const regionalOrderScan = new ScanNode('regionalOrderScan', 'RegionalOrders', regionalOrderSchema, true);

      // Diff on composite key: product_id + category
      const diff = new DiffNode('productsNotOrderedRegionally', [0, 1], {
        leftKeyAttributes: [0, 1],  // product_id, category at positions 0,1 in Products
        rightKeyAttributes: [0, 1]  // product_id, category at positions 0,1 in RegionalOrders
      });
      diff.setLeftInput(productScan);
      diff.setRightInput(regionalOrderScan);
      
      // Connect the pipeline: scan nodes → diff node
      productScan.addOutput(diff);
      regionalOrderScan.addOutput(diff);

      const mockOutput = new MockOutputNode('output');
      diff.addOutput(mockOutput);

      // Add products
      const product1 = new Tuple([new ID('p1'), new StringAtom('electronics'), new StringAtom('Laptop')]);
      const product2 = new Tuple([new ID('p2'), new StringAtom('electronics'), new StringAtom('Phone')]);
      const product3 = new Tuple([new ID('p3'), new StringAtom('books'), new StringAtom('Novel')]);

      productScan.pushDelta(new Delta(new Set([product1, product2, product3])));

      // All products should be in result initially
      expect(mockOutput.receivedDeltas[0].delta.adds.size).toBe(3);

      // Clear outputs
      mockOutput.receivedDeltas = [];

      // Add regional order for electronics laptop (matches product1 on key)
      const regionalOrder1 = new Tuple([new ID('p1'), new StringAtom('electronics'), new StringAtom('NA')]);
      regionalOrderScan.pushDelta(new Delta(new Set([regionalOrder1])));

      // Product1 should be removed
      expect(mockOutput.receivedDeltas.length).toBe(1);
      expect(mockOutput.receivedDeltas[0].delta.removes.size).toBe(1);

      // Add order for different category (should not affect product2)
      const nonMatchingOrder = new Tuple([new ID('p2'), new StringAtom('furniture'), new StringAtom('EU')]);
      regionalOrderScan.pushDelta(new Delta(new Set([nonMatchingOrder])));

      // No additional changes (key doesn't match, so no delta emitted)
      expect(mockOutput.receivedDeltas.length).toBe(1); // Still only 1 delta from the previous operation
    });
  });

  describe('performance and scalability', () => {
    it('should handle large datasets efficiently', () => {
      const userSchema = new Schema([
        { name: 'user_id', type: 'ID' },
        { name: 'score', type: 'Integer' }
      ]);

      const exclusionSchema = new Schema([
        { name: 'user_id', type: 'ID' },
        { name: 'reason', type: 'String' }
      ]);

      const userScan = new ScanNode('userScan', 'Users', userSchema, true);
      const exclusionScan = new ScanNode('exclusionScan', 'Exclusions', exclusionSchema, true);

      const diff = new DiffNode('eligibleUsers', [0], {
        leftKeyAttributes: [0],  // user_id at position 0 in Users
        rightKeyAttributes: [0]  // user_id at position 0 in Exclusions
      });
      diff.setLeftInput(userScan);
      diff.setRightInput(exclusionScan);
      
      // Connect the pipeline: scan nodes → diff node
      userScan.addOutput(diff);
      exclusionScan.addOutput(diff);

      const mockOutput = new MockOutputNode('output');
      diff.addOutput(mockOutput);

      // Create large datasets
      const users = [];
      const exclusions = [];

      for (let i = 0; i < 1000; i++) {
        users.push(new Tuple([new ID(`u${i}`), new Integer(i)]));
        
        // Exclude every 10th user
        if (i % 10 === 0) {
          exclusions.push(new Tuple([new ID(`u${i}`), new StringAtom('excluded')]));
        }
      }

      const startTime = performance.now();

      // Process large batch
      userScan.pushDelta(new Delta(new Set(users)));
      exclusionScan.pushDelta(new Delta(new Set(exclusions)));

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(1000); // 1 second

      // Verify correct results: 1000 - 100 = 900 eligible users
      const totalAdds = mockOutput.receivedDeltas.reduce((sum, received) => 
        sum + received.delta.adds.size, 0
      );
      const totalRemoves = mockOutput.receivedDeltas.reduce((sum, received) => 
        sum + received.delta.removes.size, 0
      );

      expect(totalAdds - totalRemoves).toBe(900); // 900 eligible users
    });

    it('should maintain consistent state under mixed operations', () => {
      const userSchema = new Schema([
        { name: 'user_id', type: 'ID' },
        { name: 'name', type: 'String' }
      ]);

      const blockSchema = new Schema([
        { name: 'user_id', type: 'ID' },
        { name: 'reason', type: 'String' }
      ]);

      const userScan = new ScanNode('userScan', 'Users', userSchema, true);
      const blockScan = new ScanNode('blockScan', 'Blocks', blockSchema, true);

      const diff = new DiffNode('allowedUsers', [0], {
        leftKeyAttributes: [0],  // user_id at position 0 in Users
        rightKeyAttributes: [0]  // user_id at position 0 in Blocks
      });
      diff.setLeftInput(userScan);
      diff.setRightInput(blockScan);
      
      // Connect the pipeline: scan nodes → diff node
      userScan.addOutput(diff);
      blockScan.addOutput(diff);

      const mockOutput = new MockOutputNode('output');
      diff.addOutput(mockOutput);

      // Perform sequence of mixed operations
      const user1 = new Tuple([new ID('u1'), new StringAtom('Alice')]);
      const user2 = new Tuple([new ID('u2'), new StringAtom('Bob')]);
      const block1 = new Tuple([new ID('u1'), new StringAtom('spam')]);

      // 1. Add users
      userScan.pushDelta(new Delta(new Set([user1, user2])));

      // 2. Block user1
      blockScan.pushDelta(new Delta(new Set([block1])));

      // 3. Remove user2
      userScan.pushDelta(new Delta(new Set(), new Set([user2])));

      // 4. Unblock user1
      blockScan.pushDelta(new Delta(new Set(), new Set([block1])));

      // Final state should have only user1 (user2 was removed, user1 was unblocked)
      const finalState = diff.getState();
      expect(finalState.leftTuplesCount).toBe(1); // Only user1 remains
      expect(finalState.rightSupportCount).toBe(0); // No blocks
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty left and right inputs', () => {
      const diff = new DiffNode('emptyDiff', [0]);
      const leftNode = { id: 'left' };
      const rightNode = { id: 'right' };
      
      diff.setLeftInput(leftNode);
      diff.setRightInput(rightNode);

      // Process empty deltas
      diff._currentSourceNode = leftNode;
      const leftResult = diff.processDelta(new Delta(new Set(), new Set()));

      diff._currentSourceNode = rightNode;
      const rightResult = diff.processDelta(new Delta(new Set(), new Set()));

      expect(leftResult.adds.size).toBe(0);
      expect(leftResult.removes.size).toBe(0);
      expect(rightResult.adds.size).toBe(0);
      expect(rightResult.removes.size).toBe(0);
    });

    it('should handle identical tuples on left and right', () => {
      const diff = new DiffNode('identicalDiff', [0]);
      const leftNode = { id: 'left' };
      const rightNode = { id: 'right' };
      
      diff.setLeftInput(leftNode);
      diff.setRightInput(rightNode);

      const tuple = new Tuple([new ID('same'), new StringAtom('data')]);

      // Add same tuple to both sides
      diff._currentSourceNode = leftNode;
      const leftResult = diff.processDelta(new Delta(new Set([tuple])));

      diff._currentSourceNode = rightNode;
      const rightResult = diff.processDelta(new Delta(new Set([tuple])));

      // Left tuple should be emitted, then immediately removed
      expect(leftResult.adds.size).toBe(1);
      expect(rightResult.removes.size).toBe(1);
    });

    it('should handle concurrent modifications correctly', () => {
      const diff = new DiffNode('concurrentDiff', [0]);
      const leftNode = { id: 'left' };
      const rightNode = { id: 'right' };
      
      diff.setLeftInput(leftNode);
      diff.setRightInput(rightNode);

      const leftTuple = new Tuple([new ID('u1'), new StringAtom('left')]);
      const rightTuple = new Tuple([new ID('u1'), new StringAtom('right')]);

      // Simulate concurrent delta with both left and right changes
      diff._currentSourceNode = leftNode;
      diff.processDelta(new Delta(new Set([leftTuple])));

      diff._currentSourceNode = rightNode;
      const rightResult = diff.processDelta(new Delta(new Set([rightTuple])));

      // Should remove left tuple when right is added
      expect(rightResult.removes.size).toBe(1);
      expect(Array.from(rightResult.removes)[0]).toEqual(leftTuple);
    });
  });
});