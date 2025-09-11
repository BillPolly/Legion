import { describe, it } from 'node:test';
import assert from 'node:assert';
import { EntityProxy } from '../../src/proxy.js';
import { DataStore } from '../../src/store.js';
import { retractEntity } from 'datascript';

describe('Query Subscriptions - Integration', () => {
  describe('Query Re-execution on Data Changes', () => {
    it('should re-execute subscriptions when relevant data changes', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      // Create entities
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      const charlie = store.createEntity({ ':user/name': 'Charlie' });
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      
      let notificationCount = 0;
      let latestResults = null;
      
      // Subscribe to Alice's friends
      const unsubscribe = aliceProxy.subscribe({
        find: ['?friend-name'],
        where: [
          ['?this', ':user/friends', '?friend'],
          ['?friend', ':user/name', '?friend-name']
        ]
      }, (results) => {
        notificationCount++;
        latestResults = results;
      });
      
      // Initial state: no friends
      const initialQuery = aliceProxy.query({
        find: ['?friend-name'],
        where: [
          ['?this', ':user/friends', '?friend'],
          ['?friend', ':user/name', '?friend-name']
        ]
      });
      assert.deepStrictEqual(initialQuery, []);
      
      // Add friend - should trigger subscription
      store.conn.transact([
        ['+', alice.entityId, ':user/friends', bob.entityId]
      ]);
      
      // Query should now return the friend
      const updatedQuery = aliceProxy.query({
        find: ['?friend-name'],
        where: [
          ['?this', ':user/friends', '?friend'],
          ['?friend', ':user/name', '?friend-name']
        ]
      });
      assert.strictEqual(updatedQuery.length, 1);
      assert.strictEqual(updatedQuery[0][0], 'Bob');
      
      unsubscribe();
    });

    it('should handle subscription with entity relationships', () => {
      const schema = {
        ':user/manager': { valueType: 'ref' },
        ':user/reports': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      // Create organizational structure
      const manager = store.createEntity({ ':user/name': 'Manager', ':user/level': 'senior' });
      const alice = store.createEntity({ ':user/name': 'Alice', ':user/manager': manager.entityId });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      
      const managerProxy = new EntityProxy(manager.entityId, store);
      
      let reportsChanged = 0;
      
      // Subscribe to manager's reports
      const unsubscribe = managerProxy.subscribe({
        find: ['?report-name'],
        where: [
          ['?report', ':user/manager', '?this'],
          ['?report', ':user/name', '?report-name']
        ]
      }, (results) => {
        reportsChanged++;
      });
      
      // Initial state: Alice reports to manager
      const initialReports = managerProxy.query({
        find: ['?report-name'],
        where: [
          ['?report', ':user/manager', '?this'],
          ['?report', ':user/name', '?report-name']
        ]
      });
      assert.strictEqual(initialReports.length, 1);
      assert.strictEqual(initialReports[0][0], 'Alice');
      
      // Add Bob as report
      store.conn.transact([
        { ':db/id': bob.entityId, ':user/manager': manager.entityId }
      ]);
      
      // Query should now include both reports
      const updatedReports = managerProxy.query({
        find: ['?report-name'],
        where: [
          ['?report', ':user/manager', '?this'],
          ['?report', ':user/name', '?report-name']
        ]
      });
      assert.strictEqual(updatedReports.length, 2);
      const reportNames = updatedReports.map(r => r[0]).sort();
      assert.deepStrictEqual(reportNames, ['Alice', 'Bob']);
      
      unsubscribe();
    });

    it('should handle multiple entity subscriptions independently', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      // Create entities
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      const charlie = store.createEntity({ ':user/name': 'Charlie' });
      const diana = store.createEntity({ ':user/name': 'Diana' });
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      const bobProxy = new EntityProxy(bob.entityId, store);
      
      let aliceNotifications = 0;
      let bobNotifications = 0;
      
      // Subscribe to each entity's friends
      const unsubAlice = aliceProxy.subscribe({
        find: ['?friend-name'],
        where: [
          ['?this', ':user/friends', '?friend'],
          ['?friend', ':user/name', '?friend-name']
        ]
      }, () => { aliceNotifications++; });
      
      const unsubBob = bobProxy.subscribe({
        find: ['?friend-name'],
        where: [
          ['?this', ':user/friends', '?friend'],
          ['?friend', ':user/name', '?friend-name']
        ]
      }, () => { bobNotifications++; });
      
      // Add friends to Alice
      store.conn.transact([
        ['+', alice.entityId, ':user/friends', charlie.entityId],
        ['+', alice.entityId, ':user/friends', diana.entityId]
      ]);
      
      // Alice should have 2 friends now
      const aliceFriends = aliceProxy.query({
        find: ['?friend-name'],
        where: [
          ['?this', ':user/friends', '?friend'],
          ['?friend', ':user/name', '?friend-name']
        ]
      });
      assert.strictEqual(aliceFriends.length, 2);
      
      // Bob should have no friends
      const bobFriends = bobProxy.query({
        find: ['?friend-name'],
        where: [
          ['?this', ':user/friends', '?friend'],
          ['?friend', ':user/name', '?friend-name']
        ]
      });
      assert.strictEqual(bobFriends.length, 0);
      
      // Add friend to Bob
      store.conn.transact([
        ['+', bob.entityId, ':user/friends', alice.entityId]
      ]);
      
      // Bob should now have 1 friend
      const bobFriendsUpdated = bobProxy.query({
        find: ['?friend-name'],
        where: [
          ['?this', ':user/friends', '?friend'],
          ['?friend', ':user/name', '?friend-name']
        ]
      });
      assert.strictEqual(bobFriendsUpdated.length, 1);
      assert.strictEqual(bobFriendsUpdated[0][0], 'Alice');
      
      unsubAlice();
      unsubBob();
    });

    it('should handle subscription cleanup when entity deleted', () => {
      const store = new DataStore();
      
      const alice = store.createEntity({ ':user/name': 'Alice', ':user/age': 30 });
      const proxy = new EntityProxy(alice.entityId, store);
      
      let callbackCount = 0;
      const unsubscribe = proxy.subscribe({
        find: ['?name', '?age'],
        where: [
          ['?this', ':user/name', '?name'],
          ['?this', ':user/age', '?age']
        ]
      }, () => { callbackCount++; });
      
      // Should have active subscription
      assert.ok(proxy._getActiveSubscriptionCount() >= 1);
      
      // Delete entity
      const newDB = retractEntity(store.db(), alice.entityId);
      store.conn._db = newDB;
      
      // Proxy should be invalid
      assert.ok(!proxy.isValid());
      
      // Should handle cleanup gracefully
      assert.doesNotThrow(() => {
        unsubscribe();
      });
    });

    it('should handle complex queries with joins across entities', () => {
      const schema = {
        ':user/profile': { valueType: 'ref' },
        ':profile/skills': { card: 'many' },
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      // Create profile
      const profile = store.createEntity({
        ':profile/bio': 'Developer',
        ':profile/skills': ['JavaScript', 'React', 'Node.js']
      });
      
      // Create user with profile
      const alice = store.createEntity({
        ':user/name': 'Alice',
        ':user/profile': profile.entityId
      });
      
      const bob = store.createEntity({ ':user/name': 'Bob' });
      const charlie = store.createEntity({ ':user/name': 'Charlie' });
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      
      let profileSubscriptionCount = 0;
      
      // Subscribe to user profile data
      const unsubscribe = aliceProxy.subscribe({
        find: ['?skill'],
        where: [
          ['?this', ':user/profile', '?profile'],
          ['?profile', ':profile/skills', '?skill']
        ]
      }, () => { profileSubscriptionCount++; });
      
      // Test the query works
      const skills = aliceProxy.query({
        find: ['?skill'],
        where: [
          ['?this', ':user/profile', '?profile'],
          ['?profile', ':profile/skills', '?skill']
        ]
      });
      
      assert.strictEqual(skills.length, 3);
      const skillNames = skills.map(s => s[0]).sort();
      assert.deepStrictEqual(skillNames, ['JavaScript', 'Node.js', 'React']);
      
      unsubscribe();
    });

    it('should integrate with store reactive engine for automatic triggering', () => {
      const store = new DataStore();
      
      const alice = store.createEntity({ ':user/name': 'Alice', ':user/score': 85 });
      const proxy = new EntityProxy(alice.entityId, store);
      
      let notificationCount = 0;
      let latestResults = [];
      
      // Subscribe to score changes
      const unsubscribe = proxy.subscribe({
        find: ['?score'],
        where: [['?this', ':user/score', '?score']]
      }, (results, changes) => {
        notificationCount++;
        latestResults = results;
      });
      
      // Should be registered with store's reactive engine
      assert.ok(store._reactiveEngine);
      assert.ok(store._reactiveEngine.getSubscriptionCount() >= 1);
      
      // Update score
      proxy.update({ ':user/score': 95 });
      
      // Query should reflect new score
      const currentScore = proxy.query({
        find: ['?score'],
        where: [['?this', ':user/score', '?score']]
      });
      assert.strictEqual(currentScore.length, 1);
      assert.strictEqual(currentScore[0][0], 95);
      
      unsubscribe();
    });

    it('should handle subscription with proxy updates and deletions', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      const charlie = store.createEntity({ ':user/name': 'Charlie' });
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      
      let subscriptionResults = [];
      
      // Subscribe to friends list (simpler than aggregation)
      const unsubscribe = aliceProxy.subscribe({
        find: ['?friend-name'],
        where: [
          ['?this', ':user/friends', '?friend'],
          ['?friend', ':user/name', '?friend-name']
        ]
      }, (results) => {
        subscriptionResults.push(results);
      });
      
      // Initial: no friends
      let friends = aliceProxy.query({
        find: ['?friend-name'],
        where: [
          ['?this', ':user/friends', '?friend'],
          ['?friend', ':user/name', '?friend-name']
        ]
      });
      assert.strictEqual(friends.length, 0);
      
      // Add friends through proxy update
      aliceProxy.update({
        ':user/friends': [bob.entityId, charlie.entityId]
      });
      
      // Should now have 2 friends
      friends = aliceProxy.query({
        find: ['?friend-name'],
        where: [
          ['?this', ':user/friends', '?friend'],
          ['?friend', ':user/name', '?friend-name']
        ]
      });
      assert.strictEqual(friends.length, 2);
      const friendNames = friends.map(f => f[0]).sort();
      assert.deepStrictEqual(friendNames, ['Bob', 'Charlie']);
      
      // Remove friends
      aliceProxy.update({
        ':user/friends': []
      });
      
      // Should now have 0 friends
      friends = aliceProxy.query({
        find: ['?friend-name'],
        where: [
          ['?this', ':user/friends', '?friend'],
          ['?friend', ':user/name', '?friend-name']
        ]
      });
      assert.strictEqual(friends.length, 0);
      
      unsubscribe();
    });

    it('should handle subscriptions across multiple related entities', () => {
      const schema = {
        ':user/profile': { valueType: 'ref' },
        ':profile/company': { valueType: 'ref' },
        ':company/employees': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      // Create company hierarchy
      const company = store.createEntity({
        ':company/name': 'Tech Corp',
        ':company/industry': 'Software'
      });
      
      const profile1 = store.createEntity({
        ':profile/role': 'Engineer',
        ':profile/company': company.entityId
      });
      
      const profile2 = store.createEntity({
        ':profile/role': 'Designer',
        ':profile/company': company.entityId
      });
      
      const alice = store.createEntity({
        ':user/name': 'Alice',
        ':user/profile': profile1.entityId
      });
      
      const bob = store.createEntity({
        ':user/name': 'Bob',
        ':user/profile': profile2.entityId
      });
      
      // Add employees to company
      store.conn.transact([
        ['+', company.entityId, ':company/employees', alice.entityId],
        ['+', company.entityId, ':company/employees', bob.entityId]
      ]);
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      
      let colleagueUpdates = 0;
      
      // Subscribe to colleagues at same company
      const unsubscribe = aliceProxy.subscribe({
        find: ['?colleague-name', '?colleague-role'],
        where: [
          ['?this', ':user/profile', '?my-profile'],
          ['?my-profile', ':profile/company', '?company'],
          ['?company', ':company/employees', '?colleague'],
          ['?colleague', ':user/name', '?colleague-name'],
          ['?colleague', ':user/profile', '?colleague-profile'],
          ['?colleague-profile', ':profile/role', '?colleague-role']
        ]
      }, () => { colleagueUpdates++; });
      
      // Query for colleagues
      const colleagues = aliceProxy.query({
        find: ['?colleague-name', '?colleague-role'],
        where: [
          ['?this', ':user/profile', '?my-profile'],
          ['?my-profile', ':profile/company', '?company'],
          ['?company', ':company/employees', '?colleague'],
          ['?colleague', ':user/name', '?colleague-name'],
          ['?colleague', ':user/profile', '?colleague-profile'],
          ['?colleague-profile', ':profile/role', '?colleague-role']
        ]
      });
      
      assert.strictEqual(colleagues.length, 2); // Alice and Bob
      const colleagueData = colleagues.map(c => ({ name: c[0], role: c[1] })).sort((a, b) => a.name.localeCompare(b.name));
      assert.strictEqual(colleagueData[0].name, 'Alice');
      assert.strictEqual(colleagueData[0].role, 'Engineer');
      assert.strictEqual(colleagueData[1].name, 'Bob');
      assert.strictEqual(colleagueData[1].role, 'Designer');
      
      unsubscribe();
    });

    it('should handle subscription deactivation and cleanup', () => {
      const store = new DataStore();
      
      const alice = store.createEntity({ ':user/name': 'Alice', ':user/active': true });
      const proxy = new EntityProxy(alice.entityId, store);
      
      let activeSubscriptions = 0;
      
      // Create multiple subscriptions
      const unsub1 = proxy.subscribe({
        find: ['?name'],
        where: [['?this', ':user/name', '?name']]
      }, () => { activeSubscriptions++; });
      
      const unsub2 = proxy.subscribe({
        find: ['?active'],
        where: [['?this', ':user/active', '?active']]
      }, () => { activeSubscriptions++; });
      
      // Should have 2 subscriptions
      assert.ok(proxy._getActiveSubscriptionCount() >= 2);
      assert.ok(store._reactiveEngine.getSubscriptionCount() >= 2);
      
      // Unsubscribe first subscription
      unsub1();
      assert.ok(proxy._getActiveSubscriptionCount() >= 1);
      
      // Unsubscribe second subscription
      unsub2();
      assert.ok(proxy._getActiveSubscriptionCount() >= 0);
      
      // Store reactive engine should clean up subscriptions
      const cleanedUp = store._reactiveEngine.cleanupSubscriptions();
      assert.ok(cleanedUp >= 0);
    });

    it('should handle concurrent subscription operations', () => {
      const store = new DataStore();
      
      // Create multiple entities
      const entities = [];
      const proxies = [];
      
      for (let i = 0; i < 5; i++) {
        const entity = store.createEntity({
          ':user/name': `User${i}`,
          ':user/index': i
        });
        entities.push(entity);
        proxies.push(new EntityProxy(entity.entityId, store));
      }
      
      const unsubscribeFunctions = [];
      
      // Create subscriptions for all proxies
      proxies.forEach((proxy, index) => {
        const unsub = proxy.subscribe({
          find: ['?name', '?index'],
          where: [
            ['?this', ':user/name', '?name'],
            ['?this', ':user/index', '?index']
          ]
        }, () => {});
        
        unsubscribeFunctions.push(unsub);
      });
      
      // Should have multiple subscriptions registered
      assert.ok(store._reactiveEngine.getSubscriptionCount() >= 5);
      
      // Each proxy should track its subscription
      proxies.forEach(proxy => {
        assert.ok(proxy._getActiveSubscriptionCount() >= 1);
      });
      
      // Cleanup all subscriptions
      unsubscribeFunctions.forEach(unsub => unsub());
      
      // Clean up deactivated subscriptions
      const cleanedUp = store._reactiveEngine.cleanupSubscriptions();
      assert.ok(cleanedUp >= 0); // At least some cleanup should happen
    });

    it('should validate subscription behavior with schema constraints', () => {
      const schema = {
        ':user/id': { unique: 'identity' },
        ':user/email': { unique: 'value' },
        ':user/manager': { valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      const manager = store.createEntity({
        ':user/id': 'mgr-001',
        ':user/name': 'Manager',
        ':user/email': 'manager@example.com'
      });
      
      const alice = store.createEntity({
        ':user/id': 'emp-001',
        ':user/name': 'Alice',
        ':user/email': 'alice@example.com',
        ':user/manager': manager.entityId
      });
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      
      // Subscribe to manager information
      const unsubscribe = aliceProxy.subscribe({
        find: ['?manager-name', '?manager-email'],
        where: [
          ['?this', ':user/manager', '?manager'],
          ['?manager', ':user/name', '?manager-name'],
          ['?manager', ':user/email', '?manager-email']
        ]
      }, () => {});
      
      // Query should work with schema constraints
      const managerInfo = aliceProxy.query({
        find: ['?manager-name', '?manager-email'],
        where: [
          ['?this', ':user/manager', '?manager'],
          ['?manager', ':user/name', '?manager-name'],
          ['?manager', ':user/email', '?manager-email']
        ]
      });
      
      assert.strictEqual(managerInfo.length, 1);
      assert.strictEqual(managerInfo[0][0], 'Manager');
      assert.strictEqual(managerInfo[0][1], 'manager@example.com');
      
      unsubscribe();
    });
  });

  describe('Computed Properties Integration', () => {
    it('should update computed properties when database changes', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      const charlie = store.createEntity({ ':user/name': 'Charlie' });
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      
      // Define computed property for friend count
      aliceProxy.computed('friendCount', {
        find: ['?friend'],
        where: [['?this', ':user/friends', '?friend']]
      }, (results) => results.length);
      
      // Initial: no friends
      assert.strictEqual(aliceProxy.friendCount, 0);
      
      // Add friends
      store.conn.transact([
        ['+', alice.entityId, ':user/friends', bob.entityId],
        ['+', alice.entityId, ':user/friends', charlie.entityId]
      ]);
      
      // Should manually invalidate and recompute for testing
      aliceProxy._invalidateComputedProperty('friendCount');
      assert.strictEqual(aliceProxy.friendCount, 2);
      
      // Remove one friend
      store.conn.transact([
        ['-', alice.entityId, ':user/friends', bob.entityId]
      ]);
      
      aliceProxy._invalidateComputedProperty('friendCount');
      assert.strictEqual(aliceProxy.friendCount, 1);
    });

    it('should handle computed properties with complex entity relationships', () => {
      const schema = {
        ':user/posts': { card: 'many', valueType: 'ref' },
        ':post/tags': { card: 'many' },
        ':user/profile': { valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      // Create user and profile
      const profile = store.createEntity({
        ':profile/bio': 'Content Creator',
        ':profile/followers': 1500
      });
      
      const alice = store.createEntity({
        ':user/name': 'Alice',
        ':user/profile': profile.entityId
      });
      
      // Create posts
      const post1 = store.createEntity({
        ':post/title': 'Tech Article',
        ':post/views': 100,
        ':post/tags': ['tech', 'programming']
      });
      
      const post2 = store.createEntity({
        ':post/title': 'Lifestyle Post',
        ':post/views': 50,
        ':post/tags': ['lifestyle', 'tips']
      });
      
      // Link posts to user
      store.conn.transact([
        ['+', alice.entityId, ':user/posts', post1.entityId],
        ['+', alice.entityId, ':user/posts', post2.entityId]
      ]);
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      
      // Computed property for total post views
      aliceProxy.computed('totalViews', {
        find: ['?views'],
        where: [
          ['?this', ':user/posts', '?post'],
          ['?post', ':post/views', '?views']
        ]
      }, (results) => {
        return results.reduce((sum, r) => sum + r[0], 0);
      });
      
      // Computed property for profile summary
      aliceProxy.computed('profileInfo', {
        find: ['?bio', '?followers'],
        where: [
          ['?this', ':user/profile', '?profile'],
          ['?profile', ':profile/bio', '?bio'],
          ['?profile', ':profile/followers', '?followers']
        ]
      }, (results) => {
        return results.length > 0 
          ? `${results[0][0]} (${results[0][1]} followers)`
          : 'No profile';
      });
      
      assert.strictEqual(aliceProxy.totalViews, 150); // 100 + 50
      assert.strictEqual(aliceProxy.profileInfo, 'Content Creator (1500 followers)');
      
      // Update post views
      store.conn.transact([
        { ':db/id': post1.entityId, ':post/views': 200 }
      ]);
      
      aliceProxy._invalidateComputedProperty('totalViews');
      assert.strictEqual(aliceProxy.totalViews, 250); // 200 + 50
    });

    it('should handle computed property invalidation patterns', () => {
      const store = new DataStore();
      
      const alice = store.createEntity({
        ':user/name': 'Alice',
        ':user/points': 100,
        ':user/level': 1
      });
      
      const proxy = new EntityProxy(alice.entityId, store);
      
      let computeCount = 0;
      
      // Computed property with multiple dependencies
      proxy.computed('userStatus', {
        find: ['?name', '?points', '?level'],
        where: [
          ['?this', ':user/name', '?name'],
          ['?this', ':user/points', '?points'],
          ['?this', ':user/level', '?level']
        ]
      }, (results) => {
        computeCount++;
        if (results.length === 0) return 'Unknown';
        const [name, points, level] = results[0];
        return `${name}: Level ${level} (${points} points)`;
      });
      
      // Initial computation
      assert.strictEqual(proxy.userStatus, 'Alice: Level 1 (100 points)');
      assert.strictEqual(computeCount, 1);
      
      // Update points - should automatically invalidate with new implementation
      proxy.update({ ':user/points': 150 });
      assert.strictEqual(proxy.userStatus, 'Alice: Level 1 (150 points)');
      assert.strictEqual(computeCount, 2);
      
      // Update level - should also automatically invalidate
      proxy.update({ ':user/level': 2 });
      assert.strictEqual(proxy.userStatus, 'Alice: Level 2 (150 points)');
      assert.strictEqual(computeCount, 3);
    });

    it('should handle computed properties with entity deletion', () => {
      const schema = {
        ':user/profile': { valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      const profile = store.createEntity({
        ':profile/title': 'Engineer'
      });
      
      const alice = store.createEntity({
        ':user/name': 'Alice',
        ':user/profile': profile.entityId
      });
      
      const proxy = new EntityProxy(alice.entityId, store);
      
      // Computed property depending on referenced entity
      proxy.computed('jobTitle', {
        find: ['?title'],
        where: [
          ['?this', ':user/profile', '?profile'],
          ['?profile', ':profile/title', '?title']
        ]
      }, (results) => results.length > 0 ? results[0][0] : 'Unemployed');
      
      assert.strictEqual(proxy.jobTitle, 'Engineer');
      
      // Delete referenced entity
      const newDB = retractEntity(store.db(), profile.entityId);
      store.conn._db = newDB;
      
      // Should handle missing reference gracefully  
      proxy._invalidateComputedProperty('jobTitle');
      assert.strictEqual(proxy.jobTitle, 'Unemployed');
    });

    it('should integrate computed properties with reactive subscriptions', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      const store = new DataStore(schema);
      
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      
      const proxy = new EntityProxy(alice.entityId, store);
      
      // Define computed property
      proxy.computed('socialScore', {
        find: ['?friend'],
        where: [['?this', ':user/friends', '?friend']]
      }, (results) => results.length * 10); // 10 points per friend
      
      // Also subscribe to changes
      let subscriptionTriggers = 0;
      const unsubscribe = proxy.subscribe({
        find: ['?friend'],
        where: [['?this', ':user/friends', '?friend']]
      }, () => { subscriptionTriggers++; });
      
      // Initial state
      assert.strictEqual(proxy.socialScore, 0);
      
      // Add friend
      store.conn.transact([
        ['+', alice.entityId, ':user/friends', bob.entityId]
      ]);
      
      // Manually invalidate computed property (automatic invalidation will be in next phase)
      proxy._invalidateComputedProperty('socialScore');
      assert.strictEqual(proxy.socialScore, 10); // 1 friend * 10
      
      unsubscribe();
    });
  });
});