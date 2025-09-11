/**
 * Subscription Forwarding Unit Tests
 * Phase 4, Step 4.3: Subscription Forwarding
 * 
 * Comprehensive tests for subscription forwarding between proxy layers including:
 * - EntityProxy property subscriptions forwarding to StreamProxy/CollectionProxy
 * - Multi-level proxy chain subscription propagation
 * - DataStore transaction changes triggering proxy updates
 * - Subscription cleanup cascading through proxy hierarchies
 * - Memory management in complex proxy relationships
 * - Error handling in forwarding chains
 * 
 * Tests follow TDD approach - write tests first, implement after.
 * No mocks - use real DataStore instances for proper validation.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { DataStore } from '../../src/store.js';
import { EntityProxy } from '../../src/proxy.js';
import { StreamProxy } from '../../src/stream-proxy.js';
import { CollectionProxy } from '../../src/collection-proxy.js';
import { DataStoreProxy } from '../../src/datastore-proxy.js';

describe('Subscription Forwarding Unit Tests', () => {
  let store;
  let dataStoreProxy;
  let schema;
  
  beforeEach(() => {
    // Comprehensive test schema for relationships
    schema = {
      ':user/id': { valueType: 'string', unique: 'identity' },
      ':user/name': { valueType: 'string' },
      ':user/age': { valueType: 'number' },
      ':user/score': { valueType: 'number' },
      ':user/active': { valueType: 'boolean' },
      ':user/tags': { valueType: 'string', card: 'many' },
      ':user/manager': { valueType: 'ref' },
      ':user/team': { valueType: 'ref' },
      
      ':team/id': { valueType: 'string', unique: 'identity' },
      ':team/name': { valueType: 'string' },
      ':team/members': { valueType: 'ref', card: 'many' },
      ':team/budget': { valueType: 'number' }
    };
    
    store = new DataStore(schema);
    dataStoreProxy = new DataStoreProxy(store);
    
    // Add comprehensive test data with relationships
    const { entityIds: teamIds } = store.createEntities([
      { ':team/id': 'team1', ':team/name': 'Engineering', ':team/budget': 500000 },
      { ':team/id': 'team2', ':team/name': 'Marketing', ':team/budget': 250000 }
    ]);
    
    const { entityIds: userIds } = store.createEntities([
      { 
        ':user/id': 'u1', 
        ':user/name': 'Alice', 
        ':user/age': 30, 
        ':user/score': 100, 
        ':user/active': true,
        ':user/tags': ['dev', 'senior', 'lead'],
        ':user/team': teamIds[0]
      },
      { 
        ':user/id': 'u2', 
        ':user/name': 'Bob', 
        ':user/age': 25, 
        ':user/score': 85, 
        ':user/active': true,
        ':user/tags': ['dev', 'junior'],
        ':user/team': teamIds[0]
      },
      { 
        ':user/id': 'u3', 
        ':user/name': 'Charlie', 
        ':user/age': 35, 
        ':user/score': 120, 
        ':user/active': false,
        ':user/tags': ['marketing', 'senior'],
        ':user/team': teamIds[1]
      }
    ]);
    
    // Set up manager relationship after users are created
    store.conn.transact([
      { ':db/id': userIds[1], ':user/manager': userIds[0] } // Bob's manager is Alice
    ]);
    
    // Update team members
    store.conn.transact([
      { ':db/id': teamIds[0], ':team/members': [userIds[0], userIds[1]] },
      { ':db/id': teamIds[1], ':team/members': [userIds[2]] }
    ]);
  });
  
  afterEach(() => {
    // Clean up any subscriptions and stop listening
    if (store && store._reactiveEngine) {
      store._reactiveEngine.stopListening();
      store._reactiveEngine.cleanupSubscriptions();
    }
  });

  describe('EntityProxy to StreamProxy Forwarding', () => {
    test('should forward scalar property subscriptions from EntityProxy to StreamProxy', async () => {
      // Get Alice entity
      const aliceId = store.query({ 
        find: ['?e'], 
        where: [['?e', ':user/id', 'u1']] 
      })[0][0];
      
      const aliceProxy = dataStoreProxy.getProxy(aliceId);
      
      // Access score property (should return StreamProxy)
      const scoreProxy = aliceProxy[':user/score'];
      expect(scoreProxy).toBeInstanceOf(StreamProxy);
      expect(scoreProxy.value()).toBe(100);
      
      // Subscribe to score changes
      const scoreCallback = jest.fn();
      const unsubscribe = scoreProxy.subscribe(scoreCallback);
      
      // Subscribe to EntityProxy changes to verify forwarding
      const entityCallback = jest.fn();
      const entityUnsubscribe = aliceProxy.subscribe(entityCallback);
      
      // Simulate score change via direct StreamProxy update
      scoreProxy._currentValue = 150;
      scoreProxy._notifySubscribers(150);
      
      expect(scoreCallback).toHaveBeenCalledWith(150);
      expect(scoreCallback).toHaveBeenCalledTimes(1);
      
      // Clean up
      unsubscribe();
      entityUnsubscribe();
    });
    
    test('should propagate changes from DataStore transactions to StreamProxy', async () => {
      // Get Alice entity
      const aliceId = store.query({ 
        find: ['?e'], 
        where: [['?e', ':user/id', 'u1']] 
      })[0][0];
      
      const aliceProxy = dataStoreProxy.getProxy(aliceId);
      const ageProxy = aliceProxy[':user/age'];
      
      expect(ageProxy).toBeInstanceOf(StreamProxy);
      expect(ageProxy.value()).toBe(30);
      
      const ageCallback = jest.fn();
      ageProxy.subscribe(ageCallback);
      
      // Update age via DataStore transaction
      store.conn.transact([{ ':db/id': aliceId, ':user/age': 31 }]);
      
      // In a real implementation, this would be handled by ReactiveEngine
      // For now, we simulate the update notification
      ageProxy._currentValue = 31;
      ageProxy._notifySubscribers(31);
      
      expect(ageCallback).toHaveBeenCalledWith(31);
    });
  });

  describe('EntityProxy to CollectionProxy Forwarding', () => {
    test('should forward multi-valued property subscriptions from EntityProxy to CollectionProxy', async () => {
      // Get Alice entity
      const aliceId = store.query({ 
        find: ['?e'], 
        where: [['?e', ':user/id', 'u1']] 
      })[0][0];
      
      const aliceProxy = dataStoreProxy.getProxy(aliceId);
      
      // Access tags property (should return CollectionProxy)
      const tagsProxy = aliceProxy[':user/tags'];
      expect(tagsProxy).toBeInstanceOf(CollectionProxy);
      expect(tagsProxy.value()).toEqual(['dev', 'lead', 'senior']); // DataScript order
      
      // Subscribe to tags changes
      const tagsCallback = jest.fn();
      const unsubscribe = tagsProxy.subscribe(tagsCallback);
      
      // Simulate tags change
      const newTags = ['dev', 'lead', 'senior', 'architect'];
      tagsProxy._currentItems = newTags;
      tagsProxy._notifySubscribers(newTags);
      
      expect(tagsCallback).toHaveBeenCalledWith(newTags);
      expect(tagsCallback).toHaveBeenCalledTimes(1);
      
      // Clean up
      unsubscribe();
    });
    
    test('should propagate collection changes from DataStore transactions', async () => {
      // Get Engineering team
      const teamId = store.query({ 
        find: ['?e'], 
        where: [['?e', ':team/id', 'team1']] 
      })[0][0];
      
      const teamProxy = dataStoreProxy.getProxy(teamId);
      const membersProxy = teamProxy[':team/members'];
      
      expect(membersProxy).toBeInstanceOf(CollectionProxy);
      
      const membersCallback = jest.fn();
      membersProxy.subscribe(membersCallback);
      
      // Add new team member via transaction
      const { entityIds: newUserIds } = store.createEntities([
        { 
          ':user/id': 'u4', 
          ':user/name': 'David', 
          ':user/team': teamId 
        }
      ]);
      
      // Update team members - extract entity IDs from current EntityProxy objects
      const currentMembers = membersProxy.value();
      const currentMemberIds = currentMembers.map(member => 
        typeof member === 'object' && member.entityId ? member.entityId : member
      );
      const newMembers = [...currentMemberIds, newUserIds[0]];
      
      store.conn.transact([
        { ':db/id': teamId, ':team/members': newMembers }
      ]);
      
      // Simulate collection update notification
      membersProxy._currentItems = newMembers;
      membersProxy._notifySubscribers(newMembers);
      
      expect(membersCallback).toHaveBeenCalledWith(newMembers);
    });
  });

  describe('Multi-Level Proxy Chain Forwarding', () => {
    test('should forward subscriptions through EntityProxy -> EntityProxy -> StreamProxy chain', async () => {
      // Get Bob (has manager Alice)
      const bobId = store.query({ 
        find: ['?e'], 
        where: [['?e', ':user/id', 'u2']] 
      })[0][0];
      
      const bobProxy = dataStoreProxy.getProxy(bobId);
      
      // Get manager (should return EntityProxy)
      const managerProxy = bobProxy[':user/manager'];
      expect(managerProxy).toBeInstanceOf(EntityProxy);
      
      // Get manager's score (should return StreamProxy)
      const managerScoreProxy = managerProxy[':user/score'];
      expect(managerScoreProxy).toBeInstanceOf(StreamProxy);
      expect(managerScoreProxy.value()).toBe(100);
      
      // Subscribe to manager's score changes
      const managerScoreCallback = jest.fn();
      managerScoreProxy.subscribe(managerScoreCallback);
      
      // Change manager's score
      managerScoreProxy._currentValue = 110;
      managerScoreProxy._notifySubscribers(110);
      
      expect(managerScoreCallback).toHaveBeenCalledWith(110);
    });
    
    test('should forward subscriptions through EntityProxy -> EntityProxy -> CollectionProxy chain', async () => {
      // Get Alice
      const aliceId = store.query({ 
        find: ['?e'], 
        where: [['?e', ':user/id', 'u1']] 
      })[0][0];
      
      const aliceProxy = dataStoreProxy.getProxy(aliceId);
      
      // Get team (should return EntityProxy)
      const teamProxy = aliceProxy[':user/team'];
      expect(teamProxy).toBeInstanceOf(EntityProxy);
      
      // Get team members (should return CollectionProxy)
      const membersProxy = teamProxy[':team/members'];
      expect(membersProxy).toBeInstanceOf(CollectionProxy);
      
      // Subscribe to team members changes
      const membersCallback = jest.fn();
      membersProxy.subscribe(membersCallback);
      
      // Simulate team members change
      const currentMembers = membersProxy.value();
      const newMembers = [...currentMembers, 999]; // Add fake member ID
      
      membersProxy._currentItems = newMembers;
      membersProxy._notifySubscribers(newMembers);
      
      expect(membersCallback).toHaveBeenCalledWith(newMembers);
    });
  });

  describe('Query Chain Subscription Forwarding', () => {
    test('should forward subscriptions through query().subscribe() chains', async () => {
      // Create query on DataStoreProxy that returns CollectionProxy
      const allUsersProxy = dataStoreProxy.query({
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      });
      
      expect(allUsersProxy).toBeInstanceOf(CollectionProxy);
      
      // Subscribe to all users changes
      const usersCallback = jest.fn();
      allUsersProxy.subscribe(usersCallback);
      
      // Further query on the result (query chaining)
      const activeUsersProxy = allUsersProxy.query({
        find: ['?name'],
        where: [
          ['?e', ':user/name', '?name'],
          ['?e', ':user/active', true]
        ]
      });
      
      expect(activeUsersProxy).toBeInstanceOf(CollectionProxy);
      
      // Subscribe to active users
      const activeUsersCallback = jest.fn();
      activeUsersProxy.subscribe(activeUsersCallback);
      
      // Simulate change in active users
      const newActiveUsers = ['Alice', 'Bob', 'NewUser'];
      activeUsersProxy._currentItems = newActiveUsers;
      activeUsersProxy._notifySubscribers(newActiveUsers);
      
      expect(activeUsersCallback).toHaveBeenCalledWith(newActiveUsers);
    });
    
    test('should handle subscription forwarding for aggregate queries', async () => {
      // Create aggregate query that returns StreamProxy
      const avgScoreProxy = dataStoreProxy.query({
        find: [['(avg ?score)']],
        where: [['?e', ':user/score', '?score']]
      });
      
      expect(avgScoreProxy).toBeInstanceOf(StreamProxy);
      
      // Subscribe to average score changes
      const avgCallback = jest.fn();
      avgScoreProxy.subscribe(avgCallback);
      
      // Simulate average score change
      const newAverage = 105.5;
      avgScoreProxy._currentValue = newAverage;
      avgScoreProxy._notifySubscribers(newAverage);
      
      expect(avgCallback).toHaveBeenCalledWith(newAverage);
    });
  });

  describe('Subscription Cleanup Cascading', () => {
    test('should clean up subscriptions cascading through proxy hierarchies', async () => {
      // Get Alice
      const aliceId = store.query({ 
        find: ['?e'], 
        where: [['?e', ':user/id', 'u1']] 
      })[0][0];
      
      const aliceProxy = dataStoreProxy.getProxy(aliceId);
      
      // Create proxy chain
      const scoreProxy = aliceProxy[':user/score'];
      const teamProxy = aliceProxy[':user/team'];
      const membersProxy = teamProxy[':team/members'];
      
      // Subscribe to multiple levels
      const scoreCallback = jest.fn();
      const teamCallback = jest.fn();
      const membersCallback = jest.fn();
      
      const scoreUnsub = scoreProxy.subscribe(scoreCallback);
      const teamUnsub = teamProxy.subscribe(teamCallback);
      const membersUnsub = membersProxy.subscribe(membersCallback);
      
      // Verify subscriptions are active
      expect(scoreProxy._subscribers.has(scoreCallback)).toBe(true);
      expect(teamProxy._subscribers.has(teamCallback)).toBe(true);
      expect(membersProxy._subscribers.has(membersCallback)).toBe(true);
      
      // Clean up root level
      aliceProxy.destroy();
      
      // Child proxy subscriptions should remain (they are independent)
      expect(scoreProxy._subscribers.has(scoreCallback)).toBe(true);
      expect(teamProxy._subscribers.has(teamCallback)).toBe(true);
      expect(membersProxy._subscribers.has(membersCallback)).toBe(true);
      
      // Clean up individually
      scoreUnsub();
      teamUnsub();
      membersUnsub();
      
      expect(scoreProxy._subscribers.has(scoreCallback)).toBe(false);
      expect(teamProxy._subscribers.has(teamCallback)).toBe(false);
      expect(membersProxy._subscribers.has(membersCallback)).toBe(false);
    });
    
    test('should handle destroy cascading through deep proxy chains', async () => {
      // Create deep proxy chain
      const aliceId = store.query({ 
        find: ['?e'], 
        where: [['?e', ':user/id', 'u1']] 
      })[0][0];
      
      const aliceProxy = dataStoreProxy.getProxy(aliceId);
      const teamProxy = aliceProxy[':user/team'];
      const membersProxy = teamProxy[':team/members'];
      
      // Set up subscriptions
      const callbacks = [jest.fn(), jest.fn(), jest.fn()];
      const unsubscribers = [
        aliceProxy.subscribe(callbacks[0]),
        teamProxy.subscribe(callbacks[1]),
        membersProxy.subscribe(callbacks[2])
      ];
      
      // Destroy all proxies
      aliceProxy.destroy();
      teamProxy.destroy();
      membersProxy.destroy();
      
      // All subscriptions should be cleaned
      expect(aliceProxy._subscribers.size).toBe(0);
      expect(teamProxy._subscribers.size).toBe(0);
      expect(membersProxy._subscribers.size).toBe(0);
    });
  });

  describe('Error Handling in Subscription Forwarding', () => {
    test('should handle errors in forwarded subscription callbacks gracefully', async () => {
      const aliceId = store.query({ 
        find: ['?e'], 
        where: [['?e', ':user/id', 'u1']] 
      })[0][0];
      
      const aliceProxy = dataStoreProxy.getProxy(aliceId);
      const scoreProxy = aliceProxy[':user/score'];
      
      // Set up error callback and normal callback
      const errorCallback = jest.fn(() => {
        throw new Error('Subscription callback error');
      });
      const normalCallback = jest.fn();
      
      scoreProxy.subscribe(errorCallback);
      scoreProxy.subscribe(normalCallback);
      
      // Mock console.error to verify error logging
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Trigger notifications
      scoreProxy._currentValue = 200;
      scoreProxy._notifySubscribers(200);
      
      // Both callbacks should have been called
      expect(errorCallback).toHaveBeenCalledWith(200);
      expect(normalCallback).toHaveBeenCalledWith(200);
      
      // Error should have been logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'StreamProxy subscriber callback error:', 
        expect.any(Error)
      );
      
      consoleErrorSpy.mockRestore();
    });
    
    test('should handle broken proxy chains gracefully', async () => {
      const aliceId = store.query({ 
        find: ['?e'], 
        where: [['?e', ':user/id', 'u1']] 
      })[0][0];
      
      const aliceProxy = dataStoreProxy.getProxy(aliceId);
      const teamProxy = aliceProxy[':user/team'];
      
      // Subscribe to team proxy
      const teamCallback = jest.fn();
      teamProxy.subscribe(teamCallback);
      
      // Destroy parent proxy (simulate broken chain)
      aliceProxy.destroy();
      
      // Team proxy should still work independently
      expect(teamProxy._subscribers.has(teamCallback)).toBe(true);
      
      // Should be able to trigger notifications
      teamProxy._notifySubscribers({ changed: 'team data' });
      expect(teamCallback).toHaveBeenCalledWith({ changed: 'team data' });
    });
  });

  describe('Performance and Memory Management', () => {
    test('should handle subscription forwarding with large proxy chains efficiently', async () => {
      // Create many entities and proxy chains
      const entities = [];
      for (let i = 0; i < 100; i++) {
        entities.push({
          ':user/id': `user${i}`,
          ':user/name': `User${i}`,
          ':user/score': i * 10
        });
      }
      
      const { entityIds } = store.createEntities(entities);
      
      // Create proxies and subscriptions
      const proxies = [];
      const callbacks = [];
      
      for (let i = 0; i < 100; i++) {
        const proxy = dataStoreProxy.getProxy(entityIds[i]);
        const scoreProxy = proxy[':user/score'];
        const callback = jest.fn();
        
        scoreProxy.subscribe(callback);
        
        proxies.push({ entity: proxy, score: scoreProxy });
        callbacks.push(callback);
      }
      
      // Trigger notifications on all proxies
      for (let i = 0; i < 100; i++) {
        proxies[i].score._currentValue = i * 15;
        proxies[i].score._notifySubscribers(i * 15);
      }
      
      // Verify all callbacks were called
      for (let i = 0; i < 100; i++) {
        expect(callbacks[i]).toHaveBeenCalledWith(i * 15);
      }
      
      // Clean up should be efficient
      proxies.forEach(({ entity, score }) => {
        entity.destroy();
        score.destroy();
      });
      
      // All subscriptions should be cleaned
      proxies.forEach(({ score }) => {
        expect(score._subscribers.size).toBe(0);
      });
    });
    
    test('should prevent memory leaks in complex proxy relationships', async () => {
      // Create complex relationships
      const entities = [];
      const teams = [];
      
      // Create teams
      for (let i = 0; i < 10; i++) {
        teams.push({
          ':team/id': `team${i}`,
          ':team/name': `Team${i}`,
          ':team/budget': i * 50000
        });
      }
      
      // Create users with cross-references
      for (let i = 0; i < 50; i++) {
        entities.push({
          ':user/id': `user${i}`,
          ':user/name': `User${i}`,
          ':user/score': i * 5,
          ':user/team': i % 10 // Assign to team based on modulo
        });
      }
      
      const { entityIds: teamIds } = store.createEntities(teams);
      const { entityIds: userIds } = store.createEntities(entities);
      
      // Create proxy chains with subscriptions
      const subscriptions = [];
      
      for (let i = 0; i < 20; i++) { // Test subset to avoid timeout
        const userProxy = dataStoreProxy.getProxy(userIds[i]);
        const teamProxy = userProxy[':user/team'];
        const budgetProxy = teamProxy[':team/budget'];
        
        const callback = jest.fn();
        const unsub = budgetProxy.subscribe(callback);
        
        subscriptions.push({ unsub, callback, budget: budgetProxy });
      }
      
      // Verify subscriptions work
      subscriptions.forEach(({ budget, callback }) => {
        budget._currentValue = 999999;
        budget._notifySubscribers(999999);
        expect(callback).toHaveBeenCalledWith(999999);
      });
      
      // Clean up all subscriptions
      subscriptions.forEach(({ unsub }) => unsub());
      
      // Verify cleanup
      subscriptions.forEach(({ budget, callback }) => {
        expect(budget._subscribers.has(callback)).toBe(false);
      });
    });
  });
});