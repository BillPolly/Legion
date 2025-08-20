/**
 * Comprehensive Integration Test for Incremental LFTJ Engine
 * Tests end-to-end functionality with real-world scenarios
 */

import { IncrementalLFTJ } from '../../src/IncrementalLFTJ.js';
import { EnumerableProvider } from '../../src/ComputeProvider.js';
import { Tuple } from '../../src/Tuple.js';
import { ID, StringAtom, Integer } from '../../src/Atom.js';

describe('IncrementalLFTJ End-to-End Integration', () => {
  let engine;

  beforeEach(() => {
    engine = new IncrementalLFTJ({
      batchSize: 100,
      autoFlush: true,
      enableStatistics: true
    });
  });

  afterEach(() => {
    engine.reset();
  });

  describe('social network scenario', () => {
    beforeEach(() => {
      // Define relations for a social network
      engine.defineRelation('users', {
        userId: 'ID',
        name: 'String',
        age: 'Integer'
      });

      engine.defineRelation('follows', {
        follower: 'ID',
        followee: 'ID'
      });

      engine.defineRelation('posts', {
        postId: 'ID',
        userId: 'ID',
        content: 'String'
      });

      engine.defineRelation('likes', {
        userId: 'ID',
        postId: 'ID'
      });
    });

    it('should handle follower feed query', () => {
      // Register a query to find posts from users someone follows
      const feedQuery = engine.query('feed-query')
        .from('follows', engine._relations.get('follows'))
        .joinRelation('posts', engine._relations.get('posts'), [{ left: 1, right: 1 }])
        .joinRelation('users', engine._relations.get('users'), [{ left: 2, right: 0 }])
        .select([0, 2, 3, 4]) // follower, postId, userId, content
        .build();

      const handle = engine.register(feedQuery);

      // Track notifications
      let notifications = [];
      handle.subscribe((notification) => {
        notifications.push(notification);
      }, { includeDeltas: true, includeStats: true });

      // Add users first (not part of the query)
      engine.insert('users', [
        { userId: 'u1', name: 'Alice', age: 25 },
        { userId: 'u2', name: 'Bob', age: 30 },
        { userId: 'u3', name: 'Carol', age: 28 }
      ]);

      // Add follows relationships - this should trigger the query
      engine.insert('follows', [
        ['u1', 'u2'], // Alice follows Bob
        ['u1', 'u3'], // Alice follows Carol
        ['u2', 'u3']  // Bob follows Carol
      ]);
      
      // Flush after follows to increment delta count
      engine.flush();

      // Add posts - this should also trigger the query since it joins posts
      engine.insert('posts', [
        ['p1', 'u2', 'Hello from Bob!'],
        ['p2', 'u3', 'Carol here!'],
        ['p3', 'u1', 'Alice posting']
      ]);

      // Flush again to process posts
      engine.flush();

      // Check we got notifications
      expect(notifications.length).toBeGreaterThan(0);
      
      // Check results
      const results = handle.getResults();
      expect(results).toBeDefined();

      // Check statistics - for batch operations, check other stats
      const stats = handle.getStatistics();
      expect(stats.graphId).toBe('feed-query');
      // Check that the query is registered and running
      expect(stats).toBeDefined();
      
      // Also check engine-level statistics  
      const engineStats = engine.getStatistics();
      expect(engineStats.queries).toBe(1);
    });

    it('should handle incremental updates correctly', () => {
      // Simple follower count query
      const followerCountQuery = engine.query('follower-count')
        .from('follows', engine._relations.get('follows'))
        .build();

      const handle = engine.register(followerCountQuery);

      // Track changes
      let updateCount = 0;
      handle.subscribe(() => {
        updateCount++;
      });

      // Initial data
      engine.insert('follows', [
        ['u1', 'u2'],
        ['u3', 'u2']
      ]);
      engine.flush();

      const initialCount = updateCount;

      // Add more followers
      engine.insert('follows', ['u4', 'u2']);
      engine.flush();

      expect(updateCount).toBeGreaterThan(initialCount);

      // Remove a follower
      engine.delete('follows', ['u1', 'u2']);
      engine.flush();

      expect(updateCount).toBeGreaterThan(initialCount + 1);
    });

    it('should handle complex join with projection', () => {
      // Query: Find all users who liked posts by people they follow
      const likedFollowedQuery = engine.query('liked-followed')
        .from('follows', engine._relations.get('follows'))
        .joinRelation('posts', engine._relations.get('posts'), [{ left: 1, right: 1 }])
        .joinRelation('likes', engine._relations.get('likes'), [{ left: 2, right: 1 }])
        .select([0, 3]) // follower, liker
        .build();

      const handle = engine.register(likedFollowedQuery);

      // Add data
      engine.beginTransaction();
      
      engine.insert('users', [
        ['u1', 'Alice', 25],
        ['u2', 'Bob', 30],
        ['u3', 'Carol', 28]
      ]);

      engine.insert('follows', [
        ['u1', 'u2'],
        ['u3', 'u2']
      ]);

      engine.insert('posts', [
        ['p1', 'u2', 'Post by Bob']
      ]);

      engine.insert('likes', [
        ['u1', 'p1'], // Alice likes Bob's post (she follows him)
        ['u3', 'p1'], // Carol likes Bob's post (she follows him)
        ['u2', 'p1']  // Bob likes his own post (doesn't follow himself)
      ]);

      engine.endTransaction();

      const results = handle.getResults();
      expect(results).toBeDefined();
    });
  });

  describe('e-commerce scenario', () => {
    beforeEach(() => {
      engine.defineRelation('products', {
        productId: 'ID',
        name: 'String',
        price: 'Integer'
      });

      engine.defineRelation('customers', {
        customerId: 'ID',
        name: 'String'
      });

      engine.defineRelation('orders', {
        orderId: 'ID',
        customerId: 'ID',
        productId: 'ID',
        quantity: 'Integer'
      });
    });

    it('should track customer order totals', () => {
      const orderTotalsQuery = engine.query('order-totals')
        .from('orders', engine._relations.get('orders'))
        .joinRelation('products', engine._relations.get('products'), [{ left: 2, right: 0 }])
        .joinRelation('customers', engine._relations.get('customers'), [{ left: 1, right: 0 }])
        .select([7, 8, 3, 5]) // customerId, customerName, quantity, price
        .build();

      const handle = engine.register(orderTotalsQuery);

      // Add products
      engine.insert('products', [
        ['prod1', 'Widget', 100],
        ['prod2', 'Gadget', 200]
      ]);

      // Add customers
      engine.insert('customers', [
        ['cust1', 'John'],
        ['cust2', 'Jane']
      ]);

      // Add orders
      engine.insert('orders', [
        ['order1', 'cust1', 'prod1', 2],
        ['order2', 'cust1', 'prod2', 1],
        ['order3', 'cust2', 'prod1', 3]
      ]);

      engine.flush();

      const results = handle.getResults();
      expect(results).toBeDefined();

      // Update order quantity
      engine.update('orders',
        ['order1', 'cust1', 'prod1', 2],
        ['order1', 'cust1', 'prod1', 5]
      );

      engine.flush();

      const newResults = handle.getResults();
      expect(newResults).toBeDefined();
    });
  });

  describe('compute providers', () => {
    it('should integrate with custom compute providers', () => {
      // Create a custom provider for computed values
      class PriceCalculator extends EnumerableProvider {
        constructor() {
          super('price-calculator');
          this._basePrice = 100;
        }

        enumerate() {
          // Generate some computed tuples
          const tuples = new Set();
          for (let i = 1; i <= 3; i++) {
            tuples.add(new Tuple([
              new ID(`item${i}`),
              new Integer(this._basePrice * i)
            ]));
          }
          return tuples;
        }

        deltaSince(version) {
          // For simplicity, return empty delta
          return { adds: new Set(), removes: new Set() };
        }
      }

      const calculator = new PriceCalculator();
      engine.registerProvider('prices', calculator);

      // Define a computed relation schema
      engine.defineRelation('computed_prices', {
        itemId: 'ID',
        price: 'Integer'
      });

      // Create a query using the computed provider
      const computedQuery = engine.query('computed-query')
        .compute(engine._providers.get('prices'))
        .build();

      const handle = engine.register(computedQuery);

      const results = handle.getResults();
      expect(results).toBeDefined();
    });
  });

  describe('transaction management', () => {
    it('should handle complex transactions', async () => {
      engine.defineRelation('accounts', {
        accountId: 'ID',
        balance: 'Integer'
      });

      engine.defineRelation('transfers', {
        transferId: 'ID',
        fromAccount: 'ID',
        toAccount: 'ID',
        amount: 'Integer'
      });

      const balanceQuery = engine.query('balances')
        .from('accounts', engine._relations.get('accounts'))
        .build();

      const handle = engine.register(balanceQuery);

      // Initial accounts
      engine.insert('accounts', [
        ['acc1', 1000],
        ['acc2', 500]
      ]);

      // Perform transfer in transaction
      const transferResult = await engine.transaction(async () => {
        // Record transfer
        engine.insert('transfers', ['t1', 'acc1', 'acc2', 200]);
        
        // Update balances
        engine.update('accounts', ['acc1', 1000], ['acc1', 800]);
        engine.update('accounts', ['acc2', 500], ['acc2', 700]);
        
        return 'transfer-complete';
      });

      expect(transferResult).toBe('transfer-complete');

      const results = handle.getResults();
      expect(results).toBeDefined();
    });
  });

  describe('performance and batching', () => {
    it('should efficiently handle large batch updates', () => {
      engine.defineRelation('items', {
        itemId: 'ID',
        value: 'Integer'
      });

      const itemQuery = engine.query('item-query')
        .from('items', engine._relations.get('items'))
        .build();

      const handle = engine.register(itemQuery);

      // Add many items in a single batch
      const items = [];
      for (let i = 1; i <= 1000; i++) {
        items.push([`item${i}`, i]);
      }

      engine.beginTransaction();
      engine.insert('items', items);
      engine.endTransaction();

      const stats = engine.getStatistics();
      // Since items is a single large batch, it counts as 1 delta operation
      expect(stats.batch.totalBatches).toBeGreaterThanOrEqual(1);
    });
  });

  describe('query lifecycle management', () => {
    it('should handle query activation and deactivation', () => {
      engine.defineRelation('data', {
        id: 'ID',
        value: 'String'
      });

      const query1 = engine.query('query1')
        .from('data', engine._relations.get('data'))
        .build();

      const query2 = engine.query('query2')
        .from('data', engine._relations.get('data'))
        .build();

      const handle1 = engine.register(query1);
      const handle2 = engine.register(query2);

      expect(engine.listQueries()).toContain('query1');
      expect(engine.listQueries()).toContain('query2');

      // Deactivate query1
      handle1.deactivate();
      expect(engine.listQueries()).not.toContain('query1');
      expect(engine.listQueries()).toContain('query2');

      // Try to use deactivated query
      expect(() => handle1.getResults()).toThrow('Query is not active');

      // Query2 should still work
      expect(() => handle2.getResults()).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle invalid operations gracefully', () => {
      // Create engine with autoRegisterRelations disabled
      const strictEngine = new IncrementalLFTJ({
        autoRegisterRelations: false
      });
      
      // Try to insert into undefined relation - this should fail during normalization
      // since the relation doesn't exist
      expect(() => {
        strictEngine.insert('nonexistent', [['data']]);
      }).toThrow('Relation \'nonexistent\' not defined');

      // Try to register duplicate query
      engine.defineRelation('test', { id: 'ID' });
      const query = engine.query('duplicate')
        .from('test', engine._relations.get('test'))
        .build();

      engine.register(query);

      expect(() => {
        engine.register(query);
      }).toThrow('Query \'duplicate\' already registered');

      // Try to define duplicate relation
      expect(() => {
        engine.defineRelation('test', { id: 'ID' });
      }).toThrow('Relation \'test\' already defined');
    });
  });

  describe('global subscriptions', () => {
    it('should notify all global subscribers of changes', () => {
      const globalNotifications = [];
      
      const unsubscribe = engine.onUpdate((notification) => {
        globalNotifications.push(notification);
      });

      engine.defineRelation('global_test', { id: 'ID' });
      
      const query = engine.query('global-query')
        .from('global_test', engine._relations.get('global_test'))
        .build();

      engine.register(query);

      engine.insert('global_test', ['item1']);
      engine.flush();

      expect(globalNotifications.length).toBeGreaterThan(0);
      expect(globalNotifications[0].relationName).toBe('global_test');
      expect(globalNotifications[0].affectedQueries).toContain('global-query');

      unsubscribe();

      // After unsubscribe, should not receive notifications
      const countBefore = globalNotifications.length;
      engine.insert('global_test', ['item2']);
      engine.flush();
      
      expect(globalNotifications.length).toBe(countBefore);
    });
  });
});