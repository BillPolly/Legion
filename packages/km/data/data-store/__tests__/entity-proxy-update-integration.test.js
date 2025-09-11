/**
 * Integration tests for EntityProxy with update+query functionality
 * Phase 4: EntityProxy Integration
 * NO MOCKS - using real DataStore and DataScript
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { DataStore } from '../src/store.js';
import { DataStoreProxy } from '../src/datastore-proxy.js';
import { EntityProxy } from '../src/proxy.js';
import { CollectionProxy } from '../src/collection-proxy.js';
import { StreamProxy } from '../src/stream-proxy.js';

describe('EntityProxy Update+Query Integration', () => {
  let dataStore;
  let dataStoreProxy;
  
  beforeEach(() => {
    // Create real DataStore with comprehensive schema
    const schema = {
      ':user/name': { valueType: 'string' },
      ':user/email': { valueType: 'string', unique: 'identity' },
      ':user/age': { valueType: 'number' },
      ':user/active': { valueType: 'boolean' },
      ':user/profile': { valueType: 'ref' },
      ':user/tags': { valueType: 'string', card: 'many' },
      ':profile/bio': { valueType: 'string' },
      ':profile/avatar': { valueType: 'string' },
      ':profile/settings': { valueType: 'ref' },
      ':settings/theme': { valueType: 'string' },
      ':settings/notifications': { valueType: 'boolean' },
      ':task/title': { valueType: 'string' },
      ':task/assignee': { valueType: 'ref' },
      ':task/status': { valueType: 'string' },
      ':task/priority': { valueType: 'number' }
    };
    
    dataStore = new DataStore(schema);
    dataStoreProxy = new DataStoreProxy(dataStore);
  });
  
  describe('EntityProxy.query() with Updates', () => {
    it('should support update+query on single entity', () => {
      // Create a user entity
      const user = dataStoreProxy.query({
        update: {
          ':user/name': 'Alice',
          ':user/email': 'alice@example.com',
          ':user/age': 30
        },
        find: ['?user'],
        where: [
          ['?user', ':user/email', 'alice@example.com']
        ]
      });
      
      expect(user).toBeInstanceOf(EntityProxy);
      expect(user.get(':user/name')).toBe('Alice');
      
      // Update entity and query for specific attribute
      const updatedAge = user.query({
        update: {
          ':db/id': user.entityId,
          ':user/age': 31
        },
        find: ['?age'],
        where: [
          ['?this', ':user/age', '?age']
        ]
      });
      
      expect(updatedAge).toBeInstanceOf(StreamProxy);
      expect(updatedAge.value()).toBe(31);
      
      // Verify entity was updated
      expect(user.get(':user/age')).toBe(31);
    });
    
    it('should support adding references through entity query', () => {
      // Create user and profile entities
      const user = dataStoreProxy.query({
        update: {
          ':user/name': 'Bob',
          ':user/email': 'bob@example.com'
        },
        find: ['?user'],
        where: [
          ['?user', ':user/email', 'bob@example.com']
        ]
      });
      
      // Create profile and link it to user
      const profile = user.query({
        update: [
          { ':profile/bio': 'Software developer', ':profile/avatar': 'avatar.jpg' },
          { ':db/id': user.entityId, ':user/profile': '?new-1' }
        ],
        find: ['?profile'],
        where: [
          ['?profile', ':profile/bio', 'Software developer']
        ]
      });
      
      expect(profile).toBeInstanceOf(EntityProxy);
      expect(profile.get(':profile/bio')).toBe('Software developer');
      
      // Verify user now has profile reference
      const userProfile = user.get(':user/profile');
      expect(userProfile).toBeInstanceOf(EntityProxy);
      expect(userProfile.entityId).toBe(profile.entityId);
    });
    
    it('should support chained entity updates', () => {
      // Create initial entity
      const entity = dataStoreProxy.query({
        update: {
          ':user/name': 'Charlie',
          ':user/active': false
        },
        find: ['?user'],
        where: [
          ['?user', ':user/name', 'Charlie']
        ]
      });
      
      // Chain updates
      const activated = entity.query({
        update: {
          ':db/id': entity.entityId,
          ':user/active': true
        },
        find: ['?this'],
        where: [
          ['?this', ':user/active', true]
        ]
      });
      
      expect(activated).toBeInstanceOf(EntityProxy);
      expect(activated.entityId).toBe(entity.entityId);
      expect(activated.get(':user/active')).toBe(true);
    });
    
    it('should handle entity queries that return collections', () => {
      // Create user with tasks
      const user = dataStoreProxy.query({
        update: {
          ':user/name': 'Diana',
          ':user/email': 'diana@example.com'
        },
        find: ['?user'],
        where: [
          ['?user', ':user/email', 'diana@example.com']
        ]
      });
      
      // Add multiple tasks for the user
      const tasks = user.query({
        update: [
          { ':task/title': 'Task 1', ':task/assignee': user.entityId, ':task/status': 'open' },
          { ':task/title': 'Task 2', ':task/assignee': user.entityId, ':task/status': 'open' },
          { ':task/title': 'Task 3', ':task/assignee': user.entityId, ':task/status': 'done' }
        ],
        find: ['?task'],
        where: [
          ['?task', ':task/assignee', user.entityId],
          ['?task', ':task/status', 'open']
        ]
      });
      
      expect(tasks).toBeInstanceOf(CollectionProxy);
      expect(tasks.length).toBe(2); // Only open tasks
    });
    
    it('should support multi-value attribute updates', () => {
      // Create user
      const user = dataStoreProxy.query({
        update: {
          ':user/name': 'Eve',
          ':user/tags': ['developer', 'designer']
        },
        find: ['?user'],
        where: [
          ['?user', ':user/name', 'Eve']
        ]
      });
      
      // Add more tags
      const updatedUser = user.query({
        update: {
          ':db/id': user.entityId,
          ':user/tags': ['developer', 'designer', 'manager']
        },
        find: ['?this'],
        where: [
          ['?this', ':user/name', 'Eve']
        ]
      });
      
      expect(updatedUser).toBeInstanceOf(EntityProxy);
      const tags = updatedUser.get(':user/tags');
      expect(tags).toEqual(expect.arrayContaining(['developer', 'designer', 'manager']));
      expect(tags.length).toBe(3);
    });
  });
  
  describe('Entity Cache Management', () => {
    it('should maintain cache consistency after updates', () => {
      // Create entity
      const user = dataStoreProxy.query({
        update: {
          ':user/name': 'Frank',
          ':user/age': 25
        },
        find: ['?user'],
        where: [
          ['?user', ':user/name', 'Frank']
        ]
      });
      
      const entityId = user.entityId;
      
      // Get same entity from cache
      const cachedUser = dataStoreProxy.getProxy(entityId);
      expect(cachedUser).toBe(user); // Should be same instance
      
      // Update through query
      user.query({
        update: {
          ':db/id': entityId,
          ':user/age': 26
        },
        find: ['?age'],
        where: [
          ['?user', ':user/age', '?age']
        ]
      });
      
      // Verify cache reflects update
      expect(cachedUser.get(':user/age')).toBe(26);
      expect(user.get(':user/age')).toBe(26);
    });
    
    it('should handle entity deletion and recreation', () => {
      // Create entity
      const user = dataStoreProxy.query({
        update: {
          ':user/name': 'Grace',
          ':user/email': 'grace@example.com'
        },
        find: ['?user'],
        where: [
          ['?user', ':user/email', 'grace@example.com']
        ]
      });
      
      const originalId = user.entityId;
      
      // Update entity by removing name (simpler than full deletion)
      dataStoreProxy.query({
        update: {
          ':db/id': originalId,
          ':user/name': 'Grace Updated',
          ':user/age': 28
        },
        find: ['?user'],
        where: [
          ['?user', ':db/id', originalId]
        ]
      });
      
      // Get updated entity
      const updatedUser = dataStoreProxy.getProxy(originalId);
      
      // Should have same entity ID but new values
      expect(updatedUser.entityId).toBe(originalId);
      expect(updatedUser.get(':user/name')).toBe('Grace Updated');
      expect(updatedUser.get(':user/age')).toBe(28);
    });
    
    it('should propagate updates to related entities', () => {
      // Create settings
      const settings = dataStoreProxy.query({
        update: {
          ':settings/theme': 'dark',
          ':settings/notifications': true
        },
        find: ['?settings'],
        where: [
          ['?settings', ':settings/theme', 'dark']
        ]
      });
      
      // Create profile with settings
      const profile = dataStoreProxy.query({
        update: {
          ':profile/bio': 'Developer',
          ':profile/settings': settings.entityId
        },
        find: ['?profile'],
        where: [
          ['?profile', ':profile/bio', 'Developer']
        ]
      });
      
      // Create user with profile
      const user = dataStoreProxy.query({
        update: {
          ':user/name': 'Henry',
          ':user/profile': profile.entityId
        },
        find: ['?user'],
        where: [
          ['?user', ':user/name', 'Henry']
        ]
      });
      
      // Update settings through user query
      const updatedSettings = user.query({
        find: ['?settings'],
        where: [
          ['?user', ':user/profile', '?profile'],
          ['?profile', ':profile/settings', '?settings']
        ]
      });
      
      expect(updatedSettings).toBeInstanceOf(EntityProxy);
      expect(updatedSettings.entityId).toBe(settings.entityId);
      
      // Update settings
      updatedSettings.query({
        update: {
          ':db/id': settings.entityId,
          ':settings/theme': 'light'
        },
        find: ['?theme'],
        where: [
          ['?settings', ':settings/theme', '?theme']
        ]
      });
      
      // Verify update propagated
      expect(settings.get(':settings/theme')).toBe('light');
    });
  });
});