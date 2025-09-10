import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createDataStore, EntityProxy } from '../../index.js';

describe('Performance Baseline - Integration', () => {
  describe('Basic Performance Characteristics', () => {
    it('should handle moderate entity creation load', () => {
      const store = createDataStore();
      
      const entityCount = 1000;
      const startTime = Date.now();
      
      // Create many entities
      const entities = [];
      for (let i = 0; i < entityCount; i++) {
        const entity = store.createEntity({
          ':user/name': `User${i}`,
          ':user/index': i,
          ':user/email': `user${i}@example.com`,
          ':user/active': i % 2 === 0,
          ':user/score': Math.floor(Math.random() * 100)
        });
        entities.push(entity);
      }
      
      const creationTime = Date.now() - startTime;
      console.log(`Created ${entityCount} entities in ${creationTime}ms (${(entityCount / creationTime * 1000).toFixed(1)} entities/sec)`);
      
      // Verify all entities were created correctly
      assert.strictEqual(entities.length, entityCount);
      entities.forEach((entity, index) => {
        assert.ok(entity.entityId);
        
        // Spot check some entities
        if (index % 100 === 0) {
          const entityData = store.db().entity(entity.entityId);
          assert.strictEqual(entityData[':user/name'], `User${index}`);
          assert.strictEqual(entityData[':user/index'], index);
        }
      });
      
      // Performance should be reasonable (at least 50 entities per second)
      const entitiesPerSecond = entityCount / creationTime * 1000;
      assert.ok(entitiesPerSecond >= 50, `Performance too slow: ${entitiesPerSecond.toFixed(1)} entities/sec`);
    });

    it('should handle moderate proxy creation and access load', () => {
      const store = createDataStore();
      
      // Create entities first
      const entityCount = 500;
      const entities = [];
      for (let i = 0; i < entityCount; i++) {
        const entity = store.createEntity({
          ':user/name': `User${i}`,
          ':user/index': i,
          ':user/score': i * 2
        });
        entities.push(entity);
      }
      
      const startTime = Date.now();
      
      // Create proxies and perform operations
      const proxies = [];
      for (let i = 0; i < entityCount; i++) {
        const proxy = new EntityProxy(entities[i].entityId, store);
        proxies.push(proxy);
        
        // Verify proxy works
        assert.strictEqual(proxy.get(':user/name'), `User${i}`);
        assert.strictEqual(proxy.get(':user/index'), i);
        assert.strictEqual(proxy.get(':user/score'), i * 2);
      }
      
      const accessTime = Date.now() - startTime;
      console.log(`Created ${entityCount} proxies and accessed properties in ${accessTime}ms`);
      
      // All proxies should be valid and functional
      assert.strictEqual(proxies.length, entityCount);
      proxies.forEach(proxy => {
        assert.ok(proxy.isValid());
      });
      
      // Performance should be reasonable
      const operationsPerSecond = (entityCount * 3) / accessTime * 1000; // 3 property accesses per proxy
      assert.ok(operationsPerSecond >= 1000, `Proxy access too slow: ${operationsPerSecond.toFixed(1)} ops/sec`);
    });

    it('should handle moderate query execution load', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' },
        ':user/department': { valueType: 'ref' }
      };
      
      const store = createDataStore({ schema });
      
      // Create entities with relationships
      const userCount = 200;
      const users = [];
      
      for (let i = 0; i < userCount; i++) {
        const user = store.createEntity({
          ':user/name': `User${i}`,
          ':user/index': i,
          ':user/level': i % 5, // 5 levels
          ':user/active': i % 3 === 0
        });
        users.push(user);
      }
      
      // Create some relationships
      for (let i = 0; i < userCount; i += 10) {
        const user = users[i];
        // Add friends for every 10th user
        for (let j = i + 1; j < Math.min(i + 5, userCount); j++) {
          store.conn.transact([
            ['+', user.entityId, ':user/friends', users[j].entityId]
          ]);
        }
      }
      
      const startTime = Date.now();
      
      // Perform many queries
      const queryCount = 100;
      let totalResults = 0;
      
      for (let i = 0; i < queryCount; i++) {
        const userIndex = i % userCount;
        const proxy = new EntityProxy(users[userIndex].entityId, store);
        
        // Query user data
        const userData = proxy.query({
          find: ['?name', '?level', '?active'],
          where: [
            ['?this', ':user/name', '?name'],
            ['?this', ':user/level', '?level'],
            ['?this', ':user/active', '?active']
          ]
        });
        
        totalResults += userData.length;
        
        // Query friends
        const friends = proxy.query({
          find: ['?friend-name'],
          where: [
            ['?this', ':user/friends', '?friend'],
            ['?friend', ':user/name', '?friend-name']
          ]
        });
        
        totalResults += friends.length;
      }
      
      const queryTime = Date.now() - startTime;
      console.log(`Executed ${queryCount * 2} queries in ${queryTime}ms (${(queryCount * 2 / queryTime * 1000).toFixed(1)} queries/sec)`);
      console.log(`Total results: ${totalResults}`);
      
      // Performance should be reasonable (at least 10 queries per second)
      const queriesPerSecond = (queryCount * 2) / queryTime * 1000;
      assert.ok(queriesPerSecond >= 10, `Query performance too slow: ${queriesPerSecond.toFixed(1)} queries/sec`);
    });

    it('should handle moderate subscription load', () => {
      const store = createDataStore();
      
      // Create entities
      const entityCount = 100;
      const entities = [];
      for (let i = 0; i < entityCount; i++) {
        const entity = store.createEntity({
          ':user/name': `User${i}`,
          ':user/index': i
        });
        entities.push(entity);
      }
      
      const startTime = Date.now();
      
      // Create subscriptions for each entity
      const subscriptions = [];
      const callbackCounts = [];
      
      for (let i = 0; i < entityCount; i++) {
        const proxy = new EntityProxy(entities[i].entityId, store);
        let callbackCount = 0;
        
        const unsubscribe = proxy.subscribe({
          find: ['?name', '?index'],
          where: [
            ['?this', ':user/name', '?name'],
            ['?this', ':user/index', '?index']
          ]
        }, () => { callbackCount++; });
        
        subscriptions.push(unsubscribe);
        callbackCounts.push(() => callbackCount);
      }
      
      const subscriptionTime = Date.now() - startTime;
      console.log(`Created ${entityCount} subscriptions in ${subscriptionTime}ms`);
      
      // Verify subscriptions are registered
      assert.ok(store._reactiveEngine.getSubscriptionCount() >= entityCount);
      
      // Performance should be reasonable
      const subscriptionsPerSecond = entityCount / subscriptionTime * 1000;
      assert.ok(subscriptionsPerSecond >= 50, `Subscription creation too slow: ${subscriptionsPerSecond.toFixed(1)} subs/sec`);
      
      // Cleanup
      subscriptions.forEach(unsub => unsub());
      store._reactiveEngine.cleanupSubscriptions();
    });

    it('should handle moderate update load', () => {
      const store = createDataStore();
      
      // Create entities
      const entityCount = 300;
      const entities = [];
      const proxies = [];
      
      for (let i = 0; i < entityCount; i++) {
        const entity = store.createEntity({
          ':user/name': `User${i}`,
          ':user/score': 0,
          ':user/level': 1
        });
        entities.push(entity);
        proxies.push(new EntityProxy(entity.entityId, store));
      }
      
      const startTime = Date.now();
      
      // Perform many updates
      const updateCount = 500;
      for (let i = 0; i < updateCount; i++) {
        const proxyIndex = i % entityCount;
        const proxy = proxies[proxyIndex];
        
        proxy.update({
          ':user/score': i,
          ':user/level': Math.floor(i / 100) + 1,
          ':user/lastUpdate': Date.now()
        });
      }
      
      const updateTime = Date.now() - startTime;
      console.log(`Performed ${updateCount} updates in ${updateTime}ms (${(updateCount / updateTime * 1000).toFixed(1)} updates/sec)`);
      
      // Verify updates worked correctly
      proxies.forEach((proxy, index) => {
        assert.ok(proxy.isValid());
        assert.strictEqual(proxy.get(':user/name'), `User${index}`);
        assert.ok(proxy.get(':user/lastUpdate') > 0);
      });
      
      // Performance should be reasonable (at least 20 updates per second)
      const updatesPerSecond = updateCount / updateTime * 1000;
      assert.ok(updatesPerSecond >= 20, `Update performance too slow: ${updatesPerSecond.toFixed(1)} updates/sec`);
    });

    it('should handle moderate computed property load', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      
      const store = createDataStore({ schema });
      
      // Create entities with relationships
      const userCount = 50;
      const users = [];
      
      for (let i = 0; i < userCount; i++) {
        const user = store.createEntity({
          ':user/name': `User${i}`,
          ':user/index': i,
          ':user/score': i * 10
        });
        users.push(user);
      }
      
      // Create some friendships
      for (let i = 0; i < userCount; i += 5) {
        for (let j = i + 1; j < Math.min(i + 3, userCount); j++) {
          store.conn.transact([
            ['+', users[i].entityId, ':user/friends', users[j].entityId]
          ]);
        }
      }
      
      const startTime = Date.now();
      
      // Create computed properties for all users
      const proxies = [];
      let computeCount = 0;
      
      for (let i = 0; i < userCount; i++) {
        const proxy = new EntityProxy(users[i].entityId, store);
        proxies.push(proxy);
        
        // Define multiple computed properties
        proxy.computed('friendCount', {
          find: ['?friend'],
          where: [['?this', ':user/friends', '?friend']]
        }, (results) => {
          computeCount++;
          return results.length;
        });
        
        proxy.computed('scoreLevel', {
          find: ['?score'],
          where: [['?this', ':user/score', '?score']]
        }, (results) => {
          computeCount++;
          return results.length > 0 ? Math.floor(results[0][0] / 50) : 0;
        });
        
        proxy.computed('summary', {
          find: ['?name', '?index'],
          where: [
            ['?this', ':user/name', '?name'],
            ['?this', ':user/index', '?index']
          ]
        }, (results) => {
          computeCount++;
          return results.length > 0 ? `${results[0][0]}#${results[0][1]}` : 'Unknown';
        });
      }
      
      // Access all computed properties (triggers computation)
      for (let i = 0; i < userCount; i++) {
        const proxy = proxies[i];
        
        const friendCount = proxy.friendCount;
        const scoreLevel = proxy.scoreLevel;
        const summary = proxy.summary;
        
        // Verify computed properties work
        assert.ok(typeof friendCount === 'number');
        assert.ok(typeof scoreLevel === 'number');
        assert.strictEqual(summary, `User${i}#${i}`);
        
        // Second access should use cache (no additional computation)
        const cachedSummary = proxy.summary;
        assert.strictEqual(cachedSummary, summary);
      }
      
      const computeTime = Date.now() - startTime;
      console.log(`Created and accessed ${userCount * 3} computed properties in ${computeTime}ms`);
      console.log(`Total computations: ${computeCount} (should be ${userCount * 3} for initial computation only)`);
      
      // Should have computed each property exactly once (caching working)
      assert.strictEqual(computeCount, userCount * 3);
      
      // Performance should be reasonable
      const computationsPerSecond = (userCount * 3) / computeTime * 1000;
      assert.ok(computationsPerSecond >= 100, `Computed property performance too slow: ${computationsPerSecond.toFixed(1)} computations/sec`);
    });

    it('should handle moderate relationship operation load', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' },
        ':user/manager': { valueType: 'ref' }
      };
      
      const store = createDataStore({ schema });
      
      // Create entities
      const userCount = 200;
      const users = [];
      const proxies = [];
      
      for (let i = 0; i < userCount; i++) {
        const user = store.createEntity({
          ':user/name': `User${i}`,
          ':user/index': i
        });
        users.push(user);
        proxies.push(new EntityProxy(user.entityId, store));
      }
      
      const startTime = Date.now();
      
      // Perform many relationship operations
      let operationCount = 0;
      
      // Add friendships
      for (let i = 0; i < userCount; i += 10) {
        const userProxy = proxies[i];
        
        // Add multiple friends
        for (let j = i + 1; j < Math.min(i + 5, userCount); j++) {
          userProxy.addRelation(':user/friends', proxies[j]);
          operationCount++;
        }
      }
      
      // Add manager relationships
      for (let i = 1; i < userCount; i += 20) {
        const subordinate = proxies[i];
        const manager = proxies[i - 1];
        
        subordinate.addRelation(':user/manager', manager);
        operationCount++;
      }
      
      // Remove some relationships
      for (let i = 0; i < userCount; i += 30) {
        const userProxy = proxies[i];
        const friends = userProxy.get(':user/friends');
        
        if (friends && friends.length > 0) {
          userProxy.removeRelation(':user/friends', friends[0]);
          operationCount++;
        }
      }
      
      const relationshipTime = Date.now() - startTime;
      console.log(`Performed ${operationCount} relationship operations in ${relationshipTime}ms (${(operationCount / relationshipTime * 1000).toFixed(1)} ops/sec)`);
      
      // Verify relationships work correctly
      let totalRelationships = 0;
      proxies.forEach(proxy => {
        const friends = proxy.get(':user/friends');
        const manager = proxy.get(':user/manager');
        
        if (friends && Array.isArray(friends)) {
          totalRelationships += friends.length;
          
          // Verify friend proxies are valid
          friends.forEach(friend => {
            assert.ok(friend instanceof EntityProxy);
          });
        }
        
        if (manager) {
          totalRelationships++;
          assert.ok(manager instanceof EntityProxy);
        }
      });
      
      console.log(`Total relationships created: ${totalRelationships}`);
      
      // Performance should be reasonable (at least 50 relationship ops per second)
      const opsPerSecond = operationCount / relationshipTime * 1000;
      assert.ok(opsPerSecond >= 50, `Relationship performance too slow: ${opsPerSecond.toFixed(1)} ops/sec`);
    });

    it('should handle moderate reactive subscription load', () => {
      const store = createDataStore();
      
      // Create entities
      const entityCount = 100;
      const subscriptionCount = 200; // More subscriptions than entities
      
      const entities = [];
      const proxies = [];
      
      for (let i = 0; i < entityCount; i++) {
        const entity = store.createEntity({
          ':user/name': `User${i}`,
          ':user/index': i,
          ':user/active': true
        });
        entities.push(entity);
        proxies.push(new EntityProxy(entity.entityId, store));
      }
      
      const startTime = Date.now();
      
      // Create many subscriptions
      const unsubscribeFunctions = [];
      let totalNotifications = 0;
      
      for (let i = 0; i < subscriptionCount; i++) {
        const proxyIndex = i % entityCount;
        const proxy = proxies[proxyIndex];
        
        const unsubscribe = proxy.subscribe({
          find: ['?name', '?active'],
          where: [
            ['?this', ':user/name', '?name'],
            ['?this', ':user/active', '?active']
          ]
        }, () => { totalNotifications++; });
        
        unsubscribeFunctions.push(unsubscribe);
      }
      
      const subscriptionCreationTime = Date.now() - startTime;
      
      // Trigger updates to test subscription performance
      const updateStartTime = Date.now();
      
      for (let i = 0; i < 50; i++) {
        const proxyIndex = i % entityCount;
        proxies[proxyIndex].update({ ':user/lastUpdate': Date.now() });
      }
      
      const updateTime = Date.now() - updateStartTime;
      
      console.log(`Created ${subscriptionCount} subscriptions in ${subscriptionCreationTime}ms`);
      console.log(`Performed 50 updates with subscriptions in ${updateTime}ms`);
      console.log(`Total notifications triggered: ${totalNotifications}`);
      
      // Verify subscriptions are working
      assert.ok(store._reactiveEngine.getSubscriptionCount() >= subscriptionCount);
      
      // Performance should be reasonable
      const subCreationPerSecond = subscriptionCount / subscriptionCreationTime * 1000;
      assert.ok(subCreationPerSecond >= 50, `Subscription creation too slow: ${subCreationPerSecond.toFixed(1)} subs/sec`);
      
      // Cleanup
      unsubscribeFunctions.forEach(unsub => unsub());
      store._reactiveEngine.cleanupSubscriptions();
    });

    it('should handle database growth and memory usage', () => {
      const schema = {
        ':user/profile': { valueType: 'ref' },
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      
      const store = createDataStore({ schema });
      
      const startTime = Date.now();
      let peakEntityCount = 0;
      
      // Simulate database growth over time
      const phases = 5;
      const entitiesPerPhase = 100;
      
      for (let phase = 0; phase < phases; phase++) {
        console.log(`Phase ${phase + 1}: Adding ${entitiesPerPhase} entities`);
        
        const phaseStartTime = Date.now();
        const phaseEntities = [];
        
        // Create entities for this phase
        for (let i = 0; i < entitiesPerPhase; i++) {
          const globalIndex = phase * entitiesPerPhase + i;
          const entity = store.createEntity({
            ':user/name': `User${globalIndex}`,
            ':user/phase': phase,
            ':user/index': i,
            ':user/created': Date.now()
          });
          phaseEntities.push(entity);
        }
        
        // Create some cross-phase relationships (simplified for performance test)
        if (phase > 0 && phaseEntities.length > 2) {
          // Just add a few relationships within the phase
          store.conn.transact([
            ['+', phaseEntities[0].entityId, ':user/friends', phaseEntities[1].entityId]
          ]);
        }
        
        const phaseTime = Date.now() - phaseStartTime;
        peakEntityCount = (phase + 1) * entitiesPerPhase;
        
        console.log(`Phase ${phase + 1} completed in ${phaseTime}ms. Total entities: ${peakEntityCount}`);
        
        // Test query performance at this scale
        const queryStartTime = Date.now();
        
        for (let i = 0; i < 10; i++) {
          const entityIndex = Math.floor(Math.random() * phaseEntities.length);
          const proxy = new EntityProxy(phaseEntities[entityIndex].entityId, store);
          
          const userData = proxy.query({
            find: ['?name', '?phase'],
            where: [
              ['?this', ':user/name', '?name'],
              ['?this', ':user/phase', '?phase']
            ]
          });
          
          assert.strictEqual(userData.length, 1);
          assert.strictEqual(userData[0][1], phase);
        }
        
        const queryTime = Date.now() - queryStartTime;
        console.log(`10 random queries in phase ${phase + 1}: ${queryTime}ms`);
        
        // Query performance should not degrade significantly
        assert.ok(queryTime < 1000, `Query performance degraded: ${queryTime}ms for 10 queries`);
      }
      
      const totalTime = Date.now() - startTime;
      console.log(`Total test time: ${totalTime}ms for ${peakEntityCount} entities`);
      
      // Final database size check
      const finalDatomCount = store.db().datoms(':eavt').length;
      console.log(`Final database size: ${finalDatomCount} datoms`);
      
      // Should handle the full load
      assert.ok(peakEntityCount >= phases * entitiesPerPhase);
      assert.ok(finalDatomCount >= peakEntityCount * 3); // At least 3 datoms per entity
    });
  });

  describe('Concurrent Operation Performance', () => {
    it('should handle concurrent proxy operations efficiently', () => {
      const store = createDataStore();
      
      // Create entities
      const entityCount = 100;
      const entities = [];
      const proxies = [];
      
      for (let i = 0; i < entityCount; i++) {
        const entity = store.createEntity({
          ':user/name': `User${i}`,
          ':user/index': i,
          ':user/score': 0
        });
        entities.push(entity);
        proxies.push(new EntityProxy(entity.entityId, store));
      }
      
      const startTime = Date.now();
      
      // Simulate concurrent operations
      const operations = [];
      
      // Property access operations
      for (let i = 0; i < 500; i++) {
        operations.push(() => {
          const proxy = proxies[i % entityCount];
          proxy.get(':user/name');
          proxy.get(':user/index');
          proxy.get(':user/score');
        });
      }
      
      // Update operations
      for (let i = 0; i < 200; i++) {
        operations.push(() => {
          const proxy = proxies[i % entityCount];
          proxy.update({ ':user/score': i });
        });
      }
      
      // Query operations
      for (let i = 0; i < 100; i++) {
        operations.push(() => {
          const proxy = proxies[i % entityCount];
          proxy.query({
            find: ['?name', '?score'],
            where: [
              ['?this', ':user/name', '?name'],
              ['?this', ':user/score', '?score']
            ]
          });
        });
      }
      
      // Execute all operations
      operations.forEach(op => op());
      
      const operationTime = Date.now() - startTime;
      console.log(`Executed ${operations.length} concurrent operations in ${operationTime}ms (${(operations.length / operationTime * 1000).toFixed(1)} ops/sec)`);
      
      // Verify system consistency after concurrent operations
      proxies.forEach((proxy, index) => {
        assert.ok(proxy.isValid());
        assert.strictEqual(proxy.get(':user/name'), `User${index}`);
        assert.strictEqual(proxy.get(':user/index'), index);
      });
      
      // Performance should be reasonable
      const opsPerSecond = operations.length / operationTime * 1000;
      assert.ok(opsPerSecond >= 500, `Concurrent operation performance too slow: ${opsPerSecond.toFixed(1)} ops/sec`);
    });

    it('should maintain performance with many active subscriptions', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' }
      };
      
      const store = createDataStore({ schema });
      
      // Create entities
      const userCount = 50;
      const subscriptionsPerUser = 3;
      
      const users = [];
      const proxies = [];
      
      for (let i = 0; i < userCount; i++) {
        const user = store.createEntity({
          ':user/name': `User${i}`,
          ':user/index': i
        });
        users.push(user);
        proxies.push(new EntityProxy(user.entityId, store));
      }
      
      const setupStartTime = Date.now();
      
      // Create many subscriptions
      const unsubscribeFunctions = [];
      let notificationCount = 0;
      
      proxies.forEach(proxy => {
        for (let sub = 0; sub < subscriptionsPerUser; sub++) {
          const unsubscribe = proxy.subscribe({
            find: ['?name', '?index'],
            where: [
              ['?this', ':user/name', '?name'],
              ['?this', ':user/index', '?index']
            ]
          }, () => { notificationCount++; });
          
          unsubscribeFunctions.push(unsubscribe);
        }
      });
      
      const setupTime = Date.now() - setupStartTime;
      const totalSubscriptions = userCount * subscriptionsPerUser;
      
      console.log(`Set up ${totalSubscriptions} subscriptions in ${setupTime}ms`);
      
      // Perform updates with many active subscriptions
      const updateStartTime = Date.now();
      const updateCount = 50;
      
      for (let i = 0; i < updateCount; i++) {
        const proxy = proxies[i % userCount];
        proxy.update({ ':user/lastUpdate': i });
      }
      
      const updateTime = Date.now() - updateStartTime;
      
      console.log(`Performed ${updateCount} updates with ${totalSubscriptions} active subscriptions in ${updateTime}ms`);
      console.log(`Notifications triggered: ${notificationCount}`);
      
      // Performance should not degrade significantly with many subscriptions
      const updatesPerSecond = updateCount / updateTime * 1000;
      assert.ok(updatesPerSecond >= 25, `Update performance with subscriptions too slow: ${updatesPerSecond.toFixed(1)} updates/sec`);
      
      // Cleanup
      unsubscribeFunctions.forEach(unsub => unsub());
      store._reactiveEngine.cleanupSubscriptions();
    });

    it('should handle memory cleanup efficiently', () => {
      const store = createDataStore();
      
      const cycles = 5;
      const entitiesPerCycle = 100;
      
      for (let cycle = 0; cycle < cycles; cycle++) {
        console.log(`Memory test cycle ${cycle + 1}`);
        
        const cycleStartTime = Date.now();
        
        // Create entities and proxies
        const cycleProxies = [];
        for (let i = 0; i < entitiesPerCycle; i++) {
          const entity = store.createEntity({
            ':user/name': `Cycle${cycle}User${i}`,
            ':user/cycle': cycle,
            ':user/index': i
          });
          
          const proxy = new EntityProxy(entity.entityId, store);
          cycleProxies.push(proxy);
          
          // Add resources to each proxy
          proxy.onChange(() => {});
          proxy.onDelete(() => {});
          
          const dummyQuery = { find: ['?name'], where: [['?this', ':user/name', '?name']] };
          const unsub = proxy.subscribe(dummyQuery, () => {});
          
          proxy.computed('cycleSummary', {
            find: ['?name', '?cycle'],
            where: [
              ['?this', ':user/name', '?name'],
              ['?this', ':user/cycle', '?cycle']
            ]
          }, (results) => results.length > 0 ? `${results[0][0]} from cycle ${results[0][1]}` : 'Unknown');
          
          // Trigger computation
          proxy.cycleSummary;
        }
        
        const cycleSetupTime = Date.now() - cycleStartTime;
        
        // Delete all entities from this cycle
        const deleteStartTime = Date.now();
        
        cycleProxies.forEach(proxy => {
          proxy.delete();
        });
        
        const deleteTime = Date.now() - deleteStartTime;
        
        // Cleanup
        const cleanupStartTime = Date.now();
        store._cleanupProxies();
        const subscriptionCleanup = store._reactiveEngine.cleanupSubscriptions();
        const cleanupTime = Date.now() - cleanupStartTime;
        
        console.log(`Cycle ${cycle + 1}: Setup ${cycleSetupTime}ms, Delete ${deleteTime}ms, Cleanup ${cleanupTime}ms`);
        
        // Verify cleanup worked
        cycleProxies.forEach(proxy => {
          assert.ok(!proxy.isValid());
          assert.strictEqual(proxy._getEventListenerCount(), 0);
          assert.strictEqual(proxy._getActiveSubscriptionCount(), 0);
        });
        
        // Performance should be reasonable
        assert.ok(cycleSetupTime < 5000, `Cycle setup too slow: ${cycleSetupTime}ms`);
        assert.ok(deleteTime < 2000, `Deletion too slow: ${deleteTime}ms`);
        assert.ok(cleanupTime < 1000, `Cleanup too slow: ${cleanupTime}ms`);
      }
      
      console.log(`Completed ${cycles} memory cycles with ${entitiesPerCycle} entities each`);
    });
  });
});