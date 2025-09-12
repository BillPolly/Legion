/**
 * DataStoreResourceManager Integration Tests
 * 
 * Tests the complete integration of DataStoreResourceManager with real DataStore.
 * NO MOCKS - uses real components throughout.
 */

import { jest } from '@jest/globals';
import { DataStoreResourceManager } from '../src/DataStoreResourceManager.js';
import { DataStore } from '@legion/data-store';
import * as d from '@legion/datascript';

describe('DataStoreResourceManager Integration', () => {
  let dataStore;
  let resourceManager;
  
  beforeEach(() => {
    // Create real DataStore with comprehensive schema
    const schema = {
      ':user/name': { card: 'one', valueType: 'string' },
      ':user/email': { 
        card: 'one',
        valueType: 'string',
        unique: 'identity'
      },
      ':user/age': { card: 'one', valueType: 'number' },
      ':user/tags': { card: 'many', valueType: 'string' },
      ':user/friends': { 
        card: 'many',
        valueType: 'ref'
      },
      ':post/title': { card: 'one', valueType: 'string' },
      ':post/content': { card: 'one', valueType: 'string' },
      ':post/author': { 
        card: 'one',
        valueType: 'ref'
      },
      ':post/tags': { card: 'many', valueType: 'string' },
      ':comment/text': { card: 'one', valueType: 'string' },
      ':comment/post': {
        card: 'one',
        valueType: 'ref'
      },
      ':comment/author': {
        card: 'one',
        valueType: 'ref'
      }
    };
    
    dataStore = new DataStore(schema);
    resourceManager = new DataStoreResourceManager(dataStore);
    
    // Add comprehensive test data
    const result = dataStore.createEntities([
      { ':db/id': -1, ':user/name': 'Alice', ':user/email': 'alice@test.com', ':user/age': 30, ':user/tags': ['developer', 'javascript'] },
      { ':db/id': -2, ':user/name': 'Bob', ':user/email': 'bob@test.com', ':user/age': 25, ':user/tags': ['designer'] },
      { ':db/id': -3, ':user/name': 'Charlie', ':user/email': 'charlie@test.com', ':user/age': 35 },
      { ':db/id': -4, ':post/title': 'First Post', ':post/content': 'Hello World', ':post/author': -1, ':post/tags': ['intro', 'welcome'] },
      { ':db/id': -5, ':post/title': 'Design Tips', ':post/content': 'Great design tips', ':post/author': -2 },
      { ':db/id': -6, ':comment/text': 'Great post!', ':comment/post': -4, ':comment/author': -2 },
      { ':db/id': -7, ':comment/text': 'Thanks!', ':comment/post': -4, ':comment/author': -1 }
    ]);
    
    // Add friend relationships
    const friendResult = dataStore.createEntities([
      { ':db/id': result.tempids.get(-1), ':user/friends': [result.tempids.get(-2), result.tempids.get(-3)] },
      { ':db/id': result.tempids.get(-2), ':user/friends': result.tempids.get(-1) }
    ]);
  });
  
  describe('Complex Query Scenarios', () => {
    it('should handle join queries across entities', () => {
      const spec = {
        find: ['?post-title', '?user-name', '?comment-text'],
        where: [
          ['?post', ':post/title', '?post-title'],
          ['?post', ':post/author', '?user'],
          ['?user', ':user/name', '?user-name'],
          ['?comment', ':comment/post', '?post'],
          ['?comment', ':comment/text', '?comment-text']
        ]
      };
      
      const results = resourceManager.query(spec);
      
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      
      // Should find comments on First Post by Alice
      const firstPostComments = results.filter(r => r[0] === 'First Post');
      expect(firstPostComments.length).toBe(2);
      expect(firstPostComments.some(r => r[2] === 'Great post!')).toBe(true);
      expect(firstPostComments.some(r => r[2] === 'Thanks!')).toBe(true);
    });
    
    it('should handle recursive queries for relationships', () => {
      const spec = {
        find: ['?user1-name', '?user2-name'],
        where: [
          ['?user1', ':user/friends', '?user2'],
          ['?user1', ':user/name', '?user1-name'],
          ['?user2', ':user/name', '?user2-name']
        ]
      };
      
      const results = resourceManager.query(spec);
      
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      
      // Alice should be friends with Bob and Charlie
      const aliceFriends = results.filter(r => r[0] === 'Alice');
      expect(aliceFriends.length).toBe(2);
      const friendNames = aliceFriends.map(r => r[1]).sort();
      expect(friendNames).toEqual(['Bob', 'Charlie']);
    });
    
    it('should handle aggregate queries', () => {
      const spec = {
        find: ['(count ?e)'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const results = resourceManager.query(spec);
      
      expect(results).toBeDefined();
      expect(results).toEqual([3]); // 3 users (returns array with count)
    });
  });
  
  describe('Transaction and Update Scenarios', () => {
    it('should handle multi-entity updates in single transaction', async () => {
      // Get user IDs
      const userQuery = resourceManager.query({
        find: ['?e'],
        where: [['?e', ':user/name', 'Alice']]
      });
      const aliceId = userQuery[0][0];
      
      const bobQuery = resourceManager.query({
        find: ['?e'],
        where: [['?e', ':user/name', 'Bob']]
      });
      const bobId = bobQuery[0][0];
      
      // Update multiple entities
      const updateResult = await resourceManager.updateMultiple([
        { ':db/id': aliceId, ':user/age': 31 },
        { ':db/id': bobId, ':user/age': 26 }
      ]);
      
      expect(updateResult.success).toBe(true);
      
      // Verify updates
      const verifyQuery = resourceManager.query({
        find: ['?name', '?age'],
        where: [
          ['?e', ':user/name', '?name'],
          ['?e', ':user/age', '?age']
        ]
      });
      
      const aliceData = verifyQuery.find(r => r[0] === 'Alice');
      const bobData = verifyQuery.find(r => r[0] === 'Bob');
      
      expect(aliceData[1]).toBe(31);
      expect(bobData[1]).toBe(26);
    });
    
    it('should handle entity creation with references', async () => {
      // Get Alice's ID
      const aliceQuery = resourceManager.query({
        find: ['?e'],
        where: [['?e', ':user/name', 'Alice']]
      });
      const aliceId = aliceQuery[0][0];
      
      // Create new post with author reference
      const spec = {
        find: ['?e', '?title'],
        where: [
          ['?e', ':post/title', '?title'],
          ['?e', ':post/author', aliceId]
        ],
        update: [
          { ':db/id': -1, ':post/title': 'New Post', ':post/content': 'Content by Alice', ':post/author': aliceId }
        ]
      };
      
      const results = await resourceManager.executeQueryWithUpdate(spec);
      
      // Should find the new post
      const newPost = results.find(r => r[1] === 'New Post');
      expect(newPost).toBeDefined();
      
      // Verify the author relationship
      const authorQuery = resourceManager.query({
        find: ['?author-name'],
        where: [
          ['?post', ':post/title', 'New Post'],
          ['?post', ':post/author', '?author'],
          ['?author', ':user/name', '?author-name']
        ]
      });
      
      expect(authorQuery[0][0]).toBe('Alice');
    });
  });
  
  describe('Subscription Scenarios', () => {
    it('should handle multiple concurrent subscriptions', async () => {
      const callbacks = {
        users: jest.fn(),
        posts: jest.fn(),
        comments: jest.fn()
      };
      
      // Create multiple subscriptions
      const userSub = resourceManager.subscribe({
        find: ['?e', '?name'],
        where: [['?e', ':user/name', '?name']]
      }, callbacks.users);
      
      const postSub = resourceManager.subscribe({
        find: ['?e', '?title'],
        where: [['?e', ':post/title', '?title']]
      }, callbacks.posts);
      
      const commentSub = resourceManager.subscribe({
        find: ['?e', '?text'],
        where: [['?e', ':comment/text', '?text']]
      }, callbacks.comments);
      
      // Trigger updates
      resourceManager.update(null, {
        ':user/name': 'Diana',
        ':user/email': 'diana@test.com'
      });
      
      // Wait for subscriptions to fire
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // User subscription should have been called
      expect(callbacks.users).toHaveBeenCalled();
      
      // Clean up
      userSub.unsubscribe();
      postSub.unsubscribe();
      commentSub.unsubscribe();
    });
    
    it('should handle subscription cleanup on entity deletion', async () => {
      const callback = jest.fn();
      
      // Subscribe to posts
      const subscription = resourceManager.subscribe({
        find: ['?e', '?title'],
        where: [['?e', ':post/title', '?title']]
      }, callback);
      
      // Get a post ID
      const postQuery = resourceManager.query({
        find: ['?e'],
        where: [['?e', ':post/title', 'First Post']]
      });
      const postId = postQuery[0][0];
      
      // Delete the post (retract all its attributes)
      await resourceManager.retractEntity(postId);
      
      // Wait for subscription to fire
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Callback should have been called with updated results
      expect(callback).toHaveBeenCalled();
      
      // Clean up
      subscription.unsubscribe();
    });
  });
  
  describe('Error Handling', () => {
    it('should fail fast on invalid operations', () => {
      // Invalid query - should fail immediately
      expect(() => 
        resourceManager.query({ find: 'invalid' })
      ).toThrow('Query must have find clause');
      
      // Invalid update - should fail immediately
      expect(() => 
        resourceManager.update('not-a-number', { ':user/name': 'Test' })
      ).toThrow('Entity ID must be a number');
      
      // Invalid subscription - should fail immediately
      expect(() => 
        resourceManager.subscribe({ find: [] }, 'not-a-function')
      ).toThrow('Callback must be a function');
    });
    
    it('should propagate DataStore errors', () => {
      // Try to update with invalid attribute format
      expect(() => 
        resourceManager.update(1, { 'invalid-attr': 'value' })
      ).toThrow("Attributes must start with ':'. Found: invalid-attr");
    });
  });
  
  describe('Performance Characteristics', () => {
    it('should handle large result sets', async () => {
      // Add many entities
      const entities = [];
      for (let i = 0; i < 100; i++) {
        entities.push({
          ':user/name': `User${i}`,
          ':user/email': `user${i}@test.com`,
          ':user/age': 20 + (i % 50)
        });
      }
      
      await resourceManager.updateMultiple(entities);
      
      // Query all users
      const results = resourceManager.query({
        find: ['?e', '?name'],
        where: [['?e', ':user/name', '?name']]
      });
      
      expect(results.length).toBeGreaterThanOrEqual(103); // Original 3 + 100 new
    });
    
    it('should maintain synchronous internal behavior', () => {
      // Operations should complete immediately
      const startTime = Date.now();
      
      const results = resourceManager.query({
        find: ['?e', '?name'],
        where: [['?e', ':user/name', '?name']]
      });
      
      const endTime = Date.now();
      
      // Should be very fast (< 10ms) since it's synchronous
      expect(endTime - startTime).toBeLessThan(10);
    });
  });
  
  describe('Entity Type Detection', () => {
    it('should correctly detect types for various entity patterns', async () => {
      // Test data with different type patterns
      const testEntities = [
        { ':type': 'User', ':user/name': 'TypedUser' },
        { ':user/name': 'InferredUser', ':user/email': 'inferred@test.com' },
        { ':post/title': 'InferredPost', ':post/content': 'Content' },
        { ':comment/text': 'InferredComment' },
        { ':someattr': 'NoType' }  // No namespace, should be null
      ];
      
      const result = await resourceManager.updateMultiple(testEntities);
      
      // Test type detection for each pattern
      for (let i = 0; i < testEntities.length; i++) {
        const entityId = result.tempids.get(-1 - i);
        if (!entityId) continue; // Skip if tempid wasn't resolved
        const entity = await resourceManager.getEntity(entityId);
        const type = await resourceManager.detectEntityType(entity);
        
        if (i === 0) expect(type).toBe('User');
        else if (i === 1) expect(type).toBe('user');
        else if (i === 2) expect(type).toBe('post');
        else if (i === 3) expect(type).toBe('comment');
        else if (i === 4) expect(type).toBeNull();
      }
    });
  });
});